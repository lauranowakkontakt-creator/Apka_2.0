import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReview, defaultDecisions, resolveReview, assignCategory, matchAccount, reviewKeys, guessAccountType } from '../src/utils/importReview.js'

const it = (type, category, subcategory, o = {}) => ({ type, amount: 1, currency: 'PLN', description: '', raw: { category, subcategory, account: 'PKO', detail: '', bank: '' }, ...o })
const APP = {
  expense: [{ id: 'zakupy', label: 'Zakupy', subcategories: [{ id: 's_spoz', label: 'Spożywcze' }] }, { id: 'inne', label: 'Inne' }],
  income: [{ id: 'inne', label: 'Inne' }],
}
const items = [
  it('expense', 'Zakupy', 'Spożywcze', { raw: { category: 'Zakupy', subcategory: 'Spożywcze', account: 'PKO', detail: 'Biedronka' } }),
  it('expense', 'Zakupy', 'Online'),
  it('expense', 'Jedzenie miasto', 'Fastfood'),
  it('expense', 'Jedzenie miasto', ''),
  it('income', 'Rodzice', 'Kieszonkowe'),
  { ...it('income', 'Przelew wewnętrzny', 'Między kontami'), transfer: true },
]

test('buildReview — drzewo, przelewy osobno, przykłady', () => {
  const r = buildReview(items)
  assert.equal(r.transfers, 1)
  assert.deepEqual(r.cats.map(c => c.key), ['expense|Jedzenie miasto', 'expense|Zakupy', 'income|Rodzice'])
  const zak = r.cats.find(c => c.label === 'Zakupy')
  assert.deepEqual(zak.subs.find(s => s.label === 'Spożywcze').examples, ['Biedronka'])
  assert.equal(r.accounts[0].name, 'PKO')
  assert.equal(reviewKeys(r).length, 3 + 5 + 1)   // + Spożywcze → Biedronka (3. poziom)
})

test('defaultDecisions — dopasowuje do apki po nazwie', () => {
  const r = buildReview(items)
  const d = defaultDecisions(r, APP, [])
  assert.equal(d.cats['expense|Zakupy'].target, 'app:zakupy')
  assert.equal(d.cats['expense|Jedzenie miasto'].target, 'new')
  assert.equal(d.subs['expense|Jedzenie miasto|'].parent, 'none')
  assert.deepEqual(d.approved, {})
})

test('resolveReview — bez zmian: istniejące zostają, brakujące dochodzą', () => {
  const r = buildReview(items)
  const res = resolveReview(r, defaultDecisions(r, APP, []), APP)
  const zak = res.categories.expense.find(c => c.id === 'zakupy')
  assert.deepEqual(zak.subcategories.map(s => s.label), ['Spożywcze', 'Online'])
  assert.equal(assignCategory(items[0], res).subcategoryId, 's_spoz')    // istniejąca podkategoria
  const jm = assignCategory(items[2], res)
  assert.equal(jm.category, 'Jedzenie miasto')
  assert.equal(jm.subcategoryLabel, 'Fastfood')
  assert.equal(assignCategory(items[3], res).subcategoryId, null)
  assert.equal(assignCategory(items[5], res).categoryId, 'transfer')
  assert.ok(res.created.some(c => c.label === 'Jedzenie miasto'))
})

test('resolveReview — zmiana nazwy, przeniesienie, połączenie', () => {
  const r = buildReview(items)
  const d = defaultDecisions(r, APP, [])
  d.cats['expense|Zakupy'].name = 'Sklepy'                                // zmiana nazwy istniejącej
  d.subs['expense|Zakupy|Online'] = { name: 'Internet', parent: 'file:expense|Jedzenie miasto' } // przeniesienie + nazwa
  d.cats['income|Rodzice'] = { name: 'Rodzice', target: 'app:inne' }    // połączenie z istniejącą
  const res = resolveReview(r, d, APP)
  assert.equal(res.categories.expense.find(c => c.id === 'zakupy').label, 'Sklepy')
  assert.deepEqual(res.renamed, [{ from: 'Zakupy', to: 'Sklepy' }, { from: 'Inne', to: 'Rodzice' }])
  const online = assignCategory(items[1], res)
  assert.equal(online.category, 'Jedzenie miasto')
  assert.equal(online.subcategoryLabel, 'Internet')
  assert.equal(assignCategory(items[4], res).categoryId, 'inne')
})

test('resolveReview — „połącz z" kategorią z pliku i nowa o nazwie istniejącej', () => {
  const r = buildReview(items)
  const d = defaultDecisions(r, APP, [])
  d.cats['expense|Jedzenie miasto'] = { name: 'x', target: 'file:expense|Zakupy' }
  const res = resolveReview(r, d, APP)
  assert.equal(assignCategory(items[2], res).categoryId, 'zakupy')
  assert.ok(res.categories.expense.find(c => c.id === 'zakupy').subcategories.some(s => s.label === 'Fastfood'))
  // cykl „połącz z" nie zawiesza i nie gubi transakcji
  d.cats['expense|Zakupy'] = { name: 'Zakupy', target: 'file:expense|Jedzenie miasto' }
  const res2 = resolveReview(r, d, APP)
  assert.ok(assignCategory(items[2], res2).categoryId)
  // nowa kategoria nazwana jak istniejąca = połączenie
  const d3 = defaultDecisions(r, APP, [])
  d3.cats['expense|Jedzenie miasto'].name = 'inne'
  assert.equal(assignCategory(items[2], resolveReview(r, d3, APP)).categoryId, 'inne')
})

test('matchAccount — nazwy z pliku do kont w apce', () => {
  const accs = [
    { id: 'p', name: 'PKO', currency: 'PLN' }, { id: 'e', name: 'ERSTE firmowe', currency: 'PLN' },
    { id: 'g', name: 'Gotówka', currency: 'PLN' }, { id: 're', name: 'Revolut euro', currency: 'EUR' },
    { id: 'r1', name: 'Revolut', currency: 'PLN', type: 'investment' }, { id: 'r2', name: 'Revolut', currency: 'PLN', type: 'revolut' },
  ]
  assert.equal(matchAccount('PKO', 'PLN', accs).id, 'p')
  assert.equal(matchAccount('Erste (firmowe)', 'PLN', accs).id, 'e')
  assert.equal(matchAccount('Gotówka (z arkusza)', 'PLN', accs).id, 'g')
  assert.equal(matchAccount('Revolut EUR', 'EUR', accs).id, 're')
  assert.equal(matchAccount('Revolut', 'PLN', accs).id, 'r2')
  assert.equal(matchAccount('mBank', 'PLN', accs), null)
  assert.equal(matchAccount('Revolut CZK', 'CZK', accs), null)   // inna waluta = nowe konto
  assert.equal(guessAccountType('Gotówka (z arkusza)'), 'cash')
})

test('trzeci poziom — z kolumny Szczegół, dopasowany po nazwie albo dopisany', () => {
  const APP3 = { expense: [{ id: 'jm', label: 'Jedzenie miasto', subcategories: [{ id: 'ff', label: 'Fastfood', subcategories: [{ id: 'mc', label: "McDonald's" }] }] }], income: [] }
  const xs = [
    it('expense', 'Jedzenie miasto', 'Fastfood', { raw: { category: 'Jedzenie miasto', subcategory: 'Fastfood', detail: "McDonald's" } }),
    it('expense', 'Jedzenie miasto', 'Fastfood', { raw: { category: 'Jedzenie miasto', subcategory: 'Fastfood', detail: 'Pizza' } }),
    it('expense', 'Jedzenie miasto', 'Fastfood'),
  ]
  const r = buildReview(xs)
  const ff = r.cats[0].subs[0]
  assert.deepEqual(ff.subs.map(k => k.label).sort(), ["McDonald's", 'Pizza'])
  const d = defaultDecisions(r, APP3, [])
  d.subs[ff.subs.find(k => k.label === 'Pizza').key].name = 'Pizzeria'
  const res = resolveReview(r, d, APP3)
  assert.equal(assignCategory(xs[0], res).subsubcategoryId, 'mc')
  const pz = assignCategory(xs[1], res)
  assert.equal(pz.subsubcategoryLabel, 'Pizzeria')
  assert.equal(pz.subcategoryId, 'ff')
  assert.equal(assignCategory(xs[2], res).subsubcategoryId, null)
  assert.deepEqual(res.categories.expense[0].subcategories[0].subcategories.map(x => x.label), ["McDonald's", 'Pizzeria'])
  // stan apki nietknięty
  assert.equal(APP3.expense[0].subcategories[0].subcategories.length, 1)
})
