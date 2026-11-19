import { test } from 'node:test'
import assert from 'node:assert/strict'

const {
  PRIORITY, RECURRENCE, pOrder, priorytetDoSortu, nextOccurrence,
  zadaniaAktywne, zadaniaPoTerminie, zadaniaNaDzis, naDate, statystykiOkresu,
  zadaniaUkonczone,
} = await import('../src/utils/todoLogic.js')

const dzis = new Date()

// Data LOKALNA, nie toISOString(). Ten drugi daje UTC, więc uruchomiony
// wieczorem albo nad ranem zwraca sąsiedni dzień i testy „dziś / wczoraj"
// wywalają się zależnie od godziny. Kod produkcyjny porównuje daty lokalnie.
const iso = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const przesun = (dni) => {
  const d = new Date(dzis); d.setDate(d.getDate() + dni); return iso(d)
}

test('PRIORITY — unikalne id, komplet pól', () => {
  const idy = PRIORITY.map(p => p.id)
  assert.deepEqual(idy, ['high', 'medium', 'low'])
  for (const p of PRIORITY) assert.ok(p.label && p.color)
})

test('priorytetDoSortu — brak priorytetu ląduje na końcu, nie na początku', () => {
  assert.equal(priorytetDoSortu('high'), 0)
  assert.equal(priorytetDoSortu('low'), 2)
  assert.equal(priorytetDoSortu(undefined), 99)
  assert.equal(priorytetDoSortu('cokolwiek'), 99)
  // Każdy priorytet z listy musi mieć swoją pozycję.
  for (const p of PRIORITY) assert.ok(pOrder[p.id] !== undefined)
})

test('nextOccurrence — przesuwa o właściwy krok', () => {
  const b = new Date('2026-09-01T00:00:00')
  assert.equal(nextOccurrence(b, 'daily').getDate(), 2)
  assert.equal(nextOccurrence(b, 'weekly').getDate(), 8)
  assert.equal(nextOccurrence(b, 'monthly').getMonth(), 9)
})

test('RECURRENCE zawiera opcję „brak"', () => {
  assert.ok(RECURRENCE.some(r => r.id === ''))
})

test('zadaniaAktywne pomija odhaczone', () => {
  const t = [{ id: 1, done: true }, { id: 2 }, { id: 3, done: false }]
  assert.deepEqual(zadaniaAktywne(t).map(x => x.id), [2, 3])
})

test('zadanie z terminem NA DZIŚ nie jest przeterminowane', () => {
  // Klasyczna pomyłka: isPast na dacie bez godziny zwraca prawdę dla dzisiaj
  // (północ już minęła), więc bez dodatkowego warunku wszystko z terminem
  // na dziś świeciłoby rano jako zaległe.
  const todos = [{ id: 'dzis', dueDate: iso(dzis) }]
  assert.equal(zadaniaPoTerminie(todos).length, 0)
  assert.equal(zadaniaNaDzis(todos).length, 1)
})

test('zadanie z wczorajszym terminem jest przeterminowane', () => {
  const todos = [{ id: 'wczoraj', dueDate: przesun(-1) }]
  assert.equal(zadaniaPoTerminie(todos).length, 1)
  assert.equal(zadaniaNaDzis(todos).length, 0)
})

test('zadanie przyszłe nie jest ani zaległe, ani na dziś', () => {
  const todos = [{ id: 'jutro', dueDate: przesun(1) }]
  assert.equal(zadaniaPoTerminie(todos).length, 0)
  assert.equal(zadaniaNaDzis(todos).length, 0)
})

test('odhaczone zadanie po terminie nie liczy się jako zaległe', () => {
  const todos = [{ id: 'x', dueDate: przesun(-5), done: true }]
  assert.equal(zadaniaPoTerminie(todos).length, 0)
})

test('zadanie bez terminu nie trafia do żadnej z grup', () => {
  const todos = [{ id: 'x' }]
  assert.equal(zadaniaPoTerminie(todos).length, 0)
  assert.equal(zadaniaNaDzis(todos).length, 0)
})

test('naDate radzi sobie z Timestampem i ze stringiem', () => {
  // Firestore daje Timestamp, ale po imporcie kopii w polu bywa zwykły string.
  const d = new Date('2026-09-01T10:00:00')
  assert.equal(naDate({ toDate: () => d }).getTime(), d.getTime())
  assert.equal(naDate('2026-09-01T10:00:00').getTime(), d.getTime())
  assert.equal(naDate(null), null)
  assert.equal(naDate('to nie data'), null)
})

test('statystykiOkresu — liczy zrobione w zakresie', () => {
  const zakres = { start: new Date('2026-09-01'), end: new Date('2026-09-30T23:59') }
  const todos = [
    { id: 1, done: true, doneAt: '2026-09-10', createdAt: '2026-09-01' },
    { id: 2, done: true, doneAt: '2026-08-10', createdAt: '2026-08-01' },  // poza zakresem
    { id: 3, createdAt: '2026-09-05' },                                     // aktywne
  ]
  const s = statystykiOkresu(todos, zakres)
  assert.equal(s.zrobioneWOkresie.length, 1)
  assert.equal(s.wszystkieWOkresie, 3)
  assert.equal(s.procentUkonczenia, 50)   // 1 zrobione / (1 + 1 aktywne)
})

test('statystykiOkresu — zadanie zrobione bez doneAt nie liczy się do okresu', () => {
  const zakres = { start: new Date('2026-09-01'), end: new Date('2026-09-30') }
  const s = statystykiOkresu([{ id: 1, done: true, createdAt: '2026-09-01' }], zakres)
  assert.equal(s.zrobioneWOkresie.length, 0)
})

test('statystykiOkresu — pusta lista nie dzieli przez zero', () => {
  const zakres = { start: new Date('2026-09-01'), end: new Date('2026-09-30') }
  const s = statystykiOkresu([], zakres)
  assert.equal(s.procentUkonczenia, 0)
  assert.equal(s.wszystkieWOkresie, 0)
})

test('zadaniaUkonczone — tylko odhaczone, od najświeższych', () => {
  const todos = [
    { id: 'stare',  done: true, doneAt: '2026-09-01T10:00:00' },
    { id: 'nowe',   done: true, doneAt: '2026-09-05T10:00:00' },
    { id: 'aktywne' },
  ]
  assert.deepEqual(zadaniaUkonczone(todos).map(t => t.id), ['nowe', 'stare'])
})

test('zadaniaUkonczone — wpis bez doneAt ląduje na końcu, nie na górze', () => {
  // Zadania sprzed dopisania doneAt i te z importu kopii nie mają tej daty.
  const todos = [
    { id: 'bezDaty', done: true },
    { id: 'zDatą',   done: true, doneAt: { toDate: () => new Date('2026-09-05T10:00:00') } },
  ]
  assert.deepEqual(zadaniaUkonczone(todos).map(t => t.id), ['zDatą', 'bezDaty'])
})

test('zadaniaUkonczone nie rusza tablicy wejściowej', () => {
  const todos = [
    { id: 'a', done: true, doneAt: '2026-09-01T10:00:00' },
    { id: 'b', done: true, doneAt: '2026-09-05T10:00:00' },
  ]
  zadaniaUkonczone(todos)
  assert.deepEqual(todos.map(t => t.id), ['a', 'b'])
})

test('osobyDoWyboru: bliscy przed dalszymi, potem wg liczby zadań i alfabetu', async () => {
  const { osobyDoWyboru } = await import('../src/utils/todoLogic.js')
  const people = [
    { id: 'z', name: 'Zosia', circle: 'far' },
    { id: 'a', name: 'Ania' },
    { id: 'b', name: 'Basia', circle: 'close' },
    { id: 'c', name: 'Celina' },
  ]
  const todos = [{ peopleIds: ['c'] }, { peopleIds: ['c', 'z'] }, { peopleIds: ['z'] }, { peopleIds: ['z'] }]
  assert.deepEqual(osobyDoWyboru(people, todos).map(p => p.id), ['c', 'a', 'b', 'z'])
  assert.deepEqual(osobyDoWyboru([]), [])
})

const { posortujListy, przesunListe } = await import('../src/utils/todoLogic.js')

test('posortujListy: ustawiona kolejność; stare listy bez niej w kolejności dodania, nowa na końcu', () => {
  assert.deepEqual(posortujListy([{ id: 'a', order: 2 }, { id: 'b', order: 0 }, { id: 'c', order: 1 }]).map(x => x.id), ['b', 'c', 'a'])
  // dwie stare listy + nowa z order = 2
  assert.deepEqual(posortujListy([{ id: 'a' }, { id: 'b' }, { id: 'c', order: 2 }]).map(x => x.id), ['a', 'b', 'c'])
})

test('przesunListe: zamienia sąsiadów i zapisuje tylko to, co się zmieniło', () => {
  const l = [{ id: 'a', order: 0 }, { id: 'b', order: 1 }, { id: 'c', order: 2 }]
  assert.deepEqual(przesunListe(l, 'c', -1), [{ id: 'c', order: 1 }, { id: 'b', order: 2 }])
  assert.deepEqual(przesunListe(l, 'a', -1), [])
  assert.deepEqual(przesunListe(l, 'c', 1), [])
  // Stare listy bez `order` dostają kolejność przy pierwszym przesunięciu.
  assert.deepEqual(przesunListe([{ id: 'a' }, { id: 'b' }], 'b', -1), [{ id: 'b', order: 0 }, { id: 'a', order: 1 }])
})
