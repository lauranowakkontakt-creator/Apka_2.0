import { collection, query, where, getDocs, deleteDoc, updateDoc, doc, arrayRemove } from 'firebase/firestore'
import { db } from '../firebase/config'
import { scrubPersonFromDreams } from './dreams'

// Osoba jest współdzielona przez wszystkie moduły (kolekcja `calendarPeople`).
// Widoczność jest sterowana per moduł: `hiddenInCalendar`, `hiddenInPrayer`.
// Osoba zawsze zostaje w centralnej bazie (zakładka „Osoby"), nawet gdy ukryta w module.

const FIELD = { calendar: 'hiddenInCalendar', prayer: 'hiddenInPrayer' }

// Ukryj / pokaż osobę w danym module ('calendar' | 'prayer').
export async function setPersonHidden(uid, personId, module, hidden) {
  const field = FIELD[module]
  if (!field) return
  await updateDoc(doc(db, 'users', uid, 'calendarPeople', personId), { [field]: hidden })
}

// Przenieś osobę do kręgu „bliscy" albo „dalsi" (dalsi znikają z głównej listy w Osobach).
export async function setPersonCircle(uid, personId, circle) {
  await updateDoc(doc(db, 'users', uid, 'calendarPeople', personId), { circle: circle === 'far' ? 'far' : 'close' })
}

// Trwałe usunięcie — kasuje osobę ORAZ wszystkie jej wydarzenia i prośby modlitewne.
export async function purgePerson(uid, personId) {
  for (const col of ['calendarEvents', 'prayerIntentions']) {
    const snap = await getDocs(query(collection(db, 'users', uid, col), where('personId', '==', personId)))
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
  }
  // Sny zostają — odpinamy tylko osobę od ich list uczestników/wzmianek.
  await scrubPersonFromDreams(uid, personId)
  // Długi zostają, ale tracą powiązanie z osobą (imię pozostaje we wpisie).
  const debtSnap = await getDocs(query(collection(db, 'users', uid, 'debtors'), where('personId', '==', personId)))
  await Promise.all(debtSnap.docs.map(d => updateDoc(d.ref, { personId: null })))
  // Zadania zostają — odpinamy osobę z listy `peopleIds`.
  const todoSnap = await getDocs(query(collection(db, 'users', uid, 'todos'), where('peopleIds', 'array-contains', personId)))
  await Promise.all(todoSnap.docs.map(d => updateDoc(d.ref, { peopleIds: arrayRemove(personId) })))
  // Wpisy nastroju i spotkania z kilkoma osobami zostają — odpinamy tylko tę osobę.
  for (const col of ['moodLogs', 'calendarEvents']) {
    const snap = await getDocs(query(collection(db, 'users', uid, col), where('peopleIds', 'array-contains', personId)))
    await Promise.all(snap.docs.map(d => updateDoc(d.ref, { peopleIds: arrayRemove(personId) })))
  }
  await deleteDoc(doc(db, 'users', uid, 'calendarPeople', personId))
}
