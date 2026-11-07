import { db } from '../../firebase/config'
import { confirmDialog } from '../ConfirmModal'
import { CatIcon, IconClose, IconEdit, IconTrash } from '../Icons'
import { IconPicker, ColorPicker } from '../Pickers'
import { DEFAULT_COLOR } from '../../utils/palette'
import { Timestamp, addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { useState } from 'react'

// Zarządzanie kategoriami wydarzeń.

export default function CategoryManager({ user, categories, onClose }) {
  const [editId, setEditId] = useState(null)
  const [icon, setIcon]     = useState('IconCalendar')
  const [label, setLabel]   = useState('')
  const [color, setColor]   = useState(DEFAULT_COLOR)
  const [saving, setSaving] = useState(false)

  const resetForm = () => { setEditId(null); setLabel(''); setIcon('IconCalendar'); setColor(DEFAULT_COLOR) }
  const startEdit = (cat) => { setEditId(cat.id); setLabel(cat.label); setIcon(cat.icon || 'IconCalendar'); setColor(cat.color || DEFAULT_COLOR) }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!label.trim()) return
    setSaving(true)
    if (editId) {
      await updateDoc(doc(db, 'users', user.uid, 'calendarCategories', editId), { label: label.trim(), icon, color })
    } else {
      await addDoc(collection(db, 'users', user.uid, 'calendarCategories'), { label: label.trim(), icon, color, createdAt: Timestamp.now() })
    }
    resetForm(); setSaving(false)
  }

  const handleDelete = async (id) => {
    const ok = await confirmDialog({ title: 'Usunąć kategorię?' })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'calendarCategories', id))
    if (editId === id) resetForm()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Kategorie</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <div className="form">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'min(56vh, 460px)', overflowY: 'auto' }}>
            {categories.map(cat => (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: editId === cat.id ? cat.color + '18' : 'var(--surface2)', borderRadius: 10, border: `1px solid ${editId === cat.id ? cat.color : 'transparent'}` }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: cat.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.color }}>
                  <CatIcon categoryId={null} emoji={cat.icon} size={17} />
                </div>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{cat.label}</span>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                <button className="t-btn" title="Edytuj" onClick={() => startEdit(cat)}><IconEdit size={13} /></button>
                <button className="t-btn delete" title="Usuń" onClick={() => handleDelete(cat.id)}><IconTrash size={13} /></button>
              </div>
            ))}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700 }}>{editId ? 'Edytuj kategorię' : 'Dodaj kategorię'}</p>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Nazwa</label>
              <input type="text" className="form-input" value={label} onChange={e => setLabel(e.target.value)}
                placeholder="np. Wakacje, Projekt..." maxLength={30} />
            </div>
            <div className="form-group">
              <label>Ikona</label>
              <IconPicker key={editId || "nowa"} value={icon} onChange={setIcon} color={color} />
            </div>
            <div className="form-group">
              <label>Kolor</label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn-save" disabled={saving || !label.trim()} style={{ flex: 1 }}>
                {saving ? 'Zapisywanie...' : editId ? 'Zapisz zmiany' : '+ Dodaj kategorię'}
              </button>
              {editId && (
                <button type="button" onClick={resetForm} style={{ padding: '0 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>
                  Anuluj
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
