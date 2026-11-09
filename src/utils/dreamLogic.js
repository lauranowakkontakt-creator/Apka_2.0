// Czysta logika modułu Sen — BEZ zależności od Firebase, dzięki czemu da się ją
// testować bez inicjalizacji bazy. Funkcje operujące na Firestore są w `dreams.js`.

// ─── Emocje po obudzeniu ───────────────────────────────────────────────────
export const DREAM_EMOTIONS = [
  { id: 'spokoj',        label: 'Spokój',          color: '#5FBF98' },
  { id: 'radosc',        label: 'Radość',          color: '#E6C04A' },
  { id: 'ulga',          label: 'Ulga',            color: '#7CC4E6' },
  { id: 'wdziecznosc',   label: 'Wdzięczność',     color: '#C9A24A' },
  { id: 'nadzieja',      label: 'Nadzieja',        color: '#7BCBB0' },
  { id: 'ekscytacja',    label: 'Ekscytacja',      color: '#EA964B' },
  { id: 'milosc',        label: 'Miłość',          color: '#E8607A' },
  { id: 'tesknota',      label: 'Tęsknota',        color: '#9FB2EC' },
  { id: 'zdezorientowanie', label: 'Zagubienie',   color: '#B79AE0' },
  { id: 'niepokoj',      label: 'Niepokój',        color: '#E0B15A' },
  { id: 'lek',           label: 'Lęk',             color: '#6E89DE' },
  { id: 'smutek',        label: 'Smutek',          color: '#6E89DE' },
  { id: 'zlosc',         label: 'Złość',           color: '#E66A4E' },
  { id: 'wstyd',         label: 'Wstyd',           color: '#D98B5F' },
  { id: 'obrzydzenie',   label: 'Obrzydzenie',     color: '#A878DC' },
]

// ─── Kategorie snów ─────────────────────────────────────────────────────────
export const DREAM_CATEGORIES = [
  { id: 'zwykly',       label: 'Zwykły',           color: '#7C8AF0' },
  { id: 'przyjemny',    label: 'Przyjemny',        color: '#5FBF98' },
  { id: 'koszmar',      label: 'Koszmar',          color: '#E66A4E' },
  { id: 'proroczy',     label: 'Proroczy',         color: '#C9A24A' },
  { id: 'duchowy',      label: 'Duchowy',          color: '#9CCB5E' },
  { id: 'powtarzajacy', label: 'Powtarzający się', color: '#5BB6D9' },
  { id: 'swiadomy',     label: 'Świadomy (lucid)', color: '#9B7CF0' },
  { id: 'dziwny',       label: 'Dziwny',           color: '#B79AE0' },
  { id: 'o_bliskich',   label: 'O bliskich',       color: '#D98B5F' },
  { id: 'koik',         label: 'Inny',             color: '#9E9E9E' },
]

export const SYMBOL_COLORS = [
  '#5BB6D9', '#5FBF98', '#9B7CF0', '#E0B15A', '#E8607A', '#7BCBB0',
  '#B79AE0', '#EA964B', '#6E89DE', '#C9A24A', '#A878DC', '#7C8AF0',
]

export const getEmotion  = (id) => DREAM_EMOTIONS.find(e => e.id === id)
export const getCategory = (id) => DREAM_CATEGORIES.find(c => c.id === id)

// Wbudowane kategorie snów + własne, dopisane przez użytkowniczkę. Własne idą
// na koniec i normalizujemy im kształt (w bazie leżą jako `label`/`name`), żeby
// reszta kodu nie musiała wiedzieć, skąd kategoria pochodzi. Id kolidujące
// z wbudowanym odsiewamy — inaczej wyszukiwanie trafiałoby zawsze we wbudowaną
// i własna nazwa nigdy by się nie pokazała.
export function mergeDreamCategories(custom = []) {
  const builtin = new Set(DREAM_CATEGORIES.map(c => c.id))
  const extra = (custom || [])
    .filter(c => c && c.id && !builtin.has(c.id))
    .map(c => ({
      id: c.id,
      label: (c.label || c.name || '').trim() || 'Bez nazwy',
      color: c.color || '#9E9E9E',
      custom: true,
    }))
  return [...DREAM_CATEGORIES, ...extra]
}

// Szukanie w podanej liście; bez listy spada do wbudowanych, żeby stare
// wywołania nie wybuchały.
export const findDreamCategory = (cats, id) =>
  (Array.isArray(cats) && cats.length ? cats : DREAM_CATEGORIES).find(c => c.id === id)

// Formy osoby, którymi można ją oznaczyć w śnie: pełne imię, samo imię (pierwszy człon)
// oraz dowolne ksywki zapisane w polu `aliases`. Bez pustych i duplikatów.
export function personForms(person) {
  if (!person) return []
  const forms = new Set()
  const name = (person.name || '').trim()
  if (name) {
    forms.add(name)
    const first = name.split(/\s+/)[0]
    if (first) forms.add(first)
  }
  for (const a of (person.aliases || [])) {
    const t = (a || '').trim()
    if (t) forms.add(t)
  }
  return [...forms]
}

// ─── Dopasowanie polskich odmian imion ──────────────────────────────────────
// „@Mateusza", „@Kasię", „@Franka" mają trafiać w osoby Mateusz, Kasia, Franek.
// Dopasowanie dosłowne ma pierwszeństwo, odmiana liczy się tylko, gdy dosłownego brak.
const isWordCh = (c) => !!c && /[\p{L}\p{N}]/u.test(c)

// Możliwe rdzenie odmiany jednowyrazowej formy (≥4 litery; krótsze tylko dosłownie).
// Zwykłe słowa, które wyglądają jak odmiana imienia (mamy = „mamy dom", nie „mama").
const NO_INFLECT_WORDS = new Set(['mamy'])

function inflectionStems(formLow) {
  // Krótkie formy (do 3 liter), wielowyrazowe i zdrobnienia na -o (Karo) nie odmieniają się dowolnie.
  if (formLow.length < 4 || /\s/.test(formLow) || /o$/u.test(formLow)) return []
  const out = new Set()
  const base = formLow.replace(/(a|e|o|y|i|ą|ę|u|ó)$/u, '')
  out.add(base.length >= 3 ? base : formLow)
  if (formLow.endsWith('ek')) out.add(formLow.slice(0, -2) + 'k')   // Franek → Franka
  if (formLow.endsWith('eł')) out.add(formLow.slice(0, -2) + 'ł')   // Paweł → Pawła
  return [...out]
}

// Ile znaków `restLow` (tekst PO znaczniku, małymi literami) pochłania forma.
// Zwraca { len, exact } albo null.
export function formMatch(restLow, form) {
  const f = (form || '').toLowerCase()
  if (!f) return null
  if (restLow.startsWith(f) && !isWordCh(restLow[f.length])) return { len: f.length, exact: true }
  const stems = inflectionStems(f)
  if (!stems.length) return null
  if (NO_INFLECT_WORDS.has((restLow.match(/^[\p{L}\p{N}]+/u) || [''])[0])) return null
  const word = (restLow.match(/^[\p{L}\p{N}]+/u) || [''])[0]
  let best = 0, bestStem = 0
  // Imiona na samogłoskę (Kasia, Paula) odmieniają się krótką końcówką (Kasię, Pauli), więc
  // dopuszczamy ≤2 litery (formy mnogie na -e/-i/-y: 3, np. rodzicami); imiona na spółgłoskę (Mateusz → Mateuszowi) do 4.
  const maxExtra = /[aąęo]$/u.test(f) ? 2 : /[eiyu]$/u.test(f) ? 3 : 4
  for (const st of stems) {
    const extra = word.length - st.length
    // Rdzeń z wypadającym -e- (Janek → Jank-iem, Franek → Frank-iem) bierze końcówki do 3 liter.
    const cap = f.endsWith('ek') && st === f.slice(0, -2) + 'k' ? 3 : st.length <= 4 ? 2 : 4
    if (word.startsWith(st) && extra <= Math.min(maxExtra, cap)) { best = Math.max(best, word.length); bestStem = Math.max(bestStem, st.length) }
  }
  return best ? { len: best, exact: false, stem: bestStem } : null
}

// Najlepsze dopasowanie osoby na początku `restLow`. Dosłowne wygrywa z odmianą,
// potem dłuższe. Zwraca { len, exact, ids } (ids: wszystkie osoby remisujące) albo null.
export function bestPersonMatch(restLow, people) {
  let best = null
  for (const p of people) {
    for (const form of personForms(p)) {
      const m = formMatch(restLow, form)
      if (!m) continue
      // Przy remisie odmian wygrywa dłuższy rdzeń (pastorową → pastorowa, a nie pastor).
      const better = !best || (m.exact && !best.exact) || (m.exact === best.exact && (m.len > best.len || (m.len === best.len && (m.stem || 0) > (best.stem || 0))))
      if (better) best = { ...m, ids: [p.id] }
      else if (m.exact === best.exact && m.len === best.len && (m.stem || 0) === (best.stem || 0) && !best.ids.includes(p.id)) best.ids.push(p.id)
    }
  }
  return best
}

// Wyłuskaj z treści snu osoby wspomniane przez @Forma (najdłuższe dopasowanie pierwsze).
// Formą może być pełne imię, samo imię lub ksywka (patrz personForms).
export function parseMentions(text, people) {
  if (!text) return []
  const found = new Set()
  const low = text.toLowerCase()
  for (let i = low.indexOf('@'); i !== -1; i = low.indexOf('@', i + 1)) {
    const m = bestPersonMatch(low.slice(i + 1), people)
    if (m) m.ids.forEach(id => found.add(id))
  }
  return [...found]
}

// Wszystkie formy zapisu symbolu: nazwa główna + połączone formy (`aliases`),
// np. „drzewo" + „drzewa", „drzewem". Bez pustych i bez powtórzeń.
export function symbolForms(s) {
  const seen = new Set()
  return [s?.name, ...(Array.isArray(s?.aliases) ? s.aliases : [])]
    .map(x => (x || '').trim()).filter(x => {
      const k = x.toLowerCase()
      if (!x || seen.has(k)) return false
      seen.add(k); return true
    })
}

// Rozbija wpis „#drzewa, drzewem" na listę form (po przecinku, # opcjonalne).
export function parseAliasInput(text) {
  return String(text || '').split(/[,;\n]/).map(x => x.trim().replace(/^#+\s*/, '').trim()).filter(Boolean)
}

// Czy symbol pasuje do wpisanej frazy (nazwa albo któraś połączona forma).
export function symbolMatchesQuery(s, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return true
  return symbolForms(s).some(f => f.toLowerCase().includes(q))
}

// Wyłuskaj z treści snu symbole oznaczone przez #nazwa lub #forma (najdłuższe dopasowanie pierwsze).
export function parseSymbols(text, symbols) {
  if (!text) return []
  const found = new Set()
  const forms = symbols.flatMap(s => symbolForms(s).map(f => ({ id: s.id, f })))
    .sort((a, b) => b.f.length - a.f.length)
  for (const { id, f } of forms) {
    const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp('#' + esc + '(?![\\p{L}\\p{N}])', 'iu')
    if (re.test(text)) found.add(id)
  }
  return [...found]
}

// Wykrywa aktywny „trigger" autouzupełniania na końcu tekstu przed kursorem.
//  - @osoba  — jedno słowo (imię/odmiana),
//  - #symbol — do 4 słów oddzielonych POJEDYNCZĄ spacją (np. „#stary dom"),
//    dzięki czemu można tworzyć symbole wielowyrazowe; spacja po ostatnim słowie
//    kończy tag, więc dalsze pisanie zdania działa normalnie.
// Zwraca { type, query, start } albo null. `start` to indeks znaku # / @.
export function detectTrigger(before) {
  const mSymbol = before.match(/#([\p{L}\p{N}]*(?: +[\p{L}\p{N}]+){0,3})$/u)
  if (mSymbol) return { type: 'symbol', query: mSymbol[1], start: before.length - mSymbol[1].length - 1 }
  const mPerson = before.match(/@([\p{L}\p{N}]*)$/u)
  if (mPerson) return { type: 'person', query: mPerson[1], start: before.length - mPerson[1].length - 1 }
  return null
}

// Tokenizacja treści snu do podświetlania. Zwraca segmenty:
//   { t: tekst do wyświetlenia (BEZ prefiksu @/#), kind: 'plain'|'person'|'symbol',
//     id: id encji lub null, color: kolor lub null }
// Zasada: znaczniki @Imię i #symbol są w zapisanym tekście, ale prefiks NIE jest
// pokazywany — segment dostaje kolor. Dzięki temu podświetlanie jest pewne
// (klucz to prefiks, nie zgadywanie po nazwie). Dla zgodności ze starymi snami
// (symbole bez #) podświetlamy też zwykłe słowa równe DOKŁADNIE nazwie symbolu.
export function tokenizeDreamText(text, people = [], symbols = []) {
  if (!text) return []
  const isWord = (c) => !!c && /[\p{L}\p{N}]/u.test(c)
  const lowText = text.toLowerCase()

  // Symbole przypięte do snu — najdłuższa nazwa pierwsza (żeby „stary dom" wygrał
  // nad „dom"). Dopasowujemy zarówno po #, jak i w zwykłym tekście (także WIELE słów).
  const symList = symbols.flatMap(s => symbolForms(s).map(f => ({ s, low: f.toLowerCase() })))
    .sort((a, b) => b.low.length - a.low.length)

  const segs = []
  let plain = ''
  const pushPlain = () => { if (plain) { segs.push({ t: plain, kind: 'plain', id: null, color: null }); plain = '' } }
  const symAt = (pos) => {
    const rest = lowText.slice(pos)
    return symList.find(({ low }) => rest.startsWith(low) && !isWord(text[pos + low.length]))
  }

  let i = 0
  while (i < text.length) {
    const c = text[i]
    const atBoundary = i === 0 || !isWord(text[i - 1])

    // Znaczniki #symbol / @osoba — prefiks jest pochłaniany (nie pokazujemy go).
    if (atBoundary && (c === '#' || c === '@')) {
      const restLow = lowText.slice(i + 1)
      if (c === '#') {
        const m = symAt(i + 1)
        if (m) { pushPlain(); segs.push({ t: text.slice(i + 1, i + 1 + m.low.length), kind: 'symbol', id: m.s.id, color: m.s.color || '#5BB6D9' }); i += 1 + m.low.length; continue }
        const w = text.slice(i + 1).match(/^[\p{L}\p{N}]+/u)
        if (w) { pushPlain(); segs.push({ t: w[0], kind: 'symbol', id: null, color: '#5BB6D9' }); i += 1 + w[0].length; continue }
      } else {
        const m = bestPersonMatch(restLow, people)
        if (m) {
          const p = people.find(x => x.id === m.ids[0])
          pushPlain(); segs.push({ t: text.slice(i + 1, i + 1 + m.len), kind: 'person', id: p.id, color: p.color || null }); i += 1 + m.len; continue
        }
        const w = text.slice(i + 1).match(/^[\p{L}\p{N}]+/u)
        if (w) { pushPlain(); segs.push({ t: w[0], kind: 'person', id: null, color: null }); i += 1 + w[0].length; continue }
      }
    }

    // Zwykły tekst: podświetl nazwę symbolu (też wielowyrazową) bez #.
    if (atBoundary && isWord(c)) {
      const m = symAt(i)
      if (m) { pushPlain(); segs.push({ t: text.slice(i, i + m.low.length), kind: 'symbol', id: m.s.id, color: m.s.color || '#5BB6D9' }); i += m.low.length; continue }
    }

    plain += c
    i++
  }
  pushPlain()
  return segs
}

// Wszystkie osoby powiązane ze snem (uczestnicy + wspomniani).
export const dreamPeopleIds = (dream) =>
  [...new Set([...(dream.peopleIds || []), ...(dream.mentionIds || [])])]

// Rdzeń imienia/słowa — bez końcowej samogłoski, żeby łapać polskie odmiany
// (Kasia → Kasi → Kasię/Kasią/Kasi, Ola → Ol → Olę/Olą...).
export const nameStem = (name) => {
  const s = (name || '').trim()
  return s.length >= 3 ? s.replace(/(a|e|o|y|i|ą|ę|u|ó)$/u, '') : s
}
