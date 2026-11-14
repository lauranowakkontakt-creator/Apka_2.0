import { test } from 'node:test'
import assert from 'node:assert/strict'

const { spalanie, spalaniePoTankowaniu, kosztNa100, cenaZaLitr, wydatkiMiesiaca, ostatniLicznik, przejechane, terminInfo, terminyAuta, fmt1 } =
  await import('../src/utils/carLogic.js')

const blisko = (a, b, komunikat) => assert.ok(Math.abs(a - b) < 0.001, `${komunikat || ''} oczekiwano ${b}, jest ${a}`)

// Auto na gaz: pełne baki gazu co ~400 km, benzyna dolewana rzadko.
const T = [
  { id: 'g1', date: '2026-10-01', fuel: 'lpg', liters: 40, price: 120, odometer: 100000, full: true },
  { id: 'g2', date: '2026-10-08', fuel: 'lpg', liters: 38, price: 114, odometer: 100400, full: true },
  { id: 'g3', date: '2026-10-12', fuel: 'lpg', liters: 20, price: 60,  odometer: 100600, full: false },
  { id: 'g4', date: '2026-10-16', fuel: 'lpg', liters: 22, price: 66,  odometer: 100800, full: true },
  { id: 'b1', date: '2026-10-01', fuel: 'pb',  liters: 30, price: 195, odometer: 100000, full: true },
  { id: 'b2', date: '2026-10-16', fuel: 'pb',  liters: 8,  price: 52,  odometer: 100800, full: true },
]

test('spalanie gazu: od pełna do pełna, niepełne tankowanie dolicza się do następnego pełnego', () => {
  const s = spalanie(T, 'lpg')
  assert.equal(s.szacunkowe, false)
  assert.equal(s.odcinki.length, 2)
  blisko(s.odcinki[0].na100, 9.5, 'pierwszy odcinek (38 l / 400 km)')
  blisko(s.odcinki[1].na100, 10.5, 'drugi odcinek (20 + 22 l / 400 km)')
  blisko(s.srednie, 10, 'średnia (80 l / 800 km)')
  assert.equal(s.km, 800)
})

test('spalanie benzyny liczone osobno, na ten sam dystans', () => {
  const s = spalanie(T, 'pb')
  blisko(s.srednie, 1, '8 l / 800 km')
  assert.equal(s.odcinki.length, 1)
})

test('spalanie: za mało danych → brak wyniku, a nie zero', () => {
  assert.equal(spalanie([], 'lpg').srednie, null)
  assert.equal(spalanie([T[0]], 'lpg').srednie, null)
  // tankowania bez licznika nie liczą się do spalania
  assert.equal(spalanie([{ fuel: 'lpg', liters: 30, full: true }, { fuel: 'lpg', liters: 30, full: true }], 'lpg').srednie, null)
})

test('spalanie: bez dwóch pełnych baków wynik jest szacunkowy', () => {
  const s = spalanie([
    { id: 'a', date: '2026-10-01', fuel: 'lpg', liters: 20, odometer: 1000, full: false },
    { id: 'b', date: '2026-10-05', fuel: 'lpg', liters: 25, odometer: 1250, full: false },
    { id: 'c', date: '2026-10-09', fuel: 'lpg', liters: 25, odometer: 1500, full: false },
  ], 'lpg')
  assert.equal(s.szacunkowe, true)
  blisko(s.srednie, 10, '50 l / 500 km')
})

test('spalanie: licznik cofnięty albo ten sam nie daje dzielenia przez zero', () => {
  const s = spalanie([
    { id: 'a', date: '2026-10-01', fuel: 'lpg', liters: 20, odometer: 1000, full: true },
    { id: 'b', date: '2026-10-02', fuel: 'lpg', liters: 20, odometer: 1000, full: true },
  ], 'lpg')
  assert.equal(s.srednie, null)
  assert.deepEqual(s.odcinki, [])
})

test('spalaniePoTankowaniu: wynik przypisany do tankowania, które zamknęło odcinek', () => {
  const m = spalaniePoTankowaniu(T)
  blisko(m.g2, 9.5)
  blisko(m.g4, 10.5)
  blisko(m.b2, 1)
  assert.equal(m.g1, undefined, 'pierwszy pełny bak nie ma z czym się porównać')
  assert.equal(m.g3, undefined, 'niepełne tankowanie nie zamyka odcinka')
})

test('kosztNa100: oba paliwa razem, bez kosztu pierwszego tankowania', () => {
  // po starcie (100000 km): 114 + 60 + 66 + 52 = 292 zł na 800 km
  blisko(kosztNa100(T), 36.5)
  assert.equal(kosztNa100([T[0]]), null)
  assert.equal(kosztNa100([]), null)
})

test('cenaZaLitr, wydatkiMiesiaca, liczniki', () => {
  blisko(cenaZaLitr({ liters: 40, price: 120 }), 3)
  assert.equal(cenaZaLitr({ liters: 0, price: 120 }), null)
  assert.equal(wydatkiMiesiaca(T, '2026-10'), 607)
  assert.equal(wydatkiMiesiaca(T, '2026-11'), 0)
  assert.equal(wydatkiMiesiaca([{ date: '2026-10-03', cost: 450 }], '2026-10', 'cost'), 450)
  assert.equal(ostatniLicznik(T, [{ odometer: 101200 }]), 101200)
  assert.equal(ostatniLicznik([], []), null)
  assert.equal(przejechane(T), 800)
  assert.equal(przejechane([T[0]]), 0)
})

test('kwoty i litry wpisane z przecinkiem liczą się poprawnie', () => {
  const s = spalanie([
    { id: 'a', date: '2026-10-01', fuel: 'pb', liters: '40,5', odometer: '1000', full: true },
    { id: 'b', date: '2026-10-05', fuel: 'pb', liters: '32,5', odometer: '1500', full: true },
  ], 'pb')
  blisko(s.srednie, 6.5)
})

test('terminInfo: ile dni zostało i kiedy ostrzegać', () => {
  const dzis = '2026-11-13'
  assert.deepEqual(terminInfo('', dzis), { stan: 'brak', dni: null, opis: 'nie ustawiono' })
  assert.equal(terminInfo('2027-03-01', dzis).stan, 'ok')
  assert.equal(terminInfo('2026-12-13', dzis).stan, 'blisko')
  assert.equal(terminInfo('2026-12-13', dzis).dni, 30)
  assert.equal(terminInfo('2026-12-14', dzis).stan, 'ok')
  assert.equal(terminInfo('2026-11-13', dzis).opis, 'kończy się dziś')
  assert.equal(terminInfo('2026-11-14', dzis).opis, 'kończy się jutro')
  assert.equal(terminInfo('2026-11-12', dzis).opis, 'minął wczoraj')
  assert.equal(terminInfo('2026-11-03', dzis).stan, 'po')
  assert.equal(terminInfo('2026-11-03', dzis).opis, 'minął 10 dni temu')
})

test('terminyAuta: najpilniejszy termin pierwszy', () => {
  const t = terminyAuta({ ocDo: '2027-05-01', przegladDo: '2026-11-20', acDo: '' }, '2026-11-13')
  assert.deepEqual(t.map(x => x.label), ['Przegląd', 'OC', 'AC'])
  assert.equal(t[0].stan, 'blisko')
  assert.equal(t[2].stan, 'brak')
  assert.equal(terminyAuta(null, '2026-11-13').every(x => x.stan === 'brak'), true)
})

test('fmt1: jedno miejsce po przecinku, brak danych jako kreska', () => {
  assert.equal(fmt1(9.84), '9,8')
  assert.equal(fmt1(null), '–')
})
