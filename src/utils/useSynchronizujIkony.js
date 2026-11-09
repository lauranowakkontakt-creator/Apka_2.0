import { useEffect } from 'react'
import { doc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { onSnapshot } from './subskrypcje'
import { bladSubskrypcji } from './polaczenie'
import { ustawIkonyKategorii } from './categoryIcons'

/** Jedna subskrypcja na całą aplikację — wywołaj raz w App. */
export function useSynchronizujIkonyKategorii(uid) {
  useEffect(() => {
    if (!uid) return undefined
    return onSnapshot(doc(db, 'users', uid, 'settings', 'categories'),
      d => ustawIkonyKategorii(d.exists() ? d.data() : {}),
      bladSubskrypcji('settings/categories/ikony'))
  }, [uid])
}
