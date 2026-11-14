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

const { pozycjePobudek, pobudkaWCzasieSnu, opisPobudek } = await import('../src/utils/sleepLogic.js')

test('pozycjePobudek — podana godzina stoi dokładnie w swoim miejscu nocy', () => {
  const p = pozycjePobudek({ id: 'a', start: '23:00', end: '07:00', wakeups: 2, wakeTimes: ['03:00', '01:00'] })
  assert.equal(p.length, 2)
  assert.deepEqual(p.map(x => x.znana), [true, true])
  assert.equal(p[0].u, 0.5)     // 4 h z 8 h
  assert.equal(p[1].u, 0.25)    // 2 h z 8 h
})

test('pozycjePobudek — „nie wiem” daje losowe, ale stałe miejsce w środku nocy', () => {
  const log = { id: 'b', start: '23:30', end: '06:30', wakeups: 3, wakeTimes: [null, '02:00', null] }
  const p1 = pozycjePobudek(log), p2 = pozycjePobudek(log)
  assert.deepEqual(p1, p2, 'to samo przy każdym wywołaniu')
  assert.deepEqual(p1.map(x => x.znana), [false, true, false])
  for (const x of p1) assert.ok(x.u > 0 && x.u < 1)
  assert.notEqual(p1[0].u, p1[2].u, 'dwie nieznane pobudki nie stoją w tym samym miejscu')
  const inny = pozycjePobudek({ ...log, id: 'c' })
  assert.notEqual(inny[0].u, p1[0].u, 'inna noc — inne miejsce')
})

test('pozycjePobudek — stary wpis z samą liczbą pobudek i godzina spoza snu', () => {
  const stary = pozycjePobudek({ id: 'd', start: '23:00', end: '07:00', wakeups: 2 })
  assert.deepEqual(stary.map(x => x.znana), [false, false])
  const poza = pozycjePobudek({ id: 'e', start: '23:00', end: '07:00', wakeups: 1, wakeTimes: ['12:00'] })
  assert.equal(poza[0].znana, false)
  assert.deepEqual(pozycjePobudek({ start: '23:00', end: '07:00', wakeups: 0 }), [])
})

test('pobudkaWCzasieSnu i opisPobudek', () => {
  assert.ok(pobudkaWCzasieSnu('23:00', '07:00', '02:15'))
  assert.ok(pobudkaWCzasieSnu('23:00', '07:00', '23:30'))
  assert.ok(!pobudkaWCzasieSnu('23:00', '07:00', '08:00'))
  assert.ok(!pobudkaWCzasieSnu('23:00', '07:00', ''))
  assert.equal(opisPobudek({ wakeups: 2, wakeTimes: ['02:30', null] }), 'pobudki: 2 (02:30)')
  assert.equal(opisPobudek({ wakeups: 3 }), 'pobudki: 3')
  assert.equal(opisPobudek({ wakeups: 0 }), '')
})
