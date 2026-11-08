import type { MaterialCategory } from '../materials/library'
import type { ShapeId } from './charms'

/**
 * 「圈形」首飾設計資料：手鏈、腳鏈、臂環、頸鏈都用同一份格式。
 * 存檔、分享、將來交俾師傅生產都係用呢份資料。尺寸單位係 mm（除咗 cm 註明）。
 */
export type RingZone = 'wristL' | 'wristR' | 'ankleL' | 'ankleR' | 'upperArmL' | 'upperArmR' | 'neck'
export const RING_ZONES: RingZone[] = ['wristL', 'wristR', 'ankleL', 'ankleR', 'upperArmL', 'upperArmR', 'neck']
export const isRingZone = (z: string): z is RingZone => (RING_ZONES as string[]).includes(z)

export type BaseType = 'chain' | 'beads' | 'bangle' | 'cord' | 'lace'
export type PieceKind = 'bracelet' | 'anklet' | 'armlet' | 'necklace'

export interface CharmSpec {
  id: string
  shape: ShapeId
  material: string
  /** 喺圈上面嘅位置：0–1（沿長度計） */
  t: number
  sizeMm: number
}

export interface RingDesign {
  version: 1
  base: { type: BaseType; material: string; thickMm: number }
  /** 鬆緊 / 長度款式，見各部位嘅 fits */
  fit: string
  charms: CharmSpec[]
}

export interface BaseInfo {
  label: string
  hint: string
  categories: MaterialCategory[]
  thick: { label: string; min: number; max: number; step: number; def: number }
  defMaterial: string
  /** 要唔要扣頭 */
  clasp: boolean
  /** 圓珠可唔可以直接穿入去 */
  threadable: boolean
  /** 硬身：唔可以拉開 */
  rigid?: boolean
}

export const BASES: Record<BaseType, BaseInfo> = {
  chain: {
    label: 'O字鏈', hint: '金屬鏈，可以掛任何配件', categories: ['metal'],
    thick: { label: '線徑', min: 0.5, max: 1.5, step: 0.1, def: 0.8 }, defMaterial: 'gold_polished', clasp: true, threadable: true,
  },
  beads: {
    label: '珠串', hint: '彈性繩穿珠，唔使扣頭', categories: ['plastic', 'metal'],
    thick: { label: '珠徑', min: 4, max: 10, step: 0.5, def: 6 }, defMaterial: 'pearl', clasp: false, threadable: true,
  },
  bangle: {
    label: '手鐲', hint: '硬身圓圈，要大到套得過手掌', categories: ['metal', 'plastic'],
    thick: { label: '粗度', min: 1.5, max: 8, step: 0.5, def: 3 }, defMaterial: 'silver_polished', clasp: false, threadable: false, rigid: true,
  },
  cord: {
    label: '絲絨繩', hint: '柔軟布繩，配金屬扣', categories: ['fabric'],
    thick: { label: '繩粗', min: 1.5, max: 4, step: 0.5, def: 2.5 }, defMaterial: 'velvet_pink', clasp: true, threadable: true,
  },
  lace: {
    label: '蕾絲帶', hint: '花邊布帶，配件會縫上去', categories: ['lace'],
    thick: { label: '闊度', min: 8, max: 20, step: 1, def: 12 }, defMaterial: 'lace_white', clasp: true, threadable: false,
  },
}

export interface FitOption {
  label: string
  /** 圍度 + 幾多 cm */
  slackCm?: number
  /** 固定長度（頸鏈用） */
  lengthCm?: number
  hint?: string
}

/** 每個部位嘅首飾設定 */
export interface ZoneJewelry {
  kind: PieceKind
  name: string
  bases: BaseType[]
  /** 某啲部位對底座有唔同叫法 / 說明 */
  baseText?: Partial<Record<BaseType, { label?: string; hint?: string }>>
  fits: Record<string, FitOption>
  defaultFit: string
  /** 圈嘅橫切面比例（左右 : 前後） */
  aspect: [number, number]
  /** 硬身款要額外加大幾多 cm（例如手鐲要套過手掌） */
  rigidExtraCm: number
  rigidNote?: string
  /** 新配件預設放邊（0 = 前面） */
  home: number
  pair?: RingZone
}

const BRACELET_FITS: Record<string, FitOption> = {
  snug: { label: '貼身', slackCm: 1 },
  comfort: { label: '舒適', slackCm: 1.5 },
  loose: { label: '寬鬆', slackCm: 2.5 },
}
const ANKLET_FITS: Record<string, FitOption> = {
  snug: { label: '貼身', slackCm: 1 },
  comfort: { label: '舒適', slackCm: 2 },
  loose: { label: '垂墜', slackCm: 3.5 },
}
const ARMLET_FITS: Record<string, FitOption> = {
  snug: { label: '貼身', slackCm: 0.5 },
  comfort: { label: '舒適', slackCm: 1 },
  loose: { label: '寬鬆', slackCm: 2 },
}
const NECK_FITS: Record<string, FitOption> = {
  choker: { label: '頸圈', lengthCm: 34, hint: '貼住條頸' },
  collar: { label: '鎖骨', lengthCm: 42, hint: '落到鎖骨' },
  princess: { label: '公主', lengthCm: 47, hint: '落到心口上面' },
  matinee: { label: '長款', lengthCm: 55, hint: '落到心口' },
}

const bracelet = (home: number, pair: RingZone): ZoneJewelry => ({
  kind: 'bracelet', name: '手鏈', bases: ['chain', 'beads', 'bangle', 'cord', 'lace'],
  fits: BRACELET_FITS, defaultFit: 'comfort', aspect: [0.86, 1.08],
  rigidExtraCm: 3.5, rigidNote: '手鐲要套過手掌，已自動加大', home, pair,
})
const anklet = (home: number, pair: RingZone): ZoneJewelry => ({
  kind: 'anklet', name: '腳鏈', bases: ['chain', 'beads', 'cord', 'lace'],
  fits: ANKLET_FITS, defaultFit: 'comfort', aspect: [0.95, 1.05], rigidExtraCm: 0, home, pair,
})
const armlet = (home: number, pair: RingZone): ZoneJewelry => ({
  kind: 'armlet', name: '臂環', bases: ['chain', 'beads', 'bangle', 'cord', 'lace'],
  baseText: { bangle: { label: '開口臂環', hint: '硬身開口環，可以微調鬆緊' } },
  fits: ARMLET_FITS, defaultFit: 'comfort', aspect: [1, 1], rigidExtraCm: 0, home, pair,
})

// 「home」：左邊身嘅外側喺 t=0.25（+X），右邊身外側喺 t=0.75
export const JEWELRY: Record<RingZone, ZoneJewelry> = {
  wristL: bracelet(0.25, 'wristR'),
  wristR: bracelet(0.75, 'wristL'),
  ankleL: anklet(0.25, 'ankleR'),
  ankleR: anklet(0.75, 'ankleL'),
  upperArmL: armlet(0.25, 'upperArmR'),
  upperArmR: armlet(0.75, 'upperArmL'),
  neck: {
    kind: 'necklace', name: '頸鏈', bases: ['chain', 'beads', 'cord', 'lace'],
    fits: NECK_FITS, defaultFit: 'princess', aspect: [1, 1], rigidExtraCm: 0, home: 0,
  },
}

export const baseLabel = (z: RingZone, b: BaseType) => JEWELRY[z].baseText?.[b]?.label ?? BASES[b].label
export const baseHint = (z: RingZone, b: BaseType) => JEWELRY[z].baseText?.[b]?.hint ?? BASES[b].hint

export const SHAPES: Record<ShapeId, { label: string; def: number; min: number; max: number; defMaterial: string }> = {
  heart: { label: '心心', def: 10, min: 6, max: 20, defMaterial: 'jelly_pink' },
  star: { label: '星星', def: 9, min: 6, max: 20, defMaterial: 'gold_polished' },
  moon: { label: '月亮', def: 10, min: 6, max: 20, defMaterial: 'gold_polished' },
  flower: { label: '花', def: 10, min: 6, max: 20, defMaterial: 'jelly_lavender' },
  bow: { label: '蝴蝶結', def: 12, min: 8, max: 22, defMaterial: 'matte_pink' },
  paw: { label: '貓爪', def: 9, min: 6, max: 16, defMaterial: 'jelly_mint' },
  cloud: { label: '雲朵', def: 11, min: 7, max: 20, defMaterial: 'gloss_white' },
  bead: { label: '圓珠', def: 6, min: 3, max: 12, defMaterial: 'pearl' },
}
export const SHAPE_ORDER: ShapeId[] = ['heart', 'star', 'moon', 'flower', 'bow', 'paw', 'cloud', 'bead']
export const CHARM_CATEGORIES: MaterialCategory[] = ['metal', 'plastic']

/** 圓珠喺可以穿珠嘅底座上面會直接穿入去，其他配件都係用扣環吊住 */
export const isThreaded = (c: CharmSpec, base: BaseType) => c.shape === 'bead' && BASES[base].threadable

export const fitOf = (z: RingZone, d: RingDesign) => JEWELRY[z].fits[d.fit] ?? JEWELRY[z].fits[JEWELRY[z].defaultFit]

/** 首飾內圈長度（cm）：圍度 + 鬆緊（+ 硬身額外）；頸鏈就係款式長度 */
export function innerLengthCm(d: RingDesign, z: RingZone, girthCm: number) {
  const f = fitOf(z, d)
  if (f.lengthCm) return f.lengthCm
  return girthCm + (f.slackCm ?? 1.5) + (BASES[d.base.type].rigid ? JEWELRY[z].rigidExtraCm : 0)
}

/** 底座中心線長度（mm）：內圈 + 材料本身厚度 */
export function centerLengthMm(d: RingDesign, z: RingZone, girthCm: number) {
  const thick = d.base.type === 'lace' ? 0.8 : d.base.thickMm
  return innerLengthCm(d, z, girthCm) * 10 + Math.PI * thick
}

export function newDesign(z: RingZone): RingDesign {
  return {
    version: 1,
    base: { type: 'chain', material: BASES.chain.defMaterial, thickMm: BASES.chain.thick.def },
    fit: JEWELRY[z].defaultFit,
    charms: [],
  }
}

let n = 0
export const newId = () => `c${Date.now().toString(36)}${(n++).toString(36)}`
