import { IconEdit, IconPrayer, IconTrash } from '../Icons'
import PersonBubble from '../PersonBubble'
import { findCat, findPerson, getEventColor } from './wspolne'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'

// Wiersz jednego wydarzenia. Wspólny dla tygodnia, agendy i widoku osoby,
// dlatego siedzi w osobnym pliku, a nie w którymś z nich.

export default function EventRow({ e, categories, calPeople, onEdit, onDelete, muted }) {
  const person = findPerson(calPeople, e.personId)
  const cat    = findCat(categories, e.categoryId)
  const color  = getEventColor(categories, calPeople, e)
  return (
    <div className="cal-event-row" style={{ borderLeftColor: color, opacity: muted ? 0.5 : 1 }}>
      {(e.startTime || (e.dateEnd && e.dateEnd !== e.date)) && (
        <div style={{ minWidth: 44, flexShrink: 0 }}>
          {e.startTime && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>{e.startTime}</div>}
          {e.endTime   && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>–{e.endTime}</div>}
          {e.dateEnd && e.dateEnd !== e.date && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>→{format(parseISO(e.dateEnd), 'd MMM', { locale: pl })}</div>
          )}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          {person && <PersonBubble person={person} size={20} />}
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{e.title}</p>
          {e.prayer?.enabled && <IconPrayer size={12} style={{ color: '#a78bfa', flexShrink: 0 }} />}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {person && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: person.color + '22', color: `color-mix(in oklab, ${person.color} 70%, white)`, fontWeight: 700 }}>{person.name}</span>}
          {!person && e.who && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: 'var(--surface3)', color: 'var(--text)', fontWeight: 600 }}>{e.who}</span>}
          {cat    && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: color + '18', color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{cat.label}</span>}
        </div>
        {e.note && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{e.note}</p>}
      </div>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <button aria-label="Edytuj" className="t-btn" onClick={() => onEdit(e)}><IconEdit size={13} /></button>
        <button aria-label="Usuń" className="t-btn delete" onClick={() => onDelete(e.id)}><IconTrash size={13} /></button>
      </div>
    </div>
  )
}

/* ─── PeopleView ───────────────────────────────────────────────────────── */
