import { db } from '../../firebase/config'
import { RECURRENCE } from '../../utils/calendarRecurrence'
import { CatIcon, IconChevronDown, IconChevronRight, IconClose, IconPrayer, IconRepeat } from '../Icons'
import PersonBubble from '../PersonBubble'
import { findCat, PRAYER_PRIOS, PRAYER_WINDOWS, findPerson } from './wspolne'
import { addDays, format, parseISO, subDays } from 'date-fns'
import { Timestamp, collection, doc } from 'firebase/firestore'
import { addDoc, updateDoc } from '../../utils/zapis'
import { useState } from 'react'

// Formularz wydarzenia: dodawanie i edycja, razem z cyklicznością
// i zakładaniem próśb modlitewnych powiązanych z datą.

export default function EventForm({ user, editData, defaultDate, categories, calPeople, onClose }) {
  const [title, setTitle]           = useState(editData?.title || '')
  const [date, setDate]             = useState(editData?.date || defaultDate)
  const [dateEnd, setDateEnd]       = useState(editData?.dateEnd || '')
  const [allDay, setAllDay]         = useState(editData ? !editData.startTime : true)
  const [startTime, setStartTime]   = useState(editData?.startTime || '')
  const [endTime, setEndTime]       = useState(editData?.endTime || '')
  const [note, setNote]             = useState(editData?.note || '')
  const [categoryId, setCategoryId] = useState(editData?.categoryId || '')
  const [personId, setPersonId]     = useState(editData?.personId || '')
  const [who, setWho]               = useState(editData?.who || '')
  const [recurrence, setRecurrence] = useState(editData?.recurrence || '')
  const [recurUntil, setRecurUntil] = useState(editData?.recurUntil || '')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  // Sekcja Modlitwa — tworzy/aktualizuje powiązaną prośbę modlitewną
  const [prayerOpen, setPrayerOpen]         = useState(!!editData?.prayer?.enabled)
  const [prayerEnabled, setPrayerEnabled]   = useState(!!editData?.prayer?.enabled)
  const [prayerWindow, setPrayerWindow]     = useState(editData?.prayer?.window || 'around')
  const [prayerFrom, setPrayerFrom]         = useState(editData?.prayer?.from || '')
  const [prayerTo, setPrayerTo]             = useState(editData?.prayer?.to || '')
  const [prayerPriority, setPrayerPriority] = useState(editData?.prayer?.priority || 3)
  const [prayerTitle, setPrayerTitle]       = useState(editData?.prayer?.title || '')

  const selectedCat    = findCat(categories, categoryId)
  const selectedPerson = findPerson(calPeople, personId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) { setError('Wpisz tytuł'); return }
    if (!date) { setError('Wybierz datę'); return }
    setSaving(true)
    const baseData = {
      title: title.trim(), date,
      dateEnd: dateEnd && dateEnd > date ? dateEnd : null,
      startTime: allDay ? null : (startTime || null),
      endTime:   allDay ? null : (endTime   || null),
      note: note.trim(),
      categoryId: categoryId || null,
      categoryIcon: selectedCat?.icon || null,
      color: selectedPerson?.color || selectedCat?.color || '#607D8B',
      personId: personId || null,
      personName: selectedPerson?.name || null,
      who: who.trim() || null,
      recurrence: recurrence || null,
      recurUntil: recurrence && recurUntil ? recurUntil : null,
      updatedAt: Timestamp.now()
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const computeWindow = () => {
      if (prayerWindow === 'day-of') return [date, date]
      if (prayerWindow === 'around') return [format(subDays(parseISO(date), 1), 'yyyy-MM-dd'), format(addDays(parseISO(date), 1), 'yyyy-MM-dd')]
      if (prayerWindow === 'until')  return [todayStr <= date ? todayStr : date, date]
      const f = prayerFrom || date, t = prayerTo || date
      return f <= t ? [f, t] : [t, f]
    }

    try {
      // 1. Zapis wydarzenia (potrzebujemy id do powiązania prośby)
      let eventId = editData?.id
      if (!editData) {
        const ref = await addDoc(collection(db, 'users', user.uid, 'calendarEvents'), { ...baseData, createdAt: Timestamp.now() })
        eventId = ref.id
      }

      // 2. Synchronizacja powiązanej prośby modlitewnej
      let intentionId = editData?.prayer?.intentionId || null
      let prayerField = editData?.prayer ? { ...editData.prayer } : null
      const intRef = (id) => doc(db, 'users', user.uid, 'prayerIntentions', id)

      if (prayerEnabled) {
        const [sFrom, sTo] = computeWindow()
        const intentionData = {
          title: prayerTitle.trim() || title.trim(),
          note: note.trim(),
          personId: personId || null,
          priority: prayerPriority,
          scheduleFrom: sFrom, scheduleTo: sTo, dateTo: sTo,
          eventId, eventDate: date,
          updatedAt: Timestamp.now(),
        }
        if (intentionId) {
          await updateDoc(intRef(intentionId), { ...intentionData, status: 'active', endedAt: null, autoArchived: null })
        } else {
          const iref = await addDoc(collection(db, 'users', user.uid, 'prayerIntentions'), {
            ...intentionData, status: 'active', prayedDates: [], notes: [], createdAt: Timestamp.now()
          })
          intentionId = iref.id
        }
        prayerField = { enabled: true, window: prayerWindow, from: sFrom, to: sTo, priority: prayerPriority, title: prayerTitle.trim() || null, intentionId }
      } else if (intentionId) {
        // Wyłączono modlitwę → archiwizujemy powiązaną prośbę (zostaje w historii osoby)
        await updateDoc(intRef(intentionId), { status: 'ended', endedAt: Timestamp.now(), autoArchived: true })
        prayerField = { enabled: false, intentionId: null }
      }

      // 3. Zapis pola `prayer` na wydarzeniu
      const finalData = { ...baseData, prayer: prayerField }
      if (editData) {
        await updateDoc(doc(db, 'users', user.uid, 'calendarEvents', editData.id), finalData)
      } else {
        await updateDoc(doc(db, 'users', user.uid, 'calendarEvents', eventId), { prayer: prayerField })
      }
      onClose()
    } catch { setError('Błąd zapisu'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{editData ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="form">

          <div className="form-group">
            <label>Tytuł</label>
            <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)}
              maxLength={100} placeholder="np. Lekarz, Urodziny Mamy..." />
          </div>

          {/* OSOBY — wybór jako pierwsza rzecz */}
          {calPeople.length > 0 && (
            <div className="form-group">
              <label>Dla kogo?</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setPersonId('')} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 10px', borderRadius: 12, cursor: 'pointer', fontSize: 11,
                  border: `2px solid ${!personId ? 'var(--border-strong)' : 'var(--border)'}`,
                  background: !personId ? 'var(--surface3)' : 'transparent',
                  color: !personId ? 'var(--text)' : 'var(--text-muted)',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface2)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--text-muted)' }}>—</div>
                  Brak
                </button>
                {calPeople.map(p => (
                  <button key={p.id} type="button" onClick={() => setPersonId(p.id)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '8px 10px', borderRadius: 12, cursor: 'pointer', fontSize: 11,
                    border: `2px solid ${personId === p.id ? p.color : 'var(--border)'}`,
                    background: personId === p.id ? p.color + '22' : 'transparent',
                    color: personId === p.id ? p.color : 'var(--text-muted)',
                    fontWeight: personId === p.id ? 700 : 400,
                  }}>
                    <PersonBubble person={p} size={36} />
                    {p.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Kogo dotyczy — wolny tekst, zawsze dostępny */}
          <div className="form-group">
            <label>Kogo dotyczy? (opcjonalnie)</label>
            <input type="text" className="form-input" value={who} onChange={e => setWho(e.target.value)}
              maxLength={60} placeholder="np. Mama, Tata, ja, cała rodzina..." />
          </div>

          {/* Kategoria — opcjonalna */}
          <div className="form-group">
            <label>Kategoria (opcjonalnie)</label>
            <div className="cal-cat-grid">
              {categories.map(cat => (
                <button key={cat.id} type="button"
                  className={`cal-cat-btn ${categoryId === cat.id ? 'active' : ''}`}
                  style={categoryId === cat.id ? { borderColor: cat.color, background: cat.color + '22' } : {}}
                  onClick={() => setCategoryId(categoryId === cat.id ? '' : cat.id)}>
                  <span className="cal-cat-icon" style={categoryId === cat.id ? { background: cat.color + '33' } : {}}><CatIcon categoryId={null} emoji={cat.icon} size={15} /></span>
                  <span className="cal-cat-label">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Data</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Data końca (opcjonalnie)</label>
              <input type="date" className="form-input" value={dateEnd}
                onChange={e => setDateEnd(e.target.value)} min={date} />
            </div>
          </div>

          <div className="form-group">
            <div className="type-toggle">
              <button type="button"
                className={`type-btn ${allDay ? 'active expense' : ''}`}
                onClick={() => setAllDay(true)}>Całodniowe</button>
              <button type="button"
                className={`type-btn ${!allDay ? 'active expense' : ''}`}
                onClick={() => setAllDay(false)}>Z godzinami</button>
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconRepeat size={13} /> Powtarzaj</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {RECURRENCE.map(r => (
                <button key={r.id} type="button" onClick={() => setRecurrence(r.id)} style={{
                  flex: '1 1 auto', minWidth: 64, padding: '8px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  fontWeight: recurrence === r.id ? 700 : 400,
                  border: `1px solid ${recurrence === r.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: recurrence === r.id ? 'var(--accent-soft)' : 'transparent',
                  color: recurrence === r.id ? 'var(--accent)' : 'var(--text-muted)',
                }}>{r.label}</button>
              ))}
            </div>
            {recurrence && (
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 12 }}>Powtarzaj do (opcjonalnie)</label>
                <input type="date" className="form-input" value={recurUntil} min={date}
                  onChange={e => setRecurUntil(e.target.value)} />
              </div>
            )}
          </div>

          {!allDay && (
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Od</label>
                <input type="time" className="form-input" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Do</label>
                <input type="time" className="form-input" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
          )}
          <div className="form-group">
            <label>Opis / notatka</label>
            <input type="text" className="form-input" value={note} onChange={e => setNote(e.target.value)}
              maxLength={300} placeholder="Szczegóły, miejsce, link..." />
          </div>

          {/* ── Sekcja Modlitwa ── */}
          <div className="form-group">
            <button type="button" onClick={() => setPrayerOpen(o => !o)} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', cursor: 'pointer',
              borderRadius: 10, fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              border: `1px solid ${prayerEnabled ? '#a78bfa' : 'var(--border)'}`,
              background: prayerEnabled ? 'rgba(167,139,250,0.12)' : 'var(--surface2)',
              color: prayerEnabled ? '#a78bfa' : 'var(--text)',
            }}>
              <IconPrayer size={15} />
              <span style={{ flex: 1, textAlign: 'left' }}>Modlitwa{prayerEnabled ? ' · włączona' : ''}</span>
              {prayerOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            </button>

            {prayerOpen && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={prayerEnabled} onChange={e => setPrayerEnabled(e.target.checked)} />
                  Dodaj do próśb modlitewnych{personId ? '' : ' (uwaga: bez przypisanej osoby)'}
                </label>

                {prayerEnabled && (
                  <>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>O co się modlić?</label>
                      <input type="text" className="form-input" value={prayerTitle} onChange={e => setPrayerTitle(e.target.value)}
                        maxLength={150} placeholder={title || 'np. Szczęśliwy i bezpieczny wyjazd...'} />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Kiedy się modlić</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {PRAYER_WINDOWS.map(w => (
                          <button key={w.id} type="button" onClick={() => setPrayerWindow(w.id)} style={{
                            flex: '1 1 auto', minWidth: 120, padding: '8px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                            fontWeight: prayerWindow === w.id ? 700 : 400,
                            border: `1px solid ${prayerWindow === w.id ? '#a78bfa' : 'var(--border)'}`,
                            background: prayerWindow === w.id ? 'rgba(167,139,250,0.15)' : 'transparent',
                            color: prayerWindow === w.id ? '#a78bfa' : 'var(--text-muted)',
                          }}>{w.label}</button>
                        ))}
                      </div>
                    </div>

                    {prayerWindow === 'custom' && (
                      <div className="form-row">
                        <div className="form-group" style={{ flex: 1, margin: 0 }}>
                          <label>Od</label>
                          <input type="date" className="form-input" value={prayerFrom} onChange={e => setPrayerFrom(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ flex: 1, margin: 0 }}>
                          <label>Do</label>
                          <input type="date" className="form-input" value={prayerTo} min={prayerFrom} onChange={e => setPrayerTo(e.target.value)} />
                        </div>
                      </div>
                    )}

                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Priorytet</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {PRAYER_PRIOS.slice().reverse().map(p => (
                          <button key={p.v} type="button" onClick={() => setPrayerPriority(p.v)} style={{
                            flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                            fontWeight: prayerPriority === p.v ? 700 : 400,
                            border: `2px solid ${prayerPriority === p.v ? p.color : 'var(--border)'}`,
                            background: prayerPriority === p.v ? p.color + '22' : 'transparent',
                            color: prayerPriority === p.v ? p.color : 'var(--text-muted)',
                          }}>{p.v}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz zmiany' : 'Dodaj wydarzenie'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ─── PeopleManager ────────────────────────────────────────────────────── */
