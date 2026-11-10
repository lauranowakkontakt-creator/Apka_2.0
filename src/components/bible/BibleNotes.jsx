import { useState, useEffect } from 'react'
import { collection, query, orderBy, doc, Timestamp } from 'firebase/firestore'
import { addDoc, updateDoc } from '../../utils/zapis'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { usunZCofnieciem } from '../../utils/usunZCofnieciem'
import { BIBLE_BOOKS } from '../../utils/bibleData'
import { IconBook, IconClose, IconEdit, IconTrash, IconPlus } from '../Icons'
import { toast } from '../Toast'
import { bladSubskrypcji } from '../../utils/polaczenie'

const bookName = (id) => BIBLE_BOOKS.find(b => b.id === id)?.name || '?'
const verseRef = (n) => {
  if (!n.verse) return ''
  return ':' + n.verse + (n.verseEnd && n.verseEnd !== n.verse ? '-' + n.verseEnd : '')
}
const reference = (n) => `${bookName(n.book)} ${n.chapter}${verseRef(n)}`

export default function BibleNotes({ user }) {
  const [notes, setNotes]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editNote, setEditNote] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'bibleNotes'), orderBy('number', 'desc'))
    return onSnapshot(q, snap => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, bladSubskrypcji('bibleNotes', { przyBledzie: () => setLoading(false) }))
  }, [user.uid])

  const nextNumber = notes.reduce((max, n) => Math.max(max, n.number || 0), 0) + 1

  const handleDelete = async (id) => {
    await usunZCofnieciem(doc(db, 'users', user.uid, 'bibleNotes', id), 'Usunięto notatkę')
  }

  if (loading) return <div className="list-loading">Ładowanie...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button className="btn-add-account" onClick={() => { setEditNote(null); setShowForm(true) }}>
        <IconPlus size={15} style={{ verticalAlign: '-3px', marginRight: 4 }} /> Nowa notatka
      </button>

      {notes.length === 0 ? (
        <div className="list-empty">
          <p>Brak notatek</p>
          <p className="list-empty-hint">Dodaj pierwszą notatkę przyciskiem powyżej</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map(n => (
            <div key={n.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderLeft: '3px solid var(--accent)', borderRadius: 12, padding: '12px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              {/* Numer notatki */}
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'color-mix(in oklab, var(--accent) 16%, transparent)',
                color: 'var(--accent)', fontSize: 13, fontWeight: 700,
              }}>{n.number}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700 }}>
                  <IconBook size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  {reference(n)}
                </div>
                {n.text && (
                  <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.text}</p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                <button className="t-btn" onClick={() => { setEditNote(n); setShowForm(true) }}><IconEdit size={13} /></button>
                <button className="t-btn delete" onClick={() => handleDelete(n.id)}><IconTrash size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <NoteForm
          user={user}
          editData={editNote}
          nextNumber={nextNumber}
          onClose={() => { setShowForm(false); setEditNote(null) }}
        />
      )}
    </div>
  )
}

function NoteForm({ user, editData, nextNumber, onClose }) {
  const [book, setBook]       = useState(editData?.book || BIBLE_BOOKS[0].id)
  const [chapter, setChapter] = useState(editData?.chapter || 1)
  const [verse, setVerse]     = useState(editData?.verse || '')
  const [verseEnd, setVerseEnd] = useState(editData?.verseEnd || '')
  const [text, setText]       = useState(editData?.text || '')
  const [saving, setSaving]   = useState(false)

  const bookObj = BIBLE_BOOKS.find(b => b.id === book) || BIBLE_BOOKS[0]

  // Gdy zmienia się księga, przytnij rozdział do zakresu
  useEffect(() => {
    if (chapter > bookObj.chapters) setChapter(bookObj.chapters)
  }, [book]) // eslint-disable-line

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    const data = {
      book,
      chapter: Number(chapter),
      verse: verse ? Number(verse) : null,
      verseEnd: verse && verseEnd && Number(verseEnd) > Number(verse) ? Number(verseEnd) : null,
      text: text.trim(),
      updatedAt: Timestamp.now(),
    }
    try {
      if (editData) {
        await updateDoc(doc(db, 'users', user.uid, 'bibleNotes', editData.id), data)
      } else {
        await addDoc(collection(db, 'users', user.uid, 'bibleNotes'), {
          ...data, number: nextNumber, createdAt: Timestamp.now(),
        })
      }
      toast.success('Notatka zapisana')
      onClose()
    } catch {
      setSaving(false)
    }
  }

  const st = BIBLE_BOOKS.filter(b => b.testament === 'ST')
  const nt = BIBLE_BOOKS.filter(b => b.testament === 'NT')

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IconBook size={17} /> {editData ? `Notatka #${editData.number}` : `Nowa notatka #${nextNumber}`}
          </h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          {/* Miejsce */}
          <div className="form-group">
            <label>Księga</label>
            <select className="form-input" value={book} onChange={e => setBook(e.target.value)}>
              <optgroup label="Stary Testament">
                {st.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </optgroup>
              <optgroup label="Nowy Testament">
                {nt.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </optgroup>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Rozdział</label>
              <select className="form-input" value={chapter} onChange={e => setChapter(Number(e.target.value))}>
                {Array.from({ length: bookObj.chapters }, (_, i) => i + 1).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Wersety (opcjonalnie)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="number" min="1" className="form-input" value={verse}
                  onChange={e => setVerse(e.target.value)} placeholder="od" style={{ minWidth: 0 }} />
                <span style={{ color: 'var(--text-sub)', fontWeight: 700 }}>–</span>
                <input type="number" min="1" className="form-input" value={verseEnd}
                  onChange={e => setVerseEnd(e.target.value)} placeholder="do"
                  disabled={!verse} style={{ minWidth: 0 }} />
              </div>
            </div>
          </div>

          {/* Podgląd miejsca */}
          <div style={{
            background: 'color-mix(in oklab, var(--accent) 12%, var(--surface2))',
            border: '1px solid color-mix(in oklab, var(--accent) 30%, var(--border))',
            borderRadius: 10, padding: '8px 12px', fontSize: 14, fontWeight: 700, color: 'var(--accent)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <IconBook size={14} />
            {bookObj.name} {chapter}{verse ? ':' + verse + (verseEnd && Number(verseEnd) > Number(verse) ? '-' + verseEnd : '') : ''}
          </div>

          <div className="form-group">
            <label>Notatka</label>
            <textarea className="form-input" rows={5} value={text} onChange={e => setText(e.target.value)}
              placeholder="Myśli, refleksja, co Bóg mówił przez ten fragment..."
              style={{ resize: 'vertical', minHeight: 120, fontFamily: 'inherit' }} />
          </div>

          <button type="submit" className="btn-save" disabled={saving || !text.trim()}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz zmiany' : 'Dodaj notatkę'}
          </button>
        </form>
      </div>
    </div>
  )
}
