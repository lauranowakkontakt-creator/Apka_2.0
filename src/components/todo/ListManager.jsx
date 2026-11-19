import { posortujListy, przesunListe } from '../../utils/todoLogic'
import { confirmDialog } from '../ConfirmModal'
import { CatIcon, IconArrowDown, IconArrowUp, IconClose, IconEdit, IconPlus, IconTrash } from '../Icons'
import { toast } from '../Toast'
import ListForm from './ListForm'
import { usunListe, zapiszKolejnosc } from './listyZapis'
import { useState } from 'react'

// Zarządzanie listami (kategoriami) zadań: kolejność, edycja, usuwanie, nowa lista.

export default function ListManager({ user, lists, todos = [], onClose, onUsunieta }) {
  const [edytowana, setEdytowana] = useState(null)   // lista albo 'nowa'
  const [zajete, setZajete] = useState(false)
  const posort = posortujListy(lists)
  const ileZadan = (id) => todos.filter(t => !t.done && t.listId === id).length

  const przesun = async (id, kierunek) => {
    setZajete(true)
    try { await zapiszKolejnosc(user.uid, przesunListe(lists, id, kierunek)) }
    catch { toast.error('Nie udało się zmienić kolejności') }
    setZajete(false)
  }

  const usun = async (l) => {
    const ile = todos.filter(t => t.listId === l.id).length
    const ok = await confirmDialog({
      title: `Usunąć listę „${l.name}”?`,
      message: ile ? `Zadania z tej listy (${ile}) zostaną — trafią do „Bez listy”.` : 'Lista jest pusta.',
    })
    if (!ok) return
    setZajete(true)
    try { await usunListe(user.uid, l.id); onUsunieta?.(l.id); toast.success('Lista usunięta') }
    catch { toast.error('Nie udało się usunąć listy') }
    setZajete(false)
  }

  const maly = { width: 30, height: 30 }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Listy zadań</h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        {posort.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 12px' }}>Nie masz jeszcze list. Lista to kategoria zadań, np. Dom, Studia, Auto.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {posort.map((l, i) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--surface2)', borderLeft: `3px solid ${l.color || 'var(--sky)'}` }}>
              <CatIcon categoryId={null} emoji={l.icon} size={15} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ileZadan(l.id) || ''}</span>
              <button type="button" className="t-btn" style={maly} aria-label={`${l.name}: wyżej`} disabled={zajete || i === 0} onClick={() => przesun(l.id, -1)}><IconArrowUp size={13} /></button>
              <button type="button" className="t-btn" style={maly} aria-label={`${l.name}: niżej`} disabled={zajete || i === posort.length - 1} onClick={() => przesun(l.id, 1)}><IconArrowDown size={13} /></button>
              <button type="button" className="t-btn" style={maly} aria-label={`Edytuj listę ${l.name}`} onClick={() => setEdytowana(l)}><IconEdit size={13} /></button>
              <button type="button" className="t-btn delete" style={maly} aria-label={`Usuń listę ${l.name}`} disabled={zajete} onClick={() => usun(l)}><IconTrash size={13} /></button>
            </div>
          ))}
        </div>
        <button type="button" className="btn-save" onClick={() => setEdytowana('nowa')}><IconPlus size={14} /> Nowa lista</button>
      </div>
      {edytowana && (
        <ListForm user={user} editData={edytowana === 'nowa' ? null : edytowana} order={posort.length}
          onUsunieta={onUsunieta} onClose={() => setEdytowana(null)} />
      )}
    </div>
  )
}
