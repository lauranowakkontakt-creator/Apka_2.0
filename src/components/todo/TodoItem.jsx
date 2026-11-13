import { RECUR_LABEL } from '../../utils/calendarRecurrence'
import { PRIORITY } from '../../utils/todoLogic'
import { CatIcon, IconCalendar, IconCheck, IconClock, IconEdit, IconFlag, IconRepeat, IconTrash, IconStar } from '../Icons'
import PersonBubble from '../PersonBubble'
import { format, isPast, isToday, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'

// Pojedyncze zadanie na liście, razem z podzadaniami.

export default function TodoItem({ todo, lists, peopleById = {}, onToggle, onToggleSubtask, onEdit, onDelete, onStar }) {
  const list     = lists.find(l => l.id === todo.listId)
  const priority = PRIORITY.find(p => p.id === todo.priority)
  const date     = todo.dueDate ? parseISO(todo.dueDate) : null
  const overdue  = date && isPast(date) && !isToday(date) && !todo.done
  const dueToday = date && isToday(date) && !todo.done
  const listColor = list?.color || 'var(--border)'
  const subs     = todo.subtasks || []
  const subsDone = subs.filter(s => s.done).length
  const linkedPeople = (todo.peopleIds || []).map(id => peopleById[id]).filter(Boolean)

  return (
    <div className="card hover" style={{
      padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 13,
      ...(todo.starred && !todo.done ? { borderColor: 'color-mix(in oklab, var(--warn) 55%, var(--border))', background: 'color-mix(in oklab, var(--warn) 6%, var(--surface))' } : {}),
    }}>
      {/* Checkbox */}
      <button onClick={() => onToggle(todo)} role="checkbox" aria-checked={!!todo.done}
        aria-label={`Zrobione: ${todo.title || todo.text || 'zadanie'}`} className="todo-check" style={{
        width: 24, height: 24, borderRadius: 8, flexShrink: 0, marginTop: 1,
        border: `1.8px solid ${todo.done ? 'var(--income)' : list ? listColor : priority?.color || 'var(--border-strong)'}`,
        background: todo.done ? 'var(--income)' : 'transparent', cursor: 'pointer',
        display: 'grid', placeItems: 'center', color: 'var(--bg)',
        transition: 'all .2s var(--spring)',
      }}>{todo.done ? <IconCheck size={13} /> : ''}</button>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 14.5, fontWeight: 500,
          textDecoration: todo.done ? 'line-through' : 'none',
          color: todo.done ? 'var(--text-muted)' : 'var(--text)'
        }}>{todo.title}</p>
        {todo.note && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{todo.note}</p>}
        <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {list && (
            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: listColor + '22', color: listColor, fontWeight: 600 }}>
              <CatIcon categoryId={null} emoji={list.icon} size={11} /> {list.name}
            </span>
          )}
          {priority && !todo.done && (
            <span style={{
              fontSize: 10, padding: '1px 7px', borderRadius: 4,
              background: priority.color + '22', color: `color-mix(in oklab, ${priority.color} 62%, white)`, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.04em',
            }}>
              {priority.label}
            </span>
          )}
          {date && (
            <span style={{ fontSize: 11, fontWeight: overdue || dueToday ? 600 : 400, color: overdue ? '#F0625F' : dueToday ? '#FB8C00' : 'var(--text-muted)' }}>
              {overdue ? <IconFlag size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} /> : dueToday ? <IconClock size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} /> : <IconCalendar size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />}
              {format(date, 'd MMM', { locale: pl })}
            </span>
          )}
          {todo.recurrence && (
            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: 'var(--sky)22', color: 'var(--sky)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <IconRepeat size={10} /> {RECUR_LABEL[todo.recurrence]}
            </span>
          )}
          {subs.length > 0 && (
            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--text-muted)', fontWeight: 600 }}>
              {subsDone}/{subs.length}
            </span>
          )}
        </div>

        {/* Osoby, których dotyczy zadanie */}
        {linkedPeople.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
            {linkedPeople.map(p => (
              <span key={p.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px 2px 2px', borderRadius: 999,
                background: (p.color || 'var(--accent)') + '18', color: p.color || 'var(--accent)', fontSize: 11, fontWeight: 600,
              }}>
                <PersonBubble person={p} size={18} /> {p.name}
              </span>
            ))}
          </div>
        )}

        {/* Podzadania */}
        {subs.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {subs.map(s => (
              <button key={s.id} type="button" role="checkbox" aria-checked={!!s.done} className="todo-sub" onClick={() => onToggleSubtask?.(todo, s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center',
                  border: `1.5px solid ${s.done ? 'var(--income)' : 'var(--border-strong)'}`,
                  background: s.done ? 'var(--income)' : 'transparent', color: '#fff',
                }}>{s.done && <IconCheck size={10} />}</span>
                <span style={{ fontSize: 12, textDecoration: s.done ? 'line-through' : 'none', color: s.done ? 'var(--text-muted)' : 'var(--text-sub)' }}>{s.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {onStar && !todo.done && (
          <button className="t-btn" onClick={() => onStar(todo)} aria-pressed={!!todo.starred}
            title={todo.starred ? 'Usuń z wybranych' : 'Dodaj do wybranych — chcę to zrobić'}
            style={{ color: todo.starred ? 'var(--warn)' : undefined }}>
            <IconStar size={13} style={todo.starred ? { fill: 'currentColor' } : undefined} />
          </button>
        )}
        <button aria-label="Edytuj" className="t-btn" onClick={onEdit}><IconEdit size={13} /></button>
        <button aria-label="Usuń" className="t-btn delete" onClick={() => onDelete(todo.id)}><IconTrash size={13} /></button>
      </div>
    </div>
  )
}

/* ─── Statystyki ─── */
