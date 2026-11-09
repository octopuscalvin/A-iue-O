import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useApp } from '../store'
import { useBody } from '../body/bodyProfile'
import type { V3 } from '../body/skeleton'
import { useAcc } from './accStore'
import { earSpot, type EarSpot } from './accessory'

/**
 * 耳仔 ①②③ 位置：
 * - 預設由耳仔形狀計（見 VrmMannequin / bodyProfile）
 * - 用家可以喺 App 入面撳耳仔自己設定，兩隻耳一齊改（左右對稱）
 * 全部係「相對 ① 耳掛點」嘅偏移（米，頭部座標）
 */
const ZERO: V3 = [0, 0, 0]

export function useEarSpots(zone: 'earL' | 'earR'): V3[] {
  const profile = useBody((s) => s.profile)
  const custom = useApp((s) => s.earSpotCustom[profile.key ?? profile.source]?.[zone])
  return [0, 1, 2].map((i) => custom?.[i] ?? profile.earSpots?.[zone]?.[i] ?? ZERO)
}

const LABEL = ['①', '②', '③']

/** 耳仔上面顯示 ①②③，撳一下就用嗰個位置 */
export function EarSpotMarkers({ zone }: { zone: 'earL' | 'earR' }) {
  const spots = useEarSpots(zone)
  const d = useAcc((s) => s.designs[zone])
  const update = useAcc((s) => s.update)
  const placing = useApp((s) => s.placingSpot)
  const current = d?.kind === 'earring' ? earSpot(d) : null
  return (
    <>
      {spots.map((p, i) => (
        <Html key={i} position={p} center zIndexRange={[20, 0]}>
          <button
            className={`ear-spot ${current === i + 1 ? 'on' : ''} ${placing === i + 1 ? 'placing' : ''}`}
            title={`用 ${LABEL[i]} 位置`}
            onClick={() => d?.kind === 'earring' && update(zone, { spot: (i + 1) as EarSpot })}
          >
            {LABEL[i]}
          </button>
        </Html>
      ))}
    </>
  )
}

/**
 * 設定模式：撳耳仔表面，將而家揀緊嘅位置搬去嗰度。
 * socket = 呢隻耳嘅 ① 耳掛點（座標以佢為準）
 */
export function placeEarSpot(e: ThreeEvent<PointerEvent>, sockets: Map<string, THREE.Object3D>) {
  const app = useApp.getState()
  const n = app.placingSpot
  const zone = app.zone
  if (!n || (zone !== 'earL' && zone !== 'earR')) return false
  const sock = sockets.get(zone)
  if (!sock) return false
  e.stopPropagation()
  const side = zone === 'earL' ? 1 : -1
  const local = sock.worldToLocal(e.point.clone())
  local.x -= 0.0015 * side // 向內少少：耳針穿過耳仔
  const v = local.toArray() as V3
  const prof = useBody.getState().profile
  const src = prof.key ?? prof.source
  app.setEarSpot(src, zone, n - 1, v)
  app.setEarSpot(src, zone === 'earL' ? 'earR' : 'earL', n - 1, [-v[0], v[1], v[2]])
  const d = useAcc.getState().designs[zone]
  if (d?.kind === 'earring') useAcc.getState().update(zone, { spot: n })
  app.setPlacingSpot(null)
  document.body.style.cursor = ''
  return true
}
