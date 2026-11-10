// Zapis, który nie każe czekać na serwer.
//
// Firestore zapisuje najpierw LOKALNIE (od razu widać zmianę na ekranie),
// a obietnica z addDoc / updateDoc / batch.commit() spełnia się dopiero po
// potwierdzeniu z serwera. Bez sieci to potwierdzenie nie przychodzi wcale —
// formularz z `await zapis; onClose()` wisiał więc na „Zapisywanie…" bez końca,
// chociaż wpis już był zapisany i czekał w kolejce na powrót sieci.
//
// Tutaj: offline nie czekamy w ogóle, a online najwyżej chwilę (`ms`) — tyle,
// żeby prawdziwy błąd (np. brak uprawnień) zdążył wrócić i pokazać się
// w formularzu. Po tym czasie uznajemy zapis za przyjęty do kolejki.
// Błąd, który przyjdzie później, trafia do `poCzasie` (log + komunikat).
//
// Czysta logika, bez Firebase — wiązanie z SDK jest w zapis.js.

export const CZAS_NA_SERWER_MS = 2500

/**
 * @param {Promise} obietnica     zapis do Firestore
 * @param {object}  opcje
 * @param {boolean} opcje.online   czy jest sieć
 * @param {number}  opcje.ms       ile czekać na serwer, gdy sieć jest
 * @param {Function} opcje.poCzasie wołane z błędem, który przyszedł po oddaniu sterowania
 * @returns {Promise<'serwer'|'kolejka'>}
 */
export function nieCzekajNaSerwer(obietnica, { online = true, ms = CZAS_NA_SERWER_MS, poCzasie } = {}) {
  return new Promise((resolve, reject) => {
    let oddane = false
    const oddaj = () => { if (!oddane) { oddane = true; resolve('kolejka') } }
    const zegar = online ? setTimeout(oddaj, ms) : null
    if (!online) oddaj()

    Promise.resolve(obietnica).then(
      () => {
        clearTimeout(zegar)
        if (!oddane) { oddane = true; resolve('serwer') }
      },
      (blad) => {
        clearTimeout(zegar)
        if (!oddane) { oddane = true; reject(blad); return }
        try { poCzasie?.(blad) } catch { /* obsługa błędu nie może sama wybuchnąć */ }
      },
    )
  })
}
