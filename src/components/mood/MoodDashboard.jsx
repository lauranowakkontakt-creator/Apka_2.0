import { useState, useEffect, useMemo, useRef } from 'react'
import { collection, query, deleteDoc, doc, orderBy } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import StatTiles from '../StatTiles'
import { format, startOfMonth, getDaysInMonth, addDays, subMonths, addMonths } from 'date-fns'
import { pl } from 'date-fns/locale'
import { LineAreaSVG, DonutStat, BarChartSVG } from '../ChartPrimitives'
import { IconTrash, IconChevronLeft, IconChevronRight, IconPlus, IconClose, IconChart, IcMoon, IconEdit } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import SegTabs from '../SegTabs'
import PersonBubble from '../PersonBubble'
import { Rozwijana, RokWPikselach } from '../Analityka'
import { wpisyOkresu, statystykiNastroju, podsumowanieLat } from '../../utils/moodStats'
import { bladSubskrypcji } from '../../utils/polaczenie'
import { statystykiCyklu, dzienCyklu, fazaCyklu, prognozaCyklu, czyOkres, kalendarzCyklu, FAZY } from '../../utils/cycleLogic'
import { senDnia, fmtCzas } from '../../utils/sleepLogic'
import MoodEntryForm from './MoodEntryForm'
import MoodInsights from './MoodInsights'
import SleepView from './SleepView'
import CycleView from './CycleView'
import { chwileWpisu } from '../../utils/moodEntry'
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
  const [entryMood, setEntryMood] = useState(null) // nastrój wybrany buźką na karcie „dziś”
  const [entryEdit, setEntryEdit] = useState(null) // edytowany wpis (jeden wpis na dzień)
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

  // Jeden wpis na dzień: „+”, buźka albo dotknięcie wpisu otwiera ISTNIEJĄCY wpis
  // tego dnia (do zmiany i dopisania), a nowy powstaje tylko, gdy dnia jeszcze nie ma.
  const logsRef = useRef(logs)
  logsRef.current = logs
  const otworz = (d, m = null, log = null) => {
    const dzien = d <= TODAY() ? d : TODAY()
    const istniejacy = log || logsRef.current
      .filter(l => l.date === dzien)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0] || null
    setEntryMood(m); setEntryEdit(istniejacy); setEntryDate(dzien)
  }

  // Górna belka („Apka"): [analiza][＋ Dodaj] — spójnie z innymi modułami.
  // „+” dodaje to, co pasuje do otwartej zakładki. Hook przed early-returnem.
  useEffect(() => {
    const dodaj = () => {
      if (tab === 'sleep') setSenForm({ type: 'night' })
      else if (tab === 'cycle') setCyklForm(true)
      else otworz(selDate)
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
          onDelete={handleDelete} selDate={selDate} setSelDate={setSelDate} view={view} onCycle={() => setTab('cycle')} onSleep={() => setTab('sleep')}
          onAddEntry={otworz} onEdit={(log) => otworz(log.date, null, log)} />
      )}
      {view === 'main' && tab === 'sleep' && <SleepView user={user} logs={sleepLogs} formularz={senForm} setFormularz={setSenForm} />}
      {view === 'main' && tab === 'cycle' && <CycleView user={user} okresy={okresy} moodLogs={logs} formularz={cyklForm} setFormularz={setCyklForm} />}

      {/* Modal wpisu — otwierany spod „+" */}
      {entryDate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEntryDate(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{entryEdit ? (entryDate === TODAY() ? 'Dziś · zmień lub dopisz' : `Wpis · ${entryLabel}`) : entryDate === TODAY() ? 'Nowy wpis · dziś' : `Wpis · ${entryLabel}`}</h3>
              <button className="modal-close" aria-label="Zamknij" onClick={() => setEntryDate(null)}><IconClose size={16} /></button>
            </div>
            <MoodEntryForm key={entryDate + (entryMood || '') + (entryEdit?.id || '')} user={user} date={entryDate} initialMood={entryMood} edit={entryEdit}
              ust={ust} zapiszUst={zapiszUst} people={osoby}
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
function MoodPage({ logs, sleepLogs, okresy, people, ust, zapiszUst, onDelete, selDate, setSelDate, onAddEntry, onEdit, onCycle, onSleep, view = 'main' }) {
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
  const kalCyklu = useMemo(() => kalendarzCyklu(okresy, today, 6), [okresy, today])

  // Kalendarz miesiąca
  const firstDow = (mStart.getDay() + 6) % 7
  const calDays = Array.from({ length: daysCount }, (_, i) => {
    const d = format(addDays(mStart, i), 'yyyy-MM-dd')
    const dl = logs.filter(l => l.date === d)
    const avgV = dl.length ? dl.reduce((s, l) => s + (l.moodValue || 0), 0) / dl.length : null
    const mObj = avgV ? moodDla(avgV) : null
    return { date: d, dayNum: format(addDays(mStart, i), 'd'), count: dl.length, color: mObj?.color,
      okres: d <= today && czyOkres(okresy, d, cykl.dlugoscOkresu), prognoza: kalCyklu.prognoza.has(d) }
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

  // ── WIDOK GŁÓWNY: karta „dziś", kalendarz miesiąca i wpisy wybranego dnia ──
  if (view === 'main') {
    const dzisLogs = logs.filter(l => l.date === today && l.moodValue)
    const dzisSrednia = dzisLogs.length ? dzisLogs.reduce((s, l) => s + l.moodValue, 0) / dzisLogs.length : null
    const dzisMood = dzisSrednia ? moodDla(dzisSrednia) : null
    const senDzis = senDnia(sleepLogs, today)
    const dzisLbl = format(new Date(), 'EEEE, d MMMM', { locale: pl })
    const ileWpisow = (n) => `${n} ${n === 1 ? 'wpis' : n < 5 ? 'wpisy' : 'wpisów'}`
    return (
      <div className="mood-main">
        {/* Dziś: nastrój, szybki wybór buźki, cykl i sen w jednej karcie */}
        <section className="mood-today-card">
          <div className="mood-today-top">
            <div className={`mood-today-face${dzisMood ? '' : ' empty'}`} style={dzisMood ? { '--c': dzisMood.color } : undefined}>
              {dzisMood ? <MoodFace mood={dzisMood} size={34} active /> : <span>?</span>}
            </div>
            <div className="mood-today-txt">
              <small>{dzisLbl}</small>
              <strong>{dzisMood ? dzisMood.label : 'Jak się dziś masz?'}</strong>
              {dzisMood && <span>{ileWpisow(dzisLogs.length)} · {fmt10(dzisSrednia)}/10</span>}
            </div>
          </div>
          <div className="mood-quick" role="group" aria-label="Szybki wpis nastroju">
            {MOODS.map(m => (
              <button key={m.id} type="button" style={{ '--c': m.color }} aria-label={`Dodaj wpis: ${m.label}`}
                onClick={() => onAddEntry?.(today, m.id)}>
                <MoodFace mood={m} size={24} active />
              </button>
            ))}
          </div>
          {(faza || senDzis.razem > 0) && (
            <div className="mood-today-chips">
              {faza && (
                <button type="button" onClick={onCycle}>
                  <i style={{ background: FAZY[faza].kolor }} />dzień {dzienC} · {FAZY[faza].nazwa.toLowerCase()}
                  {prog && prog.dniDo > 0 && <em>okres za {prog.dniDo} d</em>}
                </button>
              )}
              {senDzis.razem > 0 && (
                <button type="button" onClick={onSleep}>
                  <IcMoon size={13} />{senDzis.maNoc ? fmtCzas(senDzis.noc) : `drzemka ${fmtCzas(senDzis.drzemki)}`}
                  {senDzis.pobudki > 0 && <em>{senDzis.pobudki}× pobudka</em>}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Na komputerze kalendarz i wpisy stoją obok siebie. */}
        <div className="mood-main-grid">
          <section className="mood-cal">
            <div className="mood-cal-head">
              <button type="button" className="mood-cal-nav" aria-label="Poprzedni miesiąc" onClick={() => setMonth(m => addMonths(m, -1))}><IconChevronLeft size={15} /></button>
              <div className="mood-cal-title">
                <strong>{monthLbl} {year}</strong>
                <small>{tileStats.srednia ? <>śr. <b style={{ color: tileColor }}>{fmt10(tileStats.srednia)}</b> · {tileStats.dni} {tileStats.dni === 1 ? 'dzień' : 'dni'}</> : 'brak wpisów'}</small>
              </div>
              <button type="button" className="mood-cal-nav" aria-label="Następny miesiąc" onClick={() => setMonth(m => addMonths(m, 1))}><IconChevronRight size={15} /></button>
            </div>
            <div className="mood-cal-grid">
              {['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'].map(d => <span key={d} className="mood-cal-dow">{d}</span>)}
              {Array.from({ length: firstDow }, (_, i) => <span key={'e' + i} />)}
              {calDays.map(({ date, dayNum, count, color, okres, prognoza }) => {
                const isSel = date === selDate
                const isTd = date === today
                return (
                  <button key={date} type="button" onClick={() => setSelDate(date)} aria-pressed={isSel}
                    className={`mood-cal-day${color ? ' has' : ''}${isSel ? ' sel' : ''}${isTd ? ' today' : ''}${date > today ? ' future' : ''}`}
                    style={color ? { '--c': color } : undefined}
                    aria-label={`${dayNum}${count ? `, wpisów: ${count}` : ''}${okres ? ', okres' : prognoza ? ', spodziewany okres' : ''}`}>
                    {dayNum}
                    {(okres || prognoza) && <i className={`mcal-okres${okres ? '' : ' prog'}`} />}
                  </button>
                )
              })}
            </div>
            <div className="mood-cal-legend">
              {MOODS.map(m => <span key={m.id}><i style={{ background: m.color }} />{m.label}</span>)}
              {okresy.length > 0 && <span><i className="mcal-okres leg" />okres</span>}
            </div>
          </section>

          {/* Wpisy wybranego dnia */}
          <section className="mood-day">
            <div className="mood-day-head">
              <strong>{selDate === today ? 'Dziś' : selLabel}</strong>
              {canAdd && (
                <button type="button" className="mood-day-add" onClick={() => onAddEntry?.(selDate)}>
                  {dayLogs.length ? <><IconEdit size={13} /> zmień / dopisz</> : <><IconPlus size={13} /> wpis</>}
                </button>
              )}
            </div>
            {senWybranego.razem > 0 && selDate !== today && (
              <div className="mood-day-sleep"><IcMoon size={13} />
                {senWybranego.maNoc ? `noc ${fmtCzas(senWybranego.noc)}` : ''}
                {senWybranego.maNoc && senWybranego.pobudki ? ` · ${senWybranego.pobudki}× pobudka` : ''}
                {senWybranego.liczbaDrzemek ? `${senWybranego.maNoc ? ' · ' : ''}drzemki ${fmtCzas(senWybranego.drzemki)}` : ''}
              </div>
            )}
            {dayLogs.length > 0 ? (
              dayLogs.map(log => <LogEntry key={log.id} log={log} onDelete={() => onDelete(log)} onEdit={() => onEdit(log)} people={people} ust={ust} />)
            ) : (
              <p className="mood-day-empty">{canAdd ? 'Brak wpisów tego dnia' : 'Nie można dodać wpisu z przyszłości'}</p>
            )}
          </section>
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

function LogEntry({ log, onDelete, onEdit, people, ust }) {
  const moodObj = log.mood ? MOODS.find(m => m.id === log.mood) : null
  const ratingEntries = Object.entries(log.ratings || {}).filter(([, v]) => v > 0).map(([id, v]) => ({ ...findRatingCat(id, ust.ratingCats), value: v }))
  const osoby = (log.peopleIds || []).map(id => people.find(p => p.id === id)).filter(Boolean)
  const czasy = log.emotionTimes || {}
  const emocje = (log.emotions || []).map(id => findEmotion(id, ust.emotions))
    .sort((a, b) => (czasy[a.id] || '99').localeCompare(czasy[b.id] || '99'))
  const czynniki = (log.factors || []).map(id => findFactor(id, ust.factors))
  const wplyw = log.factorEffects || {}
  const chwile = chwileWpisu(log)
  const wiele = chwile.length > 1
  return (
    <article className="mood-log" style={moodObj ? { '--c': moodDla(log.moodValue || moodObj.value).color } : undefined}>
      <div className="mood-log-face">{moodObj && <MoodFace mood={moodDla(log.moodValue || moodObj.value)} size={24} active />}</div>
      <div className="mood-log-body">
        <div className="mood-log-head">
          <button type="button" className="mood-log-open" onClick={onEdit} aria-label="Zmień lub dopisz do wpisu">
            <strong>{wiele ? moodDla(log.moodValue).label : log.moodLabel}</strong>
            {!wiele && log.time && <span>{log.time}</span>}
            <IconEdit size={12} />
          </button>
          <button onClick={onDelete} className="t-btn delete" aria-label="Usuń wpis"><IconTrash size={12} /></button>
        </div>
        {wiele && (
          <div className="mood-chwile" aria-label="Nastrój w ciągu dnia">
            {chwile.map((c, i) => { const m = MOODS.find(x => x.value === c.value); return m && (
              <span key={i} className="mood-chwila" style={{ '--c': m.color }}><MoodFace mood={m} size={16} active />{c.time || ''}</span>
            ) })}
          </div>
        )}
        {(emocje.length > 0 || czynniki.length > 0 || osoby.length > 0) && (
          <div className="mood-tags">
            {emocje.map(em => <span key={em.id} className="mood-tag" style={{ '--c': em.color }}><i />{em.label.toLowerCase()}{czasy[em.id] && wiele && <small>{czasy[em.id]}</small>}</span>)}
            {czynniki.map(f => <span key={f.id} className="mood-tag sq" style={{ '--c': f.color }}><i />{f.label}
              {wplyw[f.id] === 1 && <b className="plus" aria-label="lepiej">↑</b>}{wplyw[f.id] === -1 && <b className="minus" aria-label="gorzej">↓</b>}</span>)}
            {osoby.map(o => <span key={o.id} className="mood-tag person"><PersonBubble person={o} size={16} />{o.name}</span>)}
          </div>
        )}
        {ratingEntries.length > 0 && (
          <div className="mood-log-ratings">
            {ratingEntries.map(c => (
              <span key={c.id}>{c.label}
                <b aria-label={`${c.value} na 5`}>{[1, 2, 3, 4, 5].map(v => <i key={v} style={v <= c.value ? { background: c.color } : undefined} />)}</b>
              </span>
            ))}
          </div>
        )}
        {log.note && <p className="mood-log-note">„{log.note}”</p>}
      </div>
    </article>
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
