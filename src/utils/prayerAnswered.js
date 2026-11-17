// Modlitwa: wybór osoby w formularzu, okno „od kiedy – do kiedy” i przejście
// wysłuchanej prośby do Wspomnika. Czysta logika bez Firebase
// (patrz test/prayerAnswered.test.js).

const jestAktywna = (i) => i?.status === 'active' || !i?.status

// Osoby do wyboru przy prośbie: najpierw bliscy, potem ci, za których modlę się
// najczęściej (aktywne prośby), dalej alfabetycznie. Osoby ukryte w modlitwie
// i z dalszego kręgu lądują na końcu, ale nie znikają.
export function osobyDoModlitwy(people = [], intentions = []) {
  const ile = {}
  for (const i of intentions) if (i?.personId && jestAktywna(i)) ile[i.personId] = (ile[i.personId] || 0) + 1
  const dalej = (p) => (p?.hiddenInPrayer ? 2 : p?.circle === 'far' ? 1 : 0)
  return [...people].sort((a, b) =>
    dalej(a) - dalej(b) ||
    (ile[b.id] || 0) - (ile[a.id] || 0) ||
    String(a.name || '').localeCompare(String(b.name || ''), 'pl'))
}

// Bez ogonków i wielkości liter, żeby „zosia” znalazło „Zośka”.
const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
export const pasujeOsoba = (p, q) => {
  const t = plain(q).trim()
  return !t || plain([p?.name, ...(p?.aliases || [])].join(' ')).includes(t)
}

const DATA = /^\d{4}-\d{2}-\d{2}$/

// Okno modlitwy z formularza → pola prośby. „Od” = od kiedy prośba pokazuje
// się w „Dziś”, „do” = ostatni dzień; po nim prośba sama idzie do archiwum
// (dateTo). Odwrócone daty zamieniamy miejscami zamiast odrzucać.
export function oknoModlitwy(od, doKiedy) {
  let f = DATA.test(String(od || '')) ? od : null
  let t = DATA.test(String(doKiedy || '')) ? doKiedy : null
  if (f && t && f > t) [f, t] = [t, f]
  return { scheduleFrom: f, scheduleTo: t, dateTo: t }
}

// Data do zdania: „17.11.2026”.
export const dataPL = (d) => { const [y, m, dd] = String(d).split('-'); return `${Number(dd)}.${m}.${y}` }

// Krótki opis okna na karcie prośby: „od 3.11”, „do 10.11”, „3.11 – 10.11”.
export function opisOkna(item) {
  const k = (d) => { const [, m, dd] = d.split('-'); return `${Number(dd)}.${m}` }
  const f = item?.scheduleFrom, t = item?.scheduleTo || item?.dateTo
  if (f && t) return `${k(f)} – ${k(t)}`
  if (f) return `od ${k(f)}`
  if (t) return `do ${k(t)}`
  return null
}

const ts = (v) => (typeof v?.toDate === 'function' ? v.toDate() : v instanceof Date ? v : null)
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Od kiedy trwała modlitwa: najwcześniejszy dzień modlitwy albo dzień dodania prośby.
export function poczatekModlitwy(item) {
  const dni = (item?.prayedDates || []).filter(d => DATA.test(d)).sort()
  const dodana = ts(item?.createdAt)
  const zDodania = dodana ? iso(dodana) : null
  if (dni[0] && zDodania) return dni[0] < zDodania ? dni[0] : zDodania
  return dni[0] || zDodania
}

const razy = (n) => {
  if (n === 1) return '1 raz'
  return `${n} razy`
}

// Wysłuchana prośba → gotowy szkic wspomnienia (do poprawienia w formularzu).
export function wspomnienieZProsby(item, person, today, jakSieStalo = '') {
  const tytul = String(item?.title || '').trim()
  const start = poczatekModlitwy(item)
  const n = item?.prayedDates?.length || 0
  const linie = []
  if (person?.name) linie.push(`Za kogo: ${person.name}.`)
  if (start) {
    const [y, m, d] = start.split('-')
    linie.push(`Modlitwa od ${Number(d)}.${m}.${y}${n ? ` — modliłam się ${razy(n)}` : ''}.`)
  }
  if (String(jakSieStalo).trim()) linie.push('', String(jakSieStalo).trim())
  return {
    title: person?.name ? `${tytul} (${person.name})` : tytul,
    text: linie.join('\n'),
    date: today,
    category: 'modlitwa',
    verse: '',
  }
}
