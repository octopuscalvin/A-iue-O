import * as THREE from 'three'
import { loft, limbRings, sampleAt, shell, type Ring } from './loft'
import { FOOT, SHIN, THIGH, UPPER_ARM, toPelvis } from './shapes'
import { bustParams, torsoKeysFor, type Figure } from './figure'
import type { V3 } from './skeleton'

/**
 * 衣服（DLC）：每件衣服都係由身體形狀「脹大」出嚟嘅一層外殼，
 * 所以會跟住三圍自動變大變細。加新衣服 = 喺 OUTFITS 加一項。
 */
export type OutfitSlot = 'dress' | 'top' | 'bottom' | 'socks' | 'shoes'
export const SLOT_LABEL: Record<OutfitSlot, string> = { dress: '連身裙', top: '上衣', bottom: '下裝', socks: '襪', shoes: '鞋' }
export const SLOT_ORDER: OutfitSlot[] = ['dress', 'top', 'bottom', 'socks', 'shoes']

export type FabricLook = 'cotton' | 'satin' | 'denim' | 'knit' | 'leather'

export interface OutfitPiece {
  /** 掛喺邊條骨（左右會自動複製） */
  bone: 'pelvis' | 'upperArm' | 'thigh' | 'shin' | 'foot'
  /** 專注模式用嘅標籤 */
  tag: 'torso' | 'limb'
  build: (f: Figure) => THREE.BufferGeometry
}

export interface Outfit {
  id: string
  name: string
  slot: OutfitSlot
  /** 所屬 DLC 包 */
  pack: string
  look: FabricLook
  colors: string[]
  pieces: OutfitPiece[]
  /** 呢件衫會令軀幹（頸鏈貼住嘅表面）厚幾多（米） */
  torsoGrow?: { y0: number; y1: number; grow: number }
}

// ---------------- 幾何工具 ----------------

/** 衣服用嘅軀幹截面：包埋胸部（布會跨過胸部，唔會陷入去） */
export function clothTorsoKeys(f: Figure, grow: number, y0: number, y1: number, step = 0.01): Ring[] {
  const base = torsoKeysFor(f)
  const bust = bustParams(f)
  const out: Ring[] = []
  for (let y = y0; y <= y1 + 1e-6; y += step) {
    const r = sampleAt(base, y)
    let a = r.a + grow
    const back = r.dz - r.b - grow
    let front = r.dz + r.b + grow
    for (const s of [1, -1] as const) {
      const c = bust.pos(s)
      const cy = c[1] + 0.95
      const k = bust.scale * 1.07
      const [rx, ry, rz] = bust.radii.map((v) => v * k)
      const e = 1 - ((y - cy) / ry) ** 2
      if (e > 0) {
        front = Math.max(front, c[2] + rz * Math.sqrt(e) + grow)
        a = Math.max(a, Math.abs(c[0]) + rx * Math.sqrt(e) + grow * 0.5)
      }
    }
    out.push({ y, a, b: (front - back) / 2, dz: (front + back) / 2 })
  }
  return out
}

/** 由軀幹某個高度開始向下散開嘅裙 */
function skirtRings(f: Figure, top: number, hem: number, flare: number, grow: number): Ring[] {
  // 由臀（0.84）到裙頭：跟身形；臀以下：慢慢散開
  const keys = clothTorsoKeys(f, grow, 0.84, Math.max(top, 0.85), 0.01)
  const start = sampleAt(keys, Math.max(top, 0.85))
  const hip = sampleAt(clothTorsoKeys(f, grow, 0.8, 0.88, 0.02), 0.84)
  const rings: Ring[] = keys.filter((k) => k.y >= 0.84 && k.y <= top)
  const steps = 12
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const y = 0.84 + (hem - 0.84) * t
    const spread = flare * t ** 1.3
    rings.push({ y, a: Math.max(hip.a, start.a) + spread, b: hip.b + spread * 0.9, dz: hip.dz * (1 - t) })
  }
  return rings
}

/** 打摺：截面半徑沿圓周起波浪，越近裙腳越明顯 */
function pleat(g: THREE.BufferGeometry, count: number, amp: number, yTop: number, yHem: number) {
  const pos = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const t = THREE.MathUtils.clamp((yTop - v.y) / (yTop - yHem), 0, 1)
    const th = Math.atan2(v.x, v.z)
    const k = 1 + amp * t * Math.abs(Math.sin(count * th))
    pos.setXYZ(i, v.x * k, v.y, v.z * k)
  }
  g.computeVertexNormals()
  return g
}

const pel = (rs: Ring[]) => toPelvis(rs)
const open = { capTop: false, capBottom: false }

/** 腳掌外殼（鞋 / 襪）：腳骨會轉 -90°，所以 b = 上下、dz = 上下偏移 */
function footShell(grow: number, sole = 0) {
  const keys = limbRings(FOOT).map((r) => ({ ...r, a: r.a + grow, b: (r.b ?? r.a) + grow + sole, dz: (r.dz ?? 0) - sole }))
  return loft(keys, { radial: 32 })
}

// ---------------- 衣服清單 ----------------

const PACK = '基本衣櫃（免費）'

export const OUTFITS: Outfit[] = [
  {
    id: 'long_dress', name: '連身長裙', slot: 'dress', pack: PACK, look: 'satin',
    colors: ['#f7c6d9', '#ffffff', '#c7dcff', '#2a2530', '#9e1f3d'],
    torsoGrow: { y0: 0.98, y1: 1.27, grow: 0.007 },
    pieces: [
      { bone: 'pelvis', tag: 'torso', build: (f) => loft(pel(clothTorsoKeys(f, 0.007, 0.98, 1.27)), { radial: 64, sub: 3, ...open }) },
      { bone: 'pelvis', tag: 'torso', build: (f) => pleat(loft(pel(skirtRings(f, 1.0, 0.16, 0.11, 0.008)), { radial: 72, sub: 3, ...open }), 9, 0.035, 0.84 - 0.95, 0.16 - 0.95) },
      // 肩帶：用內衣肩帶嘅路線，闊少少
      { bone: 'pelvis', tag: 'torso', build: () => strapGeo(1) },
      { bone: 'pelvis', tag: 'torso', build: () => strapGeo(-1) },
    ],
  },
  {
    id: 'tee', name: 'T 恤', slot: 'top', pack: PACK, look: 'cotton',
    colors: ['#ffffff', '#ffd6e4', '#2a2530', '#bfe6d6', '#ffe9a8'],
    torsoGrow: { y0: 0.9, y1: 1.36, grow: 0.011 },
    pieces: [
      { bone: 'pelvis', tag: 'torso', build: (f) => loft(pel(clothTorsoKeys(f, 0.011, 0.9, 1.36)), { radial: 64, sub: 3, ...open }) },
      // 短袖
      { bone: 'upperArm', tag: 'limb', build: () => loft(shell(limbRings(UPPER_ARM), -0.13, 0.02, 0.012, 6).map((r) => ({ ...r, a: r.a + 0.004 })), { radial: 32, ...open }) },
      // 膊頭：包住肩關節，唔會喺件衫同袖之間露出嚟
      { bone: 'upperArm', tag: 'limb', build: () => new THREE.SphereGeometry(0.058, 24, 16) },
    ],
  },
  {
    id: 'pleated_skirt', name: '百褶短裙', slot: 'bottom', pack: PACK, look: 'cotton',
    colors: ['#2a2530', '#e98aa8', '#c7dcff', '#9e1f3d', '#f5e6d3'],
    pieces: [
      { bone: 'pelvis', tag: 'torso', build: (f) => pleat(loft(pel(skirtRings(f, 0.99, 0.6, 0.07, 0.009)), { radial: 80, sub: 3, ...open }), 14, 0.06, 0.84 - 0.95, 0.6 - 0.95) },
    ],
  },
  {
    id: 'denim_shorts', name: '牛仔短褲', slot: 'bottom', pack: PACK, look: 'denim',
    colors: ['#5b7fae', '#2f4a73', '#c9d6ea', '#2a2530'],
    pieces: [
      { bone: 'pelvis', tag: 'torso', build: (f) => loft(pel(clothTorsoKeys(f, 0.009, 0.7, 0.98, 0.01)), { radial: 64, sub: 3, capTop: false }) },
      { bone: 'thigh', tag: 'limb', build: () => loft(shell(limbRings(THIGH), -0.11, 0.0, 0.01, 5), { radial: 40, ...open }) },
    ],
  },
  {
    id: 'knee_socks', name: '過膝長襪', slot: 'socks', pack: PACK, look: 'knit',
    colors: ['#2a2530', '#ffffff', '#ffd6e4'],
    pieces: [
      { bone: 'shin', tag: 'limb', build: () => loft(shell(limbRings(SHIN), -0.372, -0.0, 0.0025, 14), { radial: 40, ...open }) },
      { bone: 'foot', tag: 'limb', build: () => footShell(0.0025) },
    ],
  },
  {
    id: 'ankle_socks', name: '短襪', slot: 'socks', pack: PACK, look: 'knit',
    colors: ['#ffffff', '#ffd6e4', '#2a2530'],
    pieces: [
      { bone: 'shin', tag: 'limb', build: () => loft(shell(limbRings(SHIN), -0.372, -0.29, 0.0025, 6), { radial: 40, ...open }) },
      { bone: 'foot', tag: 'limb', build: () => footShell(0.0025) },
    ],
  },
  {
    id: 'mary_janes', name: '瑪莉珍鞋', slot: 'shoes', pack: PACK, look: 'leather',
    colors: ['#2a2530', '#f7c6d9', '#ffffff', '#9e1f3d'],
    pieces: [{ bone: 'foot', tag: 'limb', build: () => footShell(0.006, 0.005) }],
  },
]

export const OUTFIT_MAP = Object.fromEntries(OUTFITS.map((o) => [o.id, o])) as Record<string, Outfit>

function strapGeo(s: 1 | -1) {
  const P = (x: number, y: number, z: number) => new THREE.Vector3(x * s, y - 0.95, z)
  const curve = new THREE.CatmullRomCurve3([
    P(0.06, 1.24, 0.1), P(0.085, 1.3, 0.07), P(0.095, 1.345, 0.035), P(0.095, 1.365, -0.005),
    P(0.095, 1.34, -0.06), P(0.085, 1.27, -0.09),
  ])
  return new THREE.TubeGeometry(curve, 32, 0.006, 8, false).scale(1, 1, 1)
}

/** 布料質感 */
export function fabricMaterial(look: FabricLook, color: string) {
  const base: THREE.MeshPhysicalMaterialParameters = { color, side: THREE.DoubleSide }
  switch (look) {
    case 'satin': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.38, sheen: 0.8, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.3 })
    case 'denim': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.95 })
    case 'knit': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.9, sheen: 0.6, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.4) })
    case 'leather': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.25 })
    default: return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.85, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') })
  }
}

/** 一套衣服（各欄位揀咗邊件）：連身裙同上衣 / 下裝唔可以同時着 */
export type Wardrobe = Partial<Record<OutfitSlot, string>>
export function wearing(w: Wardrobe): Outfit[] {
  const out: Outfit[] = []
  for (const slot of SLOT_ORDER) {
    const id = w[slot]
    if (!id || !OUTFIT_MAP[id]) continue
    if ((slot === 'top' || slot === 'bottom') && w.dress) continue
    out.push(OUTFIT_MAP[id])
  }
  return out
}

/** 着咗衫之後，頸鏈要貼住嘅軀幹表面 */
export function torsoKeysWithClothes(f: Figure, w: Wardrobe): Ring[] {
  const grows = wearing(w).map((o) => o.torsoGrow).filter(Boolean) as NonNullable<Outfit['torsoGrow']>[]
  const base = torsoKeysFor(f)
  if (!grows.length) return base
  return base.map((r) => {
    const g = Math.max(0, ...grows.filter((x) => r.y >= x.y0 - 0.01 && r.y <= x.y1 + 0.01).map((x) => x.grow))
    return g ? { ...r, a: r.a + g, b: (r.b ?? r.a) + g } : r
  })
}

export type { V3 }
