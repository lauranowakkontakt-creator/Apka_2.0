// Czysta logika modułu Wspomnik — bez Firebase, testowalna w node
// (patrz test/wspomnikLogic.test.js). Operacje na Firestore są w WspomnikDashboard.
//
// Wspomnik to „kamień Ebenezer” (1 Sm 7,12): miejsce, gdzie zapisuje się,
// co Bóg zrobił — żeby nie zapomnieć i móc do tego wracać.
//
// Model danych: jeden dokument = jedno wydarzenie.
//   {
//     date: 'yyyy-MM-dd',   // kiedy to się stało (może być dawno temu)
//     title: string,        // co Bóg zrobił — jednym zdaniem
//     text: string,         // cała historia (opcjonalnie)
//     category: string|null,// rodzaj z CATEGORIES (opcjonalnie)
//     verse: string,        // słowo / werset, który się z tym wiąże (opcjonalnie)
//     createdAt: Timestamp, updatedAt?: Timestamp
//   }

import { normalize } from './notesLogic.js'

export const WSPOMNIK_COLLECTION = 'remembrances'

export const CATEGORIES = [
  { id: 'modlitwa',     label: 'Wysłuchana modlitwa' },
  { id: 'zaopatrzenie', label: 'Zaopatrzenie' },
  { id: 'uzdrowienie',  label: 'Uzdrowienie' },
  { id: 'prowadzenie',  label: 'Prowadzenie' },
  { id: 'ochrona',      label: 'Ochrona' },
  { id: 'przemiana',    label: 'Przemiana serca' },
  { id: 'slowo',        label: 'Słowo od Boga' },
  { id: 'inne',         label: 'Inne' },
]

export const categoryLabel = (id) => CATEGORIES.find(c => c.id === id)?.label || null

// `createdAt` bywa Timestampem Firestore (.toMillis), Datą albo niczym.
const ts = (v) => (typeof v?.toMillis === 'function' ? v.toMillis() : v instanceof Date ? v.getTime() : 0)

// Wpisy od najnowszego wydarzenia; przy tym samym dniu — później dodany wyżej.
export function sortEntries(entries) {
  return [...(entries || [])]
    .filter(e => e?.date)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : ts(b.createdAt) - ts(a.createdAt)))
}

// Szukanie po tytule, historii i wersecie — bez znaków diakrytycznych, żeby
// „modlitwa wysluchana” znalazło „modlitwa wysłuchana”.
export function filterEntries(entries, { search = '', category = null } = {}) {
  const q = normalize(String(search).trim())
  return (entries || []).filter(e => {
    if (category && e?.category !== category) return false
    if (!q) return true
    return normalize(`${e?.title || ''} ${e?.text || ''} ${e?.verse || ''}`).includes(q)
  })
}

// Grupy po roku (od najnowszego), w środku kolejność jak w sortEntries.
export function groupByYear(entries) {
  const map = new Map()
  for (const e of sortEntries(entries)) {
    const y = e.date.slice(0, 4)
    if (!map.has(y)) map.set(y, [])
    map.get(y).push(e)
  }
  return [...map.entries()].map(([year, items]) => ({ year, items }))
}

// Statystyki do kafelków — bez serii: to nie jest zadanie do odhaczania.
export function wspomnikStats(entries, today) {
  const list = entries || []
  const year = String(today).slice(0, 4)
  return {
    total: list.length,
    year: list.filter(e => String(e?.date || '').startsWith(year)).length,
    answered: list.filter(e => e?.category === 'modlitwa').length,
  }
}

// „Tego dnia”: wydarzenia z tym samym dniem i miesiącem w poprzednich latach.
// Każde dostaje `yearsAgo`, żeby dało się napisać „2 lata temu”.
export function onThisDay(entries, today) {
  const md = String(today).slice(5)
  const y = Number(String(today).slice(0, 4))
  return sortEntries(entries)
    .filter(e => e.date.slice(5) === md && e.date < today)
    .map(e => ({ ...e, yearsAgo: y - Number(e.date.slice(0, 4)) }))
}

// Polska odmiana: 1 rok, 2–4 lata, 5+ lat (ale 22–24 lata).
export function yearsAgoLabel(n) {
  if (n === 1) return 'rok temu'
  const d = n % 10, dd = n % 100
  const word = d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14) ? 'lata' : 'lat'
  return `${n} ${word} temu`
}

// „1 wspomnienie”, „3 wspomnienia”, „5 wspomnień”.
export function wspomnieniaWord(n) {
  if (n === 1) return 'wspomnienie'
  const d = n % 10, dd = n % 100
  return d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14) ? 'wspomnienia' : 'wspomnień'
}

// Dane z formularza → dokument do zapisu. Zwraca null, gdy brak tytułu.
export function buildEntry({ title, text, date, category, verse }) {
  const t = String(title || '').trim()
  if (!t) return null
  return {
    title: t,
    text: String(text || '').trim(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? date : null,
    category: CATEGORIES.some(c => c.id === category) ? category : null,
    verse: String(verse || '').trim(),
  }
}
