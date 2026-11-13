import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeNoteMode, parseChecklist, checklistToText, toggleChecked,
  pruneDone, checklistProgress, checklistSummary, hasChecklist, NOTE_MODES,
} from '../src/utils/prayerList.js'

test('normalizeNoteMode — domyślnie opis', () => {
  assert.equal(normalizeNoteMode('list'), 'list')
  assert.equal(normalizeNoteMode('text'), 'text')
  assert.equal(normalizeNoteMode(undefined), 'text')
  assert.equal(normalizeNoteMode('cokolwiek'), 'text')
  assert.equal(NOTE_MODES.length, 2)
})

test('parseChecklist — linia to jeden punkt, puste linie odpadają', () => {
  const items = parseChecklist('zdrowie mamy\n\npraca taty\n   \nspokój w domu')
  assert.deepEqual(items.map(i => i.text), ['zdrowie mamy', 'praca taty', 'spokój w domu'])
  assert.equal(new Set(items.map(i => i.id)).size, 3, 'id muszą być unikalne')
  assert.deepEqual(parseChecklist(''), [])
  assert.deepEqual(parseChecklist(null), [])
})

test('parseChecklist — zdejmuje myślniki i kropki, które ludzie piszą odruchowo', () => {
  const items = parseChecklist('- zdrowie\n• praca\n* dom\n   -   wyjazd')
  assert.deepEqual(items.map(i => i.text), ['zdrowie', 'praca', 'dom', 'wyjazd'])
})

test('parseChecklist — edycja jednej pozycji nie gubi ptaszków przy pozostałych', () => {
  const before = parseChecklist('zdrowie\npraca\ndom')
  const doneIds = [before[0].id, before[2].id]
  // zmieniamy tylko środkową pozycję
  const after = parseChecklist('zdrowie\npraca taty\ndom', before)
  assert.equal(after[0].id, before[0].id)
  assert.equal(after[2].id, before[2].id)
  assert.notEqual(after[1].id, before[1].id)
  assert.deepEqual(pruneDone(after, doneIds), doneIds, 'odhaczenia pozostałych mają przetrwać')
})

test('parseChecklist — dopasowanie po treści ignoruje wielkość liter i spacje', () => {
  const before = parseChecklist('Zdrowie mamy')
  const after = parseChecklist('  zdrowie MAMY  ', before)
  assert.equal(after[0].id, before[0].id)
  assert.equal(after[0].text, 'zdrowie MAMY', 'zapisujemy pisownię z pola, nie starą')
})

test('parseChecklist — duplikaty dostają osobne id', () => {
  const items = parseChecklist('dom\ndom')
  assert.equal(items.length, 2)
  assert.notEqual(items[0].id, items[1].id)
})

test('checklistToText — z powrotem do pola tekstowego', () => {
  const items = parseChecklist('zdrowie\npraca')
  assert.equal(checklistToText(items), 'zdrowie\npraca')
  assert.equal(checklistToText([]), '')
})

test('toggleChecked — odhacza i cofa punktowo', () => {
  assert.deepEqual(toggleChecked([], 'a'), ['a'])
  assert.deepEqual(toggleChecked(['a', 'b'], 'a'), ['b'])
  assert.deepEqual(toggleChecked(['a'], 'b'), ['a', 'b'])
  assert.deepEqual(toggleChecked(undefined, 'a'), ['a'])
})

test('pruneDone — odhaczenia skasowanych punktów znikają', () => {
  const items = [{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }]
  assert.deepEqual(pruneDone(items, ['a', 'zniknal', 'b']), ['a', 'b'])
  assert.deepEqual(pruneDone([], ['a']), [])
})

test('checklistProgress — licznik nie kłamie po usunięciu punktu', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  assert.deepEqual(checklistProgress(items, ['a', 'b']), { done: 2, total: 3, pct: 67 })
  assert.deepEqual(checklistProgress(items, []), { done: 0, total: 3, pct: 0 })
  assert.deepEqual(checklistProgress(items, ['a', 'b', 'c']), { done: 3, total: 3, pct: 100 })
  // ptaszek po skasowanym punkcie nie może podbijać licznika
  assert.deepEqual(checklistProgress([{ id: 'a' }], ['a', 'stary']), { done: 1, total: 1, pct: 100 })
  assert.deepEqual(checklistProgress([], []), { done: 0, total: 0, pct: 0 })
})

test('checklistSummary — krótki opis stanu', () => {
  assert.equal(checklistSummary([{ id: 'a' }, { id: 'b' }], ['a']), '1 z 2')
  assert.equal(checklistSummary([], []), '')
})

test('hasChecklist — tylko tryb listy z punktami', () => {
  assert.ok(hasChecklist({ noteMode: 'list', checklist: [{ id: 'a', text: 'x' }] }))
  assert.ok(!hasChecklist({ noteMode: 'list', checklist: [] }))
  assert.ok(!hasChecklist({ noteMode: 'text', checklist: [{ id: 'a' }] }))
  assert.ok(!hasChecklist({}))
  assert.ok(!hasChecklist(null))
})

test('dniTemu: bez „1 dni temu”', async () => {
  const { dniTemu } = await import('../src/utils/prayerList.js')
  assert.equal(dniTemu(1), 'wczoraj')
  assert.equal(dniTemu(3), '3 dni temu')
  assert.equal(dniTemu(0), '')
  assert.equal(dniTemu(null), '')
})
