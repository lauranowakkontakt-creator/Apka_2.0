import { test } from 'node:test'
import assert from 'node:assert/strict'

// Atrapa localStorage dla czystych funkcji.
globalThis.localStorage ??= (() => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) } })()
const { idsDoMigracji, czyWykluczone, wliczaneKonta } = await import('../src/utils/kontaWSumie.js')

const konta = [{ id: 'a' }, { id: 'b', excludedFromTotal: true }, { id: 'c' }]

test('idsDoMigracji — tylko istniejące konta bez flagi', () => {
  assert.deepEqual(idsDoMigracji(['a', 'b', 'zniknelo'], konta), ['a'])
  assert.deepEqual(idsDoMigracji([], konta), [])
})

test('wliczaneKonta — flaga z bazy działa na każdym urządzeniu', () => {
  assert.equal(czyWykluczone(konta[1]), true)
  assert.deepEqual(wliczaneKonta('u1', konta).map(a => a.id), ['a', 'c'])
})

test('wliczaneKonta — do czasu migracji stara lista lokalna też wyklucza', () => {
  localStorage.setItem('excludedAccounts_u2', JSON.stringify(['c']))
  assert.deepEqual(wliczaneKonta('u2', konta).map(a => a.id), ['a'])
})
