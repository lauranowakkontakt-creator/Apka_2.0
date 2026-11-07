import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { readXlsx, colIndex, parseSharedStrings, isZip } from '../src/utils/xlsxReader.js'
import { parseDate, parseForeign, guessMapping, rowsToTransactions } from '../src/utils/budgetImport.js'

// Minimalny ZIP (deflate) z podanych plików — do testu bez prawdziwego Excela.
function zip(files) {
  const enc = new TextEncoder(), parts = [], central = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const nb = enc.encode(name), data = deflateRawSync(enc.encode(text))
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8)
    lh.writeUInt32LE(data.length, 18); lh.writeUInt16LE(nb.length, 26)
    parts.push(lh, nb, data)
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10)
    ch.writeUInt32LE(data.length, 20); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(offset, 42)
    central.push(ch, nb)
    offset += 30 + nb.length + data.length
  }
  const cd = Buffer.concat(central)
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16)
  return new Uint8Array(Buffer.concat([...parts, cd, end]))
}

const BOOK = {
  'xl/workbook.xml': '<workbook><sheets><sheet name="Lata" sheetId="1" r:id="rId1"/><sheet name="Transakcje &amp; co" sheetId="2" r:id="rId2"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
  'xl/sharedStrings.xml': '<sst><si><t>Data</t></si><si><t>Kwota (zł)</t></si><si><r><t>Zakupy</t></r><r><t xml:space="preserve"> &amp; dom</t></r></si><si><t>Wydatek</t></si></sst>',
  'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Podsumowanie</t></is></c></row></sheetData></worksheet>',
  'xl/worksheets/sheet2.xml': '<worksheet><sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>Kategoria</t></is></c><c r="E1" t="inlineStr"><is><t>Typ</t></is></c></row>' +
    '<row r="2"><c r="A2" s="1"><v>43263</v></c><c r="B2"><v>-33.24</v></c><c r="D2" t="s"><v>2</v></c><c r="E2" t="s"><v>3</v></c></row>' +
    '<row r="3"/></sheetData></worksheet>',
}

test('readXlsx — arkusze, wspólne napisy, tekst sformatowany, puste kolumny', async () => {
  const bytes = zip(BOOK)
  assert.ok(isZip(bytes))
  const sheets = await readXlsx(bytes)
  assert.deepEqual(sheets.map(s => s.name), ['Lata', 'Transakcje & co'])
  assert.deepEqual(sheets[1].rows, [
    ['Data', 'Kwota (zł)', '', 'Kategoria', 'Typ'],
    ['43263', '-33.24', '', 'Zakupy & dom', 'Wydatek'],
  ])
  const map = guessMapping(sheets[1].rows[0])
  const { items } = rowsToTransactions(sheets[1].rows.slice(1), map, { expenseCats: [], incomeCats: [] })
  assert.equal(items[0].amount, 33.24)
  assert.equal(items[0].date.getFullYear(), 2018)
})

test('readXlsx — nie-ZIP daje czytelny błąd', async () => {
  await assert.rejects(readXlsx(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22])), /nie jest plik .xlsx/)
})

test('colIndex i parseSharedStrings', () => {
  assert.equal(colIndex('A1'), 0)
  assert.equal(colIndex('Z9'), 25)
  assert.equal(colIndex('AB12'), 27)
  assert.deepEqual(parseSharedStrings('<sst><si><t>a&lt;b</t></si><si/><si><t>x</t><rPh><t>ignoruj</t></rPh></si></sst>'), ['a<b', '', 'x'])
})

test('parseDate — numer dnia z Excela', () => {
  const d = parseDate('43263')
  assert.deepEqual([d.getFullYear(), d.getMonth() + 1, d.getDate()], [2018, 6, 12])
  assert.equal(parseDate('46332').getFullYear(), 2026)
  assert.equal(parseDate('12345'), null)
})

test('parseForeign i przelew wewnętrzny', () => {
  assert.deepEqual(parseForeign('5.59 USD'), { amount: 5.59, currency: 'USD' })
  assert.deepEqual(parseForeign('-3,47 EUR'), { amount: 3.47, currency: 'EUR' })
  assert.equal(parseForeign('12 XYZ'), null)
  assert.equal(parseForeign(''), null)
  const header = ['Data', 'Typ', 'Kwota (zł)', 'Konto', 'Kwota w walucie', 'Data dokładna', 'Podkategoria']
  const { items } = rowsToTransactions([['2022-06-30', 'Przelew wewnętrzny', '-25.10', 'Revolut USD', '5.59 USD', 'nie (tylko miesiąc)', 'Wymiana']],
    guessMapping(header), { expenseCats: [], incomeCats: [] })
  assert.equal(items[0].transfer, true)
  assert.equal(items[0].categoryId, 'transfer')
  assert.equal(items[0].type, 'expense')
  assert.equal(items[0].amount, 5.59)
  assert.equal(items[0].currency, 'USD')
  assert.equal(items[0].dateApprox, true)
})
