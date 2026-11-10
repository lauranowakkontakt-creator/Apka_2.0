import { useState, useEffect, useMemo } from 'react'
import { doc, serverTimestamp } from 'firebase/firestore'
import { setDoc, updateDoc } from '../../utils/zapis'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { differenceInDays, parseISO, format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { BIBLE_BOOKS, TOTAL_CHAPTERS, chapterKey } from '../../utils/bibleData'
import { IconBook, IconClose, IconCheck, IconChevronDown, IconSearch, IconCalendar, IconFlag } from '../Icons'
import { Ring } from '../ChartPrimitives'
import SegTabs from '../SegTabs'
import { toast } from '../Toast'
import BibleNotes from './BibleNotes'
import BibleMenu from './BibleMenu'
import { confirmDialog } from '../ConfirmModal'
import { bladSubskrypcji } from '../../utils/polaczenie'

const todayISO = () => format(new Date(), 'yyyy-MM-dd')
const fmtDate  = (iso) => format(parseISO(iso), 'd MMM yyyy', { locale: pl })
// Polski opis długości w dniach (+ przybliżenie w miesiącach dla długich okresów).
function durationText(days) {
  const d = Math.max(0, days)
  const dayWord = d === 1 ? 'dzień' : 'dni'
  if (d < 45) return `${d} ${dayWord}`
  const months = Math.round(d / 30.4)
  return `${d} dni (≈ ${months} mies.)`
}

// Read-count → background intensity (heatmap). More readings = stronger colour.
const INTENSITY = [40, 62, 80, 100]
function boxBackground(count) {
  if (!count) return 'var(--surface2)'
  const pct = INTENSITY[Math.min(count - 1, INTENSITY.length - 1)]
  return `color-mix(in oklab, var(--accent) ${pct}%, var(--surface))`
}

export default function BibleDashboard({ user, setHeaderExtras }) {
  const [progress, setProgress] = useState(null)   // { counts: {}, notes: {} }
  const [filter, setFilter]     = useState('ALL')  // ALL | ST | NT
  const [openKey, setOpenKey]   = useState(null)   // { book, chapter }
  const [collapsed, setCollapsed] = useState({})
  const [view, setView]         = useState('plan') // plan | notes
  const [search, setSearch]     = useState('')     // filtr ksiąg po nazwie
  const [showJourney, setShowJourney] = useState(false) // „Czytanie i licznik" z menu ⋮

  const ref = doc(db, 'users', user.uid, 'bible', 'progress')

  useEffect(() => {
    return onSnapshot(ref, snap => {
      const d = snap.data() || {}
      setProgress({ counts: d.counts || {}, notes: d.notes || {}, startDate: d.startDate || null, finishedAt: d.finishedAt || null })
    }, bladSubskrypcji('bible/progress', {
      // Pusty postęp zamiast wiecznego spinnera — Biblia ma się otworzyć nawet,
      // gdy dokumentu nie da się pobrać.
      przyBledzie: () => setProgress({ counts: {}, notes: {}, startDate: null, finishedAt: null }),
    }))
  }, [user.uid])

  const counts = progress?.counts || {}
  const notes  = progress?.notes  || {}

  const setCount = async (key, value) => {
    await setDoc(ref, { counts: { [key]: Math.max(0, value) }, updatedAt: serverTimestamp() }, { merge: true })
  }
  const bumpCount = async (key, delta) => {
    const next = Math.max(0, (counts[key] || 0) + delta)
    await setDoc(ref, { counts: { [key]: next }, updatedAt: serverTimestamp() }, { merge: true })
  }
  const saveNote = async (key, text) => {
    await setDoc(ref, { notes: { [key]: text }, updatedAt: serverTimestamp() }, { merge: true })
  }
  const saveJourney = async (patch) => {
    await setDoc(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true })
  }

  // ── Statistics ──
  const stats = useMemo(() => {
    let read = 0, total = 0, booksDone = 0
    let stRead = 0, stTotal = 0, ntRead = 0, ntTotal = 0
    for (const b of BIBLE_BOOKS) {
      let bookRead = 0
      for (let c = 1; c <= b.chapters; c++) {
        const n = counts[chapterKey(b.id, c)] || 0
        if (n > 0) { read++; bookRead++ }
        total += n
        if (b.testament === 'ST') { stTotal++; if (n > 0) stRead++ }
        else { ntTotal++; if (n > 0) ntRead++ }
      }
      if (bookRead === b.chapters) booksDone++
    }
    return { read, total, booksDone, stRead, stTotal, ntRead, ntTotal }
  }, [counts])

  const pct = Math.round((stats.read / TOTAL_CHAPTERS) * 100)
  const stPct = stats.stTotal ? Math.round((stats.stRead / stats.stTotal) * 100) : 0
  const ntPct = stats.ntTotal ? Math.round((stats.ntRead / stats.ntTotal) * 100) : 0

  // Automatyczna „podróż": pierwszy przeczytany rozdział = początek, cała Biblia = ukończona.
  // Bez wielkiego przycisku/napisu — dzieje się samo, a data jest tylko dyskretną informacją.
  useEffect(() => {
    if (progress === null) return
    if (stats.read > 0 && !progress.startDate) saveJourney({ startDate: todayISO() })
    else if (stats.read >= TOTAL_CHAPTERS && progress.startDate && !progress.finishedAt) saveJourney({ finishedAt: todayISO() })
  }, [stats.read, progress?.startDate, progress?.finishedAt])
  // Wyzerowanie całego postępu: rozdziały, daty startu i ukończenia.
  // Notatki zostają — to osobna, cenniejsza treść.
  const resetProgress = async () => {
    const ok = await confirmDialog({
      title: 'Wyzerować postępy Biblii?',
      message: 'Znikną odhaczone rozdziały oraz data rozpoczęcia. Notatki zostają.',
      confirmLabel: 'Wyzeruj',
    })
    if (!ok) return
    // UWAGA: tu musi być updateDoc, nie setDoc({...}, { merge: true }).
    // Merge scala mapy, więc `counts: {}` NIE skasowałoby odhaczonych rozdziałów —
    // reset pokazywałby sukces i nie robił nic (a wyczyszczona data startu
    // wracałaby od razu, bo licznik rusza sam przy pierwszym rozdziale).
    // updateDoc podmienia całe pole `counts` na puste. Notatki zostają nietknięte.
    await updateDoc(ref, { counts: {}, startDate: null, finishedAt: null, updatedAt: serverTimestamp() })
      .catch(() => setDoc(ref, { counts: {}, startDate: null, finishedAt: null, updatedAt: serverTimestamp() }))
    toast.success('Postępy wyzerowane')
  }

  // Górna belka: [⋮ Czytanie i licznik / Wyzeruj postępy].
  // Hook przed early-returnem (zasady hooków).
  useEffect(() => {
    setHeaderExtras?.(
      <BibleMenu onAction={(id) => {
        if (id === 'journey') setShowJourney(true)
        if (id === 'reset')   resetProgress()
      }} />
    )
    return () => setHeaderExtras?.(null)
  }, [])

  const q = search.trim().toLowerCase()
  const books = BIBLE_BOOKS.filter(b =>
    (filter === 'ALL' || b.testament === filter) &&
    (!q || b.name.toLowerCase().includes(q))
  )

  if (progress === null) return <div className="list-loading">Ładowanie...</div>

  const openBook = openKey ? BIBLE_BOOKS.find(b => b.id === openKey.book) : null

  return (
    <div className="bible-dashboard">
      {/* Zakładki */}
      <SegTabs
        items={[{ id: 'plan', label: 'Plan czytania' }, { id: 'notes', label: 'Notatki' }]}
        active={view} onChange={setView}
      />

      {view === 'notes' && <BibleNotes user={user} />}

      {view === 'plan' && (<>
      {/* Hero / postęp */}
      <div className="bible-hero">
        <Ring value={pct} size={92} thickness={9} color="var(--accent)" label="całość" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="kicker">Przeczytane rozdziały</div>
          <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
            {stats.read}<span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 400 }}>/{TOTAL_CHAPTERS}</span>
          </div>
          <div className="bible-progress-track" style={{ marginTop: 10 }}>
            <div className="bible-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="bible-testament-bars">
            <div className="bible-tbar">
              <span className="bible-tbar-label">ST</span>
              <div className="bible-progress-track"><div className="bible-progress-fill" style={{ width: `${stPct}%` }} /></div>
              <span className="bible-tbar-pct">{stPct}%</span>
            </div>
            <div className="bible-tbar">
              <span className="bible-tbar-label">NT</span>
              <div className="bible-progress-track"><div className="bible-progress-fill" style={{ width: `${ntPct}%` }} /></div>
              <span className="bible-tbar-pct">{ntPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statystyki */}
      <div className="bible-stats">
        <Stat label="Ukończone księgi" value={`${stats.booksDone}/66`} />
        <Stat label="Stary Testament" value={`${stats.stRead}/${stats.stTotal}`} />
        <Stat label="Nowy Testament" value={`${stats.ntRead}/${stats.ntTotal}`} />
        <Stat label="Łącznie czytań" value={stats.total} />
      </div>

      {/* Filtr testamentów */}
      <SegTabs
        items={[{ id: 'ALL', label: 'Wszystko' }, { id: 'ST', label: 'Stary Test.' }, { id: 'NT', label: 'Nowy Test.' }]}
        active={filter} onChange={setFilter}
      />

      {/* Legenda heatmapy */}
      <div className="bible-legend">
        <span>mniej</span>
        <span className="bible-legend-box" style={{ background: 'var(--surface2)' }} />
        {INTENSITY.map((_, i) => (
          <span key={i} className="bible-legend-box" style={{ background: boxBackground(i + 1) }} />
        ))}
        <span>więcej</span>
      </div>

      {/* Wyszukiwarka ksiąg */}
      <div className="bible-search">
        <IconSearch size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          className="bible-search-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Szukaj księgi..."
        />
        {search && (
          <button className="bible-search-clear" onClick={() => setSearch('')} title="Wyczyść">
            <IconClose size={14} />
          </button>
        )}
      </div>

      {/* Księgi */}
      <div className="bible-books">
        {books.length === 0 && (
          <div className="list-empty"><p>Brak ksiąg dla „{search}"</p></div>
        )}
        {books.map(book => {
          let bookRead = 0
          for (let c = 1; c <= book.chapters; c++) if (counts[chapterKey(book.id, c)] > 0) bookRead++
          const done = bookRead === book.chapters
          const isCollapsed = collapsed[book.id] ?? true // domyślnie zwinięte
          return (
            <div key={book.id} className={`bible-book ${done ? 'done' : ''}`}>
              <button className="bible-book-head" onClick={() => setCollapsed(p => ({ ...p, [book.id]: !(p[book.id] ?? true) }))}>
                <span className="bible-book-name">{book.name}</span>
                <span className="bible-book-count">{bookRead}/{book.chapters}</span>
                {done && <IconCheck size={13} style={{ color: 'var(--income)' }} />}
                <IconChevronDown size={14} style={{ color: 'var(--text-muted)', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              {!isCollapsed && (
                <div className="bible-grid">
                  {Array.from({ length: book.chapters }, (_, i) => i + 1).map(ch => {
                    const key = chapterKey(book.id, ch)
                    const n = counts[key] || 0
                    const hasNote = !!notes[key]
                    return (
                      <button key={ch} className="bible-cell"
                        title={`${book.name} ${ch}${n ? ` · przeczytane ${n}×` : ''}`}
                        onClick={() => setOpenKey({ book: book.id, chapter: ch })}
                        style={{ background: boxBackground(n), color: n >= 2 ? '#fff' : 'var(--text-muted)', borderColor: n ? 'transparent' : 'var(--border)' }}>
                        {ch}
                        {hasNote && <span className="bible-note-dot" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {openBook && (
        <ChapterSheet
          book={openBook}
          chapter={openKey.chapter}
          count={counts[chapterKey(openKey.book, openKey.chapter)] || 0}
          note={notes[chapterKey(openKey.book, openKey.chapter)] || ''}
          onClose={() => setOpenKey(null)}
          onSetCount={(v) => setCount(chapterKey(openKey.book, openKey.chapter), v)}
          onBump={(d) => bumpCount(chapterKey(openKey.book, openKey.chapter), d)}
          onSaveNote={(t) => saveNote(chapterKey(openKey.book, openKey.chapter), t)}
        />
      )}
      </>)}

      {/* Czytanie i licznik — wywoływane z ⋮, żeby nie zajmowało ekranu */}
      {showJourney && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowJourney(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <IconCalendar size={17} /> Czytanie i licznik
              </h3>
              <button className="modal-close" onClick={() => setShowJourney(false)}><IconClose size={16} /></button>
            </div>
            <div className="form">
              {progress.startDate ? (
                <BibleJourney
                  startDate={progress.startDate}
                  finishedAt={progress.finishedAt}
                  pct={pct}
                  onFinish={() => saveJourney({ finishedAt: todayISO() })}
                  onReset={() => saveJourney({ startDate: null, finishedAt: null })}
                />
              ) : (
                <p className="pause-info">
                  Licznik rusza sam, gdy odhaczysz pierwszy rozdział — nie trzeba niczego włączać.
                </p>
              )}
              <button type="button" className="tithe-disable" onClick={() => { setShowJourney(false); resetProgress() }}>
                Wyzeruj postępy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bible-stat">
      <div className="bible-stat-value">{value}</div>
      <div className="bible-stat-label">{label}</div>
    </div>
  )
}

// Podróż przez Biblię — teraz pod „trzema kropkami", nie na głównym ekranie.
// Start ustawia się automatycznie przy
// pierwszym rozdziale, ukończenie — po przeczytaniu całości (lub ręcznie „Ukończona").
function BibleJourney({ startDate, finishedAt, pct, onFinish, onReset }) {
  if (!startDate) return null // przed pierwszym rozdziałem nic nie pokazujemy

  const done = !!finishedAt
  const days = differenceInDays(done ? parseISO(finishedAt) : new Date(), parseISO(startDate))
  const miniBtn = {
    background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
    fontSize: 11, fontWeight: 600, fontFamily: 'inherit', padding: '3px 9px', borderRadius: 8, cursor: 'pointer', flexShrink: 0,
  }

  return (
    <div style={{
      background: done ? 'color-mix(in oklab, var(--income) 12%, var(--surface))' : 'var(--surface)',
      border: `1px solid ${done ? 'color-mix(in oklab, var(--income) 40%, var(--border))' : 'var(--border)'}`,
      borderRadius: 'var(--r)', padding: '9px 12px', marginBottom: 14,
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: done ? 'var(--income)' : 'var(--text-sub)', flexShrink: 0 }}>
        {done ? <IconFlag size={13} /> : <IconCalendar size={13} />}
        {done ? 'Ukończona' : 'W drodze'}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, minWidth: 120 }}>
        {fmtDate(startDate)}{done ? ` → ${fmtDate(finishedAt)}` : ''} · {durationText(days)}{!done ? ` · ${pct}%` : ''}
      </span>
      {!done && pct < 100 && <button style={miniBtn} onClick={onFinish} title="Oznacz jako ukończoną">Ukończona</button>}
      <button style={miniBtn} onClick={onReset} title={done ? 'Zacznij od nowa' : 'Resetuj'}>{done ? 'Od nowa' : 'Reset'}</button>
    </div>
  )
}

function ChapterSheet({ book, chapter, count, note, onClose, onSetCount, onBump, onSaveNote }) {
  const [draft, setDraft] = useState(note)
  useEffect(() => { setDraft(note) }, [note])
  const dirty = draft.trim() !== note.trim()

  const handleSaveNote = async () => {
    await onSaveNote(draft.trim())
    toast.success('Notatka zapisana')
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IconBook size={17} /> {book.name} {chapter}
          </h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>

        <div className="form">
          <div className="bible-read-state" style={{ background: count ? 'color-mix(in oklab, var(--accent) 14%, var(--surface))' : 'var(--surface2)' }}>
            {count === 0 ? (
              <>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Jeszcze nieprzeczytany</p>
                <button className="btn-save" style={{ width: 'auto', padding: '12px 22px', margin: 0 }} onClick={() => onSetCount(1)}>
                  <IconCheck size={16} style={{ marginRight: 6, verticalAlign: '-2px' }} /> Zaznacz jako przeczytane
                </button>
              </>
            ) : (
              <>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{count}×</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>przeczytane</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="bible-step" onClick={() => onBump(-1)} title="Mniej">−</button>
                  <button className="bible-step" onClick={() => onBump(1)} title="Jeszcze raz">+</button>
                  <button className="bible-clear" onClick={() => onSetCount(0)}>Odznacz</button>
                </div>
              </>
            )}
          </div>

          <div className="form-group">
            <label>Notatka</label>
            <textarea className="form-input" rows={5} value={draft} onChange={e => setDraft(e.target.value)}
              placeholder="Myśli, wersety, modlitwa, co Bóg mówił przez ten rozdział..."
              style={{ resize: 'vertical', minHeight: 110, fontFamily: 'inherit' }} />
          </div>

          <button className="btn-save" disabled={!dirty} onClick={handleSaveNote}>
            {dirty ? 'Zapisz notatkę' : 'Notatka zapisana'}
          </button>
        </div>
      </div>
    </div>
  )
}
