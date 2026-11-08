import { MATERIAL_MAP, isMetal } from '../materials/library'
import type { PricedRow, PriceKey } from './pricing'
import { SHAPE_VOLUME } from './charms'
import { BASES, JEWELRY, SHAPES, centerLengthMm, innerLengthCm, isThreaded, type CharmSpec, type RingDesign, type RingZone } from './types'

/**
 * 零件清單（BOM）同重量估算。全部用真實尺寸（mm）計。
 * 呢份清單就係將來交俾師傅嘅生產藍圖基礎。
 */
export interface BomRow extends PricedRow {
  part: string
  spec: string
  qty: number
  material: string
  weightG: number
}

export interface Bom {
  innerCm: number
  rows: BomRow[]
  totalG: number
  warnings: string[]
}

/** 鏈圈尺寸（mm）：線徑 w */
export const chainLink = (w: number) => ({ R: 1.6 * w, r: w / 2, stretch: 1.35, pitch: 2 * 1.1 * w * 1.35 })
export const chainLinkCount = (centerMm: number, w: number) => Math.max(8, 2 * Math.round(centerMm / chainLink(w).pitch / 2))

/** 珠串：邊幾粒珠要讓位畀穿入去嘅配件珠 */
export function beadSlots(d: RingDesign, centerMm: number) {
  const dia = d.base.thickMm
  const n = Math.max(6, Math.floor(centerMm / dia))
  const threaded = d.charms.filter((c) => isThreaded(c, d.base.type))
  const keep: number[] = []
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const blocked = threaded.some((c) => {
      const gap = Math.abs(((c.t - t + 1.5) % 1) - 0.5) * centerMm
      return gap < (dia + c.sizeMm) / 2 - 0.3
    })
    if (!blocked) keep.push(t)
  }
  return { count: n, keep }
}

export const gram = (mm3: number, mat: string) => (mm3 / 1000) * (MATERIAL_MAP[mat]?.density ?? 1)
/** 計價單位：數量 / 每 10cm */
const pr = (key: PriceKey, units: number) => ({ key, units })
export const per10cm = (mm: number) => mm / 100
/** 配件計價：金屬定塑膠 */
export const charmPriceKey = (mat: string): PriceKey => (isMetal(mat) ? 'charm_metal' : 'charm_plastic')
export const name = (mat: string) => MATERIAL_MAP[mat]?.name ?? mat
export const torusVol = (R: number, r: number) => 2 * Math.PI * Math.PI * R * r * r

/** 掛配件用嘅扣環材質：配件係金屬就用同款，否則跟底座金屬，再唔係就用銀 */
export function jumpRingMaterial(c: CharmSpec, d: RingDesign) {
  if (isMetal(c.material)) return c.material
  if (isMetal(d.base.material)) return d.base.material
  return 'silver_polished'
}
export const claspMaterial = (d: RingDesign) => (isMetal(d.base.material) ? d.base.material : 'silver_polished')

export function computeBom(d: RingDesign, zone: RingZone, girthCm: number): Bom {
  const info = BASES[d.base.type]
  const inner = innerLengthCm(d, zone, girthCm)
  const center = centerLengthMm(d, zone, girthCm)
  const t = d.base.thickMm
  const m = d.base.material
  const rows: BomRow[] = []
  const warnings: string[] = []

  switch (d.base.type) {
    case 'chain': {
      const n = chainLinkCount(center, t)
      const L = chainLink(t)
      rows.push({ part: 'O字鏈', spec: `線徑 ${t.toFixed(1)}mm · 長 ${(inner * 10).toFixed(0)}mm（${n} 個鏈圈）`, qty: 1, material: name(m), weightG: gram(n * torusVol(L.R, L.r) * L.stretch, m), price: pr('chain', per10cm(inner * 10)) })
      break
    }
    case 'beads': {
      const { keep } = beadSlots(d, center)
      const v = (4 / 3) * Math.PI * (t / 2) ** 3
      rows.push({ part: '底珠', spec: `直徑 ${t}mm`, qty: keep.length, material: name(m), weightG: gram(v * keep.length, m), price: pr(isMetal(m) || m === 'pearl' ? 'bead_premium' : 'bead_plastic', keep.length) })
      rows.push({ part: '彈性水晶線', spec: `0.8mm · 長 ${(inner * 10 + 40).toFixed(0)}mm（連打結位）`, qty: 1, material: '彈性線', weightG: 0.1, price: pr('elastic', 1) })
      break
    }
    case 'bangle':
      rows.push({ part: JEWELRY[zone].baseText?.bangle?.label ?? '手鐲', spec: `粗 ${t}mm · 內圈 ${(inner * 10).toFixed(0)}mm`, qty: 1, material: name(m), weightG: gram(center * Math.PI * (t / 2) ** 2, m), price: pr(isMetal(m) ? 'bangle_metal' : 'bangle_plastic', 1) })
      break
    case 'cord':
      rows.push({ part: '絲絨繩', spec: `粗 ${t}mm · 長 ${(inner * 10).toFixed(0)}mm`, qty: 1, material: name(m), weightG: gram(center * Math.PI * (t / 2) ** 2, m), price: pr('cord', per10cm(inner * 10)) })
      rows.push({ part: '繩頭夾', spec: `內徑 ${t}mm`, qty: 2, material: name(claspMaterial(d)), weightG: 2 * gram(12, claspMaterial(d)), price: pr('end_cap', 2) })
      break
    case 'lace':
      rows.push({ part: '蕾絲帶', spec: `闊 ${t}mm · 長 ${(inner * 10).toFixed(0)}mm`, qty: 1, material: name(m), weightG: gram(center * t * 0.8 * 0.5, m), price: pr('lace', per10cm(inner * 10)) })
      rows.push({ part: '蕾絲夾頭', spec: `闊 ${t}mm`, qty: 2, material: name(claspMaterial(d)), weightG: 2 * gram(t * 3, claspMaterial(d)), price: pr('end_cap', 2) })
      break
  }

  if (info.clasp) {
    const cm = claspMaterial(d)
    rows.push({ part: '龍蝦扣', spec: '10mm', qty: 1, material: name(cm), weightG: gram(35, cm), price: pr('clasp', 1) })
    rows.push({ part: '扣圈', spec: '5mm', qty: 1, material: name(cm), weightG: gram(torusVol(2.2, 0.4), cm), price: pr('ring_small', 1) })
  }

  // 配件
  const byKey = new Map<string, BomRow>()
  const add = (key: string, row: BomRow) => {
    const r = byKey.get(key)
    if (r) {
      r.qty += row.qty
      r.weightG += row.weightG
      r.price = { ...r.price, units: r.price.units + row.price.units }
    } else byKey.set(key, { ...row, price: { ...row.price } })
  }
  for (const c of d.charms) {
    const threaded = isThreaded(c, d.base.type)
    const label = SHAPES[c.shape].label + (threaded ? '（穿珠）' : '吊墜')
    add(`${c.shape}|${c.material}|${c.sizeMm}|${threaded}`, {
      part: label, spec: `${c.sizeMm}mm`, qty: 1, material: name(c.material),
      weightG: gram(SHAPE_VOLUME[c.shape] * c.sizeMm ** 3, c.material),
      price: pr(threaded ? (isMetal(c.material) || c.material === 'pearl' ? 'bead_premium' : 'bead_plastic') : charmPriceKey(c.material), 1),
    })
    if (!threaded) {
      const jm = jumpRingMaterial(c, d)
      add(`jump|${jm}`, { part: '開口圈', spec: '4mm · 線徑 0.7mm', qty: 1, material: name(jm), weightG: gram(torusVol(1.65, 0.35), jm), price: pr('ring_small', 1) })
    }
  }
  rows.push(...byKey.values())

  // 檢查：配件會唔會撞埋一齊
  const dangles = d.charms.filter((c) => !isThreaded(c, d.base.type)).sort((a, b) => a.t - b.t)
  for (let i = 0; i < dangles.length && dangles.length > 1; i++) {
    const a = dangles[i]
    const b = dangles[(i + 1) % dangles.length]
    const gap = (((b.t - a.t) % 1) + 1) % 1 * center
    if (gap < (a.sizeMm + b.sizeMm) / 2 * 0.7) {
      warnings.push(`「${SHAPES[a.shape].label}」同「${SHAPES[b.shape].label}」太近，會撞埋一齊`)
    }
  }
  if (d.base.type === 'bangle' && d.charms.some((c) => c.shape === 'bead')) {
    warnings.push('手鐲唔可以穿珠，圓珠會改為用扣環吊住')
  }
  if (d.base.type === 'lace' && d.charms.some((c) => c.shape === 'bead')) {
    warnings.push('蕾絲帶唔穿珠，圓珠會改為縫上吊墜')
  }
  const totalG = rows.reduce((s, r) => s + r.weightG, 0)
  const limit = JEWELRY[zone].kind === 'necklace' ? 40 : 30
  if (totalG > limit) warnings.push(`總重量超過 ${limit}g，戴耐咗可能會唔舒服`)
  if (d.base.type === 'lace' && d.charms.some((c) => isMetal(c.material) && c.sizeMm > 12)) {
    warnings.push('大型金屬配件太重，蕾絲帶可能會被拉變形')
  }
  return { innerCm: inner, rows, totalG, warnings }
}
