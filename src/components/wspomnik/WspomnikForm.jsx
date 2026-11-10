import { useState } from 'react'
import { collection, doc, Timestamp } from 'firebase/firestore'
import { addDoc, updateDoc } from '../../utils/zapis'
import { db } from '../../firebase/config'
import { format } from 'date-fns'
import { CATEGORIES, buildEntry } from '../../utils/wspomnikLogic'
import { IconClose } from '../Icons'
import { toast } from '../Toast'

// Formularz wspomnienia — w module Wspomnik i z Modlitwy, gdy prośba została
// wysłuchana (wtedy `prefill` niesie gotowy szkic, a `onSaved` dostaje id wpisu).

const TODAY = () => format(new Date(), 'yyyy-MM-dd')

export default function WspomnikForm({ user, editData, prefill, onClose, onSaved }) {
  const start = editData || prefill || {}
  const [title, setTitle]       = useState(start.title || '')
  const [text, setText]         = useState(start.text || '')
  const [date, setDate]         = useState(start.date || TODAY())
  const [category, setCategory] = useState(start.category || null)
  const [verse, setVerse]       = useState(start.verse || '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e) => {
    e?.preventDefault()
    const data = buildEntry({ title, text, date, category, verse })
    if (!data) { setError('Napisz krótko, co Bóg zrobił'); return }
    if (!data.date) { setError('Wybierz datę'); return }
    setSaving(true)
    try {
      if (editData) {
        await updateDoc(doc(db, 'users', user.uid, 'remembrances', editData.id), { ...data, updatedAt: Timestamp.now() })
      } else {
        const ref = await addDoc(collection(db, 'users', user.uid, 'remembrances'), {
          ...data, ...(prefill?.intentionId ? { intentionId: prefill.intentionId } : {}), createdAt: Timestamp.now(),
        })
        // Wpis już jest — błąd przy podpinaniu go do prośby nie może udawać,
        // że wspomnienie się nie zapisało.
        try { await onSaved?.(ref.id) } catch { /* zostaje samo wspomnienie */ }
        toast.success('Zapisane we Wspomniku')
      }
      onClose()
    } catch {
      setError('Nie udało się zapisać')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{editData ? 'Edytuj wspomnienie' : prefill ? 'Zapisz we Wspomniku' : 'Co Bóg zrobił?'}</h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>W skrócie</label>
            <input type="text" className="form-input" autoFocus value={title}
              onChange={e => setTitle(e.target.value)} maxLength={150}
              placeholder="np. Dostałam pracę, o którą się modliłam" />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Cała historia (opcjonalnie)</label>
            <textarea className="form-input" rows={5} value={text}
              onChange={e => setText(e.target.value)} maxLength={5000}
              placeholder="Jak to było? Co się działo wcześniej, jak Bóg zadziałał..."
              style={{ resize: 'vertical', minHeight: 110, fontFamily: 'inherit', lineHeight: 1.55 }} />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Kiedy</label>
            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Rodzaj (opcjonalnie)</label>
            <div className="wsp-filters">
              {CATEGORIES.map(c => (
                <button key={c.id} type="button" className={`chip${category === c.id ? ' active' : ''}`}
                  onClick={() => setCategory(category === c.id ? null : c.id)}>{c.label}</button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Słowo, werset (opcjonalnie)</label>
            <input type="text" className="form-input" value={verse}
              onChange={e => setVerse(e.target.value)} maxLength={300}
              placeholder="np. Flp 4,19 — Bóg mój zaspokoi każdą waszą potrzebę" />
          </div>

          {error && <p className="form-error" style={{ margin: 0 }}>{error}</p>}

          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz' : 'Zapisz wspomnienie'}
          </button>
        </form>
      </div>
    </div>
  )
}

