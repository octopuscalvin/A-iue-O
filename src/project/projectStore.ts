import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { storageBackend, useApp, type BodyStyle, type VrmLook, type VrmSizing } from '../store'
import type { Figure } from '../body/figure'
import type { Wardrobe } from '../body/outfits'
import { useDesigns } from '../jewelry/designStore'
import { useAcc } from '../jewelry/accStore'
import type { RingDesign, RingZone } from '../jewelry/types'
import type { AccDesign, AccZone } from '../jewelry/accessory'

/**
 * 作品：成套首飾設計（所有部位）+ 假人設定嘅「快照」。
 * 用嚟儲存、分享連結、匯出 / 匯入檔案。
 */
export interface Snapshot {
  app: 'jewelry-atelier'
  version: 1
  rings: Partial<Record<RingZone, RingDesign>>
  acc: Partial<Record<AccZone, AccDesign>>
  mannequin: { style: BodyStyle; figure: Figure; vrmLook: VrmLook; vrmClothes: boolean; vrmSizing: VrmSizing; vrmModel?: string; wardrobe?: Wardrobe; outfitColors?: Record<string, string> }
}

export interface Project {
  id: string
  name: string
  savedAt: number
  snapshot: Snapshot
}

export function takeSnapshot(): Snapshot {
  const a = useApp.getState()
  return {
    app: 'jewelry-atelier',
    version: 1,
    rings: structuredClone(useDesigns.getState().designs),
    acc: structuredClone(useAcc.getState().designs),
    mannequin: { style: a.style, figure: a.figure, vrmLook: a.vrmLook, vrmClothes: a.vrmClothes, vrmSizing: a.vrmSizing, vrmModel: a.vrmModel, wardrobe: a.wardrobe, outfitColors: a.outfitColors },
  }
}

export const isSnapshot = (x: unknown): x is Snapshot =>
  !!x && typeof x === 'object' && (x as Snapshot).app === 'jewelry-atelier' && typeof (x as Snapshot).rings === 'object'

export function applySnapshot(s: Snapshot) {
  useDesigns.setState({ designs: structuredClone(s.rings ?? {}), selected: null })
  useAcc.setState({ designs: structuredClone(s.acc ?? {}), selected: null })
  const m = s.mannequin
  if (m) useApp.setState({ style: m.style, figure: m.figure, vrmLook: m.vrmLook, vrmClothes: m.vrmClothes, vrmSizing: m.vrmSizing, vrmModel: m.vrmModel ?? 'sample', wardrobe: m.wardrobe ?? {}, outfitColors: m.outfitColors ?? {} })
  useApp.getState().setZone('full')
}

export const pieceCount = (s: Snapshot) => Object.keys(s.rings ?? {}).length + Object.keys(s.acc ?? {}).length

interface ProjectState {
  projects: Project[]
  currentName: string
  save: (name: string) => void
  load: (id: string) => void
  remove: (id: string) => void
  /** 載入其他作品之前，先自動備份目前設計 */
  backup: () => void
}

export const useProjects = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentName: '',
      save: (name) => {
        const n = name.trim() || '未命名作品'
        const snapshot = takeSnapshot()
        set((s) => {
          const existing = s.projects.find((p) => p.name === n)
          const p: Project = { id: existing?.id ?? crypto.randomUUID(), name: n, savedAt: Date.now(), snapshot }
          return { currentName: n, projects: [p, ...s.projects.filter((x) => x.id !== p.id)] }
        })
      },
      load: (id) => {
        const p = get().projects.find((x) => x.id === id)
        if (!p) return
        get().backup()
        applySnapshot(p.snapshot)
        set({ currentName: p.name })
      },
      remove: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
      backup: () => {
        const snap = takeSnapshot()
        if (!pieceCount(snap)) return
        const name = `自動備份 ${new Date().toLocaleString('zh-HK', { hour12: false })}`
        set((s) => ({
          projects: [
            { id: crypto.randomUUID(), name, savedAt: Date.now(), snapshot: snap },
            // 自動備份最多留 5 個
            ...s.projects.filter((p, i, arr) => !p.name.startsWith('自動備份') || arr.filter((q) => q.name.startsWith('自動備份')).indexOf(p) < 4),
          ],
        }))
      },
    }),
    { name: 'jewelry-projects', storage: createJSONStorage(storageBackend) },
  ),
)

// ---------------- 分享連結 ----------------

function toB64Url(text: string) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64Url(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/** 分享連結：成個作品放喺網址 # 後面（唔會上傳去任何伺服器） */
export function shareUrl(name: string) {
  const payload = { name, snapshot: takeSnapshot() }
  return `${location.origin}${location.pathname}#share=${toB64Url(JSON.stringify(payload))}`
}

export function readShareFromHash(): { name: string; snapshot: Snapshot } | null {
  const m = location.hash.match(/share=([A-Za-z0-9_-]+)/)
  if (!m) return null
  try {
    const data = JSON.parse(fromB64Url(m[1]))
    return isSnapshot(data?.snapshot) ? { name: String(data.name ?? '分享作品'), snapshot: data.snapshot } : null
  } catch {
    return null
  }
}

export function clearShareHash() {
  history.replaceState(null, '', location.pathname + location.search)
}
