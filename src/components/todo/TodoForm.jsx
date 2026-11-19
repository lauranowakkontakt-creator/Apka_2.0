import { db } from '../../firebase/config'
import { RECUR_LABEL } from '../../utils/calendarRecurrence'
import { PRIORITY, RECURRENCE, osobyDoWyboru } from '../../utils/todoLogic'
import { CatIcon, IconClose, IconPlus, IconTrash } from '../Icons'
import PersonBubble from '../PersonBubble'
import ListForm from './ListForm'
import { Timestamp, addDoc, collection, doc, updateDoc } from 'firebase/firestore'
import { useMemo, useState } from 'react'

// Formularz zadania: dodawanie i edycja, z podzadaniami i cyklicznością.

export default function TodoForm({ user, lists, people = [], todos = [], editData, defaultListId, defaultDueDate, onClose }) {
  const [title, setTitle]       = useState(editData?.title || '')
  const [note, setNote]         = useState(editData?.note || '')
  const [listId, setListId]     = useState(editData?.listId || defaultListId || '')
  const [priority, setPriority] = useState(editData?.priority || 'medium')
  const [dueDate, setDueDate]   = useState(editData?.dueDate || defaultDueDate || '')
  const [recurrence, setRecurrence] = useState(editData?.recurrence || '')
  const [subtasks, setSubtasks] = useState(editData?.subtasks || [])
  const [peopleIds, setPeopleIds] = useState(editData?.peopleIds || [])
  const [subInput, setSubInput] = useState('')
  const [personQuery, setPersonQuery] = useState('')
  const [showAllPeople, setShowAllPeople] = useState(false)
  const [showListForm, setShowListForm] = useState(false)
  const sortedPeople = useMemo(() => osobyDoWyboru(people, todos), [people, todos])
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
            <label>Lista</label>
            <div className="account-chips">
              <button type="button" className={`account-chip ${!listId ? 'active' : ''}`} onClick={() => setListId('')}>Bez listy</button>
              {lists.map(l => (
                <button key={l.id} type="button"
                  className={`account-chip ${listId === l.id ? 'active' : ''}`}
                  style={listId === l.id ? { borderColor: l.color, background: l.color + '22' } : {}}
                  onClick={() => setListId(l.id)}><CatIcon categoryId={null} emoji={l.icon} size={13} /> {l.name}</button>
              ))}
              <button type="button" className="account-chip" onClick={() => setShowListForm(true)}><IconPlus size={12} /> Nowa lista</button>
            </div>
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

          {people.length > 0 && (() => {
            // Wybrane zawsze na wierzchu; podpowiedzi: przy wpisywaniu wszyscy pasujący,
            // inaczej najbliżsi (bliscy, najczęściej w zadaniach) zwinięci do kilku.
            const q = personQuery.trim().toLowerCase()
            const wybrane = sortedPeople.filter(p => peopleIds.includes(p.id))
            const reszta = sortedPeople.filter(p => !peopleIds.includes(p.id))
            const pasujace = q ? reszta.filter(p => [p.name, ...(p.aliases || [])].some(x => String(x || '').toLowerCase().includes(q))) : reszta
            const pokazane = q || showAllPeople ? pasujace : pasujace.slice(0, 6)
            const chip = (p, on) => (
              <button type="button" key={p.id} onClick={() => { togglePerson(p.id); setPersonQuery('') }} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px 4px 4px', borderRadius: 999,
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
                border: `1px solid ${on ? (p.color || 'var(--accent)') : 'var(--border)'}`,
                background: on ? (p.color || 'var(--accent)') + '1e' : 'var(--surface2)',
                color: on ? (p.color || 'var(--accent)') : 'var(--text-sub)',
              }}>
                <PersonBubble person={p} size={20} />
                {p.name}
                {on && <IconClose size={11} />}
              </button>
            )
            return (
              <div className="form-group">
                <label>Osoby, których dotyczy (opcjonalnie)</label>
                {wybrane.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>{wybrane.map(p => chip(p, true))}</div>
                )}
                {people.length > 6 && (
                  <input type="search" className="form-input" value={personQuery} onChange={e => setPersonQuery(e.target.value)}
                    placeholder="Szukaj osoby…" style={{ marginBottom: 8 }} />
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: showAllPeople && !q ? 200 : undefined, overflowY: showAllPeople && !q ? 'auto' : undefined }}>
                  {pokazane.map(p => chip(p, false))}
                  {q && pokazane.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nikogo nie znaleziono</span>}
                </div>
                {!q && pasujace.length > 6 && (
                  <button type="button" onClick={() => setShowAllPeople(v => !v)} style={{ background: 'none', border: 'none', padding: '6px 0 0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                    {showAllPeople ? 'Zwiń listę' : `Pokaż wszystkich (${pasujace.length})`}
                  </button>
                )}
              </div>
            )
          })()}

          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz zmiany' : 'Dodaj zadanie'}
          </button>
        </form>
      </div>
      {showListForm && <ListForm user={user} order={lists.length} onClose={() => setShowListForm(false)} />}
    </div>
  )
}

/* ─── ListForm (create + edit) ─── */
