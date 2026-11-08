import { useRef, useState } from 'react'
import { docelowyIndeks, krok, przesuniecie } from '../utils/dragReorder'

// Przeciąganie wierszy listy za uchwyt — palcem albo myszą.
//
//   const drag = useDragReorder(list.length, (from, to) => setList(przenies(list, from, to)))
//   list.map((x, i) => (
//     <div key={x.id} {...drag.wiersz(i)}>
//       <DragHandle {...drag.uchwyt(i)} /> …
//     </div>
//   ))
//
// Na czas przeciągania chwycony wiersz jedzie za palcem, a sąsiedzi robią mu
// miejsce. Zmiana kolejności trafia do `onMove` dopiero po puszczeniu, więc
// zapis do bazy jest jeden, a nie przy każdym mijanym wierszu. Uchwyt ma też
// obsługę klawiatury: strzałka w górę/w dół przesuwa o jedną pozycję.
export function useDragReorder(count, onMove) {
  const rows = useRef([])
  const start = useRef(null)
  const [drag, setDrag] = useState(null) // { from, to, dy, h }

  const koniec = () => {
    const d = start.current
    start.current = null
    setDrag(null)
    if (d && d.to !== d.from) onMove(d.from, d.to)
  }

  const uchwyt = (i) => ({
    onPointerDown: (e) => {
      if (e.button !== undefined && e.button !== 0) return
      e.preventDefault()
      const rects = rows.current.slice(0, count).map(el => {
        const r = el?.getBoundingClientRect()
        return r ? { top: r.top, height: r.height } : { top: 0, height: 0 }
      })
      start.current = { from: i, to: i, y: e.clientY, rects, h: krok(rects, i) }
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* starsze przeglądarki */ }
      setDrag({ from: i, to: i, dy: 0, h: start.current.h })
    },
    onPointerMove: (e) => {
      const s = start.current
      if (!s) return
      const dy = e.clientY - s.y
      s.to = docelowyIndeks(s.rects, s.from, dy)
      setDrag({ from: s.from, to: s.to, dy, h: s.h })
    },
    onPointerUp: koniec,
    onPointerCancel: koniec,
    onKeyDown: (e) => {
      if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); onMove(i, i - 1) }
      if (e.key === 'ArrowDown' && i < count - 1) { e.preventDefault(); onMove(i, i + 1) }
    },
  })

  const wiersz = (i, style) => {
    const aktywny = drag && drag.from === i
    const dy = !drag ? 0 : aktywny ? drag.dy : przesuniecie(i, drag.from, drag.to, drag.h)
    return {
      ref: (el) => { rows.current[i] = el },
      style: {
        ...style,
        transform: dy ? `translateY(${dy}px)` : undefined,
        transition: aktywny || !drag ? 'none' : 'transform .18s ease',
        position: aktywny ? 'relative' : style?.position,
        zIndex: aktywny ? 5 : style?.zIndex,
        boxShadow: aktywny ? '0 8px 22px rgba(0,0,0,.35)' : style?.boxShadow,
      },
    }
  }

  return { uchwyt, wiersz, przeciaga: !!drag }
}

export function DragHandle({ disabled, title = 'Przeciągnij, żeby zmienić kolejność', ...props }) {
  return (
    <button type="button" className="drag-handle" title={title} aria-label={title}
      disabled={disabled} {...(disabled ? {} : props)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
        <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
        <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
      </svg>
    </button>
  )
}
