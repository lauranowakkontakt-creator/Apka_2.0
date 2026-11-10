import { useState, useEffect } from 'react'
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc, writeBatch, Timestamp } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { IconClose, IconTrash, IconEdit, IconCheck } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { byRoutineOrder } from '../../utils/habitLogic'
import { bladSubskrypcji } from '../../utils/polaczenie'

// Zarządzanie rutynami (częściami dnia / dowolnymi grupami nawyków).
// Rutyna to prosty dokument { name, order, createdAt } w users/{uid}/habitRoutines.
// Nawyk wskazuje na nią przez pole `routineId`. Rutyny są OPCJONALNE — bez nich
// widok „Dziś" wygląda jak wcześniej.
export default function RoutineManager({ user, onClose }) {
  const [routines, setRoutines] = useState([])
  const [name, setName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'habitRoutines'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setRoutines(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byRoutineOrder)), bladSubskrypcji('habitRoutines'))
  }, [user.uid])

  const add = async () => {
    const n = name.trim()
    if (!n) return
    await addDoc(collection(db, 'users', user.uid, 'habitRoutines'), {
      name: n, order: routines.length, createdAt: Timestamp.now(),
    })
    setName('')
  }

  const saveName = async (id) => {
    const n = editName.trim()
    if (n) await updateDoc(doc(db, 'users', user.uid, 'habitRoutines', id), { name: n })
    setEditId(null); setEditName('')
  }

  const remove = async (r) => {
    const ok = await confirmDialog({
      title: `Usunąć rutynę „${r.name}"?`,
      message: 'Nawyki z tej rutyny zostaną — wrócą do „bez grupy".',
    })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'habitRoutines', r.id))
  }

  // Przesuwa rutynę o jedną pozycję i przepisuje `order` całej listy.
  const move = async (idx, dir) => {
    const next = [...routines]
    const j = idx + dir
    if (j < 0 || j >= next.length) return
    ;[next[idx], next[j]] = [next[j], next[idx]]
    const batch = writeBatch(db)
    next.forEach((r, i) => batch.update(doc(db, 'users', user.uid, 'habitRoutines', r.id), { order: i }))
    await batch.commit()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Rutyny (części dnia)</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            Podziel dzień na części, np. Poranna rutyna, W ciągu dnia, Wieczór. Nawyk przypiszesz do rutyny w jego edycji. Kolejność ustawiasz strzałkami.
          </p>

          {routines.map((r, idx) => editId === r.id ? (
            <div key={r.id} style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" value={editName} autoFocus maxLength={30}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(r.id); if (e.key === 'Escape') { e.stopPropagation(); setEditId(null); setEditName('') } }}
                style={{ flex: 1, minWidth: 0 }} />
              <button className="btn-save" style={{ width: 'auto', margin: 0, padding: '0 14px' }} onClick={() => saveName(r.id)}><IconCheck size={15} /></button>
            </div>
          ) : (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '9px 12px',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                <button className="t-btn" title="W górę" disabled={idx === 0} onClick={() => move(idx, -1)}
                  style={{ padding: 0, height: 15, opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                <button className="t-btn" title="W dół" disabled={idx === routines.length - 1} onClick={() => move(idx, 1)}
                  style={{ padding: 0, height: 15, opacity: idx === routines.length - 1 ? 0.3 : 1 }}>↓</button>
              </div>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
              <button className="t-btn" onClick={() => { setEditId(r.id); setEditName(r.name) }}><IconEdit size={13} /></button>
              <button className="t-btn delete" onClick={() => remove(r)}><IconTrash size={13} /></button>
            </div>
          ))}

          {routines.length === 0 && (
            <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Brak rutyn. Dodaj pierwszą poniżej — np. „Poranna rutyna".
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input className="form-input" value={name} maxLength={30}
              placeholder="np. Poranna rutyna"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }}
              style={{ flex: 1, minWidth: 0 }} />
            <button className="btn-save" style={{ width: 'auto', margin: 0, padding: '0 16px' }} onClick={add}>Dodaj</button>
          </div>
        </div>
      </div>
    </div>
  )
}
