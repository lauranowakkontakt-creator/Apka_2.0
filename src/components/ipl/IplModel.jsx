import { pasmoStrefy, nazwaStrefy } from '../../utils/iplLogic'
import { KSZTALTY, OBRYS_TULOWIA, GLOWA, TWARZ, TWARZ_DEKORACJE, WIDOK, SRODEK } from './modelGeometria'

// Model ciała z przodu: każda strefa to osobny kształt, który można dotknąć.
// Kolor strefy zależy od trybu (jak dawno / owłosienie / odrastanie) — im
// mocniejszy kolor akcentu, tym „więcej” danej rzeczy.

// Ile procent koloru akcentu dla kolejnych pasm. Brak danych = pusta strefa.
export const NASYCENIE = {
  ostatnio:   [92, 64, 38, 20],   // świeżo … dawno
  owlosienie: [14, 38, 64, 92],   // gładko … gęste
  odrastanie: [30, 62, 92],       // wolno … szybko
}
export const wypelnienie = (pct) => pct == null ? 'var(--surface2)' : `color-mix(in oklab, var(--accent) ${pct}%, var(--surface2))`

export default function IplModel({ ostatnie, tryb, dzis, wybrana, onPick }) {
  const klik = (id) => () => onPick?.(id)
  const klawisz = (id) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick?.(id) }
  }

  return (
    <svg className="ipl-model" viewBox={`0 0 ${WIDOK.w} ${WIDOK.h}`} role="group" aria-label="Model ciała z przodu — dotknij strefy">
      <defs>
        <clipPath id="ipl-klip-tulow"><path d={OBRYS_TULOWIA} /></clipPath>
        <clipPath id="ipl-klip-twarz"><ellipse cx={TWARZ.cx} cy={TWARZ.cy} rx={TWARZ.rx} ry={TWARZ.ry} /></clipPath>
      </defs>

      {/* tło sylwetki — wypełnia szpary między strefami */}
      <ellipse className="ipl-tlo" cx={GLOWA.cx} cy={GLOWA.cy} rx={GLOWA.rx} ry={GLOWA.ry} />
      <path className="ipl-tlo" d={OBRYS_TULOWIA} />
      <ellipse className="ipl-tlo" cx={TWARZ.cx} cy={TWARZ.cy} rx={TWARZ.rx} ry={TWARZ.ry} />
      <TwarzDekoracje />

      {Object.entries(KSZTALTY).map(([id, k]) => {
        const pasmo = pasmoStrefy(tryb, ostatnie[id], dzis)
        const pct = pasmo == null ? null : NASYCENIE[tryb]?.[pasmo] ?? null
        const wspolne = {
          className: `ipl-strefa${wybrana === id ? ' wybrana' : ''}`,
          style: { fill: wypelnienie(pct) },
          role: 'button', tabIndex: 0, 'aria-label': nazwaStrefy(id),
          onClick: klik(id), onKeyDown: klawisz(id),
          clipPath: k.klip ? `url(#ipl-klip-${k.klip})` : undefined,
        }
        if (k.typ === 'ellipse') return <ellipse key={id} cx={k.cx} cy={k.cy} rx={k.rx} ry={k.ry} {...wspolne} />
        if (k.typ === 'rect') return <rect key={id} x={k.x} y={k.y} width={k.w} height={k.h} rx={k.rx} {...wspolne} />
        return <path key={id} d={k.d} {...wspolne} />
      })}

      <text className="ipl-strona" x={24} y={14}>PRAWA</text>
      <text className="ipl-strona" x={2 * SRODEK - 24} y={14} textAnchor="end">LEWA</text>
      <text className="ipl-strona" x={TWARZ.cx} y={150} textAnchor="middle">TWARZ</text>
    </svg>
  )
}

function TwarzDekoracje() {
  return (
    <g className="ipl-dekoracja" aria-hidden="true">
      {TWARZ_DEKORACJE.oczy.map(([x, y]) => <ellipse key={x} cx={x} cy={y} rx={4.5} ry={2.6} />)}
      <path d={TWARZ_DEKORACJE.nos} fill="none" />
      <path d={TWARZ_DEKORACJE.usta} fill="none" />
    </g>
  )
}
