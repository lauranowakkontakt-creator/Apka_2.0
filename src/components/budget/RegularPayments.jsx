import { useState, useEffect } from 'react'
import { collection, orderBy, query, doc } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { usunZCofnieciem } from '../../utils/usunZCofnieciem'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import { fmt } from '../../utils/currency'
import { CatIcon, IconEdit, IconTrash, IconCheck, IconCalendar, IconRepeat } from '../Icons'
import RegularPaymentForm from './RegularPaymentForm'
import { toast } from '../Toast'
import { periodKey, isPaymentActive, addTransactionForPayment, removeTransactionForPayment } from '../../utils/regularPayments'
import { bladSubskrypcji } from '../../utils/polaczenie'

const FREQ_LABELS = { monthly: 'miesięcznie', weekly: 'tygodniowo', yearly: 'rocznie' }

export default function RegularPayments({ user }) {
  const [payments, setPayments] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [showForm, setShowForm] = useState(false)
  const [editPayment, setEditPayment] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'regularPayments'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setPayments(list)
      setLoading(false)
    }, bladSubskrypcji('regularPayments'))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'accounts'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('accounts'))
  }, [user.uid])

  // Auto-księgowanie działa w tle (useRegularPaymentsProcessor w App.jsx),
  // tu obsługujemy tylko ręczne oznaczanie „Zrobione".
  // Bieżący okres zależy od częstotliwości płatności (miesiąc / tydzień ISO / rok).
  const markDone = async (p) => {
    try {
      await addTransactionForPayment(user.uid, p, periodKey(new Date(), p.frequency))
    } catch { toast.error('Błąd zapisu płatności') }
  }

  const markUndone = async (p) => {
    try {
      await removeTransactionForPayment(user.uid, p, periodKey(new Date(), p.frequency))
    } catch { toast.error('Błąd cofania płatności') }
  }

  const handleDelete = async (id) => {
    await usunZCofnieciem(doc(db, 'users', user.uid, 'regularPayments', id), 'Usunięto płatność')
  }

  const totalMonthly = payments
    .filter(p => p.frequency === 'monthly' && p.type === 'expense')
    .reduce((s, p) => s + p.amount, 0)

  const getAccount = (id) => accounts.find(a => a.id === id)

  const isActive = (p) => isPaymentActive(p)

  const fmtDate = (d) => format(parseISO(d), 'd MMM yyyy', { locale: pl })

  if (loading) return <div className="list-loading">Ładowanie...</div>

  return (
    <div className="regular-payments">
      {payments.length > 0 && (
        <div className="regular-summary">
          <span className="regular-summary-label">Suma stałych wydatków / miesiąc</span>
          <span className="regular-summary-amount">{fmt(totalMonthly)}</span>
        </div>
      )}

      <button className="btn-add-account" onClick={() => { setEditPayment(null); setShowForm(true) }}>
        + Dodaj płatność
      </button>

      {payments.length === 0 ? (
        <div className="list-empty">
          <p>Brak regularnych płatności</p>
          <p className="list-empty-hint">Dodaj np. czynsz, Spotify, abonament telefonu</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {payments.map(p => {
            const done    = p.donePeriods?.includes(periodKey(new Date(), p.frequency))
            const active  = isActive(p)
            const acc     = getAccount(p.accountId)
            const hasRange = p.dateFrom || p.dateTo
            return (
              <div key={p.id} style={{
                background: 'var(--surface)', border: `1px solid ${done ? '#27AE6040' : 'var(--border)'}`,
                borderLeft: `3px solid ${!active ? 'var(--border)' : done ? '#27AE60' : p.type === 'income' ? '#27AE60' : 'var(--expense)'}`,
                borderRadius: 12, padding: '12px 14px', opacity: !active ? 0.45 : done ? 0.75 : 1
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: p.type === 'income' ? 'rgba(98,195,156,0.15)' : 'rgba(224,101,60,0.15)',
                    border: `1px solid ${p.type === 'income' ? 'rgba(98,195,156,0.35)' : 'rgba(224,101,60,0.35)'}`,
                    color: p.type === 'income' ? 'var(--income)' : 'var(--expense)',
                  }}>
                    <CatIcon categoryId={p.categoryId} emoji={p.categoryIcon} size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                      {p.autoAdd && <span style={{ fontSize: 9, background: 'rgba(201,75,40,0.2)', color: 'var(--accent)', padding: '2px 5px', borderRadius: 4, fontWeight: 700 }}>AUTO</span>}
                      {done && <span style={{ fontSize: 9, background: 'rgba(39,174,96,0.2)', color: '#27AE60', padding: '2px 5px', borderRadius: 4, fontWeight: 700 }}>ZROBIONE</span>}
                      {!active && <span style={{ fontSize: 9, background: 'rgba(150,150,150,0.2)', color: 'var(--text-muted)', padding: '2px 5px', borderRadius: 4, fontWeight: 700 }}>NIEAKTYWNA</span>}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {p.category}{p.subcategoryLabel ? ` › ${p.subcategoryLabel}` : ''} · {FREQ_LABELS[p.frequency]}{p.frequency === 'monthly' ? ` (${p.dayOfMonth}.)` : ''}
                      {acc ? ` · ${acc.name}` : ''}
                    </span>
                    {hasRange && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                        <IconCalendar size={10} /> {p.dateFrom ? fmtDate(p.dateFrom) : '—'} → {p.dateTo ? fmtDate(p.dateTo) : 'bezterminowo'}
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: p.type === 'income' ? '#27AE60' : 'var(--expense)' }}>
                      {p.type === 'income' ? '+' : '-'}{fmt(p.amount)}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {active && !done && (
                        <button style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(39,174,96,0.15)', border: '1px solid #27AE6060', borderRadius: 6, color: '#27AE60', cursor: 'pointer', fontWeight: 600 }}
                          onClick={() => markDone(p)}>
                          <IconCheck size={10} /> Zrobione
                        </button>
                      )}
                      {done && (
                        <button style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer' }}
                          onClick={() => markUndone(p)}>
                          <IconRepeat size={11} /> Cofnij
                        </button>
                      )}
                      <button className="t-btn" onClick={() => { setEditPayment(p); setShowForm(true) }}><IconEdit size={13} /></button>
                      <button className="t-btn delete" onClick={() => handleDelete(p.id)}><IconTrash size={13} /></button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <RegularPaymentForm
          user={user}
          onClose={() => { setShowForm(false); setEditPayment(null) }}
          editData={editPayment}
        />
      )}
    </div>
  )
}
