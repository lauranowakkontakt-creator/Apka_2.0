import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as J from '../src/utils/dreamJackson.js'

test('listy mają unikalne id', () => {
  for (const l of [J.DREAM_POSITIONS, J.DREAM_ORIGINS, J.DREAM_KINDS, J.DREAM_VIVIDNESS, J.DREAM_COLORS, J.BEFORE_SLEEP, J.GUIDE_QUESTIONS]) {
    const ids = l.map(x => x.id)
    assert.equal(new Set(ids).size, ids.length)
  }
})

test('appendQuestion dodaje pytanie raz', () => {
  const q = J.GUIDE_QUESTIONS[0].q
  const a = J.appendQuestion('', q)
  assert.equal(J.appendQuestion(a, q), a)
  assert.ok(J.appendQuestion('moje', q).startsWith('moje\n\n'))
})

test('hasJacksonFields', () => {
  assert.equal(J.hasJacksonFields({}), false)
  assert.equal(J.hasJacksonFields({ colors: ['czerwony'] }), true)
  assert.equal(J.hasJacksonFields(null), false)
})
