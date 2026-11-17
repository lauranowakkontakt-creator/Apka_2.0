import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  debtsForPerson, debtSummary, todosForPerson, linkCountsByPerson,
} from '../src/utils/personLinks.js'

const people = [{ id: 'p1', name: 'Ania' }, { id: 'p2', name: 'Marek' }]

const debts = [
  { id: 'd1', personId: 'p1', direction: 'theyOwe', amount: 100, settled: false },
  { id: 'd2', personId: 'p1', direction: 'iOwe',    amount: 30,  settled: false },
  { id: 'd3', personId: 'p1', direction: 'theyOwe', amount: 50,  settled: true },  // rozliczony
  { id: 'd4', personId: 'p2', direction: 'iOwe',    amount: 200, settled: false },
  { id: 'd5', personId: null, direction: 'theyOwe', amount: 999, settled: false }, // bez osoby (np. Sklep)
]

const todos = [
  { id: 't1', title: 'Oddać książkę', peopleIds: ['p1'], done: false },
  { id: 't2', title: 'Zadzwonić',      peopleIds: ['p1', 'p2'], done: false },
  { id: 't3', title: 'Zrobione',        peopleIds: ['p1'], done: true },
  { id: 't4', title: 'Bez osób',        peopleIds: [], done: false },
  { id: 't5', title: 'Brak pola',       done: false },
]

test('debtsForPerson — filtruje po personId', () => {
  assert.deepEqual(debtsForPerson(debts, 'p1').map(d => d.id), ['d1', 'd2', 'd3'])
  assert.deepEqual(debtsForPerson(debts, 'p2').map(d => d.id), ['d4'])
})

test('debtsForPerson — brak id / brak danych', () => {
  assert.deepEqual(debtsForPerson(debts, null), [])
  assert.deepEqual(debtsForPerson(undefined, 'p1'), [])
})

test('debtSummary — liczy tylko nierozliczone, saldo netto', () => {
  const s = debtSummary(debtsForPerson(debts, 'p1'))
  assert.equal(s.theyOwe, 100)
  assert.equal(s.iOwe, 30)
  assert.equal(s.net, 70) // dodatnie = na moją korzyść
})

test('debtSummary — saldo ujemne gdy jestem winna więcej', () => {
  const s = debtSummary(debtsForPerson(debts, 'p2'))
  assert.equal(s.theyOwe, 0)
  assert.equal(s.iOwe, 200)
  assert.equal(s.net, -200)
})

test('debtSummary — pusta lista', () => {
  assert.deepEqual(debtSummary([]), { theyOwe: 0, iOwe: 0, net: 0 })
  assert.deepEqual(debtSummary(undefined), { theyOwe: 0, iOwe: 0, net: 0 })
})

test('todosForPerson — dopasowanie po peopleIds (w tym ukończone)', () => {
  assert.deepEqual(todosForPerson(todos, 'p1').map(t => t.id), ['t1', 't2', 't3'])
  assert.deepEqual(todosForPerson(todos, 'p2').map(t => t.id), ['t2'])
})

test('todosForPerson — brak dopasowań / brak pola peopleIds', () => {
  assert.deepEqual(todosForPerson(todos, 'nieistnieje'), [])
  assert.deepEqual(todosForPerson(todos, null), [])
})

test('linkCountsByPerson — zlicza aktywne długi i zadania per osoba', () => {
  const m = linkCountsByPerson(people, debts, todos)
  // p1: aktywne długi d1,d2 (d3 rozliczony) = 2; aktywne zadania t1,t2 (t3 done) = 2
  assert.deepEqual(m.p1, { debts: 2, todos: 2 })
  // p2: aktywny dług d4 = 1; aktywne zadanie t2 = 1
  assert.deepEqual(m.p2, { debts: 1, todos: 1 })
})

test('linkCountsByPerson — dług bez personId nie psuje liczników', () => {
  const m = linkCountsByPerson(people, debts, todos)
  assert.ok(!('null' in m))
})

test('dług: wybór i dopasowanie osoby', async () => {
  const { osobyDoDlugow, pasujeDoSzukania, dopasujOsobe } = await import('../src/utils/personLinks.js')
  const people = [{ id: 'z', name: 'Zosia' }, { id: 'f', name: 'Daleki', circle: 'far' }, { id: 'a', name: 'Ania', aliases: ['Anka'] }, { id: 'l', name: 'Łukasz' }]
  assert.deepEqual(osobyDoDlugow(people, [{ personId: 'z' }]).map(p => p.id), ['z', 'a', 'l', 'f'])
  assert.ok(pasujeDoSzukania(people[3], 'luk'))
  assert.ok(!pasujeDoSzukania(people[0], 'an'))
  assert.equal(dopasujOsobe(people, ' anka '), 'a')
  assert.equal(dopasujOsobe(people, 'lukasz'), 'l')
  assert.equal(dopasujOsobe(people, 'Sklep'), null)
  assert.equal(dopasujOsobe([...people, { id: 'a2', name: 'Ania' }], 'Ania'), null)
})
