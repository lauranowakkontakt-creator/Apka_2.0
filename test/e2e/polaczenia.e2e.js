// Test przeglądarkowy połączeń między modułami: to, co dodasz w jednym,
// ma być widać w drugim. Każdy test dodaje coś „po ludzku” (klikając)
// i sprawdza, czy pojawiło się tam, gdzie powinno.
// Uruchomienie: npm run e2e

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { format } from 'date-fns'
import { uruchom, otworzModul, TELEFON } from './pomocnicze.js'

let ctx
before(async () => { ctx = await uruchom() })
after(async () => { await ctx?.zamknij() })

const DZIS = format(new Date(), 'yyyy-MM-dd')

// Przejście do innego modułu w tej samej karcie (dane demo zostają w przeglądarce)
async function przejdz(strona, modul) {
  await strona.evaluate(m => localStorage.setItem('mw_activeModule', m), modul)
  await strona.reload({ waitUntil: 'networkidle' })
  await strona.waitForTimeout(800)
}
const plus = (strona) => strona.locator('.hdr-btn.accent:visible').first().click()
const zapisz = async (strona) => {
  await strona.locator('.modal-overlay .btn-save').last().click()
  await strona.waitForTimeout(500)
  assert.equal(await strona.locator('.modal-overlay').count(), 0, 'okno nie zamknęło się po zapisie')
}
const tekst = (strona, sel = 'body') => strona.locator(sel).first().innerText()
// „12 345,67 zł” → 12345.67
const kwota = (s) => Number(String(s).replace(/[^\d,-]/g, '').replace(',', '.'))

test('To-do → Pulpit i Kalendarz: zadanie z terminem na dziś widać w obu', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'todo')
  await plus(strona)
  await strona.locator('.modal input[placeholder="Co trzeba zrobić?"]').fill('Zadanie łączące moduły')
  await strona.locator('.modal input[type="date"]').first().fill(DZIS)
  await zapisz(strona)

  await przejdz(strona, 'home')
  assert.match(await tekst(strona, '.pulpit-today'), /Zadanie łączące moduły/, 'Pulpit nie pokazuje dzisiejszego zadania')

  await przejdz(strona, 'calendar')
  assert.match(await tekst(strona, '.content-inner'), /Zadanie łączące moduły/, 'Kalendarz nie pokazuje zadania w dzisiejszym dniu')
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('Kalendarz → Pulpit: dzisiejsze wydarzenie trafia do „Dziś”', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'calendar')
  await plus(strona)
  await strona.locator('.modal input[placeholder^="np. Lekarz"]').fill('Wydarzenie łączące moduły')
  await zapisz(strona)
  await przejdz(strona, 'home')
  assert.match(await tekst(strona, '.pulpit-today'), /Wydarzenie łączące moduły/)
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('Finanse → Pulpit: wydatek zmniejsza majątek na kafelku o tę samą kwotę', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'home')
  const kafelek = strona.locator('.pulpit-card, .pulpit-grid > *', { hasText: 'Finanse' }).first().locator('.pulpit-value')
  const przed = kwota(await kafelek.innerText())

  await przejdz(strona, 'budget')
  await plus(strona)
  await strona.locator('.modal input[inputmode="decimal"]').first().fill('250')
  await strona.locator('.modal .cat-circle').first().click()
  await zapisz(strona)

  await przejdz(strona, 'home')
  const po = kwota(await kafelek.innerText())
  assert.ok(Math.abs((przed - po) - 250) < 0.01, `majątek na Pulpicie: było ${przed}, jest ${po} — różnica powinna wynosić 250`)
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('Osoby → Modlitwa i Kalendarz: nowa osoba jest do wyboru w obu', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'people')
  await plus(strona)
  await strona.locator('.modal input[placeholder^="np. Mama, Zuzia"]').fill('Łącznik Testowy')
  await zapisz(strona)

  await przejdz(strona, 'prayer')
  assert.match(await tekst(strona, '.content-inner'), /Łącznik Testowy/, 'Modlitwa nie widzi osoby dodanej w Osobach')

  await przejdz(strona, 'calendar')
  await plus(strona)
  // Formularz wydarzenia pokazuje osoby samym imieniem
  assert.match(await tekst(strona, '.modal'), /Łącznik/, 'formularz wydarzenia nie proponuje osoby dodanej w Osobach')
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('Wdzięcznik → Pulpit: nowy wpis podnosi licznik „dziś”', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'home')
  const licznik = async () => Number((await strona.locator('.pulpit-grid > *', { hasText: 'Wdzięcznik' }).first().locator('.pulpit-value').innerText()).match(/\d+/)[0])
  const przed = await licznik()
  await przejdz(strona, 'gratitude')
  await strona.locator('.grat-add input').fill('Wdzięczność łącząca moduły')
  await strona.locator('.grat-add-btn').click()
  await strona.waitForTimeout(400)
  await przejdz(strona, 'home')
  assert.equal(await licznik(), przed + 1)
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('Nawyki → Pulpit: odhaczony nawyk podnosi „zrobione dziś”', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'home')
  const zrobione = async () => Number((await strona.locator('.pulpit-grid > *', { hasText: 'Nawyki' }).first().locator('.pulpit-value').first().innerText()).match(/[\d.,]+/)[0].replace(',', '.'))
  const przed = await zrobione()
  await przejdz(strona, 'habits')
  const pole = strona.locator('button[role="checkbox"][aria-checked="false"]:visible').first()
  assert.ok(await pole.count(), 'w danych demo nie ma nawyku do odhaczenia')
  await pole.click()
  await strona.waitForTimeout(400)
  await przejdz(strona, 'home')
  assert.ok(await zrobione() > przed, `zrobione dziś: było ${przed}, powinno wzrosnąć`)
  assert.deepEqual(bledy, [])
  await strona.close()
})

// TELEFON jest domyślnym rozmiarem otworzModul — import zostaje dla czytelności
void TELEFON
