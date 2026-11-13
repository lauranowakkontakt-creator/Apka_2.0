import { useState } from 'react'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { db } from '../../firebase/config'
import PersonBubble from '../PersonBubble'
import EmotionWheel from './EmotionWheel'
import { DOMYSLNE_CZYNNIKI } from '../../utils/moodFactors'
import { MOODS, MoodFace, kicker, ChipPicker, Skala5, AddChip, INNE_EMOCJE, RATING_CATS, RATING_W_FORMULARZU,
  CUSTOM_COLORS, TODAY, idZNazwy } from './wspolne'

// Tytuł wydarzenia zakładanego w kalendarzu ze wpisu nastroju.
export const tytulSpotkania = (osoby) => `Spotkanie: ${osoby.map(o => o.name).join(', ')}`

/**
 * Formularz wpisu nastroju. Obowiązkowy jest tylko nastrój — reszta (emocje,
 * co się działo, z kim, oceny, notatka) jest do dopisania, jeśli jest ochota.
 */
export default function MoodEntryForm({ user, date, ust, zapiszUst, people = [], onSaved }) {
  const [mood, setMood]         = useState(null)
  const [emotions, setEmotions] = useState(new Set())
  const [factors, setFactors]   = useState(new Set())
  const [osoby, setOsoby]       = useState(new Set())
  const [wszyscy, setWszyscy]   = useState(false)
  const [ratings, setRatings]   = useState({})
  const [note, setNote]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [blad, setBlad]         = useState('')

  const isToday = date === TODAY()
  const dateLabel = format(new Date(date + 'T12:00:00'), 'd MMM', { locale: pl })

  const przelacz = (setter) => (id) => setter(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleEmotion = przelacz(setEmotions)
  const toggleFactor = przelacz(setFactors)
  const toggleOsoba = przelacz(setOsoby)

  // Własne pozycje: dopisanie od razu je zaznacza; istniejącej nie dublujemy.
  const dodajWlasne = (pole, stale, setter) => (nazwa) => {
    const id = idZNazwy(nazwa)
    if (!id) return
    const lista = ust[pole] || []
    if (![...stale, ...lista].some(e => e.id === id)) {
      zapiszUst({ [pole]: [...lista, { id, label: id, color: CUSTOM_COLORS[lista.length % CUSTOM_COLORS.length] }] })
    }
    setter?.(prev => new Set(prev).add(id))
  }
  const usunWlasne = (pole, setter) => (id) => {
    zapiszUst({ [pole]: (ust[pole] || []).filter(e => e.id !== id) })
    setter?.(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const bliscy = people.filter(p => p.circle !== 'far')
  const widoczni = wszyscy || !bliscy.length ? people : people.filter(p => p.circle !== 'far' || osoby.has(p.id))
  const wybraneOsoby = people.filter(p => osoby.has(p.id))
  // Spotkanie + oznaczone osoby = wydarzenie w kalendarzu.
  const doKalendarza = factors.has('spotkanie') && wybraneOsoby.length > 0

  const katOcen = [...RATING_CATS.filter(c => RATING_W_FORMULARZU.includes(c.id)), ...(ust.ratingCats || [])]

  const handleSave = async () => {
    if (!mood) return
    setSaving(true); setBlad('')
    const mObj = MOODS.find(m => m.id === mood)
    const cleanRatings = Object.fromEntries(Object.entries(ratings).filter(([, v]) => v > 0))
    try {
      let eventId = null
      if (doKalendarza) {
        const pierwsza = wybraneOsoby[0]
        const ref = await addDoc(collection(db, 'users', user.uid, 'calendarEvents'), {
          title: tytulSpotkania(wybraneOsoby), date, dateEnd: null, startTime: null, endTime: null,
          note: '', categoryId: null, categoryIcon: null, color: pierwsza.color || '#607D8B',
          // `personId` to osoba „główna" (kolor, stare filtry), `peopleIds` — wszystkie oznaczone.
          personId: pierwsza.id, personName: wybraneOsoby.map(o => o.name).join(', '),
          peopleIds: wybraneOsoby.map(o => o.id), who: null, recurrence: null, recurUntil: null, prayer: null,
          source: 'mood', createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
        })
        eventId = ref.id
      }
      await addDoc(collection(db, 'users', user.uid, 'moodLogs'), {
        date,
        time: isToday ? format(new Date(), 'HH:mm') : null,
        mood, moodValue: mObj.value, moodLabel: mObj.label, moodColor: mObj.color,
        emotions: Array.from(emotions),
        factors: Array.from(factors),
        peopleIds: wybraneOsoby.map(o => o.id),
        eventId,
        ratings: cleanRatings,
        note: note.trim(),
        createdAt: Timestamp.now(),
      })
      onSaved?.()
    } catch {
      setBlad('Nie udało się zapisać — spróbuj ponownie')
      setSaving(false)
    }
  }

  return (
    <div className="mood-form">
      {/* 1. Nastrój */}
      <div>
        {kicker(isToday ? 'Jak się masz teraz?' : `Jak się miałaś · ${dateLabel}?`, { marginBottom: 12 })}
        <div className="mood-faces">
          {MOODS.map(m => {
            const active = mood === m.id
            return (
              <button key={m.id} type="button" aria-pressed={active} onClick={() => setMood(active ? null : m.id)}
                className={`mood-face-btn${active ? ' on' : ''}`} style={{ '--c': m.color }}>
                <MoodFace mood={m} size={28} active />
                <span>{m.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Emocje — koło + stany spoza koła + własne */}
      <div>
        {kicker(`Emocje${emotions.size ? ` · ${emotions.size}` : ''}`, { marginBottom: 10 })}
        <EmotionWheel selected={emotions} onToggle={toggleEmotion} />
        <div className="emo-panel-lbl" style={{ marginTop: 12 }}>Inne stany</div>
        <ChipPicker items={INNE_EMOCJE} wlasne={ust.emotions || []} selected={emotions} onToggle={toggleEmotion}
          onAdd={dodajWlasne('emotions', INNE_EMOCJE, setEmotions)} onRemove={usunWlasne('emotions', setEmotions)} placeholder="emocja…" />
      </div>

      {/* 3. Co się działo */}
      <div>
        {kicker('Co dziś było? · gdzie, co robiłaś', { marginBottom: 10 })}
        <ChipPicker items={DOMYSLNE_CZYNNIKI} wlasne={ust.factors || []} selected={factors} onToggle={toggleFactor}
          onAdd={dodajWlasne('factors', DOMYSLNE_CZYNNIKI, setFactors)} onRemove={usunWlasne('factors', setFactors)} placeholder="np. egzamin…" />
      </div>

      {/* 4. Relacje */}
      <div>
        {kicker('Relacje', { marginBottom: 10 })}
        <div className="mood-row">
          <span>Jak się czuję w relacjach</span>
          <Skala5 value={ratings.relacje || 0} onChange={v => setRatings(r => ({ ...r, relacje: v }))} color="#EC4899" />
        </div>
        {people.length > 0 ? (
          <>
            <div className="emo-panel-lbl" style={{ marginTop: 12 }}>Z kim byłam</div>
            <div className="mood-people">
              {widoczni.map(p => {
                const on = osoby.has(p.id)
                return (
                  <button key={p.id} type="button" aria-pressed={on} onClick={() => toggleOsoba(p.id)}
                    className={`mood-person${on ? ' on' : ''}`} style={{ '--c': p.color || '#8b5cf6' }}>
                    <PersonBubble person={p} size={22} />{p.name}
                  </button>
                )
              })}
              {!wszyscy && bliscy.length > 0 && widoczni.length < people.length && (
                <button type="button" className="mood-chip add" onClick={() => setWszyscy(true)}>pokaż wszystkich</button>
              )}
            </div>
          </>
        ) : (
          <p className="mood-note">Dodaj osoby w zakładce „Osoby", a będzie można tu zaznaczać, z kim byłaś.</p>
        )}
        {doKalendarza && <p className="mood-note ok">W kalendarzu pojawi się „{tytulSpotkania(wybraneOsoby)}" · {dateLabel}</p>}
        {factors.has('spotkanie') && !wybraneOsoby.length && people.length > 0 && (
          <p className="mood-note">Zaznacz, z kim było spotkanie — trafi do kalendarza z tymi osobami.</p>
        )}
        {!factors.has('spotkanie') && wybraneOsoby.length > 0 && (
          <p className="mood-note">To było umówione spotkanie? Zaznacz wyżej „spotkanie", a wpisze się do kalendarza.</p>
        )}
      </div>

      {/* 5. Oceny dnia 1–5 (+ własne kategorie) */}
      <div>
        {kicker('Oceń dzień · 1–5', { marginBottom: 10 })}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {katOcen.map(cat => (
            <div key={cat.id} className="mood-row">
              <span><i style={{ background: cat.color }} />{cat.label}</span>
              <Skala5 value={ratings[cat.id] || 0} onChange={v => setRatings(r => ({ ...r, [cat.id]: v }))} color={cat.color} />
            </div>
          ))}
          <div><AddChip onAdd={dodajWlasne('ratingCats', RATING_CATS)} placeholder="kategoria…" /></div>
        </div>
      </div>

      <textarea className="form-input" placeholder="Jak minął dzień? Co czujesz?…"
        value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={400}
        style={{ margin: 0, resize: 'none', fontSize: 16 }} />

      {blad && <p className="mood-note" style={{ color: 'var(--expense)' }}>{blad}</p>}
      <button type="button" className="btn-save mood-save" onClick={handleSave} disabled={saving || !mood}>
        {saving ? 'Zapisywanie…' : !mood ? 'Wybierz nastrój' : isToday ? 'Zapisz nastrój' : `Zapisz wpis · ${dateLabel}`}
      </button>
    </div>
  )
}
