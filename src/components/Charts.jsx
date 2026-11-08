import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, orderBy, Timestamp, getDoc, doc } from 'firebase/firestore'
import { onSnapshot } from '../utils/subskrypcje'
import { db } from '../firebase/config'
import { CatIcon, IconChevronLeft, IconChevronRight, IconChart } from './Icons'
import { useMounted } from './ChartPrimitives'
import { getBounds, shiftPivot } from '../utils/budgetMath'
import { byAccountOrder } from '../utils/accountOrder'
import { fmt } from '../utils/currency'
import { inPLN } from '../utils/moneyFlow'
import { getSubcategoryColor, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, isTransfer } from '../utils/categories'
import { bladSubskrypcji } from '../utils/polaczenie'
import StatsPanel from './budget/StatsPanel'

const FALLBACK_COLORS = [
  '#C94B28','#6366f1','#f59e0b','#10b981','#3b82f6','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#a78bfa',
]

// Jeden ekran analizy Finansów: „Miesiąc" (bilans i kategorie wybranego
// miesiąca) albo „Rok" (rok w liczbach, miesiąc po miesiącu, porównanie lat).
const PERIODS = [
  { id: 'month', label: 'Miesiąc' },
  { id: 'year',  label: 'Rok'     },
]

export default function Charts({ user, privateMode = false }) {
  const [tab, setTab]             = useState('general')
  const [chartType, setChartType] = useState('list')
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

      {/* Period navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="icon-btn" onClick={goBack}><IconChevronLeft size={16} /></button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
          {bounds.label}
        </span>
        <button className="icon-btn" onClick={goFwd}><IconChevronRight size={16} /></button>
      </div>

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

      {period === 'year' ? (
        <StatsPanel user={user} privateMode={privateMode} rok={pivot.getFullYear()}
          onRokChange={(y) => setPivot(new Date(y, 0, 1))} accountFilter={accountFilter} />
      ) : (<>
      {/* Tab selector */}
      <div className="habit-view-tabs">
        {[['general','Ogólne'],['expense','Wydatki'],['income','Dochody']].map(([id, lbl]) => (
          <button key={id}
            className={`habit-view-tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Chart type toggle (for category tabs) */}
      {tab !== 'general' && (
        <div style={{ display: 'flex', gap: 6 }}>
          {[['list','Lista'],['pie','Kołowy']].map(([id, lbl]) => (
            <button key={id}
              className={`type-btn ${chartType === id ? 'active expense' : ''}`}
              style={{ flex: 1, padding: '8px 0', fontSize: 13 }}
              onClick={() => setChartType(id)}>
              {lbl}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="charts-empty">
          <p style={{ marginBottom: 8, opacity: 0.4 }}><IconChart size={32} /></p>
          <p>Brak transakcji w tym okresie</p>
        </div>
      ) : (
        <>
          {tab === 'general' && (
            <GeneralTab
              expenses={expenses} incomes={incomes}
              totalExp={totalExp} totalInc={totalInc} balance={balance}
              pivot={pivot} privateMode={privateMode}
            />
          )}
          {tab === 'expense' && (
            <CategoryTab
              transactions={expenses} total={totalExp}
              chartType={chartType} label="Wydatki" catColorMap={catColorMap} subColorMap={subColorMap}
              accentColor="var(--expense)"
              privateMode={privateMode}
            />
          )}
          {tab === 'income' && (
            <CategoryTab
              transactions={incomes} total={totalInc}
              chartType={chartType} label="Dochody" catColorMap={catColorMap} subColorMap={subColorMap}
              accentColor="var(--income)"
              privateMode={privateMode}
              key="income"
            />
          )}
        </>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {statTile('Największa kategoria', topCat ? topCat.name : '—', topCat && !privateMode ? fmt(topCat.val) : '', 'var(--text)')}
        {statTile('Wydatki dziennie', privateMode ? '••' : fmt(avgDay), biezacy ? `średnio z ${dni} dni` : 'średnio w miesiącu', 'var(--expense)')}
      </div>

    </div>
  )
}

/* ─── Category Tab ─── */
function CategoryTab({ transactions, total, chartType, label, catColorMap = {}, subColorMap = {}, accentColor, privateMode = false }) {
  const [drillDown, setDrillDown] = useState(null)

  const hasSubcatSet = new Set()
  transactions.forEach(t => { if (t.subcategoryId) hasSubcatSet.add(t.categoryId) })

  const byCat = {}
  transactions.forEach(t => {
    const key = t.categoryId || t.category || 'Inne'
    if (!byCat[key]) byCat[key] = { name: t.category || 'Inne', icon: t.categoryIcon || 'IconMore', categoryId: t.categoryId, value: 0 }
    byCat[key].value += t.amount
  })
  const data = Object.values(byCat).sort((a, b) => b.value - a.value)
  data.forEach((item, i) => {
    item.chartColor = catColorMap[item.categoryId] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]
  })

  // Pre-compute subcategory breakdown for hover display
  const subcatMap = {}
  transactions.forEach(t => {
    if (!t.subcategoryId) return
    const cid = t.categoryId || 'Inne'
    if (!subcatMap[cid]) subcatMap[cid] = {}
    if (!subcatMap[cid][t.subcategoryId]) subcatMap[cid][t.subcategoryId] = { name: t.subcategoryLabel || 'Ogólne', value: 0 }
    subcatMap[cid][t.subcategoryId].value += t.amount
  })
  data.forEach(item => {
    const sc = subcatMap[item.categoryId]
    if (sc) item.subcats = Object.values(sc).sort((a, b) => b.value - a.value)
  })

  if (drillDown) {
    // Poziom 2 (podkategorie kategorii) albo poziom 3 (pod-podkategorie jednej podkategorii)
    const inSub  = !!drillDown.subId
    const catTxs = transactions.filter(t => t.categoryId === drillDown.categoryId && (!inSub || (t.subcategoryId || '__none__') === drillDown.subId))
    const bySub  = {}
    const hasDeeper = new Set()
    catTxs.forEach(t => {
      const key  = inSub ? (t.subsubcategoryId || '__none__') : (t.subcategoryId || '__none__')
      const name = inSub ? (t.subsubcategoryLabel || 'Ogólne') : (t.subcategoryLabel || 'Ogólne')
      if (!bySub[key]) bySub[key] = { name, value: 0, categoryId: key }
      bySub[key].value += t.amount
      if (!inSub && t.subsubcategoryId) hasDeeper.add(key)
    })
    const subData   = Object.values(bySub).sort((a, b) => b.value - a.value)
    const subTotal  = catTxs.reduce((s, t) => s + t.amount, 0)
    const subColors = subData.map((d, i) => subColorMap[d.categoryId] || getSubcategoryColor(drillDown.parentColor, i))

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={() => setDrillDown(inSub ? { ...drillDown, subId: null, subName: null } : null)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
          fontSize: 13, color: 'var(--text)',
        }}>
          <IconChevronLeft size={14} />
          <CatIcon categoryId={drillDown.categoryId} emoji={drillDown.icon} size={16} />
          <span style={{ fontWeight: 600 }}>{drillDown.name}{inSub ? ` › ${drillDown.subName}` : ''}</span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{fmt(subTotal)}</span>
        </button>

        {chartType === 'pie' ? (
          <DonutChart data={subData} colors={subColors} total={subTotal} privateMode={privateMode} label={label} />
        ) : (
          <ProgressList data={subData} total={subTotal} colors={subColors} privateMode={privateMode}
            hasSubcat={hasDeeper}
            onItemClick={(item) => hasDeeper.has(item.categoryId) ? setDrillDown({ ...drillDown, subId: item.categoryId, subName: item.name }) : null} />
        )}
      </div>
    )
  }

  if (!data.length) return (
    <div className="charts-empty">
      <p style={{ marginBottom: 8, opacity: 0.4 }}><IconChart size={32} /></p>
      <p>Brak {label.toLowerCase()}</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {chartType === 'pie' ? (
        <DonutChart data={data} colors={data.map(d => d.chartColor)} total={total} privateMode={privateMode} label={label} />
      ) : (
        <ProgressList
          data={data} total={total}
          colors={data.map(d => d.chartColor)}
          onItemClick={(item) => hasSubcatSet.has(item.categoryId)
            ? setDrillDown({ categoryId: item.categoryId, name: item.name, icon: item.icon, parentColor: item.chartColor })
            : null
          }
          hasSubcat={hasSubcatSet}
          renderIcon={(item) => (
            <CatIcon categoryId={item.categoryId} emoji={item.icon} size={15} />
          )}
          privateMode={privateMode}
        />
      )}
    </div>
  )
}

/* ─── Progress bar list ─── */
function ProgressList({ data, total, colors, onItemClick, hasSubcat, renderIcon, privateMode = false }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const maxVal = data[0]?.value || 1
  const on = useMounted(100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((item, i) => {
        const pct    = total > 0 ? (item.value / total * 100) : 0
        const relPct = (item.value / maxVal) * 100
        const color  = colors[i]
        const clickable = hasSubcat?.has(item.categoryId)
        const isHovered = hoveredIdx === i

        return (
          <div
            key={item.name}
            onClick={() => onItemClick?.(item)}
            style={{
              background: isHovered && clickable ? 'var(--surface2)' : 'var(--surface)',
              border: `1px solid ${isHovered && clickable ? color : 'var(--border)'}`,
              borderRadius: 14, padding: '12px 14px',
              cursor: clickable ? 'pointer' : 'default',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                {renderIcon ? renderIcon(item) : <span style={{ fontSize: 14 }}>{item.name[0]}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>{item.name}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{privateMode ? '••' : fmt(item.value)}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{pct.toFixed(1)}%</p>
              </div>
              {clickable && <span style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0 }}>›</span>}
            </div>
            <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: on ? relPct + '%' : '0%', background: color, borderRadius: 99,
                transition: `width .8s cubic-bezier(.4,0,.2,1) ${i * .05}s`,
              }} />
            </div>

            {/* Subcategory breakdown on hover */}
            {isHovered && item.subcats?.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {item.subcats.slice(0, 6).map(sc => {
                  const scPct = item.value > 0 ? (sc.value / item.value * 100) : 0
                  return (
                    <div key={sc.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, opacity: 0.5, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>{sc.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>{scPct.toFixed(0)}%</span>
                      {!privateMode && <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, minWidth: 60, textAlign: 'right' }}>{fmt(sc.value)}</span>}
                    </div>
                  )
                })}
                {item.subcats.length > 6 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 13 }}>+{item.subcats.length - 6} więcej →</span>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Total row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 12, marginTop: 2 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Łącznie</span>
        <span style={{ fontSize: 17, fontWeight: 800 }}>{privateMode ? '••' : fmt(total)}</span>
      </div>
    </div>
  )
}

/* ─── Donut chart z SVG (zastępuje recharts PieChart) ─── */
function DonutChart({ data, colors, total, privateMode = false, label = '' }) {
  const [active, setActive] = useState(null)
  const on = useMounted(120)

  const size = typeof window !== 'undefined' && window.innerWidth < 480 ? 160 : 200
  const thickness = 28
  const r = (size - thickness) / 2 - 2
  const C = 2 * Math.PI * r
  const gap = 0.015

  let acc = 0
  const segs = data.map((d, i) => {
    const frac = d.value / total
    const len = Math.max(0, frac * C - gap * C)
    const seg = { ...d, i, offset: -(acc * C), len, dash: `${len} ${C - len}`, frac }
    acc += frac
    return seg
  })

  const displayItem = active != null ? data[active] : null
  const topItem = data[0]
  const topPct  = topItem && total > 0 ? (topItem.value / total * 100) : 0
  const topWord = /doch|przych/i.test(label) ? 'Największy przychód' : 'Największy wydatek'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={thickness} opacity={.4}/>
          {segs.map(s => (
            <circle key={s.i} cx={size/2} cy={size/2} r={r} fill="none"
              stroke={colors[s.i]}
              strokeWidth={active === s.i ? thickness + 4 : thickness}
              strokeLinecap="butt"
              strokeDasharray={on ? s.dash : `0 ${C}`}
              strokeDashoffset={s.offset}
              opacity={active == null || active === s.i ? 1 : 0.4}
              onMouseEnter={() => setActive(s.i)}
              onMouseLeave={() => setActive(null)}
              style={{ transition: `stroke-dasharray .9s cubic-bezier(.4,0,.2,1) ${s.i * .07}s, stroke-width .2s, opacity .2s`, cursor: 'pointer' }}
            />
          ))}
        </svg>

        {/* Center label */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
          {displayItem ? (
            <>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{displayItem.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: colors[active] }}>{privateMode ? '••' : fmt(displayItem.value)}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{total > 0 ? (displayItem.value / total * 100).toFixed(1) : 0}%</p>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Łącznie</p>
              <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800 }}>{privateMode ? '••' : fmt(total)}</p>
            </>
          )}
        </div>
      </div>

        {/* Boczny opis największej pozycji */}
        {topItem && (
          <div style={{ minWidth: 130, flex: '1 1 130px', maxWidth: 220 }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{topWord}</p>
            <p style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: colors[0], flexShrink: 0 }} />
              {topItem.name}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{topPct.toFixed(0)}%</span> całości
              {!privateMode && <> · {fmt(topItem.value)}</>}
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((item, i) => {
          const pct = total > 0 ? (item.value / total * 100) : 0
          return (
            <div key={item.name}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 8, background: active === i ? 'var(--surface2)' : 'transparent', transition: 'background 0.15s', cursor: 'pointer' }}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <div style={{ width: 10, height: 10, borderRadius: 3, background: colors[i], flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13 }}>{item.name}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{privateMode ? '••' : fmt(item.value)}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
