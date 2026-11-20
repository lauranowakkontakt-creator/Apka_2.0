import { daysBetween, eventsOnDate, paymentsOnDate, sortDayItems, spanInfo, todosOnDate, upcomingEvents } from '../../utils/calendarDay'
import { IconEdit, IconPlus, IconTrash } from '../Icons'
import { findCat, getEventColor, whoOf } from './wspolne'
import { format, isToday, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'

// Panel dnia — wydarzenia, zadania i płatności przypadające na wybrany dzień.

export default function DayDetail({ day, events, todos, payments, categories, calPeople, onAdd, onEdit, onDelete, onGoToDay }) {
  const dateStr = format(day, 'yyyy-MM-dd')
  const colorOf = (e) => getEventColor(categories, calPeople, e)

  const items = sortDayItems([
    ...eventsOnDate(events, dateStr).map(e => ({
      kind: 'event', key: 'e-' + e.id + '-' + e.date, raw: e,
      title: e.title, time: e.startTime || null, color: colorOf(e),
      who: whoOf(e),
      meta: e.startTime ? (e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime) : 'cały dzień',
      span: spanInfo(e, dateStr),
      cat: findCat(categories, e.categoryId)?.name || '',
    })),
    ...todosOnDate(todos, dateStr).map(t => ({
      kind: 'todo', key: 't-' + t.id, raw: t,
      title: t.title, time: null, color: '#6366f1', meta: 'zadanie',
    })),
    ...paymentsOnDate(payments, day).map(p => ({
      kind: 'payment', key: 'p-' + p.id, raw: p,
      title: p.name, time: null, color: '#f59e0b',
      meta: `płatność${p.amount ? ` · ${p.type === 'income' ? '+' : '−'}${p.amount}` : ''}`,
    })),
  ])

  const upcoming = items.length === 0 ? upcomingEvents(events, dateStr, 3) : []
  const dayTitle = format(day, 'EEEE, d MMMM', { locale: pl })

  return (
    <div className="cal-daydetail">
      <div className="cal-daydetail-head">
        <div>
          <div className="cal-daydetail-kicker">
            {isToday(day) ? 'Dziś' : format(day, 'yyyy', { locale: pl })}
          </div>
          <div className="cal-daydetail-title">{dayTitle}</div>
        </div>
        <button className="cal-daydetail-add" onClick={onAdd} title="Dodaj wydarzenie tego dnia">
          <IconPlus size={16} />
        </button>
      </div>

      {items.length > 0 ? (
        <div className="cal-daydetail-list">
          {items.map(it => (
            <div key={it.key} className="cal-dayitem" style={{ borderLeftColor: it.color }}>
              <span className="cal-dayitem-time">{it.time || '—'}</span>
              <div className="cal-dayitem-main">
                <div className="cal-dayitem-title">{it.title}</div>
                <div className="cal-dayitem-meta">
                  {it.who && <span style={{ color: it.color, fontWeight: 600 }}>{it.who} · </span>}
                  {it.meta}
                  {it.cat && ` · ${it.cat}`}
                  {it.span && ` · dzień ${it.span.index} z ${it.span.total}`}
                </div>
              </div>
              {it.kind === 'event' && (
                <div className="cal-dayitem-actions">
                  <button className="t-btn" title="Edytuj" onClick={() => onEdit(it.raw)}><IconEdit size={13} /></button>
                  <button className="t-btn delete" title="Usuń" onClick={() => onDelete(it.raw.id)}><IconTrash size={13} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="cal-daydetail-empty">
          <p>Nic zaplanowanego tego dnia.</p>
          {upcoming.length > 0 && (
            <>
              <div className="cal-daydetail-next-label">Nadchodzące</div>
              <div className="cal-daydetail-list">
                {upcoming.map(e => {
                  const inDays = daysBetween(dateStr, e.date)
                  return (
                    <button key={e.id + e.date} className="cal-dayitem as-button"
                      style={{ borderLeftColor: colorOf(e) }}
                      onClick={() => onGoToDay(parseISO(e.date))}>
                      <span className="cal-dayitem-time">
                        {inDays === 1 ? 'jutro' : `za ${inDays} dni`}
                      </span>
                      <div className="cal-dayitem-main">
                        <div className="cal-dayitem-title">{e.title}</div>
                        <div className="cal-dayitem-meta">
                          {format(parseISO(e.date), 'd MMM', { locale: pl })}
                          {e.startTime ? ` · ${e.startTime}` : ' · cały dzień'}
                          {whoOf(e) ? ` · ${whoOf(e)}` : ''}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
