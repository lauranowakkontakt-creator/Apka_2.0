import { db } from '../../firebase/config'
import { collection, doc, getDocs, query, where } from 'firebase/firestore'
import { writeBatch } from '../../utils/zapis'

// Zapis list zadań, wspólny dla okna listy i zarządzania listami.

/** Usuwa listę; jej zadania zostają, tylko trafiają do „Bez listy”. */
export async function usunListe(uid, listId) {
  const zadania = await getDocs(query(collection(db, 'users', uid, 'todos'), where('listId', '==', listId)))
  const batch = writeBatch(db)
  zadania.forEach(d => batch.update(d.ref, { listId: null }))
  batch.delete(doc(db, 'users', uid, 'todoLists', listId))
  await batch.commit()
}

/** Zapisuje nową kolejność list (`[{ id, order }]`). */
export async function zapiszKolejnosc(uid, zmiany) {
  if (!zmiany.length) return
  const batch = writeBatch(db)
  for (const { id, order } of zmiany) batch.update(doc(db, 'users', uid, 'todoLists', id), { order })
  await batch.commit()
}
