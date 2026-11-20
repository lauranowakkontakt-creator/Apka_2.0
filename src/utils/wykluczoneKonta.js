import { doc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { updateDoc, writeBatch } from './zapis'
import { log } from './logger'

// Konta „niewliczane do sumy" (oko na liście kont).
//
// Dotąd lista leżała w localStorage (excludedAccounts_{uid}), więc saldo kont
// i „łączny majątek" wychodziły inne na telefonie i na komputerze. Teraz to
// pole `excludedFromTotal` na samym koncie — jedzie razem z kontem do każdego
// urządzenia. Stara lista lokalna jest jednorazowo przenoszona do bazy.

import { kluczLokalny, lokalnaLista, idsDoMigracji, czyWykluczone } from './kontaWSumie.js'

export { idsDoMigracji, czyWykluczone, wliczaneKonta } from './kontaWSumie.js'

const wTrakcie = new Set()

// Jednorazowe przeniesienie starej listy do pól na kontach. Bezpieczne do
// wołania przy każdym snapshocie kont — po udanym przeniesieniu nic nie robi.
export function migrujWykluczoneKonta(uid, konta) {
  if (!uid || !konta?.length || wTrakcie.has(uid)) return
  const lokalne = lokalnaLista(uid)
  if (!lokalne.length) return
  const ids = idsDoMigracji(lokalne, konta)
  const usunLokalne = () => { try { localStorage.removeItem(kluczLokalny(uid)) } catch { /* tryb prywatny */ } }
  if (!ids.length) { usunLokalne(); return }
  wTrakcie.add(uid)
  const paczka = writeBatch(db)
  ids.forEach(id => paczka.update(doc(db, 'users', uid, 'accounts', id), { excludedFromTotal: true }))
  paczka.commit()
    .then(() => { usunLokalne(); log.info('konta', 'konta niewliczane do sumy przeniesione do bazy', { ile: ids.length }) })
    .catch(e => log.blad('konta', 'nie udało się przenieść kont niewliczanych do sumy', e))
    .finally(() => wTrakcie.delete(uid))
}

export function przelaczWykluczenie(uid, konto) {
  if (!uid || !konto?.id) return Promise.resolve()
  // Zmiana na koncie ze starej listy: najpierw zdejmujemy je z listy lokalnej,
  // żeby nie trzymała go wykluczonym po włączeniu z powrotem.
  const lokalne = lokalnaLista(uid)
  const byloWykluczone = czyWykluczone(konto) || lokalne.includes(konto.id)
  if (lokalne.includes(konto.id)) {
    try { localStorage.setItem(kluczLokalny(uid), JSON.stringify(lokalne.filter(x => x !== konto.id))) } catch { /* tryb prywatny */ }
  }
  return updateDoc(doc(db, 'users', uid, 'accounts', konto.id), { excludedFromTotal: !byloWykluczone })
}
