// Wspólna logika analiz „miesiąc / rok" dla wszystkich modułów.
// Czyste funkcje — bez Reacta i bez Firebase — żeby dało się je przetestować
// i żeby każdy moduł liczył statystyki tak samo.

const pad = (n) => String(n).padStart(2, '0')

/** Dowolna data (Date, Timestamp z Firestore, 'yyyy-MM-dd', liczba ms) → 'yyyy-MM-dd' w czasie lokalnym. */
export function kluczDnia(x) {
  if (!x) return null
  if (typeof x === 'string') return /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 10) : null
  const d = typeof x.toDate === 'function' ? x.toDate() : x instanceof Date ? x : new Date(x)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Lata, w których są dane (od najnowszego). Bieżący rok jest zawsze na liście. */
export function lataZDanych(klucze, teraz = new Date()) {
  const lata = new Set([teraz.getFullYear()])
  for (const k of klucze) if (k) lata.add(Number(k.slice(0, 4)))
  return [...lata].filter(Number.isFinite).sort((a, b) => b - a)
}

/**
 * Suma wartości w każdym z 12 miesięcy roku.
 * `wpisy`: [{ klucz: 'yyyy-MM-dd', wartosc?: number }] — brak wartości liczy się jako 1.
 */
export function miesiaceRoku(wpisy, rok) {
  const out = Array(12).fill(0)
  const pref = String(rok)
  for (const w of wpisy) {
    if (!w.klucz || !w.klucz.startsWith(pref)) continue
    const m = Number(w.klucz.slice(5, 7)) - 1
    if (m >= 0 && m < 12) out[m] += w.wartosc ?? 1
  }
  return out
}

/** Liczba (lub suma) na dzień: Map 'yyyy-MM-dd' → number. */
export function mapaDni(wpisy) {
  const m = new Map()
  for (const w of wpisy) if (w.klucz) m.set(w.klucz, (m.get(w.klucz) || 0) + (w.wartosc ?? 1))
  return m
}

/** Ile miesięcy roku już minęło (lub trwa) — do uczciwej średniej. Przyszły rok → 0, przeszły → 12. */
export function miesiaceMinione(rok, teraz = new Date()) {
  const r = teraz.getFullYear()
  if (rok < r) return 12
  if (rok > r) return 0
  return teraz.getMonth() + 1
}

/**
 * Podsumowanie 12 miesięcy: suma, średnia na minione miesiące, najlepszy
 * i najsłabszy miesiąc (spośród minionych), liczba miesięcy z danymi.
 */
export function podsumujMiesiace(wartosci, rok, teraz = new Date()) {
  const minione = miesiaceMinione(rok, teraz)
  const zakres = wartosci.slice(0, minione)
  const suma = wartosci.reduce((s, v) => s + v, 0)
  let najlepszy = null, najslabszy = null
  zakres.forEach((v, i) => {
    if (najlepszy === null || v > wartosci[najlepszy]) najlepszy = i
    if (najslabszy === null || v < wartosci[najslabszy]) najslabszy = i
  })
  return {
    suma,
    srednia: minione ? suma / minione : 0,
    najlepszy: najlepszy !== null && wartosci[najlepszy] > 0 ? najlepszy : null,
    najslabszy: najslabszy !== null && najslabszy !== najlepszy ? najslabszy : null,
    aktywne: wartosci.filter(v => v > 0).length,
    minione,
  }
}

/** Zmiana procentowa względem poprzedniego okresu. Brak bazy → null (nie „+∞%"). */
export function zmiana(teraz, wczesniej) {
  if (!Number.isFinite(teraz) || !Number.isFinite(wczesniej) || wczesniej === 0) return null
  return Math.round(((teraz - wczesniej) / Math.abs(wczesniej)) * 100)
}

/** Rozkład na dni tygodnia, od poniedziałku: [pn, wt, śr, cz, pt, so, nd]. */
export function wgDniaTygodnia(wpisy) {
  const out = Array(7).fill(0)
  for (const w of wpisy) {
    if (!w.klucz) continue
    const [y, m, d] = w.klucz.split('-').map(Number)
    const dow = (new Date(y, m - 1, d).getDay() + 6) % 7
    out[dow] += w.wartosc ?? 1
  }
  return out
}

/** Najdłuższa seria kolejnych dni (z zestawu kluczy 'yyyy-MM-dd'), opcjonalnie tylko w danym roku. */
export function najdluzszaSeria(klucze, rok = null) {
  const dni = [...new Set(klucze)].filter(k => k && (rok === null || k.startsWith(String(rok)))).sort()
  let best = 0, cur = 0, prev = null
  for (const k of dni) {
    const [y, m, d] = k.split('-').map(Number)
    const t = Date.UTC(y, m - 1, d)
    cur = prev !== null && t - prev === 864e5 ? cur + 1 : 1
    if (cur > best) best = cur
    prev = t
  }
  return best
}

/** Liczba dni w miesiącu (m: 0–11). */
export const dniMiesiaca = (rok, m) => new Date(rok, m + 1, 0).getDate()

/** Ile dni roku już minęło (włącznie z dziś). */
export function dniMinione(rok, teraz = new Date()) {
  const r = teraz.getFullYear()
  if (rok < r) return (rok % 4 === 0 && rok % 100 !== 0) || rok % 400 === 0 ? 366 : 365
  if (rok > r) return 0
  const start = Date.UTC(r, 0, 1)
  const dzis = Date.UTC(r, teraz.getMonth(), teraz.getDate())
  return Math.round((dzis - start) / 864e5) + 1
}

export const MIESIACE_KROTKO = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
export const MIESIACE_PELNE = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']
export const DNI_TYG_KROTKO = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd']

/**
 * Suma wpisów roku `rok` do tej samej daty w roku co `teraz` (1 stycznia – dzisiejszy
 * dzień/miesiąc). Do uczciwego porównania „ten rok do dziś" z „tym samym okresem rok temu".
 */
export function doTegoDnia(wpisy, rok, teraz = new Date()) {
  const md = `${pad(teraz.getMonth() + 1)}-${pad(teraz.getDate())}`
  const pref = `${rok}-`
  let s = 0
  for (const w of wpisy) if (w.klucz && w.klucz.startsWith(pref) && w.klucz.slice(5) <= md) s += w.wartosc ?? 1
  return s
}

/**
 * Pozycje (kategorie, rodzaje…) rozbite na lata — do tabel „przez wszystkie lata".
 * `zdarzenia`: [{ nazwa, rok, wartosc? }] (brak wartości = 1).
 * Zwraca { lata (rosnąco), wiersze: [{ nazwa, suma, poLatach: { [rok]: liczba } }] } od największej sumy.
 */
export function rozbijWgLat(zdarzenia) {
  const lata = new Set()
  const m = new Map()
  for (const z of zdarzenia) {
    if (!z || !Number.isFinite(z.rok)) continue
    lata.add(z.rok)
    const w = m.get(z.nazwa) || { nazwa: z.nazwa, suma: 0, poLatach: {} }
    const v = z.wartosc ?? 1
    w.suma += v
    w.poLatach[z.rok] = (w.poLatach[z.rok] || 0) + v
    m.set(z.nazwa, w)
  }
  return { lata: [...lata].sort((a, b) => a - b), wiersze: [...m.values()].sort((a, b) => b.suma - a.suma) }
}
