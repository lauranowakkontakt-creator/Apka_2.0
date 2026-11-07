// Karty głównego panelu Finansów — po jednej na walutę, jak w Revolucie.
// Zamiast jednej sumy z dopiskami drobnymi chipami każda waluta ma własną
// kartę z saldem, liczbą kont i zmianą w bieżącym miesiącu (w tej walucie).
// Inwestycje dostają osobną, ostatnią kartę — ich wartość jest szacunkowa.

import { isInvestment } from './investmentMath.js'
import { isTransfer } from './categories.js'

const NAZWY = { PLN: 'złotówkach', EUR: 'euro', USD: 'dolarach', GBP: 'funtach', CHF: 'frankach', CZK: 'koronach czeskich', NOK: 'koronach norweskich', SEK: 'koronach szwedzkich', DKK: 'koronach duńskich', JPY: 'jenach', UAH: 'hrywnach' }
export const nazwaWaluty = (cur) => NAZWY[cur] || cur

/**
 * accounts:     konta uwzględniane w sumie (już bez wykluczonych)
 * transactions: transakcje bieżącego miesiąca
 * Zwraca [{ id, waluta, saldo, konta, zmiana, wplywy, wydatki, inwestycje? }]:
 * najpierw PLN, potem pozostałe waluty od największego salda, na końcu inwestycje.
 */
export function slajdyWalut(accounts = [], transactions = []) {
  const regular = accounts.filter(a => !isInvestment(a))
  const inv = accounts.filter(isInvestment)
  const map = {}
  for (const a of regular) {
    const cur = a.currency || 'PLN'
    map[cur] ||= { id: cur, waluta: cur, saldo: 0, konta: 0, wplywy: 0, wydatki: 0 }
    map[cur].saldo += Number(a.balance) || 0
    map[cur].konta++
  }
  if (!map.PLN && regular.length === 0) map.PLN = { id: 'PLN', waluta: 'PLN', saldo: 0, konta: 0, wplywy: 0, wydatki: 0 }
  for (const t of transactions) {
    if (isTransfer(t)) continue
    const cur = t.currency || 'PLN'
    if (!map[cur]) continue
    const kw = Number(t.amount) || 0
    if (t.type === 'income') map[cur].wplywy += kw
    else if (t.type === 'expense') map[cur].wydatki += kw
  }
  const lista = Object.values(map).map(s => ({ ...s, zmiana: s.wplywy - s.wydatki }))
    .sort((a, b) => (a.waluta === 'PLN' ? -1 : b.waluta === 'PLN' ? 1 : b.saldo - a.saldo))
  if (inv.length) {
    const wg = {}
    for (const a of inv) { const c = a.currency || 'PLN'; wg[c] = (wg[c] || 0) + (Number(a.balance) || 0) }
    const glowna = wg.PLN !== undefined ? 'PLN' : Object.keys(wg)[0]
    lista.push({ id: 'inwestycje', waluta: glowna, saldo: wg[glowna], konta: inv.length, inwestycje: wg })
  }
  return lista
}
