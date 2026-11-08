import { CATEGORY_LABEL, MATERIALS, MATERIAL_MAP, type MaterialCategory } from '../materials/library'
import { SHAPE_SVG, type ShapeId } from '../jewelry/charms'
import type { Bom } from '../jewelry/bom'
import { hkd, quoteOf, rowCost, usePrices } from '../jewelry/pricing'
import { SHAPES, SHAPE_ORDER, type CharmSpec } from '../jewelry/types'

/** 共用嘅編輯器小元件 */

export function ShapeIcon({ id, size = 22 }: { id: ShapeId; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d={SHAPE_SVG[id]} fill="currentColor" />
    </svg>
  )
}

export function Swatches({ categories, value, onChange }: { categories: MaterialCategory[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="swatches">
      {categories.map((cat) => (
        <div key={cat} className={`swrow ${categories.length === 1 ? 'single' : ''}`}>
          {categories.length > 1 && <span>{CATEGORY_LABEL[cat]}</span>}
          <div>
            {MATERIALS.filter((m) => m.category === cat).map((m) => (
              <button
                key={m.id}
                className={`sw-dot ${m.clear ? 'clear' : ''} ${m.category === 'metal' ? 'metal' : ''} ${value === m.id ? 'on' : ''}`}
                style={{ '--c': m.swatch } as React.CSSProperties}
                title={m.name}
                aria-label={m.name}
                onClick={() => onChange(m.id)}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="swname">{MATERIAL_MAP[value]?.name}</div>
    </div>
  )
}

export function Slider({ label, min, max, step, value, unit, onChange }: {
  label: string; min: number; max: number; step: number; value: number; unit: string; onChange: (v: number) => void
}) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>
        {value}
        {unit}
      </output>
    </label>
  )
}

export function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** 配件選擇板 */
export function Palette({ onAdd }: { onAdd: (id: ShapeId) => void }) {
  return (
    <div className="palette">
      {SHAPE_ORDER.map((id) => (
        <button key={id} onClick={() => onAdd(id)} title={`加入${SHAPES[id].label}`}>
          <ShapeIcon id={id} />
          <span>{SHAPES[id].label}</span>
        </button>
      ))}
    </div>
  )
}

/** 已加入嘅配件（撳一下揀） */
export function CharmTags({ charms, selected, onSelect }: { charms: CharmSpec[]; selected: string | null; onSelect: (id: string | null) => void }) {
  if (!charms.length) return null
  return (
    <div className="charm-list">
      {charms.map((c, i) => (
        <button
          key={c.id}
          className={`charm-tag ${selected === c.id ? 'on' : ''}`}
          style={{ '--c': MATERIAL_MAP[c.material]?.swatch } as React.CSSProperties}
          onClick={() => onSelect(selected === c.id ? null : c.id)}
        >
          <ShapeIcon id={c.shape} size={16} />
          {i + 1}
        </button>
      ))}
    </div>
  )
}

/** 零件清單 + 報價 */
export function BomTable({ bom, charmCount }: { bom: Bom; charmCount: number }) {
  const prices = usePrices((s) => s.prices)
  const q = quoteOf(bom.rows, charmCount, prices)
  return (
    <>
      {bom.warnings.length > 0 && (
        <ul className="warn">
          {bom.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      <table className="bom">
        <thead>
          <tr><th>零件</th><th>規格</th><th>數量</th><th>重量</th><th>成本</th></tr>
        </thead>
        <tbody>
          {bom.rows.map((r, i) => (
            <tr key={i}>
              <td>{r.part}<small>{r.material}</small></td>
              <td>{r.spec}</td>
              <td>×{r.qty}</td>
              <td>{r.weightG.toFixed(2)}g</td>
              <td>{hkd(rowCost(r, prices))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={3}>估算總重</td><td colSpan={2}>{bom.totalG.toFixed(1)}g</td></tr>
        </tfoot>
      </table>
      <div className="quote">
        <div><span>材料</span><b>{hkd(q.materials)}</b></div>
        <div><span>人工</span><b>{hkd(q.labor)}</b></div>
        <div><span>成本</span><b>{hkd(q.cost)}</b></div>
        <div className="sell"><span>建議售價</span><b>HK{hkd(q.suggested)}</b></div>
      </div>
    </>
  )
}
