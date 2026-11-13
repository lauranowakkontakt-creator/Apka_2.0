import { useState } from 'react'

// Koło emocji Plutchika w wersji na telefon.
//
// Pełne koło (8 płatków × 3 poziomy + 8 emocji mieszanych = 32 podpisy) jest
// na ekranie telefonu nieczytelne i nie da się w nie trafić palcem. Dlatego
// koło pokazuje tylko 8 dużych płatków z emocją bazową, a dotknięcie płatka
// otwiera pod spodem jego odcienie: łagodny → bazowy → intensywny oraz dwie
// emocje mieszane z sąsiadami. Identyfikatory emocji są te same co wcześniej,
// więc stare wpisy dalej się rozpoznają.

const N = 8
const STEP = (2 * Math.PI) / N
const RI = 40, RO = 150

// 8 płatków, każdy z 3 poziomami: mild (łagodna) / base (bazowa) / intense (intensywna)
export const PETALS = [
  {
    mild:    { id: 'błogość',      label: 'Błogość',      color: '#F2DC8B' },
    base:    { id: 'radość',       label: 'Radość',       color: '#E6C04A' },
    intense: { id: 'euforia',      label: 'Ekstaza',      color: '#C79A1E' },
  },
  {
    mild:    { id: 'akceptacja',   label: 'Akceptacja',   color: '#C3E08F' },
    base:    { id: 'zaufanie',     label: 'Zaufanie',     color: '#9CCB5E' },
    intense: { id: 'podziw',       label: 'Zachwyt',      color: '#74A636' },
  },
  {
    mild:    { id: 'niepokój',     label: 'Obawa',        color: '#8FD8B0' },
    base:    { id: 'strach',       label: 'Strach',       color: '#57BD8A' },
    intense: { id: 'przerażenie',  label: 'Przerażenie',  color: '#339666' },
  },
  {
    mild:    { id: 'rozproszenie', label: 'Roztargnienie', color: '#97D3F0' },
    base:    { id: 'zaskoczenie',  label: 'Zaskoczenie',  color: '#5DB6E6' },
    intense: { id: 'zdumienie',    label: 'Zdumienie',    color: '#338CC5' },
  },
  {
    mild:    { id: 'zaduma',       label: 'Zaduma',       color: '#9FB2EC' },
    base:    { id: 'smutek',       label: 'Smutek',       color: '#6E89DE' },
    intense: { id: 'rozpacz',      label: 'Cierpienie',   color: '#4763BD' },
  },
  {
    mild:    { id: 'znudzenie',    label: 'Znudzenie',    color: '#CBA4EC' },
    base:    { id: 'wstręt',       label: 'Wstręt',       color: '#A878DC' },
    intense: { id: 'odraza',       label: 'Nienawiść',    color: '#8050C0' },
  },
  {
    mild:    { id: 'irytacja',     label: 'Irytacja',     color: '#F49C84' },
    base:    { id: 'złość',        label: 'Gniew',        color: '#E66A4E' },
    intense: { id: 'wściekłość',   label: 'Wściekłość',   color: '#C24428' },
  },
  {
    mild:    { id: 'ciekawość',    label: 'Ciekawość',    color: '#F6BE86' },
    base:    { id: 'oczekiwanie',  label: 'Oczekiwanie',  color: '#EA964B' },
    intense: { id: 'czujność',     label: 'Czujność',     color: '#C97222' },
  },
]

// Emocje mieszane: k = granica między płatkiem k i k+1
export const BLENDS = [
  { id: 'miłość',        label: 'Miłość',        color: '#C0D262', k: 0 },
  { id: 'uległość',      label: 'Uległość',      color: '#79C277', k: 1 },
  { id: 'trwoga',        label: 'Trwoga',        color: '#55BBC2', k: 2 },
  { id: 'rozczarowanie', label: 'Rozczarowanie', color: '#7B9BE4', k: 3 },
  { id: 'wyrzuty',       label: 'Żal',           color: '#8C77D2', k: 4 },
  { id: 'pogarda',       label: 'Pogarda',       color: '#C45C86', k: 5 },
  { id: 'agresja',       label: 'Agresja',       color: '#DB7A33', k: 6 },
  { id: 'optymizm',      label: 'Optymizm',      color: '#E8B040', k: 7 },
]

export const ALL_EMOTIONS = [
  ...PETALS.flatMap(p => [p.mild, p.base, p.intense]),
  ...BLENDS.map(({ id, label, color }) => ({ id, label, color })),
]

// Emocje należące do płatka i: 3 poziomy + mieszanki z lewym i prawym sąsiadem.
export function emocjePlatka(i) {
  const p = PETALS[i]
  return {
    poziomy: [p.mild, p.base, p.intense],
    mieszane: [BLENDS[(i + N - 1) % N], BLENDS[i]],
  }
}

function sector(r1, r2, startA, endA, gap = 0.02) {
  const a0 = startA + gap, a1 = endA - gap
  const c0 = Math.cos(a0), s0 = Math.sin(a0)
  const c1 = Math.cos(a1), s1 = Math.sin(a1)
  return `M${c0*r1},${s0*r1}L${c0*r2},${s0*r2}A${r2},${r2} 0 0 1 ${c1*r2},${s1*r2}L${c1*r1},${s1*r1}A${r1},${r1} 0 0 0 ${c0*r1},${s0*r1}Z`
}

const INK = 'rgba(16,14,10,.92)'
const POZIOM = ['łagodnie', 'średnio', 'mocno']

export default function EmotionWheel({ selected = new Set(), onToggle }) {
  const [otwarty, setOtwarty] = useState(null)
  const ileW = (i) => {
    const { poziomy, mieszane } = emocjePlatka(i)
    return [...poziomy, ...mieszane].filter(e => selected.has(e.id)).length
  }
  const akt = otwarty === null ? null : emocjePlatka(otwarty)
  const kolejnosc = PETALS.map((_, i) => i).sort((a, b) => (a === otwarty) - (b === otwarty))

  return (
    <div className="emo-wheel">
      <svg viewBox="-160 -160 320 320" role="group" aria-label="Koło emocji">
        {/* Płatki: otwarty rysujemy na końcu, żeby jego obwódka nie chowała się
            pod sąsiadem. Płatek nie powiększa się — wcześniej wystawał poza koło
            i zasłaniał podpis obok, co wyglądało jak zepsute koło. */}
        {kolejnosc.map(i => {
          const petal = PETALS[i]
          const startA = i * STEP - Math.PI / 2
          const on = otwarty === i
          const n = ileW(i)
          const przygas = otwarty !== null && !on
          return (
            <g key={petal.base.id} role="button" tabIndex={0} aria-pressed={on}
              aria-label={`${petal.base.label}${n ? `, wybrane: ${n}` : ''}`}
              onClick={() => setOtwarty(on ? null : i)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOtwarty(on ? null : i) } }}
              style={{ cursor: 'pointer' }}>
              <g style={{ opacity: przygas ? 0.35 : 1, transition: 'opacity .2s' }}>
                {/* trzy odcienie w jednym płatku — podpowiadają, że w środku są poziomy */}
                <path d={sector(116, RO, startA, startA + STEP)} fill={petal.mild.color} />
                <path d={sector(74, 116, startA, startA + STEP)} fill={petal.base.color} />
                <path d={sector(RI, 74, startA, startA + STEP)} fill={petal.intense.color} />
              </g>
              {(on || n > 0) && <path d={sector(RI + 1, RO - 1, startA, startA + STEP, 0.03)} fill="none" stroke="#fff" strokeWidth={on ? 3.5 : 2} strokeLinejoin="round" />}
            </g>
          )
        })}
        {/* Podpisy i liczniki w osobnej warstwie nad płatkami — nic ich nie zasłania */}
        <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {PETALS.map((petal, i) => {
            const midA = i * STEP - Math.PI / 2 + STEP / 2
            const n = ileW(i)
            // Podpis stoi poziomo; w płatkach u góry i u dołu odsuwamy go w bok,
            // żeby długie słowo („Oczekiwanie") nie wchodziło na sąsiada.
            const pion = Math.abs(Math.sin(midA)) > 0.9
            const lx = Math.cos(midA) * 100 + (pion ? Math.sign(Math.cos(midA)) * 8 : 0), ly = Math.sin(midA) * 100
            const przygas = otwarty !== null && otwarty !== i
            return (
              <g key={petal.base.id} style={{ opacity: przygas ? 0.5 : 1 }}>
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="700" fill={INK}>{petal.base.label}</text>
                {n > 0 && (
                  <>
                    <circle cx={Math.cos(midA) * 134} cy={Math.sin(midA) * 134} r="9" fill="#fff" />
                    <text x={Math.cos(midA) * 134} y={Math.sin(midA) * 134} textAnchor="middle" dominantBaseline="central"
                      fontSize="11" fontWeight="700" fill={INK}>{n}</text>
                  </>
                )}
              </g>
            )
          })}
        </g>
        <circle r={RI - 4} fill="var(--surface2)" stroke="var(--border)" />
        <text textAnchor="middle" dominantBaseline="central" fontSize="16" fontWeight="700" fill="var(--text)"
          style={{ pointerEvents: 'none' }}>{selected.size || ''}</text>
      </svg>

      {akt ? (
        <div className="emo-panel">
          <div className="emo-panel-lbl">Jak mocno?</div>
          <div className="emo-levels">
            {akt.poziomy.map((e, k) => {
              const on = selected.has(e.id)
              return (
                <button key={e.id} type="button" className={`emo-level${on ? ' on' : ''}`} style={{ '--c': e.color }}
                  aria-pressed={on} onClick={() => onToggle(e.id)}>
                  <span className="emo-level-name">{e.label}</span>
                  <span className="emo-level-sub">{POZIOM[k]}</span>
                </button>
              )
            })}
          </div>
          <div className="emo-panel-lbl">Albo coś pomiędzy</div>
          <div className="mood-chips">
            {akt.mieszane.map(e => (
              <button key={e.id} type="button" className={`mood-chip${selected.has(e.id) ? ' on' : ''}`} style={{ '--c': e.color }}
                aria-pressed={selected.has(e.id)} onClick={() => onToggle(e.id)}>{e.label}</button>
            ))}
          </div>
        </div>
      ) : (
        <p className="emo-hint">Dotknij koloru, żeby wybrać odcień emocji</p>
      )}
    </div>
  )
}
