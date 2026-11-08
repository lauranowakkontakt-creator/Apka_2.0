import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, limit, Timestamp } from 'firebase/firestore'
import { onSnapshot } from '../utils/subskrypcje'
import { db } from '../firebase/config'
import useFallbackTimeout from '../utils/useFallbackTimeout'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns'
import { pl } from 'date-fns/locale'
import TransactionForm from './TransactionForm'
import TransactionList from './TransactionList'
import Charts from './Charts'
import Summary from './Summary'
import AccountsView from './budget/AccountsView'
import RegularPayments from './budget/RegularPayments'
import BudgetMenu from './budget/BudgetMenu'
import TransferForm from './budget/TransferForm'
import SearchPanel from './budget/SearchPanel'
import CurrencyTiles from './budget/CurrencyTiles'
import { sortTransactionsByDate } from '../utils/txSort'
import TitheView from './budget/TitheView'
import SavingsGoals from './budget/SavingsGoals'
import Reminders from './budget/Reminders'
import Debtors from './budget/Debtors'
import CategoriesView from './budget/CategoriesView'
import ShoppingList from './budget/ShoppingList'
import ImportView from './budget/ImportView'
import { IconTransfer, IconBank, IconChart, IconShopping, IconPlus, IconChevronLeft, IconChevronRight, IconEye, IconEyeOff, CatIcon } from './Icons'
import { useNarrow } from './ChartPrimitives'
import { DonutSzczegoly, Kafle, Ranking } from './Analityka'
import { fmt, getCurrencyCode, CURRENCIES, splitAmount } from '../utils/currency'
import { isTransfer } from '../utils/categories'
import { isInvestment, sumByCurrency } from '../utils/investmentMath'
import { bladSubskrypcji } from '../utils/polaczenie'
import { inPLN, investedNet } from '../utils/moneyFlow'
import { portfele, wPortfelu } from '../utils/portfele'

// Tytuły podstron pokazywane na pasku „wstecz" (nawigacja bez zakładek)
const SUB_LABELS = {
  transactions: 'Transakcje',
  accounts:     'Konta',
  analiza:      'Analiza',
  regular:      'Regularne płatności',
  shopping:     'Lista zakupów',
}

export default function Dashboard({ user, setHeaderExtras }) {
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts]         = useState([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showForm, setShowForm] = useState(false)
  const [editTransaction, setEditTransaction] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [privateMode, setPrivateMode] = useState(() => {
    try { return localStorage.getItem('mw_privateMode') === 'true' } catch { return false }
  })
  const [modal, setModal] = useState(null)
  // Portfel pokazany pod „Łącznym majątkiem": PLN, inna waluta albo Inwestycje.
  const [walletId, setWalletId] = useState(() => {
    try { return localStorage.getItem('mw_wallet') || 'PLN' } catch { return 'PLN' }
  })
  const [recent, setRecent] = useState([])
  const narrow = useNarrow(480)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'accounts'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('accounts'))
  }, [user.uid])

  useEffect(() => {
    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      where('date', '>=', Timestamp.fromDate(monthStart)),
      where('date', '<=', Timestamp.fromDate(monthEnd)),
      orderBy('date', 'desc')
    )
    return onSnapshot(q, snap => {
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data(), date: (d.data().date?.toDate?.() ?? d.data().createdAt?.toDate?.() ?? new Date()) }))
      setTransactions(sortTransactionsByDate(txs))
      setLoading(false)
    }, bladSubskrypcji('transactions', { przyBledzie: () => setLoading(false) }))
  }, [user.uid, currentMonth])

  // Ostatnie transakcje do listy pod portfelem — niezależnie od miesiąca, żeby
  // portfel z rzadko używaną walutą też coś pokazywał.
  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'), limit(200))
    return onSnapshot(q, snap => setRecent(sortTransactionsByDate(snap.docs.map(d => ({
      id: d.id, ...d.data(), date: (d.data().date?.toDate?.() ?? d.data().createdAt?.toDate?.() ?? new Date()),
    })))), bladSubskrypcji('transactions/recent'))
  }, [user.uid])

  const income   = transactions.filter(t => t.type === 'income' && !isTransfer(t)).reduce((s, t) => s + inPLN(t), 0)
  const expenses = transactions.filter(t => t.type === 'expense' && !isTransfer(t)).reduce((s, t) => s + inPLN(t), 0)
  const accById  = Object.fromEntries(accounts.map(a => [a.id, a]))
  const investedMonth = investedNet(transactions, accById)
  const balance  = income - expenses

  const excludedFromTotal = (() => {
    try { const s = localStorage.getItem(`excludedAccounts_${user.uid}`); return s ? JSON.parse(s) : [] } catch { return [] }
  })()
  const includedAccounts = accounts.filter(a => !excludedFromTotal.includes(a.id))
  // Inwestycje (krypto, surowce...) pokazujemy osobno — NIE wliczamy ich do
  // głównego salda kont ani „łącznego majątku" na ekranie głównym.
  const includedRegular     = includedAccounts.filter(a => !isInvestment(a))
  const includedInvestments = includedAccounts.filter(isInvestment)
  const totalsByCurrency = sumByCurrency(includedRegular)
  const investTotalsByCurrency = sumByCurrency(includedInvestments)

  const monthLabel = format(currentMonth, 'LLLL yyyy', { locale: pl })
  const isCurrentMonth = isSameMonth(currentMonth, new Date())
  const prevMonth = () => setCurrentMonth(m => subMonths(m, 1))
  const nextMonth = () => setCurrentMonth(m => addMonths(m, 1))

  const handleMenuAction = (id) => {
    if (id === 'private') {
      setPrivateMode(m => { const n=!m; try { localStorage.setItem('mw_privateMode', n) } catch {} return n })
      return
    }
    if (id === 'transfer')   return setModal('transfer')
    if (id === 'search')     return setModal('search')
    if (id === 'tithe')      return setModal('tithe')
    if (id === 'goals')      return setModal('goals')
    if (id === 'reminders')  return setModal('reminders')
    if (id === 'debtors')    return setModal('debtors')
    if (id === 'categories') return setModal('categories')
    if (id === 'import')     return setModal('import')
    if (id === 'shopping')   return setActiveTab('shopping')
    if (id === 'regular')    return setActiveTab('regular')
  }

  // Górna belka („Apka"): [＋ Dodaj][⋮ Więcej] — spójnie z Nawykami
  useEffect(() => {
    setHeaderExtras?.(
      <>
        <BudgetMenu onAction={handleMenuAction} privateMode={privateMode} />
        <button className="hdr-btn accent" title="Dodaj transakcję" onClick={() => setShowForm(true)}><IconPlus size={17} /></button>
      </>
    )
    return () => setHeaderExtras?.(null)
  }, [privateMode])

  const fmtAcc = (n, currency = 'PLN') =>
    new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(n)
  const accName = (id) => accounts.find(a => a.id === id)?.name
  const curCode = getCurrencyCode()
  const curSymbol = CURRENCIES.find(c => c.code === curCode)?.symbol || 'zł'

  const fmtHero = (n) => {
    const abs = Math.abs(n)
    const parts = abs.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(',')
    return { int: (n >= 0 ? '+' : '−') + parts[0], dec: ',' + (parts[1] ?? '00') }
  }


  // Build donut data from expense categories
  const categoryMap = {}
  transactions.filter(t => t.type === 'expense' && !isTransfer(t)).forEach(t => {
    const cat = t.category || 'Inne'
    categoryMap[cat] = (categoryMap[cat] || 0) + inPLN(t)
  })
  const donutColors = ['#E0673E','#7C8AF0','#5FBF98','#E0B15A','#5BB6D9','#9B7CF0','#EC4899','#14B8A6']
  const donutData = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ nazwa: name, wartosc: value, kolor: donutColors[i % donutColors.length] }))
  const money = (n) => privateMode ? '••' : fmt(n)

  // Szczegóły kategorii po dotknięciu wycinka: podkategorie i transakcje z miesiąca
  const szczegolyKategorii = (poz) => {
    const lista = transactions.filter(t => t.type === 'expense' && !isTransfer(t) && (t.category || 'Inne') === poz.nazwa)
      .sort((a, b) => inPLN(b) - inPLN(a))
    const sub = {}
    lista.forEach(t => { const k = t.subcategoryLabel || 'Bez podkategorii'; sub[k] = (sub[k] || 0) + inPLN(t) })
    const subPoz = Object.entries(sub).sort((a, b) => b[1] - a[1])
      .map(([nazwa, wartosc], i) => ({ nazwa, wartosc, kolor: `color-mix(in oklab, ${poz.kolor} ${Math.max(35, 100 - i * 15)}%, var(--surface3))` }))
    return (
      <>
        <Kafle min={110} items={[
          { label: 'Udział', value: `${expenses ? Math.round((poz.wartosc / expenses) * 100) : 0}%`, sub: 'wydatków miesiąca' },
          { label: 'Transakcji', value: lista.length },
          { label: 'Średnio', value: money(lista.length ? poz.wartosc / lista.length : 0), sub: 'na transakcję' },
        ]} />
        {subPoz.length > 1 && (<div><p className="an-det-h">Podkategorie</p><Ranking pozycje={subPoz} fmt={money} limit={5} /></div>)}
        <div>
          <p className="an-det-h">Transakcje w tym miesiącu</p>
          {lista.slice(0, 8).map(t => (
            <div key={t.id} className="an-tx-row" style={{ cursor: 'pointer' }} onClick={() => { setEditTransaction(t); setShowForm(true) }}>
              <span>{t.description || t.category}<small>{(t.date?.toDate ? t.date.toDate() : new Date(t.date)).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}{t.subcategoryLabel ? ` · ${t.subcategoryLabel}` : ''}</small></span>
              <b style={{ color: 'var(--expense)' }}>−{money(inPLN(t))}</b>
            </div>
          ))}
          {lista.length > 8 && <p className="an-note" style={{ marginTop: 6 }}>…i {lista.length - 8} więcej — pełna lista w „Transakcje".</p>}
        </div>
      </>
    )
  }

  return (
    <div className="dashboard">
      {/* Podstrony (Transakcje/Konta/Wykresy/…) — pasek ze strzałką wstecz i tytułem.
          Bez miesiąca/roku (przełączanie miesięcy jest tylko w Statystykach). */}
      {activeTab !== 'overview' && (
        <div className="rev-subhead">
          <button className="rev-back" onClick={() => setActiveTab('overview')} title="Wróć"><IconChevronLeft size={18} /></button>
          <div className="rev-subhead-title">{SUB_LABELS[activeTab] || 'Finanse'}</div>
        </div>
      )}

      {/* ====== OVERVIEW TAB — układ w stylu Revolut ====== */}
      {activeTab === 'overview' && (() => {
        const togglePrivate = () => setPrivateMode(m => { const n = !m; try { localStorage.setItem('mw_privateMode', n) } catch {} return n })
        const lista = portfele(includedAccounts)
        const wIdx = Math.max(0, lista.findIndex(p => p.id === walletId))
        const portfel = lista[wIdx]
        const ustawPortfel = (i) => {
          const p = lista[(i + lista.length) % lista.length]
          setWalletId(p.id)
          try { localStorage.setItem('mw_wallet', p.id) } catch { /* tryb prywatny */ }
        }
        const naInwestycjach = portfel.typ === 'inwestycje'
        const symbol = (code) => CURRENCIES.find(c => c.code === code)?.symbol || code
        // Kwota w hero: majątek w zł, suma portfela w jego walucie albo wartość inwestycji.
        const invPLN = naInwestycjach ? (portfel.sumy.PLN ?? Object.values(portfel.sumy)[0] ?? 0) : 0
        const invCur = naInwestycjach ? (portfel.sumy.PLN !== undefined ? 'PLN' : Object.keys(portfel.sumy)[0] || 'PLN') : 'PLN'
        const heroKwota = naInwestycjach ? invPLN : portfel.suma
        const heroWaluta = naInwestycjach ? invCur : portfel.waluta
        const heroHi = splitAmount(heroKwota)
        const heroLabel = naInwestycjach ? 'Inwestycje' : portfel.waluta === 'PLN' ? 'Łączny majątek' : `Portfel ${portfel.waluta}`
        // Zmiana w tym miesiącu: dla zł bilans przychodów i wydatków, dla innej
        // waluty wszystko, co weszło i wyszło z portfela (w jego walucie).
        const zmianaObca = portfel.typ === 'waluta' && portfel.waluta !== 'PLN'
          ? transactions.filter(t => wPortfelu(t, portfel, accById)).reduce((s, t) => s + (t.type === 'income' ? 1 : -1) * (Number(t.amount) || 0), 0)
          : 0
        const balanceUp = (portfel.waluta === 'PLN' ? balance : zmianaObca) >= 0
        const ostatnie = recent.filter(t => wPortfelu(t, portfel, accById)).slice(0, 6)
        let touchX = null

        return (
        <div className="rev-overview">

          {/* Szklany panel: majątek + szybkie akcje (rewolutowy teal-gradient) */}
          <div className="rev-glass-hero">
          <div className="rev-glass-waves" aria-hidden="true" />

          {/* Hero: łączny majątek */}
          <div className="rev-hero">
            <button className="rev-hero-label" onClick={togglePrivate} title={privateMode ? 'Pokaż kwoty' : 'Ukryj kwoty'}>
              {heroLabel} {privateMode ? <IconEye size={14} /> : <IconEyeOff size={14} />}
            </button>
            <div
              onTouchStart={(e) => { touchX = e.touches[0].clientX }}
              onTouchEnd={(e) => {
                if (touchX === null || lista.length < 2) return
                const dx = e.changedTouches[0].clientX - touchX
                touchX = null
                if (Math.abs(dx) > 50) ustawPortfel(wIdx + (dx < 0 ? 1 : -1))
              }}>
            {!privateMode ? (
              <>
                <div className="rev-hero-amount">
                  <span className="rev-hero-int">{heroHi.int}</span>
                  <span className="rev-hero-dec">,{heroHi.dec}&nbsp;{symbol(heroWaluta)}</span>
                </div>
                {portfel.typ === 'waluta' && portfel.waluta === 'PLN' && (
                  <div className={`rev-hero-trend ${balanceUp ? 'up' : 'down'}`}>
                    {balanceUp ? '↑' : '↓'} {fmt(Math.abs(balance))}
                    <span className="sep">· ten miesiąc</span>
                    {investedMonth > 0 && <span className="sep">· zainwestowane {fmt(investedMonth)}</span>}
                  </div>
                )}
                {zmianaObca !== 0 && (
                  <div className={`rev-hero-trend ${balanceUp ? 'up' : 'down'}`}>
                    {balanceUp ? '↑' : '↓'} {fmt(Math.abs(zmianaObca), portfel.waluta)}
                    <span className="sep">· ten miesiąc</span>
                  </div>
                )}
                {naInwestycjach && portfel.zysk !== null && (
                  <div className={`rev-hero-trend ${portfel.zysk >= 0 ? 'up' : 'down'}`}>
                    {portfel.zysk >= 0 ? '↑' : '↓'} {fmt(Math.abs(portfel.zysk))}
                    <span className="sep">· {portfel.zysk >= 0 ? 'zysk' : 'strata'} względem wpłat</span>
                  </div>
                )}
              </>
            ) : (
              <div className="rev-hero-hidden">••••</div>
            )}
            </div>
            {lista.length > 1 && (
              <div className="wallet-switch">
                <button className="wallet-switch-btn" onClick={() => ustawPortfel(wIdx - 1)} disabled={wIdx === 0} title="Poprzedni portfel"><IconChevronLeft size={15} /></button>
                <div className="wallet-dots">
                  {lista.map((p, i) => (
                    <button key={p.id} className={`wallet-dot${i === wIdx ? ' on' : ''}`} onClick={() => ustawPortfel(i)}
                      title={p.typ === 'inwestycje' ? 'Inwestycje' : p.waluta} aria-label={p.typ === 'inwestycje' ? 'Inwestycje' : `Portfel ${p.waluta}`} />
                  ))}
                </div>
                <button className="wallet-switch-btn" onClick={() => ustawPortfel(wIdx + 1)} disabled={wIdx === lista.length - 1} title="Następny portfel"><IconChevronRight size={15} /></button>
              </div>
            )}
          </div>

          {/* Szybkie akcje */}
          <div className="rev-actions">
            <button className="rev-action" onClick={() => setActiveTab('shopping')}>
              <span className="rev-action-circle"><IconShopping size={22} /></span>
              <span className="rev-action-label">Zakupy</span>
            </button>
            <button className="rev-action" onClick={() => setActiveTab('transactions')}>
              <span className="rev-action-circle"><IconTransfer size={22} /></span>
              <span className="rev-action-label">Transakcje</span>
            </button>
            <button className="rev-action" onClick={() => setActiveTab('analiza')}>
              <span className="rev-action-circle"><IconChart size={22} /></span>
              <span className="rev-action-label">Analiza</span>
            </button>
            <button className="rev-action" onClick={() => setActiveTab('accounts')}>
              <span className="rev-action-circle"><IconBank size={22} /></span>
              <span className="rev-action-label">Konta</span>
            </button>
          </div>
          </div>{/* /rev-glass-hero */}

          {/* Wydatki wg kategorii — donut */}
          <div className="rev-section">
            <div className="rev-section-head">
              <span className="rev-section-title">Wydatki wg kategorii</span>
            </div>
            <div className="rev-donut-card">
              <DonutSzczegoly pozycje={donutData} fmt={money} rozmiar={narrow ? 190 : 210} grubosc={26} limit={6}
                srodek="Razem" szczegoly={szczegolyKategorii} pusty="Brak wydatków w tym miesiącu" />
            </div>
          </div>

          {/* Ostatnie transakcje */}
          <div className="rev-section">
            <div className="rev-section-head">
              <span className="rev-section-title">Ostatnie transakcje{portfel.waluta === 'PLN' ? '' : naInwestycjach ? ' · inwestycje' : ` · ${portfel.waluta}`}</span>
              {ostatnie.length > 0 && (
                <button className="rev-section-link" onClick={() => setActiveTab('transactions')}>Wszystkie →</button>
              )}
            </div>
            <div className="rev-card">
              {ostatnie.length === 0 ? (
                <div className="rev-empty">Brak transakcji w tym portfelu</div>
              ) : (
                ostatnie.map(t => {
                  const isExpense = t.type === 'expense'
                  return (
                    <div key={t.id} className="rev-row clickable" onClick={() => { setEditTransaction(t); setShowForm(true) }}>
                      <span className="rev-row-icon" style={{ background: isExpense ? 'color-mix(in oklab, var(--expense) 16%, var(--surface))' : 'color-mix(in oklab, var(--income) 16%, var(--surface))', color: isExpense ? 'var(--expense)' : 'var(--income)' }}>
                        <CatIcon categoryId={t.categoryId} emoji={t.categoryIcon} size={18} />
                      </span>
                      <div className="rev-row-main">
                        <div className="rev-row-name">{t.description || t.subsubcategoryLabel || t.subcategoryLabel || t.category || 'Transakcja'}</div>
                        <div className="rev-row-sub">{[[t.category, t.subcategoryLabel, t.subsubcategoryLabel].filter(Boolean).join(' › '), format(t.date, 'd MMM', { locale: pl }), accName(t.accountId)].filter(Boolean).join(' · ')}</div>
                      </div>
                      <div className="rev-row-right">
                        <div className="rev-row-amt" style={{ color: isExpense ? 'var(--expense)' : 'var(--income)' }}>
                          {!privateMode ? `${isExpense ? '−' : '+'}${fmt(t.amount, t.currency)}` : '••'}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
        )
      })()}

      {activeTab === 'analiza' && <Charts user={user} privateMode={privateMode} />}

      {activeTab === 'transactions' && (
        <>
          {/* Nawigator miesiąca — przewijanie do poprzednich miesięcy */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 14 }}>
            <button className="month-btn" onClick={prevMonth} style={{ width: 32, height: 32 }} title="Poprzedni miesiąc">‹</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{monthLabel}</div>
              {isCurrentMonth
                ? <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 2 }}>Bieżący miesiąc</div>
                : <button onClick={() => setCurrentMonth(new Date())} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← wróć do bieżącego</button>}
            </div>
            <button className="month-btn" onClick={nextMonth} disabled={isCurrentMonth} style={{ width: 32, height: 32, opacity: isCurrentMonth ? 0.3 : 1 }} title="Następny miesiąc">›</button>
          </div>

          {/* Balance hero — mobile */}
          {!privateMode && (
            <div className="balance-hero mobile-only">
              {accounts.length > 0 && (
                <>
                  <div className="balance-hero-label">Saldo kont</div>
                  {(() => {
                    const entries = Object.entries(totalsByCurrency)
                    const isOnlyPLN = entries.length === 0 || (entries.length === 1 && entries[0][0] === 'PLN')
                    const plnVal = totalsByCurrency['PLN'] || 0
                    if (isOnlyPLN) {
                      return (
                        <div className="balance-hero-amount">
                          <span className="balance-hero-main" style={{ color: plnVal >= 0 ? 'var(--income)' : 'var(--expense)' }}>{fmtHero(plnVal).int}</span>
                          <span className="balance-hero-cents" style={{ color: plnVal >= 0 ? 'var(--income)' : 'var(--expense)' }}>{fmtHero(plnVal).dec} {curSymbol}</span>
                        </div>
                      )
                    }
                    return (
                      <div style={{ marginBottom: 10 }}>
                        <CurrencyTiles totals={totalsByCurrency} privateMode={privateMode} compact />
                      </div>
                    )
                  })()}
                  {includedInvestments.length > 0 && (
                    <div style={{ paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Inwestycje</span>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>
                        {Object.entries(investTotalsByCurrency).map(([cur, amt]) => fmtAcc(amt, cur)).join(' · ')}
                      </span>
                    </div>
                  )}
                  <div style={{ paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saldo miesiąca</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: balance >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                      {fmt(balance)}
                    </span>
                  </div>
                </>
              )}
              {accounts.length === 0 && (
                <>
                  <div className="balance-hero-label">Saldo miesiąca</div>
                  <div className="balance-hero-amount">
                    <span className="balance-hero-main" style={{ color: balance >= 0 ? 'var(--income)' : 'var(--expense)' }}>{fmtHero(balance).int}</span>
                    <span className="balance-hero-cents" style={{ color: balance >= 0 ? 'var(--income)' : 'var(--expense)' }}>{fmtHero(balance).dec} {curSymbol}</span>
                  </div>
                </>
              )}
              <div className="balance-hero-row">
                <div className="balance-hero-stat">
                  <span className="balance-hero-stat-label">Przychody</span>
                  <span className="balance-hero-stat-value" style={{ color: 'var(--income)' }}>+{fmt(income)}</span>
                </div>
                <div className="balance-hero-stat-sep" />
                <div className="balance-hero-stat">
                  <span className="balance-hero-stat-label">Wydatki</span>
                  <span className="balance-hero-stat-value" style={{ color: 'var(--expense)' }}>−{fmt(expenses)}</span>
                </div>
              </div>
            </div>
          )}
          {/* Summary grid — desktop */}
          <div className="desktop-only">
            <Summary income={income} expenses={expenses} balance={balance} privateMode={privateMode}
              totalsByCurrency={totalsByCurrency} hasAccounts={includedAccounts.length > 0} />
          </div>
          <TransactionList
            transactions={transactions}
            accounts={accounts}
            loading={loading}
            onEdit={(t) => { setEditTransaction(t); setShowForm(true) }}
            user={user}
            privateMode={privateMode}
          />
        </>
      )}
      {activeTab === 'accounts'  && <AccountsView user={user} privateMode={privateMode} />}
      {activeTab === 'regular'   && <RegularPayments user={user} />}
      {activeTab === 'shopping'  && <ShoppingList user={user} />}

      {activeTab === 'transactions' && (
        <button className="btn-add" onClick={() => setShowForm(true)}><IconPlus size={22} /></button>
      )}

      {modal === 'transfer'    && <TransferForm   user={user} onClose={() => setModal(null)} />}
      {modal === 'search'      && <SearchPanel    user={user} onClose={() => setModal(null)} />}
      {modal === 'tithe'       && <TitheView      user={user} onClose={() => setModal(null)} />}
      {modal === 'goals'       && <SavingsGoals   user={user} onClose={() => setModal(null)} />}
      {modal === 'reminders'   && <Reminders      user={user} onClose={() => setModal(null)} />}
      {modal === 'debtors'     && <Debtors        user={user} onClose={() => setModal(null)} />}
      {modal === 'categories'  && <CategoriesView user={user} onClose={() => setModal(null)} />}
      {modal === 'import'      && <ImportView     user={user} onClose={() => setModal(null)} />}

      {showForm && (
        <TransactionForm
          user={user}
          onClose={() => { setShowForm(false); setEditTransaction(null) }}
          editData={editTransaction}
          defaultCurrency={walletId !== 'PLN' && walletId !== 'inwestycje' ? walletId : undefined}
        />
      )}
    </div>
  )
}
