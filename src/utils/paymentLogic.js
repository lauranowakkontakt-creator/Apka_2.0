// Czysta logika płatności regularnych — BEZ zależności od Firebase, dzięki czemu
// da się ją testować bez inicjalizacji bazy. Funkcje Firestore są w `regularPayments.js`.
import { format, parseISO, isAfter, isBefore, startOfDay, getDaysInMonth } from 'date-fns'

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
