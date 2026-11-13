import { useState, useEffect } from 'react'
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { DREAM_CATEGORIES } from '../../utils/dreams'
import { IconTrash, IconEdit } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { ColorPicker } from '../Pickers'
import { APP_COLORS } from '../../utils/palette'
import { toast } from '../Toast'
import { bladSubskrypcji } from '../../utils/polaczenie'

export default function DreamCategoryManager({ user }) {
  const [cats, setCats] = useState([])
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'dreamCategories'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setCats(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('dreamCategories'))
  }, [user.uid])

  const remove = async (c) => {
    const ok = await confirmDialog({
      title: `Usunąć kategorię „${c.label}"?`,
      message: 'Sny z tej kategorii zostaną, ale stracą przypisanie.',
    })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'dreamCategories', c.id))
      .catch(() => toast.error('Nie udało się usunąć'))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.15em' }}>
          Wbudowane
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {DREAM_CATEGORIES.map(c => (
            <span key={c.id} style={{
              fontSize: 12, padding: '4px 10px', borderRadius: 999,
              background: c.color + '22', color: c.color, border: `1px solid ${c.color}44`,
            }}>{c.label}</span>
          ))}
        </div>
      </div>

      <div>
        <p style={{ margin: '4px 0 8px', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.15em' }}>
          Twoje
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cats.map(c => editId === c.id ? (
            <CatForm key={c.id} user={user} initial={c} onDone={() => setEditId(null)} />
          ) : (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${c.color || '#9E9E9E'}`, borderRadius: 10, padding: '9px 12px',
            }}>
              <span style={{
                width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                background: c.color || '#9E9E9E',
              }} />
              <span style={{ flex: 1, fontSize: 14, minWidth: 0, wordBreak: 'break-word' }}>{c.label}</span>
              <button aria-label="Edytuj" className="t-btn" onClick={() => setEditId(c.id)}><IconEdit size={13} /></button>
              <button aria-label="Usuń" className="t-btn delete" onClick={() => remove(c)}><IconTrash size={13} /></button>
            </div>
          ))}

          {cats.length === 0 && !adding && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Brak własnych kategorii.
            </p>
          )}

          {adding ? (
            <CatForm user={user} onDone={() => setAdding(false)} isNew />
          ) : (
            <button className="btn-add-account" onClick={() => setAdding(true)}>+ Nowa kategoria</button>
          )}
        </div>
      </div>
    </div>
  )
}

function CatForm({ user, initial, onDone, isNew }) {
  const [label, setLabel] = useState(initial?.label || '')
  const [color, setColor] = useState(initial?.color || APP_COLORS[48])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    const name = label.trim()
    if (!name) { setErr('Wpisz nazwę'); return }
    setSaving(true)
    try {
      const data = { label: name, color }
      if (isNew) await addDoc(collection(db, 'users', user.uid, 'dreamCategories'), { ...data, createdAt: Timestamp.now() })
      else await updateDoc(doc(db, 'users', user.uid, 'dreamCategories', initial.id), data)
      onDone()
    } catch {
      setErr('Nie udało się zapisać'); setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{isNew ? 'Nowa kategoria' : 'Edytuj kategorię'}</p>
      <div className="form-group" style={{ margin: 0 }}>
        <label>Nazwa</label>
        <input type="text" className="form-input" value={label} autoFocus maxLength={30}
          onChange={e => setLabel(e.target.value)} placeholder="np. Podróżny, O pracy..."
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save() } }} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label>Kolor</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      {err && <p className="form-error" style={{ margin: 0 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-save" style={{ flex: 1, margin: 0 }} onClick={save} disabled={saving}>
          {saving ? 'Zapisywanie...' : isNew ? 'Dodaj' : 'Zapisz'}
        </button>
        <button type="button" onClick={onDone} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--r-sm)', padding: 12, cursor: 'pointer', fontSize: 14 }}>
          Anuluj
        </button>
      </div>
    </div>
  )
}
