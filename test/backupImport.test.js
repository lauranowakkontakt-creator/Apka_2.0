import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reviveDates, isBackup, mapAccounts, mergeCategories, planBackupImport } from '../src/utils/backupImport.js'

const DEF = { expense: [{ id: 'inne', label: 'Inne' }], income: [{ id: 'inne', label: 'Inne' }] }
const tx = (id, o = {}) => ({ id, type: 'expense', amount: 10, accountId: 'a1', date: '2024-03-05T00:00:00.000Z', categoryId: 'inne', ...o })
const backup = (o = {}) => ({
  accounts: [{ id: 'a1', name: 'PKO', currency: 'PLN', type: 'bank', balance: 100, createdAt: '2026-06-01T20:38:28.425Z' }],
  transactions: [tx('t1'), tx('t2', { amount: 20 })],
  singles: { 'settings/categories': { expense: [{ id: 'inne', label: 'Inne', subcategories: [{ id: 's1', label: 'Bank' }] }, { id: 'oplaty', label: 'Opłaty' }], income: [] } },
  ...o,
})

test('reviveDates — tylko pełne daty ISO, rekurencyjnie', () => {
  const r = reviveDates({ a: '2026-06-01T20:38:28.425Z', b: '2026-06-01', c: [{ d: '2020-01-01T00:00:00Z' }] })
  assert.ok(r.a instanceof Date)
  assert.equal(r.b, '2026-06-01')
  assert.ok(r.c[0].d instanceof Date)
})

test('isBackup', () => {
  assert.ok(isBackup(backup()))
  assert.ok(!isBackup([]))
  assert.ok(!isBackup({ transactions: [] }))
})

test('mapAccounts — po id, potem po nazwie+walucie+typie, reszta nowa', () => {
  const { map, toAdd } = mapAccounts(
    [{ id: 'a1', name: 'PKO', currency: 'PLN', type: 'bank' }, { id: 'a2', name: 'ING', currency: 'PLN', type: 'bank' }, { id: 'a3', name: 'Revolut', currency: 'CZK', type: 'bank' }],
    [{ id: 'a1', name: 'PKO' }, { id: 'x9', name: 'ing', currency: 'PLN', type: 'bank' }])
  assert.deepEqual(map, { a1: 'a1', a2: 'x9', a3: 'a3' })
  assert.deepEqual(toAdd.map(a => a.id), ['a3'])
})

test('mergeCategories — dopisuje brakujące, nie rusza istniejących', () => {
  const { categories, added } = mergeCategories(
    { expense: [{ id: 'inne', label: 'Pozostałe', color: '#123' }], income: [] },
    backup().singles['settings/categories'])
  assert.equal(categories.expense[0].label, 'Pozostałe')
  assert.equal(categories.expense[0].color, '#123')
  assert.deepEqual(categories.expense[0].subcategories.map(s => s.id), ['s1'])
  assert.equal(categories.expense[1].id, 'oplaty')
  assert.deepEqual(added.map(a => a.label), ['Pozostałe → Bank', 'Opłaty'])
})

test('plan — pusta baza: wszystko nowe, daty jako Date', () => {
  const p = planBackupImport(backup(), { accounts: [], transactions: [] }, DEF)
  assert.equal(p.transactions.length, 2)
  assert.equal(p.newAccounts.length, 1)
  assert.ok(p.transactions[0].date instanceof Date)
  assert.ok(p.newAccounts[0].createdAt instanceof Date)
  assert.ok(p.categories)
})

test('plan — pomija to samo id i tę samą treść (inny projekt = inne id)', () => {
  const current = {
    accounts: [{ id: 'X1', name: 'PKO', currency: 'PLN', type: 'bank' }],
    transactions: [{ id: 't1' }, { id: 'zz', type: 'expense', amount: 20, accountId: 'X1', date: new Date('2024-03-05T00:00:00.000Z') }],
    categories: backup().singles['settings/categories'],
  }
  const p = planBackupImport(backup(), current, DEF)
  assert.equal(p.transactions.length, 0)
  assert.deepEqual(p.skipped, { sameId: 1, sameContent: 1, invalid: 0 })
  assert.equal(p.newAccounts.length, 0)
  assert.equal(p.categories, null)  // nic nowego w kategoriach → nie zapisujemy
})

test('plan — przelewy dostają id kont z bazy, uszkodzone wpisy odpadają', () => {
  const b = backup({
    accounts: [{ id: 'a1', name: 'PKO', currency: 'PLN', type: 'bank' }, { id: 'a2', name: 'Gotówka', currency: 'PLN', type: 'cash' }],
    transactions: [tx('t1', { categoryId: 'transfer', transferTo: 'a2' }), tx('t2', { amount: -5 }), tx('t3', { date: 'zła' })],
  })
  const p = planBackupImport(b, { accounts: [{ id: 'P', name: 'PKO', currency: 'PLN', type: 'bank' }], transactions: [] }, DEF)
  assert.equal(p.transactions.length, 1)
  assert.equal(p.transactions[0].accountId, 'P')
  assert.equal(p.transactions[0].transferTo, 'a2')
  assert.equal(p.skipped.invalid, 2)
})
