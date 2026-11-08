import * as THREE from 'three'
import { sampleAt } from './loft'
import { HEAD_KEYS } from './shapes'

/*
 * 少女預設髮型：偏紅粉色、齊陰（瀏海）、雙馬尾。
 * 全部座標相對 head 骨（head 骨喺 y=1.43）。
 */

const Y_MAX = 0.166 // 頭殼取樣嘅最高點
const CROWN = 0.188 // 頭頂（連頭髮厚度）

/** 髮線高度：前面係瀏海（遮住額頭）、兩側喺耳仔上面、後面落到後頸 */
function hairline(th: number) {
  const c = Math.cos(th)
  const front = 0.083
  const side = 0.094
  const back = 0.012
  if (c >= 0) {
    // 瀏海尾端有少少參差
    const jag = c > 0.55 ? 0.004 * Math.abs(Math.sin(th * 9)) : 0
    return side + (front - side) * Math.pow(c, 0.6) + jag
  }
  return side + (back - side) * Math.pow(-c, 0.9)
}

/** 頭髮外殼：沿住頭形脹大，髮線位置隨方向改變 */
function hairShell(radial = 72, rows = 28) {
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j < radial; j++) {
      const th = (j / radial) * Math.PI * 2
      const y0 = hairline(th)
      const v = i / rows
      const c = Math.cos(th)
      // 前面瀏海同頭頂蓬鬆啲
      const grow = 0.011 + 0.004 * Math.max(c, 0) + 0.004 * v
      if (i === rows) {
        const r = sampleAt(HEAD_KEYS, Y_MAX)
        pos.push(r.dx, CROWN, r.dz)
        continue
      }
      // 最頂幾行收成圓拱形，唔會變尖
      const y = y0 + (Y_MAX - y0) * (1 - Math.pow(1 - v, 1.4))
      const r = sampleAt(HEAD_KEYS, Math.min(y, Y_MAX))
      const dome = v > 0.8 ? Math.sqrt(1 - Math.pow((v - 0.8) / 0.2, 2) * 0.75) : 1
      const lift = v > 0.8 ? ((v - 0.8) / 0.2) * (CROWN - Y_MAX - 0.006) : 0
      pos.push(r.dx + (r.a + grow) * Math.sin(th) * dome, y + lift, r.dz + (r.b + grow) * c * dome)
    }
  }
  const at = (i: number, j: number) => i * radial + (j % radial)
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < radial; j++) {
      idx.push(at(i, j), at(i, j + 1), at(i + 1, j + 1))
      idx.push(at(i, j), at(i + 1, j + 1), at(i + 1, j))
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** 粗幼漸變嘅管（馬尾用） */
function taperTube(points: THREE.Vector3[], radius: (t: number) => number, seg = 64, radial = 20) {
  const curve = new THREE.CatmullRomCurve3(points)
  const frames = curve.computeFrenetFrames(seg, false)
  const pos: number[] = []
  const idx: number[] = []
  const p = new THREE.Vector3()
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    curve.getPointAt(t, p)
    const r = radius(t)
    const N = frames.normals[i]
    const B = frames.binormals[i]
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2
      // 加少少起伏，似一束束頭髮
      const rr = r * (1 + 0.07 * Math.sin(a * 5 + t * 6))
      pos.push(p.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * rr, p.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * rr, p.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * rr)
    }
  }
  const at = (i: number, j: number) => i * radial + (j % radial)
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < radial; j++) {
      idx.push(at(i, j), at(i + 1, j + 1), at(i, j + 1))
      idx.push(at(i, j), at(i + 1, j), at(i + 1, j + 1))
    }
  }
  const tip = pos.length / 3
  curve.getPointAt(1, p)
  pos.push(p.x, p.y, p.z)
  for (let j = 0; j < radial; j++) idx.push(at(seg, j), tip, at(seg, j + 1))
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return { geometry: g, curve }
}

const tailRadius = (t: number) => {
  if (t < 0.12) return 0.013 + (0.026 - 0.013) * (t / 0.12)
  if (t < 0.55) return 0.026 + 0.004 * Math.sin(((t - 0.12) / 0.43) * Math.PI)
  return 0.026 * Math.pow(1 - (t - 0.55) / 0.45, 0.8) + 0.002
}

/** 一條馬尾：由頭兩側偏後、高位綁起，向外再垂落到胸口高度 */
function twinTail(s: 1 | -1) {
  const P = (x: number, y: number, z: number) => new THREE.Vector3(x * s, y - 1.43, z)
  const pts = [
    P(0.076, 1.572, -0.052),
    P(0.1, 1.565, -0.07),
    P(0.122, 1.51, -0.092),
    P(0.128, 1.43, -0.108),
    P(0.12, 1.33, -0.118),
    P(0.108, 1.22, -0.112),
    P(0.1, 1.15, -0.1),
  ]
  const { geometry, curve } = taperTube(pts, tailRadius)
  // 髮圈：對正馬尾起點方向
  const tieT = 0.03
  const tiePos = curve.getPointAt(tieT)
  const tieDir = curve.getTangentAt(tieT)
  const tieQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tieDir)
  return { geometry, tiePos, tieQuat }
}

export const HAIR = {
  shell: hairShell(),
  tailL: twinTail(1),
  tailR: twinTail(-1),
  scrunchie: new THREE.TorusGeometry(0.016, 0.0075, 12, 32),
}
