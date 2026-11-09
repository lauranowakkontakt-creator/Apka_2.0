import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// currency.js czyta localStorage przy wywołaniu — w Node podstawiamy prostą atrapę.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const { CURRENCIES, getCurrencyCode, fmt, parseAmount, splitAmount, MAX_AMOUNT } = await import('../src/utils/currency.js')

beforeEach(() => store.clear())

test('CURRENCIES — unikalne kody, komplet pól, PLN dostępny', () => {
  const codes = CURRENCIES.map(c => c.code)
  assert.equal(new Set(codes).size, codes.length)
  assert.ok(codes.includes('PLN'))
  for (const c of CURRENCIES) assert.ok(c.code && c.symbol && c.name)
})

test('getCurrencyCode — domyślnie PLN, wybrana waluta z listy jest zapamiętana', () => {
  assert.equal(getCurrencyCode(), 'PLN')
  localStorage.setItem('app_currency', 'EUR')
  assert.equal(getCurrencyCode(), 'EUR')
  localStorage.setItem('app_currency', 'XXX')
  assert.equal(getCurrencyCode(), 'PLN')
})

test('convert — przelicza przez złote, własny kurs ma pierwszeństwo', async () => {
  const { convert, setRate } = await import('../src/utils/currency.js')
  assert.equal(convert(100, 'PLN', 'PLN'), 100)
  assert.equal(convert(10, 'EUR', 'PLN'), 43)
  setRate('EUR', 5)
  assert.equal(convert(10, 'EUR', 'PLN'), 50)
  assert.equal(convert(50, 'PLN', 'EUR'), 10)
})

test('fmt — bez kodu formatuje w złotówkach (pl-PL)', () => {
  assert.match(fmt(1234.5), /1\s?234,50\s?zł$/u)
})

test('fmt — jawny kod waluty nadpisuje globalny (transakcja z portfela EUR)', () => {
  // Globalnie PLN, ale pojedynczą transakcję pokazujemy w jej walucie.
  assert.equal(getCurrencyCode(), 'PLN')
  assert.match(fmt(10, 'EUR'), /10,00\s?€$/u)
  assert.match(fmt(10, 'USD'), /10,00/u)
  // Bez kodu nadal działa globalna waluta.
  assert.match(fmt(10), /10,00\s?zł$/u)
})

test('fmt — null/undefined traktowane jak zero', () => {
  assert.match(fmt(null), /0,00/)
  assert.match(fmt(undefined), /0,00/)
})

test('parseAmount — kropka i przecinek dziesiętny', () => {
  assert.equal(parseAmount('12.50'), 12.5)
  assert.equal(parseAmount('12,50'), 12.5)
  assert.equal(parseAmount('0,99'), 0.99)
})

test('parseAmount — spacje (separator tysięcy) i liczby', () => {
  assert.equal(parseAmount('1 200'), 1200)
  assert.equal(parseAmount('1 200,75'), 1200.75)
  assert.equal(parseAmount(15), 15)
})

test('parseAmount — puste/nieprawidłowe wejście daje NaN (walidacja je odrzuca)', () => {
  assert.ok(Number.isNaN(parseAmount('')))
  assert.ok(Number.isNaN(parseAmount(null)))
  assert.ok(Number.isNaN(parseAmount(undefined)))
  assert.ok(Number.isNaN(parseAmount('abc')))
  // wzorzec używany w formularzach: !(parseAmount(x) > 0) blokuje NaN i zera
  assert.equal(!(parseAmount('abc') > 0), true)
  assert.equal(!(parseAmount('0') > 0), true)
  assert.equal(!(parseAmount('12,50') > 0), false)
})

test('splitAmount — rozbija na część całkowitą i grosze, grupuje tysiące', () => {
  const a = splitAmount(1203)
  assert.equal(a.int.replace(/\s/g, ''), '1203')
  assert.equal(a.dec, '00')

  const b = splitAmount(1234.5)
  assert.equal(b.int.replace(/\s/g, ''), '1234')
  assert.equal(b.dec, '50')
})

test('splitAmount — liczby ujemne dostają znak minus (U+2212)', () => {
  const a = splitAmount(-49)
  assert.equal(a.int, '−49')
  assert.equal(a.dec, '00')
})

test('splitAmount — wartości nieliczbowe traktuje jak 0', () => {
  assert.deepEqual(splitAmount(NaN), { int: '0', dec: '00' })
  assert.deepEqual(splitAmount(undefined), { int: '0', dec: '00' })
  assert.deepEqual(splitAmount(null), { int: '0', dec: '00' })
})

// --- Walidacja wejścia: kwoty wpisywane ręcznie ---
// Regresja: parseAmount robił replace(',', '.') bez flagi g i opierał się na
// parseFloat, więc "1,200,50" dawało po cichu 1.2, a "12zł" → 12. Cicho przyjęta
// zła kwota rozjeżdża saldo konta, więc każdy z tych przypadków musi dać albo
// poprawną liczbę, albo NaN — nigdy zgadywanie.

test('parseAmount — przecinek dziesiętny i spacje', () => {
  assert.equal(parseAmount('12,50'), 12.5)
  assert.equal(parseAmount('1 200'), 1200)
  assert.equal(parseAmount('1 200,25'), 1200.25)
  assert.equal(parseAmount('1\u00A0200,25'), 1200.25)  // spacja nierozdzielająca
})

test('parseAmount — separator tysięcy w obu konwencjach', () => {
  assert.equal(parseAmount('1.200,50'), 1200.5)
  assert.equal(parseAmount('1,200.50'), 1200.5)
  assert.equal(parseAmount('1.200.300,50'), 1200300.5)
  // Niejednoznaczne: ostatnia grupa ma 2 cyfry, nie 3. Odrzucamy zamiast zgadywać.
  assert.ok(Number.isNaN(parseAmount('1,200,50')))
})

test('parseAmount — odrzuca tekst doklejony do liczby zamiast go obcinać', () => {
  assert.ok(Number.isNaN(parseAmount('12zł')))
  assert.ok(Number.isNaN(parseAmount('abc')))
  assert.ok(Number.isNaN(parseAmount('1.2.3')))
  assert.ok(Number.isNaN(parseAmount('--5')))
  assert.ok(Number.isNaN(parseAmount('5-')))
})

test('parseAmount — puste wejście daje NaN', () => {
  assert.ok(Number.isNaN(parseAmount('')))
  assert.ok(Number.isNaN(parseAmount('   ')))
  assert.ok(Number.isNaN(parseAmount(null)))
  assert.ok(Number.isNaN(parseAmount(undefined)))
})

test('parseAmount — odrzuca nieskończoność i kwoty poza bezpiecznym zakresem', () => {
  assert.ok(Number.isNaN(parseAmount('1e999')))
  assert.ok(Number.isNaN(parseAmount(Infinity)))
  assert.ok(Number.isNaN(parseAmount(NaN)))
  assert.ok(Number.isNaN(parseAmount(MAX_AMOUNT * 10)))
  assert.equal(parseAmount(MAX_AMOUNT), MAX_AMOUNT)
})

test('parseAmount — liczby przechodzą bez zmian', () => {
  assert.equal(parseAmount(42.5), 42.5)
  assert.equal(parseAmount(-7), -7)
  assert.equal(parseAmount(0), 0)
})

test('parseAmount — zapis bez zera wiodącego', () => {
  assert.equal(parseAmount(',50'), 0.5)
  assert.equal(parseAmount('.5'), 0.5)
})
