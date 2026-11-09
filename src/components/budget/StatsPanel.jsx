import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { fmt, getCurrencyCode } from '../../utils/currency'
import { IconChart } from '../Icons'
import { GroupedBars } from '../ChartPrimitives'
import SegTabs from '../SegTabs'
import { Rozwijana, Kafle, MiesiaceRoku, Ranking, DniTygodnia, DonutSzczegoly, TabelaLat } from '../Analityka'
import { rozbijWgLat, zmiana, miesiaceMinione, wgDniaTygodnia, kluczDnia, MIESIACE_KROTKO, MIESIACE_PELNE, DNI_TYG_KROTKO } from '../../utils/analityka'
import { isTransfer } from '../../utils/categories'
import { bladSubskrypcji } from '../../utils/polaczenie'
import { useCategoryColors } from '../../utils/useCategoryColors'
import { inPLN, investedNet, isInvestmentFlow } from '../../utils/moneyFlow'

const MONTH_NAMES = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
// Kolory rankingu — różna jasność, żeby sąsiednie pozycje dało się odróżnić także bez barwy.
const RANK_COLORS = ['#E0673E', '#7C8AF0', '#5FBF98', '#E0B15A', '#5BB6D9', '#C47BD9', '#D98B5F', '#8FB34F', '#E07A9B', '#9AA3B8']

// Przychody i wydatki rok do roku — jeden wykres słupkowy par.
function MiesiaceLat({ years, money }) {
  return <GroupedBars data={years.map(y => ({ label: String(y.year), income: y.income, expense: y.expense }))} height={130} barMaxWidth={18} fmt={money} />
}

// Analiza roku — część ekranu „Analiza" w Finansach (Charts.jsx, tryb „Rok").
// Rok wybiera się strzałkami nad tym widokiem, konto — filtrem kont; tu jest
// rok w liczbach i rozwijane sekcje (treść liczy się dopiero po rozwinięciu).
export default function StatsPanel({ user, privateMode = false, rok, onRokChange, accountFilter = 'all', tryb = 'rok', onOtworzRok }) {
  const [allRaw, setAll]      = useState([])
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState([])

  useEffect(() => onSnapshot(collection(db, 'users', user.uid, 'accounts'),
    snap => setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('accounts')), [user.uid])
  const accById = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts])
  const filtr = accountFilter !== 'all'
  const all = useMemo(() => filtr ? allRaw.filter(t => t.accountId === accountFilter) : allRaw, [allRaw, accountFilter, filtr])

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

  const activeYear = rok ?? new Date().getFullYear()

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
  const onAccounts = accounts.filter(a => (!filtr || a.id === accountFilter) && a.type !== 'investment' && (a.currency || 'PLN') === getCurrencyCode()).reduce((s, a) => s + (Number(a.balance) || 0), 0)
  const shouldBe = allBalance - allInvested
  const gap = onAccounts - shouldBe
  // Wartość inwestycji to szacunek z sald wpisanych na kontach inwestycyjnych —
  // kurs zmienia się codziennie, więc nie liczymy jej do bilansu ani przychodów.
  const investValue = accounts.filter(a => a.type === 'investment' && (a.currency || 'PLN') === getCurrencyCode()).reduce((s, a) => s + (Number(a.balance) || 0), 0)
  const investDiff = investValue - allInvested
  // Rozbicie: ile wpłynęło na inwestycje, a ile z nich wróciło (sprzedaż, wypłata)
  const invPaidIn = investedNet(invFlows.filter(t => t.type === 'expense'), accById)
  const invBack = Math.round((invPaidIn - allInvested) * 100) / 100

  const money = (n) => privateMode ? '••' : fmt(n)
  const moneyK = (n) => privateMode ? '••' : Math.round(n).toLocaleString('pl-PL')
  const hasYearData = monthly.some(m => m.income > 0 || m.expense > 0)
  // Rok bieżący porównujemy z TYM SAMYM okresem rok wcześniej (1 stycznia – dzisiejsza
  // data), a nie z całym poprzednim rokiem — inaczej w listopadzie każdy wynik wyglądałby na spadek.
  const dzis = new Date()
  const trwa = activeYear === dzis.getFullYear()
  const wOkresie = (d) => !trwa || d.getMonth() < dzis.getMonth() || (d.getMonth() === dzis.getMonth() && d.getDate() <= dzis.getDate())
  const prevRow = useMemo(() => {
    const r = { income: 0, expense: 0, count: 0 }
    let any = false
    tx.forEach(t => { if (t.date.getFullYear() === activeYear - 1 && wOkresie(t.date)) { r[t.type] += t.amount; r.count++; any = true } })
    return any ? r : null
  }, [tx, activeYear]) // eslint-disable-line react-hooks/exhaustive-deps
  const vsLabel = activeYear - 1
  const prevMonthly = useMemo(() => {
    const b = MONTH_NAMES.map(() => ({ income: 0, expense: 0 }))
    tx.filter(t => t.date.getFullYear() === activeYear - 1).forEach(t => { b[t.date.getMonth()][t.type] += t.amount })
    return b
  }, [tx, activeYear])
  const minione = miesiaceMinione(activeYear)
  const [miara, setMiara] = useState('expense')
  const [selMonth, setSelMonth] = useState(null)
  // Inny rok (strzałki nad widokiem) — wybór miesiąca z poprzedniego roku nie ma sensu.
  useEffect(() => { setSelMonth(null) }, [rok])
  const wart = (rows, k) => rows.map(r => k === 'balance' ? Math.max(0, r.income - r.expense) : r[k])
  const prevAvgExp = prevRow && minione ? prevRow.expense / minione : null

  // Kategorie wybranego roku (lub miesiąca) z porównaniem do tego samego okresu rok wcześniej
  const kolorKat = useCategoryColors(user.uid)
  const kategorie = useMemo(() => {
    const inScope = (t, y) => t.date.getFullYear() === y && (selMonth === null ? (y === activeYear || wOkresie(t.date)) : t.date.getMonth() === selMonth)
    const ids = {} // nazwa kategorii → categoryId (do koloru)
    const zbierz = (y, type) => {
      const m = {}
      tx.forEach(t => { if (t.type === type && inScope(t, y)) { const k = t.category || 'Inne'; m[k] = (m[k] || 0) + t.amount; if (t.categoryId && !ids[k]) ids[k] = t.categoryId } })
      return m
    }
    const build = (type) => {
      const now = zbierz(activeYear, type), prev = zbierz(activeYear - 1, type)
      return Object.entries(now).sort((a, b) => b[1] - a[1]).map(([nazwa, wartosc], i) => ({
        nazwa, wartosc, kolor: kolorKat(ids[nazwa], nazwa, i),
        delta: prev[nazwa] ? { pct: zmiana(wartosc, prev[nazwa]), odwrotnie: type === 'expense', wzgledem: activeYear - 1 } : null,
      }))
    }
    return { expense: build('expense'), income: build('income') }
  }, [tx, activeYear, selMonth, kolorKat]) // eslint-disable-line react-hooks/exhaustive-deps

  const yearTx = useMemo(() => tx.filter(t => t.date.getFullYear() === activeYear && (selMonth === null || t.date.getMonth() === selMonth)), [tx, activeYear, selMonth])
  const weekday = useMemo(() => wgDniaTygodnia(yearTx.filter(t => t.type === 'expense').map(t => ({ klucz: kluczDnia(t.date), wartosc: t.amount }))), [yearTx])
  const topTx = useMemo(() => yearTx.filter(t => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 8), [yearTx])
  const okres = selMonth === null ? String(activeYear) : `${MIESIACE_PELNE[selMonth].toLowerCase()} ${activeYear}`
  // Szczegóły kategorii po dotknięciu wycinka koła
  const szczegolyKat = (type) => (poz) => {
    const wKat = (t) => t.type === type && (t.category || 'Inne') === poz.nazwa
    const lista = yearTx.filter(wKat).sort((a, b) => b.amount - a.amount)
    const mies = MONTH_NAMES.map(() => 0), miesPrev = MONTH_NAMES.map(() => 0)
    tx.forEach(t => {
      if (!wKat(t)) return
      const y = t.date.getFullYear()
      if (y === activeYear) mies[t.date.getMonth()] += t.amount
      else if (y === activeYear - 1) miesPrev[t.date.getMonth()] += t.amount
    })
    const sub = {}
    lista.forEach(t => { const k = t.subcategoryLabel || 'Bez podkategorii'; sub[k] = (sub[k] || 0) + t.amount })
    const subPoz = Object.entries(sub).sort((a, b) => b[1] - a[1]).map(([nazwa, wartosc], i) => ({ nazwa, wartosc, kolor: i === 0 ? poz.kolor : `color-mix(in oklab, ${poz.kolor} ${Math.max(30, 85 - i * 14)}%, var(--surface3))` }))
    const suma = lista.reduce((a, t) => a + t.amount, 0)
    const wszystkie = yearTx.filter(t => t.type === type).reduce((a, t) => a + t.amount, 0) || 1
    return (
      <>
        <Kafle min={120} items={[
          { label: 'Suma', value: money(suma), color: poz.kolor, delta: poz.delta },
          { label: 'Udział', value: `${Math.round((suma / wszystkie) * 100)}%`, sub: type === 'expense' ? 'wszystkich wydatków' : 'wszystkich przychodów' },
          selMonth === null && { label: 'Średnio / mies.', value: money(minione ? suma / minione : suma) },
          lista.length > 0 && { label: 'Średnio', value: money(suma / lista.length), sub: 'na transakcję' },
        ]} />
        {selMonth === null && (
          <div>
            <p className="an-det-h">Miesiąc po miesiącu</p>
            <MiesiaceRoku rok={activeYear} wartosci={mies} poprzedni={miesPrev.some(v => v > 0) ? miesPrev : null}
              kolor={poz.kolor} minione={minione} trwajacy={trwa ? minione - 1 : null} odwrotnie={type === 'expense'} fmt={money} />
          </div>
        )}
        {subPoz.length > 1 && (
          <div>
            <p className="an-det-h">Podkategorie</p>
            <Ranking pozycje={subPoz} fmt={money} limit={5} />
          </div>
        )}
        {lista.length > 0 && (
          <div>
            <p className="an-det-h">Największe transakcje</p>
            {lista.slice(0, 5).map(t => (
              <div key={t.id} className="an-tx-row">
                <span>{t.description || t.category}<small>{t.date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}{t.subcategoryLabel ? ` · ${t.subcategoryLabel}` : ''}</small></span>
                <b style={{ color: type === 'expense' ? 'var(--expense)' : 'var(--income)' }}>{type === 'expense' ? '−' : '+'}{money(t.amount)}</b>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  const [miaraLat, setMiaraLat] = useState('expense')
  const kategorieLat = useMemo(() => {
    const zb = (type) => rozbijWgLat(tx.filter(t => t.type === type).map(t => ({ nazwa: t.category || 'Inne', rok: t.date.getFullYear(), wartosc: t.amount })))
    return { expense: zb('expense'), income: zb('income') }
  }, [tx])
  const najlepszyRok = years.reduce((p, y) => (!p || y.income - y.expense > p.income - p.expense ? y : p), null)
  const najdrozszyRok = years.reduce((p, y) => (!p || y.expense > p.expense ? y : p), null)

  const MIARY = [{ id: 'expense', label: 'Wydatki' }, { id: 'income', label: 'Przychody' }, { id: 'balance', label: 'Oszczędzone' }]
  const kolorMiary = miara === 'income' ? 'var(--income)' : miara === 'expense' ? 'var(--expense)' : 'var(--info)'

  // ── Widok „Lata": statystyki z całej historii ──
  const wydatkiWszystkie = useMemo(() => tx.filter(t => t.type === 'expense'), [tx])
  const kategorieWszystkie = useMemo(() => {
    const ids = {}
    const build = (type) => {
      const m = {}
      tx.forEach(t => { if (t.type === type) { const k = t.category || 'Inne'; m[k] = (m[k] || 0) + t.amount; if (t.categoryId && !ids[k]) ids[k] = t.categoryId } })
      return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([nazwa, wartosc], i) => ({ nazwa, wartosc, kolor: kolorKat(ids[nazwa], nazwa, i) }))
    }
    return { expense: build('expense'), income: build('income') }
  }, [tx, kolorKat])
  const weekdayWszystkie = useMemo(() => wgDniaTygodnia(wydatkiWszystkie.map(t => ({ klucz: kluczDnia(t.date), wartosc: t.amount }))), [wydatkiWszystkie])
  const topWszystkie = useMemo(() => [...wydatkiWszystkie].sort((a, b) => b.amount - a.amount).slice(0, 8), [wydatkiWszystkie])
  const szczegolyLata = (type) => (poz) => {
    const wKat = (t) => t.type === type && (t.category || 'Inne') === poz.nazwa
    const poLatach = {}
    tx.forEach(t => { if (wKat(t)) { const y = t.date.getFullYear(); poLatach[y] = (poLatach[y] || 0) + t.amount } })
    const rows = Object.entries(poLatach).sort((a, b) => b[0] - a[0]).map(([nazwa, wartosc], i) => ({ nazwa, wartosc, kolor: poz.kolor }))
    const suma = rows.reduce((a, x) => a + x.wartosc, 0)
    const razem = tx.filter(t => t.type === type).reduce((a, t) => a + t.amount, 0) || 1
    return (
      <>
        <Kafle min={120} items={[
          { label: 'Suma', value: money(suma), color: poz.kolor },
          { label: 'Udział', value: `${Math.round((suma / razem) * 100)}%`, sub: type === 'expense' ? 'wszystkich wydatków' : 'wszystkich przychodów' },
          rows.length > 0 && { label: 'Średnio / rok', value: money(suma / rows.length) },
        ]} />
        {rows.length > 1 && (<div><p className="an-det-h">Rok po roku</p><Ranking pozycje={rows} fmt={money} limit={12} /></div>)}
      </>
    )
  }

  const widokLata = loading ? (
    <div className="list-loading">Ładowanie...</div>
  ) : years.length === 0 ? (
    <div className="charts-empty">
      <p style={{ marginBottom: 8, opacity: 0.4 }}><IconChart size={32} /></p>
      <p>Brak transakcji</p>
    </div>
  ) : (
    <>
      <Kafle items={[
        { label: 'Przychody · razem', value: `+${money(allTime.income)}`, color: 'var(--income)' },
        { label: 'Wydatki · razem', value: `−${money(allTime.expense)}`, color: 'var(--expense)' },
        { label: 'Bilans', value: `${allBalance >= 0 ? '+' : '−'}${money(Math.abs(allBalance))}`, color: allBalance >= 0 ? 'var(--income)' : 'var(--expense)' },
        { label: 'Oszczędzasz', value: allTime.income > 0 ? `${Math.round((allBalance / allTime.income) * 100)}%` : '—', sub: 'przychodów' },
        { label: 'Lat w historii', value: String(years.length), sub: `${years[years.length - 1].year} – ${years[0].year}` },
        { label: 'Transakcji', value: String(years.reduce((a, y) => a + y.count, 0)) },
      ]} />

      <Rozwijana id="lata-kat-wyd" tytul="Na co idą pieniądze · wszystkie lata" domyslnie
        podsumowanie={kategorieWszystkie.expense[0] ? `${kategorieWszystkie.expense[0].nazwa} ${moneyK(kategorieWszystkie.expense[0].wartosc)}` : null}>
        <DonutSzczegoly pozycje={kategorieWszystkie.expense} fmt={money} srodek="Wydatki" szczegoly={szczegolyLata('expense')} pusty="Brak wydatków" />
      </Rozwijana>

      <Rozwijana id="lata-kat-prz" tytul="Skąd przychody · wszystkie lata"
        podsumowanie={kategorieWszystkie.income[0] ? `${kategorieWszystkie.income[0].nazwa} ${moneyK(kategorieWszystkie.income[0].wartosc)}` : null}>
        <DonutSzczegoly pozycje={kategorieWszystkie.income} fmt={money} srodek="Przychody" szczegoly={szczegolyLata('income')} pusty="Brak przychodów" />
      </Rozwijana>

              {years.length > 0 && (
                <Rozwijana id="fin-lata" tytul="Przez wszystkie lata" domyslnie podsumowanie={`${years.length} ${years.length === 1 ? 'rok' : 'lat'}`}>
                  <Kafle min={130} items={[
                    { label: 'Średnio / rok · przychody', value: `+${money(allTime.income / years.length)}`, color: 'var(--income)' },
                    { label: 'Średnio / rok · wydatki', value: `−${money(allTime.expense / years.length)}`, color: 'var(--expense)' },
                    najlepszyRok && { label: 'Najlepszy bilans', value: String(najlepszyRok.year), sub: `${najlepszyRok.income - najlepszyRok.expense >= 0 ? '+' : '−'}${money(Math.abs(najlepszyRok.income - najlepszyRok.expense))}`, color: 'var(--income)' },
                    najdrozszyRok && { label: 'Najwięcej wydane', value: String(najdrozszyRok.year), sub: money(najdrozszyRok.expense), color: 'var(--expense)' },
                  ]} />
                  {years.length > 1 && <MiesiaceLat years={[...years].reverse()} money={money} />}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {years.map(y => {
                      const bal = y.income - y.expense
                      return (
                        <button key={y.year} onClick={() => { onRokChange?.(y.year); setSelMonth(null); onOtworzRok?.() }} className="an-lata-row" style={{
                          background: y.year === activeYear ? 'var(--surface2)' : 'transparent',
                          borderColor: y.year === activeYear ? 'var(--accent)' : 'var(--border)',
                        }}>
                          <span style={{ fontSize: 14, fontWeight: 700, width: 44, flexShrink: 0 }}>{y.year}</span>
                          <span style={{ flex: 1, fontSize: 12, color: 'var(--income)' }}>+{moneyK(y.income)}</span>
                          <span style={{ flex: 1, fontSize: 12, color: 'var(--expense)' }}>−{moneyK(y.expense)}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: bal >= 0 ? 'var(--income)' : 'var(--expense)', flexShrink: 0 }}>
                            {bal >= 0 ? '+' : '−'}{moneyK(Math.abs(bal))}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </Rozwijana>
              )}

              {years.length > 0 && (
                <Rozwijana id="fin-kat-lata" tytul="Kategorie rok po roku" podsumowanie={kategorieLat[miaraLat].wiersze[0]?.nazwa}>
                  <SegTabs items={[{ id: 'expense', label: 'Wydatki' }, { id: 'income', label: 'Przychody' }]} active={miaraLat} onChange={setMiaraLat} />
                  <TabelaLat dane={kategorieLat[miaraLat]} fmt={moneyK} limit={10} pusty="Brak danych" />
                  <p className="an-note">Kwoty w złotych, wszystkie lata z historii.</p>
                </Rozwijana>
              )}

              {/* Cała historia */}
              <Rozwijana id="fin-historia" tytul="Cała historia" podsumowanie={`${allBalance >= 0 ? '+' : '−'}${moneyK(Math.abs(allBalance))}`}>
                <Kafle min={120} items={[
                  { label: 'Przychody', value: `+${money(allTime.income)}`, color: 'var(--income)' },
                  { label: 'Wydatki', value: `−${money(allTime.expense)}`, color: 'var(--expense)' },
                  { label: 'Bilans', value: `${allBalance >= 0 ? '+' : '−'}${money(Math.abs(allBalance))}`, color: allBalance >= 0 ? 'var(--income)' : 'var(--expense)' },
                  accounts.length > 0 && { label: 'Na kontach (zł)', value: money(onAccounts) },
                  allInvested !== 0 && { label: 'Zainwestowane', value: money(allInvested), color: 'var(--accent)' },
                  allInvested !== 0 && investValue > 0 && { label: 'Inwestycje teraz ≈', value: `≈ ${money(investValue)}`, color: 'var(--text-sub)' },
                ]} />
                {accounts.length > 0 && !filtr && (
                  <p className="an-note">
                    {allInvested !== 0
                      ? <>Bilans ≈ to, co masz na kontach, plus to, co wpłaciłaś na inwestycje{Math.abs(gap) >= 1 ? <> (różnica {gap >= 0 ? '+' : '−'}{money(Math.abs(gap))} — saldo z początku historii, gotówka wydana bez zapisu, waluty)</> : ''}.
                        {' '}Zainwestowane = wpłaty {money(invPaidIn)}{invBack > 0 ? <> − to, co wróciło {money(invBack)}</> : ''}.
                        {' '}Wartość inwestycji jest szacunkowa — z sald wpisanych na kontach inwestycyjnych{investValue > 0 ? <> ({investDiff >= 0 ? '≈ +' : '≈ −'}{money(Math.abs(investDiff))} względem wpłat)</> : ''}. Nie liczy się do bilansu; zysk stanie się przychodem dopiero, gdy go wypłacisz.</>
                      : <>Bilans ≈ to, co masz na kontach{Math.abs(gap) >= 1 ? <> (różnica {gap >= 0 ? '+' : '−'}{money(Math.abs(gap))} — saldo z początku historii, gotówka wydana bez zapisu, waluty)</> : ''}.</>}
                  </p>
                )}
              </Rozwijana>

      <Rozwijana id="lata-dni" tytul="Wydatki wg dni tygodnia · wszystkie lata"
        podsumowanie={weekdayWszystkie.some(v => v > 0) ? `najwięcej: ${DNI_TYG_KROTKO[weekdayWszystkie.indexOf(Math.max(...weekdayWszystkie))]}` : null}>
        <DniTygodnia wartosci={weekdayWszystkie} kolor="var(--expense)" fmt={moneyK} />
      </Rozwijana>

      <Rozwijana id="lata-top" tytul="Największe wydatki w historii" podsumowanie={topWszystkie[0] ? moneyK(topWszystkie[0].amount) : null}>
        <div className="an-rank">
          {topWszystkie.map(t => (
            <div key={t.id} className="an-rank-top" style={{ marginBottom: 0 }}>
              <span className="an-rank-name" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                <span>{t.description || t.category}</span>
                <small style={{ fontSize: 11, color: 'var(--text-sub)' }}>{t.category} · {t.date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
              </span>
              <span className="an-rank-val" style={{ color: 'var(--expense)' }}>−{money(t.amount)}</span>
            </div>
          ))}
        </div>
      </Rozwijana>
    </>
  )

  return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tryb === 'lata' ? widokLata : loading ? (
            <div className="list-loading">Ładowanie...</div>
          ) : !hasYearData ? (
            <div className="charts-empty">
              <p style={{ marginBottom: 8, opacity: 0.4 }}><IconChart size={32} /></p>
              <p>Brak transakcji w {activeYear} roku</p>
            </div>
          ) : (
            <>

              {/* Rok w liczbach — z porównaniem do poprzedniego roku */}
              <Kafle items={[
                { label: 'Przychody', value: `+${money(yearRow.income)}`, color: 'var(--income)',
                  delta: prevRow ? { pct: zmiana(yearRow.income, prevRow.income), wzgledem: vsLabel } : null },
                { label: 'Wydatki', value: `−${money(yearRow.expense)}`, color: 'var(--expense)',
                  delta: prevRow ? { pct: zmiana(yearRow.expense, prevRow.expense), odwrotnie: true, wzgledem: vsLabel } : null },
                { label: 'Bilans roku', value: `${yearBalance >= 0 ? '+' : '−'}${money(Math.abs(yearBalance))}`, color: yearBalance >= 0 ? 'var(--income)' : 'var(--expense)' },
                { label: 'Oszczędzasz', value: savingsRate === null ? '—' : `${savingsRate}%`, color: savingsRate >= 0 ? 'var(--income)' : 'var(--expense)', sub: 'przychodów' },
                { label: 'Śr. wydatki / mies.', value: money(minione ? yearRow.expense / minione : avgMonthExp),
                  delta: prevAvgExp ? { pct: zmiana(minione ? yearRow.expense / minione : 0, prevAvgExp), odwrotnie: true } : null },
                { label: 'Najdroższy miesiąc', value: topExpMonth && topExpMonth.expense > 0 ? MIESIACE_PELNE[topExpMonth.i] : '—', sub: topExpMonth && topExpMonth.expense > 0 ? money(topExpMonth.expense) : null },
                yearInvested !== 0 && { label: 'Zainwestowane', value: money(yearInvested), color: 'var(--accent)' },
              ]} />

              {trwa && prevRow && <p className="an-note" style={{ marginTop: -4 }}>Strzałki porównują z tym samym okresem {activeYear - 1} roku (1 stycznia – {dzis.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}).</p>}

              <Rozwijana id="fin-miesiace" tytul="Miesiąc po miesiącu" domyslnie podsumowanie={hasYearData ? `${MIESIACE_KROTKO[minione - 1] || ''}: −${moneyK(monthly[Math.max(0, minione - 1)]?.expense || 0)}` : null}>
                {hasYearData ? (
                  <>
                    <SegTabs items={MIARY} active={miara} onChange={setMiara} />
                    <MiesiaceRoku rok={activeYear} minione={minione} kolor={kolorMiary}
                      wartosci={wart(monthly, miara)} poprzedni={years.some(y => y.year === activeYear - 1) ? wart(prevMonthly, miara) : null}
                      trwajacy={trwa ? minione - 1 : null}
                      odwrotnie={miara === 'expense'} fmt={money} wybrany={selMonth} onWybierz={setSelMonth} />
                    <table className="an-tabela">
                      <thead><tr><th>Miesiąc</th><th>Przychody</th><th>Wydatki</th><th>Bilans</th></tr></thead>
                      <tbody>
                        {monthly.map((m, i) => {
                          const bal = m.income - m.expense
                          if (i >= minione && !m.income && !m.expense) return null
                          return (
                            <tr key={i} className={i === selMonth ? 'akt' : ''} onClick={() => setSelMonth(s => s === i ? null : i)} style={{ cursor: 'pointer' }}>
                              <td>{MIESIACE_PELNE[i]}</td>
                              <td style={{ color: 'var(--income)' }}>{moneyK(m.income)}</td>
                              <td style={{ color: 'var(--expense)' }}>{moneyK(m.expense)}</td>
                              <td style={{ color: bal >= 0 ? 'var(--income)' : 'var(--expense)', fontWeight: 700 }}>{bal >= 0 ? '+' : '−'}{moneyK(Math.abs(bal))}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <p className="an-note">Dotknij miesiąca na wykresie lub w tabeli — kategorie, dni tygodnia i największe wydatki poniżej pokażą wtedy tylko ten miesiąc.</p>
                  </>
                ) : <div className="an-pusty">Brak danych w tym roku</div>}
              </Rozwijana>

              <Rozwijana id="fin-kat-wyd" tytul={`Na co idą pieniądze · ${okres}`} domyslnie
                podsumowanie={kategorie.expense[0] ? `${kategorie.expense[0].nazwa} ${moneyK(kategorie.expense[0].wartosc)}` : null}>
                <DonutSzczegoly key={`e${activeYear}-${selMonth}`} pozycje={kategorie.expense} fmt={money} srodek="Wydatki" szczegoly={szczegolyKat('expense')} pusty="Brak wydatków w tym okresie" />
              </Rozwijana>

              <Rozwijana id="fin-kat-prz" tytul={`Skąd przychody · ${okres}`}
                podsumowanie={kategorie.income[0] ? `${kategorie.income[0].nazwa} ${moneyK(kategorie.income[0].wartosc)}` : null}>
                <DonutSzczegoly key={`i${activeYear}-${selMonth}`} pozycje={kategorie.income} fmt={money} srodek="Przychody" szczegoly={szczegolyKat('income')} pusty="Brak przychodów w tym okresie" />
              </Rozwijana>

              <Rozwijana id="fin-dni" tytul={`Wydatki wg dni tygodnia · ${okres}`}
                podsumowanie={weekday.some(v => v > 0) ? `najwięcej: ${DNI_TYG_KROTKO[weekday.indexOf(Math.max(...weekday))]}` : null}>
                <DniTygodnia wartosci={weekday} kolor="var(--expense)" fmt={moneyK} />
              </Rozwijana>

              <Rozwijana id="fin-top" tytul={`Największe wydatki · ${okres}`} podsumowanie={topTx[0] ? moneyK(topTx[0].amount) : null}>
                {topTx.length ? (
                  <div className="an-rank">
                    {topTx.map(t => (
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
              </Rozwijana>

            </>
          )}

        </div>
  )
}
