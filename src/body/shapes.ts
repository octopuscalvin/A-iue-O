import * as THREE from 'three'
import { loft, limbRings, shell, type LimbKey, type Ring } from './loft'

/*
 * 身體形狀數據（單位：米）。
 * 已校對嘅圍度（纖瘦版，BMI ≈ 19.5）：手腕 ≈ 15cm、腳腕 ≈ 20cm、頸 ≈ 32cm、
 * 頭 ≈ 54cm、上臂 ≈ 23.5cm、胸 ≈ 82cm、腰 ≈ 62cm、臀 ≈ 88cm。
 */

// ---------- 軀幹（絕對高度，掛喺 pelvis 骨，pelvis 喺 y=0.95） ----------
export const TORSO_KEYS: Ring[] = [
  { y: 0.705, a: 0.03, b: 0.03 },
  { y: 0.72, a: 0.1, b: 0.07, dz: -0.005 },
  { y: 0.76, a: 0.155, b: 0.1, dz: -0.01 },
  { y: 0.84, a: 0.172, b: 0.112, dz: -0.015 },
  { y: 0.92, a: 0.155, b: 0.095, dz: -0.005 },
  { y: 1.0, a: 0.12, b: 0.077, dz: 0 },
  { y: 1.07, a: 0.135, b: 0.087, dz: 0.004 },
  { y: 1.15, a: 0.146, b: 0.1, dz: 0.012 },
  { y: 1.21, a: 0.15, b: 0.092, dz: 0.004 },
  { y: 1.29, a: 0.155, b: 0.075, dz: -0.005 },
  { y: 1.34, a: 0.12, b: 0.06, dz: -0.01 },
  { y: 1.375, a: 0.055, b: 0.05, dz: -0.01 },
]

const PELVIS_Y = 0.95
export const toPelvis = (rs: Ring[]) => rs.map((r) => ({ ...r, y: r.y - PELVIS_Y }))

// ---------- 四肢（t = 由關節向下距離） ----------
export const UPPER_ARM: LimbKey[] = [
  [-0.03, 0.012], [0, 0.04, 0.043], [0.05, 0.041, 0.041], [0.15, 0.037, 0.036],
  [0.25, 0.033, 0.033], [0.3, 0.029, 0.03], [0.315, 0.012],
]
export const FOREARM: LimbKey[] = [
  [-0.02, 0.02], [0, 0.033, 0.032], [0.06, 0.036, 0.034], [0.16, 0.026, 0.029],
  [0.21, 0.02, 0.027], [0.235, 0.017, 0.022], [0.245, 0.01],
]
/** 手掌（連手指，似手套），掌心向身體。前臂近手腕位同樣係前後闊、左右薄 */
export const HAND: LimbKey[] = [
  [-0.012, 0.01, 0.018], [0.015, 0.016, 0.034], [0.07, 0.014, 0.041],
  [0.1, 0.012, 0.039], [0.14, 0.009, 0.031], [0.168, 0.006, 0.014], [0.175, 0.002, 0.004],
]
export const THIGH: LimbKey[] = [
  [-0.03, 0.03], [0, 0.072, 0.077], [0.08, 0.075, 0.08], [0.2, 0.063, 0.066],
  [0.33, 0.049, 0.052], [0.39, 0.046, 0.048], [0.405, 0.02],
]
export const SHIN: LimbKey[] = [
  [-0.012, 0.03], [0, 0.047, 0.05], [0.05, 0.044, 0.047], [0.13, 0.047, 0.052, -0.008],
  [0.25, 0.036, 0.038], [0.33, 0.03, 0.033], [0.36, 0.028, 0.032], [0.372, 0.012],
]

// 腳掌：腳骨會轉 -90° 令「向下」變成「向前」，b = 上下厚度
export const FOOT: LimbKey[] = [
  [-0.055, 0.012, 0.012, -0.04], [-0.045, 0.03, 0.033, -0.035], [0, 0.033, 0.04, -0.03],
  [0.07, 0.04, 0.03, -0.045], [0.14, 0.045, 0.02, -0.055], [0.175, 0.03, 0.013, -0.06], [0.185, 0.008, 0.006, -0.06],
]

// ---------- 頭（相對 head 骨，head 喺 y=1.43） ----------
const HEAD_Y = 1.43
export const HEAD_KEYS: Ring[] = [
  { y: 1.395, a: 0.02, b: 0.02, dz: 0.03 },
  { y: 1.41, a: 0.045, b: 0.06, dz: 0.02 },
  { y: 1.44, a: 0.062, b: 0.085, dz: 0.005 },
  { y: 1.48, a: 0.073, b: 0.095, dz: -0.002 },
  { y: 1.52, a: 0.075, b: 0.097, dz: -0.005 },
  { y: 1.56, a: 0.068, b: 0.088, dz: -0.008 },
  { y: 1.59, a: 0.045, b: 0.06, dz: -0.01 },
  { y: 1.605, a: 0.012, b: 0.015, dz: -0.01 },
].map((r) => ({ ...r, y: r.y - HEAD_Y }))

const NECK_KEYS: Ring[] = [
  { y: -0.035, a: 0.058, b: 0.056 },
  { y: 0, a: 0.052, b: 0.05 },
  { y: 0.04, a: 0.047, b: 0.048, dz: 0.006 },
  { y: 0.08, a: 0.042, b: 0.044, dz: 0.01 },
  { y: 0.095, a: 0.03, b: 0.03, dz: 0.01 },
]

function ellipsoid(rx: number, ry: number, rz: number, seg = 32) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75))
  g.scale(rx, ry, rz)
  return g
}

// ---------- 預先建好所有幾何 ----------
export const GEO = {
  // 基本人台：軀幹分三節
  pelvisBlock: loft(toPelvis([
    { y: 0.715, a: 0.03 }, { y: 0.735, a: 0.12, b: 0.08 }, { y: 0.84, a: 0.168, b: 0.108, dz: -0.012 },
    { y: 0.95, a: 0.14, b: 0.088 }, { y: 0.985, a: 0.06, b: 0.04 },
  ]), { radial: 48 }),
  abdomen: loft([
    { y: -0.065, a: 0.05 }, { y: -0.05, a: 0.115, b: 0.075 }, { y: 0.0, a: 0.124, b: 0.08 },
    { y: 0.045, a: 0.12, b: 0.078 }, { y: 0.058, a: 0.05 },
  ], { radial: 48 }),
  ribcage: loft([
    { y: -0.072, a: 0.06, b: 0.05 }, { y: -0.055, a: 0.13, b: 0.085 }, { y: 0.03, a: 0.148, b: 0.098, dz: 0.01 },
    { y: 0.11, a: 0.154, b: 0.078 }, { y: 0.16, a: 0.12, b: 0.06, dz: -0.01 }, { y: 0.19, a: 0.05, dz: -0.01 },
  ], { radial: 48 }),
  neck: loft(NECK_KEYS, { radial: 40 }),
  head: loft(HEAD_KEYS, { radial: 48, sub: 6 }),
  ear: ellipsoid(0.011, 0.028, 0.018, 20),
  upperArm: loft(limbRings(UPPER_ARM)),
  forearm: loft(limbRings(FOREARM)),
  hand: loft(limbRings(HAND)),
  thumb: new THREE.CapsuleGeometry(0.0095, 0.04, 6, 16),
  thigh: loft(limbRings(THIGH), { radial: 48 }),
  shin: loft(limbRings(SHIN), { radial: 48 }),
  foot: loft(limbRings(FOOT)),
  bust: ellipsoid(0.056, 0.052, 0.044),
  joint: new THREE.SphereGeometry(1, 24, 16),

  // ---------- 少女：基本衣物（日後 DLC 衣服用同一方法加） ----------
  braCup: ellipsoid(0.06, 0.056, 0.047),
  briefsLeg: loft(shell(limbRings(THIGH), -0.075, -0.0, 0.005, 4), { radial: 48, capBottom: false, capTop: false }),
}

function strap(points: [number, number, number][]) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1] - PELVIS_Y, p[2])))
  return new THREE.TubeGeometry(curve, 32, 0.0035, 8, false)
}
export const STRAP_L = strap([
  [0.055, 1.18, 0.112], [0.08, 1.26, 0.083], [0.09, 1.335, 0.05], [0.09, 1.36, 0.0],
  [0.09, 1.335, -0.06], [0.08, 1.24, -0.098], [0.07, 1.12, -0.098],
])
export const STRAP_R = strap([
  [-0.055, 1.18, 0.112], [-0.08, 1.26, 0.083], [-0.09, 1.335, 0.05], [-0.09, 1.36, 0.0],
  [-0.09, 1.335, -0.06], [-0.08, 1.24, -0.098], [-0.07, 1.12, -0.098],
])
