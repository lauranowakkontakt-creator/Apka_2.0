import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, doc, limit } from 'firebase/firestore'
import { onSnapshot } from '../utils/subskrypcje'
import { db } from '../firebase/config'
import { format, subDays, addDays, parseISO, isPast, isToday } from 'date-fns'
import { pl } from 'date-fns/locale'
import { isMonthlyPaymentOn } from '../utils/paymentLogic'
import { expandEvents } from '../utils/calendarRecurrence'
import { eventsOnDate } from '../utils/calendarDay'
import {
  IconBudget, IconHabits, IconTodo, IconPrayer, IconBook,
  IconFlame, IconChevronRight, IconCheck, IconClock,
  IcSun,
} from './Icons'
import { Ring } from './ChartPrimitives'
import { fmt, getCurrencyCode } from '../utils/currency'
import { isInvestment, sumByCurrency } from '../utils/investmentMath'
import { BIBLE_BOOKS, TOTAL_CHAPTERS, chapterKey } from '../utils/bibleData'
import { dayScore, isRequiredHabit } from '../utils/habitLogic'
import { gratitudeStats } from '../utils/gratitudeLogic'
import { bladSubskrypcji } from '../utils/polaczenie'

const TODAY = () => format(new Date(), 'yyyy-MM-dd')

function greeting() {
  const h = new Date().getHours()
  if (h < 6)  return 'Dobrej nocy'
  if (h < 12) return 'Dzień dobry'
  if (h < 18) return 'Miłego dnia'
  return 'Dobry wieczór'
}

export default function Pulpit({ user, onNavigate, visibleIds }) {
  // Pulpit pokazuje tylko te moduły, które użytkownik zostawił widoczne
  // (Ustawienia → Twoje aplikacje). Brak listy = pokazujemy wszystko.
  const shows = (id) => !visibleIds || visibleIds.includes(id)
  const [accounts, setAccounts]     = useState([])
  const [habits, setHabits]         = useState([])
  const [pauses, setPauses]         = useState([])
  const [moodLogs, setMoodLogs]     = useState([])
  const [todos, setTodos]           = useState([])
  const [events, setEvents]         = useState([])
  const [intentions, setIntentions] = useState([])
  const [people, setPeople]         = useState([])
  const [payments, setPayments]     = useState([])
  const [bible, setBible]           = useState({ counts: {} })
  const [gratitude, setGratitude]   = useState([])

  useEffect(() => {
    const subs = [
      onSnapshot(doc(db, 'users', user.uid, 'bible', 'progress'),
        s => setBible({ counts: s.data()?.counts || {} }),
        bladSubskrypcji('bible/progress', { przyBledzie: () => setBible({ counts: {} }) })),
      onSnapshot(query(collection(db, 'users', user.uid, 'accounts'), orderBy('createdAt', 'asc')),
        s => setAccounts(s.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('accounts')),
      onSnapshot(query(collection(db, 'users', user.uid, 'habits'), orderBy('createdAt', 'asc')),
        s => setHabits(s.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('habits')),
      onSnapshot(query(collection(db, 'users', user.uid, 'habitPauses'), orderBy('from', 'desc')),
        s => setPauses(s.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('habitPauses')),
      // Rosnące kolekcje z limitem — Pulpit potrzebuje tylko świeżych wpisów
      // (nastrój: 30 dni, zadania/prośby: aktywne), a bez limitu każda wizyta
      // ściągałaby całą wieloletnią historię.
      onSnapshot(query(collection(db, 'users', user.uid, 'moodLogs'), orderBy('createdAt', 'desc'), limit(400)),
        s => setMoodLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('moodLogs')),
      onSnapshot(query(collection(db, 'users', user.uid, 'todos'), orderBy('createdAt', 'desc'), limit(400)),
        s => setTodos(s.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('todos')),
      onSnapshot(query(collection(db, 'users', user.uid, 'calendarEvents'), orderBy('date', 'asc')),
        s => setEvents(s.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('calendarEvents')),
      onSnapshot(query(collection(db, 'users', user.uid, 'prayerIntentions'), orderBy('createdAt', 'desc'), limit(300)),
        s => setIntentions(s.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('prayerIntentions')),
      onSnapshot(query(collection(db, 'users', user.uid, 'calendarPeople'), orderBy('createdAt', 'asc')),
        s => setPeople(s.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('calendarPeople')),
      onSnapshot(query(collection(db, 'users', user.uid, 'regularPayments'), orderBy('createdAt', 'asc')),
        s => setPayments(s.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('regularPayments')),
      onSnapshot(query(collection(db, 'users', user.uid, 'gratitude'), orderBy('date', 'desc'), limit(400)),
        s => setGratitude(s.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('gratitude')),
    ]
    return () => subs.forEach(u => u())
  }, [user.uid])

  const today = TODAY()

  /* ── BUDŻET ── */
  const budget = useMemo(() => {
    let excluded = []
    try { const s = localStorage.getItem(`excludedAccounts_${user.uid}`); excluded = s ? JSON.parse(s) : [] } catch {}
    const included = accounts.filter(a => !excluded.includes(a.id))
    // Inwestycje liczymy osobno — nie wchodzą do głównej sumy salda kont.
    const byCur = sumByCurrency(included.filter(a => !isInvestment(a)))
    const glowna = getCurrencyCode()
    const totalPLN = byCur[glowna] || 0
    const others = Object.entries(byCur).filter(([c]) => c !== glowna)
    const investByCur = sumByCurrency(included.filter(isInvestment))
    const investPLN = investByCur[glowna] || 0
    const hasInvest = included.some(isInvestment)
    return { totalPLN, others, count: accounts.length, investPLN, hasInvest }
  }, [accounts, user.uid])

  /* ── NAWYKI ── */
  const habitsStat = useMemo(() => {
    // Cel dnia to nawyki WYMAGANE; licznik obejmuje też te zrobione ponad plan,
    // więc może przebić cel — dokładnie jak w module Nawyki.
    // Wyzwania (nawyki dodatkowe) mają własny ekran i tu się nie liczą: inaczej
    // odhaczone wyzwanie podbijało „zrobione" na kafelku, mimo że celem nie było.
    const s = dayScore(habits.filter(isRequiredHabit), today, pauses)
    return { due: s.required, done: s.doneTotal, pct: s.pct, extra: s.extra }
  }, [habits, pauses, today])

  /* ── NASTRÓJ ── */
  const moodStat = useMemo(() => {
    const todayLogs = moodLogs.filter(l => l.date === today)
    const last = todayLogs[0] || null
    const last30 = moodLogs.filter(l => l.date >= format(subDays(new Date(), 29), 'yyyy-MM-dd') && l.moodValue)
    const avgRaw = last30.length ? last30.reduce((s, l) => s + l.moodValue, 0) / last30.length : 0
    // Nastrój trzymany wewnętrznie w skali 1–5, ale pokazujemy 1–10 (spójnie z modułem Nastrój)
    const avg = avgRaw > 0 ? ((avgRaw - 1) / 4) * 9 + 1 : 0
    return { loggedToday: !!last, lastLabel: last?.moodLabel, lastColor: last?.moodColor, avg }
  }, [moodLogs, today])

  /* ── TO-DO ── */
  const todoStat = useMemo(() => {
    const active = todos.filter(t => !t.done)
    const overdue = active.filter(t => t.dueDate && isPast(parseISO(t.dueDate)) && !isToday(parseISO(t.dueDate)))
    const dueToday = active.filter(t => t.dueDate && isToday(parseISO(t.dueDate)))
    return { active: active.length, overdue: overdue.length, dueToday: dueToday.length }
  }, [todos])

  /* ── MODLITWA ── */
  const prayerStat = useMemo(() => {
    // Osoby ukryte w modlitwie — ich prośby nie liczą się (zostają tylko w archiwum modułu).
    const hiddenIds = new Set(people.filter(p => p.hiddenInPrayer).map(p => p.id))
    const live = intentions.filter(i => !(i.personId && hiddenIds.has(i.personId)))
    // „Na dziś" — tak samo jak w module Modlitwa: aktywne prośby,
    // bez okna (codzienne) lub z oknem obejmującym dziś, jeszcze przed terminem.
    const dueToday = live.filter(i => {
      if (!(i.status === 'active' || !i.status)) return false
      if (i.dateTo && i.dateTo < today) return false
      if (!i.scheduleFrom && !i.scheduleTo) return true
      return today >= (i.scheduleFrom || '0000-01-01') && today <= (i.scheduleTo || '9999-12-31')
    })
    const prayedToday = dueToday.filter(i => i.prayedDates?.includes(today)).length
    const allDates = new Set(live.flatMap(i => i.prayedDates || []))
    let streak = 0
    for (let i = 0; i < 365; i++) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
      if (d > today) continue
      if (allDates.has(d)) streak++
      else if (d < today) break
    }
    return { active: dueToday.length, prayedToday, streak }
  }, [intentions, people, today])

  /* ── BIBLIA ── */
  const bibleStat = useMemo(() => {
    const counts = bible.counts || {}
    let read = 0
    for (const b of BIBLE_BOOKS)
      for (let c = 1; c <= b.chapters; c++)
        if (counts[chapterKey(b.id, c)] > 0) read++
    return { read, pct: Math.round((read / TOTAL_CHAPTERS) * 100) }
  }, [bible])

  /* ── WDZIĘCZNIK ── */
  const gratStat = useMemo(() => {
    const stats = gratitudeStats(gratitude, today)
    return { ...stats, todayCount: gratitude.filter(e => e.date === today).length }
  }, [gratitude, today])

  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  /* ── DZIŚ / JUTRO — wspólna agenda ── */
  // Cykliczność liczy ta sama funkcja co w Kalendarzu (expandEvents) — własna
  // kopia tutaj gubiła wydarzenia „co miesiąc 31." w krótszych miesiącach
  // i kolejne dni cyklicznych wydarzeń wielodniowych.
  const occursOn = (dateStr) => eventsOnDate(expandEvents(events, dateStr, dateStr), dateStr)
  const buildAgenda = (dateStr) => {
    const items = []
    const d = parseISO(dateStr)
    // Wydarzenia z kalendarza (z uwzględnieniem cykliczności) — z osobą w nazwie
    occursOn(dateStr).forEach(e => {
      const person = e.personName || e.who || ''
      items.push({
        key: 'ev-' + e.id + '-' + dateStr, module: 'calendar', color: e.color || '#5FBF98',
        time: e.startTime || null,
        label: person ? `${e.title} · ${person}` : e.title,
        meta: e.startTime ? (e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime) : 'cały dzień',
      })
    })
    // Zadania na dany dzień (nieukończone)
    todos.filter(t => !t.done && t.dueDate === dateStr).forEach(t => {
      items.push({ key: 'td-' + t.id + '-' + dateStr, module: 'todo', color: '#5BB6D9', time: null, label: t.title, meta: 'zadanie' })
    })
    // Płatności (miesięczne, w dniu, jeszcze nieodhaczone)
    const period = format(d, 'yyyy-MM')
    payments.filter(p => isMonthlyPaymentOn(p, d) && !p.donePeriods?.includes(period)).forEach(p => {
      items.push({ key: 'pm-' + p.id + '-' + dateStr, module: 'budget', color: '#E0B15A', time: null, label: p.name, meta: `${p.type === 'income' ? '+' : '−'}${fmt(p.amount)}` })
    })
    // Sortuj: z godziną najpierw (wg godziny), reszta po. Pozycje z ukrytych
    // modułów odpadają — skoro apka jest schowana, nie ma jej też w agendzie.
    return items.filter(it => shows(it.module)).sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || '').localeCompare(b.time || ''))
  }
  const agenda         = useMemo(() => buildAgenda(today),    [events, todos, payments, today, visibleIds])
  const agendaTomorrow = useMemo(() => buildAgenda(tomorrow), [events, todos, payments, tomorrow, visibleIds])

  const habitsLeft = habitsStat.due - habitsStat.done
  const prayerLeft = prayerStat.active - prayerStat.prayedToday

  const privateMode = (() => {
    try { return localStorage.getItem('mw_privateMode') === 'true' } catch { return false }
  })()

  const dateLabel = format(new Date(), 'EEEE, d MMMM', { locale: pl })

  return (
    <div className="pulpit">
      {/* Powitanie */}
      <div className="pulpit-hero">
        <div className="pulpit-hero-kicker" style={{ textTransform: 'capitalize' }}>{dateLabel}</div>
        <h1 className="pulpit-hero-title">{greeting()}, {(user?.displayName || 'Laura').split(' ')[0]}</h1>
      </div>

      {/* DZIŚ i JUTRO — wspólna agenda */}
      <div className="pulpit-today">
        <div className="pulpit-today-head">
          <span className="pulpit-today-kicker"><IconClock size={12} /> Dziś i jutro</span>
        </div>
        <div className="pulpit-today-cols">
          <AgendaColumn
            title="Dziś"
            items={agenda}
            onNavigate={onNavigate}
            empty={habitsLeft <= 0 && prayerLeft <= 0
              ? <><IconCheck size={15} /> Wszystko ogarnięte — wolny dzień</>
              : 'Brak wydarzeń i zadań na dziś'}
          />
          <AgendaColumn
            title="Jutro"
            items={agendaTomorrow}
            onNavigate={onNavigate}
            empty="Brak wydarzeń i zadań na jutro"
          />
        </div>
      </div>

      {/* Siatka kart */}
      <div className="pulpit-grid">

        {/* BUDŻET */}
        {shows('budget') && (
        <PulpitCard accent="#33C3A6" Icon={IconBudget} label="Finanse" onClick={() => onNavigate('budget')}>
          <div className="pulpit-value" style={{ color: privateMode ? 'var(--text-muted)' : (budget.totalPLN >= 0 ? 'var(--income)' : 'var(--expense)') }}>
            {privateMode ? '••••' : fmt(budget.totalPLN)}
          </div>
          <div className="pulpit-sub">
            {privateMode
              ? `${budget.count} ${budget.count === 1 ? 'konto' : 'kont'}`
              : budget.others.length > 0
                ? budget.others.map(([c, v]) => `${Math.round(v)} ${c}`).join(' · ')
                : `Saldo łączne · ${budget.count} ${budget.count === 1 ? 'konto' : 'kont'}`}
          </div>
          {!privateMode && budget.hasInvest && (
            <div className="pulpit-sub" style={{ marginTop: 2 }}>
              Inwestycje: {fmt(budget.investPLN)}
            </div>
          )}
        </PulpitCard>
        )}

        {/* NAWYKI */}
        {shows('habits') && (
        <PulpitCard accent="#E0B15A" Icon={IconHabits} label="Nawyki" onClick={() => onNavigate('habits')}>
          <div className="pulpit-row">
            <Ring value={habitsStat.pct} size={56} thickness={6} color="#E0B15A" />
            <div>
              <div className="pulpit-value" style={{ fontSize: 26 }}>
                {habitsStat.done}<span className="pulpit-value-dim">/{habitsStat.due}</span>
              </div>
              <div className="pulpit-sub">
                {habitsStat.due > 0
                  ? (habitsStat.done > habitsStat.due ? 'ponad plan' : 'zrobione dziś')
                  : habitsStat.done > 0 ? 'ponad plan' : 'brak na dziś'}
              </div>
              {/* Nastrój mieszka teraz w Nawykach — pokazujemy go tu, zamiast
                  osobnej karty, żeby informacja nie zniknęła z Pulpitu. */}
              {/* Kropka + krótka etykieta. Kafelek ma na telefonie ~110 px na
                  tekst, więc dłuższy opis zawijał się i rozpychał kartę. */}
              <div className="pulpit-sub" style={{
                display: 'flex', alignItems: 'center', gap: 5, marginTop: 2,
                minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: moodStat.loggedToday ? (moodStat.lastColor || '#9B7CF0') : 'var(--text-muted)',
                  opacity: moodStat.loggedToday ? 1 : .4,
                }} />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {moodStat.loggedToday ? moodStat.lastLabel : 'bez wpisu'}
                </span>
              </div>
            </div>
          </div>
        </PulpitCard>
        )}

        {/* TO-DO */}
        {shows('todo') && (
        <PulpitCard accent="#5BB6D9" Icon={IconTodo} label="To-do" onClick={() => onNavigate('todo')}>
          <div className="pulpit-value" style={{ fontSize: 26 }}>
            {todoStat.active}<span className="pulpit-value-dim"> {todoStat.active === 1 ? 'zadanie' : 'zadań'}</span>
          </div>
          <div className="pulpit-sub" style={{ color: todoStat.overdue > 0 ? 'var(--expense)' : 'var(--text-muted)' }}>
            {todoStat.overdue > 0
              ? `${todoStat.overdue} przeterminowane`
              : todoStat.dueToday > 0 ? `${todoStat.dueToday} na dziś` : 'na bieżąco'}
          </div>
        </PulpitCard>
        )}

        {/* MODLITWA */}
        {shows('prayer') && (
        <PulpitCard accent="#C9A24A" Icon={IconPrayer} label="Modlitwa" onClick={() => onNavigate('prayer')}>
          <div className="pulpit-value" style={{ fontSize: 26 }}>
            {prayerStat.prayedToday}<span className="pulpit-value-dim">/{prayerStat.active}</span>
          </div>
          <div className="pulpit-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {prayerStat.streak > 0
              ? <><IconFlame size={11} style={{ color: '#C9A24A' }} /> {prayerStat.streak} dni serii</>
              : 'modlono dziś'}
          </div>
        </PulpitCard>
        )}

        {/* WDZIĘCZNIK */}
        {shows('gratitude') && (
        <PulpitCard accent="#E8A33D" Icon={IcSun} label="Wdzięcznik" onClick={() => onNavigate('gratitude')}>
          <div className="pulpit-value" style={{ fontSize: 26 }}>
            {gratStat.todayCount}<span className="pulpit-value-dim"> dziś</span>
          </div>
          {/* Bez serii i rekordów — wdzięczność nie jest wyścigiem. */}
          <div className="pulpit-sub">
            {gratStat.todayCount > 0
              ? `${gratStat.month} w tym miesiącu`
              : 'Za co dziękujesz?'}
          </div>
        </PulpitCard>
        )}

        {/* BIBLIA */}
        {shows('bible') && (
        <PulpitCard accent="#4F74D9" Icon={IconBook} label="Biblia" onClick={() => onNavigate('bible')}>
          <div className="pulpit-row">
            <Ring value={bibleStat.pct} size={56} thickness={6} color="#4F74D9" />
            <div style={{ minWidth: 0 }}>
              {/* „1189/1189" to dużo znaków jak na pół kafelka — stąd mniejszy stopień */}
              <div className="pulpit-value" style={{ fontSize: 19 }}>
                {bibleStat.read}<span className="pulpit-value-dim">/{TOTAL_CHAPTERS}</span>
              </div>
              <div className="pulpit-sub">rozdziały</div>
            </div>
          </div>
        </PulpitCard>
        )}

      </div>
    </div>
  )
}

function AgendaColumn({ title, items, empty, onNavigate }) {
  return (
    <div className="pulpit-today-col">
      <div className="pulpit-today-coltitle">{title}</div>
      {items.length === 0 ? (
        <div className="pulpit-today-empty">{empty}</div>
      ) : (
        <div className="pulpit-today-list">
          {items.map(it => (
            <button key={it.key} className="pulpit-today-item" onClick={() => onNavigate(it.module)}>
              <span className="pulpit-today-time">{it.time || '—'}</span>
              <span className="pulpit-today-dot" style={{ background: it.color }} />
              <span className="pulpit-today-label">{it.label}</span>
              <span className="pulpit-today-meta">{it.meta}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PulpitCard({ accent, Icon, label, children, onClick }) {
  return (
    <button className="pulpit-card" onClick={onClick} style={{ '--card-accent': accent }}>
      <div className="pulpit-card-head">
        <span className="pulpit-card-icon"><Icon size={16} /></span>
        <span className="pulpit-card-label">{label}</span>
        <IconChevronRight size={14} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />
      </div>
      <div className="pulpit-card-body">{children}</div>
    </button>
  )
}
