import { db } from '../../firebase/config'
import { filterIntentions, groupByPerson, loadFilters, saveFilters, sortIntentions } from '../../utils/prayerFilters'
import { findPrio } from '../../utils/prayerStats'
import { confirmDialog } from '../ConfirmModal'
import { CatIcon, IconCheck, IconChevronLeft, IconChevronRight, IconPrayer } from '../Icons'
import { toast } from '../Toast'
import IntentionForm from './IntentionForm'
import PrayerFilterBar from './PrayerFilterBar'
import RequestCard from './RequestCard'
import { TODAY, toggleChecklistItem } from './wspolne'
import { addDays, format, parseISO, subDays } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Timestamp, arrayRemove, arrayUnion, doc } from 'firebase/firestore'
import { deleteDoc, updateDoc } from '../../utils/zapis'
import { useEffect, useMemo, useState } from 'react'

// Widok „Dziś" — prośby na dany dzień, z możliwością cofania się w tył.
// Nad listą pasek filtrów: temat (tag), jak dawno się nie modliłam i w jakiej
// kolejności ma iść lista. Sam wybór i porządkowanie siedzą w utils/prayerFilters.

export default function TodayView({ user, intentions, people, carMode }) {
  const [viewDate, setViewDate] = useState(TODAY())
  const [editItem, setEditItem] = useState(null)
  // Filtry przeżywają odświeżenie — po wejściu w moduł lista wygląda tak,
  // jak się ją zostawiło, a nie zawsze od zera.
  const [filters, setFilters]   = useState(loadFilters)
  useEffect(() => { saveFilters(filters) }, [filters])

  const hiddenIds          = useMemo(() => new Set(people.filter(p => p.hiddenInPrayer).map(p => p.id)), [people])
  const activeIntentions   = intentions.filter(i => (i.status === 'active' || !i.status) && !(i.personId && hiddenIds.has(i.personId)))
  // Prośby z oknem czasowym (np. z wydarzenia) pokazują się tylko w swoich dniach; bez okna — codziennie.
  const dueIntentions      = activeIntentions.filter(i => {
    if (!i.scheduleFrom && !i.scheduleTo) return true
    const from = i.scheduleFrom || '0000-01-01'
    const to   = i.scheduleTo   || '9999-12-31'
    return viewDate >= from && viewDate <= to
  })
  // Filtry liczymy względem oglądanego dnia, nie „teraz" — cofnięcie się o tydzień
  // ma pokazać stan z tamtego dnia, a nie dzisiejsze zaniedbania.
  const teraz              = useMemo(() => parseISO(`${viewDate}T12:00:00`), [viewDate])
  const visibleIntentions  = useMemo(
    () => filterIntentions(dueIntentions, filters, teraz),
    [dueIntentions, filters, teraz]
  )
  const archivedPrayedOnDate = useMemo(
    () => intentions.filter(i => i.status === 'ended' && i.prayedDates?.includes(viewDate)),
    [intentions, viewDate]
  )

  const togglePrayed = async (item, date) => {
    const d = date || viewDate
    const prayed = item.prayedDates?.includes(d)
    try {
      await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', item.id), {
        prayedDates: prayed ? arrayRemove(d) : arrayUnion(d)
      })
    } catch {
      toast.error('Nie udało się zapisać modlitwy')
    }
  }

  const addNote = async (itemId, text) => {
    await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', itemId), {
      notes: arrayUnion({ text, date: viewDate, id: Date.now().toString() })
    })
  }

  const editNote = async (item, note, newText) => {
    await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', item.id), { notes: arrayRemove(note) })
    await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', item.id), { notes: arrayUnion({ ...note, text: newText }) })
  }

  const deleteNote = async (item, note) => {
    await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', item.id), { notes: arrayRemove(note) })
  }

  const archiveItem = async (item) =>
    updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', item.id), { status: 'ended', endedAt: Timestamp.now() })

  const deleteItem = async (id) => {
    const ok = await confirmDialog({ title: 'Usunąć prośbę?' })
    if (ok) await deleteDoc(doc(db, 'users', user.uid, 'prayerIntentions', id))
  }

  const porzadek = useMemo(
    () => ({ mode: filters.sort, date: viewDate, teraz, pinTemporary: filters.pinTemporary }),
    [filters.sort, filters.pinTemporary, viewDate, teraz]
  )
  const grupy    = useMemo(
    () => (porzadek.mode === 'person' ? groupByPerson(visibleIntentions, people, porzadek) : null),
    [visibleIntentions, people, porzadek]
  )
  const sorted   = useMemo(
    () => (porzadek.mode === 'person' ? [] : sortIntentions(visibleIntentions, porzadek)),
    [visibleIntentions, porzadek]
  )

  // Karta jest ta sama w obu układach — płaskiej liście i w grupie osoby;
  // różni się tylko tym, czy imię stoi na karcie, czy w nagłówku grupy.
  const karta = (item, { showPerson = true } = {}) => (
    <RequestCard
      key={item.id}
      item={item}
      user={user}
      carMode={carMode}
      viewDate={viewDate}
      onTogglePrayed={togglePrayed}
      onAddNote={addNote}
      onToggleChecklistItem={(it, id) => toggleChecklistItem(user.uid, it, id)}
      onEditNote={editNote}
      onDeleteNote={deleteNote}
      onArchive={archiveItem}
      onEdit={() => setEditItem(item)}
      onDelete={deleteItem}
      showPerson={showPerson}
      person={people.find(p => p.id === item.personId)}
    />
  )

  const prayedCount = visibleIntentions.filter(i => i.prayedDates?.includes(viewDate)).length
  const isToday     = viewDate === TODAY()
  const dateLabel   = isToday ? 'Dziś' : format(parseISO(viewDate), 'EEEE, d MMMM', { locale: pl })
  const ukryte      = dueIntentions.length - visibleIntentions.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
        <button className="icon-btn" onClick={() => setViewDate(d => format(subDays(parseISO(d), 1), 'yyyy-MM-dd'))}><IconChevronLeft size={16} /></button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{dateLabel}</p>
          {!isToday && <button onClick={() => setViewDate(TODAY())} style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>wróć do dziś</button>}
        </div>
        <button className="icon-btn" onClick={() => setViewDate(d => format(addDays(parseISO(d), 1), 'yyyy-MM-dd'))}><IconChevronRight size={16} /></button>
      </div>

      <PrayerFilterBar
        filters={filters}
        onChange={setFilters}
        intentions={activeIntentions}
        carMode={carMode}
      />

      {/* Licznik modlono X/Y jest już w prawym górnym rogu nagłówka — tu tylko komunikat o komplecie */}
      {visibleIntentions.length > 0 && prayedCount === visibleIntentions.length && (
        <div style={{ background: 'rgba(39,174,96,0.12)', border: '1px solid #27AE60', borderRadius: 12, padding: carMode ? '14px' : '10px 14px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: carMode ? 17 : 14, color: '#27AE60', fontWeight: 700 }}>
            {ukryte > 0 ? 'Wszystkie prośby z tego filtra modlone!' : `Wszystkie prośby modlone ${isToday ? 'dziś' : 'tego dnia'}!`}
          </p>
        </div>
      )}

      {/* Tryb „Po osobach": kolejno jedna osoba i komplet jej próśb. */}
      {grupy
        ? grupy.map(g => (
            <div key={g.id}>
              <div className={`pray-person-head${g.done ? ' done' : ''}`}>
                <CatIcon categoryId={null} emoji={g.person?.icon || 'IcUsers'} size={carMode ? 22 : 16} />
                <span className="pray-person-name">{g.label}</span>
                <span className="pray-person-meta">
                  {g.items.filter(i => i.prayedDates?.includes(viewDate)).length}/{g.items.length}
                  {g.days > 0 && Number.isFinite(g.days) && ` · ${g.days} dni`}
                  {g.days === Infinity && ' · nigdy'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                {g.items.map(item => karta(item, { showPerson: false }))}
              </div>
            </div>
          ))
        : sorted.map(item => karta(item))}

      {editItem && (
        <IntentionForm user={user} editData={editItem} personId={editItem.personId} allIntentions={intentions} onClose={() => setEditItem(null)} />
      )}

      {/* Archived intentions that were prayed on this date */}
      {archivedPrayedOnDate.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.15em', marginBottom: 8, paddingLeft: 2 }}>
            Zarchiwizowane · modlono {isToday ? 'dziś' : 'tego dnia'}
          </div>
          {archivedPrayedOnDate.map(item => {
            const person = people.find(p => p.id === item.personId)
            const prio = findPrio(item.priority || 3)
            return (
              <div key={item.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderLeft: `3px solid ${prio.color}55`,
                borderRadius: 12, padding: '10px 14px', opacity: 0.5,
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
                pointerEvents: 'none',
              }}>
                <IconCheck size={16} style={{ flexShrink: 0, color: '#27AE60', marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{item.title}</p>
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'var(--surface3)', color: 'var(--text-muted)' }}>archiwum</span>
                  </div>
                  {person && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{person.name}</p>}
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><IconPrayer size={10} /> ×{item.prayedDates?.length || 0} łącznie</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {visibleIntentions.length === 0 && archivedPrayedOnDate.length === 0 && (
        <div className="list-empty">
          <p>{ukryte > 0 ? 'Filtry nie przepuściły żadnej prośby' : 'Brak próśb na ten dzień'}</p>
          <p className="list-empty-hint">
            {ukryte > 0
              ? `${ukryte} ${ukryte === 1 ? 'prośba jest' : 'próśb jest'} poza filtrem — zmień temat albo próg „jak dawno"`
              : isToday ? 'Dodaj prośby w zakładce Osoby lub przy wydarzeniu w Kalendarzu' : 'Tego dnia nic nie zaplanowano'}
          </p>
        </div>
      )}
    </div>
  )
}

/* ─── StatsView ──────────────────────────────────────────────────────────── */
