import { normalizeTags } from '../../utils/prayerFilters'
import { checklistProgress, hasChecklist, dniTemu } from '../../utils/prayerList'
import { daysSince, findPrio, getNeglect } from '../../utils/prayerStats'
import { CatIcon, IconCalendar, IconCheck, IconEdit, IconPrayer, IconTrash } from '../Icons'
import { TODAY } from './wspolne'
import { useState } from 'react'

// Karta pojedynczej prośby wraz z listą do odhaczania.
// Największy kawałek modułu — używają go trzy widoki: „Dziś", szczegóły osoby
// i archiwum, więc siedzi w osobnym pliku, a nie w którymś z nich.

export function PrayerChecklist({ item, fs, onToggle }) {
  const items = item.checklist || []
  const done = item.checklistDone || []
  const { done: n, total, pct } = checklistProgress(items, done)
  return (
    <div className="pray-list">
      <div className="pray-list-head">
        <span className="pray-list-count">{n} z {total}</span>
        <span className="pray-list-track"><span className="pray-list-fill" style={{ width: `${pct}%` }} /></span>
      </div>
      <div className="pray-list-items">
        {items.map(it => {
          const checked = done.includes(it.id)
          return (
            <button key={it.id} type="button"
              className={`pray-list-item${checked ? ' done' : ''}`}
              aria-pressed={checked}
              onClick={() => onToggle(it.id)}>
              <span className="pray-list-box">{checked && <IconCheck size={11} />}</span>
              <span className="pray-list-text" style={{ fontSize: fs?.sub || 12 }}>{it.text}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function RequestCard({ item, user, carMode, onTogglePrayed, onAddNote, onEditNote, onDeleteNote, onToggleChecklistItem, onArchive, onEdit, onDelete, showPerson, person, viewDate }) {
  // Notatki są rozwinięte od razu: pisze się je po to, żeby przy kolejnej
  // modlitwie mieć je przed oczami, a nie żeby ich szukać za guzikiem.
  const [showNotes, setShowNotes]     = useState(true)
  const [addingNote, setAddingNote]   = useState(false)
  const [noteText, setNoteText]       = useState('')
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editNoteText, setEditNoteText]   = useState('')

  const prio       = findPrio(item.priority || 3)
  const tags       = normalizeTags(item.tags || [])
  const date       = viewDate || TODAY()
  const prayedToday = item.prayedDates?.includes(date)
  const days       = daysSince(item.prayedDates)
  const neglect    = getNeglect(prayedToday ? 0 : days)
  const isNeglected = !prayedToday && neglect.level >= 4

  const submitNote = () => {
    if (!noteText.trim()) return
    onAddNote(item.id, noteText.trim())
    setNoteText('')
    setAddingNote(false)
    setShowNotes(true)
  }

  const submitEditNote = (note) => {
    if (!editNoteText.trim()) return
    onEditNote(item, note, editNoteText.trim())
    setEditingNoteId(null)
  }

  // Tryb auto — duża osoba i treść prośby, a pod nimi szeroki przycisk
  // „Pomodlono" na całą kartę. Sama ikona w kółku była za mało oczywista i za
  // mała jak na odhaczanie kciukiem zza kierownicy; napis mówi wprost, co się
  // zaznacza, a pełna szerokość daje w co trafić bez patrzenia.
  if (carMode) {
    return (
      <div style={{
        background: prayedToday ? 'rgba(39,174,96,0.12)' : 'var(--surface)',
        border: `1px solid ${prayedToday ? '#27AE60' : 'var(--border)'}`,
        borderLeft: `5px solid ${prio.color}`,
        borderRadius: 16, padding: '16px 14px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {showPerson && person && (
              <div style={{ fontSize: 21, fontWeight: 800, color: '#8b5cf6', marginBottom: 3, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <CatIcon categoryId={null} emoji={person.icon || 'IcUsers'} size={24} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ minWidth: 0, wordBreak: 'break-word', lineHeight: 1.15 }}>{person.name}</span>
              </div>
            )}
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, wordBreak: 'break-word' }}>{item.title}</div>
            {item.prayedDates?.length > 0 && (
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconPrayer size={13} /> ×{item.prayedDates.length}
                {days === 0 && ' · dziś'}
                {days !== null && days > 0 && ` · ${dniTemu(days)}`}
              </div>
            )}
          </div>

          <button type="button" onClick={onEdit} style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-muted)',
          }} title="Edytuj"><IconEdit size={20} /></button>
        </div>

        <button type="button" onClick={() => onTogglePrayed(item, viewDate)} style={{
          width: '100%', minHeight: 60, borderRadius: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          fontFamily: 'inherit', fontSize: 20, fontWeight: 800, letterSpacing: '.01em',
          border: `2px solid ${prayedToday ? '#27AE60' : 'var(--border-strong)'}`,
          background: prayedToday ? 'rgba(39,174,96,0.22)' : 'transparent',
          color: prayedToday ? '#27AE60' : 'var(--text)',
        }} title={prayedToday ? 'Odznacz modlitwę' : 'Zaznacz, że się pomodliłaś'}>
          {prayedToday ? <IconCheck size={26} /> : <IconPrayer size={24} />}
          Pomodlono
        </button>
      </div>
    )
  }

  const fs = { title: 14, sub: 12, badge: 10, action: 12, note: 12 }
  const pad = '12px 14px'

  return (
    <div style={{
      background: isNeglected ? neglect.color + '08' : 'var(--surface)',
      border: `1px solid ${isNeglected ? neglect.color + '44' : 'var(--border)'}`,
      borderLeft: `3px solid ${prio.color}`,
      borderRadius: 12, padding: pad
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: fs.title, fontWeight: 600 }}>{item.title}</p>
            <span style={{ fontSize: fs.badge, padding: '1px 5px', borderRadius: 4, background: prio.color + '22', color: prio.color, fontWeight: 700 }}>P{item.priority || 3}</span>
            {isNeglected && (
              <span style={{ fontSize: fs.badge, padding: '1px 5px', borderRadius: 4, background: neglect.color + '18', color: neglect.color, fontWeight: 600 }}>
                L{neglect.level} · {neglect.label}
              </span>
            )}
          </div>
          {showPerson && person && (
            <p style={{ margin: '2px 0 0', fontSize: fs.sub, color: '#8b5cf6' }}>
              <CatIcon categoryId={null} emoji={person.icon || 'IcUsers'} size={fs.sub} /> {person.name}
            </p>
          )}
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {tags.map(t => (
                <span key={t} style={{ fontSize: fs.badge, padding: '1px 6px', borderRadius: 99, background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{t}</span>
              ))}
            </div>
          )}
          {hasChecklist(item) ? (
            <PrayerChecklist item={item} fs={fs} onToggle={(id) => onToggleChecklistItem?.(item, id)} />
          ) : (
            item.note && <p style={{ margin: '3px 0 0', fontSize: fs.sub, color: 'var(--text-muted)' }}>{item.note}</p>
          )}
          {item.eventId ? (
            <p style={{ margin: '2px 0 0', fontSize: fs.badge, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 3 }}>
              <IconCalendar size={10} /> z kalendarza{item.eventDate ? ` · ${item.eventDate}` : ''}
              {item.scheduleFrom && ` · modlitwa ${item.scheduleFrom}–${item.scheduleTo}`}
            </p>
          ) : item.dateTo && (
            <p style={{ margin: '2px 0 0', fontSize: fs.badge, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <IconCalendar size={10} /> do {item.dateTo}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {item.prayedDates?.length > 0 && (
              <span style={{ fontSize: fs.badge, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <IconPrayer size={10} /> ×{item.prayedDates.length}
                {days === 0 && ' · dziś'}
                {days !== null && days > 0 && ` · ${dniTemu(days)}`}
              </span>
            )}
            {item.notes?.length > 0 && (
              <button type="button" onClick={() => setShowNotes(v => !v)} style={{ fontSize: fs.badge, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <IconEdit size={10} /> {item.notes.length} {item.notes.length === 1 ? 'notatka' : 'notatki'}{showNotes ? ' · ukryj' : ' · pokaż'}
              </button>
            )}
          </div>
        </div>
        {!carMode && (
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            <button aria-label="Edytuj" className="t-btn" onClick={onEdit}><IconEdit size={13} /></button>
            <button aria-label="Usuń" className="t-btn delete" onClick={() => onDelete(item.id)}><IconTrash size={13} /></button>
          </div>
        )}
      </div>

      {showNotes && item.notes?.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...item.notes].sort((a, b) => b.date.localeCompare(a.date)).map(n => (
            <div key={n.id} style={{ background: 'var(--bg)', borderRadius: 8, padding: '7px 10px' }}>
              {editingNoteId === n.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    className="form-input"
                    value={editNoteText}
                    onChange={e => setEditNoteText(e.target.value)}
                    rows={3}
                    autoFocus
                    style={{ width: '100%', margin: 0, fontSize: fs.note, resize: 'vertical', minHeight: 72, lineHeight: 1.5, boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingNoteId(null)} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)' }}>Anuluj</button>
                    <button className="btn-save" style={{ width: 'auto', margin: 0, padding: '7px 16px', fontSize: 12 }} onClick={() => submitEditNote(n)}>Zapisz</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: fs.note }}>{n.text}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>{n.date}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button aria-label="Edytuj" className="t-btn" onClick={() => { setEditingNoteId(n.id); setEditNoteText(n.text) }}><IconEdit size={12} /></button>
                    <button aria-label="Usuń" className="t-btn delete" onClick={() => onDeleteNote(item, n)}><IconTrash size={12} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button type="button" onClick={() => onTogglePrayed(item, viewDate)} style={{
          flex: 1, padding: carMode ? '13px' : '8px', borderRadius: 8, fontSize: fs.action, cursor: 'pointer', fontWeight: 600,
          border: `1px solid ${prayedToday ? '#27AE60' : 'var(--border)'}`,
          background: prayedToday ? 'rgba(39,174,96,0.15)' : 'transparent',
          color: prayedToday ? '#27AE60' : 'var(--text-muted)'
        }}>
          {prayedToday ? <><IconCheck size={carMode ? 16 : 12} /> Modlono</> : <><IconPrayer size={carMode ? 16 : 12} /> Módl się</>}
        </button>
        <button aria-label="Edytuj" type="button" onClick={() => setAddingNote(v => !v)} style={{
          padding: carMode ? '13px 16px' : '8px 11px', borderRadius: 8, fontSize: carMode ? 18 : 13, cursor: 'pointer',
          border: `1px solid ${addingNote ? 'var(--accent)' : 'var(--border)'}`,
          background: addingNote ? 'rgba(201,75,40,0.1)' : 'transparent',
          color: addingNote ? 'var(--accent)' : 'var(--text-muted)'
        }}><IconEdit size={carMode ? 18 : 13} /></button>
        {!carMode && (
          <button type="button" onClick={() => onArchive(item)} style={{
            padding: '8px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)'
          }}>Archiwizuj</button>
        )}
      </div>

      {addingNote && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            className="form-input"
            placeholder="Notatka z modlitwy..."
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && submitNote()}
            rows={3}
            autoFocus
            style={{ width: '100%', margin: 0, fontSize: fs.note, resize: 'vertical', minHeight: 80, lineHeight: 1.5, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setAddingNote(false); setNoteText('') }} style={{ padding: '8px 14px', fontSize: 13, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer' }}>
              Anuluj
            </button>
            <button className="btn-save" style={{ width: 'auto', margin: 0, padding: '8px 18px', fontSize: 13 }} onClick={submitNote}>
              Dodaj notatkę
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── TodayView ──────────────────────────────────────────────────────────── */
