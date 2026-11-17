// Czysta logika powiązań osób z innymi modułami (długi, zadania).
// Bez Firebase, żeby dała się testować.
//
// Dług (kolekcja `debtors`) może mieć `personId` wskazujący na osobę z bazy
// `calendarPeople`. Zadanie (kolekcja `todos`) może mieć listę `peopleIds`.

// Długi powiązane z daną osobą.
export function debtsForPerson(debts, personId) {
  if (!personId) return []
  return (debts || []).filter(d => d.personId === personId)
}

// Podsumowanie kwot dla listy długów — liczymy tylko nierozliczone.
//   theyOwe — ktoś jest winien mnie
//   iOwe    — ja jestem winna
//   net     — saldo (dodatnie = na moją korzyść)
export function debtSummary(debts) {
  const active = (debts || []).filter(d => !d.settled)
  const theyOwe = active.filter(d => d.direction === 'theyOwe').reduce((s, d) => s + (d.amount || 0), 0)
  const iOwe    = active.filter(d => d.direction === 'iOwe').reduce((s, d) => s + (d.amount || 0), 0)
  return { theyOwe, iOwe, net: theyOwe - iOwe }
}

// Zadania dotyczące danej osoby.
export function todosForPerson(todos, personId) {
  if (!personId) return []
  return (todos || []).filter(t => (t.peopleIds || []).includes(personId))
}

// Zliczenie aktywnych powiązań per osoba — do etykiet w bazie osób.
export function linkCountsByPerson(people, debts, todos) {
  const m = {}
  ;(people || []).forEach(p => { m[p.id] = { debts: 0, todos: 0 } })
  ;(debts || []).forEach(d => {
    if (!d.settled && d.personId && m[d.personId]) m[d.personId].debts++
  })
  ;(todos || []).forEach(t => {
    if (t.done) return
    ;(t.peopleIds || []).forEach(pid => { if (m[pid]) m[pid].todos++ })
  })
  return m
}

// Bez ogonków i wielkości liter — „zośka” = „Zośka”, „lukasz” = „Łukasz”.
const plain = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')

// Osoby do wyboru przy długu: bliscy przed dalszymi, częściej w długach wyżej,
// dalej alfabetycznie.
export function osobyDoDlugow(people, debts) {
  const ile = {}
  for (const d of debts || []) if (d?.personId) ile[d.personId] = (ile[d.personId] || 0) + 1
  const dalszy = (p) => (p?.circle === 'far' ? 1 : 0)
  return [...(people || [])].sort((a, b) =>
    dalszy(a) - dalszy(b) ||
    (ile[b.id] || 0) - (ile[a.id] || 0) ||
    String(a.name || '').localeCompare(String(b.name || ''), 'pl'))
}

export const pasujeDoSzukania = (p, q) => {
  const t = plain(q)
  return !t || plain([p?.name, ...(p?.aliases || [])].join(' ')).includes(t)
}

// Imię wpisane ręcznie, które jest dokładnie imieniem (albo ksywką) jednej
// osoby z bazy → id tej osoby. Przy dwóch pasujących nie zgadujemy.
export function dopasujOsobe(people, name) {
  const t = plain(name)
  if (!t) return null
  const hit = (people || []).filter(p => [p?.name, ...(p?.aliases || [])].some(x => plain(x) === t))
  return hit.length === 1 ? hit[0].id : null
}
