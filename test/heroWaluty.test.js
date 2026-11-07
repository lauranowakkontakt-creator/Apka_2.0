import { test } from 'node:test'
import assert from 'node:assert/strict'

const { slajdyWalut, nazwaWaluty } = await import('../src/utils/heroWaluty.js')

const konta = [
  { id: 'a', currency: 'PLN', balance: 1000 },
  { id: 'b', balance: 500 },                      // brak waluty = PLN
  { id: 'c', currency: 'EUR', balance: 200 },
  { id: 'd', currency: 'USD', balance: 900 },
  { id: 'e', currency: 'PLN', balance: 3000, type: 'investment' },
]

test('karta na walutę: PLN pierwsza, reszta od największego salda, inwestycje na końcu', () => {
  const s = slajdyWalut(konta, [])
  assert.deepEqual(s.map(x => x.id), ['PLN', 'USD', 'EUR', 'inwestycje'])
  assert.equal(s[0].saldo, 1500); assert.equal(s[0].konta, 2)
  assert.equal(s[3].saldo, 3000); assert.deepEqual(s[3].inwestycje, { PLN: 3000 })
})

test('zmiana miesiąca liczy się w walucie karty, bez przelewów', () => {
  const tx = [
    { type: 'income', amount: 100, currency: 'EUR' },
    { type: 'expense', amount: 30, currency: 'EUR' },
    { type: 'expense', amount: 50 },                               // PLN
    { type: 'expense', amount: 999, currency: 'EUR', categoryId: 'transfer' },
  ]
  const s = slajdyWalut(konta, tx)
  const eur = s.find(x => x.id === 'EUR'), pln = s.find(x => x.id === 'PLN')
  assert.equal(eur.zmiana, 70); assert.equal(eur.wplywy, 100); assert.equal(eur.wydatki, 30)
  assert.equal(pln.zmiana, -50)
})

test('bez kont — jedna pusta karta PLN', () => {
  const s = slajdyWalut([], [])
  assert.equal(s.length, 1); assert.equal(s[0].saldo, 0)
})

test('nazwaWaluty', () => {
  assert.equal(nazwaWaluty('EUR'), 'euro')
  assert.equal(nazwaWaluty('XYZ'), 'XYZ')
})
