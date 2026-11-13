import { db } from '../../firebase/config'
import { RECUR_LABEL } from '../../utils/calendarRecurrence'
import { PRIORITY, RECURRENCE } from '../../utils/todoLogic'
import { CatIcon, IconCheck, IconClose, IconPlus, IconTrash } from '../Icons'
import PersonBubble from '../PersonBubble'
import { Timestamp, addDoc, collection, doc, updateDoc } from 'firebase/firestore'
import { useState } from 'react'

// Formularz zadania: dodawanie i edycja, z podzadaniami i cyklicznością.

export default function TodoForm({ user, lists, people = [], editData, defaultListId, defaultDueDate, onClose }) {
  const [title, setTitle]       = useState(editData?.title || '')
  const [note, setNote]         = useState(editData?.note || '')
  const [listId, setListId]     = useState(editData?.listId || defaultListId || '')
  const [priority, setPriority] = useState(editData?.priority || 'medium')
  const [dueDate, setDueDate]   = useState(editData?.dueDate || defaultDueDate || '')
  const [recurrence, setRecurrence] = useState(editData?.recurrence || '')
  const [subtasks, setSubtasks] = useState(editData?.subtasks || [])
  const [peopleIds, setPeopleIds] = useState(editData?.peopleIds || [])
  const [subInput, setSubInput] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const togglePerson = (id) => setPeopleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const addSub = () => {
    const t = subInput.trim()
    if (!t) return
    setSubtasks(prev => [...prev, { id: Date.now().toString(36), title: t, done: false }])
    setSubInput('')
  }
  const removeSub = (id) => setSubtasks(prev => prev.filter(s => s.id !== id))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) { setError('Wpisz tytuł zadania'); return }
    setSaving(true)
    const data = {
      title: title.trim(), note: note.trim(),
      listId: listId || null, priority,
      dueDate: dueDate || null,
      recurrence: recurrence || null,
      subtasks,
      peopleIds,
      done: editData?.done ?? false,
      updatedAt: Timestamp.now()
    }
    try {
      if (editData) {
        await updateDoc(doc(db, 'users', user.uid, 'todos', editData.id), data)
      } else {
        await addDoc(collection(db, 'users', user.uid, 'todos'), { ...data, createdAt: Timestamp.now(), doneAt: null })
      }
      onClose()
    } catch { setError('Błąd zapisu'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{editData ? 'Edytuj zadanie' : 'Nowe zadanie'}</h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label>Zadanie</label>
            <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)}
              maxLength={100} placeholder="Co trzeba zrobić?" />
          </div>
          <div className="form-group">
            <label>Notatka (opcjonalnie)</label>
            <input type="text" className="form-input" value={note} onChange={e => setNote(e.target.value)}
              maxLength={200} placeholder="Dodatkowe szczegóły..." />
          </div>
          <div className="form-group">
            <label>Priorytet</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PRIORITY.map(p => (
                <button key={p.id} type="button" onClick={() => setPriority(p.id)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: priority === p.id ? 700 : 400,
                  border: `2px solid ${priority === p.id ? p.color : 'var(--border)'}`,
                  background: priority === p.id ? p.color + '22' : 'transparent',
                  color: priority === p.id ? p.color : 'var(--text-muted)'
                }}>{p.label}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Termin (opcjonalnie)</label>
            <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Powtarzanie</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {RECURRENCE.map(r => (
                <button key={r.id} type="button" onClick={() => setRecurrence(r.id)} style={{
                  flex: '1 1 auto', minWidth: 70, padding: '8px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  fontWeight: recurrence === r.id ? 700 : 400,
                  border: `1px solid ${recurrence === r.id ? 'var(--sky)' : 'var(--border)'}`,
                  background: recurrence === r.id ? 'var(--sky)22' : 'transparent',
                  color: recurrence === r.id ? 'var(--sky)' : 'var(--text-muted)',
                }}>{r.label}</button>
              ))}
            </div>
            {recurrence && <p style={{ margin: '6px 2px 0', fontSize: 11, color: 'var(--text-muted)' }}>Po odhaczeniu zadanie wróci z kolejnym terminem ({RECUR_LABEL[recurrence]}).</p>}
          </div>

          <div className="form-group">
            <label>Podzadania (opcjonalnie)</label>
            {subtasks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {subtasks.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', borderRadius: 8, padding: '7px 10px' }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{s.title}</span>
                    <button aria-label="Usuń" type="button" className="t-btn delete" onClick={() => removeSub(s.id)}><IconTrash size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" className="form-input" value={subInput} onChange={e => setSubInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSub() } }}
                placeholder="Dodaj krok..." maxLength={100} style={{ flex: 1, margin: 0 }} />
              <button aria-label="Dodaj" type="button" className="btn-save" style={{ width: 'auto', margin: 0, padding: '0 14px' }} onClick={addSub}><IconPlus size={16} /></button>
            </div>
          </div>

          {people.length > 0 && (
            <div className="form-group">
              <label>Osoby, których dotyczy (opcjonalnie)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {people.map(p => {
                  const on = peopleIds.includes(p.id)
                  return (
                    <button type="button" key={p.id} onClick={() => togglePerson(p.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px 5px 5px', borderRadius: 999,
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                      border: `1px solid ${on ? (p.color || 'var(--accent)') : 'var(--border)'}`,
                      background: on ? (p.color || 'var(--accent)') + '1e' : 'var(--surface2)',
                      color: on ? (p.color || 'var(--accent)') : 'var(--text-sub)',
                    }}>
                      <PersonBubble person={p} size={24} />
                      {p.name}
                      {on && <IconCheck size={13} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {lists.length > 0 && (
            <div className="form-group">
              <label>Lista</label>
              <div className="account-chips">
                <button type="button" className={`account-chip ${!listId ? 'active' : ''}`} onClick={() => setListId('')}>Bez listy</button>
                {lists.map(l => (
                  <button key={l.id} type="button"
                    className={`account-chip ${listId === l.id ? 'active' : ''}`}
                    style={listId === l.id ? { borderColor: l.color, background: l.color + '22' } : {}}
                    onClick={() => setListId(l.id)}><CatIcon categoryId={null} emoji={l.icon} size={13} /> {l.name}</button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz zmiany' : 'Dodaj zadanie'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ─── ListForm (create + edit) ─── */
