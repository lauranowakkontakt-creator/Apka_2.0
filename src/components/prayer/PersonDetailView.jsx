import { db } from '../../firebase/config'
import { confirmDialog } from '../ConfirmModal'
import { CatIcon, IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconPrayer, IconTrash } from '../Icons'
import { toast } from '../Toast'
import IntentionForm from './IntentionForm'
import RequestCard from './RequestCard'
import { TODAY, toggleChecklistItem } from './wspolne'
import { Timestamp, arrayRemove, arrayUnion, doc } from 'firebase/firestore'
import { deleteDoc, updateDoc } from '../../utils/zapis'
import { useState } from 'react'

// Szczegóły jednej osoby: jej prośby, notatki i historia modlitwy.

export default function PersonDetailView({ user, person, intentions, carMode, onBack }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editItem, setEditItem]       = useState(null)
  const [showEnded, setShowEnded]     = useState(false)

  const mine   = intentions.filter(i => i.personId === person.id)
  const active = mine.filter(i => i.status === 'active' || !i.status).sort((a, b) => {
    if ((a.priority || 3) === 5 && (b.priority || 3) !== 5) return -1
    if ((a.priority || 3) !== 5 && (b.priority || 3) === 5) return 1
    const at = a.prayedDates?.includes(TODAY())
    const bt = b.prayedDates?.includes(TODAY())
    if (at && !bt) return 1
    if (!at && bt) return -1
    return (b.priority || 3) - (a.priority || 3)
  })
  const ended = mine.filter(i => i.status === 'ended')

  // Nieudany zapis musi być widoczny. Bez tego odbicie kciukiem w aucie kończyło
  // się ciszą: kafelek zostawał szary i nie było wiadomo, czy to nie zadziałało,
  // czy to my nie trafiłyśmy w przycisk.
  const togglePrayed = async (item, date) => {
    const d = date || TODAY()
    const prayed = item.prayedDates?.includes(d)
    try {
      await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', item.id), {
        prayedDates: prayed ? arrayRemove(d) : arrayUnion(d)
      })
    } catch {
      toast.error('Nie udało się zapisać modlitwy')
    }
  }

  const addNote = async (itemId, text) => {
    await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', itemId), {
      notes: arrayUnion({ text, date: TODAY(), id: Date.now().toString() })
    })
  }

  const editNote = async (item, note, newText) => {
    await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', item.id), {
      notes: arrayRemove(note)
    })
    await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', item.id), {
      notes: arrayUnion({ ...note, text: newText })
    })
  }

  const deleteNote = async (item, note) => {
    await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', item.id), {
      notes: arrayRemove(note)
    })
  }

  const archiveItem = async (item) => {
    await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', item.id), {
      status: 'ended', endedAt: Timestamp.now()
    })
  }

  const deleteItem = async (id) => {
    const ok = await confirmDialog({ title: 'Usunąć prośbę?' })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'prayerIntentions', id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="t-btn" onClick={onBack} style={{ padding: carMode ? '8px 10px' : '4px 8px' }}><IconChevronLeft size={carMode ? 24 : 18} /></button>
        <div style={{ width: carMode ? 52 : 36, height: carMode ? 52 : 36, borderRadius: carMode ? 14 : 10, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6', flexShrink: 0 }}>
          <CatIcon categoryId={null} emoji={person.icon || 'IcUsers'} size={carMode ? 28 : 20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: carMode ? 26 : 17, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name}</p>
          {person.note && <p style={{ margin: 0, fontSize: carMode ? 14 : 12, color: 'var(--text-muted)' }}>{person.note}</p>}
        </div>
        <span style={{ fontSize: carMode ? 14 : 12, color: '#8b5cf6', flexShrink: 0 }}>{active.length} aktywnych</span>
      </div>

      {active.length === 0 && !showAddForm && (
        <div className="list-empty">
          <p>Brak aktywnych próśb</p>
          <p className="list-empty-hint">Dodaj pierwszą prośbę modlitewną</p>
        </div>
      )}

      {active.map(item => (
        <RequestCard
          key={item.id}
          item={item}
          user={user}
          carMode={carMode}
          onTogglePrayed={togglePrayed}
          onAddNote={addNote}
          onToggleChecklistItem={(it, id) => toggleChecklistItem(user.uid, it, id)}
          onEditNote={editNote}
          onDeleteNote={deleteNote}
          onArchive={archiveItem}
          onEdit={() => { setEditItem(item); setShowAddForm(true) }}
          onDelete={deleteItem}
        />
      ))}

      {showAddForm ? (
        <IntentionForm
          user={user}
          editData={editItem}
          personId={person.id}
          allIntentions={intentions}
          onClose={() => { setShowAddForm(false); setEditItem(null) }}
        />
      ) : (
        <button className="btn-add-account" onClick={() => { setEditItem(null); setShowAddForm(true) }}>
          + Dodaj prośbę modlitewną
        </button>
      )}

      {ended.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <button className="todo-done-toggle" onClick={() => setShowEnded(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {showEnded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />} Zarchiwizowane ({ended.length})
          </button>
          {showEnded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {ended.map(item => (
                <div key={item.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', opacity: 0.65, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <IconCheck size={16} style={{ flexShrink: 0, color: '#27AE60', marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{item.title}</p>
                    {item.endedNote && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>"{item.endedNote}"</p>}
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <IconPrayer size={10} /> ×{item.prayedDates?.length || 0}
                      {item.autoArchived && ' · auto-zarchiwizowana'}
                    </p>
                  </div>
                  <button className="t-btn delete" onClick={() => deleteItem(item.id)}><IconTrash size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── RequestCard ────────────────────────────────────────────────────────── */
/* Lista rzeczy do modlitwy przy jednej prośbie. Każdy punkt odhacza się
   osobno; licznik u góry pokazuje, ile już przeszło. */
