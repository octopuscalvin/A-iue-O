import { ZONES } from '../body/zones'
import { girthOf, useBody } from '../body/bodyProfile'
import { useApp } from '../store'
import { MATERIAL_MAP } from '../materials/library'
import { SHAPE_SVG } from '../jewelry/charms'
import { computeBom, type Bom } from '../jewelry/bom'
import { useDesigns } from '../jewelry/designStore'
import { useAcc } from '../jewelry/accStore'
import { CLIP_LENGTH_MM, EAR_SPOTS, EAR_STYLES, HEAD_STYLES, earSpot, earBom, headBom, headbandLengthMm, type EarDesign, type HeadDesign } from '../jewelry/accessory'
import { BASES, JEWELRY, SHAPES, baseLabel, fitOf, innerLengthCm, isThreaded, type CharmSpec, type RingDesign, type RingZone } from '../jewelry/types'
import { hkd, priceOf, quoteOf, rowCost, usePrices, type Quote } from '../jewelry/pricing'
import { cameraApi } from '../scene/Stage'

/**
 * 生產藍圖：喺新視窗開一頁可以直接列印（或者「另存為 PDF」）嘅文件。
 * 圖則用 mm 做單位，用「實際大小 / 100%」列印就係 1:1。
 */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const matName = (id: string) => MATERIAL_MAP[id]?.name ?? id
const charmName = (c: CharmSpec) => `${SHAPES[c.shape].label} ${c.sizeMm}mm（${matName(c.material)}）`

/** 喺 (cx, cy) 畫一件 S mm 嘅配件 */
function shapeSvg(c: CharmSpec, cx: number, cy: number, scale = 1) {
  const S = c.sizeMm * scale
  const fill = MATERIAL_MAP[c.material]?.swatch ?? '#ccc'
  return `<g transform="translate(${cx - S / 2} ${cy - S / 2}) scale(${S / 20}) translate(-2 -2)"><path d="${SHAPE_SVG[c.shape]}" fill="${fill}" stroke="#555" stroke-width="${0.6 / (S / 20)}"/></g>`
}

const ruler = (x0: number, y: number, len: number, start = 0) => {
  let s = `<line x1="${x0}" y1="${y}" x2="${x0 + len}" y2="${y}" stroke="#999" stroke-width="0.2"/>`
  for (let i = 0; i <= len; i += 5) {
    const h = i % 10 === 0 ? 2 : 1
    s += `<line x1="${x0 + i}" y1="${y}" x2="${x0 + i}" y2="${y + h}" stroke="#999" stroke-width="0.2"/>`
    if ((i + start) % 50 === 0) s += `<text x="${x0 + i}" y="${y + 5}" font-size="2.6" text-anchor="middle" fill="#888">${i + start}</text>`
  }
  return s
}

/** 圈形首飾：由扣頭位剪開、攤直嘅 1:1 展開圖（太長就分行） */
function ringDrawing(d: RingDesign, zone: RingZone, girth: number) {
  const L = innerLengthCm(d, zone, girth) * 10
  const ROW = 170
  const rows = Math.ceil(L / ROW)
  const rowH = 44
  const W = ROW + 20
  const H = rows * rowH + 6
  const base = BASES[d.base.type]
  const col = MATERIAL_MAP[d.base.material]?.swatch ?? '#c9a24b'
  let body = ''
  for (let r = 0; r < rows; r++) {
    const x0 = 10, y = 12 + r * rowH
    const len = Math.min(ROW, L - r * ROW)
    if (d.base.type === 'lace') body += `<rect x="${x0}" y="${y - d.base.thickMm / 2}" width="${len}" height="${d.base.thickMm}" fill="${col}" stroke="#999" stroke-width="0.2" opacity="0.8"/>`
    else if (d.base.type === 'beads') {
      const dia = d.base.thickMm
      for (let x = dia / 2; x < len; x += dia) body += `<circle cx="${x0 + x}" cy="${y}" r="${dia / 2 - 0.1}" fill="${col}" stroke="#999" stroke-width="0.2"/>`
    } else body += `<line x1="${x0}" y1="${y}" x2="${x0 + len}" y2="${y}" stroke="${col}" stroke-width="${Math.max(0.6, d.base.thickMm)}" stroke-linecap="round"/>`
    body += ruler(x0, y + 22, len, r * ROW)
    if (r === 0) body += `<text x="${x0}" y="${y - 6}" font-size="3" fill="#c4314b">${base.clasp ? '◀ 龍蝦扣' : '◀ 起點'}</text>`
    if (r === rows - 1) body += `<text x="${x0 + len}" y="${y - 6}" font-size="3" text-anchor="end" fill="#c4314b">${base.clasp ? '扣圈 ▶' : '終點 ▶'}</text>`
  }
  // 配件位置：展開圖由 t = 0.5（扣頭）開始
  const placed = d.charms.map((c) => ({ c, x: ((c.t - 0.5 + 1) % 1) * L })).sort((a, b) => a.x - b.x)
  placed.forEach(({ c, x }, i) => {
    const r = Math.min(rows - 1, Math.floor(x / ROW))
    const px = 10 + (x - r * ROW)
    const y = 12 + r * rowH
    const threaded = isThreaded(c, d.base.type)
    const cy = threaded ? y : y + 4 + c.sizeMm / 2
    if (!threaded) body += `<line x1="${px}" y1="${y}" x2="${px}" y2="${y + 3}" stroke="#777" stroke-width="0.3"/>`
    body += shapeSvg(c, px, cy)
    body += `<text x="${px}" y="${y - 3 - (threaded ? c.sizeMm / 2 : 0)}" font-size="2.8" text-anchor="middle" fill="#333">${i + 1}·${x.toFixed(0)}</text>`
  })
  return { svg: `<svg width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">${body}</svg>`, placed, L }
}

/** 耳環：放大 2 倍嘅側面圖 */
function earDrawing(d: EarDesign) {
  const K = 2
  const col = MATERIAL_MAP[d.metal]?.swatch ?? '#c9a24b'
  let body = `<circle cx="30" cy="12" r="3" fill="#f3d6cc" stroke="#c9a" stroke-width="0.3"/><text x="36" y="13" font-size="3" fill="#888">耳珠</text>`
  let H = 40
  if (d.style === 'stud') {
    const f = d.charms[0]
    body += f ? shapeSvg(f, 30, 12, K) : `<circle cx="30" cy="12" r="${2 * K}" fill="${col}" stroke="#555" stroke-width="0.3"/>`
  } else if (d.style === 'cuff') {
    const R = ((d.cuffDiaMm ?? 8) / 2) * K
    body += `<path d="M${30 + R * Math.cos(0.45)} ${12 - R * Math.sin(0.45)} A${R} ${R} 0 1 0 ${30 + R * Math.cos(0.45)} ${12 + R * Math.sin(0.45)}" fill="none" stroke="${col}" stroke-width="${d.wireMm * K}"/>`
    let y = 12 + R
    d.charms.forEach((c) => {
      body += shapeSvg(c, 30, y + 3 + (c.sizeMm * K) / 2, K)
      y += c.sizeMm * K + 3
    })
    body += `<text x="${34 + R}" y="13" font-size="3" fill="#333">直徑 ${d.cuffDiaMm ?? 8}mm</text>`
    H = Math.max(H, y + 10)
  } else if (d.style === 'hoop') {
    const R = (d.hoopDiaMm / 2) * K
    const cy = 12 + R - 2
    body += `<circle cx="30" cy="${cy}" r="${R}" fill="none" stroke="${col}" stroke-width="${d.wireMm * K}"/>`
    d.charms.forEach((c) => {
      const a = c.t * Math.PI * 2
      const px = 30 + R * Math.sin(a), py = cy + R * Math.cos(a)
      body += `<line x1="${px}" y1="${py}" x2="${px}" y2="${py + 4}" stroke="#777" stroke-width="0.4"/>` + shapeSvg(c, px, py + 4 + (c.sizeMm * K) / 2, K)
    })
    H = Math.max(H, cy + R + 40)
    body += `<text x="${32 + R}" y="${cy}" font-size="3" fill="#333">直徑 ${d.hoopDiaMm}mm</text>`
  } else {
    let y = 12 + 6 * K
    body += `<path d="M30 ${y} L30 ${12 - 2} Q30 6 34 8 L36 ${18}" fill="none" stroke="${col}" stroke-width="${0.7 * K}"/>`
    body += `<line x1="30" y1="${y}" x2="30" y2="${y + d.dropLenMm * K}" stroke="${col}" stroke-width="${0.6 * K}" stroke-dasharray="1.2 0.6"/>`
    body += `<text x="33" y="${y + (d.dropLenMm * K) / 2}" font-size="3" fill="#333">鏈長 ${d.dropLenMm}mm</text>`
    y += d.dropLenMm * K
    d.charms.forEach((c) => {
      y += 3 * K
      body += shapeSvg(c, 30, y + (c.sizeMm * K) / 2, K)
      y += c.sizeMm * K
    })
    H = Math.max(H, y + 8)
  }
  return `<svg width="70mm" height="${H}mm" viewBox="0 0 70 ${H}">${body}<text x="2" y="${H - 2}" font-size="2.6" fill="#888">（放大 2 倍）</text></svg>`
}

/** 頭飾：攤直嘅 1:1 圖 */
function headDrawing(d: HeadDesign, arcMm: number) {
  const L = d.style === 'headband' ? arcMm : CLIP_LENGTH_MM
  const ROW = 170
  const rows = Math.ceil(L / ROW)
  const rowH = 48
  const H = rows * rowH + 6
  const col = MATERIAL_MAP[d.material]?.swatch ?? '#e98aa8'
  let body = ''
  for (let r = 0; r < rows; r++) {
    const len = Math.min(ROW, L - r * ROW)
    const y = 16 + r * rowH
    body += `<rect x="10" y="${y - d.widthMm / 2}" width="${len}" height="${d.widthMm}" rx="${Math.min(3, d.widthMm / 2)}" fill="${col}" stroke="#999" stroke-width="0.2"/>` + ruler(10, y + 22, len, r * ROW)
  }
  const placed = d.charms.map((c) => ({ c, x: c.t * L })).sort((a, b) => a.x - b.x)
  placed.forEach(({ c, x }, i) => {
    const r = Math.min(rows - 1, Math.floor(x / ROW))
    const px = 10 + (x - r * ROW)
    const y = 16 + r * rowH
    body += shapeSvg(c, px, y) + `<text x="${px}" y="${y - d.widthMm / 2 - 2}" font-size="2.8" text-anchor="middle">${i + 1}·${x.toFixed(0)}</text>`
  })
  return { svg: `<svg width="190mm" height="${H}mm" viewBox="0 0 190 ${H}">${body}</svg>`, placed, L }
}

function bomTable(bom: Bom, q: Quote, prices: ReturnType<typeof usePrices.getState>['prices']) {
  const rows = bom.rows
    .map((r) => `<tr><td>${esc(r.part)}</td><td>${esc(r.spec)}</td><td>${esc(r.material)}</td><td class="n">${r.qty}</td><td class="n">${r.weightG.toFixed(2)}g</td><td class="n">${hkd(rowCost(r, prices))}</td></tr>`)
    .join('')
  return `<table><thead><tr><th>零件</th><th>規格</th><th>物料</th><th>數量</th><th>重量</th><th>成本</th></tr></thead><tbody>${rows}</tbody>
  <tfoot><tr><td colspan="4">總重</td><td class="n">${bom.totalG.toFixed(1)}g</td><td></td></tr>
  <tr><td colspan="5">材料 ${hkd(q.materials)} ＋ 人工 ${hkd(q.labor)} ＝ 成本</td><td class="n">${hkd(q.cost)}</td></tr>
  <tr class="sell"><td colspan="5">建議售價（成本 × ${priceOf(prices, 'margin')}）</td><td class="n">HK${hkd(q.suggested)}</td></tr></tfoot></table>`
}

const warnBox = (bom: Bom) => (bom.warnings.length ? `<ul class="warn">${bom.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '')
const steps = (list: string[]) => `<ol class="steps">${list.map((s) => `<li>${s}</li>`).join('')}</ol>`

/** 砌好成份藍圖（完整 HTML 文件） */
export function buildBlueprint(projectName: string): string {
  const body = useBody.getState().profile
  const prices = usePrices.getState().prices
  const app = useApp.getState()
  const rings = useDesigns.getState().designs
  const acc = useAcc.getState().designs
  const sections: string[] = []
  let total = 0
  let totalSell = 0

  for (const [zone, d] of Object.entries(rings) as [RingZone, RingDesign][]) {
    const j = JEWELRY[zone]
    const girth = girthOf(body, zone)
    const bom = computeBom(d, zone, girth)
    const q = quoteOf(bom.rows, d.charms.length, prices)
    total += q.cost
    totalSell += q.suggested
    const dr = ringDrawing(d, zone, girth)
    const base = BASES[d.base.type]
    const fit = fitOf(zone, d)
    const st: string[] = [
      `準備底座：${baseLabel(zone, d.base.type)}（${matName(d.base.material)}，${base.thick.label} ${d.base.thickMm}mm），${j.kind === 'necklace' ? '鏈長' : '內圈長度'} <b>${dr.L.toFixed(0)}mm</b>（${fit.label}）。`,
    ]
    if (d.base.type === 'beads') st.push(`用彈性水晶線穿底珠，配件珠喺下面位置穿入，最後打結並將結收入珠孔。`)
    else if (base.clasp) st.push(`${d.base.type === 'chain' ? '剪好條鏈' : '剪好長度，兩端裝上夾頭'}，一端裝龍蝦扣、另一端裝扣圈。`)
    else st.push(`將${baseLabel(zone, d.base.type)}整形到內圈 ${dr.L.toFixed(0)}mm。`)
    dr.placed.forEach(({ c, x }, i) => {
      st.push(`配件 ${i + 1}：喺離起點 <b>${x.toFixed(0)}mm</b> ${isThreaded(c, d.base.type) ? '穿入' : '用 4mm 開口圈掛上'} ${esc(charmName(c))}。`)
    })
    st.push(`完成後量度內圈長度同總重（約 ${bom.totalG.toFixed(1)}g）。`)
    sections.push(`<section><h2>${j.name} · ${ZONES[zone].label}</h2>
      <p class="sub">${ZONES[zone].label}圍度 ${girth.toFixed(1)}cm · 圖則 1:1（數字 = 配件編號·離起點 mm）</p>
      <div class="draw">${dr.svg}</div>${warnBox(bom)}<h3>組裝步驟</h3>${steps(st)}<h3>零件清單同報價</h3>${bomTable(bom, q, prices)}</section>`)
  }

  for (const [zone, d] of Object.entries(acc) as ['earL' | 'earR' | 'head', EarDesign | HeadDesign][]) {
    if (d.kind === 'earring') {
      const bom = earBom(d)
      const q = quoteOf(bom.rows, d.charms.length, prices)
      total += q.cost
      totalSell += q.suggested
      const st: string[] = []
      if (d.style === 'stud') st.push(`耳針（${matName(d.metal)}）用首飾膠黏上耳釘面：${d.charms[0] ? esc(charmName(d.charms[0])) : '4mm 圓珠'}，等 24 小時乾透。`)
      if (d.style === 'hoop') {
        st.push(`準備耳圈：直徑 ${d.hoopDiaMm}mm、線徑 ${d.wireMm}mm（${matName(d.metal)}）。`)
        d.charms.forEach((c, i) => st.push(`配件 ${i + 1}：喺耳圈 ${Math.round(c.t * 360)}°（0° = 最低點）用 3mm 開口圈掛上 ${esc(charmName(c))}。`))
      }
      if (d.style === 'cuff') {
        st.push(`耳骨夾：直徑 ${d.cuffDiaMm ?? 8}mm、線徑 ${d.wireMm}mm（${matName(d.metal)}），留開口，夾喺${EAR_SPOTS[earSpot(d)].label}。`)
        d.charms.forEach((c, i) => st.push(`配件 ${i + 1}：用 3mm 開口圈吊喺夾外面：${esc(charmName(c))}。`))
      }
      if (d.style === 'drop') {
        st.push(`法式耳鈎下面接 ${d.dropLenMm}mm 幼鏈（${matName(d.metal)}）。`)
        d.charms.forEach((c, i) => st.push(`第 ${i + 1} 件（由上至下）：用 3mm 開口圈接上 ${esc(charmName(c))}。`))
      }
      st.unshift(`佩戴位置：${EAR_SPOTS[earSpot(d)].label}（${EAR_SPOTS[earSpot(d)].hint}）。`)
      sections.push(`<section><h2>耳環（${EAR_STYLES[d.style].label}）· ${ZONES[zone].label}</h2>
        <div class="draw">${earDrawing(d)}</div>${warnBox(bom)}<h3>組裝步驟</h3>${steps(st)}<h3>零件清單同報價（一隻）</h3>${bomTable(bom, q, prices)}</section>`)
    } else {
      const arcMm = headbandLengthMm(body.headArc.rx, body.headArc.ry)
      const bom = headBom(d, arcMm)
      const q = quoteOf(bom.rows, d.charms.length, prices)
      total += q.cost
      totalSell += q.suggested
      const dr = headDrawing(d, arcMm)
      const st = [
        d.style === 'headband'
          ? `準備髮箍底座（${matName(d.material)}），闊 ${d.widthMm}mm、長約 ${arcMm.toFixed(0)}mm。`
          : `準備 ${CLIP_LENGTH_MM}mm 彈簧髮夾（${matName(d.material)}），闊 ${d.widthMm}mm。`,
        ...dr.placed.map(({ c, x }, i) => `配件 ${i + 1}：喺離${d.style === 'headband' ? '左端' : '髮夾前端'} <b>${x.toFixed(0)}mm</b> 黏上 ${esc(charmName(c))}。`),
        '用首飾膠黏好，平放 24 小時等膠乾透。',
      ]
      sections.push(`<section><h2>${HEAD_STYLES[d.style].label}</h2><p class="sub">圖則 1:1（數字 = 配件編號·離左端 mm）</p>
        <div class="draw">${dr.svg}</div>${warnBox(bom)}<h3>組裝步驟</h3>${steps(st)}<h3>零件清單同報價</h3>${bomTable(bom, q, prices)}</section>`)
    }
  }

  const shot = cameraApi.snapshot()
  const date = new Date().toLocaleDateString('zh-HK')
  const sizing = app.style === 'vrm' ? (app.vrmSizing === 'standard' ? '真人標準尺寸' : '跟模型實際尺寸') : '160cm 標準假人尺寸'
  const html = `<!doctype html><html lang="zh-HK"><head><meta charset="utf-8"><title>生產藍圖 · ${esc(projectName)}</title>
<style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
body { font-family: system-ui, 'PingFang HK', 'Microsoft JhengHei', sans-serif; color: #2b2026; margin: 0; padding: 16px; background: #fff; }
.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #ff4f8b; padding-bottom: 10px; }
h1 { margin: 0; font-size: 22px; } .meta { color: #7a6670; font-size: 13px; margin-top: 4px; line-height: 1.6; }
.shot { width: 46mm; border: 1px solid #eee; border-radius: 6px; }
.total { margin: 12px 0; padding: 10px 12px; background: #fff0f5; border-radius: 8px; font-size: 14px; }
section { break-inside: avoid-page; margin-top: 18px; padding-top: 10px; border-top: 1px solid #eee; }
h2 { font-size: 17px; margin: 0 0 2px; } h3 { font-size: 14px; margin: 12px 0 4px; } .sub { margin: 0; color: #7a6670; font-size: 12px; }
.draw { margin: 8px 0; overflow-x: auto; } .draw svg { display: block; }
table { width: 100%; border-collapse: collapse; font-size: 12px; } th, td { border-bottom: 1px solid #eee; padding: 4px 6px; text-align: left; }
th { color: #7a6670; font-weight: 500; } .n { text-align: right; white-space: nowrap; } tfoot td { font-weight: 600; } tr.sell td { color: #c4314b; }
.steps { font-size: 13px; line-height: 1.7; padding-left: 20px; margin: 4px 0; }
.warn { background: #fff4e5; color: #8a4b00; font-size: 12px; padding: 6px 10px 6px 26px; border-radius: 6px; }
.note { font-size: 12px; color: #7a6670; } .bar { margin-bottom: 12px; } .bar button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 0; background: #ff4f8b; color: #fff; cursor: pointer; }
@media print { .bar { display: none; } body { padding: 0; } }
</style></head><body>
<p class="note bar">列印時請揀「實際大小」或者「100%」，圖則先係 1:1。</p>
<div class="top"><div><h1>生產藍圖 · ${esc(projectName)}</h1>
<div class="meta">日期 ${date} · 共 ${sections.length} 件首飾<br>尺寸基準：${sizing}（手腕 ${girthOf(body, 'wristL').toFixed(1)}cm · 腳腕 ${girthOf(body, 'ankleL').toFixed(1)}cm · 上臂 ${girthOf(body, 'upperArmL').toFixed(1)}cm · 頸 ${girthOf(body, 'neck').toFixed(1)}cm）<br>單位：mm · 價錢：港幣（按「報價設定」計）</div></div>
${shot ? `<img class="shot" src="${shot}" alt="3D 預覽">` : ''}</div>
<div class="total">全套成本 <b>${hkd(total)}</b> · 建議售價合共 <b>HK${hkd(totalSell)}</b></div>
${sections.join('') || '<p>未有任何首飾設計。</p>'}
</body></html>`
  return html
}
