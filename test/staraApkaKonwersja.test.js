import { test } from 'node:test'
import assert from 'node:assert/strict'
import { convertOldApp } from '../public/stara-apka-konwersja.js'
import { parseDreamFile, planDreamImport } from '../src/utils/dreamImport.js'

const OLD = {
  people: [{ id: 'p1', name: 'Manuela Filipska', aliases: ['Mana'], color: '#E91E63' }, { id: 'p2', name: '  ' }],
  symbols: [{ id: 's1', name: 'wodospad', color: '#5BB6D9' }, { id: 's2', name: 'góry' }],
  categories: [{ id: 'c1', label: 'Pokojowy', color: '#14B8A6' }],
  dreams: [
    { id: 'd1', title: 'Wodospad ciszy', date: '2026-06-23', text: 'Szłam z @Manuelą, widok #wodospad', category: 'przyjemny', emotions: ['spokoj'], symbolIds: ['s1', 's2', 'brak'], peopleIds: ['p1'] },
    { id: 'd2', title: 'Inny', date: '2026-06-24', text: 'x', category: 'c1', interpretation: 'moje' },
    { id: 'd3', title: '', date: '2026-06-25', text: '' },
    { id: 'd4', title: 'Bez daty', text: 'a' },
  ],
}

test('konwersja zachowuje treść, tytuł, kategorię, emocje, symbole i uczestników', () => {
  const r = convertOldApp(OLD)
  assert.equal(r.dreams.length, 2)
  assert.deepEqual(r.dreams[0], {
    title: 'Wodospad ciszy', date: '2026-06-23', text: 'Szłam z @Manuelą, widok #wodospad', category: 'przyjemny',
    emotions: ['spokoj'], symbole: ['wodospad', 'góry'], uczestnicy: ['Manuela Filipska'],
  })
  assert.equal(r.dreams[1].kategoria, 'Pokojowy')
  assert.equal(r.dreams[1].interpretation, 'moje')
  assert.equal(r.people.length, 1)
  assert.deepEqual(r.people[0].aliases, ['Mana'])
  assert.equal(r.symbols.length, 2)
  assert.deepEqual(r.categories, [{ name: 'Pokojowy', color: '#14B8A6' }])
})

test('wynik konwersji przechodzi przez import: kategorie, symbole i uczestnicy', () => {
  const file = parseDreamFile(JSON.stringify(convertOldApp(OLD)))
  assert.equal(file.error, undefined)
  const plan = planDreamImport({
    dreams: file.dreams,
    people: [{ id: 'P', name: 'Manuela Filipska', aliases: ['Mana'] }],
    symbols: [{ id: 'S1', name: 'wodospad' }, { id: 'S2', name: 'góry' }],
    categories: [{ id: 'C', label: 'Pokojowy' }],
  })
  const [a, b] = plan.toAdd.map(x => x.data)
  assert.equal(a.category, 'przyjemny')
  assert.deepEqual(a.emotions, ['spokoj'])
  assert.deepEqual(a.symbolIds.sort(), ['S1', 'S2'])
  assert.deepEqual(a.peopleIds, ['P'])
  assert.equal(b.category, 'C')
})
