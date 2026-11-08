import * as THREE from 'three'
import { sampleAt } from '../body/loft'
import type { BodyProfile } from '../body/bodyProfile'
import { JEWELRY, type RingZone } from './types'

/**
 * 首飾嘅「圈」（底座中心線），喺掛點嘅本地座標入面。
 * - 手鏈 / 腳鏈 / 臂環：XZ 平面上嘅橢圓
 * - 頸鏈：繞過後頸、喺前面自然垂落，並且貼住身體（唔會穿過心口）
 * t = 沿圈嘅長度比例（0–1），所以配件之間嘅距離同真實 mm 一致。t = 0 喺正前面。
 */

/** 橢圓周長（Ramanujan 公式） */
export function ellipsePerimeter(a: number, b: number) {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))
}

export interface Ring {
  /** 中心線長度（米） */
  length: number
  curve: THREE.CatmullRomCurve3
  pointAt: (t: number, out?: THREE.Vector3) => THREE.Vector3
  tangentAt: (t: number, out?: THREE.Vector3) => THREE.Vector3
  /** 向外嘅方向（水平） */
  normalAt: (t: number, out?: THREE.Vector3) => THREE.Vector3
  /** 由本地座標搵返最近嘅 t（拖動配件用） */
  tFromLocal: (x: number, z: number) => number
}

const SAMPLES = 360
const wrapT = (t: number) => ((t % 1) + 1) % 1

function finish(pts: THREE.Vector3[], length: number, sx: number, sz: number): Ring {
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal')
  const angles: number[] = []
  const p = new THREE.Vector3()
  for (let i = 0; i < SAMPLES; i++) {
    curve.getPointAt(i / SAMPLES, p)
    angles.push(Math.atan2(p.x / sx, p.z / sz))
  }
  return {
    length,
    curve,
    pointAt: (t, out = new THREE.Vector3()) => curve.getPointAt(wrapT(t), out),
    tangentAt: (t, out = new THREE.Vector3()) => curve.getTangentAt(wrapT(t), out),
    normalAt: (t, out = new THREE.Vector3()) => {
      curve.getPointAt(wrapT(t), out)
      return out.set(out.x / (sx * sx), 0, out.z / (sz * sz)).normalize()
    },
    tFromLocal: (x, z) => {
      const a = Math.atan2(x / sx, z / sz)
      let best = 0
      let bestD = Infinity
      for (let i = 0; i < SAMPLES; i++) {
        const d = Math.abs(Math.atan2(Math.sin(a - angles[i]), Math.cos(a - angles[i])))
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      return best / SAMPLES
    },
  }
}

function ellipseRing(lengthM: number, ax: number, az: number, y = 0, dz = 0): Ring {
  const k = lengthM / ellipsePerimeter(ax, az)
  const rx = ax * k
  const rz = az * k
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < 96; i++) {
    const th = (i / 96) * Math.PI * 2
    pts.push(new THREE.Vector3(rx * Math.sin(th), y, dz + rz * Math.cos(th)))
  }
  return finish(pts, lengthM, rx, rz)
}

// ---------------- 頸鏈 ----------------

const CLEAR = 0.0035 // 同皮膚保持嘅距離

/** 將一點推出身體表面（軀幹 + 胸部） */
function pushOut(p: THREE.Vector3, body: BodyProfile) {
  const keys = body.torsoKeys
  const wy = body.neckY + p.y
  const r = sampleAt(keys, Math.min(wy, keys[keys.length - 1].y))
  const dx = p.x / (r.a + CLEAR)
  const dzv = (p.z - r.dz) / (r.b + CLEAR)
  const q = dx * dx + dzv * dzv
  if (q < 1) {
    const s = 1 / Math.sqrt(Math.max(q, 1e-6))
    p.x *= s
    p.z = r.dz + (p.z - r.dz) * s
  }
  // 胸部（連內衣厚度）
  const bust = body.bust
  if (!bust) return
  for (const side of [1, -1] as const) {
    const c = bust.pos(side)
    const cy = c[1] + 0.95 - body.neckY
    const k = bust.scale * 1.07
    const rx = bust.radii[0] * k + CLEAR, ry = bust.radii[1] * k + CLEAR, rz = bust.radii[2] * k + CLEAR
    const ex = (p.x - c[0]) / rx, ey = (p.y - cy) / ry
    const rest = 1 - ex * ex - ey * ey
    if (rest > 0) {
      const front = c[2] + rz * Math.sqrt(rest)
      if (p.z < front && p.z > c[2] - rz) p.z = front
    }
  }
}

function polyLength(pts: THREE.Vector3[]) {
  let L = 0
  for (let i = 0; i < pts.length; i++) L += pts[i].distanceTo(pts[(i + 1) % pts.length])
  return L
}

function drape(drop: number, body: BodyProfile) {
  const N = 72
  const A = 0.066, B = 0.062 // 頸底（膊頭同頸交界）嘅圈
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < N; i++) {
    const phi = (i / N) * Math.PI * 2
    const c = Math.cos(phi)
    const p = new THREE.Vector3(A * Math.sin(phi), 0, B * c)
    if (c > 0) {
      // 前面垂落：越近正中越低（U 字形）
      p.y -= drop * Math.pow(c, 1.8)
      p.x *= 1 + 0.9 * drop * c
    }
    pushOut(p, body)
    pts.push(p)
  }
  // 撫平兩次，避免被推出嚟嗰陣有尖角
  for (let it = 0; it < 2; it++) {
    const copy = pts.map((v) => v.clone())
    for (let i = 0; i < N; i++) {
      pts[i].copy(copy[(i - 1 + N) % N]).add(copy[(i + 1) % N]).multiplyScalar(0.25).addScaledVector(copy[i], 0.5)
      pushOut(pts[i], body)
    }
  }
  return pts
}

/** VRM：用身體表面地圖 —— 後面同兩側坐喺膊頭上面，前面垂落並貼住心口 */
function drapeOnSurface(drop: number, body: BodyProfile) {
  const S = body.surface!
  const nb = body.neckBase!
  const N = 72
  const A = nb.a + CLEAR, B = nb.b + CLEAR
  const pts: THREE.Vector3[] = []
  const restOn = (x: number, z: number) => {
    const top = S.top(x, body.neckZ + z)
    return top !== null ? Math.min(top - body.neckY, 0.03) + CLEAR : 0
  }
  // 兩側膊頭嘅高度：前面唔可以高過佢（否則會被喉嚨頂高變成 M 字）
  const sideBase = (restOn(A, nb.dz) + restOn(-A, nb.dz)) / 2
  const place = (p: THREE.Vector3, c: number, sink: number) => {
    const wz = body.neckZ + p.z
    // 坐喺膊頭 / 頸底表面上面
    let base = restOn(p.x, p.z)
    if (c > 0) base = Math.min(base, sideBase)
    p.y = base - sink
    const wy = body.neckY + p.y
    if (c > 0 && sink > 0.003) {
      const f = S.front(p.x, wy)
      if (f !== null && wz < f + CLEAR) p.z = f + CLEAR - body.neckZ
    } else if (c < 0) {
      const b = S.back(p.x, wy)
      if (b !== null && wz > b - CLEAR && sink > 0.003) p.z = b - CLEAR - body.neckZ
    }
  }
  const sinks: number[] = []
  for (let i = 0; i < N; i++) {
    const phi = (i / N) * Math.PI * 2
    const c = Math.cos(phi)
    const p = new THREE.Vector3(A * Math.sin(phi), 0, nb.dz + B * c)
    const sink = c > 0 ? drop * Math.pow(c, 1.8) : 0
    // 垂落嘅部分沿住心口向外散開少少，似真鏈
    if (c > 0) p.x *= 1 + 3.5 * drop * c
    place(p, c, sink)
    pts.push(p)
    sinks.push(sink)
  }
  for (let it = 0; it < 2; it++) {
    const copy = pts.map((v) => v.clone())
    for (let i = 0; i < N; i++) {
      pts[i].copy(copy[(i - 1 + N) % N]).add(copy[(i + 1) % N]).multiplyScalar(0.25).addScaledVector(copy[i], 0.5)
      const c = Math.cos((i / N) * Math.PI * 2)
      if (c > 0 && sinks[i] > 0.003) {
        const f = S.front(pts[i].x, body.neckY + pts[i].y)
        if (f !== null && body.neckZ + pts[i].z < f + CLEAR) pts[i].z = f + CLEAR - body.neckZ
      }
    }
  }
  return pts
}

function necklaceRing(lengthM: number, choker: boolean, body: BodyProfile): Ring {
  if (choker) {
    // 頸圈：直接圍住條頸（頸掛點上面少少）
    const c = body.choker
    return ellipseRing(lengthM, c.aspect[0], c.aspect[1], c.y, c.dz)
  }
  // 二分法：搵出前面要垂幾低，條鏈長度先啱
  const build = body.surface && body.neckBase ? drapeOnSurface : drape
  let lo = 0, hi = 0.35
  let pts = build(0, body)
  if (polyLength(pts) >= lengthM) return finish(pts, lengthM, 1, 1)
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2
    pts = build(mid, body)
    if (polyLength(pts) < lengthM) lo = mid
    else hi = mid
  }
  return finish(build((lo + hi) / 2, body), lengthM, 1, 1)
}

export function makeRing(lengthM: number, zone: RingZone, body: BodyProfile, fit: string): Ring {
  const j = JEWELRY[zone]
  if (j.kind === 'necklace') return necklaceRing(lengthM, fit === 'choker', body)
  return ellipseRing(lengthM, j.aspect[0], j.aspect[1])
}
