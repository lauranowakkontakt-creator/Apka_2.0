// Sen (czas spania, pobudki, drzemki) — czysta logika do testów.
// Wpis: { date: 'yyyy-MM-dd' (dzień POBUDKI), type: 'night' | 'nap',
//         start: 'HH:mm', end: 'HH:mm', minutes, wakeups, quality }

const naMinuty = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

// Długość snu w minutach; koniec wcześniejszy niż początek = sen przez północ.
export function minutySnu(start, end) {
  const a = naMinuty(start), b = naMinuty(end)
  if (a === null || b === null) return 0
  const d = b - a
  return d >= 0 ? d : d + 1440
}

export function fmtCzas(min) {
  if (!min || min < 0) return '0 min'
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

export const fmtGodziny = (min) => (min / 60).toFixed(1).replace('.', ',')

/** Podsumowanie jednego dnia: noc, drzemki, pobudki, średnia jakość. */
export function senDnia(logi, data) {
  const dnia = logi.filter(l => l.date === data)
  const noce = dnia.filter(l => l.type !== 'nap')
  const drzemki = dnia.filter(l => l.type === 'nap')
  const suma = (t) => t.reduce((s, l) => s + (l.minutes || 0), 0)
  const zJakoscia = noce.filter(l => l.quality)
  return {
    noc: suma(noce), drzemki: suma(drzemki), liczbaDrzemek: drzemki.length,
    pobudki: noce.reduce((s, l) => s + (l.wakeups || 0), 0),
    jakosc: zJakoscia.length ? zJakoscia.reduce((s, l) => s + l.quality, 0) / zJakoscia.length : null,
    razem: suma(dnia), maNoc: noce.length > 0,
  }
}

/**
 * Średnie z listy dni (klucze 'yyyy-MM-dd'). Średnią nocy i pobudek liczymy
 * tylko z dni, w których noc została zapisana — brak wpisu to nie „0 godzin".
 */
export function sredniaSnu(logi, dni) {
  const s = dni.map(d => senDnia(logi, d))
  const zNoca = s.filter(x => x.maNoc)
  const sr = (t, f) => (t.length ? t.reduce((a, x) => a + f(x), 0) / t.length : null)
  return {
    noc: sr(zNoca, x => x.noc),
    pobudki: sr(zNoca, x => x.pobudki),
    drzemki: s.reduce((a, x) => a + x.liczbaDrzemek, 0),
    minutyDrzemek: s.reduce((a, x) => a + x.drzemki, 0),
    nocy: zNoca.length,
  }
}

// Przedziały długości nocy — pod porównanie „ile spałam a jak się czułam".
export const KUBELKI_SNU = ['poniżej 6 h', '6–7 h', '7–8 h', '8 h i więcej']
export function kubelekSnu(min) {
  if (!min) return null
  if (min < 360) return KUBELKI_SNU[0]
  if (min < 420) return KUBELKI_SNU[1]
  if (min < 480) return KUBELKI_SNU[2]
  return KUBELKI_SNU[3]
}
