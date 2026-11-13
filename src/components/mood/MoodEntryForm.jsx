import { useState, useEffect } from 'react'
import { IconChevronRight, IconChevronLeft, IconPlus, IconTrash } from '../Icons'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { db } from '../../firebase/config'
import PersonBubble from '../PersonBubble'
import EmotionWheel from './EmotionWheel'
import { DOMYSLNE_CZYNNIKI } from '../../utils/moodFactors'
import { chwileWpisu, podsumujDzien, posortujChwile, nowaChwilaId } from '../../utils/moodEntry'
import { MOODS, MoodFace, moodDla, kicker, ChipPicker, Skala5, AddChip, INNE_EMOCJE, RATING_CATS, RATING_W_FORMULARZU,
  CUSTOM_COLORS, TODAY, idZNazwy, findFactor, findEmotion } from './wspolne'

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

const moodZWartosci = (v) => MOODS.find(m => m.value === v) || moodDla(v)

/**
 * Formularz dnia. Jeden wpis na dzień, złożony z chwil: każda chwila ma
 * godzinę, nastrój, emocje, to, co się działo, i osoby — bo różne rzeczy
 * wywołują różne emocje (10:00 praca → złość, 18:00 spotkanie → radość).
 * Na poziomie dnia: data, ocena relacji, kalendarz, energia i ciało, notatka.
 */
export default function MoodEntryForm({ user, date, ust, zapiszUst, people = [], initialMood = null, edit = null, onZmienDzien, onSaved }) {
  const dzien = date
  const [chwile, setChwile]     = useState(() => (edit ? chwileWpisu(edit) : []))
  // Widok: 'dzien' (przegląd) albo id edytowanej chwili / 'nowa'
  const [widok, setWidok]       = useState(() => (initialMood || !edit ? 'nowa' : 'dzien'))
  const [ratings, setRatings]   = useState(() => ({ ...(edit?.ratings || {}) }))
  const [note, setNote]         = useState(edit?.note || '')
  const [kal, setKal]           = useState(!!edit?.eventId)
  const [kalRecznie, setKalRecznie] = useState(!!edit?.eventId)
  const [tytul, setTytul]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [blad, setBlad]         = useState('')

  // Tytuł wydarzenia, które wpis już założył — żeby edycja go nie nadpisała domyślnym
  useEffect(() => {
    if (!edit?.eventId) return
    getDoc(doc(db, 'users', user.uid, 'calendarEvents', edit.eventId))
      .then(d => { if (d.exists()) setTytul(t => t || d.data().title || '') }).catch(() => {})
  }, [edit?.eventId, user.uid])

  const isToday = dzien === TODAY()
  const dateLabel = format(new Date(dzien + 'T12:00:00'), 'd MMM', { locale: pl })

  const suma = podsumujDzien(chwile)
  const wybraneOsoby = people.filter(p => suma?.peopleIds.includes(p.id))
  // „spotkanie" w którejś chwili włącza kalendarz, dopóki nie przestawi się go ręcznie
  const kalWlaczony = kalRecznie ? kal : (kal || !!suma?.factors.includes('spotkanie'))
  const tytulKal = tytul.trim() || tytulSpotkania(wybraneOsoby)
  const katOcen = [...RATING_CATS.filter(c => RATING_W_FORMULARZU.includes(c.id)), ...(ust.ratingCats || [])]

  const dodajWlasne = (pole, stale) => (nazwa) => {
    const id = idZNazwy(nazwa)
    if (!id) return null
    const lista = ust[pole] || []
    if (![...stale, ...lista].some(e => e.id === id)) {
      zapiszUst({ [pole]: [...lista, { id, label: id, color: CUSTOM_COLORS[lista.length % CUSTOM_COLORS.length] }] })
    }
    return id
  }
  const usunWlasne = (pole) => (id) => zapiszUst({ [pole]: (ust[pole] || []).filter(e => e.id !== id) })

  const zapisz = async (listaChwil = chwile) => {
    const p = podsumujDzien(listaChwil)
    if (!p) { setBlad('Dodaj przynajmniej jedną chwilę z nastrojem'); return }
    setSaving(true); setBlad('')
    const osobyDnia = people.filter(o => p.peopleIds.includes(o.id))
    const kalTak = (kalRecznie ? kal : (kal || p.factors.includes('spotkanie'))) && osobyDnia.length > 0
    const cleanRatings = Object.fromEntries(Object.entries(ratings).filter(([, v]) => v > 0))
    const evRef = (id) => doc(db, 'users', user.uid, 'calendarEvents', id)
    const posort = posortujChwile(listaChwil)
    const dniowy = moodDla(p.moodValue)
    const ostatni = moodZWartosci(p.ostatnia)
    try {
      // Wydarzenie w kalendarzu: założyć, poprawić albo usunąć.
      let eventId = edit?.eventId || null
      if (kalTak) {
        const pierwsza = osobyDnia[0]
        const dane = {
          title: tytul.trim() || tytulSpotkania(osobyDnia), date: dzien, color: pierwsza.color || '#607D8B',
          // `personId` to osoba „główna" (kolor, stare filtry), `peopleIds` — wszystkie oznaczone.
          personId: pierwsza.id, personName: osobyDnia.map(o => o.name).join(', '),
          peopleIds: osobyDnia.map(o => o.id), updatedAt: Timestamp.now(),
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
        date: dzien,
        time: posort.find(c => c.time)?.time || null,
        // `mood` = ostatnia chwila (buźka „teraz”), moodValue/moodLabel = cały dzień
        mood: ostatni.id, moodValue: p.moodValue, moodLabel: dniowy.label, moodColor: dniowy.color,
        moments: posort,
        emotions: p.emotions, emotionTimes: p.emotionTimes, factors: p.factors, peopleIds: p.peopleIds,
        eventId, ratings: cleanRatings, note: note.trim(),
      }
      if (edit) await updateDoc(doc(db, 'users', user.uid, 'moodLogs', edit.id), { ...dane, updatedAt: Timestamp.now() })
      else await addDoc(collection(db, 'users', user.uid, 'moodLogs'), { ...dane, createdAt: Timestamp.now() })
      onSaved?.()
    } catch {
      setBlad('Nie udało się zapisać — spróbuj ponownie')
      setSaving(false)
    }
  }

  // ── Edycja jednej chwili ─────────────────────────────────────────────────────
  if (widok !== 'dzien') {
    const istniejaca = chwile.find(c => c.id === widok)
    const wstaw = (c) => { const bez = chwile.filter(x => x.id !== c.id); return [...bez, c] }
    return (
      <ChwilaForm key={widok} chwila={istniejaca} initialMood={initialMood} isToday={isToday} ust={ust} people={people}
        dodajWlasne={dodajWlasne} usunWlasne={usunWlasne} saving={saving} blad={blad}
        naglowek={(
          <div className="mood-day-bar">
            <label className="mood-date">
              <span>Dzień</span>
              <input type="date" value={dzien} max={TODAY()} onChange={e => e.target.value && e.target.value <= TODAY() && onZmienDzien?.(e.target.value)} />
            </label>
            {chwile.length > (istniejaca ? 1 : 0) && <span className="mood-day-bar-info">{chwile.length} {chwile.length === 1 ? 'chwila' : 'chwile'} tego dnia</span>}
          </div>
        )}
        onDzien={(c) => { if (c) setChwile(wstaw(c)); setWidok('dzien') }}
        onZapisz={(c) => { const lista = wstaw(c); setChwile(lista); zapisz(lista) }} />
    )
  }

  // ── Przegląd dnia ────────────────────────────────────────────────────────────
  const posort = posortujChwile(chwile)
  return (
    <div className="mood-form">
      <div className="mood-day-bar">
        <label className="mood-date">
          <span>Dzień</span>
          <input type="date" value={dzien} max={TODAY()} onChange={e => e.target.value && e.target.value <= TODAY() && onZmienDzien?.(e.target.value)} />
        </label>
        {suma && <span className="mood-day-bar-info">średnio <b>{moodDla(suma.moodValue).label}</b></span>}
      </div>

      {/* Chwile dnia */}
      <div>
        {kicker('Chwile dnia', { marginBottom: 8 })}
        <div className="mood-chwile-lista">
          {posort.map(c => {
            const m = moodZWartosci(c.value)
            const opis = [
              ...c.emotions.map(id => findEmotion(id, ust.emotions).label.toLowerCase()),
              ...c.factors.map(id => findFactor(id, ust.factors).label),
              ...people.filter(p => c.peopleIds.includes(p.id)).map(p => p.name.split(' ')[0]),
            ]
            return (
              <div key={c.id} className="mood-chwila-row" style={{ '--c': m.color }}>
                <button type="button" className="mood-chwila-open" onClick={() => setWidok(c.id)} aria-label={`Zmień chwilę ${c.time || ''}`}>
                  <span className="mood-chwila-face"><MoodFace mood={m} size={20} active /></span>
                  <span className="mood-chwila-txt">
                    <strong>{c.time || 'bez godziny'} · {m.label}</strong>
                    <small>{opis.join(', ') || 'dotknij, żeby dopisać emocje i co się działo'}</small>
                  </span>
                </button>
                <button type="button" className="t-btn delete" aria-label="Usuń chwilę" onClick={() => setChwile(ch => ch.filter(x => x.id !== c.id))}><IconTrash size={12} /></button>
              </div>
            )
          })}
          <button type="button" className="mood-chwila-add" onClick={() => setWidok('nowa')}><IconPlus size={14} /> Dodaj chwilę</button>
        </div>
      </div>

      {/* Relacje i kalendarz — osoby zbierają się z chwil */}
      <Czesc tytul="Relacje" podsumowanie={[wybraneOsoby.map(o => o.name.split(' ')[0]).join(', '), ratings.relacje ? `${ratings.relacje}/5` : ''].filter(Boolean).join(' · ') || 'jak się czujesz z ludźmi'}>
        <div className="mood-row">
          <span>Jak się czuję w relacjach</span>
          <Skala5 value={ratings.relacje || 0} onChange={v => setRatings(r => ({ ...r, relacje: v }))} color="#EC4899" />
        </div>
        {wybraneOsoby.length > 0 ? (
          <div className="mood-kal">
            <label className="mood-switch">
              <input type="checkbox" checked={kalWlaczony} onChange={e => { setKal(e.target.checked); setKalRecznie(true) }} />
              <span className="mood-switch-ui" aria-hidden="true" />
              <span>Wpisz do kalendarza<small>{wybraneOsoby.map(o => o.name.split(' ')[0]).join(', ')} · {dateLabel}</small></span>
            </label>
            {kalWlaczony && (
              <input className="form-input" value={tytul} onChange={e => setTytul(e.target.value)} maxLength={100}
                placeholder={tytulKal} aria-label="Tytuł w kalendarzu" style={{ marginTop: 8, fontSize: 16 }} />
            )}
          </div>
        ) : (
          <p className="mood-note">Osoby zaznaczasz w chwilach („Z kim”). Wtedy pojawi się tu opcja wpisania spotkania do kalendarza.</p>
        )}
      </Czesc>

      {/* Energia, stres, ciało (+ własne skale) */}
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

      <Czesc tytul="Notatka" podsumowanie={note.trim() ? note.trim().slice(0, 40) : 'jak minął dzień'}>
        <textarea className="form-input" placeholder="Jak minął dzień? Co czujesz?…"
          value={note} onChange={e => setNote(e.target.value)} rows={4} maxLength={1000}
          style={{ margin: 0, resize: 'vertical', fontSize: 16 }} />
      </Czesc>

      <div className="mood-form-foot">
        {blad && <p className="mood-note" style={{ color: 'var(--expense)', margin: '0 0 8px' }}>{blad}</p>}
        <button type="button" className="btn-save mood-save" onClick={() => zapisz()} disabled={saving || !chwile.length}>
          {saving ? 'Zapisywanie…' : !chwile.length ? 'Dodaj chwilę' : `Zapisz dzień · ${dateLabel}`}
        </button>
      </div>
    </div>
  )
}

/**
 * Jedna chwila: godzina (do zmiany), nastrój, emocje, co się działo, z kim.
 * „Zapisz” zapisuje od razu cały dzień — szybki wpis to jedno dotknięcie;
 * „Cały dzień” wraca do przeglądu (oceny, notatka, kolejne chwile).
 */
function ChwilaForm({ chwila, initialMood, isToday, ust, people, dodajWlasne, usunWlasne, naglowek, saving, blad, onDzien, onZapisz }) {
  const [time, setTime]         = useState(chwila?.time || (isToday ? format(new Date(), 'HH:mm') : ''))
  const [value, setValue]       = useState(chwila?.value || MOODS.find(m => m.id === initialMood)?.value || null)
  const [emotions, setEmotions] = useState(() => new Set(chwila?.emotions || []))
  const [factors, setFactors]   = useState(() => new Set(chwila?.factors || []))
  const [osoby, setOsoby]       = useState(() => new Set(chwila?.peopleIds || []))
  const [wszyscy, setWszyscy]   = useState(false)

  const przelacz = (setter) => (id) => setter(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const dodaj = (pole, stale, setter) => (nazwa) => { const id = dodajWlasne(pole, stale)(nazwa); if (id) setter(prev => new Set(prev).add(id)) }
  const usun = (pole, setter) => (id) => { usunWlasne(pole)(id); setter(prev => { const n = new Set(prev); n.delete(id); return n }) }

  const bliscy = people.filter(p => p.circle !== 'far')
  const widoczni = wszyscy || !bliscy.length ? people : people.filter(p => p.circle !== 'far' || osoby.has(p.id))
  const gotowa = () => value ? {
    id: chwila?.id || nowaChwilaId(), time: time || null, value,
    emotions: [...emotions], factors: [...factors], peopleIds: [...osoby],
  } : null

  return (
    <div className="mood-form">
      {naglowek}
      <div>
        <div className="mood-chwila-top">
          {kicker(isToday && !chwila ? 'Jak się masz teraz?' : 'Jak się czułaś?')}
          <label className="mood-time">
            <span>godz.</span>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label="Godzina chwili" />
          </label>
        </div>
        <div className="mood-faces">
          {MOODS.map(m => {
            const active = value === m.value
            return (
              <button key={m.id} type="button" aria-pressed={active} onClick={() => setValue(active ? null : m.value)}
                className={`mood-face-btn${active ? ' on' : ''}`} style={{ '--c': m.color }}>
                <MoodFace mood={m} size={28} active />
                <span>{m.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <Czesc tytul="Emocje" domyslnie podsumowanie={emotions.size ? [...emotions].map(id => findEmotion(id, ust.emotions).label.toLowerCase()).join(', ') : ''}>
        <EmotionWheel selected={emotions} onToggle={przelacz(setEmotions)} />
        <div className="emo-panel-lbl" style={{ marginTop: 12 }}>Inne stany</div>
        <ChipPicker items={INNE_EMOCJE} wlasne={ust.emotions || []} selected={emotions} onToggle={przelacz(setEmotions)}
          onAdd={dodaj('emotions', INNE_EMOCJE, setEmotions)} onRemove={usun('emotions', setEmotions)} placeholder="emocja…" />
      </Czesc>

      <Czesc tytul="Co się działo" podsumowanie={factors.size ? [...factors].map(id => findFactor(id, ust.factors).label).join(', ') : 'praca, studia, spotkanie…'}>
        <ChipPicker items={DOMYSLNE_CZYNNIKI} wlasne={ust.factors || []} selected={factors} onToggle={przelacz(setFactors)}
          onAdd={dodaj('factors', DOMYSLNE_CZYNNIKI, setFactors)} onRemove={usun('factors', setFactors)} placeholder="np. egzamin…" />
      </Czesc>

      <Czesc tytul="Z kim" podsumowanie={people.filter(p => osoby.has(p.id)).map(p => p.name.split(' ')[0]).join(', ') || 'osoby'}>
        {people.length > 0 ? (
          <div className="mood-people">
            {widoczni.map(p => {
              const on = osoby.has(p.id)
              return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => przelacz(setOsoby)(p.id)}
                  className={`mood-person${on ? ' on' : ''}`} style={{ '--c': p.color || '#8b5cf6' }}>
                  <PersonBubble person={p} size={22} />{p.name}
                </button>
              )
            })}
            {!wszyscy && bliscy.length > 0 && widoczni.length < people.length && (
              <button type="button" className="mood-chip add" onClick={() => setWszyscy(true)}>pokaż wszystkich</button>
            )}
          </div>
        ) : (
          <p className="mood-note">Dodaj osoby w zakładce „Osoby”, a będzie można tu zaznaczać, z kim byłaś.</p>
        )}
      </Czesc>

      <div className="mood-form-foot">
        {blad && <p className="mood-note" style={{ color: 'var(--expense)', margin: '0 0 8px' }}>{blad}</p>}
        <div className="mood-foot-row">
          <button type="button" className="mood-btn-ghost" onClick={() => onDzien(gotowa())}>
            <IconChevronLeft size={14} /> Cały dzień
          </button>
          <button type="button" className="btn-save mood-save" disabled={!value || saving} onClick={() => onZapisz(gotowa())}>
            {saving ? 'Zapisywanie…' : !value ? 'Wybierz nastrój' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>
  )
}
