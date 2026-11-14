// Auto — czysta logika do testów: spalanie, koszty, terminy.
//
// Tankowanie: { date: 'yyyy-MM-dd', fuel: 'lpg' | 'pb', liters, price (zł za
//               całość), odometer (km, może być null), full: bool }
// Naprawa:    { date, title, cost, odometer }
//
// Auto na gaz jeździ na dwóch paliwach naraz (gaz + trochę benzyny na rozruch),
// więc każde paliwo liczymy osobno, ale na ten sam dystans: „9,8 l gazu
// i 0,9 l benzyny na 100 km”.

export const PALIWA = [
  { id: 'lpg', label: 'Gaz (LPG)', krotko: 'LPG', color: '#5BB6D9' },
  { id: 'pb',  label: 'Benzyna',   krotko: 'Pb',  color: '#E0B15A' },
]
export const paliwo = (id) => PALIWA.find(p => p.id === id) || PALIWA[0]

const liczba = (v) => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v)
  return Number.isFinite(n) ? n : 0
}
const zLicznikiem = (t) => liczba(t?.odometer) > 0
// Kolejność jazdy: po liczniku, a przy tym samym liczniku — po dacie.
const poLiczniku = (a, b) => liczba(a.odometer) - liczba(b.odometer) || String(a.date).localeCompare(String(b.date))

/** Cena za litr tankowania (zł/l) albo null, gdy brakuje danych. */
export function cenaZaLitr(t) {
  const l = liczba(t?.liters), c = liczba(t?.price)
  return l > 0 && c > 0 ? c / l : null
}

/**
 * Spalanie jednego paliwa metodą „od pełna do pełna”.
 *
 * Zwraca { srednie, odcinki, szacunkowe, km, litry }:
 * - `odcinki`: dla każdego tankowania do pełna (poza pierwszym) — ile litrów
 *   wlano od poprzedniego pełnego baku i na ilu kilometrach. Tankowania
 *   „nie do pełna” po drodze doliczają się do najbliższego pełnego.
 * - `srednie`: wszystkie litry z odcinków / wszystkie kilometry × 100.
 * - `szacunkowe`: true, gdy pełnych tankowań jest mniej niż dwa i liczymy
 *   między pierwszym a ostatnim tankowaniem w ogóle (mniej dokładne, bo nie
 *   wiemy, ile zostało w baku).
 */
export function spalanie(tankowania, fuel) {
  const lista = (tankowania || []).filter(t => t.fuel === fuel && zLicznikiem(t) && liczba(t.liters) > 0).sort(poLiczniku)
  const pusto = { srednie: null, odcinki: [], szacunkowe: false, km: 0, litry: 0 }
  if (lista.length < 2) return pusto

  const pelne = lista.filter(t => t.full)
  const szacunkowe = pelne.length < 2
  const kotwice = szacunkowe ? [lista[0], lista[lista.length - 1]] : pelne

  const odcinki = []
  for (let i = 1; i < kotwice.length; i++) {
    const od = kotwice[i - 1], doo = kotwice[i]
    const km = liczba(doo.odometer) - liczba(od.odometer)
    if (km <= 0) continue
    // Litry wlane PO poprzedniej kotwicy, łącznie z bieżącą
    const litry = lista
      .filter(t => (poLiczniku(t, od) > 0 || t === doo) && poLiczniku(t, doo) <= 0 && t !== od)
      .reduce((s, t) => s + liczba(t.liters), 0)
    odcinki.push({ id: doo.id, date: doo.date, km, litry, na100: (litry / km) * 100 })
  }
  const km = odcinki.reduce((s, o) => s + o.km, 0)
  const litry = odcinki.reduce((s, o) => s + o.litry, 0)
  return { srednie: km > 0 ? (litry / km) * 100 : null, odcinki, szacunkowe, km, litry }
}

/** Spalanie przypisane do konkretnego tankowania (id → l/100 km) — do listy. */
export function spalaniePoTankowaniu(tankowania) {
  const mapa = {}
  for (const p of PALIWA) for (const o of spalanie(tankowania, p.id).odcinki) if (o.id) mapa[o.id] = o.na100
  return mapa
}

/**
 * Koszt paliwa na 100 km (oba paliwa razem). Tankowania przy najniższym
 * stanie licznika tylko wyznaczają punkt startu, więc ich kosztu nie liczymy.
 */
export function kosztNa100(tankowania) {
  const lista = (tankowania || []).filter(zLicznikiem).sort(poLiczniku)
  if (lista.length < 2) return null
  const km = liczba(lista[lista.length - 1].odometer) - liczba(lista[0].odometer)
  if (km <= 0) return null
  // Wszystko zatankowane na starcie (ten sam licznik co pierwszy wpis) to punkt wyjścia
  const start = liczba(lista[0].odometer)
  const koszt = lista.filter(t => liczba(t.odometer) > start).reduce((s, t) => s + liczba(t.price), 0)
  return (koszt / km) * 100
}

/** Suma wydatków w miesiącu 'yyyy-MM' (tankowania albo naprawy). */
export function wydatkiMiesiaca(pozycje, miesiac, pole = 'price') {
  return (pozycje || []).filter(p => String(p.date || '').startsWith(miesiac)).reduce((s, p) => s + liczba(p[pole]), 0)
}

/** Najwyższy znany stan licznika z tankowań i napraw (albo null). */
export function ostatniLicznik(tankowania, naprawy) {
  const wszystkie = [...(tankowania || []), ...(naprawy || [])].map(x => liczba(x.odometer)).filter(n => n > 0)
  return wszystkie.length ? Math.max(...wszystkie) : null
}

/** Kilometry przejechane między pierwszym a ostatnim wpisem z licznikiem. */
export function przejechane(tankowania) {
  const l = (tankowania || []).filter(zLicznikiem).map(t => liczba(t.odometer))
  return l.length >= 2 ? Math.max(...l) - Math.min(...l) : 0
}

/**
 * Termin (OC, przegląd…): ile dni zostało i jak pilny jest.
 * stan: 'brak' (nie ustawiono) | 'ok' | 'blisko' (≤ 30 dni) | 'po' (minął).
 */
export function terminInfo(data, dzis) {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return { stan: 'brak', dni: null, opis: 'nie ustawiono' }
  const ms = new Date(data + 'T12:00:00') - new Date(dzis + 'T12:00:00')
  const dni = Math.round(ms / 86400000)
  if (dni < 0) return { stan: 'po', dni, opis: dni === -1 ? 'minął wczoraj' : `minął ${-dni} dni temu` }
  if (dni === 0) return { stan: 'blisko', dni, opis: 'kończy się dziś' }
  if (dni === 1) return { stan: 'blisko', dni, opis: 'kończy się jutro' }
  return { stan: dni <= 30 ? 'blisko' : 'ok', dni, opis: `za ${dni} dni` }
}

/** Terminy auta z ustawień, najpilniejsze pierwsze. */
export const POLA_TERMINOW = [
  { pole: 'ocDo',       label: 'OC' },
  { pole: 'przegladDo', label: 'Przegląd' },
  { pole: 'acDo',       label: 'AC' },
]
export function terminyAuta(ustawienia, dzis) {
  const waga = { po: 0, blisko: 1, ok: 2, brak: 3 }
  return POLA_TERMINOW
    .map(p => ({ ...p, data: ustawienia?.[p.pole] || '', ...terminInfo(ustawienia?.[p.pole], dzis) }))
    .sort((a, b) => waga[a.stan] - waga[b.stan] || (a.dni ?? 0) - (b.dni ?? 0))
}

/** „9,8” — liczba z jednym miejscem po przecinku, po polsku. */
export const fmt1 = (n) => (n == null ? '–' : n.toFixed(1).replace('.', ','))
/** „1 234,50 zł” */
export const fmtZl = (n) => `${liczba(n).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
/** „123 456 km” */
export const fmtKm = (n) => `${Math.round(liczba(n)).toLocaleString('pl-PL')} km`
export { liczba }
