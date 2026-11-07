import { useRef, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconEye, IconEyeOff } from '../Icons'
import { splitAmount } from '../../utils/currency'
import { nazwaWaluty } from '../../utils/heroWaluty'

// Główna karta Finansów w stylu Revolut: jedna waluta na raz, strzałki
// po bokach, kropki pod spodem i przesuwanie palcem. Ostatnio oglądana
// waluta jest zapamiętywana na tym urządzeniu.

const KLUCZ = 'mw_heroWaluta'
const symbol = (cur) => {
  try {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: cur }).formatToParts(0).find(p => p.type === 'currency')?.value || cur
  } catch { return cur }
}
const kwota = (n, cur) => {
  try { return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: cur }).format(n) } catch { return `${n} ${cur}` }
}
const odmKonta = (n) => n === 1 ? 'konto' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'konta' : 'kont'

export default function HeroWaluty({ slajdy, privateMode, onTogglePrivate, investedMonth = 0 }) {
  const [idx, setIdx] = useState(() => {
    try { const z = localStorage.getItem(KLUCZ); const i = slajdy.findIndex(s => s.id === z); return i >= 0 ? i : 0 } catch { return 0 }
  })
  const i = Math.min(idx, slajdy.length - 1)
  const idz = (n) => {
    const nowy = Math.max(0, Math.min(slajdy.length - 1, n))
    setIdx(nowy)
    try { localStorage.setItem(KLUCZ, slajdy[nowy].id) } catch { /* tryb prywatny */ }
  }
  const start = useRef(null)
  const [drag, setDrag] = useState(0)
  const onDown = (e) => { start.current = { x: e.clientX, y: e.clientY } }
  const onMove = (e) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    if (Math.abs(dx) > Math.abs(e.clientY - start.current.y)) setDrag(dx)
  }
  const onUp = () => {
    if (start.current && Math.abs(drag) > 45) idz(i + (drag < 0 ? 1 : -1))
    start.current = null; setDrag(0)
  }
  const wiele = slajdy.length > 1

  return (
    <div className="hw">
      <button className="rev-hero-label" onClick={onTogglePrivate} title={privateMode ? 'Pokaż kwoty' : 'Ukryj kwoty'}>
        {slajdy[i]?.inwestycje ? 'Inwestycje · szacunkowo' : `Konta w ${nazwaWaluty(slajdy[i]?.waluta)}`}
        {privateMode ? <IconEye size={14} /> : <IconEyeOff size={14} />}
      </button>

      <div className="hw-row">
        {wiele && (
          <button type="button" className="hw-arrow" onClick={() => idz(i - 1)} disabled={i === 0} aria-label="Poprzednia waluta">
            <IconChevronLeft size={18} />
          </button>
        )}
        <div className="hw-viewport" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}>
          <div className="hw-track" style={{ transform: `translateX(calc(${-i * 100}% + ${drag}px))`, transition: drag ? 'none' : undefined }}>
            {slajdy.map(s => {
              const a = splitAmount(s.saldo)
              return (
                <div key={s.id} className="hw-slide" aria-hidden={s !== slajdy[i]}>
                  {privateMode ? <div className="rev-hero-hidden">••••</div> : (
                    <>
                      <div className="rev-hero-amount">
                        <span className="rev-hero-int">{a.int}</span>
                        <span className="rev-hero-dec">,{a.dec}&nbsp;{symbol(s.waluta)}</span>
                      </div>
                      {s.inwestycje ? (
                        <div className="hw-sub">
                          {Object.entries(s.inwestycje).filter(([c]) => c !== s.waluta).map(([c, v]) => <span key={c} className="rev-hero-chip">{kwota(v, c)}</span>)}
                          <span className="hw-note">{s.konta} {odmKonta(s.konta)} · wartość z sald kont, nie liczy się do majątku</span>
                        </div>
                      ) : (
                        <div className="hw-sub">
                          <span className={`rev-hero-trend ${s.zmiana >= 0 ? 'up' : 'down'}`}>
                            {s.zmiana >= 0 ? '↑' : '↓'} {kwota(Math.abs(s.zmiana), s.waluta)}
                            <span className="sep">· ten miesiąc</span>
                            {s.waluta === 'PLN' && investedMonth > 0 && <span className="sep">· zainwestowane {kwota(investedMonth, 'PLN')}</span>}
                          </span>
                          <span className="hw-note">{s.konta} {odmKonta(s.konta)}{s.wplywy || s.wydatki ? ` · +${kwota(s.wplywy, s.waluta)} / −${kwota(s.wydatki, s.waluta)}` : ''}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        {wiele && (
          <button type="button" className="hw-arrow" onClick={() => idz(i + 1)} disabled={i === slajdy.length - 1} aria-label="Następna waluta">
            <IconChevronRight size={18} />
          </button>
        )}
      </div>

      {wiele && (
        <div className="hw-dots" role="tablist">
          {slajdy.map((s, k) => (
            <button type="button" key={s.id} role="tab" aria-selected={k === i} className={`hw-dot${k === i ? ' on' : ''}`}
              onClick={() => idz(k)} aria-label={s.inwestycje ? 'Inwestycje' : s.waluta}>
              <span>{s.inwestycje ? 'Inwest.' : s.waluta}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
