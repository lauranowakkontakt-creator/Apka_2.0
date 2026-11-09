import { useSyncExternalStore } from 'react'

// Aktualne ikony kategorii z „Zarządzaj kategoriami" (id → klucz ikony).
// Transakcje zapisują ikonę w chwili dodania, więc po zmianie ikony kategorii
// stare wpisy pokazywałyby starą. CatIcon sprawdza najpierw tę mapę.
let ikony = {}
const sluchacze = new Set()

export function ustawIkonyKategorii(settings) {
  const next = {}
  ;[...(settings?.expense || []), ...(settings?.income || [])].forEach(c => { if (c?.id && c.icon) next[c.id] = c.icon })
  const same = Object.keys(next).length === Object.keys(ikony).length && Object.keys(next).every(k => ikony[k] === next[k])
  if (same) return
  ikony = next
  sluchacze.forEach(f => f())
}

export const ikonaKategorii = (id) => (id ? ikony[id] : undefined)

/** Re-render komponentu przy zmianie ikon kategorii. */
export function useIkonyKategorii() {
  return useSyncExternalStore(
    (f) => { sluchacze.add(f); return () => sluchacze.delete(f) },
    () => ikony,
  )
}
