import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ZoneId } from './body/zones'
import { DEFAULT_FIGURE, type Figure } from './body/figure'
import type { OutfitSlot, Wardrobe } from './body/outfits'

export type BodyStyle = 'basic' | 'girl' | 'vrm'
export type VrmLook = 'original' | 'mannequin'
/** VRM 首飾尺寸：真人標準 / 模型實際 */
export type VrmSizing = 'standard' | 'model'
type V3 = [number, number, number]
/** 用家自己撳耳仔設定嘅 ①②③ 位置（相對耳掛點，米）；分開程式假人同 VRM */
export type EarSpotCustom = Partial<Record<'procedural' | 'vrm', Partial<Record<'earL' | 'earR', (V3 | null)[]>>>>

interface AppState {
  style: BodyStyle
  zone: ZoneId
  isolate: boolean
  showSockets: boolean
  showBones: boolean
  demoJewelry: boolean
  figure: Figure
  /** VRM 模型：原本樣 / 人台質感 */
  vrmLook: VrmLook
  vrmClothes: boolean
  vrmSizing: VrmSizing
  earSpotCustom: EarSpotCustom
  /** 少女假人着緊嘅衣服（DLC） */
  wardrobe: Wardrobe
  outfitColors: Record<string, string>
  /** 而家撳耳仔會設定邊個位置（1–3），null = 唔係設定緊 */
  placingSpot: 1 | 2 | 3 | null
  setStyle: (s: BodyStyle) => void
  setZone: (z: ZoneId) => void
  toggle: (k: 'isolate' | 'showSockets' | 'showBones' | 'demoJewelry') => void
  setFigure: (f: Partial<Figure>) => void
  resetFigure: () => void
  setVrmLook: (l: VrmLook) => void
  toggleVrmClothes: () => void
  setVrmSizing: (v: VrmSizing) => void
  setEarSpot: (src: 'procedural' | 'vrm', zone: 'earL' | 'earR', i: number, v: V3 | null) => void
  resetEarSpots: (src: 'procedural' | 'vrm') => void
  setPlacingSpot: (n: 1 | 2 | 3 | null) => void
  setOutfit: (slot: OutfitSlot, id: string | null) => void
  setOutfitColor: (id: string, color: string) => void
}

/** 瀏覽器唔畀儲存（例如無痕模式）時都唔會壞 */
export const storageBackend = () => {
  try {
    const t = '__t'
    localStorage.setItem(t, t)
    localStorage.removeItem(t)
    return localStorage
  } catch {
    const mem = new Map<string, string>()
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    }
  }
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      style: 'girl',
      zone: 'full',
      isolate: false,
      showSockets: true,
      showBones: false,
      demoJewelry: true,
      figure: DEFAULT_FIGURE,
      setStyle: (style) => set({ style }),
      setZone: (zone) => set({ zone }),
      toggle: (k) => set((s) => ({ [k]: !s[k] }) as Partial<AppState>),
      setFigure: (f) => set((s) => ({ figure: { ...s.figure, ...f } })),
      resetFigure: () => set({ figure: DEFAULT_FIGURE }),
      vrmLook: 'mannequin',
      vrmClothes: true,
      setVrmLook: (vrmLook) => set({ vrmLook }),
      toggleVrmClothes: () => set((s) => ({ vrmClothes: !s.vrmClothes })),
      vrmSizing: 'standard',
      setVrmSizing: (vrmSizing) => set({ vrmSizing }),
      earSpotCustom: {},
      placingSpot: null,
      setEarSpot: (src, zone, i, v) =>
        set((s) => {
          const bySrc = { ...(s.earSpotCustom[src] ?? {}) }
          const arr = [...(bySrc[zone] ?? [null, null, null])]
          arr[i] = v
          bySrc[zone] = arr
          return { earSpotCustom: { ...s.earSpotCustom, [src]: bySrc } }
        }),
      resetEarSpots: (src) => set((s) => ({ earSpotCustom: { ...s.earSpotCustom, [src]: {} } })),
      setPlacingSpot: (placingSpot) => set({ placingSpot }),
      wardrobe: {},
      outfitColors: {},
      setOutfit: (slot, id) =>
        set((s) => {
          const w: Wardrobe = { ...s.wardrobe }
          if (id) w[slot] = id
          else delete w[slot]
          // 連身裙同上衣 / 下裝二揀一
          if (id && slot === 'dress') {
            delete w.top
            delete w.bottom
          }
          if (id && (slot === 'top' || slot === 'bottom')) delete w.dress
          return { wardrobe: w }
        }),
      setOutfitColor: (id, color) => set((s) => ({ outfitColors: { ...s.outfitColors, [id]: color } })),
    }),
    {
      name: 'jewelry-atelier',
      storage: createJSONStorage(storageBackend),
      // 只記低假人設定，唔記鏡頭位置
      partialize: (s) => ({ style: s.style, figure: s.figure, vrmLook: s.vrmLook, vrmClothes: s.vrmClothes, vrmSizing: s.vrmSizing, earSpotCustom: s.earSpotCustom, wardrobe: s.wardrobe, outfitColors: s.outfitColors }),
    },
  ),
)
