import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeLayout, applyLayout, visibleModules, navModules,
  moveModule, moveModuleTo, toggleHidden, isHidden, FIXED_FIRST,
} from '../src/utils/moduleLayout.js'

const ALL = ['home', 'budget', 'habits', 'mood', 'prayer', 'calendar']
const mods = (ids) => ids.map(id => ({ id, label: id }))

test('normalizeLayout — brak zapisu daje kolejność wyjściową, nic nie ukryte', () => {
  assert.deepEqual(normalizeLayout(null, ALL), { order: ALL, hidden: [] })
  assert.deepEqual(normalizeLayout({}, ALL), { order: ALL, hidden: [] })
})

test('normalizeLayout — Pulpit zawsze pierwszy i nigdy ukryty', () => {
  const l = normalizeLayout({ order: ['prayer', 'home', 'budget'], hidden: ['home', 'mood'] }, ALL)
  assert.equal(l.order[0], FIXED_FIRST)
  assert.deepEqual(l.hidden, ['mood'])
})

test('normalizeLayout — nieznane id znikają, nowe moduły dopisują się na koniec', () => {
  const l = normalizeLayout({ order: ['prayer', 'stare-id', 'budget'], hidden: ['nie-ma-takiego'] }, ALL)
  assert.deepEqual(l.order, ['home', 'prayer', 'budget', 'habits', 'mood', 'calendar'])
  assert.deepEqual(l.hidden, [])
})

test('normalizeLayout — duplikaty w hidden są scalane', () => {
  const l = normalizeLayout({ order: ALL, hidden: ['mood', 'mood', 'prayer'] }, ALL)
  assert.deepEqual(l.hidden, ['mood', 'prayer'])
})

test('applyLayout — kolejność użytkownika i flaga hidden', () => {
  const layout = { order: ['home', 'prayer', 'budget', 'habits', 'mood', 'calendar'], hidden: ['mood'] }
  const out = applyLayout(mods(ALL), layout)
  assert.deepEqual(out.map(m => m.id), layout.order)
  assert.deepEqual(out.filter(m => m.hidden).map(m => m.id), ['mood'])
})

test('applyLayout — moduł zniknięty z listy nie wywraca układu', () => {
  const layout = { order: ['home', 'nieistniejacy', 'budget'], hidden: [] }
  assert.deepEqual(applyLayout(mods(['home', 'budget']), layout).map(m => m.id), ['home', 'budget'])
})

test('visibleModules / navModules — pasek bierze pierwsze widoczne', () => {
  const layout = { order: ['home', 'prayer', 'budget', 'habits', 'mood', 'calendar'], hidden: ['budget'] }
  const out = applyLayout(mods(ALL), layout)
  assert.deepEqual(visibleModules(out).map(m => m.id), ['home', 'prayer', 'habits', 'mood', 'calendar'])
  assert.deepEqual(navModules(out).map(m => m.id), ['home', 'prayer', 'habits', 'mood'])
  assert.deepEqual(navModules(out, 2).map(m => m.id), ['home', 'prayer'])
})

test('moveModule — przesuwa w górę i w dół', () => {
  const order = ['home', 'budget', 'habits', 'mood']
  assert.deepEqual(moveModule(order, 'habits', -1), ['home', 'habits', 'budget', 'mood'])
  assert.deepEqual(moveModule(order, 'budget', 1), ['home', 'habits', 'budget', 'mood'])
})

test('moveModule — nie wychodzi poza listę i nie przeskakuje przed Pulpit', () => {
  const order = ['home', 'budget', 'habits']
  assert.deepEqual(moveModule(order, 'budget', -1), order) // już zaraz za Pulpitem
  assert.deepEqual(moveModule(order, 'habits', 1), order)  // ostatni
  assert.deepEqual(moveModule(order, 'home', -1), order)   // Pulpit stoi w miejscu
  assert.deepEqual(moveModule(order, 'home', 1), order)
  assert.deepEqual(moveModule(order, 'nie-ma', 1), order)
})

test('toggleHidden — ukrywa i odkrywa, Pulpitu nie rusza', () => {
  let l = { order: ALL, hidden: [] }
  l = toggleHidden(l, 'mood')
  assert.deepEqual(l.hidden, ['mood'])
  assert.ok(isHidden(l, 'mood'))
  l = toggleHidden(l, 'mood')
  assert.deepEqual(l.hidden, [])
  assert.deepEqual(toggleHidden(l, 'home').hidden, [])
})

test('moveModuleTo — przeciąganie na miejsce innego modułu', () => {
  const order = ['home', 'budget', 'habits', 'todo', 'mood']
  assert.deepEqual(moveModuleTo(order, 'budget', 'todo'), ['home', 'habits', 'todo', 'budget', 'mood'])
  assert.deepEqual(moveModuleTo(order, 'mood', 'budget'), ['home', 'mood', 'budget', 'habits', 'todo'])
  assert.deepEqual(moveModuleTo(order, 'home', 'todo'), order)
  assert.deepEqual(moveModuleTo(order, 'budget', 'home'), order)
  assert.deepEqual(moveModuleTo(order, 'nieznany', 'todo'), order)
})
