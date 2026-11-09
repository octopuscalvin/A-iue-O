import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { storageBackend } from '../store'
import type { ShapeId } from './charms'
import {
  JEWELRY, SHAPES, defaultBase, newDesign, newId,
  type BaseType, type CharmSpec, type RingDesign, type RingZone,
} from './types'

interface DesignState {
  designs: Partial<Record<RingZone, RingDesign>>
  selected: string | null
  start: (z: RingZone) => void
  remove: (z: RingZone) => void
  setBaseType: (z: RingZone, type: BaseType) => void
  setBase: (z: RingZone, patch: Partial<RingDesign['base']>) => void
  setFit: (z: RingZone, fit: string) => void
  addCharm: (z: RingZone, shape: ShapeId) => void
  updateCharm: (z: RingZone, id: string, patch: Partial<CharmSpec>) => void
  removeCharm: (z: RingZone, id: string) => void
  duplicateCharm: (z: RingZone, id: string) => void
  /** 複製去對面（左 ↔ 右），位置左右反轉 */
  mirror: (z: RingZone) => void
  select: (id: string | null) => void
}

const wrap = (t: number) => ((t % 1) + 1) % 1

export const useDesigns = create<DesignState>()(
  persist(
    (set, get) => {
      const edit = (z: RingZone, fn: (d: RingDesign) => RingDesign) =>
        set((s) => {
          const d = s.designs[z]
          return d ? { designs: { ...s.designs, [z]: fn(d) } } : {}
        })
      return {
        designs: {},
        selected: null,
        start: (z) => set((s) => ({ designs: { ...s.designs, [z]: newDesign(z) }, selected: null })),
        remove: (z) =>
          set((s) => {
            const designs = { ...s.designs }
            delete designs[z]
            return { designs, selected: null }
          }),
        setBaseType: (z, type) =>
          edit(z, (d) => ({ ...d, base: defaultBase(type) })),
        setBase: (z, patch) => edit(z, (d) => ({ ...d, base: { ...d.base, ...patch } })),
        setFit: (z, fit) => edit(z, (d) => ({ ...d, fit })),
        addCharm: (z, shape) => {
          const id = newId()
          edit(z, (d) => {
            // 新配件放喺外側（頸鏈就放正中前面），再避開已有嘅配件
            const used = d.charms.map((c) => c.t)
            const home = JEWELRY[z].home
            let t = home
            for (let k = 0; k < 24 && used.some((u) => Math.abs(wrap(u - t + 0.5) - 0.5) < 0.04); k++) {
              t = wrap(home + (k % 2 ? -1 : 1) * Math.ceil((k + 1) / 2) * 0.06)
            }
            const info = SHAPES[shape]
            return { ...d, charms: [...d.charms, { id, shape, material: info.defMaterial, t, sizeMm: info.def }] }
          })
          set({ selected: id })
        },
        updateCharm: (z, id, patch) =>
          edit(z, (d) => ({ ...d, charms: d.charms.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
        removeCharm: (z, id) => {
          edit(z, (d) => ({ ...d, charms: d.charms.filter((c) => c.id !== id) }))
          if (get().selected === id) set({ selected: null })
        },
        duplicateCharm: (z, id) => {
          const nid = newId()
          edit(z, (d) => {
            const c = d.charms.find((x) => x.id === id)
            return c ? { ...d, charms: [...d.charms, { ...c, id: nid, t: wrap(c.t + 0.06) }] } : d
          })
          set({ selected: nid })
        },
        // 鏡像：左右手對稱，位置左右反轉
        mirror: (z) =>
          set((s) => {
            const d = s.designs[z]
            const pair = JEWELRY[z].pair
            if (!d || !pair) return {}
            const copy: RingDesign = {
              ...d,
              charms: d.charms.map((c) => ({ ...c, id: newId(), t: wrap(1 - c.t) })),
            }
            return { designs: { ...s.designs, [pair]: copy } }
          }),
        select: (id) => set({ selected: id }),
      }
    },
    {
      name: 'jewelry-designs',
      storage: createJSONStorage(storageBackend),
      partialize: (s) => ({ designs: s.designs }),
    },
  ),
)

