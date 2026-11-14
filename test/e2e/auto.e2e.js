// Test przeglądarkowy modułu Auto: tankowania, spalanie, naprawy, terminy.
// Uruchomienie: npm run e2e

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { uruchom, otworzModul, nakladanie, wystajeWBok, coWystaje, MALY_TELEFON, KOMPUTER } from './pomocnicze.js'

let ctx
before(async () => { ctx = await uruchom() })
after(async () => { await ctx?.zamknij() })

// Pusta baza: wynik spalania zależy wtedy tylko od tego, co wpisze test
async function pusteAuto(rozmiar) {
  const o = await otworzModul(ctx, 'auto', rozmiar)
  await o.strona.evaluate(() => { for (const k of Object.keys(localStorage)) if (k !== 'mw_activeModule') localStorage.removeItem(k) })
  await o.strona.evaluate(async () => { const m = await import('/src/demo/firestore.js'); m.__resetDemo({ empty: true }) })
  await o.strona.reload({ waitUntil: 'networkidle' })
  await o.strona.waitForTimeout(800)
  return o
}
async function tankuj(strona, { paliwo, litry, kwota, licznik, pelny = true }) {
  await strona.locator('.hdr-btn.accent:visible').first().click()
  if (paliwo) await strona.locator('.modal [role=tab]', { hasText: paliwo }).click()
  await strona.locator('#auto-litry').fill(litry)
  await strona.locator('#auto-kwota').fill(kwota)
  if (licznik) await strona.locator('#auto-licznik').fill(licznik)
  if (!pelny) await strona.locator('.modal .mood-switch').click()
  await strona.locator('.modal .btn-save').click()
  await strona.waitForTimeout(400)
  assert.equal(await strona.locator('.modal-overlay').count(), 0, 'okno tankowania nie zamknęło się po zapisie')
}
const kafelek = (strona, etykieta) => strona.locator('.stat-tile', { hasText: etykieta }).locator('.stat-tile-value').innerText()

test('spalanie gazu i benzyny liczy się od pełna do pełna, osobno dla każdego paliwa', async () => {
  const { strona, bledy } = await pusteAuto(MALY_TELEFON)
  assert.equal(await kafelek(strona, 'Gaz'), '–', 'bez tankowań nie powinno być wyniku')
  await tankuj(strona, { paliwo: 'Gaz', litry: '40', kwota: '120', licznik: '100000' })
  await tankuj(strona, { paliwo: 'Benzyna', litry: '30', kwota: '195', licznik: '100000' })
  assert.equal(await kafelek(strona, 'Gaz'), '–', 'jedno tankowanie to za mało na wynik')
  await tankuj(strona, { paliwo: 'Gaz', litry: '19,5', kwota: '58,50', licznik: '100200', pelny: false })
  await tankuj(strona, { paliwo: 'Gaz', litry: '20,5', kwota: '61,50', licznik: '100400' })
  await tankuj(strona, { paliwo: 'Benzyna', litry: '4', kwota: '26', licznik: '100400' })

  assert.equal(await kafelek(strona, 'Gaz'), '10,0', '(19,5 + 20,5) l na 400 km')
  assert.equal(await kafelek(strona, 'Benzyna'), '1,0', '4 l na 400 km')
  assert.equal(await kafelek(strona, 'Koszt'), '36,5 zł', '(58,50 + 61,50 + 26) zł na 400 km')
  // wynik stoi przy tankowaniu, które zamknęło odcinek
  assert.match(await strona.locator('.auto-row', { hasText: '20,5 l' }).innerText(), /10,0\s*l\/100 km/)
  assert.deepEqual(await nakladanie(strona), [], 'lista tankowań: elementy nachodzą na siebie')
  assert.equal(await wystajeWBok(strona), false, `coś wystaje w bok: ${await coWystaje(strona)}`)

  // po odświeżeniu wszystko zostaje
  await strona.reload({ waitUntil: 'networkidle' }); await strona.waitForTimeout(700)
  assert.equal(await kafelek(strona, 'Gaz'), '10,0')
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('tankowanie: edycja zmienia wynik, usunięcie go zabiera', async () => {
  const { strona, bledy } = await pusteAuto(MALY_TELEFON)
  await tankuj(strona, { paliwo: 'Gaz', litry: '40', kwota: '120', licznik: '50000' })
  await tankuj(strona, { paliwo: 'Gaz', litry: '45', kwota: '135', licznik: '50500' })
  assert.equal(await kafelek(strona, 'Gaz'), '9,0')
  await strona.locator('.auto-row', { hasText: '45,0 l' }).locator('button[aria-label="Edytuj tankowanie"]').click()
  await strona.locator('#auto-litry').fill('50')
  await strona.locator('.modal .btn-save').click(); await strona.waitForTimeout(400)
  assert.equal(await kafelek(strona, 'Gaz'), '10,0')
  await strona.locator('.auto-row', { hasText: '50,0 l' }).locator('button[aria-label="Usuń tankowanie"]').click()
  await strona.locator('.modal-overlay[data-own-esc] button', { hasText: 'Usuń' }).click(); await strona.waitForTimeout(400)
  assert.equal(await kafelek(strona, 'Gaz'), '–')
  assert.equal(await strona.locator('.auto-row').count(), 1)
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('naprawa: dodanie widać na liście i w sumie', async () => {
  const { strona, bledy } = await pusteAuto(MALY_TELEFON)
  await strona.locator('[role=tab]', { hasText: 'Naprawy' }).click()
  await strona.locator('.btn-add-account').click()
  await strona.locator('#auto-n-tytul').fill('Wymiana oleju')
  await strona.locator('#auto-n-koszt').fill('350,50')
  await strona.locator('#auto-n-licznik').fill('120000')
  assert.deepEqual(await nakladanie(strona, '.modal'), [])
  await strona.locator('.modal .btn-save').click(); await strona.waitForTimeout(400)
  const wiersz = await strona.locator('.auto-row').first().innerText()
  assert.match(wiersz, /Wymiana oleju/)
  assert.match(wiersz, /350,50 zł/)
  assert.match(wiersz, /120\s000 km/)
  assert.match(await strona.locator('.auto-podsumowanie').innerText(), /Razem\s+350,50 zł/)
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('dane auta: zbliżający się termin OC ostrzega w module i na Pulpicie', async () => {
  const { strona, bledy } = await pusteAuto(MALY_TELEFON)
  const zaTydzien = new Date(Date.now() + 7 * 86400000).toLocaleDateString('sv-SE')
  await strona.locator('[role=tab]', { hasText: 'Auto' }).last().click()
  await strona.locator('#auto-nazwa').fill('Testowa Astra')
  await strona.locator('#auto-oc').fill(zaTydzien)
  await strona.locator('.auto-dane .btn-save').click(); await strona.waitForTimeout(500)
  assert.match(await strona.locator('.auto-alert').first().innerText(), /OC[\s\S]*za 7 dni/)
  assert.match(await strona.locator('.auto-karta-glowa').innerText(), /Testowa Astra/)
  // Tylko karta auta — przez chwilę po zapisie nad formularzem wisi komunikat „zapisano”
  assert.deepEqual(await nakladanie(strona, '.auto-karta'), [])

  await strona.evaluate(() => localStorage.setItem('mw_activeModule', 'home'))
  await strona.reload({ waitUntil: 'networkidle' }); await strona.waitForTimeout(800)
  assert.match(await strona.locator('.pulpit-card', { hasText: 'Auto' }).innerText(), /OC za 7 dni/)
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('wygląd na komputerze: nic nie nachodzi i nie wystaje (dane demo)', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'auto', KOMPUTER)
  for (const zakladka of ['Paliwo', 'Naprawy', 'Auto']) {
    await strona.locator('.content-inner [role=tab]', { hasText: zakladka }).last().click()
    await strona.waitForTimeout(250)
    assert.deepEqual(await nakladanie(strona), [], `${zakladka}: elementy nachodzą na siebie`)
    assert.equal(await wystajeWBok(strona), false, `${zakladka}: coś wystaje w bok`)
  }
  assert.deepEqual(bledy, [])
  await strona.close()
})
