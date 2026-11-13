// Wspólne klocki testów przeglądarkowych (e2e).
//
// Testy klikają prawdziwą apkę w trybie demo (dane w pamięci, bez Firebase)
// w przeglądarce o rozmiarze telefonu. Sprawdzają to, czego testy jednostkowe
// nie widzą: czy coś na siebie nie nachodzi, czy nic nie wychodzi poza ekran
// i czy główne scenariusze naprawdę działają po kliknięciu.

import { createServer } from 'vite'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

export async function uruchom() {
  const serwer = await createServer({ root: ROOT, mode: 'demo', logLevel: 'error', server: { port: 0, strictPort: false } })
  await serwer.listen()
  const adres = serwer.resolvedUrls.local[0]
  const przegladarka = await chromium.launch()
  return { serwer, adres, przegladarka, zamknij: async () => { await przegladarka.close(); await serwer.close() } }
}

export const TELEFON = { width: 390, height: 844 }
export const MALY_TELEFON = { width: 360, height: 740 }
export const KOMPUTER = { width: 1280, height: 820 }

/** Nowa karta z apką otwartą na danym module. Zbiera błędy JS strony. */
export async function otworzModul(ctx, modul, rozmiar = TELEFON) {
  const strona = await ctx.przegladarka.newPage({ viewport: rozmiar, hasTouch: rozmiar.width < 600 })
  const bledy = []
  strona.on('pageerror', e => bledy.push(e.message))
  await strona.goto(ctx.adres, { waitUntil: 'networkidle' })
  await strona.evaluate(m => localStorage.setItem('mw_activeModule', m), modul)
  await strona.reload({ waitUntil: 'networkidle' })
  await strona.waitForTimeout(800)
  return { strona, bledy }
}

/**
 * Elementy, które na siebie nachodzą — to, co na ekranie wygląda jak
 * „grafika się nakłada”. Dwie kontrole:
 * 1. Przycisk / pole, którego środka nie da się kliknąć, bo leży na nim inny
 *    element (pomijając celowe nakładki: przyklejoną stopkę formularza,
 *    dolny pasek, belkę i plakietkę DEMO).
 * 2. Teksty zachodzące na siebie (wspólna część > 25% mniejszego z nich).
 * 3. Słowa łamane w połowie, bo nie mieszczą się w swoim polu.
 * Zwraca listę czytelnych opisów; pusta lista = w porządku.
 */
export async function nakladanie(strona, zakres = 'body') {
  return strona.evaluate((sel) => {
    const root = document.querySelector(sel) || document.body
    const widoczny = (e) => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e)
      return r.width > 3 && r.height > 3 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
        && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
    }
    const opis = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''} „${(e.innerText || e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30)}”`
    const NAKLADKI = '.mood-form-foot, .bottom-nav, .header, .mobile-header, .mod-header, .topbar, .demo-badge'
    const problemy = []

    // 1. Zasłonięte przyciski i pola
    const klikalne = [...root.querySelectorAll('button, input, textarea, select, [role="button"]')].filter(widoczny)
    for (const e of klikalne) {
      if (e.closest(NAKLADKI)) continue
      const r = e.getBoundingClientRect()
      const x = r.left + r.width / 2, y = r.top + r.height / 2
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue
      const traf = document.elementFromPoint(x, y)
      if (!traf || e.contains(traf) || traf.contains(e)) continue
      if (traf.closest(NAKLADKI)) continue
      problemy.push(`zasłonięty: ${opis(e)} — leży na nim ${opis(traf)}`)
    }

    // 2. Teksty zachodzące na siebie
    const teksty = [...root.querySelectorAll('*')].filter(e =>
      [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && widoczny(e) && !e.closest(NAKLADKI))
    const boxy = teksty.map(e => ({ e, r: e.getBoundingClientRect() }))
    for (let i = 0; i < boxy.length; i++) {
      for (let j = i + 1; j < boxy.length; j++) {
        const a = boxy[i], b = boxy[j]
        if (a.e.contains(b.e) || b.e.contains(a.e)) continue
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
        if (w <= 0 || h <= 0) continue
        const mniejszy = Math.min(a.r.width * a.r.height, b.r.width * b.r.height)
        if ((w * h) / mniejszy > 0.25) problemy.push(`teksty na sobie: ${opis(a.e)} i ${opis(b.e)}`)
      }
    }
    // 3. Słowo złamane w połowie („wdzięcznoś / ć”): najdłuższe słowo szersze
    //    niż miejsce na tekst. Mierzymy krojem pisma elementu.
    const ctx = document.createElement('canvas').getContext('2d')
    for (const { e, r } of boxy) {
      const tekst = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ')
      const s = getComputedStyle(e)
      if (s.whiteSpace.startsWith('nowrap') || s.textOverflow === 'ellipsis' || e.closest('svg')) continue
      ctx.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
      // Element w linii (np. <b> w zdaniu) może się zawinąć między słowami —
      // wtedy miejscem na słowo jest blok, w którym stoi, a nie jego kawałek.
      let blok = e
      while (blok.parentElement && getComputedStyle(blok).display.startsWith('inline') && !getComputedStyle(blok).display.includes('-')) blok = blok.parentElement
      const sb = getComputedStyle(blok), rb = blok.getBoundingClientRect()
      const szer = rb.width - parseFloat(sb.paddingLeft) - parseFloat(sb.paddingRight)
      const slowo = tekst.split(/\s+/).filter(Boolean).sort((a, b) => ctx.measureText(b).width - ctx.measureText(a).width)[0]
      if (slowo && ctx.measureText(slowo).width > szer + 1) problemy.push(`słowo łamane w połowie: „${slowo}” w ${opis(e)}`)
    }
    return problemy
  }, zakres)
}

/** Czy strona przewija się w bok (coś wystaje poza szerokość ekranu). */
export const wystajeWBok = (strona) =>
  strona.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)

/** Elementy wystające poza prawą krawędź — do czytelnego komunikatu. */
export const coWystaje = (strona) => strona.evaluate(() =>
  [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed')
    .slice(0, 5).map(e => `${e.tagName.toLowerCase()}.${String(e.className).split(' ').join('.')}`))

/**
 * Przewija o ~70% ekranu to, co faktycznie się przewija: otwarte okno
 * (.modal), a bez niego — kontener treści apki albo stronę. Zwraca false,
 * gdy dalej się nie da (koniec treści).
 */
export const przewin = (strona) => strona.evaluate(() => {
  const modal = document.querySelector('.modal')
  const kandydaci = modal ? [modal] : [...document.querySelectorAll('*')].filter(e => {
    const s = getComputedStyle(e)
    return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 10
  }).concat(document.scrollingElement)
  for (const el of kandydaci) {
    const przed = el.scrollTop
    el.scrollTop += innerHeight * 0.7
    if (el.scrollTop !== przed) return true
  }
  return false
})
