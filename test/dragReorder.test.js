import { test } from 'node:test'
import assert from 'node:assert/strict'
import { docelowyIndeks, krok, przesuniecie, przenies } from '../src/utils/dragReorder.js'

// Pięć wierszy po 40 px z odstępem 6 px.
const rects = [0, 1, 2, 3, 4].map(i => ({ top: i * 46, height: 40 }))

test('docelowyIndeks: bez ruchu zostaje na miejscu', () => {
  assert.equal(docelowyIndeks(rects, 2, 0), 2)
  assert.equal(docelowyIndeks(rects, 2, 20), 2)
})

test('docelowyIndeks: w dół i w górę po minięciu środka sąsiada', () => {
  assert.equal(docelowyIndeks(rects, 0, 47), 1)
  assert.equal(docelowyIndeks(rects, 0, 93), 2)
  assert.equal(docelowyIndeks(rects, 4, -47), 3)
  assert.equal(docelowyIndeks(rects, 4, -500), 0)
  assert.equal(docelowyIndeks(rects, 0, 5000), 4)
})

test('docelowyIndeks: odporny na złe dane', () => {
  assert.equal(docelowyIndeks([], 0, 100), 0)
  assert.equal(docelowyIndeks(rects, 9, 100), 9)
})

test('krok: wysokość plus odstęp', () => {
  assert.equal(krok(rects, 0), 46)
  assert.equal(krok(rects, 4), 46)
  assert.equal(krok([{ top: 0, height: 40 }], 0), 40)
})

test('przesuniecie: sąsiedzi robią miejsce', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(j => przesuniecie(j, 1, 3, 46)), [0, 0, -46, -46, 0])
  assert.deepEqual([0, 1, 2, 3, 4].map(j => przesuniecie(j, 3, 0, 46)), [46, 46, 46, 0, 0])
})

test('przenies: przenosi element i nie rusza oryginału', () => {
  const a = ['a', 'b', 'c', 'd']
  assert.deepEqual(przenies(a, 0, 2), ['b', 'c', 'a', 'd'])
  assert.deepEqual(przenies(a, 3, 0), ['d', 'a', 'b', 'c'])
  assert.deepEqual(przenies(a, 1, 1), a)
  assert.deepEqual(przenies(a, 1, 9), a)
  assert.deepEqual(a, ['a', 'b', 'c', 'd'])
})
