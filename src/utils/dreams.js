import { collection, query, where, getDocs, updateDoc, arrayRemove } from 'firebase/firestore'
import { db } from '../firebase/config'

// Sny są zapisywane w kolekcji `users/{uid}/dreams`.
// Osoba może być powiązana ze snem na dwa sposoby:
//   - peopleIds  — uczestnicy wybrani jawnie z listy „kto brał udział"
//   - mentionIds — osoby wspomniane w treści (parsowane przy zapisie)
// Czysta logika (stałe, parsowanie, rdzeń imienia) żyje w `dreamLogic.js` — bez Firebase,
// dzięki czemu można ją testować. Tutaj re-eksport + operacje na bazie.
export {
  DREAM_EMOTIONS, DREAM_CATEGORIES, SYMBOL_COLORS,
  getEmotion, getCategory, mergeDreamCategories, findDreamCategory, parseMentions, parseSymbols, dreamPeopleIds, nameStem, personForms,
  detectTrigger, tokenizeDreamText, formMatch, bestPersonMatch,
} from './dreamLogic'

// Przy usunięciu symbolu — odpiąć go od snów (sny zostają).
export async function scrubSymbolFromDreams(uid, symbolId) {
  const snap = await getDocs(query(
    collection(db, 'users', uid, 'dreams'), where('symbolIds', 'array-contains', symbolId)
  ))
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { symbolIds: arrayRemove(symbolId) })))
}

// Przy trwałym usunięciu osoby — odpiąć ją od snów (sny zostają).
export async function scrubPersonFromDreams(uid, personId) {
  for (const field of ['peopleIds', 'mentionIds']) {
    const snap = await getDocs(query(
      collection(db, 'users', uid, 'dreams'), where(field, 'array-contains', personId)
    ))
    await Promise.all(snap.docs.map(d =>
      updateDoc(d.ref, { [field]: arrayRemove(personId) })
    ))
  }
}
