// Czynniki dnia i ich wpływ na nastrój — czysta logika do testów.
//
// Pytanie, na które to odpowiada: „czy w dni, kiedy było X, czuję się inaczej
// niż w pozostałe?". Porównujemy średni nastrój DNI z czynnikiem ze średnią
// dni bez niego. To zestawienie, nie dowód przyczyny — dlatego przy małej
// liczbie dni wynik jest oznaczany jako niepewny.

export const DOMYSLNE_CZYNNIKI = [
  { id: 'dom',       label: 'dom',       color: '#B8875A' },
  { id: 'praca',     label: 'praca',     color: '#3B82F6' },
  { id: 'studia',    label: 'studia',    color: '#8B5CF6' },
  { id: 'kościół',   label: 'kościół',   color: '#FBBF24' },
  { id: 'spotkanie', label: 'spotkanie', color: '#EC4899' },
  { id: 'sport',     label: 'sport',     color: '#22C55E' },
  { id: 'natura',    label: 'natura',    color: '#0D9488' },
  { id: 'podróż',    label: 'podróż',    color: '#06B6D4' },
  { id: 'choroba',   label: 'choroba',   color: '#DC2626' },
]

// Ile dni po każdej stronie porównania, żeby wynik uznać za coś więcej niż przypadek.
export const MIN_DNI = 3

// Średni nastrój (1–5) każdego dnia z wpisem z oceną: Map data → średnia.
export function nastrojDni(logi) {
  const sumy = new Map()
  for (const l of logi) {
    if (!l.moodValue || !l.date) continue
    const a = sumy.get(l.date) || [0, 0]
    sumy.set(l.date, [a[0] + l.moodValue, a[1] + 1])
  }
  return new Map([...sumy].map(([d, [s, n]]) => [d, s / n]))
}

/**
 * Co się działo którego dnia: Map data → Set kluczy.
 * Klucze: `f:<czynnik>`, `p:<osoba>`, `o:<okres życia>`.
 * Okres życia (np. żałoba) ma daty od–do i obejmuje każdy dzień w zakresie,
 * także bez zaznaczania go ręcznie we wpisach; brak daty końca = trwa nadal.
 */
export function znacznikiDni(logi, okresyZycia = []) {
  const mapa = new Map()
  const dodaj = (data, klucz) => {
    if (!mapa.has(data)) mapa.set(data, new Set())
    mapa.get(data).add(klucz)
  }
  const daty = new Set()
  for (const l of logi) {
    if (!l.date) continue
    daty.add(l.date)
    for (const f of l.factors || []) dodaj(l.date, `f:${f}`)
    for (const p of l.peopleIds || []) dodaj(l.date, `p:${p}`)
  }
  for (const o of okresyZycia) {
    if (!o?.from) continue
    for (const d of daty) if (d >= o.from && (!o.to || d <= o.to)) dodaj(d, `o:${o.id}`)
  }
  return mapa
}

/**
 * Wpływ każdego znacznika: średnia dni „z" i „bez", różnica i liczba dni.
 * Sortowanie: najpierw wyniki pewne (dość dni po obu stronach), w nich od
 * największej różnicy — żeby na górze nie lądował czynnik z jednego dnia.
 */
export function wplywZnacznikow(nastroj, znaczniki) {
  const klucze = new Set()
  for (const [d, zb] of znaczniki) if (nastroj.has(d)) for (const k of zb) klucze.add(k)
  const wszystkie = [...nastroj]
  const out = []
  for (const klucz of klucze) {
    let sZ = 0, nZ = 0, sBez = 0, nBez = 0
    for (const [d, v] of wszystkie) {
      if (znaczniki.get(d)?.has(klucz)) { sZ += v; nZ++ } else { sBez += v; nBez++ }
    }
    if (!nZ) continue
    const z = sZ / nZ
    const bez = nBez ? sBez / nBez : null
    out.push({ klucz, z, bez, roznica: bez === null ? null : z - bez, dni: nZ, dniBez: nBez, pewne: nZ >= MIN_DNI && nBez >= MIN_DNI })
  }
  return out.sort((a, b) => (b.pewne - a.pewne) || (Math.abs(b.roznica ?? 0) - Math.abs(a.roznica ?? 0)) || (b.dni - a.dni))
}

/**
 * Średni nastrój w grupach, do których dzień należy rozłącznie (faza cyklu,
 * przedział długości snu). `grupaDnia(data)` zwraca nazwę grupy albo null.
 * Zwraca [{ grupa, srednia, dni }] w kolejności `kolejnosc`.
 */
export function nastrojWGrupach(nastroj, grupaDnia, kolejnosc = []) {
  const sumy = new Map()
  for (const [d, v] of nastroj) {
    const g = grupaDnia(d)
    if (!g) continue
    const a = sumy.get(g) || [0, 0]
    sumy.set(g, [a[0] + v, a[1] + 1])
  }
  const grupy = [...new Set([...kolejnosc, ...sumy.keys()])]
  return grupy.filter(g => sumy.has(g)).map(g => ({ grupa: g, srednia: sumy.get(g)[0] / sumy.get(g)[1], dni: sumy.get(g)[1] }))
}
