import { test } from 'node:test'
import assert from 'node:assert/strict'

const { expandEvents, recStep, RECURRENCE, RECUR_LABEL } =
  await import('../src/utils/calendarRecurrence.js')

const daty = (wynik) => wynik.map(e => e.date).sort()

test('wydarzenie bez cyklu przechodzi tylko, gdy wpada w zakres', () => {
  const ev = [{ id: 'a', date: '2026-09-10' }]
  assert.equal(expandEvents(ev, '2026-09-01', '2026-09-30').length, 1)
  assert.equal(expandEvents(ev, '2026-10-01', '2026-10-31').length, 0)
})

test('wydarzenie wielodniowe łapie się, gdy zaczęło się PRZED zakresem', () => {
  // Konferencja 28.08–02.09 musi być widoczna we wrześniu, mimo że zaczęła się
  // w sierpniu. Porównanie tylko po dacie startu by ją zgubiło.
  const ev = [{ id: 'a', date: '2026-08-28', dateEnd: '2026-09-02' }]
  assert.equal(expandEvents(ev, '2026-09-01', '2026-09-30').length, 1)
})

test('cykl dzienny daje wystąpienie na każdy dzień zakresu', () => {
  const ev = [{ id: 'a', date: '2026-09-01', recurrence: 'daily' }]
  const w = expandEvents(ev, '2026-09-01', '2026-09-07')
  assert.equal(w.length, 7)
  assert.equal(w[0].date, '2026-09-01')
  assert.equal(w.at(-1).date, '2026-09-07')
})

test('cykl tygodniowy trafia w ten sam dzień tygodnia', () => {
  const ev = [{ id: 'a', date: '2026-09-01', recurrence: 'weekly' }]  // wtorek
  assert.deepEqual(daty(expandEvents(ev, '2026-09-01', '2026-09-30')),
    ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29'])
})

test('cykl miesięczny i roczny', () => {
  const mies = [{ id: 'a', date: '2026-01-15', recurrence: 'monthly' }]
  assert.deepEqual(daty(expandEvents(mies, '2026-03-01', '2026-05-31')),
    ['2026-03-15', '2026-04-15', '2026-05-15'])

  const rok = [{ id: 'b', date: '2020-06-10', recurrence: 'yearly' }]
  assert.deepEqual(daty(expandEvents(rok, '2026-01-01', '2026-12-31')), ['2026-06-10'])
})

test('REGRESJA: codzienne wydarzenie sprzed lat nadal się pokazuje', () => {
  // Pętla szła krok po kroku od pierwszego wystąpienia z limitem 900 obrotów.
  // Wydarzenie codzienne sprzed ~2,5 roku wyczerpywało limit, ZANIM pętla
  // doszła do oglądanego miesiąca — i znikało z kalendarza bez śladu błędu.
  const ev = [{ id: 'a', date: '2019-01-01', recurrence: 'daily' }]
  const w = expandEvents(ev, '2026-09-01', '2026-09-30')
  assert.equal(w.length, 30, 'wydarzenie sprzed lat zgubione')
  assert.equal(w[0].date, '2026-09-01')
})

test('REGRESJA: tygodniowe i miesięczne sprzed wielu lat też', () => {
  const tyg = [{ id: 'a', date: '2015-01-06', recurrence: 'weekly' }]
  assert.ok(expandEvents(tyg, '2026-09-01', '2026-09-30').length >= 4)

  const mies = [{ id: 'b', date: '2010-03-15', recurrence: 'monthly' }]
  assert.deepEqual(daty(expandEvents(mies, '2026-09-01', '2026-09-30')), ['2026-09-15'])
})

test('recurUntil kończy serię', () => {
  const ev = [{ id: 'a', date: '2026-09-01', recurrence: 'daily', recurUntil: '2026-09-05' }]
  assert.equal(expandEvents(ev, '2026-09-01', '2026-09-30').length, 5)
})

test('recurUntil przed zakresem — brak wystąpień', () => {
  const ev = [{ id: 'a', date: '2020-01-01', recurrence: 'daily', recurUntil: '2020-02-01' }]
  assert.equal(expandEvents(ev, '2026-09-01', '2026-09-30').length, 0)
})

test('cykl nie produkuje wystąpień przed datą startu', () => {
  const ev = [{ id: 'a', date: '2026-09-20', recurrence: 'daily' }]
  const w = expandEvents(ev, '2026-09-01', '2026-09-30')
  assert.equal(w.length, 11)
  assert.equal(w[0].date, '2026-09-20')
})

test('cykliczne wystąpienia niosą _baseId i _recurring', () => {
  // Widok musi wiedzieć, że edycja dotyczy całej serii, a nie tego jednego dnia.
  const ev = [{ id: 'seria-1', date: '2026-09-01', recurrence: 'weekly' }]
  for (const w of expandEvents(ev, '2026-09-01', '2026-09-30')) {
    assert.equal(w._baseId, 'seria-1')
    assert.equal(w._recurring, true)
  }
})

test('wielodniowe cykliczne zachowuje długość w każdym wystąpieniu', () => {
  const ev = [{ id: 'a', date: '2026-09-01', dateEnd: '2026-09-03', recurrence: 'weekly' }]
  const w = expandEvents(ev, '2026-09-01', '2026-09-30')
  for (const x of w) {
    const dni = (new Date(x.dateEnd) - new Date(x.date)) / 86400000
    assert.equal(dni, 2)
  }
})

test('wielodniowe cykliczne łapie się końcem wchodzącym w zakres', () => {
  // Wystąpienie zaczyna się 30.08, kończy 01.09 — należy do września.
  const ev = [{ id: 'a', date: '2026-08-30', dateEnd: '2026-09-01', recurrence: 'monthly' }]
  const w = expandEvents(ev, '2026-09-01', '2026-09-30')
  assert.ok(w.some(x => x.date === '2026-08-30'), 'zgubione wystąpienie wchodzące końcem')
})

test('29 lutego przy cyklu rocznym nie gubi się w latach przestępnych', () => {
  const ev = [{ id: 'a', date: '2024-02-29', recurrence: 'yearly' }]
  assert.equal(expandEvents(ev, '2028-01-01', '2028-12-31').length, 1)
})

test('pusta lista i brak wydarzeń w zakresie', () => {
  assert.deepEqual(expandEvents([], '2026-09-01', '2026-09-30'), [])
})

test('recStep przesuwa o właściwy krok', () => {
  const d = new Date('2026-09-01T00:00:00')
  assert.equal(recStep(d, 'daily').getDate(), 2)
  assert.equal(recStep(d, 'weekly').getDate(), 8)
  assert.equal(recStep(d, 'monthly').getMonth(), 9)
  assert.equal(recStep(d, 'yearly').getFullYear(), 2027)
})

test('RECURRENCE i RECUR_LABEL pokrywają te same tryby', () => {
  const idy = RECURRENCE.map(r => r.id).filter(Boolean)
  assert.deepEqual(idy.sort(), Object.keys(RECUR_LABEL).sort())
})

test('cykl miesięczny z 31. dnia nie zsuwa się na 28. po lutym', () => {
  const ev = [{ id: 'a', date: '2026-01-31', recurrence: 'monthly' }]
  assert.deepEqual(expandEvents(ev, '2026-01-01', '2026-06-30').map(e => e.date),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30'])
})

test('to samo wystąpienie ma tę samą datę niezależnie od oglądanego zakresu', () => {
  const ev = [{ id: 'a', date: '2026-01-31', recurrence: 'monthly' }]
  assert.deepEqual(expandEvents(ev, '2026-05-01', '2026-05-31').map(e => e.date), ['2026-05-31'])
  assert.deepEqual(expandEvents(ev, '2027-03-01', '2027-03-31').map(e => e.date), ['2027-03-31'])
})

test('29 lutego co rok: w latach zwykłych 28 lutego, w przestępnych znów 29', () => {
  const ev = [{ id: 'a', date: '2024-02-29', recurrence: 'yearly' }]
  assert.deepEqual(expandEvents(ev, '2025-01-01', '2028-12-31').map(e => e.date),
    ['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'])
})
