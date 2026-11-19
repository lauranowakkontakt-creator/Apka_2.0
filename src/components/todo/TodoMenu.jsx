import { useState, useRef, useEffect } from 'react'
import { IconMoreVert, IconChart, IconSearch, IconCheck, IconPlus, IconTag } from '../Icons'

// Menu „trzy kropki" dla To-do — spójne wizualnie z BudgetMenu/HabitMenu.
// Kryje: analizę, wyszukiwanie, ukończone, listy i nową listę, żeby belka była czysta.
export default function TodoMenu({ onAction }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const items = [
    { id: 'stats',   Icon: IconChart,  label: 'Analiza i statystyki' },
    { id: 'search',  Icon: IconSearch, label: 'Szukaj zadań' },
    { id: 'done',    Icon: IconCheck,  label: 'Ukończone zadania' },
    { id: 'lists',   Icon: IconTag,    label: 'Zarządzaj listami' },
    { id: 'newlist', Icon: IconPlus,   label: 'Nowa lista' },
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
