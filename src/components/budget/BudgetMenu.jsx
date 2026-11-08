import { useState, useRef, useEffect } from 'react'
import { IconSearch, IconTransfer, IconPrayer, IconBell, IconTag, IconUsers, IconRepeat } from '../Icons'

const IconUpload = (p) => (
  <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

export default function BudgetMenu({ onAction, privateMode }) {
  const [open, setOpen]         = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false) } }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const items = [
    { id: 'search',     Icon: IconSearch,   label: 'Szukaj transakcji' },
    { id: 'transfer',   Icon: IconTransfer, label: 'Przelew i przewalutowanie' },
    { id: 'regular',    Icon: IconRepeat,   label: 'Regularne płatności' },
    { id: 'tithe',      Icon: IconPrayer,   label: 'Dziesięcina' },
    { id: 'reminders',  Icon: IconBell,     label: 'Przypomnienia' },
    { id: 'debtors',    Icon: IconUsers,    label: 'Dłużnicy' },
    { id: 'categories', Icon: IconTag,      label: 'Zarządzaj kategoriami' },
    { id: 'import',     Icon: IconUpload,   label: 'Import danych' },
  ]

  const handle = (id) => {
    onAction(id)
    setOpen(false)
  }

  return (
    <div className="budget-menu-wrap" ref={ref}>
      <button className={`budget-menu-btn ${open ? 'active' : ''}`} onClick={() => setOpen(o => !o)}>
        ⋮
      </button>
      {open && (
        <div className="budget-menu-dropdown">
          {
            items.map(item => (
              <button key={item.id} className="budget-menu-item" onClick={() => handle(item.id)}>
                <span className="bmi-icon"><item.Icon size={16} /></span>
                <span className="bmi-label">{item.label}</span>
                {item.toggle && <span className={`bmi-toggle ${item.id === 'private' && privateMode ? 'on' : ''}`} />}
              </button>
            ))
          }
        </div>
      )}
    </div>
  )
}
