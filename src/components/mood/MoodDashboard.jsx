import { useState, useEffect, useMemo } from 'react'
import { collection, query, deleteDoc, doc, orderBy } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import StatTiles from '../StatTiles'
import { format, startOfMonth, getDaysInMonth, addDays, subMonths, addMonths } from 'date-fns'
import { pl } from 'date-fns/locale'
import { LineAreaSVG, DonutStat, BarChartSVG } from '../ChartPrimitives'
import { IconTrash, IconChevronLeft, IconChevronRight, IconPlus, IconClose, IconChart } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import SegTabs from '../SegTabs'
import PersonBubble from '../PersonBubble'
import { Rozwijana, RokWPikselach } from '../Analityka'
import { wpisyOkresu, statystykiNastroju, podsumowanieLat } from '../../utils/moodStats'
import { bladSubskrypcji } from '../../utils/polaczenie'
import { statystykiCyklu, dzienCyklu, fazaCyklu, prognozaCyklu, czyOkres, FAZY } from '../../utils/cycleLogic'
import { senDnia, fmtCzas } from '../../utils/sleepLogic'
import MoodEntryForm from './MoodEntryForm'
import MoodInsights from './MoodInsights'
import SleepView from './SleepView'
import CycleView from './CycleView'
import { MOODS, MoodFace, kicker, to10, fmt10, TODAY, moodDla, findEmotion, findRatingCat, findFactor, useMoodSettings } from './wspolne'

// Kolekcja pod users/{uid}/… z sortowaniem — trzy takie same subskrypcje modułu.
function useKolekcja(uid, nazwa, pole, onLoaded) {
  const [dane, setDane] = useState([])
  useEffect(() => {
    // Bez `pole` bierzemy całą kolekcję — orderBy pominąłby dokumenty bez tego pola.
    const kol = collection(db, 'users', uid, nazwa)
    const q = pole ? query(kol, orderBy(pole, 'desc')) : kol
    return onSnapshot(q, snap => {
      setDane(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      onLoaded?.()
    }, bladSubskrypcji(nazwa))
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps
  return dane
}

// ── Root component ────────────────────────────────────────────────────────────
export default function MoodDashboard({ user, setHeaderExtras }) {
  const [loading, setLoading] = useState(true)
  const [tab, setTab]             = useState('mood') // mood | sleep | cycle
  const [entryDate, setEntryDate] = useState(null) // otwiera modal wpisu dla danego dnia
  const [selDate, setSelDate]     = useState(TODAY()) // wybrany dzień (kalendarz) — dzielony z „+" w rogu
  const [view, setView]           = useState('main') // main | stats (analiza pod ikoną w belce)
  const [senForm, setSenForm]     = useState(null)
  const [cyklForm, setCyklForm]   = useState(false)
  useFallbackTimeout(() => setLoading(false))

  const logs      = useKolekcja(user.uid, 'moodLogs', 'createdAt', () => setLoading(false))
  const sleepLogs = useKolekcja(user.uid, 'sleepLogs', 'date')
  const okresy    = useKolekcja(user.uid, 'cycleLogs', 'start')
  const people    = useKolekcja(user.uid, 'calendarPeople')
  const osoby     = useMemo(() => [...people].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pl')), [people])
  const [ust, zapiszUst] = useMoodSettings(user.uid)

  // Górna belka („Apka"): [analiza][＋ Dodaj] — spójnie z innymi modułami.
  // „+” dodaje to, co pasuje do otwartej zakładki. Hook przed early-returnem.
  useEffect(() => {
    const dodaj = () => {
      if (tab === 'sleep') setSenForm({ type: 'night' })
      else if (tab === 'cycle') setCyklForm(true)
      else setEntryDate(selDate <= TODAY() ? selDate : TODAY())
    }
    setHeaderExtras?.(
      <>
        <button className="hdr-btn" title="Analiza i statystyki" aria-label="Analiza i statystyki" onClick={() => setView('stats')}>
          <IconChart size={17} />
        </button>
        <button className="hdr-btn accent" title="Dodaj wpis" aria-label="Dodaj wpis" onClick={() => { setView('main'); dodaj() }}>
          <IconPlus size={17} />
        </button>
      </>
    )
    return () => setHeaderExtras?.(null)
  }, [selDate, tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (log) => {
    const ok = await confirmDialog({
      title: 'Usunąć wpis nastroju?',
      ...(log.eventId ? { message: 'Z kalendarza zniknie też spotkanie założone z tego wpisu.' } : {}),
    })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'moodLogs', log.id))
    if (log.eventId) await deleteDoc(doc(db, 'users', user.uid, 'calendarEvents', log.eventId)).catch(() => { /* już usunięte w kalendarzu */ })
  }

  if (loading) return <div className="list-loading">Ładowanie...</div>

  const entryLabel = entryDate ? format(new Date(entryDate + 'T12:00:00'), 'd MMMM', { locale: pl }) : ''

  return (
    <div className="mood-dashboard">
      {view === 'stats' ? (
        <div className="rev-subhead">
          <button className="rev-back" onClick={() => setView('main')} title="Wróć" aria-label="Wróć"><IconChevronLeft size={18} /></button>
          <div className="rev-subhead-title">Analiza i statystyki</div>
        </div>
      ) : (
        <SegTabs items={[{ id: 'mood', label: 'Nastrój' }, { id: 'sleep', label: 'Sen' }, { id: 'cycle', label: 'Cykl' }]}
          active={tab} onChange={setTab} style={{ marginBottom: 12 }} />
      )}

      {(view === 'stats' || tab === 'mood') && (
        <MoodPage logs={logs} sleepLogs={sleepLogs} okresy={okresy} people={osoby} ust={ust} zapiszUst={zapiszUst}
          onDelete={handleDelete} selDate={selDate} setSelDate={setSelDate} view={view} onCycle={() => setTab('cycle')}
          onAddEntry={(d) => setEntryDate(d <= TODAY() ? d : TODAY())} />
      )}
      {view === 'main' && tab === 'sleep' && <SleepView user={user} logs={sleepLogs} formularz={senForm} setFormularz={setSenForm} />}
      {view === 'main' && tab === 'cycle' && <CycleView user={user} okresy={okresy} moodLogs={logs} formularz={cyklForm} setFormularz={setCyklForm} />}

      {/* Modal wpisu — otwierany spod „+" */}
      {entryDate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEntryDate(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3 style={{ textTransform: 'capitalize' }}>{entryDate === TODAY() ? 'Nowy wpis · dziś' : `Wpis · ${entryLabel}`}</h3>
              <button className="modal-close" aria-label="Zamknij" onClick={() => setEntryDate(null)}><IconClose size={16} /></button>
            </div>
            <MoodEntryForm key={entryDate} user={user} date={entryDate} ust={ust} zapiszUst={zapiszUst} people={osoby}
              onSaved={() => setEntryDate(null)} />
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   JEDEN WIDOK — wykres + średnia + emocje + wpis + kalendarz
   ============================================================ */
function MoodPage({ logs, sleepLogs, okresy, people, ust, zapiszUst, onDelete, selDate, setSelDate, onAddEntry, onCycle, view = 'main' }) {
  const [viewMode, setViewMode] = useState('month') // month | year | all
  const [month, setMonth]     = useState(new Date())
  const today = TODAY()

  const year = month.getFullYear()
  const monthStr = format(month, 'yyyy-MM')
  const monthLbl = (() => { const l = format(month, 'LLLL', { locale: pl }); return l.charAt(0).toUpperCase() + l.slice(1) })()
  const mStart = startOfMonth(month)
  const daysCount = getDaysInMonth(month)
  const monthLogs = useMemo(() => logs.filter(l => l.date.startsWith(monthStr)), [logs, monthStr])

  // Średnia + zmiana m/m (skala 1–10)
  const valid = monthLogs.filter(l => l.moodValue)
  const monthAvg = valid.length ? valid.reduce((s, l) => s + l.moodValue, 0) / valid.length : 0
  const prevStr = format(subMonths(month, 1), 'yyyy-MM')
  const prevValid = logs.filter(l => l.date.startsWith(prevStr) && l.moodValue)
  const prevAvg = prevValid.length ? prevValid.reduce((s, l) => s + l.moodValue, 0) / prevValid.length : 0
  const diff = prevAvg > 0 && monthAvg > 0 ? to10(monthAvg) - to10(prevAvg) : null

  // Wykres dzienny
  const chartData = useMemo(() => Array.from({ length: daysCount }, (_, i) => {
    const d = format(addDays(mStart, i), 'yyyy-MM-dd')
    const dl = logs.filter(l => l.date === d)
    const a = dl.length ? dl.reduce((s, l) => s + (l.moodValue || 0), 0) / dl.length : null
    return { day: String(i + 1), value: a }
  }).filter(d => d.value !== null), [logs, monthStr]) // eslint-disable-line

  // Kafelki liczą się z tego, co widać na ekranie: w kalendarzu z przeglądanego
  // miesiąca, w analizie z wybranego trybu. Wcześniej niezależnie od wszystkiego
  // pokazywały sumę wszystkich wpisów i średnią z całej historii.
  const tileMode  = view === 'main' ? 'month' : viewMode
  const tileLogs  = wpisyOkresu(logs, tileMode, tileMode === 'year' ? String(year) : monthStr)
  const tileStats = statystykiNastroju(tileLogs)
  const tileColor = tileStats.srednia
    ? moodDla(tileStats.srednia).color
    : undefined
  const tiles = (
    <StatTiles tiles={[
      { label: 'Wpisy', value: tileStats.wpisy },
      { label: 'Średni nastrój', value: tileStats.srednia ? fmt10(tileStats.srednia) : '—', color: tileColor },
      { label: 'Dni z wpisem', value: tileStats.dni },
    ]} />
  )

  // Najczęstsze emocje — z tego samego okresu co reszta analizy
  const emoSource = wpisyOkresu(logs, viewMode, viewMode === 'year' ? String(year) : monthStr)
  const topEms = useMemo(() => {
    const c = {}
    emoSource.forEach(l => (l.emotions || []).forEach(id => { c[id] = (c[id] || 0) + 1 }))
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ ...findEmotion(id, ust.emotions), count: n }))
  }, [emoSource, ust.emotions])

  // Cykl: dzień i faza na dziś + dni okresu do zaznaczenia w kalendarzu
  const cykl = statystykiCyklu(okresy)
  const prog = prognozaCyklu(okresy, today)
  const dzienC = dzienCyklu(okresy, today)
  const faza = fazaCyklu(dzienC, cykl.dlugoscCyklu, cykl.dlugoscOkresu)

  // Kalendarz miesiąca
  const firstDow = (mStart.getDay() + 6) % 7
  const calDays = Array.from({ length: daysCount }, (_, i) => {
    const d = format(addDays(mStart, i), 'yyyy-MM-dd')
    const dl = logs.filter(l => l.date === d)
    const avgV = dl.length ? dl.reduce((s, l) => s + (l.moodValue || 0), 0) / dl.length : null
    const mObj = avgV ? moodDla(avgV) : null
    return { date: d, dayNum: format(addDays(mStart, i), 'd'), count: dl.length, color: mObj?.color,
      okres: czyOkres(okresy, d, cykl.dlugoscOkresu), prognoza: !!prog?.przyszleDni.has(d) }
  })

  // Rok: średnia per miesiąc + średnia roczna
  const yearMonths = Array.from({ length: 12 }, (_, m) => {
    const ms = new Date(year, m, 1)
    const pref = format(ms, 'yyyy-MM')
    const ml = logs.filter(l => (l.date || '').startsWith(pref) && l.moodValue)
    const avgV = ml.length ? ml.reduce((s, l) => s + l.moodValue, 0) / ml.length : null
    const mObj = avgV ? moodDla(avgV) : null
    return { idx: m, label: format(ms, 'LLL', { locale: pl }), avgV, color: mObj?.color, count: ml.length }
  })
  const yearValid = logs.filter(l => (l.date || '').startsWith(String(year)) && l.moodValue)
  const yearAvg = yearValid.length ? yearValid.reduce((s, l) => s + l.moodValue, 0) / yearValid.length : 0

  const senWybranego = senDnia(sleepLogs, selDate)
  const dayLogs = logs.filter(l => l.date === selDate).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  const canAdd = selDate <= today
  const selLabel = format(new Date(selDate + 'T12:00:00'), 'd MMMM yyyy', { locale: pl })

  const nav = (dir) => setMonth(m => addMonths(m, viewMode === 'year' ? dir * 12 : dir))
  const navLabel = viewMode === 'year' ? String(year) : `${monthLbl} ${year}`
  // „Łącznie" nie ma czego przewijać — zamiast strzałek podsumowanie rok po roku.
  const lata = podsumowanieLat(logs)
  // Rok w pikselach: średni nastrój każdego dnia wybranego roku
  const pixYear = year
  const pixDays = useMemo(() => {
    const sum = new Map()
    logs.forEach(l => { if (l.moodValue && (l.date || '').startsWith(String(pixYear))) { const a = sum.get(l.date) || [0, 0]; sum.set(l.date, [a[0] + l.moodValue, a[1] + 1]) } })
    return new Map([...sum].map(([k, [s, n]]) => [k, s / n]))
  }, [logs, pixYear])
  // Emocje jako wykres kołowy (donut) — czytelniejszy podział niż same słupki
  const emoDonut = (list) => (
    <DonutStat
      data={list.map(em => ({ name: em.label, value: em.count }))}
      colors={list.map(em => em.color)}
      fmtValue={v => `${v}×`}
      thickness={22}
    />
  )

  // ── WIDOK GŁÓWNY: kalendarz miesiąca + wpisy wybranego dnia ──────────────────
  if (view === 'main') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Cykl na dziś — skrót do zakładki Cykl */}
        {faza && (
          <button type="button" className="cycle-banner" onClick={onCycle}>
            <i style={{ background: FAZY[faza].kolor }} />
            <span><strong>Dzień {dzienC} cyklu · {FAZY[faza].nazwa.toLowerCase()}</strong>
              <small>{prog && prog.dniDo > 0 ? `okres za ok. ${prog.dniDo} dni · ` : ''}zobacz, czego się spodziewać</small></span>
            <IconChevronRight size={15} />
          </button>
        )}

        {/* Nawigacja miesiąca (nazwa nad kalendarzem) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <button className="month-btn" style={{ width: 32, height: 32 }} onClick={() => setMonth(m => addMonths(m, -1))}><IconChevronLeft size={15} /></button>
          <span style={{ fontSize: 15, fontWeight: 700, textTransform: 'capitalize' }}>{monthLbl} {year}</span>
          <button className="month-btn" style={{ width: 32, height: 32 }} onClick={() => setMonth(m => addMonths(m, 1))}><IconChevronRight size={15} /></button>
        </div>

        {tiles}

        {/* Kalendarz miesiąca (kolor = nastrój dnia; klik wybiera dzień) */}
        <div className="card card-hover-glow" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
            {['P', 'W', 'Ś', 'C', 'P', 'S', 'N'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {Array.from({ length: firstDow }, (_, i) => <div key={'e' + i} />)}
            {calDays.map(({ date, dayNum, count, color, okres, prognoza }) => {
              const isSel = date === selDate
              const isTd = date === today
              return (
                <button key={date} onClick={() => setSelDate(date)} aria-pressed={isSel}
                  aria-label={`${dayNum}${count ? `, wpisów: ${count}` : ''}${okres ? ', okres' : prognoza ? ', spodziewany okres' : ''}`} style={{
                  position: 'relative',
                  aspectRatio: '1 / 1', borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer',
                  background: color ? color + '33' : 'var(--surface2)',
                  border: `1.5px solid ${isSel ? (color || 'var(--accent)') : isTd ? 'var(--accent)' : 'transparent'}`,
                  fontSize: 12, fontWeight: isTd ? 700 : 500, color: color ? 'var(--text)' : 'var(--text-muted)', transition: 'all .15s',
                }}>{dayNum}{(okres || prognoza) && <span className={`cal-okres${okres ? '' : ' prog'}`} />}</button>
              )
            })}
          </div>
          {okresy.length > 0 && (
            <div className="cal-legenda"><span><i className="cal-okres" />okres</span><span><i className="cal-okres prog" />spodziewany</span></div>
          )}
        </div>

        {/* Wpisy wybranego dnia + dodawanie */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            {kicker(selDate === today ? 'Wpisy dziś' : `Wpisy · ${selLabel}`)}
            {canAdd && (
              <button className="t-btn" onClick={() => onAddEntry?.(selDate)}
                style={{ width: 'auto', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
                <IconPlus size={13} /> Dodaj wpis
              </button>
            )}
          </div>
          {senWybranego.razem > 0 && (
            <p className="mood-note" style={{ margin: 0 }}>Sen: {senWybranego.maNoc ? `noc ${fmtCzas(senWybranego.noc)}` : ''}{senWybranego.maNoc && senWybranego.pobudki ? ` · pobudki: ${senWybranego.pobudki}` : ''}{senWybranego.liczbaDrzemek ? `${senWybranego.maNoc ? ' · ' : ''}drzemki ${fmtCzas(senWybranego.drzemki)}` : ''}</p>
          )}
          {dayLogs.length > 0 ? (
            dayLogs.map(log => <LogEntry key={log.id} log={log} onDelete={() => onDelete(log)} people={people} ust={ust} />)
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0', margin: 0 }}>
              {canAdd ? 'Brak wpisów tego dnia' : 'Nie można dodać wpisu z przyszłości'}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── WIDOK ANALIZY: wykresy nastroju i emocji (miesiąc / rok) ─────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Tryb (Miesiąc / Rok) + wspólna nawigacja obu wykresów */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SegTabs items={[{ id: 'month', label: 'Miesiąc' }, { id: 'year', label: 'Rok' }]} active={viewMode} onChange={setViewMode} style={{ maxWidth: 300, flex: 1, minWidth: 0 }} />
        {viewMode !== 'all' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button className="month-btn" style={{ width: 30, height: 30 }} onClick={() => nav(-1)}><IconChevronLeft size={14} /></button>
            <span style={{ minWidth: 92, textAlign: 'center', fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{navLabel}</span>
            <button className="month-btn" style={{ width: 30, height: 30 }} onClick={() => nav(1)}><IconChevronRight size={14} /></button>
          </div>
        )}
      </div>

      {tiles}

      {viewMode === 'month' ? (
        <>
          {/* Nastrój w czasie */}
          <div className="card card-hover-glow" style={{ padding: 16 }}>
            {kicker('Nastrój w czasie', { marginBottom: 10 })}
            {chartData.length === 1 ? (
              <SingleMoodPreview point={chartData[0]} />
            ) : chartData.length > 1 ? (
              <LineAreaSVG
                data={chartData.map(d => ({ label: d.day, value: d.value }))}
                height={160} min={0.5} max={5.5} yTicks={[1, 2, 3, 4, 5]} accent="var(--accent)" allLabels
                fmtValue={v => MOODS.find(m => Math.abs(m.value - v) < 0.5)?.label || v.toFixed(1)}
                fmtLabel={d => `${d} ${monthLbl.toLowerCase()}`}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '30px 0' }}>Brak wpisów w tym miesiącu</div>
            )}
          </div>

          {/* Najczęstsze emocje */}
          {topEms.length > 0 && (
            <div className="card card-hover-glow" style={{ padding: 16 }}>
              {kicker('Najczęstsze emocje', { marginBottom: 12 })}
              {emoDonut(topEms)}
            </div>
          )}
        </>
      ) : viewMode === 'year' ? (
        <>
          {/* ROK: średnia nastroju miesiąc po miesiącu (1–10) — wizualny wykres słupkowy */}
          {yearValid.length > 0 && (
            <div className="card card-hover-glow" style={{ padding: 16 }}>
              {kicker(`Średnia nastroju miesięcami · ${year}`, { marginBottom: 12 })}
              <BarChartSVG
                data={yearMonths.map(m => ({ label: m.label, value: m.avgV ? Math.round(to10(m.avgV) * 10) / 10 : 0 }))}
                height={150} accent="var(--accent)" fmt={v => v ? `${v.toFixed(1).replace('.', ',')}/10` : ''}
              />
            </div>
          )}

          {/* 12 miesięcy z kolorem nastroju */}
          <div className="card card-hover-glow" style={{ padding: 16 }}>
            {kicker(`Nastrój w roku ${year}`, { marginBottom: 12 })}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
              {yearMonths.map(m => (
                <button key={m.idx} onClick={() => { setMonth(new Date(year, m.idx, 1)); setViewMode('month') }} style={{
                  padding: '10px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
                  background: m.color ? m.color + '22' : 'var(--surface2)',
                  border: `1px solid ${m.color ? m.color + '55' : 'var(--border)'}`, transition: 'all .15s',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize', color: m.color || 'var(--text-muted)' }}>{m.label}</div>
                  <div className="serif" style={{ fontSize: 20, marginTop: 4, color: m.color || 'var(--text-muted)' }}>{m.avgV ? fmt10(m.avgV) : '—'}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{m.count ? `${m.count} wpis.` : ''}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Najczęstsze emocje roku — wykres kołowy */}
          {topEms.length > 0 && (
            <div className="card card-hover-glow" style={{ padding: 16 }}>
              {kicker('Najczęstsze emocje roku', { marginBottom: 12 })}
              {emoDonut(topEms)}
            </div>
          )}
        </>
      ) : (
        <>
          {/* ŁĄCZNIE: cała historia — średnia rok po roku zamiast przewijania miesięcy */}
          {lata.length > 0 ? (
            <div className="card card-hover-glow" style={{ padding: 16 }}>
              {kicker('Nastrój rok po roku', { marginBottom: 12 })}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
                {lata.map(r => {
                  const color = r.srednia
                    ? moodDla(r.srednia).color
                    : null
                  return (
                    <button key={r.rok} onClick={() => { setMonth(new Date(Number(r.rok), 0, 1)); setViewMode('year') }} style={{
                      padding: '10px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
                      background: color ? color + '22' : 'var(--surface2)',
                      border: `1px solid ${color ? color + '55' : 'var(--border)'}`, transition: 'all .15s',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: color || 'var(--text-muted)' }}>{r.rok}</div>
                      <div className="serif" style={{ fontSize: 20, marginTop: 4, color: color || 'var(--text-muted)' }}>{r.srednia ? fmt10(r.srednia) : '—'}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{r.dni} {r.dni === 1 ? 'dzień' : 'dni'}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="card card-hover-glow" style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Brak wpisów — zapisz pierwszy nastrój, a pojawi się tu podsumowanie.
            </div>
          )}

          {/* Najczęstsze emocje z całej historii */}
          {topEms.length > 0 && (
            <div className="card card-hover-glow" style={{ padding: 16 }}>
              {kicker('Najczęstsze emocje łącznie', { marginBottom: 12 })}
              {emoDonut(topEms)}
            </div>
          )}
        </>
      )}
      <MoodInsights logs={logs} sleepLogs={sleepLogs} okresy={okresy} people={people} ust={ust} zapiszUst={zapiszUst} />

      {/* Rok w pikselach — każdy dzień w kolorze średniego nastroju */}
      <Rozwijana id="nastroj-pix" tytul={`Rok w pikselach · ${pixYear}`} domyslnie podsumowanie={`${pixDays.size} dni`}>
        <RokWPikselach rok={pixYear} dzis={format(new Date(), 'yyyy-MM-dd')}
          kolorDnia={(k) => { const v = pixDays.get(k); return v ? moodDla(v).color : null }}
          opisDnia={(k) => { const v = pixDays.get(k); return v ? `średnio ${v.toFixed(1).replace('.', ',')} · ${moodDla(v).label}` : 'brak wpisu' }}
          legenda={MOODS.map(m => [m.color, m.label])} />
      </Rozwijana>
    </div>
  )
}

function LogEntry({ log, onDelete, people, ust }) {
  const moodObj = log.mood ? MOODS.find(m => m.id === log.mood) : null
  const ratingEntries = Object.entries(log.ratings || {}).filter(([, v]) => v > 0).map(([id, v]) => ({ ...findRatingCat(id, ust.ratingCats), value: v }))
  const osoby = (log.peopleIds || []).map(id => people.find(p => p.id === id)).filter(Boolean)
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${moodObj ? moodObj.color + '44' : 'var(--border)'}`,
      borderLeft: `3px solid ${moodObj?.color || 'var(--border)'}`,
      borderRadius: 'var(--r)', padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {moodObj && <MoodFace mood={moodObj} size={20} active />}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{log.moodLabel}</span>
          {log.time && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.time}</span>}
        </div>
        <button onClick={onDelete} className="t-btn delete" aria-label="Usuń wpis"><IconTrash size={12} /></button>
      </div>
      {log.emotions?.length > 0 && (
        <div className="mood-tags">
          {log.emotions.map(id => {
            const em = findEmotion(id, ust.emotions)
            return <span key={id} className="mood-tag" style={{ '--c': em.color }}><i />{em.label.toLowerCase()}</span>
          })}
        </div>
      )}
      {(log.factors?.length > 0 || osoby.length > 0) && (
        <div className="mood-tags">
          {(log.factors || []).map(id => {
            const f = findFactor(id, ust.factors)
            return <span key={id} className="mood-tag sq" style={{ '--c': f.color }}><i />{f.label}</span>
          })}
          {osoby.map(o => <span key={o.id} className="mood-tag person"><PersonBubble person={o} size={16} />{o.name}</span>)}
        </div>
      )}
      {ratingEntries.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {ratingEntries.map(c => (
            <span key={c.id} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {c.label} <strong style={{ color: 'var(--text)' }}>{c.value}/5</strong>
            </span>
          ))}
        </div>
      )}
      {log.note && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-sub)', fontStyle: 'italic', lineHeight: 1.5 }}>„{log.note}"</p>}
    </div>
  )
}



// Pojedynczy wpis w miesiącu — zamiast samotnej kropki na wykresie pokaż czytelną kartę
function SingleMoodPreview({ point }) {
  const mObj = moodDla(point.value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 150, padding: '0 6px' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
        background: mObj.color + '22', border: `2px solid ${mObj.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <MoodFace mood={mObj} size={38} active />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: mObj.color }}>{mObj.label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
          Pierwszy wpis w tym miesiącu.<br />Dodaj kolejne dni, a pojawi się wykres trendu.
        </div>
      </div>
    </div>
  )
}
