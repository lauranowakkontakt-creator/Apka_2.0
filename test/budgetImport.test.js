import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCSV, detectDelimiter, findHeaderRow, guessMapping, parseDate, parseBankAmount,
  rowsToTransactions, markDuplicates, balanceDeltas, chunk, decodeBytes,
} from '../src/utils/budgetImport.js'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../src/utils/categories.js'

const opts = { expenseCats: DEFAULT_EXPENSE_CATEGORIES, incomeCats: DEFAULT_INCOME_CATEGORIES }

test('parseCSV — średnik, cudzysłowy, BOM i nowa linia w polu', () => {
  const rows = parseCSV('\uFEFFData;Opis;Kwota\r\n2026-01-02;"Sklep; ""Ala""";-12,50\n\n2026-01-03;"dwie\nlinie";5\n')
  assert.deepEqual(rows, [
    ['Data', 'Opis', 'Kwota'],
    ['2026-01-02', 'Sklep; "Ala"', '-12,50'],
    ['2026-01-03', 'dwie\nlinie', '5'],
  ])
})

test('detectDelimiter — średnik mimo przecinków w kwotach', () => {
  assert.equal(detectDelimiter('a;b;c\n1,5;2,5;x\n3;4;y'), ';')
  assert.equal(detectDelimiter('a,b,c\n1,2,3'), ',')
  assert.equal(detectDelimiter('a\tb\n1\t2'), '\t')
})

test('parseDate — formaty polskie i ISO, odrzuca bzdury', () => {
  assert.equal(parseDate('2026-03-05').getDate(), 5)
  assert.equal(parseDate('05.03.2026').getMonth(), 2)
  assert.equal(parseDate('5/3/2026 10:11').getDate(), 5)
  assert.equal(parseDate('2026-03-05 10:11:12').getFullYear(), 2026)
  assert.equal(parseDate('31.02.2026'), null)
  assert.equal(parseDate('wczoraj'), null)
})

test('parseBankAmount — znak, waluta, separator tysięcy, nawias', () => {
  assert.equal(parseBankAmount('-1 234,56 PLN'), -1234.56)
  assert.equal(parseBankAmount('−12,50'), -12.5)
  assert.equal(parseBankAmount('+4500,00'), 4500)
  assert.equal(parseBankAmount('(9,99)'), -9.99)
  assert.equal(parseBankAmount('-12.50'), -12.5)
  assert.ok(Number.isNaN(parseBankAmount('abc')))
  assert.ok(Number.isNaN(parseBankAmount('')))
})

test('mBank: nagłówek pod preambułą, kwota ze znakiem', () => {
  const csv = [
    'mBank S.A. Bankowość Detaliczna;',
    '#Klient;',
    'JAN KOWALSKI;',
    '',
    '#Data operacji;#Opis operacji;#Rachunek;#Kategoria;#Kwota;',
    '2026-11-02;BIEDRONKA 1234 WARSZAWA;eKonto;Żywność;-23,40 PLN;',
    '2026-11-03;WYNAGRODZENIE ZA PAŹDZIERNIK;eKonto;Wpływy;4 500,00 PLN;',
  ].join('\n')
  const rows = parseCSV(csv)
  const h = findHeaderRow(rows)
  assert.equal(rows[h][0], '#Data operacji')
  const map = guessMapping(rows[h])
  assert.equal(map.date, 0)
  assert.equal(map.amount, 4)
  const { items, errors } = rowsToTransactions(rows.slice(h + 1), map, opts)
  assert.equal(errors.length, 0)
  assert.equal(items[0].type, 'expense')
  assert.equal(items[0].amount, 23.4)
  assert.equal(items[0].categoryId, 'jedzenie')     // „Żywność" nie pasuje → słowo „biedronka"
  assert.equal(items[1].type, 'income')
  assert.equal(items[1].amount, 4500)
  assert.equal(items[1].categoryId, 'wynagrodzenie')
})

test('osobne kolumny obciążeń i uznań', () => {
  const rows = parseCSV('Data;Kontrahent;Tytuł;Obciążenia;Uznania\n02.11.2026;Orlen;paliwo;120,00;\n03.11.2026;Jan;zwrot za bilety;;50,00')
  const map = guessMapping(rows[0])
  assert.equal(map.debit, 3)
  assert.equal(map.credit, 4)
  const { items } = rowsToTransactions(rows.slice(1), map, opts)
  assert.deepEqual(items.map(i => [i.type, i.amount, i.categoryId]), [
    ['expense', 120, 'paliwo'],
    ['income', 50, 'zwrot'],
  ])
  assert.equal(items[0].description, 'Orlen — paliwo')
})

test('eksport Apki wraca bez strat: typ, kategoria po nazwie, konto po id', () => {
  const rows = parseCSV('\uFEFFData,Typ,Kwota,Kategoria,Podkategoria,Opis,Konto\n2026-10-01,wydatek,12.5,Kawa / Cafe,,latte,acc1\n2026-10-02,przychód,100,Premia,,,acc1')
  const map = guessMapping(rows[0])
  const { items } = rowsToTransactions(rows.slice(1), map, { ...opts, accounts: [{ id: 'acc1', name: 'Główne' }] })
  assert.equal(items[0].type, 'expense')        // kwota bez znaku, ale Typ = wydatek
  assert.equal(items[0].categoryId, 'kawa')
  assert.equal(items[0].accountId, 'acc1')
  assert.equal(items[1].type, 'income')
  assert.equal(items[1].categoryId, 'premia')
})

test('złe wiersze trafiają do błędów, nie do importu', () => {
  const { items, errors } = rowsToTransactions(
    [['zła data', '-5'], ['2026-01-01', 'xx'], ['2026-01-01', '0'], ['2026-01-01', '-5']],
    { date: 0, amount: 1 }, opts)
  assert.equal(items.length, 1)
  assert.deepEqual(errors.map(e => e.line), [1, 2, 3])
  assert.equal(items[0].categoryId, 'inne')
})

test('markDuplicates — liczy wystąpienia, opis bez znaczenia', () => {
  const day = new Date(2026, 0, 5, 12)
  const items = [
    { date: day, type: 'expense', amount: 12 },
    { date: day, type: 'expense', amount: 12 },
    { date: day, type: 'income', amount: 12 },
  ]
  const existing = [{ date: new Date(2026, 0, 5, 18), type: 'expense', amount: 12, description: 'kawa' }]
  assert.deepEqual(markDuplicates(items, existing).map(i => i.duplicate), [true, false, false])
})

test('balanceDeltas i chunk', () => {
  assert.deepEqual(balanceDeltas([
    { accountId: 'a', type: 'expense', amount: 10.1 },
    { accountId: 'a', type: 'income', amount: 0.2 },
    { accountId: null, type: 'income', amount: 5 },
  ]), { a: -9.9 })
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
})

test('decodeBytes — Windows-1250 z polskimi znakami', () => {
  // „Żółw" w cp1250: Ż=0xAF ó=0xF3 ł=0xB3 w=0x77
  assert.equal(decodeBytes(new Uint8Array([0xAF, 0xF3, 0xB3, 0x77])), 'Żółw')
  assert.equal(decodeBytes(new TextEncoder().encode('Żółw')), 'Żółw')
})
