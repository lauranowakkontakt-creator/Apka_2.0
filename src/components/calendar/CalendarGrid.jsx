import { WEEKDAYS, getEventColor } from './wspolne'
import { eachDayOfInterval, endOfMonth, endOfWeek, format, getDate, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns'
import { pl } from 'date-fns/locale'

// Siatka miesiąca z kropkami zajętości pod dniami.

export default function CalendarGrid({ currentMonth, selectedDay, categories, calPeople, events, onDayClick, todosOnDay, paymentsOnDay }) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)
  const allDays    = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end:   endOfWeek(monthEnd,     { weekStartsOn: 1 })
  })
  const weeks = []
  for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7))

  const eventsOnDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return events.filter(e => dayStr >= e.date && dayStr <= (e.dateEnd || e.date))
  }

  const getSpanPos = (event, day) => {
    if (!event.dateEnd || event.dateEnd === event.date) return 'solo'
    const dayStr = format(day, 'yyyy-MM-dd')
    const wStart = format(startOfWeek(day, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const wEnd   = format(endOfWeek(day, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const effStart = event.date > wStart ? event.date : wStart
    const effEnd   = event.dateEnd < wEnd  ? event.dateEnd  : wEnd
    if (dayStr === effStart) return 'start'
    if (dayStr === effEnd)   return 'end'
    return 'mid'
  }

  return (
    <div>
      <div className="cal-grid" style={{ marginBottom: 2 }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0 6px', letterSpacing: '.06em' }}>{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="cal-grid" style={{ marginBottom: 2 }}>
          {week.map(day => {
            const evts = eventsOnDay(day)
            const tdos = todosOnDay(day)
            const pmts = paymentsOnDay(day)
            const isSelected = isSameDay(day, selectedDay)
            const inMonth    = isSameMonth(day, currentMonth)
            const today      = isToday(day)

            const multiDay  = evts.filter(e => e.dateEnd && e.dateEnd !== e.date)
            const singleDay = evts.filter(e => !e.dateEnd || e.dateEnd === e.date)

            const singleItems = [
              ...singleDay.map(e => ({ label: e.title, color: getEventColor(categories, calPeople, e) })),
              ...tdos.map(t => ({ label: t.title, color: '#6366f1' })),
              ...pmts.map(p => ({ label: p.name,  color: '#f59e0b' })),
            ]
            const visibleSingle = singleItems.slice(0, Math.max(0, 3 - multiDay.length))
            const overflow = singleItems.length - visibleSingle.length + Math.max(0, multiDay.length - 3)

            // Mobile: każde wydarzenie/zadanie/płatność jako kolorowa kropka (widać wszystkie)
            const dotColors = [
              ...multiDay.map(e => getEventColor(categories, calPeople, e)),
              ...singleItems.map(it => it.color),
            ]

            return (
              <button
                key={day.toISOString()}
                className={`cal-day${isSelected ? ' cal-day--sel' : ''}`}
                onClick={() => onDayClick(day)}
                aria-label={format(day, 'EEEE, d MMMM yyyy', { locale: pl })}
                aria-pressed={!!isSelected}
                style={{ opacity: inMonth ? 1 : 0.42 }}
              >
                <div className={`cal-day-num${today ? ' today' : isSelected ? ' selected' : ''}`}>
                  {getDate(day)}
                </div>
                <div className="cal-chips">
                  {multiDay.slice(0, 3).map((e) => {
                    const pos     = getSpanPos(e, day)
                    const color   = getEventColor(categories, calPeople, e)
                    const isStart = pos === 'start' || pos === 'solo'
                    const isEnd   = pos === 'end'   || pos === 'solo'
                    return (
                      <div key={e.id} className="cal-mday" style={{
                        background: color + '40',
                        borderLeft:  isStart ? `2px solid ${color}` : `2px solid ${color}40`,
                        borderRight: isEnd   ? `2px solid ${color}` : 'none',
                        borderTop: `1px solid ${color}66`, borderBottom: `1px solid ${color}66`,
                        borderTopLeftRadius:     isStart ? 3 : 0,
                        borderBottomLeftRadius:  isStart ? 3 : 0,
                        borderTopRightRadius:    isEnd ? 3 : 0,
                        borderBottomRightRadius: isEnd ? 3 : 0,
                        paddingLeft: isStart ? 4 : 0,
                      }}>
                        {isStart && <span className="cal-mday-title">{e.title}</span>}
                      </div>
                    )
                  })}
                  {visibleSingle.map((item, i) => (
                    <div key={i} className="cal-chip" style={{ background: item.color + '28', borderLeft: `2px solid ${item.color}` }}>
                      <span className="cal-chip-text">{item.label}</span>
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div className="cal-chip-more">+{overflow}</div>
                  )}
                </div>
                <div className="cal-dots">
                  {dotColors.slice(0, 9).map((c, i) => (
                    <span key={i} className="cal-dot" style={{ background: c }} />
                  ))}
                  {dotColors.length > 9 && <span className="cal-dots-more">+{dotColors.length - 9}</span>}
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ─── WeekView ─────────────────────────────────────────────────────────── */
