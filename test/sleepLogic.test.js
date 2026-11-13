import { test } from 'node:test'
import assert from 'node:assert/strict'

const { minutySnu, fmtCzas, senDnia, sredniaSnu, kubelekSnu } = await import('../src/utils/sleepLogic.js')

test('minutySnu — sen przez północ i w ciągu dnia', () => {
  assert.equal(minutySnu('23:30', '07:00'), 450)
  assert.equal(minutySnu('14:10', '14:40'), 30)
  assert.equal(minutySnu('00:15', '06:15'), 360)
  assert.equal(minutySnu('', '07:00'), 0)
})

test('fmtCzas — godziny i minuty po polsku', () => {
  assert.equal(fmtCzas(450), '7 h 30 min')
  assert.equal(fmtCzas(480), '8 h')
  assert.equal(fmtCzas(25), '25 min')
  assert.equal(fmtCzas(0), '0 min')
})

const logi = [
  { date: '2026-10-10', type: 'night', minutes: 420, wakeups: 2, quality: 4 },
  { date: '2026-10-10', type: 'nap', minutes: 30 },
  { date: '2026-10-11', type: 'night', minutes: 480, wakeups: 0, quality: 5 },
  { date: '2026-10-12', type: 'nap', minutes: 20 },
]

test('senDnia — noc i drzemki liczone osobno', () => {
  const d = senDnia(logi, '2026-10-10')
  assert.equal(d.noc, 420)
  assert.equal(d.drzemki, 30)
  assert.equal(d.razem, 450)
  assert.equal(d.pobudki, 2)
  assert.equal(d.jakosc, 4)
  assert.ok(d.maNoc)
  assert.equal(senDnia(logi, '2026-10-12').maNoc, false)
})

test('sredniaSnu — dzień bez zapisu nocy nie liczy się jako zero godzin', () => {
  const s = sredniaSnu(logi, ['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'])
  assert.equal(s.noc, 450)          // (420 + 480) / 2, nie / 4
  assert.equal(s.pobudki, 1)
  assert.equal(s.nocy, 2)
  assert.equal(s.drzemki, 2)
  assert.equal(sredniaSnu([], ['2026-10-10']).noc, null)
})

test('kubelekSnu — granice przedziałów', () => {
  assert.equal(kubelekSnu(359), 'poniżej 6 h')
  assert.equal(kubelekSnu(360), '6–7 h')
  assert.equal(kubelekSnu(420), '7–8 h')
  assert.equal(kubelekSnu(480), '8 h i więcej')
  assert.equal(kubelekSnu(0), null)
})
