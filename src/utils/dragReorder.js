// Przeciąganie elementów listy palcem lub myszą — czysta logika, bez Reacta.
//
// `rects` to prostokąty wierszy zmierzone na starcie przeciągania
// ({ top, height }), `from` to indeks chwyconego wiersza, `dy` — o ile pikseli
// przesunął się palec. Wiersz „ląduje" tam, gdzie jego środek minie środek
// sąsiada, czyli tak, jak to działa w listach na telefonie.

const srodek = (r) => r.top + r.height / 2

/** Indeks, na który trafi chwycony wiersz po przesunięciu o `dy`. */
export function docelowyIndeks(rects, from, dy) {
  if (!rects?.length || from < 0 || from >= rects.length) return from
  const c = srodek(rects[from]) + dy
  let to = from
  while (to + 1 < rects.length && c > srodek(rects[to + 1])) to++
  while (to - 1 >= 0 && c < srodek(rects[to - 1])) to--
  return to
}

/** Wysokość „kroku" chwyconego wiersza: jego wysokość plus odstęp do sąsiada. */
export function krok(rects, from) {
  const r = rects[from]
  if (!r) return 0
  const nast = rects[from + 1], poprz = rects[from - 1]
  const gap = nast ? nast.top - (r.top + r.height) : poprz ? r.top - (poprz.top + poprz.height) : 0
  return r.height + Math.max(0, gap)
}

/** O ile przesunąć wiersz `j`, żeby zrobić miejsce chwyconemu (from → to). */
export function przesuniecie(j, from, to, h) {
  if (j === from) return 0
  if (from < to && j > from && j <= to) return -h
  if (from > to && j >= to && j < from) return h
  return 0
}

/** Kopia tablicy z elementem przeniesionym z `from` na `to`. */
export function przenies(arr, from, to) {
  const next = [...arr]
  if (from === to || from < 0 || from >= next.length || to < 0 || to >= next.length) return next
  const [el] = next.splice(from, 1)
  next.splice(to, 0, el)
  return next
}
