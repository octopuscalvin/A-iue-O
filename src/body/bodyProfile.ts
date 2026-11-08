import { create } from 'zustand'
import type { Ring } from './loft'
import type { BodySurface } from './surface'
import type { V3 } from './skeleton'
import { bustParams, type Figure } from './figure'
import { torsoKeysWithClothes, type Wardrobe } from './outfits'
import { ZONES, type ZoneId } from './zones'

/**
 * 「身體資料」：首飾用嚟計尺寸同貼身形狀。
 * 程式生成嘅假人用三圍計；VRM 模型就喺載入時直接量度模型本身。
 */
export interface BodyProfile {
  source: 'procedural' | 'vrm'
  /** 身高（cm） */
  heightCm: number
  /** 各部位圍度（cm）：首飾尺寸用呢個 */
  girthCm: Partial<Record<ZoneId, number>>
  /** 模型本身量度出嚟嘅圍度（cm） */
  measuredGirthCm: Partial<Record<ZoneId, number>>
  /** 軀幹截面（世界高度），頸鏈用嚟貼住身體 */
  torsoKeys: Ring[]
  /** 頸掛點嘅世界高度 / 前後位置 */
  neckY: number
  neckZ: number
  /** VRM：頸底圈（相對頸掛點）同身體表面地圖，頸鏈用嚟坐喺膊頭、貼住心口 */
  neckBase?: { a: number; b: number; dz: number }
  surface?: BodySurface
  /** 程式假人先有獨立胸部形狀；VRM 嘅胸部已經包喺 torsoKeys 入面 */
  bust: ReturnType<typeof bustParams> | null
  /** 頸圈款嘅位置（相對頸掛點） */
  choker: { y: number; dz: number; aspect: [number, number] }
  /**
   * 髮箍 / 髮夾用嘅頭形（相對頭掛點，米）：
   * 喺 XY 平面嘅橢圓弧，中心 (0, cy, cz)，再向後傾 tilt 弧度
   */
  headArc: { cy: number; cz: number; rx: number; ry: number; rz: number; tilt: number }
  /** 耳仔位置 ②、③ 相對耳掛點（①）嘅偏移（米，頭部座標） */
  earSpots: { earL: [V3, V3, V3]; earR: [V3, V3, V3] }
}

const PROC_EAR_SPOTS = (s: 1 | -1): [V3, V3, V3] => [
  [0, 0, 0],
  [0.003 * s, 0.007, -0.002],
  [-0.002 * s, 0.042, -0.019],
]

export function proceduralProfile(f: Figure, wardrobe: Wardrobe = {}): BodyProfile {
  const girthCm: Partial<Record<ZoneId, number>> = {}
  for (const z of Object.values(ZONES)) if (z.girthCm) girthCm[z.id] = z.girthCm
  return {
    source: 'procedural',
    heightCm: 160,
    girthCm,
    measuredGirthCm: girthCm,
    // 着咗衫：頸鏈貼住件衫，唔會穿入去
    torsoKeys: torsoKeysWithClothes(f, wardrobe),
    neckY: 1.36,
    neckZ: 0,
    bust: bustParams(f),
    choker: { y: 0.03, dz: 0.006, aspect: [0.97, 1] },
    headArc: { cy: 0.012, cz: 0.006, rx: 0.095, ry: 0.111, rz: 0.112, tilt: -0.3 },
    // 程式假人：耳仔係個橢球（見 Mannequin 嘅 ear），① 就係耳掛點
    earSpots: { earL: PROC_EAR_SPOTS(1), earR: PROC_EAR_SPOTS(-1) },
  }
}

export const useBody = create<{ profile: BodyProfile }>(() => ({
  profile: proceduralProfile({ bust: 82, waist: 62, hip: 88 }),
}))

export const setProfile = (profile: BodyProfile) => useBody.setState({ profile })

/** 某部位嘅圍度（cm） */
export const girthOf = (p: BodyProfile, z: ZoneId) => p.girthCm[z] ?? ZONES[z].girthCm ?? 15
