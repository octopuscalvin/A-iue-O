import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useBody } from '../body/bodyProfile'
import { material } from '../materials/library'
import { SHAPE_GEO, SHAPE_HALF_H } from './charms'
import { useAcc } from './accStore'
import { useEarSpots } from './earSpots'
import { CLIP_LENGTH_MM, HEADBAND_ARC, earSpot, type AccZone, type EarDesign, type HeadDesign } from './accessory'
import type { CharmSpec } from './types'

const MM = 0.001
const NO_OFFSET: [number, number, number] = [0, 0, 0]
const selMat = new THREE.MeshBasicMaterial({ color: '#ff4f8b', transparent: true, opacity: 0.85, depthTest: false })

/** 配件闊 1 單位時嘅半厚度 */
const halfDepth = (c: CharmSpec) => {
  const g = SHAPE_GEO[c.shape]
  if (!g.boundingBox) g.computeBoundingBox()
  return (g.boundingBox!.max.z - g.boundingBox!.min.z) / 2
}

/** 一件配件（面向本地 +Z），撳一下就揀咗佢 */
function Shape({ c, zone }: { c: CharmSpec; zone: AccZone }) {
  const selected = useAcc((s) => s.selected === c.id)
  const select = useAcc((s) => s.select)
  const size = c.sizeMm * MM
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    select(c.id)
  }
  return (
    <group onClick={onClick} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      <mesh geometry={SHAPE_GEO[c.shape]} material={material(c.material)} scale={size} userData={{ zone }} />
      {selected && (
        <mesh material={selMat} renderOrder={30}>
          <torusGeometry args={[size * 0.78, 0.0003, 8, 40]} />
        </mesh>
      )}
    </group>
  )
}

/** 吊住嘅配件：(0,0,0) 係掛點，開口圈 + 配件向下吊 */
function Hanging({ c, zone, metal }: { c: CharmSpec; zone: AccZone; metal: string }) {
  return (
    <group>
      <mesh material={material(metal)} position={[0, -1.2 * MM, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1.2 * MM, 0.3 * MM, 8, 20]} />
      </mesh>
      <group position={[0, -(2.4 * MM + SHAPE_HALF_H[c.shape] * c.sizeMm * MM), 0]}>
        <Shape c={c} zone={zone} />
      </group>
    </group>
  )
}

/** 幼鏈（吊墜耳環用）：細鏈圈一平一企 */
function FineChain({ lengthMm, metal }: { lengthMm: number; metal: string }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const pitch = 1.3
  const n = Math.max(2, Math.round(lengthMm / pitch))
  const geo = useMemo(() => new THREE.TorusGeometry(0.75 * MM, 0.2 * MM, 6, 14), [])
  useEffect(() => () => geo.dispose(), [geo])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
    const q1 = q0.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2))
    const s = new THREE.Vector3(1.3, 1, 1)
    const mat = new THREE.Matrix4()
    for (let i = 0; i < n; i++) {
      m.setMatrixAt(i, mat.compose(new THREE.Vector3(0, -(i + 0.5) * pitch * MM, 0), i % 2 ? q1 : q0, s))
    }
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [n])
  return <instancedMesh ref={ref} args={[geo, undefined, n]} material={material(metal)} />
}

/** 法式耳鈎：由耳珠外面穿入去，喺後面垂落 */
const HOOK = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3([
    [0, -6, 1.2], [0, -1.5, 1.2], [0, 1.2, 0.4], [0, 1.4, -1.2], [0, -1, -2.6], [0, -7, -3.2],
  ].map(([x, y, z]) => new THREE.Vector3(x * MM, y * MM, z * MM))),
  48, 0.35 * MM, 8, false,
)

function EarPiece3D({ zone, d }: { zone: 'earL' | 'earR'; d: EarDesign }) {
  const side = zone === 'earL' ? 1 : -1
  const metal = material(d.metal)
  // ①②③ 位置：相對耳掛點（①）嘅偏移
  const offset = useEarSpots(zone)[earSpot(d) - 1] ?? NO_OFFSET
  // 本地 +Z 向外（耳仔外面），+Y 向上
  return (
    <group position={offset}>
    <group rotation={[0, (side * Math.PI) / 2, 0]}>
      {d.style === 'cuff' && (() => {
        const R = ((d.cuffDiaMm ?? 8) / 2) * MM
        const arc = 5.4
        const gapMid = arc + (Math.PI * 2 - arc) / 2
        // 開口向耳仔中間（左耳 = 本地 -X、右耳 = 本地 +X）
        const want = side > 0 ? Math.PI : 0
        const n = d.charms.length
        return (
          <>
            <group rotation={[Math.PI / 2, 0, 0]}>
              <mesh material={metal} rotation={[0, 0, want - gapMid]}>
                <torusGeometry args={[R, (d.wireMm / 2) * MM, 10, 48, arc]} />
              </mesh>
            </group>
            {d.charms.map((c, i) => (
              <group key={c.id} position={[(i - (n - 1) / 2) * 3.5 * MM, 0, R]}>
                <Hanging c={c} zone={zone} metal={d.metal} />
              </group>
            ))}
          </>
        )
      })()}
      {d.style === 'stud' && (
        <>
          <mesh material={metal} position={[0, 0, -3.5 * MM]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.4 * MM, 0.4 * MM, 9 * MM, 8]} />
          </mesh>
          <mesh material={metal} position={[0, 0, -7 * MM]} scale={[1, 1, 0.35]}>
            <sphereGeometry args={[2.6 * MM, 16, 12]} />
          </mesh>
          {d.charms[0] ? (
            <group position={[0, 0, (1 + halfDepth(d.charms[0]) * d.charms[0].sizeMm) * MM]}>
              <Shape c={d.charms[0]} zone={zone} />
            </group>
          ) : (
            <mesh material={metal} position={[0, 0, 1.6 * MM]}>
              <sphereGeometry args={[2 * MM, 20, 14]} />
            </mesh>
          )}
        </>
      )}
      {d.style === 'hoop' && (() => {
        const R = (d.hoopDiaMm / 2) * MM
        const cy = -R + 1.5 * MM
        return (
          <group position={[0, cy, 0]}>
            <mesh material={metal} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[R, (d.wireMm / 2) * MM, 10, 64]} />
            </mesh>
            {d.charms.map((c) => {
              const a = c.t * Math.PI * 2
              // 圈喺本地 YZ 平面（穿過耳珠），t = 0 喺最低點
              return (
                <group key={c.id} position={[0, -R * Math.cos(a), R * Math.sin(a)]}>
                  <Hanging c={c} zone={zone} metal={d.metal} />
                </group>
              )
            })}
          </group>
        )
      })()}
      {d.style === 'drop' && (() => {
        let y = -6.5 - d.dropLenMm
        return (
          <>
            <mesh geometry={HOOK} material={metal} />
            <group position={[0, -6.5 * MM, 1.2 * MM]}>
              <FineChain lengthMm={d.dropLenMm} metal={d.metal} />
            </group>
            {d.charms.map((c) => {
              const top = y
              y -= 3 + SHAPE_HALF_H[c.shape] * 2 * c.sizeMm
              return (
                <group key={c.id} position={[0, top * MM, 1.2 * MM]}>
                  <Hanging c={c} zone={zone} metal={d.metal} />
                </group>
              )
            })}
          </>
        )
      })()}
    </group>
    </group>
  )
}

/** 由弧上 t 計位置、向外方向同切線（喺頭飾平面入面） */
function arcFrame(rx: number, ry: number, t: number) {
  const a = HEADBAND_ARC[0] + (HEADBAND_ARC[1] - HEADBAND_ARC[0]) * t
  const p = new THREE.Vector3(rx * Math.cos(a), ry * Math.sin(a), 0)
  const n = new THREE.Vector3(Math.cos(a) / rx, Math.sin(a) / ry, 0).normalize()
  let tan = new THREE.Vector3(-rx * Math.sin(a), ry * Math.cos(a), 0).normalize()
  // 配件「向上」：切線揀向上嗰邊（頭頂就揀向左）
  if (tan.y < -0.05 || (Math.abs(tan.y) <= 0.05 && tan.x < 0)) tan = tan.negate()
  return { p, n, tan }
}

function basis(x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3) {
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
}

function HeadPiece3D({ d }: { d: HeadDesign }) {
  const arc = useBody((s) => s.profile.headArc)
  const band = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 64; i++) {
      const a = HEADBAND_ARC[0] + ((HEADBAND_ARC[1] - HEADBAND_ARC[0]) * i) / 64
      pts.push(new THREE.Vector3(arc.rx * Math.cos(a), arc.ry * Math.sin(a), 0))
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 128, 1.25 * MM, 10, false)
  }, [arc.rx, arc.ry])
  useEffect(() => () => band.dispose(), [band])
  const mat = material(d.material)
  const thick = d.style === 'headband' ? 1.25 : 1.6

  const charmAt = (c: CharmSpec, pos: THREE.Vector3, n: THREE.Vector3, up: THREE.Vector3) => {
    const z = n.clone()
    const y = up.clone().addScaledVector(z, -up.dot(z)).normalize()
    const x = new THREE.Vector3().crossVectors(y, z)
    const out = (thick + halfDepth(c) * c.sizeMm) * MM
    return (
      <group key={c.id} position={pos.clone().addScaledVector(n, out)} quaternion={basis(x, y, z)}>
        <Shape c={c} zone="head" />
      </group>
    )
  }

  return (
    <group position={[0, arc.cy, arc.cz]} rotation={[arc.tilt, 0, 0]}>
      {d.style === 'headband' ? (
        <>
          <mesh geometry={band} material={mat} scale={[1, 1, d.widthMm / 2.5]} />
          {d.charms.map((c) => {
            const f = arcFrame(arc.rx, arc.ry, c.t)
            return charmAt(c, f.p, f.n, f.tan)
          })}
        </>
      ) : (() => {
        // 髮夾：沿住前後方向（本地 Z）夾喺頭髮上面
        const f = arcFrame(arc.rx, arc.ry, d.clipT)
        // 前後移動：頭當係橢球，移前 / 移後時跟住頭形收窄、轉方向
        const dz = (d.clipZ ?? 0) * MM
        const k = Math.sqrt(Math.max(0.05, 1 - (dz / arc.rz) ** 2))
        const p = new THREE.Vector3(f.p.x * k, f.p.y * k, dz)
        const n = new THREE.Vector3(p.x / arc.rx ** 2, p.y / arc.ry ** 2, p.z / arc.rz ** 2).normalize()
        const fwd = new THREE.Vector3(0, 0, 1).addScaledVector(n, -n.z).normalize()
        const up = f.tan.clone().addScaledVector(n, -f.tan.dot(n)).addScaledVector(fwd, -f.tan.dot(fwd)).normalize()
        const q = basis(up.clone().cross(fwd).normalize(), up, fwd)
        const base = p.clone().addScaledVector(n, 3 * MM)
        return (
          <>
            <mesh material={mat} position={base} quaternion={q}>
              <boxGeometry args={[1.6 * MM, d.widthMm * MM, CLIP_LENGTH_MM * MM]} />
            </mesh>
            {d.charms.map((c) => {
              const pos = base.clone().addScaledVector(fwd, (c.t - 0.5) * CLIP_LENGTH_MM * MM)
              return charmAt(c, pos, n, up)
            })}
          </>
        )
      })()}
    </group>
  )
}

/** 掛喺耳仔 / 頭掛點嘅首飾 */
export function AccPiece3D({ zone }: { zone: AccZone }) {
  const d = useAcc((s) => s.designs[zone])
  if (!d) return null
  if (d.kind === 'head') return zone === 'head' ? <HeadPiece3D d={d} /> : null
  return zone === 'head' ? null : <EarPiece3D zone={zone} d={d} />
}
