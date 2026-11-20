// Geometria modelu ciała (widok z przodu) dla modułu IPL.
//
// Sylwetka składa się z gładkich części (tułów, ręce, nogi), a każda strefa to
// poziomy „przekrój” takiej części — pas przycięty do jej obrysu. Dzięki temu
// brzegi stref są gładkie jak sama sylwetka, a podziały proste jak na rysunku
// anatomicznym.
//
// Oś ciała jest w x = SRODEK. Strona „prawa” osoby jest po LEWEJ stronie
// rysunku (patrzymy na osobę z przodu): znak -1 = prawa, +1 = lewa.
// Twarz to osobny rysunek z własnym układem współrzędnych (TWARZ).

export const SRODEK = 120
export const WIDOK = { w: 240, h: 560 }

const r1 = (n) => Math.round(n * 10) / 10
const P = (x, y) => `${r1(x)} ${r1(y)}`

// Gładka krzywa przez punkty (Catmull-Rom zamieniony na krzywe Béziera).
function gladka(pts, zamknieta = true) {
  const n = pts.length
  const at = (i) => zamknieta ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]
  let d = `M${P(...pts[0])}`
  const koniec = zamknieta ? n : n - 1
  for (let i = 0; i < koniec; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${P(...c1)} ${P(...c2)} ${P(...p2)}`
  }
  return zamknieta ? d + ' Z' : d
}

// Kończyna: oś (punkty) i grubość w każdym z nich → gładki obrys z zaokrąglonymi końcami.
function konczyna(os) {
  const lewa = [], prawa = []
  os.forEach(([x, y, w], i) => {
    const a = os[Math.max(0, i - 1)], b = os[Math.min(os.length - 1, i + 1)]
    let tx = b[0] - a[0], ty = b[1] - a[1]
    const dl = Math.hypot(tx, ty) || 1
    tx /= dl; ty /= dl
    lewa.push([x - ty * w / 2, y + tx * w / 2])
    prawa.push([x + ty * w / 2, y - tx * w / 2])
  })
  const [x0, y0, w0] = os[0], [x1, y1, w1] = os[os.length - 1]
  const t0 = [os[1][0] - x0, os[1][1] - y0], t1 = [x1 - os[os.length - 2][0], y1 - os[os.length - 2][1]]
  const l0 = Math.hypot(...t0) || 1, l1 = Math.hypot(...t1) || 1
  const czapkaGora = [x0 - t0[0] / l0 * w0 * 0.42, y0 - t0[1] / l0 * w0 * 0.42]
  const czapkaDol = [x1 + t1[0] / l1 * w1 * 0.55, y1 + t1[1] / l1 * w1 * 0.55]
  return gladka([czapkaGora, ...lewa, czapkaDol, ...prawa.reverse()])
}

const X = (znak, dx) => SRODEK + znak * dx

// Tułów od szyi po biodra — połowa punktów (dx, y), druga to lustro. Dno jest
// płaskie i leży dokładnie tam, gdzie zaczynają się nogi, więc przejście z bioder
// w uda nie ma widocznego szwu.
const DNO_TULOWIA = 298
const POLOWA_TULOWIA = [
  [13, 76], [32, 82], [52, 88], [58, 99], [47, 121], [43, 143], [37, 169],
  [32, 197], [34, 225], [44, 253], [51, 275], [52, DNO_TULOWIA],
]
const obrysTulowia = () => {
  const lewa = POLOWA_TULOWIA.map(([dx, y]) => [X(-1, dx), y])      // od szyi w dół
  const prawa = POLOWA_TULOWIA.map(([dx, y]) => [X(1, dx), y])
  // od dołu po lewej, w górę, przez szyję, w dół po prawej; dno zamykamy prostą
  return `${gladka([...lewa.reverse(), [SRODEK, 80], ...prawa], false)} Z`
}

const os = {
  reka: (z) => [
    [X(z, 56), 106, 22], [X(z, 61), 142, 21], [X(z, 70), 188, 18], [X(z, 80), 226, 15],
    [X(z, 87), 262, 11], [X(z, 91), 282, 15], [X(z, 94), 304, 14], [X(z, 96), 330, 9],
  ],
  noga: (z) => [
    [X(z, 26), 276, 50], [X(z, 26), 300, 50], [X(z, 27), 336, 46], [X(z, 28), 380, 38], [X(z, 28), 412, 32],
    [X(z, 28), 450, 34], [X(z, 26), 490, 22], [X(z, 25), 516, 16], [X(z, 27), 536, 22],
    [X(z, 28), 553, 18],
  ],
}

// Szyja: osobna strefa, wchodzi trochę na dekolt.
const SZYJA = `M${P(X(-1, 10), 58)} L${P(X(-1, 11), 80)} Q${P(SRODEK, 91)} ${P(X(1, 11), 80)} L${P(X(1, 10), 58)} Z`

export const CZESCI = {
  szyja: SZYJA,
  tulow: obrysTulowia(),
  'reka-p': konczyna(os.reka(-1)), 'reka-l': konczyna(os.reka(1)),
  'noga-p': konczyna(os.noga(-1)), 'noga-l': konczyna(os.noga(1)),
}

// Głowa — tylko tło, nie do klikania.
export const GLOWA = { cx: SRODEK, cy: 36, rx: 22, ry: 29 }

const pasX = (z) => (z < 0 ? [SRODEK - 110, SRODEK] : [SRODEK, SRODEK + 110])
// Pas poziomy między y1 a y2: na całą szerokość albo po jednej stronie.
const pas = (czesc, y1, y2, znak = 0) => {
  const [x1, x2] = znak ? pasX(znak) : [SRODEK - 110, SRODEK + 110]
  return { typ: 'rect', czesc, x: x1, y: y1, w: x2 - x1, h: y2 - y1, srodekX: (x1 + x2) / 2 }
}
const para = (id, budowa) => ({ [`${id}-p`]: budowa(-1), [`${id}-l`]: budowa(1) })

// Strefy ciała — w kolejności rysowania (późniejsze leżą na wierzchu).
export const KSZTALTY = {
  // nogi
  ...para('udo-g', z => pas(`noga-${z < 0 ? 'p' : 'l'}`, 296, 352, z)),
  ...para('udo-d', z => pas(`noga-${z < 0 ? 'p' : 'l'}`, 352, 404, z)),
  ...para('kolano', z => pas(`noga-${z < 0 ? 'p' : 'l'}`, 404, 436, z)),
  ...para('podudzie', z => pas(`noga-${z < 0 ? 'p' : 'l'}`, 436, 504, z)),
  ...para('stopa', z => pas(`noga-${z < 0 ? 'p' : 'l'}`, 504, 538, z)),
  ...para('palce-stopa', z => pas(`noga-${z < 0 ? 'p' : 'l'}`, 538, 560, z)),
  // ręce
  ...para('ramie', z => pas(`reka-${z < 0 ? 'p' : 'l'}`, 80, 190, z)),
  ...para('przedramie', z => pas(`reka-${z < 0 ? 'p' : 'l'}`, 190, 262, z)),
  ...para('dlon', z => pas(`reka-${z < 0 ? 'p' : 'l'}`, 262, 306, z)),
  ...para('palce-reka', z => pas(`reka-${z < 0 ? 'p' : 'l'}`, 306, 340, z)),
  // tułów
  dekolt: pas('tulow', 70, 108),
  piersi: pas('tulow', 108, 150),
  'brzuch-g': pas('tulow', 150, 205),
  'brzuch-d': pas('tulow', 205, 252),
  ...para('bikini', z => pas('tulow', 252, 299, z)),
  intymne: { typ: 'path', czesc: 'tulow', d: `M${P(SRODEK - 17, 254)} L${P(SRODEK + 17, 254)} L${P(SRODEK + 13, 280)} L${P(SRODEK, 299)} L${P(SRODEK - 13, 280)} Z`, srodekX: SRODEK },
  // pachy — na styku ręki i tułowia
  ...para('pacha', z => ({ typ: 'ellipse', czesc: 'pacha', cx: X(z, 46), cy: 127, rx: 8, ry: 15, srodekX: X(z, 46) })),
  szyja: { typ: 'path', czesc: 'szyja', d: SZYJA, srodekX: SRODEK },
}

// Klipy: pacha przycina się do sumy tułowia i obu rąk, szyja do własnego kształtu.
export const KLIPY = {
  tulow: ['tulow'],
  'reka-p': ['reka-p'], 'reka-l': ['reka-l'],
  'noga-p': ['noga-p'], 'noga-l': ['noga-l'],
  'pacha-p': ['tulow', 'reka-p'], 'pacha-l': ['tulow', 'reka-l'],
  szyja: ['szyja'],
}
export const klipDlaStrefy = (id, k) => k.czesc === 'pacha' ? `pacha-${id.endsWith('-p') ? 'p' : 'l'}` : k.czesc

// ── Twarz — osobny rysunek ──
export const TWARZ_WIDOK = { w: 120, h: 140 }
export const TWARZ = { cx: 60 }
export const OBRYS_TWARZY =
  'M60 6 C86 6 103 26 103 56 C103 90 85 128 60 135 C35 128 17 90 17 56 C17 26 34 6 60 6 Z'

export const TWARZ_KSZTALTY = {
  'policzek-p': { typ: 'ellipse', cx: 33, cy: 94, rx: 17, ry: 27, srodekX: 33 },
  'policzek-l': { typ: 'ellipse', cx: 87, cy: 94, rx: 17, ry: 27, srodekX: 87 },
  wasik: { typ: 'ellipse', cx: 60, cy: 98, rx: 17, ry: 6, srodekX: 60 },
  broda: { typ: 'ellipse', cx: 60, cy: 126, rx: 21, ry: 11, srodekX: 60 },
}
export const TWARZ_DEKORACJE = {
  oczy: [[45, 50], [75, 50]],
  brwi: ['M37 41 Q45 37 53 40', 'M67 40 Q75 37 83 41'],
  nos: 'M60 56 L56 83 Q60 87 64 83',
  usta: 'M49 110 Q60 115 71 110',
}
