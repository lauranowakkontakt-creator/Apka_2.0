// Zatwierdzanie kategorii i kont przed importem pliku, który ma własne
// kategorie (np. arkusz z kolumnami Kategoria / Podkategoria).
//
// Czysta logika. Przebieg:
//   buildReview(items)           → drzewo kategorii i lista kont z pliku
//   defaultDecisions(...)        → propozycja: dopasuj do apki po nazwie
//   (użytkowniczka zmienia nazwy, przenosi, łączy, zatwierdza)
//   resolveReview(...)           → gotowy dokument kategorii + mapowanie
//   assignCategory(item, res)    → categoryId / subcategoryId dla transakcji
//
// Decyzje:
//   cats[catKey] = { name, target }   target: 'new' | 'app:<id>' | 'file:<catKey>'
//   subs[subKey] = { name, parent }   parent: 'same' | 'none' | 'app:<id>' | 'file:<catKey>'
//   accs[name]   = { target, currency } target: 'new' | 'app:<id>'
//   approved     = { [catKey|subKey]: true }

const norm = (s) => String(s ?? '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').trim()
const squash = (s) => norm(s).replace(/[^a-z0-9]/g, '')

export const NO_SUB = '(bez podkategorii)'
export const catKeyOf = (type, label) => `${type}|${label}`
export const subKeyOf = (catKey, label) => `${catKey}|${label}`

const itemCatKey = (it) => catKeyOf(it.type, it.raw?.category || 'Inne')
const itemSubKey = (it) => subKeyOf(itemCatKey(it), it.raw?.subcategory || '')

// ── Drzewo z pliku ──────────────────────────────────────────────────────────

export function buildReview(items) {
  const cats = new Map()
  const accs = new Map()
  let transfers = 0
  for (const it of items) {
    if (it.raw?.account) {
      const a = accs.get(it.raw.account) || { name: it.raw.account, count: 0, currencies: {} }
      a.count++
      a.currencies[it.currency] = (a.currencies[it.currency] || 0) + 1
      accs.set(it.raw.account, a)
    }
    if (it.transfer) { transfers++; continue }
    const ck = itemCatKey(it)
    let c = cats.get(ck)
    if (!c) { c = { key: ck, type: it.type, label: it.raw?.category || 'Inne', count: 0, subs: new Map() }; cats.set(ck, c) }
    c.count++
    const sk = itemSubKey(it)
    let s = c.subs.get(sk)
    if (!s) { s = { key: sk, label: it.raw?.subcategory || '', count: 0, ex: {} }; c.subs.set(sk, s) }
    s.count++
    const e = (it.raw?.detail || it.raw?.bank || it.description || '').slice(0, 40)
    if (e) s.ex[e] = (s.ex[e] || 0) + 1
  }
  const byCount = (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pl')
  return {
    transfers,
    cats: [...cats.values()].map(c => ({
      key: c.key, type: c.type, label: c.label, count: c.count,
      subs: [...c.subs.values()].map(s => ({
        key: s.key, label: s.label, count: s.count,
        examples: Object.entries(s.ex).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k),
      })).sort(byCount),
    })).sort((a, b) => (a.type === b.type ? 0 : a.type === 'expense' ? -1 : 1) || byCount(a, b)),
    accounts: [...accs.values()].map(a => ({
      name: a.name, count: a.count,
      currency: Object.entries(a.currencies).sort((x, y) => y[1] - x[1])[0]?.[0] || 'PLN',
    })).sort((a, b) => b.count - a.count),
  }
}

// ── Propozycja startowa ─────────────────────────────────────────────────────

// Konto z pliku → konto w apce: dokładna nazwa, potem nazwa „bez ozdobników"
// (Erste (firmowe) = ERSTE firmowe), potem prefiks (Revolut EUR ↔ Revolut euro,
// Gotówka (z arkusza) ↔ Gotówka). Przy kilku trafieniach wygrywa ta sama waluta.
export function matchAccount(name, currency, accounts) {
  const n = squash(name)
  const score = (a) => {
    const m = squash(a.name)
    if (!m) return 0
    let s = 0
    if (norm(a.name) === norm(name)) s = 100
    else if (m === n) s = 90
    else if (n.startsWith(m) || m.startsWith(n)) s = 50 + Math.min(m.length, n.length)
    if (!s) return 0
    const same = (a.currency || 'PLN') === (currency || 'PLN')
    // Podobna nazwa w innej walucie to inne konto (Revolut CZK ≠ Revolut PLN)
    if (!same && s < 90) return 0
    if (same) s += 20
    if (a.type === 'investment') s -= 5
    return s
  }
  let best = null, bestS = 0
  for (const a of accounts) {
    const s = score(a)
    if (s > bestS) { best = a; bestS = s }
  }
  return best
}

export function defaultDecisions(review, appCats, appAccounts) {
  const cats = {}, subs = {}, accs = {}
  for (const c of review.cats) {
    const hit = (appCats?.[c.type] || []).find(a => norm(a.label) === norm(c.label))
    cats[c.key] = { name: c.label, target: hit ? `app:${hit.id}` : 'new' }
    for (const s of c.subs) subs[s.key] = { name: s.label, parent: s.label ? 'same' : 'none' }
  }
  for (const a of review.accounts) {
    const hit = matchAccount(a.name, a.currency, appAccounts || [])
    accs[a.name] = { target: hit ? `app:${hit.id}` : 'new', currency: a.currency }
  }
  return { cats, subs, accs, approved: {} }
}

// Wszystko, co trzeba zatwierdzić (kategorie i podkategorie).
export const reviewKeys = (review) => review.cats.flatMap(c => [c.key, ...c.subs.map(s => s.key)])

// ── Rozwiązanie decyzji ─────────────────────────────────────────────────────

const PALETTE = ['#C97A55', '#A8B5A0', '#9AAFB8', '#D4A574', '#9B8FA8', '#E0B570', '#7A9E9A', '#B89090', '#8A7E72', '#6366F1', '#14B8A6', '#EC4899']

function uniqueId(base, taken) {
  let id = base || 'imp', i = 2
  while (taken.has(id)) id = `${base}_${i++}`
  taken.add(id)
  return id
}
const slug = (s) => squash(s).slice(0, 24) || 'x'

export function resolveReview(review, dec, appCats) {
  const out = {}
  const catMap = {}           // catKey → id kategorii w apce
  const subMap = {}           // subKey → { categoryId, subcategoryId }
  const created = [], renamed = []

  for (const type of ['expense', 'income']) {
    const list = (appCats?.[type] || []).map(c => ({ ...c, subcategories: [...(c.subcategories || [])] }))
    const ids = new Set(list.map(c => c.id))
    const fileCats = review.cats.filter(c => c.type === type)
    const known = new Set(fileCats.map(c => c.key))

    // Łańcuch „połącz z" kończy się na kategorii, która nie wskazuje dalej.
    const rootOf = (key) => {
      const seen = new Set()
      let k = key
      while (!seen.has(k)) {
        seen.add(k)
        const t = dec.cats[k]?.target || 'new'
        if (!t.startsWith('file:') || !known.has(t.slice(5))) return k
        k = t.slice(5)
      }
      return key // cykl — traktuj jak samodzielną
    }

    for (const c of fileCats) {
      if (rootOf(c.key) !== c.key) continue
      const d = dec.cats[c.key] || { name: c.label, target: 'new' }
      const name = (d.name || '').trim() || c.label
      const appId = d.target?.startsWith('app:') ? d.target.slice(4) : null
      let cat = appId ? list.find(x => x.id === appId) : null
      if (cat) {
        if (name !== cat.label) { renamed.push({ from: cat.label, to: name }); cat.label = name }
      } else {
        // Nowa — ale ta sama nazwa co istniejąca = połączenie z nią
        cat = list.find(x => norm(x.label) === norm(name))
        if (!cat) {
          cat = { id: uniqueId(`imp_${slug(name)}`, ids), label: name, icon: 'IconTag', color: PALETTE[list.length % PALETTE.length], subcategories: [] }
          list.push(cat)
          created.push({ type, label: name })
        }
      }
      catMap[c.key] = cat.id
    }
    for (const c of fileCats) if (!catMap[c.key]) catMap[c.key] = catMap[rootOf(c.key)]

    for (const c of fileCats) {
      for (const s of c.subs) {
        const d = dec.subs[s.key] || { name: s.label, parent: 'same' }
        const p = d.parent || 'same'
        let catId = catMap[c.key]
        if (p.startsWith('file:') && catMap[p.slice(5)]) catId = catMap[p.slice(5)]
        else if (p.startsWith('app:') && list.some(x => x.id === p.slice(4))) catId = p.slice(4)
        const name = (d.name || '').trim()
        if (p === 'none' || !name) { subMap[s.key] = { categoryId: catId, subcategoryId: null }; continue }
        const cat = list.find(x => x.id === catId)
        let sub = cat.subcategories.find(x => norm(x.label) === norm(name))
        if (!sub) {
          const sids = new Set(list.flatMap(x => x.subcategories.map(y => y.id)))
          sub = { id: uniqueId(`imp_sub_${slug(name)}`, sids), label: name, icon: 'IcTag' }
          cat.subcategories.push(sub)
          created.push({ type, label: `${cat.label} → ${name}` })
        }
        subMap[s.key] = { categoryId: catId, subcategoryId: sub.id }
      }
    }
    for (const c of list) if (!c.subcategories.length) delete c.subcategories
    out[type] = list
  }
  return { categories: out, catMap, subMap, created, renamed }
}

export function assignCategory(item, res) {
  if (item.transfer) {
    return { categoryId: 'transfer', category: 'Przelew', categoryIcon: 'IconTransfer', subcategoryId: null, subcategoryLabel: null }
  }
  const m = res.subMap[itemSubKey(item)] || { categoryId: res.catMap[itemCatKey(item)] || 'inne', subcategoryId: null }
  const cat = res.categories[item.type]?.find(c => c.id === m.categoryId)
  const sub = cat?.subcategories?.find(s => s.id === m.subcategoryId)
  return {
    categoryId: m.categoryId,
    category: cat?.label || m.categoryId,
    categoryIcon: cat?.icon || 'IconTag',
    subcategoryId: sub?.id || null,
    subcategoryLabel: sub?.label || null,
  }
}

export function guessAccountType(name) {
  const n = norm(name)
  if (/gotowk|portfel|miedziak|koperta|cash/.test(n)) return 'cash'
  if (/revolut|wise|zen/.test(n)) return 'revolut'
  if (/xtb|binance|inwest|krypto/.test(n)) return 'investment'
  return 'bank'
}
