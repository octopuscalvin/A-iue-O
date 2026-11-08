import * as THREE from 'three'

/**
 * 身體表面地圖（VRM 模型用）：將模型三角形「印」落格仔度，之後可以好快咁問：
 * - top(x, z)：喺呢個位置，身體最高點幾高（膊頭、頸底）
 * - front(x, y)：喺呢個高度，身體最前面去到邊（心口）
 * - back(x, y)：最後面去到邊（背脊）
 * 全部係世界座標（米）。
 */
class Field {
  private data: Float32Array
  private nu: number
  private nv: number
  constructor(private u0: number, u1: number, private v0: number, v1: number, private step: number, private mode: 'max' | 'min') {
    this.nu = Math.ceil((u1 - u0) / step) + 1
    this.nv = Math.ceil((v1 - v0) / step) + 1
    this.data = new Float32Array(this.nu * this.nv).fill(NaN)
  }
  private put(i: number, j: number, w: number) {
    const k = j * this.nu + i
    const cur = this.data[k]
    if (Number.isNaN(cur) || (this.mode === 'max' ? w > cur : w < cur)) this.data[k] = w
  }
  /** 將一個三角形（投影到 u-v 平面，w 係高度 / 深度）印落去 */
  addTri(a: number[], b: number[], c: number[], wMax = Infinity) {
    const minU = Math.min(a[0], b[0], c[0]), maxU = Math.max(a[0], b[0], c[0])
    const minV = Math.min(a[1], b[1], c[1]), maxV = Math.max(a[1], b[1], c[1])
    const i0 = Math.max(0, Math.ceil((minU - this.u0) / this.step)), i1 = Math.min(this.nu - 1, Math.floor((maxU - this.u0) / this.step))
    const j0 = Math.max(0, Math.ceil((minV - this.v0) / this.step)), j1 = Math.min(this.nv - 1, Math.floor((maxV - this.v0) / this.step))
    if (i0 > i1 || j0 > j1) return
    const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
    if (Math.abs(det) < 1e-12) return
    for (let j = j0; j <= j1; j++) {
      const v = this.v0 + j * this.step
      for (let i = i0; i <= i1; i++) {
        const u = this.u0 + i * this.step
        const l1 = ((b[1] - c[1]) * (u - c[0]) + (c[0] - b[0]) * (v - c[1])) / det
        const l2 = ((c[1] - a[1]) * (u - c[0]) + (a[0] - c[0]) * (v - c[1])) / det
        const l3 = 1 - l1 - l2
        if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue
        const w = l1 * a[2] + l2 * b[2] + l3 * c[2]
        if (w <= wMax) this.put(i, j, w)
      }
    }
  }
  get(u: number, v: number): number | null {
    const i = Math.round((u - this.u0) / this.step)
    const j = Math.round((v - this.v0) / this.step)
    // 揾最近有資料嘅格（最多行兩格）
    for (let r = 0; r <= 2; r++) {
      let best: number | null = null
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          const ii = i + di, jj = j + dj
          if (ii < 0 || jj < 0 || ii >= this.nu || jj >= this.nv) continue
          const w = this.data[jj * this.nu + ii]
          if (Number.isNaN(w)) continue
          if (best === null || (this.mode === 'max' ? w > best : w < best)) best = w
        }
      }
      if (best !== null) return best
    }
    return null
  }
}

export interface BodySurface {
  top: (x: number, z: number) => number | null
  front: (x: number, y: number) => number | null
  back: (x: number, y: number) => number | null
}

/**
 * tris：軀幹三角形（世界座標）。neckY：頸底高度。
 * 只計頸底以下少少到心口以下 35cm 嘅範圍，夠頸鏈用。
 */
export function buildSurface(tris: [THREE.Vector3, THREE.Vector3, THREE.Vector3][], neckY: number): BodySurface {
  const step = 0.004
  const top = new Field(-0.2, 0.2, -0.2, 0.2, step, 'max')
  const front = new Field(-0.2, 0.2, neckY - 0.38, neckY + 0.06, step, 'max')
  const back = new Field(-0.2, 0.2, neckY - 0.38, neckY + 0.06, step, 'min')
  const yCap = neckY + 0.04 // 唔計條頸本身（頸會高過頸鏈）
  for (const [a, b, c] of tris) {
    top.addTri([a.x, a.z, a.y], [b.x, b.z, b.y], [c.x, c.z, c.y], yCap)
    front.addTri([a.x, a.y, a.z], [b.x, b.y, b.z], [c.x, c.y, c.z])
    back.addTri([a.x, a.y, a.z], [b.x, b.y, b.z], [c.x, c.y, c.z])
  }
  return {
    top: (x, z) => top.get(x, z),
    front: (x, y) => front.get(x, y),
    back: (x, y) => back.get(x, y),
  }
}
