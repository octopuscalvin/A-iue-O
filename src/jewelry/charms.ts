import * as THREE from 'three'

/**
 * 可愛形狀配件：先畫 2D 圖形，再「擠壓」成有厚度、有圓邊嘅 3D 物件。
 * 加新形狀 = 喺下面加一個 2D 圖形。
 * 所有形狀都統一做成「闊 1 單位」，用嘅時候再按 mm 縮放。
 */
export type ShapeId = 'heart' | 'star' | 'moon' | 'flower' | 'bow' | 'paw' | 'cloud' | 'bead'

function heart() {
  const s = new THREE.Shape()
  s.moveTo(5, 5)
  s.bezierCurveTo(5, 5, 4, 0, 0, 0)
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7)
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19)
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7)
  s.bezierCurveTo(16, 7, 16, 0, 10, 0)
  s.bezierCurveTo(7, 0, 5, 5, 5, 5)
  return [s]
}

function star(points = 5, outer = 11, inner = 5) {
  const s = new THREE.Shape()
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  return [s]
}

function moon() {
  const s = new THREE.Shape()
  s.moveTo(3, 10)
  s.bezierCurveTo(-12, 10, -12, -10, 3, -10)
  s.bezierCurveTo(-4.5, -6, -4.5, 6, 3, 10)
  return [s]
}

/** 用極座標畫圓滑外形 */
function polar(r: (th: number) => number, clampY?: number, n = 160) {
  const s = new THREE.Shape()
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI * 2
    const rr = r(th)
    const x = Math.cos(th) * rr
    let y = Math.sin(th) * rr
    if (clampY !== undefined) y = Math.max(y, clampY)
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  return [s]
}

const flower = () => polar((t) => 7 + 3.6 * Math.abs(Math.cos(2.5 * t)))
const bow = () => polar((t) => 3.5 + 7.5 * Math.cos(t) ** 2)
const cloud = () =>
  polar((t) => {
    const base = 1 / Math.sqrt((Math.cos(t) / 11) ** 2 + (Math.sin(t) / 6.5) ** 2)
    return base + (Math.sin(t) > 0 ? 2.2 * Math.abs(Math.sin(3.5 * t)) : 0)
  }, -4.5)

function paw() {
  const pad = new THREE.Shape()
  pad.absellipse(0, -3, 6.2, 5, 0, Math.PI * 2, false, 0)
  const toe = (x: number, y: number, r: number) => {
    const s = new THREE.Shape()
    s.absarc(x, y, r, 0, Math.PI * 2, false)
    return s
  }
  return [pad, toe(-7.2, 3.6, 2.5), toe(-2.6, 7.6, 2.7), toe(2.6, 7.6, 2.7), toe(7.2, 3.6, 2.5)]
}

const OUTLINES: Record<Exclude<ShapeId, 'bead'>, { shapes: () => THREE.Shape[]; flip?: boolean }> = {
  heart: { shapes: heart, flip: true },
  star: { shapes: () => star() },
  moon: { shapes: moon },
  flower: { shapes: flower },
  bow: { shapes: bow },
  paw: { shapes: paw },
  cloud: { shapes: cloud },
}

function puffUnit(shapes: THREE.Shape[], flip = false) {
  const g = new THREE.ExtrudeGeometry(shapes, {
    depth: 3, bevelEnabled: true, bevelThickness: 2.4, bevelSize: 1.8, bevelSegments: 5, curveSegments: 24,
  })
  g.center()
  g.computeBoundingBox()
  const w = g.boundingBox!.max.x - g.boundingBox!.min.x
  g.scale(1 / w, 1 / w, 1 / w)
  if (flip) g.rotateZ(Math.PI)
  g.computeBoundingBox()
  return g
}

/** 計一個封閉模型嘅體積（立方單位） */
export function geometryVolume(g: THREE.BufferGeometry) {
  const pos = g.attributes.position
  const idx = g.index
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  let v = 0
  const n = idx ? idx.count : pos.count
  for (let i = 0; i < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2)
    v += a.dot(b.cross(c)) / 6
  }
  return Math.abs(v)
}

/** 闊 1 單位嘅 3D 形狀 */
export const SHAPE_GEO = {} as Record<ShapeId, THREE.BufferGeometry>
/** 闊 1 單位時嘅體積 */
export const SHAPE_VOLUME = {} as Record<ShapeId, number>
/** 闊 1 單位時嘅半高（用嚟計吊墜掛幾低） */
export const SHAPE_HALF_H = {} as Record<ShapeId, number>
/** 介面用嘅小圖示（SVG path，viewBox 0 0 24 24） */
export const SHAPE_SVG = {} as Record<ShapeId, string>

for (const [id, o] of Object.entries(OUTLINES) as [Exclude<ShapeId, 'bead'>, (typeof OUTLINES)['heart']][]) {
  const shapes = o.shapes()
  const g = puffUnit(shapes, o.flip)
  SHAPE_GEO[id] = g
  SHAPE_VOLUME[id] = geometryVolume(g)
  SHAPE_HALF_H[id] = (g.boundingBox!.max.y - g.boundingBox!.min.y) / 2

  const pts = shapes.map((s) => s.getPoints(16))
  const all = pts.flat()
  const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x))
  const minY = Math.min(...all.map((p) => p.y)), maxY = Math.max(...all.map((p) => p.y))
  const k = 20 / Math.max(maxX - minX, maxY - minY)
  const ox = 12 - ((maxX - minX) * k) / 2, oy = 12 - ((maxY - minY) * k) / 2
  SHAPE_SVG[id] = pts
    .map((ring) =>
      ring
        .map((p, i) => {
          const x = ox + (p.x - minX) * k
          const y = o.flip ? oy + (p.y - minY) * k : oy + (maxY - p.y) * k
          return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
        })
        .join('') + 'Z',
    )
    .join('')
}
SHAPE_GEO.bead = new THREE.SphereGeometry(0.5, 24, 18)
SHAPE_VOLUME.bead = (4 / 3) * Math.PI * 0.125
SHAPE_HALF_H.bead = 0.5
SHAPE_SVG.bead = 'M12 3a9 9 0 1 0 0.01 0Z'

/** 舊示範首飾用（固定大小，單位：米） */
function sized(id: ShapeId, mm: number) {
  const g = SHAPE_GEO[id].clone()
  g.scale(mm / 1000, mm / 1000, mm / 1000)
  return g
}
export const CHARMS = {
  heart: sized('heart', 10),
  star: sized('star', 9),
}
