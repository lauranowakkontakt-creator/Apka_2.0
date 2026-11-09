import { collection, query, where, getDocs, updateDoc, deleteDoc, doc, arrayRemove, arrayUnion } from 'firebase/firestore'
import { symbolForms } from './dreamLogic'
import { db } from '../firebase/config'

// Sny są zapisywane w kolekcji `users/{uid}/dreams`.
// Osoba może być powiązana ze snem na dwa sposoby:
//   - peopleIds  — uczestnicy wybrani jawnie z listy „kto brał udział"
//   - mentionIds — osoby wspomniane w treści (parsowane przy zapisie)
// Czysta logika (stałe, parsowanie, rdzeń imienia) żyje w `dreamLogic.js` — bez Firebase,
// dzięki czemu można ją testować. Tutaj re-eksport + operacje na bazie.
export {
  DREAM_EMOTIONS, DREAM_CATEGORIES, SYMBOL_COLORS,
  getEmotion, getCategory, mergeDreamCategories, findDreamCategory, parseMentions, parseSymbols, symbolForms, parseAliasInput, symbolMatchesQuery, dreamPeopleIds, nameStem, personForms,
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

// Łączenie symboli: `others` wchodzą do `primary` jako jego dodatkowe formy,
// we wszystkich snach id scalanych symboli zamienia się na id głównego,
// znaczenia się sklejają, a scalone symbole są usuwane (sny zostają).
export async function mergeSymbols(uid, primary, others) {
  const forms = [...new Set([
    ...symbolForms(primary),
    ...others.flatMap(symbolForms),
  ].map(f => f.trim()))]
  const aliases = forms.filter(f => f.toLowerCase() !== (primary.name || '').trim().toLowerCase())
  const meanings = [primary, ...others].map(s => (s.meaning || '').trim()).filter(Boolean)
  const meaning = [...new Set(meanings)].join('\n\n')

  for (const o of others) {
    const snap = await getDocs(query(collection(db, 'users', uid, 'dreams'), where('symbolIds', 'array-contains', o.id)))
    await Promise.all(snap.docs.map(d => updateDoc(d.ref, { symbolIds: arrayRemove(o.id) })
      .then(() => updateDoc(d.ref, { symbolIds: arrayUnion(primary.id) }))))
  }
  await updateDoc(doc(db, 'users', uid, 'dreamSymbols', primary.id), { aliases, ...(meaning ? { meaning } : {}) })
  await Promise.all(others.map(o => deleteDoc(doc(db, 'users', uid, 'dreamSymbols', o.id))))
}
