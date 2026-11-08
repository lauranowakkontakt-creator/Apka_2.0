import { db } from '../../firebase/config'
import { SYMBOL_COLORS, mergeDreamCategories } from '../../utils/dreams'
import { bladSubskrypcji } from '../../utils/polaczenie'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { confirmDialog } from '../ConfirmModal'
import { IconChevronLeft, IconPlus } from '../Icons'
import DreamCard from './DreamCard'
import DreamCategoryManager from './DreamCategoryManager'
import DreamDetail from './DreamDetail'
import DreamForm from './DreamForm'
import DreamMenu from './DreamMenu'
import DreamStats from './DreamStats'
import SymbolsView from './SymbolsView'
import { Timestamp, addDoc, collection, deleteDoc, doc, orderBy, query } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { useEffect, useMemo, useState } from 'react'

// Moduł Sen — spinacz. Dane z Firestore, wybór widoku i nawigacja;
// wyświetlanie oddane komponentom w plikach obok.

export default function DreamDashboard({ user, focusId, onFocusConsumed, setHeaderExtras }) {
  const [dreams, setDreams]   = useState([])
  const [people, setPeople]   = useState([])
  const [symbols, setSymbols] = useState([])
  const [loading, setLoading] = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [tab, setTab]         = useState('dreams') // 'dreams' | 'symbols'
  const [selectedId, setSelectedId] = useState(null)
  const [selectedSymbolId, setSelectedSymbolId] = useState(null)
  const [showForm, setShowForm]     = useState(false)
  const [editDream, setEditDream]   = useState(null)
  const [customCats, setCustomCats] = useState([])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'dreams'), orderBy('date', 'desc'))
    return onSnapshot(q, snap => { setDreams(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      bladSubskrypcji('dreams', { przyBledzie: () => setLoading(false) }))
  }, [user.uid])
  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'calendarPeople'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setPeople(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('calendarPeople'))
  }, [user.uid])
  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'dreamSymbols'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setSymbols(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('dreamSymbols'))
  }, [user.uid])
  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'dreamCategories'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setCustomCats(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('dreamCategories'))
  }, [user.uid])

  // Wejście z innego modułu (np. z karty osoby w „Osoby")
  useEffect(() => {
    if (focusId) { setSelectedId(focusId); setTab('dreams'); onFocusConsumed?.() }
  }, [focusId])

  // Wbudowane kategorie + własne — jedna lista dla kafelków, szczegółów i formularza.
  const categories  = useMemo(() => mergeDreamCategories(customCats), [customCats])
  const peopleById  = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people])
  const symbolsById = useMemo(() => Object.fromEntries(symbols.map(s => [s.id, s])), [symbols])

  // Liczba snów per symbol
  const symbolCounts = useMemo(() => {
    const m = {}
    symbols.forEach(s => { m[s.id] = 0 })
    dreams.forEach(d => (d.symbolIds || []).forEach(sid => { if (m[sid] != null) m[sid]++ }))
    return m
  }, [symbols, dreams])

  // Górna belka („Apka"): [＋ Zapisz sen][⋮ Symbole / Statystyki].
  // Hook przed early-returnem (zasady hooków).
  useEffect(() => {
    setHeaderExtras?.(
      <>
        <DreamMenu onAction={(id) => { setSelectedId(null); setSelectedSymbolId(null); setTab(id) }} />
        <button className="hdr-btn accent" title="Zapisz sen" onClick={() => { setEditDream(null); setShowForm(true) }}><IconPlus size={17} /></button>
      </>
    )
    return () => setHeaderExtras?.(null)
  }, [])

  if (loading) return <div className="list-loading">Ładowanie...</div>

  const selected = dreams.find(d => d.id === selectedId)

  const deleteDream = async (id) => {
    const ok = await confirmDialog({ title: 'Usunąć ten sen?', message: 'Tego nie da się cofnąć.' })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'dreams', id))
    if (selectedId === id) setSelectedId(null)
  }

  const createSymbol = async (name) => {
    const color = SYMBOL_COLORS[Math.floor(Math.random() * SYMBOL_COLORS.length)]
    const ref = await addDoc(collection(db, 'users', user.uid, 'dreamSymbols'), {
      name: name.trim(), color, createdAt: Timestamp.now(),
    })
    return { id: ref.id, name: name.trim(), color }
  }

  const openSymbol = (id) => { setSelectedId(null); setTab('symbols'); setSelectedSymbolId(id) }

  return (
    <div className="dream-dashboard">
      {/* Podstrona Symbole / Statystyki — pasek ze strzałką wstecz do dziennika */}
      {!selected && (tab === 'symbols' || tab === 'stats' || tab === 'categories') && (
        <div className="rev-subhead">
          <button className="rev-back" onClick={() => { setTab('dreams'); setSelectedSymbolId(null) }} title="Wróć"><IconChevronLeft size={18} /></button>
          <div className="rev-subhead-title">
            {tab === 'symbols' ? 'Symbole' : tab === 'categories' ? 'Kategorie snów' : 'Statystyki'}
          </div>
        </div>
      )}

      {selected ? (
        <DreamDetail
          dream={selected}
          categories={categories}
          peopleById={peopleById}
          symbolsById={symbolsById}
          onBack={() => setSelectedId(null)}
          onOpenSymbol={openSymbol}
          onEdit={() => { setEditDream(selected); setShowForm(true) }}
          onDelete={() => deleteDream(selected.id)}
        />
      ) : tab === 'stats' ? (
        <DreamStats dreams={dreams} />
      ) : tab === 'categories' ? (
        <DreamCategoryManager user={user} />
      ) : tab === 'symbols' ? (
        <SymbolsView
          user={user}
          symbols={symbols}
          dreams={dreams}
          counts={symbolCounts}
          categories={categories}
          peopleById={peopleById}
          symbolsById={symbolsById}
          selectedSymbolId={selectedSymbolId}
          onSelectSymbol={setSelectedSymbolId}
          onOpenDream={(id) => setSelectedId(id)}
          onCreateSymbol={createSymbol}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dreams.length === 0 ? (
            <div className="list-empty">
              <p>Brak zapisanych snów</p>
              <p className="list-empty-hint">Zapisz, co Ci się śniło — emocje, kategorię, osoby (@) i symbole (#)</p>
            </div>
          ) : dreams.map(d => (
            <DreamCard key={d.id} dream={d} categories={categories} peopleById={peopleById} symbolsById={symbolsById} onClick={() => setSelectedId(d.id)} />
          ))}
        </div>
      )}

      {showForm && (
        <DreamForm
          user={user}
          categories={categories}
          people={people}
          symbols={symbols}
          onCreateSymbol={createSymbol}
          editData={editDream}
          onClose={() => { setShowForm(false); setEditDream(null) }}
        />
      )}
    </div>
  )
}

/* ─── Kafelek snu na liście ──────────────────────────────────────────────── */
