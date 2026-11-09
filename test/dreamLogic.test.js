import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DREAM_EMOTIONS, DREAM_CATEGORIES, SYMBOL_COLORS,
  getEmotion, getCategory, parseMentions, parseSymbols, dreamPeopleIds, nameStem, personForms,
  detectTrigger, tokenizeDreamText, mergeDreamCategories, findDreamCategory,
} from '../src/utils/dreamLogic.js'

test('tokenizeDreamText: #symbol podświetlony bez prefiksu, z id i kolorem', () => {
  const symbols = [{ id: 's1', name: 'drzewo', color: '#5BB6D9' }]
  const segs = tokenizeDreamText('Widziałam #drzewo w parku', [], symbols)
  const sym = segs.find(s => s.kind === 'symbol')
  assert.equal(sym.t, 'drzewo')
  assert.equal(sym.id, 's1')
  assert.equal(sym.color, '#5BB6D9')
  // prefiks # nie trafia do tekstu
  assert.ok(!segs.some(s => s.t.includes('#')))
})

test('tokenizeDreamText: #symbol wielowyrazowy dopasowany po nazwie', () => {
  const symbols = [{ id: 's1', name: 'stary dom', color: '#fff' }]
  const segs = tokenizeDreamText('Śniłam #stary dom nocą', [], symbols)
  const sym = segs.find(s => s.kind === 'symbol')
  assert.equal(sym.t, 'stary dom')
  assert.equal(sym.id, 's1')
  // reszta zostaje zwykłym tekstem
  assert.ok(segs.some(s => s.kind === 'plain' && s.t.includes('nocą')))
})

test('tokenizeDreamText: @osoba dopasowana po formie, bez prefiksu, z id', () => {
  const people = [{ id: 'p1', name: 'Kasia', color: '#E8607A' }]
  const segs = tokenizeDreamText('Byłam z @Kasia nad morzem', people, [])
  const per = segs.find(s => s.kind === 'person')
  assert.equal(per.t, 'Kasia')
  assert.equal(per.id, 'p1')
  assert.equal(per.color, '#E8607A')
})

test('tokenizeDreamText: @osoba nierozpoznana i tak podświetlona (id null)', () => {
  const segs = tokenizeDreamText('spotkałam @Zenobia', [], [])
  const per = segs.find(s => s.kind === 'person')
  assert.equal(per.t, 'Zenobia')
  assert.equal(per.id, null) // brak dopasowania → nadal podświetlone
})

test('tokenizeDreamText: stary sen bez # — dokładna nazwa symbolu też podświetlona', () => {
  const symbols = [{ id: 's1', name: 'woda', color: '#5BB6D9' }]
  const segs = tokenizeDreamText('piłam wodę i woda była zimna', [], symbols)
  const syms = segs.filter(s => s.kind === 'symbol')
  assert.equal(syms.length, 1) // tylko dokładne „woda", nie „wodę"
  assert.equal(syms[0].t, 'woda')
})

test('tokenizeDreamText: wielowyrazowy symbol w zwykłym tekście (bez #)', () => {
  const symbols = [{ id: 's1', name: 'stary dom', color: '#abc' }]
  const segs = tokenizeDreamText('wróciłam do stary dom i spałam', [], symbols)
  const syms = segs.filter(s => s.kind === 'symbol')
  assert.equal(syms.length, 1)
  assert.equal(syms[0].t, 'stary dom')
  assert.equal(syms[0].id, 's1')
})

test('tokenizeDreamText: dłuższa nazwa wygrywa (stary dom > dom)', () => {
  const symbols = [{ id: 'd', name: 'dom' }, { id: 'sd', name: 'stary dom' }]
  const segs = tokenizeDreamText('to był stary dom', [], symbols)
  const syms = segs.filter(s => s.kind === 'symbol')
  assert.equal(syms.length, 1)
  assert.equal(syms[0].id, 'sd')
})

test('tokenizeDreamText: nazwa symbolu w środku słowa nie łapie', () => {
  const symbols = [{ id: 'd', name: 'dom' }]
  const segs = tokenizeDreamText('domek na wsi', [], symbols)
  assert.ok(!segs.some(s => s.kind === 'symbol')) // „domek" != „dom"
})

test('tokenizeDreamText: e-mail nie jest traktowany jak @osoba', () => {
  const segs = tokenizeDreamText('napisz na a@b', [], [])
  assert.ok(!segs.some(s => s.kind === 'person'))
})

test('tokenizeDreamText: pusty tekst → pusto', () => {
  assert.deepEqual(tokenizeDreamText('', [], []), [])
})

test('detectTrigger: #symbol jednowyrazowy', () => {
  const t = detectTrigger('Śniło mi się #drzewo')
  assert.equal(t.type, 'symbol')
  assert.equal(t.query, 'drzewo')
  assert.equal(t.start, 13) // pozycja znaku #
})

test('detectTrigger: #symbol wielowyrazowy (do 4 słów)', () => {
  assert.equal(detectTrigger('#stary dom').query, 'stary dom')
  assert.equal(detectTrigger('#dom nad jeziorem').query, 'dom nad jeziorem')
  assert.equal(detectTrigger('#a b c d').query, 'a b c d')
})

test('detectTrigger: spacja po ostatnim słowie kończy tag', () => {
  assert.equal(detectTrigger('#drzewo '), null)
  assert.equal(detectTrigger('#stary dom '), null)
})

test('detectTrigger: powyżej 4 słów przestaje być tagiem (zwykłe zdanie)', () => {
  assert.equal(detectTrigger('#a b c d e'), null)
})

test('detectTrigger: samo # otwiera przeglądanie (pusty query)', () => {
  const t = detectTrigger('opis #')
  assert.equal(t.type, 'symbol')
  assert.equal(t.query, '')
})

test('detectTrigger: @osoba to jedno słowo, kończy się na spacji', () => {
  assert.equal(detectTrigger('spotkałam @Kasia').query, 'Kasia')
  assert.equal(detectTrigger('spotkałam @Kasia w'), null) // @ to jedno słowo
})

test('detectTrigger: interpunkcja kończy tag symbolu', () => {
  assert.equal(detectTrigger('#dom, potem'), null)
  assert.equal(detectTrigger('#dom.'), null)
})

test('detectTrigger: brak triggera w zwykłym tekście', () => {
  assert.equal(detectTrigger('zwykły tekst bez znaczników'), null)
})

const people = [
  { id: 'p1', name: 'Kasia' },
  { id: 'p2', name: 'Przyjaciel Paweł' },
  { id: 'p3', name: 'Ola' },
]

test('parseMentions — znajduje osobę po @Imię', () => {
  assert.deepEqual(parseMentions('Śniła mi się @Kasia w domu', people), ['p1'])
})

test('parseMentions — imię wielowyrazowe (najdłuższe dopasowanie)', () => {
  assert.deepEqual(parseMentions('był tam @Przyjaciel Paweł', people), ['p2'])
})

test('parseMentions — granica słowa: @Kasiaziom nie pasuje do Kasia', () => {
  assert.deepEqual(parseMentions('@Kasiaziom', people), [])
})

test('parseMentions — pusty/brak tekstu', () => {
  assert.deepEqual(parseMentions('', people), [])
  assert.deepEqual(parseMentions('nic ciekawego', people), [])
})

test('parseMentions — wiele osób', () => {
  const r = parseMentions('@Kasia i @Ola', people)
  assert.equal(r.length, 2)
  assert.ok(r.includes('p1') && r.includes('p3'))
})

test('personForms — pełne imię, samo imię i ksywki, bez duplikatów', () => {
  assert.deepEqual(personForms({ name: 'Manuela Filipska', aliases: ['Manka', 'Manuela'] }),
    ['Manuela Filipska', 'Manuela', 'Manka'])
  assert.deepEqual(personForms({ name: 'Ola' }), ['Ola'])
  assert.deepEqual(personForms(null), [])
})

test('parseMentions — dopasowuje po ksywce (aliasie)', () => {
  const ppl = [{ id: 'p1', name: 'Manuela Filipska', aliases: ['Manka'] }]
  assert.deepEqual(parseMentions('była tam @Manka', ppl), ['p1'])
  assert.deepEqual(parseMentions('oraz @Manuela na końcu', ppl), ['p1'])
})

test('parseSymbols — znajduje #symbol', () => {
  const symbols = [{ id: 's1', name: 'drzewo' }, { id: 's2', name: 'dom' }]
  assert.deepEqual(parseSymbols('rosło #drzewo obok #dom', symbols), ['s1', 's2'])
})

test('parseSymbols — granica słowa', () => {
  const symbols = [{ id: 's1', name: 'dom' }]
  assert.deepEqual(parseSymbols('#domek', symbols), [])
})

test('dreamPeopleIds — suma uczestników i wspomnianych, bez duplikatów', () => {
  assert.deepEqual(dreamPeopleIds({ peopleIds: ['a', 'b'], mentionIds: ['b', 'c'] }), ['a', 'b', 'c'])
  assert.deepEqual(dreamPeopleIds({}), [])
})

test('nameStem — odmiana imion żeńskich', () => {
  assert.equal(nameStem('Kasia'), 'Kasi')
  assert.equal(nameStem('Ola'), 'Ol')
})

test('nameStem — imię zakończone spółgłoską bez zmian', () => {
  assert.equal(nameStem('Marek'), 'Marek')
})

test('nameStem — bardzo krótkie / puste', () => {
  assert.equal(nameStem('Ka'), 'Ka')
  assert.equal(nameStem(''), '')
  assert.equal(nameStem(undefined), '')
})

test('getCategory / getEmotion — trafienie i brak', () => {
  assert.equal(getCategory('koszmar').label, 'Koszmar')
  assert.equal(getEmotion('lek').label, 'Lęk')
  assert.equal(getCategory('nie-istnieje'), undefined)
})

test('stałe mają unikalne id i poprawne kolory hex', () => {
  for (const list of [DREAM_EMOTIONS, DREAM_CATEGORIES]) {
    const ids = list.map(x => x.id)
    assert.equal(new Set(ids).size, ids.length, 'id muszą być unikalne')
    for (const item of list) assert.match(item.color, /^#[0-9A-Fa-f]{6}$/)
  }
  for (const c of SYMBOL_COLORS) assert.match(c, /^#[0-9A-Fa-f]{6}$/)
})

// Strażnik wymagania: w kategoriach/emocjach snów NIE MA emotek
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u
test('kategorie i emocje snów nie zawierają emotek', () => {
  for (const item of [...DREAM_EMOTIONS, ...DREAM_CATEGORIES]) {
    assert.ok(!EMOJI.test(item.label + item.id), `emotka w: ${item.label}`)
  }
})

/* ─── Własne kategorie snów ─────────────────────────────────────────────── */

test('mergeDreamCategories — własne dopisane na końcu, wbudowane nietknięte', () => {
  const merged = mergeDreamCategories([{ id: 'x1', label: 'Lotne', color: '#123456' }])
  assert.equal(merged.length, DREAM_CATEGORIES.length + 1)
  assert.deepEqual(merged.slice(0, DREAM_CATEGORIES.length), DREAM_CATEGORIES)
  assert.deepEqual(merged.at(-1), { id: 'x1', label: 'Lotne', color: '#123456', custom: true })
})

test('mergeDreamCategories — pusto/nic nie psuje wbudowanych', () => {
  assert.deepEqual(mergeDreamCategories(), DREAM_CATEGORIES)
  assert.deepEqual(mergeDreamCategories([]), DREAM_CATEGORIES)
  assert.deepEqual(mergeDreamCategories(null), DREAM_CATEGORIES)
})

test('mergeDreamCategories — odsiewa śmieci i kolizje id z wbudowanymi', () => {
  const merged = mergeDreamCategories([
    null, {}, { label: 'bez id' },
    { id: 'koszmar', label: 'Podszywka' },
  ])
  assert.deepEqual(merged, DREAM_CATEGORIES)
})

test('mergeDreamCategories — bierze `name`, gdy nie ma `label`, i domyka braki', () => {
  const [extra] = mergeDreamCategories([{ id: 'x2', name: 'Z bazy' }]).slice(-1)
  assert.equal(extra.label, 'Z bazy')
  assert.equal(extra.color, '#9E9E9E')
  const [pusty] = mergeDreamCategories([{ id: 'x3', label: '   ' }]).slice(-1)
  assert.equal(pusty.label, 'Bez nazwy')
})

test('findDreamCategory — szuka w podanej liście, bez listy we wbudowanych', () => {
  const cats = mergeDreamCategories([{ id: 'x1', label: 'Lotne' }])
  assert.equal(findDreamCategory(cats, 'x1').label, 'Lotne')
  assert.equal(findDreamCategory(cats, 'koszmar').label, 'Koszmar')
  assert.equal(findDreamCategory([], 'koszmar').label, 'Koszmar')
  assert.equal(findDreamCategory(cats, 'nie-ma'), undefined)
})

// ─── Odmiany imion przy @ ───────────────────────────────────────────────────
const _fmLE = (a, b) => { const r = _fm(a, b); return r && { len: r.len, exact: r.exact } }
import { formMatch as _fm, bestPersonMatch as _bpm, parseMentions as _pm, tokenizeDreamText as _tok } from '../src/utils/dreamLogic.js'

const LUDZIE = [
  { id: 'mt', name: 'Mateusz Telenga' },
  { id: 'mo', name: 'Mateusz Tomczak', aliases: ['Mat', 'Mati', 'Matiego', 'Matim'] },
  { id: 'ka', name: 'Kasia Nowak' },
  { id: 'fr', name: 'Franek Wielgus' },
  { id: 'ma', name: 'Manuela Filipska', aliases: ['Man', 'Mana', 'Many', 'Manueli'] },
  { id: 'ol', name: 'Ola Kowal' },
  { id: 'ro', name: 'Rodzice' },
]

test('formMatch: dosłowne i odmienione', () => {
  assert.deepEqual(_fmLE('mateusz i', 'Mateusz'), { len: 7, exact: true })
  assert.deepEqual(_fmLE('mateusza w', 'Mateusz'), { len: 8, exact: false })
  assert.deepEqual(_fmLE('kasię w', 'Kasia'), { len: 5, exact: false })
  assert.deepEqual(_fmLE('franka w', 'Franek'), { len: 6, exact: false })
  assert.deepEqual(_fmLE('jankiem w', 'Janek'), { len: 7, exact: false })
  assert.equal(_fm('olek', 'Ola'), null)          // krótka forma tylko dosłownie
  assert.equal(_fm('mateuszowskiego', 'Mateusz'), null) // za długa końcówka
})

test('parseMentions łączy odmienione imiona', () => {
  assert.deepEqual(_pm('Byłam z @Kasię i @Franka w domu', LUDZIE).sort(), ['fr', 'ka'])
  assert.deepEqual(_pm('Rozmowa z @Manueli o @Rodziców', LUDZIE).sort(), ['ma', 'ro'])
})

test('dosłowne dopasowanie wygrywa z odmianą innej osoby', () => {
  // „Mateusz" dosłownie pasuje do dwóch osób (oba remisują), „Matiego" tylko do aliasu Tomczaka
  assert.deepEqual(_bpm('mateusz', LUDZIE).ids.sort(), ['mo', 'mt'])
  assert.deepEqual(_bpm('matiego rano', LUDZIE).ids, ['mo'])
})

test('tokenizeDreamText linkuje odmienione imię z id osoby', () => {
  const segs = _tok('Rozmawiałam z @Kasię wieczorem', LUDZIE, [])
  const p = segs.find(s => s.kind === 'person')
  assert.equal(p.t, 'Kasię')
  assert.equal(p.id, 'ka')
})

test('krótkie formy nie łapią obcych słów (Karo ≠ kartę, Zach ≠ zachować)', () => {
  assert.equal(_fm('kartę w', 'Karo'), null)
  assert.equal(_fm('zachować', 'Zach'), null)
  assert.deepEqual(_fmLE('zuzą w', 'Zuza'), { len: 4, exact: false })
  assert.deepEqual(_fmLE('maną', 'Mana'), { len: 4, exact: false })
  assert.deepEqual(_fmLE('kubie', 'Kuba'), { len: 5, exact: false })
})

test('pastorową trafia w Olę (pastorowa), a nie w pastora; „mamy" to nie mama', () => {
  const L = [{ id: 'o', name: 'Ola W', aliases: ['pastorowa'] }, { id: 'w', name: 'Wojciech W', aliases: ['pastor'] }, { id: 'b', name: 'Bożena N', aliases: ['mama'] }]
  assert.deepEqual(_bpm('pastorową i', L).ids, ['o'])
  assert.deepEqual(_bpm('pastorem z', L).ids, ['w'])
  assert.equal(_bpm('mamy jej', L), null)
  assert.deepEqual(_bpm('mamie w', L).ids, ['b'])
})

test('symbole z połączonymi formami — #forma przypina ten sam symbol, wyszukiwanie i parsowanie', async () => {
  const { symbolForms, parseAliasInput, symbolMatchesQuery, parseSymbols, tokenizeDreamText } = await import('../src/utils/dreamLogic.js')
  const drzewo = { id: 'd1', name: 'drzewo', aliases: ['drzewa', 'Drzewem', 'drzewo'] }
  const woda = { id: 'w1', name: 'woda' }
  assert.deepEqual(symbolForms(drzewo), ['drzewo', 'drzewa', 'Drzewem'])
  assert.deepEqual(parseAliasInput('#drzewa, drzewem ; # stare drzewo,'), ['drzewa', 'drzewem', 'stare drzewo'])
  assert.ok(symbolMatchesQuery(drzewo, 'drzew'))
  assert.ok(symbolMatchesQuery(drzewo, 'DRZEWEM'))
  assert.ok(!symbolMatchesQuery(woda, 'drzew'))
  assert.deepEqual(parseSymbols('Stałam pod #drzewem i #woda', [drzewo, woda]).sort(), ['d1', 'w1'])
  const segs = tokenizeDreamText('Widziałam #drzewa nad rzeką', [], [drzewo])
  assert.ok(segs.some(s => s.kind === 'symbol' && s.id === 'd1' && s.t === 'drzewa'))
})
