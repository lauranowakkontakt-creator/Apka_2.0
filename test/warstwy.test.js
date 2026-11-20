import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zamknijWierzchniaWarstwe } from '../src/utils/warstwy.js'

// Atrapa dokumentu: tyle DOM-u, ile funkcja naprawdę używa.
const okno = (nazwa, klik, zPrzyciskiem = true) => ({
  querySelector: (s) => (s === '.modal-close' && zPrzyciskiem ? { click: () => klik.push(nazwa) } : null),
})
const dokument = ({ okna = [], szuflada = false, wiecej = false, klik }) => ({
  querySelectorAll: (s) => (s === '.modal-overlay' ? okna : []),
  querySelector: (s) => {
    if (s === '.drawer-overlay' && szuflada) return { click: () => klik.push('szuflada') }
    if (s === '.more-overlay.open' && wiecej) return { click: () => klik.push('wiecej') }
    return null
  },
})

test('zamyka okno z wierzchu — ostatnie w dokumencie', () => {
  const klik = []
  const d = dokument({ okna: [okno('formularz', klik), okno('potwierdzenie', klik)], szuflada: true, klik })
  assert.equal(zamknijWierzchniaWarstwe(d), true)
  assert.deepEqual(klik, ['potwierdzenie'])
})

test('okno bez przycisku zamknięcia jest pomijane', () => {
  const klik = []
  const d = dokument({ okna: [okno('formularz', klik), okno('bez-x', klik, false)], klik })
  zamknijWierzchniaWarstwe(d)
  assert.deepEqual(klik, ['formularz'])
})

test('bez okien zamyka szufladę ustawień, potem „Więcej"', () => {
  const klik = []
  assert.equal(zamknijWierzchniaWarstwe(dokument({ szuflada: true, wiecej: true, klik })), true)
  assert.equal(zamknijWierzchniaWarstwe(dokument({ wiecej: true, klik })), true)
  assert.deepEqual(klik, ['szuflada', 'wiecej'])
})

test('nic otwartego — nic nie robi', () => {
  assert.equal(zamknijWierzchniaWarstwe(dokument({ klik: [] })), false)
})
