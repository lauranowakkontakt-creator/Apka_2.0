import { SymbolChip } from './wspolne'
import { db } from '../../firebase/config'
import { scrubSymbolFromDreams } from '../../utils/dreams'
import { confirmDialog } from '../ConfirmModal'
import { IconChevronLeft, IconChevronRight, IconTag, IconTrash } from '../Icons'
import { toast } from '../Toast'
import DreamCard from './DreamCard'
import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { useMemo, useState } from 'react'

// Symbole ze snów: lista, ich wystąpienia i przejście do konkretnego snu.

// Własne znaczenie symbolu — „słownik" śniącej. Znaczenie zależy od kontekstu snu, więc
// zapisujemy je jako tekst, a nie sztywną definicję (podręcznik kursu 201, rozdz. 3.4 i 6.1).
function SymbolMeaning({ user, symbol }) {
  const [text, setText] = useState(symbol.meaning || '')
  const [saving, setSaving] = useState(false)
  const dirty = text.trim() !== (symbol.meaning || '').trim()
  const save = async () => {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid, 'dreamSymbols', symbol.id), { meaning: text.trim() })
      toast.success('Zapisano znaczenie')
    } catch (err) {
      toast.error('Nie udało się zapisać: ' + (err?.message || 'błąd'))
    }
    setSaving(false)
  }
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.16em', textTransform: 'uppercase' }}>Co to dla mnie znaczy</div>
      <textarea className="form-input" value={text} onChange={e => setText(e.target.value)} rows={3}
        placeholder="Znaczenie dobre i złe, skojarzenia, kiedy się pojawia. Pamiętaj: ten sam symbol nie znaczy w każdym śnie tego samego."
        style={{ resize: 'vertical', minHeight: 70, lineHeight: 1.6 }} />
      {dirty && (
        <button type="button" className="btn-save" disabled={saving} onClick={save} style={{ margin: 0 }}>
          {saving ? 'Zapisywanie...' : 'Zapisz znaczenie'}
        </button>
      )}
    </div>
  )
}

export default function SymbolsView({ user, symbols, dreams, counts, categories, peopleById, symbolsById, selectedSymbolId, onSelectSymbol, onOpenDream, onCreateSymbol }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const selected = symbols.find(s => s.id === selectedSymbolId)

  const sorted = useMemo(
    () => [...symbols].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name)),
    [symbols, counts]
  )

  const add = async () => {
    const n = name.trim()
    if (!n) return
    if (!symbols.some(s => s.name.toLowerCase() === n.toLowerCase())) await onCreateSymbol(n)
    setName(''); setAdding(false)
  }

  const remove = async (s) => {
    const ok = await confirmDialog({
      title: `Usunąć symbol „${s.name}"?`,
      message: 'Zniknie ze spisu i zostanie odpięty od snów (same sny zostają).',
    })
    if (!ok) return
    try {
      // Najpierw kasujemy sam symbol (główna akcja) — nawet gdyby odpinanie od snów zawiodło.
      await deleteDoc(doc(db, 'users', user.uid, 'dreamSymbols', s.id))
      if (selectedSymbolId === s.id) onSelectSymbol(null)
      // Odpięcie od snów jest poboczne — błąd tutaj nie może blokować usunięcia symbolu.
      try { await scrubSymbolFromDreams(user.uid, s.id) } catch {}
      toast.success('Symbol usunięty')
    } catch (err) {
      toast.error('Nie udało się usunąć symbolu: ' + (err?.message || 'błąd'))
    }
  }

  // Widok pojedynczego symbolu — jego sny
  if (selected) {
    const its = dreams.filter(d => (d.symbolIds || []).includes(selected.id))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="t-btn" onClick={() => onSelectSymbol(null)} style={{ padding: '4px 8px' }}><IconChevronLeft size={18} /></button>
          <SymbolChip symbol={selected} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>w {its.length} {its.length === 1 ? 'śnie' : 'snach'}</span>
          <button className="t-btn delete" title="Usuń symbol" onClick={() => remove(selected)} style={{ marginLeft: 'auto' }}><IconTrash size={14} /></button>
        </div>
        <SymbolMeaning key={selected.id} user={user} symbol={selected} />
        {its.length === 0 ? (
          <div className="list-empty"><p>Brak snów z tym symbolem</p></div>
        ) : its.map(d => (
          <DreamCard key={d.id} dream={d} categories={categories} peopleById={peopleById} symbolsById={symbolsById} onClick={() => onOpenDream(d.id)} />
        ))}
      </div>
    )
  }

  // Katalog symboli
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {adding ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" value={name} autoFocus placeholder="np. drzewo, dom, woda..."
            maxLength={40} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') { setAdding(false); setName('') } }}
            style={{ flex: 1, minWidth: 0 }} />
          <button className="btn-save" style={{ width: 'auto', margin: 0, padding: '0 16px' }} onClick={add}>Dodaj</button>
        </div>
      ) : (
        <button className="btn-add-account" onClick={() => setAdding(true)}>+ Dodaj symbol</button>
      )}

      {symbols.length === 0 ? (
        <div className="list-empty">
          <p>Brak symboli</p>
          <p className="list-empty-hint">Dodaj symbol tutaj lub wpisz # w treści snu (np. #drzewo)</p>
        </div>
      ) : sorted.map(s => {
        const c = counts[s.id] || 0
        return (
          <div key={s.id} onClick={() => onSelectSymbol(s.id)} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderLeft: `3px solid ${s.color || '#5BB6D9'}`,
            borderRadius: 12, padding: '11px 14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center',
              background: (s.color || '#5BB6D9') + '22', color: s.color || '#5BB6D9',
            }}>
              <IconTag size={17} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                <span style={{ opacity: 0.5 }}>#</span>{s.name}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                {c === 0 ? 'jeszcze w żadnym śnie' : `w ${c} ${c === 1 ? 'śnie' : c < 5 ? 'snach' : 'snach'}`}
              </p>
              {s.meaning && (
                <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.meaning}</p>
              )}
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: s.color || '#5BB6D9', flexShrink: 0 }}>{c}</span>
            <button className="t-btn delete" title="Usuń" onClick={e => { e.stopPropagation(); remove(s) }}><IconTrash size={13} /></button>
            <IconChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
        )
      })}
    </div>
  )
}

/* ─── Szczegóły snu ───────────────────────────────────────────────────────── */
