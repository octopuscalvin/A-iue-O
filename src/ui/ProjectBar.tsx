import { useEffect, useRef, useState } from 'react'
import {
  applySnapshot, clearShareHash, isSnapshot, pieceCount, readShareFromHash, shareUrl, takeSnapshot, useProjects, type Snapshot,
} from '../project/projectStore'
import { buildBlueprint } from '../project/blueprint'
import { PRICE_ITEMS, priceOf, usePrices, type PriceKey } from '../jewelry/pricing'
import { useDesigns } from '../jewelry/designStore'
import { useAcc } from '../jewelry/accStore'
import { isRingZone } from '../jewelry/types'
import { isAccZone } from '../jewelry/accessory'
import { download } from './controls'

type Modal = null | 'projects' | 'prices' | 'blueprint'

function Projects({ onClose }: { onClose: () => void }) {
  const p = useProjects()
  const [name, setName] = useState(p.currentName)
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 2500)
  }
  const copyShare = async () => {
    const url = shareUrl(name || '分享作品')
    try {
      await navigator.clipboard.writeText(url)
      flash('已複製分享連結')
    } catch {
      prompt('複製呢條連結：', url)
    }
  }
  const importFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text())
      if (isSnapshot(data)) {
        p.backup()
        applySnapshot(data)
        flash('已匯入成套作品')
        return
      }
      // 單件設計檔（由編輯器「匯出設計檔」嚟）
      if (data?.zone && data?.design) {
        if (isRingZone(data.zone)) useDesigns.setState((s) => ({ designs: { ...s.designs, [data.zone]: data.design } }))
        else if (isAccZone(data.zone)) useAcc.setState((s) => ({ designs: { ...s.designs, [data.zone]: data.design } }))
        else throw new Error()
        flash('已匯入一件設計')
        return
      }
      throw new Error()
    } catch {
      flash('呢個檔案唔係首飾設計檔')
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header><h2>我的作品</h2><button className="x" onClick={onClose} aria-label="關閉">×</button></header>
        <p className="hint">「作品」= 而家所有部位嘅首飾 + 假人設定。設計本身會自動儲存，呢度係另外存一份有名嘅版本。</p>
        <div className="save-row">
          <input value={name} placeholder="作品名，例如：粉紅星星套裝" onChange={(e) => setName(e.target.value)} />
          <button className="primary small" onClick={() => (p.save(name), flash('已儲存'))}>儲存</button>
        </div>
        <div className="row-btns">
          <button className="ghost" onClick={copyShare}>複製分享連結</button>
          <button className="ghost" onClick={() => download(`${name || '作品'}.json`, takeSnapshot())}>匯出檔案</button>
          <button className="ghost" onClick={() => file.current?.click()}>匯入檔案</button>
          <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </div>
        {msg && <p className="flash">{msg}</p>}
        <h3>已儲存（{p.projects.length}）</h3>
        <ul className="plist">
          {p.projects.length === 0 && <li className="empty">未有儲存嘅作品</li>}
          {p.projects.map((x) => (
            <li key={x.id}>
              <div>
                <b>{x.name}</b>
                <small>{new Date(x.savedAt).toLocaleString('zh-HK', { hour12: false })} · {pieceCount(x.snapshot)} 件</small>
              </div>
              <button className="ghost" onClick={() => confirm(`載入「${x.name}」？目前設計會先自動備份。`) && (p.load(x.id), onClose())}>載入</button>
              <button className="ghost danger" onClick={() => confirm(`刪除「${x.name}」？`) && p.remove(x.id)}>刪除</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Prices({ onClose }: { onClose: () => void }) {
  const { prices, set, reset } = usePrices()
  const groups = [...new Set(Object.values(PRICE_ITEMS).map((i) => i.group))]
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header><h2>報價設定（港幣）</h2><button className="x" onClick={onClose} aria-label="關閉">×</button></header>
        <p className="hint">預設值只係參考，請按你實際入貨價同人工修改。改完所有零件清單同生產藍圖會即時更新。</p>
        {groups.map((g) => (
          <div key={g} className="pgroup">
            <h3>{g}</h3>
            {(Object.keys(PRICE_ITEMS) as PriceKey[]).filter((k) => PRICE_ITEMS[k].group === g).map((k) => (
              <label key={k} className="prow">
                <span>{PRICE_ITEMS[k].label}</span>
                <input
                  type="number" min={0} step={k === 'margin' ? 0.1 : 0.5}
                  value={priceOf(prices, k)}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (!Number.isNaN(v) && v >= 0) set(k, v)
                  }}
                />
              </label>
            ))}
          </div>
        ))}
        <button className="ghost" onClick={() => confirm('還原所有預設價錢？') && reset()}>還原預設</button>
      </div>
    </div>
  )
}

/** 生產藍圖：喺 App 入面預覽，可以列印 / 另存 PDF / 下載 */
function Blueprint({ name, onClose }: { name: string; onClose: () => void }) {
  const [html] = useState(() => buildBlueprint(name))
  const frame = useRef<HTMLIFrameElement>(null)
  const downloadHtml = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    a.download = `生產藍圖-${name}.html`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  return (
    <div className="bp-overlay">
      <div className="bp-bar">
        <b>生產藍圖 · {name}</b>
        <button className="primary small" onClick={() => frame.current?.contentWindow?.print()}>列印 / 另存 PDF</button>
        <button className="ghost" onClick={downloadHtml}>下載</button>
        <button className="ghost" onClick={onClose}>關閉</button>
      </div>
      <iframe ref={frame} title="生產藍圖" srcDoc={html} />
    </div>
  )
}

/** 收到分享連結：問用家要唔要載入 */
function ShareBanner() {
  const [share, setShare] = useState<{ name: string; snapshot: Snapshot } | null>(null)
  useEffect(() => setShare(readShareFromHash()), [])
  if (!share) return null
  const close = () => (clearShareHash(), setShare(null))
  return (
    <div className="share-banner">
      <span>收到分享作品「{share.name}」（{pieceCount(share.snapshot)} 件），要載入嗎？目前設計會先自動備份。</span>
      <button className="primary small" onClick={() => (useProjects.getState().backup(), applySnapshot(share.snapshot), close())}>載入</button>
      <button className="ghost" onClick={close}>唔要</button>
    </div>
  )
}

export function ProjectBar() {
  const [modal, setModal] = useState<Modal>(null)
  const name = useProjects((s) => s.currentName)
  return (
    <>
      <div className="projectbar">
        <button onClick={() => setModal('projects')}>📁 作品{name ? `：${name}` : ''}</button>
        <button onClick={() => setModal('blueprint')}>📄 生產藍圖</button>
        <button onClick={() => setModal('prices')}>💲 報價設定</button>
      </div>
      <ShareBanner />
      {modal === 'projects' && <Projects onClose={() => setModal(null)} />}
      {modal === 'prices' && <Prices onClose={() => setModal(null)} />}
      {modal === 'blueprint' && <Blueprint name={name || '未命名作品'} onClose={() => setModal(null)} />}
    </>
  )
}
