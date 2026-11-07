import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { fmt } from '../../utils/currency'
import { IconClose, IconChart, IconChevronLeft, IconChevronRight } from '../Icons'
import { GroupedBars } from '../ChartPrimitives'
import { isTransfer } from '../../utils/categories'
import { bladSubskrypcji } from '../../utils/polaczenie'
import { inPLN, investedNet, isInvestmentFlow } from '../../utils/moneyFlow'

const MONTH_NAMES = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']

// Statystyki i analiza całej historii — na przestrzeni lat i miesięcy.
export default function StatsPanel({ user, privateMode = false, onClose }) {
  const [all, setAll]         = useState([])
  const [loading, setLoading] = useState(true)
  const [selYear, setSelYear] = useState(null)
  const [accounts, setAccounts] = useState([])

  useEffect(() => onSnapshot(collection(db, 'users', user.uid, 'accounts'),
    snap => setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('accounts')), [user.uid])
  const accById = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'asc'))
    // Pierwsza odpowiedź z pamięci telefonu może mieć tylko część historii
    // (np. sam bieżący miesiąc) — statystyki pokazujemy dopiero z pełnych
    // danych z serwera, a bez sieci po 8 s z tego, co jest.
    const t0 = Date.now()
    const fallback = setTimeout(() => setLoading(false), 8000)
    const stop = onSnapshot(q, snap => {
      setAll(snap.docs.map(d => ({ id: d.id, ...d.data(), date: (d.data().date?.toDate?.() ?? d.data().createdAt?.toDate?.() ?? new Date()) })))
      if (!snap.metadata.fromCache || Date.now() - t0 > 8000) { clearTimeout(fallback); setLoading(false) }
    }, bladSubskrypcji('transactions', { przyBledzie: () => setLoading(false) }))
    return () => { clearTimeout(fallback); stop() }
  }, [user.uid])

  // Kwoty w złotówkach (waluty po kursie z importu), bez przelewów między kontami
  const tx = useMemo(() => all.filter(t => !isTransfer(t) && (t.type === 'income' || t.type === 'expense'))
    .map(t => ({ ...t, amount: inPLN(t) })), [all])
  const invFlows = useMemo(() => all.filter(t => isInvestmentFlow(t, accById)), [all, accById])
  const investedIn = (year) => investedNet(year == null ? invFlows : invFlows.filter(t => t.date.getFullYear() === year), accById)

  // Podsumowanie per rok
  const years = useMemo(() => {
    const map = {}
    tx.forEach(t => {
      const y = t.date.getFullYear()
      if (!map[y]) map[y] = { year: y, income: 0, expense: 0, count: 0 }
      if (t.type === 'income') map[y].income += t.amount
      else map[y].expense += t.amount
      map[y].count++
    })
    return Object.values(map).sort((a, b) => b.year - a.year)
  }, [tx])

  const activeYear = selYear ?? years[0]?.year ?? new Date().getFullYear()

  // Kubełki miesięczne dla wybranego roku
  const monthly = useMemo(() => {
    const buckets = MONTH_NAMES.map(n => ({ label: n, income: 0, expense: 0 }))
    tx.filter(t => t.date.getFullYear() === activeYear).forEach(t => {
      const m = t.date.getMonth()
      if (t.type === 'income') buckets[m].income += t.amount
      else buckets[m].expense += t.amount
    })
    return buckets
  }, [tx, activeYear])

  const yearRow = years.find(y => y.year === activeYear) || { income: 0, expense: 0, count: 0 }
  const yearBalance = yearRow.income - yearRow.expense
  const savingsRate = yearRow.income > 0 ? Math.round((yearBalance / yearRow.income) * 100) : null
  const activeMonths = monthly.filter(m => m.income > 0 || m.expense > 0)
  const avgMonthExp = activeMonths.length ? yearRow.expense / activeMonths.length : 0
  const topExpMonth = monthly.reduce((p, c, i) => c.expense > (p?.expense ?? -1) ? { ...c, i } : p, null)

  // Cała historia
  const allTime = useMemo(() => tx.reduce((acc, t) => {
    if (t.type === 'income') acc.income += t.amount; else acc.expense += t.amount
    return acc
  }, { income: 0, expense: 0 }), [tx])
  const allBalance = allTime.income - allTime.expense
  const allInvested = investedIn(null)
  const yearInvested = investedIn(activeYear)
  // Czy bilans się zgadza: bilans − zainwestowane ≈ to, co jest teraz na zwykłych kontach w zł
  const onAccounts = accounts.filter(a => a.type !== 'investment' && (a.currency || 'PLN') === 'PLN').reduce((s, a) => s + (Number(a.balance) || 0), 0)
  const shouldBe = allBalance - allInvested
  const gap = onAccounts - shouldBe
  // Wartość inwestycji to szacunek z sald wpisanych na kontach inwestycyjnych —
  // kurs zmienia się codziennie, więc nie liczymy jej do bilansu ani przychodów.
  const investValue = accounts.filter(a => a.type === 'investment' && (a.currency || 'PLN') === 'PLN').reduce((s, a) => s + (Number(a.balance) || 0), 0)
  const investDiff = investValue - allInvested
  // Rozbicie: ile wpłynęło na inwestycje, a ile z nich wróciło (sprzedaż, wypłata)
  const invPaidIn = investedNet(invFlows.filter(t => t.type === 'expense'), accById)
  const invBack = Math.round((invPaidIn - allInvested) * 100) / 100

  const money = (n) => privateMode ? '••' : fmt(n)
  const hasYearData = monthly.some(m => m.income > 0 || m.expense > 0)
  const yearIdx = years.findIndex(y => y.year === activeYear)

  const Tile = ({ label, value, color }) => (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-tall">
        <div className="modal-header">
          <h3><IconChart size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />Statystyki i analiza</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>

        <div style={{ padding: '4px 2px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div className="list-loading">Ładowanie...</div>
          ) : tx.length === 0 ? (
            <div className="charts-empty">
              <p style={{ marginBottom: 8, opacity: 0.4 }}><IconChart size={32} /></p>
              <p>Brak transakcji do analizy</p>
            </div>
          ) : (
            <>
              {/* Cała historia */}
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Cała historia</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  <Tile label="Przychody" value={`+${money(allTime.income)}`} color="var(--income)" />
                  <Tile label="Wydatki" value={`−${money(allTime.expense)}`} color="var(--expense)" />
                  <Tile label="Bilans" value={`${allBalance >= 0 ? '+' : '−'}${money(Math.abs(allBalance))}`} color={allBalance >= 0 ? 'var(--income)' : 'var(--expense)'} />
                  {accounts.length > 0 && <Tile label="Na kontach (zł)" value={money(onAccounts)} />}
                  {allInvested !== 0 && <Tile label="Zainwestowane" value={money(allInvested)} color="var(--accent)" />}
                  {allInvested !== 0 && investValue > 0 && (
                    <Tile label="Inwestycje teraz ≈" value={`≈ ${money(investValue)}`} color="var(--text-muted)" />
                  )}
                </div>
                {accounts.length > 0 && (
                  <p style={{ margin: '8px 2px 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {allInvested !== 0
                      ? <>Bilans ≈ to, co masz na kontach, plus to, co wpłaciłaś na inwestycje{Math.abs(gap) >= 1 ? <> (różnica {gap >= 0 ? '+' : '−'}{money(Math.abs(gap))} — saldo z początku historii, gotówka wydana bez zapisu, waluty)</> : ''}.
                        {' '}Zainwestowane = wpłaty {money(invPaidIn)}{invBack > 0 ? <> − to, co wróciło {money(invBack)}</> : ''}.
                        {' '}Wartość inwestycji jest szacunkowa — z sald wpisanych na kontach inwestycyjnych{investValue > 0 ? <> ({investDiff >= 0 ? '≈ +' : '≈ −'}{money(Math.abs(investDiff))} względem wpłat)</> : ''}. Nie liczy się do bilansu; zysk stanie się przychodem dopiero, gdy go wypłacisz.</>
                      : <>Bilans ≈ to, co masz na kontach{Math.abs(gap) >= 1 ? <> (różnica {gap >= 0 ? '+' : '−'}{money(Math.abs(gap))} — saldo z początku historii, gotówka wydana bez zapisu, waluty)</> : ''}.</>}
                  </p>
                )}
              </div>

              {/* Nawigacja po latach */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="icon-btn" disabled={yearIdx >= years.length - 1} onClick={() => setSelYear(years[yearIdx + 1].year)}><IconChevronLeft size={16} /></button>
                <span style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700 }}>{activeYear}</span>
                <button className="icon-btn" disabled={yearIdx <= 0} onClick={() => setSelYear(years[yearIdx - 1].year)}><IconChevronRight size={16} /></button>
              </div>

              {/* Rok w liczbach */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                <Tile label="Przychody roku" value={`+${money(yearRow.income)}`} color="var(--income)" />
                <Tile label="Wydatki roku" value={`−${money(yearRow.expense)}`} color="var(--expense)" />
                <Tile label="Bilans roku" value={`${yearBalance >= 0 ? '+' : '−'}${money(Math.abs(yearBalance))}`} color={yearBalance >= 0 ? 'var(--income)' : 'var(--expense)'} />
                {yearInvested !== 0 && <Tile label="Zainwestowane w roku" value={money(yearInvested)} color="var(--accent)" />}
                <Tile label="Oszczędności" value={savingsRate === null ? '—' : `${savingsRate}%`} color={savingsRate >= 0 ? 'var(--income)' : 'var(--expense)'} />
                <Tile label="Śr. wydatki / mies." value={money(avgMonthExp)} />
                <Tile label="Najdroższy mies." value={topExpMonth && topExpMonth.expense > 0 ? `${topExpMonth.label} · ${money(topExpMonth.expense)}` : '—'} />
              </div>

              {/* Wykres miesięczny */}
              <div className="card card-pad" style={{ overflow: 'hidden' }}>
                <p style={{ margin: '0 0 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  Przychody i wydatki · {activeYear} wg miesięcy
                </p>
                {hasYearData ? (
                  <>
                    <GroupedBars data={monthly} height={150} barMaxWidth={10} fmt={privateMode ? () => '••' : (n) => Math.round(n).toLocaleString('pl-PL')} />
                    <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                      {[['var(--income)', 'Przychody'], ['var(--expense)', 'Wydatki']].map(([color, lbl]) => (
                        <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lbl}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '24px 0' }}>Brak danych w tym roku</div>
                )}
              </div>

              {/* Porównanie lat */}
              {years.length > 1 && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Porównanie lat</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {years.map(y => {
                      const bal = y.income - y.expense
                      return (
                        <button key={y.year} onClick={() => setSelYear(y.year)} style={{
                          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer',
                          background: y.year === activeYear ? 'var(--surface2)' : 'var(--surface)',
                          border: `1px solid ${y.year === activeYear ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: 10, padding: '10px 14px',
                        }}>
                          <span style={{ fontSize: 14, fontWeight: 700, width: 44, flexShrink: 0 }}>{y.year}</span>
                          <span style={{ flex: 1, fontSize: 12, color: 'var(--income)' }}>+{money(y.income)}</span>
                          <span style={{ flex: 1, fontSize: 12, color: 'var(--expense)' }}>−{money(y.expense)}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: bal >= 0 ? 'var(--income)' : 'var(--expense)', flexShrink: 0 }}>
                            {bal >= 0 ? '+' : '−'}{money(Math.abs(bal))}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
