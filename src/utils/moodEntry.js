// Wpis nastroju = dzień złożony z chwil — czysta logika do testów.
//
// Różne rzeczy wywołują różne emocje (praca → złość, spotkanie → radość),
// więc każda chwila ma własną godzinę, nastrój, emocje, czynniki i osoby.
// Dzień trzyma listę chwil i podsumowanie (pola, z których korzystają
// kalendarz, statystyki i stare widoki): średni nastrój i sumę emocji,
// czynników i osób ze wszystkich chwil.

export const nowaChwilaId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

// Chwile posortowane po godzinie; chwile bez godziny na początku (uzupełniane po fakcie).
export const posortujChwile = (chwile) =>
  [...chwile].sort((a, b) => (a.time || '').localeCompare(b.time || ''))

/** Chwile wpisu. Stary wpis (sprzed chwil) staje się jedną chwilą z jego danymi. */
export function chwileWpisu(log) {
  if (Array.isArray(log?.moments) && log.moments.length) {
    return log.moments.filter(c => c && c.value).map((c, i) => ({
      id: c.id || `m${i}`, time: c.time || null, value: c.value,
      emotions: c.emotions || [], factors: c.factors || [], peopleIds: c.peopleIds || [],
    }))
  }
  if (!log?.moodValue) return []
  return [{
    id: 'm0', time: log.time || null, value: Math.round(log.moodValue),
    emotions: log.emotions || [], factors: log.factors || [], peopleIds: log.peopleIds || [],
  }]
}

const unikalne = (listy) => [...new Set(listy.flat())]

/**
 * Podsumowanie dnia z chwil: średni nastrój (1–5, do dziesiątych), nastrój
 * ostatniej chwili oraz suma emocji, czynników i osób. `emotionTimes` to
 * godzina pierwszej chwili z daną emocją.
 */
export function podsumujDzien(chwile) {
  const t = posortujChwile(chwile.filter(c => c && c.value))
  if (!t.length) return null
  const emotionTimes = {}
  for (const c of t) for (const e of c.emotions || []) if (c.time && !emotionTimes[e]) emotionTimes[e] = c.time
  return {
    moodValue: Math.round((t.reduce((s, c) => s + c.value, 0) / t.length) * 10) / 10,
    ostatnia: t[t.length - 1].value,
    emotions: unikalne(t.map(c => c.emotions || [])),
    factors: unikalne(t.map(c => c.factors || [])),
    peopleIds: unikalne(t.map(c => c.peopleIds || [])),
    emotionTimes,
  }
}

/**
 * Chwile ze wszystkich wpisów jako osobne „mini-wpisy" do analizy wpływu:
 * praca i spotkanie tego samego dnia przestają się zlewać, bo każda chwila
 * ma swój nastrój. Klucz `date` jest unikalny dla chwili.
 */
export function chwileDoAnalizy(logi) {
  const out = []
  for (const l of logi) {
    if (!l.date) continue
    chwileWpisu(l).forEach((c, i) => out.push({ date: `${l.date}#${i}`, moodValue: c.value, factors: c.factors, peopleIds: c.peopleIds }))
  }
  return out
}
