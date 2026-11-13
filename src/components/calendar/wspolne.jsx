
// Konfiguracja i drobne pomocniki używane przez kilka widoków Kalendarza.
// Osobny plik zamiast importów „w bok" między widokami — tak nie powstaje
// cykl importów przy kolejnym podziale.
import { APP_COLORS } from '../../utils/palette'

export const DEFAULT_CATEGORIES = [
  { slug: 'work',     label: 'Praca',     icon: 'IcBriefcase', color: '#3b82f6' },
  { slug: 'home',     label: 'Dom',       icon: 'IcSofa',      color: '#10b981' },
  { slug: 'health',   label: 'Zdrowie',   icon: 'IconHeart',   color: '#ef4444' },
  { slug: 'birthday', label: 'Urodziny',  icon: 'IcCake',      color: '#f59e0b' },
  { slug: 'study',    label: 'Nauka',     icon: 'IcBookOpen',  color: '#8b5cf6' },
  { slug: 'sport',    label: 'Sport',     icon: 'IcDumbbell',  color: '#14b8a6' },
  { slug: 'family',   label: 'Rodzina',   icon: 'IcUsersGrp',  color: '#ec4899' },
  { slug: 'meeting',  label: 'Spotkania', icon: 'IcHandshake', color: '#6366f1' },
  { slug: 'travel',   label: 'Wyjazdy',   icon: 'IcPlane',     color: '#C94B28' },
  { slug: 'finance',  label: 'Finanse',   icon: 'IcWallet',    color: '#84cc16' },
  { slug: 'prayer',   label: 'Modlitwa',  icon: 'IcPray',      color: '#a78bfa' },
  { slug: 'other',    label: 'Inne',      icon: 'IconMore',    color: '#607D8B' },
]

export const PRAYER_WINDOWS = [
  { id: 'day-of', label: 'Tylko w dniu' },
  { id: 'around', label: 'Dzień przed, w dniu i po' },
  { id: 'until',  label: 'Od dziś do dnia' },
  { id: 'custom', label: 'Własny zakres' },
]
export const PRAYER_PRIOS = [
  { v: 5, label: 'Pilna',   color: '#ef4444' },
  { v: 4, label: 'Wysoka',  color: '#f97316' },
  { v: 3, label: 'Średnia', color: '#f59e0b' },
  { v: 2, label: 'Niska',   color: '#3b82f6' },
  { v: 1, label: 'Mała',    color: '#9E9E9E' },
]

// Paleta kategorii = wspólna paleta aplikacji (50 kolorów, 10 w rzędzie).
export const CAT_COLORS = APP_COLORS
export const WEEKDAYS = ['Pn','Wt','Śr','Cz','Pt','So','Nd']

export const findCat = (cats, id)   => cats.find(c => c.id === id)
export const findPerson = (ppl, id)    => ppl.find(p => p.id === id)
export const getEventColor = (cats, ppl, e) =>
  findPerson(ppl, e.personId)?.color || findCat(cats, e.categoryId)?.color || e.color || '#607D8B'
// Etykieta „kogo dotyczy": osoba z systemu Osób lub wolny tekst `who`
// Wydarzenie należy do osoby, gdy jest jej „główną" osobą albo jedną z oznaczonych
// (`peopleIds` — spotkania zakładane ze wpisu nastroju mają kilka osób naraz).
export const eventHasPerson = (e, id) => e.personId === id || (e.peopleIds || []).includes(id)
export const whoOf = (e) => e.personName || e.who || ''

export const kicker = (t) => (
  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{ display: 'inline-block', width: 14, height: 2, borderRadius: 2, background: 'var(--accent)', opacity: 0.6 }} />
    {t}
  </div>
)

/* ─── PersonBubble ─────────────────────────────────────────────────────── */
