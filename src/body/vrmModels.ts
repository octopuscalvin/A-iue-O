/**
 * 可以揀嘅 VRM 假人模型。加新模型：
 * 1. 將 .vrm 檔放入 public/models/
 * 2. 喺下面加一項
 * key：用嚟分開記住每個模型自己嘅設定（例如耳仔 ①②③ 位置）
 */
export interface VrmModelInfo {
  id: string
  name: string
  file: string
  key: string
}

export const VRM_MODELS: VrmModelInfo[] = [
  // 第一個模型沿用舊 key「vrm」，之前設定好嘅耳仔位置唔會唔見
  { id: 'sample', name: 'Sample Manequein', file: 'sample-mannequin.vrm', key: 'vrm' },
  { id: 'arisa', name: 'ありさ', file: 'arisa.vrm', key: 'vrm:arisa' },
]

export const vrmModel = (id: string) => VRM_MODELS.find((m) => m.id === id) ?? VRM_MODELS[0]
export const vrmUrl = (id: string) => `${import.meta.env.BASE_URL}models/${vrmModel(id).file}`
