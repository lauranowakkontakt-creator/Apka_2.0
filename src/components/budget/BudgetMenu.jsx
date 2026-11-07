import { useState, useRef, useEffect } from 'react'
import { CURRENCIES, getCurrencyCode, setCurrencyCode } from '../../utils/currency'
import { IconClose, IconSearch, IconTransfer, IconPrayer, IconBell, IconTag, IconCheck, IconUsers, IconRepeat, IconChart } from '../Icons'

const IconCurrency = (p) => (
  <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
)

const IconUpload = (p) => (
  <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

export default function BudgetMenu({ onAction, privateMode, onCurrencyChange }) {
  const [open, setOpen]         = useState(false)
  const [showCurrency, setShowCurrency] = useState(false)
  const [currentCurrency, setCurrentCurrency] = useState(getCurrencyCode())
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setShowCurrency(false) } }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const items = [
    { id: 'search',     Icon: IconSearch,   label: 'Szukaj transakcji' },
    { id: 'stats',      Icon: IconChart,    label: 'Statystyki i analiza' },
    { id: 'transfer',   Icon: IconTransfer, label: 'Przelew i przewalutowanie' },
    { id: 'regular',    Icon: IconRepeat,   label: 'Regularne płatności' },
    { id: 'tithe',      Icon: IconPrayer,   label: 'Dziesięcina' },
    { id: 'reminders',  Icon: IconBell,     label: 'Przypomnienia' },
    { id: 'debtors',    Icon: IconUsers,    label: 'Dłużnicy' },
    { id: 'categories', Icon: IconTag,      label: 'Zarządzaj kategoriami' },
    { id: 'import',     Icon: IconUpload,   label: 'Import danych' },
    { id: 'currency',   Icon: IconCurrency, label: `Waluta (${currentCurrency})` },
  ]

  const handle = (id) => {
    if (id === 'currency') { setShowCurrency(v => !v); return }
    onAction(id)
    setOpen(false)
  }

  const selectCurrency = (code) => {
    setCurrencyCode(code)
    setCurrentCurrency(code)
    setShowCurrency(false)
    setOpen(false)
    onCurrencyChange?.(code)
  }

  return (
    <div className="budget-menu-wrap" ref={ref}>
      <button className={`budget-menu-btn ${open ? 'active' : ''}`} onClick={() => setOpen(o => !o)}>
        ⋮
      </button>
      {open && (
        <div className="budget-menu-dropdown">
          {showCurrency ? (
            <>
              <div className="budget-menu-item" style={{ cursor: 'default', fontSize: 12, color: 'var(--text-muted)' }}>
                <span className="bmi-icon"><IconCurrency size={16} /></span>
                <span className="bmi-label">Wybierz walutę</span>
                <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  onClick={() => setShowCurrency(false)}><IconClose size={14} /></button>
              </div>
              {CURRENCIES.map(c => (
                <button key={c.code} className="budget-menu-item" onClick={() => selectCurrency(c.code)}>
                  <span className="bmi-icon" style={{ fontSize: 14, width: 22 }}>{c.symbol}</span>
                  <span className="bmi-label">{c.name}</span>
                  {c.code === currentCurrency && <IconCheck size={16} style={{ color: 'var(--accent)' }} />}
                </button>
              ))}
            </>
          ) : (
            items.map(item => (
              <button key={item.id} className="budget-menu-item" onClick={() => handle(item.id)}>
                <span className="bmi-icon"><item.Icon size={16} /></span>
                <span className="bmi-label">{item.label}</span>
                {item.toggle && <span className={`bmi-toggle ${item.id === 'private' && privateMode ? 'on' : ''}`} />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
