import { db } from '../../firebase/config'
import { bladSubskrypcji } from '../../utils/polaczenie'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { IcCar, IconChevronLeft, IconFlame, IconPlus, IconPrayer } from '../Icons'
import SegTabs from '../SegTabs'
import ArchiveView from './ArchiveView'
import PeopleView from './PeopleView'
import PersonDetailView from './PersonDetailView'
import PersonForm from './PersonForm'
import PrayerMenu from './PrayerMenu'
import StatsView from './StatsView'
import TodayView from './TodayView'
import { TODAY } from './wspolne'
import { format, subDays } from 'date-fns'
import { Timestamp, collection, doc, orderBy, query } from 'firebase/firestore'
import { updateDoc } from '../../utils/zapis'
import { onSnapshot } from '../../utils/subskrypcje'
import { useEffect, useMemo, useState } from 'react'

// Moduł Modlitwa — spinacz. Trzyma dane z Firestore i stan nawigacji,
// a samo wyświetlanie oddaje widokom w osobnych plikach obok.

export default function PrayerDashboard({ user, setHeaderExtras }) {
  const [intentions, setIntentions] = useState([])
  const [people, setPeople]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [showPersonForm, setShowPersonForm] = useState(false)
  const [editPerson, setEditPerson] = useState(null)
  useFallbackTimeout(() => setLoading(false))
  const [tab, setTab]               = useState('people')
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [carMode, setCarMode]       = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'prayerIntentions'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setIntentions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, bladSubskrypcji('prayerIntentions'))
  }, [user.uid])

  useEffect(() => {
    // Wspólna baza osób z Kalendarzem — ta sama kolekcja `calendarPeople`.
    const q = query(collection(db, 'users', user.uid, 'calendarPeople'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setPeople(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('calendarPeople'))
  }, [user.uid])

  // Auto-archive intentions past their dateTo
  useEffect(() => {
    const today = TODAY()
    intentions.forEach(async i => {
      if ((i.status === 'active' || !i.status) && i.dateTo && i.dateTo < today) {
        await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', i.id), {
          status: 'ended', endedAt: Timestamp.now(), autoArchived: true
        })
      }
    })
  }, [intentions])

  const today            = TODAY()
  // Osoby ukryte w modlitwie — ich prośby nie liczą się w aktywnym widoku/licznikach
  const hiddenPersonIds  = useMemo(() => new Set(people.filter(p => p.hiddenInPrayer).map(p => p.id)), [people])
  const liveIntentions   = intentions.filter(i => !(i.personId && hiddenPersonIds.has(i.personId)))
  const activeIntentions = liveIntentions.filter(i => i.status === 'active' || !i.status)
  // Na dziś = prośby bez okna (codzienne) + te, których okno obejmuje dzisiaj
  const dueToday         = activeIntentions.filter(i => {
    if (!i.scheduleFrom && !i.scheduleTo) return true
    return today >= (i.scheduleFrom || '0000-01-01') && today <= (i.scheduleTo || '9999-12-31')
  })
  const prayedToday      = dueToday.filter(i => i.prayedDates?.includes(today)).length

  const allPrayedDates = useMemo(() => new Set(liveIntentions.flatMap(i => i.prayedDates || [])), [liveIntentions])
  const streak = useMemo(() => {
    let s = 0
    for (let i = 0; i < 365; i++) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
      if (d > today) continue
      if (allPrayedDates.has(d)) s++
      else if (d < today) break
    }
    return s
  }, [allPrayedDates])

  // Górna belka („Apka"): [＋ Dodaj osobę][⋮ Statystyki / Archiwum / Tryb auto].
  // Hook przed early-returnem (zasady hooków).
  useEffect(() => {
    setHeaderExtras?.(
      <>
        <PrayerMenu onAction={(id) => { setTab(id); setSelectedPerson(null) }} />
        <button className="hdr-btn accent" title="Dodaj osobę" onClick={() => { setEditPerson(null); setShowPersonForm(true) }}><IconPlus size={17} /></button>
      </>
    )
    return () => setHeaderExtras?.(null)
  }, [])

  if (loading) return <div className="list-loading">Ładowanie...</div>

  const switchTab = (t) => { setTab(t); setSelectedPerson(null) }

  return (
    <div className={`prayer-dashboard${carMode ? ' car-mode' : ''}`}>
      {/* Statystyki / Archiwum — podstrona ze strzałką wstecz do Osób */}
      {(tab === 'stats' || tab === 'archive') ? (
        <div className="rev-subhead">
          <button className="rev-back" onClick={() => switchTab('people')} title="Wróć"><IconChevronLeft size={18} /></button>
          <div className="rev-subhead-title">{tab === 'stats' ? 'Statystyki' : 'Archiwum'}</div>
        </div>
      ) : (
        <>
          {/* Pigułki: seria, tryb auto i „pomodlono dziś" */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 10 }}>
            <div className="mod-header-stat"><IconFlame size={14} style={{ color: 'var(--accent)' }} /><span>{streak}</span></div>
            <button
              onClick={() => setCarMode(m => !m)}
              title="Tryb auto (większe przyciski do prowadzenia)"
              className="mod-header-stat"
              style={{
                cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${carMode ? 'var(--accent)' : 'var(--border)'}`,
                background: carMode ? 'var(--accent)' : undefined,
                color: carMode ? '#fff' : 'var(--text-sub)',
              }}
            ><IcCar size={14} /></button>
            <div className="mod-header-stat"><IconPrayer size={14} style={{ color: 'var(--warn)' }} /><span>{prayedToday}/{dueToday.length}</span></div>
          </div>
          <SegTabs
            items={[{ id: 'people', label: 'Osoby' }, { id: 'today', label: 'Dziś' }]}
            active={tab} onChange={switchTab}
            size={carMode ? 'lg' : undefined}
          />
        </>
      )}

      {tab === 'people' && (
        selectedPerson
          ? <PersonDetailView
              user={user}
              person={selectedPerson}
              intentions={intentions}
              carMode={carMode}
              onBack={() => setSelectedPerson(null)}
            />
          : <PeopleView
              user={user}
              people={people}
              intentions={intentions}
              carMode={carMode}
              onSelect={setSelectedPerson}
              onAdd={() => { setEditPerson(null); setShowPersonForm(true) }}
              onEdit={(p) => { setEditPerson(p); setShowPersonForm(true) }}
            />
      )}
      {tab === 'today' && (
        <TodayView user={user} intentions={intentions} people={people} carMode={carMode} />
      )}
      {tab === 'stats' && (
        <StatsView intentions={intentions} people={people} allPrayedDates={allPrayedDates} streak={streak} />
      )}
      {tab === 'archive' && (
        <ArchiveView user={user} intentions={intentions} people={people} />
      )}

      {showPersonForm && (
        <PersonForm user={user} editData={editPerson} onClose={() => { setShowPersonForm(false); setEditPerson(null) }} />
      )}
    </div>
  )
}

/* ─── PeopleView ─────────────────────────────────────────────────────────── */
