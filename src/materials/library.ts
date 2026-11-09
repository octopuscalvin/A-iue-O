import * as THREE from 'three'

/**
 * 材質庫。每個材質有：
 * - swatch：介面上色板嘅顏色
 * - density：密度 (g/cm³)，用嚟計首飾重量
 */
export type MaterialCategory = 'metal' | 'plastic' | 'silicone' | 'fabric' | 'cotton' | 'leather' | 'lace' | 'gem'

export const CATEGORY_LABEL: Record<MaterialCategory, string> = {
  metal: '金屬',
  plastic: '塑膠',
  silicone: '矽膠',
  fabric: '布料',
  cotton: '棉繩',
  leather: '皮革',
  lace: '蕾絲',
  gem: '寶石',
}

/** 閃粉膠：用程式畫細閃點做 roughness / 顏色貼圖 */
let glitterTex: THREE.Texture | null = null
function glitterTexture() {
  if (glitterTex) return glitterTex
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#c8c8c8'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 1400; i++) {
    const v = 200 + Math.floor(Math.random() * 55)
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5)
  }
  glitterTex = new THREE.CanvasTexture(c)
  glitterTex.wrapS = glitterTex.wrapT = THREE.RepeatWrapping
  glitterTex.repeat.set(6, 6)
  return glitterTex
}
const glitter = (color: string) => () =>
  new THREE.MeshPhysicalMaterial({
    color, map: glitterTexture(), roughness: 0.25, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05,
    iridescence: 0.5, iridescenceIOR: 1.4,
  })
const silicone = (color: string) => phys({ color, roughness: 0.75, sheen: 0.3, sheenColor: new THREE.Color('#ffffff') })
const cotton = (color: string) => phys({ color, roughness: 0.95, sheen: 0.5, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.5) })
const leather = (color: string) => phys({ color, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.5 })
/** 寶石：高折射、透光、切面 */
const gem = (color: string) => () =>
  new THREE.MeshPhysicalMaterial({
    color, roughness: 0, metalness: 0, transmission: 0.95, thickness: 0.003, ior: 2.2,
    clearcoat: 1, iridescence: 0.3, flatShading: true,
  })

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
  // 閃粉膠（塑膠）
  { id: 'glitter_pink', name: '粉紅閃粉', category: 'plastic', swatch: '#ff9cc2', density: 1.19, make: glitter('#ff9cc2') },
  { id: 'glitter_silver', name: '銀閃粉', category: 'plastic', swatch: '#dfe3ea', density: 1.19, make: glitter('#e6e9ef') },
  { id: 'glitter_lavender', name: '紫閃粉', category: 'plastic', swatch: '#cdb6ff', density: 1.19, make: glitter('#cdb6ff') },
  // 矽膠（軟身手環）
  { id: 'sil_pink', name: '矽膠粉紅', category: 'silicone', swatch: '#f7a8c4', density: 1.15, make: silicone('#f7a8c4') },
  { id: 'sil_mint', name: '矽膠薄荷', category: 'silicone', swatch: '#a8e6d2', density: 1.15, make: silicone('#a8e6d2') },
  { id: 'sil_lavender', name: '矽膠紫', category: 'silicone', swatch: '#c9b5f2', density: 1.15, make: silicone('#c9b5f2') },
  { id: 'sil_yellow', name: '矽膠黃', category: 'silicone', swatch: '#ffe08a', density: 1.15, make: silicone('#ffe08a') },
  { id: 'sil_black', name: '矽膠黑', category: 'silicone', swatch: '#2b2a30', density: 1.15, make: silicone('#2b2a30') },
  { id: 'sil_white', name: '矽膠白', category: 'silicone', swatch: '#f6f6f6', density: 1.15, make: silicone('#f6f6f6') },
  // 棉繩（編織手繩）
  { id: 'cot_white', name: '白棉繩', category: 'cotton', swatch: '#f7f4ee', density: 0.5, make: cotton('#f7f4ee') },
  { id: 'cot_pink', name: '粉紅棉繩', category: 'cotton', swatch: '#f4a6c0', density: 0.5, make: cotton('#f4a6c0') },
  { id: 'cot_red', name: '紅棉繩', category: 'cotton', swatch: '#d8344f', density: 0.5, make: cotton('#d8344f') },
  { id: 'cot_mint', name: '薄荷棉繩', category: 'cotton', swatch: '#8fd9c3', density: 0.5, make: cotton('#8fd9c3') },
  { id: 'cot_yellow', name: '黃棉繩', category: 'cotton', swatch: '#ffd75e', density: 0.5, make: cotton('#ffd75e') },
  { id: 'cot_sky', name: '天藍棉繩', category: 'cotton', swatch: '#8cc8f0', density: 0.5, make: cotton('#8cc8f0') },
  { id: 'cot_navy', name: '深藍棉繩', category: 'cotton', swatch: '#2e3d6b', density: 0.5, make: cotton('#2e3d6b') },
  // 皮革
  { id: 'lea_brown', name: '啡色皮', category: 'leather', swatch: '#7a4a2b', density: 0.9, make: leather('#7a4a2b') },
  { id: 'lea_tan', name: '淺啡皮', category: 'leather', swatch: '#c08a5a', density: 0.9, make: leather('#c08a5a') },
  { id: 'lea_black', name: '黑皮', category: 'leather', swatch: '#1f1b1d', density: 0.9, make: leather('#1f1b1d') },
  { id: 'lea_pink', name: '粉紅皮', category: 'leather', swatch: '#e8a3b8', density: 0.9, make: leather('#e8a3b8') },
  { id: 'lea_white', name: '白皮', category: 'leather', swatch: '#f2ede6', density: 0.9, make: leather('#f2ede6') },
  // 寶石（鋯石 / 水晶）
  { id: 'gem_clear', name: '白鑽', category: 'gem', swatch: '#f4f8ff', clear: true, density: 5.7, make: gem('#ffffff') },
  { id: 'gem_pink', name: '粉紅鑽', category: 'gem', swatch: '#ff9cc2', clear: true, density: 5.7, make: gem('#ff8fbb') },
  { id: 'gem_sky', name: '海藍', category: 'gem', swatch: '#9fd6ff', clear: true, density: 5.7, make: gem('#8fd0ff') },
  { id: 'gem_emerald', name: '祖母綠', category: 'gem', swatch: '#3ccf8e', clear: true, density: 5.7, make: gem('#33c48a') },
  { id: 'gem_ruby', name: '紅寶石', category: 'gem', swatch: '#e0244f', clear: true, density: 5.7, make: gem('#e0244f') },
  { id: 'gem_amethyst', name: '紫水晶', category: 'gem', swatch: '#a66bff', clear: true, density: 5.7, make: gem('#a66bff') },
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
