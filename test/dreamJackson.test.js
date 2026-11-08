import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as J from '../src/utils/dreamJackson.js'

test('listy mają unikalne id', () => {
  for (const l of [J.DREAM_POSITIONS, J.DREAM_SPHERES, J.DREAM_ORIGINS, J.DREAM_KINDS, J.DREAM_VIVIDNESS,
    J.DREAM_ATMOSPHERE, J.DREAM_COLORS, J.BEFORE_SLEEP, J.GUIDE_QUESTIONS, J.DREAM_ELEMENTS]) {
    const ids = l.map(x => x.id)
    assert.equal(new Set(ids).size, ids.length)
  }
})

test('dwadzieścia kategorii snów i cztery pozycje śniącego', () => {
  assert.equal(J.DREAM_KINDS.length, 20)
  assert.equal(J.DREAM_POSITIONS.length, 4)
})

test('numberMeanings łapie tylko całe liczby z tabeli', () => {
  assert.deepEqual(J.numberMeanings('3, 12 i 2010').map(m => m.n), [3, 12])
  assert.deepEqual(J.numberMeanings('888').map(m => m.n), [888])
  assert.deepEqual(J.numberMeanings('18, 99'), [])
  assert.deepEqual(J.numberMeanings(''), [])
})

test('dreamKindIds czyta nowy i stary zapis', () => {
  assert.deepEqual(J.dreamKindIds({ kinds: ['a', 'b'] }), ['a', 'b'])
  assert.deepEqual(J.dreamKindIds({ kind: 'x' }), ['x'])
  assert.deepEqual(J.dreamKindIds(null), [])
})

test('appendQuestion dodaje pytanie raz', () => {
  const q = J.GUIDE_QUESTIONS[0].q
  const a = J.appendQuestion('', q)
  assert.equal(J.appendQuestion(a, q), a)
  assert.ok(J.appendQuestion('moje', q).startsWith('moje\n\n'))
})

test('hasJacksonFields', () => {
  assert.equal(J.hasJacksonFields({}), false)
  assert.equal(J.hasJacksonFields({ elements: ['zwierzeta:Wąż'] }), true)
  assert.equal(J.hasJacksonFields({ kind: 'x' }), true)
  assert.equal(J.hasJacksonFields(null), false)
})
