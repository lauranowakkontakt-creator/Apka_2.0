import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { onSnapshot } from './subskrypcje'
import { bladSubskrypcji } from './polaczenie'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from './categories'

// Kolory kategorii ustawione w „Zarządzaj kategoriami" (a dla nieruszonych —
// domyślne), do użycia na wykresach. Zwraca `kolorKategorii(categoryId, nazwa, i)`:
// najpierw po id, potem po nazwie kategorii, a gdy nic nie pasuje — kolor
// zapasowy z palety (wg miejsca na liście).
export const KOLORY_ZAPASOWE = ['#E0673E', '#7C8AF0', '#5FBF98', '#E0B15A', '#5BB6D9', '#C47BD9', '#D98B5F', '#8FB34F', '#E07A9B', '#9AA3B8']

export function budujMapyKolorow(wlasne) {
  const poId = {}, poNazwie = {}
  const dodaj = (c) => {
    if (!c?.color) return
    if (c.id) poId[c.id] = c.color
    if (c.label) poNazwie[c.label.trim().toLowerCase()] = c.color
  }
  ;[...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].forEach(dodaj)
  ;[...(wlasne?.expense || []), ...(wlasne?.income || [])].forEach(dodaj)
  return { poId, poNazwie }
}

export function useCategoryColors(uid) {
  const [wlasne, setWlasne] = useState(null)
  useEffect(() => {
    if (!uid) return undefined
    return onSnapshot(doc(db, 'users', uid, 'settings', 'categories'),
      d => setWlasne(d.exists() ? d.data() : {}),
      bladSubskrypcji('settings/categories', { przyBledzie: () => setWlasne({}) }))
  }, [uid])
  const mapy = useMemo(() => budujMapyKolorow(wlasne), [wlasne])
  return useCallback((categoryId, nazwa, i = 0) =>
    (categoryId && mapy.poId[categoryId]) ||
    (nazwa && mapy.poNazwie[String(nazwa).trim().toLowerCase()]) ||
    KOLORY_ZAPASOWE[i % KOLORY_ZAPASOWE.length], [mapy])
}
