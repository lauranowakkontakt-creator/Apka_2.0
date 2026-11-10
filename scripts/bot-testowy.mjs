// BOT TESTUJĄCY — chodzi po aplikacji w trybie demo (losowe dane, bez Firebase)
// i szuka błędów: wyjątków w konsoli, ekranu awarii (ErrorBoundary), poziomego
// przewijania strony, zapętlonych spinnerów oraz kilku znanych scenariuszy
// (np. pisanie po wstawieniu #symbolu w opisie snu).
//
//   npm run bot                       # demo uruchamia się samo
//   npm run bot -- --kroki 150        # więcej losowych kliknięć na moduł
//   npm run bot -- --ziarno 7         # powtórzenie tego samego przebiegu
//   npm run bot -- --url http://localhost:5173/   # własny adres
//
// Wymaga pakietu `playwright` (npm i -D playwright && npx playwright install chromium).
// Wynik: raport w konsoli + bot-raport.md; kod wyjścia 1, gdy znaleziono błędy.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'

const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) } catch {
  console.error('Brak pakietu playwright. Zainstaluj: npm i -D playwright && npx playwright install chromium')
  process.exit(2)
}

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d }
const KROKI = Number(arg('kroki', 60))
let seed = Number(arg('ziarno', Date.now() % 100000))
const startSeed = seed
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const pick = (a) => a[Math.floor(rnd() * a.length)]

const MODULY = ['Pulpit', 'Finanse', 'Nawyki', 'To-do', 'Kalendarz', 'Modlitwa', 'Biblia', 'Osoby', 'Sen', 'Wdzięcznik', 'Nastrój']
const WIDOKI = [{ nazwa: 'komputer', width: 1400, height: 900 }, { nazwa: 'telefon', width: 390, height: 844 }]
const OMIJAJ = /wyloguj|usuń|usun|wyczyść|wyczysc|skasuj|losuj|nowe dane|reset|zresetuj|eksport|import|pobierz/i
const TEKSTY = ['test', 'Ąćęłńóśźż', '#drzewo i potem', '@Kasia', '...', '0', '-5', '99999999', 'x'.repeat(120), '<b>x</b>', '', ' ']

const problemy = []
let aktywnaStrona = null
const widziane = new Set()
function zglos(widok, modul, rodzaj, opis) {
  const klucz = `${rodzaj}|${modul}|${opis}`.slice(0, 300)
  if (widziane.has(klucz)) return
  widziane.add(klucz)
  problemy.push({ widok, modul, rodzaj, opis })
  if (aktywnaStrona) {
    mkdirSync('bot-zrzuty', { recursive: true })
    aktywnaStrona.screenshot({ path: `bot-zrzuty/${problemy.length}-${widok}-${modul}-${rodzaj}.png`.replace(/\s/g, '_') }).catch(() => {})
  }
  console.log(`  ✗ [${widok}/${modul}] ${rodzaj}: ${opis.slice(0, 160)}`)
}

async function uruchomDemo() {
  const port = 5200 + Math.floor(rnd() * 500)
  const proc = spawn('npx', ['vite', '--mode', 'demo', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
  const url = `http://localhost:${port}/`
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) return { url, proc } } catch { /* jeszcze nie wstał */ }
    await new Promise(r => setTimeout(r, 500))
  }
  proc.kill(); throw new Error('Demo nie wystartowało')
}

async function klikalne(page) {
  return page.evaluate((omijaj) => {
    const re = new RegExp(omijaj, 'i')
    const out = []
    document.querySelectorAll('button, [role=tab], [role=button], a[href], summary, input[type=checkbox], select').forEach((el, i) => {
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || el.disabled) return
      const txt = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.title || ''}`
      if (re.test(txt)) return
      if (el.closest('.sidebar, .bottom-nav, .more-sheet')) return // nawigację robi pętla modułów
      el.setAttribute('data-bot', String(i)); out.push(String(i))
    })
    return out
  }, OMIJAJ.source)
}

async function krok(page) {
  const r = rnd()
  if (r < 0.15) { // wpisz coś w losowe pole
    const pola = await page.$$('input[type=text], input:not([type]), textarea, input[type=number], input[type=search]')
    const widoczne = []
    for (const p of pola) if (await p.isVisible().catch(() => false)) widoczne.push(p)
    if (widoczne.length) { await pick(widoczne).fill(pick(TEKSTY), { timeout: 800 }).catch(() => {}); return }
  }
  if (r < 0.2) { await page.keyboard.press(pick(['Escape', 'Enter', 'Tab'])).catch(() => {}); return }
  const ids = await klikalne(page)
  if (!ids.length) { await page.keyboard.press('Escape').catch(() => {}); return }
  await page.locator(`[data-bot="${pick(ids)}"]`).first().click({ timeout: 800, force: true }).catch(() => {})
}

async function sprawdzStan(page, widok, modul) {
  const stan = await page.evaluate(() => ({
    awaria: /coś poszło nie tak|wystąpił błąd|something went wrong/i.test(document.body.innerText),
    przewija: document.documentElement.scrollWidth > innerWidth + 2,
    pusta: document.body.innerText.trim().length < 20,
  })).catch(() => null)
  if (!stan) return
  if (stan.pusta) { // przejście między ekranami bywa chwilowo puste — sprawdź jeszcze raz
    await page.waitForTimeout(600)
    stan.pusta = await page.evaluate(() => document.body.innerText.trim().length < 20).catch(() => false)
  }
  if (stan.awaria) zglos(widok, modul, 'AWARIA', 'pokazał się ekran błędu (ErrorBoundary)')
  if (stan.przewija) zglos(widok, modul, 'UKŁAD', 'strona przewija się poziomo (element wystaje poza ekran)')
  if (stan.pusta) zglos(widok, modul, 'PUSTO', 'pusty ekran')
}

// Znany scenariusz: po wstawieniu #symbolu dalsze pisanie ma być zwykłym tekstem.
async function scenariuszSymbol(page, widok) {
  const dodaj = page.locator('button[title="Zapisz sen"]:visible').first()
  if (!(await dodaj.isVisible().catch(() => false))) { zglos(widok, 'Sen', 'BOT', 'nie znalazłem przycisku nowego snu — scenariusz # pominięty'); return }
  await dodaj.click().catch(() => {})
  const pole = page.locator('textarea').first()
  if (!(await pole.isVisible().catch(() => false))) { zglos(widok, 'Sen', 'BOT', 'formularz snu się nie otworzył'); return }
  await pole.click()
  await pole.pressSequentially('Widziałam #drzewo', { delay: 15 })
  const sugestia = page.locator('button:has-text("#drzewo"), button:has-text("Utwórz symbol")').first()
  if (await sugestia.isVisible().catch(() => false)) await sugestia.click()
  await pole.pressSequentially('i szłam dalej do domu', { delay: 15 })
  const wisi = await page.locator('button:has-text("Utwórz symbol")').isVisible().catch(() => false)
  if (wisi) zglos(widok, 'Sen', 'BŁĄD', 'po wstawieniu #symbolu dalsze słowa nadal są traktowane jak tag (Utwórz symbol)')
  const tekst = await pole.inputValue()
  if (!tekst.includes('szłam dalej do domu')) zglos(widok, 'Sen', 'BŁĄD', 'tekst po #symbolu zaginął: ' + tekst)
  await page.keyboard.press('Escape').catch(() => {})
}

async function main() {
  let demo = null, url = arg('url', null)
  if (!url) { demo = await uruchomDemo(); url = demo.url }
  console.log(`Bot: ${url}, kroków na moduł: ${KROKI}, ziarno: ${startSeed}`)
  const browser = await chromium.launch()
  try {
    for (const w of WIDOKI) {
      console.log(`\n== ${w.nazwa} (${w.width}×${w.height}) ==`)
      const ctx = await browser.newContext({ viewport: { width: w.width, height: w.height } })
      const page = await ctx.newPage()
      let modul = 'start'
      aktywnaStrona = page
      page.on('pageerror', e => zglos(w.nazwa, modul, 'WYJĄTEK', e.message))
      page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) zglos(w.nazwa, modul, 'KONSOLA', m.text()) })
      page.on('dialog', d => d.dismiss().catch(() => {}))
      await page.goto(url); await page.waitForTimeout(2000)
      await sprawdzStan(page, w.nazwa, 'start')

      const wejdz = async (m) => {
        const nav = page.locator(w.width > 700 ? '.sidebar-nav-item' : '.bottom-nav-item', { hasText: m }).first()
        if (!(await nav.isVisible().catch(() => false)) && w.width <= 700) {
          await page.locator('.bottom-nav-item', { hasText: 'Więcej' }).click().catch(() => {})
          await page.waitForTimeout(250)
          const wDrawerze = page.locator('.more-item', { hasText: m }).first()
          return wDrawerze.click({ timeout: 1500 }).then(() => true).catch(() => false)
        }
        return nav.click({ timeout: 4000 }).then(() => true).catch(() => false)
      }

      for (const m of MODULY) {
        modul = m
        process.stdout.write(`· ${m} `)
        await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() }).catch(() => {}) // bot potrafi ukryć moduły w układzie
        await page.goto(url); await page.waitForTimeout(1200) // czysty start: bez zostawionych okien
        if (!(await wejdz(m))) { zglos(w.nazwa, m, 'NAWIGACJA', 'nie da się wejść do modułu'); console.log('(pominięty)'); continue }
        await page.waitForTimeout(500)
        if (/ładowanie/i.test(await page.evaluate(() => document.body.innerText))) {
          await page.waitForTimeout(3000)
          if (/ładowanie\.\.\./i.test(await page.evaluate(() => document.body.innerText))) zglos(w.nazwa, m, 'SPINNER', 'moduł wisi na „Ładowanie…"')
        }
        await sprawdzStan(page, w.nazwa, m)
        for (let i = 0; i < KROKI; i++) {
          await krok(page)
          await page.waitForTimeout(60)
          await sprawdzStan(page, w.nazwa, m)
          if (!page.url().startsWith(url)) { await page.goto(url); await page.waitForTimeout(800); break }
        }
        console.log('ok')
      }
      modul = 'Sen'
      await page.goto(url); await page.waitForTimeout(1500)
      if (await wejdz('Sen')) { await page.waitForTimeout(500); await scenariuszSymbol(page, w.nazwa) }
      await ctx.close()
    }
  } finally {
    await browser.close(); demo?.proc.kill()
  }

  const md = ['# Raport bota testowego', '', `Ziarno: ${startSeed}, kroków na moduł: ${KROKI}`, '',
    problemy.length ? `Znaleziono **${problemy.length}** problemów:` : 'Nic nie znaleziono.', '',
    ...problemy.map(p => `- **${p.rodzaj}** · ${p.widok} · ${p.modul} — ${p.opis.replace(/\n/g, ' ').slice(0, 300)}`)].join('\n')
  writeFileSync('bot-raport.md', md + '\n')
  console.log(`\n${problemy.length ? `Znaleziono problemów: ${problemy.length}` : 'Bez błędów'} — raport: bot-raport.md`)
  process.exit(problemy.length ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(2) })
