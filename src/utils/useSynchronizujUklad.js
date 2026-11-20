import { useEffect } from 'react'
import { doc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { setDoc } from './zapis'
import { onSnapshot } from './subskrypcje'
import { bladSubskrypcji } from './polaczenie'
import { log } from './logger'
import { LAYOUT_KEY, getLayout, saveLayout, normalizeLayout, innyUklad, teSameIkony, czyscIkony } from './moduleLayout'
import { getModuleIcons, replaceModuleIcons } from './iconPrefs'

// Kolejność, ukrywanie i ikony modułów — wspólne dla wszystkich urządzeń.
//
// Dotąd leżały tylko w localStorage, więc pasek na telefonie i menu na
// komputerze miały każde swój układ: przestawienie modułów w jednym miejscu
// nie zmieniało drugiego. Teraz kopia jest w users/{uid}/settings/moduleLayout.

const refUkladu = (uid) => doc(db, 'users', uid, 'settings', 'moduleLayout')

// Po zmianie w Ustawieniach: wyślij bieżący układ i ikony do bazy.
export function zapiszUkladWBazie(uid, layout) {
  if (!uid || !layout) return
  setDoc(refUkladu(uid), {
    order: layout.order || [],
    hidden: layout.hidden || [],
    icons: getModuleIcons(),
    updatedAt: Timestamp.now(),
  }).catch(e => log.blad('uklad', 'nie udało się zapisać układu modułów', e))
}

const maLokalnyZapis = () => {
  try { return localStorage.getItem(LAYOUT_KEY) != null || Object.keys(getModuleIcons()).length > 0 }
  catch { return false }
}

// Jedna subskrypcja na całą aplikację (wywołaj raz w App).
// `poZmianie(layout, ikonyZmienione)` — gdy układ przyszedł z innego urządzenia.
export function useSynchronizujUklad(uid, allIds, poZmianie) {
  useEffect(() => {
    if (!uid) return undefined
    return onSnapshot(refUkladu(uid), d => {
      if (!d.exists()) {
        // Pierwsze uruchomienie po tej zmianie: urządzenie z własnym układem
        // zakłada wspólną kopię.
        if (maLokalnyZapis()) zapiszUkladWBazie(uid, getLayout(allIds))
        return
      }
      const dane = d.data() || {}
      const lokalny = getLayout(allIds)
      const zdalneIkony = czyscIkony(dane.icons)
      const ukladInny = innyUklad(dane, lokalny, allIds)
      const ikonyInne = !teSameIkony(zdalneIkony, getModuleIcons())
      if (!ukladInny && !ikonyInne) return
      const nowy = normalizeLayout(dane, allIds)
      if (ukladInny) saveLayout(nowy)
      if (ikonyInne) replaceModuleIcons(zdalneIkony)
      log.info('uklad', 'układ modułów pobrany z bazy')
      poZmianie?.(nowy, ikonyInne)
    }, bladSubskrypcji('settings/moduleLayout'))
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps -- allIds i poZmianie są stałe w App
}
