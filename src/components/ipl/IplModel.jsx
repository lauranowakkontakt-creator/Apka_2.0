import { pasmoStrefy, nazwaStrefy, czyAktywna } from '../../utils/iplLogic'
import {
  KSZTALTY, CZESCI, KLIPY, klipDlaStrefy, GLOWA, WIDOK,
  TWARZ_KSZTALTY, TWARZ_DEKORACJE, TWARZ_WIDOK, OBRYS_TWARZY,
} from './modelGeometria'

// Model ciała z przodu i osobna wstawka z twarzą: każda strefa to osobny kształt,
// który można dotknąć. Kolor strefy zależy od trybu (jak dawno / owłosienie /
// odrastanie) — im mocniejszy kolor akcentu, tym „więcej” danej rzeczy.

// Ile procent koloru akcentu dla kolejnych pasm. Brak danych = pusta strefa.
export const NASYCENIE = {
  ostatnio:   [95, 70, 46, 28],   // świeżo … dawno
  owlosienie: [24, 48, 72, 96],   // gładko … gęste
  odrastanie: [34, 66, 96],       // wolno … szybko
}
// Baza jest nieprzezroczysta (tło apki + odrobina tekstu), bo powierzchnie apki są
// półprzezroczyste: nakładające się kształty sumowałyby się i na biodrach
// i barkach wychodziły jaśniejsze plamy.
const BAZA = 'color-mix(in oklab, var(--text) 22%, var(--bg))'
export const wypelnienie = (pct) => pct == null
  ? BAZA
  : `color-mix(in oklab, var(--accent) ${pct}%, ${BAZA})`

function Ksztalt({ k, ...reszta }) {
  if (k.typ === 'ellipse') return <ellipse cx={k.cx} cy={k.cy} rx={k.rx} ry={k.ry} {...reszta} />
  if (k.typ === 'rect') return <rect x={k.x} y={k.y} width={k.w} height={k.h} {...reszta} />
  return <path d={k.d} {...reszta} />
}

// Wspólne dla ciała i twarzy: lista stref jako przyciski SVG + wyróżnienie wybranej.
function Strefy({ ksztalty, klip, ostatnie, tryb, dzis, wybrana, onPick, ukryte }) {
  const wejdz = (id) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick?.(id) } }
  // Wyłączone strefy w ogóle nie istnieją na rysunku — zostaje sama sylwetka.
  const wpisy = Object.entries(ksztalty).filter(([id]) => czyAktywna(id, ukryte))
  return (
    <>
      {wpisy.map(([id, k]) => {
        const pasmo = pasmoStrefy(tryb, ostatnie[id], dzis)
        const pct = pasmo == null ? null : NASYCENIE[tryb]?.[pasmo] ?? null
        return (
          <Ksztalt key={id} k={k} className="ipl-strefa" style={{ fill: wypelnienie(pct) }}
            clipPath={`url(#ipl-klip-${klip(id, k)})`}
            role="button" tabIndex={0} aria-label={nazwaStrefy(id)} aria-pressed={wybrana === id}
            onClick={() => onPick?.(id)} onKeyDown={wejdz(id)} />
        )
      })}
      {/* obrys wybranej strefy rysujemy na wierzchu, żeby sąsiedzi go nie zasłonili */}
      {wpisy.filter(([id]) => id === wybrana).map(([id, k]) => (
        <Ksztalt key={`w-${id}`} k={k} className="ipl-wybrana" clipPath={`url(#ipl-klip-${klip(id, k)})`} />
      ))}
    </>
  )
}

export default function IplModel({ ostatnie, tryb, dzis, wybrana, onPick, ukryte = [] }) {
  return (
    <svg className="ipl-model" viewBox={`0 0 ${WIDOK.w} ${WIDOK.h}`} role="group" aria-label="Model ciała z przodu — dotknij strefy">
      <defs>
        {Object.entries(KLIPY).map(([nazwa, czesci]) => (
          <clipPath key={nazwa} id={`ipl-klip-${nazwa}`}>
            {czesci.map(c => <path key={c} d={CZESCI[c]} />)}
          </clipPath>
        ))}
      </defs>

      {/* sylwetka: wypełnia szpary między strefami i daje czysty obrys */}
      <g className="ipl-tlo">
        <ellipse cx={GLOWA.cx} cy={GLOWA.cy} rx={GLOWA.rx} ry={GLOWA.ry} />
        {Object.entries(CZESCI).filter(([n]) => n !== 'szyja').map(([n, d]) => <path key={n} d={d} />)}
        <path d={CZESCI.szyja} />
      </g>

      <Strefy ksztalty={KSZTALTY} klip={klipDlaStrefy} ostatnie={ostatnie} tryb={tryb} dzis={dzis} wybrana={wybrana} onPick={onPick} ukryte={ukryte} />

      <text className="ipl-strona" x={14} y={14}>PRAWA</text>
      <text className="ipl-strona" x={WIDOK.w - 14} y={14} textAnchor="end">LEWA</text>
    </svg>
  )
}

export function IplTwarz({ ostatnie, tryb, dzis, wybrana, onPick, ukryte = [] }) {
  return (
    <svg className="ipl-twarz" viewBox={`0 0 ${TWARZ_WIDOK.w} ${TWARZ_WIDOK.h}`} role="group" aria-label="Twarz — dotknij strefy">
      <defs>
        <clipPath id="ipl-klip-twarz"><path d={OBRYS_TWARZY} /></clipPath>
      </defs>
      <path className="ipl-tlo-twarz" d={OBRYS_TWARZY} />
      <Strefy ksztalty={TWARZ_KSZTALTY} klip={() => 'twarz'} ostatnie={ostatnie} tryb={tryb} dzis={dzis} wybrana={wybrana} onPick={onPick} ukryte={ukryte} />
      <g className="ipl-dekoracja" aria-hidden="true">
        {TWARZ_DEKORACJE.oczy.map(([x, y]) => <ellipse key={x} cx={x} cy={y} rx={5.5} ry={2.8} />)}
        {TWARZ_DEKORACJE.brwi.map(d => <path key={d} d={d} fill="none" />)}
        <path d={TWARZ_DEKORACJE.nos} fill="none" />
        <path d={TWARZ_DEKORACJE.usta} fill="none" />
      </g>
    </svg>
  )
}
