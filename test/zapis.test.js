import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nieCzekajNaSerwer } from '../src/utils/zapisWTle.js'

const nigdy = () => new Promise(() => {})
const pauza = (ms) => new Promise(r => setTimeout(r, ms))

test('offline: oddaje sterowanie od razu, choć serwer nie odpowiada', async () => {
  assert.equal(await nieCzekajNaSerwer(nigdy(), { online: false }), 'kolejka')
})

test('online: szybkie potwierdzenie z serwera', async () => {
  assert.equal(await nieCzekajNaSerwer(Promise.resolve(), { online: true, ms: 50 }), 'serwer')
})

test('online, ale serwer milczy: po czasie zapis uznany za przyjęty do kolejki', async () => {
  assert.equal(await nieCzekajNaSerwer(nigdy(), { online: true, ms: 20 }), 'kolejka')
})

test('błąd przed upływem czasu trafia do formularza', async () => {
  const blad = Object.assign(new Error('nie wolno'), { code: 'permission-denied' })
  await assert.rejects(nieCzekajNaSerwer(Promise.reject(blad), { online: true, ms: 50 }), /nie wolno/)
})

test('błąd po oddaniu sterowania trafia do poCzasie, a nie ginie', async () => {
  const zlapane = []
  let odrzuc
  const zapis = new Promise((_, rej) => { odrzuc = rej })
  assert.equal(await nieCzekajNaSerwer(zapis, { online: false, poCzasie: e => zlapane.push(e.message) }), 'kolejka')
  odrzuc(new Error('za późno'))
  await pauza(5)
  assert.deepEqual(zlapane, ['za późno'])
})

test('wyjątek w poCzasie nie wywraca apki', async () => {
  let odrzuc
  const zapis = new Promise((_, rej) => { odrzuc = rej })
  await nieCzekajNaSerwer(zapis, { online: false, poCzasie: () => { throw new Error('bum') } })
  odrzuc(new Error('x'))
  await pauza(5) // nieobsłużone odrzucenie wywaliłoby test
})

// Strażnik regresji: zapisy idą przez utils/zapis.js. Zapis zaimportowany
// prosto z SDK czeka na serwer, więc bez sieci formularz wisi na „Zapisywanie…".
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const pliki = (katalog) => readdirSync(katalog).flatMap(n => {
  const p = join(katalog, n)
  if (statSync(p).isDirectory()) return pliki(p)
  return ['.js', '.jsx'].includes(extname(n)) ? [p] : []
})

test('addDoc / updateDoc / setDoc / deleteDoc / writeBatch importowane tylko z utils/zapis', () => {
  const winni = []
  for (const p of pliki(join(ROOT, 'src'))) {
    const rel = relative(ROOT, p).replaceAll('\\', '/')
    if (rel.startsWith('src/demo/') || rel === 'src/utils/zapis.js') continue
    const kod = readFileSync(p, 'utf8')
    for (const m of kod.matchAll(/import\s*\{([^}]*)\}\s*from\s*'firebase\/firestore'/g)) {
      const zle = m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0])
        .filter(x => ['addDoc', 'updateDoc', 'setDoc', 'deleteDoc', 'writeBatch'].includes(x))
      if (zle.length) winni.push(`${rel}: ${zle.join(', ')}`)
    }
  }
  assert.deepEqual(winni, [], 'te zapisy trzeba importować z utils/zapis')
})
