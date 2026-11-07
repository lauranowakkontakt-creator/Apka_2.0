// Firestore „lite" — zwykłe zapytania HTTP, bez stałego połączenia i bez
// lokalnej kolejki. Używamy go do masowych zapisów (import, czyszczenie):
// na telefonie strumień zapisów pełnego SDK potrafił stanąć po pierwszej
// paczce i dopiero zamknięcie okna puszczało kolejną. Tu każda paczka to
// osobne zapytanie, które albo się uda, albo zwróci błąd.
//
// Ładowany dopiero, gdy jest potrzebny — nie powiększa startu apki.
import { app, USE_EMULATORS } from './config'

let cached = null
export async function lite() {
  if (cached) return cached
  const mod = await import('firebase/firestore/lite')
  const dbLite = mod.getFirestore(app)
  if (USE_EMULATORS) {
    const h = typeof location !== 'undefined' ? location.hostname : ''
    mod.connectFirestoreEmulator(dbLite, !h || h === 'localhost' ? '127.0.0.1' : h, 8080)
  }
  cached = { ...mod, dbLite }
  return cached
}

// Zapis wielu operacji paczkami przez lite.
// ops: [{ path: ['users', uid, 'transactions', id], data, merge? } | { path, del: true }]
const plain = (v) => {
  if (v && typeof v.toDate === 'function' && !(v instanceof Date)) return v.toDate()
  if (Array.isArray(v)) return v.map(plain)
  if (v && typeof v === 'object' && !(v instanceof Date)) { const o = {}; for (const k of Object.keys(v)) o[k] = plain(v[k]); return o }
  return v
}

export async function zapiszWiele(ops, { wPaczkach, size = 250, onProgress, onWait }) {
  const L = await lite()
  return wPaczkach(ops, {
    size,
    timeoutMs: 60000,
    makeBatch: () => L.writeBatch(L.dbLite),
    apply: (b, op) => {
      const ref = L.doc(L.dbLite, ...op.path)
      if (op.del) b.delete(ref)
      else if (op.merge) b.set(ref, plain(op.data), { merge: true })
      else b.set(ref, plain(op.data))
    },
    onProgress, onWait,
  })
}
