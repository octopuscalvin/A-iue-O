import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useApp, type BodyStyle } from '../store'
import { BASE_POSE, CHILDREN, boneObjects, localHead, localTail, type V3 } from './skeleton'
import { GEO, STRAP_L, STRAP_R } from './shapes'
import { buildTorso, DEFAULT_FIGURE } from './figure'
import { HAIR } from './hair'
import { OUTFIT_MAP, fabricMaterial, wearing, type OutfitPiece } from './outfits'
import { ZONES, ZONE_LIST, type Zone, type ZoneId } from './zones'
import { DemoPiece } from '../jewelry/DemoJewelry'
import { proceduralProfile, setProfile } from './bodyProfile'
import { VrmMannequin } from './VrmMannequin'
import { Piece3D } from '../jewelry/Piece3D'
import { useDesigns } from '../jewelry/designStore'
import { isRingZone } from '../jewelry/types'
import { AccPiece3D } from '../jewelry/Accessory3D'
import { useAcc } from '../jewelry/accStore'
import { isAccZone } from '../jewelry/accessory'
import { EarSpotMarkers, placeEarSpot } from '../jewelry/earSpots'

/** 執行時：掛點 → Object3D（鏡頭用嚟對焦） */
export const socketObjects = new Map<ZoneId, THREE.Object3D>()

type Kind = 'skin' | 'joint' | 'fabric' | 'hair' | 'accent'

type ProcStyle = Exclude<BodyStyle, 'vrm'>
const PALETTE: Record<ProcStyle, Record<Kind, THREE.MeshPhysicalMaterialParameters>> = {
  basic: {
    skin: { color: '#d8d8de', roughness: 0.62 },
    joint: { color: '#9d9eab', roughness: 0.5 },
    fabric: { color: '#d8d8de' },
    hair: { color: '#d8d8de' },
    accent: { color: '#d8d8de' },
  },
  girl: {
    skin: { color: '#f0d0be', roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color('#ffd9c9') },
    joint: { color: '#f0d0be', roughness: 0.55 },
    fabric: { color: '#f7c3d6', roughness: 0.85, sheen: 1, sheenColor: new THREE.Color('#ffe4ee'), sheenRoughness: 0.5 },
    hair: { color: '#c42f52', roughness: 0.42, sheen: 0.8, sheenColor: new THREE.Color('#ff8fb0'), sheenRoughness: 0.35 },
    accent: { color: '#fff1f5', roughness: 0.8, sheen: 1, sheenColor: new THREE.Color('#ffc2d6') },
  },
}

/**
 * 身體一個部分。每個部分有自己嘅「標籤」，專注模式時
 * 唔相關嘅部分會淡化成半透明。
 */
function BodyMesh({
  geometry, kind, tag, style, ...rest
}: {
  geometry: THREE.BufferGeometry
  kind: Kind
  tag: string
  style: ProcStyle
  position?: V3
  rotation?: V3
  scale?: number | V3
}) {
  const mat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ ...PALETTE[style][kind], side: kind === 'hair' || kind === 'fabric' ? THREE.DoubleSide : THREE.FrontSide }),
    [style, kind],
  )
  useIsolationFade(mat, tag)
  return <mesh geometry={geometry} material={mat} {...rest} />
}

/** 專注模式：唔相關嘅部分淡化 */
function useIsolationFade(mat: THREE.Material, tag: string) {
  useFrame((_, dt) => {
    const { isolate, zone } = useApp.getState()
    const keep = ZONES[zone].keep
    const target = isolate && zone !== 'full' && !keep.includes(tag) ? 0.1 : 1
    mat.opacity = THREE.MathUtils.damp(mat.opacity, target, 8, dt)
    const transparent = mat.opacity < 0.985
    if (transparent !== mat.transparent) {
      mat.transparent = transparent
      mat.depthWrite = !transparent
      mat.needsUpdate = true
    }
  })
}

/** 一件衣服嘅一部分（跟三圍重新生成） */
function OutfitPieceMesh({ outfitId, piece, tag }: { outfitId: string; piece: OutfitPiece; tag: string }) {
  const figure = useApp((s) => s.figure)
  const color = useApp((s) => s.outfitColors[outfitId]) ?? OUTFIT_MAP[outfitId].colors[0]
  const geo = useMemo(() => piece.build(figure), [piece, figure])
  useEffect(() => () => geo.dispose(), [geo])
  const mat = useMemo(() => fabricMaterial(OUTFIT_MAP[outfitId].look, color), [outfitId, color])
  useEffect(() => () => mat.dispose(), [mat])
  useIsolationFade(mat, tag)
  return <mesh geometry={geo} material={mat} />
}

/** 呢條骨上面着緊嘅衣服 */
function OutfitLayer({ bone }: { bone: string }) {
  const wardrobe = useApp((s) => s.wardrobe)
  const base = bone.replace(/_[LR]$/, '')
  const items = wearing(wardrobe).flatMap((o) =>
    o.pieces.map((p, i) => ({ o, p, i })).filter(({ p }) => p.bone === base),
  )
  if (!items.length) return null
  const meshes = items.map(({ o, p, i }) => (
    <OutfitPieceMesh key={`${o.id}-${i}`} outfitId={o.id} piece={p} tag={p.tag === 'torso' ? 'torso' : bone} />
  ))
  return base === 'foot' ? <group rotation={[-Math.PI / 2, 0, 0]}>{meshes}</group> : <>{meshes}</>
}

/** 少女軀幹：跟三圍設定即時重新生成 */
function GirlTorso({ style }: { style: ProcStyle }) {
  const figure = useApp((s) => s.figure)
  const coveredTop = useApp((s) => wearing(s.wardrobe).some((o) => o.slot === 'top' || o.slot === 'dress'))
  const t = useMemo(() => buildTorso(figure), [figure])
  useEffect(
    () => () => {
      t.torso.dispose()
      t.braBand.dispose()
      t.briefs.dispose()
    },
    [t],
  )
  const p = { style, tag: 'torso' }
  const k = t.bustScale
  return (
    <>
      <BodyMesh {...p} geometry={t.torso} kind="skin" />
      <BodyMesh {...p} geometry={GEO.bust} kind="skin" position={t.bustPos(1)} scale={k} />
      <BodyMesh {...p} geometry={GEO.bust} kind="skin" position={t.bustPos(-1)} scale={k} />
      {/* 基本衣物：內衣 + 安全褲（之後 DLC 衣服都係咁一層層加） */}
      <BodyMesh {...p} geometry={t.braBand} kind="fabric" />
      <BodyMesh {...p} geometry={GEO.braCup} kind="fabric" position={t.bustPos(1)} scale={k} />
      <BodyMesh {...p} geometry={GEO.braCup} kind="fabric" position={t.bustPos(-1)} scale={k} />
      {/* 着咗上衣 / 連身裙就收埋內衣肩帶（唔會穿出件衫外面） */}
      {!coveredTop && <BodyMesh {...p} geometry={STRAP_L} kind="fabric" scale={[1, 1, k]} />}
      {!coveredTop && <BodyMesh {...p} geometry={STRAP_R} kind="fabric" scale={[1, 1, k]} />}
      <BodyMesh {...p} geometry={t.briefs} kind="fabric" />
    </>
  )
}

/** 基本人台：軀幹三節，按三圍左右前後放大縮細 */
function BasicPiece({ geometry, part }: { geometry: THREE.BufferGeometry; part: 'bust' | 'waist' | 'hip' }) {
  const f = useApp((s) => s.figure)
  const k = f[part] / DEFAULT_FIGURE[part]
  return <BodyMesh style="basic" tag="torso" geometry={geometry} kind="skin" scale={[k, 1, k]} />
}

/** 每條骨頭上面嘅身體形狀 */
function Parts({ bone, style }: { bone: string; style: ProcStyle }) {
  const girl = style === 'girl'
  const S = bone.endsWith('_L') ? 1 : -1
  const p = { style, tag: bone }
  const joint = (r: number, pos: V3 = [0, 0, 0]) => (
    <BodyMesh {...p} geometry={GEO.joint} kind="joint" position={pos} scale={r} />
  )

  switch (bone.replace(/_[LR]$/, '')) {
    case 'pelvis':
      return girl ? <GirlTorso style={style} /> : <BasicPiece geometry={GEO.pelvisBlock} part="hip" />
    case 'spine':
      return girl ? null : <BasicPiece geometry={GEO.abdomen} part="waist" />
    case 'chest':
      return girl ? null : <BasicPiece geometry={GEO.ribcage} part="bust" />
    case 'neck':
      return (
        <>
          <BodyMesh {...p} geometry={GEO.neck} kind="skin" />
          {!girl && joint(0.042, [0, 0.0, 0])}
        </>
      )
    case 'head':
      return (
        <>
          <BodyMesh {...p} geometry={GEO.head} kind="skin" />
          <BodyMesh {...p} geometry={GEO.ear} kind="skin" position={[0.077, 0.06, -0.008]} rotation={[0, 0, -0.12]} />
          <BodyMesh {...p} geometry={GEO.ear} kind="skin" position={[-0.077, 0.06, -0.008]} rotation={[0, 0, 0.12]} />
          {girl && (
            <>
              {/* 預設髮型：紅粉色齊陰 + 雙馬尾 */}
              <BodyMesh {...p} tag="hair" geometry={HAIR.shell} kind="hair" />
              {[HAIR.tailL, HAIR.tailR].map((t, i) => (
                <group key={i}>
                  <BodyMesh {...p} tag="hair" geometry={t.geometry} kind="hair" />
                  <group position={t.tiePos} quaternion={t.tieQuat}>
                    <BodyMesh {...p} tag="hair" geometry={HAIR.scrunchie} kind="accent" />
                  </group>
                </group>
              ))}
            </>
          )}
        </>
      )
    case 'upperArm':
      return (
        <>
          <BodyMesh {...p} geometry={GEO.upperArm} kind="skin" />
          {joint(0.046)}
        </>
      )
    case 'forearm':
      return (
        <>
          <BodyMesh {...p} geometry={GEO.forearm} kind="skin" />
          {joint(girl ? 0.031 : 0.034)}
        </>
      )
    case 'hand':
      return (
        <>
          <BodyMesh {...p} geometry={GEO.hand} kind="skin" />
          <BodyMesh {...p} geometry={GEO.thumb} kind="skin" position={[-0.012 * S, -0.045, 0.03]} rotation={[0.35, 0, 0.25 * S]} />
          {!girl && joint(0.022)}
        </>
      )
    case 'thigh':
      return (
        <>
          <BodyMesh {...p} geometry={GEO.thigh} kind="skin" />
          {!girl && joint(0.07)}
        </>
      )
    case 'shin':
      return (
        <>
          <BodyMesh {...p} geometry={GEO.shin} kind="skin" />
          {joint(girl ? 0.047 : 0.053)}
        </>
      )
    case 'foot':
      return (
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <BodyMesh {...p} geometry={GEO.foot} kind="skin" />
          {!girl && joint(0.032)}
        </group>
      )
    default:
      return null
  }
}

/** 掛點：一粒可以撳嘅小珠 + 示範首飾（VRM 模型會另外傳入位置同方向） */
export function Socket({ zone, position, quaternion, scale }: {
  zone: Zone; position?: THREE.Vector3; quaternion?: THREE.Quaternion; scale?: number
}) {
  const showSockets = useApp((s) => s.showSockets)
  const demo = useApp((s) => s.demoJewelry)
  const active = useApp((s) => s.zone === zone.id)
  const closeUp = useApp((s) => s.zone !== 'full')
  const setZone = useApp((s) => s.setZone)
  const hasDesign = useDesigns((s) => isRingZone(zone.id) && !!s.designs[zone.id])
  const hasAcc = useAcc((s) => isAccZone(zone.id) && !!s.designs[zone.id])
  const [hover, setHover] = useState(false)

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setZone(zone.id)
  }
  return (
    <group
      position={position ?? zone.socket}
      quaternion={quaternion}
      scale={scale}
      ref={(o) => {
        if (o) socketObjects.set(zone.id, o)
      }}
    >
      {hasDesign && isRingZone(zone.id) ? (
        <Piece3D zone={zone.id} />
      ) : hasAcc && isAccZone(zone.id) ? (
        <AccPiece3D zone={zone.id} />
      ) : (
        demo && <DemoPiece zone={zone} />
      )}
      {active && (zone.id === 'earL' || zone.id === 'earR') && <EarSpotMarkers zone={zone.id} />}
      {showSockets && !active && (
        <mesh
          onClick={onClick}
          onPointerOver={(e) => (e.stopPropagation(), setHover(true), (document.body.style.cursor = 'pointer'))}
          onPointerOut={() => (setHover(false), (document.body.style.cursor = ''))}
          position={zone.id.startsWith('ear') ? [Math.sign(zone.socket[0]) * 0.012, 0, 0] : [0, 0, 0]}
          renderOrder={10}
        >
          <sphereGeometry args={[(closeUp ? 0.0045 : 0.008) * (hover ? 1.4 : 1), 16, 12]} />
          <meshBasicMaterial color={hover ? '#ff4f8b' : '#ffffff'} transparent opacity={0.9} depthTest={false} />
        </mesh>
      )}
    </group>
  )
}

const SOCKETS_BY_BONE: Record<string, Zone[]> = {}
for (const z of ZONE_LIST) if (z.id !== 'full') (SOCKETS_BY_BONE[z.bone] ??= []).push(z)

/** Blender 風格嘅八面體骨頭（顯示骨架用） */
const boneGeoCache = new Map<string, THREE.BufferGeometry>()
function boneGeometry(tail: V3) {
  const key = tail.join(',')
  let g = boneGeoCache.get(key)
  if (g) return g
  const v = new THREE.Vector3(...tail)
  const len = v.length()
  const w = len * 0.09
  const base = new THREE.OctahedronGeometry(1, 0)
  base.translate(0, 1, 0)
  // 將八面體拉成「頭粗尾尖」嘅骨頭形
  const pos = base.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    if (y > 1.5) pos.setXYZ(i, 0, len, 0)
    else if (y < 0.5) pos.setXYZ(i, 0, 0, 0)
    else pos.setXYZ(i, pos.getX(i) * w, len * 0.12, pos.getZ(i) * w)
  }
  base.computeVertexNormals()
  base.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()))
  boneGeoCache.set(key, base)
  g = base
  return g
}

const boneMat = new THREE.MeshBasicMaterial({ color: '#3d7bff', transparent: true, opacity: 0.55, depthTest: false })
const boneWire = new THREE.MeshBasicMaterial({ color: '#1b3e8f', wireframe: true, depthTest: false })

function BoneViz({ name }: { name: string }) {
  const show = useApp((s) => s.showBones)
  const tail = localTail(name)
  if (!show || !tail) return null
  const g = boneGeometry(tail)
  return (
    <>
      <mesh geometry={g} material={boneMat} renderOrder={20} />
      <mesh geometry={g} material={boneWire} renderOrder={21} />
    </>
  )
}

function BoneNode({ name, style }: { name: string; style: ProcStyle }) {
  return (
    <group
      name={name}
      position={localHead(name)}
      ref={(o) => {
        if (o) boneObjects.set(name, o)
      }}
    >
      <Parts bone={name} style={style} />
      {style === 'girl' && <OutfitLayer bone={name} />}
      <BoneViz name={name} />
      {SOCKETS_BY_BONE[name]?.map((z) => <Socket key={z.id} zone={z} />)}
      {CHILDREN[name]?.map((c) => <BoneNode key={c} name={c} style={style} />)}
    </group>
  )
}

/** 某條骨喺某個部位聚焦時嘅目標角度 */
function targetRotation(bone: string, zoneId: ZoneId, out: THREE.Euler) {
  const { figure } = useApp.getState()
  const r = ZONES[zoneId].pose?.[bone] ?? BASE_POSE[bone] ?? [0, 0, 0]
  out.set(r[0], r[1], r[2])
  // 臀圍越大，雙手自然張開多少少，避免手插入身體
  if (bone.startsWith('upperArm')) out.z += Math.sign(r[2]) * Math.max(0, figure.hip / DEFAULT_FIGURE.hip - 1) * 0.9
  return out
}

const tmpEuler = new THREE.Euler()

/**
 * 目前假人（程式生成或者 VRM）點樣計每條骨嘅目標姿勢。
 * VRM 模型載入時會換成佢自己嘅計法。
 */
export const proceduralPoseTarget = (bone: string, zoneId: ZoneId, out: THREE.Quaternion) =>
  out.setFromEuler(targetRotation(bone, zoneId, tmpEuler))
export const rig = { poseTarget: proceduralPoseTarget }

const boneNameOf = (o: THREE.Object3D) => {
  for (const [n, b] of boneObjects) if (b === o) return n
  return null
}

/**
 * 預計假人擺好姿勢之後，掛點會喺邊（鏡頭直接飛去終點，唔使追住隻手郁）。
 * 做法：暫時將骨頭轉去目標角度、量位置、再轉返原狀。
 */
export function predictSocketWorld(zoneId: ZoneId, out: THREE.Vector3) {
  const s = socketObjects.get(zoneId)
  if (!s) return null
  const saved: [THREE.Object3D, THREE.Quaternion][] = []
  for (let o = s.parent; o; o = o.parent) {
    const name = boneNameOf(o)
    if (name) {
      saved.push([o, o.quaternion.clone()])
      rig.poseTarget(name, zoneId, o.quaternion)
    }
  }
  s.updateWorldMatrix(true, false)
  s.getWorldPosition(out)
  for (const [o, q] of saved) o.quaternion.copy(q)
  s.updateWorldMatrix(true, false)
  return out
}

/** 姿勢動畫：每條骨慢慢轉去目標角度 */
function usePoseAnimation() {
  const target = useRef(new THREE.Quaternion())
  useFrame((_, dt) => {
    const zoneId = useApp.getState().zone
    const k = 1 - Math.exp(-9 * dt)
    for (const [name, o] of boneObjects) {
      rig.poseTarget(name, zoneId, target.current)
      o.quaternion.slerp(target.current, k)
    }
  })
}

/** 程式生成嘅假人：身體資料跟三圍計 */
function ProceduralMannequin({ style }: { style: ProcStyle }) {
  const figure = useApp((s) => s.figure)
  const wardrobe = useApp((s) => s.wardrobe)
  useEffect(() => {
    rig.poseTarget = proceduralPoseTarget
    // 少女着咗衫，頸鏈要貼住件衫
    setProfile(proceduralProfile(figure, style === 'girl' ? wardrobe : {}))
  }, [figure, wardrobe, style])
  return <BoneNode key={style} name="pelvis" style={style} />
}

export function Mannequin() {
  const style = useApp((s) => s.style)
  usePoseAnimation()
  return (
    // 設定耳仔位置模式：撳身體表面就設定（見 earSpots）
    <group onPointerDown={(e) => placeEarSpot(e, socketObjects as Map<string, THREE.Object3D>)}>
      {style === 'vrm' ? (
        <Suspense fallback={<LoadingNote />}>
          <VrmMannequin />
        </Suspense>
      ) : (
        <ProceduralMannequin style={style} />
      )}
    </group>
  )
}

/** VRM 載入中：喺地台上面顯示一個慢慢轉嘅圈 */
function LoadingNote() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => ref.current && (ref.current.rotation.z += dt * 2))
  return (
    <mesh ref={ref} position={[0, 0.9, 0]}>
      <torusGeometry args={[0.12, 0.008, 8, 48, Math.PI * 1.5]} />
      <meshBasicMaterial color="#ff4f8b" />
    </mesh>
  )
}
