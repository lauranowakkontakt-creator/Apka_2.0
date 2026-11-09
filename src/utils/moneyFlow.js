// Pieniądze w statystykach: waluty i inwestycje.
//
// 1. inPLN — statystyki liczą w złotówkach. Transakcja w innej walucie ma
//    `amountPLN` (z importu: kwota przeliczona w arkuszu). Bez niego zostaje
//    jej kwota — tak jak dotąd (ręczne wpisy walutowe nie znają kursu).
// 2. Inwestycje — wpłata na XTB/Binance itp. to nie wydatek, ale też nie są
//    to „wolne" pieniądze: nie wiadomo, czy wrócą z zyskiem. Liczymy je osobno
//    jako „Zainwestowane" (netto: wpłaty − wypłaty) i pokazujemy, ile
//    z bilansu zostało po inwestycjach.

import { isTransfer } from './categories.js'
import { convert, getCurrencyCode } from './currency.js'

// Nazwa historyczna: zwraca kwotę w WALUCIE GŁÓWNEJ (domyślnie zł). Najpierw
// bierze kwotę przeliczoną w arkuszu (`amountPLN`), inaczej przelicza po
// kursach z ustawień.
export function inPLN(t) {
  const base = getCurrencyCode()
  const cur = t?.currency || 'PLN'
  if (cur === base) return Number(t?.amount) || 0
  if (cur !== 'PLN' && Number.isFinite(t?.amountPLN)) return convert(t.amountPLN, 'PLN', base)
  return convert(t?.amount, cur, base)
}

// Noga przelewu związana z inwestycjami: oznaczona przy imporcie albo
// prowadząca do/z konta typu „Inwestycje".
export function isInvestmentFlow(t, accById = {}) {
  if (!isTransfer(t)) return false
  if (t.investment === true) return true
  const inv = (id) => accById[id]?.type === 'investment'
  return inv(t.transferTo) || inv(t.transferFrom) || inv(t.accountId)
}

// Zainwestowane netto (w zł): liczymy tylko nogi na zwykłych kontach, żeby
// przelew z obiema nogami nie liczył się dwa razy.
export function investedNet(list, accById = {}) {
  let sum = 0
  for (const t of list) {
    if (!isInvestmentFlow(t, accById)) continue
    if (accById[t.accountId]?.type === 'investment') continue
    sum += t.type === 'expense' ? inPLN(t) : -inPLN(t)
  }
  return Math.round(sum * 100) / 100
}
