import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, orderBy, Timestamp, doc } from 'firebase/firestore'
import { onSnapshot } from '../utils/subskrypcje'
import { db } from '../firebase/config'
import { IconChevronLeft, IconChevronRight, IconChart } from './Icons'
import { useMounted } from './ChartPrimitives'
import { getBounds, shiftPivot } from '../utils/budgetMath'
import { byAccountOrder } from '../utils/accountOrder'
import { fmt } from '../utils/currency'
import { inPLN } from '../utils/moneyFlow'
import { getSubcategoryColor, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, isTransfer } from '../utils/categories'
import { bladSubskrypcji } from '../utils/polaczenie'
import StatsPanel from './budget/StatsPanel'
import { Sekcja, Kafle, Ranking, DonutSzczegoly, DniTygodnia } from './Analityka'
import { wgDniaTygodnia, kluczDnia } from '../utils/analityka'

const FALLBACK_COLORS = [
  '#C94B28','#6366f1','#f59e0b','#10b981','#3b82f6','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#a78bfa',
]

// Jeden ekran analizy Finansów: „Miesiąc" (bilans i kategorie wybranego
// miesiąca), „Rok" (rok w liczbach, miesiąc po miesiącu, porównanie z rokiem
// wcześniej) albo „Lata" (statystyki z całej historii).
const PERIODS = [
  { id: 'month', label: 'Miesiąc' },
  { id: 'year',  label: 'Rok'     },
  { id: 'all',   label: 'Lata'    },
]

export default function Charts({ user, privateMode = false }) {
  const [period, setPeriod]       = useState('month')
  const [pivot, setPivot]         = useState(new Date())
  const [transactions, setTx]     = useState([])
  const [accounts, setAccounts]   = useState([])
  const [accountFilter, setAccountFilter] = useState('all')
  const [customCats, setCustomCats] = useState(null)

  const bounds = getBounds(period, pivot)

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'accounts'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('accounts'))
  }, [user.uid])

  useEffect(() => {
    return onSnapshot(doc(db, 'users', user.uid, 'settings', 'categories'),
      d => setCustomCats(d.exists() ? d.data() : {}),
      bladSubskrypcji('settings/categories', { przyBledzie: () => setCustomCats({}) }))
  }, [user.uid])

  const catColorMap = useMemo(() => {
    const map = {}
    ;[...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].forEach(c => { map[c.id] = c.color })
    if (customCats) {
      ;[...(customCats.expense || []), ...(customCats.income || [])].forEach(c => { if (c.id && c.color) map[c.id] = c.color })
    }
    return map
  }, [customCats])

  // Własne kolory podkategorii i pod-podkategorii (ustawiane w „Zarządzaj kategoriami").
  const subColorMap = useMemo(() => {
    const map = {}
    const zbierz = (subs = []) => subs.forEach(sc => { if (sc?.id && sc.color) map[sc.id] = sc.color; zbierz(sc?.subcategories) })
    ;[...(customCats?.expense || []), ...(customCats?.income || [])].forEach(c => zbierz(c.subcategories))
    return map
  }, [customCats])

  useEffect(() => {
    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      where('date', '>=', Timestamp.fromDate(bounds.start)),
      where('date', '<=', Timestamp.fromDate(bounds.end)),
      orderBy('date', 'asc')
    )
    return onSnapshot(q, snap =>
      setTx(snap.docs.map(d => ({ id: d.id, ...d.data(), date: (d.data().date?.toDate?.() ?? d.data().createdAt?.toDate?.() ?? new Date()) })))
    , bladSubskrypcji('transactions'))
  }, [user.uid, period, pivot])

  // Filtr kont w ustawionej ręcznie kolejności (spójnie z zakładką Konta)
  const sortedAccounts = useMemo(() => [...accounts].sort(byAccountOrder), [accounts])

  const goBack = () => setPivot(p => shiftPivot(period, p, -1))
  const goFwd  = () => setPivot(p => shiftPivot(period, p, +1))

  // Przelewy między kontami nie są przychodem/wydatkiem — pomijamy w wykresach
  const base = transactions.filter(t => !isTransfer(t)).map(t => ({ ...t, amount: inPLN(t) }))
  const filtered = accountFilter === 'all' ? base : base.filter(t => t.accountId === accountFilter)
  const expenses = filtered.filter(t => t.type === 'expense')
  const incomes  = filtered.filter(t => t.type === 'income')
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0)
  const totalInc = incomes.reduce((s, t) => s + t.amount, 0)
  const balance  = totalInc - totalExp

  return (
    <div className="charts">

      {/* Period selector */}
      <div className="habit-view-tabs">
        {PERIODS.map(p => (
          <button key={p.id}
            className={`habit-view-tab ${period === p.id ? 'active' : ''}`}
            onClick={() => { setPeriod(p.id); setPivot(new Date()) }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Period navigation (bez strzałek w widoku „Lata") */}
      {period !== 'all' && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button aria-label="Poprzedni okres" className="icon-btn" onClick={goBack}><IconChevronLeft size={16} /></button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
          {bounds.label}
        </span>
        <button aria-label="Następny okres" className="icon-btn" onClick={goFwd}><IconChevronRight size={16} /></button>
      </div>}

      {/* Filtr kont — jeden przewijany palcem wiersz, niezależnie od liczby kont */}
      {accounts.length > 0 && (
        <div className="acc-filter-row" role="group" aria-label="Filtr kont">
          <button
            className={`account-chip ${accountFilter === 'all' ? 'active' : ''}`}
            onClick={() => setAccountFilter('all')}>
            Wszystkie konta
          </button>
          {sortedAccounts.map(a => (
            <button key={a.id}
              className={`account-chip ${accountFilter === a.id ? 'active' : ''}`}
              style={accountFilter === a.id ? { borderColor: a.color, background: a.color + '22' } : {}}
              title={a.name}
              onClick={() => setAccountFilter(a.id)}>
              {a.name}
            </button>
          ))}
        </div>
      )}

      {period === 'year' || period === 'all' ? (
        <StatsPanel user={user} privateMode={privateMode} rok={pivot.getFullYear()} tryb={period === 'all' ? 'lata' : 'rok'}
          onRokChange={(y) => setPivot(new Date(y, 0, 1))} onOtworzRok={() => setPeriod('year')} accountFilter={accountFilter} />
      ) : (<>
      {filtered.length === 0 ? (
        <div className="charts-empty">
          <p style={{ marginBottom: 8, opacity: 0.4 }}><IconChart size={32} /></p>
          <p>Brak transakcji w tym okresie</p>
        </div>
      ) : (
        <MiesiacView
          expenses={expenses} incomes={incomes}
          totalExp={totalExp} totalInc={totalInc} balance={balance}
          pivot={pivot} privateMode={privateMode} catColorMap={catColorMap} subColorMap={subColorMap}
        />
      )}
      </>)}
    </div>
  )
}

/* ─── General Tab ─── */
function GeneralTab({ expenses, totalExp, totalInc, balance, pivot, privateMode = false }) {
  const savingsRate = totalInc > 0 ? Math.round((balance / totalInc) * 100) : null
  const on = useMounted(80)

  // Statystyki pomocnicze — do kafelków „na pierwszy rzut oka"
  // Średnio na dzień: w bieżącym miesiącu dzielimy przez dni, które już minęły.
  const dzis = new Date()
  const biezacy = pivot.getFullYear() === dzis.getFullYear() && pivot.getMonth() === dzis.getMonth()
  const dni = biezacy ? dzis.getDate() : new Date(pivot.getFullYear(), pivot.getMonth() + 1, 0).getDate()
  const avgDay = totalExp / Math.max(1, dni)
  const topCat  = useMemo(() => {
    const m = {}
    expenses.forEach(t => { const k = t.category || 'Inne'; m[k] = (m[k] || 0) + t.amount })
    const e = Object.entries(m).sort((a, b) => b[1] - a[1])[0]
    return e ? { name: e[0], val: e[1] } : null
  }, [expenses])
  const statTile = (label, value, sub, color) => (
    <div className="card card-pad" style={{ padding: 14 }}>
      <p style={{ margin: 0, fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', color: color || 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )

  return (
    <div className="an-general">

      {/* Balance hero card */}
      <div className="card card-pad" style={{ overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: balance >= 0
            ? 'radial-gradient(ellipse at top right, rgba(95,191,152,0.08) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at top right, rgba(224,103,62,0.08) 0%, transparent 60%)',
        }} />

        <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Bilans okresu
        </p>
        <p style={{
          margin: '0 0 16px', fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em',
          color: balance >= 0 ? 'var(--income)' : 'var(--expense)', lineHeight: 1.1,
        }}>
          {privateMode ? '••' : `${balance >= 0 ? '+' : '−'}${fmt(Math.abs(balance))}`}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 0, alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Przychody</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--income)' }}>{privateMode ? '••' : `+${fmt(totalInc)}`}</p>
          </div>
          <div style={{ width: 1, height: 32, background: 'var(--border)', justifySelf: 'center' }} />
          <div style={{ paddingLeft: 16 }}>
            <p style={{ margin: '0 0 2px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Wydatki</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--expense)' }}>{privateMode ? '••' : `−${fmt(totalExp)}`}</p>
          </div>
        </div>

        {savingsRate !== null && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: on ? `${Math.min(100, Math.max(0, savingsRate))}%` : '0%',
                background: savingsRate >= 0 ? 'var(--income)' : 'var(--expense)',
                borderRadius: 99,
                transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
              }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 60, textAlign: 'right' }}>
              {savingsRate >= 0 ? 'oszczędności' : 'na minusie'} {Math.abs(savingsRate)}%
            </span>
          </div>
        )}
      </div>

      {/* Kafelki statystyk — szybki przegląd okresu */}
      <div className="an-general-tiles">
        {statTile('Największa kategoria', topCat ? topCat.name : '—', topCat && !privateMode ? fmt(topCat.val) : '', 'var(--text)')}
        {statTile('Wydatki dziennie', privateMode ? '••' : fmt(avgDay), biezacy ? `średnio z ${dni} dni` : 'średnio w miesiącu', 'var(--expense)')}
      </div>

    </div>
  )
}

/* ─── Widok „Miesiąc": bilans, dwa wykresy kołowe i krótkie analizy — wszystko
   na jednym ekranie, w dwóch kolumnach na komputerze. ─── */
function MiesiacView({ expenses, incomes, totalExp, totalInc, balance, pivot, privateMode, catColorMap, subColorMap }) {
  const money = (n) => privateMode ? '••' : fmt(n)
  const moneyK = (n) => privateMode ? '••' : Math.round(n).toLocaleString('pl-PL')

  // Pozycje koła: kategorie od największej, kolor z ustawień kategorii.
  const pozycje = (list) => {
    const m = {}
    list.forEach(t => {
      const klucz = t.categoryId || t.category || 'Inne'
      if (!m[klucz]) m[klucz] = { klucz, nazwa: t.category || 'Inne', categoryId: t.categoryId, wartosc: 0 }
      m[klucz].wartosc += t.amount
    })
    return Object.values(m).sort((a, b) => b.wartosc - a.wartosc)
      .map((p, i) => ({ ...p, kolor: catColorMap[p.categoryId] || FALLBACK_COLORS[i % FALLBACK_COLORS.length] }))
  }
  const poz = useMemo(() => ({ expense: pozycje(expenses), income: pozycje(incomes) }), [expenses, incomes, catColorMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // Szczegóły po dotknięciu wycinka: udział, podkategorie, największe transakcje.
  const szczegoly = (list, total) => (p) => {
    const lista = list.filter(t => (t.categoryId || t.category || 'Inne') === p.klucz).sort((a, b) => b.amount - a.amount)
    const sub = {}
    lista.forEach(t => {
      const k = t.subcategoryLabel || 'Bez podkategorii'
      if (!sub[k]) sub[k] = { nazwa: k, wartosc: 0, id: t.subcategoryId }
      sub[k].wartosc += t.amount
    })
    const subPoz = Object.values(sub).sort((a, b) => b.wartosc - a.wartosc)
      .map((x, i) => ({ nazwa: x.nazwa, wartosc: x.wartosc, kolor: subColorMap[x.id] || getSubcategoryColor(p.kolor, i) }))
    return (
      <>
        <Kafle min={110} items={[
          { label: 'Udział', value: `${total ? Math.round((p.wartosc / total) * 100) : 0}%` },
          { label: 'Transakcji', value: lista.length },
          { label: 'Średnio', value: money(lista.length ? p.wartosc / lista.length : 0) },
        ]} />
        {subPoz.length > 1 && <Ranking pozycje={subPoz} fmt={money} limit={5} />}
      </>
    )
  }

  const weekday = useMemo(() => wgDniaTygodnia(expenses.map(t => ({ klucz: kluczDnia(t.date), wartosc: t.amount }))), [expenses])
  const top = useMemo(() => [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 6), [expenses])

  return (
    <div className="an-grid">
      <div className="wide">
        <GeneralTab expenses={expenses} totalExp={totalExp} totalInc={totalInc} balance={balance} pivot={pivot} privateMode={privateMode} />
      </div>

      <Sekcja tytul="Na co idą pieniądze">
        <DonutSzczegoly legenda="chipy" pozycje={poz.expense} fmt={money} srodek="Wydatki" szczegoly={szczegoly(expenses, totalExp)} pusty="Brak wydatków w tym okresie" />
      </Sekcja>

      <Sekcja tytul="Skąd przychody">
        <DonutSzczegoly legenda="chipy" pozycje={poz.income} fmt={money} srodek="Przychody" szczegoly={szczegoly(incomes, totalInc)} pusty="Brak przychodów w tym okresie" />
      </Sekcja>

      <Sekcja tytul="Wydatki wg dni tygodnia">
        <DniTygodnia wartosci={weekday} kolor="var(--expense)" fmt={moneyK} />
      </Sekcja>

      <Sekcja tytul="Największe wydatki">
        {top.length ? (
          <div className="an-rank">
            {top.map(t => (
              <div key={t.id} className="an-rank-top" style={{ marginBottom: 0 }}>
                <span className="an-rank-name" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                  <span>{t.description || t.category}</span>
                  <small style={{ fontSize: 11, color: 'var(--text-sub)' }}>{t.category} · {t.date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</small>
                </span>
                <span className="an-rank-val" style={{ color: 'var(--expense)' }}>−{money(t.amount)}</span>
              </div>
            ))}
          </div>
        ) : <div className="an-pusty">Brak wydatków</div>}
      </Sekcja>
    </div>
  )
}
