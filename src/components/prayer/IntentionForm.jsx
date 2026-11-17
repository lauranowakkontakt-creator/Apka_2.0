import { db } from '../../firebase/config'
import { collectTags, normalizeTags, parseTags, tagsToText, toggleTag } from '../../utils/prayerFilters'
import { NOTE_MODES, checklistToText, normalizeNoteMode, parseChecklist, pruneDone } from '../../utils/prayerList'
import { PERSON_COLORS, PRIORITY_CFG, findPrio } from '../../utils/prayerStats'
import { dataPL, oknoModlitwy, osobyDoModlitwy, pasujeOsoba } from '../../utils/prayerAnswered'
import { IconClose, IconPlus } from '../Icons'
import PersonBubble from '../PersonBubble'
import { TODAY } from './wspolne'
import { Timestamp, addDoc, collection, doc, updateDoc } from 'firebase/firestore'
import { addDays, format, parseISO } from 'date-fns'
import { useMemo, useState } from 'react'

// Formularz prośby: dodawanie i edycja. Osobę wybiera się tutaj (albo zostawia
// pustą), więc prośbę da się dodać prosto z plusa w górnej belce.

const plusDni = (n) => format(addDays(parseISO(TODAY()), n), 'yyyy-MM-dd')

export default function IntentionForm({ user, editData, personId, onClose, allIntentions = [], people = [] }) {
  const [title, setTitle]       = useState(editData?.title || '')
  const [note, setNote]         = useState(editData?.note || '')
  // Opis może być zwykłym tekstem albo listą do odhaczania.
  const [noteMode, setNoteMode] = useState(normalizeNoteMode(editData?.noteMode))
  const [listText, setListText] = useState(checklistToText(editData?.checklist || []))
  const [priority, setPriority] = useState(editData?.priority || 3)
  const [osobaId, setOsobaId]   = useState(personId || editData?.personId || null)
  const [szukaj, setSzukaj]     = useState('')
  const [wszyscy, setWszyscy]   = useState(false)
  const [nowaOsoba, setNowaOsoba] = useState(null) // null = schowane, '' = pole otwarte
  // Okno modlitwy: od kiedy prośba pokazuje się w „Dziś” i do kiedy (potem archiwum).
  const [od, setOd]             = useState(editData?.scheduleFrom || '')
  const [doKiedy, setDoKiedy]   = useState(editData?.scheduleTo || editData?.dateTo || '')
  const osoby = useMemo(() => osobyDoModlitwy(people, allIntentions), [people, allIntentions])
  // Tagi trzymamy jako listę, a pole tekstowe jest tylko wygodnym wejściem —
  // klikanie w podpowiedzi i dopisywanie ręczne muszą dawać ten sam wynik.
  const [tags, setTags]         = useState(normalizeTags(editData?.tags || []))
  const [tagText, setTagText]   = useState(tagsToText(normalizeTags(editData?.tags || [])))
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) { setError('Wpisz treść prośby'); return }
    setSaving(true)
    // Przy edycji dopasowujemy punkty po treści, żeby zmiana jednej pozycji
    // nie zdjęła ptaszków z pozostałych.
    const checklist = noteMode === 'list' ? parseChecklist(listText, editData?.checklist || []) : []
    const data = {
      title: title.trim(),
      noteMode,
      note: noteMode === 'text' ? note.trim() : '',
      checklist,
      checklistDone: pruneDone(checklist, editData?.checklistDone || []),
      personId: osobaId || null,
      priority, ...oknoModlitwy(od, doKiedy),
      tags: normalizeTags([...tags, ...parseTags(tagText)]),
      updatedAt: Timestamp.now()
    }
    try {
      if (editData) {
        await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', editData.id), data)
      } else {
        await addDoc(collection(db, 'users', user.uid, 'prayerIntentions'), {
          ...data, status: 'active', prayedDates: [], notes: [], createdAt: Timestamp.now()
        })
      }
      onClose()
    } catch { setError('Błąd zapisu'); setSaving(false) }
  }

  // Podpowiadamy tagi już używane w innych prośbach — inaczej po miesiącu
  // powstaje „Zdrowie", „zdrowie mamy" i „ZDROWIE" jako trzy osobne tematy.
  const podpowiedzi = collectTags(allIntentions).filter(t => t.tag)

  const dodajOsobe = async () => {
    const name = String(nowaOsoba || '').trim()
    if (!name) return
    try {
      const ref = await addDoc(collection(db, 'users', user.uid, 'calendarPeople'), {
        name, note: '', icon: 'IcUsers',
        color: PERSON_COLORS[Math.floor(Math.random() * PERSON_COLORS.length)],
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      })
      setOsobaId(ref.id); setNowaOsoba(null); setSzukaj('')
    } catch { setError('Nie udało się dodać osoby') }
  }

  // Wybrana osoba na wierzchu; przy wpisywaniu — wszyscy pasujący,
  // inaczej kilka najbliższych i „Pokaż wszystkich”.
  const wybrana   = osoby.find(p => p.id === osobaId) || null
  const pasujace  = osoby.filter(p => p.id !== osobaId && pasujeOsoba(p, szukaj))
  const pokazane  = szukaj.trim() || wszyscy ? pasujace : pasujace.slice(0, 8)
  const chipOsoby = (p, on) => (
    <button type="button" key={p.id} className={`pray-person-chip${on ? ' on' : ''}`}
      style={{ '--pc': p.color || 'var(--accent)' }}
      onClick={() => { setOsobaId(on ? null : p.id); setSzukaj('') }}>
      <PersonBubble person={p} size={22} />
      {p.name}
      {on && <IconClose size={11} />}
    </button>
  )

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{editData ? 'Edytuj prośbę' : 'Nowa prośba modlitewna'}</h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div className="form-group" style={{ margin: 0 }}>
        <label>Prośba</label>
        <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)}
          maxLength={150} placeholder="O co się modlisz?" />
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label>Za kogo (opcjonalnie)</label>
        {wybrana ? (
          <div className="pray-person-chips">{chipOsoby(wybrana, true)}</div>
        ) : (
          <>
            {osoby.length > 8 && (
              <input type="search" className="form-input" value={szukaj} onChange={e => setSzukaj(e.target.value)}
                placeholder="Szukaj osoby…" />
            )}
            <div className="pray-person-chips">
              {pokazane.map(p => chipOsoby(p, false))}
              {szukaj.trim() && pokazane.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nikogo nie znaleziono</span>
              )}
              {nowaOsoba === null && (
                <button type="button" className="pray-person-chip add"
                  onClick={() => setNowaOsoba(szukaj.trim())}>
                  <IconPlus size={13} /> Nowa osoba
                </button>
              )}
            </div>
            {!szukaj.trim() && pasujace.length > 8 && (
              <button type="button" className="pray-link-btn" onClick={() => setWszyscy(v => !v)}>
                {wszyscy ? 'Zwiń listę' : `Pokaż wszystkich (${pasujace.length})`}
              </button>
            )}
            {nowaOsoba !== null && (
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" className="form-input" autoFocus value={nowaOsoba} maxLength={60}
                  onChange={e => setNowaOsoba(e.target.value)} placeholder="Imię, np. Ciocia Ania"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); dodajOsobe() } }}
                  style={{ flex: 1 }} />
                <button type="button" className="btn-save" style={{ width: 'auto', margin: 0, padding: '0 14px' }}
                  disabled={!nowaOsoba.trim()} onClick={dodajOsobe}>Dodaj</button>
                <button type="button" aria-label="Anuluj" className="icon-btn" onClick={() => setNowaOsoba(null)}><IconClose size={14} /></button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label>Priorytet</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {PRIORITY_CFG.slice().reverse().map(p => (
            <button key={p.v} type="button" onClick={() => setPriority(p.v)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: priority === p.v ? 700 : 400,
              border: `2px solid ${priority === p.v ? p.color : 'var(--border)'}`,
              background: priority === p.v ? p.color + '22' : 'transparent',
              color: priority === p.v ? p.color : 'var(--text-muted)'
            }}>{p.v}</button>
          ))}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: findPrio(priority)?.color }}>{findPrio(priority)?.label}</p>
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <label style={{ margin: 0 }}>Szczegóły (opcjonalnie)</label>
          <div className="note-mode">
            {NOTE_MODES.map(m => (
              <button key={m.id} type="button"
                className={`note-mode-btn${noteMode === m.id ? ' active' : ''}`}
                onClick={() => setNoteMode(m.id)}>{m.label}</button>
            ))}
          </div>
        </div>
        {noteMode === 'text' ? (
          <input type="text" className="form-input" value={note} onChange={e => setNote(e.target.value)}
            maxLength={300} placeholder="Szczegóły..." />
        ) : (
          <>
            <textarea className="form-input" rows={5} value={listText}
              onChange={e => setListText(e.target.value)}
              placeholder={'zdrowie mamy\npraca taty\nspokój w domu'}
              style={{ resize: 'vertical', minHeight: 108, fontFamily: 'inherit', lineHeight: 1.6 }} />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
              Jedna rzecz w linii. Każdą odhaczysz osobno przy prośbie.
            </p>
          </>
        )}
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label>Tematy (opcjonalnie)</label>
        <input type="text" className="form-input" value={tagText}
          onChange={e => { setTagText(e.target.value); setTags(parseTags(e.target.value)) }}
          maxLength={120} placeholder="Zdrowie, Praca" />
        {podpowiedzi.length > 0 && (
          <div className="pray-filters-chips" style={{ marginTop: 6 }}>
            {podpowiedzi.map(({ tag }) => {
              const wybrany = tags.some(t => t.toLowerCase() === tag.toLowerCase())
              return (
                <button key={tag} type="button" className={`chip${wybrany ? ' active' : ''}`}
                  onClick={() => { const next = toggleTag(tags, tag); setTags(next); setTagText(tagsToText(next)) }}>
                  {tag}
                </button>
              )
            })}
          </div>
        )}
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
          Po przecinku. W widoku „Dziś" filtrujesz prośby po temacie.
        </p>
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label>Kiedy się modlić (opcjonalnie)</label>
        <div className="pray-dates">
          <div className="pray-date">
            <span>Od kiedy</span>
            <input type="date" className="form-input" value={od} onChange={e => setOd(e.target.value)} />
          </div>
          <div className="pray-date">
            <span>Do kiedy</span>
            <input type="date" className="form-input" value={doKiedy} min={od || undefined}
              onChange={e => setDoKiedy(e.target.value)} />
          </div>
        </div>
        <div className="pray-person-chips">
          <button type="button" className="chip" onClick={() => { setOd(TODAY()); setDoKiedy(plusDni(6)) }}>Tydzień</button>
          <button type="button" className="chip" onClick={() => { setOd(TODAY()); setDoKiedy(plusDni(29)) }}>Miesiąc</button>
          <button type="button" className="chip" onClick={() => { setOd(TODAY()); setDoKiedy(plusDni(53)) }}>Nowenna pompejańska</button>
          {(od || doKiedy) && <button type="button" className="chip" onClick={() => { setOd(''); setDoKiedy('') }}>Bez dat</button>}
        </div>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
          {!od && !doKiedy
            ? 'Bez dat prośba jest w „Dziś” codziennie, aż ją zakończysz.'
            : `Prośba pokaże się w „Dziś”${od ? ` od ${dataPL(od)}` : ''}${doKiedy ? ` do ${dataPL(doKiedy)}, potem sama przejdzie do archiwum` : ''}.`}
        </p>
      </div>

      {error && <p className="form-error" style={{ margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-save" onClick={handleSubmit} disabled={saving} style={{ flex: 1 }}>
          {saving ? 'Zapisywanie...' : editData ? 'Zapisz' : 'Dodaj prośbę'}
        </button>
        <button type="button" onClick={onClose} style={{
          flex: 1, background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--text-muted)', borderRadius: 'var(--radius)', padding: 12, cursor: 'pointer', fontSize: 14
        }}>Anuluj</button>
      </div>
        </div>
      </div>
    </div>
  )
}

/* ─── PersonForm ─────────────────────────────────────────────────────────── */
