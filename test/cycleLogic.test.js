import { test } from 'node:test'
import assert from 'node:assert/strict'

const { statystykiCyklu, dzienCyklu, fazaCyklu, prognozaCyklu, czyOkres, zakresyFaz, fazaDnia, dodajDni, roznicaDni } =
  await import('../src/utils/cycleLogic.js')

const okresy = [
  { start: '2026-08-01', end: '2026-08-05' },
  { start: '2026-08-29', end: '2026-09-02' },   // cykl 28
  { start: '2026-09-28', end: '2026-10-03' },   // cykl 30
]

test('daty: dodawanie dni i różnica przechodzą przez zmianę czasu', () => {
  assert.equal(dodajDni('2026-10-24', 2), '2026-10-26')   // noc zmiany czasu
  assert.equal(roznicaDni('2026-03-28', '2026-03-30'), 2)
  assert.equal(dodajDni('2026-12-31', 1), '2027-01-01')
})

test('statystykiCyklu — średnia z zapisanych odstępów i długości okresu', () => {
  const s = statystykiCyklu(okresy)
  assert.equal(s.dlugoscCyklu, 29)       // (28 + 30) / 2
  assert.equal(s.dlugoscOkresu, 5)       // (5 + 5 + 6) / 3 = 5,33
  assert.equal(s.liczbaCykli, 2)
  assert.equal(s.najkrotszy, 28)
  assert.equal(s.najdluzszy, 30)
  assert.ok(s.zDanych)
})

test('statystykiCyklu — jeden okres daje wartości domyślne', () => {
  const s = statystykiCyklu([{ start: '2026-09-01', end: null }])
  assert.equal(s.dlugoscCyklu, 28)
  assert.equal(s.dlugoscOkresu, 5)
  assert.equal(s.zDanych, false)
})

test('statystykiCyklu — dziura w zapisach nie psuje średniej', () => {
  // Między marcem a sierpniem nic nie zapisano: 153 dni to nie cykl.
  const s = statystykiCyklu([{ start: '2026-03-01', end: null }, ...okresy])
  assert.equal(s.dlugoscCyklu, 29)
  assert.equal(s.liczbaCykli, 2)
})

test('dzienCyklu — liczony od ostatniego początku okresu', () => {
  assert.equal(dzienCyklu(okresy, '2026-09-28'), 1)
  assert.equal(dzienCyklu(okresy, '2026-10-11'), 14)
  assert.equal(dzienCyklu(okresy, '2026-07-31'), null)    // przed pierwszym zapisem
  assert.equal(dzienCyklu(okresy, '2027-01-15'), null)    // zbyt dawno, żeby liczyć
})

test('fazaCyklu — pełny przebieg 28-dniowego cyklu', () => {
  const f = (d) => fazaCyklu(d, 28, 5)
  assert.equal(f(1), 'menstruacja')
  assert.equal(f(5), 'menstruacja')
  assert.equal(f(6), 'folikularna')
  assert.equal(f(13), 'owulacja')
  assert.equal(f(14), 'owulacja')
  assert.equal(f(15), 'owulacja')
  assert.equal(f(16), 'lutealna')
  assert.equal(f(23), 'lutealna')
  assert.equal(f(24), 'przedmiesiaczkowa')
  assert.equal(f(28), 'przedmiesiaczkowa')
  assert.equal(f(29), 'spoznienie')
  assert.equal(fazaCyklu(null, 28, 5), null)
})

test('zakresyFaz — pokrywają cały cykl bez dziur', () => {
  for (const dl of [21, 26, 28, 31, 35, 40]) {
    const z = zakresyFaz(dl, 5)
    assert.equal(z[0].od, 1)
    assert.equal(z[z.length - 1].do, dl)
    for (let i = 1; i < z.length; i++) assert.equal(z[i].od, z[i - 1].do + 1)
  }
})

test('prognozaCyklu — następny okres wg średniej, także spóźniony', () => {
  const p = prognozaCyklu(okresy, '2026-10-11')
  assert.equal(p.nastepny, '2026-10-27')     // 28 września + 29 dni
  assert.equal(p.dniDo, 16)
  assert.ok(p.przyszleDni.has('2026-10-27'))
  assert.ok(p.przyszleDni.has('2026-10-31'))
  assert.ok(!p.przyszleDni.has('2026-11-01'))
  assert.equal(prognozaCyklu(okresy, '2026-10-30').dniDo, -3)
  assert.equal(prognozaCyklu([], '2026-10-11'), null)
})

test('czyOkres — okres bez daty końca trwa średnią długość, nie w nieskończoność', () => {
  const o = [{ start: '2026-10-01', end: null }]
  assert.ok(czyOkres(o, '2026-10-05', 5))
  assert.ok(!czyOkres(o, '2026-10-06', 5))
  assert.ok(czyOkres(okresy, '2026-10-03'))
  assert.ok(!czyOkres(okresy, '2026-10-04'))
})

test('fazaDnia — w zamkniętym cyklu liczy się jego faktyczna długość', () => {
  // Cykl sierpniowy trwał 28 dni: 25 sierpnia to dzień 25 → przed miesiączką.
  assert.equal(fazaDnia(okresy, '2026-08-25'), 'przedmiesiaczkowa')
  assert.equal(fazaDnia(okresy, '2026-08-02'), 'menstruacja')
  assert.equal(fazaDnia(okresy, '2026-07-01'), null)
  // Bieżący cykl po terminie zostaje „przed miesiączką", a nie osobną grupą.
  assert.equal(fazaDnia(okresy, '2026-10-29'), 'przedmiesiaczkowa')
})

test('kalendarzCyklu — kolejne okresy i owulacje wg jej średniej', async () => {
  const { kalendarzCyklu } = await import('../src/utils/cycleLogic.js')
  // Średnia z zapisów: 29 dni, okres 5 dni; ostatni okres 28 września.
  const k = kalendarzCyklu(okresy, '2026-10-11', 3)
  assert.deepEqual(k.starty, ['2026-10-27', '2026-11-25', '2026-12-24'])
  assert.ok(k.prognoza.has('2026-10-31'))
  assert.ok(!k.prognoza.has('2026-11-01'))
  assert.ok(k.prognoza.has('2026-11-25'))
  // Owulacja bieżącego cyklu: dzień 15 (29 − 14) → 12 października ±1.
  assert.ok(k.owulacja.has('2026-10-11') && k.owulacja.has('2026-10-12') && k.owulacja.has('2026-10-13'))
  assert.ok(!k.owulacja.has('2026-10-10'), 'minione dni nie są prognozą')
  assert.ok(k.owulacja.has('2026-11-10'))      // 27 października + 14 dni
})

test('kalendarzCyklu — spóźniony okres przesuwa prognozę od jutra', async () => {
  const { kalendarzCyklu } = await import('../src/utils/cycleLogic.js')
  const k = kalendarzCyklu(okresy, '2026-10-30', 2)
  assert.equal(k.starty[0], '2026-10-31')
  assert.equal(k.starty[1], '2026-11-29')
  assert.deepEqual(kalendarzCyklu([], '2026-10-30').starty, [])
})
