// Prośba modlitewna: opis może być zwykłym tekstem albo listą do odhaczania
// (patrz test/prayerList.test.js).
//
// Model na dokumencie prośby:
//   noteMode: 'text' | 'list'
//   note: string                      — używane w trybie 'text'
//   checklist: [{ id, text }]         — używane w trybie 'list'
//   checklistDone: [id]               — odhaczone punkty
//
// Listę wpisuje się w polu tekstowym, jedna rzecz w linii. Przy zapisie
// dopasowujemy nowe linie do starych punktów po treści, żeby edycja jednej
// pozycji nie zdejmowała ptaszków z pozostałych.

export const NOTE_MODES = [
  { id: 'text', label: 'Opis' },
  { id: 'list', label: 'Lista' },
]

export const normalizeNoteMode = (v) => (v === 'list' ? 'list' : 'text')

const key = (s) => String(s || '').trim().toLowerCase()

// Tekst z pola → punkty listy. Puste linie i wiodące „-" / „•" wypadają,
// bo ludzie odruchowo piszą listy z myślnikami.
export function parseChecklist(input, previous = []) {
  const pool = [...(previous || [])]
  const out = []
  for (const raw of String(input || '').split('\n')) {
    const text = raw.replace(/^\s*[-•*]\s*/, '').trim()
    if (!text) continue
    // Ten sam tekst co wcześniej → zachowujemy id (a więc i ptaszek).
    const i = pool.findIndex(p => key(p.text) === key(text))
    if (i !== -1) {
      out.push({ id: pool[i].id, text })
      pool.splice(i, 1)
    } else {
      out.push({ id: `${Date.now().toString(36)}-${out.length}-${Math.random().toString(36).slice(2, 7)}`, text })
    }
  }
  return out
}

export const checklistToText = (items = []) => items.map(i => i.text).join('\n')

export function toggleChecked(doneIds = [], id) {
  const list = doneIds || []
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id]
}

// Po edycji listy odhaczenia skasowanych punktów muszą zniknąć — inaczej
// licznik „3 z 2" zaczyna kłamać.
export function pruneDone(items = [], doneIds = []) {
  const ids = new Set(items.map(i => i.id))
  return (doneIds || []).filter(id => ids.has(id))
}

export function checklistProgress(items = [], doneIds = []) {
  const total = items.length
  const done = pruneDone(items, doneIds).length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

// Podsumowanie listy do jednej linijki — do kart i podglądów.
export function checklistSummary(items = [], doneIds = []) {
  const { done, total } = checklistProgress(items, doneIds)
  return total ? `${done} z ${total}` : ''
}

// Czy prośba ma pokazać listę zamiast opisu.
export const hasChecklist = (item) =>
  normalizeNoteMode(item?.noteMode) === 'list' && (item?.checklist || []).length > 0

/** „wczoraj”, „3 dni temu” — bez „1 dni temu”. Dla 0 i braku danych: ''. */
export function dniTemu(n) {
  if (n == null || n <= 0) return ''
  return n === 1 ? 'wczoraj' : `${n} dni temu`
}
