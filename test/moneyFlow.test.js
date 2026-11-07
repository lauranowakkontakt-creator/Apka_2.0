import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inPLN, isInvestmentFlow, investedNet } from '../src/utils/moneyFlow.js'

const ACC = { pko: { type: 'bank' }, xtb: { type: 'investment' } }
const tr = (o) => ({ categoryId: 'transfer', ...o })

test('inPLN — waluta z amountPLN, reszta bez zmian', () => {
  assert.equal(inPLN({ amount: 5.59, currency: 'USD', amountPLN: 25 }), 25)
  assert.equal(inPLN({ amount: 5.59, currency: 'USD' }), 5.59)
  assert.equal(inPLN({ amount: 12, currency: 'PLN', amountPLN: 99 }), 12)
  assert.equal(inPLN({ amount: 7 }), 7)
})

test('zainwestowane — oznaczone, do konta inwestycyjnego, bez podwójnego liczenia', () => {
  const list = [
    tr({ type: 'expense', amount: 100, accountId: 'pko', investment: true }),         // import: „→ XTB" bez drugiej nogi
    tr({ type: 'expense', amount: 50, accountId: 'pko', transferTo: 'xtb' }),         // przelew z apki…
    tr({ type: 'income', amount: 50, accountId: 'xtb', transferFrom: 'pko' }),        // …i jego druga noga
    tr({ type: 'income', amount: 30, accountId: 'pko', transferFrom: 'xtb' }),        // wypłata z XTB
    tr({ type: 'expense', amount: 999, accountId: 'pko' }),                           // zwykły przelew
    { type: 'expense', amount: 500, accountId: 'pko', categoryId: 'zakupy', investment: true }, // nie przelew
  ]
  assert.equal(investedNet(list, ACC), 120)
  assert.equal(isInvestmentFlow(list[4], ACC), false)
  assert.equal(isInvestmentFlow(list[5], ACC), false)
})
