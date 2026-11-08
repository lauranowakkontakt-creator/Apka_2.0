import { useState, useRef, useEffect } from 'react'
import { IconPause, IconReorder, IconMoreVert, IconChart, IconClock, IconEdit, IconArchive, IconRepeat } from '../Icons'

// Menu „trzy kropki" dla Nawyków — spójne wizualnie z BudgetMenu (te same klasy CSS).
// Kryje opcje Pauza i Kolejność, żeby nagłówek był czysty (tylko + i ⋮).
export default function HabitMenu({ onAction, canReorder = true, hasArchive = false, canFresh = false, extras = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Na ekranie Wyzwań zostaje tylko to, co tam ma sens: rutyny, „Zacznij od
  // nowa" i analiza dotyczą nawyków (Wyzwania mają własną zakładkę Statystyki).
  const items = extras ? [
    { id: 'manage',  Icon: IconEdit,    label: 'Edytuj nawyki i wyzwania' },
    { id: 'pause',   Icon: IconPause,   label: 'Pauza (wyjazd / choroba)' },
    ...(canReorder ? [{ id: 'reorder', Icon: IconReorder, label: 'Kolejność wyzwań' }] : []),
    ...(hasArchive ? [{ id: 'archive', Icon: IconArchive, label: 'Ukończone i archiwum' }] : []),
  ] : [
    // Edycja nawyków mieszka tutaj — obejmuje też te jeszcze nierozpoczęte,
    // których lista dnia w ogóle nie pokazuje.
    { id: 'manage',   Icon: IconEdit,    label: 'Edytuj nawyki' },
    { id: 'stats',    Icon: IconChart,   label: 'Analiza i statystyki' },
    { id: 'routines', Icon: IconClock,   label: 'Rutyny (części dnia)' },
    { id: 'pause',    Icon: IconPause,   label: 'Pauza (wyjazd / choroba)' },
    ...(canReorder ? [{ id: 'reorder', Icon: IconReorder, label: 'Kolejność nawyków' }] : []),
    // Ukończone + archiwum tylko wtedy, gdy jest co pokazać — pusta pozycja w menu myli.
    ...(hasArchive ? [{ id: 'archive', Icon: IconArchive, label: 'Ukończone i archiwum' }] : []),
    // Zamknięcie rozdziału ma sens tylko wtedy, gdy jest co zamykać.
    ...(canFresh ? [{ id: 'fresh', Icon: IconRepeat, label: 'Zacznij od nowa' }] : []),
  ]

  const handle = (id) => { onAction(id); setOpen(false) }

  return (
    <div className="budget-menu-wrap" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen(o => !o)} title="Więcej"
        style={open ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}>
        <IconMoreVert size={18} />
      </button>
      {open && (
        <div className="budget-menu-dropdown">
          {items.map(item => (
            <button key={item.id} className="budget-menu-item" onClick={() => handle(item.id)}>
              <span className="bmi-icon"><item.Icon size={16} /></span>
              <span className="bmi-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
