import { useEffect, useRef } from 'react'
import { zamknijWierzchniaWarstwe } from './warstwy'

// Esc i systemowy przycisk „wstecz" zamykają to, co jest na wierzchu.
//
//  - Esc (komputer): zamyka otwarte okno, szufladę ustawień albo „Więcej".
//  - „Wstecz" (Android, gest w przeglądarce): najpierw zamyka otwarte okno,
//    potem wraca z modułu na Pulpit, a dopiero z Pulpitu wychodzi z apki.
//    Bez tego „wstecz" przy otwartym formularzu zamykało całą aplikację
//    i wpisywany tekst przepadał.
//
// Jak to działa: w historii przeglądarki trzymamy jeden dodatkowy wpis
// („pułapkę"). „Wstecz" zdejmuje go zamiast wychodzić z apki; jeśli było co
// zamknąć albo skąd wracać, wpis odkładamy z powrotem. Na Pulpicie bez
// otwartych okien nie odkładamy — kolejne „wstecz" normalnie zamyka apkę.
export function useZamykanieWstecz({ wlaczone, naPulpicie, wrocNaPulpit }) {
  const stan = useRef({ naPulpicie, wrocNaPulpit })
  stan.current = { naPulpicie, wrocNaPulpit }

  useEffect(() => {
    if (!wlaczone) return

    const uzbroj = () => {
      try {
        if (!window.history.state?.mwPulapka) window.history.pushState({ mwPulapka: true }, '')
      } catch { /* historia niedostępna (np. podgląd w ramce) — trudno */ }
    }

    const przyEsc = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      zamknijWierzchniaWarstwe(document)
    }

    const przyWstecz = () => {
      if (zamknijWierzchniaWarstwe(document)) { uzbroj(); return }
      if (!stan.current.naPulpicie) { stan.current.wrocNaPulpit(); uzbroj() }
      // Pulpit i nic otwartego: zostajemy bez pułapki — następne „wstecz" wychodzi.
    }

    uzbroj()
    window.addEventListener('keydown', przyEsc)
    window.addEventListener('popstate', przyWstecz)
    // Po „wstecz" na Pulpicie pułapki nie ma; pierwsze dotknięcie ją odkłada.
    window.addEventListener('pointerdown', uzbroj, { passive: true })
    return () => {
      window.removeEventListener('keydown', przyEsc)
      window.removeEventListener('popstate', przyWstecz)
      window.removeEventListener('pointerdown', uzbroj)
    }
  }, [wlaczone])
}
