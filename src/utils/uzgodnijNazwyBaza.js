import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { zapiszWiele } from '../firebase/lite'
import { wPaczkach } from './zapisWPaczkach'
import { etykietyKategorii, zmianyNazw } from './uzgodnijNazwy'

/** Poprawia nazwy kategorii w transakcjach i płatnościach regularnych wg ustawień. Zwraca liczbę poprawionych wpisów. */
export async function uzgodnijNazwy(uid, settings) {
  const et = etykietyKategorii(settings)
  let razem = 0
  for (const kol of ['transactions', 'regularPayments']) {
    const snap = await getDocs(collection(db, 'users', uid, kol))
    const zmiany = zmianyNazw(snap.docs.map(d => ({ id: d.id, ...d.data() })), et)
    if (!zmiany.length) continue
    await zapiszWiele(zmiany.map(z => ({ path: ['users', uid, kol, z.id], data: z.data, merge: true })), { wPaczkach })
    razem += zmiany.length
  }
  return razem
}
