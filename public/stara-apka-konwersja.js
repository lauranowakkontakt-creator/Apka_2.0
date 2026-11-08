// Zamiana danych ze STAREJ Apki (baza aplikacja-0) na plik, który rozumie „Import snów" w Apce 2.0.
// Czysta funkcja bez zależności — używa jej strona stara-apka-eksport.html i testy.
//
// Wejście: dokumenty z kolekcji dreams, dreamSymbols, dreamCategories i calendarPeople
// (każdy z polem id). Treść snu zostaje DOKŁADNIE taka, jaką zapisałaś (razem ze znacznikami @ i #).

const BUILTIN = ['zwykly', 'przyjemny', 'koszmar', 'proroczy', 'duchowy', 'powtarzajacy', 'swiadomy', 'dziwny', 'o_bliskich', 'koik']

const text = (v) => (typeof v === 'string' ? v.trim() : '')

export function convertOldApp({ dreams = [], symbols = [], categories = [], people = [] }) {
  const symbolName = Object.fromEntries(symbols.map(s => [s.id, text(s.name)]))
  const personName = Object.fromEntries(people.map(p => [p.id, text(p.name)]))
  const catLabel = Object.fromEntries(categories.map(c => [c.id, text(c.label || c.name)]))

  const out = dreams
    .filter(d => d && (text(d.title) || text(d.text)) && /^\d{4}-\d{2}-\d{2}/.test(d.date || ''))
    .map(d => {
      const o = { title: text(d.title), date: d.date.slice(0, 10), text: text(d.text) }
      if (text(d.interpretation)) o.interpretation = text(d.interpretation)
      if (d.category) {
        if (BUILTIN.includes(d.category)) o.category = d.category
        else if (catLabel[d.category]) o.kategoria = catLabel[d.category]
      }
      if (Array.isArray(d.emotions) && d.emotions.length) o.emotions = d.emotions
      const syms = (d.symbolIds || []).map(id => symbolName[id]).filter(Boolean)
      if (syms.length) o.symbole = syms
      const who = (d.peopleIds || []).map(id => personName[id]).filter(Boolean)
      if (who.length) o.uczestnicy = who
      return o
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    people: people.filter(p => text(p.name)).map(p => ({
      name: text(p.name), aliases: (p.aliases || []).map(text).filter(Boolean), note: text(p.note), color: text(p.color),
    })),
    symbols: symbols.filter(s => text(s.name)).map(s => ({ name: text(s.name), color: text(s.color), meaning: text(s.meaning) })),
    categories: categories.filter(c => text(c.label || c.name)).map(c => ({ name: text(c.label || c.name), color: text(c.color) })),
    dreams: out,
  }
}
