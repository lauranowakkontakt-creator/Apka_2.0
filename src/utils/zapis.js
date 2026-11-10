import {
  doc,
  setDoc as setDocFirestore,
  updateDoc as updateDocFirestore,
  deleteDoc as deleteDocFirestore,
  writeBatch as writeBatchFirestore,
} from 'firebase/firestore'
import { nieCzekajNaSerwer } from './zapisWTle.js'
import { log } from './logger.js'
import { toast } from '../components/Toast'

// Zapisy Firestore, które nie wieszają formularza bez sieci (patrz zapisWTle.js).
//
// Nazwy eksportów są celowo takie same jak w SDK: moduły podmieniają wyłącznie
// ścieżkę importu, a wywołania zostają bez zmian — tak samo jak przy
// onSnapshot z subskrypcje.js. Pilnuje tego test/zapis.test.js: zapis
// zaimportowany prosto z 'firebase/firestore' znów wisiałby offline.
//
// Masowe zapisy (import, czyszczenie modułu) idą osobną drogą — przez
// firebase/lite.js — i tam czekanie na serwer jest zamierzone.

const jestSiec = () => typeof navigator === 'undefined' || navigator.onLine !== false

// `zapisz` to funkcja, a nie gotowa obietnica: SDK potrafi rzucić wyjątek
// synchronicznie (np. `undefined` w danych) — zamieniamy go na odrzuconą
// obietnicę, żeby `.catch()` u wołającego działał tak samo jak `try/await`.
function wTle(zapisz, co) {
  let obietnica
  try { obietnica = zapisz() } catch (blad) { return Promise.reject(blad) }
  return nieCzekajNaSerwer(obietnica, {
    online: jestSiec(),
    poCzasie: (blad) => {
      log.blad('zapis', `${co} — odrzucony po czasie`, blad)
      toast.error('Nie udało się zapisać ostatniej zmiany. Sprawdź połączenie i spróbuj ponownie.', { duration: 7000 })
    },
  })
}

export const setDoc = (ref, ...reszta) => wTle(() => setDocFirestore(ref, ...reszta), `setDoc ${ref.path}`)
export const updateDoc = (ref, ...reszta) => wTle(() => updateDocFirestore(ref, ...reszta), `updateDoc ${ref.path}`)
export const deleteDoc = (ref) => wTle(() => deleteDocFirestore(ref), `deleteDoc ${ref.path}`)

// addDoc z SDK oddaje referencję dopiero po potwierdzeniu z serwera. Id nadaje
// jednak klient, więc referencję mamy od razu — i od razu ją oddajemy.
export function addDoc(kolekcja, dane) {
  let ref
  try { ref = doc(kolekcja) } catch (blad) { return Promise.reject(blad) }
  return wTle(() => setDocFirestore(ref, dane), `addDoc ${kolekcja.path}`).then(() => ref)
}

export function writeBatch(db) {
  const paczka = writeBatchFirestore(db)
  const commit = paczka.commit.bind(paczka)
  paczka.commit = () => wTle(commit, 'batch.commit')
  return paczka
}
