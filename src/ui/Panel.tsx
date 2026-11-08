import { useApp, type BodyStyle } from '../store'
import { ZONE_GROUPS, ZONE_LIST, ZONES } from '../body/zones'
import { cameraApi } from '../scene/Stage'
import { FIGURE_RANGE, type Figure } from '../body/figure'
import { girthOf, useBody } from '../body/bodyProfile'
import { HAS_VRM } from '../body/VrmMannequin'
import { OUTFITS, OUTFIT_MAP, SLOT_LABEL, SLOT_ORDER } from '../body/outfits'

const STYLES: { id: BodyStyle; label: string; hint: string }[] = [
  { id: 'girl', label: '少女', hint: '著基本內衣，日後可加衣服' },
  { id: 'basic', label: '基本人台', hint: '分節人偶，睇清關節' },
  { id: 'vrm', label: 'VRM', hint: '由 VRoid 匯出嘅模型，尺寸自動量度' },
]

const TOGGLES = [
  { k: 'isolate', label: '專注模式', hint: '淡化無關身體部分' },
  { k: 'showSockets', label: '顯示掛點', hint: '撳身上嘅白點都可以聚焦' },
  { k: 'demoJewelry', label: '示範首飾', hint: '測試首飾會唔會跟住身體郁' },
  { k: 'showBones', label: '顯示骨架', hint: 'Blender 風格骨頭' },
] as const

export function Panel() {
  const s = useApp()
  const body = useBody((b) => b.profile)
  const vrm = s.style === 'vrm'
  const g = (z: Parameters<typeof girthOf>[1]) => `${girthOf(body, z).toFixed(1)} cm`
  /** VRM：同時顯示模型實際量度 */
  const m = (z: Parameters<typeof girthOf>[1]) =>
    body.source === 'vrm' && body.measuredGirthCm[z] !== body.girthCm[z] ? <small>（模型 {body.measuredGirthCm[z]?.toFixed(1)}）</small> : null
  return (
    <aside className="panel">
      <header className="brand">
        <div className="logo">✦</div>
        <div>
          <h1>首飾工作室</h1>
          <p>手鏈 · 腳鏈 · 臂環 · 頸鏈</p>
        </div>
      </header>

      <section>
        <h2>假人風格</h2>
        <div className={`seg ${HAS_VRM ? 'three' : ''}`}>
          {STYLES.filter((x) => HAS_VRM || x.id !== 'vrm').map((x) => (
            <button key={x.id} className={s.style === x.id ? 'on' : ''} onClick={() => s.setStyle(x.id)} title={x.hint}>
              {x.label}
            </button>
          ))}
        </div>
        {vrm && (
          <div className="vrm-opts">
            <div className="seg small two">
              <button className={s.vrmLook === 'mannequin' ? 'on' : ''} onClick={() => s.setVrmLook('mannequin')}>人台質感</button>
              <button className={s.vrmLook === 'original' ? 'on' : ''} onClick={() => s.setVrmLook('original')}>原本樣貌</button>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={s.vrmClothes} onChange={s.toggleVrmClothes} />
              <span className="sw" />
              <span>顯示衣服同鞋</span>
            </label>
            <div className="fit vrm-size" title="真人標準：可以直接交俾師傅生產；跟模型：喺模型上面最貼身">
              <span>首飾尺寸</span>
              <div className="seg small two">
                <button className={s.vrmSizing === 'standard' ? 'on' : ''} onClick={() => s.setVrmSizing('standard')}>真人標準</button>
                <button className={s.vrmSizing === 'model' ? 'on' : ''} onClick={() => s.setVrmSizing('model')}>跟模型</button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2>
          佩戴部位 <small>（以假人自己嘅左右計）</small>
        </h2>
        <button className={`zone full ${s.zone === 'full' ? 'on' : ''}`} onClick={() => cameraApi.reset()}>
          全身
        </button>
        {ZONE_GROUPS.map((g) => (
          <div key={g} className="zgroup">
            <span>{g}</span>
            <div className="zrow">
              {ZONE_LIST.filter((z) => z.group === g).map((z) => (
                <button key={z.id} className={`zone ${s.zone === z.id ? 'on' : ''}`} onClick={() => s.setZone(z.id)}>
                  {z.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {!vrm && <section>
        <h2 className="row">
          三圍 <small>（cm）</small>
          <button className="link" onClick={s.resetFigure}>重設</button>
        </h2>
        {(Object.keys(FIGURE_RANGE) as (keyof Figure)[]).map((k) => {
          const r = FIGURE_RANGE[k]
          return (
            <label key={k} className="slider">
              <span>{r.label}</span>
              <input
                type="range"
                min={r.min}
                max={r.max}
                step={0.5}
                value={s.figure[k]}
                onChange={(e) => s.setFigure({ [k]: Number(e.target.value) })}
              />
              <input
                type="number"
                min={r.min}
                max={r.max}
                step={0.5}
                value={s.figure[k]}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (!Number.isNaN(v)) s.setFigure({ [k]: Math.min(r.max, Math.max(r.min, v)) })
                }}
              />
            </label>
          )
        })}
      </section>}

      {s.style === 'girl' && (
        <section>
          <h2>衣櫃 <small>（{OUTFITS[0].pack}）</small></h2>
          {SLOT_ORDER.map((slot) => {
            const current = s.wardrobe[slot]
            const blocked = (slot === 'top' || slot === 'bottom') && !!s.wardrobe.dress
            return (
              <div key={slot} className="wslot">
                <span>{SLOT_LABEL[slot]}</span>
                <div className="zrow">
                  <button className={`zone ${!current ? 'on' : ''}`} onClick={() => s.setOutfit(slot, null)}>無</button>
                  {OUTFITS.filter((o) => o.slot === slot).map((o) => (
                    <button
                      key={o.id}
                      className={`zone ${current === o.id && !blocked ? 'on' : ''}`}
                      onClick={() => s.setOutfit(slot, o.id)}
                      title={blocked ? '會除咗連身裙' : ''}
                    >
                      {o.name}
                    </button>
                  ))}
                </div>
                {current && !blocked && (
                  <div className="wcolors">
                    {OUTFIT_MAP[current].colors.map((c) => (
                      <button
                        key={c}
                        className={`sw-dot ${(s.outfitColors[current] ?? OUTFIT_MAP[current].colors[0]) === c ? 'on' : ''}`}
                        style={{ '--c': c } as React.CSSProperties}
                        aria-label={`顏色 ${c}`}
                        onClick={() => s.setOutfitColor(current, c)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <p className="hint">衣服會跟三圍變；頸鏈會自動貼住件衫。之後嘅 DLC 衣服會喺呢度出現。</p>
        </section>
      )}

      <section>
        <h2>顯示</h2>
        {TOGGLES.filter((t) => !vrm || t.k === 'showSockets' || t.k === 'demoJewelry').map((t) => (
          <label key={t.k} className="toggle" title={t.hint}>
            <input type="checkbox" checked={s[t.k]} onChange={() => s.toggle(t.k)} />
            <span className="sw" />
            <span>{t.label}</span>
          </label>
        ))}
      </section>

      <section className="spec">
        <h2>假人規格{body.source === 'vrm' && <small>（首飾用嘅尺寸）</small>}</h2>
        <dl>
          <dt>身高</dt><dd>{body.heightCm} cm</dd>
          {body.source === 'procedural' && <><dt>體重</dt><dd>≈ 50 kg</dd><dt>BMI</dt><dd>19.5（健康）</dd><dt>頭圍</dt><dd>54 cm</dd></>}
          <dt>頸圍</dt><dd>{g('neck')}{m('neck')}</dd>
          <dt>上臂</dt><dd>{g('upperArmL')}{m('upperArmL')}</dd>
          <dt>手腕</dt><dd>{g('wristL')}{m('wristL')}</dd>
          <dt>腳腕</dt><dd>{g('ankleL')}{m('ankleL')}</dd>
        </dl>
      </section>
    </aside>
  )
}

export function ViewBar() {
  const zone = useApp((s) => s.zone)
  const body = useBody((b) => b.profile)
  const z = ZONES[zone]
  const views = [
    { label: '正面', az: 0 },
    { label: '左側', az: Math.PI / 2 },
    { label: '背面', az: Math.PI },
    { label: '右側', az: -Math.PI / 2 },
  ]
  return (
    <div className="viewbar">
      <div className="crumb">
        {zone === 'full' ? '全身' : `${z.group} · ${z.label}`}
        {z.girthCm ? <em>圍度 {girthOf(body, zone).toFixed(1)} cm</em> : null}
      </div>
      <div className="views">
        {views.map((v) => (
          <button key={v.label} onClick={() => cameraApi.orbit(v.az)}>
            {v.label}
          </button>
        ))}
        <button onClick={() => cameraApi.reset()}>重設</button>
      </div>
      <p className="tip">拖曳：360° 旋轉 · 滾輪 / 兩指：縮放 · 右鍵 / 兩指拖：平移</p>
    </div>
  )
}
