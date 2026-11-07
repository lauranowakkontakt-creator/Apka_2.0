import { useState } from 'react'
import { doc, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { IconClose, IconReorder, IconBank, IconCash, IconCard, IconSavings } from '../Icons'
import { useDragReorder, DragHandle } from '../DragReorder'
import { przenies } from '../../utils/dragReorder'
import { byAccountOrder } from '../../utils/accountOrder'

const ACCOUNT_ICON_COMPS = {
  bank: IconBank, cash: IconCash, card: IconCard,
  revolut: IconCard, savings: IconSavings, investment: IconSavings
}

// Ustawianie kolejności, w jakiej konta mają się pojawiać (przeciąganie za uchwyt).
// Zapisuje pole `order` = pozycja na liście dla wszystkich kont jednym batchem.
export default function AccountReorderModal({ user, accounts, onClose }) {
  const [list, setList] = useState(() => [...accounts].sort(byAccountOrder))
  const [saving, setSaving] = useState(false)

  const drag = useDragReorder(list.length, (from, to) => setList(prev => przenies(prev, from, to)))

  const handleSave = async () => {
    setSaving(true)
    try {
      const batch = writeBatch(db)
      list.forEach((a, i) => batch.update(doc(db, 'users', user.uid, 'accounts', a.id), { order: i }))
      await batch.commit()
      onClose()
    } catch { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconReorder size={16} /> Kolejność kont</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <div className="form">
          <p className="pause-info">Przeciągnij konto za uchwyt po prawej, żeby ustawić kolejność.</p>

          {list.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Brak kont do uporządkowania.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {list.map((a, i) => {
                const color = a.color || '#3B82F6'
                const Ic = ACCOUNT_ICON_COMPS[a.type] || IconBank
                return (
                  <div key={a.id} {...drag.wiersz(i, { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', borderRadius: 10, padding: '8px 10px' })}>
                    <span className="mono" style={{ width: 18, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: color + '1c', border: `1px solid ${color}40`, color }}>
                      <Ic size={15} />
                    </div>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                    <DragHandle {...drag.uchwyt(i)} />
                  </div>
                )
              })}
            </div>
          )}

          <button className="btn-save" onClick={handleSave} disabled={saving || list.length === 0} style={{ marginTop: 12 }}>
            {saving ? 'Zapisywanie...' : 'Zapisz kolejność'}
          </button>
        </div>
      </div>
    </div>
  )
}
