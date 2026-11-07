import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planImportCleanup } from '../src/utils/importCleanup.js'

test('cofnij import — tylko importowane, puste konta z saldem 0, nieużywane kategorie imp_', () => {
  const tx = [
    { id: 't1', source: 'import', importedFrom: 'plik.xlsx · bank', accountId: 'a1', type: 'expense', categoryId: 'imp_auto' },
    { id: 't2', source: 'import', importedFrom: 'plik.xlsx · bank', accountId: 'a2', type: 'expense', categoryId: 'imp_dom' },
    { id: 't3', accountId: 'a2', type: 'expense', categoryId: 'imp_dom' },                       // ręczna
    { id: 't4', source: 'import', importedFrom: 'plik.xlsx', accountId: 'a3', type: 'income', categoryId: 'imp_x' },
  ]
  const acc = [{ id: 'a1', name: 'PKO', balance: 0 }, { id: 'a2', name: 'ING', balance: 0 }, { id: 'a3', name: 'Koperta', balance: 5000 }]
  const cats = { expense: [{ id: 'imp_auto' }, { id: 'imp_dom' }, { id: 'jedzenie' }], income: [{ id: 'imp_x' }] }
  const p = planImportCleanup(tx, acc, cats)
  assert.deepEqual(p.transactions, ['t1', 't2', 't4'])
  assert.deepEqual(p.accounts.map(a => a.id), ['a1'])               // ING ma ręczną, Koperta ma saldo
  assert.deepEqual(p.categories.expense.map(c => c.id), ['imp_dom', 'jedzenie'])
  assert.deepEqual(p.categories.income, [])
  assert.equal(p.removedCats, 2)
  assert.deepEqual(p.files, ['plik.xlsx'])
})

test('cofnij import — nic do zrobienia', () => {
  const p = planImportCleanup([{ id: 't', accountId: 'a' }], [{ id: 'a', balance: 0 }], null)
  assert.equal(p.transactions.length, 0)
  assert.equal(p.categories, null)
})
