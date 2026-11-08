import { useApp } from '../store'
import { ZONES } from '../body/zones'
import { girthOf, useBody } from '../body/bodyProfile'
import { cameraApi } from '../scene/Stage'
import { BomTable, CharmTags, Palette, ShapeIcon, Slider, Swatches, download } from './controls'
import { useDesigns } from '../jewelry/designStore'
import { computeBom } from '../jewelry/bom'
import {
  BASES, CHARM_CATEGORIES, JEWELRY, SHAPES, baseHint, baseLabel, fitOf, innerLengthCm, isRingZone, isThreaded,
  type RingZone,
} from '../jewelry/types'

/** 部位圍度嘅叫法 */
const GIRTH_NAME: Record<string, string> = { bracelet: '手腕', anklet: '腳腕', armlet: '上臂', necklace: '頸圍' }

export function JewelryEditor() {
  const zone = useApp((s) => s.zone)
  const st = useDesigns()
  const body = useBody((s) => s.profile)
  if (!isRingZone(zone)) return null
  const z: RingZone = zone
  const j = JEWELRY[z]
  const d = st.designs[z]
  const label = ZONES[z].label
  const girth = Math.round(girthOf(body, z) * 10) / 10
  const pair = j.pair
  const isNeck = j.kind === 'necklace'

  const header = (
    <header className="ed-head">
      <button className="back" onClick={() => cameraApi.reset()} aria-label="返回全身">‹</button>
      <div>
        <h1>{j.name}設計</h1>
        <p>{label} · {GIRTH_NAME[j.kind]} {girth} cm</p>
      </div>
    </header>
  )

  if (!d) {
    return (
      <aside className="editor">
        {header}
        <div className="empty">
          <p>
            由「底座」開始（{j.bases.map((b) => baseLabel(z, b)).join('、')}），再加可愛配件。
            {isNeck ? '揀長度款式，條鏈會自然垂落喺心口。' : `尺寸會跟${GIRTH_NAME[j.kind]}自動計好。`}
          </p>
          <button className="primary" onClick={() => st.start(z)}>開始設計{isNeck ? '' : label}{j.name}</button>
          {pair && st.designs[pair] && (
            <button className="ghost" onClick={() => st.mirror(pair)}>複製{ZONES[pair].label}嘅設計</button>
          )}
        </div>
      </aside>
    )
  }

  const base = BASES[d.base.type]
  const bom = computeBom(d, z, girth)
  const fit = fitOf(z, d)
  const sel = d.charms.find((c) => c.id === st.selected)

  return (
    <aside className="editor">
      {header}

      <section>
        <h2>① 底座</h2>
        <div className="chips">
          {j.bases.map((t) => (
            <button key={t} className={`chip ${d.base.type === t ? 'on' : ''}`} onClick={() => st.setBaseType(z, t)} title={baseHint(z, t)}>
              {baseLabel(z, t)}
            </button>
          ))}
        </div>
        <p className="hint">{baseHint(z, d.base.type)}</p>
        <Swatches categories={base.categories} value={d.base.material} onChange={(m) => st.setBase(z, { material: m })} />
        <Slider
          label={base.thick.label} min={base.thick.min} max={base.thick.max} step={base.thick.step}
          value={d.base.thickMm} unit="mm" onChange={(v) => st.setBase(z, { thickMm: v })}
        />
        <div className="fit">
          <span>{isNeck ? '長度' : '鬆緊'}</span>
          <div className="seg small" style={{ gridTemplateColumns: `repeat(${Object.keys(j.fits).length}, 1fr)` }}>
            {Object.entries(j.fits).map(([f, o]) => (
              <button key={f} className={fit === o ? 'on' : ''} onClick={() => st.setFit(z, f)} title={o.hint}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <p className="measure">
          {isNeck ? '鏈長' : '內圈長度'} <b>{(innerLengthCm(d, z, girth) * 10).toFixed(0)} mm</b>
          {fit.hint && <small>{fit.hint}</small>}
          {base.rigid && j.rigidNote && <small>{j.rigidNote}</small>}
        </p>
      </section>

      <section>
        <h2>② 配件 <small>撳一下加入，喺 3D 入面可以拖動位置</small></h2>
        <Palette onAdd={(id) => st.addCharm(z, id)} />
        <CharmTags charms={d.charms} selected={st.selected} onSelect={st.select} />
        {sel && (
          <div className="charm-edit">
            <div className="ce-title">
              <ShapeIcon id={sel.shape} size={18} />
              <b>{SHAPES[sel.shape].label}</b>
              <small>{isThreaded(sel, d.base.type) ? '穿喺底座上' : '用開口圈吊住'}</small>
            </div>
            <Swatches categories={CHARM_CATEGORIES} value={sel.material} onChange={(m) => st.updateCharm(z, sel.id, { material: m })} />
            <Slider
              label="大小" min={SHAPES[sel.shape].min} max={SHAPES[sel.shape].max} step={0.5}
              value={sel.sizeMm} unit="mm" onChange={(v) => st.updateCharm(z, sel.id, { sizeMm: v })}
            />
            <Slider
              label="位置" min={0} max={359} step={1}
              value={Math.round(sel.t * 360) % 360} unit="°" onChange={(v) => st.updateCharm(z, sel.id, { t: v / 360 })}
            />
            <div className="row-btns">
              <button className="ghost" onClick={() => st.duplicateCharm(z, sel.id)}>複製</button>
              <button className="ghost danger" onClick={() => st.removeCharm(z, sel.id)}>刪除</button>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2>③ 零件清單同報價 <small>交俾師傅用</small></h2>
        <BomTable bom={bom} charmCount={d.charms.length} />
      </section>

      <section className="actions">
        {pair && <button className="ghost" onClick={() => st.mirror(z)}>複製去{ZONES[pair].label}</button>}
        <button
          className="ghost"
          onClick={() => download(`${j.name}-${label}.json`, { zone: z, kind: j.kind, girthCm: girth, design: d, innerLengthMm: bom.innerCm * 10, bom: bom.rows, totalWeightG: bom.totalG })}
        >
          匯出設計檔
        </button>
        <button className="ghost danger" onClick={() => confirm(`確定刪除呢件${j.name}設計？`) && st.remove(z)}>刪除設計</button>
      </section>
    </aside>
  )
}
