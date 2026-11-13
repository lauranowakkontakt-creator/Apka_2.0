import { db } from '../../firebase/config'
import { IconClose } from '../Icons'
import { IconPicker, ColorPicker } from '../Pickers'
import { Timestamp, addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { useState } from 'react'

// Formularz listy zadań.

export default function ListForm({ user, onClose, editData }) {
  const [name, setName]         = useState(editData?.name || '')
  const [iconKey, setIconKey]   = useState(editData?.icon || 'IcBriefcase')
  const [color, setColor]       = useState(editData?.color || '#6366f1')
  const [saving, setSaving]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    if (editData) {
      await updateDoc(doc(db, 'users', user.uid, 'todoLists', editData.id), {
        name: name.trim(), icon: iconKey, color
      })
    } else {
      await addDoc(collection(db, 'users', user.uid, 'todoLists'), {
        name: name.trim(), icon: iconKey, color, createdAt: Timestamp.now()
      })
    }
    onClose()
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    await deleteDoc(doc(db, 'users', user.uid, 'todoLists', editData.id))
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{editData ? 'Edytuj listę' : 'Nowa lista'}</h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label>Nazwa</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)}
              placeholder="np. Praca, Dom, Projekt..." maxLength={30} />
          </div>
          <div className="form-group">
            <label>Ikona</label>
            <IconPicker value={iconKey} onChange={setIconKey} color={color} />
          </div>
          <div className="form-group">
            <label>Kolor</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <button type="submit" className="btn-save" disabled={saving || !name.trim()}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz zmiany' : 'Utwórz listę'}
          </button>
          {editData && (
            <button type="button" onClick={handleDelete} style={{
              width: '100%', padding: 12, borderRadius: 'var(--r)', border: `1px solid ${confirmDelete ? 'var(--expense)' : 'var(--border)'}`,
              background: confirmDelete ? 'var(--expense)22' : 'transparent', color: confirmDelete ? 'var(--expense)' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: 14, marginTop: 4,
            }}>
              {confirmDelete ? 'Kliknij ponownie aby potwierdzić usunięcie' : 'Usuń listę'}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
