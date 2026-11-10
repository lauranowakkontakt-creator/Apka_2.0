import { IconArchive, IconChevronDown, IconChevronRight, IconEdit, IconRestore, IconTrash } from '../Icons'
import PersonBubble from '../PersonBubble'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useState } from 'react'

// Osoby w Kalendarzu — wydarzenia zgrupowane po osobie, plus archiwizacja.

export default function PeopleView({ calPeople, events, categories, onManage, onEditPerson, onArchivePerson, onRestorePerson, onDeletePerson, onEdit, onDelete }) {
  const [showArchive, setShowArchive] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  const activePeople   = calPeople.filter(p => !p.hiddenInCalendar)
  const archivedPeople = calPeople.filter(p => p.hiddenInCalendar)

  const upcomingFor = (personId) =>
    events.filter(e => e.personId === personId && e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))

  const noPerson = events.filter(e => !e.personId && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))

  const renderPerson = (person, archived) => {
    const upcoming = upcomingFor(person.id)
    const totalEvents = events.filter(e => e.personId === person.id).length
    return (
      <div key={person.id} style={{ background: 'var(--surface)', border: `1px solid ${person.color}44`, borderRadius: 'var(--r)', overflow: 'hidden', opacity: archived ? 0.85 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: person.color + '14', borderBottom: `1px solid ${person.color}22` }}>
          <PersonBubble person={person} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              {person.name}
              {archived && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'var(--surface3)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Ukryta</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {archived
                ? `${totalEvents} ${totalEvents === 1 ? 'wydarzenie' : 'wydarzeń'} w historii`
                : (upcoming.length > 0 ? `${upcoming.length} nadchodzących wydarzeń` : 'Nic zaplanowanego')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {archived ? (
              <button className="t-btn" title="Pokaż w kalendarzu" onClick={() => onRestorePerson(person.id)}><IconRestore size={14} /></button>
            ) : (
              <>
                <button className="t-btn" title="Edytuj osobę" onClick={() => onEditPerson(person)}><IconEdit size={14} /></button>
                <button className="t-btn" title="Ukryj w kalendarzu (zostaje w bazie Osób)" onClick={() => onArchivePerson(person.id)}><IconArchive size={14} /></button>
              </>
            )}
            <button className="t-btn delete" title="Usuń trwale (z wydarzeniami i prośbami)" onClick={() => onDeletePerson(person.id)}><IconTrash size={14} /></button>
          </div>
        </div>

        {!archived && (upcoming.length > 0 ? (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {upcoming.map(e => (
              <div key={`${e.id}-${e.date}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 10px', borderRadius: 9, background: 'var(--surface2)' }}>
                <div style={{ flexShrink: 0, paddingTop: 1 }}>
                  <div style={{ fontSize: 11, color: person.color, fontWeight: 700, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                    {format(parseISO(e.date), 'd MMM', { locale: pl })}
                  </div>
                  {e.startTime && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{e.startTime}</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.title}</div>
                  {e.note && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>{e.note}</div>}
                </div>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <button className="t-btn" onClick={() => onEdit(e)}><IconEdit size={11} /></button>
                  <button className="t-btn delete" onClick={() => onDelete(e.id)}><IconTrash size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Nic zaplanowanego</div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button className="btn-add-account" onClick={onManage}>+ Zarządzaj osobami</button>

      {activePeople.length === 0 && archivedPeople.length === 0 && (
        <div className="list-empty">
          <p>Brak osób</p>
          <p className="list-empty-hint">Dodaj osoby przyciskiem powyżej, każda dostanie swój kolor</p>
        </div>
      )}

      {activePeople.map(person => renderPerson(person, false))}

      {archivedPeople.length > 0 && (
        <div>
          <button onClick={() => setShowArchive(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '9px 12px', cursor: 'pointer',
            background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10,
            color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          }}>
            <IconArchive size={13} />
            <span style={{ flex: 1, textAlign: 'left' }}>Ukryte w kalendarzu ({archivedPeople.length})</span>
            {showArchive ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </button>
          {showArchive && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              {archivedPeople.map(person => renderPerson(person, true))}
            </div>
          )}
        </div>
      )}

      {noPerson.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.12em', borderBottom: '1px solid var(--border)' }}>
            Bez osoby
          </div>
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {noPerson.map(e => (
              <div key={`${e.id}-${e.date}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{format(parseISO(e.date), 'd MMM', { locale: pl })}</span>
                <span style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{e.title}</span>
                <button className="t-btn" onClick={() => onEdit(e)}><IconEdit size={11} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── EventForm ────────────────────────────────────────────────────────── */
