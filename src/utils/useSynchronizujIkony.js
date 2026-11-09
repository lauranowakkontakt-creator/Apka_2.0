import { useEffect } from 'react'
import { doc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { onSnapshot } from './subskrypcje'
import { bladSubskrypcji } from './polaczenie'
import { ustawIkonyKategorii } from './categoryIcons'
import { etykietyKategorii } from './uzgodnijNazwy'
import { uzgodnijNazwy } from './uzgodnijNazwyBaza'
import { toast } from '../components/Toast'

// Jedna subskrypcja ustawień kategorii na całą aplikację (wywołaj raz w App):
//  1. ikony kategorii na żywo (CatIcon),
//  2. nazwy kategorii w transakcjach — gdy zmieni się któraś nazwa (albo
//     pierwszy raz na tym urządzeniu), uzgadniamy je w tle. Podpis nazw jest
//     zapamiętany, więc przy każdym starcie NIE czytamy całej historii.
const podpis = (settings) => {
  const e = etykietyKategorii(settings)
  return JSON.stringify([e.cat, e.sub, e.subsub])
}

export function useSynchronizujIkonyKategorii(uid) {
  useEffect(() => {
    if (!uid) return undefined
    let trwa = false
    return onSnapshot(doc(db, 'users', uid, 'settings', 'categories'),
      async d => {
        const settings = d.exists() ? d.data() : {}
        ustawIkonyKategorii(settings)
        if (!d.exists() || trwa) return // bez własnych ustawień nie ma czego uzgadniać
        const klucz = `catNamesSig_${uid}`
        const sig = podpis(settings)
        let zapisany = null
        try { zapisany = localStorage.getItem(klucz) } catch { /* tryb prywatny */ }
        if (zapisany === sig) return
        trwa = true
        try {
          const n = await uzgodnijNazwy(uid, settings)
          try { localStorage.setItem(klucz, sig) } catch { /* tryb prywatny */ }
          if (n > 0) toast.success(`Zaktualizowano nazwy kategorii w ${n} ${n === 1 ? 'wpisie' : 'wpisach'}`)
        } catch (e) {
          console.error('Uzgadnianie nazw kategorii:', e)
          toast.error('Nie udało się zaktualizować nazw kategorii w transakcjach')
        }
        trwa = false
      },
      bladSubskrypcji('settings/categories/ikony'))
  }, [uid])
}
