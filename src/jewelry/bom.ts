import { MATERIAL_MAP, isMetal } from '../materials/library'
import type { PricedRow, PriceKey } from './pricing'
import { SHAPE_VOLUME } from './charms'
import { BASES, JEWELRY, SHAPES, centerLengthMm, innerLengthCm, isThreaded, type BaseOption, type CharmSpec, type RingDesign, type RingZone } from './types'

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

/** 底座選項嘅文字（例如「O字鏈」「光面」） */
export function variantLabel(d: RingDesign) {
  const o = BASES[d.base.type].options?.find((x) => x.kind === 'variant') as Extract<BaseOption, { kind: 'variant' }> | undefined
  return o?.choices.find((c) => c.id === (d.base.variant ?? o.def))?.label ?? ''
}

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
      rows.push({ part: variantLabel(d) || 'O字鏈', spec: `線徑 ${t.toFixed(1)}mm · 長 ${(inner * 10).toFixed(0)}mm（${n} 個鏈圈）`, qty: 1, material: name(m), weightG: gram(n * torusVol(L.R, L.r) * L.stretch, m), price: pr('chain', per10cm(inner * 10)) })
      break
    }
    case 'beads': {
      const { keep } = beadSlots(d, center)
      const v = (4 / 3) * Math.PI * (t / 2) ** 3
      const letters = (d.base.text ?? '').replace(/\s+/g, '').length
      const plain = Math.max(0, keep.length - letters)
      const key = d.base.variant === 'faceted' ? 'bead_crystal' : isMetal(m) || m === 'pearl' ? 'bead_premium' : 'bead_plastic'
      rows.push({ part: `底珠（${variantLabel(d) || '圓珠'}）`, spec: `${t}mm`, qty: plain, material: name(m), weightG: gram(v * plain, m), price: pr(key, plain) })
      if (letters) rows.push({ part: '字母珠', spec: `${t}mm 方珠 · 「${(d.base.text ?? '').toUpperCase()}」`, qty: letters, material: '亞克力', weightG: gram(t ** 3 * 0.7 * letters, 'gloss_white'), price: pr('letter_bead', letters) })
      rows.push({ part: '彈性水晶線', spec: `0.8mm · 長 ${(inner * 10 + 40).toFixed(0)}mm（連打結位）`, qty: 1, material: '彈性線', weightG: 0.1, price: pr('elastic', 1) })
      break
    }
    case 'bangle':
      rows.push({ part: JEWELRY[zone].baseText?.bangle?.label ?? '手鐲', spec: `粗 ${t}mm · 內圈 ${(inner * 10).toFixed(0)}mm`, qty: 1, material: name(m), weightG: gram(center * Math.PI * (t / 2) ** 2, m), price: pr(isMetal(m) ? 'bangle_metal' : 'bangle_plastic', 1) })
      break
    case 'idchain': {
      const n = chainLinkCount(center, t)
      const L = chainLink(t)
      const W = d.base.widthMm ?? 30
      const text = (d.base.text ?? '').toUpperCase()
      rows.push({ part: '側身鏈', spec: `線徑 ${t.toFixed(1)}mm · 長 ${(inner * 10 - W).toFixed(0)}mm`, qty: 1, material: name(m), weightG: gram(n * torusVol(L.R, L.r) * L.stretch * 0.85, m), price: pr('chain', per10cm(inner * 10 - W)) })
      rows.push({ part: '名牌', spec: `${W} × 8 × 1.3mm`, qty: 1, material: name(m), weightG: gram(W * 8 * 1.3, m), price: pr('id_plate', 1) })
      if (text) rows.push({ part: '刻字', spec: `「${text}」`, qty: text.length, material: '雷射 / 手刻', weightG: 0, price: pr('engrave', text.length) })
      rows.push({ part: '開口圈', spec: '4mm（名牌兩邊）', qty: 2, material: name(m), weightG: gram(2 * torusVol(1.65, 0.35), m), price: pr('ring_small', 2) })
      break
    }
    case 'tennis': {
      const n = Math.max(10, Math.floor(center / (t * 1.12)))
      const gm = d.base.gem ?? 'gem_clear'
      rows.push({ part: '寶石', spec: `${t}mm 圓形明亮式`, qty: n, material: name(gm), weightG: gram(n * 0.35 * t ** 3, gm), price: pr('gem_set', n) })
      rows.push({ part: '鑲座鏈', spec: `${n} 個爪鑲 · 長 ${(inner * 10).toFixed(0)}mm`, qty: 1, material: name(m), weightG: gram(n * t * t * 0.35, m), price: pr('chain', per10cm(inner * 10)) })
      break
    }
    case 'spiral': {
      const turns = d.base.count ?? 3
      const len = center * turns
      const n = Math.floor(len / t)
      const bm = d.base.colors?.[0] ?? 'jelly_pink'
      rows.push({ part: '記憶鋼線', spec: `0.7mm · ${turns} 圈`, qty: 1, material: name(m), weightG: gram(len * 0.38, m), price: pr('memory_wire', turns) })
      rows.push({ part: '珠', spec: `${t}mm`, qty: n, material: name(bm), weightG: gram(n * (4 / 3) * Math.PI * (t / 2) ** 3, bm), price: pr(isMetal(bm) ? 'bead_premium' : 'bead_plastic', n) })
      rows.push({ part: '鋼線尾珠', spec: '2.5mm', qty: 2, material: name(m), weightG: gram(2 * 8, m), price: pr('end_cap', 2) })
      break
    }
    case 'hardband':
    case 'cuff':
    case 'silicone':
    case 'strap': {
      const W = d.base.widthMm ?? 12
      const label = { hardband: '硬膠手環', cuff: '開口手鐲', silicone: '矽膠手環', strap: '皮帶' }[d.base.type]
      const surface = variantLabel(d)
      const len = d.base.type === 'cuff' ? center - 25 : d.base.type === 'strap' ? center + 40 : center
      const key = d.base.type === 'hardband' ? 'hardband' : d.base.type === 'silicone' ? 'silicone_band' : d.base.type === 'strap' ? 'strap_band' : isMetal(m) ? 'cuff_metal' : 'cuff_plastic'
      rows.push({
        part: label, spec: `闊 ${W}mm · 厚 ${t}mm${surface ? ` · ${surface}` : ''} · ${d.base.type === 'cuff' ? `開口 25mm` : `內圈 ${(inner * 10).toFixed(0)}mm`}`,
        qty: 1, material: name(m), weightG: gram(len * W * t * 0.85, m), price: pr(key, 1),
      })
      if (d.base.type === 'silicone' && d.base.text) rows.push({ part: '凹字', spec: `「${d.base.text.toUpperCase()}」`, qty: d.base.text.length, material: '模具', weightG: 0, price: pr('engrave', d.base.text.length * 0.5) })
      if (d.base.type === 'strap') rows.push({ part: '皮帶扣', spec: `${W}mm`, qty: 1, material: name(claspMaterial(d)), weightG: gram(W * 20, claspMaterial(d)), price: pr('buckle', 1) })
      break
    }
    case 'braided': {
      const cols = d.base.colors?.length ? d.base.colors : [m, m, m]
      cols.forEach((c, i) => rows.push({ part: `棉繩 第 ${i + 1} 股`, spec: `${(t * 0.6).toFixed(1)}mm · 長 ${(inner * 10 * 1.15 + 150).toFixed(0)}mm（連結尾）`, qty: 1, material: name(c), weightG: gram(inner * 10 * 1.15 * (t * 0.3) ** 2 * Math.PI, c), price: pr('braid_cord', per10cm(inner * 10 * 1.15 + 150)) }))
      rows.push({ part: '尾珠', spec: `${(t * 1.4).toFixed(1)}mm`, qty: 2, material: name(cols[2 % cols.length]), weightG: 0.2, price: pr('bead_plastic', 2) })
      break
    }
    case 'wrap': {
      const turns = d.base.count ?? 2
      const len = center * turns + 20
      rows.push({ part: '皮繩', spec: `粗 ${t}mm · 長 ${len.toFixed(0)}mm（${turns} 圈）`, qty: 1, material: name(m), weightG: gram(len * Math.PI * (t / 2) ** 2, m), price: pr('leather_cord', per10cm(len)) })
      rows.push({ part: '按扣', spec: `${(t * 1.7).toFixed(0)}mm`, qty: 1, material: name(claspMaterial(d)), weightG: gram(40, claspMaterial(d)), price: pr('snap', 1) })
      break
    }
    case 'scrunchie':
      rows.push({ part: '髮圈手圈', spec: `粗 ${t}mm · 布長 ${(center * 1.8).toFixed(0)}mm + 橡筋`, qty: 1, material: name(m), weightG: gram(center * 1.8 * t * 0.4, m), price: pr('scrunchie', 1) })
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
