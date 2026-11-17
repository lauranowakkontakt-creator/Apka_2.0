import { differenceInDays, parseISO } from 'date-fns'
// Paleta osób jest wspólna dla modułów — jedno źródło w utils/people.js.
export { PERSON_COLORS } from './personColors.js'

// Czysta logika modułu Modlitwa: konfiguracja i liczenie statystyk.
//
// Wydzielone z PrayerDashboard.jsx, bo dawało się to policzyć z samych danych
// wejściowych — a więc i przetestować bez przeglądarki i bez Firestore.
// W komponencie te same reguły siedziały wewnątrz useMemo i nie było jak
// sprawdzić żadnego przypadku brzegowego.

export const PRIORITY_CFG = [
  { v: 5, label: 'Pilna',   color: '#ef4444' },
  { v: 4, label: 'Wysoka',  color: '#f97316' },
  { v: 3, label: 'Średnia', color: '#f59e0b' },
  { v: 2, label: 'Niska',   color: '#3b82f6' },
  { v: 1, label: 'Mała',    color: '#9E9E9E' },
]

// Jak dawno modlono się w danej intencji — od „niedawno" do „zapomniana".
// Progi są w dniach i muszą się stykać bez dziur, inaczej getNeglect wpadałby
// w wariant awaryjny dla dnia pomiędzy przedziałami.
export const NEGLECT_LEVELS = [
  { min: 0,  max: 2,    level: 1, label: 'niedawno',     color: '#22c55e' },
  { min: 3,  max: 6,    level: 2, label: 'trochę dawno', color: '#eab308' },
  { min: 7,  max: 13,   level: 3, label: 'kilka dni',    color: '#f59e0b' },
  { min: 14, max: 29,   level: 4, label: 'dawno',        color: '#f97316' },
  { min: 30, max: 9999, level: 5, label: 'zapomniana',   color: '#ef4444' },
]

export const findPrio = (v) => PRIORITY_CFG.find(p => p.v === v) || PRIORITY_CFG[2]

// null (nigdy się nie modlono) to nie to samo co 0 dni — dlatego osobny
// wariant, a nie wpadnięcie w najwyższy przedział przez przypadek.
export function getNeglect(days) {
  if (days === null || days === undefined) {
    return { level: 5, label: 'nigdy', color: '#ef4444' }
  }
  return NEGLECT_LEVELS.find(l => days >= l.min && days <= l.max) || NEGLECT_LEVELS[4]
}

// Ile dni minęło od ostatniej daty na liście. Daty są w formacie yyyy-MM-dd,
// więc sortowanie leksykalne = sortowanie chronologiczne.
export function daysSince(dates, teraz = new Date()) {
  if (!dates?.length) return null
  const ostatnia = [...dates].sort().reverse()[0]
  return differenceInDays(teraz, parseISO(ostatnia))
}

const jestAktywna = (i) => i.status === 'active' || !i.status

/**
 * Podsumowanie „w liczbach" dla okresu wskazanego prefiksem daty:
 * '2026-09' (miesiąc) albo '2026' (rok).
 *
 * Rozróżnienie, które łatwo przeoczyć: „Dni modlitwy" liczy UNIKALNE daty,
 * a „Modlitw" wszystkie wpisy. Trzy intencje odhaczone tego samego dnia to
 * jeden dzień modlitwy i trzy modlitwy.
 */
export function podsumowanieOkresu(intentions, prefiks) {
  const wszystkieDaty = intentions.flatMap(i => i.prayedDates || [])
  const wOkresie = wszystkieDaty.filter(d => d.startsWith(prefiks))

  const osoby = new Set(
    intentions
      .filter(i => (i.prayedDates || []).some(d => d.startsWith(prefiks)))
      .map(i => i.personId)
  )

  return [
    { label: 'Dni modlitwy', value: new Set(wOkresie).size },
    { label: 'Modlitw',      value: wOkresie.length },
    { label: 'Za osoby',     value: osoby.size },
    { label: 'Aktywne',      value: intentions.filter(jestAktywna).length },
  ]
}

/**
 * Statystyki per osoba, posortowane tak, żeby na górze były osoby najbardziej
 * zaniedbane, a te odhaczone dzisiaj spadły na sam dół — lista ma podpowiadać,
 * za kogo modlić się teraz, a nie chwalić za to, co już zrobione.
 *
 * Osoba, za którą nigdy się nie modlono (days === null), traktowana jest jako
 * skrajnie zaniedbana (999), więc ląduje na samej górze.
 */
export function statystykiOsob(people, intentions, dzisiaj, teraz = new Date()) {
  return people
    .map(p => {
      const moje = intentions.filter(i => i.personId === p.id)
      const daty = moje.flatMap(i => i.prayedDates || [])
      return {
        ...p,
        totalPrays: daty.length,
        totalIntentions: moje.length,
        // Zaplanowane na później (okno jeszcze się nie zaczęło) nie są zaległe.
        activeCount: moje.filter(i => jestAktywna(i) && !(i.scheduleFrom && i.scheduleFrom > dzisiaj)).length,
        days: daysSince(daty, teraz),
        prayedToday: daty.includes(dzisiaj),
      }
    })
    .sort((a, b) => {
      if (a.prayedToday && !b.prayedToday) return 1
      if (!a.prayedToday && b.prayedToday) return -1
      return (b.days ?? 999) - (a.days ?? 999)
    })
}
