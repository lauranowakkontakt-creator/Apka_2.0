import { doc, increment, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { fmt } from '../utils/currency'
import { CatIcon, IconEdit, IconTrash, IconBank } from './Icons'
import { confirmDialog } from './ConfirmModal'
import { toast } from './Toast'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, isTransfer } from '../utils/categories'

const ALL_CATS = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES]
const getCatColor = (id, type) => ALL_CATS.find(c => c.id === id)?.color || (type === 'income' ? '#5FBF98' : '#E0673E')

const hide = '••••'

export default function TransactionList({
  transactions, accounts = [], loading, onEdit, user, privateMode,
  emptyText = 'Brak transakcji w tym miesiącu',
  emptyHint = 'Kliknij + aby dodać pierwszą',
  // W historii konkretnego konta nazwa konta przy każdym wierszu to szum —
  // wszystkie transakcje i tak są z tego samego portfela.
  showAccount = true,
}) {
  const accName = (id) => accounts.find(a => a.id === id)?.name
  const handleDelete = async (t) => {
    const ok = await confirmDialog({ title: 'Usunąć transakcję?', message: 'Ta operacja jest nieodwracalna.' })
    if (!ok) return
    try {
      // Atomowo: usunięcie transakcji + cofnięcie salda w jednym batchu
      const batch = writeBatch(db)
      batch.delete(doc(db, 'users', user.uid, 'transactions', t.id))
      // Konto transakcji mogło zostać usunięte — update na nieistniejącym
      // dokumencie wywala cały batch i transakcji nie dałoby się usunąć.
      // Sprawdzamy istnienie po wczytanej liście kont (bez strzału do sieci,
      // który przy słabym połączeniu potrafił zawisnąć i blokować usuwanie).
      if (t.accountId && accounts.some(a => a.id === t.accountId)) {
        const reversal = t.type === 'income' ? -t.amount : t.amount
        batch.update(doc(db, 'users', user.uid, 'accounts', t.accountId), { balance: increment(reversal) })
      }
      await batch.commit()
    } catch {
      toast.error('Błąd usuwania transakcji')
    }
  }

  if (loading) return <div className="list-loading">Ładowanie...</div>

  if (transactions.length === 0) {
    return (
      <div className="list-empty">
        <p>{emptyText}</p>
        {emptyHint && <p className="list-empty-hint">{emptyHint}</p>}
      </div>
    )
  }

  // Group by date
  const groups = []
  const seen = {}
  for (const t of transactions) {
    const key = format(t.date, 'yyyy-MM-dd')
    if (!seen[key]) {
      seen[key] = { key, label: format(t.date, 'EEEE · d MMM', { locale: pl }), items: [], sum: 0 }
      groups.push(seen[key])
    }
    seen[key].items.push(t)
    if (!isTransfer(t)) seen[key].sum += t.type === 'income' ? t.amount : -t.amount
  }

  const fmtSum = (s) => {
    const sign = s >= 0 ? '+' : '−'
    return `${sign}${fmt(Math.abs(s))}`
  }

  return (
    <div className="transaction-list">
      {groups.map(group => (
        <div key={group.key} className="tx-date-group">
          <div className="tx-date-header">
            <span className="tx-date-label">{group.label}</span>
            {!privateMode && (
              <span className="tx-date-sum" style={{ color: group.sum >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                {fmtSum(group.sum)}
              </span>
            )}
          </div>
          <div className="tx-group-body">
            {group.items.map(t => {
              const catColor = getCatColor(t.categoryId, t.type)
              return (
                <div key={t.id} className={`transaction-item ${t.type}`} style={{ borderLeft: `3px solid ${catColor}66` }}>
                  <div className="t-icon" style={{
                    background: catColor + '20',
                    border: `1px solid ${catColor}44`,
                    color: catColor,
                  }}>
                    <CatIcon categoryId={t.categoryId} subcategoryId={t.subcategoryId} emoji={t.categoryIcon} size={18} />
                  </div>
                  <div className="t-details">
                    <span className="t-category">
                      {t.category}{t.subcategoryLabel ? <span style={{ opacity: 0.7 }}> › {t.subcategoryLabel}{t.subsubcategoryLabel ? ` › ${t.subsubcategoryLabel}` : ''}</span> : ''}
                    </span>
                    {t.description && <span className="t-desc">{t.description}</span>}
                    {showAccount && accName(t.accountId) && (
                      <span className="t-desc" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, opacity: 0.85 }}>
                        <IconBank size={10} /> {accName(t.accountId)}
                      </span>
                    )}
                  </div>
                  <div className="t-right">
                    <span className={`t-amount ${t.type}`}>
                      {privateMode ? hide : `${t.type === 'income' ? '+' : '-'}${fmt(t.amount, t.currency)}`}
                    </span>
                    <div className="t-actions">
                      <button className="t-btn edit" onClick={() => onEdit(t)}><IconEdit size={13} /></button>
                      <button className="t-btn delete" onClick={() => handleDelete(t)}><IconTrash size={13} /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
