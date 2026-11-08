import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Zone } from '../body/zones'
import { material } from '../materials/library'
import { CHARMS } from './charms'
import { girthOf, useBody } from '../body/bodyProfile'

/**
 * 「試戴示範」：證明每個掛點都會跟住骨頭郁。
 * 真正嘅首飾編輯器（底座 + 配件拼砌）係 P1 嘅工作。
 */

const tmpQ = new THREE.Quaternion()
const down = new THREE.Vector3()

/**
 * 吊墜：無論手點擺，都會滑去圈嘅最低點，並保持向下垂（模擬地心吸力）。
 * ring = 圈喺本地 XZ 平面嘅半徑。
 */
function Dangle({ children, ring }: { children: React.ReactNode; ring: [number, number] }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = ref.current
    if (!g?.parent) return
    g.parent.getWorldQuaternion(tmpQ).invert()
    down.set(0, -1, 0).applyQuaternion(tmpQ)
    const len = Math.hypot(down.x, down.z) || 1
    g.position.set((down.x / len) * ring[0], 0, (down.z / len) * ring[1])
    g.quaternion.copy(tmpQ)
  })
  return <group ref={ref}>{children}</group>
}

/** 小扣環 + 配件，掛喺 (0,0,0) 向下 */
function Charm({ geo, mat, ringMat = 'gold_polished' }: { geo: THREE.BufferGeometry; mat: string; ringMat?: string }) {
  return (
    <group>
      <mesh material={material(ringMat)} rotation={[0, Math.PI / 2, 0]} position={[0, -0.0025, 0]}>
        <torusGeometry args={[0.0028, 0.0007, 8, 24]} />
      </mesh>
      <mesh geometry={geo} material={material(mat)} position={[0, -0.0095, 0]} />
    </group>
  )
}

/** 由圍度(cm) + 餘量 → 戴喺身上嘅圈半徑（米） */
const ringRadius = (girthCm: number, slackCm: number) => (girthCm + slackCm) / 100 / (2 * Math.PI)

export function DemoPiece({ zone }: { zone: Zone }) {
  const beads = useMemo(() => Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2), [])
  // 示範首飾跟目前假人嘅圍度
  const body = useBody((b) => b.profile)
  const girth = zone.id === 'full' ? 15 : girthOf(body, zone.id)

  switch (zone.id) {
    case 'wristL':
    case 'wristR': {
      const r = ringRadius(girth, 2.2)
      return (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[0.86, 1.08, 1]} material={material('gold_polished')}>
            <torusGeometry args={[r, 0.0016, 12, 96]} />
          </mesh>
          <Dangle ring={[r * 0.86, r * 1.08]}>
            <Charm geo={CHARMS.star} mat="jelly_mint" />
          </Dangle>
        </group>
      )
    }
    case 'ankleL':
    case 'ankleR': {
      const r = ringRadius(girth, 2.5)
      return (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[0.95, 1.05, 1]} material={material('rose_gold')}>
            <torusGeometry args={[r, 0.0011, 10, 96]} />
          </mesh>
          {beads.map((a, i) => (
            <mesh key={i} position={[Math.sin(a) * r * 0.95, 0, Math.cos(a) * r * 1.05]} material={material('pearl')}>
              <sphereGeometry args={[0.0028, 16, 12]} />
            </mesh>
          ))}
        </group>
      )
    }
    case 'upperArmL':
    case 'upperArmR': {
      const r = ringRadius(girth, 0.6)
      return (
        <mesh material={material('silver_brushed')}>
          <cylinderGeometry args={[r, r, 0.012, 64, 1, true]} />
        </mesh>
      )
    }
    case 'neck':
      return (
        <group rotation={[0.42, 0, 0]} position={[0, 0.0, 0.012]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.05, 1.15, 1]} material={material('gold_polished')}>
            <torusGeometry args={[0.068, 0.0012, 10, 128]} />
          </mesh>
          <Dangle ring={[0.068 * 1.05, 0.068 * 1.15]}>
            <Charm geo={CHARMS.heart} mat="jelly_pink" />
          </Dangle>
        </group>
      )
    case 'earL':
    case 'earR':
      return (
        <group>
          <mesh rotation={[0, Math.PI / 2, 0]} position={[0, -0.007, 0]} material={material('gold_polished')}>
            <torusGeometry args={[0.007, 0.0009, 10, 48]} />
          </mesh>
          <mesh position={[0, -0.0155, 0]} material={material('pearl')}>
            <sphereGeometry args={[0.0032, 20, 14]} />
          </mesh>
        </group>
      )
    case 'head':
      return (
        <group position={[0, 0.015, 0.008]} rotation={[-0.32, 0, 0]}>
          <mesh scale={[1, 1.16, 1]} rotation={[0, 0, -0.06]} material={material('velvet_pink')}>
            <torusGeometry args={[0.088, 0.0045, 12, 96, Math.PI + 0.12]} />
          </mesh>
          <mesh position={[0.044, 0.09, 0.008]} rotation={[0, 0, -0.5]} material={material('gold_polished')} geometry={CHARMS.star} scale={1.3} />
        </group>
      )
    default:
      return null
  }
}
