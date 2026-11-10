import { addDays, addWeeks, addMonths, parseISO, isPast, isToday, isWithinInterval } from 'date-fns'

// Czysta logika modułu To-do: konfiguracja i klasyfikacja zadań.
// Wydzielone z TodoDashboard.jsx, żeby dało się to sprawdzić testem —
// zwłaszcza granice „po terminie" kontra „na dziś", które łatwo pomylić.

export const PRIORITY = [
  { id: 'high',   label: 'Wysoki', color: '#E53935' },
  { id: 'medium', label: 'Średni', color: '#FB8C00' },
  { id: 'low',    label: 'Niski',  color: '#43A047' },
]

// Kolejność sortowania priorytetów. Zadania bez priorytetu lądują na końcu
// (99), a nie na początku — brak priorytetu nie znaczy „najważniejsze".
export const pOrder = { high: 0, medium: 1, low: 2 }
export const priorytetDoSortu = (p) => pOrder[p] ?? 99

export const RECURRENCE = [
  { id: '',        label: 'Brak' },
  { id: 'daily',   label: 'Codziennie' },
  { id: 'weekly',  label: 'Co tydzień' },
  { id: 'monthly', label: 'Co miesiąc' },
]

// Kolejny termin po odhaczeniu zadania cyklicznego.
export const nextOccurrence = (base, rec) =>
  rec === 'daily' ? addDays(base, 1)
  : rec === 'weekly' ? addWeeks(base, 1)
  : addMonths(base, 1)

// Kolejny termin zadania cyklicznego, który wypada PO dzisiejszym dniu.
// Zaległe zadanie „codziennie" sprzed dwóch tygodni po odhaczeniu przeskakuje
// od razu na jutro, zamiast zostawać zaległe na kolejne 13 kliknięć.
// Rytm zostaje zachowany: zadanie „co tydzień" z poniedziałku wraca w poniedziałek.
export function nextOccurrenceAfter(base, rec, today = new Date()) {
  const dzis = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let next = nextOccurrence(base, rec)
  for (let i = 0; next <= dzis && i < 5000; i++) next = nextOccurrence(next, rec)
  return next
}

export const zadaniaAktywne = (todos) => todos.filter(t => !t.done)

/**
 * Zadania po terminie. Dzisiejsze NIE liczą się jako przeterminowane, mimo że
 * `isPast` na dacie bez godziny zwraca dla nich prawdę (północ już minęła) —
 * stąd dodatkowy warunek `!isToday`. Bez niego wszystko, co ma termin na dziś,
 * pokazywałoby się rano jako zaległe.
 */
export const zadaniaPoTerminie = (todos) =>
  zadaniaAktywne(todos).filter(t => t.dueDate && isPast(parseISO(t.dueDate)) && !isToday(parseISO(t.dueDate)))

export const zadaniaNaDzis = (todos) =>
  zadaniaAktywne(todos).filter(t => t.dueDate && isToday(parseISO(t.dueDate)))

// Daty z Firestore bywają Timestampem, a po imporcie kopii zwykłym stringiem.
// Jedno miejsce, które radzi sobie z obiema postaciami.
export function naDate(wartosc) {
  if (!wartosc) return null
  if (typeof wartosc.toDate === 'function') return wartosc.toDate()
  const d = new Date(wartosc)
  return Number.isNaN(d.getTime()) ? null : d
}

// Ukończone zadania od najświeżej odhaczonych. Wpisy bez `doneAt` — starsze
// zadania i te z importu kopii — lądują na końcu, zamiast wypływać na górę.
export const zadaniaUkonczone = (todos) =>
  todos.filter(t => t.done)
    .sort((a, b) => (naDate(b.doneAt)?.getTime() ?? 0) - (naDate(a.doneAt)?.getTime() ?? 0))

/**
 * Podsumowanie zadań w zakresie czasu.
 *
 * Uwaga o `procentUkonczenia`: mianownikiem są zadania zrobione w okresie PLUS
 * wszystkie aktywne — również te spoza okresu. To zachowanie przeniesione
 * jeden do jednego z poprzedniej wersji; liczba odpowiada raczej na pytanie
 * „ile z tego, co mam na głowie, udało się domknąć", niż na „ile procent
 * zadań z tego miesiąca zrobiłam".
 */
export function statystykiOkresu(todos, zakres) {
  const aktywne = zadaniaAktywne(todos)

  const zrobioneWOkresie = todos.filter(t => {
    if (!t.done || !t.doneAt) return false
    const d = naDate(t.doneAt)
    return d ? isWithinInterval(d, zakres) : false
  })

  const wszystkieWOkresie = todos.filter(t => {
    const utworzone = naDate(t.createdAt)
    return utworzone ? utworzone <= zakres.end : false
  }).length

  const mianownik = Math.max(zrobioneWOkresie.length + aktywne.length, 1)
  const procentUkonczenia = wszystkieWOkresie > 0
    ? Math.round((zrobioneWOkresie.length / mianownik) * 100)
    : 0

  return { zrobioneWOkresie, wszystkieWOkresie, procentUkonczenia }
}
