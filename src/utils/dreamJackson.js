// Pola zapisu snu wg metody Johna Paula Jacksona (Streams Ministries) — czyste dane,
// bez Firebase. Nazwy rodzajów, kolorów i trzy źródła snów pochodzą z kursu
// „Understanding Dreams and Visions"; pytania pomocnicze są streszczeniem jego zasad.

// Pozycja śniącego: obserwujesz kogoś → sen nie jest o Tobie; jesteś w centrum → jest o Tobie.
export const DREAM_POSITIONS = [
  { id: 'obserwator', label: 'Obserwowałam', hint: 'Sen raczej nie jest o mnie' },
  { id: 'uczestnik',  label: 'Byłam w centrum', hint: 'Sen jest o mnie' },
]

// Trzy źródła snów (Tertulian, za Jacksonem).
export const DREAM_ORIGINS = [
  { id: 'bog',    label: 'Od Boga',   color: '#C9A24A' },
  { id: 'dusza',  label: 'Z duszy',   color: '#5BB6D9' },
  { id: 'demony', label: 'Ciemny / wróg', color: '#7C8AF0' },
  { id: 'nie_wiem', label: 'Nie wiem', color: '#9E9E9E' },
]

// Rodzaje snów z kursu (potwierdzone nazwy).
export const DREAM_KINDS = [
  { id: 'uzdrawiajacy',  label: 'Uzdrawiający',  color: '#5FBF98' },
  { id: 'oczyszczajacy', label: 'Oczyszczający', color: '#7CC4E6' },
  { id: 'powolania',     label: 'Powołania',     color: '#C9A24A' },
  { id: 'ostrzegawczy',  label: 'Ostrzegawczy',  color: '#E0B15A' },
  { id: 'falszywy',      label: 'Fałszywy',      color: '#B79AE0' },
  { id: 'cielesny',      label: 'Cielesny',      color: '#D98B5F' },
  { id: 'chemiczny',     label: 'Chemiczny',     color: '#A878DC' },
  { id: 'ciemny',        label: 'Ciemny',        color: '#6E89DE' },
  { id: 'duszy',         label: 'Duszy',         color: '#5BB6D9' },
]

// Jasność obrazu: kolorowy / przytłumiony / czarno-biały.
export const DREAM_VIVIDNESS = [
  { id: 'kolorowy',   label: 'Kolorowy' },
  { id: 'przytlumiony', label: 'Przytłumiony' },
  { id: 'czarno_bialy', label: 'Czarno-biały' },
]

// Wyraźne kolory w śnie. Znaczenie dobre/złe pokazujemy tylko tam, gdzie je mamy z kursu.
export const DREAM_COLORS = [
  { id: 'czerwony',  label: 'Czerwony',  color: '#E66A4E', plus: 'namaszczenie, odkupienie', minus: 'gniew, wojna' },
  { id: 'niebieski', label: 'Niebieski', color: '#5B8DEF', plus: 'objawienie', minus: 'depresja, izolacja' },
  { id: 'zielony',   label: 'Zielony',   color: '#5FBF98' },
  { id: 'zolty',     label: 'Żółty',     color: '#E6C04A' },
  { id: 'bialy',     label: 'Biały',     color: '#D8D8D8' },
  { id: 'czarny',    label: 'Czarny',    color: '#6B6B6B' },
  { id: 'fioletowy', label: 'Fioletowy', color: '#9B7CF0' },
  { id: 'pomaranczowy', label: 'Pomarańczowy', color: '#EA964B' },
  { id: 'zloty',     label: 'Złoty',     color: '#C9A24A' },
  { id: 'brazowy',   label: 'Brązowy',   color: '#9C7A5B' },
]

// Co było przed snem — pomaga odróżnić sen cielesny/chemiczny od przesłania.
export const BEFORE_SLEEP = [
  { id: 'alkohol',   label: 'Alkohol' },
  { id: 'leki',      label: 'Leki' },
  { id: 'ciezki_posilek', label: 'Ciężki posiłek' },
  { id: 'bol_choroba', label: 'Ból / choroba' },
  { id: 'gniew',     label: 'Nierozwiązany gniew' },
]

// Pytania pomocnicze do interpretacji — klik wstawia pytanie do pola.
export const GUIDE_QUESTIONS = [
  { id: 'glowna-mysl', group: 'Sen jako całość', q: 'Jaka jest główna myśl tej historii w jednym zdaniu?' },
  { id: 'element', group: 'Sen jako całość', q: 'Który element jest centralny — taki, bez którego sen by się rozpadł?' },
  { id: 'inne-sny', group: 'Sen jako całość', q: 'Czy tej nocy lub ostatnio śniły mi się inne sceny na ten sam temat?' },
  { id: 'emocja', group: 'Szczegóły', q: 'Co czułam w śnie, a co po obudzeniu? Czy te emocje się różniły?' },
  { id: 'kolory', group: 'Szczegóły', q: 'Jakie kolory były wyraźne? Co dla mnie znaczą (dobrze i źle)?' },
  { id: 'liczby', group: 'Szczegóły', q: 'Czy nie nadaję liczbom większego znaczenia, niż mają?' },
  { id: 'slownik', group: 'Mój słownik', q: 'Co dla mnie osobiście znaczy główny symbol? Co mi się z nim kojarzy?' },
  { id: 'powtarza', group: 'Mój słownik', q: 'Czy ten symbol wraca w innych snach? (Sprawdź zakładkę Symbole.)' },
  { id: 'cialo', group: 'Rozeznanie', q: 'Czy to mógł być sen cielesny lub chemiczny (jedzenie, leki, alkohol, ból)?' },
  { id: 'zrodlo', group: 'Rozeznanie', q: 'Jaki jest owoc tego snu — pokój i jasność czy lęk i zamęt?' },
  { id: 'ogloszenie', group: 'Co dalej', q: 'Czy i komu to przekazać? Czy to na pewno nie jest sen o mnie samej?' },
]

export const findIn = (list, id) => list.find(x => x.id === id)

// Dodaje pytanie do tekstu interpretacji (bez duplikatów).
export function appendQuestion(current, q) {
  const text = current || ''
  if (text.includes(q)) return text
  const sep = text && !text.endsWith('\n') ? '\n\n' : ''
  return text + sep + q + '\n'
}

// Czy sen ma wypełnione jakiekolwiek pola rozszerzone — do rozwinięcia sekcji w formularzu.
export const hasJacksonFields = (d) => !!d && !!(
  d.position || d.origin || d.kind || d.vividness || d.mainElement || d.numbers || d.application ||
  d.colors?.length || d.beforeSleep?.length
)
