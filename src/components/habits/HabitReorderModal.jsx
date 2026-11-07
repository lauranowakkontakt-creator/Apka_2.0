import { useState } from 'react'
import { doc, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'
import SegTabs from '../SegTabs'
import { CatIcon, IconClose, IconReorder } from '../Icons'
import { useDragReorder, DragHandle } from '../DragReorder'
import { przenies } from '../../utils/dragReorder'
import { byHabitOrder, isRequiredHabit, isOptionalHabit, habitOrderUpdates } from '../../utils/habitLogic'

// Ustawianie kolejności, w jakiej nawyki mają się pojawiać (przeciąganie za uchwyt).
// Zapisuje pole `order` = pozycja na liście dla wszystkich nawyków jednym batchem.
export default function HabitReorderModal({ user, habits, onClose, startTab = 'required' }) {
  // Nawyki i wyzwania ustawia się OSOBNO: na ekranach też są rozdzielone, więc
  // jedna wspólna lista kazała przeplatać rzeczy, których nigdy nie widać obok
  // siebie. Kolejność zapisujemy dalej jednym ciągiem `order` (nawyki, potem
  // wyzwania) — każda grupa i tak sortuje się tylko wewnątrz siebie.
  const [grupy, setGrupy] = useState(() => ({
    required: [...habits].filter(isRequiredHabit).sort(byHabitOrder),
    optional: [...habits].filter(isOptionalHabit).sort(byHabitOrder),
  }))
  const [tab, setTab] = useState(startTab)
  const [saving, setSaving] = useState(false)

  const maWyzwania = grupy.optional.length > 0
  const list = maWyzwania ? grupy[tab] : grupy.required

  const drag = useDragReorder(list.length, (from, to) => {
    const klucz = maWyzwania ? tab : 'required'
    setGrupy(prev => ({ ...prev, [klucz]: przenies(prev[klucz], from, to) }))
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      const batch = writeBatch(db)
      // Zapisujemy OBIE grupy, nie tylko otwartą zakładkę — inaczej przestawienie
      // wyzwań przepadałoby po przejściu na nawyki.
      for (const { id, order } of habitOrderUpdates(grupy.required, grupy.optional)) {
        batch.update(doc(db, 'users', user.uid, 'habits', id), { order })
      }
      await batch.commit()
      onClose()
    } catch { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconReorder size={16} /> Kolejność nawyków</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <div className="form">
          <p className="pause-info">Przeciągnij nawyk za uchwyt po prawej, żeby ustawić kolejność — tak będą pokazywane na liście „Dziś", w tygodniu i statystykach.</p>

          {maWyzwania && (
            <SegTabs
              items={[
                { id: 'required', label: `Nawyki (${grupy.required.length})` },
                { id: 'optional', label: `Wyzwania (${grupy.optional.length})` },
              ]}
              active={tab} onChange={setTab} style={{ marginBottom: 12 }}
            />
          )}

          {list.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {maWyzwania && tab === 'optional' ? 'Brak wyzwań do uporządkowania.' : 'Brak nawyków do uporządkowania.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {list.map((h, i) => {
                const color = h.color || 'var(--accent)'
                return (
                  <div key={h.id} {...drag.wiersz(i, { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', borderRadius: 10, padding: '8px 10px' })}>
                    <span className="mono" style={{ width: 18, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: color + '1c', border: `1px solid ${color}40`, color }}>
                      <CatIcon categoryId={null} emoji={h.emoji} size={15} />
                    </div>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</span>
                    <DragHandle {...drag.uchwyt(i)} />
                  </div>
                )
              })}
            </div>
          )}

          <button className="btn-save" onClick={handleSave} disabled={saving || grupy.required.length + grupy.optional.length === 0} style={{ marginTop: 12 }}>
            {saving ? 'Zapisywanie...' : 'Zapisz kolejność'}
          </button>
        </div>
      </div>
    </div>
  )
}
