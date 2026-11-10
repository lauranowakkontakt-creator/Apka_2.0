import { getDoc, getDocFromCache } from 'firebase/firestore'
import { deleteDoc, setDoc } from './zapis'
import { toast } from '../components/Toast'
import { log } from './logger'

// Usuwanie z „Cofnij" zamiast pytania „Usunąć?".
//
// Pytanie przed każdym usunięciem to dodatkowe kliknięcie przy każdym wpisie,
// a i tak nie chroni przed pomyłką — „Usuń" klika się odruchowo. Tutaj wpis
// znika od razu, a przez kilka sekund na dole jest przycisk „Cofnij", który
// odkłada go dokładnie w to samo miejsce (to samo id, ta sama treść).
//
// Tylko dla pojedynczych, samodzielnych wpisów. Usunięcia, które pociągają za
// sobą inne dane (konto, kategoria, osoba, nawyk z historią), dalej pytają.

export const CZAS_NA_COFNIECIE_MS = 6000

// Komunikat z przyciskiem „Cofnij"; `przywroc` ma odtworzyć usunięte dane.
export function pokazCofnij(opis, przywroc) {
  toast.info(opis, {
    duration: CZAS_NA_COFNIECIE_MS,
    action: {
      label: 'Cofnij',
      onClick: () => {
        Promise.resolve().then(przywroc).catch(e => {
          log.blad('cofnij', 'nie udało się przywrócić wpisu', e)
          toast.error('Nie udało się przywrócić wpisu')
        })
      },
    },
  })
}

// Usuwa dokument i pokazuje „Cofnij". Treść do przywrócenia bierzemy
// z lokalnego cache (wpis jest na ekranie, więc tam jest) — bez czekania na sieć.
export async function usunZCofnieciem(ref, opis = 'Usunięto') {
  let dane = null
  try {
    let snap
    try { snap = await getDocFromCache(ref) } catch { snap = await getDoc(ref) }
    dane = snap.exists() ? snap.data() : null
  } catch (e) {
    log.warn('cofnij', 'nie udało się odczytać wpisu przed usunięciem — bez „Cofnij"', { kod: e?.code })
  }
  try {
    await deleteDoc(ref)
  } catch (e) {
    log.blad('cofnij', 'usuwanie nie powiodło się', e)
    toast.error('Nie udało się usunąć')
    return false
  }
  if (dane) pokazCofnij(opis, () => setDoc(ref, dane))
  else toast.info(opis)
  return true
}
