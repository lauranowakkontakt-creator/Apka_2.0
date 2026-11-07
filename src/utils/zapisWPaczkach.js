// Zapis / usuwanie wielu dokumentów małymi paczkami, z ponawianiem.
//
// Na prawdziwym serwerze (zwłaszcza w Safari, przy wolnym łączu albo
// long-pollingu) paczka 400 dokumentów potrafiła wisieć bez końca i bez błędu
// — import stał na „0 / 5577". Małe paczki idą płynnie, pasek postępu rusza
// się co paczkę, a zawieszona paczka jest ponawiana. set/delete są
// idempotentne, więc ponowienie paczki, która jednak doszła, niczego nie psuje.
//
// makeBatch: () => batch (writeBatch(db)), apply(batch, item): dodaje operację.

export const ROZMIAR_PACZKI = 50
const PRZEJSCIOWE = new Set(['timeout', 'unavailable', 'deadline-exceeded', 'resource-exhausted', 'aborted', 'internal'])

export function zTimeoutem(p, ms) {
  let t
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej({ code: 'timeout' }), ms) })])
    .finally(() => clearTimeout(t))
}

export async function wPaczkach(items, { makeBatch, apply, size = ROZMIAR_PACZKI, timeoutMs = 45000, proby = 4, onProgress, onWait, czekaj = (ms) => new Promise(r => setTimeout(r, ms)) }) {
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
        await czekaj(Math.min(2000 * proba, 8000))
      }
    }
    done += part.length
    onProgress?.(done, items.length)
  }
  return done
}
