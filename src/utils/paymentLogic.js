// Czysta logika płatności regularnych — BEZ zależności od Firebase, dzięki czemu
// da się ją testować bez inicjalizacji bazy. Funkcje Firestore są w `regularPayments.js`.
import {
  format, parse, parseISO, isAfter, isBefore, startOfDay, getDaysInMonth,
  startOfMonth, endOfMonth, addMonths, startOfISOWeek, addWeeks, addDays,
  startOfYear, endOfYear, addYears,
} from 'date-fns'

// Klucz okresu rozliczeniowego zależny od częstotliwości płatności:
//  - monthly → 'yyyy-MM'      (np. '2026-07')
//  - weekly  → tydzień ISO    (np. '2026-W29' — RRRR/II to rok i numer tygodnia ISO)
//  - yearly  → 'yyyy'         (np. '2026')
// Dzięki temu płatność roczna księguje się raz w roku, a tygodniowa co tydzień
// (wcześniej wszystkie używały klucza miesięcznego).
export const periodKey = (d = new Date(), frequency = 'monthly') => {
  if (frequency === 'weekly') return format(d, "RRRR-'W'II")
  if (frequency === 'yearly') return format(d, 'yyyy')
  return format(d, 'yyyy-MM')
}

// Czy płatność jest aktywna w danym dniu (mieści się w zakresie dat)
export function isPaymentActive(p, today = startOfDay(new Date())) {
  if (p.dateFrom && isBefore(today, startOfDay(parseISO(p.dateFrom)))) return false
  if (p.dateTo   && isAfter(today,  startOfDay(parseISO(p.dateTo))))   return false
  return true
}

// Dzień, w którym płatność miesięczna REALNIE wypada w miesiącu daty `date`.
// Płatność ustawiona na 31. (albo 29./30.) w krótszym miesiącu wypada w jego
// ostatnim dniu — inaczej w lutym, kwietniu itd. nie wypadałaby wcale:
// auto-księgowanie by ją pominęło, a kalendarz i Pulpit nie pokazały.
export function dueDayInMonth(p, date = new Date()) {
  const dzien = Math.max(1, Math.floor(Number(p?.dayOfMonth)) || 1)
  return Math.min(dzien, getDaysInMonth(date))
}

// Czy płatność miesięczna wypada dokładnie w tym dniu kalendarza
// (z uwzględnieniem zakresu dat „obowiązuje od / do").
export function isMonthlyPaymentOn(p, date) {
  if ((p?.frequency || 'monthly') !== 'monthly') return false
  if (date.getDate() !== dueDayInMonth(p, date)) return false
  return isPaymentActive(p, startOfDay(date))
}

// Czy płatność powinna zostać automatycznie/ręcznie zaksięgowana w tym okresie.
//  - monthly: dopiero od ustawionego dnia miesiąca
//  - yearly:  dopiero od rocznicy daty „obowiązuje od" (jeśli ustawiona);
//             bez niej — od początku roku
//  - weekly:  przez cały tydzień ISO (płatność nie ma dnia tygodnia)
export function isPaymentDue(p, period = periodKey(new Date(), p.frequency), today = new Date()) {
  if (p.donePeriods?.includes(period)) return false
  if (!isPaymentActive(p, startOfDay(today))) return false
  const freq = p.frequency || 'monthly'
  if (freq === 'monthly' && today.getDate() < dueDayInMonth(p, today)) return false
  if (freq === 'yearly' && p.dateFrom) {
    // rocznica: porównanie 'MM-dd' działa leksykograficznie
    if (format(today, 'MM-dd') < format(parseISO(p.dateFrom), 'MM-dd')) return false
  }
  return true
}

// ─── Nadrabianie pominiętych okresów (płatności AUTO) ───────────────────────
//
// Auto-księgowanie działa tylko wtedy, gdy apka jest otwarta. Bez tego miesiąc,
// w którym nikt jej nie otworzył, przepadał: czynsz za październik nie trafiał
// do historii, a saldo konta było od tej pory zawyżone.
//
// naleznePeriods zwraca WSZYSTKIE okresy do zaksięgowania — zaległe i bieżący —
// razem z datą, pod którą transakcja ma trafić do historii.

// Bezpiecznik: nie nadrabiamy więcej niż tyle okresów naraz.
export const LIMIT_ZALEGLYCH = 24

const KROKI = {
  monthly: { wzor: /^\d{4}-\d{2}$/,     poczatek: startOfMonth,   dalej: (d) => addMonths(d, 1), zKlucza: (k) => parseISO(`${k}-01`) },
  weekly:  { wzor: /^\d{4}-W\d{2}$/,    poczatek: startOfISOWeek, dalej: (d) => addWeeks(d, 1),  zKlucza: (k) => parse(k, "RRRR-'W'II", new Date()) },
  yearly:  { wzor: /^\d{4}$/,            poczatek: startOfYear,    dalej: (d) => addYears(d, 1),  zKlucza: (k) => parseISO(`${k}-01-01`) },
}

// Okno okresu: od pierwszego dnia, w którym płatność jest w nim należna,
// do końca okresu.
function oknoOkresu(p, freq, poczatekOkresu) {
  if (freq === 'weekly') return [poczatekOkresu, addDays(poczatekOkresu, 6)]
  if (freq === 'yearly') {
    const od = p.dateFrom ? parseISO(p.dateFrom) : null
    const start = od ? new Date(poczatekOkresu.getFullYear(), od.getMonth(), od.getDate()) : poczatekOkresu
    return [start, endOfYear(poczatekOkresu)]
  }
  const start = new Date(poczatekOkresu.getFullYear(), poczatekOkresu.getMonth(), dueDayInMonth(p, poczatekOkresu))
  return [start, endOfMonth(poczatekOkresu)]
}

/**
 * Okresy płatności do zaksięgowania na dzień `today`.
 *
 * Skąd zaczynamy:
 *  - od okresu po ostatnim zaksięgowanym (`donePeriods`),
 *  - nie wcześniej niż od włączenia auto-księgowania (`autoSince`) — żeby
 *    płatność prowadzona latami ręcznie nie dostała nagle transakcji wstecz,
 *  - bez żadnej z tych informacji: tylko bieżący okres (jak dotąd).
 *
 * @returns {{ period: string, date: Date, biezacy: boolean }[]} od najstarszego
 */
export function naleznePeriods(p, today = new Date(), limit = LIMIT_ZALEGLYCH) {
  const freq = KROKI[p.frequency] ? p.frequency : 'monthly'
  const krok = KROKI[freq]
  const dzis = startOfDay(today)
  const biezacy = krok.poczatek(dzis)
  const zrobione = new Set(p.donePeriods || [])

  let start = biezacy
  const ostatni = [...zrobione].filter(k => krok.wzor.test(k)).sort().pop()
  if (ostatni) {
    const po = krok.dalej(krok.poczatek(krok.zKlucza(ostatni)))
    if (po < start) start = po
  }
  if (p.autoSince) {
    const od = krok.poczatek(parseISO(p.autoSince))
    if (!ostatni && od < start) start = od
    else if (od > start) start = od > biezacy ? biezacy : od
  }

  const od = p.dateFrom ? startOfDay(parseISO(p.dateFrom)) : null
  const doKiedy = p.dateTo ? startOfDay(parseISO(p.dateTo)) : null

  const wynik = []
  for (let cur = start, i = 0; cur <= biezacy && i < 2000; cur = krok.dalej(cur), i++) {
    const period = periodKey(cur, freq)
    if (zrobione.has(period)) continue
    const [oknoOd, oknoDo] = oknoOkresu(p, freq, cur)
    const date = od && od > oknoOd ? od : oknoOd
    if (date > oknoDo || date > dzis) continue
    if (doKiedy && date > doKiedy) continue
    const czyBiezacy = cur.getTime() === biezacy.getTime()
    // Bieżący okres trzyma się dotychczasowej reguły: po „obowiązuje do"
    // płatność już nie jest należna.
    if (czyBiezacy && doKiedy && dzis > doKiedy) continue
    wynik.push({ period, date, biezacy: czyBiezacy })
  }
  return wynik.slice(-limit)
}
