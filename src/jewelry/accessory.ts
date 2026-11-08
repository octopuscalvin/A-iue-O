import { isMetal, type MaterialCategory } from '../materials/library'
import { SHAPE_VOLUME } from './charms'
import { charmPriceKey, gram, name, per10cm, torusVol, type Bom, type BomRow } from './bom'
import { SHAPES, type CharmSpec } from './types'

/**
 * 耳環同頭飾（唔係圈形嘅首飾）。
 * 尺寸單位一律 mm。
 */
export type AccZone = 'earL' | 'earR' | 'head'
export const isAccZone = (z: string): z is AccZone => z === 'earL' || z === 'earR' || z === 'head'

export type EarStyle = 'stud' | 'hoop' | 'drop' | 'cuff'
/** 耳仔上面嘅位置：1 = 耳珠（預設）、2 = 耳珠上緣、3 = 耳骨 */
export type EarSpot = 1 | 2 | 3
export interface EarDesign {
  version: 1
  kind: 'earring'
  style: EarStyle
  /** 耳針 / 耳圈 / 耳鈎同鏈嘅金屬 */
  metal: string
  hoopDiaMm: number
  wireMm: number
  dropLenMm: number
  /** 戴喺邊個位置（舊設計冇呢項 = 1） */
  spot?: EarSpot
  /** 耳骨夾直徑 */
  cuffDiaMm?: number
  /**
   * 耳釘：第一件就係耳釘面
   * 耳圈：t = 圈上位置（0 = 最低點）
   * 吊墜：由上至下一件接一件
   * 耳骨夾：吊喺夾外面
   */
  charms: CharmSpec[]
}

export type HeadStyle = 'headband' | 'clip'
export interface HeadDesign {
  version: 1
  kind: 'head'
  style: HeadStyle
  material: string
  /** 髮箍闊度 / 髮夾闊度 */
  widthMm: number
  /** 髮夾喺頭上嘅位置：0 = 左耳上面、0.5 = 頭頂、1 = 右耳上面 */
  clipT: number
  /** 髮夾前後移動（mm，正數 = 向前，舊設計冇呢項 = 0） */
  clipZ?: number
  /** t = 沿髮箍 / 髮夾嘅位置（0–1） */
  charms: CharmSpec[]
}

export type AccDesign = EarDesign | HeadDesign

export const EAR_STYLES: Record<EarStyle, { label: string; hint: string }> = {
  stud: { label: '耳釘', hint: '貼住耳珠，配件就係耳釘面' },
  hoop: { label: '耳圈', hint: '金屬圈穿過耳珠，可以掛配件' },
  drop: { label: '吊墜耳環', hint: '耳鈎 + 幼鏈，配件一件接一件吊落去' },
  cuff: { label: '耳骨夾', hint: '唔使穿耳，夾喺耳骨邊上面，配件吊喺外面' },
}
export const EAR_SPOTS: Record<EarSpot, { label: string; hint: string }> = {
  1: { label: '① 耳珠', hint: '一般耳洞位置' },
  2: { label: '② 耳珠上緣', hint: '耳珠後上方，第二個耳洞' },
  3: { label: '③ 耳骨', hint: '耳朵上面嘅軟骨邊' },
}
export const earSpot = (d: EarDesign): EarSpot => d.spot ?? (d.style === 'cuff' ? 3 : 1)
export const CLIP_Z_RANGE = 35
export const HEAD_STYLES: Record<HeadStyle, { label: string; hint: string; width: { min: number; max: number; def: number } }> = {
  headband: { label: '髮箍', hint: '由左耳上面跨過頭頂去到右耳', width: { min: 4, max: 20, def: 8 } },
  clip: { label: '髮夾', hint: '50mm 彈簧髮夾，配件黏喺上面', width: { min: 6, max: 15, def: 9 } },
}
export const HEAD_CATEGORIES: MaterialCategory[] = ['metal', 'plastic', 'fabric']
export const CLIP_LENGTH_MM = 50

export function newAccDesign(z: AccZone): AccDesign {
  if (z === 'head') {
    return { version: 1, kind: 'head', style: 'headband', material: 'velvet_pink', widthMm: 8, clipT: 0.3, charms: [] }
  }
  return { version: 1, kind: 'earring', style: 'hoop', metal: 'gold_polished', hoopDiaMm: 18, wireMm: 1.2, dropLenMm: 15, charms: [] }
}

/** 髮箍弧形長度（mm）：用頭部橢圓（rx, ry 米）同角度範圍計 */
export const HEADBAND_ARC = [-0.12, Math.PI + 0.12] as const
export function headbandLengthMm(rx: number, ry: number) {
  let L = 0
  const n = 64
  let px = 0, py = 0
  for (let i = 0; i <= n; i++) {
    const a = HEADBAND_ARC[0] + ((HEADBAND_ARC[1] - HEADBAND_ARC[0]) * i) / n
    const x = rx * Math.cos(a), y = ry * Math.sin(a)
    if (i) L += Math.hypot(x - px, y - py)
    px = x
    py = y
  }
  return L * 1000
}

const pr = (key: BomRow['price']['key'], units: number) => ({ key, units })

function charmRows(charms: CharmSpec[], ringMetal: string, opts: { glued?: boolean; jump?: boolean }) {
  const rows = new Map<string, BomRow>()
  const add = (k: string, r: BomRow) => {
    const o = rows.get(k)
    if (o) {
      o.qty += r.qty
      o.weightG += r.weightG
      o.price = { ...o.price, units: o.price.units + r.price.units }
    } else rows.set(k, { ...r, price: { ...r.price } })
  }
  for (const c of charms) {
    add(`${c.shape}|${c.material}|${c.sizeMm}`, {
      part: SHAPES[c.shape].label + (opts.glued ? '（黏貼）' : '吊墜'), spec: `${c.sizeMm}mm`, qty: 1, material: name(c.material),
      weightG: gram(SHAPE_VOLUME[c.shape] * c.sizeMm ** 3, c.material), price: pr(charmPriceKey(c.material), 1),
    })
    if (opts.jump) {
      const jm = isMetal(c.material) ? c.material : ringMetal
      add(`jump|${jm}`, { part: '開口圈', spec: '3mm · 線徑 0.6mm', qty: 1, material: name(jm), weightG: gram(torusVol(1.2, 0.3), jm), price: pr('ring_small', 1) })
    }
    if (opts.glued) add('glue', { part: '首飾膠', spec: '黏貼配件', qty: 1, material: 'E6000 / UV 膠', weightG: 0.02, price: pr('glue', 1) })
  }
  return [...rows.values()]
}

/** 一隻耳環嘅零件清單 */
export function earBom(d: EarDesign): Bom {
  const rows: BomRow[] = []
  const warnings: string[] = []
  const m = d.metal
  if (d.style === 'stud') {
    rows.push({ part: '耳針連耳背', spec: '針長 11mm · 0.8mm', qty: 1, material: name(m), weightG: gram(11 * Math.PI * 0.16 + 20, m), price: pr('ear_stud', 1) })
    const face = d.charms[0]
    if (face) rows.push(...charmRows([face], m, { glued: true }))
    else rows.push({ part: '圓珠耳釘面', spec: '4mm', qty: 1, material: name(m), weightG: gram((4 / 3) * Math.PI * 8, m), price: pr('charm_metal', 1) })
    if (d.charms.length > 1) warnings.push('耳釘只用第一件配件做耳釘面，其餘唔會用到')
  } else if (d.style === 'hoop') {
    const len = Math.PI * d.hoopDiaMm
    rows.push({ part: '耳圈', spec: `直徑 ${d.hoopDiaMm}mm · 線徑 ${d.wireMm}mm`, qty: 1, material: name(m), weightG: gram(len * Math.PI * (d.wireMm / 2) ** 2, m), price: pr('hoop', 1) })
    rows.push(...charmRows(d.charms, m, { jump: true }))
    if (d.hoopDiaMm < 14 && d.charms.some((c) => c.sizeMm > 10)) warnings.push('耳圈太細，大配件會頂住塊面')
  } else if (d.style === 'cuff') {
    const dia = d.cuffDiaMm ?? 8
    const len = Math.PI * dia * (5.4 / (Math.PI * 2))
    rows.push({ part: '耳骨夾', spec: `直徑 ${dia}mm · 線徑 ${d.wireMm}mm（開口）`, qty: 1, material: name(m), weightG: gram(len * Math.PI * (d.wireMm / 2) ** 2, m), price: pr('ear_cuff', 1) })
    rows.push(...charmRows(d.charms, m, { jump: true }))
    if (earSpot(d) === 1) warnings.push('耳骨夾通常夾喺耳骨（③）或者耳珠上緣（②），夾喺耳珠容易跌')
  } else {
    rows.push({ part: '法式耳鈎', spec: '0.7mm · 20mm', qty: 1, material: name(m), weightG: gram(20 * Math.PI * 0.1225, m), price: pr('ear_hook', 1) })
    rows.push({ part: '耳環幼鏈', spec: `長 ${d.dropLenMm}mm`, qty: 1, material: name(m), weightG: gram(d.dropLenMm * 0.25, m), price: pr('ear_chain', per10cm(d.dropLenMm)) })
    rows.push(...charmRows(d.charms, m, { jump: true }))
    const total = d.dropLenMm + d.charms.reduce((s, c) => s + c.sizeMm + 3, 0)
    if (total > 70) warnings.push(`吊墜總長 ${total.toFixed(0)}mm，會掂到膊頭`)
  }
  if (d.style !== 'cuff' && earSpot(d) === 3) warnings.push('③ 耳骨位置要另外穿耳骨洞，耳針要用 1.2mm 耳骨釘')
  const totalG = rows.reduce((s, r) => s + r.weightG, 0)
  if (totalG > 6) warnings.push(`一隻耳環 ${totalG.toFixed(1)}g，超過 6g 戴耐咗耳珠會痛`)
  return { innerCm: 0, rows, totalG, warnings }
}

/** 頭飾零件清單；arcMm = 髮箍長度 */
export function headBom(d: HeadDesign, arcMm: number): Bom {
  const rows: BomRow[] = []
  const warnings: string[] = []
  const m = d.material
  if (d.style === 'headband') {
    rows.push({ part: '髮箍底座', spec: `闊 ${d.widthMm}mm · 長 ${arcMm.toFixed(0)}mm`, qty: 1, material: name(m), weightG: gram(arcMm * d.widthMm * 2.5 * 0.6, m), price: pr('headband', 1) })
  } else {
    rows.push({ part: '彈簧髮夾', spec: `${CLIP_LENGTH_MM}mm × ${d.widthMm}mm`, qty: 1, material: name(m), weightG: gram(CLIP_LENGTH_MM * d.widthMm * 1.5, m), price: pr('hair_clip', 1) })
    const used = d.charms.reduce((s, c) => s + c.sizeMm, 0)
    if (used > CLIP_LENGTH_MM + 10) warnings.push('髮夾上面嘅配件太多，會超出髮夾長度')
  }
  rows.push(...charmRows(d.charms, 'silver_polished', { glued: true }))
  const totalG = rows.reduce((s, r) => s + r.weightG, 0)
  return { innerCm: 0, rows, totalG, warnings }
}

