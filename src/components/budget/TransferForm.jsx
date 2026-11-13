import { useState, useEffect } from 'react'
import { collection, orderBy, query, Timestamp, doc, increment, writeBatch } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { format } from 'date-fns'
import { fmt, getCurrencyCode, parseAmount } from '../../utils/currency'
import { byAccountOrder } from '../../utils/accountOrder'
import { rateFromAmounts, receivedFromRate, formatRateInput, formatRateLine } from '../../utils/exchange'
import { IconClose, IconTransfer, IconArrowDown } from '../Icons'
import { bladSubskrypcji } from '../../utils/polaczenie'

export default function TransferForm({ user, onClose }) {
  const [accounts, setAccounts] = useState([])
  const [fromId, setFromId]     = useState('')
  const [toId, setToId]         = useState('')
  const [amount, setAmount]     = useState('')
  const [amountTo, setAmountTo] = useState('')
  const [rate, setRate]         = useState('')
  const [exchange, setExchange] = useState(false)
  const [date, setDate]         = useState(format(new Date(), 'yyyy-MM-dd'))
  const [comment, setComment]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'accounts'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byAccountOrder)
      setAccounts(list)
      if (list.length >= 1) setFromId(list[0].id)
      if (list.length >= 2) setToId(list[1].id)
    }, bladSubskrypcji('accounts'))
  }, [user.uid])

  const fromAcc = accounts.find(a => a.id === fromId)
  const toAcc   = accounts.find(a => a.id === toId)
  const fromCur = fromAcc?.currency || getCurrencyCode()
  const toCur   = toAcc?.currency   || getCurrencyCode()
  // Konta w różnych walutach nie da się przelać „jeden do jednego" — wtedy
  // przewalutowanie jest wymuszone i przełącznika nie da się zgasić.
  const mustExchange = fromCur !== toCur
  const isExchange   = mustExchange || exchange

  // Przełącznik podąża za wyborem kont: różne waluty zapalają go same (przelew
  // 1:1 między PLN a EUR nie ma sensu), powrót do jednej waluty gasi i czyści
  // pola wymiany, żeby nie zostały po nim liczby z poprzedniego układu.
  useEffect(() => {
    setExchange(mustExchange)
    if (!mustExchange) { setAmountTo(''); setRate('') }
  }, [mustExchange])

  const toggleExchange = () => {
    if (mustExchange) return
    if (exchange) { setAmountTo(''); setRate('') }
    setExchange(!exchange)
  }

  // Trzy pola, dwa stopnie swobody: otrzymane = wysłane × kurs. Która para
  // jest wpisana, ta wygrywa — trzecie pole przelicza się samo. Dzięki temu
  // można wpisać „ile zeszło i ile przyszło" (i zobaczyć kurs) albo „ile zeszło
  // i po jakim kursie" (i zobaczyć, ile przyjdzie).
  const setSent = (v) => {
    setAmount(v)
    const s = parseAmount(v)
    const r = parseAmount(rate)
    const got = receivedFromRate(s, r)
    if (got != null) setAmountTo(String(got))
  }

  const setReceived = (v) => {
    setAmountTo(v)
    const r = rateFromAmounts(parseAmount(amount), parseAmount(v))
    if (r != null) setRate(formatRateInput(r))
  }

  const setRateValue = (v) => {
    setRate(v)
    const got = receivedFromRate(parseAmount(amount), parseAmount(v))
    if (got != null) setAmountTo(String(got))
  }

  const rateLine = isExchange
    ? formatRateLine(parseAmount(amount), parseAmount(amountTo), fromCur, toCur)
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fromId || !toId) { setError('Wybierz oba konta'); return }
    if (fromId === toId) { setError('Wybierz różne konta'); return }
    const amt = parseAmount(amount)
    if (!(amt > 0)) { setError('Podaj kwotę'); return }
    // Przy przewalutowaniu kwota docelowa jest osobną daną — bez niej nie
    // wiadomo, ile realnie wpłynęło na drugie konto.
    const amtTo = isExchange ? parseAmount(amountTo) : amt
    if (!(amtTo > 0)) { setError(`Podaj kwotę, która wpłynęła (${toCur})`); return }
    setSaving(true); setError('')
    const d = Timestamp.fromDate(new Date(date))
    const desc = comment.trim() || undefined
    const usedRate = isExchange ? rateFromAmounts(amt, amtTo) : null
    // Szczegóły wymiany trafiają też do opisu, bo to on jest widoczny na
    // liście transakcji — sama kwota jednej nogi nie mówi, co się wymieniło.
    const exchangeNote = isExchange ? ` · ${fmt(amt, fromCur)} → ${fmt(amtTo, toCur)}` : ''
    const shared = {
      category: 'Przelew', categoryId: 'transfer', categoryIcon: 'IconTransfer',
      transferComment: desc || '',
      isExchange,
      exchangeRate: usedRate,
      date: d, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    }
    try {
      // Atomowo: obie nogi przelewu + oba salda w jednym batchu
      const batch = writeBatch(db)
      batch.set(doc(collection(db, 'users', user.uid, 'transactions')), {
        ...shared,
        type: 'expense', amount: amt, currency: fromCur,
        description: `→ ${toAcc?.name}${exchangeNote}${desc ? ` · ${desc}` : ''}`,
        transferTo: toId, accountId: fromId,
      })
      batch.set(doc(collection(db, 'users', user.uid, 'transactions')), {
        ...shared,
        type: 'income', amount: amtTo, currency: toCur,
        description: `← ${fromAcc?.name}${exchangeNote}${desc ? ` · ${desc}` : ''}`,
        transferFrom: fromId, accountId: toId,
      })
      batch.update(doc(db, 'users', user.uid, 'accounts', fromId), { balance: increment(-amt) })
      batch.update(doc(db, 'users', user.uid, 'accounts', toId),   { balance: increment(amtTo) })
      await batch.commit()
      onClose()
    } catch { setError('Błąd zapisu'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IconTransfer size={18} /> {isExchange ? 'Przewalutowanie' : 'Przelew między kontami'}
          </h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        {accounts.length < 2 ? (
          <p style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
            Potrzebujesz co najmniej 2 konta.<br />Dodaj je w zakładce Konta.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label>Z konta</label>
              <select className="form-input" value={fromId} onChange={e => setFromId(e.target.value)}>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({fmt(a.balance || 0, a.currency)})
                  </option>
                ))}
              </select>
            </div>
            <div className="transfer-arrow"><IconArrowDown size={18} /></div>
            <div className="form-group">
              <label>Na konto</label>
              <select className="form-input" value={toId} onChange={e => setToId(e.target.value)}>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({fmt(a.balance || 0, a.currency)})
                  </option>
                ))}
              </select>
            </div>

            {/* Przełącznik przewalutowania */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Przewalutowanie</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  {mustExchange
                    ? `Konta w różnych walutach (${fromCur} → ${toCur}) — kwoty podajesz osobno`
                    : isExchange
                      ? 'Osobna kwota wysłana i otrzymana'
                      : 'Ta sama kwota schodzi i wpływa'}
                </p>
              </div>
              <button type="button" disabled={mustExchange}
                className={`bmi-toggle ${isExchange ? 'on' : ''}`}
                style={mustExchange ? { opacity: 0.6, cursor: 'default' } : undefined}
                onClick={toggleExchange} />
            </div>

            <div className="form-group">
              <label>{isExchange ? `Kwota z konta (${fromCur})` : `Kwota (${fromCur})`}</label>
              <input type="number" inputMode="decimal" step="0.01" min="0" className="form-input amount-input"
                value={amount} onChange={e => setSent(e.target.value)} />
            </div>

            {isExchange && (
              <>
                <div className="form-group">
                  <label>Kwota na konto ({toCur})</label>
                  <input type="number" inputMode="decimal" step="0.01" min="0" className="form-input amount-input"
                    value={amountTo} onChange={e => setReceived(e.target.value)}
                    placeholder="ile realnie wpłynęło" />
                </div>
                <div className="form-group">
                  <label>Kurs <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(1 {fromCur} = ile {toCur})</span></label>
                  <input type="number" inputMode="decimal" step="0.000001" min="0" className="form-input amount-input"
                    value={rate} onChange={e => setRateValue(e.target.value)}
                    placeholder="wpisz kurs zamiast kwoty" />
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                    {rateLine || 'Wpisz dwie z trzech wartości — trzecia przeliczy się sama.'}
                  </p>
                </div>
              </>
            )}

            <div className="form-group">
              <label>Data</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Komentarz (opcjonalny)</label>
              <input type="text" className="form-input" value={comment}
                onChange={e => setComment(e.target.value)} placeholder="np. rata kredytu, zasilenie..." maxLength={80} />
            </div>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? 'Zapisywanie...' : isExchange ? 'Przewalutuj' : 'Wykonaj przelew'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
