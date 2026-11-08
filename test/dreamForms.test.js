import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as F from '../src/utils/dreamForms.js'

test('wrapLines zawija słowa i skraca nadmiar', () => {
  assert.deepEqual(F.wrapLines('zamknięte drzwi do piwnicy', 12), ['zamknięte', 'drzwi do', 'piwnicy'])
  assert.deepEqual(F.wrapLines('', 12), [])
  const long = F.wrapLines('a b c d e f g h i j k l m n o p q r s t', 5, 2)
  assert.equal(long.length, 2)
  assert.ok(long[1].endsWith('…'))
  assert.ok(F.wrapLines('nadzwyczajnienajdłuższesłowo', 8)[0].length <= 8)
})

test('cleanMindMap usuwa puste pola i zwraca null dla pustej mapy', () => {
  assert.equal(F.cleanMindMap(F.emptyMindMap()), null)
  assert.equal(F.cleanMindMap({ center: ' ', branches: [{ text: '', leaves: ['', ' '] }] }), null)
  const m = F.cleanMindMap({ center: ' woda ', branches: [{ text: 'dom', leaves: ['okno', ''] }, { text: '', leaves: [] }] })
  assert.deepEqual(m, { center: 'woda', branches: [{ text: 'dom', leaves: ['okno'] }] })
})

test('mindMapLayout: środek, gałęzie i liście z krawędziami', () => {
  assert.equal(F.mindMapLayout({ center: '', branches: [] }), null)
  const l = F.mindMapLayout({ center: 'woda', branches: [{ text: 'dom', leaves: ['okno', 'drzwi'] }, { text: 'pies', leaves: [] }] })
  assert.equal(l.nodes.filter(n => n.kind === 'center').length, 1)
  assert.equal(l.nodes.filter(n => n.kind === 'branch').length, 2)
  assert.equal(l.nodes.filter(n => n.kind === 'leaf').length, 2)
  assert.equal(l.edges.length, 4)
  assert.ok(l.box.w > 0 && l.box.h > 0)
  for (const n of l.nodes) assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y))
})

test('mapa z samym środkiem też się układa', () => {
  const l = F.mindMapLayout({ center: 'sen', branches: [] })
  assert.equal(l.nodes.length, 1)
  assert.equal(l.edges.length, 0)
})

test('cleanDiagram', () => {
  assert.equal(F.cleanDiagram([F.emptyScene()]), null)
  assert.deepEqual(F.cleanDiagram([{ text: ' klif ', notes: ['strach', ''] }, { text: '', notes: [] }]),
    [{ text: 'klif', notes: ['strach'] }])
})

test('spiralGeometry rośnie razem z tekstem', () => {
  const a = F.spiralGeometry('krótko')
  const b = F.spiralGeometry('dłuższy tekst '.repeat(30))
  assert.ok(a.d.startsWith('M'))
  assert.ok(b.size > a.size)
  assert.ok(b.d.length > a.d.length)
  assert.ok(F.spiralGeometry('').size > 0)
})

test('memoryStreak liczy kolejne dni, kończąc dziś lub wczoraj', () => {
  assert.equal(F.memoryStreak([], '2026-11-08'), 0)
  assert.equal(F.memoryStreak(['2026-11-08', '2026-11-07', '2026-11-06'], '2026-11-08'), 3)
  assert.equal(F.memoryStreak(['2026-11-07', '2026-11-06'], '2026-11-08'), 2)
  assert.equal(F.memoryStreak(['2026-11-05'], '2026-11-08'), 0)
  assert.equal(F.memoryStreak(['2026-11-08', '2026-11-06'], '2026-11-08'), 1)
  assert.equal(F.memoryStreak(['2026-03-01', '2026-02-28'], '2026-03-01'), 2)
})

test('memoryEntryValid wymaga pokoju i 5 szczegółów', () => {
  assert.equal(F.memoryEntryValid('Salon', ['a', 'b', 'c', 'd']), false)
  assert.equal(F.memoryEntryValid('', ['a', 'b', 'c', 'd', 'e']), false)
  assert.equal(F.memoryEntryValid('Salon', ['a', 'b', ' ', 'c', 'd', 'e']), true)
})
