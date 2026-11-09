import type { MaterialCategory } from '../materials/library'
import type { ShapeId } from './charms'

/**
 * 「圈形」首飾設計資料：手鏈、腳鏈、臂環、頸鏈都用同一份格式。
 * 存檔、分享、將來交俾師傅生產都係用呢份資料。尺寸單位係 mm（除咗 cm 註明）。
 */
export type RingZone = 'wristL' | 'wristR' | 'ankleL' | 'ankleR' | 'upperArmL' | 'upperArmR' | 'neck'
export const RING_ZONES: RingZone[] = ['wristL', 'wristR', 'ankleL', 'ankleR', 'upperArmL', 'upperArmR', 'neck']
export const isRingZone = (z: string): z is RingZone => (RING_ZONES as string[]).includes(z)

export type BaseType =
  | 'chain' | 'beads' | 'bangle' | 'cord' | 'lace'
  | 'hardband' | 'silicone' | 'cuff' | 'tennis' | 'braided' | 'wrap' | 'strap' | 'spiral' | 'scrunchie' | 'idchain'
export type PieceKind = 'bracelet' | 'anklet' | 'armlet' | 'necklace'

export interface CharmSpec {
  id: string
  shape: ShapeId
  material: string
  /** 喺圈上面嘅位置：0–1（沿長度計） */
  t: number
  sizeMm: number
}

/** 底座設定：唔同底座用到唔同嘅選項（見 BaseInfo.options） */
export interface BaseSpec {
  type: BaseType
  material: string
  thickMm: number
  /** 款式（例如鏈款、珠形、表面紋理） */
  variant?: string
  /** 闊度（扁身手環、名牌） */
  widthMm?: number
  /** 圈數 / 轉數 */
  count?: number
  /** 刻字 / 字母珠 */
  text?: string
  /** 多色（編織繩每股顏色、螺旋手鐲嘅珠） */
  colors?: string[]
  /** 寶石 */
  gem?: string
}

export interface RingDesign {
  version: 1
  base: BaseSpec
  /** 鬆緊 / 長度款式，見各部位嘅 fits */
  fit: string
  charms: CharmSpec[]
}

export type BaseOption =
  | { kind: 'variant'; label: string; choices: { id: string; label: string }[]; def: string }
  | { kind: 'width'; label: string; min: number; max: number; step: number; def: number }
  | { kind: 'count'; label: string; min: number; max: number; def: number; unit: string }
  | { kind: 'text'; label: string; maxLen: number; def: string; placeholder: string }
  | { kind: 'colors'; label: string; n: number; categories: MaterialCategory[]; def: string[] }
  | { kind: 'gem'; label: string; def: string }

export interface BaseInfo {
  /** 分類（介面分組用） */
  group: '鏈' | '珠' | '硬身' | '繩帶'
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
  /** 配件點樣裝：吊住（預設）定黏喺表面 */
  mount?: 'hang' | 'glue'
  options?: BaseOption[]
  /** 底座由中心線向外嘅半厚度（mm），配件要放喺佢外面 */
  outMm?: (b: BaseSpec) => number
}

const RIGID_HINT = '硬身，要大到套得過手掌'
const TEXTURES = [
  { id: 'smooth', label: '光面' }, { id: 'ribbed', label: '坑紋' }, { id: 'faceted', label: '切面' }, { id: 'twisted', label: '扭紋' },
]

export const BASES: Record<BaseType, BaseInfo> = {
  chain: {
    group: '鏈', label: '金屬鏈', hint: '金屬鏈，可以掛任何配件', categories: ['metal'],
    thick: { label: '線徑', min: 0.5, max: 1.5, step: 0.1, def: 0.8 }, defMaterial: 'gold_polished', clasp: true, threadable: true,
    options: [{
      kind: 'variant', label: '鏈款', def: 'cable', choices: [
        { id: 'cable', label: 'O字鏈' }, { id: 'curb', label: '側身鏈' }, { id: 'figaro', label: '費加洛' },
        { id: 'box', label: '盒仔鏈' }, { id: 'ball', label: '波珠鏈' }, { id: 'snake', label: '蛇骨鏈' }, { id: 'rope', label: '扭繩鏈' },
      ],
    }],
    outMm: (b) => b.thickMm * (b.variant === 'ball' ? 1.6 : b.variant === 'snake' ? 1.4 : 1),
  },
  idchain: {
    group: '鏈', label: '名牌鏈', hint: '側身鏈 + 刻字名牌', categories: ['metal'],
    thick: { label: '線徑', min: 0.6, max: 1.5, step: 0.1, def: 0.9 }, defMaterial: 'silver_polished', clasp: true, threadable: false,
    options: [
      { kind: 'text', label: '刻字', maxLen: 12, def: 'LOVE', placeholder: '英文 / 數字，最多 12 字' },
      { kind: 'width', label: '名牌長', min: 20, max: 40, step: 1, def: 30 },
    ],
  },
  tennis: {
    group: '鏈', label: '鑽石鏈', hint: '一粒接一粒鑲住嘅寶石（網球手鏈 / 網球頸鏈）', categories: ['metal'],
    thick: { label: '石大小', min: 2, max: 5, step: 0.5, def: 3 }, defMaterial: 'silver_polished', clasp: true, threadable: false,
    options: [{ kind: 'gem', label: '寶石', def: 'gem_clear' }],
    outMm: (b) => b.thickMm * 0.6,
  },
  beads: {
    group: '珠', label: '珠串', hint: '彈性繩穿珠，唔使扣頭', categories: ['plastic', 'metal', 'gem'],
    thick: { label: '珠徑', min: 4, max: 10, step: 0.5, def: 6 }, defMaterial: 'pearl', clasp: false, threadable: true,
    options: [
      { kind: 'variant', label: '珠形', def: 'round', choices: [
        { id: 'round', label: '圓珠' }, { id: 'faceted', label: '切面水晶' }, { id: 'cube', label: '方珠' }, { id: 'rondelle', label: '扁珠' },
      ] },
      { kind: 'text', label: '字母珠', maxLen: 10, def: '', placeholder: '例如 ARISA（可以留空）' },
    ],
  },
  spiral: {
    group: '珠', label: '螺旋手鐲', hint: '記憶鋼線繞幾圈，唔使扣頭', categories: ['metal'],
    thick: { label: '珠徑', min: 3, max: 8, step: 0.5, def: 4 }, defMaterial: 'silver_polished', clasp: false, threadable: false,
    options: [
      { kind: 'count', label: '圈數', min: 2, max: 5, def: 3, unit: '圈' },
      { kind: 'colors', label: '珠色', n: 1, categories: ['plastic', 'gem', 'metal'], def: ['jelly_pink'] },
    ],
  },
  bangle: {
    group: '硬身', label: '手鐲', hint: '硬身圓圈，要大到套得過手掌', categories: ['metal', 'plastic'],
    thick: { label: '粗度', min: 1.5, max: 8, step: 0.5, def: 3 }, defMaterial: 'silver_polished', clasp: false, threadable: false, rigid: true,
  },
  hardband: {
    group: '硬身', label: '硬膠手環', hint: '亞克力 / 樹脂扁身手環，' + RIGID_HINT, categories: ['plastic'],
    thick: { label: '厚度', min: 2, max: 5, step: 0.5, def: 3 }, defMaterial: 'jelly_pink', clasp: false, threadable: false, rigid: true, mount: 'glue',
    options: [
      { kind: 'width', label: '闊度', min: 5, max: 30, step: 1, def: 12 },
      { kind: 'variant', label: '表面', def: 'smooth', choices: TEXTURES },
    ],
  },
  cuff: {
    group: '硬身', label: '開口手鐲', hint: '扁身 C 形，開口位套入，唔使加大', categories: ['metal', 'plastic'],
    thick: { label: '厚度', min: 1, max: 3, step: 0.5, def: 1.5 }, defMaterial: 'gold_polished', clasp: false, threadable: false, mount: 'glue',
    options: [
      { kind: 'width', label: '闊度', min: 3, max: 30, step: 1, def: 10 },
      { kind: 'variant', label: '表面', def: 'smooth', choices: [{ id: 'smooth', label: '光面' }, { id: 'hammered', label: '錘紋' }, { id: 'ribbed', label: '坑紋' }, { id: 'twisted', label: '扭紋' }] },
    ],
  },
  silicone: {
    group: '繩帶', label: '矽膠手環', hint: '軟身有彈性，拉開就套到，可以凹字', categories: ['silicone'],
    thick: { label: '厚度', min: 1.5, max: 3, step: 0.5, def: 2 }, defMaterial: 'sil_pink', clasp: false, threadable: false, mount: 'glue',
    options: [
      { kind: 'width', label: '闊度', min: 6, max: 20, step: 1, def: 12 },
      { kind: 'text', label: '凹字', maxLen: 16, def: '', placeholder: '例如 STAY CUTE（可以留空）' },
    ],
  },
  cord: {
    group: '繩帶', label: '絲絨繩', hint: '柔軟布繩，配金屬扣', categories: ['fabric'],
    thick: { label: '繩粗', min: 1.5, max: 4, step: 0.5, def: 2.5 }, defMaterial: 'velvet_pink', clasp: true, threadable: true,
  },
  braided: {
    group: '繩帶', label: '編織手繩', hint: '三股棉繩（友誼手繩），抽繩結調鬆緊', categories: ['cotton'],
    thick: { label: '繩粗', min: 2, max: 6, step: 0.5, def: 3.5 }, defMaterial: 'cot_pink', clasp: false, threadable: true,
    options: [
      { kind: 'variant', label: '織法', def: 'braid', choices: [{ id: 'braid', label: '三股辮' }, { id: 'twist', label: '扭繩' }] },
      { kind: 'colors', label: '每股顏色', n: 3, categories: ['cotton'], def: ['cot_pink', 'cot_white', 'cot_mint'] },
    ],
  },
  wrap: {
    group: '繩帶', label: '皮繩多圈', hint: '皮繩繞幾圈，用按扣扣', categories: ['leather'],
    thick: { label: '繩粗', min: 1.5, max: 4, step: 0.5, def: 2.5 }, defMaterial: 'lea_brown', clasp: false, threadable: true,
    options: [{ kind: 'count', label: '圈數', min: 1, max: 3, def: 2, unit: '圈' }],
  },
  strap: {
    group: '繩帶', label: '皮帶扣手帶', hint: '扁身皮帶，似錶帶咁用皮帶扣', categories: ['leather'],
    thick: { label: '厚度', min: 1.5, max: 3, step: 0.5, def: 2 }, defMaterial: 'lea_tan', clasp: false, threadable: false, mount: 'glue',
    options: [{ kind: 'width', label: '闊度', min: 8, max: 20, step: 1, def: 14 }],
  },
  scrunchie: {
    group: '繩帶', label: '髮圈手圈', hint: '布料包住橡筋，皺皺咁套喺手腕', categories: ['fabric'],
    thick: { label: '粗度', min: 8, max: 20, step: 1, def: 14 }, defMaterial: 'satin_cream', clasp: false, threadable: false,
    outMm: (b) => b.thickMm * 0.55,
  },
  lace: {
    group: '繩帶', label: '蕾絲帶', hint: '花邊布帶，配件會縫上去', categories: ['lace'],
    thick: { label: '闊度', min: 8, max: 20, step: 1, def: 12 }, defMaterial: 'lace_white', clasp: true, threadable: false,
    outMm: () => 0.8,
  },
}

/** 配件要放喺底座外面幾遠（mm） */
export const baseOutMm = (b: BaseSpec) => BASES[b.type].outMm?.(b) ?? b.thickMm / 2

/** 揀新底座時嘅預設設定 */
export function defaultBase(type: BaseType): BaseSpec {
  const info = BASES[type]
  const b: BaseSpec = { type, material: info.defMaterial, thickMm: info.thick.def }
  for (const o of info.options ?? []) {
    if (o.kind === 'variant') b.variant = o.def
    if (o.kind === 'width') b.widthMm = o.def
    if (o.kind === 'count') b.count = o.def
    if (o.kind === 'text') b.text = o.def
    if (o.kind === 'colors') b.colors = [...o.def]
    if (o.kind === 'gem') b.gem = o.def
  }
  return b
}

/** 繞幾圈嘅底座：材料長度 = 內圈 × 圈數 */
export const turnsOf = (b: BaseSpec) => (b.type === 'wrap' || b.type === 'spiral' ? b.count ?? 1 : 1)

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
  kind: 'bracelet', name: '手鏈',
  bases: ['chain', 'idchain', 'tennis', 'beads', 'spiral', 'bangle', 'hardband', 'cuff', 'silicone', 'cord', 'braided', 'wrap', 'strap', 'scrunchie', 'lace'],
  fits: BRACELET_FITS, defaultFit: 'comfort', aspect: [0.86, 1.08],
  rigidExtraCm: 3.5, rigidNote: '手鐲要套過手掌，已自動加大', home, pair,
})
const anklet = (home: number, pair: RingZone): ZoneJewelry => ({
  kind: 'anklet', name: '腳鏈', bases: ['chain', 'tennis', 'beads', 'silicone', 'cord', 'braided', 'wrap', 'lace'],
  fits: ANKLET_FITS, defaultFit: 'comfort', aspect: [0.95, 1.05], rigidExtraCm: 0, home, pair,
})
const armlet = (home: number, pair: RingZone): ZoneJewelry => ({
  kind: 'armlet', name: '臂環', bases: ['chain', 'beads', 'spiral', 'bangle', 'cuff', 'hardband', 'silicone', 'cord', 'braided', 'wrap', 'lace'],
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
    kind: 'necklace', name: '頸鏈', bases: ['chain', 'idchain', 'tennis', 'beads', 'cord', 'braided', 'lace'],
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
  // 中心線比內圈長：多咗材料本身向外嗰半厚度
  return innerLengthCm(d, z, girthCm) * 10 + Math.PI * 2 * baseOutMm(d.base) * (d.base.type === 'scrunchie' ? 0.6 : 1)
}

export function newDesign(z: RingZone): RingDesign {
  return {
    version: 1,
    base: defaultBase('chain'),
    fit: JEWELRY[z].defaultFit,
    charms: [],
  }
}

let n = 0
export const newId = () => `c${Date.now().toString(36)}${(n++).toString(36)}`
