import { db } from '../../firebase/config'
import { PERSON_COLORS } from '../../utils/prayerStats'
import { IconClose } from '../Icons'
import { IconPicker, ColorPicker } from '../Pickers'
import { Timestamp, collection, doc } from 'firebase/firestore'
import { addDoc, updateDoc } from '../../utils/zapis'
import { useState } from 'react'

// Formularz osoby: dodawanie i edycja.

export default function PersonForm({ user, editData, onClose }) {
  const [name, setName]         = useState(editData?.name || '')
  const [note, setNote]         = useState(editData?.note || '')
  const [iconKey, setIconKey]   = useState(editData?.icon || 'IcUsers')
  const [color, setColor]       = useState(editData?.color || PERSON_COLORS[Math.floor(Math.random() * PERSON_COLORS.length)])
  const [saving, setSaving]     = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    // Osoba jest współdzielona z Kalendarzem → zapis do `calendarPeople`. Kolor używa Kalendarz, ikona/notatka — Modlitwa.
    const data = { name: name.trim(), note: note.trim(), icon: iconKey, color, updatedAt: Timestamp.now() }
    try {
      if (editData) {
        await updateDoc(doc(db, 'users', user.uid, 'calendarPeople', editData.id), data)
      } else {
        await addDoc(collection(db, 'users', user.uid, 'calendarPeople'), { ...data, createdAt: Timestamp.now() })
      }
      onClose()
    } catch { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{editData ? 'Edytuj osobę' : 'Nowa osoba'}</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label>Imię / nazwa</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)}
              maxLength={60} placeholder="np. Mama, Zuzia, Przyjaciel Paweł..." />
          </div>

          <div className="form-group">
            <label>Ikona</label>
            <IconPicker value={iconKey} onChange={setIconKey} color={color} />
          </div>

          <div className="form-group">
            <label>Notatka (opcjonalnie)</label>
            <input type="text" className="form-input" value={note} onChange={e => setNote(e.target.value)}
              maxLength={200} placeholder="np. Chora na raka, szuka Boga..." />
          </div>

          <div className="form-group">
            <label>Kolor (w Kalendarzu)</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <button type="submit" className="btn-save" disabled={saving || !name.trim()}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz' : 'Dodaj osobę'}
          </button>
        </form>
      </div>
    </div>
  )
}
