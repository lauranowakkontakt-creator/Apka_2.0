// Jeden wpis nastroju na dzień, do którego się dopisuje — czysta logika do testów.
//
// Zamiast osobnego wpisu na każdą zmianę nastroju dzień ma listę „chwil"
// [{ time: 'HH:mm' | null, value: 1–5 }]. Rano „źle", wieczorem „dobrze" to
// jeden wpis z dwiema chwilami; nastrój dnia (moodValue) to ich średnia.

/**
 * Nowa lista chwil po zapisie formularza.
 * - Dziś: zmieniony nastrój dopisuje nową chwilę z godziną; ten sam nie dubluje.
 * - Inny dzień (uzupełnianie po fakcie): godziny nie znamy, więc poprawiamy
 *   ostatnią chwilę zamiast dopisywać.
 */
export function chwilePoZapisie(chwile, value, time, dzis) {
  const lista = Array.isArray(chwile) ? chwile.filter(c => c && c.value) : []
  if (!lista.length) return [{ time: dzis ? time : null, value }]
  const ost = lista[lista.length - 1]
  if (ost.value === value) return lista
  if (!dzis) return [...lista.slice(0, -1), { ...ost, value }]
  return [...lista, { time, value }]
}

// Nastrój dnia: średnia chwil (1–5), zaokrąglona do dziesiątych.
export function wartoscDnia(chwile) {
  const t = (chwile || []).filter(c => c && c.value)
  if (!t.length) return null
  return Math.round((t.reduce((s, c) => s + c.value, 0) / t.length) * 10) / 10
}

/**
 * Godziny emocji: zachowane emocje trzymają swoją pierwszą godzinę, nowe
 * dostają `time` (tylko dziś), odznaczone znikają.
 */
export function czasyEmocji(poprzednie, emocje, time, dzis) {
  const out = {}
  for (const id of emocje) {
    if (poprzednie && poprzednie[id]) out[id] = poprzednie[id]
    else if (dzis && time) out[id] = time
  }
  return out
}

// Chwile dla starego wpisu, zapisanego zanim wpis stał się dniem.
export const chwileWpisu = (log) =>
  Array.isArray(log?.moments) && log.moments.length ? log.moments
    : log?.moodValue ? [{ time: log.time || null, value: Math.round(log.moodValue) }] : []
