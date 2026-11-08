import { useState, useEffect, useMemo, useRef, useId } from 'react'
import { fmt as fmtMoney } from '../utils/currency'

// useNarrow — czy okno jest węższe niż `maxWidth`; nasłuchuje zmian rozmiaru
// (obrót telefonu, zmiana szerokości okna), nie tylko przy pierwszym renderze
export function useNarrow(maxWidth = 480) {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(`(max-width: ${maxWidth}px)`).matches)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const onChange = (e) => setNarrow(e.matches)
    mq.addEventListener('change', onChange)
    setNarrow(mq.matches)
    return () => mq.removeEventListener('change', onChange)
  }, [maxWidth])
  return narrow
}

// useMounted — trigger CSS transition after mount
export function useMounted(delay = 60) {
  const [on, setOn] = useState(() => typeof document !== 'undefined' && document.hidden)
  useEffect(() => {
    if (document.hidden) { setOn(true); return }
    const id = setTimeout(() => setOn(true), delay)
    return () => clearTimeout(id)
  }, [])
  return on
}

// useCountUp — animuje liczby od 0 do target
export function useCountUp(target, { dur = 900, decimals = 0 } = {}) {
  const [v, setV] = useState(() => (typeof document !== 'undefined' && document.hidden) ? target : 0)
  useEffect(() => {
    if (document.hidden) { setV(target); return }
    let raf, start
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min(1, (ts - start) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setV(target * e)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, dur])
  return decimals ? v.toFixed(decimals) : Math.round(v)
}

// Donut chart z hover i animacją rysowania
export function Donut({ data, size = 200, thickness = 22, gap = 0.018, centerTop, centerMain, centerSub, onHover }) {
  const on = useMounted(120)
  const [hover, setHover] = useState(null)
  // || 1 — gdy wszystkie wartości są 0, unika dzielenia przez zero (NaN w SVG)
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = (size - thickness) / 2 - 2
  const C = 2 * Math.PI * r
  let acc = 0
  const segs = data.map((d, i) => {
    const frac = d.value / total
    const len = Math.max(0, frac * C - gap * C)
    const seg = { ...d, i, offset: -acc * C, len, dash: `${len} ${C - len}`, frac }
    acc += frac; return seg
  })
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={thickness} opacity={.5}/>
        {segs.map(s => (
          <circle key={s.i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={s.color} strokeWidth={hover === s.i ? thickness + 4 : thickness} strokeLinecap="butt"
            strokeDasharray={on ? s.dash : `0 ${C}`} strokeDashoffset={s.offset}
            onMouseEnter={() => { setHover(s.i); onHover && onHover(s) }}
            onMouseLeave={() => { setHover(null); onHover && onHover(null) }}
            style={{ transition: `stroke-dasharray .9s cubic-bezier(.4,0,.2,1) ${s.i * .07}s, stroke-width .2s`, cursor: 'pointer' }}
          />
        ))}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
        {centerTop && <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 4 }}>{centerTop}</div>}
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: size * .19, fontWeight: 700, lineHeight: 1 }}>{centerMain}</div>
        {centerSub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, letterSpacing: '.04em' }}>{centerSub}</div>}
      </div>
    </div>
  )
}

// DonutStat — pełny donut ze statystykami: środek pokazuje sumę albo najechany
// segment (nazwa + kwota + %), opcjonalna legenda, tryb prywatny.
// data: [{ name, value }], colors: tablica kolorów per segment.
export function DonutStat({ data, colors, total: totalProp, size: sizeProp, thickness = 28, privateMode = false, legend = true, fmtValue = fmtMoney }) {
  const [active, setActive] = useState(null)
  const on = useMounted(120)
  const narrow = useNarrow(480)

  const size = sizeProp ?? (narrow ? 180 : 220)
  const total = totalProp ?? data.reduce((s, d) => s + d.value, 0)
  const r = (size - thickness) / 2 - 2
  const C = 2 * Math.PI * r
  const gap = 0.015

  let acc = 0
  const segs = data.map((d, i) => {
    const frac = total > 0 ? d.value / total : 0
    const len = Math.max(0, frac * C - gap * C)
    const seg = { ...d, i, offset: -(acc * C), len, dash: `${len} ${C - len}`, frac }
    acc += frac
    return seg
  })

  const displayItem = active != null ? data[active] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={thickness} opacity={.4}/>
          {segs.map(s => (
            <circle key={s.i} cx={size/2} cy={size/2} r={r} fill="none"
              stroke={colors[s.i]}
              strokeWidth={active === s.i ? thickness + 4 : thickness}
              strokeLinecap="butt"
              strokeDasharray={on ? s.dash : `0 ${C}`}
              strokeDashoffset={s.offset}
              opacity={active == null || active === s.i ? 1 : 0.4}
              onMouseEnter={() => setActive(s.i)}
              onMouseLeave={() => setActive(null)}
              style={{ transition: `stroke-dasharray .9s cubic-bezier(.4,0,.2,1) ${s.i * .07}s, stroke-width .2s, opacity .2s`, cursor: 'pointer' }}
            />
          ))}
        </svg>

        {/* Center label */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
          {displayItem ? (
            <>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{displayItem.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: colors[active] }}>{privateMode ? '••' : fmtValue(displayItem.value)}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{total > 0 ? (displayItem.value / total * 100).toFixed(1) : 0}%</p>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Łącznie</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800 }}>{privateMode ? '••' : fmtValue(total)}</p>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      {legend && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.map((item, i) => {
            const pct = total > 0 ? (item.value / total * 100) : 0
            return (
              <div key={item.name}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 8, background: active === i ? 'var(--surface2)' : 'transparent', transition: 'background 0.15s', cursor: 'pointer' }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                <div style={{ width: 10, height: 10, borderRadius: 3, background: colors[i], flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13 }}>{item.name}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{privateMode ? '••' : fmtValue(item.value)}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// LineAreaSVG — wykres liniowy z wypełnieniem (zastępuje recharts AreaChart).
// data: [{ label, value }], stała skala Y [min, max], opcjonalne linie siatki
// na yTicks, tooltip na hover. Szerokość mierzy z kontenera (ResizeObserver).
export function LineAreaSVG({ data, height = 150, min = 0, max = 5, yTicks = [], accent = 'var(--accent)', fmtValue, fmtLabel, allLabels = false }) {
  const ref = useRef(null)
  const gradId = useId()
  const [w, setW] = useState(0)
  const [hover, setHover] = useState(null)
  const on = useMounted(100)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const padL = 24, padR = 8, padT = 8, padB = 18
  const iw = Math.max(0, w - padL - padR)
  const ih = height - padT - padB
  const n = data.length
  const x = (i) => padL + (n > 1 ? (i / (n - 1)) * iw : iw / 2)
  const y = (v) => padT + (1 - (v - min) / (max - min || 1)) * ih

  const pts = data.map((d, i) => [x(i), y(d.value)])
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area = pts.length ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${padT + ih} L${pts[0][0].toFixed(1)},${padT + ih} Z` : ''

  // Etykiety osi X — maksymalnie ~8, żeby nie nachodziły na siebie
  // (allLabels = podpisz każdy punkt)
  const labelStep = allLabels ? 1 : Math.max(1, Math.ceil(n / 8))

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {w > 0 && (
        <svg width={w} height={height} style={{ display: 'block', opacity: on ? 1 : 0, transition: 'opacity .5s' }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const mx = e.clientX - rect.left
            let best = 0, bestD = Infinity
            pts.forEach(([px], i) => { const dd = Math.abs(px - mx); if (dd < bestD) { bestD = dd; best = i } })
            setHover(bestD < 40 ? best : null)
          }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" style={{ stopColor: accent, stopOpacity: 0.3 }} />
              <stop offset="95%" style={{ stopColor: accent, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {/* siatka + etykiety Y */}
          {yTicks.map(t => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.055)" />
              <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="var(--text-muted)">{t}</text>
            </g>
          ))}
          {/* obszar + linia */}
          <path d={area} fill={`url(#${gradId})`} />
          <path d={line} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {/* punkty */}
          {pts.map(([px, py], i) => (
            <circle key={i} cx={px} cy={py}
              r={hover === i ? 5 : 3}
              fill={hover === i ? accent : 'var(--bg)'}
              stroke={accent} strokeWidth="2"
              style={{ transition: 'r .15s' }}
            />
          ))}
          {/* etykiety X */}
          {data.map((d, i) => (
            (i % labelStep === 0 || hover === i) && (
              <text key={i} x={x(i)} y={height - 4} textAnchor="middle" fontSize="9"
                fill={hover === i ? 'var(--text)' : 'var(--text-muted)'}>{d.label}</text>
            )
          ))}
        </svg>
      )}
      {/* tooltip */}
      {hover != null && data[hover] && (
        <div style={{
          position: 'absolute',
          left: Math.min(Math.max(pts[hover][0], 44), w - 44),
          top: pts[hover][1] - 34,
          transform: 'translateX(-50%)',
          background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 7,
          padding: '3px 8px', fontSize: 11, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2,
          color: 'var(--text)',
        }}>
          {fmtLabel ? fmtLabel(data[hover].label) + ' · ' : ''}{fmtValue ? fmtValue(data[hover].value) : data[hover].value}
        </div>
      )}
    </div>
  )
}

// FlowBar — poziomy pasek przepływu
export function FlowBar({ segments, height = 14 }) {
  const on = useMounted(200)
  const total = segments.reduce((s, d) => s + d.value, 0) || 1
  return (
    <div style={{ display: 'flex', width: '100%', height, borderRadius: 99, overflow: 'hidden', background: 'var(--surface3)' }}>
      {segments.map((s, i) => (
        <div key={i} title={s.label} style={{
          width: on ? `${(s.value / total) * 100}%` : '0%', background: s.color, height: '100%',
          transition: `width .9s cubic-bezier(.4,0,.2,1) ${i * .1}s`,
          borderRight: i < segments.length - 1 ? '2px solid var(--surface)' : 'none',
        }}/>
      ))}
    </div>
  )
}

// Pionowe słupki (trend miesięczny)
export function BarChartSVG({ data, height = 150, accent = 'var(--accent)', fmt }) {
  const on = useMounted(120)
  const max = Math.max(...data.map(d => d.value)) * 1.12 || 1
  const [hover, setHover] = useState(null)
  const tooltipH = fmt ? 26 : 0
  // Etykiety osi X przerzedzamy, gdy kubełków jest dużo (np. dni miesiąca).
  // Przy 31 słupkach kolumna ma ~7 px, więc dwucyfrowy dzień i tak by się nie
  // zmieścił — obcięty wyglądał jak zupełnie inna liczba. Zostawiamy co n-tą
  // etykietę (~8 podpisów) i pozwalamy jej wyjść poza szerokość kolumny.
  const labelStep = data.length > 12 ? Math.ceil(data.length / 8) : 1
  // Odstęp między słupkami liczony w procentach zjadał przy 31 dniach niemal
  // całą szerokość (29 przerw po 3%) i z kolumn zostawały włoski niepasujące
  // do podpisów. Przy wielu kubełkach przechodzimy na stałe kilka pikseli.
  const gap = data.length > 12 ? 3 : 'min(3%,8px)'
  // Gdy kolumna ma kilka pikseli, 70% szerokości daje włosek zamiast słupka.
  const barW = data.length > 12 ? 'min(85%,28px)' : 'min(70%,28px)'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap, height, padding: '0 2px', overflow: 'hidden' }}>
      {data.map((d, i) => {
        const h = (d.value / max) * (100 - (tooltipH / height) * 100)
        const active = d.active || hover === i
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end', minWidth: 0 }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            onPointerDown={() => setHover(i)}>
            <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', flex: 1, minHeight: tooltipH }}>
              {active && fmt && d.value > 0 && (
                <div style={{ fontSize: 9, color: 'var(--text)', whiteSpace: 'nowrap', background: 'var(--surface2)', padding: '2px 5px', borderRadius: 5, border: '1px solid var(--border-strong)', zIndex: 2, marginBottom: 3, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmt(d.value)}</div>
              )}
              <div style={{
                width: barW, borderRadius: '6px 6px 3px 3px', transformOrigin: 'bottom', flexShrink: 0,
                height: on ? `${h}%` : '0%',
                background: active ? accent : `color-mix(in oklab, ${accent} 30%, var(--surface3))`,
                boxShadow: active ? `0 4px 14px -6px ${accent}` : 'none',
                transition: `height .8s cubic-bezier(.34,1.4,.64,1) ${i * .04}s, background .2s`,
              }}/>
            </div>
            {/* Wiersz podpisu ma stałą wysokość w KAŻDEJ kolumnie — także bez
                etykiety. Wcześniej pusta kolumna nie miała tego wiersza, więc jej
                słupek sięgał niżej niż w kolumnie z podpisem i wchodził na numerki. */}
            <span style={{ fontSize: 8, lineHeight: '10px', height: 10, color: active ? 'var(--text)' : 'var(--text-muted)', letterSpacing: '.02em', flexShrink: 0, whiteSpace: 'nowrap', textAlign: 'center' }} aria-hidden={i % labelStep !== 0}>{i % labelStep === 0 ? d.label : '\u00a0'}</span>
          </div>
        )
      })}
    </div>
  )
}

// Zgrupowane słupki — para przychody (zielony) / wydatki (pomarańczowy) na miesiąc
// data: [{ label, income, expense }]
export function GroupedBars({ data, height = 150, incomeColor = 'var(--income)', expenseColor = 'var(--expense)', barMaxWidth = 14, fmt }) {
  const on = useMounted(120)
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...data.flatMap(d => [d.income, d.expense])) * 1.1

  // Słupek z najwyższą wartością — to on domyślnie zasila nagłówek (gdy nic nie wskazano).
  let peakIdx = 0, peakVal = -1
  data.forEach((d, i) => { const v = Math.max(d.income, d.expense); if (v > peakVal) { peakVal = v; peakIdx = i } })

  // Etykiety osi X przerzedzamy, gdy kubełków jest dużo (np. dni miesiąca) — inaczej nachodzą na siebie.
  const labelStep = data.length > 16 ? Math.ceil(data.length / 8) : 1

  // Zamiast pływających kwot NAD słupkami (nachodziły na siebie i wychodziły poza ekran)
  // pokazujemy jeden czytelny nagłówek dla wskazanego (lub szczytowego) kubełka.
  const capIdx = hover ?? peakIdx
  const cap = data[capIdx]

  return (
    <div>
      {fmt && cap && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10, minHeight: 18, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'capitalize', color: 'var(--text)' }}>{cap.label}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: incomeColor }}>+{fmt(cap.income)}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: expenseColor }}>−{fmt(cap.expense)}</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'min(3%,10px)', height, padding: '0 2px' }}>
        {data.map((d, i) => {
          const active = hover === i
          const showLabel = i % labelStep === 0
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end', minWidth: 0 }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onClick={() => setHover(h => h === i ? null : i)}>
              <div style={{ position: 'relative', width: '100%', flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3 }}>
                {[['income', incomeColor], ['expense', expenseColor]].map(([type, color]) => {
                  const val = d[type]
                  const h = (val / max) * 100
                  return (
                    <div key={type} style={{ flex: 1, maxWidth: barMaxWidth, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <div style={{
                        width: '100%', borderRadius: '4px 4px 2px 2px', flexShrink: 0,
                        height: on ? `${h}%` : '0%',
                        background: hover === null || active ? color : `color-mix(in oklab, ${color} 45%, var(--surface3))`,
                        transition: `height .8s cubic-bezier(.34,1.4,.64,1) ${i * .03}s, background .2s`,
                      }}/>
                    </div>
                  )
                })}
              </div>
              <span style={{ fontSize: 9, height: 11, color: active ? 'var(--text)' : 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{showLabel ? d.label : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Heatmap (GitHub-style) — do nawyków i modlitwy
// accentHex: raw hex like '#E0B15A' — used for rgba-based level colors (no color-mix needed)
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r},${g},${b}`
}

export function Heatmap({ weeks = 18, accentHex = '#E0B15A', data }) {
  const on = useMounted(80)
  const cells = useMemo(() => {
    if (data) return data
    const out = []; let s = 7
    for (let i = 0; i < weeks * 7; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      const r = s / 0x7fffffff
      out.push(i > weeks * 7 - 3 ? 0 : r < .16 ? 0 : r < .4 ? 1 : r < .66 ? 2 : r < .88 ? 3 : 4)
    }
    return out
  }, [weeks, data])

  const rgb = useMemo(() => hexToRgb(accentHex), [accentHex])

  // rgba-based levels — works on ALL browsers (no color-mix)
  const lvl = (v) => {
    if (v === 0) return 'rgba(255,255,255,0.06)'  // surface2-like
    if (v === 1) return `rgba(${rgb},0.25)`
    if (v === 2) return `rgba(${rgb},0.50)`
    if (v === 3) return `rgba(${rgb},0.75)`
    return accentHex  // v>=4: fully saturated
  }

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 3 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingRight: 4, flexShrink: 0 }}>
          {['P','','Ś','','P','','N'].map((d, i) => (
            <span key={i} style={{ fontSize: 8, color: 'var(--text-muted)', height: 11, lineHeight: '11px' }}>{d}</span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateRows: 'repeat(7,11px)', gridAutoColumns: '11px', gridAutoFlow: 'column', gap: 3, overflow: 'hidden', flex: 1 }}>
          {cells.map((v, i) => (
            <div key={i} style={{
              width: 11, height: 11, borderRadius: 3,
              background: lvl(v),
              boxShadow: v >= 4 ? `0 0 6px 1px rgba(${rgb},0.45)` : 'none',
              opacity: on ? 1 : 0,
              transform: on ? 'scale(1)' : 'scale(.4)',
              transition: `opacity .5s cubic-bezier(.4,0,.2,1) ${(i % 40) * .006}s, transform .5s cubic-bezier(.34,1.4,.64,1) ${(i % 40) * .006}s`,
            }}/>
          ))}
        </div>
      </div>
    </div>
  )
}

// Pierścień postępu (streak / procent)
export function Ring({ value, size = 72, thickness = 7, color = 'var(--accent)', label }) {
  const on = useMounted(120)
  const r = (size - thickness) / 2
  const C = 2 * Math.PI * r
  return (
    // flexShrink: 0 — pierścień stoi w kontenerze flex obok tekstu (kafelki
    // Pulpitu, hero Nawyków). Bez tego kurczy się poniżej swojego rozmiaru,
    // a SVG o stałej szerokości wychodzi poza pudełko i nachodzi na napisy.
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={thickness}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={on ? C * (1 - value / 100) : C}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: size * .28, lineHeight: 1 }}>{Math.round(value)}<span style={{ fontSize: size * .16, color: 'var(--text-muted)' }}>%</span></div>
          {label && <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>}
        </div>
      </div>
    </div>
  )
}

// Spark bars (mini trend inline)
export function Spark({ data, color = 'var(--accent)', height = 30, w = 4 }) {
  const on = useMounted(80)
  const max = Math.max(...data) || 1
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height }}>
      {data.map((v, i) => (
        <div key={i} style={{
          width: w, borderRadius: 2, background: color,
          opacity: .55 + .45 * (v / max),
          height: on ? `${(v / max) * 100}%` : '0%',
          transition: `height .6s cubic-bezier(.34,1.4,.64,1) ${i * .03}s`,
        }}/>
      ))}
    </div>
  )
}
