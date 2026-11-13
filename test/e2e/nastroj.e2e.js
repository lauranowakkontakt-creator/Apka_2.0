// Test przeglądarkowy modułu Nastrój: prawdziwe kliknięcia w wersji demo.
// Uruchomienie: npm run e2e
//
// Każdy test sprawdza jedną rzecz, którą da się zepsuć niezauważenie:
// scenariusz, który użytkowniczka faktycznie robi, albo wygląd na telefonie.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { format, subDays } from 'date-fns'
import { uruchom, otworzModul, nakladanie, wystajeWBok, coWystaje, przewin, TELEFON, MALY_TELEFON, KOMPUTER } from './pomocnicze.js'

let ctx
before(async () => { ctx = await uruchom() })
after(async () => { await ctx?.zamknij() })

// Dni sprzed ponad roku — dane demo sięgają ~2 miesięcy wstecz, więc te są puste.
const dzien = (n) => format(subDays(new Date(), n), 'yyyy-MM-dd')

// Otwiera formularz przez „+” i przełącza datę na dzień bez wpisu (wpis wstecz)
async function nowyDzien(strona, data) {
  await strona.locator('.hdr-btn.accent:visible').first().click()
  await strona.locator('.mood-date input').first().fill(data)
  await strona.waitForTimeout(150)
  // Dzień bez wpisu otwiera się od razu na nowej chwili
  assert.equal(await strona.locator('.mood-time input').count(), 1, 'nowy dzień powinien otworzyć formularz chwili')
}
const zapisz = (strona) => strona.locator('.mood-form-foot .mood-save').click()
const MIESIACE = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień']
// Przewija kalendarz nastroju (w przód albo w tył) do miesiąca daty i klika dzień
async function dzienWKalendarzu(strona, data) {
  const cel = new Date(data + 'T12:00:00')
  const celIdx = cel.getFullYear() * 12 + cel.getMonth()
  for (let i = 0; i < 40; i++) {
    const [mies, rok] = (await strona.locator('.mood-cal-title strong').innerText()).toLowerCase().split(/\s+/)
    const teraz = Number(rok) * 12 + MIESIACE.indexOf(mies)
    if (teraz === celIdx) break
    await strona.locator('.mood-cal-nav').nth(teraz > celIdx ? 0 : 1).click()
  }
  await strona.locator('.mood-cal-day', { hasText: new RegExp(`^${cel.getDate()}$`) }).first().click()
}

test('wpis wstecz trafia na wybrany dzień, a dzisiejszy wpis zostaje na miejscu', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'mood')
  // Najpierw dzisiejszy wpis (dane demo są losowe — dziś może go nie być)
  await strona.locator('.mood-quick button').nth(2).click()
  await zapisz(strona)
  const data = dzien(400)
  await nowyDzien(strona, data)
  await strona.locator('.mood-time input').fill('09:30')
  await strona.locator('.mood-face-btn').nth(4).click()
  await zapisz(strona)
  await dzienWKalendarzu(strona, data)
  const karta = strona.locator('.mood-day .mood-log')
  assert.equal(await karta.count(), 1, 'na wybranym dniu nie ma wpisu')
  assert.match(await karta.innerText(), /09:30/)
  // „+” otwierał dzisiejszy wpis — zmiana daty nie może go przenieść
  await dzienWKalendarzu(strona, format(new Date(), 'yyyy-MM-dd'))
  assert.equal(await strona.locator('.mood-day .mood-log').count(), 1, 'dzisiejszy wpis zniknął')
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('dwie chwile jednego dnia: praca → złość rano, spotkanie → radość wieczorem', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'mood')
  const data = dzien(430)
  await nowyDzien(strona, data)
  // Rano
  await strona.locator('.mood-time input').fill('08:00')
  await strona.locator('.mood-face-btn').nth(1).click()
  await strona.locator('.emo-wheel g[role=button][aria-label^="Gniew"]').click()
  await strona.locator('.emo-level').nth(1).click()
  await strona.locator('.mood-part-head', { hasText: 'Co się działo' }).click()
  await strona.locator('.mood-chip', { hasText: /^praca$/ }).click()
  await strona.locator('.mood-foot-row .mood-btn-ghost').click()          // „Cały dzień”
  // Wieczór
  await strona.locator('.mood-chwila-add').click()
  await strona.locator('.mood-time input').fill('19:00')
  await strona.locator('.mood-face-btn').nth(4).click()
  await strona.locator('.emo-wheel g[role=button][aria-label^="Radość"]').click()
  await strona.locator('.emo-level').nth(1).click()
  await strona.locator('.mood-part-head', { hasText: 'Co się działo' }).click()
  await strona.locator('.mood-chip', { hasText: /^spotkanie$/ }).click()
  await zapisz(strona)

  await dzienWKalendarzu(strona, data)
  const chwile = strona.locator('.mood-day .mood-log-chwile li')
  assert.equal(await chwile.count(), 2, 'dzień powinien mieć dwie chwile w jednym wpisie')
  assert.equal(await strona.locator('.mood-day .mood-log').count(), 1, 'powstał drugi wpis zamiast chwili')
  const [rano, wieczor] = await chwile.allInnerTexts()
  assert.match(rano, /08:00[\s\S]*gniew[\s\S]*praca/)
  assert.match(wieczor, /19:00[\s\S]*radość[\s\S]*spotkanie/)
  assert.deepEqual(bledy, [])
  await strona.close()
})

test('zmiana godziny chwili przestawia kolejność', async () => {
  const { strona } = await otworzModul(ctx, 'mood')
  const data = dzien(460)
  await nowyDzien(strona, data)
  await strona.locator('.mood-time input').fill('07:00')
  await strona.locator('.mood-face-btn').nth(2).click()
  await strona.locator('.mood-foot-row .mood-btn-ghost').click()
  await strona.locator('.mood-chwila-add').click()
  await strona.locator('.mood-time input').fill('12:00')
  await strona.locator('.mood-face-btn').nth(3).click()
  await strona.locator('.mood-foot-row .mood-btn-ghost').click()
  // Poranna chwila przesunięta na 22:00 — powinna spaść na koniec listy
  await strona.locator('.mood-chwila-open', { hasText: '07:00' }).click()
  await strona.locator('.mood-time input').fill('22:00')
  await strona.locator('.mood-foot-row .mood-btn-ghost').click()
  const godziny = await strona.locator('.mood-chwila-txt strong').allInnerTexts()
  assert.deepEqual(godziny.map(t => t.slice(0, 5)), ['12:00', '22:00'])
  await zapisz(strona)
  await strona.close()
})

test('spotkanie z osobą trafia do kalendarza, a wyłączone z niego znika', async () => {
  const { strona } = await otworzModul(ctx, 'mood')
  const data = dzien(490)
  await nowyDzien(strona, data)
  await strona.locator('.mood-face-btn').nth(3).click()
  await strona.locator('.mood-part-head', { hasText: 'Co się działo' }).click()
  await strona.locator('.mood-chip', { hasText: /^spotkanie$/ }).click()
  await strona.locator('.mood-part-head', { hasText: 'Z kim' }).click()
  const osoba = (await strona.locator('.mood-person').first().innerText()).trim()
  await strona.locator('.mood-person').first().click()
  await strona.locator('.mood-foot-row .mood-btn-ghost').click()
  await strona.locator('.mood-part-head', { hasText: 'Relacje' }).click()
  assert.ok(await strona.locator('.mood-switch input').isChecked(), '„spotkanie” powinno samo włączyć kalendarz')
  await zapisz(strona)

  // Wydarzenie sprawdzamy w danych demo — musi istnieć niezależnie od widoku kalendarza.
  const ileWBazie = () => strona.evaluate(async (o) => {
    const fs = await import('/src/demo/firestore.js')
    const snap = await fs.getDocs(fs.collection({}, 'users', 'demo-user', 'calendarEvents'))
    return snap.docs.filter(d => d.data().title === `Spotkanie: ${o}`).length
  }, osoba)
  assert.equal(await ileWBazie(), 1, 'brak spotkania w kalendarzu')

  await dzienWKalendarzu(strona, data)
  await strona.locator('.mood-day-add').click()
  await strona.locator('.mood-part-head', { hasText: 'Relacje' }).click()
  await strona.locator('.mood-switch').click()
  await zapisz(strona)
  assert.equal(await ileWBazie(), 0, 'po wyłączeniu spotkanie nadal jest w kalendarzu')
  await strona.close()
})

test('kolejny wpis tego samego dnia otwiera istniejący dzień, nie tworzy drugiego', async () => {
  const { strona } = await otworzModul(ctx, 'mood')
  await strona.locator('.mood-quick button').nth(1).click()
  await zapisz(strona)
  await strona.locator('.mood-quick button').nth(3).click()
  await zapisz(strona)
  assert.equal(await strona.locator('.mood-day .mood-log').count(), 1)
  await strona.close()
})

test('analiza: to, przy czym jest dobrze, ląduje w „pomaga”, a przy czym źle — w „szkodzi”', async () => {
  const { strona, bledy } = await otworzModul(ctx, 'mood')
  // Dane demo nie mają „podróży” ani „natury” w ten sposób — dopisujemy po 4 wyraźne chwile
  const chwila = async (godz, buzka, czynnik) => {
    await strona.locator('.mood-time input').fill(godz)
    await strona.locator('.mood-face-btn').nth(buzka).click()
    await strona.locator('.mood-part-head', { hasText: 'Co się działo' }).click()
    await strona.locator('.mood-chip', { hasText: new RegExp(`^${czynnik}$`) }).click()
    await strona.locator('.mood-foot-row .mood-btn-ghost').click()
  }
  for (let d = 0; d < 4; d++) {
    await nowyDzien(strona, dzien(520 + d))
    await chwila('09:00', 4, 'podróż')
    await strona.locator('.mood-chwila-add').click()
    await chwila('15:00', 0, 'choroba')
    await zapisz(strona)
  }
  await strona.locator('.hdr-btn[aria-label="Analiza i statystyki"]:visible').first().click()
  await strona.waitForTimeout(400)
  const pomaga = await strona.locator('.wn-karta.plus').innerText()
  const szkodzi = await strona.locator('.wn-karta.minus').innerText()
  assert.match(pomaga, /podróż/, 'podróż (zawsze „świetnie”) nie trafiła do „pomaga”')
  assert.match(szkodzi, /choroba/, 'choroba (zawsze „okropny”) nie trafiła do „szkodzi”')
  assert.doesNotMatch(pomaga, /choroba/)
  assert.match(await strona.locator('.wn-head').innerText(), /Średnio|Brak wpisów/)
  assert.deepEqual(bledy, [])
  await strona.close()
})

// ── Wygląd: nic na siebie nie nachodzi i nic nie wystaje w bok ───────────────
const EKRANY = [
  ['Nastrój', async () => {}],
  ['Sen', async (s) => { await s.locator('.seg button', { hasText: 'Sen' }).click() }],
  ['Cykl', async (s) => { await s.locator('.seg button', { hasText: 'Cykl' }).click() }],
  ['Analiza', async (s) => { await s.locator('.hdr-btn[aria-label="Analiza i statystyki"]:visible').first().click() }],
  ['Formularz chwili', async (s) => {
    await s.locator('.hdr-btn.accent:visible').first().click()
    const nowa = s.locator('.mood-chwila-add')
    if (await nowa.count()) await nowa.click()
    await s.locator('.emo-wheel g[role=button]').nth(3).click()
  }],
  ['Formularz dnia', async (s) => {
    await s.locator('.hdr-btn.accent:visible').first().click()
    const wroc = s.locator('.mood-foot-row .mood-btn-ghost')
    if (await wroc.count()) { await s.locator('.mood-face-btn').nth(2).click(); await wroc.click() }
    for (const t of ['Relacje', 'Energia i ciało']) await s.locator('.mood-part-head', { hasText: t }).click()
  }],
]

for (const [rozmiar, nazwaR] of [[TELEFON, 'telefon'], [MALY_TELEFON, 'mały telefon'], [KOMPUTER, 'komputer']]) {
  for (const [ekran, wejdz] of EKRANY) {
    test(`wygląd · ${nazwaR} · ${ekran}`, async () => {
      const { strona, bledy } = await otworzModul(ctx, 'mood', rozmiar)
      await wejdz(strona)
      await strona.waitForTimeout(400)
      const zakres = (await strona.locator('.modal').count()) ? '.modal' : '.content, main, body'
      // Sprawdzamy kilka pozycji przewinięcia — nakładanie bywa dopiero niżej
      const problemy = new Set()
      for (let krok = 0; krok < 6; krok++) {
        for (const p of await nakladanie(strona, zakres)) problemy.add(p)
        const dalej = await przewin(strona)
        if (!dalej) break
        await strona.waitForTimeout(120)
      }
      assert.deepEqual([...problemy], [], 'elementy nachodzą na siebie')
      assert.equal(await wystajeWBok(strona), false, `strona wystaje w bok: ${(await coWystaje(strona)).join(', ')}`)
      assert.deepEqual(bledy, [])
      await strona.close()
    })
  }
}
