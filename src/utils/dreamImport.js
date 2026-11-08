// Import snów z plików (Dreamy, kopia z tej apki, ogólna lista JSON) — czysta logika
// bez Firebase. Zapis robi komponent DreamImport.
//
// Zasady bezpieczeństwa (tak samo jak przy imporcie budżetu):
//  - nic nie jest nadpisywane ani usuwane, tylko dopisywane,
//  - sen, który już jest (to samo id albo ta sama data i tytuł), jest pomijany,
//    więc ten sam plik można wgrać drugi raz i nic się nie zdubluje,
//  - treść snu zostaje taka, jak ją napisano; jedyna zmiana to znak @ przed
//    imieniem osoby (żeby w apce było podświetlone i klikalne).

import { bestPersonMatch, formMatch } from './dreamLogic.js'

const APPLE_EPOCH_MS = Date.UTC(2001, 0, 1)

// Dreamy zapisuje datę jako sekundy od 1.01.2001 (czas Apple). Zamieniamy na dzień
// w czasie polskim, bo sen zapisany o 23:30 ma należeć do tego dnia, nie do następnego.
export function appleToIso(seconds, timeZone = 'Europe/Warsaw') {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null
  const d = new Date(APPLE_EPOCH_MS + seconds * 1000)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  return /^\d{4}-\d{2}-\d{2}$/.test(parts) ? parts : null
}

// Liczba: sekundy Apple (Dreamy), sekundy Unix albo milisekundy. Tekst: dzień z początku.
const isoDay = (v, apple = false) => {
  if (typeof v === 'number') {
    if (apple) return appleToIso(v)
    if (v > 1e11) return new Date(v).toISOString().slice(0, 10)
    return v >= 1.2e9 ? new Date(v * 1000).toISOString().slice(0, 10) : appleToIso(v)
  }
  const m = typeof v === 'string' && v.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

// Typy snów z Dreamy → kategorie w apce. Nastrój z Dreamy pomijamy (w Twoim pliku
// wszystkie wpisy mają „happy", więc niczego nie mówi).
const DREAMY_TYPES = {
  'normal dream': 'zwykly', 'nightmare': 'koszmar', 'daydream': 'koik',
  'lucid dream': 'swiadomy', 'recurring dream': 'powtarzajacy', 'prophetic dream': 'proroczy',
}

const str = (v) => (typeof v === 'string' ? v.trim() : '')

// Wejście: tekst pliku. Wyjście: { format, dreams, skipped } albo { error }.
// dream: { title, date, text, interpretation, category, extra }
export function parseDreamFile(text) {
  let data
  try { data = JSON.parse(text) } catch { return { error: 'To nie jest poprawny plik JSON.' } }
  const list = Array.isArray(data) ? data : Array.isArray(data?.dreams) ? data.dreams : null
  if (!list) return { error: 'Nie widzę w pliku listy snów (spodziewam się klucza „dreams" albo samej listy).' }
  if (!list.length) return { error: 'Lista snów w pliku jest pusta.' }

  const first = list.find(x => x && typeof x === 'object') || {}
  const format = 'dreamDescription' in first || 'dreamTitle' in first ? 'dreamy'
    : ('text' in first || 'title' in first) && typeof first.date === 'string' ? 'apka' : 'ogolny'

  const dreams = []
  let skipped = 0
  const pickNames = (x) => ({
    symbolNames: Array.isArray(x.symbole) ? x.symbole.map(str).filter(Boolean) : [], categoryName: str(x.kategoria),
    peopleNames: Array.isArray(x.uczestnicy) ? x.uczestnicy.map(str).filter(Boolean) : [],
  })
  const pickLink = (x) => (x.powiazania && typeof x.powiazania === 'object' ? { skip: x.powiazania.pomin || [], force: x.powiazania.jako || {} } : undefined)
  for (const x of list) {
    if (!x || typeof x !== 'object') { skipped++; continue }
    let d
    if (format === 'dreamy') {
      d = {
        title: str(x.dreamTitle), date: isoDay(x.date, true), text: str(x.dreamDescription),
        interpretation: str(x.dreamInterpretation), category: DREAMY_TYPES[str(x.dreamType).toLowerCase()] || null,
      }
    } else if (format === 'apka') {
      d = {
        title: str(x.title), date: isoDay(x.date), text: str(x.text), interpretation: str(x.interpretation),
        category: x.category || null,
        extra: Object.fromEntries(['emotions', 'position', 'sphere', 'origin', 'kinds', 'vividness', 'colors', 'atmosphere',
          'elements', 'numbers', 'mainElement', 'context', 'wakeTime', 'beforeSleep', 'application', 'story', 'storyMoral',
          'mindMap', 'diagram', 'spiral', 'originalText'].filter(k => x[k] != null && x[k] !== '' && !(Array.isArray(x[k]) && !x[k].length)).map(k => [k, x[k]])),
        link: pickLink(x), ...pickNames(x),
      }
    } else {
      d = {
        title: str(x.title ?? x.tytul ?? x['tytuł'] ?? x.name), date: isoDay(x.date ?? x.data ?? x.createdAt),
        text: str(x.text ?? x.tresc ?? x['treść'] ?? x.content ?? x.description ?? x.opis ?? x.body),
        interpretation: str(x.interpretation ?? x.interpretacja), category: str(x.category) || null,
        extra: x.originalText ? { originalText: str(x.originalText) } : undefined,
        link: pickLink(x), ...pickNames(x),
      }
    }
    if (!d.date || (!d.title && !d.text)) { skipped++; continue }
    dreams.push(d)
  }
  if (!dreams.length) return { error: 'Nie znalazłam w pliku żadnego snu z datą i treścią.' }
  dreams.sort((a, b) => a.date.localeCompare(b.date))
  // Opcjonalne listy w pliku: osoby (name, aliases, note) i symbole (name, meaning, color).
  const cleanList = (arr) => (Array.isArray(arr) ? arr : []).filter(x => x && str(x.name))
    .map(x => ({ name: str(x.name), aliases: (x.aliases || []).map(str).filter(Boolean), note: str(x.note), meaning: str(x.meaning), color: str(x.color) }))
  const people = Array.isArray(data) ? [] : cleanList(data.people)
  const symbols = Array.isArray(data) ? [] : cleanList(data.symbols)
  const categories = Array.isArray(data) ? [] : cleanList(data.categories)
  return { format, dreams, skipped, people, symbols, categories }
}

// ─── Identyfikatory i duplikaty ─────────────────────────────────────────────
const hash36 = (s) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(36)
}
// Stałe id z treści: ponowny import tego samego snu trafia w ten sam dokument.
export const dreamId = (d) => `imp_${d.date}_${hash36(`${d.title}|${d.text}`)}`
export const dupKey = (d) => `${d.date}|${(d.title || '').trim().toLowerCase()}`

// ─── Szukanie osób i symboli w tekście ──────────────────────────────────────
const WORD = /[\p{L}][\p{L}\p{N}]*/gu

// Odmiana nazwy symbolu: „dom" → „domu", „domem"; wielowyrazowe tylko dosłownie.
function symbolMatchLen(restLow, nameLow) {
  const w = (restLow.match(/^[\p{L}\p{N}]+/u) || [''])[0]
  // Krótkie nazwy (do 3 liter, np. „dom", „lew") tylko z typowymi końcówkami, żeby „lew" nie łapał „lewo".
  if (!/\s/.test(nameLow) && nameLow.length <= 3) {
    return w === nameLow || (w.startsWith(nameLow) && /^(u|em|owi|ie|y|a|ach|ów|om|ami|ek|ku|ka|ki)$/.test(w.slice(nameLow.length))) ? w.length : 0
  }
  const m = formMatch(restLow, nameLow)
  if (m) return m.len
  if (!/\s/.test(nameLow) && nameLow.length >= 3) {
    if (w.startsWith(nameLow) && w.length - nameLow.length <= 3) return w.length
  }
  return 0
}

// Przeszukuje tekst: zwraca nową treść (z @ przed osobami, jeśli tag), listy id
// i niejednoznaczności. Nie rusza słów już poprzedzonych @ albo #.
// opcje: tag — dopisz @ przed imionami; skip — słowa (małe litery, początek słowa), których NIE łączymy z osobami;
// force — { początek słowa (małe litery) → pełna nazwa osoby }, gdy w tym śnie imię znaczy konkretną osobę.
export function linkText(text, people, symbols, { tag = true, skip = [], force = {} } = {}) {
  const low = text.toLowerCase()
  const skipList = skip.map(x => x.toLowerCase())
  const forceList = Object.entries(force).map(([k, name]) => [k.toLowerCase(), people.find(p => (p.name || '').toLowerCase() === String(name).toLowerCase())])
  const mentionIds = new Set()
  const symbolIds = new Set()
  const ambiguous = []   // { word, ids }
  const inserts = []     // pozycje, przed którymi wstawiamy @
  for (const m of text.matchAll(WORD)) {
    const i = m.index
    const prev = text[i - 1]
    if (prev === '@' || prev === '#') {
      // już oznaczone ręcznie — tylko zbieramy powiązania
      if (prev === '@') { const pm = bestPersonMatch(low.slice(i), people); if (pm) pm.ids.forEach(id => mentionIds.add(id)) }
      continue
    }
    const rest = low.slice(i)
    const word = m[0].toLowerCase()
    if (skipList.some(k => word.startsWith(k))) continue
    const forced = forceList.find(([k, person]) => person && word.startsWith(k))
    if (forced) { mentionIds.add(forced[1].id); inserts.push(i); continue }
    const pm = bestPersonMatch(rest, people)
    if (pm) {
      const matched = text.slice(i, i + pm.len)
      // Bardzo krótkie ksywki (do 3 liter) tylko gdy zapisane wielką literą, żeby nie łapać zwykłych słów.
      const shortOk = pm.len >= 4 || (matched[0] !== matched[0].toLowerCase() && pm.len >= 2)
      if (shortOk) {
        if (pm.ids.length > 1) ambiguous.push({ word: matched, ids: [...pm.ids] })
        else { mentionIds.add(pm.ids[0]); inserts.push(i) }
        continue
      }
    }
    for (const s of symbols) {
      if (s.auto) continue   // symbole automatyczne przypisujemy wprost z reguł, nie po słowach w tekście
      const nm = (s.name || '').trim().toLowerCase()
      if (nm && symbolMatchLen(rest, nm) > 0) { symbolIds.add(s.id); break }
    }
  }
  let out = text
  if (tag) for (const pos of [...inserts].sort((a, b) => b - a)) out = out.slice(0, pos) + '@' + out.slice(pos)
  return { text: out, mentionIds: [...mentionIds], symbolIds: [...symbolIds], ambiguous }
}

// ─── Propozycje nowych symboli (częste rzeczowniki z Twoich snów) ───────────
const STOP = new Set(`to ten ta te tej tym tych tego jest są był była było byli były będzie będą ale albo oraz więc żeby żebym
  gdy gdzie kiedy jak jako czy nie tak już jeszcze tylko też także bardzo trochę potem później wtedy teraz tam tutaj tu
  mnie mi mój moja moje moich mojej moim moimi sobie siebie się nas nam nami was wam ich im nimi jego jej go ją je nim nią
  oni one ona ono ja ty my wy który która które których którym którą kto co coś ktoś jakiś jakaś jakieś jakiegoś jakąś
  przez przed pod nad przy bez dla do od za na po w z ze we ku u o oraz lub bo ponieważ chociaż mimo że by bym byś
  kilka kilku wiele wszystko wszyscy wszystkich wszystkie cały cała całe każdy każda każde inny inna inne innych jeden jedna jedno
  dwa dwie dwóch trzy dużo mało więcej mniej bardzo właśnie nagle zaczęło zaczęła zaczął mogłam mogłem mogła mógł mogę chciałam
  chciałem chciała wiedziałam wiedziałem wiedziała nikt nikogo nic niczego sen śnił śniło
  gdzieś jakoś jakimś jakiejś jakimś chyba niej niego niemu nich takie takiego taki taka takim dalej może bardziej wiec razem obok
  mówi mówił mówiła powiedział powiedziała chciał miał miała mają miało czas czasie osoba osoby osobę osobą rzecz rzeczy rzeczą
  ludzi ludzie ludziom miejsce miejsca miejscu chwila chwile chwilę strona strony stronę stronie śnie potem najpierw później
  zaczęli zaczęliśmy poszliśmy weszliśmy wyszliśmy pojechaliśmy dobrze super fajny fajna fajne normalnie prawie znowu znów
  jakiś jakiegoś którymś kimś czymś komuś czegoś gdzie indziej pewnie można trzeba musiałam musiałem musi muszę końcu jakby jedną grupie osób chce różne wyjeździe dzień prostu przyszedł innego inni jestem mamy moją kogoś szybko początku przykro robi dlaczego drugi każdego międzyczasie mocno nawet pierwsza starym wyszedł angielsku innymi jakichś jakiś lekko nasze pani jednak mówię patrzę`.split(/\s+/))
// Czasowniki (czas przeszły i bezokolicznik) odsiewamy po końcówce — zostają głównie rzeczowniki.
const VERBISH = /(łam|łem|ła|ło|ły|li|liśmy|łyśmy|ć|ąc|ając|ęła|ęło|ęli|ąłem|ąłam|ał|ił|eł|ął|ował|owała|ować|ejmy|ajmy|uje|uję)$/u

// Zwraca [{ word, count }] — słowa występujące w co najmniej `min` snach,
// z pominięciem osób i symboli, które już są. Słowa o tym samym rdzeniu łączymy.
export function suggestSymbols(texts, { people = [], symbols = [], min = 4, limit = 30 } = {}) {
  const known = [...symbols.map(s => (s.name || '').toLowerCase())]
  const docs = new Map()   // rdzeń → { word (najczęstsza forma), docs:Set, forms:Map }
  texts.forEach((t, di) => {
    const seen = new Set()
    for (const m of t.matchAll(WORD)) {
      const w = m[0].toLowerCase()
      if (w.length < 4 || STOP.has(w) || VERBISH.test(w)) continue
      if (people.length && bestPersonMatch(w, people)) continue
      const stem = w.length > 5 ? w.slice(0, -2) : w.length > 4 ? w.slice(0, -1) : w
      if (known.some(k => k && (w.startsWith(k.slice(0, Math.max(3, k.length - 2))) && Math.abs(w.length - k.length) <= 3))) continue
      if (seen.has(stem)) { docs.get(stem).forms.set(w, (docs.get(stem).forms.get(w) || 0) + 1); continue }
      seen.add(stem)
      const e = docs.get(stem) || { docs: new Set(), forms: new Map() }
      e.docs.add(di); e.forms.set(w, (e.forms.get(w) || 0) + 1)
      docs.set(stem, e)
    }
  })
  return [...docs.values()]
    .filter(e => e.docs.size >= min)
    .map(e => ({ word: [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0], count: e.docs.size }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit)
}

// ─── Nowe osoby: imiona z wielkiej litery w środku zdania, których nie ma na liście ──
const NOT_NAMES = new Set(`bóg boga bogu bogiem boże bożej bożego jezus jezusa jezusowi chrystus chrystusa chrystusowi pan pana panu
  duch ducha święty polska polsce polskę niemcy anglia anglii grecja grecji grecję indie indiach warszawa warszawie warszawy
  kraków krakowie ameryka ameryce europa europie`.split(/\s+/))

// Zwraca [{ name, count, forms }] — kandydaci na osoby (≥ `min` snów), najczęstsi pierwsi.
// Odmiany tego samego imienia (Monia, Monią, Monie) łączymy w jedną osobę.
export function suggestNewPeople(texts, people = [], { min = 2, limit = 40, exclude = [] } = {}) {
  // Nazwiska znanych osób i nazwy symboli (np. koty, postacie) to nie nowe osoby.
  const known = new Set(exclude.map(x => x.toLowerCase()))
  for (const p of people) for (const w of (p.name || '').split(/\s+/).slice(1)) known.add(w.toLowerCase())
  const isKnown = (low) => [...known].some(k => formMatch(low, k)?.len === low.length || low === k)
  const groups = new Map()   // rdzeń → { forms: Map(forma → ile), docs: Set }
  texts.forEach((t, di) => {
    for (const m of t.matchAll(/(?<![\p{L}@#])\p{Lu}[\p{L}]{2,}/gu)) {
      const before = t.slice(0, m.index).trimEnd()
      if (!before || /[.!?:]$/.test(before)) continue            // początek zdania
      const w = m[0], low = w.toLowerCase()
      if (NOT_NAMES.has(low) || VERBISH.test(low) || STOP.has(low)) continue
      if (bestPersonMatch(low, people) || isKnown(low)) continue
      const stem = low.length > 4 ? low.replace(/(em|om|ami|ach)$/u, '').replace(/[aąęeioyuó]+$/u, '') : low
      const g = groups.get(stem) || { forms: new Map(), docs: new Set() }
      g.forms.set(w, (g.forms.get(w) || 0) + 1); g.docs.add(di); groups.set(stem, g)
    }
  })
  return [...groups.values()]
    .filter(g => g.docs.size >= min)
    .map(g => {
      // Mianownik jest zwykle najkrótszą formą (Daniel, nie Danielem); przy remisie wygrywa częstsza.
      const forms = [...g.forms.entries()].sort((a, b) => a[0].length - b[0].length || b[1] - a[1])
      return { name: forms[0][0], count: g.docs.size, forms: forms.map(f => f[0]) }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

// Dodaje do osób dodatkowe formy (ksywki) wskazane przez użytkownika: { forma(mała litera) → idOsoby }.
export function withAliases(people, choices = {}) {
  const byId = {}
  for (const [form, id] of Object.entries(choices)) if (id) (byId[id] ||= []).push(form)
  return people.map(p => byId[p.id] ? { ...p, aliases: [...new Set([...(p.aliases || []), ...byId[p.id]])] } : p)
}

// ─── Ten sam sen z dwóch źródeł ─────────────────────────────────────────────
// Sen z Dreamy i ten sam sen przepisany do starej apki mają różne tytuły i trochę inny tekst,
// więc samo „data + tytuł" nie wystarcza. Uznajemy za ten sam, gdy data się zgadza,
// a teksty mają dużo wspólnych słów.
const words = (t) => new Set(String(t || '').toLowerCase().replace(/[@#]/g, '').match(/[\p{L}\p{N}]{4,}/gu) || [])
export function textSimilarity(a, b) {
  const A = words(a), B = words(b)
  if (!A.size || !B.size) return 0
  let common = 0
  for (const w of A) if (B.has(w)) common++
  // Dzielimy przez średnią długość, żeby krótki sen zawarty w długim nie był uznany za ten sam.
  return common / ((A.size + B.size) / 2)
}
export function isSameDream(d, other, threshold = 0.4) {
  if (other.date !== d.date) return false
  if ((other.title || '').trim().toLowerCase() === (d.title || '').trim().toLowerCase()) return true
  const mine = [d.text, d.extra?.originalText]
  const theirs = [other.text, other.originalText]
  return mine.some(m => m && theirs.some(t => t && textSimilarity(m, t) >= threshold))
}

// ─── Plan importu ───────────────────────────────────────────────────────────
// dreams: z parseDreamFile; existing: [{ id, date, title }]; people/symbols: z bazy.
// options: { tag, link } — dopisywać @ i łączyć osoby/symbole.
export function planDreamImport({ dreams, existing = [], people = [], symbols = [], categories = [], options = {} }) {
  const { tag = true, link = true, only = null } = options   // only: Set id osób do powiązania (null = wszystkie)
  const ids = new Set(existing.map(e => e.id))
  const keys = new Set(existing.map(dupKey))
  const existingByDate = new Map()
  for (const e of existing) { if (!existingByDate.has(e.date)) existingByDate.set(e.date, []); existingByDate.get(e.date).push(e) }
  const peopleUse = only ? people.filter(p => only.has(p.id)) : people
  const toAdd = []
  const perPerson = {}
  const perSymbol = {}
  const perCategory = {}
  const ambiguous = new Map()   // słowo (mała litera) → { word, ids, count }
  const years = {}
  let dup = 0
  for (const d of dreams) {
    const id = dreamId(d)
    if (ids.has(id) || keys.has(dupKey(d)) || existingByDate.get(d.date)?.some(o => isSameDream(d, o))) { dup++; continue }
    ids.add(id); keys.add(dupKey(d))
    const r = link ? linkText(d.text, peopleUse, symbols, { tag, ...(d.link || {}) }) : { text: d.text, mentionIds: [], symbolIds: [], ambiguous: [] }
    // Symbole wskazane w pliku wprost (np. „Woda", gdy w tekście jest „w wodzie") — suma z wykrytymi w tekście.
    if (link && d.symbolNames?.length) {
      const have = new Set(r.symbolIds)
      for (const nm of d.symbolNames) {
        const sy = symbols.find(x => (x.name || '').toLowerCase() === nm.toLowerCase())
        if (sy && !have.has(sy.id)) { have.add(sy.id); r.symbolIds.push(sy.id) }
      }
    }
    // Uczestnicy wskazani w pliku z imienia (stara apka zapisuje je osobno od wzmianek w tekście).
    const participantIds = []
    for (const nm of d.peopleNames || []) {
      const pe = people.find(x => (x.name || '').toLowerCase() === nm.toLowerCase())
      if (pe && !participantIds.includes(pe.id)) participantIds.push(pe.id)
    }
    participantIds.forEach(p => { perPerson[p] = (perPerson[p] || 0) + 1 })
    r.mentionIds.forEach(p => { perPerson[p] = (perPerson[p] || 0) + 1 })
    r.symbolIds.forEach(s => { perSymbol[s] = (perSymbol[s] || 0) + 1 })
    const catByName = d.categoryName ? categories.find(c => (c.label || '').toLowerCase() === d.categoryName.toLowerCase()) : null
    const category = catByName?.id || d.category || null
    if (category) perCategory[category] = (perCategory[category] || 0) + 1
    for (const a of r.ambiguous) {
      const k = a.word.toLowerCase()
      const e = ambiguous.get(k) || { word: a.word, ids: a.ids, count: 0 }
      e.count++; ambiguous.set(k, e)
    }
    years[d.date.slice(0, 4)] = (years[d.date.slice(0, 4)] || 0) + 1
    toAdd.push({
      id,
      data: {
        title: d.title, date: d.date, text: r.text, interpretation: d.interpretation || '',
        category, emotions: [], peopleIds: participantIds, mentionIds: r.mentionIds.filter(id => !participantIds.includes(id)), symbolIds: r.symbolIds,
        ...(d.extra || {}), imported: true,
      },
    })
  }
  return { toAdd, dup, perPerson, perSymbol, perCategory, ambiguous: [...ambiguous.values()].sort((a, b) => b.count - a.count), years }
}

// Dopasowanie osób i symboli w snach, które już są w apce (np. po dodaniu nowej osoby).
// Tekst dostaje @ tylko przy imionach, które jeszcze go nie mają; powiązania tylko się dopisują.
export function planRelink({ dreams, people = [], symbols = [], options = {} }) {
  const { tag = true } = options
  const updates = []
  const perPerson = {}
  for (const d of dreams) {
    const text = d.text || ''
    const r = linkText(text, people, symbols, { tag })
    const mention = [...new Set([...(d.mentionIds || []), ...r.mentionIds])]
    const sym = [...new Set([...(d.symbolIds || []), ...r.symbolIds])]
    const changed = r.text !== text || mention.length !== (d.mentionIds || []).length || sym.length !== (d.symbolIds || []).length
    if (!changed) continue
    r.mentionIds.forEach(p => { perPerson[p] = (perPerson[p] || 0) + 1 })
    updates.push({ id: d.id, data: { text: r.text, mentionIds: mention, symbolIds: sym } })
  }
  return { updates, perPerson }
}
