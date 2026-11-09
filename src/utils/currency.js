export const CURRENCIES = [
  { code: 'PLN', symbol: 'zł', name: 'Złoty polski' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'Dolar amerykański' },
  { code: 'GBP', symbol: '£', name: 'Funt brytyjski' },
  { code: 'CHF', symbol: 'CHF', name: 'Frank szwajcarski' },
  { code: 'CZK', symbol: 'Kč', name: 'Korona czeska' },
]

// Waluta główna — wybierana w ustawieniach Finansów (domyślnie PLN). W niej
// liczą się sumy, statystyki i „łączny majątek"; kwoty w innych walutach są
// przeliczane po kursach, które da się poprawić w ustawieniach. Inne waluty
// mają też własne portfele (strzałki ← → pod kwotą na ekranie Finansów).
export const BASE_CURRENCY = 'PLN'
export function getCurrencyCode() {
  try {
    const c = localStorage.getItem('app_currency')
    if (CURRENCIES.some(x => x.code === c)) return c
  } catch { /* tryb prywatny */ }
  return BASE_CURRENCY
}

export function setCurrencyCode(code) {
  if (!CURRENCIES.some(x => x.code === code)) return
  try { localStorage.setItem('app_currency', code) } catch { /* tryb prywatny */ }
}

// Kursy: ile złotych kosztuje 1 jednostka waluty. Orientacyjne wartości
// startowe — własne kursy użytkownika (ustawienia Finansów) mają pierwszeństwo.
export const DEFAULT_RATES = { PLN: 1, EUR: 4.3, USD: 4.0, GBP: 5.0, CHF: 4.6, CZK: 0.18 }

export function getRates() {
  let own = {}
  try { own = JSON.parse(localStorage.getItem('app_fx_rates') || '{}') || {} } catch { /* uszkodzone */ }
  const out = { ...DEFAULT_RATES }
  for (const [c, v] of Object.entries(own)) if (c in out && c !== 'PLN' && Number(v) > 0) out[c] = Number(v)
  return out
}

export function setRate(code, value) {
  if (!(code in DEFAULT_RATES) || code === 'PLN') return
  const v = Number(value)
  if (!(v > 0) || !Number.isFinite(v)) return
  let own = {}
  try { own = JSON.parse(localStorage.getItem('app_fx_rates') || '{}') || {} } catch { /* uszkodzone */ }
  own[code] = v
  try { localStorage.setItem('app_fx_rates', JSON.stringify(own)) } catch { /* tryb prywatny */ }
}

/** Przelicza kwotę między walutami przez złote. Nieznana waluta = bez zmian. */
export function convert(amount, from = 'PLN', to = getCurrencyCode()) {
  const n = Number(amount) || 0
  if (!from || from === to) return n
  const r = getRates()
  if (!r[from] || !r[to]) return n
  return n * r[from] / r[to]
}

// Największa sensowna kwota. Powyżej tego progu arytmetyka na groszach
// (mnożenie przez 100) wychodzi poza bezpieczny zakres liczb JS i salda zaczynają
// się rozjeżdżać o grosze — lepiej odrzucić wpis, niż policzyć źle.
export const MAX_AMOUNT = 1e12

// Parsowanie kwoty wpisanej przez użytkownika.
//
// Akceptuje: przecinek dziesiętny ("12,50"), spacje zwykłe i nierozdzielające
// ("1 200") oraz separator tysięcy w obu konwencjach ("1.200,50", "1,200.50").
// Zwraca NaN dla wszystkiego, czego nie da się odczytać JEDNOZNACZNIE.
//
// Zasada: nie zgadujemy. Cicho przyjęta zła kwota rozjeżdża saldo konta i nikt
// tego nie zauważy, więc niejednoznaczny wpis ("1,200,50" — ostatnia grupa nie
// ma trzech cyfr) kończy się NaN, a formularz pokazuje „Podaj prawidłową kwotę".
export function parseAmount(v) {
  if (typeof v === 'number') return Number.isFinite(v) && Math.abs(v) <= MAX_AMOUNT ? v : NaN

  let s = String(v ?? '').replace(/[\s\u00A0\u202F]/g, '')  // \u00A0/\u202F: spacje nierozdzielające z klawiatur i wklejek
  if (!s) return NaN

  let znak = ''
  if (s[0] === '+' || s[0] === '-') { znak = s[0] === '-' ? '-' : ''; s = s.slice(1) }
  if (!s) return NaN

  const przecinki = (s.match(/,/g) || []).length
  const kropki = (s.match(/\./g) || []).length

  // Który znak jest przecinkiem dziesiętnym, a który grupuje tysiące:
  //  - oba obecne  → dziesiętny jest ten stojący DALEJ ("1.200,50" vs "1,200.50")
  //  - jeden rodzaj, powtórzony → to grupowanie, liczba nie ma części dziesiętnej
  //  - jeden rodzaj, pojedynczy → dziesiętny
  let dziesietny = null, grupujacy = null
  if (przecinki && kropki) {
    const dalej = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'
    dziesietny = dalej
    grupujacy = dalej === ',' ? '.' : ','
  } else if (przecinki > 1) { grupujacy = ',' }
  else if (kropki > 1) { grupujacy = '.' }
  else if (przecinki === 1) { dziesietny = ',' }
  else if (kropki === 1) { dziesietny = '.' }

  let calosc = s, ulamek = ''
  if (dziesietny) {
    const i = s.lastIndexOf(dziesietny)
    calosc = s.slice(0, i)
    ulamek = s.slice(i + 1)
    // Wiele znaków dziesiętnych po odjęciu grupowania ("1.2.3") — bez sensu.
    if (ulamek.includes(dziesietny) || !/^\d+$/.test(ulamek)) return NaN
  }

  if (grupujacy) {
    // Grupy muszą mieć dokładnie po trzy cyfry — inaczej to nie jest zapis
    // tysięcy, tylko literówka, i nie wiadomo, co użytkownik miał na myśli.
    const wzor = grupujacy === ',' ? /^\d{1,3}(,\d{3})+$/ : /^\d{1,3}(\.\d{3})+$/
    if (!wzor.test(calosc)) return NaN
    calosc = calosc.split(grupujacy).join('')
  }

  // Część całkowita może być pusta tylko przy zapisie ",50" / ".5".
  if (calosc === '' && ulamek === '') return NaN
  if (calosc !== '' && !/^\d+$/.test(calosc)) return NaN

  const n = Number(`${znak}${calosc || '0'}.${ulamek || '0'}`)
  if (!Number.isFinite(n) || Math.abs(n) > MAX_AMOUNT) return NaN
  return n
}

// Formatuje kwotę. Opcjonalny `code` pozwala pokazać transakcję w walucie jej
// portfela (np. wydatek z konta EUR), a nie w globalnej walucie aplikacji.
export function fmt(n, code) {
  const cur = code || getCurrencyCode()
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: cur }).format(n ?? 0)
}

// Rozbija kwotę na część całkowitą (z grupowaniem tysięcy i ewentualnym znakiem
// minus) oraz dwucyfrową część dziesiętną — do dużego „hero" w stylu Revolut,
// gdzie grosze wyświetlamy mniejszą czcionką. Znak minus to U+2212 (−).
export function splitAmount(n) {
  const num = Number(n)
  const safe = Number.isFinite(num) ? num : 0
  const parts = Math.abs(safe)
    .toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split(',')
  return { int: (safe < 0 ? '−' : '') + parts[0], dec: parts[1] ?? '00' }
}
