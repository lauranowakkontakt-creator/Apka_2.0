// Import transakcji z pliku CSV (wyciąg z banku albo eksport z samej Apki).
//
// Czysta logika — bez Reacta i bez Firebase. Komponent ImportView czyta plik,
// woła te funkcje i dopiero gotową listę zapisuje do Firestore.
//
// Zasada jak w parseAmount: nie zgadujemy po cichu. Wiersz, którego nie da się
// jednoznacznie odczytać (data, kwota), trafia na listę błędów i nie jest
// importowany — lepiej pokazać „pominięto 2 wiersze", niż rozjechać saldo.

import { parseAmount, CURRENCIES } from './currency.js'

// ── Odczyt pliku ────────────────────────────────────────────────────────────

// Polskie banki często eksportują CSV w Windows-1250 (ą, ę, ł jako krzaki
// w UTF-8). Próbujemy UTF-8 „na ostro"; jeśli bajty nie są poprawnym UTF-8,
// czytamy jako Windows-1250.
export function decodeBytes(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    try { return new TextDecoder('windows-1250').decode(bytes) }
    catch { return new TextDecoder('utf-8').decode(bytes) }
  }
}

// ── CSV ─────────────────────────────────────────────────────────────────────

// Separator: ten z ; , tab, który daje najwięcej spójnych kolumn
// w pierwszych liniach. Polskie banki zwykle używają średnika.
export function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 30)
  let best = ',', bestScore = -1
  for (const d of [';', ',', '\t']) {
    const counts = lines.map(l => splitLine(l, d).length).filter(n => n > 1)
    if (!counts.length) continue
    // Najczęstsza liczba kolumn × ile linii ją ma
    const freq = {}
    for (const n of counts) freq[n] = (freq[n] || 0) + 1
    const [cols, times] = Object.entries(freq).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]
    const score = times * 100 + Number(cols)
    if (score > bestScore) { bestScore = score; best = d }
  }
  return best
}

function splitLine(line, d) {
  return parseCSV(line, d)[0] || []
}

// Parser CSV z obsługą cudzysłowów ("a;b", podwójne "" w środku, nowe linie
// w polu). Zwraca tablicę wierszy (tablic stringów), bez pustych wierszy.
export function parseCSV(text, delimiter) {
  const s = String(text ?? '').replace(/^\uFEFF/, '')
  const d = delimiter || detectDelimiter(s)
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ }
        else quoted = false
      } else field += c
      continue
    }
    if (c === '"' && field.trim() === '') { quoted = true; field = ''; continue }
    if (c === d) { row.push(field); field = ''; continue }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(f => f.trim() !== '')) rows.push(row)
      row = []
      continue
    }
    field += c
  }
  row.push(field)
  if (row.some(f => f.trim() !== '')) rows.push(row)
  return rows.map(r => r.map(f => f.trim()))
}

// ── Kolumny ─────────────────────────────────────────────────────────────────

const norm = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ł/g, 'l')
  .replace(/[#:*]/g, '')
  .trim()

// Pola, na które mapujemy kolumny pliku. Kolejność = kolejność w widoku.
export const FIELDS = [
  { id: 'date',        label: 'Data',              required: true },
  { id: 'amount',      label: 'Kwota (ze znakiem)' },
  { id: 'debit',       label: 'Kwota obciążenia' },
  { id: 'credit',      label: 'Kwota uznania' },
  { id: 'type',        label: 'Typ (wydatek/przychód)' },
  { id: 'description', label: 'Opis' },
  { id: 'counterparty',label: 'Kontrahent' },
  { id: 'category',    label: 'Kategoria' },
  { id: 'subcategory', label: 'Podkategoria' },
  { id: 'currency',    label: 'Waluta' },
  { id: 'account',     label: 'Konto' },
  { id: 'detail',      label: 'Szczegół' },
  { id: 'note',        label: 'Notatka' },
  { id: 'foreign',     label: 'Kwota w walucie' },
  { id: 'exactDate',   label: 'Data dokładna (tak/nie)' },
  { id: 'source',      label: 'Źródło' },
]

// Nazwy nagłówków spotykane w eksportach polskich banków (mBank, PKO BP, ING,
// Santander, Millennium, Pekao, Revolut) i w eksporcie samej Apki.
const ALIASES = {
  date:         ['data', 'data operacji', 'data transakcji', 'data ksiegowania', 'data waluty', 'date', 'started date', 'completed date', 'data zlecenia'],
  amount:       ['kwota', 'kwota operacji', 'kwota transakcji', 'kwota w walucie rachunku', 'amount', 'wartosc', 'kwota transakcji (waluta rachunku)'],
  debit:        ['obciazenia', 'obciazenie', 'wydatki', 'kwota obciazenia', 'debet', 'wyplywy'],
  credit:       ['uznania', 'uznanie', 'wplywy', 'kwota uznania', 'kredyt'],
  type:         ['typ', 'typ transakcji', 'rodzaj', 'rodzaj operacji', 'typ operacji', 'type'],
  description:  ['opis', 'opis operacji', 'tytul', 'tytul operacji', 'tytulem', 'szczegoly', 'description', 'opis transakcji'],
  counterparty: ['kontrahent', 'odbiorca', 'nadawca', 'dane kontrahenta', 'nazwa odbiorcy', 'nadawca / odbiorca', 'odbiorca/nadawca', 'nazwa kontrahenta', 'nadawca/odbiorca'],
  category:     ['kategoria', 'category'],
  subcategory:  ['podkategoria', 'subcategory'],
  currency:     ['waluta', 'currency', 'waluta rachunku', 'waluta operacji'],
  account:      ['konto', 'rachunek', 'account', 'nazwa konta'],
  detail:       ['szczegol', 'szczegoly kategorii', 'pod-podkategoria', 'podpodkategoria'],
  note:         ['twoja notatka', 'notatka', 'uwagi', 'komentarz'],
  foreign:      ['kwota w walucie', 'kwota oryginalna', 'kwota w walucie operacji'],
  exactDate:    ['data dokladna'],
  source:       ['zrodlo'],
}

// Pierwszy wiersz, który wygląda jak nagłówek (ma kolumnę z datą i kolumnę
// z kwotą). mBank i PKO dopisują nad tabelą kilka linii z danymi rachunku.
export function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const m = guessMapping(rows[i])
    if (m.date != null && (m.amount != null || m.debit != null || m.credit != null)) return i
  }
  return -1
}

// header → { pole: indeks kolumny }. Najpierw dokładne trafienia, potem
// „zawiera", żeby „Data księgowania" nie zabrała miejsca „Dacie operacji".
export function guessMapping(header) {
  const h = (header || []).map(norm)
  const map = {}
  const used = new Set()
  for (const pass of ['exact', 'prefix']) {
    for (const f of FIELDS) {
      if (map[f.id] != null) continue
      for (const alias of ALIASES[f.id]) {
        const idx = h.findIndex((col, i) => !used.has(i) &&
          (pass === 'exact' ? col === alias : col.startsWith(alias)))
        if (idx >= 0) { map[f.id] = idx; used.add(idx); break }
      }
    }
  }
  // Kwota ze znakiem wystarcza — osobne obciążenia/uznania są wtedy zbędne,
  // ale zostawiamy je, gdy nie ma kolumny „kwota".
  return map
}

// ── Wartości ────────────────────────────────────────────────────────────────

// Data z pliku → Date (południe, żeby strefa czasowa nie przesunęła dnia).
// Akceptuje: 2026-03-05, 2026.03.05, 05.03.2026, 05-03-2026, 05/03/2026,
// także z doklejoną godziną. Dzień/miesiąc w kolejności europejskiej.
export function parseDate(v) {
  const s = String(v ?? '').trim()
  // Data z Excela zapisana jako numer dnia (1 = 1900-01-01, epoka 1899-12-30).
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Math.floor(Number(s))
    if (n < 20000 || n > 80000) return null      // ~1954–2119: poza tym to nie data
    const base = new Date(1899, 11, 30, 12, 0, 0)
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + n, 12, 0, 0)
  }
  let y, m, d
  let r = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  if (r) { [, y, m, d] = r }
  else if ((r = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/))) { [, d, m, y] = r }
  else return null
  y = Number(y); m = Number(m); d = Number(d)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(y, m - 1, d, 12, 0, 0)
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return null // 31.02
  return date
}

// Kwota z wyciągu: "-1 234,56", "1.234,56 PLN", "−12,50" (minus U+2212),
// "(12,50)" jako ujemna. Zwraca liczbę ze znakiem albo NaN.
export function parseBankAmount(v) {
  let s = String(v ?? '').trim()
  if (!s) return NaN
  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1) }
  s = s.replace(/[−–]/g, '-')
  s = s.replace(/[A-Za-zł€$£]+\.?/g, '').trim()   // PLN, zł, EUR, €…
  const n = parseAmount(s)
  if (!Number.isFinite(n)) return NaN
  return neg ? -Math.abs(n) : n
}

function parseType(v) {
  const s = norm(v)
  if (!s) return null
  if (/przelew wewn|wewnetrzn|miedzy kontami|transfer|przeksiegowanie/.test(s)) return 'transfer'
  if (/przych|wplyw|uznan|income|credit|zwrot|wplata/.test(s)) return 'income'
  if (/wydat|obciaz|expense|debit|platnosc|wyplata|zakup/.test(s)) return 'expense'
  return null
}

function parseCurrency(v) {
  const s = String(v ?? '').trim().toUpperCase()
  if (!s) return null
  if (s === 'ZŁ' || s === 'ZL') return 'PLN'
  return CURRENCIES.some(c => c.code === s) ? s : null
}

// "5.59 USD", "-12,30 EUR", "EUR 3,47" → { amount, currency } albo null.
export function parseForeign(v) {
  const s = String(v ?? '').trim()
  if (!s) return null
  const code = s.match(/\b([A-Z]{3})\b/)?.[1]
  const cur = code && parseCurrency(code)
  const n = parseBankAmount(s)
  if (!cur || !Number.isFinite(n) || n === 0) return null
  return { amount: Math.round(Math.abs(n) * 100) / 100, currency: cur }
}

// ── Kategorie ───────────────────────────────────────────────────────────────

// Słowa kluczowe w opisie → id domyślnej kategorii. Używane tylko, gdy plik
// nie ma własnej kolumny „Kategoria". Pierwsze trafienie wygrywa.
const KEYWORDS = [
  ['jedzenie',     ['biedronka', 'lidl', 'zabka', 'kaufland', 'auchan', 'carrefour', 'netto', 'dino', 'stokrotka', 'lewiatan', 'aldi', 'polomarket', 'spolem', 'piekarnia', 'delikatesy', 'frisco', 'intermarche']],
  ['kawa',         ['starbucks', 'costa coffee', 'kawiarnia', 'coffee', 'green caffe']],
  ['restauracje',  ['mcdonald', 'kfc', 'burger king', 'pizza', 'pyszne', 'glovo', 'uber eats', 'wolt', 'restaurac', 'bistro', 'sushi', 'kebab']],
  ['paliwo',       ['orlen', 'bp ', 'shell', 'circle k', 'lotos', 'moya', 'amic', 'stacja paliw']],
  ['transport',    ['uber', 'bolt', 'freenow', 'pkp', 'intercity', 'koleje', 'mpk', 'ztm', 'jakdojade', 'flixbus', 'skycash', 'parking']],
  ['subskrypcje',  ['spotify', 'netflix', 'hbo', 'max.com', 'disney', 'youtube', 'apple.com', 'icloud', 'google one', 'canva', 'chatgpt', 'openai', 'anthropic', 'claude', 'audible', 'storytel', 'legimi', 'empik go', 'prime video']],
  ['rachunki',     ['pge', 'tauron', 'enea', 'energa', 'pgnig', 'veolia', 'wodociagi', 'orange', 'play ', 'plus ', 't-mobile', 'upc', 'vectra', 'netia', 'czynsz', 'abonament', 'ubezpiecz']],
  ['zdrowie',      ['apteka', 'doz', 'gemini', 'super-pharm', 'luxmed', 'medicover', 'enel-med', 'lekarz', 'stomatolog', 'dentyst', 'przychodnia']],
  ['kosmetyki',    ['rossmann', 'hebe', 'sephora', 'douglas', 'notino', 'natura']],
  ['ubrania',      ['zara', 'h&m', 'reserved', 'sinsay', 'cropp', 'house', 'mohito', 'zalando', 'ccc', 'deichmann', 'pepco', 'primark', 'vinted']],
  ['zakupy',       ['allegro', 'amazon', 'aliexpress', 'temu', 'shein', 'ikea', 'action', 'empik', 'smyk']],
  ['elektronika',  ['media expert', 'rtv euro', 'media markt', 'x-kom', 'morele', 'komputronik']],
  ['dom',          ['leroy', 'castorama', 'obi ', 'jysk', 'agata', 'black red white', 'bricomarche']],
  ['ksiazki',      ['ksiegarnia', 'bonito', 'tania ksiazka', 'swiat ksiazki']],
  ['rozrywka',     ['cinema city', 'multikino', 'helios', 'kino', 'steam', 'playstation', 'xbox', 'nintendo', 'ebilet', 'eventim', 'teatr']],
  ['sport',        ['decathlon', 'multisport', 'medicover sport', 'silownia', 'fitness', 'gym']],
  ['wyjazdy',      ['booking', 'airbnb', 'ryanair', 'wizz', 'lot.com', 'hotel', 'hostel']],
  ['zwierzeta',    ['zooplus', 'maxi zoo', 'weteryn', 'kakadu']],
  ['dziesiecina',  ['parafia', 'kosciol', 'ofiara', 'darowizna']],
]
const INCOME_KEYWORDS = [
  ['wynagrodzenie', ['wynagrodzenie', 'pensja', 'wyplata', 'payroll', 'salary']],
  ['premia',        ['premia', 'bonus', 'nagroda']],
  ['zwrot',         ['zwrot', 'refund', 'chargeback']],
  ['stypendium',    ['stypendium']],
  ['inwestycje',    ['odsetki', 'dywidend', 'kapitalizacja']],
  ['sprzedaz',      ['vinted', 'olx', 'allegro']],
]

// Etykieta kategorii z pliku → kategoria z listy (po id albo po nazwie).
export function matchCategory(label, cats) {
  const n = norm(label)
  if (!n) return null
  return cats.find(c => norm(c.id) === n || norm(c.label) === n) || null
}

export function guessCategory(text, type, cats) {
  const n = ' ' + norm(text) + ' '
  const list = type === 'income' ? INCOME_KEYWORDS : KEYWORDS
  for (const [id, words] of list) {
    if (!words.some(w => n.includes(w))) continue
    const cat = cats.find(c => c.id === id)
    if (cat) return cat
  }
  return null
}

export const fallbackCategory = (cats) =>
  cats.find(c => c.id === 'inne') || cats[cats.length - 1] || null

// ── Wiersze → transakcje ────────────────────────────────────────────────────

// rows: wiersze danych (bez nagłówka), mapping: { pole: indeks }.
// opts: { expenseCats, incomeCats, accounts, defaultCurrency }.
// Zwraca { items, errors }. Każdy item to gotowy szkic transakcji;
// błędy mają numer wiersza (od 1, licząc wiersze danych) i powód.
export function rowsToTransactions(rows, mapping, opts = {}) {
  const { expenseCats = [], incomeCats = [], accounts = [], defaultCurrency = 'PLN' } = opts
  const get = (row, f) => mapping[f] != null ? (row[mapping[f]] ?? '') : ''
  const items = [], errors = []

  rows.forEach((row, i) => {
    const line = i + 1
    const date = parseDate(get(row, 'date'))
    if (!date) { errors.push({ line, reason: `nie rozpoznano daty „${get(row, 'date')}"` }); return }

    // Kwota: jedna kolumna ze znakiem albo dwie (obciążenia / uznania).
    let signed = NaN
    if (mapping.amount != null && get(row, 'amount') !== '') {
      signed = parseBankAmount(get(row, 'amount'))
    } else {
      const deb = get(row, 'debit'), cred = get(row, 'credit')
      const dv = deb ? parseBankAmount(deb) : NaN
      const cv = cred ? parseBankAmount(cred) : NaN
      if (Number.isFinite(dv) && dv !== 0) signed = -Math.abs(dv)
      else if (Number.isFinite(cv) && cv !== 0) signed = Math.abs(cv)
    }
    if (!Number.isFinite(signed)) { errors.push({ line, reason: 'nie rozpoznano kwoty' }); return }
    if (signed === 0) { errors.push({ line, reason: 'kwota 0 — pominięto' }); return }

    // Typ: minus zawsze oznacza wydatek. Kwota dodatnia może być wydatkiem,
    // gdy mówi tak kolumna „Typ" (eksport Apki ma kwoty bez znaku).
    // Przelew między własnymi kontami: kierunek ze znaku, bez kategorii.
    const typeCol = parseType(get(row, 'type'))
    const transfer = typeCol === 'transfer'
    const type = signed < 0 ? 'expense' : (transfer ? 'income' : (typeCol || 'income'))
    let amount = Math.round(Math.abs(signed) * 100) / 100

    // Kwota w walucie konta (np. „5.59 USD" przy koncie Revolut USD) ma
    // pierwszeństwo przed przeliczoną na złote — saldo konta jest w jego walucie.
    const foreign = parseForeign(get(row, 'foreign'))
    if (foreign) amount = foreign.amount

    const desc = get(row, 'description')
    const party = get(row, 'counterparty')
    const detail = get(row, 'detail')
    const note = get(row, 'note')
    const main = note || [party, desc].filter(Boolean).join(' — ')
    const description = [detail, main].filter(Boolean)
      .filter((x, k, a) => a.findIndex(y => norm(y) === norm(x)) === k)
      .join(' · ').replace(/\s+/g, ' ').slice(0, 100)
    const exact = norm(get(row, 'exactDate'))

    const cats = type === 'income' ? incomeCats : expenseCats
    const cat = matchCategory(get(row, 'category'), cats)
      || guessCategory(`${party} ${desc}`, type, cats)
      || fallbackCategory(cats)
    const sub = cat?.subcategories?.length
      ? cat.subcategories.find(s => norm(s.label) === norm(get(row, 'subcategory')))
      : null

    const accRaw = get(row, 'account')
    const acc = accRaw
      ? accounts.find(a => a.id === accRaw || norm(a.name) === norm(accRaw))
      : null

    items.push({
      line,
      date,
      type,
      amount,
      description,
      transfer,
      categoryId: transfer ? 'transfer' : (cat?.id || 'inne'),
      subcategoryId: transfer ? null : (sub?.id || null),
      currency: foreign?.currency || parseCurrency(get(row, 'currency')) || defaultCurrency,
      accountId: acc?.id || null,
      // Surowe wartości z pliku — do ekranu zatwierdzania kategorii i kont.
      raw: {
        category: get(row, 'category'),
        subcategory: get(row, 'subcategory'),
        account: accRaw,
        detail,
        note,
        bank: [party, desc].filter(Boolean).join(' — '),
        source: get(row, 'source'),
      },
      dateApprox: exact ? /^(nie|no|false|0)/.test(exact) : false,
    })
  })
  return { items, errors }
}

// ── Duplikaty ───────────────────────────────────────────────────────────────

const ymd = (d) => {
  const x = d instanceof Date ? d : new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

// Klucz „ta sama transakcja": dzień + typ + kwota w groszach. Opis celowo
// pominięty — ręcznie wpisany „Biedronka" i bankowy „BIEDRONKA 1234 WARSZAWA"
// to ta sama transakcja.
export const dupKey = (t) => `${ymd(t.date)}|${t.type}|${Math.round(t.amount * 100)}`

// Oznacza items.duplicate = true, gdy w `existing` jest transakcja z tym
// samym kluczem. Liczy wystąpienia: dwie kawy po 12 zł tego samego dnia
// w pliku przy jednej już zapisanej → tylko jedna jest duplikatem.
export function markDuplicates(items, existing) {
  const pool = {}
  for (const t of existing) {
    if (!t?.date || !Number.isFinite(t.amount)) continue
    const k = dupKey(t)
    pool[k] = (pool[k] || 0) + 1
  }
  return items.map(it => {
    const k = dupKey(it)
    if (pool[k] > 0) { pool[k]--; return { ...it, duplicate: true } }
    return { ...it, duplicate: false }
  })
}

// ── Zapis ───────────────────────────────────────────────────────────────────

// Zmiana sald kont po imporcie: { accountId: delta }. Jeden increment na konto
// zamiast jednego na transakcję — mniej zapisów w batchu.
export function balanceDeltas(items) {
  const out = {}
  for (const t of items) {
    if (!t.accountId) continue
    const d = t.type === 'income' ? t.amount : -t.amount
    out[t.accountId] = Math.round(((out[t.accountId] || 0) + d) * 100) / 100
  }
  return out
}

// Dzieli listę na paczki — Firestore przyjmuje max 500 operacji w batchu.
export function chunk(list, size = 400) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}
