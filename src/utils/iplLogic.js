// IPL (depilator) — czysta logika do testów: strefy ciała, statystyki zabiegów.
//
// Zabieg = jeden wpis na jedną strefę ciała:
//   { zone: 'udo-g-p', date: 'yyyy-MM-dd', hair: 0..3 | null, regrowth: 1..3 | null, note }
// `hair` to owłosienie w dniu zabiegu (przed świetlnym impulsem), `regrowth` —
// jak szybko włosy odrastały od poprzedniego razu. Zabieg kilku stref naraz to
// po prostu kilka wpisów z tą samą datą.
//
// Strony ciała liczymy z punktu widzenia osoby, nie patrzącego: „prawa” to ta,
// która na rysunku jest po lewej stronie.

export const GRUPY = [
  { id: 'twarz', label: 'Twarz' },
  { id: 'tulow', label: 'Szyja i tułów' },
  { id: 'rece',  label: 'Ręce' },
  { id: 'bikini', label: 'Bikini' },
  { id: 'nogi',  label: 'Nogi' },
]

// Para stref (prawa + lewa) zapisana jednym wierszem — dzięki temu lista nie
// rozjeżdża się z rysunkiem i nic nie trzeba pisać dwa razy. Nazwy podajemy
// jawnie, bo polska odmiana („prawa pacha”, „prawe udo”) nie daje się wyliczyć.
const para = (baza, group, prawa, lewa) => [
  { id: `${baza}-p`, label: prawa, group, strona: 'p', baza },
  { id: `${baza}-l`, label: lewa, group, strona: 'l', baza },
]

export const ZONY = [
  { id: 'wasik', label: 'Wąsik', group: 'twarz' },
  { id: 'broda', label: 'Broda', group: 'twarz' },
  ...para('policzek', 'twarz', 'Policzek i bak prawy', 'Policzek i bak lewy'),

  { id: 'szyja', label: 'Szyja', group: 'tulow' },
  { id: 'dekolt', label: 'Dekolt', group: 'tulow' },
  { id: 'piersi', label: 'Piersi', group: 'tulow' },
  { id: 'brzuch-g', label: 'Brzuch górny', group: 'tulow' },
  { id: 'brzuch-d', label: 'Brzuch dolny', group: 'tulow' },

  ...para('pacha', 'rece', 'Pacha prawa', 'Pacha lewa'),
  ...para('ramie', 'rece', 'Ramię prawe', 'Ramię lewe'),
  ...para('przedramie', 'rece', 'Przedramię prawe', 'Przedramię lewe'),
  ...para('dlon', 'rece', 'Dłoń prawa', 'Dłoń lewa'),
  ...para('palce-reka', 'rece', 'Palce prawej dłoni', 'Palce lewej dłoni'),

  ...para('bikini', 'bikini', 'Linia bikini prawa', 'Linia bikini lewa'),
  { id: 'intymne', label: 'Okolice intymne', group: 'bikini' },

  ...para('udo-g', 'nogi', 'Udo prawe (góra)', 'Udo lewe (góra)'),
  ...para('udo-d', 'nogi', 'Udo prawe (dół)', 'Udo lewe (dół)'),
  ...para('kolano', 'nogi', 'Kolano prawe', 'Kolano lewe'),
  ...para('podudzie', 'nogi', 'Podudzie prawe', 'Podudzie lewe'),
  ...para('stopa', 'nogi', 'Stopa prawa', 'Stopa lewa'),
  ...para('palce-stopa', 'nogi', 'Palce prawej stopy', 'Palce lewej stopy'),
]

export const ZONY_PO_ID = Object.fromEntries(ZONY.map(z => [z.id, z]))
export const strefa = (id) => ZONY_PO_ID[id] || null
export const nazwaStrefy = (id) => ZONY_PO_ID[id]?.label || 'Nieznana strefa'
export const strefyGrupy = (grupa, ukryte = []) => ZONY.filter(z => z.group === grupa && !ukryte.includes(z.id))

// Strefy, które użytkowniczka śledzi. Domyślnie wszystkie; niepotrzebne można
// wyłączyć w ustawieniach modułu — znikają wtedy z modelu, formularza i liczników,
// ale zapisane wcześniej zabiegi zostają.
export const aktywneStrefy = (ukryte = []) => ZONY.filter(z => !ukryte.includes(z.id))
export const czyAktywna = (id, ukryte = []) => !!ZONY_PO_ID[id] && !ukryte.includes(id)
/** Zostawia w liście tylko znane strefy (bez duplikatów) — do zapisu ustawienia. */
export const oczyscUkryte = (ukryte) => [...new Set((Array.isArray(ukryte) ? ukryte : []).filter(id => ZONY_PO_ID[id]))]

// Poziom owłosienia w dniu zabiegu.
export const OWLOSIENIE = [
  { v: 0, label: 'Gładko',  opis: 'nic nie odrosło' },
  { v: 1, label: 'Meszek',  opis: 'pojedyncze, cienkie włoski' },
  { v: 2, label: 'Średnie', opis: 'wyraźnie widoczne włosy' },
  { v: 3, label: 'Gęste',   opis: 'gęste, grube włosy' },
]
// Jak szybko odrastają.
export const ODRASTANIE = [
  { v: 1, label: 'Wolno' },
  { v: 2, label: 'Średnio' },
  { v: 3, label: 'Szybko' },
]
export const etykietaOwlosienia = (v) => OWLOSIENIE.find(o => o.v === v)?.label ?? '–'
export const etykietaOdrastania = (v) => ODRASTANIE.find(o => o.v === v)?.label ?? '–'

const MS_DZIEN = 86400000
const dzienUTC = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''))
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null
}

/** Ile dni minęło od daty `od` do `do` (obie 'yyyy-MM-dd'); null, gdy data jest zepsuta. */
export function dniMiedzy(od, doDnia) {
  const a = dzienUTC(od), b = dzienUTC(doDnia)
  return a == null || b == null ? null : Math.round((b - a) / MS_DZIEN)
}

const poDacieMalejaco = (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAtMs ?? '').localeCompare(String(a.createdAtMs ?? ''))

/** Wpisy jednej strefy, od najnowszego. */
export const wpisyStrefy = (wpisy, zone) => wpisy.filter(w => w.zone === zone).sort(poDacieMalejaco)

/** { [id strefy]: najnowszy wpis tej strefy } — do kolorowania rysunku. */
export function ostatniePoStrefach(wpisy) {
  const wynik = {}
  for (const w of [...wpisy].sort(poDacieMalejaco).reverse()) wynik[w.zone] = w   // późniejsze nadpisują wcześniejsze
  return wynik
}

const srednia = (t) => t.length ? t.reduce((s, x) => s + x, 0) / t.length : null

/**
 * Statystyki jednej strefy.
 *
 * - `sredniOdstep`: średnia liczba dni między kolejnymi dniami zabiegów
 *   (dwa wpisy z tego samego dnia to jeden zabieg), null przy mniej niż dwóch.
 * - `trend`: 'spada' / 'stabilnie' / 'rosnie' — jak zmienia się owłosienie.
 *   Porównujemy początek z końcem (po dwa ostatnie wpisy, gdy jest ich ≥ 4).
 *   Mniej niż dwa wpisy z poziomem owłosienia = null.
 */
export function statStrefy(wpisy, zone, dzis) {
  const lista = wpisyStrefy(wpisy, zone)              // od najnowszego
  const ostatni = lista[0] || null
  const dni = [...new Set(lista.map(w => w.date))].sort()   // rosnąco
  const odstepy = []
  for (let i = 1; i < dni.length; i++) { const d = dniMiedzy(dni[i - 1], dni[i]); if (d != null) odstepy.push(d) }

  const zPoziomem = [...lista].reverse().filter(w => Number.isInteger(w.hair))   // rosnąco po dacie
  let trend = null
  if (zPoziomem.length >= 2) {
    const k = zPoziomem.length >= 4 ? 2 : 1
    const roznica = srednia(zPoziomem.slice(-k).map(w => w.hair)) - srednia(zPoziomem.slice(0, k).map(w => w.hair))
    trend = roznica <= -0.5 ? 'spada' : roznica >= 0.5 ? 'rosnie' : 'stabilnie'
  }
  const odrastania = lista.filter(w => Number.isInteger(w.regrowth)).map(w => w.regrowth)

  return {
    liczba: dni.length,
    ostatni,
    dniOdOstatniego: ostatni ? dniMiedzy(ostatni.date, dzis) : null,
    sredniOdstep: odstepy.length ? Math.round(srednia(odstepy)) : null,
    ostatnieOwlosienie: zPoziomem.length ? zPoziomem[zPoziomem.length - 1].hair : null,
    ostatnieOdrastanie: odrastania.length ? odrastania[0] : null,
    trend,
  }
}

/** Przedziały „jak dawno” do kolorowania rysunku. */
export const PRZEDZIALY_DNI = [
  { id: 'swiezo',  max: 7,   label: 'do 7 dni' },
  { id: 'niedawno', max: 14, label: '8–14 dni' },
  { id: 'dawno',   max: 30,  label: '15–30 dni' },
  { id: 'bardzo-dawno', max: Infinity, label: 'ponad 30 dni' },
]
export function przedzialDni(dni) {
  if (dni == null || dni < 0) return null
  return PRZEDZIALY_DNI.find(p => dni <= p.max)
}

/**
 * Do którego pasma (0..N) wpada strefa na rysunku w danym trybie:
 *  - 'ostatnio':    przedział jak dawno (0 = świeżo … 3 = dawno), null = nigdy
 *  - 'owlosienie':  ostatni zapisany poziom (0..3), null = brak danych
 *  - 'odrastanie':  ostatnia ocena (0..2 = wolno..szybko), null = brak danych
 */
export function pasmoStrefy(tryb, ostatni, dzis) {
  if (!ostatni) return null
  if (tryb === 'ostatnio') {
    const p = przedzialDni(dniMiedzy(ostatni.date, dzis))
    return p ? PRZEDZIALY_DNI.indexOf(p) : null
  }
  if (tryb === 'owlosienie') return Number.isInteger(ostatni.hair) ? ostatni.hair : null
  if (tryb === 'odrastanie') return Number.isInteger(ostatni.regrowth) ? ostatni.regrowth - 1 : null
  return null
}

/** Zabiegi pogrupowane po dniach, od najnowszego: [{ date, wpisy: [...] }]. */
export function grupujZabiegi(wpisy) {
  const mapa = new Map()
  for (const w of [...wpisy].sort(poDacieMalejaco)) {
    if (!mapa.has(w.date)) mapa.set(w.date, [])
    mapa.get(w.date).push(w)
  }
  return [...mapa].map(([date, lista]) => ({ date, wpisy: lista }))
}

/** Podsumowanie całości do kafelków i Pulpitu. */
export function podsumowanie(wpisy, dzis, ukryte = []) {
  const ost = ostatniePoStrefach(wpisy)
  const dni = [...new Set(wpisy.map(w => w.date))].sort()
  const ostatniDzien = dni[dni.length - 1] || null
  const miesiac = String(dzis).slice(0, 7)
  return {
    zabiegi: dni.length,
    zabiegiMiesiac: dni.filter(d => d.startsWith(miesiac)).length,
    strefyZrobione: Object.keys(ost).filter(id => czyAktywna(id, ukryte)).length,
    strefyRazem: aktywneStrefy(ukryte).length,
    ostatniDzien,
    dniOdOstatniego: ostatniDzien ? dniMiedzy(ostatniDzien, dzis) : null,
    ostatniaLiczbaStref: ostatniDzien ? wpisy.filter(w => w.date === ostatniDzien).length : 0,
  }
}

/** Wpisy, które trzeba zapisać dla zabiegu kilku stref naraz. */
export function wpisyZabiegu({ strefy, date, hair, regrowth, note }) {
  return [...new Set(strefy)].filter(id => ZONY_PO_ID[id]).map(zone => ({
    zone, date,
    hair: Number.isInteger(hair) ? hair : null,
    regrowth: Number.isInteger(regrowth) ? regrowth : null,
    note: (note || '').trim(),
  }))
}

/** „5 stref”, „1 strefa”, „2 strefy” — polska odmiana. */
export function strefyWord(n) {
  const j = n % 10, d = n % 100
  if (n === 1) return 'strefa'
  return j >= 2 && j <= 4 && !(d >= 12 && d <= 14) ? 'strefy' : 'stref'
}

/** „dziś”, „wczoraj”, „5 dni temu”. */
export function dawnoTemu(dni) {
  if (dni == null) return ''
  if (dni <= 0) return 'dziś'
  if (dni === 1) return 'wczoraj'
  return `${dni} dni temu`
}
