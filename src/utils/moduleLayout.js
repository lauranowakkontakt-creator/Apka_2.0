// Układ modułów: kolejność i ukrywanie — sterowane przez użytkownika.
// Trzymane lokalnie (jak preferencje ikon), bo lista modułów jest po stronie
// klienta i nie ma sensu jej synchronizować przez Firestore.
//
//   { order: ['home', 'prayer', 'budget', ...], hidden: ['dream', ...] }
//
// Pulpit ('home') jest przypięty na pierwszej pozycji i nie da się go ukryć —
// to launcher całej aplikacji, bez niego nie ma z czego wybierać.

export const LAYOUT_KEY = 'mw_moduleLayout'
export const FIXED_FIRST = 'home'
// Ile modułów mieści dolny pasek na telefonie (ostatni slot zajmuje „Więcej").
export const NAV_SLOTS = 4

// Porządkuje zapisany układ względem modułów, które faktycznie istnieją:
// nieznane id znikają, a moduły dodane w nowej wersji aplikacji dopisują się
// na koniec jako widoczne — dzięki temu nowa apka nie gubi się w starym układzie.
export function normalizeLayout(raw, allIds) {
  const known = new Set(allIds)
  const savedOrder = Array.isArray(raw?.order) ? raw.order.filter(id => known.has(id)) : []
  const seen = new Set(savedOrder)
  const order = [...savedOrder, ...allIds.filter(id => !seen.has(id))]

  // Pulpit zawsze pierwszy, niezależnie od tego, co jest w zapisie.
  const rest = order.filter(id => id !== FIXED_FIRST)
  const finalOrder = known.has(FIXED_FIRST) ? [FIXED_FIRST, ...rest] : rest

  const hidden = (Array.isArray(raw?.hidden) ? raw.hidden : [])
    .filter(id => known.has(id) && id !== FIXED_FIRST)

  return { order: finalOrder, hidden: [...new Set(hidden)] }
}

export function getLayout(allIds) {
  let raw = null
  try { raw = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null') } catch { /* ignore */ }
  return normalizeLayout(raw, allIds)
}

export function saveLayout(layout) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)) } catch { /* ignore */ }
}

// Moduły w kolejności użytkownika, każdy z flagą `hidden`.
export function applyLayout(modules, layout) {
  const byId = new Map(modules.map(m => [m.id, m]))
  const hidden = new Set(layout?.hidden || [])
  return (layout?.order || modules.map(m => m.id))
    .map(id => byId.get(id))
    .filter(Boolean)
    .map(m => ({ ...m, hidden: hidden.has(m.id) }))
}

export const visibleModules = (modules) => modules.filter(m => !m.hidden)

// Moduły na dolny pasek: pierwsze widoczne, tyle ile slotów.
export const navModules = (modules, slots = NAV_SLOTS) => visibleModules(modules).slice(0, slots)

// Przesunięcie o jedną pozycję. Pulpit stoi w miejscu i nic nie przeskakuje
// przed niego — dlatego przestawiamy tylko ogon listy.
export function moveModule(order, id, dir) {
  if (id === FIXED_FIRST) return [...order]
  const head = order.filter(x => x === FIXED_FIRST)
  const rest = order.filter(x => x !== FIXED_FIRST)
  const i = rest.indexOf(id)
  const to = i + dir
  if (i === -1 || to < 0 || to >= rest.length) return [...order]
  const next = [...rest]
  ;[next[i], next[to]] = [next[to], next[i]]
  return [...head, ...next]
}

// Przeciąganie: moduł `id` ląduje na miejscu modułu `naId` (Pulpit zostaje pierwszy).
export function moveModuleTo(order, id, naId) {
  if (id === FIXED_FIRST || naId === FIXED_FIRST || id === naId) return [...order]
  const head = order.filter(x => x === FIXED_FIRST)
  const rest = order.filter(x => x !== FIXED_FIRST)
  const from = rest.indexOf(id), to = rest.indexOf(naId)
  if (from === -1 || to === -1) return [...order]
  const next = [...rest]
  next.splice(from, 1)
  next.splice(to, 0, id)
  return [...head, ...next]
}

export function toggleHidden(layout, id) {
  if (id === FIXED_FIRST) return layout
  const hidden = new Set(layout.hidden || [])
  if (hidden.has(id)) hidden.delete(id)
  else hidden.add(id)
  return { ...layout, hidden: [...hidden] }
}

export const isHidden = (layout, id) => (layout?.hidden || []).includes(id)
