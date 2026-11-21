// Test przeglądarkowy modułu IPL: model ciała, zapis zabiegu, wybór śledzonych stref.
// Uruchomienie: npm run e2e

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { uruchom, otworzModul, nakladanie, wystajeWBok, coWystaje, MALY_TELEFON, KOMPUTER } from './pomocnicze.js'

let ctx
before(async () => { ctx = await uruchom() })
after(async () => { await ctx?.zamknij() })

async function pusteIpl(rozmiar) {
  const o = await otworzModul(ctx, 'ipl', rozmiar)
  await o.strona.evaluate(() => { for (const k of Object.keys(localStorage)) if (k !== 'mw_activeModule') localStorage.removeItem(k) })
  await o.strona.evaluate(async () => { const m = await import('/src/demo/firestore.js'); m.__resetDemo({ empty: true }) })
  await o.strona.reload({ waitUntil: 'networkidle' })
  await o.strona.waitForTimeout(800)
  return o
}
const kafelek = (strona, etykieta) => strona.locator('.stat-tile', { hasText: etykieta }).locator('.stat-tile-value').innerText()
const strefy = (strona) => strona.evaluate(() => ({
  cialo: document.querySelectorAll('.ipl-model .ipl-strefa').length,
  twarz: document.querySelectorAll('.ipl-twarz .ipl-strefa').length,
}))
// Środek prostokąta strefy bywa poza przyciętym kształtem (np. poza nogą), więc zdarzenie wysyłamy wprost.
const dotknij = (strona, nazwa) => strona.locator(`svg [aria-label="${nazwa}"]`).dispatchEvent('click')

test('pusta baza: model ma wszystkie 34 strefy i podpowiada pierwszy zabieg', async () => {
  const { strona, bledy } = await pusteIpl(MALY_TELEFON)
  assert.deepEqual(await strefy(strona), { cialo: 30, twarz: 4 })
  assert.equal(await kafelek(strona, 'Strefy zrobione'), '0/34')
  assert.match(await strona.locator('.list-empty').innerText(), /Brak zabiegów/)
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('zabieg kilku stref: zapis, kolory modelu, historia i usunięcie z „Cofnij”', async () => {
  const { strona, bledy } = await pusteIpl(MALY_TELEFON)
  await strona.locator('.hdr-btn.accent:visible').first().click()
  for (const n of ['Szyja', 'Pacha prawa', 'Pacha lewa']) await strona.locator('.modal .ipl-chip', { hasText: n }).first().click()
  await strona.locator('.modal .ipl-chip', { hasText: 'Średnie' }).click()
  await strona.locator('.modal .ipl-chip', { hasText: 'Szybko' }).click()
  assert.match(await strona.locator('.modal .btn-save').innerText(), /Zapisz zabieg \(3 strefy\)/)
  await strona.locator('.modal .btn-save').click(); await strona.waitForTimeout(500)
  assert.equal(await strona.locator('.modal-overlay').count(), 0, 'okno zabiegu nie zamknęło się po zapisie')
  assert.equal(await kafelek(strona, 'Strefy zrobione'), '3/34')
  assert.equal(await kafelek(strona, 'Ostatni zabieg'), 'dziś')

  // karta strefy pokazuje świeżo zapisany zabieg
  await dotknij(strona, 'Szyja'); await strona.waitForTimeout(300)
  assert.match(await strona.locator('.modal').innerText(), /owłosienie: średnie/)
  await strona.getByRole('button', { name: 'Zamknij' }).click()

  // historia: jeden dzień, trzy strefy; usunięcie nie pyta, jest „Cofnij”
  await strona.locator('[role=tab]', { hasText: 'Zabiegi' }).click(); await strona.waitForTimeout(250)
  assert.equal(await strona.locator('.ipl-dzien li').count(), 3)
  await strona.locator('.ipl-dzien li', { hasText: 'Szyja' }).locator('button[aria-label^="Usuń"]').click(); await strona.waitForTimeout(500)
  assert.equal(await strona.locator('.modal-overlay').count(), 0, 'usunięcie zabiegu nie powinno pytać')
  assert.equal(await strona.locator('.ipl-dzien li').count(), 2)
  await strona.getByRole('button', { name: 'Cofnij' }).click(); await strona.waitForTimeout(500)
  assert.equal(await strona.locator('.ipl-dzien li').count(), 3)
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('wybór śledzonych stref: wyłączone znikają z modelu, formularza i licznika', async () => {
  const { strona, bledy } = await pusteIpl(MALY_TELEFON)
  await strona.getByRole('button', { name: /Wybierz śledzone strefy/ }).click(); await strona.waitForTimeout(250)
  await strona.locator('.ipl-wybor-grupa', { hasText: 'Twarz' }).getByRole('button', { name: 'Wyłącz wszystko' }).click()
  for (const n of ['Dłoń prawa', 'Dłoń lewa']) await strona.locator('.modal .ipl-chip', { hasText: n }).first().click()
  assert.match(await strona.locator('.modal .btn-save').innerText(), /Zapisz \(28 stref\)/)
  await strona.locator('.modal .btn-save').click(); await strona.waitForTimeout(500)

  assert.deepEqual(await strefy(strona), { cialo: 28, twarz: 0 }, 'twarz znika razem ze wstawką')
  assert.equal(await kafelek(strona, 'Strefy zrobione'), '0/28')
  await strona.locator('.hdr-btn.accent:visible').first().click()
  const chipy = await strona.locator('.modal .ipl-chip').allInnerTexts()
  assert.ok(!chipy.includes('Wąsik') && !chipy.includes('Dłoń prawa'), 'formularz pokazuje wyłączone strefy')
  assert.ok(chipy.includes('Szyja'))
  await strona.getByRole('button', { name: 'Zamknij' }).click()

  // ustawienie zostaje po odświeżeniu; nie da się wyłączyć wszystkiego
  await strona.reload({ waitUntil: 'networkidle' }); await strona.waitForTimeout(700)
  assert.deepEqual(await strefy(strona), { cialo: 28, twarz: 0 })
  await strona.getByRole('button', { name: /Wybierz śledzone strefy/ }).click(); await strona.waitForTimeout(250)
  for (const g of ['Twarz', 'Szyja i tułów', 'Ręce', 'Bikini', 'Nogi']) {
    // przycisk grupy przełącza: gdy część stref jest wyłączona, najpierw włącza wszystkie
    const przycisk = strona.locator('.ipl-wybor-grupa', { hasText: g }).first().locator('.ipl-link')
    if ((await przycisk.innerText()) === 'Włącz wszystko') await przycisk.click()
    await przycisk.click()
  }
  assert.equal(await strona.locator('.modal .btn-save').isDisabled(), true, 'zapis bez żadnej strefy powinien być zablokowany')
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('wygląd: nic nie nachodzi i nie wystaje w bok (telefon i komputer, dane demo)', async () => {
  for (const rozmiar of [MALY_TELEFON, KOMPUTER]) {
    const { strona, bledy } = await otworzModul(ctx, 'ipl', rozmiar)
    for (const zakladka of ['Model', 'Zabiegi', 'Postępy']) {
      await strona.locator('.content-inner [role=tab]', { hasText: zakladka }).last().click()
      await strona.waitForTimeout(250)
      assert.deepEqual(await nakladanie(strona, '.ipl'), [], `${zakladka} (${rozmiar.width}px): elementy nachodzą na siebie`)
      assert.equal(await wystajeWBok(strona), false, `${zakladka} (${rozmiar.width}px): coś wystaje w bok: ${await coWystaje(strona)}`)
    }
    assert.deepEqual(bledy, [])
    await strona.close()
  }
})

test('data zabiegu wpisana ręcznie nie wraca do dzisiejszej', async () => {
  const { strona, bledy } = await pusteIpl(KOMPUTER)
  await strona.locator('.hdr-btn.accent:visible').first().click()
  const pole = strona.locator('#ipl-data')
  const dzis = await pole.inputValue()
  // Skasowanie fragmentu daty chwilowo opróżnia pole — wcześniej React od razu wstawiał dzisiejszą.
  await pole.click({ position: { x: 30, y: 10 } })
  await strona.keyboard.press('Backspace')
  assert.equal(await pole.inputValue(), '', 'pole wróciło do dzisiejszej daty po skasowaniu fragmentu')
  await pole.fill('2026-01-15')
  await strona.locator('.modal .ipl-chip', { hasText: 'Szyja' }).first().click()
  await strona.locator('.modal .btn-save').click(); await strona.waitForTimeout(500)
  await strona.locator('[role=tab]', { hasText: 'Zabiegi' }).click(); await strona.waitForTimeout(250)
  assert.match(await strona.locator('.ipl-dzien').first().innerText(), /15 Stycznia 2026/i)
  assert.notEqual(dzis, '2026-01-15')
  assert.deepEqual(bledy, [])
  await strona.close()
})
