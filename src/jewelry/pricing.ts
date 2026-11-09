import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { storageBackend } from '../store'

/**
 * 報價：每樣零件嘅單價（港幣），全部可以喺「報價設定」度改。
 * 預設值只係小型手作工作室嘅大約參考，請按實際入貨價調整。
 */
export const PRICE_ITEMS = {
  chain: { label: '金屬鏈（每 10cm）', def: 12, group: '底座' },
  cord: { label: '絲絨繩（每 10cm）', def: 4, group: '底座' },
  lace: { label: '蕾絲帶（每 10cm）', def: 5, group: '底座' },
  elastic: { label: '彈性線（每條）', def: 1, group: '底座' },
  bead_plastic: { label: '塑膠珠（每粒）', def: 1.5, group: '底座' },
  bead_premium: { label: '金屬珠 / 珍珠（每粒）', def: 3, group: '底座' },
  bangle_metal: { label: '金屬手鐲 / 臂環', def: 35, group: '底座' },
  bangle_plastic: { label: '塑膠手鐲 / 臂環', def: 15, group: '底座' },
  headband: { label: '髮箍底座', def: 12, group: '底座' },
  hardband: { label: '硬膠手環', def: 18, group: '底座' },
  cuff_metal: { label: '金屬開口手鐲', def: 30, group: '底座' },
  cuff_plastic: { label: '塑膠開口手鐲', def: 12, group: '底座' },
  silicone_band: { label: '矽膠手環', def: 8, group: '底座' },
  strap_band: { label: '皮帶（手帶）', def: 15, group: '底座' },
  leather_cord: { label: '皮繩（每 10cm）', def: 3, group: '底座' },
  braid_cord: { label: '編織棉繩（每股每 10cm）', def: 1, group: '底座' },
  scrunchie: { label: '髮圈手圈', def: 10, group: '底座' },
  memory_wire: { label: '記憶鋼線（每圈）', def: 2, group: '底座' },
  gem_set: { label: '鑲石（每粒，連鑲座）', def: 2.5, group: '配件' },
  bead_crystal: { label: '切面水晶珠（每粒）', def: 1.5, group: '配件' },
  letter_bead: { label: '字母珠（每粒）', def: 0.8, group: '配件' },
  id_plate: { label: '名牌', def: 12, group: '配件' },
  hair_clip: { label: '髮夾底座', def: 4, group: '底座' },
  charm_metal: { label: '金屬配件（每件）', def: 8, group: '配件' },
  charm_plastic: { label: '塑膠配件（每件）', def: 4, group: '配件' },
  clasp: { label: '龍蝦扣', def: 3, group: '五金' },
  ring_small: { label: '開口圈 / 扣圈（每個）', def: 0.3, group: '五金' },
  end_cap: { label: '繩頭夾 / 蕾絲夾頭（每個）', def: 1, group: '五金' },
  ear_hook: { label: '耳鈎（每個）', def: 2, group: '五金' },
  ear_stud: { label: '耳針連耳背（每個）', def: 3, group: '五金' },
  hoop: { label: '耳圈（每個）', def: 6, group: '五金' },
  ear_cuff: { label: '耳骨夾（每個）', def: 8, group: '五金' },
  ear_chain: { label: '耳環幼鏈（每 10cm）', def: 10, group: '五金' },
  glue: { label: '黏貼（每件配件）', def: 0.5, group: '五金' },
  snap: { label: '按扣', def: 3, group: '五金' },
  buckle: { label: '皮帶扣', def: 4, group: '五金' },
  engrave: { label: '刻字 / 凹字（每個字）', def: 1, group: '人工同利潤' },
  labor_base: { label: '人工：每件首飾', def: 30, group: '人工同利潤' },
  labor_part: { label: '人工：每件配件', def: 3, group: '人工同利潤' },
  margin: { label: '建議售價 = 成本 ×', def: 2.5, group: '人工同利潤' },
} as const

export type PriceKey = keyof typeof PRICE_ITEMS

interface PriceState {
  prices: Partial<Record<PriceKey, number>>
  set: (k: PriceKey, v: number) => void
  reset: () => void
}

export const usePrices = create<PriceState>()(
  persist(
    (set) => ({
      prices: {},
      set: (k, v) => set((s) => ({ prices: { ...s.prices, [k]: v } })),
      reset: () => set({ prices: {} }),
    }),
    { name: 'jewelry-prices', storage: createJSONStorage(storageBackend) },
  ),
)

export const priceOf = (prices: Partial<Record<PriceKey, number>>, k: PriceKey) => prices[k] ?? PRICE_ITEMS[k].def

export interface PricedRow {
  price: { key: PriceKey; units: number }
}

export interface Quote {
  materials: number
  labor: number
  cost: number
  suggested: number
}

/** 報價：材料 + 人工，再乘售價倍數（建議售價取整到 $5） */
export function quoteOf(rows: PricedRow[], charmCount: number, prices: Partial<Record<PriceKey, number>>): Quote {
  const materials = rows.reduce((s, r) => s + priceOf(prices, r.price.key) * r.price.units, 0)
  const labor = priceOf(prices, 'labor_base') + priceOf(prices, 'labor_part') * charmCount
  const cost = materials + labor
  return { materials, labor, cost, suggested: Math.ceil((cost * priceOf(prices, 'margin')) / 5) * 5 }
}

export const rowCost = (r: PricedRow, prices: Partial<Record<PriceKey, number>>) => priceOf(prices, r.price.key) * r.price.units
export const hkd = (n: number) => `$${n.toFixed(n < 10 ? 1 : 0)}`
