import { test } from 'node:test'
import assert from 'node:assert/strict'

const { chwilePoZapisie, wartoscDnia, czasyEmocji, chwileWpisu } = await import('../src/utils/moodEntry.js')

test('chwilePoZapisie — rano źle, wieczorem dobrze to dwie chwile jednego dnia', () => {
  let c = chwilePoZapisie([], 2, '08:15', true)
  assert.deepEqual(c, [{ time: '08:15', value: 2 }])
  c = chwilePoZapisie(c, 2, '12:00', true)
  assert.equal(c.length, 1, 'ten sam nastrój nie dubluje chwili')
  c = chwilePoZapisie(c, 4, '20:30', true)
  assert.deepEqual(c, [{ time: '08:15', value: 2 }, { time: '20:30', value: 4 }])
})

test('chwilePoZapisie — poprawka wczorajszego dnia zmienia ostatnią chwilę', () => {
  const c = chwilePoZapisie([{ time: null, value: 3 }], 5, '10:00', false)
  assert.deepEqual(c, [{ time: null, value: 5 }])
  assert.deepEqual(chwilePoZapisie(undefined, 3, '10:00', false), [{ time: null, value: 3 }])
})

test('wartoscDnia — średnia chwil', () => {
  assert.equal(wartoscDnia([{ value: 2 }, { value: 4 }, { value: 4 }]), 3.3)
  assert.equal(wartoscDnia([]), null)
})

test('czasyEmocji — nowe dostają godzinę, stare zachowują pierwszą', () => {
  const t = czasyEmocji({ smutek: '08:15', lęk: '09:00' }, ['smutek', 'złość'], '20:30', true)
  assert.deepEqual(t, { smutek: '08:15', złość: '20:30' })
  assert.deepEqual(czasyEmocji({}, ['złość'], '20:30', false), {})
})

test('chwileWpisu — stary wpis bez chwil dostaje jedną z jego oceny', () => {
  assert.deepEqual(chwileWpisu({ moodValue: 4, time: '08:00' }), [{ time: '08:00', value: 4 }])
  assert.deepEqual(chwileWpisu({ moments: [{ time: '1', value: 2 }], moodValue: 2 }), [{ time: '1', value: 2 }])
  assert.deepEqual(chwileWpisu({}), [])
})
