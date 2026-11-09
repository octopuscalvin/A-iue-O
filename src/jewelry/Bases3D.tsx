import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MATERIAL_MAP, material } from '../materials/library'
import type { Ring } from './ring'
import { beadSlots, chainLink, chainLinkCount, claspMaterial } from './bom'
import type { RingDesign } from './types'

/**
 * 各種底座嘅 3D 形狀。全部用真實尺寸（mm → 米）。
 * 共用做法：沿住圈「掃」一個截面（sweep），或者沿圈擺一粒粒（instanced）。
 */
const MM = 0.001
const UP = new THREE.Vector3(0, 1, 0)

export interface Frame { p: THREE.Vector3; T: THREE.Vector3; Y: THREE.Vector3; N: THREE.Vector3 }

/** 圈上 u 位置嘅座標：T = 切線、N = 向外、Y = 大致向上 */
export function frameAtU(ring: Ring, u: number): Frame {
  const p = ring.pointAt(u)
  const T = ring.tangentAt(u)
  const N = ring.normalAt(u).addScaledVector(T, -ring.normalAt(u).dot(T)).normalize()
  const Y = new THREE.Vector3().crossVectors(N, T).normalize()
  if (Y.dot(UP) < 0) Y.negate()
  return { p, T, Y, N }
}
export const frameQuat = (f: Frame) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.T, f.Y, f.N))

/**
 * 沿住圈掃截面。profile(i, u) 回傳截面點 [向外 n, 向上 y]（米），逆時針。
 * closed = 成個圈；否則由 u0 到 u1，兩頭封口。
 */
function sweep(ring: Ring, n: number, profile: (u: number) => [number, number][], opts: { u0?: number; u1?: number; closed?: boolean; flat?: boolean } = {}) {
  const { u0 = 0, u1 = 1, closed = true, flat = false } = opts
  const steps = closed ? n : n + 1
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let m = 0
  const centers: THREE.Vector3[] = []
  for (let i = 0; i < steps; i++) {
    const u = closed ? i / n : u0 + ((u1 - u0) * i) / n
    const f = frameAtU(ring, u)
    const prof = profile(u)
    m = prof.length
    prof.forEach(([a, b], j) => {
      pos.push(f.p.x + f.N.x * a + f.Y.x * b, f.p.y + f.N.y * a + f.Y.y * b, f.p.z + f.N.z * a + f.Y.z * b)
      uv.push(closed ? i / n : (u - u0) / (u1 - u0), j / m)
    })
    centers.push(f.p)
  }
  const at = (i: number, j: number) => (i % steps) * m + (j % m)
  const last = closed ? steps : steps - 1
  for (let i = 0; i < last; i++) {
    for (let j = 0; j < m; j++) {
      idx.push(at(i, j), at(i + 1, j), at(i, j + 1))
      idx.push(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1))
    }
  }
  if (!closed) {
    // 兩頭封口
    for (const [i, flip] of [[0, true], [steps - 1, false]] as [number, boolean][]) {
      const c = pos.length / 3
      pos.push(centers[i].x, centers[i].y, centers[i].z)
      uv.push(0, 0)
      for (let j = 0; j < m; j++) idx.push(...(flip ? [c, at(i, j + 1), at(i, j)] : [c, at(i, j), at(i, j + 1)]))
    }
  }
  let g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  if (flat) g = g.toNonIndexed()
  g.computeVertexNormals()
  return g
}

/** 圓角長方截面（扁身手環） */
function roundRect(thick: number, width: number, m = 36, e = 0.28) {
  const pts: [number, number][] = []
  for (let j = 0; j < m; j++) {
    const a = (j / m) * Math.PI * 2 - Math.PI // 由內面開始，外面喺正中（貼圖用）
    const c = Math.cos(a), s = Math.sin(a)
    pts.push([(thick / 2) * Math.sign(c) * Math.abs(c) ** e, (width / 2) * Math.sign(s) * Math.abs(s) ** e])
  }
  return pts
}
const circle = (r: number, m = 16) => Array.from({ length: m }, (_, j) => {
  const a = (j / m) * Math.PI * 2
  return [r * Math.cos(a), r * Math.sin(a)] as [number, number]
})

/** 固定亂數（錘紋用） */
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function useGeo(make: () => THREE.BufferGeometry, deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g = useMemo(make, deps)
  useEffect(() => () => g.dispose(), [g])
  return g
}

/** 一堆相同嘅細件（鏈圈、珠、寶石）：傳入每件嘅 matrix */
function Instances({ geo, mat, matrices }: { geo: THREE.BufferGeometry; mat: THREE.Material; matrices: THREE.Matrix4[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    matrices.forEach((x, i) => m.setMatrixAt(i, x))
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [matrices])
  return <instancedMesh key={matrices.length} ref={ref} args={[geo, undefined, Math.max(1, matrices.length)]} material={mat} />
}

const compose = (f: Frame, extra?: THREE.Quaternion, scale = new THREE.Vector3(1, 1, 1), out = 0) => {
  const q = frameQuat(f)
  if (extra) q.multiply(extra)
  return new THREE.Matrix4().compose(f.p.clone().addScaledVector(f.N, out), q, scale)
}
const rotT = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a)

// ================= 鏈 =================

export function ChainBase({ d, ring }: { d: RingDesign; ring: Ring }) {
  const w = d.base.thickMm
  const v = d.base.variant ?? 'cable'
  const mat = material(d.base.material)
  const L = ring.length / MM

  const link = chainLink(w)
  const none = () => new THREE.BufferGeometry()
  const torus = useGeo(() => new THREE.TorusGeometry(link.R * MM, link.r * MM, 8, 20), [w])
  const ball = useGeo(() => new THREE.SphereGeometry(1.4 * w * MM, 14, 10), [w])
  const bar = useGeo(() => new THREE.CylinderGeometry(0.25 * w * MM, 0.25 * w * MM, 1.2 * w * MM, 6).rotateZ(Math.PI / 2), [w])
  const box = useGeo(() => new THREE.BoxGeometry(2.1 * w * MM, 2.1 * w * MM, 2.1 * w * MM), [w])
  const snake = useGeo(() => v !== 'snake' ? none() : sweep(ring, 480, (u) => circle(1.4 * w * MM * (1 + 0.07 * Math.abs(Math.sin(u * L / (0.9 * w) * Math.PI))), 14)), [ring, w, v])
  const rope = useGeo(() => {
    if (v !== 'rope') return none()
    const geos = [0, 1].map((k) => {
      const pts: THREE.Vector3[] = []
      const n = Math.round(L / 0.5)
      for (let i = 0; i < n; i++) {
        const u = i / n
        const f = frameAtU(ring, u)
        const ph = (u * L) / (3 * w) * Math.PI * 2 + k * Math.PI
        pts.push(f.p.clone().addScaledVector(f.N, 0.55 * w * MM * Math.cos(ph)).addScaledVector(f.Y, 0.55 * w * MM * Math.sin(ph)))
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), n, 0.62 * w * MM, 8, true)
    })
    return mergeGeos(geos)
  }, [ring, w, v])

  const instances = useMemo(() => {
    if (v === 'ball') {
      const n = Math.max(8, Math.round(L / (3.6 * w)))
      const balls: THREE.Matrix4[] = [], bars: THREE.Matrix4[] = []
      for (let i = 0; i < n; i++) {
        balls.push(compose(frameAtU(ring, i / n)))
        bars.push(compose(frameAtU(ring, (i + 0.5) / n)))
      }
      return { balls, bars }
    }
    if (v === 'box') {
      const n = Math.max(8, Math.round(L / (2.3 * w)))
      return { boxes: Array.from({ length: n }, (_, i) => compose(frameAtU(ring, (i + 0.5) / n), rotT(i % 2 ? Math.PI / 4 : 0))) }
    }
    if (v === 'curb' || v === 'figaro') {
      // 側身鏈：鏈圈扭平；費加洛：一長三短
      const pattern = v === 'figaro' ? [2.2, 1, 1, 1] : [1]
      const base = chainLink(w).pitch
      const unit = pattern.reduce((s, x) => s + x * base, 0)
      const reps = Math.max(2, Math.round(L / unit))
      const k = L / (reps * unit)
      const out: THREE.Matrix4[] = []
      let pos = 0
      for (let r = 0; r < reps; r++) {
        pattern.forEach((len, j) => {
          const l = len * base * k
          const u = (pos + l / 2) / L
          out.push(compose(frameAtU(ring, u), rotT((out.length % 2 ? 1 : -1) * 0.45), new THREE.Vector3(link.stretch * len * k, 1, 0.55)))
          pos += l
          void j
        })
      }
      return { links: out }
    }
    // O字鏈：一平一企
    const n = chainLinkCount(L, w)
    return { links: Array.from({ length: n }, (_, i) => compose(frameAtU(ring, (i + 0.5) / n), i % 2 ? rotT(Math.PI / 2) : undefined, new THREE.Vector3(link.stretch, 1, 1))) }
  }, [ring, v, w, L, link.stretch])

  if (v === 'snake') return <mesh geometry={snake} material={mat} />
  if (v === 'rope') return <mesh geometry={rope} material={mat} />
  if (v === 'ball') return <><Instances geo={ball} mat={mat} matrices={instances.balls!} /><Instances geo={bar} mat={mat} matrices={instances.bars!} /></>
  if (v === 'box') return <Instances geo={box} mat={mat} matrices={instances.boxes!} />
  return <Instances geo={torus} mat={mat} matrices={instances.links!} />
}

function mergeGeos(geos: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [], idx: number[] = []
  let off = 0
  for (const g of geos) {
    const p = g.attributes.position, n = g.attributes.normal
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i))
      nor.push(n.getX(i), n.getY(i), n.getZ(i))
    }
    const ix = g.index!
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off)
    off += p.count
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setIndex(idx)
  return out
}

// ================= 名牌手鏈 =================

function textTexture(text: string, w: number, h: number, bg: string, fg: string, font: string) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  g.fillStyle = fg
  g.font = font
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, w / 2, h / 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function IdChainBase({ d, ring, home }: { d: RingDesign; ring: Ring; home: number }) {
  const W = d.base.widthMm ?? 30
  const text = (d.base.text ?? '').toUpperCase()
  const plateMat = useMemo(() => {
    const m = (material(d.base.material) as THREE.MeshPhysicalMaterial).clone()
    m.map = textTexture(text, 1024, 256, '#ffffff', '#6d6d6d', 'bold 150px "Times New Roman", serif')
    return m
  }, [d.base.material, text])
  useEffect(() => () => (plateMat.map?.dispose(), plateMat.dispose()), [plateMat])
  const f = frameAtU(ring, home)
  const q = frameQuat(f)
  const out = 1.4 * MM
  return (
    <>
      <ChainBase d={{ ...d, base: { ...d.base, variant: 'curb' } }} ring={ring} />
      <group position={f.p.clone().addScaledVector(f.N, out)} quaternion={q}>
        <mesh material={plateMat}>
          <boxGeometry args={[W * MM, 8 * MM, 1.3 * MM]} />
        </mesh>
      </group>
    </>
  )
}

// ================= 鑽石手鏈 =================

/** 圓形明亮式切割（簡化）：亭部尖底、冠部、檯面 */
const BRILLIANT = new THREE.LatheGeometry(
  [[0, -0.43], [0.5, 0], [0.5, 0.03], [0.32, 0.17], [0, 0.17]].map(([x, y]) => new THREE.Vector2(x, y)),
  8,
)

export function TennisBase({ d, ring }: { d: RingDesign; ring: Ring }) {
  const g = d.base.thickMm
  const L = ring.length / MM
  const cup = useGeo(() => new THREE.CylinderGeometry(0.56 * g * MM, 0.4 * g * MM, 0.45 * g * MM, 12), [g])
  const { gems, cups } = useMemo(() => {
    const n = Math.max(10, Math.floor(L / (g * 1.12)))
    const toN = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1))
    const gems: THREE.Matrix4[] = [], cups: THREE.Matrix4[] = []
    for (let i = 0; i < n; i++) {
      const f = frameAtU(ring, (i + 0.5) / n)
      gems.push(compose(f, toN, new THREE.Vector3(g * MM, g * MM, g * MM), 0.25 * g * MM))
      cups.push(compose(f, toN, undefined, 0.02 * g * MM))
    }
    return { gems, cups }
  }, [ring, g, L])
  return (
    <>
      <Instances geo={BRILLIANT} mat={material(d.base.gem ?? 'gem_clear')} matrices={gems} />
      <Instances geo={cup} mat={material(d.base.material)} matrices={cups} />
    </>
  )
}

// ================= 珠串（多款珠 + 字母珠） =================

const letterTexCache = new Map<string, THREE.Texture>()
function letterMaterial(ch: string, bg: string) {
  const key = ch + bg
  let t = letterTexCache.get(key)
  if (!t) {
    t = textTexture(ch, 128, 128, bg, '#3a2a32', 'bold 92px system-ui, sans-serif')
    letterTexCache.set(key, t)
  }
  return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.35, clearcoat: 1 })
}

export function BeadsBase({ d, ring, home }: { d: RingDesign; ring: Ring; home: number }) {
  const r = (d.base.thickMm / 2) * MM * 0.98
  const v = d.base.variant ?? 'round'
  const text = (d.base.text ?? '').toUpperCase().replace(/\s+/g, '')
  const geo = useGeo(() => {
    if (v === 'faceted') return new THREE.IcosahedronGeometry(r, 1)
    if (v === 'cube') return new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6)
    if (v === 'rondelle') return new THREE.SphereGeometry(r, 20, 14).scale(0.62, 1, 1)
    return new THREE.SphereGeometry(r, 20, 14)
  }, [r, v])
  const { keep } = beadSlots(d, ring.length / MM)
  // 字母珠：放喺正外側（home），由左至右
  const letters = useMemo(() => {
    if (!text) return { plain: keep, letters: [] as { t: number; ch: string }[] }
    const sorted = keep.map((t, i) => ({ t, i, dist: Math.abs(((t - home + 1.5) % 1) - 0.5) }))
    const centre = sorted.reduce((b, x) => (x.dist < b.dist ? x : b), sorted[0]).i
    const start = centre - Math.floor((text.length - 1) / 2)
    const used = new Set<number>()
    const out: { t: number; ch: string }[] = []
    for (let k = 0; k < text.length; k++) {
      const i = (start + k + keep.length) % keep.length
      used.add(i)
      out.push({ t: keep[i], ch: text[k] })
    }
    return { plain: keep.filter((_, i) => !used.has(i)), letters: out }
  }, [keep.join(','), text, home])
  const matrices = useMemo(() => letters.plain.map((t) => compose(frameAtU(ring, t), v === 'faceted' ? rotT(t * 40) : undefined)), [ring, letters, v])
  const cube = useGeo(() => new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6), [r])
  const plainMat = material(d.base.material)
  const letterMats = useMemo(() => {
    const white = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.35, clearcoat: 1 })
    return letters.letters.map(({ ch }) => [white, white, white, white, letterMaterial(ch, '#ffffff'), white])
  }, [letters])
  return (
    <>
      <Instances geo={geo} mat={plainMat} matrices={matrices} />
      {letters.letters.map(({ t, ch }, i) => {
        const f = frameAtU(ring, t)
        return <mesh key={`${i}-${ch}`} geometry={cube} material={letterMats[i]} position={f.p} quaternion={frameQuat(f)} />
      })}
    </>
  )
}

// ================= 扁身手環（硬膠、開口手鐲、矽膠、皮帶） =================

function bandProfile(d: RingDesign, L: number) {
  const T = d.base.thickMm * MM
  const W = (d.base.widthMm ?? 12) * MM
  const v = d.base.variant ?? 'smooth'
  const base = roundRect(T, W, v === 'faceted' ? 8 : 36, v === 'faceted' ? 0.7 : 0.28)
  return (u: number) =>
    base.map(([n, y], j): [number, number] => {
      let k = 1
      if (v === 'ribbed') k = 1 + 0.3 * Math.abs(Math.sin(u * (L / 3) * Math.PI))
      if (v === 'twisted') {
        const ph = (j / base.length) * Math.PI * 2
        k = 1 + 0.25 * Math.abs(Math.sin(ph * 2 + (u * L) / 6 * Math.PI * 2))
      }
      if (v === 'hammered') k = 1 - 0.18 * hash(Math.round(u * L / 1.6), Math.round(j / 3))
      return [n * (n > 0 ? k : 1), y]
    })
}

/** 矽膠凹字：成條帶用一張貼圖，字放喺正外側 */
function bandTextMaterial(d: RingDesign, home: number) {
  const base = material(d.base.material) as THREE.MeshPhysicalMaterial
  if (!d.base.text) return base
  const sw = MATERIAL_MAP[d.base.material]?.swatch ?? '#f7a8c4'
  const c = document.createElement('canvas')
  c.width = 4096
  c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = new THREE.Color(sw).getHex() > 0x888888 ? '#b9b9b9' : '#d8d8d8'
  g.font = 'bold 70px system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(d.base.text.toUpperCase(), home * c.width, c.height / 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const m = base.clone()
  m.map = t
  return m
}

export function BandBase({ d, ring, home }: { d: RingDesign; ring: Ring; home: number }) {
  const L = ring.length / MM
  const type = d.base.type
  const v = d.base.variant ?? 'smooth'
  // 開口手鐲：留 25mm 開口（喺手腕內側）
  const gap = type === 'cuff' ? 25 / L : 0
  const gapAt = (home + 0.5) % 1
  const geo = useGeo(
    () => sweep(ring, type === 'cuff' ? 300 : 360, bandProfile(d, L), type === 'cuff'
      ? { closed: false, u0: gapAt + gap / 2, u1: gapAt + 1 - gap / 2, flat: v === 'faceted' }
      : { flat: v === 'faceted' }),
    [ring, d.base.thickMm, d.base.widthMm, v, type, gapAt],
  )
  const mat = useMemo(() => (type === 'silicone' ? bandTextMaterial(d, home) : material(d.base.material)), [type, d.base.material, d.base.text, home])
  return (
    <>
      <mesh geometry={geo} material={mat} />
      {type === 'strap' && <Buckle d={d} ring={ring} home={home} />}
    </>
  )
}

/** 皮帶扣（喺手腕內側）+ 幾個窿 */
function Buckle({ d, ring, home }: { d: RingDesign; ring: Ring; home: number }) {
  const W = (d.base.widthMm ?? 14) * MM
  const T = d.base.thickMm * MM
  const at = (home + 0.5) % 1
  const L = ring.length / MM
  const metal = material(claspMaterial(d))
  const hole = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a1416', roughness: 0.9 }), [])
  const f = frameAtU(ring, at)
  const q = frameQuat(f)
  const bw = 1.4 * MM
  const fw = W + 3 * MM, fl = W * 0.85
  return (
    <>
      <group position={f.p.clone().addScaledVector(f.N, T / 2 + bw / 2)} quaternion={q}>
        {/* 扣框：四條邊 */}
        <mesh material={metal} position={[0, fw / 2, 0]}><boxGeometry args={[fl, bw, bw]} /></mesh>
        <mesh material={metal} position={[0, -fw / 2, 0]}><boxGeometry args={[fl, bw, bw]} /></mesh>
        <mesh material={metal} position={[fl / 2, 0, 0]}><boxGeometry args={[bw, fw, bw]} /></mesh>
        <mesh material={metal} position={[-fl / 2, 0, 0]}><boxGeometry args={[bw, fw, bw]} /></mesh>
        {/* 扣針 */}
        <mesh material={metal} position={[0, 0, bw * 0.3]}><boxGeometry args={[fl, 0.9 * MM, 0.9 * MM]} /></mesh>
      </group>
      {[1, 2, 3, 4].map((k) => {
        const h = frameAtU(ring, at + (k * 9) / L)
        return (
          <mesh key={k} material={hole} position={h.p.clone().addScaledVector(h.N, T / 2 + 0.05 * MM)} quaternion={frameQuat(h)}>
            <cylinderGeometry args={[1 * MM, 1 * MM, 0.3 * MM, 12]} />
          </mesh>
        )
      })}
    </>
  )
}

// ================= 編織手繩 =================

export function BraidedBase({ d, ring }: { d: RingDesign; ring: Ring }) {
  const t = d.base.thickMm
  const L = ring.length / MM
  const v = d.base.variant ?? 'braid'
  const colors = d.base.colors?.length ? d.base.colors : [d.base.material, d.base.material, d.base.material]
  const strands = useMemo(() => {
    const n = Math.round(L / 0.6)
    return [0, 1, 2].map((k) => {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i < n; i++) {
        const u = i / n
        const f = frameAtU(ring, u)
        const ph = (u * L) / (t * 2.2) * Math.PI * 2 + (k * Math.PI * 2) / 3
        const [a, b] = v === 'twist'
          ? [0.3 * t * Math.cos(ph), 0.3 * t * Math.sin(ph)]
          : [0.16 * t * Math.sin(2 * ph), 0.34 * t * Math.sin(ph)]
        pts.push(f.p.clone().addScaledVector(f.N, a * MM).addScaledVector(f.Y, b * MM))
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), n, 0.3 * t * MM, 8, true)
    })
  }, [ring, t, L, v])
  useEffect(() => () => strands.forEach((g) => g.dispose()), [strands])
  // 抽繩結（喺內側）+ 兩條尾
  const k = frameAtU(ring, 0.5)
  const kq = frameQuat(k)
  return (
    <>
      {strands.map((g, i) => <mesh key={i} geometry={g} material={material(colors[i % colors.length])} />)}
      <group position={k.p} quaternion={kq}>
        <mesh material={material(colors[0])} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.85 * t * MM, 0.85 * t * MM, 10 * MM, 16]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 4 * MM, -0.6 * t * MM, 0.3 * t * MM]}>
            <mesh material={material(colors[1 % colors.length])} position={[0, -9 * MM, 0]}>
              <cylinderGeometry args={[0.32 * t * MM, 0.32 * t * MM, 18 * MM, 8]} />
            </mesh>
            <mesh material={material(colors[2 % colors.length])} position={[0, -18.5 * MM, 0]}>
              <sphereGeometry args={[0.7 * t * MM, 14, 10]} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  )
}

// ================= 多圈：皮繩 / 螺旋手鐲 =================

function spiralCurve(ring: Ring, turns: number, pitchMm: number) {
  const pts: THREE.Vector3[] = []
  const per = 90
  const n = Math.round(turns * per)
  for (let i = 0; i <= n; i++) {
    const u = i / per
    const f = frameAtU(ring, u % 1)
    pts.push(f.p.clone().addScaledVector(f.Y, (u - turns / 2) * pitchMm * MM))
  }
  return new THREE.CatmullRomCurve3(pts, false)
}

export function WrapBase({ d, ring }: { d: RingDesign; ring: Ring }) {
  const t = d.base.thickMm
  const turns = d.base.count ?? 2
  const curve = useMemo(() => spiralCurve(ring, turns, t + 0.8), [ring, turns, t])
  const geo = useGeo(() => new THREE.TubeGeometry(curve, Math.round(turns * 180), (t / 2) * MM, 10, false), [curve, t])
  const metal = material(claspMaterial(d))
  const ends = [curve.getPointAt(0), curve.getPointAt(1)]
  return (
    <>
      <mesh geometry={geo} material={material(d.base.material)} />
      {/* 兩頭按扣 */}
      {ends.map((p, i) => (
        <mesh key={i} material={metal} position={p}>
          <sphereGeometry args={[t * 0.85 * MM, 16, 12]} />
        </mesh>
      ))}
    </>
  )
}

export function SpiralBase({ d, ring }: { d: RingDesign; ring: Ring }) {
  const bead = d.base.thickMm
  const turns = d.base.count ?? 3
  const curve = useMemo(() => spiralCurve(ring, turns, bead + 0.6), [ring, turns, bead])
  const wire = useGeo(() => new THREE.TubeGeometry(curve, Math.round(turns * 180), 0.35 * MM, 6, false), [curve])
  const sphere = useGeo(() => new THREE.SphereGeometry((bead / 2) * 0.97 * MM, 16, 12), [bead])
  const matrices = useMemo(() => {
    const len = curve.getLength() / MM
    const n = Math.floor(len / bead)
    return Array.from({ length: n }, (_, i) => new THREE.Matrix4().makeTranslation(curve.getPointAt((i + 0.5) / n)))
  }, [curve, bead])
  const metal = material(d.base.material)
  return (
    <>
      <mesh geometry={wire} material={metal} />
      <Instances geo={sphere} mat={material(d.base.colors?.[0] ?? 'jelly_pink')} matrices={matrices} />
      {[0, 1].map((i) => (
        <mesh key={i} material={metal} position={curve.getPointAt(i)}>
          <sphereGeometry args={[1.2 * MM, 12, 8]} />
        </mesh>
      ))}
    </>
  )
}

// ================= 髮圈手圈 =================

export function ScrunchieBase({ d, ring }: { d: RingDesign; ring: Ring }) {
  const R = (d.base.thickMm / 2) * MM
  const L = ring.length / MM
  const folds = Math.max(8, Math.round(L / 11))
  const geo = useGeo(
    () => sweep(ring, 480, (u) => {
      const g = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(u * folds * Math.PI * 2))
      return circle(1, 24).map(([a, b], j) => {
        const ph = (j / 24) * Math.PI * 2
        const k = R * g * (1 + 0.07 * Math.sin(ph * 5 + u * folds * Math.PI * 2))
        return [a * k, b * k] as [number, number]
      })
    }),
    [ring, R, folds],
  )
  return <mesh geometry={geo} material={material(d.base.material)} />
}
