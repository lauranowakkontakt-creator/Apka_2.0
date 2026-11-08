import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ORIGINS, RECALL_TIPS, STEPS, PRINCIPLES, DREAM_KINDS, GUIDE_QUESTIONS, CRITICAL_NOTES, SOURCES, appendQuestion,
} from '../src/utils/dreamLessons.js'

test('lekcje mają unikalne id i znane pochodzenie', () => {
  for (const list of [RECALL_TIPS, STEPS, PRINCIPLES, DREAM_KINDS, GUIDE_QUESTIONS, CRITICAL_NOTES]) {
    const ids = list.map(x => x.id)
    assert.equal(new Set(ids).size, ids.length)
  }
  for (const l of [...RECALL_TIPS, ...STEPS, ...PRINCIPLES]) assert.ok(ORIGINS[l.origin], l.id)
})

test('źródła mają adresy https', () => {
  for (const s of SOURCES) assert.match(s.url, /^https:\/\//)
})

test('appendQuestion dodaje pytanie raz', () => {
  const q = GUIDE_QUESTIONS[0].q
  const a = appendQuestion('', q)
  assert.equal(appendQuestion(a, q), a)
  assert.ok(appendQuestion('moje myśli', q).startsWith('moje myśli\n\n'))
})
