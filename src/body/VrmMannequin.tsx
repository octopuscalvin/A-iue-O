import { Fragment, useEffect, useMemo } from 'react'
import { createPortal, useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm'
import { useApp } from '../store'
import { boneObjects, BONE_MAP, type V3 } from './skeleton'
import { ZONES, type ZoneId } from './zones'
import type { Ring } from './loft'
import { proceduralProfile, setProfile, type BodyProfile } from './bodyProfile'
import { buildSurface, type BodySurface } from './surface'
import { DEFAULT_FIGURE } from './figure'
import { rig, Socket } from './Mannequin'
import { vrmModel, vrmUrl } from './vrmModels'

/**
 * VRM 模型假人（例如由 VRoid Studio 匯出）。
 * - 自動縮放到 160cm
 * - 由 T-pose 擺成雙手自然垂低；揀手腕時舉起隻手
 * - 掛點跟住模型骨頭
 * - 載入時直接量度模型：手腕、腳腕、上臂、頸嘅圍度，同軀幹形狀（頸鏈貼身用）
 */
/** 網上版可以唔包 VRM（授權：唔准轉發），發佈時設定 VITE_HAS_VRM=false */
export const HAS_VRM = import.meta.env.VITE_HAS_VRM !== 'false'
const TARGET_HEIGHT = 1.6

/** 我哋骨架名 → VRM 標準骨名 */
const MAP: Record<string, VRMHumanBoneName> = {
  pelvis: 'hips', spine: 'spine', chest: 'upperChest', neck: 'neck', head: 'head',
  upperArm_L: 'leftUpperArm', forearm_L: 'leftLowerArm', hand_L: 'leftHand',
  upperArm_R: 'rightUpperArm', forearm_R: 'rightLowerArm', hand_R: 'rightHand',
  thigh_L: 'leftUpperLeg', shin_L: 'leftLowerLeg', foot_L: 'leftFoot',
  thigh_R: 'rightUpperLeg', shin_R: 'rightLowerLeg', foot_R: 'rightFoot',
}
/** 每條骨「指向」邊條子骨（用嚟計骨頭方向） */
const CHILD: Record<string, VRMHumanBoneName> = {
  upperArm_L: 'leftLowerArm', forearm_L: 'leftHand', hand_L: 'leftMiddleProximal',
  upperArm_R: 'rightLowerArm', forearm_R: 'rightHand', hand_R: 'rightMiddleProximal',
  thigh_L: 'leftLowerLeg', shin_L: 'leftFoot', thigh_R: 'rightLowerLeg', shin_R: 'rightFoot',
}
const ORDER = ['pelvis', 'spine', 'chest', 'neck', 'head', 'upperArm_L', 'forearm_L', 'hand_L', 'upperArm_R', 'forearm_R', 'hand_R', 'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R']

type Dirs = Record<string, [number, number, number]>
const mirror = (d: Dirs): Dirs =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [k.replace(/_L$/, '_R'), [-v[0], v[1], v[2]]])) as Dirs

/** 姿勢用「骨頭指向邊個方向」嚟描述（世界座標，+Z = 前面） */
const BASE_L: Dirs = { upperArm_L: [0.2, -1, 0.02], forearm_L: [0.2, -1, 0.14], hand_L: [0.17, -1, 0.14] }
const BASE_DIRS: Dirs = { ...BASE_L, ...mirror(BASE_L) }
const WRIST_L: Dirs = { upperArm_L: [0.3, -0.85, 0.42], forearm_L: [0.15, 0.02, 1], hand_L: [0.15, 0.02, 1] }
const ZONE_DIRS: Partial<Record<ZoneId, Dirs>> = { wristL: WRIST_L, wristR: mirror(WRIST_L) }

/** 掛點：喺邊條骨、向子骨方向行幾多 */
const SOCKETS: Partial<Record<ZoneId, { bone: string; frac: number }>> = {
  wristL: { bone: 'forearm_L', frac: 0.9 }, wristR: { bone: 'forearm_R', frac: 0.9 },
  upperArmL: { bone: 'upperArm_L', frac: 0.38 }, upperArmR: { bone: 'upperArm_R', frac: 0.38 },
  ankleL: { bone: 'shin_L', frac: 0.88 }, ankleR: { bone: 'shin_R', frac: 0.88 },
}

const EXCLUDE_TORSO = /UpperArm|LowerArm|Hand|Thumb|Index|Middle|Ring|Little|UpperLeg|LowerLeg|Foot|Toes|head|Eye|jaw/i

interface Vert { p: THREE.Vector3; human: string | null; raw: string; mat: string }
interface Mesh3 { verts: Vert[]; tris: [number, number, number][] }

/** 收集所有網格嘅頂點同三角形（休息姿勢、世界座標），連同每點主要跟邊條骨 */
function collectVerts(vrm: VRM): Mesh3 {
  const rawToHuman = new Map<THREE.Object3D, string>()
  for (const name of Object.keys(vrm.humanoid.humanBones) as VRMHumanBoneName[]) {
    const n = vrm.humanoid.getRawBoneNode(name)
    if (n) rawToHuman.set(n, name)
  }
  const out: Vert[] = []
  const tris: [number, number, number][] = []
  vrm.scene.updateMatrixWorld(true)
  vrm.scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh
    if (!m.isSkinnedMesh) return
    const pos = m.geometry.attributes.position
    const si = m.geometry.attributes.skinIndex
    const sw = m.geometry.attributes.skinWeight
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material).name
    const base = out.length
    const idx = m.geometry.index
    if (idx) for (let i = 0; i < idx.count; i += 3) tris.push([base + idx.getX(i), base + idx.getX(i + 1), base + idx.getX(i + 2)])
    for (let i = 0; i < pos.count; i++) {
      let best = 0
      for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k
      const bone = m.skeleton.bones[si.getComponent(i, best)]
      out.push({
        p: new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld),
        human: rawToHuman.get(bone) ?? null,
        raw: bone?.name ?? '',
        mat,
      })
    }
  })
  return { verts: out, tris }
}

/** 用平面切開所有三角形，攞返截面上嘅點（比淨係揀附近頂點準確好多） */
function sectionPoints(mesh: Mesh3, c: THREE.Vector3, n: THREE.Vector3, allow: (v: Vert) => boolean) {
  const out: THREE.Vector3[] = []
  const tmp = new THREE.Vector3()
  const d = (v: Vert) => n.dot(tmp.subVectors(v.p, c))
  for (const [a, b, e] of mesh.tris) {
    const V = [mesh.verts[a], mesh.verts[b], mesh.verts[e]]
    if (!allow(V[0])) continue
    const D = V.map(d)
    for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) {
      if (D[i] > 0 !== D[j] > 0) {
        const t = D[i] / (D[i] - D[j])
        out.push(V[i].p.clone().lerp(V[j].p, t))
      }
    }
  }
  return out
}

/** 2D 凸包周長（圍度） */
function hullPerimeter(pts: [number, number][]) {
  if (pts.length < 6) return null
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lo: [number, number][] = [], hi: [number, number][] = []
  for (const p of pts) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop()
    lo.push(p)
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop()
    hi.push(p)
  }
  const h = lo.slice(0, -1).concat(hi.slice(0, -1))
  let L = 0
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length]
    L += Math.hypot(a[0] - b[0], a[1] - b[1])
  }
  return L
}

/** 喺某個截面量度圍度（cm）同截面中心 / 比例 */
function slice(mesh: Mesh3, c: THREE.Vector3, axis: THREE.Vector3, xAx: THREE.Vector3, zAx: THREE.Vector3, rMax: number, allow: (v: Vert) => boolean) {
  const pts: [number, number][] = []
  const d = new THREE.Vector3()
  for (const p of sectionPoints(mesh, c, axis, allow)) {
    d.subVectors(p, c)
    const x = d.dot(xAx), z = d.dot(zAx)
    if (Math.hypot(x, z) > rMax) continue
    pts.push([x, z])
  }
  if (pts.length < 6) return null
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1])
  const per = hullPerimeter(pts)
  if (!per) return null
  return {
    girthCm: per * 100,
    cx: (Math.max(...xs) + Math.min(...xs)) / 2,
    cz: (Math.max(...zs) + Math.min(...zs)) / 2,
    ax: (Math.max(...xs) - Math.min(...xs)) / 2,
    az: (Math.max(...zs) - Math.min(...zs)) / 2,
  }
}

/** 掛點方向：本地 -Y 沿住骨頭（向手 / 腳嗰邊），+Z 盡量向前 */
function socketFrame(dir: THREE.Vector3) {
  const y = dir.clone().negate().normalize()
  const z = new THREE.Vector3(0, 0, 1).addScaledVector(y, -y.z)
  if (z.lengthSq() < 1e-6) z.set(1, 0, 0)
  z.normalize()
  const x = new THREE.Vector3().crossVectors(y, z)
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
}

interface Setup {
  vrm: VRM
  bones: Record<string, THREE.Object3D>
  restDir: Record<string, THREE.Vector3>
  sockets: { zone: ZoneId; node: THREE.Object3D; position: THREE.Vector3; quaternion?: THREE.Quaternion }[]
  profile: BodyProfile
  meshes: { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[]; kind: 'skin' | 'detail' | 'cloth' | 'hair' }[]
  surfaces: { skin: BodySurface; clothed: BodySurface }
}

function setup(vrm: VRM): Setup {
  // 同一個模型只處理一次（開發時熱更新會再 call 多次）
  if (vrm.scene.userData.__setup) return vrm.scene.userData.__setup as Setup
  const result = setupOnce(vrm)
  vrm.scene.userData.__setup = result
  return result
}

function setupOnce(vrm: VRM): Setup {
  VRMUtils.removeUnnecessaryVertices(vrm.scene)
  VRMUtils.combineSkeletons(vrm.scene)
  vrm.scene.traverse((o) => (o.frustumCulled = false))

  // 1. 縮放到 160cm（以身體皮膚最高點計，唔計頭髮）
  let mesh = collectVerts(vrm)
  const skinTop = Math.max(...mesh.verts.filter((v) => /Body.*SKIN|Face.*SKIN/i.test(v.mat)).map((v) => v.p.y))
  vrm.scene.scale.setScalar(TARGET_HEIGHT / skinTop)
  vrm.scene.updateMatrixWorld(true)
  mesh = collectVerts(vrm)
  const verts = mesh.verts
  // 量度只計皮膚（唔計衣服、頭髮）
  const isSkin = (v: Vert) => /SKIN/i.test(v.mat)

  // 2. 骨頭
  const bones: Record<string, THREE.Object3D> = {}
  for (const [ours, h] of Object.entries(MAP)) {
    const n = vrm.humanoid.getNormalizedBoneNode(h) ?? (h === 'upperChest' ? vrm.humanoid.getNormalizedBoneNode('chest') : null)
    if (n) bones[ours] = n
  }
  const restDir: Record<string, THREE.Vector3> = {}
  for (const [ours, child] of Object.entries(CHILD)) {
    const c = vrm.humanoid.getNormalizedBoneNode(child)
    if (c) restDir[ours] = c.position.clone().normalize()
  }
  const worldOf = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3())

  // 3. 掛點 + 量度
  const girthCm: Partial<Record<ZoneId, number>> = {}
  const sockets: Setup['sockets'] = []
  const scale = vrm.scene.scale.x
  for (const [zone, spec] of Object.entries(SOCKETS) as [ZoneId, { bone: string; frac: number }][]) {
    const node = bones[spec.bone]
    const dir = restDir[spec.bone]
    if (!node || !dir) continue
    const childNode = vrm.humanoid.getNormalizedBoneNode(CHILD[spec.bone])!
    const local = childNode.position.clone().multiplyScalar(spec.frac)
    const q = socketFrame(dir)
    sockets.push({ zone, node, position: local, quaternion: q })
    // 量度：截面垂直於骨頭
    const c = worldOf(node).add(local.clone().multiplyScalar(scale))
    const xAx = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
    const zAx = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
    const human = MAP[spec.bone]
    const childH = CHILD[spec.bone]
    const rMax = zone.startsWith('wrist') ? 0.045 : 0.07
    const m = slice(mesh, c, dir, xAx, zAx, rMax, (v) => isSkin(v) && (v.human === human || v.human === childH || !v.human))
    if (m) girthCm[zone] = Math.round(m.girthCm * 10) / 10
  }

  // 頸、頭、耳
  const neck = bones.neck
  const head = bones.head
  const neckW = worldOf(neck)
  const headW = worldOf(head)
  sockets.push({ zone: 'neck', node: neck, position: new THREE.Vector3() })
  const up = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1)
  const neckSlice = slice(mesh, neckW.clone().add(new THREE.Vector3(0, 0.03, 0)), up, X, Z, 0.08, (v) => isSkin(v) && (v.human === 'neck' || v.human === 'head'))
  // 頸底（頸鏈後面同兩側搭住嘅位置）
  const neckBase = slice(mesh, neckW.clone().add(new THREE.Vector3(0, 0.012, 0)), up, X, Z, 0.07, (v) => isSkin(v) && (v.human === 'neck' || v.human === 'upperChest' || v.human === 'chest'))
  if (neckSlice) girthCm.neck = Math.round(neckSlice.girthCm * 10) / 10
  sockets.push({ zone: 'head', node: head, position: new THREE.Vector3(0, ((skinTop * scale - headW.y) * 0.4) / scale, 0) })
  const earSpots: BodyProfile['earSpots'] = { earL: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], earR: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] }
  // 耳仔：頭部皮膚最突出嘅位置就係耳仔，耳珠 = 耳仔最低點（唔計頭髮、五官）
  const eye = vrm.humanoid.getNormalizedBoneNode('leftEye')
  const eyeY = eye ? worldOf(eye).y : headW.y + 0.07
  for (const s of [1, -1]) {
    const cand = verts.filter((v) => isSkin(v) && !/Hair/i.test(v.raw) && (v.human === 'head' || /Face/i.test(v.mat))
      && v.p.y > eyeY - 0.08 && v.p.y < eyeY + 0.03 && Math.abs(v.p.z - headW.z) < 0.08 && v.p.x * s > 0)
    if (!cand.length) continue
    const maxX = Math.max(...cand.map((v) => Math.abs(v.p.x)))
    const ear = cand.filter((v) => Math.abs(v.p.x) > maxX - 0.016)
    const ys = ear.map((v) => v.p.y)
    const y0 = Math.min(...ys), y1 = Math.max(...ys)
    const lobe = ear.filter((v) => v.p.y < y0 + 0.012)
    const lz0 = Math.min(...lobe.map((v) => v.p.z)), lz1 = Math.max(...lobe.map((v) => v.p.z))
    // 揀最近嘅表面點（耳仔外側），再向內 1.5mm（穿過耳仔）
    const snap = (ty: number, tz: number) => {
      const best = ear.reduce((b, v) => (Math.hypot(v.p.y - ty, v.p.z - tz) < Math.hypot(b.p.y - ty, b.p.z - tz) ? v : b), ear[0])
      return new THREE.Vector3(best.p.x - 0.0015 * s, best.p.y, best.p.z)
    }
    // 預設位置（一般穿耳指引）：
    // ① 標準耳洞 = 耳珠肉墊正中；② 第二耳洞 = ① 上面約 7mm、略向後；③ 耳骨 = 耳朵上半部外緣
    // 用家可以喺 App 入面撳耳仔自己再校正
    const h1 = snap(y0 + 0.007, (lz0 + lz1) / 2 + 0.002)
    const h2 = snap(h1.y + 0.007, h1.z - 0.002)
    const h3 = snap(y1 - 0.016, h2.z + 0.001)
    const holes = [h1, h2, h3]
    const zone = s > 0 ? 'earL' : 'earR'
    sockets.push({ zone, node: head, position: holes[0].clone().sub(headW).divideScalar(scale) })
    earSpots[zone] = holes.map((h) => h.clone().sub(holes[0]).toArray() as [number, number, number]) as [V3, V3, V3]
  }

  // 4. 軀幹截面（頸鏈貼身用）：唔計手腳、頭同頭髮
  const hipsY = worldOf(bones.pelvis).y
  const torsoKeys: Ring[] = []
  for (let y = hipsY - 0.05; y <= neckW.y + 0.025; y += 0.01) {
    const sl = sectionPoints(mesh, new THREE.Vector3(0, y, 0), up, (v) => !(v.human && EXCLUDE_TORSO.test(v.human)) && !/Hair/i.test(v.raw))
    if (sl.length < 8) continue
    const xs = sl.map((p) => Math.abs(p.x)), zs = sl.map((p) => p.z)
    const zmin = Math.min(...zs), zmax = Math.max(...zs)
    torsoKeys.push({ y, a: Math.max(...xs), b: (zmax - zmin) / 2, dz: (zmax + zmin) / 2 })
  }

  // 身體表面地圖：一個只計皮膚，一個連衣服
  const torsoTris = (withClothes: boolean) =>
    mesh.tris
      .filter(([a]) => {
        const v = verts[a]
        if (/Hair/i.test(v.raw) || (v.human && EXCLUDE_TORSO.test(v.human))) return false
        return withClothes ? /SKIN|CLOTH/i.test(v.mat) : isSkin(v)
      })
      .map(([a, b, c]) => [verts[a].p, verts[b].p, verts[c].p] as [THREE.Vector3, THREE.Vector3, THREE.Vector3])
  const surfaces = { skin: buildSurface(torsoTris(false), neckW.y), clothed: buildSurface(torsoTris(true), neckW.y) }

  // 頭形（髮箍用）：連頭髮計，喺耳仔高度最闊位同頭頂最高點
  const socketY = headW.y + (TARGET_HEIGHT - headW.y) * 0.4
  const arcCy = eyeY - 0.01
  const hairish = verts.filter((v) => /Hair/i.test(v.raw) || v.human === 'head')
  const sideCand = hairish.filter((v) => Math.abs(v.p.y - (eyeY + 0.025)) < 0.015 && Math.abs(v.p.z - headW.z) < 0.04)
  const topCand = hairish.filter((v) => Math.abs(v.p.x) < 0.015 && Math.abs(v.p.z - headW.z) < 0.05)
  const arcRx = (sideCand.length ? Math.max(...sideCand.map((v) => Math.abs(v.p.x))) : 0.08) + 0.004
  const arcTop = topCand.length ? Math.max(...topCand.map((v) => v.p.y)) : TARGET_HEIGHT + 0.01
  const depthCand = hairish.filter((v) => v.p.y > eyeY + 0.02 && v.p.y < eyeY + 0.06 && Math.abs(v.p.x) < 0.03)
  const arcRz = (depthCand.length ? Math.max(...depthCand.map((v) => Math.abs(v.p.z - headW.z))) : 0.1) + 0.004
  const headArc = { cy: arcCy - socketY, cz: 0.004, rx: arcRx, ry: arcTop - arcCy + 0.004, rz: arcRz, tilt: -0.25 }

  const profile: BodyProfile = {
    source: 'vrm',
    heightCm: 160,
    girthCm,
    measuredGirthCm: girthCm,
    torsoKeys,
    neckY: neckW.y,
    neckZ: neckW.z,
    headArc,
    earSpots,
    neckBase: neckBase ? { a: neckBase.ax, b: neckBase.az, dz: neckBase.cz } : undefined,
    surface: surfaces.clothed,
    bust: null,
    choker: neckSlice
      ? { y: 0.03, dz: neckSlice.cz, aspect: [neckSlice.ax / Math.max(neckSlice.ax, neckSlice.az), neckSlice.az / Math.max(neckSlice.ax, neckSlice.az)] }
      : { y: 0.03, dz: 0, aspect: [1, 1] },
  }

  // 5. 網格分類（換人台質感 / 收埋衣服用）
  const meshes: Setup['meshes'] = []
  vrm.scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const name = (Array.isArray(m.material) ? m.material[0] : m.material).name
    const kind = /CLOTH/i.test(name) ? 'cloth' : /HAIR/i.test(name) ? 'hair' : /SKIN/i.test(name) ? 'skin' : 'detail'
    meshes.push({ mesh: m, original: m.material, kind })
  })

  return { vrm, bones, restDir, sockets, profile, meshes, surfaces }
}

const mannequinSkin = new THREE.MeshStandardMaterial({ color: '#ebe5e7', roughness: 0.6 })
const mannequinHair = new THREE.MeshStandardMaterial({ color: '#d6cdd2', roughness: 0.5, side: THREE.DoubleSide })
const mannequinCloth = new THREE.MeshStandardMaterial({ color: '#f3d4df', roughness: 0.85, side: THREE.DoubleSide })

export function VrmMannequin({ modelId }: { modelId: string }) {
  const gltf = useLoader(GLTFLoader, vrmUrl(modelId), (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser))
  })
  const s = useMemo(() => setup(gltf.userData.vrm as VRM), [gltf])
  const look = useApp((st) => st.vrmLook)
  const clothes = useApp((st) => st.vrmClothes)

  // 註冊骨頭、身體資料、姿勢計法
  useEffect(() => {
    boneObjects.clear()
    for (const [k, n] of Object.entries(s.bones)) boneObjects.set(k, n)

    const cache = new Map<ZoneId, Map<string, THREE.Quaternion>>()
    const targets = (zone: ZoneId) => {
      let m = cache.get(zone)
      if (m) return m
      m = new Map()
      const worldQ = new Map<string, THREE.Quaternion>()
      const dirs = { ...BASE_DIRS, ...ZONE_DIRS[zone] }
      for (const name of ORDER) {
        const parent = BONE_MAP[name].parent
        const pq = (parent && worldQ.get(parent)) || new THREE.Quaternion()
        const d = dirs[name]
        const q = new THREE.Quaternion()
        if (d && s.restDir[name]) {
          const local = new THREE.Vector3(...d).normalize().applyQuaternion(pq.clone().invert())
          q.setFromUnitVectors(s.restDir[name], local)
        }
        worldQ.set(name, pq.clone().multiply(q))
        m.set(name, q)
      }
      cache.set(zone, m)
      return m
    }
    rig.poseTarget = (bone, zone, out) => out.copy(targets(zone).get(bone) ?? out.identity())
    return () => {
      // 只刪自己嘅骨頭（另一個假人可能已經註冊咗）
      for (const [k, n] of Object.entries(s.bones)) if (boneObjects.get(k) === n) boneObjects.delete(k)
    }
  }, [s])

  // 首飾尺寸：跟真人標準（可以直接生產）或者跟模型實際量度
  const sizing = useApp((st) => st.vrmSizing)
  useEffect(() => {
    const standard = proceduralProfile(DEFAULT_FIGURE).girthCm
    setProfile({
      ...s.profile,
      key: vrmModel(modelId).key,
      girthCm: sizing === 'model' ? s.profile.measuredGirthCm : standard,
      // 收埋衣服時，頸鏈就貼住皮膚
      surface: clothes ? s.surfaces.clothed : s.surfaces.skin,
    })
  }, [s, sizing, clothes])

  // 外觀：原本 / 人台；衣服：顯示 / 收埋；揀耳仔時收埋頭髮（唔係會遮住耳環）
  const earZone = useApp((st) => st.zone === 'earL' || st.zone === 'earR')
  useEffect(() => {
    for (const { mesh, original, kind } of s.meshes) {
      if (look === 'original') mesh.material = original
      else mesh.material = kind === 'hair' ? mannequinHair : kind === 'cloth' ? mannequinCloth : mannequinSkin
      mesh.visible = kind === 'cloth' ? clothes : kind === 'detail' ? look === 'original' : kind === 'hair' ? !earZone : true
    }
  }, [s, look, clothes, earZone])

  useFrame((_, dt) => s.vrm.update(Math.min(dt, 1 / 30)))

  return (
    <>
      <primitive object={s.vrm.scene} />
      {/* 首飾用真實尺寸（米），所以掛點要抵銷模型嘅縮放 */}
      {s.sockets.map(({ zone, node, position, quaternion }) => (
        <Fragment key={zone}>
          {createPortal(<Socket zone={ZONES[zone]} position={position} quaternion={quaternion} scale={1 / s.vrm.scene.scale.x} />, node)}
        </Fragment>
      ))}
    </>
  )
}

