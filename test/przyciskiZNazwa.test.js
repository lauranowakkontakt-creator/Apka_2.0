import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// Przycisk, w którym jest sama ikona (ołówek, kosz, krzyżyk, strzałka), nie ma
// żadnego tekstu — czytnik ekranu mówi wtedy tylko „przycisk”. Przegląd
// dostępności znalazł takich 118. Ten test pilnuje, żeby nie wróciły: każdy
// <button>, którego jedyną treścią jest ikona albo pojedynczy znak, musi mieć
// aria-label albo title.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

function jsxFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...jsxFiles(full))
    else if (name.endsWith('.jsx')) out.push(full)
  }
  return out
}

// Koniec znacznika otwierającego: pierwszy `>` poza klamrami i cudzysłowami.
function koniecZnacznika(src, od) {
  let klamry = 0, cudz = null
  for (let i = od; i < src.length; i++) {
    const c = src[i]
    if (cudz) { if (c === cudz && src[i - 1] !== '\\') cudz = null; continue }
    if (c === '"' || c === "'" || c === '`') cudz = c
    else if (c === '{') klamry++
    else if (c === '}') klamry--
    else if (c === '>' && klamry === 0 && src[i - 1] !== '=') return i
  }
  return -1
}

const SAMA_IKONA = /^(\s*<(Icon|Ic)[A-Z]\w*\b[^<>]*\/>\s*)+$/
const SAM_ZNAK = /^\s*[‹›×✕+−<>✓⋮-]\s*$/

test('przycisk z samą ikoną ma nazwę dla czytnika ekranu', () => {
  const braki = []
  for (const plik of jsxFiles(SRC)) {
    const src = readFileSync(plik, 'utf8')
    for (const m of src.matchAll(/<button\b/g)) {
      const koniec = koniecZnacznika(src, m.index)
      if (koniec < 0 || src[koniec - 1] === '/') continue
      const atrybuty = src.slice(m.index, koniec)
      if (/aria-label|aria-labelledby|title=|\{\.\.\./.test(atrybuty)) continue
      const zamkniecie = src.indexOf('</button>', koniec)
      const tresc = src.slice(koniec + 1, zamkniecie)
      if (SAMA_IKONA.test(tresc) || SAM_ZNAK.test(tresc)) {
        const linia = src.slice(0, m.index).split('\n').length
        braki.push(`${relative(ROOT, plik)}:${linia}`)
      }
    }
  }
  assert.deepEqual(braki, [], `Przyciski bez nazwy (dodaj aria-label):\n  ${braki.join('\n  ')}`)
})
