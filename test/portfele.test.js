import { test } from 'node:test'
import assert from 'node:assert/strict'
import { portfele, wPortfelu, PORTFEL_INWESTYCJE } from '../src/utils/portfele.js'

const konta = [
  { id: 'b', name: 'Bank', currency: 'PLN', balance: 1000.1, order: 0 },
  { id: 'r', name: 'Revolut', currency: 'EUR', balance: 50, order: 2 },
  { id: 'g', name: 'Gotówka', balance: 20.2, order: 1 },
  { id: 'x', name: 'XTB', type: 'investment', currency: 'PLN', balance: 1200, invested: 1000 },
]

test('portfele: złotówki pierwsze, potem inne waluty, na końcu inwestycje', () => {
  const p = portfele(konta)
  assert.deepEqual(p.map(x => x.id), ['PLN', 'EUR', PORTFEL_INWESTYCJE])
  assert.equal(p[0].suma, 1020.3)
  assert.equal(p[1].suma, 50)
  assert.deepEqual(p[2].sumy, { PLN: 1200 })
  assert.equal(p[2].zysk, 200)
})

test('portfele: bez kont zostaje sam portfel złotówkowy', () => {
  assert.deepEqual(portfele([]), [{ id: 'PLN', typ: 'waluta', waluta: 'PLN', suma: 0 }])
})

test('wPortfelu: po walucie transakcji, konta inwestycyjne osobno', () => {
  const [pln, eur, inw] = portfele(konta)
  const poId = Object.fromEntries(konta.map(a => [a.id, a]))
  assert.equal(wPortfelu({ accountId: 'b', currency: 'PLN' }, pln, poId), true)
  assert.equal(wPortfelu({ accountId: 'r', currency: 'EUR' }, eur, poId), true)
  assert.equal(wPortfelu({ accountId: 'r', currency: 'EUR' }, pln, poId), false)
  assert.equal(wPortfelu({ accountId: null, currency: 'EUR' }, eur, poId), true)
  assert.equal(wPortfelu({ accountId: 'g' }, pln, poId), true)
  assert.equal(wPortfelu({ accountId: 'x', currency: 'PLN' }, pln, poId), false)
  assert.equal(wPortfelu({ accountId: 'x', currency: 'PLN' }, inw, poId), true)
})
