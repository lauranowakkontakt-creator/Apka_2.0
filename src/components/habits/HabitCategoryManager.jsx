import { useState, useEffect } from 'react'
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { CatIcon, IconClose, IconTrash, IconEdit, IconTag } from '../Icons'
import { IconPicker, ColorPicker } from '../Pickers'
import { DEFAULT_COLOR } from '../../utils/palette'
import { confirmDialog } from '../ConfirmModal'
import { bladSubskrypcji } from '../../utils/polaczenie'

export default function HabitCategoryManager({ user, onClose }) {
  const [cats, setCats] = useState([])
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'habitCategories'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setCats(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('habitCategories'))
  }, [user.uid])

  const remove = async (c) => {
    const ok = await confirmDialog({
      title: `Usunąć kategorię „${c.name}"?`,
      message: 'Nawyki w tej kategorii zostaną, ale stracą przypisanie.',
    })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'habitCategories', c.id))
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3><IconTag size={17} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Kategorie nawyków</h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            Twoje własne kategorie (oprócz wbudowanych: Zdrowie, Duchowość, Nauka, Sport, Praca, Inne).
          </p>

          {cats.map(c => editId === c.id ? (
            <CatForm key={c.id} user={user} initial={c} onDone={() => setEditId(null)} />
          ) : (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${c.color || '#64748B'}`, borderRadius: 10, padding: '9px 12px',
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: (c.color || '#64748B') + '22', color: c.color || '#64748B', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <CatIcon categoryId={null} emoji={c.icon || 'IcTag'} size={17} />
              </div>
              <span style={{ flex: 1, fontSize: 14 }}>{c.name}</span>
              <button aria-label="Edytuj" className="t-btn" onClick={() => setEditId(c.id)}><IconEdit size={13} /></button>
              <button aria-label="Usuń" className="t-btn delete" onClick={() => remove(c)}><IconTrash size={13} /></button>
            </div>
          ))}

          {cats.length === 0 && !adding && (
            <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Brak własnych kategorii.</p>
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
  const [name, setName]   = useState(initial?.name || '')
  const [color, setColor] = useState(initial?.color || DEFAULT_COLOR)
  const [icon, setIcon]   = useState(initial?.icon || 'IcTag')
  const [err, setErr] = useState('')

  const save = async () => {
    if (!name.trim()) { setErr('Wpisz nazwę'); return }
    const data = { name: name.trim(), color, icon }
    if (isNew) await addDoc(collection(db, 'users', user.uid, 'habitCategories'), { ...data, createdAt: Timestamp.now() })
    else await updateDoc(doc(db, 'users', user.uid, 'habitCategories', initial.id), data)
    onDone()
  }

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{isNew ? 'Nowa kategoria' : 'Edytuj kategorię'}</p>
      <div className="form-group" style={{ margin: 0 }}>
        <label>Nazwa</label>
        <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)}
          placeholder="np. Finanse, Relacje..." maxLength={30} autoFocus />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label>Ikona</label>
        <IconPicker value={icon} onChange={setIcon} color={color} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label>Kolor</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      {err && <p className="form-error" style={{ margin: 0 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-save" style={{ flex: 1, margin: 0 }} onClick={save}>{isNew ? 'Dodaj' : 'Zapisz'}</button>
        <button type="button" onClick={onDone} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--r-sm)', padding: 12, cursor: 'pointer', fontSize: 14 }}>Anuluj</button>
      </div>
    </div>
  )
}
