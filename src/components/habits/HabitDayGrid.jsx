import { isHabitDue, pauseForDay, pauseReasonMeta, eachDayStr, habitDayKind,
  habitDoneDates } from '../../utils/habitLogic'

// Siatka małych kwadracików — jeden na każdy dzień zakresu [start..end].
// Kolor mówi, co się działo danego dnia (spójny język z siatką tygodnia):
//   pełny kolor        — zrobione
//   ciemniejszy kolor  — zrobione dodatkowo (nawyk nie wypadał tego dnia)
//   kolor + obwódka    — zrobione MIMO wyjazdu/choroby (obwódka w kolorze powodu)
//   kolor pauzy         — dzień wyjazdu/choroby bez wykonania (nie kara)
//   pusta ramka         — obowiązkowe, pominięte
//   ledwo widoczne      — poza planem / przed startem / przyszłość
// Rozmiar kwadratów dobiera się do długości okresu (tydzień → duże, rok → małe).
export default function HabitDayGrid({ habit, pauses = [], start, end, today, color = 'var(--accent)', size }) {
  const days = eachDayStr(start, end)
  if (days.length === 0) return null
  const cell = size || (days.length <= 7 ? 20 : days.length <= 31 ? 14 : days.length <= 92 ? 10 : 8)
  const gap  = cell >= 18 ? 5 : cell >= 12 ? 4 : cell >= 9 ? 3 : 2
  const radius = cell >= 12 ? 4 : 2
  // Dni zaliczone liczymy, a nie czytamy z zapisanej listy — przy nawyku na
  // czas zapisane odhaczenia nie wiedzą o późniejszej zmianie celu i kratka
  // świeciła się na dzień, który przy nowej normie zrobiony nie jest.
  const done = new Set(habitDoneDates(habit))
  const deep = `color-mix(in oklab, ${color} 58%, #000)`

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap }}>
      {days.map(d => {
        const isDone = done.has(d)
        const status = isHabitDue(habit, d, pauses) // before-start|after-end|paused|due|off
        const future = d > today
        let bg = 'transparent', border = '1px solid transparent', title = d, pauseRing = null
        if (future) {
          // Zaplanowana pauza (wyjazd/choroba) widoczna już przed terminem.
          if (status === 'paused') {
            const m = pauseReasonMeta(pauseForDay(d, pauses))
            bg = m.color + '22'; border = `1px dashed ${m.color}88`; title = `${d} • ${m.label.toLowerCase()} (zaplanowane)`
          } else {
            border = '1px dashed var(--border)'
          }
        } else if (isDone) {
          const kind = habitDayKind({ habit, dateStr: d, pauses, today, isDone: true })
          if (kind === 'done-paused') {
            // Zrobione, choć trwał wyjazd/choroba — wypełnienie jak zawsze,
            // ale obwódka w kolorze powodu, żeby było widać, że to nie był
            // zwykły dzień.
            const m = pauseReasonMeta(pauseForDay(d, pauses))
            bg = color; border = `2px solid ${m.color}`
            pauseRing = m.color
            title = `${d} • zrobione mimo: ${m.label.toLowerCase()}`
          } else {
            const bonus = kind === 'done-bonus'
            bg = bonus ? deep : color; border = `1px solid ${bonus ? deep : color}`
            title = `${d} • zrobione${bonus ? ' (dodatkowo)' : ''}`
          }
        } else if (status === 'paused') {
          const m = pauseReasonMeta(pauseForDay(d, pauses))
          bg = m.color + '33'; border = `1px solid ${m.color}66`; title = `${d} • ${m.label.toLowerCase()}`
        } else if (status === 'due') {
          border = '1px solid var(--border-strong)'; title = `${d} • pominięte`
        } else {
          border = '1px solid var(--border)'; title = `${d} • poza planem`
        }
        return (
          <div key={d} title={title} style={{
            width: cell, height: cell, borderRadius: radius, background: bg, border, boxSizing: 'border-box',
            boxShadow: [
              d === today ? '0 0 0 2px var(--warn)' : null,
              pauseRing ? `inset 0 0 0 1px ${pauseRing}` : null,
            ].filter(Boolean).join(', ') || 'none',
          }} />
        )
      })}
    </div>
  )
}
