// Czyste funkcje o kontach „niewliczanych do sumy" (bez Firebase — testowalne).
// Opis całości: wykluczoneKonta.js.

export const kluczLokalny = (uid) => `excludedAccounts_${uid}`

export function lokalnaLista(uid) {
  try { const s = localStorage.getItem(kluczLokalny(uid)); const v = s ? JSON.parse(s) : []; return Array.isArray(v) ? v : [] }
  catch { return [] }
}

// Czyste: które konta trzeba oznaczyć w bazie na podstawie starej listy.
export function idsDoMigracji(lokalne, konta) {
  const zbior = new Set(lokalne || [])
  return (konta || []).filter(a => zbior.has(a.id) && a.excludedFromTotal !== true).map(a => a.id)
}

export const czyWykluczone = (konto) => konto?.excludedFromTotal === true

// Konta wliczane do sumy. Do czasu przeniesienia starej listy bierzemy ją
// też pod uwagę, żeby suma nie mignęła innym wynikiem.
export function wliczaneKonta(uid, konta) {
  const stare = new Set(lokalnaLista(uid))
  return (konta || []).filter(a => !czyWykluczone(a) && !stare.has(a.id))
}
