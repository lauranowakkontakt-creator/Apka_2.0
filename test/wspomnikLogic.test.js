import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sortEntries, filterEntries, groupByYear, wspomnikStats, onThisDay,
  yearsAgoLabel, wspomnieniaWord, buildEntry, categoryLabel,
} from '../src/utils/wspomnikLogic.js'

const E = [
  { id: 'a', date: '2024-11-17', title: 'Praca', category: 'modlitwa', verse: 'Flp 4,19' },
  { id: 'b', date: '2026-03-02', title: 'Uzdrowienie mamy', category: 'uzdrowienie', text: 'Lekarze byli zdziwieni' },
  { id: 'c', date: '2026-11-17', title: 'Dziś coś', category: null },
  { id: 'd', date: '2025-11-17', title: 'Rok temu', category: 'modlitwa' },
]

test('sortowanie: od najnowszego wydarzenia, wpisy bez daty odpadają', () => {
  assert.deepEqual(sortEntries([...E, { id: 'x' }]).map(e => e.id), ['c', 'b', 'd', 'a'])
})

test('ten sam dzień: później dodany wyżej', () => {
  const r = sortEntries([
    { id: '1', date: '2026-01-01', createdAt: new Date(1000) },
    { id: '2', date: '2026-01-01', createdAt: new Date(2000) },
  ])
  assert.deepEqual(r.map(e => e.id), ['2', '1'])
})

test('szukanie bez polskich znaków i po historii, filtr po rodzaju', () => {
  assert.deepEqual(filterEntries(E, { search: 'zdziwieni' }).map(e => e.id), ['b'])
  assert.deepEqual(filterEntries(E, { search: 'flp' }).map(e => e.id), ['a'])
  assert.deepEqual(filterEntries(E, { category: 'modlitwa' }).map(e => e.id), ['a', 'd'])
  assert.equal(filterEntries(E, {}).length, 4)
})

test('grupy po latach, od najnowszego', () => {
  assert.deepEqual(groupByYear(E).map(g => [g.year, g.items.length]), [['2026', 2], ['2025', 1], ['2024', 1]])
})

test('statystyki', () => {
  assert.deepEqual(wspomnikStats(E, '2026-11-17'), { total: 4, year: 2, answered: 2 })
})

test('tego dnia: ten sam dzień i miesiąc we wcześniejszych latach, bez dzisiejszych', () => {
  const r = onThisDay(E, '2026-11-17')
  assert.deepEqual(r.map(e => [e.id, e.yearsAgo]), [['d', 1], ['a', 2]])
})

test('odmiana', () => {
  assert.equal(yearsAgoLabel(1), 'rok temu')
  assert.equal(yearsAgoLabel(2), '2 lata temu')
  assert.equal(yearsAgoLabel(5), '5 lat temu')
  assert.equal(yearsAgoLabel(12), '12 lat temu')
  assert.equal(yearsAgoLabel(22), '22 lata temu')
  assert.equal(wspomnieniaWord(1), 'wspomnienie')
  assert.equal(wspomnieniaWord(3), 'wspomnienia')
  assert.equal(wspomnieniaWord(0), 'wspomnień')
  assert.equal(wspomnieniaWord(13), 'wspomnień')
})

test('buildEntry: wymaga tytułu, czyści pola, odrzuca nieznany rodzaj', () => {
  assert.equal(buildEntry({ title: '   ' }), null)
  assert.deepEqual(buildEntry({ title: ' Praca ', text: ' x ', date: '2026-01-02', category: 'zle', verse: '' }),
    { title: 'Praca', text: 'x', date: '2026-01-02', category: null, verse: '' })
  assert.equal(buildEntry({ title: 'a', date: 'jutro' }).date, null)
  assert.equal(categoryLabel('modlitwa'), 'Wysłuchana modlitwa')
})
