// Krąg osoby: „bliscy" (domyślnie) albo „dalsi". Osoby z dalszego kręgu nie pokazują się
// na głównej liście w Osobach, ale zostają w bazie i we wszystkich modułach (sny, kalendarz…).
// Czysta logika bez Firebase — zapis robi people.js.

export const CIRCLES = [
  { id: 'close', label: 'Bliscy' },
  { id: 'far',   label: 'Dalsi' },
]

// Brak pola (osoby sprzed tej funkcji) = bliscy, więc nic nie znika po aktualizacji.
export const circleOf = (p) => (p?.circle === 'far' ? 'far' : 'close')

// Bez ogonków i wielkości liter, żeby „zosia" znalazło „Zośka".
const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')

// Szukanie po imieniu, ksywkach i opisie.
export const matchesQuery = (p, q) => {
  const t = plain(q).trim()
  if (!t) return true
  return plain([p.name, ...(p.aliases || []), p.note].join(' ')).includes(t)
}

// circle: 'close' | 'far' | 'all'. Wpisane wyszukiwanie przeszukuje WSZYSTKICH,
// żeby dalszą osobę dało się znaleźć bez przełączania zakładki.
export function visiblePeople(people, { circle = 'close', q = '' } = {}) {
  const searching = !!plain(q).trim()
  return people.filter(p => matchesQuery(p, q) && (searching || circle === 'all' || circleOf(p) === circle))
}

export function circleCounts(people) {
  const c = { close: 0, far: 0, all: people.length }
  for (const p of people) c[circleOf(p)]++
  return c
}
