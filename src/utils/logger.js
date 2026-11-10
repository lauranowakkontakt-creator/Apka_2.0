// Jedno miejsce na logi aplikacji.
//
// Po co, skoro jest console.log? Bo w PWA na telefonie konsoli się nie widzi.
// Gdy Laura mówi „Wdzięcznik się nie ładuje", trzeba móc zajrzeć, co apka
// zapisała u siebie — dlatego każdy wpis ląduje też w buforze w pamięci,
// który Ustawienia potrafią pokazać i skopiować.
//
// Zasady:
//  - logger nigdy nie rzuca. Wyjątek z logowania błędu, który miał tylko
//    zostać odnotowany, wysadziłby moduł skuteczniej niż sam błąd.
//  - w produkcji do konsoli idą wyłącznie ostrzeżenia i błędy; debug i info
//    zostają w buforze, żeby nie zaśmiecać konsoli PWA.

const MAKS_WPISOW = 200

const bufor = []
const sluchacze = new Set()

const POZIOMY = { debug: 10, info: 20, warn: 30, error: 40 }

// W produkcji cisza poniżej warn — patrz komentarz wyżej.
const PROG_KONSOLI = import.meta.env?.DEV ? POZIOMY.debug : POZIOMY.warn

function czasHHMMSS(t) {
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

// Błędy Firestore niosą `code` (np. 'permission-denied', 'unavailable'), które
// mówi więcej niż sam komunikat — wyciągamy go do osobnego pola.
function opiszBlad(blad) {
  if (!blad) return {}
  if (typeof blad === 'string') return { komunikat: blad }
  return {
    komunikat: blad.message || String(blad),
    kod: blad.code || undefined,
    stos: blad.stack || undefined,
  }
}

function zapisz(poziom, zrodlo, wiadomosc, dane) {
  try {
    const wpis = {
      czas: Date.now(),
      poziom,
      zrodlo,
      wiadomosc,
      ...(dane ? { dane } : {}),
    }

    bufor.push(wpis)
    // Bufor ograniczony — logi z długiej sesji nie mogą rosnąć bez końca
    // i zjadać pamięci telefonu.
    if (bufor.length > MAKS_WPISOW) bufor.splice(0, bufor.length - MAKS_WPISOW)

    if (POZIOMY[poziom] >= PROG_KONSOLI) {
      const metoda = poziom === 'error' ? 'error' : poziom === 'warn' ? 'warn' : 'log'
      const args = [`[${zrodlo}] ${wiadomosc}`]
      if (dane) args.push(dane)
      console[metoda](...args)
    }

    for (const s of sluchacze) {
      try { s(wpis) } catch {}
    }
  } catch {
    // Logowanie nie ma prawa wywrócić aplikacji. Świadomie połykamy.
  }
}

export const log = {
  debug: (zrodlo, wiadomosc, dane) => zapisz('debug', zrodlo, wiadomosc, dane),
  info:  (zrodlo, wiadomosc, dane) => zapisz('info',  zrodlo, wiadomosc, dane),
  warn:  (zrodlo, wiadomosc, dane) => zapisz('warn',  zrodlo, wiadomosc, dane),

  // `blad` przyjmuje obiekt Error (albo cokolwiek innego) i sam wyciąga z niego
  // komunikat, kod i stos — wołający nie musi o tym pamiętać.
  blad: (zrodlo, wiadomosc, blad, dane) =>
    zapisz('error', zrodlo, wiadomosc, { ...opiszBlad(blad), ...(dane || {}) }),
}

// Podgląd logów (Ustawienia → Diagnostyka). Kopia, żeby widok nie mógł
// przypadkiem zmodyfikować bufora.
export function odczytajLogi() {
  return bufor.slice()
}

export function wyczyscLogi() {
  bufor.length = 0
}

// Tekst do skopiowania i wklejenia — jedyna droga, żeby zobaczyć,
// co się stało na telefonie, gdy nie da się podpiąć konsoli.
// Zrzut jest ostatnią deską ratunku przy diagnozowaniu awarii — nie ma prawa
// paść sam. Struktura cykliczna (a takie trafiają się w obiektach zdarzeń
// i odpowiedziach SDK) wywracała tu JSON.stringify.
function serializuj(dane) {
  if (!dane || !Object.keys(dane).length) return ''
  try {
    return ' ' + JSON.stringify(dane, (_, v) => (v instanceof Error ? String(v) : v))
  } catch {
    return ' {nie da się zserializować}'
  }
}

export function logiJakoTekst() {
  return bufor
    .map(w => {
      // Stos pomijamy: w zrzucie do wklejenia zajmuje kilkanaście linii na wpis
      // i topi to, co naprawdę interesujące (kolejność zdarzeń i kody błędów).
      // W buforze zostaje — odczytajLogi() nadal go zwraca.
      const { stos: _stos, ...dane } = w.dane || {}
      return `${czasHHMMSS(w.czas)} ${w.poziom.toUpperCase().padEnd(5)} [${w.zrodlo}] ${w.wiadomosc}${serializuj(dane)}`
    })
    .join('\n')
}

export function nasluchujLogow(fn) {
  sluchacze.add(fn)
  return () => sluchacze.delete(fn)
}
