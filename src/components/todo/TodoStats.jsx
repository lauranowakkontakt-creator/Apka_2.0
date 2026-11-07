import { PRIORITY, statystykiOkresu, zadaniaAktywne, zadaniaNaDzis, zadaniaPoTerminie } from '../../utils/todoLogic'
import { BarChartSVG } from '../ChartPrimitives'
import { CatIcon } from '../Icons'
import SegTabs from '../SegTabs'
import { eachDayOfInterval, eachMonthOfInterval, endOfDay, endOfMonth, endOfWeek, endOfYear, format, startOfDay, startOfMonth, startOfWeek, startOfYear } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { AnalizaRoku, Rozwijana } from '../Analityka'
import { kluczDnia } from '../../utils/analityka'

// Statystyki zadań: kafelki, wykres i rozbicie po listach i priorytetach.
// Samo liczenie siedzi w utils/todoLogic.js.

const PERIODS = [
  { id: 'week',  label: 'Tydzień' },
  { id: 'month', label: 'Miesiąc' },
  { id: 'year',  label: 'Rok' },
]

export default function TodoStats({ todos, lists }) {
  const [period, setPeriod] = useState('month')

  // Ukończone zadania po dniu ukończenia — do analizy roku
  const wpisyDone = useMemo(() => todos.filter(t => t.done && t.doneAt).map(t => ({ klucz: kluczDnia(t.doneAt) })), [todos])
  const now    = new Date()
  const ranges = {
    day:   { start: startOfDay(now),            end: endOfDay(now) },
    week:  { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) },
    month: { start: startOfMonth(now),          end: endOfMonth(now) },
    year:  { start: startOfYear(now),           end: endOfYear(now) },
  }
  const range = ranges[period]

  // Klasyfikacja i liczenie w utils/todoLogic.js — razem z testami na granicę
  // „po terminie" kontra „na dziś", której nie dało się sprawdzić stąd.
  const allActive = zadaniaAktywne(todos)
  const overdue   = zadaniaPoTerminie(todos)
  const dueToday  = zadaniaNaDzis(todos)

  const { zrobioneWOkresie: doneInPeriod, procentUkonczenia: completionRate } =
    statystykiOkresu(todos, range)

  const chartData = (() => {
    if (period === 'day') return []
    if (period === 'week' || period === 'month') {
      const days = eachDayOfInterval(range)
      return days.map(d => {
        const count = doneInPeriod.filter(t => {
          const done = t.doneAt.toDate ? t.doneAt.toDate() : new Date(t.doneAt)
          return format(done, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd')
        }).length
        return { label: format(d, period === 'week' ? 'EEE' : 'd', { locale: pl }), count }
      })
    }
    return eachMonthOfInterval(range).map(m => {
      const count = doneInPeriod.filter(t => {
        const done = t.doneAt.toDate ? t.doneAt.toDate() : new Date(t.doneAt)
        return format(done, 'yyyy-MM') === format(m, 'yyyy-MM')
      }).length
      return { label: format(m, 'MMM', { locale: pl }), count }
    })
  })()

  const byList = lists.map(l => ({
    ...l,
    done:   doneInPeriod.filter(t => t.listId === l.id).length,
    active: allActive.filter(t => t.listId === l.id).length,
  })).filter(l => l.done > 0 || l.active > 0)
  const noListDone   = doneInPeriod.filter(t => !t.listId).length
  const noListActive = allActive.filter(t => !t.listId).length

  const byPriority = PRIORITY.map(p => ({
    ...p, count: allActive.filter(t => t.priority === p.id).length
  }))
  const noPriorityCount = allActive.filter(t => !t.priority).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatCard value={allActive.length}  label="Aktywnych"       color="var(--text)" />
        <StatCard value={overdue.length}    label="Przeterminowane" color={overdue.length > 0 ? '#E53935' : 'var(--text-muted)'} />
        <StatCard value={dueToday.length}   label="Na dziś"         color={dueToday.length > 0 ? '#FB8C00' : 'var(--text-muted)'} />
      </div>

      <AnalizaRoku id="todo" wpisy={wpisyDone} jednostka={['zadanie', 'zadania', 'zadań']} kolor="var(--income)" tytulDni="Dni z ukończeniem" />

      <Rozwijana id="todo-okres" tytul="Okres i listy" podsumowanie={`${doneInPeriod.length} w tym ${period === 'week' ? 'tygodniu' : period === 'month' ? 'miesiącu' : 'roku'}`}>
      <SegTabs items={PERIODS} active={period} onChange={setPeriod} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <StatCard value={doneInPeriod.length} label="Ukończonych" color="var(--income)" big />
        <StatCard value={`${completionRate}%`} label="Ukończono" color="var(--accent)" big />
      </div>

      {chartData.length > 0 && chartData.some(d => d.count > 0) && (
        <div className="chart-section">
          <h3 className="chart-title">Ukończone zadania</h3>
          {/* Przerzedzaniem etykiet zajmuje się sam wykres — przy 31 dniach
              robił to wcześniej stąd co drugi dzień, a i tak się nie mieściły. */}
          <BarChartSVG
            height={160}
            accent="var(--income)"
            fmt={(v) => `${v} ukończ.`}
            data={chartData.map(d => ({ label: d.label, value: d.count }))}
          />
        </div>
      )}

      {(byList.length > 0 || noListDone > 0 || noListActive > 0) && (
        <div className="chart-section">
          <h3 className="chart-title">Według list</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byList.map(l => (
              <ListStatRow key={l.id} icon={l.icon} name={l.name} color={l.color}
                done={l.done} active={l.active} />
            ))}
            {(noListDone > 0 || noListActive > 0) && (
              <ListStatRow icon="IconMore" name="Bez listy" color="var(--text-muted)"
                done={noListDone} active={noListActive} />
            )}
          </div>
        </div>
      )}

      {allActive.length > 0 && (
        <div className="chart-section">
          <h3 className="chart-title">Aktywne według priorytetu</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {byPriority.filter(p => p.count > 0).map(p => (
              <PriorityRow key={p.id} label={p.label} color={p.color} count={p.count} total={allActive.length} />
            ))}
            {noPriorityCount > 0 && (
              <PriorityRow label="Brak" color="var(--text-muted)" count={noPriorityCount} total={allActive.length} />
            )}
          </div>
        </div>
      )}
      </Rozwijana>
    </div>
  )
}

function StatCard({ value, label, color, big }) {
  return (
    <div className="card" style={{ padding: big ? '18px 12px' : '14px 10px', textAlign: 'center' }}>
      <div className="serif" style={{ fontSize: big ? 34 : 26, color }}>{value}</div>
      <div className="kicker" style={{ marginTop: 6 }}>{label}</div>
    </div>
  )
}

function ListStatRow({ icon, name, color, done, active }) {
  const total = done + active
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CatIcon categoryId={null} emoji={icon} size={16} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{name}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{done} / {total}</span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'var(--border)' }}>
          <div style={{ height: '100%', borderRadius: 3, background: color === 'var(--text-muted)' ? '#607D8B' : color, width: `${pct}%`, transition: 'width .3s' }} />
        </div>
      </div>
    </div>
  )
}

function PriorityRow({ label, color, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, width: 64 }}>{label}</span>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--border)' }}>
        <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 24, textAlign: 'right' }}>{count}</span>
    </div>
  )
}

/* ─── TodoCalendar ─── */
