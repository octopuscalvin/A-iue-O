import type { Pose, V3 } from './skeleton'

export type ZoneId =
  | 'full'
  | 'head'
  | 'earL'
  | 'earR'
  | 'neck'
  | 'upperArmL'
  | 'upperArmR'
  | 'wristL'
  | 'wristR'
  | 'ankleL'
  | 'ankleR'

/** 首飾嘅「佩戴方式」，決定底座形狀 */
export type WearKind = 'none' | 'band' | 'loop' | 'hoop' | 'headband'

export interface Zone {
  id: ZoneId
  label: string
  group: string
  /** 掛點跟住邊條骨 */
  bone: string
  /** 掛點相對骨頭位置（米） */
  socket: V3
  /** 呢個位置嘅身體圍度（cm），之後用嚟計首飾尺寸 */
  girthCm?: number
  wear: WearKind
  /** 鏡頭：方位角、俯仰角（弧度）、距離（米） */
  az: number
  polar: number
  dist: number
  /** 專注模式時保持唔透明嘅身體部分 */
  keep: string[]
  /** 聚焦時假人擺嘅姿勢 */
  pose?: Pose
}

const HEAD_KEEP = ['head', 'hair', 'neck']

export const ZONES: Record<ZoneId, Zone> = {
  full: { id: 'full', label: '全身', group: '全身', bone: 'pelvis', socket: [0, -0.09, 0], wear: 'none', az: 0.35, polar: 1.47, dist: 3.3, keep: [] },
  head: { id: 'head', label: '頭飾', group: '頭部', bone: 'head', socket: [0, 0.07, 0], girthCm: 54, wear: 'headband', az: 0.55, polar: 1.15, dist: 0.62, keep: HEAD_KEEP },
  earL: { id: 'earL', label: '左耳', group: '頭部', bone: 'head', socket: [0.081, 0.038, -0.001], wear: 'hoop', az: 1.25, polar: 1.5, dist: 0.3, keep: HEAD_KEEP },
  earR: { id: 'earR', label: '右耳', group: '頭部', bone: 'head', socket: [-0.081, 0.038, -0.001], wear: 'hoop', az: -1.25, polar: 1.5, dist: 0.3, keep: HEAD_KEEP },
  neck: { id: 'neck', label: '頸', group: '頸部', bone: 'neck', socket: [0, 0.0, 0.0], girthCm: 32, wear: 'loop', az: 0.25, polar: 1.4, dist: 0.6, keep: [...HEAD_KEEP, 'torso', 'upperArm_L', 'upperArm_R'] },
  upperArmL: { id: 'upperArmL', label: '左上臂', group: '手臂', bone: 'upperArm_L', socket: [0, -0.09, 0], girthCm: 23.5, wear: 'band', az: 1.05, polar: 1.45, dist: 0.48, keep: ['upperArm_L', 'forearm_L', 'torso'] },
  upperArmR: { id: 'upperArmR', label: '右上臂', group: '手臂', bone: 'upperArm_R', socket: [0, -0.09, 0], girthCm: 23.5, wear: 'band', az: -1.05, polar: 1.45, dist: 0.48, keep: ['upperArm_R', 'forearm_R', 'torso'] },
  wristL: {
    id: 'wristL', label: '左手腕', group: '手腕', bone: 'forearm_L', socket: [0, -0.205, 0], girthCm: 15, wear: 'band',
    az: 1.35, polar: 1.0, dist: 0.6, keep: ['forearm_L', 'hand_L'],
    pose: { upperArm_L: [-0.45, 0, 0.3], forearm_L: [-1.15, 0, 0], hand_L: [0, 0, 0] },
  },
  wristR: {
    id: 'wristR', label: '右手腕', group: '手腕', bone: 'forearm_R', socket: [0, -0.205, 0], girthCm: 15, wear: 'band',
    az: -1.35, polar: 1.0, dist: 0.6, keep: ['forearm_R', 'hand_R'],
    pose: { upperArm_R: [-0.45, 0, -0.3], forearm_R: [-1.15, 0, 0], hand_R: [0, 0, 0] },
  },
  ankleL: { id: 'ankleL', label: '左腳腕', group: '腳腕', bone: 'shin_L', socket: [0, -0.325, 0], girthCm: 20, wear: 'band', az: 0.6, polar: 1.25, dist: 0.48, keep: ['shin_L', 'foot_L'] },
  ankleR: { id: 'ankleR', label: '右腳腕', group: '腳腕', bone: 'shin_R', socket: [0, -0.325, 0], girthCm: 20, wear: 'band', az: -0.6, polar: 1.25, dist: 0.48, keep: ['shin_R', 'foot_R'] },
}

export const ZONE_LIST = Object.values(ZONES)
export const ZONE_GROUPS = ['頭部', '頸部', '手臂', '手腕', '腳腕']
