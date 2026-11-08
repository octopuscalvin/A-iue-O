import { loft, shell, type Ring } from './loft'
import { TORSO_KEYS, toPelvis } from './shapes'

/** 三圍（cm）。假人預設：胸 82 / 腰 62 / 臀 88 */
export interface Figure {
  bust: number
  waist: number
  hip: number
}

export const DEFAULT_FIGURE: Figure = { bust: 82, waist: 62, hip: 88 }

export const FIGURE_RANGE: Record<keyof Figure, { min: number; max: number; label: string }> = {
  bust: { min: 72, max: 100, label: '胸圍' },
  waist: { min: 54, max: 80, label: '腰圍' },
  hip: { min: 78, max: 104, label: '臀圍' },
}

const bell = (y: number, c: number, s: number) => Math.exp(-(((y - c) / s) ** 2))

/** 某個高度嘅放大倍數：胸、腰、臀各自影響佢附近嘅身體，之間平滑過渡 */
export function girthScale(f: Figure, y: number) {
  return (
    1 +
    bell(y, 1.15, 0.05) * (f.bust / DEFAULT_FIGURE.bust - 1) +
    bell(y, 1.0, 0.045) * (f.waist / DEFAULT_FIGURE.waist - 1) +
    bell(y, 0.84, 0.065) * (f.hip / DEFAULT_FIGURE.hip - 1)
  )
}

export function torsoKeysFor(f: Figure): Ring[] {
  return TORSO_KEYS.map((k) => {
    const s = girthScale(f, k.y)
    return { ...k, a: k.a * s, b: (k.b ?? k.a) * s }
  })
}

/** 胸部大小（倍數）同位置（相對 pelvis 骨，pelvis 喺 y=0.95） */
export function bustParams(f: Figure) {
  const k = f.bust / DEFAULT_FIGURE.bust
  return {
    scale: k,
    pos: (s: 1 | -1): [number, number, number] => [0.052 * s * k, 1.14 - 0.95, 0.075 + 0.1 * (k - 1)],
    /** 胸部橢球半徑（未乘倍數） */
    radii: [0.056, 0.052, 0.044] as const,
  }
}

/** 按三圍重新生成軀幹同貼身衣物 */
export function buildTorso(f: Figure) {
  const keys = torsoKeysFor(f)
  const b = bustParams(f)
  return {
    torso: loft(toPelvis(keys), { radial: 56, sub: 6 }),
    braBand: loft(toPelvis(shell(keys, 1.085, 1.13, 0.004)), { radial: 56, capBottom: false, capTop: false }),
    briefs: loft(toPelvis(shell(keys, 0.705, 0.9, 0.004, 12)), { radial: 56, capTop: false }),
    /** 胸部大小同位置跟胸圍變 */
    bustScale: b.scale,
    bustPos: b.pos,
  }
}
