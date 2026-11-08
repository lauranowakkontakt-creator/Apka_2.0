import { test } from 'node:test'
import assert from 'node:assert/strict'

const A = await import('../src/utils/analityka.js')

test('kluczDnia — Date, Timestamp, tekst, śmieci', () => {
  assert.equal(A.kluczDnia(new Date(2026, 0, 5, 23, 59)), '2026-01-05')
  assert.equal(A.kluczDnia({ toDate: () => new Date(2025, 11, 31) }), '2025-12-31')
  assert.equal(A.kluczDnia('2026-03-04T10:00'), '2026-03-04')
  assert.equal(A.kluczDnia('wczoraj'), null)
  assert.equal(A.kluczDnia(null), null)
})

test('lataZDanych — od najnowszego, z bieżącym rokiem', () => {
  assert.deepEqual(A.lataZDanych(['2024-02-01', '2022-05-05'], new Date(2026, 1, 1)), [2026, 2024, 2022])
})

test('miesiaceRoku — liczy i sumuje wartości tylko z danego roku', () => {
  const w = [{ klucz: '2026-01-02' }, { klucz: '2026-01-20', wartosc: 3 }, { klucz: '2026-12-31' }, { klucz: '2025-01-01' }]
  const m = A.miesiaceRoku(w, 2026)
  assert.equal(m[0], 4); assert.equal(m[11], 1); assert.equal(m.reduce((a, b) => a + b), 5)
})

test('podsumujMiesiace — średnia z minionych miesięcy, najlepszy i najsłabszy', () => {
  const v = [10, 0, 30, 20, 0, 0, 0, 0, 0, 0, 0, 0]
  const p = A.podsumujMiesiace(v, 2026, new Date(2026, 3, 15))
  assert.equal(p.minione, 4); assert.equal(p.suma, 60); assert.equal(p.srednia, 15)
  assert.equal(p.najlepszy, 2); assert.equal(p.najslabszy, 1); assert.equal(p.aktywne, 3)
  assert.equal(A.podsumujMiesiace(Array(12).fill(0), 2026, new Date(2026, 3, 1)).najlepszy, null)
})

test('zmiana — procent, brak bazy daje null', () => {
  assert.equal(A.zmiana(120, 100), 20)
  assert.equal(A.zmiana(50, 100), -50)
  assert.equal(A.zmiana(5, 0), null)
})

test('wgDniaTygodnia — od poniedziałku', () => {
  // 2026-11-02 to poniedziałek, 2026-11-08 niedziela
  const d = A.wgDniaTygodnia([{ klucz: '2026-11-02' }, { klucz: '2026-11-08', wartosc: 2 }])
  assert.deepEqual(d, [1, 0, 0, 0, 0, 0, 2])
})

test('najdluzszaSeria — kolejne dni, także przez granicę miesiąca', () => {
  assert.equal(A.najdluzszaSeria(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-03']), 3)
  assert.equal(A.najdluzszaSeria(['2025-12-31', '2026-01-01'], 2026), 1)
  assert.equal(A.najdluzszaSeria([]), 0)
})

test('dniMinione i miesiaceMinione', () => {
  assert.equal(A.dniMinione(2026, new Date(2026, 0, 1)), 1)
  assert.equal(A.dniMinione(2024, new Date(2026, 0, 1)), 366)
  assert.equal(A.dniMinione(2027, new Date(2026, 0, 1)), 0)
  assert.equal(A.miesiaceMinione(2026, new Date(2026, 10, 7)), 11)
  assert.equal(A.dniMiesiaca(2026, 1), 28)
})

test('doTegoDnia — ten sam okres roku', () => {
  const w = [{ klucz: '2025-03-01' }, { klucz: '2025-11-07' }, { klucz: '2025-11-08' }, { klucz: '2024-01-01' }]
  assert.equal(A.doTegoDnia(w, 2025, new Date(2026, 10, 7)), 2)
})

test('rozbijWgLat — suma i podział na lata, od największej', () => {
  const r = A.rozbijWgLat([
    { nazwa: 'A', rok: 2024, wartosc: 10 }, { nazwa: 'A', rok: 2025, wartosc: 5 },
    { nazwa: 'B', rok: 2025, wartosc: 30 }, { nazwa: 'B', rok: 2025 },
  ])
  assert.deepEqual(r.lata, [2024, 2025])
  assert.equal(r.wiersze[0].nazwa, 'B')
  assert.equal(r.wiersze[0].suma, 31)
  assert.equal(r.wiersze[1].poLatach[2024], 10)
})
