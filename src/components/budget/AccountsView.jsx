import { useState, useEffect } from 'react'
import { collection, orderBy, query, deleteDoc, doc, updateDoc, where, Timestamp } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { format, subMonths, startOfMonth } from 'date-fns'
import { pl } from 'date-fns/locale'
import AccountForm from './AccountForm'
import AccountReorderModal from './AccountReorderModal'
import TransactionForm from '../TransactionForm'
import TransactionList from '../TransactionList'
import CurrencyTiles from './CurrencyTiles'
import { fmt, parseAmount } from '../../utils/currency'
import { IconBank, IconCash, IconCard, IconSavings, IconTrendUp, IconTrendDown, IconEdit, IconTrash, IconEye, IconEyeOff, IconChevronLeft, IconReorder, IconClose } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { toast } from '../Toast'
import { sortTransactionsByDate } from '../../utils/txSort'
import { byAccountOrder } from '../../utils/accountOrder'
import { isTransfer } from '../../utils/categories'
import { isInvestment, investmentStats, sumByCurrency, mergeTotals, historyWithDeltas, investmentChartData } from '../../utils/investmentMath'
import { LineAreaSVG } from '../ChartPrimitives'
import { bladSubskrypcji } from '../../utils/polaczenie'

const fmtAcc = (n, currency = 'PLN') =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(n)

const ACCOUNT_ICON_COMPS = {
  bank: IconBank, cash: IconCash, card: IconCard,
  revolut: IconCard, savings: IconSavings, investment: IconSavings
}

export default function AccountsView({ user, privateMode }) {
  const [accounts, setAccounts]   = useState([])
  const [loading, setLoading]     = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [showForm, setShowForm]   = useState(false)
  const [editAccount, setEditAccount] = useState(null)
  const [selected, setSelected]   = useState(null)
  const [showReorder, setShowReorder] = useState(false)
  const storageKey = `excludedAccounts_${user.uid}`
  const [excludedFromTotal, setExcludedFromTotal] = useState(() => {
    try { const s = localStorage.getItem(`excludedAccounts_${user.uid}`); return s ? JSON.parse(s) : [] } catch { return [] }
  })

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'accounts'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, bladSubskrypcji('accounts'))
  }, [user.uid])

  // Rozdzielamy zwykłe konta od inwestycji (krypto, surowce itp.) — inwestycje
  // mają osobną sekcję i osobną sumę, a na końcu wiersz „Razem".
  const regularAccounts    = accounts.filter(a => !isInvestment(a))
  const investmentAccounts = accounts.filter(isInvestment)
  const orderedRegular      = [...regularAccounts].sort(byAccountOrder)
  const orderedInvestments  = [...investmentAccounts].sort(byAccountOrder)

  const includedRegular      = regularAccounts.filter(a => !excludedFromTotal.includes(a.id))
  const includedInvestments  = investmentAccounts.filter(a => !excludedFromTotal.includes(a.id))

  const totalsByCurrency     = sumByCurrency(includedRegular)
  const investTotalsByCurrency = sumByCurrency(includedInvestments)
  const grandTotalByCurrency = mergeTotals(totalsByCurrency, investTotalsByCurrency)

  const toggleExcluded = (id, e) => {
    e.stopPropagation()
    setExcludedFromTotal(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    const ok = await confirmDialog({ title: 'Usunąć konto?', message: 'Historia transakcji zostanie zachowana.' })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'accounts', id))
    if (selected?.id === id) setSelected(null)
    setExcludedFromTotal(prev => {
      const next = prev.filter(x => x !== id)
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
      return next
    })
  }

  if (loading) return <div className="list-loading">Ładowanie...</div>

  if (selected) {
    // Po zapisie snapshotu chcemy widzieć świeże dane — bierzemy z listy.
    const live = accounts.find(a => a.id === selected.id) || selected
    if (isInvestment(live)) {
      return (
        <InvestmentDetail
          user={user}
          account={live}
          privateMode={privateMode}
          onBack={() => setSelected(null)}
          onEdit={() => { setEditAccount(live); setShowForm(true) }}
        />
      )
    }
    return (
      <AccountHistory
        user={user}
        account={live}
        accounts={accounts}
        privateMode={privateMode}
        onBack={() => setSelected(null)}
        onEdit={() => { setEditAccount(live); setShowForm(true) }}
      />
    )
  }

  // Kafelek sumy w danej walucie (jeden wynik, wiele walut lub prywatny tryb).
  const renderTotalAmount = (totals) => {
    if (privateMode) return <span className="accounts-total-amount">••••</span>
    const keys = Object.keys(totals)
    if (keys.length === 0) return <span className="accounts-total-amount">{fmtAcc(0)}</span>
    if (keys.length === 1) return <span className="accounts-total-amount">{fmtAcc(Object.values(totals)[0], keys[0])}</span>
    return <CurrencyTiles totals={totals} privateMode={privateMode} />
  }

  const renderAccountRow = (acc, { footer = null } = {}) => {
    const excluded = excludedFromTotal.includes(acc.id)
    const color = acc.color || '#3B82F6'
    const balance = acc.balance || 0
    const Ic = ACCOUNT_ICON_COMPS[acc.type] || IconBank
    return (
      <div key={acc.id} onClick={() => setSelected(acc)} style={{
        opacity: excluded ? 0.45 : 1,
        background: `linear-gradient(135deg, ${color}08 0%, var(--surface) 60%)`,
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${color}`,
        borderRadius: 'var(--r)',
        padding: '7px 12px',
        display: 'flex', flexDirection: 'column', gap: footer ? 6 : 0,
        cursor: 'pointer', transition: 'background .15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(135deg, ${color}14 0%, var(--surface2) 60%)`}
        onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg, ${color}08 0%, var(--surface) 60%)`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: color + '22', border: `1px solid ${color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color
          }}>
            <Ic size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc.name}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 1 }}>{acc.typeName || acc.type}</div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', flexShrink: 0, whiteSpace: 'nowrap', color: balance >= 0 ? 'var(--income)' : 'var(--expense)' }}>
            {privateMode ? '••••' : fmtAcc(balance, acc.currency || 'PLN')}
          </div>
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button className="t-btn" title={excluded ? 'Uwzględnij w sumie' : 'Wyklucz z sumy'} onClick={(e) => toggleExcluded(acc.id, e)}>
              {excluded ? <IconEyeOff size={13} /> : <IconEye size={13} />}
            </button>
            <button className="t-btn" onClick={(e) => { e.stopPropagation(); setEditAccount(acc); setShowForm(true) }}><IconEdit size={13} /></button>
            <button className="t-btn delete" onClick={(e) => handleDelete(acc.id, e)}><IconTrash size={13} /></button>
          </div>
        </div>
        {footer}
      </div>
    )
  }

  const hasInvestments = investmentAccounts.length > 0
  const hasRegular     = regularAccounts.length > 0

  return (
    <div className="accounts-view">
      <div className="accounts-total">
        <span className="accounts-total-label">
          Suma kont{excludedFromTotal.length > 0 ? ` (${includedRegular.length}/${regularAccounts.length})` : ''}
          {accounts.length > 1 && (
            <button className="t-btn" title="Zmień kolejność kont" onClick={() => setShowReorder(true)}
              style={{ marginLeft: 8, verticalAlign: 'middle' }}>
              <IconReorder size={14} />
            </button>
          )}
        </span>
        {renderTotalAmount(totalsByCurrency)}
      </div>

      {accounts.length === 0 ? (
        <div className="list-empty">
          <p>Brak kont</p>
          <p className="list-empty-hint">Dodaj konto przyciskiem poniżej</p>
        </div>
      ) : hasRegular ? (
        <div className="accounts-list">
          {orderedRegular.map(acc => renderAccountRow(acc))}
        </div>
      ) : null}

      {/* Inwestycje (krypto, surowce...) — osobna sekcja z własną sumą */}
      {hasInvestments && (
        <>
          <div className="accounts-total" style={{ marginTop: 14 }}>
            <span className="accounts-total-label">Inwestycje</span>
            {renderTotalAmount(investTotalsByCurrency)}
          </div>
          <div className="accounts-list">
            {orderedInvestments.map(acc => {
              const { profit, percent } = investmentStats(acc)
              const up = profit >= 0
              const footer = privateMode ? null : (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderTop: '1px dashed var(--border)', paddingTop: 6, fontSize: 12, fontWeight: 600,
                }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>
                    {up ? 'Zysk' : 'Strata'}
                  </span>
                  <span style={{ color: up ? 'var(--income)' : 'var(--expense)', whiteSpace: 'nowrap' }}>
                    {up ? '+' : '−'}{fmtAcc(Math.abs(profit), acc.currency || 'PLN')}
                    {percent != null && <span style={{ opacity: 0.85 }}> ({up ? '+' : '−'}{Math.abs(percent).toFixed(1)}%)</span>}
                  </span>
                </div>
              )
              return renderAccountRow(acc, { footer })
            })}
          </div>
        </>
      )}

      {/* Razem: konta + inwestycje */}
      {hasInvestments && hasRegular && (
        <div className="accounts-total" style={{ marginTop: 14, borderTop: '2px solid var(--border)', paddingTop: 10 }}>
          <span className="accounts-total-label" style={{ fontWeight: 700 }}>Razem</span>
          {renderTotalAmount(grandTotalByCurrency)}
        </div>
      )}

      <button className="btn-add-account" onClick={() => { setEditAccount(null); setShowForm(true) }}>+ Dodaj konto</button>

      {showForm && (
        <AccountForm
          user={user}
          onClose={() => { setShowForm(false); setEditAccount(null) }}
          editData={editAccount}
        />
      )}

      {showReorder && (
        <AccountReorderModal
          user={user}
          accounts={accounts}
          onClose={() => setShowReorder(false)}
        />
      )}
    </div>
  )
}

// Szczegóły inwestycji (krypto, surowce...): aktualna wartość vs wpłacone,
// zysk/strata oraz aktualizacja wartości z historią pomiarów. Bez transakcji.
function InvestmentDetail({ user, account, privateMode, onBack, onEdit }) {
  const [showUpdate, setShowUpdate] = useState(false)
  const cur = account.currency || 'PLN'
  const { value, invested, profit, percent } = investmentStats(account)
  const up = profit >= 0
  const history = historyWithDeltas(account.valueHistory || [])
  const chart = investmentChartData(account.valueHistory || [], d => format(d, 'd MMM', { locale: pl }))

  const saveUpdate = async ({ newValue, deposit }) => {
    const nextInvested = (account.invested || 0) + (deposit || 0)
    const snapshot = { date: Timestamp.now(), value: newValue, invested: nextInvested }
    const prevHist = Array.isArray(account.valueHistory) ? account.valueHistory : []
    await updateDoc(doc(db, 'users', user.uid, 'accounts', account.id), {
      balance: newValue,
      invested: nextInvested,
      valueHistory: [...prevHist, snapshot],
    })
    setShowUpdate(false)
    toast('Wartość zaktualizowana')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="t-btn" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center' }}><IconChevronLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{account.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{account.typeName || 'Inwestycje'}</p>
        </div>
        <button className="t-btn" onClick={onEdit}><IconEdit size={16} /></button>
      </div>

      {/* Karta wartość / zysk */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
        <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Aktualna wartość</p>
        <p style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{privateMode ? '••••' : fmtAcc(value, cur)}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: up ? 'var(--income)' : 'var(--expense)' }}>
          {up ? <IconTrendUp size={16} /> : <IconTrendDown size={16} />}
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {privateMode ? '••••' : <>{up ? '+' : '−'}{fmtAcc(Math.abs(profit), cur)}{percent != null && <> ({up ? '+' : '−'}{Math.abs(percent).toFixed(1)}%)</>}</>}
          </span>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
          Wpłacone: {privateMode ? '••••' : fmtAcc(invested, cur)}
        </p>
      </div>

      <button className="btn-add-account" onClick={() => setShowUpdate(true)}>Aktualizuj wartość</button>

      {/* Wykres wartości w czasie (z zapisanych pomiarów) */}
      {!privateMode && chart.data.length >= 2 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 8px 4px' }}>
          <p style={{ margin: '0 0 6px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Wartość w czasie</p>
          <LineAreaSVG
            data={chart.data}
            height={150}
            min={chart.min}
            max={chart.max}
            yTicks={chart.yTicks}
            accent={up ? 'var(--income)' : 'var(--expense)'}
            fmtValue={(v) => fmtAcc(v, cur)}
          />
        </div>
      )}

      {/* Historia pomiarów */}
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Historia wartości</p>
        {history.length === 0 ? (
          <div className="list-empty"><p>Brak pomiarów — zaktualizuj wartość, aby zacząć śledzić zmiany</p></div>
        ) : (
          <div className="transaction-list">
            {history.map((h, i) => {
              const d = h.date?.toDate?.() ?? (h.date instanceof Date ? h.date : null)
              return (
                <div key={i} className="transaction-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="t-date">{d ? format(d, 'd MMM yyyy', { locale: pl }) : '—'}</span>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontWeight: 700 }}>{privateMode ? '••••' : fmtAcc(h.value, cur)}</span>
                    {!privateMode && h.delta != null && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: h.delta >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                        {h.delta >= 0 ? '+' : '−'}{fmtAcc(Math.abs(h.delta), cur)}
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showUpdate && (
        <InvestmentUpdateModal account={account} onSave={saveUpdate} onClose={() => setShowUpdate(false)} />
      )}
    </div>
  )
}

function InvestmentUpdateModal({ account, onSave, onClose }) {
  const cur = account.currency || 'PLN'
  const [value, setValue] = useState(account.balance?.toString() || '')
  const [deposit, setDeposit] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const v = parseAmount(value)
    if (!Number.isFinite(v)) { setError('Wpisz aktualną wartość'); return }
    const dep = parseAmount(deposit)
    setSaving(true)
    try {
      await onSave({ newValue: v, deposit: Number.isFinite(dep) ? dep : 0 })
    } catch {
      setError('Błąd zapisu'); setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Aktualizuj wartość</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={submit} className="form">
          <div className="form-group">
            <label>Aktualna wartość ({cur})</label>
            <input type="number" inputMode="decimal" step="0.01" className="form-input" value={value}
              autoFocus onChange={e => setValue(e.target.value)} placeholder="ile to teraz warte" />
          </div>
          <div className="form-group">
            <label>Dopłata (opcjonalnie)</label>
            <input type="number" inputMode="decimal" step="0.01" className="form-input" value={deposit}
              onChange={e => setDeposit(e.target.value)} placeholder="jeśli dołożyłaś pieniędzy" />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
              Doda się do „wpłaconych", żeby zysk liczył się poprawnie.
            </p>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Zapisywanie...' : 'Zapisz'}
          </button>
        </form>
      </div>
    </div>
  )
}

function AccountHistory({ user, account, accounts = [], privateMode, onBack, onEdit }) {
  const [transactions, setTx] = useState([])
  const [loading, setLoading] = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [months, setMonths]   = useState(1) // 1 | 3 | 12 | 0 (all)
  const [showTxForm, setShowTxForm] = useState(false)
  const [editTx, setEditTx]   = useState(null)
  const cur = account.currency || 'PLN'

  useEffect(() => {
    let q
    if (months === 0) {
      q = query(
        collection(db, 'users', user.uid, 'transactions'),
        where('accountId', '==', account.id),
        orderBy('date', 'desc')
      )
    } else {
      const start = startOfMonth(subMonths(new Date(), months - 1))
      q = query(
        collection(db, 'users', user.uid, 'transactions'),
        where('accountId', '==', account.id),
        where('date', '>=', Timestamp.fromDate(start)),
        orderBy('date', 'desc')
      )
    }
    return onSnapshot(q, snap => {
      setTx(sortTransactionsByDate(snap.docs.map(d => ({ id: d.id, ...d.data(), date: (d.data().date?.toDate?.() ?? d.data().createdAt?.toDate?.() ?? new Date()) }))))
      setLoading(false)
    }, bladSubskrypcji('accounts'))
  }, [user.uid, account.id, months])

  // Przelewy między własnymi kontami to nie przychód ani wydatek
  const totalIn  = transactions.filter(t => t.type === 'income' && !isTransfer(t)).reduce((s,t) => s+t.amount, 0)
  const totalOut = transactions.filter(t => t.type === 'expense' && !isTransfer(t)).reduce((s,t) => s+t.amount, 0)

  const closeTxForm = () => { setShowTxForm(false); setEditTx(null) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="t-btn" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center' }}><IconChevronLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{account.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{account.typeName}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{privateMode ? '••••' : fmtAcc(account.balance || 0, cur)}</p>
        </div>
        <button className="t-btn" onClick={onEdit}><IconEdit size={16} /></button>
      </div>

      {/* Dodawanie transakcji bezpośrednio na to konto (bez wchodzenia w pulpit) */}
      <button className="btn-add-account" onClick={() => { setEditTx(null); setShowTxForm(true) }}>+ Dodaj transakcję</button>

      {/* Period filter */}
      <div className="habit-view-tabs">
        {[[1,'1 mies.'],[3,'3 mies.'],[12,'Rok'],[0,'Wszystko']].map(([v,l]) => (
          <button key={v} className={`habit-view-tab ${months === v ? 'active' : ''}`} onClick={() => setMonths(v)}>{l}</button>
        ))}
      </div>

      {/* Summary */}
      {transactions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Wpływy</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#27AE60' }}>{privateMode ? '••••' : fmt(totalIn, cur)}</p>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Wypływy</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--expense)' }}>{privateMode ? '••••' : fmt(totalOut, cur)}</p>
          </div>
        </div>
      )}

      {/* Lista transakcji — ta sama co na pulpicie, więc z edycją i usuwaniem
          (usunięcie cofa saldo konta, edycja idzie przez TransactionForm). */}
      <TransactionList
        transactions={transactions}
        accounts={accounts}
        loading={loading}
        onEdit={(t) => { setEditTx(t); setShowTxForm(true) }}
        user={user}
        privateMode={privateMode}
        showAccount={false}
        emptyText="Brak transakcji w tym okresie"
        emptyHint="Dodaj pierwszą przyciskiem powyżej"
      />

      {showTxForm && (
        <TransactionForm
          user={user}
          editData={editTx}
          defaultAccountId={account.id}
          onClose={closeTxForm}
        />
      )}
    </div>
  )
}
