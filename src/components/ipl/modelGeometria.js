// Geometria modelu ciała (widok z przodu) dla modułu IPL.
//
// Rysunek ma oś w x = 105. Strona „prawa” osoby jest po LEWEJ stronie rysunku
// (patrzymy na osobę z przodu), więc znak -1 = prawa, +1 = lewa.
// Każda strefa to jeden kształt SVG: { d } — ścieżka, opcjonalnie `klip`
// (nazwa obrysu, do którego strefa jest przycinana, żeby podziały tułowia były
// proste, a sylwetka gładka) i `typ` ('ellipse' | 'rect') dla prostych figur.

export const SRODEK = 118
// Rozstaw poziomy sylwetki (tułów i położenie kończyn) i grubość kończyn — osobno,
// żeby ramiona i nogi nie robiły się grube, gdy tułów jest szeroki.
const K = 1.38
const W = 1.12
export const WIDOK = { w: 300, h: 556 }

const r1 = (n) => Math.round(n * 10) / 10
const pt = (x, y) => `${r1(x)} ${r1(y)}`

// Kapsuła — odcinek o zadanej grubości na obu końcach, z półokrągłymi końcami.
// Z niej składamy ręce i nogi.
function kapsula(ax, ay, aw, bx, by, bw) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy)
  const nx = -dy / len, ny = dx / len
  const ra = aw / 2, rb = bw / 2
  const p1 = [ax + nx * ra, ay + ny * ra], p2 = [bx + nx * rb, by + ny * rb]
  const p3 = [bx - nx * rb, by - ny * rb], p4 = [ax - nx * ra, ay - ny * ra]
  return `M${pt(...p1)} L${pt(...p2)} A${rb} ${rb} 0 0 0 ${pt(...p3)} L${pt(...p4)} A${ra} ${ra} 0 0 0 ${pt(...p1)} Z`
}

// Kapsuła po jednej stronie osi: dx to odległość od środka na zewnątrz.
const strona = (znak, adx, ay, aw, bdx, by, bw) =>
  kapsula(SRODEK + znak * adx * K, ay, aw * W, SRODEK + znak * bdx * K, by, bw * W)

const C = (dx) => r1(SRODEK + dx * K)

// Obrys tułowia — gładka sylwetka od szyi po krocze.
export const OBRYS_TULOWIA =
  `M${C(-13)} 76 Q${C(-30)} 79 ${C(-40)} 88 ` +
  `C${C(-41)} 110 ${C(-39)} 130 ${C(-36)} 160 ` +
  `C${C(-34)} 180 ${C(-30)} 190 ${C(-31)} 200 ` +
  `C${C(-33)} 215 ${C(-44)} 232 ${C(-44)} 252 ` +
  `Q${C(-26)} 262 ${C(0)} 268 Q${C(26)} 262 ${C(44)} 252 ` +
  `C${C(44)} 232 ${C(33)} 215 ${C(31)} 200 ` +
  `C${C(30)} 190 ${C(34)} 180 ${C(36)} 160 ` +
  `C${C(39)} 130 ${C(41)} 110 ${C(40)} 88 ` +
  `Q${C(30)} 79 ${C(13)} 76 Q${C(0)} 80 ${C(-13)} 76 Z`

const pas = (y1, y2) => ({ typ: 'rect', x: SRODEK - 90, y: y1, w: 180, h: y2 - y1, klip: 'tulow' })
const polowa = (znak, y1, y2) => ({ typ: 'rect', x: znak < 0 ? SRODEK - 90 : SRODEK, y: y1, w: 90, h: y2 - y1, klip: 'tulow' })

// Twarz — powiększona wstawka po prawej, bo na sylwetce byłaby za mała, żeby w nią trafić.
export const TWARZ = { cx: 256, cy: 82, rx: 38, ry: 50 }

function para(id, budowa) {
  return { [`${id}-p`]: budowa(-1), [`${id}-l`]: budowa(1) }
}

// d / kształt każdej strefy, w kolejności rysowania (późniejsze leżą na wierzchu).
export const KSZTALTY = {
  // ── nogi ──
  ...para('udo-g', z => ({ d: strona(z, 22, 258, 40, 22, 314, 36) })),
  ...para('udo-d', z => ({ d: strona(z, 22, 318, 36, 21, 366, 30) })),
  ...para('kolano', z => ({ d: strona(z, 21, 370, 28, 21, 392, 26) })),
  ...para('podudzie', z => ({ d: strona(z, 20, 396, 26, 17, 498, 16) })),
  ...para('stopa', z => ({ d: strona(z, 17, 503, 15, 19, 525, 21) })),
  ...para('palce-stopa', z => ({ d: strona(z, 19, 529, 21, 19, 541, 19) })),

  // ── ręce ──
  ...para('ramie', z => ({ d: strona(z, 46, 88, 19, 62, 155, 15) })),
  ...para('przedramie', z => ({ d: strona(z, 62, 161, 15, 74, 225, 11) })),
  ...para('dlon', z => ({ d: strona(z, 74, 230, 12, 79, 255, 14) })),
  ...para('palce-reka', z => ({ d: strona(z, 79, 259, 14, 82, 275, 10) })),

  // ── tułów (przycinany do obrysu) ──
  dekolt: pas(76, 104),
  piersi: pas(104, 134),
  'brzuch-g': pas(134, 172),
  'brzuch-d': pas(172, 214),
  ...para('bikini', z => polowa(z, 214, 270)),
  intymne: { d: `M${C(-13)} 222 L${C(13)} 222 L${C(11)} 245 L${C(0)} 262 L${C(-11)} 245 Z`, klip: 'tulow' },

  // pachy leżą na styku ręki i tułowia — na wierzchu
  ...para('pacha', z => ({ d: strona(z, 41, 99, 10, 41, 121, 10) })),
  szyja: { d: `M${C(-11)} 56 L${C(11)} 56 L${C(14)} 79 Q${C(0)} 84 ${C(-14)} 79 Z` },

  // ── twarz (wstawka) ──
  'policzek-p': { typ: 'ellipse', cx: TWARZ.cx - 25, cy: 95, rx: 11, ry: 19 },
  'policzek-l': { typ: 'ellipse', cx: TWARZ.cx + 25, cy: 95, rx: 11, ry: 19 },
  wasik: { typ: 'rect', x: TWARZ.cx - 14, y: 100, w: 28, h: 9, rx: 4.5 },
  broda: { typ: 'ellipse', cx: TWARZ.cx, cy: 123, rx: 16, ry: 9, klip: 'twarz' },
}

// Elementy czysto dekoracyjne (nie do klikania).
export const GLOWA = { cx: SRODEK, cy: 34, rx: 21, ry: 25 }
export const TWARZ_DEKORACJE = {
  oczy: [[TWARZ.cx - 14, 66], [TWARZ.cx + 14, 66]],
  nos: `M${TWARZ.cx} 72 L${TWARZ.cx - 4} 90 Q${TWARZ.cx} 93 ${TWARZ.cx + 4} 90`,
  usta: `M${TWARZ.cx - 9} 112 Q${TWARZ.cx} 116 ${TWARZ.cx + 9} 112`,
}
