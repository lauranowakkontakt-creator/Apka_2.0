// Czysta logika panelu „co się dzieje danego dnia" w Kalendarzu
// (patrz test/calendarDay.test.js). Wydarzenia przychodzą już rozwinięte
// z cykliczności (expandEvents w CalendarDashboard), więc tutaj operujemy
// na zwykłych datach 'yyyy-MM-dd'.

import { isMonthlyPaymentOn } from './paymentLogic.js'

// Wydarzenia obejmujące dany dzień — także wielodniowe (date..dateEnd).
export function eventsOnDate(events, dateStr) {
  return events.filter(e => dateStr >= e.date && dateStr <= (e.dateEnd || e.date))
}

export const todosOnDate = (todos, dateStr) =>
  todos.filter(t => t.dueDate === dateStr)

// Płatności miesięczne wypadają w konkretnym dniu miesiąca; ustawione na
// 29.–31. w krótszym miesiącu wypadają w jego ostatnim dniu. `date` to Date.
export const paymentsOnDate = (payments, date) =>
  payments.filter(p => isMonthlyPaymentOn(p, date))

// Wspólna kolejność pozycji dnia: najpierw z godziną (rosnąco), potem
// całodniowe. Przy równej godzinie decyduje typ (wydarzenie → zadanie →
// płatność), żeby lista nie skakała między renderami.
const KIND_RANK = { event: 0, todo: 1, payment: 2 }

export function sortDayItems(items) {
  return [...items].sort((a, b) =>
    (a.time ? 0 : 1) - (b.time ? 0 : 1) ||
    String(a.time || '').localeCompare(String(b.time || '')) ||
    (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9) ||
    String(a.title || '').localeCompare(String(b.title || ''))
  )
}

// Czy wydarzenie jest wielodniowe i który to dzień z kolei — do etykiety
// „dzień 2 z 5" w panelu.
export function spanInfo(event, dateStr) {
  if (!event.dateEnd || event.dateEnd === event.date) return null
  const day = (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 86400000)
  const total = day(event.dateEnd) - day(event.date) + 1
  const index = day(dateStr) - day(event.date) + 1
  if (index < 1 || index > total) return null
  return { index, total }
}

// Najbliższe wydarzenia PO danym dniu — pokazujemy je, gdy kliknięty dzień
// jest pusty, żeby kliknięcie zawsze coś dawało.
export function upcomingEvents(events, afterDateStr, limit = 3) {
  return [...events]
    .filter(e => e.date > afterDateStr)
    .sort((a, b) =>
      String(a.date).localeCompare(String(b.date)) ||
      (a.startTime ? 0 : 1) - (b.startTime ? 0 : 1) ||
      String(a.startTime || '').localeCompare(String(b.startTime || ''))
    )
    // to samo wydarzenie cykliczne pokazujemy raz — tylko najbliższe wystąpienie
    .filter((e, i, arr) => arr.findIndex(x => (x._baseId || x.id) === (e._baseId || e.id)) === i)
    .slice(0, limit)
}

// Ile dni dzieli dwie daty 'yyyy-MM-dd' (dodatnio = w przyszłość).
export function daysBetween(fromStr, toStr) {
  const day = (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 86400000)
  return day(toStr) - day(fromStr)
}
