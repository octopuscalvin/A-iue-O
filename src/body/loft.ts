import * as THREE from 'three'

/**
 * 一個「截面圈」：喺高度 y 嘅橢圓截面。
 * a = 左右半闊 (X)，b = 前後半深 (Z)，dx/dz = 截面中心偏移。
 * 單位全部係「米」(1 = 1m)，所以 0.024 = 2.4cm。
 */
export interface Ring {
  y: number
  a: number
  b?: number
  dx?: number
  dz?: number
}

interface FullRing {
  y: number
  a: number
  b: number
  dx: number
  dz: number
}

const norm = (k: Ring): FullRing => ({ y: k.y, a: k.a, b: k.b ?? k.a, dx: k.dx ?? 0, dz: k.dz ?? 0 })

function cr(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

function interp(keys: FullRing[], i: number, t: number): FullRing {
  const p0 = keys[Math.max(i - 1, 0)]
  const p1 = keys[i]
  const p2 = keys[i + 1]
  const p3 = keys[Math.min(i + 2, keys.length - 1)]
  const f = (k: keyof FullRing) => cr(p0[k], p1[k], p2[k], p3[k], t)
  return { y: f('y'), a: Math.max(0.001, f('a')), b: Math.max(0.001, f('b')), dx: f('dx'), dz: f('dz') }
}

const sorted = (keys: Ring[]) => keys.map(norm).sort((p, q) => p.y - q.y)

/** 喺一組截面入面，攞返某個高度 y 嘅平滑截面（用嚟整貼身衣物）。 */
export function sampleAt(keysIn: Ring[], y: number): FullRing {
  const keys = sorted(keysIn)
  if (y <= keys[0].y) return { ...keys[0], y }
  if (y >= keys[keys.length - 1].y) return { ...keys[keys.length - 1], y }
  let i = 0
  while (i < keys.length - 2 && keys[i + 1].y < y) i++
  const t = (y - keys[i].y) / (keys[i + 1].y - keys[i].y)
  return { ...interp(keys, i, t), y }
}

/** 由身體截面抽一段出嚟再「脹大」少少，就變成貼身布料（例如內衣）。 */
export function shell(keys: Ring[], y0: number, y1: number, grow: number, steps = 8): Ring[] {
  const out: Ring[] = []
  for (let s = 0; s <= steps; s++) {
    const r = sampleAt(keys, y0 + ((y1 - y0) * s) / steps)
    out.push({ y: r.y, a: r.a + grow, b: r.b + grow, dx: r.dx, dz: r.dz })
  }
  return out
}

export interface LoftOptions {
  radial?: number
  sub?: number
  capBottom?: boolean
  capTop?: boolean
}

/** 將一串截面圈「放樣」成一個平滑嘅 3D 形狀（身體每一節都係咁整）。 */
export function loft(keysIn: Ring[], opts: LoftOptions = {}): THREE.BufferGeometry {
  const { radial = 40, sub = 5, capBottom = true, capTop = true } = opts
  const keys = sorted(keysIn)
  const rings: FullRing[] = []
  for (let i = 0; i < keys.length - 1; i++) {
    for (let s = 0; s < sub; s++) rings.push(interp(keys, i, s / sub))
  }
  rings.push(keys[keys.length - 1])

  const pos: number[] = []
  const idx: number[] = []
  for (const r of rings) {
    for (let j = 0; j < radial; j++) {
      const th = (j / radial) * Math.PI * 2
      pos.push(r.dx + r.a * Math.sin(th), r.y, r.dz + r.b * Math.cos(th))
    }
  }
  const at = (i: number, j: number) => i * radial + (j % radial)
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      idx.push(at(i, j), at(i, j + 1), at(i + 1, j + 1))
      idx.push(at(i, j), at(i + 1, j + 1), at(i + 1, j))
    }
  }
  if (capBottom) {
    const r = rings[0]
    const c = pos.length / 3
    pos.push(r.dx, r.y - Math.min(r.a, r.b) * 0.5, r.dz)
    for (let j = 0; j < radial; j++) idx.push(c, at(0, j + 1), at(0, j))
  }
  if (capTop) {
    const last = rings.length - 1
    const r = rings[last]
    const c = pos.length / 3
    pos.push(r.dx, r.y + Math.min(r.a, r.b) * 0.5, r.dz)
    for (let j = 0; j < radial; j++) idx.push(c, at(last, j), at(last, j + 1))
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** 四肢用：t = 由關節向下嘅距離（米）。[t, a, b?, dz?] */
export type LimbKey = [number, number, number?, number?]
export const limbRings = (keys: LimbKey[]): Ring[] =>
  keys.map(([t, a, b, dz]) => ({ y: -t, a, b: b ?? a, dz: dz ?? 0 }))
