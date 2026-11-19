import { useEffect } from 'react'

// Pola daty i godziny (input type="date" / "time") w Safari — poprawki w jednym miejscu.
//
// 1. Godzina „nie zapisuje się”: Safari zmienia wartość pola od razu po
//    wpisaniu godziny, ale zdarzenie `input` wysyła dopiero po przejściu do
//    minut. Kto zmieni tylko godzinę i od razu kliknie „Zapisz”, zapisuje
//    starą wartość, bo React jeszcze o zmianie nie wie. Dlatego przed każdym
//    kliknięciem / Enterem / wyjściem z pola wysyłamy `input` sami — React
//    porównuje wartość ze swoją i przyjmuje ją tylko, jeśli się różni.
//
// 2. Dymek „Nieprawidłowa wartość”: pole wpisane do połowy (np. sam dzień)
//    Safari uznaje za błędne i blokuje wysłanie formularza. Po wyjściu z pola
//    wracamy do ostatniej pełnej wartości, a przy wysyłaniu chowamy dymek
//    i wysyłamy formularz z tą wartością.

const POLA_DATY = 'input[type="date"], input[type="time"], input[type="month"], input[type="datetime-local"]'

export const jestPolemDaty = (el) => !!el?.matches?.(POLA_DATY)

/** Daj Reactowi znać o wartości, którą pole już ma (React pominie, jeśli to nic nowego). */
export function zglosWartosc(el) {
  if (!jestPolemDaty(el)) return
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

// Ostatnia pełna wartość każdego pola — przy wpisywaniu do połowy przeglądarka
// zgłasza pustą, więc sam React jej już nie pamięta.
const ostatniePelne = new WeakMap()
export function zapamietaj(el) {
  if (jestPolemDaty(el) && el.value) ostatniePelne.set(el, el.value)
}

/** Pole wpisane do połowy → ostatnia pełna wartość (i React o niej wie). */
export function naprawNiepelne(el) {
  if (!jestPolemDaty(el) || !el.validity?.badInput) return false
  // Setter z prototypu: przypisanie wprost React uznałby za swoje i przeoczył zmianę.
  const ustaw = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  ustaw.call(el, ostatniePelne.get(el) || el.defaultValue || '')
  zglosWartosc(el)
  return true
}

export function usePolaDaty() {
  useEffect(() => {
    const aktywnePole = () => (jestPolemDaty(document.activeElement) ? document.activeElement : null)

    // Kliknięcie gdziekolwiek (np. „Zapisz”) albo Enter — najpierw zgłoś wartość pola.
    const przedAkcja = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter') return
      const pole = aktywnePole()
      if (pole) zglosWartosc(pole)
    }
    const naWejscie = (e) => zapamietaj(e.target)
    const poWyjsciu = (e) => {
      if (!jestPolemDaty(e.target)) return
      zglosWartosc(e.target)
      naprawNiepelne(e.target)
    }

    // Formularz zatrzymany przez niepełną datę: bez dymka, poprawiamy i wysyłamy dalej.
    const doPonowienia = new Set()
    const naBlad = (e) => {
      const pole = e.target
      if (!jestPolemDaty(pole) || !pole.validity?.badInput) return
      e.preventDefault()
      zglosWartosc(pole)
      naprawNiepelne(pole)
      const form = pole.form
      if (!form || doPonowienia.has(form)) return
      doPonowienia.add(form)
      // setTimeout, nie mikrozadanie: przeglądarka jest jeszcze w trakcie poprzedniej próby wysłania.
      setTimeout(() => {
        doPonowienia.delete(form)
        // Inne błędy (np. puste wymagane pole) zostawiamy przeglądarce.
        if (!form.isConnected || ![...form.elements].every(el => !el.willValidate || el.validity.valid)) return
        form.requestSubmit?.()
      })
    }

    // Wartość startowa (np. termin edytowanego zadania) liczy się od pierwszego dotknięcia.
    const naFokus = (e) => zapamietaj(e.target)

    document.addEventListener('focusin', naFokus, true)
    document.addEventListener('input', naWejscie, true)
    document.addEventListener('pointerdown', przedAkcja, true)
    document.addEventListener('keydown', przedAkcja, true)
    document.addEventListener('focusout', poWyjsciu, true)
    document.addEventListener('invalid', naBlad, true)
    return () => {
      document.removeEventListener('focusin', naFokus, true)
      document.removeEventListener('input', naWejscie, true)
      document.removeEventListener('pointerdown', przedAkcja, true)
      document.removeEventListener('keydown', przedAkcja, true)
      document.removeEventListener('focusout', poWyjsciu, true)
      document.removeEventListener('invalid', naBlad, true)
    }
  }, [])
}
