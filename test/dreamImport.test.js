import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  appleToIso, dreamId, linkText, parseDreamFile, planDreamImport, planRelink, suggestNewPeople, suggestSymbols, withAliases,
} from '../src/utils/dreamImport.js'

const LUDZIE = [
  { id: 'da', name: 'Dawid Nowak' },
  { id: 'mt', name: 'Mateusz Telenga' },
  { id: 'mo', name: 'Mateusz Tomczak', aliases: ['Mati', 'Matiego'] },
  { id: 'ro', name: 'Rodzice' },
  { id: 'pl', name: 'Paulina Olszewska' },
  { id: 'pa', name: 'Paula Gajda' },
]
const DREAMY = { dreams: [
  { dreamTitle: 'Sesja', dreamDescription: 'Poszłam z Dawidem na sesję do dziadków', date: 645693137.19, dreamType: 'Normal Dream', dreamInterpretation: '' },
  { dreamTitle: 'Wojna', dreamDescription: 'Wybuchła wojna, chowaliśmy się z rodzicami', date: 646125811.5, dreamType: 'Nightmare', dreamInterpretation: '' },
  { dreamTitle: '', dreamDescription: '', date: 1 },
] }

test('appleToIso: sekundy od 2001 w czasie polskim', () => {
  assert.equal(appleToIso(642589200), '2021-05-13')
  assert.equal(appleToIso(0), '2001-01-01')
  assert.equal(appleToIso(NaN), null)
  // 23:30 UTC 31 grudnia to już 1 stycznia w Polsce
  assert.equal(appleToIso((Date.UTC(2020, 11, 31, 23, 30) - Date.UTC(2001, 0, 1)) / 1000), '2021-01-01')
})

test('parseDreamFile: Dreamy, typy i pomijanie pustych', () => {
  const r = parseDreamFile(JSON.stringify(DREAMY))
  assert.equal(r.format, 'dreamy')
  assert.equal(r.dreams.length, 2)
  assert.equal(r.skipped, 1)
  assert.equal(r.dreams[0].date, '2021-06-18')
  assert.deepEqual(r.dreams.map(d => d.category), ['zwykly', 'koszmar'])
})

test('parseDreamFile: kopia z apki i ogólna lista', () => {
  const apka = parseDreamFile(JSON.stringify({ dreams: [{ title: 'A', date: '2024-01-02', text: 'tekst', category: 'proroczy', colors: ['czerwony'], originalText: 'oryg', peopleIds: ['x'] }] }))
  assert.equal(apka.format, 'apka')
  assert.equal(apka.dreams[0].category, 'proroczy')
  assert.deepEqual(apka.dreams[0].extra.colors, ['czerwony'])
  assert.equal(apka.dreams[0].extra.peopleIds, undefined)
  assert.equal(apka.dreams[0].extra.originalText, 'oryg')
  const og = parseDreamFile(JSON.stringify([{ tytuł: 'B', data: '2020-05-05', treść: 'x', originalText: 'oryg' }]))
  assert.equal(og.format, 'ogolny')
  assert.equal(og.dreams[0].extra.originalText, 'oryg')
  assert.ok(parseDreamFile('nie json').error)
  assert.ok(parseDreamFile('{"a":1}').error)
})

test('linkText: oznacza odmienione osoby, nie rusza reszty', () => {
  const r = linkText('Poszłam z Dawidem do rodziców', LUDZIE, [])
  assert.equal(r.text, 'Poszłam z @Dawidem do @rodziców')
  assert.deepEqual(r.mentionIds.sort(), ['da', 'ro'])
})

test('linkText: bez tagowania zostawia tekst, ale łączy osoby', () => {
  const r = linkText('Z Dawidem', LUDZIE, [], { tag: false })
  assert.equal(r.text, 'Z Dawidem')
  assert.deepEqual(r.mentionIds, ['da'])
})

test('linkText: niejednoznaczne imię trafia do pytań, nie do tekstu', () => {
  const r = linkText('Rozmawiałam z Mateuszem', LUDZIE, [])
  assert.deepEqual(r.mentionIds, [])
  assert.equal(r.text, 'Rozmawiałam z Mateuszem')
  assert.equal(r.ambiguous.length, 1)
  assert.deepEqual(r.ambiguous[0].ids.sort(), ['mo', 'mt'])
  // po wskazaniu odmiany jako ksywki Tomczaka jest jednoznacznie
  const ludzie2 = withAliases(LUDZIE, { mateuszem: 'mo' })
  assert.deepEqual(linkText('Rozmawiałam z Mateuszem', ludzie2, []).mentionIds, ['mo'])
})

test('linkText: Pauliny nie łapie się na Paulę', () => {
  assert.deepEqual(linkText('Byłam u Pauliny', LUDZIE, []).mentionIds, ['pl'])
  assert.deepEqual(linkText('Byłam u Pauli', LUDZIE, []).mentionIds, ['pa'])
})

test('linkText: nie dubluje @ i łączy symbole z odmianą', () => {
  const sym = [{ id: 's1', name: 'dom' }, { id: 's2', name: 'stary las' }]
  const r = linkText('Z @Dawidem w domu i w starym lesie? nie, w stary las', LUDZIE, sym)
  assert.equal(r.text, 'Z @Dawidem w domu i w starym lesie? nie, w stary las')
  assert.ok(r.symbolIds.includes('s1'))
  assert.ok(r.symbolIds.includes('s2'))
})

test('planDreamImport: duplikaty, powiązania i ponowny import nic nie dodaje', () => {
  const { dreams } = parseDreamFile(JSON.stringify(DREAMY))
  const p1 = planDreamImport({ dreams, people: LUDZIE, symbols: [] })
  assert.equal(p1.toAdd.length, 2)
  assert.equal(p1.dup, 0)
  assert.deepEqual(p1.perPerson, { da: 1, ro: 1 })
  assert.match(p1.toAdd[0].data.text, /@Dawidem/)
  assert.equal(p1.toAdd[0].data.imported, true)
  const existing = p1.toAdd.map(x => ({ id: x.id, date: x.data.date, title: x.data.title }))
  const p2 = planDreamImport({ dreams, existing, people: LUDZIE, symbols: [] })
  assert.equal(p2.toAdd.length, 0)
  assert.equal(p2.dup, 2)
  // ten sam sen z inną treścią, ale tą samą datą i tytułem, też jest duplikatem
  const p3 = planDreamImport({ dreams: [{ ...dreams[0], text: 'inny tekst' }], existing, people: [], symbols: [] })
  assert.equal(p3.dup, 1)
})

test('dreamId jest stałe i zależy od treści', () => {
  const a = { date: '2024-01-01', title: 'A', text: 'x' }
  assert.equal(dreamId(a), dreamId({ ...a }))
  assert.notEqual(dreamId(a), dreamId({ ...a, text: 'y' }))
})

test('planRelink dopisuje powiązania w istniejących snach i jest idempotentne', () => {
  const dreams = [{ id: 'd1', text: 'Z Dawidem', mentionIds: [], symbolIds: [] }, { id: 'd2', text: 'Nic', mentionIds: [], symbolIds: [] }]
  const p = planRelink({ dreams, people: LUDZIE, symbols: [] })
  assert.equal(p.updates.length, 1)
  assert.equal(p.updates[0].data.text, 'Z @Dawidem')
  const after = [{ id: 'd1', ...p.updates[0].data }, dreams[1]]
  assert.equal(planRelink({ dreams: after, people: LUDZIE, symbols: [] }).updates.length, 0)
})

test('suggestNewPeople łączy odmiany i pomija znane osoby', () => {
  const texts = ['Była tam Monia i Dawid', 'Rozmawiałam z Monią', 'Spotkałam Monię', 'Z Dawidem']
  const c = suggestNewPeople(texts, LUDZIE)
  assert.equal(c.length, 1)
  assert.equal(c[0].name, 'Monia')
  assert.equal(c[0].count, 3)
})

test('suggestSymbols zwraca częste słowa i pomija czasowniki oraz znane symbole', () => {
  const texts = Array.from({ length: 5 }, () => 'Byłam w starym domu i weszłam do domu przy wodzie')
  const s = suggestSymbols(texts, { min: 3 })
  assert.ok(s.some(x => x.word.startsWith('dom')))
  assert.ok(!s.some(x => /łam$/.test(x.word)))
  const s2 = suggestSymbols(texts, { min: 3, symbols: [{ name: 'dom' }] })
  assert.ok(!s2.some(x => x.word.startsWith('dom')))
})

test('linkText: skip i force dla konkretnego snu', () => {
  const ludzie = [
    { id: 'bw', name: 'Bartek Wójcikowski' }, { id: 'bs', name: 'Bartłomiej Steleblak' },
    { id: 'zs', name: 'Zosia Bogusławska' }, { id: 'ma', name: 'Mateusz Nowak' }, { id: 'mt', name: 'Mateusz Tomczak' },
  ]
  const a = linkText('Przyszedł Bartek, mój kuzyn', ludzie, [], { force: { bartek: 'Bartek Wójcikowski' } })
  assert.deepEqual(a.mentionIds, ['bw'])
  assert.equal(a.text, 'Przyszedł @Bartek, mój kuzyn')
  const b = linkText('Wzięłam ciocię Zosię', ludzie, [], { skip: ['zosi'] })
  assert.deepEqual(b.mentionIds, [])
  assert.equal(b.text, 'Wzięłam ciocię Zosię')
  const c = linkText('Zaszłam w ciążę z Mateuszem Nowakiem', ludzie, [], { force: { mateusz: 'Mateusz Nowak' } })
  assert.deepEqual(c.mentionIds, ['ma'])
})

test('parseDreamFile: osoby, symbole i powiązania z pliku', () => {
  const r = parseDreamFile(JSON.stringify({
    people: [{ name: 'Monika Matuszak', aliases: ['Monia'], note: 'koleżanka' }, { name: '' }],
    symbols: [{ name: 'Mila', meaning: 'mój kot' }],
    dreams: [{ title: 'A', date: '2024-01-02', text: 'Bartek', powiazania: { pomin: ['x'], jako: { bartek: 'Bartek W' } } }],
  }))
  assert.equal(r.people.length, 1)
  assert.deepEqual(r.people[0].aliases, ['Monia'])
  assert.equal(r.symbols[0].meaning, 'mój kot')
  assert.deepEqual(r.dreams[0].link, { skip: ['x'], force: { bartek: 'Bartek W' } })
})

test('suggestNewPeople pomija nazwiska znanych osób i nazwy symboli', () => {
  const texts = ['Rozmawiałam z Prusem i Mila', 'Znowu Prusa i Mila', 'Była Mila', 'Była Monia i Monią', 'Spotkałam Monię']
  const c = suggestNewPeople(texts, [{ id: 'n', name: 'Natalia Prus' }], { exclude: ['Mila'] })
  assert.deepEqual(c.map(x => x.name), ['Monia'])
})

test('plan: symbole i kategoria wskazane w pliku wprost', () => {
  const r = parseDreamFile(JSON.stringify({
    dreams: [{ title: 'A', date: '2024-01-02', text: 'Byłam w wodzie', symbole: ['Woda', 'Nieznany'], kategoria: 'Walki duchowej', category: 'zwykly', emotions: ['lek'], kinds: ['walka'] }],
    categories: [{ name: 'Walki duchowej', color: '#123456' }],
  }))
  assert.equal(r.categories.length, 1)
  assert.deepEqual(r.dreams[0].symbolNames, ['Woda', 'Nieznany'])
  const plan = planDreamImport({
    dreams: r.dreams, people: [], symbols: [{ id: 's1', name: 'Woda' }],
    categories: [{ id: 'imp-cat-walki', label: 'Walki duchowej' }],
  })
  const d = plan.toAdd[0].data
  assert.deepEqual(d.symbolIds, ['s1'])
  assert.equal(d.category, 'imp-cat-walki')
  assert.deepEqual(d.emotions, ['lek'])
  assert.deepEqual(d.kinds, ['walka'])
  assert.deepEqual(plan.perCategory, { 'imp-cat-walki': 1 })
})

test('krótkie symbole nie łapią obcych słów (lew ≠ lewo)', () => {
  const sym = [{ id: 'l', name: 'Lew' }, { id: 'd', name: 'Dom' }]
  assert.deepEqual(linkText('Skręciłam w lewo, lewej strony', [], sym).symbolIds, [])
  assert.deepEqual(linkText('Wszedłam do domu i domku', [], sym).symbolIds, ['d'])
  assert.deepEqual(linkText('Zjadł mnie lew', [], sym).symbolIds, ['l'])
})
