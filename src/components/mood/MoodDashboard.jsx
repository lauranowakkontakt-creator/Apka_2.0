import { useState, useEffect, useMemo } from 'react'
import { collection, query, addDoc, deleteDoc, doc, Timestamp, orderBy } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import StatTiles from '../StatTiles'
import { format, startOfMonth, getDaysInMonth, addDays, subMonths, addMonths } from 'date-fns'
import { pl } from 'date-fns/locale'
import { LineAreaSVG, DonutStat, BarChartSVG } from '../ChartPrimitives'
import { IconTrash, IconChevronLeft, IconChevronRight, IconPlus, IconClose, IconChart } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { ALL_EMOTIONS } from './EmotionWheel'
import SegTabs from '../SegTabs'
import { Rozwijana, RokWPikselach } from '../Analityka'
import { wpisyOkresu, statystykiNastroju, podsumowanieLat } from '../../utils/moodStats'
import { bladSubskrypcji } from '../../utils/polaczenie'

// Skala pomocnicza: wewnętrznie nastrój to 1–5, ale średnią pokazujemy 1–10
const to10 = (v) => (v > 0 ? ((v - 1) / 4) * 9 + 1 : 0)
const fmt10 = (v) => to10(v).toFixed(1).replace('.', ',')

// Własne emocje / kategorie ocen — trzymane lokalnie (reużywalne między wpisami)
const CUSTOM_COLORS = ['#E6C04A', '#5FBF98', '#3B82F6', '#EC4899', '#9B7CF0', '#14B8A6', '#F97316', '#84CC16', '#06B6D4', '#E0673E']
function loadCustom(key) { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } }
function saveCustom(key, arr) { try { localStorage.setItem(key, JSON.stringify(arr)) } catch { /* ignore */ } }
const EMO_KEY = 'mw_moodEmotions'
const CAT_KEY = 'mw_moodRatingCats'

// ── 5-stopniowa skala nastroju ────────────────────────────────────────────────
const MOODS = [
  { id: 'awful',   label: 'okropny',  value: 1, color: '#E05A2B' },
  { id: 'bad',     label: 'źle',      value: 2, color: '#F59E0B' },
  { id: 'ok',      label: 'ok',       value: 3, color: '#94A3B8' },
  { id: 'good',    label: 'dobrze',   value: 4, color: '#5FBF98' },
  { id: 'great',   label: 'świetnie', value: 5, color: '#3B82F6' },
]

// ── Oceny dnia 1–5 w kategoriach ──────────────────────────────────────────────
export const RATING_CATS = [
  { id: 'sen',     label: 'Sen',     color: '#7C8AF0' },
  { id: 'energia', label: 'Energia', color: '#E0B15A' },
  { id: 'spokój',  label: 'Spokój',  color: '#5FBF98' },
  { id: 'relacje', label: 'Relacje', color: '#EC4899' },
]

// Emocje do wyboru (pigułki) — prosty, czytelny zestaw zamiast koła Plutchika
const PILL_EMOTIONS = [
  { id: 'spokój',      label: 'spokój',      color: '#5FBF98' },
  { id: 'wdzięczność', label: 'wdzięczność', color: '#9B7CF0' },
  { id: 'radość',      label: 'radość',      color: '#E6C04A' },
  { id: 'ciekawość',   label: 'ciekawość',   color: '#3B82F6' },
  { id: 'miłość',      label: 'miłość',      color: '#E8607A' },
  { id: 'nadzieja',    label: 'nadzieja',    color: '#14B8A6' },
  { id: 'duma',        label: 'duma',        color: '#F97316' },
  { id: 'ulga',        label: 'ulga',        color: '#84CC16' },
  { id: 'zmęczenie',   label: 'zmęczenie',   color: '#06B6D4' },
  { id: 'frustracja',  label: 'frustracja',  color: '#E0673E' },
  { id: 'lęk',         label: 'lęk',         color: '#8B5CF6' },
  { id: 'smutek',      label: 'smutek',      color: '#6E89DE' },
  { id: 'złość',       label: 'złość',       color: '#E66A4E' },
  { id: 'samotność',   label: 'samotność',   color: '#9FB2EC' },
  { id: 'stres',       label: 'stres',       color: '#D98B5F' },
]
// Stare chipy — fallback dla wpisów sprzed pigułek
const LEGACY_EMOTIONS = [
  { id: 'przerażenie', label: 'przerażenie', color: '#339666' },
]

function MoodFace({ mood, size = 30, active }) {
  const col = active ? mood.color : 'var(--text-muted)'
  const mouths = {
    awful:   'M9,17 Q16,11 23,17',
    bad:     'M9,17 Q16,13 23,17',
    ok:      'M9,15 L23,15',
    good:    'M9,15 Q16,18 23,15',
    great:   'M9,14 Q16,20 23,14',
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11.5" cy="11.5" r="1.5" fill={col} stroke="none" />
      <circle cx="20.5" cy="11.5" r="1.5" fill={col} stroke="none" />
      <path d={mouths[mood.id] || mouths.ok} />
    </svg>
  )
}

const TODAY = () => format(new Date(), 'yyyy-MM-dd')

function findEmotion(id) {
  return PILL_EMOTIONS.find(e => e.id === id)
    || loadCustom(EMO_KEY).find(e => e.id === id)
    || ALL_EMOTIONS.find(e => e.id === id)
    || LEGACY_EMOTIONS.find(e => e.id === id)
    || { id, label: id, color: '#9A9DB5' }
}

function findRatingCat(id) {
  return RATING_CATS.find(c => c.id === id)
    || loadCustom(CAT_KEY).find(c => c.id === id)
    || { id, label: id, color: '#9A9DB5' }
}

// Mały „+ dodaj" zamieniający się w pole tekstowe — do własnych emocji/kategorii
function AddChip({ onAdd, placeholder = 'nowa…' }) {
  const [open, setOpen] = useState(false)
  const [val, setVal]   = useState('')
  const submit = () => { const t = val.trim(); if (t) onAdd(t); setVal(''); setOpen(false) }
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 99, fontSize: 12.5,
      cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: 'var(--surface2)',
      border: '1px dashed var(--border-strong)', color: 'var(--text-muted)',
    }}><IconPlus size={13} /> dodaj</button>
  )
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input autoFocus value={val} onChange={e => setVal(e.target.value)} maxLength={20}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } if (e.key === 'Escape') setOpen(false) }}
        placeholder={placeholder}
        style={{ width: 120, padding: '6px 10px', borderRadius: 99, fontSize: 12.5, fontFamily: 'inherit',
          background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--text)', outline: 'none' }} />
      <button type="button" onClick={submit} style={{ padding: '6px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700,
        cursor: 'pointer', fontFamily: 'inherit', background: 'var(--accent)', color: 'var(--bg)', border: 'none' }}>OK</button>
    </span>
  )
}

const kicker = (t, extra) => (
  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.18em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, ...extra }}>
    <span style={{ display: 'inline-block', width: 14, height: 2, borderRadius: 2, background: 'var(--accent)', opacity: 0.6 }} />
    {t}
  </div>
)

// ── Root component ────────────────────────────────────────────────────────────
export default function MoodDashboard({ user, setHeaderExtras }) {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [entryDate, setEntryDate] = useState(null) // otwiera modal wpisu dla danego dnia
  const [selDate, setSelDate]     = useState(TODAY()) // wybrany dzień (kalendarz) — dzielony z „+" w rogu
  const [view, setView]           = useState('main') // main | stats (analiza pod ikoną w belce)
  useFallbackTimeout(() => setLoading(false))

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'moodLogs'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, bladSubskrypcji('moodLogs'))
  }, [user.uid])

  // Górna belka („Apka"): [analiza][＋ Dodaj] — spójnie z innymi modułami.
  // „+” jest ostatni (przy ustawieniach). Hook przed early-returnem (zasady hooków).
  useEffect(() => {
    setHeaderExtras?.(
      <>
        <button className="hdr-btn" title="Analiza i statystyki" onClick={() => setView('stats')}>
          <IconChart size={17} />
        </button>
        <button className="hdr-btn accent" title="Dodaj wpis nastroju"
          onClick={() => setEntryDate(selDate <= TODAY() ? selDate : TODAY())}>
          <IconPlus size={17} />
        </button>
      </>
    )
    return () => setHeaderExtras?.(null)
  }, [selDate])

  const handleDelete = async (id) => {
    const ok = await confirmDialog({ title: 'Usunąć wpis nastroju?' })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'moodLogs', id))
  }

  if (loading) return <div className="list-loading">Ładowanie...</div>

  const entryLabel = entryDate ? format(new Date(entryDate + 'T12:00:00'), 'd MMMM', { locale: pl }) : ''

  return (
    <div className="mood-dashboard">
      {view === 'stats' && (
        <div className="rev-subhead">
          <button className="rev-back" onClick={() => setView('main')} title="Wróć"><IconChevronLeft size={18} /></button>
          <div className="rev-subhead-title">Analiza i statystyki</div>
        </div>
      )}
      <MoodPage user={user} logs={logs} onDelete={handleDelete} selDate={selDate} setSelDate={setSelDate}
        view={view} onAddEntry={(d) => setEntryDate(d <= TODAY() ? d : TODAY())} />

      {/* Modal wpisu — emocje / jak się masz / ocena dnia otwierane spod „+" */}
      {entryDate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEntryDate(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3 style={{ textTransform: 'capitalize' }}>{entryDate === TODAY() ? 'Nowy wpis · dziś' : `Wpis · ${entryLabel}`}</h3>
              <button className="modal-close" onClick={() => setEntryDate(null)}><IconClose size={16} /></button>
            </div>
            <MoodEntryForm key={entryDate} user={user} date={entryDate} onSaved={() => setEntryDate(null)} />
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   FORMULARZ WPISU — wielokrotnego użytku (Dziś + Kalendarz)
   ============================================================ */
function MoodEntryForm({ user, date, onSaved }) {
  const [mood, setMood]         = useState(null)
  const [emotions, setEmotions] = useState(new Set())
  const [ratings, setRatings]   = useState({})
  const [note, setNote]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [customEms, setCustomEms]   = useState(() => loadCustom(EMO_KEY))
  const [customCats, setCustomCats] = useState(() => loadCustom(CAT_KEY))

  const isToday = date === TODAY()

  const slug = (s) => s.toLowerCase().trim()
  const addEmotion = (label) => {
    const id = slug(label)
    if (!id) return
    if (![...PILL_EMOTIONS, ...customEms].some(e => e.id === id)) {
      const next = [...customEms, { id, label: id, color: CUSTOM_COLORS[customEms.length % CUSTOM_COLORS.length] }]
      setCustomEms(next); saveCustom(EMO_KEY, next)
    }
    setEmotions(prev => new Set(prev).add(id))
  }
  const addCat = (label) => {
    const id = slug(label)
    if (!id || [...RATING_CATS, ...customCats].some(c => c.id === id)) return
    const next = [...customCats, { id, label, color: CUSTOM_COLORS[(RATING_CATS.length + customCats.length) % CUSTOM_COLORS.length] }]
    setCustomCats(next); saveCustom(CAT_KEY, next)
  }
  const allEmotions = [...PILL_EMOTIONS, ...customEms]
  const allCats = [...RATING_CATS, ...customCats]

  const handleSave = async () => {
    if (!mood) return
    setSaving(true)
    const mObj = MOODS.find(m => m.id === mood)
    const cleanRatings = Object.fromEntries(Object.entries(ratings).filter(([, v]) => v > 0))
    try {
      await addDoc(collection(db, 'users', user.uid, 'moodLogs'), {
        date,
        time: isToday ? format(new Date(), 'HH:mm') : null,
        mood,
        moodValue: mObj.value,
        moodLabel: mObj.label,
        moodColor: mObj.color,
        emotions: Array.from(emotions),
        ratings: cleanRatings,
        note: note.trim(),
        createdAt: Timestamp.now(),
      })
      setMood(null); setEmotions(new Set()); setRatings({}); setNote('')
      onSaved?.()
    } finally { setSaving(false) }
  }

  const toggleEmotion = (id) => {
    if (id === null) { setEmotions(new Set()); return }
    setEmotions(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const dateLabel = format(new Date(date + 'T12:00:00'), 'd MMM', { locale: pl })

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Nastrój */}
      <div>
        {kicker(isToday ? 'Jak się masz teraz?' : `Jak się miałaś · ${dateLabel}?`, { marginBottom: 14 })}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {MOODS.map(m => {
            const active = mood === m.id
            return (
              <button key={m.id} onClick={() => setMood(active ? null : m.id)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '9px 4px', borderRadius: 12, cursor: 'pointer',
                background: active ? m.color + '33' : m.color + '14',
                border: `2px solid ${active ? m.color : m.color + '55'}`,
                transform: active ? 'translateY(-2px)' : 'none',
                boxShadow: active ? `0 6px 16px -8px ${m.color}` : 'none',
                transition: 'all .2s cubic-bezier(.34,1.4,.64,1)',
              }}>
                <MoodFace mood={m} size={28} active />
                <span style={{
                  fontSize: 11, fontWeight: active ? 700 : 500,
                  color: m.color, letterSpacing: '.01em',
                }}>{m.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Emocje — wybierz kilka lub dodaj własną */}
      <div>
        {kicker('Emocje · wybierz kilka', { marginBottom: 12 })}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {allEmotions.map(em => {
            const on = emotions.has(em.id)
            return (
              <button key={em.id} onClick={() => toggleEmotion(em.id)} style={{
                padding: '7px 14px', borderRadius: 99, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: on ? 700 : 500,
                background: on ? em.color + '26' : em.color + '12',
                border: `1px solid ${on ? em.color : em.color + '40'}`,
                color: em.color, transition: 'all .15s',
              }}>{em.label}</button>
            )
          })}
          <AddChip onAdd={addEmotion} placeholder="emocja…" />
        </div>
      </div>

      {/* Oceny dnia 1–5 (+ własne kategorie) */}
      <div>
        {kicker('Oceń dzień · 1–5', { marginBottom: 12 })}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allCats.map(cat => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: cat.color, display: 'inline-block' }} />
                {cat.label}
              </span>
              <div style={{ display: 'flex', gap: 5 }}>
                {[1,2,3,4,5].map(v => {
                  const cur = ratings[cat.id] || 0
                  const on = v <= cur
                  return (
                    <button key={v}
                      onClick={() => setRatings(r => ({ ...r, [cat.id]: v === cur ? 0 : v }))}
                      style={{
                        width: 28, height: 28, borderRadius: 99, cursor: 'pointer',
                        border: `1.5px solid ${on ? cat.color : 'var(--border)'}`,
                        background: on ? cat.color + '2E' : 'transparent',
                        color: on ? cat.color : 'var(--text-muted)',
                        fontSize: 11, fontWeight: 700, transition: 'all .15s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{v}</button>
                  )
                })}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 2 }}><AddChip onAdd={addCat} placeholder="kategoria…" /></div>
        </div>
      </div>

      {/* Notatka */}
      <textarea
        className="form-input"
        placeholder="Jak minął dzień? Co czujesz?…"
        value={note} onChange={e => setNote(e.target.value)}
        rows={3} maxLength={400}
        style={{ margin: 0, resize: 'none', fontSize: 14 }}
      />

      {/* Zapis */}
      <button
        className="btn-save"
        onClick={handleSave}
        disabled={saving || !mood}
        style={{ opacity: !mood ? 0.4 : 1, margin: 0 }}>
        {saving ? 'Zapisywanie…' : !mood ? 'Wybierz nastrój' : isToday ? 'Zapisz nastrój' : `Zapisz wpis · ${dateLabel}`}
      </button>
    </div>
  )
}

/* ============================================================
   JEDEN WIDOK — wykres + średnia + emocje + wpis + kalendarz
   ============================================================ */
function MoodPage({ user, logs, onDelete, selDate, setSelDate, onAddEntry, view = 'main' }) {
  const [viewMode, setViewMode] = useState('month') // month | year | all
  const [month, setMonth]     = useState(new Date())
  const today = TODAY()

  const year = month.getFullYear()
  const monthStr = format(month, 'yyyy-MM')
  const monthLbl = (() => { const l = format(month, 'LLLL', { locale: pl }); return l.charAt(0).toUpperCase() + l.slice(1) })()
  const mStart = startOfMonth(month)
  const daysCount = getDaysInMonth(month)
  const monthLogs = useMemo(() => logs.filter(l => l.date.startsWith(monthStr)), [logs, monthStr])

  // Średnia + zmiana m/m (skala 1–10)
  const valid = monthLogs.filter(l => l.moodValue)
  const monthAvg = valid.length ? valid.reduce((s, l) => s + l.moodValue, 0) / valid.length : 0
  const prevStr = format(subMonths(month, 1), 'yyyy-MM')
  const prevValid = logs.filter(l => l.date.startsWith(prevStr) && l.moodValue)
  const prevAvg = prevValid.length ? prevValid.reduce((s, l) => s + l.moodValue, 0) / prevValid.length : 0
  const diff = prevAvg > 0 && monthAvg > 0 ? to10(monthAvg) - to10(prevAvg) : null

  // Wykres dzienny
  const chartData = useMemo(() => Array.from({ length: daysCount }, (_, i) => {
    const d = format(addDays(mStart, i), 'yyyy-MM-dd')
    const dl = logs.filter(l => l.date === d)
    const a = dl.length ? dl.reduce((s, l) => s + (l.moodValue || 0), 0) / dl.length : null
    return { day: String(i + 1), value: a }
  }).filter(d => d.value !== null), [logs, monthStr]) // eslint-disable-line

  // Kafelki liczą się z tego, co widać na ekranie: w kalendarzu z przeglądanego
  // miesiąca, w analizie z wybranego trybu. Wcześniej niezależnie od wszystkiego
  // pokazywały sumę wszystkich wpisów i średnią z całej historii.
  const tileMode  = view === 'main' ? 'month' : viewMode
  const tileLogs  = wpisyOkresu(logs, tileMode, tileMode === 'year' ? String(year) : monthStr)
  const tileStats = statystykiNastroju(tileLogs)
  const tileColor = tileStats.srednia
    ? MOODS.reduce((p, c) => Math.abs(c.value - tileStats.srednia) < Math.abs(p.value - tileStats.srednia) ? c : p).color
    : undefined
  const tiles = (
    <StatTiles tiles={[
      { label: 'Wpisy', value: tileStats.wpisy },
      { label: 'Średni nastrój', value: tileStats.srednia ? fmt10(tileStats.srednia) : '—', color: tileColor },
      { label: 'Dni z wpisem', value: tileStats.dni },
    ]} />
  )

  // Najczęstsze emocje — z tego samego okresu co reszta analizy
  const emoSource = wpisyOkresu(logs, viewMode, viewMode === 'year' ? String(year) : monthStr)
  const topEms = useMemo(() => {
    const c = {}
    emoSource.forEach(l => (l.emotions || []).forEach(id => { c[id] = (c[id] || 0) + 1 }))
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ ...findEmotion(id), count: n }))
  }, [emoSource])

  // Kalendarz miesiąca
  const firstDow = (mStart.getDay() + 6) % 7
  const calDays = Array.from({ length: daysCount }, (_, i) => {
    const d = format(addDays(mStart, i), 'yyyy-MM-dd')
    const dl = logs.filter(l => l.date === d)
    const avgV = dl.length ? dl.reduce((s, l) => s + (l.moodValue || 0), 0) / dl.length : null
    const mObj = avgV ? MOODS.reduce((p, c) => Math.abs(c.value - avgV) < Math.abs(p.value - avgV) ? c : p) : null
    return { date: d, dayNum: format(addDays(mStart, i), 'd'), count: dl.length, color: mObj?.color }
  })

  // Rok: średnia per miesiąc + średnia roczna
  const yearMonths = Array.from({ length: 12 }, (_, m) => {
    const ms = new Date(year, m, 1)
    const pref = format(ms, 'yyyy-MM')
    const ml = logs.filter(l => (l.date || '').startsWith(pref) && l.moodValue)
    const avgV = ml.length ? ml.reduce((s, l) => s + l.moodValue, 0) / ml.length : null
    const mObj = avgV ? MOODS.reduce((p, c) => Math.abs(c.value - avgV) < Math.abs(p.value - avgV) ? c : p) : null
    return { idx: m, label: format(ms, 'LLL', { locale: pl }), avgV, color: mObj?.color, count: ml.length }
  })
  const yearValid = logs.filter(l => (l.date || '').startsWith(String(year)) && l.moodValue)
  const yearAvg = yearValid.length ? yearValid.reduce((s, l) => s + l.moodValue, 0) / yearValid.length : 0

  const dayLogs = logs.filter(l => l.date === selDate).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  const canAdd = selDate <= today
  const selLabel = format(new Date(selDate + 'T12:00:00'), 'd MMMM yyyy', { locale: pl })

  const nav = (dir) => setMonth(m => addMonths(m, viewMode === 'year' ? dir * 12 : dir))
  const navLabel = viewMode === 'year' ? String(year) : `${monthLbl} ${year}`
  // „Łącznie" nie ma czego przewijać — zamiast strzałek podsumowanie rok po roku.
  const lata = podsumowanieLat(logs)
  // Rok w pikselach: średni nastrój każdego dnia wybranego roku
  const pixYear = year
  const pixDays = useMemo(() => {
    const sum = new Map()
    logs.forEach(l => { if (l.moodValue && (l.date || '').startsWith(String(pixYear))) { const a = sum.get(l.date) || [0, 0]; sum.set(l.date, [a[0] + l.moodValue, a[1] + 1]) } })
    return new Map([...sum].map(([k, [s, n]]) => [k, s / n]))
  }, [logs, pixYear])
  // Emocje jako wykres kołowy (donut) — czytelniejszy podział niż same słupki
  const emoDonut = (list) => (
    <DonutStat
      data={list.map(em => ({ name: em.label, value: em.count }))}
      colors={list.map(em => em.color)}
      fmtValue={v => `${v}×`}
      thickness={22}
    />
  )

  // ── WIDOK GŁÓWNY: kalendarz miesiąca + wpisy wybranego dnia ──────────────────
  if (view === 'main') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Nawigacja miesiąca (nazwa nad kalendarzem) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <button className="month-btn" style={{ width: 32, height: 32 }} onClick={() => setMonth(m => addMonths(m, -1))}><IconChevronLeft size={15} /></button>
          <span style={{ fontSize: 15, fontWeight: 700, textTransform: 'capitalize' }}>{monthLbl} {year}</span>
          <button className="month-btn" style={{ width: 32, height: 32 }} onClick={() => setMonth(m => addMonths(m, 1))}><IconChevronRight size={15} /></button>
        </div>

        {tiles}

        {/* Kalendarz miesiąca (kolor = nastrój dnia; klik wybiera dzień) */}
        <div className="card card-hover-glow" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
            {['P', 'W', 'Ś', 'C', 'P', 'S', 'N'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {Array.from({ length: firstDow }, (_, i) => <div key={'e' + i} />)}
            {calDays.map(({ date, dayNum, count, color }) => {
              const isSel = date === selDate
              const isTd = date === today
              return (
                <button key={date} onClick={() => setSelDate(date)} title={count ? `${dayNum} · ${count} wpis.` : dayNum} style={{
                  aspectRatio: '1 / 1', borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer',
                  background: color ? color + '33' : 'var(--surface2)',
                  border: `1.5px solid ${isSel ? (color || 'var(--accent)') : isTd ? 'var(--accent)' : 'transparent'}`,
                  fontSize: 12, fontWeight: isTd ? 700 : 500, color: color ? '#fff' : 'var(--text-muted)', transition: 'all .15s',
                }}>{dayNum}</button>
              )
            })}
          </div>
        </div>

        {/* Wpisy wybranego dnia + dodawanie */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            {kicker(selDate === today ? 'Wpisy dziś' : `Wpisy · ${selLabel}`)}
            {canAdd && (
              <button className="t-btn" onClick={() => onAddEntry?.(selDate)}
                style={{ width: 'auto', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
                <IconPlus size={13} /> Dodaj wpis
              </button>
            )}
          </div>
          {dayLogs.length > 0 ? (
            dayLogs.map(log => <LogEntry key={log.id} log={log} onDelete={() => onDelete(log.id)} />)
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0', margin: 0 }}>
              {canAdd ? 'Brak wpisów tego dnia' : 'Nie można dodać wpisu z przyszłości'}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── WIDOK ANALIZY: wykresy nastroju i emocji (miesiąc / rok) ─────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Tryb (Miesiąc / Rok) + wspólna nawigacja obu wykresów */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SegTabs items={[{ id: 'month', label: 'Miesiąc' }, { id: 'year', label: 'Rok' }]} active={viewMode} onChange={setViewMode} style={{ maxWidth: 300, flex: 1, minWidth: 0 }} />
        {viewMode !== 'all' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button className="month-btn" style={{ width: 30, height: 30 }} onClick={() => nav(-1)}><IconChevronLeft size={14} /></button>
            <span style={{ minWidth: 92, textAlign: 'center', fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{navLabel}</span>
            <button className="month-btn" style={{ width: 30, height: 30 }} onClick={() => nav(1)}><IconChevronRight size={14} /></button>
          </div>
        )}
      </div>

      {tiles}

      {viewMode === 'month' ? (
        <>
          {/* Nastrój w czasie */}
          <div className="card card-hover-glow" style={{ padding: 16 }}>
            {kicker('Nastrój w czasie', { marginBottom: 10 })}
            {chartData.length === 1 ? (
              <SingleMoodPreview point={chartData[0]} />
            ) : chartData.length > 1 ? (
              <LineAreaSVG
                data={chartData.map(d => ({ label: d.day, value: d.value }))}
                height={160} min={0.5} max={5.5} yTicks={[1, 2, 3, 4, 5]} accent="var(--accent)" allLabels
                fmtValue={v => MOODS.find(m => Math.abs(m.value - v) < 0.5)?.label || v.toFixed(1)}
                fmtLabel={d => `${d} ${monthLbl.toLowerCase()}`}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '30px 0' }}>Brak wpisów w tym miesiącu</div>
            )}
          </div>

          {/* Najczęstsze emocje */}
          {topEms.length > 0 && (
            <div className="card card-hover-glow" style={{ padding: 16 }}>
              {kicker('Najczęstsze emocje', { marginBottom: 12 })}
              {emoDonut(topEms)}
            </div>
          )}
        </>
      ) : viewMode === 'year' ? (
        <>
          {/* ROK: średnia nastroju miesiąc po miesiącu (1–10) — wizualny wykres słupkowy */}
          {yearValid.length > 0 && (
            <div className="card card-hover-glow" style={{ padding: 16 }}>
              {kicker(`Średnia nastroju miesięcami · ${year}`, { marginBottom: 12 })}
              <BarChartSVG
                data={yearMonths.map(m => ({ label: m.label, value: m.avgV ? Math.round(to10(m.avgV) * 10) / 10 : 0 }))}
                height={150} accent="var(--accent)" fmt={v => v ? `${v.toFixed(1).replace('.', ',')}/10` : ''}
              />
            </div>
          )}

          {/* 12 miesięcy z kolorem nastroju */}
          <div className="card card-hover-glow" style={{ padding: 16 }}>
            {kicker(`Nastrój w roku ${year}`, { marginBottom: 12 })}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
              {yearMonths.map(m => (
                <button key={m.idx} onClick={() => { setMonth(new Date(year, m.idx, 1)); setViewMode('month') }} style={{
                  padding: '10px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
                  background: m.color ? m.color + '22' : 'var(--surface2)',
                  border: `1px solid ${m.color ? m.color + '55' : 'var(--border)'}`, transition: 'all .15s',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize', color: m.color || 'var(--text-muted)' }}>{m.label}</div>
                  <div className="serif" style={{ fontSize: 20, marginTop: 4, color: m.color || 'var(--text-muted)' }}>{m.avgV ? fmt10(m.avgV) : '—'}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{m.count ? `${m.count} wpis.` : ''}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Najczęstsze emocje roku — wykres kołowy */}
          {topEms.length > 0 && (
            <div className="card card-hover-glow" style={{ padding: 16 }}>
              {kicker('Najczęstsze emocje roku', { marginBottom: 12 })}
              {emoDonut(topEms)}
            </div>
          )}
        </>
      ) : (
        <>
          {/* ŁĄCZNIE: cała historia — średnia rok po roku zamiast przewijania miesięcy */}
          {lata.length > 0 ? (
            <div className="card card-hover-glow" style={{ padding: 16 }}>
              {kicker('Nastrój rok po roku', { marginBottom: 12 })}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
                {lata.map(r => {
                  const color = r.srednia
                    ? MOODS.reduce((p, c) => Math.abs(c.value - r.srednia) < Math.abs(p.value - r.srednia) ? c : p).color
                    : null
                  return (
                    <button key={r.rok} onClick={() => { setMonth(new Date(Number(r.rok), 0, 1)); setViewMode('year') }} style={{
                      padding: '10px 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
                      background: color ? color + '22' : 'var(--surface2)',
                      border: `1px solid ${color ? color + '55' : 'var(--border)'}`, transition: 'all .15s',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: color || 'var(--text-muted)' }}>{r.rok}</div>
                      <div className="serif" style={{ fontSize: 20, marginTop: 4, color: color || 'var(--text-muted)' }}>{r.srednia ? fmt10(r.srednia) : '—'}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{r.dni} {r.dni === 1 ? 'dzień' : 'dni'}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="card card-hover-glow" style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Brak wpisów — zapisz pierwszy nastrój, a pojawi się tu podsumowanie.
            </div>
          )}

          {/* Najczęstsze emocje z całej historii */}
          {topEms.length > 0 && (
            <div className="card card-hover-glow" style={{ padding: 16 }}>
              {kicker('Najczęstsze emocje łącznie', { marginBottom: 12 })}
              {emoDonut(topEms)}
            </div>
          )}
        </>
      )}
      {/* Rok w pikselach — każdy dzień w kolorze średniego nastroju */}
      <Rozwijana id="nastroj-pix" tytul={`Rok w pikselach · ${pixYear}`} domyslnie podsumowanie={`${pixDays.size} dni`}>
        <RokWPikselach rok={pixYear} dzis={format(new Date(), 'yyyy-MM-dd')}
          kolorDnia={(k) => { const v = pixDays.get(k); return v ? MOODS.reduce((p, c) => Math.abs(c.value - v) < Math.abs(p.value - v) ? c : p).color : null }}
          opisDnia={(k) => { const v = pixDays.get(k); return v ? `średnio ${v.toFixed(1).replace('.', ',')} · ${MOODS.reduce((p, c) => Math.abs(c.value - v) < Math.abs(p.value - v) ? c : p).label}` : 'brak wpisu' }}
          legenda={MOODS.map(m => [m.color, m.label])} />
      </Rozwijana>
    </div>
  )
}

function LogEntry({ log, onDelete }) {
  const moodObj = log.mood ? MOODS.find(m => m.id === log.mood) : null
  const ratingEntries = Object.entries(log.ratings || {}).filter(([, v]) => v > 0).map(([id, v]) => ({ ...findRatingCat(id), value: v }))
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${moodObj ? moodObj.color + '44' : 'var(--border)'}`,
      borderLeft: `3px solid ${moodObj?.color || 'var(--border)'}`,
      borderRadius: 'var(--r)', padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {moodObj && <MoodFace mood={moodObj} size={20} active />}
          <span style={{ fontSize: 13, fontWeight: 600, color: moodObj?.color || 'var(--text)' }}>{log.moodLabel}</span>
          {log.time && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.time}</span>}
        </div>
        <button onClick={onDelete} className="t-btn delete"><IconTrash size={12} /></button>
      </div>
      {log.emotions?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {log.emotions.map(id => {
            const em = findEmotion(id)
            return (
              <span key={id} style={{
                padding: '2px 8px', borderRadius: 99, fontSize: 11,
                background: em.color + '22', color: em.color, border: `1px solid ${em.color}44`, fontWeight: 600,
              }}>{em.label}</span>
            )
          })}
        </div>
      )}
      {ratingEntries.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {ratingEntries.map(c => (
            <span key={c.id} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {c.label} <strong style={{ color: c.color }}>{c.value}/5</strong>
            </span>
          ))}
        </div>
      )}
      {log.note && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-sub)', fontStyle: 'italic', lineHeight: 1.5 }}>„{log.note}"</p>}
    </div>
  )
}


// Pojedynczy wpis w miesiącu — zamiast samotnej kropki na wykresie pokaż czytelną kartę
function SingleMoodPreview({ point }) {
  const mObj = MOODS.reduce((p, c) => Math.abs(c.value - point.value) < Math.abs(p.value - point.value) ? c : p)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 150, padding: '0 6px' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
        background: mObj.color + '22', border: `2px solid ${mObj.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <MoodFace mood={mObj} size={38} active />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: mObj.color }}>{mObj.label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
          Pierwszy wpis w tym miesiącu.<br />Dodaj kolejne dni, a pojawi się wykres trendu.
        </div>
      </div>
    </div>
  )
}

function AnimBar({ pct, color }) {
  const [w, setW] = useState(0)
  useEffect(() => { const id = setTimeout(() => setW(pct), 80); return () => clearTimeout(id) }, [pct])
  return <div style={{ height: '100%', borderRadius: 99, background: color, width: `${w}%`, transition: 'width .7s ease' }} />
}
