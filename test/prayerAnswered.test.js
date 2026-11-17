import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dataPL, osobyDoModlitwy, pasujeOsoba, oknoModlitwy, opisOkna, poczatekModlitwy, wspomnienieZProsby } from '../src/utils/prayerAnswered.js'

test('osoby: bliscy przed dalszymi i ukrytymi, częściej modlone wyżej, potem alfabet', () => {
  const people = [
    { id: 'z', name: 'Zosia' }, { id: 'a', name: 'Ania' },
    { id: 'f', name: 'Daleki', circle: 'far' }, { id: 'h', name: 'Ukryta', hiddenInPrayer: true },
    { id: 'm', name: 'Mama' },
  ]
  const intentions = [{ personId: 'm' }, { personId: 'm' }, { personId: 'z', status: 'active' }, { personId: 'a', status: 'ended' }]
  assert.deepEqual(osobyDoModlitwy(people, intentions).map(p => p.id), ['m', 'z', 'a', 'f', 'h'])
})

test('szukanie osoby bez ogonków i po ksywce', () => {
  assert.ok(pasujeOsoba({ name: 'Łucja' }, 'luc'))
  assert.ok(pasujeOsoba({ name: 'Zofia', aliases: ['Zośka'] }, 'zosk'))
  assert.ok(!pasujeOsoba({ name: 'Ania' }, 'zo'))
  assert.ok(pasujeOsoba({ name: 'Ania' }, '  '))
})

test('okno modlitwy: puste, jedno, oba, odwrócone', () => {
  assert.deepEqual(oknoModlitwy('', ''), { scheduleFrom: null, scheduleTo: null, dateTo: null })
  assert.deepEqual(oknoModlitwy('2026-11-01', ''), { scheduleFrom: '2026-11-01', scheduleTo: null, dateTo: null })
  assert.deepEqual(oknoModlitwy('', '2026-11-30'), { scheduleFrom: null, scheduleTo: '2026-11-30', dateTo: '2026-11-30' })
  assert.deepEqual(oknoModlitwy('2026-12-05', '2026-12-01'), { scheduleFrom: '2026-12-01', scheduleTo: '2026-12-05', dateTo: '2026-12-05' })
})

test('opis okna na karcie', () => {
  assert.equal(opisOkna({ scheduleFrom: '2026-11-03', scheduleTo: '2026-11-10' }), '3.11 – 10.11')
  assert.equal(opisOkna({ scheduleFrom: '2026-11-03' }), 'od 3.11')
  assert.equal(opisOkna({ dateTo: '2026-12-24' }), 'do 24.12')
  assert.equal(opisOkna({}), null)
})

test('początek modlitwy: najwcześniejsza z dat modlitwy i dodania', () => {
  assert.equal(poczatekModlitwy({ prayedDates: ['2026-05-02', '2026-04-10'], createdAt: new Date(2026, 4, 1) }), '2026-04-10')
  assert.equal(poczatekModlitwy({ prayedDates: [], createdAt: new Date(2026, 4, 1) }), '2026-05-01')
  assert.equal(poczatekModlitwy({}), null)
})

test('wysłuchana prośba → szkic wspomnienia', () => {
  const w = wspomnienieZProsby(
    { title: 'Praca dla taty', prayedDates: ['2026-03-01', '2026-03-02'] },
    { name: 'Tata' }, '2026-11-17', 'Przyjęli go od grudnia',
  )
  assert.equal(w.title, 'Praca dla taty (Tata)')
  assert.equal(w.category, 'modlitwa')
  assert.equal(w.date, '2026-11-17')
  assert.match(w.text, /Tata/)
  assert.match(w.text, /od 1\.03\.2026 — modliłam się 2 razy/)
  assert.match(w.text, /Przyjęli go od grudnia/)
  assert.equal(wspomnienieZProsby({ title: 'X' }, null, '2026-01-01').title, 'X')
})

test('data po polsku', () => {
  assert.equal(dataPL('2026-11-07'), '7.11.2026')
})

test('zaplanowane: tylko aktywne z oknem, które jeszcze się nie zaczęło', async () => {
  const { czyZaplanowana, zaplanowane, zaIleDni } = await import('../src/utils/prayerAnswered.js')
  const dzis = '2026-11-17'
  assert.ok(czyZaplanowana({ scheduleFrom: '2026-11-29' }, dzis))
  assert.ok(!czyZaplanowana({ scheduleFrom: '2026-11-17' }, dzis))
  assert.ok(!czyZaplanowana({ scheduleFrom: '2026-11-29', status: 'ended' }, dzis))
  assert.ok(!czyZaplanowana({ dateTo: '2026-12-01' }, dzis))
  assert.deepEqual(zaplanowane([
    { id: 'b', scheduleFrom: '2026-12-05' }, { id: 'x' }, { id: 'a', scheduleFrom: '2026-11-20' },
  ], dzis).map(i => i.id), ['a', 'b'])
  assert.equal(zaIleDni('2026-11-18', dzis), 'jutro')
  assert.equal(zaIleDni('2026-11-29', dzis), 'za 12 dni')
})

test('statystyki osób: zaplanowana prośba nie robi z osoby zaległej', async () => {
  const { statystykiOsob } = await import('../src/utils/prayerStats.js')
  const r = statystykiOsob([{ id: 'm', name: 'M' }], [{ personId: 'm', scheduleFrom: '2026-11-29' }], '2026-11-17')
  assert.equal(r[0].activeCount, 0)
})
