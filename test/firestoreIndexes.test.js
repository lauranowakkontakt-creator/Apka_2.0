import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// Firestore nie umie sam obsłużyć zapytania, które filtruje po jednym polu,
// a sortuje po innym — bez indeksu złożonego onSnapshot wywala się z kodem
// failed-precondition. To błąd TRWAŁY: ponawianie go nie naprawi, więc moduł
// zostaje z banerem „Nie udało się pobrać części danych" do przeładowania.
//
// Tak właśnie padła historia pojedynczego konta (where accountId + orderBy date).
// Ten test pilnuje, żeby każde takie zapytanie miało swój indeks w
// firestore.indexes.json — inaczej regresja wychodzi dopiero na telefonie.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const INDEKSY = JSON.parse(readFileSync(join(ROOT, 'firestore.indexes.json'), 'utf8'))

function zrodlaSrc(katalog = join(ROOT, 'src')) {
  const wynik = []
  for (const nazwa of readdirSync(katalog)) {
    const p = join(katalog, nazwa)
    if (statSync(p).isDirectory()) wynik.push(...zrodlaSrc(p))
    else if (/\.jsx?$/.test(nazwa)) wynik.push(p)
  }
  return wynik
}

// Wycina treść wywołania query(...) licząc nawiasy — regex nie wystarczy,
// bo w środku siedzą kolejne wywołania z własnymi nawiasami.
function wywolaniaQuery(kod) {
  const wynik = []
  for (let i = kod.indexOf('query('); i !== -1; i = kod.indexOf('query(', i + 1)) {
    if (/[\w.]/.test(kod[i - 1] || '')) continue // np. subQuery(
    let glebokosc = 0
    for (let j = i + 5; j < kod.length; j++) {
      if (kod[j] === '(') glebokosc++
      else if (kod[j] === ')' && --glebokosc === 0) { wynik.push(kod.slice(i + 6, j)); break }
    }
  }
  return wynik
}

const KIERUNEK = { asc: 'ASCENDING', desc: 'DESCENDING' }

function opiszZapytanie(tresc) {
  const sciezka = [...tresc.matchAll(/'([^']+)'/g)].map(m => m[1])
  const kolekcja = tresc.match(/collection\([^)]*'([^']+)'\s*\)/)?.[1]
    ?? sciezka[sciezka.length - 1]
  const filtry = [...tresc.matchAll(/where\(\s*'([^']+)'\s*,\s*'([^']+)'/g)]
    .map(m => ({ pole: m[1], operator: m[2] }))
  const sortowania = [...tresc.matchAll(/orderBy\(\s*'([^']+)'(?:\s*,\s*'(asc|desc)')?/g)]
    .map(m => ({ pole: m[1], kierunek: KIERUNEK[m[2] || 'asc'] }))
  return { kolekcja, filtry, sortowania }
}

// Indeks złożony jest potrzebny, gdy zapytanie filtruje po innym polu niż
// sortuje. Sam zakres po polu sortowania (date >= … + orderBy date) obsługuje
// indeks pojedynczy, który Firestore tworzy automatycznie.
function wymaganyIndeks({ kolekcja, filtry, sortowania }) {
  if (!kolekcja || !sortowania.length) return null
  const rownosci = filtry.filter(f => f.operator === '==').map(f => f.pole)
  const inne = filtry.filter(f => !sortowania.some(s => s.pole === f.pole)).map(f => f.pole)
  if (!inne.length) return null
  const pola = [
    ...[...new Set([...rownosci, ...inne])].map(pole => ({ fieldPath: pole, order: 'ASCENDING' })),
    ...sortowania.map(s => ({ fieldPath: s.pole, order: s.kierunek })),
  ]
  return { kolekcja, pola }
}

function jestZadeklarowany({ kolekcja, pola }) {
  return (INDEKSY.indexes || []).some(idx =>
    idx.collectionGroup === kolekcja &&
    pola.every((p, i) => idx.fields[i]?.fieldPath === p.fieldPath && idx.fields[i]?.order === p.order))
}

test('każde zapytanie z filtrem po innym polu niż sortowanie ma indeks', () => {
  const braki = []
  for (const plik of zrodlaSrc()) {
    for (const tresc of wywolaniaQuery(readFileSync(plik, 'utf8'))) {
      const potrzebny = wymaganyIndeks(opiszZapytanie(tresc))
      if (potrzebny && !jestZadeklarowany(potrzebny)) {
        braki.push(`${relative(ROOT, plik)}: ${potrzebny.kolekcja} [${potrzebny.pola.map(p => `${p.fieldPath} ${p.order}`).join(', ')}]`)
      }
    }
  }
  assert.deepEqual(braki, [], `brak indeksów w firestore.indexes.json:\n${braki.join('\n')}`)
})

test('historia pojedynczego konta ma swój indeks (accountId + date)', () => {
  assert.ok(jestZadeklarowany({
    kolekcja: 'transactions',
    pola: [{ fieldPath: 'accountId', order: 'ASCENDING' }, { fieldPath: 'date', order: 'DESCENDING' }],
  }), 'bez tego indeksu historia konta wywala się na failed-precondition')
})

test('historia konta nie zależy od indeksu złożonego', () => {
  // Wdrożenie strony nie wgrywa indeksów do Firebase, więc zapytanie
  // „accountId + orderBy date” padało na telefonie z banerem (accounts).
  const kod = readFileSync(join(ROOT, 'src/components/budget/AccountsView.jsx'), 'utf8')
  const historia = wywolaniaQuery(kod).filter(q => /'transactions'/.test(q))
  assert.ok(historia.length > 0, 'nie znaleziono zapytania o transakcje konta')
  for (const q of historia) assert.ok(!/orderBy\(/.test(q), `zapytanie znów sortuje w bazie: ${q}`)
})
