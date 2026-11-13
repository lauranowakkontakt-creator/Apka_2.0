import { useState, useEffect } from 'react'
import { collection, query, orderBy } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { format, getDaysInMonth } from 'date-fns'
import { pl } from 'date-fns/locale'
import { CatIcon, IconBell, IconClose } from '../Icons'
import { fmt } from '../../utils/currency'
import { bladSubskrypcji } from '../../utils/polaczenie'

export default function Reminders({ user, onClose }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading]   = useState(true)
  useFallbackTimeout(() => setLoading(false))

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'regularPayments'), orderBy('dayOfMonth', 'asc'))
    return onSnapshot(q, snap => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, bladSubskrypcji('regularPayments'))
  }, [user.uid])

  const today  = new Date()
  const todayDay = today.getDate()
  const thisMonth = format(today, 'LLLL yyyy', { locale: pl })

  const monthly = payments.filter(p => p.frequency === 'monthly')
  const sorted  = [...monthly].sort((a, b) => (a.dayOfMonth || 1) - (b.dayOfMonth || 1))

  const upcoming = sorted.filter(p => (p.dayOfMonth || 1) >= todayDay)
  const past     = sorted.filter(p => (p.dayOfMonth || 1) < todayDay)

  const daysUntil = (day) => Math.max(0, (day || 1) - todayDay)

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-tall">
        <div className="modal-header">
          <h3><IconBell size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Przypomnienia płatności</h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>

        {loading ? <div className="list-loading">Ładowanie...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {thisMonth} · dziś: {todayDay}
            </p>

            {payments.length === 0 ? (
              <div className="list-empty">
                <p>Brak regularnych płatności</p>
                <p className="list-empty-hint">Dodaj je w zakładce Regularne</p>
              </div>
            ) : (
              <>
                {upcoming.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                      Nadchodzące
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {upcoming.map(p => {
                        const days = daysUntil(p.dayOfMonth)
                        const isToday = days === 0
                        return (
                          <div key={p.id} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            background: isToday ? 'rgba(201,75,40,0.1)' : 'var(--surface)',
                            border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`,
                            borderRadius: 12, padding: '10px 14px'
                          }}>
                            <CatIcon categoryId={p.categoryId} emoji={p.categoryIcon} size={20} />
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.name}</p>
                              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                                {p.dayOfMonth}. każdego miesiąca
                              </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: p.type === 'income' ? '#27AE60' : 'var(--expense)' }}>
                                {p.type === 'income' ? '+' : '-'}{fmt(p.amount)}
                              </p>
                              <p style={{ margin: '2px 0 0', fontSize: 11, color: isToday ? 'var(--accent)' : 'var(--text-muted)', fontWeight: isToday ? 700 : 400 }}>
                                {isToday ? 'Dziś!' : `za ${days} ${days === 1 ? 'dzień' : 'dni'}`}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {past.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                      Ten miesiąc — minione
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {past.map(p => (
                        <div key={p.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 12, padding: '10px 14px', opacity: 0.6
                        }}>
                          <CatIcon categoryId={p.categoryId} emoji={p.categoryIcon} size={20} />
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.name}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                              {p.dayOfMonth}. każdego miesiąca
                            </p>
                          </div>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: p.type === 'income' ? '#27AE60' : 'var(--expense)' }}>
                            {p.type === 'income' ? '+' : '-'}{fmt(p.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {payments.filter(p => p.frequency !== 'monthly').length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                      Inne częstotliwości
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {payments.filter(p => p.frequency !== 'monthly').map(p => (
                        <div key={p.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 12, padding: '10px 14px'
                        }}>
                          <CatIcon categoryId={p.categoryId} emoji={p.categoryIcon} size={20} />
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.name}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                              {p.frequency === 'weekly' ? 'Co tydzień' : 'Co rok'}
                            </p>
                          </div>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: p.type === 'income' ? '#27AE60' : 'var(--expense)' }}>
                            {p.type === 'income' ? '+' : '-'}{fmt(p.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
