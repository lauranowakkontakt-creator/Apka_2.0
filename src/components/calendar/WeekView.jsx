import { CatIcon, IconCheck, IconChevronLeft, IconChevronRight, IconEdit, IconRepeat, IconTrash } from '../Icons'
import { getEventColor, eventHasPerson } from './wspolne'
import { eachDayOfInterval, endOfWeek, format, isToday, startOfWeek } from 'date-fns'
import { pl } from 'date-fns/locale'

// Widok tygodnia.

export default function WeekView({ weekDate, events, categories, calPeople, filterPersonId, todosOnDay, paymentsOnDay, onPrev, onNext, onToday, onAddOn, onEdit, onDelete }) {
  const start = startOfWeek(weekDate, { weekStartsOn: 1 })
  const days  = eachDayOfInterval({ start, end: endOfWeek(weekDate, { weekStartsOn: 1 }) })
  const evOn = (day) => {
    const s = format(day, 'yyyy-MM-dd')
    let all = events.filter(e => s >= e.date && s <= (e.dateEnd || e.date))
    if (filterPersonId) all = all.filter(e => eventHasPerson(e, filterPersonId))
    return all.sort((a, b) => (a.startTime || '99').localeCompare(b.startTime || '99'))
  }
  const rangeLabel = `${format(start, 'd', { locale: pl })}–${format(days[6], 'd MMM yyyy', { locale: pl })}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button aria-label="Poprzedni" className="icon-btn" onClick={onPrev}><IconChevronLeft size={16} /></button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{rangeLabel}</span>
        <button className="icon-btn" style={{ width: 'auto', padding: '0 10px', fontSize: 12 }} onClick={onToday}>Dziś</button>
        <button aria-label="Następny" className="icon-btn" onClick={onNext}><IconChevronRight size={16} /></button>
      </div>

      {days.map(day => {
        const evts  = evOn(day)
        const tds   = todosOnDay(day)
        const pms   = paymentsOnDay(day)
        const today = isToday(day)
        const count = evts.length + tds.length + pms.length
        return (
          <div key={day.toISOString()} style={{
            background: 'var(--surface)', border: `1px solid ${today ? 'color-mix(in oklab, var(--accent) 40%, var(--border))' : 'var(--border)'}`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: today ? 'var(--accent-soft)' : 'var(--surface2)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize', color: today ? 'var(--accent)' : 'var(--text)' }}>
                {format(day, 'EEEE', { locale: pl })}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{format(day, 'd MMM', { locale: pl })}</span>
              {today && <span style={{ fontSize: 8, fontWeight: 700, background: 'var(--accent)', color: '#fff', padding: '1px 6px', borderRadius: 4 }}>DZIŚ</span>}
              <button className="t-btn" style={{ marginLeft: 'auto' }} title="Dodaj" onClick={() => onAddOn(day)}>+</button>
            </div>
            {count === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>—</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px' }}>
                {evts.map(e => {
                  const color = getEventColor(categories, calPeople, e)
                  return (
                    <div key={e.id + e.date} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '7px 10px' }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 38, flexShrink: 0 }}>{e.startTime || '—'}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                      {e.recurrence && <IconRepeat size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                      <button aria-label="Edytuj" className="t-btn" onClick={() => onEdit(e)}><IconEdit size={12} /></button>
                      <button aria-label="Usuń" className="t-btn delete" onClick={() => onDelete(e.id)}><IconTrash size={12} /></button>
                    </div>
                  )
                })}
                {tds.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
                    <IconCheck size={12} style={{ color: '#6366f1' }} /> {t.title} <span style={{ fontSize: 9, color: '#6366f1', fontWeight: 700 }}>ZADANIE</span>
                  </div>
                ))}
                {pms.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
                    <CatIcon categoryId={p.categoryId} emoji={p.categoryIcon} size={12} /> {p.name} <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>PŁATNOŚĆ</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── AgendaView ───────────────────────────────────────────────────────── */
