import { useEffect, useRef } from 'react'
import { collection, orderBy, query, where, getDocs, getDoc, arrayUnion, arrayRemove, Timestamp, increment, doc } from 'firebase/firestore'
import { writeBatch, updateDoc } from './zapis'
import { onSnapshot } from './subskrypcje'
import { db } from '../firebase/config'
import { periodKey, naleznePeriods } from './paymentLogic'
import { toast } from '../components/Toast'
import { log } from './logger'
import { bladSubskrypcji } from './polaczenie'

export { periodKey, isPaymentActive, isPaymentDue } from './paymentLogic'

// Dodaje transakcję dla płatności i oznacza okres jako zrobiony.
// Atomowo: transakcja + saldo + odhaczenie okresu w jednym batchu.
// Bez batcha przerwanie między zapisami mogło dodać transakcję bez
// odhaczenia okresu → duplikat przy odświeżeniu.
// `date` — data transakcji; podawana przy nadrabianiu zaległego okresu, żeby
// wpis trafił do historii pod dniem płatności, a nie pod dzisiejszym.
export async function addTransactionForPayment(uid, p, period = periodKey(new Date(), p.frequency), date = null) {
  const batch = writeBatch(db)
  // Konto mogło zostać usunięte po utworzeniu płatności — update na
  // nieistniejącym dokumencie wywala cały batch i blokuje księgowanie.
  const accRef = p.accountId ? doc(db, 'users', uid, 'accounts', p.accountId) : null
  const accSnap = accRef ? await getDoc(accRef) : null
  const acc = accSnap?.exists() ? accSnap.data() : null
  batch.set(doc(collection(db, 'users', uid, 'transactions')), {
    type: p.type, amount: p.amount,
    // Waluta jak przy ręcznym wpisie: taka, jak konta. Bez tego płatność
    // z konta EUR liczyła się w statystykach jako złotówki.
    currency: acc?.currency || 'PLN',
    category: p.category, categoryId: p.categoryId, categoryIcon: p.categoryIcon,
    subcategoryId: p.subcategoryId || null, subcategoryLabel: p.subcategoryLabel || null,
    description: p.name, accountId: p.accountId || null,
    date: date ? Timestamp.fromDate(date) : Timestamp.now(), createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    fromRegular: p.id
  })
  if (acc) {
    const delta = p.type === 'expense' ? -p.amount : p.amount
    batch.update(accRef, { balance: increment(delta) })
  }
  batch.update(doc(db, 'users', uid, 'regularPayments', p.id), {
    donePeriods: arrayUnion(period)
  })
  await batch.commit()
}

// Cofa zaksięgowanie płatności: usuwa transakcje tego okresu utworzone przez
// „Zrobione"/auto-księgowanie, oddaje saldo kont i zdejmuje odhaczenie okresu.
// Atomowo (batch) — dzięki temu „Cofnij" + ponowne „Zrobione" nie duplikuje
// transakcji ani nie odejmuje salda podwójnie.
export async function removeTransactionForPayment(uid, p, period = periodKey(new Date(), p.frequency)) {
  const snap = await getDocs(query(
    collection(db, 'users', uid, 'transactions'),
    where('fromRegular', '==', p.id)
  ))
  const batch = writeBatch(db)
  const balanceDeltas = {}
  snap.docs.forEach(d => {
    const t = d.data()
    const date = t.date?.toDate?.() ?? t.createdAt?.toDate?.()
    if (!date || periodKey(date, p.frequency) !== period) return
    batch.delete(d.ref)
    if (t.accountId) {
      const delta = t.type === 'expense' ? t.amount : -t.amount
      balanceDeltas[t.accountId] = (balanceDeltas[t.accountId] || 0) + delta
    }
  })
  for (const [accountId, delta] of Object.entries(balanceDeltas)) {
    // Pomijamy konta usunięte w międzyczasie — inaczej cały batch pada
    const accRef = doc(db, 'users', uid, 'accounts', accountId)
    if ((await getDoc(accRef)).exists()) batch.update(accRef, { balance: increment(delta) })
  }
  batch.update(doc(db, 'users', uid, 'regularPayments', p.id), {
    donePeriods: arrayRemove(period)
  })
  await batch.commit()
}

// Czy w danym okresie istnieje już transakcja utworzona z tej płatności.
// Chroni przed duplikatem, gdy dwa urządzenia księgują równolegle, zanim
// zaktualizowane `donePeriods` zdąży się zsynchronizować.
async function hasTransactionForPeriod(uid, p, period) {
  const snap = await getDocs(query(
    collection(db, 'users', uid, 'transactions'),
    where('fromRegular', '==', p.id)
  ))
  return snap.docs.some(d => {
    const t = d.data()
    const date = t.date?.toDate?.() ?? t.createdAt?.toDate?.()
    return !!date && periodKey(date, p.frequency) === period
  })
}

// Księguje płatność, chyba że transakcja tego okresu już istnieje —
// wtedy tylko uzupełnia odhaczenie okresu (naprawa po wyścigu urządzeń).
async function bookPaymentOnce(uid, p, period, date = null) {
  if (await hasTransactionForPeriod(uid, p, period)) {
    await updateDoc(doc(db, 'users', uid, 'regularPayments', p.id), {
      donePeriods: arrayUnion(period)
    })
    return false
  }
  await addTransactionForPayment(uid, p, period, date)
  return true
}

// Hook uruchamiany na poziomie aplikacji — księguje należne płatności AUTO w tle,
// niezależnie od tego, czy użytkownik wejdzie w zakładkę „Regularne".
// Księguje też okresy POMINIĘTE (apka nieotwierana przez miesiąc) — każdy pod
// datą swojej płatności; patrz naleznePeriods w paymentLogic.js.
export function useRegularPaymentsProcessor(uid) {
  const processed = useRef(new Set())
  useEffect(() => {
    if (!uid) return
    processed.current.clear()
    const q = query(collection(db, 'users', uid, 'regularPayments'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      snap.docs.forEach(d => {
        const p = { id: d.id, ...d.data() }
        if (!p.autoAdd) return
        const klucz = (it) => `${p.id}_${it.period}`
        const doZrobienia = naleznePeriods(p, new Date()).filter(it => !processed.current.has(klucz(it)))
        if (!doZrobienia.length) return
        doZrobienia.forEach(it => processed.current.add(klucz(it)))
        // Po kolei, od najstarszego: równoległe zapisy tej samej płatności
        // ścigałyby się o saldo konta i odhaczenie okresu.
        ;(async () => {
          let zalegle = 0
          for (let i = 0; i < doZrobienia.length; i++) {
            const it = doZrobienia[i]
            try {
              // Zaległy okres: południe dnia płatności (środek dnia nie zmieni
              // daty przy żadnej strefie czasowej). Bieżący: chwila obecna.
              const data = it.biezacy ? null : new Date(it.date.getFullYear(), it.date.getMonth(), it.date.getDate(), 12)
              const dodano = await bookPaymentOnce(uid, p, it.period, data)
              if (dodano && !it.biezacy) zalegle++
            } catch (blad) {
              log.blad('regularPayments', `księgowanie „${p.name}" (${it.period}) nie powiodło się`, blad)
              // Ten i kolejne okresy spróbujemy przy następnej zmianie danych.
              doZrobienia.slice(i).forEach(x => processed.current.delete(klucz(x)))
              break
            }
          }
          if (zalegle) toast.info(`${p.name}: zaksięgowano zaległe płatności (${zalegle})`, { duration: 6000 })
        })()
      })
    }, bladSubskrypcji('regularPayments'))
  }, [uid])
}
