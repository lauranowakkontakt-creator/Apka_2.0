import { test } from 'node:test'
import assert from 'node:assert/strict'
import { circleOf, circleCounts, matchesQuery, visiblePeople } from '../src/utils/personCircles.js'

const L = [
  { id: 'a', name: 'Monika Matuszak', aliases: ['Monia'] },
  { id: 'b', name: 'Zosia Cetnarowska', circle: 'far' },
  { id: 'c', name: 'Łabi Łabuz', circle: 'far', note: 'z kościoła' },
  { id: 'd', name: 'Dawid Nowak', circle: 'close' },
]

test('brak pola circle znaczy bliscy', () => {
  assert.equal(circleOf({}), 'close')
  assert.equal(circleOf(null), 'close')
  assert.equal(circleOf({ circle: 'far' }), 'far')
  assert.equal(circleOf({ circle: 'cokolwiek' }), 'close')
})

test('liczniki kręgów', () => {
  assert.deepEqual(circleCounts(L), { close: 2, far: 2, all: 4 })
})

test('lista dla zakładki: bliscy, dalsi, wszyscy', () => {
  assert.deepEqual(visiblePeople(L, { circle: 'close' }).map(p => p.id), ['a', 'd'])
  assert.deepEqual(visiblePeople(L, { circle: 'far' }).map(p => p.id), ['b', 'c'])
  assert.equal(visiblePeople(L, { circle: 'all' }).length, 4)
})

test('szukanie bez ogonków, po ksywce i opisie, we wszystkich kręgach', () => {
  assert.ok(matchesQuery(L[0], 'monia'))
  assert.ok(matchesQuery(L[2], 'labi'))
  assert.ok(matchesQuery(L[2], 'kosciola'))
  assert.deepEqual(visiblePeople(L, { circle: 'close', q: 'zosia' }).map(p => p.id), ['b'])
  assert.deepEqual(visiblePeople(L, { circle: 'close', q: '  ' }).map(p => p.id), ['a', 'd'])
})
