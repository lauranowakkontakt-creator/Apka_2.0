import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from './categories.js'

// Transakcja zapisuje nazwę kategorii w chwili dodania (category,
// subcategoryLabel, subsubcategoryLabel). Po zmianie nazwy w „Zarządzaj
// kategoriami" stare wpisy zostawały ze starą — historia, wykresy i główny
// ekran pokazywały dwie nazwy jednej kategorii. Te funkcje wyznaczają, co
// trzeba w transakcjach poprawić.

/** id → aktualna nazwa, osobno dla kategorii, podkategorii i pod-podkategorii. */
export function etykietyKategorii(settings) {
  const cat = {}, sub = {}, subsub = {}
  ;[...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].forEach(c => { cat[c.id] = c.label })
  ;[...(settings?.expense || []), ...(settings?.income || [])].forEach(c => {
    if (c?.id && c.label) cat[c.id] = c.label
    ;(c?.subcategories || []).forEach(s => {
      if (s?.id && s.label) sub[s.id] = s.label
      ;(s?.subcategories || []).forEach(x => { if (x?.id && x.label) subsub[x.id] = x.label })
    })
  })
  return { cat, sub, subsub }
}

/** Poprawki do zapisania: [{ id, data }] — tylko pola, które się różnią. */
export function zmianyNazw(lista, et) {
  const out = []
  for (const t of lista) {
    const data = {}
    if (t.categoryId && et.cat[t.categoryId] && t.category !== et.cat[t.categoryId]) data.category = et.cat[t.categoryId]
    if (t.subcategoryId && et.sub[t.subcategoryId] && t.subcategoryLabel !== et.sub[t.subcategoryId]) data.subcategoryLabel = et.sub[t.subcategoryId]
    if (t.subsubcategoryId && et.subsub[t.subsubcategoryId] && t.subsubcategoryLabel !== et.subsub[t.subsubcategoryId]) data.subsubcategoryLabel = et.subsub[t.subsubcategoryId]
    if (Object.keys(data).length) out.push({ id: t.id, data })
  }
  return out
}
