import { useState, useEffect } from 'react'
import { IconChevronRight } from '../Icons'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { db } from '../../firebase/config'
import PersonBubble from '../PersonBubble'
import EmotionWheel from './EmotionWheel'
import { DOMYSLNE_CZYNNIKI } from '../../utils/moodFactors'
import { chwilePoZapisie, wartoscDnia, czasyEmocji, chwileWpisu } from '../../utils/moodEntry'
import { MOODS, MoodFace, kicker, ChipPicker, Skala5, AddChip, INNE_EMOCJE, RATING_CATS, RATING_W_FORMULARZU,
  CUSTOM_COLORS, TODAY, idZNazwy, findFactor } from './wspolne'

// Zwijana część formularza: w nagłówku to, co już wybrane — formularz jest krótki,
// a i tak widać, co się w nim zaznaczyło.
function Czesc({ tytul, podsumowanie, domyslnie = false, children }) {
  const [open, setOpen] = useState(domyslnie)
  return (
    <section className={`mood-part${open ? ' open' : ''}`}>
      <button type="button" className="mood-part-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="mood-part-title">{tytul}</span>
        <span className="mood-part-sum">{podsumowanie}</span>
        <IconChevronRight size={15} className="mood-part-chev" />
      </button>
      {open && <div className="mood-part-body">{children}</div>}
    </section>
  )
}

// Domyślny tytuł wydarzenia zakładanego w kalendarzu ze wpisu nastroju.
export const tytulSpotkania = (osoby) => `Spotkanie: ${osoby.map(o => o.name).join(', ')}`

/**
 * Formularz dnia. Jeden wpis na dzień: drugi raz tego samego dnia otwiera się
 * ten sam wpis i można go zmienić albo dopisać (rano smutek, wieczorem złość —
 * z godzinami). Obowiązkowy jest tylko nastrój.
 */
export default function MoodEntryForm({ user, date, ust, zapiszUst, people = [], initialMood = null, edit = null, onSaved }) {
  const [mood, setMood]         = useState(initialMood || edit?.mood || null)
  const [emotions, setEmotions] = useState(() => new Set(edit?.emotions || []))
  const [factors, setFactors]   = useState(() => new Set(edit?.factors || []))
  const [osoby, setOsoby]       = useState(() => new Set(edit?.peopleIds || []))
  const [wszyscy, setWszyscy]   = useState(false)
  const [ratings, setRatings]   = useState(() => ({ ...(edit?.ratings || {}) }))
  const [note, setNote]         = useState(edit?.note || '')
  // Jak dany czynnik wpłynął na nastrój: -1 gorzej, 1 lepiej (brak = bez oceny)
  const [wplyw, setWplyw]       = useState(() => ({ ...(edit?.factorEffects || {}) }))
  // Kalendarz: jawny przełącznik. Domyślnie włączony, gdy wpis ma już spotkanie
  // albo zaznaczono „spotkanie" — ale zawsze można go zmienić, przy dowolnym czynniku.
  const [kal, setKal]           = useState(!!edit?.eventId)
  const [kalRecznie, setKalRecznie] = useState(!!edit?.eventId)
  const [tytul, setTytul]       = useState('')
  // Tytuł wydarzenia, które wpis już założył — żeby edycja go nie nadpisała domyślnym
  useEffect(() => {
    if (!edit?.eventId) return
    getDoc(doc(db, 'users', user.uid, 'calendarEvents', edit.eventId))
      .then(d => { if (d.exists()) setTytul(t => t || d.data().title || '') }).catch(() => {})
  }, [edit?.eventId, user.uid])
  const [saving, setSaving]     = useState(false)
  const [blad, setBlad]         = useState('')

  const isToday = date === TODAY()
  const dateLabel = format(new Date(date + 'T12:00:00'), 'd MMM', { locale: pl })

  const przelacz = (setter) => (id) => setter(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleEmotion = przelacz(setEmotions)
  const toggleOsoba = przelacz(setOsoby)
  const toggleFactor = (id) => {
    przelacz(setFactors)(id)
    // „spotkanie" włącza kalendarz, dopóki nie przestawiło się go ręcznie
    if (id === 'spotkanie' && !kalRecznie) setKal(!factors.has('spotkanie'))
  }

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
  const doKalendarza = kal && wybraneOsoby.length > 0
  const tytulKal = tytul.trim() || tytulSpotkania(wybraneOsoby)

  const katOcen = [...RATING_CATS.filter(c => RATING_W_FORMULARZU.includes(c.id)), ...(ust.ratingCats || [])]
  const chwile = edit ? chwileWpisu(edit) : []

  const handleSave = async () => {
    if (!mood) return
    setSaving(true); setBlad('')
    const mObj = MOODS.find(m => m.id === mood)
    const teraz = format(new Date(), 'HH:mm')
    const cleanRatings = Object.fromEntries(Object.entries(ratings).filter(([, v]) => v > 0))
    const noweChwile = chwilePoZapisie(chwile, mObj.value, teraz, isToday)
    const evRef = (id) => doc(db, 'users', user.uid, 'calendarEvents', id)
    try {
      // Wydarzenie w kalendarzu: założyć, poprawić albo usunąć.
      let eventId = edit?.eventId || null
      if (doKalendarza) {
        const pierwsza = wybraneOsoby[0]
        const dane = {
          title: tytulKal, date, color: pierwsza.color || '#607D8B',
          // `personId` to osoba „główna" (kolor, stare filtry), `peopleIds` — wszystkie oznaczone.
          personId: pierwsza.id, personName: wybraneOsoby.map(o => o.name).join(', '),
          peopleIds: wybraneOsoby.map(o => o.id), updatedAt: Timestamp.now(),
        }
        if (eventId) await updateDoc(evRef(eventId), dane).catch(() => { eventId = null })
        if (!eventId) {
          const ref = await addDoc(collection(db, 'users', user.uid, 'calendarEvents'), {
            ...dane, dateEnd: null, startTime: null, endTime: null, note: '', categoryId: null, categoryIcon: null,
            who: null, recurrence: null, recurUntil: null, prayer: null, source: 'mood', createdAt: Timestamp.now(),
          })
          eventId = ref.id
        }
      } else if (eventId) {
        await deleteDoc(evRef(eventId)).catch(() => { /* już usunięte w kalendarzu */ })
        eventId = null
      }
      const dane = {
        date,
        time: edit?.time ?? (isToday ? teraz : null),
        mood, moodValue: wartoscDnia(noweChwile), moodLabel: mObj.label, moodColor: mObj.color,
        moments: noweChwile,
        emotions: Array.from(emotions),
        emotionTimes: czasyEmocji(edit?.emotionTimes, Array.from(emotions), teraz, isToday),
        factors: Array.from(factors),
        factorEffects: Object.fromEntries(Object.entries(wplyw).filter(([id, v]) => factors.has(id) && v)),
        peopleIds: wybraneOsoby.map(o => o.id),
        eventId,
        ratings: cleanRatings,
        note: note.trim(),
      }
      if (edit) await updateDoc(doc(db, 'users', user.uid, 'moodLogs', edit.id), { ...dane, updatedAt: Timestamp.now() })
      else await addDoc(collection(db, 'users', user.uid, 'moodLogs'), { ...dane, createdAt: Timestamp.now() })
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
        {chwile.length > 0 && isToday && (
          <div className="mood-chwile">
            <span>Wcześniej dziś:</span>
            {chwile.map((c, i) => { const m = MOODS.find(x => x.value === c.value); return m && (
              <span key={i} className="mood-chwila" style={{ '--c': m.color }}><MoodFace mood={m} size={16} active />{c.time || ''}</span>
            ) })}
          </div>
        )}
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
      <Czesc tytul="Emocje" domyslnie podsumowanie={emotions.size ? `${emotions.size} wybrane` : ''}>
        <EmotionWheel selected={emotions} onToggle={toggleEmotion} />
        <div className="emo-panel-lbl" style={{ marginTop: 12 }}>Inne stany</div>
        <ChipPicker items={INNE_EMOCJE} wlasne={ust.emotions || []} selected={emotions} onToggle={toggleEmotion}
          onAdd={dodajWlasne('emotions', INNE_EMOCJE, setEmotions)} onRemove={usunWlasne('emotions', setEmotions)} placeholder="emocja…" />
      </Czesc>

      {/* 3. Co się działo */}
      <Czesc tytul="Co dziś było" podsumowanie={factors.size ? [...factors].map(id => `${findFactor(id, ust.factors).label}${wplyw[id] === 1 ? ' ↑' : wplyw[id] === -1 ? ' ↓' : ''}`).join(', ') : 'praca, studia, kościół…'}>
        <ChipPicker items={DOMYSLNE_CZYNNIKI} wlasne={ust.factors || []} selected={factors} onToggle={toggleFactor}
          onAdd={dodajWlasne('factors', DOMYSLNE_CZYNNIKI, setFactors)} onRemove={usunWlasne('factors', setFactors)} placeholder="np. egzamin…" />
        {factors.size > 0 && (
          <div className="mood-wplyw">
            <div className="emo-panel-lbl">Jak to na Ciebie wpłynęło?</div>
            {[...factors].map(id => {
              const f = findFactor(id, ust.factors)
              const v = wplyw[id] || 0
              const ustaw = (n) => setWplyw(w => ({ ...w, [id]: v === n ? 0 : n }))
              return (
                <div key={id} className="mood-wplyw-row">
                  <span><i style={{ background: f.color }} />{f.label}</span>
                  <div className="mood-wplyw-btns" role="group" aria-label={`Wpływ: ${f.label}`}>
                    <button type="button" className={v === -1 ? 'on minus' : ''} aria-pressed={v === -1} onClick={() => ustaw(-1)}>↓ gorzej</button>
                    <button type="button" className={v === 1 ? 'on plus' : ''} aria-pressed={v === 1} onClick={() => ustaw(1)}>↑ lepiej</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Czesc>

      {/* 4. Relacje */}
      <Czesc tytul="Relacje" podsumowanie={[wybraneOsoby.map(o => o.name.split(' ')[0]).join(', '), ratings.relacje ? `${ratings.relacje}/5` : ''].filter(Boolean).join(' · ') || 'z kim byłaś'}>
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
        {wybraneOsoby.length > 0 && (
          <div className="mood-kal">
            <label className="mood-switch">
              <input type="checkbox" checked={kal} onChange={e => { setKal(e.target.checked); setKalRecznie(true) }} />
              <span className="mood-switch-ui" aria-hidden="true" />
              <span>Wpisz do kalendarza<small>wydarzenie z tymi osobami · {dateLabel}</small></span>
            </label>
            {kal && (
              <input className="form-input" value={tytul} onChange={e => setTytul(e.target.value)} maxLength={100}
                placeholder={tytulSpotkania(wybraneOsoby)} aria-label="Tytuł w kalendarzu" style={{ marginTop: 8, fontSize: 16 }} />
            )}
          </div>
        )}
      </Czesc>

      {/* 5. Energia, stres, ciało (+ własne skale) */}
      <Czesc tytul="Energia i ciało" podsumowanie={katOcen.filter(c => ratings[c.id]).map(c => `${c.label.toLowerCase()} ${ratings[c.id]}`).join(' · ') || 'energia, stres, ciało'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {katOcen.map(cat => (
            <div key={cat.id} className="mood-row">
              <span className="mood-row-lbl"><i style={{ background: cat.color }} /><span>{cat.label}{cat.opis && <small>{cat.opis}</small>}</span></span>
              <Skala5 value={ratings[cat.id] || 0} onChange={v => setRatings(r => ({ ...r, [cat.id]: v }))} color={cat.color} />
            </div>
          ))}
          <div><AddChip onAdd={dodajWlasne('ratingCats', RATING_CATS)} placeholder="np. apetyt…" label="własna skala" /></div>
        </div>
      </Czesc>

      {/* 6. Notatka */}
      <Czesc tytul="Notatka" podsumowanie={note.trim() ? note.trim().slice(0, 40) : 'jak minął dzień'}>
        <textarea className="form-input" placeholder="Jak minął dzień? Co czujesz?…"
          value={note} onChange={e => setNote(e.target.value)} rows={4} maxLength={1000}
          style={{ margin: 0, resize: 'vertical', fontSize: 16 }} />
      </Czesc>

      {/* Stopka z przyciskiem: przyklejona do dołu okna, z własnym tłem — nic pod nią nie prześwituje */}
      <div className="mood-form-foot">
        {blad && <p className="mood-note" style={{ color: 'var(--expense)', margin: '0 0 8px' }}>{blad}</p>}
        <button type="button" className="btn-save mood-save" onClick={handleSave} disabled={saving || !mood}>
          {saving ? 'Zapisywanie…' : !mood ? 'Wybierz nastrój' : edit ? 'Zapisz zmiany' : isToday ? 'Zapisz nastrój' : `Zapisz wpis · ${dateLabel}`}
        </button>
      </div>
    </div>
  )
}
