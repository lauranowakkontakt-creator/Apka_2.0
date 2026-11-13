import { useState, useEffect, useCallback } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { format } from 'date-fns'
import { db } from '../../firebase/config'
import { onSnapshot } from '../../utils/subskrypcje'
import { bladSubskrypcji } from '../../utils/polaczenie'
import { IconPlus, IconClose } from '../Icons'
import { ALL_EMOTIONS } from './EmotionWheel'
import { DOMYSLNE_CZYNNIKI } from '../../utils/moodFactors'

// Wspólne klocki modułu Nastrój: skala, emocje, czynniki, ustawienia.

// Skala pomocnicza: wewnętrznie nastrój to 1–5, ale średnią pokazujemy 1–10
export const to10 = (v) => (v > 0 ? ((v - 1) / 4) * 9 + 1 : 0)
export const fmt10 = (v) => to10(v).toFixed(1).replace('.', ',')
export const TODAY = () => format(new Date(), 'yyyy-MM-dd')

export const CUSTOM_COLORS = ['#E6C04A', '#5FBF98', '#3B82F6', '#EC4899', '#9B7CF0', '#14B8A6', '#F97316', '#84CC16', '#06B6D4', '#E0673E']

// ── 5-stopniowa skala nastroju ────────────────────────────────────────────────
export const MOODS = [
  { id: 'awful',   label: 'okropny',  value: 1, color: '#E05A2B' },
  { id: 'bad',     label: 'źle',      value: 2, color: '#F59E0B' },
  { id: 'ok',      label: 'ok',       value: 3, color: '#94A3B8' },
  { id: 'good',    label: 'dobrze',   value: 4, color: '#5FBF98' },
  { id: 'great',   label: 'świetnie', value: 5, color: '#3B82F6' },
]
// Najbliższy stopień skali dla średniej (np. 3,6 → „dobrze").
export const moodDla = (v) => MOODS.reduce((p, c) => Math.abs(c.value - v) < Math.abs(p.value - v) ? c : p)

// ── Oceny dnia 1–5 ────────────────────────────────────────────────────────────
// „Relacje" ocenia się w sekcji Relacje formularza, „Sen" ma własną zakładkę —
// obie zostają na liście, żeby stare wpisy nadal miały podpis i kolor.
export const RATING_CATS = [
  { id: 'sen',     label: 'Sen',     color: '#7C8AF0' },
  { id: 'energia', label: 'Energia', color: '#E0B15A' },
  { id: 'spokój',  label: 'Spokój',  color: '#5FBF98' },
  { id: 'relacje', label: 'Relacje', color: '#EC4899' },
]
export const RATING_W_FORMULARZU = ['energia', 'spokój']

// Stany spoza koła emocji — codzienne, których u Plutchika nie ma.
export const INNE_EMOCJE = [
  { id: 'spokój',      label: 'spokój',      color: '#5FBF98' },
  { id: 'wdzięczność', label: 'wdzięczność', color: '#9B7CF0' },
  { id: 'nadzieja',    label: 'nadzieja',    color: '#14B8A6' },
  { id: 'duma',        label: 'duma',        color: '#F97316' },
  { id: 'ulga',        label: 'ulga',        color: '#84CC16' },
  { id: 'zmęczenie',   label: 'zmęczenie',   color: '#06B6D4' },
  { id: 'stres',       label: 'stres',       color: '#D98B5F' },
  { id: 'lęk',         label: 'lęk',         color: '#8B5CF6' },
  { id: 'frustracja',  label: 'frustracja',  color: '#E0673E' },
  { id: 'samotność',   label: 'samotność',   color: '#9FB2EC' },
]

const NIEZNANE = '#9A9DB5'
export const findEmotion = (id, wlasne = []) =>
  INNE_EMOCJE.find(e => e.id === id) || wlasne.find(e => e.id === id)
  || ALL_EMOTIONS.find(e => e.id === id) || { id, label: id, color: NIEZNANE }
export const findRatingCat = (id, wlasne = []) =>
  RATING_CATS.find(c => c.id === id) || wlasne.find(c => c.id === id) || { id, label: id, color: NIEZNANE }
export const findFactor = (id, wlasne = []) =>
  DOMYSLNE_CZYNNIKI.find(c => c.id === id) || wlasne.find(c => c.id === id) || { id, label: id, color: NIEZNANE }

export function MoodFace({ mood, size = 30, active }) {
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

export const kicker = (t, extra) => (
  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.18em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, ...extra }}>
    <span style={{ display: 'inline-block', width: 14, height: 2, borderRadius: 2, background: 'var(--accent)', opacity: 0.6 }} />
    {t}
  </div>
)

// Mały „+ dodaj" zamieniający się w pole tekstowe — do własnych emocji/czynników
export function AddChip({ onAdd, placeholder = 'nowa…', label = 'dodaj' }) {
  const [open, setOpen] = useState(false)
  const [val, setVal]   = useState('')
  const submit = () => { const t = val.trim(); if (t) onAdd(t); setVal(''); setOpen(false) }
  if (!open) return (
    <button type="button" className="mood-chip add" onClick={() => setOpen(true)}><IconPlus size={13} /> {label}</button>
  )
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input autoFocus value={val} onChange={e => setVal(e.target.value)} maxLength={24}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } if (e.key === 'Escape') setOpen(false) }}
        placeholder={placeholder} className="mood-chip-input" />
      <button type="button" className="mood-chip-ok" onClick={submit}>OK</button>
    </span>
  )
}

/**
 * Pigułki wielokrotnego wyboru z własnymi pozycjami. `wlasne` można usuwać
 * w trybie „edytuj" — stare wpisy zachowują wtedy samą nazwę.
 */
export function ChipPicker({ items, wlasne = [], selected, onToggle, onAdd, onRemove, placeholder }) {
  const [edycja, setEdycja] = useState(false)
  return (
    <div className="mood-chips">
      {[...items, ...wlasne].map(it => {
        const on = selected.has(it.id)
        const swoj = wlasne.some(w => w.id === it.id)
        return (
          <button key={it.id} type="button" className={`mood-chip${on ? ' on' : ''}`} style={{ '--c': it.color }}
            onClick={() => (edycja && swoj ? onRemove?.(it.id) : onToggle(it.id))}>
            {it.label}{edycja && swoj && <IconClose size={11} />}
          </button>
        )
      })}
      {onAdd && !edycja && <AddChip onAdd={onAdd} placeholder={placeholder} />}
      {onRemove && wlasne.length > 0 && (
        <button type="button" className="mood-chip add" onClick={() => setEdycja(v => !v)}>{edycja ? 'gotowe' : 'usuń własne'}</button>
      )}
    </div>
  )
}

// Rząd 1–5 (oceny, jakość snu). Ponowne kliknięcie tej samej wartości ją zdejmuje.
export function Skala5({ value = 0, onChange, color = 'var(--accent)' }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(v => {
        const on = v <= value
        return (
          <button key={v} type="button" onClick={() => onChange(v === value ? 0 : v)} className="mood-dot"
            style={on ? { borderColor: color, background: `color-mix(in oklab, ${color} 22%, transparent)`, color } : undefined}>{v}</button>
        )
      })}
    </div>
  )
}

// ── Ustawienia modułu (własne emocje, czynniki, kategorie ocen, okresy życia) ──
// Trzymane w bazie, żeby były te same na telefonie i komputerze. Wcześniej
// siedziały w localStorage — przy pierwszym uruchomieniu przenosimy je stamtąd.
const PUSTE = { emotions: [], factors: [], ratingCats: [], okresy: [] }
const zLocal = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }

export function useMoodSettings(uid) {
  const [ust, setUst] = useState(PUSTE)
  useEffect(() => {
    const ref = doc(db, 'users', uid, 'settings', 'mood')
    return onSnapshot(ref, d => {
      if (d.exists()) { setUst({ ...PUSTE, ...d.data() }); return }
      const stare = { emotions: zLocal('mw_moodEmotions'), ratingCats: zLocal('mw_moodRatingCats') }
      if (stare.emotions.length || stare.ratingCats.length) {
        setUst({ ...PUSTE, ...stare })
        setDoc(ref, stare, { merge: true }).catch(() => { /* spróbujemy przy kolejnym wejściu */ })
      }
    }, bladSubskrypcji('settings/mood'))
  }, [uid])
  const zapisz = useCallback((zmiana) => {
    setUst(u => ({ ...u, ...zmiana }))
    return setDoc(doc(db, 'users', uid, 'settings', 'mood'), zmiana, { merge: true })
  }, [uid])
  return [ust, zapisz]
}

export const idZNazwy = (s) => s.toLowerCase().trim()
