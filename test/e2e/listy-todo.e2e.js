// To-do: zarządzanie listami (kategoriami) — kolejność, edycja, usuwanie.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { uruchom, otworzModul } from './pomocnicze.js'

let ctx
before(async () => { ctx = await uruchom() })
after(async () => { await ctx?.zamknij() })

test('To-do: okno „Zarządzaj listami” zmienia kolejność i usuwa listę, zadania zostają', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'todo')
  const nazwy = () => strona.locator('.modal [aria-label^="Edytuj listę "]').evaluateAll(b => b.map(x => x.getAttribute('aria-label').replace('Edytuj listę ', '')))

  await strona.locator('.budget-menu-wrap button[title="Więcej"]:visible').click()
  await strona.getByRole('button', { name: 'Zarządzaj listami' }).click()
  const przed = await nazwy()
  assert.ok(przed.length >= 2, 'w demo są listy')

  await strona.getByRole('button', { name: `${przed[1]}: wyżej` }).click()
  await strona.waitForTimeout(300)
  assert.deepEqual((await nazwy()).slice(0, 2), [przed[1], przed[0]])

  const zadaniaPrzed = await strona.evaluate(() => document.querySelectorAll('[data-stagger] > *').length)
  await strona.getByRole('button', { name: `Usuń listę ${przed[0]}` }).click()
  await strona.locator('[data-own-esc] .modal').getByRole('button', { name: 'Usuń', exact: true }).click()
  await strona.waitForTimeout(400)
  assert.ok(!(await nazwy()).includes(przed[0]), 'lista zniknęła')

  await strona.locator('.modal-close').first().click()
  const zadaniaPo = await strona.evaluate(() => document.querySelectorAll('[data-stagger] > *').length)
  assert.equal(zadaniaPo, zadaniaPrzed, 'zadania z usuniętej listy zostały')
  assert.deepEqual(bledy, [])
})
