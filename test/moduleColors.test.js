import { test } from 'node:test'
import assert from 'node:assert/strict'

const { MODULE_ACCENTS } = await import('../src/utils/moduleColors.js')

// Barwa koloru (0–360°) w przestrzeni OKLCH — tak, jak widzi ją oko.
function barwa(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  return (Math.atan2(B, A) * 180 / Math.PI + 360) % 360
}
const odstep = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d) }

test('każdy moduł ma własny kolor — żadne dwa nie są do siebie podobne', () => {
  const lista = Object.entries(MODULE_ACCENTS)
  for (const [id, hex] of lista) assert.match(hex, /^#[0-9A-F]{6}$/i, `kolor modułu ${id} ma być w zapisie #RRGGBB`)
  const zaBlisko = []
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
    const d = odstep(barwa(lista[i][1]), barwa(lista[j][1]))
    // 20° to granica, od której dwa kolory czyta się jako różne, a nie jako odcienie jednego
    if (d < 20) zaBlisko.push(`${lista[i][0]} i ${lista[j][0]} (różnica barwy ${d.toFixed(0)}°)`)
  }
  assert.deepEqual(zaBlisko, [], `Zbyt podobne kolory modułów:\n  ${zaBlisko.join('\n  ')}`)
})

test('barwa: znane kolory wypadają tam, gdzie powinny', () => {
  assert.ok(odstep(barwa('#FF0000'), 29) < 3, 'czerwień')
  assert.ok(odstep(barwa('#00FF00'), 142) < 3, 'zieleń')
  assert.ok(odstep(barwa('#0000FF'), 264) < 3, 'niebieski')
})
