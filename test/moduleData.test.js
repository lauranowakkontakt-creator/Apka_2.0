import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { MODULE_DATA } from '../src/utils/moduleData.js'

const ROOT = new URL('..', import.meta.url).pathname
const files = (d) => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : [p] })
const SRC = files(join(ROOT, 'src')).filter(f => /\.(jsx?|tsx?)$/.test(f)).map(f => readFileSync(f, 'utf8')).join('\n')
const used = new Set([...SRC.matchAll(/collection\(db, 'users', [\w.]+, '(\w+)'/g)].map(m => m[1]))

test('każda kolekcja z kodu należy do jakiegoś modułu (czyszczenie) i jest w kopii', () => {
  const owned = new Set(Object.values(MODULE_DATA).flatMap(m => m.collections))
  const exp = readFileSync(join(ROOT, 'src/utils/dataExport.js'), 'utf8')
  for (const c of used) {
    if (c === 'notes' || c === 'memories') continue   // stare kolekcje bez modułu — zostają tylko w kopii
    assert.ok(owned.has(c), `kolekcja ${c} nie jest przypisana do modułu w moduleData.js`)
    assert.match(exp, new RegExp(`'${c}'`), `kolekcja ${c} nie trafia do pełnej kopii`)
  }
})

test('czyszczenie zawsze pyta „czy na pewno”', () => {
  const src = readFileSync(join(ROOT, 'src/components/ClearModuleData.jsx'), 'utf8')
  assert.match(src, /await confirmDialog\(/)
  assert.match(src, /if \(!ok\)/)
  assert.ok(src.indexOf('confirmDialog(') < src.indexOf('b.delete('), 'usuwanie przed pytaniem')
})
