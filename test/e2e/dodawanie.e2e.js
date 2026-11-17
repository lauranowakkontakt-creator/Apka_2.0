// To, co dodasz, ma być widać OD RAZU — bez wychodzenia z ekranu i wracania.
// Każdy test odpowiada konkretnemu zgłoszeniu: transakcja w koncie pojawiała
// się dopiero po ponownym wejściu, dług nie dawał się przypiąć do osoby,
// prośba „na kiedyś” świeciła na czerwono jako zaległa.
// Uruchomienie: npm run e2e

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { format, addDays } from 'date-fns'
import { uruchom, otworzModul, KOMPUTER } from './pomocnicze.js'

let ctx
before(async () => { ctx = await uruchom() })
after(async () => { await ctx?.zamknij() })

const za = (n) => format(addDays(new Date(), n), 'yyyy-MM-dd')
const modal = (strona) => strona.locator('.modal-overlay').last()
const zakladka = (strona, nazwa) => strona.locator('.content .seg > button:visible, .content .seg-btn:visible', { hasText: nazwa }).first().click()

test('Finanse: transakcja dodana w koncie pojawia się w nim od razu', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'budget', KOMPUTER)
  await strona.getByText('Konta', { exact: true }).first().click()
  await strona.waitForTimeout(500)
  await strona.locator('[class*=account]').filter({ hasText: 'zł' }).first().click()
  await strona.waitForTimeout(500)
  await strona.getByText('+ Dodaj transakcję').click()
  const m = modal(strona)
  await m.locator('input[type=number]').first().fill('12.34')
  await m.locator('input[type=text]').last().fill('Transakcja-od-razu')
  await m.getByText('Rozrywka', { exact: true }).click()
  await m.locator('.btn-save').last().click()
  await strona.waitForTimeout(600)
  assert.equal(await strona.getByText('Transakcja-od-razu').count(), 1, 'transakcji nie widać bez ponownego wejścia')
  assert.equal(await strona.locator('.pasek-polaczenia').count(), 0, 'baner „nie udało się pobrać”')
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('Dłużnicy: dług przypięty do osoby z bazy pokazuje jej imię', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'budget', KOMPUTER)
  await strona.locator('.budget-menu-btn:visible').click()
  await strona.locator('.budget-menu-item:visible', { hasText: 'Dłużnicy' }).click()
  await strona.locator('.btn-add-account', { hasText: 'Dodaj wpis' }).click()
  const m = modal(strona)
  await m.locator('input[type=text]').first().fill('mam')
  await m.locator('.pray-person-chip', { hasText: 'Mama' }).click()
  await m.getByRole('button', { name: 'Jestem winna' }).click()
  await m.locator('input[type=number]').fill('77')
  await m.locator('button[type=submit]').click()
  await strona.waitForTimeout(500)
  const lista = await strona.locator('.modal').first().innerText()
  assert.match(lista, /Mama[\s\S]*77,00/, 'długu przy Mamie nie widać na liście')
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('Modlitwa: prośba „na kiedyś” jest w Zaplanowanych, nie w Dziś i nie jako zaległa', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'prayer', KOMPUTER)
  await strona.locator('.hdr-btn[title="Nowa prośba"]:visible').click()
  const m = modal(strona)
  await m.locator('input[type=text]').first().fill('Prośba-na-później')
  await m.locator('.pray-person-chip', { hasText: 'Mama' }).click()
  await m.locator('input[type=date]').nth(0).fill(za(10))
  await m.locator('input[type=date]').nth(1).fill(za(12))
  await m.locator('.btn-save').click()
  await strona.waitForTimeout(500)

  await zakladka(strona, 'Dziś'); await strona.waitForTimeout(300)
  assert.equal(await strona.getByText('Prośba-na-później').count(), 0, 'przyszła prośba wisi w „Dziś”')
  await zakladka(strona, 'Zaplanowane'); await strona.waitForTimeout(300)
  const karta = strona.locator('div', { hasText: 'Prośba-na-później' }).filter({ has: strona.locator('.pray-planned-badge') }).last()
  assert.equal(await karta.count(), 1, 'brak w Zaplanowanych')
  assert.ok(!/nigdy/.test(await karta.innerText()), 'zaplanowana prośba oznaczona jako „nigdy”')
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('Modlitwa → Wspomnik: wysłuchana prośba od razu trafia do Wspomnika', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'prayer', KOMPUTER)
  await strona.locator('.hdr-btn[title="Nowa prośba"]:visible').click()
  await modal(strona).locator('input[type=text]').first().fill('Prośba-wysłuchana')
  await modal(strona).locator('.btn-save').click()
  await strona.waitForTimeout(400)
  await zakladka(strona, 'Dziś'); await strona.waitForTimeout(300)
  const karta = strona.locator('div', { hasText: 'Prośba-wysłuchana' }).filter({ has: strona.locator('button', { hasText: 'Zakończ' }) }).last()
  await karta.locator('button', { hasText: 'Zakończ' }).click()
  await strona.locator('.pray-answered-btn').click()
  await strona.waitForTimeout(400)
  await modal(strona).locator('button[type=submit]').click()
  await strona.waitForTimeout(400)

  await strona.evaluate(() => localStorage.setItem('mw_activeModule', 'wspomnik'))
  await strona.reload({ waitUntil: 'networkidle' }); await strona.waitForTimeout(800)
  assert.equal(await strona.locator('.wsp-card', { hasText: 'Prośba-wysłuchana' }).count(), 1, 'brak wpisu we Wspomniku')
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('Wspomnik: nowe wspomnienie widać na liście od razu', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'wspomnik', KOMPUTER)
  await strona.locator('.wsp-add').click()
  await modal(strona).locator('input[type=text]').first().fill('Wspomnienie-od-razu')
  await modal(strona).locator('button[type=submit]').click()
  await strona.waitForTimeout(400)
  assert.equal(await strona.locator('.wsp-card', { hasText: 'Wspomnienie-od-razu' }).count(), 1)
  assert.deepEqual(bledy, [])
  await strona.close()
})
