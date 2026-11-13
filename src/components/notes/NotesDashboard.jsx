import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { filterNotes, sortNotes, collectTags, parseTags, preview } from '../../utils/notesLogic'
import { IconNote, IcPin, IconClose, IconTrash, IconPlus, IconSearch, IconTag } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { toast } from '../Toast'
import { bladSubskrypcji } from '../../utils/polaczenie'

const noteDate = (n) => {
  const t = n.updatedAt?.toDate?.() || n.createdAt?.toDate?.()
  return t ? format(t, 'd MMM yyyy', { locale: pl }) : ''
}

export default function NotesDashboard({ user }) {
  const [notes, setNotes]     = useState([])
  const [loading, setLoading] = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [search, setSearch]   = useState('')
  const [tag, setTag]         = useState(null)
  const [editor, setEditor]   = useState(null) // null | 'new' | notatka

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'notes'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, bladSubskrypcji('notes', { przyBledzie: () => setLoading(false) }))
  }, [user.uid])

  const allTags = useMemo(() => collectTags(notes), [notes])
  const visible = useMemo(() => sortNotes(filterNotes(notes, search, tag)), [notes, search, tag])

  const togglePin = (n) =>
    updateDoc(doc(db, 'users', user.uid, 'notes', n.id), { pinned: !n.pinned }).catch(() => {})

  const handleDelete = async (n) => {
    const ok = await confirmDialog({ title: 'Usunąć notatkę?', message: 'Ta operacja jest nieodwracalna.' })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'notes', n.id))
    toast.success('Notatka usunięta')
  }

  if (loading) return <div className="list-loading">Ładowanie...</div>

  return (
    <div className="notes-dashboard">

      {/* Mobile module header */}
      <div className="mod-header">
        <div>
          <div className="mod-header-kicker">Notatnik</div>
          <div className="mod-header-title">
            {notes.length} {notes.length === 1 ? 'notatka' : notes.length % 10 >= 2 && notes.length % 10 <= 4 && (notes.length % 100 < 12 || notes.length % 100 > 14) ? 'notatki' : 'notatek'}
          </div>
        </div>
      </div>

      {/* Szukajka */}
      <div style={{ position: 'relative' }}>
        <IconSearch size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          type="search" className="form-input" placeholder="Szukaj w notatkach..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 38 }}
        />
      </div>

      {/* Tagi */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className={`account-chip ${tag === null ? 'active' : ''}`} onClick={() => setTag(null)}>Wszystkie</button>
          {allTags.map(t => (
            <button key={t} className={`account-chip ${tag === t ? 'active' : ''}`}
              onClick={() => setTag(tag === t ? null : t)}>
              <IconTag size={10} style={{ verticalAlign: '-1px', marginRight: 4, opacity: .7 }} />{t}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {visible.length === 0 ? (
        <div className="list-empty">
          <p style={{ marginBottom: 8, opacity: 0.4, display: 'flex', justifyContent: 'center' }}><IconNote size={32} /></p>
          <p>{notes.length === 0 ? 'Brak notatek' : 'Nic nie znaleziono'}</p>
          {notes.length === 0 && <p className="list-empty-hint">Kliknij + aby dodać pierwszą</p>}
        </div>
      ) : (
        <div className="notes-grid">
          {visible.map(n => (
            <div key={n.id} className="note-card" onClick={() => setEditor(n)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {n.title || 'Bez tytułu'}
                </span>
                <button
                  className={`note-pin ${n.pinned ? 'pinned' : ''}`}
                  title={n.pinned ? 'Odepnij' : 'Przypnij'}
                  onClick={(e) => { e.stopPropagation(); togglePin(n) }}
                ><IcPin size={13} /></button>
              </div>
              {n.content && (
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-sub)', lineHeight: 1.5 }}>
                  {preview(n.content)}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 10 }}>
                {(n.tags || []).slice(0, 3).map(t => (
                  <span key={t} className="note-tag">{t}</span>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{noteDate(n)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button aria-label="Dodaj" className="btn-add" onClick={() => setEditor('new')}><IconPlus size={22} /></button>

      {editor && (
        <NoteEditor
          user={user}
          note={editor === 'new' ? null : editor}
          onClose={() => setEditor(null)}
          onDelete={(n) => { setEditor(null); handleDelete(n) }}
        />
      )}
    </div>
  )
}

function NoteEditor({ user, note, onClose, onDelete }) {
  const [title, setTitle]     = useState(note?.title || '')
  const [content, setContent] = useState(note?.content || '')
  const [tagsInput, setTagsInput] = useState((note?.tags || []).join(', '))
  const [pinned, setPinned]   = useState(note?.pinned || false)
  const [saving, setSaving]   = useState(false)

  const canSave = title.trim() || content.trim()

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    const data = {
      title: title.trim(),
      content: content.trim(),
      tags: parseTags(tagsInput),
      pinned,
      updatedAt: Timestamp.now(),
    }
    try {
      if (note) {
        await updateDoc(doc(db, 'users', user.uid, 'notes', note.id), data)
      } else {
        await addDoc(collection(db, 'users', user.uid, 'notes'), { ...data, createdAt: Timestamp.now() })
      }
      toast.success('Notatka zapisana')
      onClose()
    } catch {
      toast.error('Błąd zapisu')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IconNote size={17} /> {note ? 'Edytuj notatkę' : 'Nowa notatka'}
          </h3>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className={`note-pin ${pinned ? 'pinned' : ''}`}
              style={{ width: 30, height: 30 }}
              title={pinned ? 'Odepnij' : 'Przypnij'}
              onClick={() => setPinned(p => !p)}
            ><IcPin size={15} /></button>
            {note && (
              <button className="t-btn delete" style={{ width: 30, height: 30 }} title="Usuń"
                onClick={() => onDelete(note)}><IconTrash size={14} /></button>
            )}
            <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
          </div>
        </div>

        <form className="form" onSubmit={(e) => { e.preventDefault(); handleSave() }}>
          <div className="form-group">
            <input
              type="text" className="form-input" placeholder="Tytuł"
              value={title} onChange={e => setTitle(e.target.value)} maxLength={120}
              style={{ fontSize: 16, fontWeight: 700 }}
            />
          </div>

          <div className="form-group">
            <textarea
              className="form-input" rows={10} autoFocus={!note}
              placeholder="Treść notatki..."
              value={content} onChange={e => setContent(e.target.value)}
              style={{ resize: 'vertical', minHeight: 220, fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          </div>

          <div className="form-group">
            <label>Tagi <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(oddziel przecinkami)</span></label>
            <input
              type="text" className="form-input" placeholder="np. dom, praca, pomysły"
              value={tagsInput} onChange={e => setTagsInput(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-save" disabled={saving || !canSave}>
            {saving ? 'Zapisywanie...' : note ? 'Zapisz zmiany' : 'Dodaj notatkę'}
          </button>
        </form>
      </div>
    </div>
  )
}
