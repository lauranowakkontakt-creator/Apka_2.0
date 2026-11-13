import { test } from 'node:test'
import assert from 'node:assert/strict'

const { chwileWpisu, podsumujDzien, posortujChwile, chwileDoAnalizy } = await import('../src/utils/moodEntry.js')

const dzien = [
  { id: 'a', time: '18:00', value: 5, emotions: ['radość'], factors: ['spotkanie'], peopleIds: ['ola'] },
  { id: 'b', time: '10:00', value: 2, emotions: ['złość', 'stres'], factors: ['praca'], peopleIds: [] },
  { id: 'c', time: '21:00', value: 4, emotions: ['radość', 'spokój'], factors: ['dom'], peopleIds: ['ola'] },
]

test('podsumujDzien — średnia, ostatnia chwila i suma emocji, czynników, osób', () => {
  const p = podsumujDzien(dzien)
  assert.equal(p.moodValue, 3.7)
  assert.equal(p.ostatnia, 4)                   // 21:00, nie ostatnia na liście
  assert.deepEqual(p.emotions, ['złość', 'stres', 'radość', 'spokój'])
  assert.deepEqual(p.factors, ['praca', 'spotkanie', 'dom'])
  assert.deepEqual(p.peopleIds, ['ola'])
  assert.deepEqual(p.emotionTimes, { złość: '10:00', stres: '10:00', radość: '18:00', spokój: '21:00' })
  assert.equal(podsumujDzien([]), null)
})

test('posortujChwile — po godzinie, bez godziny na początku', () => {
  assert.deepEqual(posortujChwile([{ time: '12:00' }, { time: null }, { time: '08:00' }]).map(c => c.time), [null, '08:00', '12:00'])
})

test('chwileWpisu — stary wpis bez chwil staje się jedną chwilą', () => {
  const c = chwileWpisu({ moodValue: 4, time: '08:00', emotions: ['lęk'], factors: ['praca'], peopleIds: ['x'] })
  assert.equal(c.length, 1)
  assert.deepEqual(c[0], { id: 'm0', time: '08:00', value: 4, emotions: ['lęk'], factors: ['praca'], peopleIds: ['x'] })
  assert.deepEqual(chwileWpisu({}), [])
  assert.equal(chwileWpisu({ moments: dzien }).length, 3)
})

test('chwileDoAnalizy — każda chwila osobno, z własnym nastrojem', () => {
  const a = chwileDoAnalizy([{ date: '2026-11-13', moments: dzien }, { date: '2026-11-12', moodValue: 3, factors: ['praca'] }])
  assert.equal(a.length, 4)
  const praca = a.filter(x => x.factors.includes('praca')).map(x => x.moodValue)
  assert.deepEqual(praca, [2, 3])
  assert.equal(new Set(a.map(x => x.date)).size, 4, 'klucze chwil są unikalne')
})
