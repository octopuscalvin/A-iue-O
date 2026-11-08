import * as THREE from 'three'

export type V3 = [number, number, number]

/**
 * 骨架定義（站立、面向 +Z、腳底 y=0、單位：米）。
 * 身高 160cm、BMI ≈ 20.5 嘅健康女性比例。
 * 「_L」= 假人自己嘅左邊（喺 +X，即係正面睇佢時喺畫面右邊）。
 */
export interface BoneDef {
  name: string
  parent?: string
  head: V3
  /** 冇子骨時，用嚟畫骨架嘅尾端 */
  tail?: V3
}

function side(s: 1 | -1, S: 'L' | 'R'): BoneDef[] {
  return [
    { name: `upperArm_${S}`, parent: 'chest', head: [0.165 * s, 1.31, 0] },
    { name: `forearm_${S}`, parent: `upperArm_${S}`, head: [0.165 * s, 1.02, 0] },
    { name: `hand_${S}`, parent: `forearm_${S}`, head: [0.165 * s, 0.79, 0], tail: [0.165 * s, 0.62, 0] },
    { name: `thigh_${S}`, parent: 'pelvis', head: [0.09 * s, 0.84, 0] },
    { name: `shin_${S}`, parent: `thigh_${S}`, head: [0.09 * s, 0.45, 0] },
    { name: `foot_${S}`, parent: `shin_${S}`, head: [0.09 * s, 0.075, 0], tail: [0.09 * s, 0.02, 0.17] },
  ]
}

export const BONES: BoneDef[] = [
  { name: 'pelvis', head: [0, 0.95, 0] },
  { name: 'spine', parent: 'pelvis', head: [0, 1.05, 0] },
  { name: 'chest', parent: 'spine', head: [0, 1.18, 0] },
  { name: 'neck', parent: 'chest', head: [0, 1.36, 0] },
  { name: 'head', parent: 'neck', head: [0, 1.43, 0], tail: [0, 1.6, 0] },
  ...side(1, 'L'),
  ...side(-1, 'R'),
]

export const BONE_MAP = Object.fromEntries(BONES.map((b) => [b.name, b])) as Record<string, BoneDef>
export const CHILDREN: Record<string, string[]> = {}
for (const b of BONES) if (b.parent) (CHILDREN[b.parent] ??= []).push(b.name)

/** 骨頭相對父骨嘅位置 */
export function localHead(name: string): V3 {
  const b = BONE_MAP[name]
  const p = b.parent ? BONE_MAP[b.parent].head : ([0, 0, 0] as V3)
  return [b.head[0] - p[0], b.head[1] - p[1], b.head[2] - p[2]]
}

/** 骨頭尾端（相對自己） */
export function localTail(name: string): V3 | null {
  const b = BONE_MAP[name]
  const t = b.tail ?? (CHILDREN[name]?.length ? BONE_MAP[CHILDREN[name][0]].head : null)
  if (!t) return null
  return [t[0] - b.head[0], t[1] - b.head[1], t[2] - b.head[2]]
}

/** 執行時：骨名 → 場景入面嘅 Object3D */
export const boneObjects = new Map<string, THREE.Object3D>()

/** 姿勢：每條骨嘅旋轉 (x, y, z 弧度) */
export type Pose = Record<string, V3>

export const BASE_POSE: Pose = {
  upperArm_L: [0, 0, 0.2],
  upperArm_R: [0, 0, -0.2],
  forearm_L: [-0.12, 0, 0],
  forearm_R: [-0.12, 0, 0],
  thigh_L: [0, 0, 0.03],
  thigh_R: [0, 0, -0.03],
}
