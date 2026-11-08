import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { storageBackend } from '../store'
import type { ShapeId } from './charms'
import { newAccDesign, type AccDesign, type AccZone } from './accessory'
import { SHAPES, newId, type CharmSpec } from './types'

interface AccState {
  designs: Partial<Record<AccZone, AccDesign>>
  selected: string | null
  start: (z: AccZone) => void
  remove: (z: AccZone) => void
  update: (z: AccZone, patch: Partial<AccDesign>) => void
  addCharm: (z: AccZone, shape: ShapeId) => void
  updateCharm: (z: AccZone, id: string, patch: Partial<CharmSpec>) => void
  removeCharm: (z: AccZone, id: string) => void
  duplicateCharm: (z: AccZone, id: string) => void
  /** 左右耳互相複製 */
  mirror: (z: AccZone) => void
  select: (id: string | null) => void
}

const wrap = (t: number) => ((t % 1) + 1) % 1

export const useAcc = create<AccState>()(
  persist(
    (set, get) => {
      const edit = (z: AccZone, fn: (d: AccDesign) => AccDesign) =>
        set((s) => {
          const d = s.designs[z]
          return d ? { designs: { ...s.designs, [z]: fn(d) } } : {}
        })
      return {
        designs: {},
        selected: null,
        start: (z) => set((s) => ({ designs: { ...s.designs, [z]: newAccDesign(z) }, selected: null })),
        remove: (z) =>
          set((s) => {
            const designs = { ...s.designs }
            delete designs[z]
            return { designs, selected: null }
          }),
        update: (z, patch) => edit(z, (d) => ({ ...d, ...patch }) as AccDesign),
        addCharm: (z, shape) => {
          const id = newId()
          edit(z, (d) => {
            const info = SHAPES[shape]
            const c: CharmSpec = { id, shape, material: info.defMaterial, t: 0, sizeMm: info.def }
            if (d.kind === 'earring') {
              // 耳釘：換耳釘面；耳圈：由最低點向兩邊排開
              if (d.style === 'stud') return { ...d, charms: [{ ...c, sizeMm: Math.min(info.def, 8) }] }
              const n = d.charms.length
              if (d.style === 'cuff') return { ...d, charms: [...d.charms, { ...c, sizeMm: Math.min(info.def, 7), t: n }] }
              c.t = d.style === 'hoop' ? wrap((n % 2 ? -1 : 1) * Math.ceil(n / 2) * 0.07) : n
              c.sizeMm = Math.min(info.def, 9)
              return { ...d, charms: [...d.charms, c] }
            }
            // 頭飾：由中間向兩邊排開
            const n = d.charms.length
            c.t = Math.min(0.95, Math.max(0.05, 0.5 + (n % 2 ? -1 : 1) * Math.ceil(n / 2) * (d.style === 'clip' ? 0.22 : 0.07)))
            return { ...d, charms: [...d.charms, c] }
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
            if (!c) return d
            const t = d.kind === 'earring' && d.style === 'drop' ? d.charms.length : Math.min(1, c.t + 0.08)
            return { ...d, charms: [...d.charms, { ...c, id: nid, t }] }
          })
          set({ selected: nid })
        },
        mirror: (z) =>
          set((s) => {
            const d = s.designs[z]
            if (!d || z === 'head') return {}
            const other: AccZone = z === 'earL' ? 'earR' : 'earL'
            return { designs: { ...s.designs, [other]: { ...d, charms: d.charms.map((c) => ({ ...c, id: newId() })) } } }
          }),
        select: (id) => set({ selected: id }),
      }
    },
    { name: 'jewelry-accessories', storage: createJSONStorage(storageBackend), partialize: (s) => ({ designs: s.designs }) },
  ),
)
