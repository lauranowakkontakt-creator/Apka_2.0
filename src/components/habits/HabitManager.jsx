import { useState } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import SegTabs from '../SegTabs'
import { CatIcon, IconClose, IconEdit, IconPlus, IconSearch, IconChevronRight } from '../Icons'
import HabitForm from './HabitForm'
import { byHabitOrder, habitLifecycle, isRequiredHabit, isOptionalHabit } from '../../utils/habitLogic'

// Lista WSZYSTKICH nawyków do edycji — także tych, które jeszcze nie wystartowały
// (np. start za tydzień), już się skończyły albo siedzą w archiwum. Wcześniej
// edycja szła tylko przez klik w kafelek na liście dnia, więc nawyku z datą
// startu w przyszłości nie dało się ruszyć, dopóki ta data nie nadeszła.

const DAY_LABELS = { 1: 'pn', 2: 'wt', 3: 'śr', 4: 'cz', 5: 'pt', 6: 'so', 0: 'nd' }
const DAY_ORDER  = [1, 2, 3, 4, 5, 6, 0]

const fmtDate = (d) => format(new Date(d + 'T12:00:00'), 'd MMM yyyy', { locale: pl })

// Krótki opis harmonogramu („codziennie", „pn, śr, pt")
function freqLabel(habit) {
  const days = habit.frequencyDays || [0, 1, 2, 3, 4, 5, 6]
  if (days.length === 7) return 'codziennie'
  if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) return 'pon–pt'
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'sob–nd'
  return DAY_ORDER.filter(d => days.includes(d)).map(d => DAY_LABELS[d]).join(', ')
}

// Sekcje listy — najpierw to, czego nie dało się dotąd edytować (zaplanowane).
const SECTIONS = [
  { id: 'planned',  title: 'Zaplanowane', hint: 'jeszcze się nie zaczęły' },
  { id: 'active',   title: 'Aktywne',     hint: null },
  { id: 'ended',    title: 'Zakończone',  hint: 'po dacie zakończenia' },
  { id: 'archived', title: 'Archiwum',    hint: null },
]

export default function HabitManager({ user, habits = [], categories = [], onClose }) {
  const [search, setSearch]   = useState('')
  const [editing, setEditing] = useState(null)   // nawyk w edycji
  const [adding, setAdding]   = useState(false)  // nowy nawyk
  const [rodzaj, setRodzaj]   = useState('required')  // nawyki / wyzwania

  const today = format(new Date(), 'yyyy-MM-dd')
  const q = search.trim().toLowerCase()
  // Nawyki i wyzwania trzymamy w osobnych zakladkach — na ekranach tez sa
  // rozdzielone, wiec wspolna lista mieszala rzeczy, ktorych nigdzie nie widac
  // obok siebie. Sekcje cyklu zycia (zaplanowane / aktywne / ...) zostaja
  // wewnatrz kazdej zakladki.
  const wszystkie = [...habits].filter(h => !q || (h.name || '').toLowerCase().includes(q))
  const wyzwaniaAll = habits.filter(isOptionalHabit)
  const list = wszystkie
    .filter(rodzaj === 'optional' ? isOptionalHabit : isRequiredHabit)
    .sort(byHabitOrder)

  const groups = Object.fromEntries(SECTIONS.map(s => [s.id, []]))
  list.forEach(h => groups[habitLifecycle(h, today)].push(h))

  const badgeFor = (habit, kind) => {
    if (kind === 'planned') return { text: `start ${fmtDate(habit.startDate)}`, color: 'var(--warn)' }
    if (kind === 'ended')   return { text: `do ${fmtDate(habit.endDate)}`,      color: 'var(--text-muted)' }
    if (kind === 'archived') return { text: 'zarchiwizowany',                   color: 'var(--text-muted)' }
    return null
  }

  const row = (habit, kind) => {
    const color = habit.color || 'var(--accent)'
    const cat   = categories.find(c => c.id === habit.category)
    const badge = badgeFor(habit, kind)
    const dim   = kind === 'archived' || kind === 'ended'
    return (
      <button key={habit.id} type="button" onClick={() => setEditing(habit)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
          background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)',
          opacity: dim ? 0.62 : 1,
        }}>
        <span style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center',
          background: color + '1c', border: `1px solid ${color}40`, color,
        }}>
          <CatIcon categoryId={null} emoji={habit.emoji} size={15} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {habit.name}
          </span>
          <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[cat?.label, freqLabel(habit), habit.optional === true ? 'wyzwanie' : null].filter(Boolean).join(' · ')}
          </span>
          {badge && (
            <span className="mono" style={{ display: 'inline-block', marginTop: 4, fontSize: 9.5, letterSpacing: '.04em', textTransform: 'uppercase', color: badge.color }}>
              {badge.text}
            </span>
          )}
        </span>
        <span style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
          <IconChevronRight size={15} />
        </span>
      </button>
    )
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconEdit size={16} /> Edytuj nawyki</h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <div className="form">
          <p className="pause-info">
            Wszystkie nawyki w jednym miejscu — także te, które zaczynają się dopiero za jakiś czas,
            już się skończyły albo są w archiwum. Kliknij nawyk, żeby go zmienić.
          </p>

          {wyzwaniaAll.length > 0 && (
            <SegTabs
              items={[
                { id: 'required', label: `Nawyki (${habits.filter(isRequiredHabit).length})` },
                { id: 'optional', label: `Wyzwania (${wyzwaniaAll.length})` },
              ]}
              active={rodzaj} onChange={setRodzaj} style={{ marginBottom: 12 }}
            />
          )}

          {habits.length > 6 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <IconSearch size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input type="text" className="form-input" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Szukaj nawyku..." style={{ margin: 0, flex: 1 }} />
            </div>
          )}

          <button type="button" className="btn-outline" style={{ width: '100%', marginBottom: 12 }} onClick={() => setAdding(true)}>
            <IconPlus size={14} /> Nowy nawyk
          </button>

          {list.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {habits.length === 0
                ? 'Nie masz jeszcze żadnych nawyków.'
                : q ? 'Nic nie pasuje do szukanej nazwy.'
                  : rodzaj === 'optional' ? 'Nie masz żadnych wyzwań.' : 'Nie masz zwykłych nawyków — same wyzwania.'}
            </p>
          ) : SECTIONS.map(sec => groups[sec.id].length === 0 ? null : (
            <div key={sec.id} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 7 }}>
                {sec.title} ({groups[sec.id].length}){sec.hint ? ` — ${sec.hint}` : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {groups[sec.id].map(h => row(h, sec.id))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(editing || adding) && (
        <HabitForm user={user} editData={editing}
          onClose={() => { setEditing(null); setAdding(false) }} />
      )}
    </div>
  )
}
