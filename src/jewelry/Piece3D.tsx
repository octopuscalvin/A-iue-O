import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { girthOf, useBody } from '../body/bodyProfile'
import { material } from '../materials/library'
import { beadSlots, chainLink, chainLinkCount, claspMaterial, jumpRingMaterial } from './bom'
import { SHAPE_GEO, SHAPE_HALF_H } from './charms'
import { useDesigns } from './designStore'
import { makeRing, type Ring } from './ring'
import { BASES, centerLengthMm, isThreaded, type CharmSpec, type RingDesign, type RingZone } from './types'

const MM = 0.001
const UP = new THREE.Vector3(0, 1, 0)

/** 沿住圈擺一件嘢：x = 切線、y = 大致向上（手臂 / 頸方向）、z = 向外 */
function frameAt(ring: Ring, t: number, q: THREE.Quaternion, p: THREE.Vector3) {
  const T = ring.tangentAt(t)
  const Y = UP.clone().addScaledVector(T, -UP.dot(T)).normalize()
  const Z = new THREE.Vector3().crossVectors(T, Y)
  q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(T, Y, Z))
  ring.pointAt(t, p)
}

// ---------------- 底座 ----------------

function Chain({ d, ring }: { d: RingDesign; ring: Ring }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const w = d.base.thickMm
  const L = chainLink(w)
  const n = chainLinkCount(ring.length / MM, w)
  const geo = useMemo(() => new THREE.TorusGeometry(L.R * MM, L.r * MM, 8, 20), [L.R, L.r])
  useEffect(() => () => geo.dispose(), [geo])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const q = new THREE.Quaternion()
    const p = new THREE.Vector3()
    const twist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
    const s = new THREE.Vector3(L.stretch, 1, 1)
    const mat = new THREE.Matrix4()
    for (let i = 0; i < n; i++) {
      frameAt(ring, (i + 0.5) / n, q, p)
      if (i % 2) q.multiply(twist) // 一個平放、一個企起，似真鏈
      m.setMatrixAt(i, mat.compose(p, q, s))
    }
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [ring, n, L.stretch, geo])
  return <instancedMesh ref={ref} args={[geo, undefined, n]} material={material(d.base.material)} />
}

function Beads({ d, ring }: { d: RingDesign; ring: Ring }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const { keep } = beadSlots(d, ring.length / MM)
  const geo = useMemo(() => new THREE.SphereGeometry((d.base.thickMm / 2) * MM * 0.98, 20, 14), [d.base.thickMm])
  useEffect(() => () => geo.dispose(), [geo])
  const key = keep.join(',')
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const p = new THREE.Vector3()
    const mat = new THREE.Matrix4()
    keep.forEach((t, i) => m.setMatrixAt(i, mat.makeTranslation(ring.pointAt(t, p))))
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [ring, key, geo])
  return <instancedMesh ref={ref} args={[geo, undefined, Math.max(1, keep.length)]} material={material(d.base.material)} />
}

function Tube({ d, ring }: { d: RingDesign; ring: Ring }) {
  const geo = useMemo(() => new THREE.TubeGeometry(ring.curve, 240, (d.base.thickMm / 2) * MM, 16, true), [ring, d.base.thickMm])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={material(d.base.material)} />
}

/** 蕾絲帶：沿住圈嘅一條闊帶，花紋沿長度重複 */
function Lace({ d, ring }: { d: RingDesign; ring: Ring }) {
  const geo = useMemo(() => {
    const w = d.base.thickMm * MM
    const N = 240
    const repeats = Math.max(1, Math.round(ring.length / (w * 2)))
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    const p = new THREE.Vector3()
    for (let i = 0; i <= N; i++) {
      const u = i / N
      ring.pointAt(u, p)
      for (const v of [-0.5, 0.5]) {
        pos.push(p.x, v * w, p.z)
        uv.push(u * repeats, v + 0.5)
      }
      if (i < N) {
        const a = i * 2
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [ring, d.base.thickMm])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={material(d.base.material)} />
}

/** 龍蝦扣：放喺圈嘅另一邊（t = 0.5） */
function Clasp({ d, ring }: { d: RingDesign; ring: Ring }) {
  const { q, p } = useMemo(() => {
    const q = new THREE.Quaternion()
    const p = new THREE.Vector3()
    frameAt(ring, 0.5, q, p)
    return { q, p }
  }, [ring])
  const m = material(claspMaterial(d))
  const out = d.base.type === 'lace' ? 0.6 : d.base.thickMm / 2
  return (
    <group position={p} quaternion={q}>
      <group position={[0, 0, out * MM]}>
        <mesh material={m} position={[2.6 * MM, 0, 0]} scale={[1.7, 1, 1]}>
          <torusGeometry args={[2 * MM, 0.55 * MM, 10, 28]} />
        </mesh>
        <mesh material={m} position={[-1.2 * MM, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.8 * MM, 0.4 * MM, 8, 24]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------- 配件 ----------------

const tmpQ = new THREE.Quaternion()
const m4 = new THREE.Matrix4()
const vDown = new THREE.Vector3(), vN = new THREE.Vector3()
const vX = new THREE.Vector3(), vY = new THREE.Vector3(), vZ = new THREE.Vector3()
const plane = new THREE.Plane()
const hit = new THREE.Vector3()
const selMat = new THREE.MeshBasicMaterial({ color: '#ff4f8b', transparent: true, opacity: 0.85, depthTest: false })

function CharmNode({ c, d, ring, zone, root }: {
  c: CharmSpec; d: RingDesign; ring: Ring; zone: RingZone; root: React.RefObject<THREE.Group>
}) {
  const selected = useDesigns((s) => s.selected === c.id)
  const select = useDesigns((s) => s.select)
  const update = useDesigns((s) => s.updateCharm)
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null
  const orient = useRef<THREE.Group>(null)
  const dragging = useRef(false)
  const threaded = isThreaded(c, d.base.type)
  const size = c.sizeMm * MM
  const out = d.base.type === 'lace' ? 0.8 * MM : (d.base.thickMm / 2) * MM

  const pos = useMemo(() => {
    const p = ring.pointAt(c.t)
    if (!threaded) p.addScaledVector(ring.normalAt(c.t), out)
    return p
  }, [ring, c.t, threaded, out])

  // 吊墜：受地心吸力向下垂，用彈簧模擬晃動；如果會插入身體，就沿住皮膚表面攤開
  const dir = useRef(new THREE.Vector3(0, -1, 0))
  const vel = useRef(new THREE.Vector3())
  useFrame((_, rawDt) => {
    const g = orient.current
    if (threaded || !g?.parent) return
    const dt = Math.min(rawDt, 1 / 30)
    g.parent.getWorldQuaternion(tmpQ).invert()
    vDown.set(0, -1, 0).applyQuaternion(tmpQ)
    ring.normalAt(c.t, vN)
    const keepOut = (v: THREE.Vector3) => {
      const dn = v.dot(vN)
      if (dn < 0.2) v.addScaledVector(vN, 0.2 - dn)
      if (v.lengthSq() < 1e-6) v.set(0, -1, 0)
      return v.normalize()
    }
    keepOut(vDown)
    // 彈簧：加速度 = 拉力 − 阻尼（阻尼偏細，所以會擺幾下先停）
    vel.current.addScaledVector(vDown.clone().sub(dir.current), 90 * dt).multiplyScalar(Math.exp(-6 * dt))
    dir.current.addScaledVector(vel.current, dt)
    keepOut(dir.current)
    vY.copy(dir.current).negate()
    vZ.copy(vN).addScaledVector(vY, -vN.dot(vY))
    if (vZ.lengthSq() < 1e-6) vZ.set(0, 0, 1)
    vZ.normalize()
    vX.crossVectors(vY, vZ)
    g.quaternion.setFromRotationMatrix(m4.makeBasis(vX, vY, vZ))
  })

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    select(c.id)
    dragging.current = true
    ;(e.target as unknown as Element).setPointerCapture?.(e.pointerId)
    if (controls) controls.enabled = false
    document.body.style.cursor = 'grabbing'
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current || !root.current) return
    e.stopPropagation()
    const r = root.current
    r.updateWorldMatrix(true, false)
    const normal = new THREE.Vector3(0, 1, 0).transformDirection(r.matrixWorld)
    plane.setFromNormalAndCoplanarPoint(normal, new THREE.Vector3().setFromMatrixPosition(r.matrixWorld))
    if (!e.ray.intersectPlane(plane, hit)) return
    r.worldToLocal(hit)
    update(zone, c.id, { t: Math.round(ring.tFromLocal(hit.x, hit.z) * 360) / 360 })
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return
    dragging.current = false
    ;(e.target as unknown as Element).releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
    document.body.style.cursor = 'grab'
  }

  const shape = (
    <mesh geometry={SHAPE_GEO[c.shape]} material={material(c.material)} scale={size} />
  )
  const halo = selected && (
    <mesh material={selMat} renderOrder={30}>
      <torusGeometry args={[size * 0.78, 0.00035, 8, 40]} />
    </mesh>
  )

  return (
    <group
      position={pos}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerOver={(e) => (e.stopPropagation(), (document.body.style.cursor = 'grab'))}
      onPointerOut={() => !dragging.current && (document.body.style.cursor = '')}
    >
      {threaded ? (
        <>
          {shape}
          {halo}
        </>
      ) : (
        <group ref={orient}>
          <mesh material={material(jumpRingMaterial(c, d))} position={[0, -1.6 * MM, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[1.65 * MM, 0.35 * MM, 8, 24]} />
          </mesh>
          <group position={[0, -(3.2 * MM + SHAPE_HALF_H[c.shape] * size), 0]}>
            {shape}
            {halo}
          </group>
        </group>
      )}
    </group>
  )
}

/** 一件圈形首飾（手鏈、腳鏈、臂環、頸鏈），掛喺對應掛點度 */
export function Piece3D({ zone }: { zone: RingZone }) {
  const d = useDesigns((s) => s.designs[zone])
  const body = useBody((s) => s.profile)
  const root = useRef<THREE.Group>(null)
  const girth = girthOf(body, zone)
  const len = d ? centerLengthMm(d, zone, girth) : 0
  const fit = d?.fit ?? ''
  const ring = useMemo(() => makeRing(len * MM, zone, body, fit), [len, zone, body, fit])
  if (!d) return null
  const Base = { chain: Chain, beads: Beads, bangle: Tube, cord: Tube, lace: Lace }[d.base.type]
  return (
    <group ref={root}>
      <Base d={d} ring={ring} />
      {BASES[d.base.type].clasp && <Clasp d={d} ring={ring} />}
      {d.charms.map((c) => (
        <CharmNode key={c.id} c={c} d={d} ring={ring} zone={zone} root={root} />
      ))}
    </group>
  )
}
