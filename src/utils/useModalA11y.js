import { useEffect } from 'react'

// Dostępność okien (modali) w jednym miejscu.
//
// W apce jest kilkadziesiąt okien zbudowanych tak samo: `.modal-overlay`
// z `.modal` w środku. Żadne nie mówiło czytnikowi ekranu, że jest oknem,
// nie zamykało się klawiszem Escape i nie pilnowało, żeby Tab nie uciekał
// pod spód. Zamiast poprawiać każde osobno, ten hook (włączony raz w App)
// patrzy, kiedy okno pojawia się na stronie, i dokłada mu:
//  - role="dialog" + aria-modal + nazwę wziętą z nagłówka okna,
//  - fokus w oknie po otwarciu i powrót fokusu po zamknięciu,
//  - Tab krążący tylko po oknie,
//  - Escape = przycisk zamknięcia (`.modal-close`).
//
// Okno z własną obsługą Escape oznacza się atrybutem `data-own-esc`.

const FOKUSOWALNE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Okno na wierzchu: najwyższy z-index, przy remisie — późniejsze w dokumencie. */
export function oknoNaWierzchu(doc = document) {
  let top = null, topZ = -Infinity
  for (const o of doc.querySelectorAll('.modal-overlay')) {
    const z = Number(getComputedStyle(o).zIndex) || 0
    if (z >= topZ) { top = o; topZ = z }
  }
  return top
}

const widoczne = (el) => el.getClientRects().length > 0

let licznik = 0

function opisz(overlay) {
  const okno = overlay.querySelector('.modal') || overlay
  if (okno.getAttribute('role')) return okno
  okno.setAttribute('role', 'dialog')
  okno.setAttribute('aria-modal', 'true')
  if (!okno.hasAttribute('tabindex')) okno.setAttribute('tabindex', '-1')
  const tytul = okno.querySelector('.modal-header h3, .modal-header h2, h2, h3')
  if (tytul && !okno.hasAttribute('aria-label') && !okno.hasAttribute('aria-labelledby')) {
    if (!tytul.id) tytul.id = `okno-tytul-${++licznik}`
    okno.setAttribute('aria-labelledby', tytul.id)
  }
  return okno
}

export function useModalA11y() {
  useEffect(() => {
    // overlay -> element, który miał fokus przed otwarciem
    const powroty = new Map()

    const przejrzyj = () => {
      const otwarte = new Set(document.querySelectorAll('.modal-overlay'))
      for (const o of otwarte) {
        if (powroty.has(o)) continue
        powroty.set(o, document.activeElement)
        const okno = opisz(o)
        // Pole z autoFocus dostaje fokus samo — nie zabieramy mu go.
        // Fokus na samo okno (nie na pierwsze pole), żeby na telefonie nie
        // wyskakiwała klawiatura tam, gdzie formularz jej nie chciał.
        requestAnimationFrame(() => {
          if (o.isConnected && !o.contains(document.activeElement)) okno.focus({ preventScroll: true })
        })
      }
      for (const [o, wroc] of powroty) {
        if (otwarte.has(o)) continue
        powroty.delete(o)
        const wOknie = oknoNaWierzchu()
        const zgubiony = !document.activeElement || document.activeElement === document.body
        if (zgubiony && wroc?.isConnected && (!wOknie || wOknie.contains(wroc))) wroc.focus({ preventScroll: true })
      }
    }

    const naKlawisz = (e) => {
      if (e.key !== 'Escape' && e.key !== 'Tab') return
      const o = oknoNaWierzchu()
      if (!o) return
      if (e.key === 'Escape') {
        if (e.defaultPrevented || o.hasAttribute('data-own-esc') || o.querySelector('[data-own-esc]')) return
        // Rozwinięta lista wyboru albo pole daty: Escape zamyka najpierw je.
        const a = document.activeElement
        if (a && o.contains(a) && a.matches('select, input[type="date"], input[type="time"], input[type="month"], input[type="datetime-local"]')) return
        const zamknij = o.querySelector('.modal-close')
        if (zamknij) { e.preventDefault(); zamknij.click() }
        return
      }
      const lista = [...o.querySelectorAll(FOKUSOWALNE)].filter(widoczne)
      if (!lista.length) { e.preventDefault(); return }
      const pierwszy = lista[0], ostatni = lista[lista.length - 1]
      const a = document.activeElement
      if (!o.contains(a)) { e.preventDefault(); pierwszy.focus() }
      else if (e.shiftKey && (a === pierwszy || !lista.includes(a))) { e.preventDefault(); ostatni.focus() }
      else if (!e.shiftKey && a === ostatni) { e.preventDefault(); pierwszy.focus() }
    }

    const obserwator = new MutationObserver(przejrzyj)
    obserwator.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('keydown', naKlawisz)
    przejrzyj()
    return () => { obserwator.disconnect(); window.removeEventListener('keydown', naKlawisz) }
  }, [])
}
