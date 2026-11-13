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

// Oś nocy od 20:00 do 12:00 następnego dnia (w minutach od północy dnia zaśnięcia).
export const OS_OD = 20 * 60
export const OS_DO = 36 * 60

/**
 * Pozycja snu na osi nocy jako ułamki [od, do] w zakresie 0–1, albo null.
 * Zaśnięcie po północy (np. 00:30) przesuwamy na „następny dzień" osi,
 * żeby stało za 23:00, a nie na jej początku.
 */
export function naOsi(start, end) {
  const a = /^(\d{1,2}):(\d{2})$/.exec(start || ''), b = /^(\d{1,2}):(\d{2})$/.exec(end || '')
  if (!a || !b) return null
  let s = Number(a[1]) * 60 + Number(a[2])
  if (s < 12 * 60) s += 1440
  let e = Number(b[1]) * 60 + Number(b[2])
  while (e <= s) e += 1440
  const od = Math.max(OS_OD, Math.min(OS_DO, s)), doo = Math.max(OS_OD, Math.min(OS_DO, e))
  if (doo <= od) return null
  const dl = OS_DO - OS_OD
  return [(od - OS_OD) / dl, (doo - OS_OD) / dl]
}

// ── Pobudki na osi nocy ──────────────────────────────────────────────────────
// Wpis nocy może mieć `wakeTimes`: listę godzin pobudek ('HH:mm') albo null
// tam, gdzie godzina jest nieznana („nie wiem”). Starsze wpisy mają samo
// `wakeups` (liczbę) — wszystkie ich pobudki traktujemy jak nieznane.

// Stała „losowość”: ta sama pobudka zawsze ląduje w tym samym miejscu, żeby
// kreski nie skakały przy każdym odświeżeniu ekranu.
function losowaStala(ziarno) {
  let h = 2166136261
  for (let i = 0; i < ziarno.length; i++) { h ^= ziarno.charCodeAt(i); h = Math.imul(h, 16777619) }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13
  return ((h >>> 0) % 10000) / 10000
}

/**
 * Położenie pobudek na pasku nocy: lista { u, znana, godzina }, gdzie `u` to
 * ułamek 0–1 długości snu (0 = zaśnięcie, 1 = wstanie).
 * - godzina podana i mieści się w czasie snu → dokładnie w tym miejscu,
 * - „nie wiem” (albo godzina spoza snu) → stałe losowe miejsce w środku nocy.
 */
export function pozycjePobudek(log, max = 8) {
  const ile = Math.min(Math.max(log?.wakeups || 0, (log?.wakeTimes || []).length), max)
  if (!ile) return []
  const s0 = naMinuty(log.start), e0 = naMinuty(log.end)
  const dlugosc = s0 === null || e0 === null ? 0 : (e0 - s0 + 1440) % 1440 || 1440
  const out = []
  for (let i = 0; i < ile; i++) {
    const godzina = log.wakeTimes?.[i] || null
    const t = naMinuty(godzina)
    if (t !== null && dlugosc) {
      const odStartu = (t - s0 + 1440) % 1440
      if (odStartu > 0 && odStartu < dlugosc) { out.push({ u: odStartu / dlugosc, znana: true, godzina }); continue }
    }
    const los = losowaStala(`${log.id || log.date || ''}|${log.start}|${log.end}|${i}`)
    out.push({ u: 0.08 + los * 0.84, znana: false, godzina: null })
  }
  return out
}

/** Czy godzina pobudki mieści się między zaśnięciem a wstaniem. */
export function pobudkaWCzasieSnu(start, end, godzina) {
  const s = naMinuty(start), e = naMinuty(end), t = naMinuty(godzina)
  if (s === null || e === null || t === null) return false
  const dl = (e - s + 1440) % 1440 || 1440, od = (t - s + 1440) % 1440
  return od > 0 && od < dl
}

/** Opis pobudek do listy: „pobudki: 2 (02:30, 04:10)” albo „pobudki: 2”. */
export function opisPobudek(log) {
  const n = log?.wakeups || 0
  if (!n) return ''
  const znane = (log.wakeTimes || []).filter(Boolean)
  return `pobudki: ${n}${znane.length ? ` (${znane.join(', ')})` : ''}`
}
