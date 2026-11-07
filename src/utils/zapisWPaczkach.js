// Zapis / usuwanie wielu dokumentów małymi paczkami, z ponawianiem.
//
// Na prawdziwym serwerze (zwłaszcza w Safari, przy wolnym łączu albo
// long-pollingu) paczka 400 dokumentów potrafiła wisieć bez końca i bez błędu
// — import stał na „0 / 5577". Małe paczki idą płynnie, pasek postępu rusza
// się co paczkę, a zawieszona paczka jest ponawiana. set/delete są
// idempotentne, więc ponowienie paczki, która jednak doszła, niczego nie psuje.
//
// makeBatch: () => batch (writeBatch(db)), apply(batch, item): dodaje operację.
// onStall: wołane, gdy paczka utknie (timeout) — w apce restartuje połączenie
// z Firestore (disableNetwork/enableNetwork). Na telefonie strumień zapisów
// potrafi stanąć po pierwszej paczce i bez restartu kolejne czekają w kolejce
// za zawieszoną; ręcznie pomagało tylko zamknięcie i otwarcie apki.

export const ROZMIAR_PACZKI = 50
const PRZEJSCIOWE = new Set(['timeout', 'unavailable', 'deadline-exceeded', 'resource-exhausted', 'aborted', 'internal'])

export function zTimeoutem(p, ms) {
  let t
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej({ code: 'timeout' }), ms) })])
    .finally(() => clearTimeout(t))
}

export async function wPaczkach(items, { makeBatch, apply, size = ROZMIAR_PACZKI, timeoutMs = 20000, proby = 6, onProgress, onWait, onStall, czekaj = (ms) => new Promise(r => setTimeout(r, ms)) }) {
  let done = 0
  onProgress?.(0, items.length)
  for (let i = 0; i < items.length; i += size) {
    const part = items.slice(i, i + size)
    for (let proba = 1; ; proba++) {
      try {
        const b = makeBatch()
        for (const it of part) apply(b, it)
        await zTimeoutem(b.commit(), timeoutMs)
        break
      } catch (e) {
        const code = e?.code || 'unknown'
        if (proba >= proby || !PRZEJSCIOWE.has(code)) throw e
        onWait?.(code, proba)
        if (code === 'timeout' && onStall) { try { await zTimeoutem(onStall(), 15000) } catch { /* spróbujemy i tak */ } }
        await czekaj(Math.min(1000 * proba, 5000))
      }
    }
    done += part.length
    onProgress?.(done, items.length)
  }
  return done
}
