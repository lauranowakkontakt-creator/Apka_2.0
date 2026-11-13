import { db } from '../../firebase/config'
import { expandEvents } from '../../utils/calendarRecurrence'
import { purgePerson, setPersonHidden } from '../../utils/people'
import { bladSubskrypcji } from '../../utils/polaczenie'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { confirmDialog } from '../ConfirmModal'
import { IconChevronLeft, IconChevronRight, IconPlus } from '../Icons'
import AgendaView from './AgendaView'
import CalendarGrid from './CalendarGrid'
import CalendarMenu from './CalendarMenu'
import CategoryManager from './CategoryManager'
import DayDetail from './DayDetail'
import EventForm from './EventForm'
import PeopleManager from './PeopleManager'
import PeopleView from './PeopleView'
import WeekView from './WeekView'
import { DEFAULT_CATEGORIES, getEventColor, whoOf, eventHasPerson } from './wspolne'
import { addDays, addMonths, endOfMonth, format, getDate, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Timestamp, addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { useEffect, useMemo, useState } from 'react'

// Moduł Kalendarz — spinacz. Dane z Firestore, wybór widoku i stan
// nawigacji; samo wyświetlanie oddane widokom w plikach obok.

export default function CalendarDashboard({ user, setHeaderExtras }) {
  const [events, setEvents]         = useState([])
  const [todos, setTodos]           = useState([])
  const [payments, setPayments]     = useState([])
  const [categories, setCategories] = useState([])
  const [calPeople, setCalPeople]   = useState([])
  const [loading, setLoading]       = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay]   = useState(new Date())
  const [tab, setTab]               = useState('month')
  const [showForm, setShowForm]     = useState(false)
  const [editEvent, setEditEvent]   = useState(null)
  const [showCatMgr, setShowCatMgr]       = useState(false)
  const [showPeopleMgr, setShowPeopleMgr] = useState(false)
  const [editPerson, setEditPerson]       = useState(null)
  const [filterPersonId, setFilterPersonId] = useState(null)

  const archivePersonH = async (id) => {
    await setPersonHidden(user.uid, id, 'calendar', true)
    if (filterPersonId === id) setFilterPersonId(null)
  }
  const restorePersonH = async (id) => {
    await setPersonHidden(user.uid, id, 'calendar', false)
  }
  const deletePerson = async (id) => {
    const ok = await confirmDialog({
      title: 'Usunąć osobę trwale?',
      message: 'Usunie też WSZYSTKIE jej wydarzenia i prośby modlitewne. Tego nie da się cofnąć. (Jeśli chcesz tylko ukryć osobę w kalendarzu — użyj Ukryj.)'
    })
    if (!ok) return
    await purgePerson(user.uid, id)
    if (filterPersonId === id) setFilterPersonId(null)
  }
  const openPersonEdit = (p) => { setEditPerson(p); setShowPeopleMgr(true) }

  // Zasiew domyślnych kategorii TYLKO RAZ (gdy użytkownik nigdy ich nie miał).
  // Flaga w settings/calendar zapobiega ponownemu zasiewowi po usunięciu —
  // wcześniej puste = ciągłe odtwarzanie domyślnych, przez co „usuwanie nie działało".
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const flagRef = doc(db, 'users', user.uid, 'settings', 'calendar')
        const flag = await getDoc(flagRef)
        if (cancelled || (flag.exists() && flag.data().seededCategories)) return
        const snap = await getDocs(collection(db, 'users', user.uid, 'calendarCategories'))
        if (cancelled) return
        if (snap.empty) {
          for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
            await addDoc(collection(db, 'users', user.uid, 'calendarCategories'), {
              ...DEFAULT_CATEGORIES[i], createdAt: Timestamp.fromMillis(Date.now() + i * 10)
            })
          }
        }
        await setDoc(flagRef, { seededCategories: true }, { merge: true })
      } catch { /* brak sieci itp. — pomiń */ }
    })()
    return () => { cancelled = true }
  }, [user.uid])

  // Live subskrypcja kategorii (bez zasiewu — usunięcia są trwałe)
  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'calendarCategories'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('calendarCategories'))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'calendarPeople'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setCalPeople(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('calendarPeople'))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'calendarEvents'), orderBy('date', 'asc'))
    return onSnapshot(q, snap => { setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      bladSubskrypcji('calendarEvents', { przyBledzie: () => setLoading(false) }))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'todos'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => setTodos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !t.done && t.dueDate)), bladSubskrypcji('todos'))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'regularPayments'), orderBy('dayOfMonth', 'asc'))
    return onSnapshot(q, snap => setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.frequency === 'monthly')), bladSubskrypcji('regularPayments'))
  }, [user.uid])

  const handleDayClick = (day) => {
    setSelectedDay(day)
    if (!isSameMonth(day, currentMonth)) setCurrentMonth(day)
  }

  const handleDelete = async (id) => {
    const ok = await confirmDialog({ title: 'Usunąć wydarzenie?' })
    if (!ok) return
    // Powiązaną prośbę modlitewną archiwizujemy (zostaje w historii), nie kasujemy.
    const ev = events.find(e => e.id === id)
    if (ev?.prayer?.intentionId) {
      await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', ev.prayer.intentionId), {
        status: 'ended', endedAt: Timestamp.now(), autoArchived: true
      }).catch(() => {})
    }
    await deleteDoc(doc(db, 'users', user.uid, 'calendarEvents', id))
  }

  // Osoby widoczne w kalendarzu (bez ukrytych) — do filtrów i wyboru w formularzu
  const activePeople = calPeople.filter(p => !p.hiddenInCalendar)

  // Wydarzenia z rozwiniętą cyklicznością dla widocznego zakresu (miesiąc ± bufor + agenda do przodu)
  const expandedEvents = useMemo(() => {
    const rs = format(startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const re = format(endOfMonth(addMonths(currentMonth, 6)), 'yyyy-MM-dd')
    return expandEvents(events, rs, re)
  }, [events, currentMonth])

  const eventsOnDay = (day) => {
    const s = format(day, 'yyyy-MM-dd')
    const all = expandedEvents.filter(e => s >= e.date && s <= (e.dateEnd || e.date))
    return filterPersonId ? all.filter(e => eventHasPerson(e, filterPersonId)) : all
  }
  const todosOnDay    = (day) => todos.filter(t => t.dueDate === format(day, 'yyyy-MM-dd'))
  const paymentsOnDay = (day) => payments.filter(p => p.dayOfMonth === getDate(day))

  // Górna belka („Apka"): [＋ Dodaj wydarzenie][⋮ Agenda / Osoby / Kategorie].
  // Hook musi być przed early-returnem (zasady hooków).
  useEffect(() => {
    setHeaderExtras?.(
      <>
        <CalendarMenu onAction={(id) => {
          if (id === 'categories') setShowCatMgr(true)
          else setTab(id)
        }} />
        <button className="hdr-btn accent" title="Nowe wydarzenie" onClick={() => { setEditEvent(null); setShowForm(true) }}><IconPlus size={17} /></button>
      </>
    )
    return () => setHeaderExtras?.(null)
  }, [])

  if (loading) return <div className="list-loading">Ładowanie...</div>

  const calMonthLabel  = format(currentMonth, 'LLLL yyyy', { locale: pl })
  const monthStr = format(currentMonth, 'yyyy-MM')
  const monthEvents = expandedEvents.filter(e => e.date.startsWith(monthStr))
  const colorOf = (e) => getEventColor(categories, calPeople, e)
  const peekToday    = eventsOnDay(new Date())
  const peekTomorrow = eventsOnDay(addDays(new Date(), 1))

  return (
    <div className="calendar-dashboard">
      {/* Podstrona (Agenda / Osoby / Tydzień) — pasek ze strzałką wstecz do Miesiąca */}
      {tab !== 'month' && (
        <div className="rev-subhead">
          <button className="rev-back" onClick={() => setTab('month')} title="Wróć"><IconChevronLeft size={18} /></button>
          <div className="rev-subhead-title">{tab === 'agenda' ? 'Agenda' : tab === 'people' ? 'Osoby' : tab === 'week' ? 'Tydzień' : 'Kalendarz'}</div>
        </div>
      )}

      {/* Kalendarz zawsze pokazuje wszystkich — bez ręcznego wybierania osoby.
          (Zarządzanie osobami jest w ⋮ → Osoby.) */}

      {/* Dziś / Jutro — szybki podgląd (tylko na widoku Miesiąc; w Tygodniu/Agendzie i tak jest to widoczne) */}
      {tab === 'month' && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[['Dziś', peekToday], ['Jutro', peekTomorrow]].map(([lbl, list]) => (
          <div key={lbl} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 8 }}>{lbl}</div>
            {list.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Brak wydarzeń</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {list.map(e => {
                  const c = colorOf(e)
                  const who = whoOf(e)
                  return (
                    <div key={e.id + e.date} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', borderLeft: `3px solid ${c}`, borderRadius: 8, padding: '6px 9px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                        {who && <div style={{ fontSize: 11, fontWeight: 600, color: c, marginTop: 1 }}>{who}</div>}
                      </div>
                      {e.startTime && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0 }}>{e.startTime}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      {/* MONTH TAB — jedna kolumna: nazwa miesiąca nad kalendarzem */}
      {tab === 'month' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 18 }}>
          {/* Nazwa miesiąca + nawigacja — nad kalendarzem */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button className="icon-btn" onClick={() => setCurrentMonth(m => subMonths(m, 1))} title="Poprzedni miesiąc"><IconChevronLeft size={16} /></button>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.02em', textTransform: 'capitalize' }}>{calMonthLabel}</div>
            <button className="icon-btn" onClick={() => setCurrentMonth(m => addMonths(m, 1))} title="Następny miesiąc"><IconChevronRight size={16} /></button>
          </div>

          <CalendarGrid
            currentMonth={currentMonth}
            selectedDay={selectedDay}
            categories={categories}
            calPeople={calPeople}
            events={filterPersonId ? expandedEvents.filter(e => eventHasPerson(e, filterPersonId)) : expandedEvents}
            onDayClick={handleDayClick}
            todosOnDay={todosOnDay}
            paymentsOnDay={paymentsOnDay}
          />

          {/* Co się dzieje w klikniętym dniu — wcześniej klik tylko podświetlał
              kratkę i nic nie pokazywał. */}
          <DayDetail
            day={selectedDay}
            events={filterPersonId ? expandedEvents.filter(e => eventHasPerson(e, filterPersonId)) : expandedEvents}
            todos={todos}
            payments={payments}
            categories={categories}
            calPeople={calPeople}
            onAdd={() => { setEditEvent(null); setShowForm(true) }}
            onEdit={(e) => { setEditEvent(e); setShowForm(true) }}
            onDelete={handleDelete}
            onGoToDay={(d) => { setSelectedDay(d); setCurrentMonth(d) }}
          />

          <div className="cal-mini-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 14 }}>
            {[[monthEvents.length,'Wydarzeń'],[todos.filter(t=>t.dueDate?.startsWith(monthStr)).length,'Zadań'],[payments.length,'Płatności']].map(([n,lbl]) => (
              <div key={lbl} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div className="cal-stat-num" style={{ fontSize: 16, fontWeight: 700 }}>{n}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'week' && (
        <WeekView
          weekDate={selectedDay}
          events={expandedEvents}
          categories={categories}
          calPeople={calPeople}
          filterPersonId={filterPersonId}
          todosOnDay={todosOnDay}
          paymentsOnDay={paymentsOnDay}
          onPrev={() => setSelectedDay(d => addDays(d, -7))}
          onNext={() => setSelectedDay(d => addDays(d, 7))}
          onToday={() => setSelectedDay(new Date())}
          onAddOn={(day) => { setSelectedDay(day); setEditEvent(null); setShowForm(true) }}
          onEdit={e => { setEditEvent(e); setShowForm(true) }}
          onDelete={handleDelete}
        />
      )}

      {tab === 'agenda' && (
        <AgendaView events={expandedEvents} categories={categories} calPeople={calPeople}
          filterPersonId={filterPersonId}
          onAdd={() => { setEditEvent(null); setShowForm(true) }}
          onEdit={e => { setEditEvent(e); setShowForm(true) }}
          onDelete={handleDelete} />
      )}

      {tab === 'people' && (
        <PeopleView calPeople={calPeople} events={expandedEvents} categories={categories}
          onManage={() => { setEditPerson(null); setShowPeopleMgr(true) }}
          onEditPerson={openPersonEdit}
          onArchivePerson={archivePersonH}
          onRestorePerson={restorePersonH}
          onDeletePerson={deletePerson}
          onEdit={e => { setEditEvent(e); setShowForm(true) }}
          onDelete={handleDelete} />
      )}

      {showForm && (
        <EventForm user={user} editData={editEvent} categories={categories} calPeople={activePeople}
          defaultDate={format(selectedDay, 'yyyy-MM-dd')}
          onClose={() => { setShowForm(false); setEditEvent(null) }} />
      )}
      {showCatMgr    && <CategoryManager user={user} categories={categories} onClose={() => setShowCatMgr(false)} />}
      {showPeopleMgr && <PeopleManager   user={user} calPeople={calPeople} editData={editPerson} onClose={() => { setShowPeopleMgr(false); setEditPerson(null) }} />}
    </div>
  )
}

/* ─── CalendarGrid ─── */
/* ─── DayDetail — co się dzieje w wybranym dniu ─────────────────────────
   Klik w kratkę pokazuje pełną listę: wydarzenia (z godziną, osobą,
   oznaczeniem dni wielodniowych), zadania na ten dzień i płatności.
   Gdy dzień jest pusty — podpowiadamy najbliższe nadchodzące wydarzenia,
   żeby kliknięcie nigdy nie kończyło się pustką. */
