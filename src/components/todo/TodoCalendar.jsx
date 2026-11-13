import { PRIORITY, pOrder } from '../../utils/todoLogic'
import { IconCheck, IconChevronLeft, IconChevronRight, IconEdit } from '../Icons'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, getDate, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useState } from 'react'

// Zadania w siatce miesiąca.

const TC_WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']
export default function TodoCalendar({ todos, lists, onToggle, onEdit, onAddOnDay }) {
  const [month, setMonth]       = useState(new Date())
  const [selected, setSelected] = useState(new Date())

  const listColor = (id) => lists.find(l => l.id === id)?.color || 'var(--sky)'
  const monthStart = startOfMonth(month)
  const allDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  })
  const weeks = []
  for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7))

  const dated = todos.filter(t => t.dueDate)
  const tasksOn = (day) => dated.filter(t => t.dueDate === format(day, 'yyyy-MM-dd'))

  const selStr   = format(selected, 'yyyy-MM-dd')
  const selTasks = dated.filter(t => t.dueDate === selStr)
    .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || pOrder[a.priority] - pOrder[b.priority])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button aria-label="Poprzedni" className="icon-btn" onClick={() => setMonth(m => subMonths(m, 1))}><IconChevronLeft size={16} /></button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, textTransform: 'capitalize' }}>
          {format(month, 'LLLL yyyy', { locale: pl })}
        </span>
        <button aria-label="Następny" className="icon-btn" onClick={() => setMonth(m => addMonths(m, 1))}><IconChevronRight size={16} /></button>
      </div>

      {/* Grid */}
      <div>
        <div className="cal-grid" style={{ marginBottom: 2 }}>
          {TC_WEEKDAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0 6px', letterSpacing: '.06em' }}>{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="cal-grid" style={{ marginBottom: 2 }}>
            {week.map(day => {
              const ts       = tasksOn(day)
              const isSel    = isSameDay(day, selected)
              const inMonth  = isSameMonth(day, month)
              const today    = isToday(day)
              return (
                <button key={day.toISOString()} className={`cal-day${isSel ? ' cal-day--sel' : ''}`}
                  onClick={() => setSelected(day)} style={{ opacity: inMonth ? 1 : 0.3 }}>
                  <div className={`cal-day-num${today ? ' today' : isSel ? ' selected' : ''}`}>{getDate(day)}</div>
                  <div className="cal-chips">
                    {ts.slice(0, 3).map(t => {
                      const c = listColor(t.listId)
                      return (
                        <div key={t.id} className="cal-chip" style={{ background: c + '28', borderLeft: `2px solid ${c}`, opacity: t.done ? 0.5 : 1 }}>
                          <span className="cal-chip-dot" style={{ '--dot-color': c }} />
                          <span className="cal-chip-text" style={{ textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
                        </div>
                      )
                    })}
                    {ts.length > 3 && <div className="cal-chip-more">+{ts.length - 3}</div>}
                  </div>
                  {/* Kropki na mobile (chipy tekstowe są ukryte) — zadania widoczne bez klikania */}
                  {ts.length > 0 && (
                    <div className="cal-dots">
                      {ts.slice(0, 5).map(t => (
                        <span key={t.id} className="cal-dot" style={{ background: listColor(t.listId), opacity: t.done ? 0.4 : 1 }} />
                      ))}
                      {ts.length > 5 && <span className="cal-dots-more">+{ts.length - 5}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Selected day tasks */}
      <div className="cal-day-detail">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize', flex: 1 }}>
            {format(selected, 'EEEE, d MMMM', { locale: pl })}
          </span>
          <button className="t-btn" title="Dodaj zadanie na ten dzień" onClick={() => onAddOnDay(selStr)} style={{ width: 'auto', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <IconCheck size={12} /> Dodaj
          </button>
        </div>
        {selTasks.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>Brak zadań na ten dzień</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {selTasks.map(t => {
              const c = listColor(t.listId)
              const pc = PRIORITY.find(p => p.id === t.priority)?.color || '#888'
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--surface2)', borderLeft: `3px solid ${c}` }}>
                  <button onClick={() => onToggle(t)} title={t.done ? 'Cofnij' : 'Zrobione'} style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: 'pointer', display: 'grid', placeItems: 'center',
                    border: `1.5px solid ${t.done ? 'var(--income)' : 'var(--border-strong)'}`,
                    background: t.done ? 'var(--income)' : 'transparent', color: '#fff',
                  }}>{t.done && <IconCheck size={12} />}</button>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--text-muted)' : 'var(--text)' }}>{t.title}</span>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: pc, flexShrink: 0 }} title={t.priority} />
                  <button aria-label="Edytuj" className="t-btn" onClick={() => onEdit(t)}><IconEdit size={13} /></button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── TodoForm ─── */
