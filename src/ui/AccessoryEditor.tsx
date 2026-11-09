import { useEffect } from 'react'
import { useApp } from '../store'
import { ZONES } from '../body/zones'
import { useBody } from '../body/bodyProfile'
import { cameraApi } from '../scene/Stage'
import { useAcc } from '../jewelry/accStore'
import {
  CLIP_LENGTH_MM, CLIP_Z_RANGE, EAR_SPOTS, EAR_STYLES, HEAD_CATEGORIES, earSpot, HEAD_STYLES, earBom, headBom, headbandLengthMm, isAccZone,
  type AccZone, type EarSpot, type EarStyle, type HeadStyle,
} from '../jewelry/accessory'
import { CHARM_CATEGORIES, SHAPES } from '../jewelry/types'
import { BomTable, CharmTags, Palette, ShapeIcon, Slider, Swatches, download } from './controls'

/** 撳耳仔設定 ①②③ 位置 */
function SpotSetter({ z, spot }: { z: 'earL' | 'earR'; spot: EarSpot }) {
  const placing = useApp((s) => s.placingSpot)
  const setPlacing = useApp((s) => s.setPlacingSpot)
  const reset = useApp((s) => s.resetEarSpots)
  const src = useBody((s) => s.profile.key ?? s.profile.source)
  const hasCustom = useApp((s) => (s.earSpotCustom[src]?.[z] ?? []).some(Boolean))
  useEffect(() => {
    document.body.style.cursor = placing ? 'crosshair' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [placing])
  // 離開耳仔就取消設定模式
  useEffect(() => () => setPlacing(null), [setPlacing])
  return (
    <div className="spot-setter">
      {placing ? (
        <p className="placing-hint">
          而家喺 3D 入面<b>撳耳仔上面</b>你想要嘅 {EAR_SPOTS[placing].label} 位置（兩隻耳會一齊改）
          <button className="link" onClick={() => setPlacing(null)}>取消</button>
        </p>
      ) : (
        <div className="row-btns">
          <button className="ghost" onClick={() => setPlacing(spot)}>✎ 撳耳仔設定 {EAR_SPOTS[spot].label.slice(0, 1)} 位置</button>
          {hasCustom && <button className="ghost" onClick={() => confirm('還原 ①②③ 嘅預設位置？') && reset(src)}>還原預設</button>}
        </div>
      )}
    </div>
  )
}

/** 耳環同頭飾編輯器 */
export function AccessoryEditor() {
  const zone = useApp((s) => s.zone)
  const st = useAcc()
  const arc = useBody((s) => s.profile.headArc)
  if (!isAccZone(zone)) return null
  const z: AccZone = zone
  const d = st.designs[z]
  const isHead = z === 'head'
  const name = isHead ? '頭飾' : '耳環'
  const other: AccZone | null = z === 'earL' ? 'earR' : z === 'earR' ? 'earL' : null

  const header = (
    <header className="ed-head">
      <button className="back" onClick={() => cameraApi.reset()} aria-label="返回全身">‹</button>
      <div>
        <h1>{name}設計</h1>
        <p>{ZONES[z].label}</p>
      </div>
    </header>
  )

  if (!d) {
    return (
      <aside className="editor">
        {header}
        <div className="empty">
          <p>
            {isHead
              ? '揀髮箍或者髮夾，再黏上可愛配件。髮箍長度會跟頭形自動計。'
              : '揀耳釘、耳圈或者吊墜耳環，再加配件。做好一邊可以一鍵複製去另一邊。'}
          </p>
          <button className="primary" onClick={() => st.start(z)}>開始設計{isHead ? '' : ZONES[z].label}{name}</button>
          {other && st.designs[other] && (
            <button className="ghost" onClick={() => st.mirror(other)}>複製{ZONES[other].label}嘅設計</button>
          )}
        </div>
      </aside>
    )
  }

  const arcMm = headbandLengthMm(arc.rx, arc.ry)
  const bom = d.kind === 'head' ? headBom(d, arcMm) : earBom(d)
  const sel = d.charms.find((c) => c.id === st.selected)
  const posLabel = d.kind === 'earring' ? '位置' : '位置'

  return (
    <aside className="editor">
      {header}

      <section>
        <h2>① 款式</h2>
        {d.kind === 'earring' ? (
          <>
            <div className="chips">
              {(Object.keys(EAR_STYLES) as EarStyle[]).map((s) => (
                <button key={s} className={`chip ${d.style === s ? 'on' : ''}`} onClick={() => st.update(z, { style: s, spot: undefined })}>
                  {EAR_STYLES[s].label}
                </button>
              ))}
            </div>
            <p className="hint">{EAR_STYLES[d.style].hint}</p>
            <div className="fit spot">
              <span>位置</span>
              <div className="seg small">
                {([1, 2, 3] as EarSpot[]).map((n) => (
                  <button key={n} className={earSpot(d) === n ? 'on' : ''} title={EAR_SPOTS[n].hint} onClick={() => st.update(z, { spot: n })}>
                    {EAR_SPOTS[n].label}
                  </button>
                ))}
              </div>
            </div>
            <SpotSetter z={z as 'earL' | 'earR'} spot={earSpot(d)} />
            <Swatches categories={['metal']} value={d.metal} onChange={(m) => st.update(z, { metal: m })} />
            {d.style === 'hoop' && (
              <>
                <Slider label="直徑" min={10} max={40} step={1} value={d.hoopDiaMm} unit="mm" onChange={(v) => st.update(z, { hoopDiaMm: v })} />
                <Slider label="線徑" min={0.8} max={2.5} step={0.1} value={d.wireMm} unit="mm" onChange={(v) => st.update(z, { wireMm: v })} />
              </>
            )}
            {d.style === 'cuff' && (
              <>
                <Slider label="直徑" min={6} max={12} step={0.5} value={d.cuffDiaMm ?? 8} unit="mm" onChange={(v) => st.update(z, { cuffDiaMm: v })} />
                <Slider label="線徑" min={0.8} max={2} step={0.1} value={d.wireMm} unit="mm" onChange={(v) => st.update(z, { wireMm: v })} />
              </>
            )}
            {d.style === 'drop' && (
              <Slider label="鏈長" min={0} max={45} step={1} value={d.dropLenMm} unit="mm" onChange={(v) => st.update(z, { dropLenMm: v })} />
            )}
          </>
        ) : (
          <>
            <div className="chips">
              {(Object.keys(HEAD_STYLES) as HeadStyle[]).map((s) => (
                <button
                  key={s}
                  className={`chip ${d.style === s ? 'on' : ''}`}
                  onClick={() => st.update(z, { style: s, widthMm: HEAD_STYLES[s].width.def })}
                >
                  {HEAD_STYLES[s].label}
                </button>
              ))}
            </div>
            <p className="hint">{HEAD_STYLES[d.style].hint}</p>
            <Swatches categories={HEAD_CATEGORIES} value={d.material} onChange={(m) => st.update(z, { material: m })} />
            <Slider
              label="闊度" min={HEAD_STYLES[d.style].width.min} max={HEAD_STYLES[d.style].width.max} step={1}
              value={d.widthMm} unit="mm" onChange={(v) => st.update(z, { widthMm: v })}
            />
            {d.style === 'clip' && (
              <>
                <Slider label="夾喺" min={0} max={100} step={1} value={Math.round(d.clipT * 100)} unit="%" onChange={(v) => st.update(z, { clipT: v / 100 })} />
                <Slider label="前後" min={-CLIP_Z_RANGE} max={CLIP_Z_RANGE} step={1} value={d.clipZ ?? 0} unit="mm" onChange={(v) => st.update(z, { clipZ: v })} />
              </>
            )}
            <p className="measure">
              {d.style === 'headband' ? <>髮箍長度 <b>{arcMm.toFixed(0)} mm</b><small>由左耳上面跨過頭頂去右耳上面</small></> : <>髮夾 <b>{CLIP_LENGTH_MM} × {d.widthMm} mm</b><small>夾喺：0% = 左耳上面 · 50% = 頭頂 · 100% = 右耳上面<br />前後：正數向前（額頭）、負數向後（後腦）</small></>}
            </p>
          </>
        )}
      </section>

      <section>
        <h2>
          ② 配件{' '}
          <small>
            {d.kind === 'earring'
              ? d.style === 'stud' ? '撳一下就係耳釘面' : d.style === 'drop' ? '一件接一件吊落去' : d.style === 'cuff' ? '吊喺夾外面' : '掛喺耳圈上面'
              : '黏喺上面，撳 3D 配件都可以揀'}
          </small>
        </h2>
        <Palette onAdd={(id) => st.addCharm(z, id)} />
        <CharmTags charms={d.charms} selected={st.selected} onSelect={st.select} />
        {sel && (
          <div className="charm-edit">
            <div className="ce-title">
              <ShapeIcon id={sel.shape} size={18} />
              <b>{SHAPES[sel.shape].label}</b>
            </div>
            <Swatches categories={CHARM_CATEGORIES} value={sel.material} onChange={(m) => st.updateCharm(z, sel.id, { material: m })} />
            <Slider
              label="大小" min={SHAPES[sel.shape].min} max={d.kind === 'earring' ? 14 : SHAPES[sel.shape].max} step={0.5}
              value={sel.sizeMm} unit="mm" onChange={(v) => st.updateCharm(z, sel.id, { sizeMm: v })}
            />
            {d.kind === 'earring' && d.style === 'hoop' && (
              <Slider label={posLabel} min={0} max={359} step={1} value={Math.round(sel.t * 360) % 360} unit="°" onChange={(v) => st.updateCharm(z, sel.id, { t: v / 360 })} />
            )}
            {d.kind === 'head' && (
              <Slider label={posLabel} min={0} max={100} step={1} value={Math.round(sel.t * 100)} unit="%" onChange={(v) => st.updateCharm(z, sel.id, { t: v / 100 })} />
            )}
            <div className="row-btns">
              <button className="ghost" onClick={() => st.duplicateCharm(z, sel.id)}>複製</button>
              <button className="ghost danger" onClick={() => st.removeCharm(z, sel.id)}>刪除</button>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2>③ 零件清單同報價 <small>{isHead ? '' : '一隻耳環'}</small></h2>
        <BomTable bom={bom} charmCount={d.charms.length} />
      </section>

      <section className="actions">
        {other && <button className="ghost" onClick={() => st.mirror(z)}>複製去{ZONES[other].label}</button>}
        <button className="ghost" onClick={() => download(`${name}-${ZONES[z].label}.json`, { zone: z, design: d, bom: bom.rows, totalWeightG: bom.totalG })}>
          匯出設計檔
        </button>
        <button className="ghost danger" onClick={() => confirm(`確定刪除呢件${name}設計？`) && st.remove(z)}>刪除設計</button>
      </section>
    </aside>
  )
}
