import { useState, useEffect, useMemo, useRef } from 'react'
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc, Timestamp, limit } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { format, parseISO, isToday, isYesterday, subDays, addDays } from 'date-fns'
import { pl } from 'date-fns/locale'
import { groupByDay, filterEntries, gratitudeStats, flatEntries } from '../../utils/gratitudeLogic'
import { pickBySeed, daySeed, neighbors } from '../../utils/browsing'
import StatTiles from '../StatTiles'
import { AnalizaRoku, Rozwijana } from '../Analityka'
import { IconPlus, IconTrash, IconSearch, IconCheck, IconClose, IconEdit,
  IconChevronLeft, IconChevronRight, IconRepeat, IcSun } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { toast } from '../Toast'
import { bladSubskrypcji } from '../../utils/polaczenie'

const TODAY = () => format(new Date(), 'yyyy-MM-dd')

// Nagłówek dnia: „Dziś", „Wczoraj", inaczej pełna data po polsku.
function dayLabel(dateStr) {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Dziś'
  if (isYesterday(d)) return 'Wczoraj'
  return format(d, 'EEEE, d MMMM yyyy', { locale: pl })
}

// Krótka etykieta do belki dnia: „Dziś", „Wczoraj", inaczej sam dzień
// tygodnia — pełna data stoi i tak wierszem niżej, więc nie dublujemy jej.
function shortDayLabel(dateStr) {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Dziś'
  if (isYesterday(d)) return 'Wczoraj'
  return format(d, 'EEEE', { locale: pl })
}

// Podpowiedzi, gdy pole jest puste — żeby nie patrzeć w pustkę.
const PROMPTS = [
  'Za co jesteś dziś wdzięczna?',
  'Co dziś sprawiło Ci radość?',
  'Kto dziś dla Ciebie coś zrobił?',
  'Co dziś poszło lepiej, niż się spodziewałaś?',
  'Za jaką drobną rzecz z dziś warto podziękować?',
]

export default function GratitudeDashboard({ user, setHeaderExtras }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [draft, setDraft]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [editing, setEditing] = useState(null) // { id, text }
  const [shuffle, setShuffle] = useState(0)    // ile razy dolosowano przypominajkę
  const [reading, setReading] = useState(null) // id oglądanego wpisu
  // Dzień, który dopisujemy i oglądamy. Wstecz bez ograniczeń, w przód tylko
  // do dziś — wdzięczności nie da się zapisać na zapas.
  const [viewDate, setViewDate] = useState(TODAY())
  const inputRef = useRef(null)

  useEffect(() => {
    // Limit jak w innych rosnących kolekcjach — moduł pokazuje historię,
    // ale nie ma potrzeby ciągnąć wieloletniego archiwum przy każdym wejściu.
    const q = query(collection(db, 'users', user.uid, 'gratitude'), orderBy('date', 'desc'), limit(500))
    return onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, bladSubskrypcji('gratitude', { przyBledzie: () => setLoading(false) }))
  }, [user.uid])

  const today = TODAY()
  const stats = useMemo(() => gratitudeStats(entries, today), [entries, today])
  const isTodayView = viewDate === today
  const dayItems = useMemo(
    () => groupByDay(entries.filter(e => e.date === viewDate))[0]?.items || [],
    [entries, viewDate]
  )
  // Oglądany dzień ma własną sekcję u góry, więc w historii go nie powtarzamy.
  const history = useMemo(
    () => groupByDay(filterEntries(entries, search)).filter(g => search ? true : g.date !== viewDate),
    [entries, search, viewDate]
  )

  const goBack = () => setViewDate(d => format(subDays(parseISO(d), 1), 'yyyy-MM-dd'))
  const goForward = () => setViewDate(d => {
    const next = format(addDays(parseISO(d), 1), 'yyyy-MM-dd')
    return next > TODAY() ? d : next
  })

  // Podpowiedź zmienia się wraz z liczbą dzisiejszych wpisów — bez losowania,
  // żeby nie skakała przy każdym renderze.
  const promptText = isTodayView
    ? PROMPTS[dayItems.length % PROMPTS.length]
    : 'Za co byłaś wdzięczna tego dnia?'

  // Wszystkie wpisy po kolei — do przeglądania strzałkami.
  const all = useMemo(() => flatEntries(entries), [entries])

  // Przypominajka: losowy wpis sprzed dziś. Jedna na dzień, chyba że sama
  // dolosujesz — dlatego seed to numer dnia plus licznik kliknięć.
  const older = useMemo(() => all.filter(e => e.date !== today), [all, today])
  const reminder = useMemo(
    () => pickBySeed(older, daySeed(today) + shuffle),
    [older, today, shuffle]
  )

  const add = async () => {
    const text = draft.trim()
    if (!text || saving) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'users', user.uid, 'gratitude'), {
        date: viewDate, text, createdAt: Timestamp.now(),
      })
      setDraft('')
      inputRef.current?.focus()
    } catch {
      toast.error('Nie udało się zapisać')
    }
    setSaving(false)
  }

  const remove = async (entry) => {
    const ok = await confirmDialog({ title: 'Usunąć wpis?', message: entry.text })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'gratitude', entry.id)).catch(() => {})
  }

  const saveEdit = async () => {
    const text = editing.text.trim()
    if (!text) return
    await updateDoc(doc(db, 'users', user.uid, 'gratitude', editing.id), {
      text, updatedAt: Timestamp.now(),
    }).catch(() => toast.error('Nie udało się zapisać'))
    setEditing(null)
  }

  useEffect(() => {
    setHeaderExtras?.(
      <button className="hdr-btn" title="Szukaj" onClick={() => setShowSearch(v => !v)}>
        <IconSearch size={16} />
      </button>
    )
    return () => setHeaderExtras?.(null)
  }, [])

  const wpisyRoku = entries.filter(e => e.date).map(e => ({ klucz: e.date }))

  if (loading) return <div className="list-loading">Ładowanie...</div>

  return (
    <div className="gratitude-dashboard">

      <StatTiles tiles={[
        { label: 'W tym miesiącu', value: stats.month },
        { label: 'Łącznie', value: stats.total },
        { label: 'Dni z wpisem', value: stats.days },
      ]} />

      {/* Analiza roku — zwinięta, żeby nie spychać pisania w dół.
          Liczy z ostatnich 500 wpisów (tyle ładuje moduł). */}
      <div style={{ marginBottom: 14 }}>
        <Rozwijana id="wdz-rok" tytul="Statystyki roku" podsumowanie={`${stats.month} w tym miesiącu`}>
          <AnalizaRoku id="wdz" wpisy={wpisyRoku} jednostka={['wpis', 'wpisy', 'wpisów']} kolor="#E8A33D" />
        </Rozwijana>
      </div>

      {/* Przypominajka — po to się to pisze: żeby potem wrócić */}
      {reminder && (
        <div className="recall-card">
          <div className="recall-head">
            <span className="recall-kicker"><IcSun size={12} /> Przypomnij sobie</span>
            <div className="recall-actions">
              {older.length > 1 && (
                <button className="recall-btn" title="Wylosuj inny"
                  onClick={() => setShuffle(n => n + 1)}><IconRepeat size={13} /></button>
              )}
            </div>
          </div>
          <button className="recall-body" onClick={() => setReading(reminder.id)}>
            <span className="recall-text">{reminder.text}</span>
            <span className="recall-date">{dayLabel(reminder.date)}</span>
          </button>
        </div>
      )}

      {showSearch && (
        <div style={{ position: 'relative' }}>
          <IconSearch size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="search" className="form-input" autoFocus placeholder="Szukaj we wdzięczności..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>
      )}

      {/* DZIŚ — dopisywanie. Przy aktywnym szukaniu chowamy tę sekcję: wyniki
          obejmują też dzisiejsze wpisy, więc inaczej widać je dwa razy. */}
      {!search && (
      <div className="grat-today">
        <div className="grat-today-head">
          <button className="icon-btn" onClick={goBack} title="Poprzedni dzień">
            <IconChevronLeft size={16} />
          </button>
          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <span className="grat-today-kicker"><IcSun size={13} /> {shortDayLabel(viewDate)}</span>
            <div className="grat-today-date">{format(parseISO(viewDate), 'd MMMM yyyy', { locale: pl })}</div>
            {!isTodayView && (
              <button onClick={() => setViewDate(today)}
                style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                wróć do dziś
              </button>
            )}
          </div>
          {/* W przód tylko do dziś — dalej nie ma czego zapisywać */}
          <button className="icon-btn" onClick={goForward} disabled={isTodayView}
            title={isTodayView ? 'To już dziś' : 'Następny dzień'}
            style={isTodayView ? { opacity: 0.35, cursor: 'default' } : undefined}>
            <IconChevronRight size={16} />
          </button>
        </div>

        {dayItems.length > 0 && (
          <div className="grat-list">
            {dayItems.map((e, i) => (
              <GratitudeRow
                key={e.id} entry={e} index={i + 1}
                editing={editing?.id === e.id}
                editValue={editing?.text || ''}
                onEditChange={(v) => setEditing({ id: e.id, text: v })}
                onEditStart={() => setEditing({ id: e.id, text: e.text })}
                onEditCancel={() => setEditing(null)}
                onEditSave={saveEdit}
                onDelete={() => remove(e)}
                onOpen={() => setReading(e.id)}
              />
            ))}
          </div>
        )}

        <form className="grat-add" onSubmit={(e) => { e.preventDefault(); add() }}>
          <input
            ref={inputRef}
            type="text" className="form-input" placeholder={promptText}
            value={draft} onChange={e => setDraft(e.target.value)} maxLength={200}
          />
          <button type="submit" className="grat-add-btn" disabled={!draft.trim() || saving} title="Dodaj">
            <IconPlus size={18} />
          </button>
        </form>
      </div>
      )}

      {/* HISTORIA */}
      {history.length === 0 ? (
        <div className="list-empty">
          <p style={{ marginBottom: 8, opacity: 0.4, display: 'flex', justifyContent: 'center' }}><IcSun size={32} /></p>
          <p>{search ? 'Nic nie znaleziono' : 'Historia pojawi się tutaj'}</p>
          {!search && <p className="list-empty-hint">Zapisz pierwszą rzecz, za którą jesteś dziś wdzięczna</p>}
        </div>
      ) : (
        history.map(g => (
          <div key={g.date} className="grat-day">
            <div className="grat-day-head">
              <span className="grat-day-label">{dayLabel(g.date)}</span>
              <span className="grat-day-count">{g.items.length}</span>
            </div>
            <div className="grat-list">
              {g.items.map((e, i) => (
                <GratitudeRow
                  key={e.id} entry={e} index={i + 1}
                  editing={editing?.id === e.id}
                  editValue={editing?.text || ''}
                  onEditChange={(v) => setEditing({ id: e.id, text: v })}
                  onEditStart={() => setEditing({ id: e.id, text: e.text })}
                  onEditCancel={() => setEditing(null)}
                  onEditSave={saveEdit}
                  onDelete={() => remove(e)}
                  onOpen={() => setReading(e.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {reading && (
        <GratitudeReader
          all={all}
          id={reading}
          onGo={setReading}
          onClose={() => setReading(null)}
        />
      )}
    </div>
  )
}

/* Podgląd jednego wpisu ze strzałkami — da się przejść przez całą historię
   bez zamykania okna i szukania wzrokiem następnego dnia. */
function GratitudeReader({ all, id, onGo, onClose }) {
  const { index, total, prev, next } = neighbors(all, id)
  const entry = all[index]
  // Wpis mógł zniknąć (usunięty w tle albo z innego urządzenia) — zamykamy
  // okno, zamiast zostawiać niewidoczny, zablokowany stan.
  useEffect(() => { if (!entry) onClose() }, [entry, onClose])
  if (!entry) return null
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal reader-modal">
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IcSun size={17} /> Wdzięczność
          </h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <div className="reader-body">
          <div className="reader-date">{dayLabel(entry.date)}</div>
          <p className="reader-text">{entry.text}</p>
        </div>
        <div className="reader-nav">
          <button className="reader-nav-btn" disabled={!prev} onClick={() => prev && onGo(prev.id)}>
            <IconChevronLeft size={16} /> Nowszy
          </button>
          <span className="reader-count">{index + 1} z {total}</span>
          <button className="reader-nav-btn" disabled={!next} onClick={() => next && onGo(next.id)}>
            Starszy <IconChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function GratitudeRow({ entry, index, editing, editValue, onEditChange, onEditStart, onEditCancel, onEditSave, onDelete, onOpen }) {
  if (editing) {
    return (
      <div className="grat-item editing">
        <input
          type="text" className="form-input" autoFocus value={editValue}
          onChange={e => onEditChange(e.target.value)} maxLength={200}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onEditSave() }
            if (e.key === 'Escape') { e.stopPropagation(); onEditCancel() }
          }}
        />
        <button className="t-btn" title="Zapisz" onClick={onEditSave}><IconCheck size={14} /></button>
        <button className="t-btn" title="Anuluj" onClick={onEditCancel}><IconClose size={14} /></button>
      </div>
    )
  }
  return (
    <div className="grat-item">
      <span className="grat-item-num">{index}</span>
      <button className="grat-item-text" onClick={onOpen} title="Zobacz i przeglądaj">{entry.text}</button>
      <button className="t-btn" title="Edytuj" onClick={onEditStart}><IconEdit size={13} /></button>
      <button className="t-btn delete" title="Usuń" onClick={onDelete}><IconTrash size={13} /></button>
    </div>
  )
}
