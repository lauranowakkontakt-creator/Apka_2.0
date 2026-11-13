// Cykl miesiączkowy — czysta logika (bez Reacta i bez bazy), żeby dało się ją
// testować. Okres to { start: 'yyyy-MM-dd', end: 'yyyy-MM-dd' | null }.
//
// To są szacunki z kalendarza, nie pomiar: owulację liczymy klasycznie jako
// ~14 dni przed spodziewanym okresem. Do orientacji w samopoczuciu wystarcza,
// do antykoncepcji ani diagnozy — nie.

const DZIEN = 86400000
const naDate = (k) => new Date(k + 'T12:00:00')
export const roznicaDni = (a, b) => Math.round((naDate(b) - naDate(a)) / DZIEN)
export function dodajDni(k, n) {
  const d = naDate(k)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const DOMYSLNY_CYKL = 28
export const DOMYSLNY_OKRES = 5
// Odstęp między okresami spoza tego zakresu traktujemy jako lukę w zapisach
// (zapomniany miesiąc), a nie prawdziwy cykl — inaczej jedna dziura psuje średnią.
const MIN_CYKL = 15
const MAX_CYKL = 60

export const posortowane = (okresy) =>
  [...okresy].filter(o => o?.start).sort((a, b) => a.start.localeCompare(b.start))

const srednia = (t) => t.reduce((s, v) => s + v, 0) / t.length

/**
 * Średnia długość cyklu i okresu z historii. Liczymy z ostatnich 6 cykli —
 * cykl zmienia się z czasem, więc dane sprzed lat nie powinny ciążyć prognozie.
 * `zDanych` mówi, czy średnia cyklu pochodzi z zapisów, czy to domyślne 28 dni.
 */
export function statystykiCyklu(okresy) {
  const p = posortowane(okresy)
  const cykle = []
  for (let i = 1; i < p.length; i++) {
    const d = roznicaDni(p[i - 1].start, p[i].start)
    if (d >= MIN_CYKL && d <= MAX_CYKL) cykle.push(d)
  }
  const ostatnie = cykle.slice(-6)
  const dlugosciOkresu = p.filter(o => o.end && o.end >= o.start)
    .map(o => roznicaDni(o.start, o.end) + 1).filter(d => d <= 14).slice(-6)
  return {
    dlugoscCyklu: ostatnie.length ? Math.round(srednia(ostatnie)) : DOMYSLNY_CYKL,
    dlugoscOkresu: dlugosciOkresu.length ? Math.round(srednia(dlugosciOkresu)) : DOMYSLNY_OKRES,
    liczbaCykli: cykle.length,
    najkrotszy: ostatnie.length ? Math.min(...ostatnie) : null,
    najdluzszy: ostatnie.length ? Math.max(...ostatnie) : null,
    zDanych: ostatnie.length > 0,
  }
}

// Ostatni okres, który zaczął się nie później niż `data`.
export function okresPrzed(okresy, data) {
  const p = posortowane(okresy).filter(o => o.start <= data)
  return p.length ? p[p.length - 1] : null
}

// Który to dzień cyklu (1 = pierwszy dzień okresu). null, gdy brak zapisów
// albo ostatni okres był tak dawno, że liczenie nie ma sensu.
export function dzienCyklu(okresy, data) {
  const o = okresPrzed(okresy, data)
  if (!o) return null
  const d = roznicaDni(o.start, data) + 1
  return d > MAX_CYKL ? null : d
}

// Czy tego dnia trwa zapisany okres. Okres bez daty końca liczymy do średniej
// długości — żeby zapomniane „skończył się" nie malowało całego miesiąca.
export function czyOkres(okresy, data, dlugoscOkresu = DOMYSLNY_OKRES) {
  return okresy.some(o => o?.start && o.start <= data && data <= (o.end || dodajDni(o.start, dlugoscOkresu - 1)))
}

export const FAZY = {
  menstruacja: {
    nazwa: 'Miesiączka', kolor: '#DC2626',
    opis: 'Poziom hormonów jest najniższy. Częste są mniejsza energia, skurcze, ból pleców i potrzeba wycofania się. To dobry czas na odpoczynek, ciepło i lżejszy plan dnia — siły zwykle wracają po 2–3 dniach.',
  },
  folikularna: {
    nazwa: 'Faza folikularna', kolor: '#22C55E',
    opis: 'Estrogen rośnie, a razem z nim zwykle energia, koncentracja i nastrój. Łatwiej zaczynać nowe rzeczy, uczyć się i ćwiczyć intensywniej.',
  },
  owulacja: {
    nazwa: 'Okolice owulacji', kolor: '#FBBF24',
    opis: 'Szczyt estrogenu. Często najwięcej energii, pewności siebie i ochoty na kontakt z ludźmi. U części kobiet pojawia się krótki ból po jednej stronie podbrzusza.',
  },
  lutealna: {
    nazwa: 'Faza lutealna', kolor: '#3B82F6',
    opis: 'Dominuje progesteron. Energia powoli się wycisza, może rosnąć apetyt i senność. Dobrze wychodzą rzeczy spokojne i porządkujące.',
  },
  przedmiesiaczkowa: {
    nazwa: 'Przed miesiączką', kolor: '#8B5CF6',
    opis: 'Hormony spadają. Możliwe są drażliwość, płaczliwość, wzdęcia, tkliwość piersi, gorszy sen i ochota na słodkie. Gorszy nastrój w tych dniach często ma podłoże hormonalne — warto być dla siebie łagodniejszą.',
  },
  spoznienie: {
    nazwa: 'Okres się spóźnia', kolor: '#8285A0',
    opis: 'Spodziewany termin minął. Kilka dni różnicy to norma — cykl przesuwają stres, choroba, podróż czy zmiana trybu życia. Gdy okres przyjdzie, zaznacz jego początek.',
  },
}
export const KOLEJNOSC_FAZ = ['menstruacja', 'folikularna', 'owulacja', 'lutealna', 'przedmiesiaczkowa']

// Dzień spodziewanej owulacji: ~14 dni przed kolejnym okresem.
export const dzienOwulacji = (dlugoscCyklu) => Math.max(8, dlugoscCyklu - 14)

/** Faza cyklu dla danego dnia cyklu. Zwraca klucz z FAZY albo null. */
export function fazaCyklu(dzien, dlugoscCyklu = DOMYSLNY_CYKL, dlugoscOkresu = DOMYSLNY_OKRES) {
  if (!dzien || dzien < 1) return null
  const owu = dzienOwulacji(dlugoscCyklu)
  if (dzien > dlugoscCyklu) return 'spoznienie'
  if (dzien <= dlugoscOkresu) return 'menstruacja'
  if (dzien < owu - 1) return 'folikularna'
  if (dzien <= owu + 1) return 'owulacja'
  if (dzien > dlugoscCyklu - 5) return 'przedmiesiaczkowa'
  return 'lutealna'
}

// Granice faz w cyklu — pod pasek z podziałem: [{ faza, od, do }] (dni cyklu).
export function zakresyFaz(dlugoscCyklu = DOMYSLNY_CYKL, dlugoscOkresu = DOMYSLNY_OKRES) {
  const out = []
  for (let d = 1; d <= dlugoscCyklu; d++) {
    const f = fazaCyklu(d, dlugoscCyklu, dlugoscOkresu)
    const ost = out[out.length - 1]
    if (ost && ost.faza === f) ost.do = d
    else out.push({ faza: f, od: d, do: d })
  }
  return out
}

/**
 * Prognoza: kiedy następny okres i ile dni do niego (ujemne = spóźnia się).
 * `przyszleDni` to zbiór dat spodziewanych okresów w najbliższych cyklach —
 * do zaznaczenia w kalendarzu.
 */
export function prognozaCyklu(okresy, dzis, ileCykli = 3) {
  const ost = okresPrzed(okresy, dzis)
  if (!ost) return null
  const s = statystykiCyklu(okresy)
  if (roznicaDni(ost.start, dzis) + 1 > MAX_CYKL) return null
  const nastepny = dodajDni(ost.start, s.dlugoscCyklu)
  const przyszleDni = new Set()
  for (let c = 1; c <= ileCykli; c++) {
    const start = dodajDni(ost.start, s.dlugoscCyklu * c)
    for (let i = 0; i < s.dlugoscOkresu; i++) {
      const d = dodajDni(start, i)
      if (d > dzis) przyszleDni.add(d)
    }
  }
  return { nastepny, dniDo: roznicaDni(dzis, nastepny), owulacja: dodajDni(ost.start, dzienOwulacji(s.dlugoscCyklu) - 1), przyszleDni }
}

// Faza cyklu dla dowolnej daty z historii (pod statystyki nastroju wg faz).
// Długość konkretnego cyklu bierzemy z faktycznego odstępu do kolejnego okresu,
// a dopiero dla bieżącego — ze średniej.
export function fazaDnia(okresy, data, stat = statystykiCyklu(okresy)) {
  const p = posortowane(okresy)
  let i = -1
  for (let k = 0; k < p.length; k++) if (p[k].start <= data) i = k
  if (i < 0) return null
  const dzien = roznicaDni(p[i].start, data) + 1
  let dlugosc = stat.dlugoscCyklu
  if (p[i + 1]) {
    const fakt = roznicaDni(p[i].start, p[i + 1].start)
    if (fakt < MIN_CYKL || fakt > MAX_CYKL) return dzien <= stat.dlugoscOkresu ? 'menstruacja' : null
    dlugosc = fakt
  } else if (dzien > MAX_CYKL) return null
  const dlOkresu = p[i].end ? Math.min(14, roznicaDni(p[i].start, p[i].end) + 1) : stat.dlugoscOkresu
  const f = fazaCyklu(dzien, dlugosc, dlOkresu)
  return f === 'spoznienie' ? 'przedmiesiaczkowa' : f
}

/**
 * Dni do małego kalendarza cyklu, liczone z JEJ średnich (nie z książkowych 28 dni):
 * - `starty`    — przewidywane początki kolejnych `ileCykli` okresów,
 * - `prognoza`  — przewidywane dni okresu (tylko po dzisiejszym dniu),
 * - `owulacja`  — okno owulacji (dzień owulacji ±1) bieżącego i kolejnych cykli.
 * Dni okresu już zapisanego sprawdza się osobno przez czyOkres().
 */
export function kalendarzCyklu(okresy, dzis, ileCykli = 6) {
  const ost = okresPrzed(okresy, dzis)
  const pusto = { starty: [], prognoza: new Set(), owulacja: new Set() }
  if (!ost || roznicaDni(ost.start, dzis) + 1 > MAX_CYKL) return pusto
  const s = statystykiCyklu(okresy)
  const owu = dzienOwulacji(s.dlugoscCyklu)
  const starty = [], prognoza = new Set(), owulacja = new Set()
  // Spóźniony okres: kolejne prognozy liczymy od dziś, nie od dawno minionego terminu.
  let kolejny = dodajDni(ost.start, s.dlugoscCyklu)
  if (kolejny <= dzis) kolejny = dodajDni(dzis, 1)
  for (let i = -1; i <= 1; i++) { const d = dodajDni(ost.start, owu - 1 + i); if (d >= dzis) owulacja.add(d) }
  for (let c = 0; c < ileCykli; c++) {
    const start = dodajDni(kolejny, s.dlugoscCyklu * c)
    starty.push(start)
    for (let i = 0; i < s.dlugoscOkresu; i++) prognoza.add(dodajDni(start, i))
    for (let i = -1; i <= 1; i++) owulacja.add(dodajDni(start, owu - 1 + i))
  }
  return { starty, prognoza, owulacja }
}
