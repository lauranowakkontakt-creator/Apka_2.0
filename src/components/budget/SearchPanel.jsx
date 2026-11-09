import { useState, useEffect } from 'react'
import { collection, query, orderBy } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

import { fmt } from '../../utils/currency'
import { CatIcon, IconClose, IconSearch } from '../Icons'
import { sortTransactionsByDate } from '../../utils/txSort'
import { bladSubskrypcji } from '../../utils/polaczenie'

export default function SearchPanel({ user, onClose, onEdit }) {
  const [all, setAll]           = useState([])
  const [search, setSearch]     = useState('')
  const [filterType, setType]   = useState('all')
  const [filterCat, setCat]     = useState('')

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'))
    return onSnapshot(q, snap => {
      setAll(sortTransactionsByDate(snap.docs.map(d => ({ id: d.id, ...d.data(), date: d.data().date?.toDate() }))))
    }, bladSubskrypcji('transactions'))
  }, [user.uid])

  const results = all.filter(t => {
    // Szukamy też w podkategoriach i w ukrytym opisie z wyciągu (np. „Biedronka", „Orlen")
    const q = search.trim().toLowerCase()
    const matchSearch = !q || [t.description, t.category, t.subcategoryLabel, t.subsubcategoryLabel, t.bankDescription, t.amount != null ? String(t.amount).replace('.', ',') : '']
      .some(v => v && String(v).toLowerCase().includes(q))
    const matchType = filterType === 'all' || t.type === filterType
    return matchSearch && matchType
  }).slice(0, 50)

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-tall">
        <div className="modal-header">
          <h3><IconSearch size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />Szukaj transakcji</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <div className="search-filters">
          <input type="text" className="form-input" placeholder="Szukaj po opisie lub kategorii..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <div className="type-toggle" style={{ marginTop: 8 }}>
            {['all','expense','income'].map(t => (
              <button key={t} type="button"
                className={`type-btn ${filterType === t ? 'active expense' : ''}`}
                style={filterType === t && t === 'income' ? { background: 'var(--income)' } : {}}
                onClick={() => setType(t)}
              >{{ all: 'Wszystkie', expense: 'Wydatki', income: 'Przychody' }[t]}</button>
            ))}
          </div>
        </div>
        <div className="search-results">
          {results.length === 0 && <p className="list-empty">Brak wyników</p>}
          {results.map(t => (
            <div key={t.id} className={`transaction-item ${t.type}`} role={onEdit ? 'button' : undefined} tabIndex={onEdit ? 0 : undefined}
              onClick={() => onEdit?.(t)} onKeyDown={e => { if (onEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onEdit(t) } }}
              style={onEdit ? { cursor: 'pointer' } : undefined}>
              <div className="t-icon"><CatIcon categoryId={t.categoryId} subcategoryId={t.subcategoryId} emoji={t.categoryIcon} size={20} /></div>
              <div className="t-details">
                <span className="t-category">{[t.category, t.subcategoryLabel, t.subsubcategoryLabel].filter(Boolean).join(' › ')}</span>
                {t.description && <span className="t-desc">{t.description}</span>}
                <span className="t-date">{t.date ? format(t.date, 'd MMM yyyy', { locale: pl }) : ''}</span>
              </div>
              <span className={`t-amount ${t.type}`}>{t.type === 'income' ? '+' : '-'}{fmt(t.amount, t.currency)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
