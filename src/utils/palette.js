// Wspólna paleta kolorów całej aplikacji — 50 kolorów w 5 rzędach po 10.
//
// Każdy rząd to dwie rodziny barw ułożone płynnie odcieniami, tak żeby podobne
// kolory stały obok siebie (np. wszystkie pomarańcze razem, potem żółcie).
// Ten sam zestaw widać w każdym miejscu, gdzie wybiera się kolor: nawyki,
// kategorie, konta, cele, listy, osoby, sny…
export const PALETTE_ROWS = [
  // czerwienie → róże
  ['#7F1D1D', '#B91C1C', '#DC2626', '#EF4444', '#F87171', '#F472B6', '#EC4899', '#DB2777', '#BE185D', '#831843'],
  // pomarańcze → żółcie
  ['#9A3412', '#C94B28', '#E05A2B', '#F97316', '#FB923C', '#FCD34D', '#FBBF24', '#F59E0B', '#D97706', '#B45309'],
  // brązy → beże
  ['#4E342E', '#6D4C41', '#8D5B3E', '#A0703F', '#B8875A', '#C9A27E', '#D4A574', '#D8BFA0', '#E3CFB4', '#EADDC8'],
  // zielenie → turkusy
  ['#84CC16', '#65A30D', '#4D7C0F', '#6B9E72', '#22C55E', '#16A34A', '#166534', '#0F766E', '#0D9488', '#14B8A6'],
  // błękity → fiolety
  ['#06B6D4', '#0EA5E9', '#3B82F6', '#2563EB', '#1E3A8A', '#4338CA', '#6366F1', '#7C3AED', '#8B5CF6', '#A855F7'],
]

export const APP_COLORS = PALETTE_ROWS.flat()

// Domyślny kolor nowej rzeczy — ceglasty pomarańcz marki.
export const DEFAULT_COLOR = '#C94B28'
