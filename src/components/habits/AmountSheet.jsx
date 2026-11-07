import { useState } from 'react'
import { IconClose, IconCheck, IconTrash } from '../Icons'
import { formatAmount, amountStep, unitMeta, dayAmount, szybkieDodatki, liczbaZPola } from '../../utils/habitLogic'

// Okno ustawiania wykonania dla nawyku na czas albo ilość.
//
// W karcie dnia nie ma miejsca na „−", pole i „+" — próba wciśnięcia ich tam
// przycinała nazwy nawyków do „Czas z B…". Sam pierścień z kolei dodaje skok,
// ale nie pozwala odjąć ani wpisać konkretnej liczby. Dlatego precyzja mieszka
// tutaj: otwiera się kliknięciem w liczbę przy nazwie.
export default function AmountSheet({ habit, dateStr, onSet, onClose }) {
  const target = Number(habit.target) || 0
  const unit   = habit.unit || 'szt'
  const skok   = amountStep(target, unit)
  const color  = habit.color || 'var(--accent)'
  // Pole trzyma TEKST, a liczbę liczymy z niego. Wcześniej trzymało liczbę,
  // więc wyczyszczone pole od razu wracało do „0" i każda wpisana cyfra lądowała
  // za tym zerem („045"). Pusty dzień zaczyna od pustego pola.
  const [tekst, setTekst] = useState(() => { const v = dayAmount(habit, dateStr); return v > 0 ? String(v) : '' })
  const wartosc = liczbaZPola(tekst)
  const setWartosc = (f) => setTekst(t => {
    const v = Math.max(0, Math.round(typeof f === 'function' ? f(liczbaZPola(t)) : f))
    return v > 0 ? String(v) : ''
  })

  const zapisz = (v) => {
    const liczba = Math.max(0, Math.round(Number(v) || 0))
    onSet(habit, dateStr, liczba)
    onClose()
  }

  const pct = target > 0 ? Math.min(100, Math.round((wartosc / target) * 100)) : 0

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 360 }}>
        <div className="modal-header">
          <h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>

        <div className="form">
          <p className="pause-info" style={{ marginBottom: 14 }}>
            Cel na dzień: {formatAmount(target, unit)}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <button type="button" className="icon-btn" disabled={wartosc <= 0}
              onClick={() => setWartosc(w => Math.max(0, w - skok))}
              title={`−${formatAmount(skok, unit)}`}
              style={{ width: 44, height: 44, fontSize: 20, flexShrink: 0 }}>−</button>

            <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
              <input
                type="text" inputMode="numeric" value={tekst} placeholder="0" autoFocus
                aria-label={`Ile (${unitMeta(unit).label})`}
                onChange={(e) => setTekst(e.target.value.replace(/[^\d.,]/g, ''))}
                onFocus={(e) => e.target.select()}
                style={{
                  width: '100%', textAlign: 'center', fontSize: 30, fontWeight: 700,
                  background: 'none', border: 'none', color: 'var(--text)',
                  fontFamily: 'inherit', padding: 0,
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -2 }}>
                {unitMeta(unit).label}{target > 0 ? ` · ${pct}% celu` : ''}
              </div>
            </div>

            <button type="button" className="icon-btn"
              onClick={() => setWartosc(w => w + skok)}
              title={`+${formatAmount(skok, unit)}`}
              style={{ width: 44, height: 44, fontSize: 20, flexShrink: 0 }}>+</button>
          </div>

          {/* Szybkie dodawanie — każdy klik dokłada do tego, co już jest. */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {szybkieDodatki(unit).map(d => (
              <button key={d.v} type="button" className="btn-outline"
                style={{ flex: '1 1 0', minWidth: 52, padding: '8px 0', fontWeight: 700, color: color, borderColor: `color-mix(in oklab, ${color} 45%, var(--border))` }}
                onClick={() => setWartosc(w => w + d.v)}>
                {d.label}
              </button>
            ))}
          </div>

          {/* Pasek postępu — ten sam język co pierścień w liście dnia. */}
          <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .2s' }} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button type="button" className="btn-outline" style={{ flex: 1 }}
              onClick={() => setWartosc(target)}>
              <IconCheck size={14} /> Cały cel
            </button>
            <button type="button" className="btn-outline" style={{ flex: 1 }}
              onClick={() => setWartosc(0)}>
              <IconTrash size={14} /> Wyczyść
            </button>
          </div>

          {/* Przycisk mówi, CO zapisze — po „Wyczyść" widać, że zapisze zero,
              zamiast zostawiać wątpliwość, czy zmiana w ogóle weszła. */}
          <button className="btn-save" onClick={() => zapisz(wartosc)}>
            {wartosc > 0 ? `Zapisz ${formatAmount(wartosc, unit)}` : 'Zapisz — nic dziś'}
          </button>
        </div>
      </div>
    </div>
  )
}
