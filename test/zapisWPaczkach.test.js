import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wPaczkach } from '../src/utils/zapisWPaczkach.js'

const fakeDb = (failures = {}) => {
  const written = []; let n = 0
  return {
    written,
    makeBatch: () => { const ops = []; const id = n++; return { set: (x) => ops.push(x), commit: async () => {
      if (failures[id]) { const f = failures[id]; if (f === 'hang') return new Promise(() => {}); throw { code: f } }
      written.push(...ops) } } },
  }
}

test('małe paczki, postęp co paczkę', async () => {
  const db = fakeDb(); const prog = []
  await wPaczkach([...Array(120).keys()], { makeBatch: db.makeBatch, apply: (b, x) => b.set(x), size: 50, onProgress: (d, t) => prog.push(`${d}/${t}`) })
  assert.equal(db.written.length, 120)
  assert.deepEqual(prog, ['0/120', '50/120', '100/120', '120/120'])
})

test('zawieszona i chwilowo niedostępna paczka jest ponawiana', async () => {
  const db = fakeDb({ 0: 'hang', 1: 'unavailable' }); const waits = []
  await wPaczkach([1, 2, 3], { makeBatch: db.makeBatch, apply: (b, x) => b.set(x), size: 3, timeoutMs: 10, czekaj: async () => {}, onWait: (c) => waits.push(c) })
  assert.deepEqual(db.written, [1, 2, 3])
  assert.deepEqual(waits, ['timeout', 'unavailable'])
})

test('błąd uprawnień nie jest ponawiany', async () => {
  const db = fakeDb({ 0: 'permission-denied' })
  await assert.rejects(wPaczkach([1], { makeBatch: db.makeBatch, apply: (b, x) => b.set(x), czekaj: async () => {} }), (e) => e.code === 'permission-denied')
})
