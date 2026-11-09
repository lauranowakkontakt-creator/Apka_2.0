import { isInvestment } from './investmentMath.js'
import { byAccountOrder } from './accountOrder.js'
import { getCurrencyCode } from './currency.js'

// Portfele na ekranie głównym Finansów — przełączane strzałkami ← →.
//
// Waluta główna (domyślnie zł) jest zawsze pierwsza: to „łączny majątek". Każda
// inna waluta, w której jest jakieś zwykłe konto, to osobny portfel z własną
// sumą w tej walucie (bez przeliczania). Konta inwestycyjne tworzą jeden
// portfel „Inwestycje", bo ich wartość zmienia się z kursem i nie wlicza się
// do majątku.

export const PORTFEL_INWESTYCJE = 'inwestycje'
const waluta = (a) => a?.currency || 'PLN'

/** Lista portfeli z sumami. `konta` to konta wliczane do majątku. */
export function portfele(konta = [], glowna = getCurrencyCode()) {
  const zwykle = konta.filter(a => !isInvestment(a)).sort(byAccountOrder)
  const inwest = konta.filter(isInvestment)
  const sumy = {}
  for (const a of zwykle) sumy[waluta(a)] = (sumy[waluta(a)] || 0) + (Number(a.balance) || 0)

  const kolejnosc = [glowna, ...new Set(zwykle.map(waluta).filter(c => c !== glowna))]
  const lista = kolejnosc.map(c => ({ id: c, typ: 'waluta', waluta: c, suma: round2(sumy[c] || 0) }))

  if (inwest.length) {
    const wartosci = {}
    let wplacone = 0, wartoscPLN = 0
    for (const a of inwest) {
      wartosci[waluta(a)] = round2((wartosci[waluta(a)] || 0) + (Number(a.balance) || 0))
      if (waluta(a) === glowna) { wartoscPLN += Number(a.balance) || 0; wplacone += Number(a.invested) || 0 }
    }
    lista.push({ id: PORTFEL_INWESTYCJE, typ: 'inwestycje', sumy: wartosci, zysk: wplacone ? round2(wartoscPLN - wplacone) : null })
  }
  return lista
}

/** Czy transakcja należy do portfela. `kontaPoId` — mapa id → konto. */
export function wPortfelu(t, portfel, kontaPoId = {}) {
  if (!t || !portfel) return false
  const konto = t.accountId ? kontaPoId[t.accountId] : null
  if (portfel.typ === 'inwestycje') return !!konto && isInvestment(konto)
  if (konto && isInvestment(konto)) return false
  return (t.currency || waluta(konto)) === portfel.waluta
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100 }
