import { IconChevronRight } from '../Icons'
import EventRow from './EventRow'
import { format, isToday, parseISO } from 'date-fns'
import { eventHasPerson } from './wspolne'
import { pl } from 'date-fns/locale'

// Agenda — lista nadchodzących wydarzeń bez siatki.

export default function AgendaView({ events, categories, calPeople, filterPersonId, onAdd, onEdit, onDelete }) {
  const today    = format(new Date(), 'yyyy-MM-dd')
  const src      = filterPersonId ? events.filter(e => eventHasPerson(e, filterPersonId)) : events
  const upcoming = [...src].filter(e => e.date >= today)
    .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : (a.startTime || '').localeCompare(b.startTime || ''))
  const grouped  = {}
  upcoming.forEach(e => { if (!grouped[e.date]) grouped[e.date] = []; grouped[e.date].push(e) })
  const dates    = Object.keys(grouped).sort()
  const past     = [...src].filter(e => e.date < today).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button className="btn-add-account" onClick={onAdd}>+ Dodaj wydarzenie</button>
      {dates.length === 0 ? (
        <div className="list-empty">
          <p>Brak nadchodzących wydarzeń</p>
          <p className="list-empty-hint">Dodaj wydarzenie przyciskiem powyżej</p>
        </div>
      ) : dates.map(date => (
        <div key={date}>
          <p className="cal-agenda-date">
            {isToday(parseISO(date)) ? 'DZIŚ' : format(parseISO(date), 'EEEE, d MMMM', { locale: pl })}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {grouped[date].map(e => <EventRow key={e.id} e={e} categories={categories} calPeople={calPeople} onEdit={onEdit} onDelete={onDelete} />)}
          </div>
        </div>
      ))}
      {past.length > 0 && (
        <details>
          <summary style={{ fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, listStyle: 'none', marginTop: 4 }}>
            <IconChevronRight size={12} style={{ verticalAlign: 'middle' }} /> Minione ({past.length})
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {past.map(e => <EventRow key={e.id} e={e} categories={categories} calPeople={calPeople} onEdit={onEdit} onDelete={onDelete} muted />)}
          </div>
        </details>
      )}
    </div>
  )
}

/* ─── EventRow ─────────────────────────────────────────────────────────── */
