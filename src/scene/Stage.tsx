import { useEffect, useRef, type ElementRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, ContactShadows, Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { useApp } from '../store'
import { Mannequin, predictSocketWorld } from '../body/Mannequin'
import { ZONES, type ZoneId } from '../body/zones'

type Controls = ElementRef<typeof CameraControls>

/** 畀介面按鈕用：轉去正面 / 側面 / 背面 */
export const cameraApi = {
  controls: null as Controls | null,
  /** 截圖用（生產藍圖） */
  three: null as { gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera } | null,
  snapshot(): string | null {
    const t = this.three
    if (!t) return null
    t.gl.render(t.scene, t.camera)
    return t.gl.domElement.toDataURL('image/png')
  },
  orbit(az: number) {
    const c = this.controls
    if (!c) return
    const z = ZONES[useApp.getState().zone]
    c.rotateTo(az, z.polar, true)
  },
  reset() {
    useApp.getState().setZone('full')
    focusZone('full', true)
  },
}

const FULL_TARGET = new THREE.Vector3(0, 0.86, 0)
const tmp = new THREE.Vector3()

function zoneTarget(id: ZoneId, out: THREE.Vector3) {
  if (id === 'full') return out.copy(FULL_TARGET)
  return predictSocketWorld(id, out) ?? out.copy(FULL_TARGET)
}

function focusZone(id: ZoneId, smooth: boolean) {
  const c = cameraApi.controls
  if (!c) return
  const z = ZONES[id]
  const p = zoneTarget(id, new THREE.Vector3())
  const off = new THREE.Vector3().setFromSphericalCoords(z.dist, z.polar, z.az)
  c.setLookAt(p.x + off.x, p.y + off.y, p.z + off.z, p.x, p.y, p.z, smooth)
}

/** 鏡頭：360° 自由旋轉；揀咗部位就飛過去，並一路跟住嗰個掛點 */
function FocusCamera() {
  const three = useThree()
  cameraApi.three = { gl: three.gl, scene: three.scene, camera: three.camera }
  const ref = useRef<Controls>(null)
  const zone = useApp((s) => s.zone)
  const last = useRef(new THREE.Vector3())

  useEffect(() => {
    cameraApi.controls = ref.current
    focusZone('full', false)
  }, [])

  useEffect(() => {
    focusZone(zone, true)
    zoneTarget(zone, last.current)
  }, [zone])

  // 假人轉姿勢（例如舉起手）時，鏡頭中心會跟住掛點移動
  useFrame(() => {
    if (zone === 'full' || !ref.current) return
    zoneTarget(zone, tmp)
    if (tmp.distanceTo(last.current) > 0.0004) {
      ref.current.moveTo(tmp.x, tmp.y, tmp.z, true)
      last.current.copy(tmp)
    }
  })

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={0.12}
      maxDistance={7}
      smoothTime={0.32}
      draggingSmoothTime={0.08}
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
    />
  )
}

export function Stage() {
  return (
    <Canvas
      camera={{ fov: 35, near: 0.01, far: 50, position: [1, 1.2, 3] }}
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <color attach="background" args={['#f6eef1']} />
      <hemisphereLight args={['#ffffff', '#e8d6dc', 0.55]} />
      <directionalLight position={[2, 4, 3]} intensity={1.3} />
      <directionalLight position={[-3, 2, -2]} intensity={0.45} color="#ffe6ef" />

      {/* 本地生成嘅「影樓燈箱」環境光，令金屬有靚反光（唔使上網下載） */}
      <Environment resolution={256} frames={1}>
        {/* 環境底色：令金屬喺任何角度都有柔和反光，唔會變黑 */}
        <color attach="background" args={['#cdbec4']} />
        <Lightformer form="rect" intensity={0.9} position={[0, 1.2, 5]} rotation-y={Math.PI} scale={[6, 3, 1]} color="#fff4f7" />
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 1]} rotation-x={Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[-4, 1.5, 1]} rotation-y={Math.PI / 2} scale={[4, 1.2, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[4, 1.5, -1]} rotation-y={-Math.PI / 2} scale={[4, 1.2, 1]} />
        <Lightformer form="ring" intensity={1.2} color="#ffd1e0" position={[0, 1, -4]} scale={2.5} />
        <Lightformer form="rect" intensity={0.6} position={[0, -2, 0]} rotation-x={-Math.PI / 2} scale={[6, 6, 1]} color="#f3dde4" />
      </Environment>

      <Mannequin />

      <mesh rotation-x={-Math.PI / 2} position={[0, -0.001, 0]}>
        <circleGeometry args={[0.55, 64]} />
        <meshStandardMaterial color="#efe2e7" roughness={0.9} />
      </mesh>
      <ContactShadows position={[0, 0.0005, 0]} opacity={0.4} scale={2} blur={2.4} far={1.2} resolution={512} />

      <FocusCamera />
    </Canvas>
  )
}
