import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { collection, orderBy, query, where, doc, updateDoc, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { format, startOfWeek, addDays, subDays, startOfMonth, endOfMonth, getDaysInMonth, addMonths, subMonths } from 'date-fns'
import { pl } from 'date-fns/locale'
import HabitForm, { HABIT_CATEGORIES, DEFAULT_HABIT_CATEGORIES } from './HabitForm'
import PauseForm from './PauseForm'
import HabitReorderModal from './HabitReorderModal'
import HabitFreshStart from './HabitFreshStart'
import HabitDayGrid from './HabitDayGrid'
import HabitMenu from './HabitMenu'
import HabitManager from './HabitManager'
import HabitArchive from './HabitArchive'
import RoutineManager from './RoutineManager'
// Nastrój nie jest już osobną apką — mieszka w Nawykach, otwierany z kafelka.
// Leniwie, żeby wejście w Nawyki nie ciągnęło kodu wykresów nastroju.
const MoodDashboard = lazy(() => import('../mood/MoodDashboard'))
import { CatIcon, IconFlame, IconStar, IconCheck, IconPause, IconChevronDown, IconChevronLeft, IconChevronRight, IconPlus, IconMood, IconFlag, IconEdit, IconClose } from '../Icons'
import { Ring, BarChartSVG } from '../ChartPrimitives'
import DayPath from '../DayPath'
import { AnalizaRoku, Rozwijana, Ranking } from '../Analityka'
import SegTabs from '../SegTabs'
import { ymd, statRange, statBuckets, dayAggregate, getPauseIcon, getPauseColor, habitYearMonths } from '../../utils/habitStats'
import MonthCalendar from './MonthCalendar'
import HabitExtras from './HabitExtras'
import AmountStepper from './AmountStepper'
import AmountSheet from './AmountSheet'
import { isPausedDay, isHabitDue, getStreak, getBestStreak, toggleStepDone, isChecklistComplete,
  pauseForDay, pauseReasonMeta, byHabitOrder, rangeStats, byRoutineOrder, groupByRoutine,
  habitDayKind, dayScore, isRequiredHabit, isOptionalHabit, habitDoneDates, isDayComplete,
  habitLifecycle, hasAmountGoal, amountTotals, amountShortLabel, dayAmount,
  amountStats, formatAmount } from '../../utils/habitLogic'
import { bladSubskrypcji } from '../../utils/polaczenie'

const SHOW_DAY_RHYTHM = false

export default function HabitsDashboard({ user, setHeaderExtras }) {
  const [habits, setHabits]         = useState([])
  const [pauses, setPauses]         = useState([])
  const [customCats, setCustomCats] = useState([])
  const [loading, setLoading]       = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [showForm, setShowForm]     = useState(false)
  const [showPause, setShowPause]   = useState(false)
  const [editHabit, setEditHabit]   = useState(null)
  const [view, setView]             = useState('today')
  const [filterCat, setFilterCat]   = useState('all')
  const [selectedDay, setSelectedDay] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showArchive, setShowArchive] = useState(false)  // archiwum spod ⋮, nie z dołu ekranu
  const [openStat, setOpenStat]       = useState(null)   // rozwinięta karta w statystykach
  const [amountFor, setAmountFor]     = useState(null)   // nawyk w oknie „ile dziś" 
  const [showFresh, setShowFresh]     = useState(false)
  const [showReorder, setShowReorder] = useState(false)
  const [showRoutineMgr, setShowRoutineMgr] = useState(false)
  const [showManager, setShowManager] = useState(false)  // lista wszystkich nawyków do edycji
  const [routines, setRoutines]       = useState([])
  const [collapsedRoutines, setCollapsedRoutines] = useState({}) // ręczne nadpisania zwinięcia (per dzień)
  const [statPeriod, setStatPeriod]   = useState('month')
  const [dashMonth, setDashMonth]     = useState(new Date())     // nawigacja miesiąca na dashboardzie
  const [weekAnchor, setWeekAnchor]   = useState(new Date())     // nawigacja tygodnia w statystykach
  const [monthAnchor, setMonthAnchor] = useState(new Date())     // nawigacja miesiąca w statystykach
  const [statYear, setStatYear]       = useState(new Date().getFullYear()) // nawigacja roku w statystykach
  const [moodOpen, setMoodOpen]       = useState(false)  // czy pokazujemy Nastrój zamiast Nawyków
  const [extrasOpen, setExtrasOpen]   = useState(false)  // czy pokazujemy Wyzwania zamiast Nawyków
  const [moodExtras, setMoodExtras]   = useState(null)   // akcje Nastroju wstrzyknięte do wspólnej belki
  const [todayMood, setTodayMood]     = useState(null)

  const TODAY = format(new Date(), 'yyyy-MM-dd')

  // Nastrój z dziś — tylko do kafelka. Jeden filtr równościowy, więc Firestore
  // radzi sobie bez zakładania złożonego indeksu.
  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'moodLogs'), where('date', '==', TODAY))
    return onSnapshot(q, snap => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setTodayMood(logs[0] || null)
    }, bladSubskrypcji('moodLogs', { przyBledzie: () => setTodayMood(null) }))
  }, [user.uid, TODAY])


  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'habits'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => { setHabits(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      bladSubskrypcji('habits', { przyBledzie: () => setLoading(false) }))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'habitPauses'), orderBy('from', 'desc'))
    return onSnapshot(q, snap => setPauses(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('habitPauses'))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'habitCategories'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setCustomCats(snap.docs.map(d => ({ id: d.id, label: d.data().name, icon: d.data().icon || 'IcTag', color: d.data().color }))), bladSubskrypcji('habitCategories'))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'habitRoutines'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setRoutines(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byRoutineOrder)), bladSubskrypcji('habitRoutines'))
  }, [user.uid])

  // Zmiana dnia — czyścimy ręczne rozwinięcia (każdy dzień startuje „domyślnie":
  // zrobione rutyny zwinięte).
  useEffect(() => { setCollapsedRoutines({}) }, [selectedDay])

  // Zapis wykonania dla nawyku na czas / ilość. `completedDates` zostaje
  // źródłem prawdy o zaliczonym dniu — czytają je seria, kalendarze i archiwum —
  // więc trzymamy je w zgodzie z `amounts`: cały cel wpisuje dzień, mniej go
  // zdejmuje. Zero czyści pole, żeby w bazie nie zostawały puste wpisy.
  const setDayAmount = async (habit, date, value) => {
    const ref = doc(db, 'users', user.uid, 'habits', habit.id)
    const target = Number(habit.target) || 0
    await updateDoc(ref, {
      [`amounts.${date}`]: value > 0 ? value : deleteField(),
      completedDates: value >= target && target > 0 ? arrayUnion(date) : arrayRemove(date),
    })
  }

  const toggleDay = async (habit, date) => {
    const ref = doc(db, 'users', user.uid, 'habits', habit.id)
    const done = habit.completedDates?.includes(date)
    const update = { completedDates: done ? arrayRemove(date) : arrayUnion(date) }
    // Główny check ustawia też wszystkie kroki (odznaczenie — czyści je)
    if (habit.checklist?.length) update[`checklistDone.${date}`] = done ? [] : habit.checklist.map(s => s.id)
    await updateDoc(ref, update)
  }

  // Odhaczenie pojedynczego kroku; komplet kroków zalicza nawyk, brak — cofa zaliczenie
  const toggleStep = async (habit, date, stepId) => {
    const ref = doc(db, 'users', user.uid, 'habits', habit.id)
    const next = toggleStepDone(habit.checklistDone?.[date], stepId)
    await updateDoc(ref, {
      [`checklistDone.${date}`]: next,
      completedDates: isChecklistComplete(habit.checklist, next) ? arrayUnion(date) : arrayRemove(date),
    })
  }

  const allCategories  = [...DEFAULT_HABIT_CATEGORIES, ...customCats]
  const activeHabits   = habits.filter(h => !h.archived).sort(byHabitOrder)
  const archivedHabits = habits.filter(h => h.archived)
  // Ukończone = po dacie zakończenia. Znikają z listy dnia, więc muszą mieć
  // swoje miejsce — inaczej nawyk po prostu przepada.
  const endedHabits    = habits.filter(h => habitLifecycle(h, TODAY) === 'ended').sort(byHabitOrder)
  // Nawyki dodatkowe („wyzwania") mieszkają na własnym ekranie pod flagą w
  // nagłówku — obok nastroju. Z listy dnia i ze statystyk są wyjęte: inaczej
  // byłyby w dwóch miejscach naraz i dalej podbijałyby główne liczby.
  // Ukończone zostają w `activeHabits` (ukończenie to endDate, nie archiwizacja),
  // więc bez tego filtra wchodziły do statystyk i kart nawyków razem z tym, co
  // robisz teraz. Analiza ma dotyczyć aktualnych — historia zamkniętych siedzi
  // w „Ukończone i archiwum".
  const requiredActive = activeHabits.filter(
    h => isRequiredHabit(h) && habitLifecycle(h, TODAY) !== 'ended')
  const extraHabits    = activeHabits.filter(isOptionalHabit)
  // Archiwum w statystykach: pokazujemy karty z historii, ale POZA procentami
  // okresu. Archiwizacja nie zapisuje daty, wiec nie wiadomo, od kiedy nawyk
  // przestal obowiazywac — wliczony do rangeStats wygladalby na pominiety w
  // kazdym dniu po schowaniu i zanizalby biezace miesiace.
  const archivedExtras   = archivedHabits.filter(isOptionalHabit).sort(byHabitOrder)
  // Kolejność układa się dla tego, co robisz TERAZ. Ukończone siedzą dalej w
  // `activeHabits` (nie są zarchiwizowane), więc bez tego filtra wchodziły do
  // układania razem z resztą i zajmowały miejsca, których już nie używasz.
  const reorderable = activeHabits.filter(h => habitLifecycle(h, TODAY) !== 'ended')
  const filtered = requiredActive.filter(h => filterCat === 'all' || h.category === filterCat)

  // Wszystkie odhaczenia (każdy nawyk, każdy dzień) — do analizy roku
  const wpisyNawykow = useMemo(() => habits.filter(h => !h.archived).flatMap(h => habitDoneDates(h).map(k => ({ klucz: k }))), [habits])
  // Lata z jakimikolwiek danymi (do nawigacji w statystykach) — zawsze z bieżącym
  const dataYears = (() => {
    const s = new Set([new Date().getFullYear()])
    habits.forEach(h => habitDoneDates(h).forEach(d => s.add(+d.slice(0, 4))))
    return [...s].sort((a, b) => a - b)
  })()

  const todayDue  = filtered.filter(h => isHabitDue(h, TODAY, pauses) === 'due')
  // Cel dnia liczymy z nawyków WYMAGANYCH, a zrobione — ze wszystkich, więc
  // nadprogramowa robota potrafi przebić cel (np. 11 z 8).
  const score     = dayScore(filtered, TODAY, pauses)
  const doneToday = score.doneTotal

  const todayIsPaused = isPausedDay(TODAY, pauses)

  // Overall streak — max streak across all habits
  const maxStreak = filtered.length > 0
    ? Math.max(...filtered.map(h => getStreak(habitDoneDates(h), h.frequencyDays, pauses, h.startDate)))
    : 0

  // Rekord — najlepsza seria historycznie (kafelek „Postęp dnia")
  const recordStreak = filtered.length > 0
    ? Math.max(...filtered.map(h => getBestStreak(habitDoneDates(h), h.frequencyDays, pauses, h.startDate)))
    : 0

  // Akcje z menu „⋮": Analiza / Pauza / Kolejność
  const handleMenu = (id) => {
    if (id === 'manage') setShowManager(true)
    else if (id === 'stats') setView('stats')
    else if (id === 'pause') setShowPause(true)
    else if (id === 'reorder') setShowReorder(true)
    else if (id === 'routines') setShowRoutineMgr(true)
    else if (id === 'archive') setShowArchive(true)
    else if (id === 'fresh') setShowFresh(true)
  }
  const addBtn = (
    <button className="hdr-btn accent" onClick={() => { setEditHabit(null); setShowForm(true) }} title="Nowy nawyk">
      <IconPlus size={17} />
    </button>
  )

  // Twarz nastroju — jednocześnie przełącznik widoku i informacja, gdzie jesteś.
  // Świeci → jesteś w Nastroju, klik wraca do Nawyków. Szara → jesteś w Nawykach,
  // klik wchodzi w Nastrój. Kolor bierze się z dzisiejszego wpisu.
  const moodBtn = (
    <button
      className={`hdr-mood${moodOpen ? ' active' : ''}`}
      title={moodOpen ? 'Wróć do nawyków' : todayMood ? `Nastrój: ${todayMood.moodLabel || 'zapisany'}` : 'Zapisz nastrój'}
      aria-label={moodOpen ? 'Wróć do nawyków' : 'Nastrój'}
      aria-pressed={moodOpen}
      style={todayMood?.moodColor ? { '--mood-color': todayMood.moodColor } : undefined}
      onClick={() => { setExtrasOpen(false); setMoodOpen(o => !o) }}
    >
      <IconMood size={17} />
    </button>
  )

  // Flaga wyzwań — ten sam wzorzec co twarz nastroju: świeci, gdy jesteś w
  // Wyzwaniach, klik wraca do Nawyków. Dwa widoki nie mogą być otwarte naraz.
  const extrasBtn = (
    <button
      className={`hdr-btn${extrasOpen ? ' accent' : ''}`}
      title={extrasOpen ? 'Wróć do nawyków' : `Wyzwania (dodatkowe)${extraHabits.length ? ` — ${extraHabits.length}` : ''}`}
      aria-label={extrasOpen ? 'Wróć do nawyków' : 'Wyzwania'}
      aria-pressed={extrasOpen}
      onClick={() => { setMoodOpen(false); setExtrasOpen(o => !o) }}
    >
      <IconFlag size={17} />
    </button>
  )

  // Akcje modułu w górnej belce („Apka"). JEDNA belka na oba widoki: w Nastroju
  // pokazujemy jego własne akcje (wstrzyknięte przez moduł do `moodExtras`),
  // w Nawykach — menu i „+". Wcześniej Nastrój otwierał się w osobnym arkuszu
  // z drugim paskiem, który belka Nawyków zasłaniała — nie dało się wyjść.
  // UWAGA: hook musi być przed early-returnem (zasady hooków).
  useEffect(() => {
    setHeaderExtras?.(
      moodOpen
        ? <>{moodBtn}{extrasBtn}{moodExtras}</>
        : <>{moodBtn}{extrasBtn}<HabitMenu onAction={handleMenu} canReorder={reorderable.length > 1} hasArchive={archivedHabits.length + endedHabits.length > 0}
            canFresh={reorderable.length > 0} />{addBtn}</>
    )
    return () => setHeaderExtras?.(null)
  }, [activeHabits.length, archivedHabits.length, endedHabits.length, extraHabits.length, reorderable.length,
      todayMood, moodOpen, moodExtras, extrasOpen])

  if (loading) return <div className="list-loading">Ładowanie...</div>

  const todayLabel = format(new Date(), 'EEEE, d LLL', { locale: pl })

  const kicker = (t) => (
    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-block', width: 14, height: 2, borderRadius: 2, background: 'var(--accent)', opacity: 0.6 }} />
      {t}
    </div>
  )

  // Komórka kalendarza — zbiorczo (intensywność realizacji dnia dla listy nawyków)
  const aggCellFor = (list) => (d) => {
    const { done, due, pct, paused } = dayAggregate(list, pauses, d)
    const future = d > TODAY, isToday = d === TODAY
    let bg = 'var(--surface2)', border = '1px solid transparent', color = 'var(--text-muted)'
    // Przyszły dzień: jeśli jest w zaplanowanej pauzie (wyjazd/choroba), pokaż już
    // jej kolor z przerywaną ramką (= zaplanowane), a nie pustą kratkę.
    if (future) {
      if (paused) { const p = getPauseColor(pauses, d) || 'var(--text-muted)'; bg = p + '22'; border = `1px dashed ${p}88` }
      else { bg = 'transparent'; border = '1px dashed var(--border)' }
    }
    else if (due > 0) {
      bg = `color-mix(in oklab, var(--warn) ${Math.round(22 + pct * 78)}%, var(--surface2))`
      if (pct >= 1) border = '1px solid var(--warn)'
      if (pct >= 0.5) color = 'var(--bg)'
      // Coś zrobione, ale to był dzień wyjazdu/choroby — obwódka powodu,
      // żeby nie wyglądał jak każdy inny dzień.
      if (paused) { const p = getPauseColor(pauses, d) || 'var(--text-muted)'; border = `2px solid ${p}` }
    }
    else if (paused) { const p = getPauseColor(pauses, d) || 'var(--text-muted)'; bg = p + '33'; border = `1px solid ${p}66` }
    const title = `${format(new Date(d + 'T12:00:00'), 'd MMM', { locale: pl })}${due ? ` • ${done}/${due}` : paused ? ` • ${pauseReasonMeta(pauseForDay(d, pauses)?.reason).label.toLowerCase()}${future ? ' (zaplanowane)' : ''}` : ' • wolne'}`
    return { bg, border, color, ring: isToday, title }
  }

  // Komórka kalendarza — pojedynczy nawyk (zrobione / dodatkowo / pauza / pominięte)
  const habitCellFor = (habit, color) => (d) => {
    const isDone = isDayComplete(habit, d)
    const status = isHabitDue(habit, d, pauses)
    const future = d > TODAY, isToday = d === TODAY
    const deep = `color-mix(in oklab, ${color} 58%, #000)`
    let bg = 'transparent', border = '1px solid transparent', textColor = 'var(--text-muted)'
    if (future) {
      if (status === 'paused') { const m = pauseReasonMeta(pauseForDay(d, pauses)?.reason); bg = m.color + '22'; border = `1px dashed ${m.color}88` }
      else border = '1px dashed var(--border)'
    }
    else if (isDone) {
      const kind = habitDayKind({ habit, dateStr: d, pauses, today: TODAY, isDone: true })
      if (kind === 'done-paused') {
        // Zrobione mimo wyjazdu/choroby — obwódka w kolorze powodu.
        const m = pauseReasonMeta(pauseForDay(d, pauses)?.reason)
        bg = color; border = `2px solid ${m.color}`; textColor = '#fff'
      } else {
        const bonus = kind === 'done-bonus'
        bg = bonus ? deep : color; border = `1px solid ${bonus ? deep : color}`; textColor = '#fff'
      }
    }
    else if (status === 'paused') { const m = pauseReasonMeta(pauseForDay(d, pauses)?.reason); bg = m.color + '33'; border = `1px solid ${m.color}66` }
    else if (status === 'due') { border = '1px solid var(--border-strong)' }
    else { border = '1px solid var(--border)' }
    return { bg, border, color: textColor, ring: isToday, title: d }
  }

  const intensityLegend = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
      <span style={{ fontSize: 8.5, color: 'var(--text-muted)' }}>mniej</span>
      {[0, 0.35, 0.6, 0.85, 1].map((v, i) => (
        <div key={i} style={{ width: 9, height: 9, borderRadius: 2, background: v === 0 ? 'var(--surface2)' : `color-mix(in oklab, var(--warn) ${Math.round(22 + v * 78)}%, var(--surface2))` }} />
      ))}
      <span style={{ fontSize: 8.5, color: 'var(--text-muted)' }}>więcej</span>
    </div>
  )

  // Nastrój renderujemy W MIEJSCU treści Nawyków, nie jako nakładkę. Nakładka
  // musiałaby przebić się przez kontekst nakładania kontenera treści, a to
  // właśnie chowało jej pasek pod belką aplikacji.
  if (moodOpen) {
    return (
      <div className="habits-dashboard">
        <Suspense fallback={<div className="list-loading">Ładowanie...</div>}>
          <MoodDashboard user={user} setHeaderExtras={setMoodExtras} />
        </Suspense>
      </div>
    )
  }

  // Wyzwania — tak samo w miejscu treści, bez drugiego paska.
  if (extrasOpen) {
    return (
      <div className="habits-dashboard">
        <HabitExtras
          habits={extraHabits}
          archived={archivedExtras}
          today={TODAY}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onToggle={toggleDay}
          onSetAmount={setDayAmount}
          onEdit={(h) => { setEditHabit(h); setShowForm(true) }}
          onAdd={() => { setEditHabit(null); setShowForm(true) }}
        />
        {showForm && (
          <HabitForm user={user} editData={editHabit}
            onClose={() => { setShowForm(false); setEditHabit(null) }} />
        )}
      </div>
    )
  }

  return (
    <div className="habits-dashboard">
      {/* ===== EKRAN GŁÓWNY (Dziś): hero (akcje są w górnej belce) ===== */}
      {view === 'today' && (
        <>
          {/* Hero — Postęp dnia i Kalendarz jako osobne karty */}
          <div className="g2-br" data-stagger style={{ gap: 12, marginBottom: 14, marginTop: 4, alignItems: 'start' }}>
            {/* Postęp dnia */}
            <div className="card card-hover-glow" style={{
              padding: 18, display: 'flex', alignItems: 'center', gap: 16,
              borderTop: '2px solid color-mix(in oklab, var(--accent) 80%, transparent)',
              background: 'linear-gradient(140deg, var(--surface) 45%, color-mix(in oklab, var(--accent) 7%, var(--surface)) 100%)',
            }}>
              <Ring
                value={score.pct}
                size={88} thickness={8} color="var(--warn)" label="dziś"
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-sub)', textTransform: 'capitalize', marginBottom: 6 }}>{todayLabel}</div>
                {kicker('Postęp dnia')}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '2px 0 8px', whiteSpace: 'nowrap' }}>
                  <span className="serif" style={{ fontSize: 40 }}>{doneToday}</span>
                  <span className="mono" style={{ fontSize: 17, color: 'var(--text-muted)' }}>/ {score.required}</span>
                </div>
                {maxStreak > 0 && (
                  <div style={{ color: 'var(--warn)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    <IconFlame size={14}/> <span className="mono" style={{ fontSize: 12.5 }}>{maxStreak} dni serii</span>
                  </div>
                )}
                {recordStreak > 0 && (
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <IconStar size={12} style={{ color: 'var(--text-muted)' }} /> rekord: {recordStreak} dni
                  </div>
                )}
              </div>
            </div>

            {/* Kalendarz miesiąca — z przewijaniem (jak w budżecie) */}
            <div className="card card-hover-glow" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                {kicker('Kalendarz')}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setDashMonth(subMonths(dashMonth, 1))} title="Poprzedni miesiąc"><IconChevronLeft size={14} /></button>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-sub)', textTransform: 'capitalize', minWidth: 78, textAlign: 'center' }}>{format(dashMonth, 'LLLL yyyy', { locale: pl })}</span>
                  <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setDashMonth(addMonths(dashMonth, 1))} title="Następny miesiąc"><IconChevronRight size={14} /></button>
                </div>
              </div>
              <MonthCalendar month={dashMonth} renderCell={aggCellFor(filtered)} cellH={20} font={8.5} maxWidth={266} />
              {intensityLegend}
            </div>
          </div>
        </>
      )}

      {/* ===== ANALIZA I STATYSTYKI — nagłówek ze strzałką wstecz ===== */}
      {view === 'stats' && (
        <div className="rev-subhead">
          <button className="rev-back" onClick={() => setView('today')} title="Wróć"><IconChevronLeft size={18} /></button>
          <div className="rev-subhead-title">Analiza i statystyki</div>
        </div>
      )}

      {/* ===== DZIŚ ===== */}
      {view === 'today' && (() => {
        const items = filtered
          .map(h => ({ h, status: isHabitDue(h, selectedDay, pauses) }))
          .filter(x => x.status !== 'before-start' && x.status !== 'after-end')
        const mandatory = items.filter(x => x.status === 'due')
        const extra     = items.filter(x => x.status === 'off' || x.status === 'paused')
        const selDateObj  = new Date(selectedDay + 'T12:00:00')
        const isToday     = selectedDay === TODAY
        const isFut       = selectedDay > TODAY
        const dayPaused   = isPausedDay(selectedDay, pauses)
        const dayLabel    = format(selDateObj, 'EEEE, d MMMM', { locale: pl })
        const goBack  = () => setSelectedDay(format(subDays(selDateObj, 1), 'yyyy-MM-dd'))
        const goFwd   = () => setSelectedDay(format(addDays(selDateObj, 1), 'yyyy-MM-dd'))

        const renderCard = ({ h: habit, status }) => {
          const done    = isDayComplete(habit, selectedDay)
          const streak  = getStreak(habitDoneDates(habit), habit.frequencyDays, pauses, habit.startDate)
          const isExtra = status !== 'due'
          const cat     = allCategories.find(c => c.id === habit.category)
          const color   = habit.color || 'var(--accent)'
          const steps    = habit.checklist || []
          const stepDone = habit.checklistDone?.[selectedDay] || []
          return (
            <div key={habit.id} className="card hover" style={{
              background: done ? `color-mix(in oklab, ${color} 10%, var(--surface))` : 'var(--surface)',
              border: `1px solid ${done ? color + '50' : 'var(--border)'}`,
              padding: 11,
              opacity: isExtra && !done ? 0.66 : 1,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              {/* Icon tile */}
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                display: 'grid', placeItems: 'center',
                background: color + '1c', border: `1px solid ${color + '40'}`, color,
              }}>
                <CatIcon categoryId={null} emoji={habit.emoji} size={17} />
              </div>

              {/* Body */}
              {/* Sam opis nawyku nic nie otwiera — edycja siedzi w menu „Edytuj nawyki",
                  żeby klik na liście dnia nie wpadał przypadkiem w formularz. */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5, fontWeight: 600,
                  textDecoration: done ? 'line-through' : 'none',
                  textDecorationColor: 'var(--text-muted)',
                  color: done ? 'var(--text-muted)' : 'var(--text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{habit.name}</div>
                <div className="row" style={{ gap: 7, marginTop: 3 }}>
                  {streak > 0 && <>
                    <IconFlame size={12} style={{ color: 'var(--warn)' }} />
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--warn)' }}>{streak} dni</span>
                  </>}
                  <span className="mono" style={{ fontSize: 9.5, color: isExtra && done ? color : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {streak > 0 && '· '}{isExtra ? (done ? '+1 do serii' : 'dodatkowy') : (cat?.label || '')}
                  </span>
                  {steps.length > 0 && (
                    <span className="mono" style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: color + '1c', color, fontWeight: 600 }}>
                      {stepDone.length}/{steps.length}
                    </span>
                  )}
                  {/* Liczba stoi PRZY NAZWIE, nie w kontrolce — tam nie było na
                      nią miejsca i przycinała nazwę nawyku. */}
                  {hasAmountGoal(habit) && (
                    /* Klik w liczbę otwiera precyzyjne ustawianie: tam jest „−",
                       „+" i pole, na które w karcie nie ma miejsca. */
                    <button type="button" className="mono" disabled={isFut}
                      onClick={(e) => { e.stopPropagation(); setAmountFor({ habit, date: selectedDay }) }}
                      title="Ustaw dokładnie (odejmij, wpisz, wyczyść)"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 10, padding: '2px 7px', borderRadius: 6, background: color + '1c',
                        color, fontWeight: 600, border: `1px solid ${color}44`,
                        cursor: isFut ? 'default' : 'pointer', opacity: isFut ? 0.45 : 1,
                        fontFamily: 'inherit',
                      }}>
                      <IconEdit size={10} />
                      {amountShortLabel(dayAmount(habit, selectedDay), habit.target, habit.unit)}
                    </button>
                  )}
                </div>
              </div>

              {/* Nawyk na czas / ilość dostaje pasek z liczbą, nie haczyk —
                  haczyk nie umie powiedzieć „10 z 20 minut". */}
              {hasAmountGoal(habit) ? (
                <AmountStepper habit={habit} dateStr={selectedDay} onSet={setDayAmount} disabled={isFut} />
              ) : (
                /* Check — odhaczysz też dodatkowe (dni poza harmonogramem / w pauzie) */
                <button
                  onClick={() => !isFut && toggleDay(habit, selectedDay)}
                  disabled={isFut}
                  style={{
                    width: 32, height: 32, borderRadius: 99, flexShrink: 0,
                    border: `2px solid ${done ? color : 'var(--border-strong)'}`,
                    background: done ? color : 'transparent',
                    display: 'grid', placeItems: 'center',
                    color: 'var(--bg)', cursor: isFut ? 'default' : 'pointer',
                    transition: 'all .2s var(--spring)',
                  }}
                >
                  {done ? <IconCheck size={15} /> : status === 'paused' && getPauseIcon(pauses, selectedDay) ? <span style={{ color: getPauseColor(pauses, selectedDay) || 'var(--text-muted)', display: 'grid', placeItems: 'center' }}><CatIcon categoryId={null} emoji={getPauseIcon(pauses, selectedDay)} size={14} /></span> : ''}
                </button>
              )}
            </div>

            {/* Kroki nawyku — odhaczane per dzień */}
            {steps.length > 0 && (
              <div style={{ marginTop: 8, paddingLeft: 47, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {steps.map(s => {
                  const sDone = stepDone.includes(s.id)
                  return (
                    <button key={s.id} type="button" disabled={isFut}
                      onClick={() => toggleStep(habit, selectedDay, s.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: isFut ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center',
                        border: `1.5px solid ${sDone ? color : 'var(--border-strong)'}`,
                        background: sDone ? color : 'transparent', color: 'var(--bg)',
                        transition: 'all .15s var(--spring)',
                      }}>{sDone && <IconCheck size={10} />}</span>
                      <span style={{ fontSize: 12, textDecoration: sDone ? 'line-through' : 'none', color: sDone ? 'var(--text-muted)' : 'var(--text-sub)' }}>{s.title}</span>
                    </button>
                  )
                })}
              </div>
            )}
            </div>
          )
        }

        const grid = (rows) => (
          <div data-stagger style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 8 }}>
            {rows.map(renderCard)}
          </div>
        )

        const rytmSteps = SHOW_DAY_RHYTHM ? mandatory.map(({ h }) => ({
          key: h.id, emoji: h.emoji, color: h.color || 'var(--accent)',
          done: isDayComplete(h, selectedDay), title: h.name,
        })) : []

        return (
          <>
            {/* Dzisiejszy rytm — ścieżka dnia (wspólny język z To-do).
                Uśpiony za SHOW_DAY_RHYTHM, patrz flaga na górze pliku. */}
            {SHOW_DAY_RHYTHM && rytmSteps.length > 0 && (
              <div className="card card-hover-glow" style={{ padding: 18, marginBottom: 14 }}>
                {kicker(isToday ? 'Dzisiejszy rytm' : 'Rytm dnia')}
                <DayPath steps={rytmSteps} accent="var(--warn)" />
              </div>
            )}

            {/* Single day navigator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 14 }}>
              <button className="month-btn" onClick={goBack} style={{ width: 32, height: 32 }}>‹</button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{dayLabel}</div>
                {isToday && <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 2 }}>Dziś</div>}
              </div>
              <button className="month-btn" onClick={goFwd} style={{ width: 32, height: 32, opacity: isToday ? 0.3 : 1 }} disabled={isToday}>›</button>
            </div>

            {/* Category filter */}
            {activeHabits.length > 0 && (
              <div className="habit-cat-filter" style={{ marginBottom: 12 }}>
                <button className={`habit-cat-chip ${filterCat === 'all' ? 'active' : ''}`} onClick={() => setFilterCat('all')}>Wszystkie</button>
                {allCategories.filter(c => activeHabits.some(h => h.category === c.id)).map(c => (
                  <button key={c.id} className={`habit-cat-chip ${filterCat === c.id ? 'active' : ''}`}
                    style={filterCat === c.id ? { borderColor: c.color, color: c.color, background: c.color + '22' } : {}}
                    onClick={() => setFilterCat(c.id)}>
                    <CatIcon categoryId={c.id} emoji={c.icon} size={13} /> {c.label}
                  </button>
                ))}
              </div>
            )}

            {items.length === 0 ? (
              <div className="list-empty"><p>Brak nawyków</p><p className="list-empty-hint">Kliknij "+ Nowy" aby dodać</p></div>
            ) : (
              <>
                {/* Obowiązkowe na dziś — pogrupowane w rutyny (części dnia), jeśli są */}
                {mandatory.length > 0 && (
                  <div style={{ marginBottom: extra.length > 0 ? 18 : 0 }}>
                    {kicker('Na dziś')}
                    {(() => {
                      const isItemDone = (x) => isDayComplete(x.h, selectedDay)
                      // Zrobione „rzeczy" na dół (stabilnie — reszta kolejności zostaje).
                      const sortedMandatory = [...mandatory].sort((a, b) => (isItemDone(a) ? 1 : 0) - (isItemDone(b) ? 1 : 0))
                      // Nagłówki sekcji pokazujemy tylko, gdy realnie dzielą dzień na
                      // części (są rutyny i choć jedna nazwana grupa). Inaczej — jak dawniej.
                      const showHeaders = routines.length > 0 && groupByRoutine(mandatory, routines, x => x.h.routineId).some(g => g.id != null)
                      if (!showHeaders) return grid(sortedMandatory)

                      let groups = groupByRoutine(sortedMandatory, routines, x => x.h.routineId)
                      const isSectionDone = (g) => g.items.length > 0 && g.items.every(isItemDone)
                      // Zrobione segmenty (całe rutyny) na sam dół.
                      groups = [...groups].sort((a, b) => (isSectionDone(a) ? 1 : 0) - (isSectionDone(b) ? 1 : 0))

                      return groups.map(g => {
                        const doneN = g.items.filter(isItemDone).length
                        const secDone = isSectionDone(g)
                        // Domyślnie zrobiona rutyna jest zwinięta; ręczny klik nadpisuje.
                        const collapsed = collapsedRoutines[g.id ?? '_none'] ?? secDone
                        const toggle = () => setCollapsedRoutines(prev => ({ ...prev, [g.id ?? '_none']: !collapsed }))
                        return (
                          <div key={g.id ?? '_none'} style={{ marginBottom: 14 }}>
                            <button type="button" onClick={toggle} style={{
                              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, width: '100%',
                              background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
                              color: 'inherit', textAlign: 'left',
                            }}>
                              <IconChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: secDone ? 'var(--text-muted)' : (g.id ? 'var(--text)' : 'var(--text-muted)') }}>
                                {g.name || 'Pozostałe'}
                              </span>
                              {secDone && <IconCheck size={12} style={{ color: 'var(--income, #5FBF98)' }} />}
                              <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{doneN}/{g.items.length}</span>
                              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                            </button>
                            {!collapsed && grid(g.items)}
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}

                {/* Nic obowiązkowego — komunikat */}
                {mandatory.length === 0 && extra.length > 0 && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 14, fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {dayPaused ? <IconPause size={14} /> : <IconStar size={14} />}
                    <span>{dayPaused ? 'Przerwa — dziś nic nie jest obowiązkowe. Możesz zrobić coś ekstra, seria się nie przerwie.' : 'Dziś nic obowiązkowego. Możesz zrobić coś dodatkowego poniżej.'}</span>
                  </div>
                )}

                {/* Dodatkowe / nieobowiązkowe */}
                {extra.length > 0 && (
                  <div>
                    {kicker(dayPaused ? 'Dodatkowe (przerwa) — liczą się do serii' : 'Dodatkowe — nieobowiązkowe')}
                    {grid(extra)}
                  </div>
                )}
              </>
            )}
          </>
        )
      })()}

      {/* ===== STATYSTYKI ===== */}
      {view === 'stats' && (() => {
        const today = TODAY
        const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
        const ctx = { weekAnchor, monthAnchor, year: statYear }
        const { start, end } = statRange(statPeriod, ctx)
        const endClamped = today < end ? today : end
        const agg = rangeStats(requiredActive, pauses, start, endClamped)
        const bestStreakAll = requiredActive.reduce((m, h) => Math.max(m, getBestStreak(habitDoneDates(h), h.frequencyDays, pauses, h.startDate)), 0)
        const buckets = statBuckets(requiredActive, pauses, statPeriod, ctx, dataYears)
        const trendTitle  = statPeriod === 'week' ? 'Realizacja dzień po dniu (%)' : statPeriod === 'month' ? 'Kalendarz miesiąca' : 'Realizacja rok po roku (%)'

        // Nawigator okresu (‹ etykieta ›)
        const wkStart   = startOfWeek(weekAnchor, { weekStartsOn: 1 })
        const yearIdx   = Math.max(0, dataYears.indexOf(statYear))
        const nowMonth  = ymd(startOfMonth(new Date()))
        const navLabel  = statPeriod === 'week'
          ? `${format(wkStart, 'd MMM', { locale: pl })} – ${format(addDays(wkStart, 6), 'd MMM yyyy', { locale: pl })}`
          : statPeriod === 'month' ? cap(format(monthAnchor, 'LLLL yyyy', { locale: pl }))
          : String(statYear)
        const ringSub   = statPeriod === 'week' ? 'tydzień' : statPeriod === 'month' ? cap(format(monthAnchor, 'LLLL', { locale: pl })) : String(statYear)
        const prevDisabled = statPeriod === 'year' ? yearIdx <= 0 : false
        const nextDisabled = statPeriod === 'week'
          ? ymd(wkStart) >= ymd(startOfWeek(new Date(), { weekStartsOn: 1 }))
          : statPeriod === 'month'
            ? ymd(startOfMonth(monthAnchor)) >= nowMonth
            : yearIdx >= dataYears.length - 1
        const goPrev = () => {
          if (statPeriod === 'week') setWeekAnchor(subDays(weekAnchor, 7))
          else if (statPeriod === 'month') setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))
          else setStatYear(dataYears[Math.max(0, yearIdx - 1)])
        }
        const goNext = () => {
          if (statPeriod === 'week') setWeekAnchor(addDays(weekAnchor, 7))
          else if (statPeriod === 'month') setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))
          else setStatYear(dataYears[Math.min(dataYears.length - 1, yearIdx + 1)])
        }

        const tile = (value, label, color, sub) => (
          <div className="tile-accent" style={{ '--tile-color': color || 'var(--warn)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
            <div className="serif" style={{ fontSize: 24, lineHeight: 1, color: color || 'var(--text)' }}>{value}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
            {sub && <div className="mono" style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
          </div>
        )
        return (
        <div data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Wybór okresu */}
          <SegTabs
            items={[{ id: 'week', label: 'Tydzień' }, { id: 'month', label: 'Miesiąc' }, { id: 'year', label: 'Rok' }]}
            active={statPeriod} onChange={setStatPeriod} style={{ maxWidth: 420 }}
          />

          {/* Nawigator okresu */}
          <div className="habit-week-nav" style={{ margin: 0 }}>
            <button className="month-btn" onClick={goPrev} disabled={prevDisabled} style={{ opacity: prevDisabled ? 0.3 : 1 }}>‹</button>
            <span className="habit-period-label" style={{ textTransform: statPeriod === 'week' ? 'none' : 'none' }}>{navLabel}</span>
            <button className="month-btn" onClick={goNext} disabled={nextDisabled} style={{ opacity: nextDisabled ? 0.3 : 1 }}>›</button>
          </div>

          {/* Podsumowanie okresu — duży pierścień % + kafelki */}
          <div className="card card-hover-glow" style={{
            padding: 18,
            borderTop: '2px solid color-mix(in oklab, var(--accent) 80%, transparent)',
            background: 'linear-gradient(140deg, var(--surface) 45%, color-mix(in oklab, var(--accent) 7%, var(--surface)) 100%)',
          }}>
            {kicker('Realizacja — ' + navLabel)}
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <Ring value={agg.pct} size={104} thickness={9} color="var(--warn)" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(80px,1fr))', gap: 10, flex: 1, minWidth: 180 }}>
                {tile(`${agg.done}/${agg.expected}`, 'Zrobione', 'var(--accent)')}
                {tile(agg.perfectDays, 'Dni 100%')}
                {tile(agg.completions, 'Odhaczeń')}
                {tile(bestStreakAll, 'Rekord serii', undefined, 'dni')}
              </div>
            </div>

            {/* „Ile na to poszło" — sumy czasu i ilości dla nawyków z celem.
                Jednostek nie mieszamy: minuty i strony to osobne liczby. */}
            {amountTotals(requiredActive, start, endClamped).length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14,
                paddingTop: 14, borderTop: '1px solid var(--border)',
              }}>
                {amountTotals(requiredActive, start, endClamped).map(t => (
                  <div key={t.unit}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>
                      na to poszło
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trend realizacji w czasie — tydzień: słupki, miesiąc: kalendarz, rok: bez wykresu */}
          {requiredActive.length > 0 && statPeriod !== 'year' && (
            <div className="card card-hover-glow" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                {kicker(trendTitle)}
                {statPeriod === 'month' && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-sub)', textTransform: 'capitalize', marginBottom: 10 }}>{navLabel}</span>}
              </div>
              {statPeriod === 'month' ? (
                <>
                  <MonthCalendar month={monthAnchor} renderCell={aggCellFor(requiredActive)} cellH={30} gap={4} font={11} />
                  {intensityLegend}
                </>
              ) : (
                <BarChartSVG
                  data={buckets.map(b => ({ label: b.label, value: b.value, active: b.active }))}
                  height={150} accent="var(--warn)" fmt={v => `${v}%`}
                />
              )}
            </div>
          )}

          {/* Legenda kwadracików — tylko przy rozwiniętej karcie, bo tylko wtedy
              są na ekranie jakieś kwadraciki do objaśnienia. */}
          {openStat && statPeriod !== 'year' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', padding: '0 4px' }}>
              {(() => {
                const chip = (bg, border, label) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-muted)' }}>
                    <span style={{ width: 13, height: 13, borderRadius: 4, background: bg, border: border || '1px solid transparent', flexShrink: 0 }} />{label}
                  </span>
                )
                const usedPauses = [...new Set(pauses.map(p => p.reason))]
                return <>
                  {chip('var(--accent)', null, 'zrobione')}
                  {chip('color-mix(in oklab, var(--accent) 58%, #000)', null, 'dodatkowo')}
                  {/* Zrobione mimo wyjazdu/choroby — wypełnienie jak zwykle,
                      ale obwódka w kolorze powodu przerwy. */}
                  {usedPauses.length > 0 && chip('var(--accent)',
                    `2px solid ${pauseReasonMeta(usedPauses[0]).color}`, 'zrobione mimo przerwy')}
                  {chip('transparent', '1px solid var(--border-strong)', 'pominięte')}
                  {usedPauses.map(rid => { const m = pauseReasonMeta(rid); return <span key={rid}>{chip(m.color + '33', `1px solid ${m.color}66`, m.label.toLowerCase())}</span> })}
                </>
              })()}
            </div>
          )}

          {/* Karty nawyków — z procentem z wybranego okresu */}
          <div data-stagger style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
            {filtered.length === 0 ? (
              <div className="list-empty"><p>Brak nawyków</p></div>
            ) : filtered.map(habit => {
              const streak = getStreak(habitDoneDates(habit), habit.frequencyDays, pauses, habit.startDate)
              const best   = getBestStreak(habitDoneDates(habit), habit.frequencyDays, pauses, habit.startDate)
              const cat    = allCategories.find(c => c.id === habit.category)
              const color  = habit.color || 'var(--accent)'
              const pct    = rangeStats([habit], pauses, start, endClamped).pct
              const fmtShort = (d) => format(new Date(d + 'T12:00:00'), 'd MMM', { locale: pl })
              // Klik rozwija historię, a nie formularz: w analizie chce się
              // zobaczyć, jak nawyk szedł, a nie go zmieniać. Edycja siedzi w
              // „Edytuj nawyki" i na liście dnia.
              const rozwiniety = openStat === habit.id
              const miary = amountStats(habit, start, endClamped)
              return (
                <div key={habit.id} className="card hover" style={{ padding: 16, cursor: 'pointer' }}
                  onClick={() => setOpenStat(rozwiniety ? null : habit.id)}
                  title={rozwiniety ? 'Zwiń' : 'Pokaż historię nawyku'}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 14 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                      display: 'grid', placeItems: 'center',
                      background: color + '1c', border: `1px solid ${color + '40'}`, color,
                    }}>
                      <CatIcon categoryId={null} emoji={habit.emoji} size={17} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{habit.name}</div>
                      {cat && <div className="kicker" style={{ marginTop: 3 }}>{cat.label}</div>}
                    </div>
                    <IconChevronDown size={15} style={{
                      color: 'var(--text-muted)', flexShrink: 0,
                      transform: rozwiniety ? 'rotate(180deg)' : 'none', transition: 'transform .2s',
                    }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <Ring value={pct} size={78} thickness={8} color={color} label={ringSub} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--warn)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IconFlame size={14} /> <span className="mono" style={{ fontSize: 13 }}>{streak} dni serii</span>
                      </div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6 }}>rekord: {best} dni</div>
                      {/* Przy nawyku na czas sam procent mowi za malo — suma to
                          to, co sie z niego naprawde pamieta. */}
                      {miary && miary.total > 0 && (
                        <div className="mono" style={{ fontSize: 11, color, marginTop: 6, fontWeight: 600 }}>
                          {formatAmount(miary.total, miary.unit)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Historia — pokazuje się po kliknięciu. Wcześniej karta
                      zawsze niosła pełną siatkę, więc kilkanaście nawyków
                      znaczyło ekran, przez który trzeba było się przewijać. */}
                  {rozwiniety && (<>
                  {miary && (
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 14,
                      paddingBottom: 12, borderBottom: '1px solid var(--border)',
                    }}>
                      <div>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 700, color }}>
                          {formatAmount(miary.total, miary.unit)}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>łącznie</div>
                      </div>
                      <div>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                          {formatAmount(miary.avg, miary.unit)}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>średnio w dniu</div>
                      </div>
                      <div>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                          {miary.fullDays}<span style={{ fontSize: 10, color: 'var(--text-muted)' }}>/{miary.days}</span>
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>dni z celem</div>
                      </div>
                      {miary.best && (
                        <div>
                          <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)' }}>
                            {formatAmount(miary.best.value, miary.unit)}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>
                            rekord {fmtShort(miary.best.date)}
                          </div>
                        </div>
                      )}
                      {/* Robota ponad norme — przy nawyku na czas czesto
                          najciekawsza liczba w calym zestawieniu. */}
                      {miary.over > 0 && (
                        <div>
                          <div className="mono" style={{ fontSize: 13, fontWeight: 700, color }}>
                            +{formatAmount(miary.over, miary.unit)}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>
                            ponad cel · {miary.overDays} dni
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {statPeriod === 'month' ? (
                    <MonthCalendar month={monthAnchor} renderCell={habitCellFor(habit, color)} cellH={18} gap={3} font={8} />
                  ) : statPeriod === 'year' ? (
                    /* Rok w 12 kratkach. Siatka dzien po dniu dawala tu 365 kratek
                       NA NAWYK — przy kilkunastu nawykach ponad cztery tysiace
                       elementow i zacinajace sie przewijanie. Pojedynczy dzien i
                       tak byl przy tej skali nieczytelny. */
                    <div style={{ display: 'flex', gap: 3 }}>
                      {habitYearMonths(habit, statYear, pauses, today).map((m, i) => (
                        <div key={i} title={m.pct === null ? `${m.label} — brak danych` : `${m.label} — ${m.pct}% (${m.done}x)`}
                          style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            height: 22, borderRadius: 4,
                            background: m.pct === null
                              ? 'transparent'
                              : `color-mix(in oklab, ${color} ${Math.max(10, m.pct)}%, var(--surface2))`,
                            border: m.pct === null ? '1px dashed var(--border)' : `1px solid ${color}40`,
                          }} />
                          <div style={{ fontSize: 7.5, textAlign: 'center', color: 'var(--text-muted)', marginTop: 3 }}>
                            {m.label.slice(0, 1)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <HabitDayGrid habit={habit} pauses={pauses} start={start} end={end} today={today} color={color} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{fmtShort(start)}</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{fmtShort(end)}</span>
                      </div>
                    </>
                  )}
                  </>)}
                </div>
              )
            })}
          </div>

          {/* Rok w liczbach — wszystkie nawyki razem: odhaczenia miesiąc po
              miesiącu, rok w pikselach i ranking nawyków w wybranym roku. */}
          <AnalizaRoku id="nawyki" wpisy={wpisyNawykow} jednostka={['odhaczenie', 'odhaczenia', 'odhaczeń']}
            kolor="#E0B15A" tytulDni="Dni z nawykiem">
            {(rok) => {
              const poz = habits.filter(h => !h.archived).map(h => ({
                nazwa: h.name, kolor: h.color || 'var(--warn)',
                wartosc: habitDoneDates(h).filter(k => k.startsWith(String(rok))).length,
              })).filter(p => p.wartosc > 0).sort((a, b) => b.wartosc - a.wartosc)
              return (
                <Rozwijana id="nawyki-rank" tytul={`Nawyki w roku ${rok}`} podsumowanie={poz[0]?.nazwa}>
                  <Ranking pozycje={poz} fmt={(v) => `${v} dni`} pusty="Brak odhaczeń w tym roku" />
                </Rozwijana>
              )
            }}
          </AnalizaRoku>

        </div>
      ) })()}

      {showPause && <PauseForm user={user} onClose={() => setShowPause(false)} />}
      {showRoutineMgr && <RoutineManager user={user} onClose={() => setShowRoutineMgr(false)} />}
      {showReorder && <HabitReorderModal user={user} habits={reorderable} onClose={() => setShowReorder(false)} />}
      {amountFor && (
        <AmountSheet habit={amountFor.habit} dateStr={amountFor.date} onSet={setDayAmount}
          onClose={() => setAmountFor(null)} />
      )}
      {showFresh && (
        <HabitFreshStart user={user} habits={reorderable} pauses={pauses} onClose={() => setShowFresh(false)} />
      )}
      {showArchive && (
        <HabitArchive user={user} habits={archivedHabits} endedHabits={endedHabits} pauses={pauses}
          onEdit={(h) => { setShowArchive(false); setEditHabit(h); setShowForm(true) }}
          onClose={() => setShowArchive(false)} />
      )}
      {showManager && (
        <HabitManager user={user} habits={habits} categories={allCategories} onClose={() => setShowManager(false)} />
      )}
      {showForm && (
        <HabitForm user={user} onClose={() => { setShowForm(false); setEditHabit(null) }} editData={editHabit} />
      )}

    </div>
  )
}
