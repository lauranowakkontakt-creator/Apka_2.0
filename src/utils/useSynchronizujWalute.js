import { useEffect } from 'react'
import { doc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { setDoc } from './zapis'
import { onSnapshot } from './subskrypcje'
import { bladSubskrypcji } from './polaczenie'
import { log } from './logger'
import { ustawieniaWaluty, zastosujUstawieniaWaluty, teSameUstawieniaWaluty, domyslnaWaluta, normalizujWalute } from './currency'

// Waluta główna i własne kursy — wspólne dla wszystkich urządzeń.
//
// Dotąd leżały wyłącznie w localStorage: na drugim telefonie albo po
// wyczyszczeniu przeglądarki wracało „zł" z kursami domyślnymi i te same
// transakcje dawały inne sumy. Teraz kopia jest w users/{uid}/settings/currency.

const refWaluty = (uid) => doc(db, 'users', uid, 'settings', 'currency')

// Po zmianie w Ustawieniach: wyślij bieżące ustawienia do bazy.
export function zapiszWaluteWBazie(uid) {
  if (!uid) return
  setDoc(refWaluty(uid), { ...ustawieniaWaluty(), updatedAt: Timestamp.now() })
    .catch(e => log.blad('waluta', 'nie udało się zapisać ustawień waluty', e))
}

// Jedna subskrypcja na całą aplikację (wywołaj raz w App).
// `poZmianie(code)` — wołane, gdy ustawienia przyszły z innego urządzenia.
export function useSynchronizujWalute(uid, poZmianie) {
  useEffect(() => {
    if (!uid) return undefined
    return onSnapshot(refWaluty(uid), d => {
      const lokalne = ustawieniaWaluty()
      if (!d.exists()) {
        // Pierwsze uruchomienie po tej zmianie: to urządzenie ma już własne
        // ustawienia, więc to ono zakłada wspólną kopię.
        if (!domyslnaWaluta(lokalne)) zapiszWaluteWBazie(uid)
        return
      }
      const zdalne = normalizujWalute(d.data())
      if (teSameUstawieniaWaluty(zdalne, lokalne)) return
      if (zastosujUstawieniaWaluty(zdalne)) {
        log.info('waluta', 'ustawienia waluty pobrane z bazy', { code: zdalne.code })
        poZmianie?.(zdalne.code)
      }
    }, bladSubskrypcji('settings/currency'))
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps -- poZmianie jest stabilne (useCallback w App)
}
