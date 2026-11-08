import * as THREE from 'three'

/**
 * 材質庫。每個材質有：
 * - swatch：介面上色板嘅顏色
 * - density：密度 (g/cm³)，用嚟計首飾重量
 */
export type MaterialCategory = 'metal' | 'plastic' | 'fabric' | 'lace'

export const CATEGORY_LABEL: Record<MaterialCategory, string> = {
  metal: '金屬',
  plastic: '塑膠',
  fabric: '布料',
  lace: '蕾絲',
}

export interface MaterialPreset {
  id: string
  name: string
  category: MaterialCategory
  swatch: string
  /** 半透明（果凍）材質，色板會畫成通透樣 */
  clear?: boolean
  density: number
  make: () => THREE.Material
}

const phys = (p: THREE.MeshPhysicalMaterialParameters) => () => new THREE.MeshPhysicalMaterial(p)
const jelly = (color: string) =>
  phys({ color, roughness: 0.1, transmission: 0.75, thickness: 0.006, ior: 1.49, clearcoat: 1, clearcoatRoughness: 0.05 })
const matte = (color: string) => phys({ color, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.6 })
const velvet = (color: string, sheen: string) =>
  phys({ color, roughness: 0.92, sheen: 1, sheenColor: new THREE.Color(sheen), sheenRoughness: 0.45 })

/** 蕾絲花邊：用程式畫出嚟嘅鏤空圖案（唔使下載圖片） */
let laceTex: THREE.Texture | null = null
function laceTexture() {
  if (laceTex) return laceTex
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, 256, 128)
  g.fillStyle = '#fff'
  g.fillRect(0, 26, 256, 76)
  // 上下花邊（半圓波浪）
  for (let x = 0; x <= 256; x += 32) {
    g.beginPath(); g.arc(x + 16, 26, 16, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.arc(x + 16, 102, 16, 0, Math.PI * 2); g.fill()
  }
  // 鏤空花紋
  g.globalCompositeOperation = 'destination-out'
  for (let x = 0; x <= 256; x += 32) {
    g.beginPath(); g.arc(x + 16, 64, 9, 0, Math.PI * 2); g.fill()
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      g.beginPath(); g.arc(x + 16 + Math.cos(a) * 15, 64 + Math.sin(a) * 15, 3, 0, Math.PI * 2); g.fill()
    }
    g.beginPath(); g.arc(x, 64, 4, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.arc(x + 16, 22, 5, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.arc(x + 16, 106, 5, 0, Math.PI * 2); g.fill()
  }
  // 灰度圖要黑底（鏤空位 = 黑）
  g.globalCompositeOperation = 'destination-over'
  g.fillStyle = '#000'
  g.fillRect(0, 0, 256, 128)
  laceTex = new THREE.CanvasTexture(c)
  laceTex.wrapS = THREE.RepeatWrapping
  laceTex.anisotropy = 4
  return laceTex
}
const lace = (color: string) => () =>
  new THREE.MeshPhysicalMaterial({
    color, alphaMap: laceTexture(), alphaTest: 0.5, side: THREE.DoubleSide,
    roughness: 0.85, sheen: 0.8, sheenColor: new THREE.Color('#ffffff'),
  })

export const MATERIALS: MaterialPreset[] = [
  // 金屬（K 金用 18K 密度）
  { id: 'gold_polished', name: '拋光金', category: 'metal', swatch: '#f2c46b', density: 15.5, make: phys({ color: '#f2c46b', metalness: 1, roughness: 0.16 }) },
  { id: 'rose_gold', name: '玫瑰金', category: 'metal', swatch: '#f0b4a0', density: 15.0, make: phys({ color: '#f0b4a0', metalness: 1, roughness: 0.2 }) },
  { id: 'silver_polished', name: '拋光銀', category: 'metal', swatch: '#e8eaee', density: 10.4, make: phys({ color: '#e8eaee', metalness: 1, roughness: 0.14 }) },
  { id: 'silver_brushed', name: '磨砂銀', category: 'metal', swatch: '#c9ccd2', density: 10.4, make: phys({ color: '#d6d8dc', metalness: 1, roughness: 0.42 }) },
  // 塑膠（亞克力密度 1.19）
  { id: 'jelly_pink', name: '果凍粉紅', category: 'plastic', swatch: '#ff8fb8', clear: true, density: 1.19, make: jelly('#ff8fb8') },
  { id: 'jelly_mint', name: '果凍薄荷', category: 'plastic', swatch: '#8fe3cf', clear: true, density: 1.19, make: jelly('#8fe3cf') },
  { id: 'jelly_lavender', name: '果凍薰衣草', category: 'plastic', swatch: '#c3a6ff', clear: true, density: 1.19, make: jelly('#c3a6ff') },
  { id: 'jelly_lemon', name: '果凍檸檬', category: 'plastic', swatch: '#ffe680', clear: true, density: 1.19, make: jelly('#ffe680') },
  { id: 'acrylic_clear', name: '透明', category: 'plastic', swatch: '#eef6ff', clear: true, density: 1.19, make: jelly('#ffffff') },
  { id: 'matte_pink', name: '啞面粉紅', category: 'plastic', swatch: '#f7a8c4', density: 1.19, make: matte('#f7a8c4') },
  { id: 'matte_sky', name: '啞面天藍', category: 'plastic', swatch: '#9fd3f5', density: 1.19, make: matte('#9fd3f5') },
  { id: 'gloss_white', name: '光面白', category: 'plastic', swatch: '#ffffff', density: 1.19, make: phys({ color: '#ffffff', roughness: 0.2, clearcoat: 1 }) },
  { id: 'pearl', name: '珍珠', category: 'plastic', swatch: '#fbf3ec', density: 2.5, make: phys({ color: '#fbf3ec', roughness: 0.25, iridescence: 0.8, iridescenceIOR: 1.6, clearcoat: 1 }) },
  // 布料（絲絨繩、緞帶）
  { id: 'velvet_pink', name: '粉紅絲絨', category: 'fabric', swatch: '#e98aa8', density: 0.6, make: velvet('#e98aa8', '#ffd6e4') },
  { id: 'velvet_red', name: '酒紅絲絨', category: 'fabric', swatch: '#9e1f3d', density: 0.6, make: velvet('#9e1f3d', '#ff8fa8') },
  { id: 'velvet_black', name: '黑絲絨', category: 'fabric', swatch: '#24202a', density: 0.6, make: velvet('#24202a', '#8a7f99') },
  { id: 'satin_cream', name: '奶油緞面', category: 'fabric', swatch: '#f5e6d3', density: 0.6, make: phys({ color: '#f5e6d3', roughness: 0.35, sheen: 0.6, sheenColor: new THREE.Color('#ffffff') }) },
  // 蕾絲
  { id: 'lace_white', name: '白蕾絲', category: 'lace', swatch: '#ffffff', density: 0.35, make: lace('#ffffff') },
  { id: 'lace_pink', name: '粉紅蕾絲', category: 'lace', swatch: '#ffc8da', density: 0.35, make: lace('#ffc8da') },
  { id: 'lace_black', name: '黑蕾絲', category: 'lace', swatch: '#2a2530', density: 0.35, make: lace('#2a2530') },
]

export const MATERIAL_MAP = Object.fromEntries(MATERIALS.map((m) => [m.id, m])) as Record<string, MaterialPreset>

const cache = new Map<string, THREE.Material>()
export function material(id: string): THREE.Material {
  let m = cache.get(id)
  if (!m) {
    const p = MATERIAL_MAP[id]
    if (!p) throw new Error(`未知材質 ${id}`)
    m = p.make()
    cache.set(id, m)
  }
  return m
}

export const isMetal = (id: string) => MATERIAL_MAP[id]?.category === 'metal'
