import { test } from 'node:test'
import assert from 'node:assert/strict'
import { periodKey, isPaymentActive, isPaymentDue, dueDayInMonth, isMonthlyPaymentOn } from '../src/utils/paymentLogic.js'

test('periodKey — format yyyy-MM', () => {
  assert.equal(periodKey(new Date(2026, 6, 5)), '2026-07')
  assert.equal(periodKey(new Date(2026, 0, 1)), '2026-01')
  assert.match(periodKey(), /^\d{4}-\d{2}$/)
})

test('isPaymentActive — bez zakresu dat zawsze aktywna', () => {
  assert.equal(isPaymentActive({}), true)
})

test('isPaymentActive — przed dateFrom nieaktywna, od dateFrom aktywna', () => {
  const p = { dateFrom: '2026-07-10' }
  assert.equal(isPaymentActive(p, new Date(2026, 6, 9)), false)
  assert.equal(isPaymentActive(p, new Date(2026, 6, 10)), true)
  assert.equal(isPaymentActive(p, new Date(2026, 6, 11)), true)
})

test('isPaymentActive — po dateTo nieaktywna, w dniu dateTo jeszcze aktywna', () => {
  const p = { dateTo: '2026-07-10' }
  assert.equal(isPaymentActive(p, new Date(2026, 6, 10)), true)
  assert.equal(isPaymentActive(p, new Date(2026, 6, 11)), false)
})

test('isPaymentDue — okres już zaksięgowany blokuje', () => {
  const p = { donePeriods: ['2026-07'] }
  assert.equal(isPaymentDue(p, '2026-07', new Date(2026, 6, 5)), false)
  assert.equal(isPaymentDue(p, '2026-08', new Date(2026, 7, 5)), true)
})

test('isPaymentDue — miesięczna czeka na dayOfMonth', () => {
  const p = { frequency: 'monthly', dayOfMonth: 15 }
  assert.equal(isPaymentDue(p, '2026-07', new Date(2026, 6, 14)), false)
  assert.equal(isPaymentDue(p, '2026-07', new Date(2026, 6, 15)), true)
  assert.equal(isPaymentDue(p, '2026-07', new Date(2026, 6, 20)), true)
})

test('isPaymentDue — miesięczna bez dayOfMonth księgowana od 1. dnia', () => {
  const p = { frequency: 'monthly' }
  assert.equal(isPaymentDue(p, '2026-07', new Date(2026, 6, 1)), true)
})

test('isPaymentDue — nieaktywna (poza zakresem dat) nie jest należna', () => {
  const p = { dateTo: '2026-06-30' }
  assert.equal(isPaymentDue(p, '2026-07', new Date(2026, 6, 5)), false)
})

test('periodKey — tygodniowy klucz ISO zmienia się co tydzień, nie co miesiąc', () => {
  // 2026-07-13 (pon) i 2026-07-19 (nd) to ten sam tydzień ISO; 2026-07-20 to następny
  assert.equal(periodKey(new Date(2026, 6, 13), 'weekly'), periodKey(new Date(2026, 6, 19), 'weekly'))
  assert.notEqual(periodKey(new Date(2026, 6, 19), 'weekly'), periodKey(new Date(2026, 6, 20), 'weekly'))
  assert.match(periodKey(new Date(2026, 6, 13), 'weekly'), /^\d{4}-W\d{2}$/)
  // przełom roku: 2026-01-01 należy do tygodnia ISO roku 2026 (czwartek)
  assert.equal(periodKey(new Date(2026, 0, 1), 'weekly'), '2026-W01')
})

test('periodKey — roczny klucz to sam rok', () => {
  assert.equal(periodKey(new Date(2026, 6, 5), 'yearly'), '2026')
  assert.equal(periodKey(new Date(2026, 0, 1), 'yearly'), '2026')
})

test('isPaymentDue — roczna zaksięgowana w tym roku nie jest należna do końca roku', () => {
  const p = { frequency: 'yearly', donePeriods: ['2026'] }
  assert.equal(isPaymentDue(p, periodKey(new Date(2026, 7, 1), 'yearly'), new Date(2026, 7, 1)), false)
  assert.equal(isPaymentDue(p, periodKey(new Date(2026, 11, 31), 'yearly'), new Date(2026, 11, 31)), false)
  // nowy rok → znowu należna
  assert.equal(isPaymentDue(p, periodKey(new Date(2027, 0, 2), 'yearly'), new Date(2027, 0, 2)), true)
})

test('isPaymentDue — roczna z dateFrom czeka na rocznicę', () => {
  const p = { frequency: 'yearly', dateFrom: '2025-09-15' }
  assert.equal(isPaymentDue(p, '2026', new Date(2026, 8, 14)), false) // 14 września — przed rocznicą
  assert.equal(isPaymentDue(p, '2026', new Date(2026, 8, 15)), true)  // rocznica
  assert.equal(isPaymentDue(p, '2026', new Date(2026, 10, 1)), true)  // po rocznicy
})

test('isPaymentDue — tygodniowa: nowy tydzień ISO znów należna', () => {
  const doneWeek = periodKey(new Date(2026, 6, 13), 'weekly')
  const p = { frequency: 'weekly', donePeriods: [doneWeek] }
  assert.equal(isPaymentDue(p, doneWeek, new Date(2026, 6, 15)), false)
  const nextWeek = periodKey(new Date(2026, 6, 20), 'weekly')
  assert.equal(isPaymentDue(p, nextWeek, new Date(2026, 6, 20)), true)
})

test('dueDayInMonth — 29.–31. w krótszym miesiącu to jego ostatni dzień', () => {
  assert.equal(dueDayInMonth({ dayOfMonth: 31 }, new Date(2026, 1, 10)), 28) // luty
  assert.equal(dueDayInMonth({ dayOfMonth: 31 }, new Date(2028, 1, 10)), 29) // luty przestępny
  assert.equal(dueDayInMonth({ dayOfMonth: 31 }, new Date(2026, 3, 10)), 30) // kwiecień
  assert.equal(dueDayInMonth({ dayOfMonth: 31 }, new Date(2026, 4, 10)), 31)
  assert.equal(dueDayInMonth({ dayOfMonth: 15 }, new Date(2026, 1, 10)), 15)
  assert.equal(dueDayInMonth({}, new Date(2026, 1, 10)), 1)
  assert.equal(dueDayInMonth({ dayOfMonth: 45 }, new Date(2026, 4, 10)), 31) // śmieciowa wartość
})

test('isPaymentDue — płatność z 31. jest należna ostatniego dnia lutego', () => {
  const p = { dayOfMonth: 31 }
  assert.equal(isPaymentDue(p, '2026-02', new Date(2026, 1, 27)), false)
  assert.equal(isPaymentDue(p, '2026-02', new Date(2026, 1, 28)), true)
})

test('isMonthlyPaymentOn — dzień, zakres dat i częstotliwość', () => {
  assert.equal(isMonthlyPaymentOn({ dayOfMonth: 30 }, new Date(2026, 1, 28)), true)
  assert.equal(isMonthlyPaymentOn({ dayOfMonth: 30 }, new Date(2026, 2, 28)), false)
  assert.equal(isMonthlyPaymentOn({ dayOfMonth: 5, dateFrom: '2026-06-01' }, new Date(2026, 4, 5)), false)
  assert.equal(isMonthlyPaymentOn({ dayOfMonth: 5, frequency: 'weekly' }, new Date(2026, 4, 5)), false)
})
