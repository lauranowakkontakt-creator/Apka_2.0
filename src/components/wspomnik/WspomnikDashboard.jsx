import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc, Timestamp, limit } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import {
  WSPOMNIK_COLLECTION, CATEGORIES, categoryLabel, sortEntries, filterEntries,
  groupByYear, wspomnikStats, onThisDay, yearsAgoLabel, buildEntry,
} from '../../utils/wspomnikLogic'
import { pickBySeed, daySeed, neighbors } from '../../utils/browsing'
import StatTiles from '../StatTiles'
import { IconPlus, IconTrash, IconSearch, IconClose, IconEdit,
  IconChevronLeft, IconChevronRight, IconRepeat, IcStones, IconBook } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { toast } from '../Toast'
import { bladSubskrypcji } from '../../utils/polaczenie'

// Wspomnik — „co Bóg zrobił”. Każde wydarzenie to osobny wpis z datą, krótkim
// tytułem i (jeśli chcesz) całą historią i wersetem. Po to, żeby nie zapomnieć
// i móc wracać: przypominajka, „tego dnia” sprzed lat i czytnik ze strzałkami.

const TODAY = () => format(new Date(), 'yyyy-MM-dd')
const fullDate = (d) => format(parseISO(d), 'd MMMM yyyy', { locale: pl })

export default function WspomnikDashboard({ user, setHeaderExtras }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [search, setSearch]   = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [category, setCategory] = useState(null)
  const [shuffle, setShuffle] = useState(0)
  const [reading, setReading] = useState(null)  // id oglądanego wpisu
  const [form, setForm]       = useState(null)  // null | 'new' | wpis do edycji

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'remembrances'), orderBy('date', 'desc'), limit(1000))
    return onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, bladSubskrypcji(WSPOMNIK_COLLECTION, { przyBledzie: () => setLoading(false) }))
  }, [user.uid])

  useEffect(() => {
    setHeaderExtras?.(
      <button className="hdr-btn" title="Szukaj" onClick={() => setShowSearch(v => !v)}>
        <IconSearch size={16} />
      </button>
    )
    return () => setHeaderExtras?.(null)
  }, [])

  const today = TODAY()
  const all = useMemo(() => sortEntries(entries), [entries])
  const stats = useMemo(() => wspomnikStats(entries, today), [entries, today])
  const thisDay = useMemo(() => onThisDay(entries, today), [entries, today])
  const filtering = !!(search.trim() || category)
  const shown = useMemo(() => filterEntries(all, { search, category }), [all, search, category])
  const years = useMemo(() => groupByYear(shown), [shown])
  // Czytnik chodzi po tym, co widać — przy filtrze tylko po wynikach.
  const readerList = filtering ? sortEntries(shown) : all

  // Przypominajka: jeden losowy wpis na dzień (albo kolejny po „losuj”).
  // Gdy jest coś „tego dnia” sprzed lat — to ma pierwszeństwo.
  const reminder = useMemo(
    () => pickBySeed(all, daySeed(today) + shuffle),
    [all, today, shuffle]
  )
  const usedCategories = CATEGORIES.filter(c => entries.some(e => e.category === c.id))

  const remove = async (entry) => {
    const ok = await confirmDialog({ title: 'Usunąć wspomnienie?', message: entry.title })
    if (!ok) return
    setReading(null)
    await deleteDoc(doc(db, 'users', user.uid, 'remembrances', entry.id))
      .catch(() => toast.error('Nie udało się usunąć'))
  }

  if (loading) return <div className="list-loading">Ładowanie...</div>

  return (
    <div className="wspomnik-dashboard">

      <StatTiles tiles={[
        { label: 'Wspomnień', value: stats.total },
        { label: 'W tym roku', value: stats.year },
        { label: 'Wysłuchane modlitwy', value: stats.answered },
      ]} />

      <button className="btn-primary wsp-add" onClick={() => setForm('new')}>
        <IconPlus size={16} /> Zapisz, co Bóg zrobił
      </button>

      {/* TEGO DNIA — wydarzenia z tego samego dnia w poprzednich latach */}
      {!filtering && thisDay.length > 0 && (
        <div className="recall-card">
          <div className="recall-head">
            <span className="recall-kicker"><IcStones size={12} /> Tego dnia</span>
          </div>
          {thisDay.map(e => (
            <button key={e.id} className="recall-body" onClick={() => setReading(e.id)}>
              <span className="recall-text">{e.title}</span>
              <span className="recall-date" style={{ textTransform: 'none' }}>{yearsAgoLabel(e.yearsAgo)} · {fullDate(e.date)}</span>
            </button>
          ))}
        </div>
      )}

      {/* PRZYPOMINAJKA — po to się to zapisuje: żeby wracać */}
      {!filtering && thisDay.length === 0 && reminder && (
        <div className="recall-card">
          <div className="recall-head">
            <span className="recall-kicker"><IcStones size={12} /> Pamiętasz?</span>
            {all.length > 1 && (
              <div className="recall-actions">
                <button className="recall-btn" title="Wylosuj inne"
                  onClick={() => setShuffle(n => n + 1)}><IconRepeat size={13} /></button>
              </div>
            )}
          </div>
          <button className="recall-body" onClick={() => setReading(reminder.id)}>
            <span className="recall-text">{reminder.title}</span>
            <span className="recall-date">{fullDate(reminder.date)}</span>
          </button>
        </div>
      )}

      {showSearch && (
        <div style={{ position: 'relative' }}>
          <IconSearch size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="search" className="form-input" autoFocus placeholder="Szukaj we wspomnieniach..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>
      )}

      {usedCategories.length > 1 && (
        <div className="wsp-filters">
          <button className={`chip${!category ? ' active' : ''}`} onClick={() => setCategory(null)}>Wszystkie</button>
          {usedCategories.map(c => (
            <button key={c.id} className={`chip${category === c.id ? ' active' : ''}`}
              onClick={() => setCategory(category === c.id ? null : c.id)}>{c.label}</button>
          ))}
        </div>
      )}

      {years.length === 0 ? (
        <div className="list-empty">
          <p style={{ marginBottom: 8, opacity: 0.4, display: 'flex', justifyContent: 'center' }}><IcStones size={32} /></p>
          {filtering ? <p>Nic nie znaleziono</p> : (
            <>
              <p>„Aż dotąd pomagał nam Pan”</p>
              <p className="list-empty-hint">1 Sm 7,12 · Zapisz pierwszą rzecz, którą Bóg dla Ciebie zrobił — żeby o niej nie zapomnieć</p>
            </>
          )}
        </div>
      ) : (
        years.map(g => (
          <div key={g.year} className="wsp-year">
            <div className="grat-day-head">
              <span className="grat-day-label">{g.year}</span>
              <span className="grat-day-count">{g.items.length}</span>
            </div>
            <div className="wsp-list">
              {g.items.map(e => (
                <button key={e.id} className="wsp-card" onClick={() => setReading(e.id)}>
                  <span className="wsp-card-meta">
                    {format(parseISO(e.date), 'd MMMM', { locale: pl })}
                    {e.category && <span className="wsp-tag">{categoryLabel(e.category)}</span>}
                  </span>
                  <span className="wsp-card-title">{e.title}</span>
                  {e.text && <span className="wsp-card-text">{e.text}</span>}
                  {e.verse && <span className="wsp-card-verse"><IconBook size={11} /> {e.verse}</span>}
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {reading && (
        <WspomnikReader
          all={readerList}
          id={reading}
          onGo={setReading}
          onClose={() => setReading(null)}
          onEdit={(e) => { setReading(null); setForm(e) }}
          onDelete={remove}
        />
      )}

      {form && (
        <WspomnikForm
          user={user}
          editData={form === 'new' ? null : form}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  )
}

/* Formularz: dodawanie i edycja wspomnienia */
function WspomnikForm({ user, editData, onClose }) {
  const [title, setTitle]       = useState(editData?.title || '')
  const [text, setText]         = useState(editData?.text || '')
  const [date, setDate]         = useState(editData?.date || TODAY())
  const [category, setCategory] = useState(editData?.category || null)
  const [verse, setVerse]       = useState(editData?.verse || '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e) => {
    e?.preventDefault()
    const data = buildEntry({ title, text, date, category, verse })
    if (!data) { setError('Napisz krótko, co Bóg zrobił'); return }
    if (!data.date) { setError('Wybierz datę'); return }
    setSaving(true)
    try {
      if (editData) {
        await updateDoc(doc(db, 'users', user.uid, 'remembrances', editData.id), { ...data, updatedAt: Timestamp.now() })
      } else {
        await addDoc(collection(db, 'users', user.uid, 'remembrances'), { ...data, createdAt: Timestamp.now() })
      }
      onClose()
    } catch {
      setError('Nie udało się zapisać')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{editData ? 'Edytuj wspomnienie' : 'Co Bóg zrobił?'}</h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>W skrócie</label>
            <input type="text" className="form-input" autoFocus value={title}
              onChange={e => setTitle(e.target.value)} maxLength={150}
              placeholder="np. Dostałam pracę, o którą się modliłam" />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Cała historia (opcjonalnie)</label>
            <textarea className="form-input" rows={5} value={text}
              onChange={e => setText(e.target.value)} maxLength={5000}
              placeholder="Jak to było? Co się działo wcześniej, jak Bóg zadziałał..."
              style={{ resize: 'vertical', minHeight: 110, fontFamily: 'inherit', lineHeight: 1.55 }} />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Kiedy</label>
            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Rodzaj (opcjonalnie)</label>
            <div className="wsp-filters">
              {CATEGORIES.map(c => (
                <button key={c.id} type="button" className={`chip${category === c.id ? ' active' : ''}`}
                  onClick={() => setCategory(category === c.id ? null : c.id)}>{c.label}</button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Słowo, werset (opcjonalnie)</label>
            <input type="text" className="form-input" value={verse}
              onChange={e => setVerse(e.target.value)} maxLength={300}
              placeholder="np. Flp 4,19 — Bóg mój zaspokoi każdą waszą potrzebę" />
          </div>

          {error && <p className="form-error" style={{ margin: 0 }}>{error}</p>}

          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz' : 'Zapisz wspomnienie'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* Czytnik jednego wspomnienia ze strzałkami — przez całą historię */
function WspomnikReader({ all, id, onGo, onClose, onEdit, onDelete }) {
  const { index, total, prev, next } = neighbors(all, id)
  const entry = all[index]
  useEffect(() => { if (!entry) onClose() }, [entry, onClose])
  if (!entry) return null
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal reader-modal">
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IcStones size={17} /> Wspomnienie
          </h3>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="t-btn" title="Edytuj" onClick={() => onEdit(entry)}><IconEdit size={14} /></button>
            <button className="t-btn delete" title="Usuń" onClick={() => onDelete(entry)}><IconTrash size={14} /></button>
            <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
          </div>
        </div>
        <div className="reader-body">
          <div className="reader-date">
            {fullDate(entry.date)}{entry.category ? ` · ${categoryLabel(entry.category)}` : ''}
          </div>
          <p className="reader-text">{entry.title}</p>
          {entry.text && <p className="wsp-reader-story">{entry.text}</p>}
          {entry.verse && <p className="wsp-reader-verse"><IconBook size={13} /> {entry.verse}</p>}
        </div>
        <div className="reader-nav">
          <button className="reader-nav-btn" disabled={!prev} onClick={() => prev && onGo(prev.id)}>
            <IconChevronLeft size={16} /> Nowsze
          </button>
          <span className="reader-count">{index + 1} z {total}</span>
          <button className="reader-nav-btn" disabled={!next} onClick={() => next && onGo(next.id)}>
            Starsze <IconChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
