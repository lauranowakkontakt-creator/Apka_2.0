import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  eventsOnDate, todosOnDate, paymentsOnDate, sortDayItems,
  spanInfo, upcomingEvents, daysBetween,
} from '../src/utils/calendarDay.js'

test('eventsOnDate — jednodniowe i wielodniowe obejmujące dzień', () => {
  const events = [
    { id: 'a', date: '2026-08-27' },
    { id: 'b', date: '2026-08-25', dateEnd: '2026-08-29' }, // trwa przez 27
    { id: 'c', date: '2026-08-28' },
    { id: 'd', date: '2026-08-20', dateEnd: '2026-08-26' }, // kończy się przed
  ]
  assert.deepEqual(eventsOnDate(events, '2026-08-27').map(e => e.id), ['a', 'b'])
  assert.deepEqual(eventsOnDate(events, '2026-08-29').map(e => e.id), ['b'])
  assert.deepEqual(eventsOnDate(events, '2026-08-30').map(e => e.id), [])
})

test('todosOnDate / paymentsOnDate', () => {
  const todos = [{ id: 1, dueDate: '2026-08-27' }, { id: 2, dueDate: '2026-08-28' }]
  assert.deepEqual(todosOnDate(todos, '2026-08-27').map(t => t.id), [1])
  const pmts = [{ id: 'p1', dayOfMonth: 10 }, { id: 'p2', dayOfMonth: 27 }, { id: 'p3' }]
  assert.deepEqual(paymentsOnDate(pmts, new Date(2026, 7, 27)).map(p => p.id), ['p2'])
  assert.deepEqual(paymentsOnDate(pmts, new Date(2026, 7, 1)).map(p => p.id), ['p3']) // brak pola = 1.
})

test('paymentsOnDate — 31. w krótkim miesiącu, zakres dat i częstotliwość', () => {
  const pmts = [
    { id: 'p31', dayOfMonth: 31 },
    { id: 'koniec', dayOfMonth: 28, dateTo: '2026-01-31' },
    { id: 'roczna', dayOfMonth: 28, frequency: 'yearly' },
  ]
  // luty 2026 ma 28 dni: płatność z 31. wypada 28.; zakończona i roczna nie
  assert.deepEqual(paymentsOnDate(pmts, new Date(2026, 1, 28)).map(p => p.id), ['p31'])
  assert.deepEqual(paymentsOnDate(pmts, new Date(2026, 2, 28)).map(p => p.id), [])
  assert.deepEqual(paymentsOnDate(pmts, new Date(2026, 2, 31)).map(p => p.id), ['p31'])
})

test('sortDayItems — z godziną najpierw, potem całodniowe', () => {
  const items = [
    { kind: 'todo',    title: 'zadanie', time: null },
    { kind: 'event',   title: 'obiad',   time: '14:00' },
    { kind: 'payment', title: 'czynsz',  time: null },
    { kind: 'event',   title: 'lekarz',  time: '09:30' },
  ]
  assert.deepEqual(sortDayItems(items).map(i => i.title), ['lekarz', 'obiad', 'zadanie', 'czynsz'])
})

test('sortDayItems — przy równej godzinie stabilnie wg typu', () => {
  const items = [
    { kind: 'payment', title: 'rata',  time: '08:00' },
    { kind: 'event',   title: 'msza',  time: '08:00' },
    { kind: 'todo',    title: 'kupic', time: '08:00' },
  ]
  assert.deepEqual(sortDayItems(items).map(i => i.title), ['msza', 'kupic', 'rata'])
})

test('spanInfo — który to dzień wielodniowego wydarzenia', () => {
  const e = { date: '2026-08-25', dateEnd: '2026-08-29' }
  assert.deepEqual(spanInfo(e, '2026-08-25'), { index: 1, total: 5 })
  assert.deepEqual(spanInfo(e, '2026-08-27'), { index: 3, total: 5 })
  assert.deepEqual(spanInfo(e, '2026-08-29'), { index: 5, total: 5 })
  assert.equal(spanInfo(e, '2026-08-30'), null)
  assert.equal(spanInfo({ date: '2026-08-25' }, '2026-08-25'), null)
})

test('spanInfo — działa przez zmianę czasu', () => {
  // ostatnia niedziela marca 2026 wypada 29.03
  assert.deepEqual(spanInfo({ date: '2026-03-27', dateEnd: '2026-03-31' }, '2026-03-30'), { index: 4, total: 5 })
})

test('upcomingEvents — najbliższe po dniu, po dacie i godzinie', () => {
  const events = [
    { id: 'past', date: '2026-08-20' },
    { id: 'c', date: '2026-09-01' },
    { id: 'a', date: '2026-08-28', startTime: '08:00' },
    { id: 'b', date: '2026-08-28' }, // całodniowe — po tych z godziną
  ]
  assert.deepEqual(upcomingEvents(events, '2026-08-27').map(e => e.id), ['a', 'b', 'c'])
  assert.deepEqual(upcomingEvents(events, '2026-08-27', 2).map(e => e.id), ['a', 'b'])
  assert.deepEqual(upcomingEvents(events, '2026-12-31'), [])
})

test('upcomingEvents — cykliczne tylko raz (najbliższe wystąpienie)', () => {
  const events = [
    { id: 'x1', _baseId: 'x', date: '2026-08-28' },
    { id: 'x2', _baseId: 'x', date: '2026-09-04' },
    { id: 'y',  date: '2026-08-30' },
  ]
  assert.deepEqual(upcomingEvents(events, '2026-08-27').map(e => e.id), ['x1', 'y'])
})

test('daysBetween — różnica dni, także przez zmianę czasu', () => {
  assert.equal(daysBetween('2026-08-27', '2026-08-28'), 1)
  assert.equal(daysBetween('2026-08-27', '2026-08-27'), 0)
  assert.equal(daysBetween('2026-08-28', '2026-08-27'), -1)
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2)
})
