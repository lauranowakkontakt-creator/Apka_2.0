import { useState, useEffect } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc, Timestamp, orderBy, query } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { CatIcon, IconClose, IconTrash, IconPause, IconEdit, IconPlus } from '../Icons'
import { ColorPicker } from '../Pickers'
import { pauseReasonMeta, powodyPauz } from '../../utils/habitLogic'
import { bladSubskrypcji } from '../../utils/polaczenie'

// Pauza nawyków: dodawanie, edycja (np. przedłużenie choroby) i własne powody.
// Własne powody leżą w settings/habitPauses, a każda pauza i tak zapisuje
// nazwę, kolor i ikonę powodu — usunięcie powodu z listy nie psuje starych pauz.
export default function PauseForm({ user, onClose }) {
  const dzis = format(new Date(), 'yyyy-MM-dd')
  const [pauses, setPauses] = useState([])
  const [wlasne, setWlasne] = useState([])
  const [from, setFrom]     = useState(dzis)
  const [to, setTo]         = useState(dzis)
  const [reason, setReason] = useState('vacation')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [nowyPowod, setNowyPowod] = useState(null) // { label, color } albo null

  const settingsRef = doc(db, 'users', user.uid, 'settings', 'habitPauses')

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'habitPauses'), orderBy('from', 'desc'))
    return onSnapshot(q, snap => setPauses(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('habitPauses'))
  }, [user.uid])

  useEffect(() => onSnapshot(doc(db, 'users', user.uid, 'settings', 'habitPauses'),
    d => setWlasne(d.exists() ? (d.data().customReasons || []) : []),
    bladSubskrypcji('settings/habitPauses')), [user.uid])

  const powody = powodyPauz(wlasne)
  // Pauza z powodem, którego już nie ma na liście (usunięty własny) — pokazujemy
  // go dalej przy edycji, żeby zapis nie zamienił go po cichu na „Inne".
  const edytowana = editId ? pauses.find(p => p.id === editId) : null
  const wybrany = powody.find(r => r.id === reason) || (edytowana?.reason === reason ? pauseReasonMeta(edytowana) : pauseReasonMeta(reason))

  const resetForm = () => { setEditId(null); setFrom(dzis); setTo(dzis); setReason('vacation') }

  const handleSave = async () => {
    if (from > to) return
    setSaving(true)
    const dane = { from, to, reason: wybrany.id, reasonLabel: wybrany.label, reasonIcon: wybrany.icon, reasonColor: wybrany.color }
    try {
      if (editId) await updateDoc(doc(db, 'users', user.uid, 'habitPauses', editId), dane)
      else await addDoc(collection(db, 'users', user.uid, 'habitPauses'), { ...dane, createdAt: Timestamp.now() })
      resetForm()
    } finally { setSaving(false) }
  }

  const handleEdit = (p) => {
    setEditId(p.id); setFrom(p.from); setTo(p.to); setReason(p.reason || 'other'); setNowyPowod(null)
  }

  const handleDelete = async (id) => {
    if (id === editId) resetForm()
    await deleteDoc(doc(db, 'users', user.uid, 'habitPauses', id))
  }

  const dodajPowod = async () => {
    const label = nowyPowod?.label.trim()
    if (!label) return
    const powod = { id: `wlasny-${Date.now().toString(36)}`, label, color: nowyPowod.color, icon: 'IcPin' }
    await setDoc(settingsRef, { customReasons: [...wlasne, powod] }, { merge: true })
    setReason(powod.id)
    setNowyPowod(null)
  }

  const usunPowod = async (id) => {
    await setDoc(settingsRef, { customReasons: wlasne.filter(r => r.id !== id) }, { merge: true })
    if (reason === id && !editId) setReason('vacation')
  }

  const fmtDate = (d) => {
    try { return format(new Date(d + 'T12:00:00'), 'd MMM yyyy', { locale: pl }) } catch { return d }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconPause size={16} /> Pauza nawyków</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <div className="form">
          <p className="pause-info">W podanym czasie żaden nawyk ani wyzwanie nie jest wymagany — seria nie jest przerywana, ale dni przerwy nie liczą się do streaka. W kalendarzu dni przerwy dostają kolor powodu.</p>

          <div className="form-group">
            <label>Powód</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {powody.map(r => {
                const active = reason === r.id
                const wlasny = wlasne.some(w => w.id === r.id)
                return (
                  <div key={r.id} style={{ position: 'relative', minWidth: 0 }}>
                    <button type="button" onClick={() => setReason(r.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: wlasny ? '10px 28px 10px 12px' : '10px 12px', minWidth: 0,
                        borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, textAlign: 'left', lineHeight: 1.2,
                        background: active ? r.color + '22' : 'var(--surface2)',
                        border: `1.5px solid ${active ? r.color : 'var(--border)'}`,
                        color: active ? r.color : 'var(--text-sub)',
                      }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: r.color, flexShrink: 0 }} />
                      <CatIcon categoryId={null} emoji={r.icon} size={15} />
                      <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{r.label}</span>
                    </button>
                    {wlasny && (
                      <button type="button" title={`Usuń powód „${r.label}"`} aria-label={`Usuń powód ${r.label}`}
                        onClick={() => usunPowod(r.id)}
                        style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 6, border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                        <IconClose size={11} />
                      </button>
                    )}
                  </div>
                )
              })}
              {!nowyPowod && (
                <button type="button" onClick={() => setNowyPowod({ label: '', color: '#0EA5E9' })}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: 'transparent', border: '1.5px dashed var(--border-strong)', color: 'var(--text-muted)' }}>
                  <IconPlus size={14} /> Własny powód
                </button>
              )}
            </div>

            {nowyPowod && (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input type="text" className="form-input" autoFocus maxLength={30} placeholder="np. Egzaminy, Remont, Rekolekcje"
                  value={nowyPowod.label} onChange={e => setNowyPowod(n => ({ ...n, label: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); dodajPowod() } }} />
                <ColorPicker value={nowyPowod.color} onChange={c => setNowyPowod(n => ({ ...n, color: c }))} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={() => setNowyPowod(null)}>Anuluj</button>
                  <button type="button" className="btn-save" style={{ flex: 1, marginTop: 0 }} disabled={!nowyPowod.label.trim()} onClick={dodajPowod}>Dodaj powód</button>
                </div>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Od</label>
              <input type="date" className="form-input" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Do</label>
              <input type="date" className="form-input" value={to} min={from} onChange={e => setTo(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {editId && <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={resetForm}>Anuluj edycję</button>}
            <button className="btn-save" style={{ flex: 2, marginTop: 0 }} onClick={handleSave} disabled={saving || from > to}>
              {saving ? 'Zapisywanie...' : editId ? 'Zapisz zmiany' : 'Dodaj pauzę'}
            </button>
          </div>

          {pauses.length > 0 && (
            <div className="pause-list">
              <p className="pause-list-title">Zapisane pauzy</p>
              {pauses.map(p => {
                const m = pauseReasonMeta(p)
                return (
                  <div key={p.id} className="pause-item" style={p.id === editId ? { borderColor: m.color, background: m.color + '14' } : undefined}>
                    <span className="pause-reason" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: m.color, flexShrink: 0 }} /><CatIcon categoryId={null} emoji={m.icon} size={14} /> {m.label}</span>
                    <span className="pause-dates">{fmtDate(p.from)} – {fmtDate(p.to)}</span>
                    <button className="t-btn" title="Edytuj (np. przedłuż)" onClick={() => handleEdit(p)}><IconEdit size={13} /></button>
                    <button className="t-btn delete" title="Usuń pauzę" onClick={() => handleDelete(p.id)}><IconTrash size={13} /></button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
