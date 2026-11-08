// Zaawansowane formy zapisu snu z podręcznika kursu 201 (rozdz. 4.1, 4.4, 5.1) —
// czysta logika bez Firebase i Reacta (układ rysunków, wskazówki, serie ćwiczeń).

// ─── Opowieść (rozdz. 5.1): wskazówki, jak wzmocnić sen ─────────────────────
export const STORY_TIPS = [
  'Twoim celem jest wzmocnić treść snu (jak w przekładzie Amplified Bible).',
  'Zacznij od klasycznego „Dawno, dawno temu…".',
  'Przesadzaj: co było małe, zrób bardzo małym, co duże, ogromnym.',
  'Opisz szczegółowo scenę i krajobraz, to pomaga zapamiętać atmosferę snu.',
  'Zapamiętaj ubiór i kolor każdego przedmiotu, bo to pomaga zrozumieć metaforę.',
  'Wprowadź dialogi, żeby wyrazić niewypowiedziane uczucia i myśli.',
  'Używaj opisowych przymiotników i przysłówków.',
  'Opowiadaj w czasie przeszłym.',
  'Dodaj do opowieści morał.',
  'Nadaj jej tytuł.',
]
export const STORY_OPENING = 'Dawno, dawno temu, '

// ─── Zawijanie podpisów w rysunkach ─────────────────────────────────────────
export function wrapLines(text, max = 12, maxLines = 3) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  const lines = []
  let cur = ''
  for (const w of words) {
    const word = w.length > max ? w.slice(0, max - 1) + '…' : w
    if (!cur) cur = word
    else if ((cur + ' ' + word).length <= max) cur += ' ' + word
    else { lines.push(cur); cur = word }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines)
    cut[maxLines - 1] = cut[maxLines - 1].replace(/…?$/, '…')
    return cut
  }
  return lines
}

// ─── Mapa myśli (rozdz. 4.1 III.A): chmura w środku → gałęzie → liście ──────
export const emptyMindMap = () => ({ center: '', branches: [] })

// Usuwa puste pola; zwraca null, gdy mapa nic nie zawiera.
export function cleanMindMap(map) {
  if (!map) return null
  const center = (map.center || '').trim()
  const branches = (map.branches || [])
    .map(b => ({ text: (b.text || '').trim(), leaves: (b.leaves || []).map(l => (l || '').trim()).filter(Boolean) }))
    .filter(b => b.text || b.leaves.length)
  return center || branches.length ? { center, branches } : null
}

// Układ promienisty. Zwraca węzły (kind: center | branch | leaf), krawędzie i ramkę rysunku.
export function mindMapLayout(map) {
  const m = cleanMindMap(map)
  if (!m) return null
  const R1 = 110, R2 = 215
  const nodes = [{ id: 'c', kind: 'center', x: 0, y: 0, lines: wrapLines(m.center || 'Sen', 11, 3) }]
  const edges = []
  const n = Math.max(1, m.branches.length)
  m.branches.forEach((b, i) => {
    // 1–2 gałęzie idą ukośnie (rysunek wychodzi zbliżony do kwadratu, a nie płaska kreska).
    const a = n <= 2 ? -Math.PI / 4 + Math.PI * i : (2 * Math.PI * i) / n - Math.PI / 2
    const bx = Math.cos(a) * R1, by = Math.sin(a) * R1
    nodes.push({ id: `b${i}`, kind: 'branch', x: bx, y: by, lines: wrapLines(b.text, 10, 3) })
    edges.push({ x1: 0, y1: 0, x2: bx, y2: by })
    const k = b.leaves.length
    const spread = Math.min(0.9, 0.38 * Math.max(0, k - 1))
    b.leaves.forEach((leaf, j) => {
      const la = a + (k === 1 ? 0 : -spread / 2 + (spread * j) / (k - 1))
      const lx = Math.cos(la) * R2, ly = Math.sin(la) * R2
      nodes.push({ id: `l${i}_${j}`, kind: 'leaf', x: lx, y: ly, lines: wrapLines(leaf, 12, 3) })
      edges.push({ x1: bx, y1: by, x2: lx, y2: ly })
    })
  })
  const pad = 48
  let minX = 0, maxX = 0, minY = 0, maxY = 0
  nodes.forEach(nd => { minX = Math.min(minX, nd.x); maxX = Math.max(maxX, nd.x); minY = Math.min(minY, nd.y); maxY = Math.max(maxY, nd.y) })
  return { nodes, edges, box: { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad } }
}

// ─── Diagram historii (rozdz. 4.1 III.B): oś scen z notatkami ───────────────
export const emptyScene = () => ({ text: '', notes: [] })

export function cleanDiagram(scenes) {
  const out = (scenes || [])
    .map(s => ({ text: (s.text || '').trim(), notes: (s.notes || []).map(x => (x || '').trim()).filter(Boolean) }))
    .filter(s => s.text || s.notes.length)
  return out.length ? out : null
}

// ─── Spirala (rozdz. 4.1 III.C): tekst od środka na zewnątrz ────────────────
// Spirala Archimedesa r = r0 + gap·θ/2π. Długość ścieżki dobieramy do długości tekstu.
export function spiralGeometry(text, { gap = 30, charW = 7.5, r0 = 14 } = {}) {
  const need = Math.max(String(text || '').length * charW + 40, 60)
  const pts = []
  let theta = 0, len = 0, prev = null
  const step = 0.05
  while (len < need && theta < 400) {
    const r = r0 + (gap * theta) / (2 * Math.PI)
    const p = [r * Math.cos(theta), r * Math.sin(theta)]
    if (prev) len += Math.hypot(p[0] - prev[0], p[1] - prev[1])
    pts.push(p)
    prev = p
    theta += step
  }
  const maxR = r0 + (gap * theta) / (2 * Math.PI)
  const size = Math.ceil(2 * (maxR + gap))
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(p[0] + size / 2).toFixed(1)} ${(p[1] + size / 2).toFixed(1)}`).join(' ')
  return { d, size }
}

// ─── Ćwiczenie pamięci (rozdz. 4.4): pokój, 5–7 szczegółów, codziennie przez tydzień ──
export const MEMORY_GOAL_DAYS = 7
export const MEMORY_MIN_DETAILS = 5
export const MEMORY_MAX_DETAILS = 7
export const MEMORY_ROOMS = ['Salon', 'Kuchnia', 'Sypialnia', 'Łazienka', 'Przedpokój', 'Pokój dziecka', 'Gabinet', 'Balkon']

// Ile kolejnych dni (kończąc dziś lub wczoraj) zrobiono ćwiczenie. dates: 'yyyy-MM-dd'.
export function memoryStreak(dates, todayIso) {
  const set = new Set(dates || [])
  const day = (iso, delta) => {
    const [y, m, d] = iso.split('-').map(Number)
    const t = new Date(Date.UTC(y, m - 1, d + delta))
    return t.toISOString().slice(0, 10)
  }
  let cursor = set.has(todayIso) ? todayIso : day(todayIso, -1)
  let n = 0
  while (set.has(cursor)) { n++; cursor = day(cursor, -1) }
  return n
}

// Wpis ćwiczenia ma sens, gdy jest pokój i co najmniej 5 niepustych szczegółów.
export const cleanMemoryDetails = (details) => (details || []).map(x => (x || '').trim()).filter(Boolean)
export const memoryEntryValid = (room, details) =>
  !!(room || '').trim() && cleanMemoryDetails(details).length >= MEMORY_MIN_DETAILS
