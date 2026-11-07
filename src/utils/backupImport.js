// Import kopii JSON (z „Pobierz pełną kopię" albo kopii uzupełnionej o historię).
//
// Czysta logika: dostaje kopię i to, co już jest w bazie, i zwraca PLAN —
// co dodać, co pominąć i dlaczego. Zapis robi komponent ImportView.
//
// Zakres: tylko budżet — konta, transakcje i kategorie. Reszta modułów z kopii
// (nawyki, to-do…) zostaje nietknięta.
//
// Zasady bezpieczeństwa:
//  - nic nie jest nadpisywane ani usuwane, tylko dopisywane,
//  - salda istniejących kont się nie zmieniają (historia jest już w saldzie),
//  - transakcja, która już jest (to samo id albo ten sam dzień, typ, kwota
//    i konto), jest pomijana — import tej samej kopii drugi raz nic nie doda.

import { dupKey } from './budgetImport.js'

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

// Odwrotność serialize() z dataExport: ISO string → Date, rekurencyjnie.
export function reviveDates(value) {
  if (typeof value === 'string' && ISO.test(value)) return new Date(value)
  if (Array.isArray(value)) return value.map(reviveDates)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {}
    for (const k of Object.keys(value)) out[k] = reviveDates(value[k])
    return out
  }
  return value
}

// Czy to w ogóle kopia z apki?
export function isBackup(data) {
  return !!data && typeof data === 'object' && !Array.isArray(data)
    && Array.isArray(data.transactions) && Array.isArray(data.accounts)
}

const accKey = (a) => `${String(a.name ?? '').trim().toLowerCase()}|${a.currency || 'PLN'}|${a.type || ''}`

// Konta z kopii → konta w bazie. Najpierw po id; gdy baza jest innym projektem
// (inne id), po nazwie + walucie + typie. Brak dopasowania = nowe konto.
export function mapAccounts(backupAccounts, currentAccounts) {
  const byId = new Map(currentAccounts.map(a => [a.id, a]))
  const byKey = new Map()
  for (const a of currentAccounts) if (!byKey.has(accKey(a))) byKey.set(accKey(a), a)
  const map = {}          // id z kopii → id w bazie
  const toAdd = []
  const taken = new Set()
  for (const a of backupAccounts) {
    let hit = byId.get(a.id)
    if (!hit) {
      const k = byKey.get(accKey(a))
      if (k && !taken.has(k.id)) hit = k
    }
    if (hit) { map[a.id] = hit.id; taken.add(hit.id) }
    else { map[a.id] = a.id; toAdd.push(a) }
  }
  return { map, toAdd }
}

// Kategorie: zostają wszystkie obecne (nazwy, kolory, kolejność), dochodzą
// brakujące kategorie z kopii i brakujące podkategorie w istniejących.
export function mergeCategories(current, backup) {
  const out = {}
  const added = []
  for (const type of ['expense', 'income']) {
    const list = (current?.[type] || []).map(c => ({ ...c, subcategories: [...(c.subcategories || [])] }))
    for (const bc of backup?.[type] || []) {
      const ex = list.find(c => c.id === bc.id)
      if (!ex) {
        list.push({ ...bc, subcategories: [...(bc.subcategories || [])] })
        added.push({ type, label: bc.label })
        continue
      }
      for (const bs of bc.subcategories || []) {
        if (ex.subcategories.some(s => s.id === bs.id)) continue
        ex.subcategories.push(bs)
        added.push({ type, label: `${ex.label} → ${bs.label}` })
      }
    }
    for (const c of list) if (!c.subcategories.length) delete c.subcategories
    out[type] = list
  }
  return { categories: out, added }
}

function validTx(t) {
  return t && (t.type === 'income' || t.type === 'expense')
    && Number.isFinite(t.amount) && t.amount > 0
    && t.date instanceof Date && !Number.isNaN(t.date.getTime())
}

// Główny plan.
// backup: sparsowany JSON. current: { accounts, transactions, categories }
// gdzie transactions to [{ id, date: Date, type, amount, accountId }],
// a categories to dokument settings/categories (albo null).
// defaultCategories: { expense, income } — gdy w bazie nie ma jeszcze własnych.
export function planBackupImport(backup, current, defaultCategories) {
  const data = reviveDates(backup)
  const { map, toAdd: newAccounts } = mapAccounts(data.accounts || [], current.accounts || [])
  const remap = (id) => (id && map[id]) || id || null

  const existingIds = new Set((current.transactions || []).map(t => t.id))
  // Pula do porównania treści: dzień|typ|kwota|konto, z licznikiem.
  const pool = {}
  for (const t of current.transactions || []) {
    if (!(t.date instanceof Date)) continue
    const k = `${dupKey(t)}|${t.accountId || ''}`
    pool[k] = (pool[k] || 0) + 1
  }

  const transactions = []
  let sameId = 0, sameContent = 0, invalid = 0
  for (const raw of data.transactions || []) {
    if (!validTx(raw)) { invalid++; continue }
    if (existingIds.has(raw.id)) { sameId++; continue }
    const t = {
      ...raw,
      accountId: remap(raw.accountId),
      ...(raw.transferTo   ? { transferTo:   remap(raw.transferTo) }   : {}),
      ...(raw.transferFrom ? { transferFrom: remap(raw.transferFrom) } : {}),
    }
    const k = `${dupKey(t)}|${t.accountId || ''}`
    if (pool[k] > 0) { pool[k]--; sameContent++; continue }
    transactions.push(t)
  }

  const backupCats = data.singles?.['settings/categories']
  // Bez zapisanych kategorii apka pokazuje wbudowane domyślne — ale kopia ma
  // własne, kompletne. Dokładanie ich do domyślnych dawało podwójne „Auto",
  // „Zdrowie" itd., więc w pustej bazie bierzemy kategorie z kopii.
  // (defaultCategories zostaje tylko na wypadek kopii bez kategorii.)
  const hasOwn = current.categories?.expense?.length || current.categories?.income?.length
  const base = hasOwn ? current.categories : (backupCats ? { expense: [], income: [] } : defaultCategories)
  const { categories, added: newCategories } = backupCats
    ? mergeCategories(base, backupCats)
    : { categories: null, added: [] }

  const years = {}
  for (const t of transactions) {
    const y = t.date.getFullYear()
    years[y] = (years[y] || 0) + 1
  }

  return {
    newAccounts,
    transactions,
    categories: newCategories.length ? categories : null,
    newCategories,
    skipped: { sameId, sameContent, invalid },
    years,
  }
}
