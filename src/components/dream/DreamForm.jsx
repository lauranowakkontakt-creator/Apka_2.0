import PersonBubble from '../PersonBubble'
import { db } from '../../firebase/config'
import { DREAM_EMOTIONS, symbolMatchesQuery, symbolForms, bestPersonMatch, detectTrigger, nameStem, parseMentions, personForms } from '../../utils/dreams'
import { IconClose, IconPlus, IconTag } from '../Icons'
import { toast } from '../Toast'
import { Chip, TODAY } from './wspolne'
import DreamWriteModes from './DreamWriteModes'
import { circleOf } from '../../utils/personCircles'
import { cleanDiagram, cleanMindMap } from '../../utils/dreamForms'
import {
  GUIDE_QUESTIONS, appendQuestion, hasJacksonFields, dreamKindIds, numberMeanings, NUMBER_CAVEAT,
  DREAM_POSITIONS, DREAM_SPHERES, DREAM_ORIGINS, DREAM_KINDS, DREAM_VIVIDNESS, DREAM_ATMOSPHERE,
  DREAM_COLORS, DREAM_ELEMENTS, BEFORE_SLEEP,
} from '../../utils/dreamJackson'
import { Timestamp, addDoc, arrayUnion, collection, doc, updateDoc } from 'firebase/firestore'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'

// Formularz snu: pisanie i edycja, razem z oznaczaniem osób (@) i symboli (#).

export default function DreamForm({ user, categories, people, symbols, onCreateSymbol, editData, onClose }) {
  const [title, setTitle]       = useState(editData?.title || '')
  const [date, setDate]         = useState(editData?.date || TODAY())
  const [text, setText]         = useState(editData?.text || '')
  const [category, setCategory] = useState(editData?.category || '')
  const [emotions, setEmotions] = useState(editData?.emotions || [])
  const [interpretation, setInterpretation] = useState(editData?.interpretation || '')
  const [peopleIds, setPeopleIds] = useState(editData?.peopleIds || [])
  const [symbolIds, setSymbolIds] = useState(editData?.symbolIds || [])
  const [localSymbols, setLocalSymbols] = useState([]) // symbole utworzone w tej sesji
  const [saving, setSaving]     = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  // Pola wg metody Jacksona — sekcja zwinięta przy szybkim zapisie, rozwinięta gdy sen je ma.
  const [showMore, setShowMore] = useState(hasJacksonFields(editData))
  const [position, setPosition] = useState(editData?.position || '')
  const [origin, setOrigin]     = useState(editData?.origin || '')
  const [kinds, setKinds]       = useState(dreamKindIds(editData))
  const [sphere, setSphere]     = useState(editData?.sphere || '')
  const [atmosphere, setAtmosphere] = useState(editData?.atmosphere || [])
  const [elements, setElements] = useState(editData?.elements || [])
  const [openGroup, setOpenGroup] = useState(null)
  const [context, setContext]   = useState(editData?.context || '')
  // Zaawansowane formy zapisu (opowieść, mapa myśli, diagram, spirala).
  const [story, setStory]       = useState(editData?.story || '')
  const [storyMoral, setStoryMoral] = useState(editData?.storyMoral || '')
  const [mindMap, setMindMap]   = useState(editData?.mindMap || null)
  const [diagram, setDiagram]   = useState(editData?.diagram || [])
  const [spiral, setSpiral]     = useState(editData?.spiral || '')
  const [personQuery, setPersonQuery] = useState('')
  const [showAllPeople, setShowAllPeople] = useState(false)
  const [showModes, setShowModes] = useState(!!(editData?.story || editData?.mindMap || editData?.diagram?.length || editData?.spiral))
  const [wakeTime, setWakeTime] = useState(editData?.wakeTime || '')
  const [vividness, setVividness] = useState(editData?.vividness || '')
  const [colors, setColors]     = useState(editData?.colors || [])
  const [mainElement, setMainElement] = useState(editData?.mainElement || '')
  const [numbers, setNumbers]   = useState(editData?.numbers || '')
  const [beforeSleep, setBeforeSleep] = useState(editData?.beforeSleep || [])
  const [application, setApplication] = useState(editData?.application || '')

  const textRef = useRef(null)
  const [trigger, setTrigger]   = useState(null) // { type:'person'|'symbol', query, start }
  const [caretPos, setCaretPos] = useState(null)

  // Pełny katalog symboli widoczny w formularzu (z bazy + utworzone teraz)
  const allSymbols = useMemo(() => {
    const m = {}
    ;[...symbols, ...localSymbols].forEach(s => { m[s.id] = s })
    return Object.values(m)
  }, [symbols, localSymbols])

  const toggle = (arr, setArr, id) =>
    setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id])

  const onTextChange = (e) => {
    const val = e.target.value
    setText(val)
    const caret = e.target.selectionStart
    // Symbol (#) może mieć kilka słów (np. „#stary dom"); osoba (@) — jedno.
    setTrigger(detectTrigger(val.slice(0, caret)))
  }

  const personMatches = useMemo(() => {
    if (trigger?.type !== 'person') return []
    const q = trigger.query.toLowerCase()
    // Dopasuj też odmiany: „@Manueli" trafia w osobę „Manuela" (przez rdzeń imienia).
    return people.filter(p => personForms(p).some(f => {
      const fl = f.toLowerCase()
      if (!q) return true
      return fl.startsWith(q) || q.startsWith(fl) || q.startsWith(nameStem(fl).toLowerCase()) || fl.includes(q)
    })).slice(0, 6)
  }, [trigger, people])

  const symbolMatches = useMemo(() => {
    if (trigger?.type !== 'symbol') return []
    return allSymbols.filter(s => symbolMatchesQuery(s, trigger.query)).slice(0, 6)
  }, [trigger, allSymbols])

  const canCreateSymbol = trigger?.type === 'symbol' && trigger.query.trim() &&
    !allSymbols.some(s => symbolForms(s).some(f => f.toLowerCase() === trigger.query.trim().toLowerCase()))

  const insertToken = (prefix, name) => {
    const ta = textRef.current
    const caret = ta ? ta.selectionStart : text.length
    const insert = prefix + name + ' '
    const next = text.slice(0, trigger.start) + insert + text.slice(caret)
    setText(next)
    setTrigger(null)
    setCaretPos(trigger.start + insert.length)
  }

  // Klik osoby: użyj formy dokładnie tak, jak ją wpisano (np. odmienioną „Manueli").
  // Jeśli to nowa forma — zapisz ją na stałe jako ksywkę osoby, by następnym razem od razu pasowała.
  const pickPerson = (p) => {
    const typed = (trigger?.query || '').trim()
    const form = typed || (p.name || '').trim().split(/\s+/)[0] || p.name
    if (!peopleIds.includes(p.id)) setPeopleIds([...peopleIds, p.id])
    if (typed && !formRecognized(p, typed)) {
      updateDoc(doc(db, 'users', user.uid, 'calendarPeople', p.id), { aliases: arrayUnion(typed) }).catch(() => {})
    }
    insertToken('@', form)
  }
  // Wybór symbolu: wstawiamy #nazwa (prefiks widać przy edycji, znika po zapisie),
  // a powiązanie trzyma lista symbolIds.
  const pickSymbol = (s) => { if (!symbolIds.includes(s.id)) setSymbolIds([...symbolIds, s.id]); insertToken('#', s.name) }
  const createAndPick = async () => {
    const n = trigger.query.trim()
    const sym = await onCreateSymbol(n)
    setLocalSymbols(prev => [...prev, sym])
    setSymbolIds(prev => prev.includes(sym.id) ? prev : [...prev, sym.id])
    insertToken('#', sym.name)
  }

  // Przywróć kursor po wstawieniu
  useLayoutEffect(() => {
    if (caretPos != null && textRef.current) {
      textRef.current.focus()
      textRef.current.setSelectionRange(caretPos, caretPos)
      setCaretPos(null)
    }
  }, [caretPos, text])

  // Symbole przypięte do snu (jawnie, niezależnie od treści) — klik usuwa
  const usedSymbols = useMemo(
    () => symbolIds.map(id => allSymbols.find(s => s.id === id)).filter(Boolean),
    [symbolIds, allSymbols]
  )

  const showDrop = trigger && (
    (trigger.type === 'person' && personMatches.length > 0) ||
    (trigger.type === 'symbol' && (symbolMatches.length > 0 || canCreateSymbol))
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() && !text.trim()) return
    setSaving(true)
    const mentionIds = parseMentions(text, people)
    const data = {
      title: title.trim(), date, text: text.trim(),
      interpretation: interpretation.trim(),
      category: category || null, emotions, peopleIds, mentionIds, symbolIds,
      position: position || null, origin: origin || null, kinds, sphere: sphere || null, vividness: vividness || null,
      atmosphere, elements, context: context.trim(), wakeTime: wakeTime || null,
      colors, mainElement: mainElement.trim(), numbers: numbers.trim(), beforeSleep,
      application: application.trim(),
      story: story.trim(), storyMoral: storyMoral.trim(), mindMap: cleanMindMap(mindMap),
      diagram: cleanDiagram(diagram), spiral: spiral.trim(),
      updatedAt: Timestamp.now(),
    }
    try {
      if (editData) {
        // Zapamiętaj poprzednią wersję, żeby dać „Cofnij" po zapisie edycji.
        const ref = doc(db, 'users', user.uid, 'dreams', editData.id)
        const prev = {
          title: editData.title ?? '', date: editData.date ?? date, text: editData.text ?? '',
          interpretation: editData.interpretation ?? '',
          category: editData.category ?? null, emotions: editData.emotions ?? [],
          peopleIds: editData.peopleIds ?? [], mentionIds: editData.mentionIds ?? [],
          symbolIds: editData.symbolIds ?? [],
          position: editData.position ?? null, origin: editData.origin ?? null, kinds: dreamKindIds(editData),
          sphere: editData.sphere ?? null, atmosphere: editData.atmosphere ?? [], elements: editData.elements ?? [],
          context: editData.context ?? '', wakeTime: editData.wakeTime ?? null,
          story: editData.story ?? '', storyMoral: editData.storyMoral ?? '', mindMap: editData.mindMap ?? null,
          diagram: editData.diagram ?? null, spiral: editData.spiral ?? '',
          vividness: editData.vividness ?? null, colors: editData.colors ?? [],
          mainElement: editData.mainElement ?? '', numbers: editData.numbers ?? '',
          beforeSleep: editData.beforeSleep ?? [], application: editData.application ?? '',
        }
        await updateDoc(ref, data)
        onClose()
        toast.success('Zapisano zmiany', {
          duration: 6000,
          action: {
            label: 'Cofnij',
            onClick: async () => {
              try {
                await updateDoc(ref, { ...prev, updatedAt: Timestamp.now() })
                toast.info('Przywrócono poprzednią wersję')
              } catch { toast.error('Nie udało się cofnąć') }
            },
          },
        })
      } else {
        await addDoc(collection(db, 'users', user.uid, 'dreams'), { ...data, createdAt: Timestamp.now() })
        onClose()
      }
    } catch { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{editData ? 'Edytuj sen' : 'Nowy sen'}</h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label>Tytuł snu</label>
            <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)}
              maxLength={120} placeholder="np. Lot nad miastem, Spotkanie z babcią..." autoFocus />
          </div>

          <div className="form-group">
            <label>Data</label>
            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} max={TODAY()} />
          </div>

          <div className="form-group" style={{ position: 'relative' }}>
            <label>Treść snu <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— @ osoba, # symbol</span></label>
            <textarea ref={textRef} className="form-input" value={text} onChange={onTextChange}
              rows={6} placeholder={'Opisz, co Ci się śniło... Wpisz @ aby oznaczyć osobę (np. @Kasia), # aby oznaczyć symbol (np. #drzewo).'}
              style={{ resize: 'vertical', minHeight: 130, lineHeight: 1.6 }} />

            {showDrop && (
              <div style={{
                position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 20, marginTop: -6,
                background: 'var(--popover-bg)', border: '1px solid var(--border-strong)', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)', overflow: 'hidden',
              }}>
                {trigger.type === 'person' && personMatches.map(p => {
                  const typed = (trigger.query || '').trim()
                  const known = !typed || formRecognized(p, typed)
                  return (
                    <button type="button" key={p.id} onClick={() => pickPerson(p)} style={dropItemStyle}>
                      <PersonBubble title person={p} size={26} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.name}</span>
                      {!known && (
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <IconPlus size={10} /> zapisz „{typed}"
                        </span>
                      )}
                    </button>
                  )
                })}
                {trigger.type === 'symbol' && symbolMatches.map(s => (
                  <button type="button" key={s.id} onClick={() => pickSymbol(s)} style={dropItemStyle}>
                    <span style={{ width: 26, height: 26, borderRadius: 7, display: 'grid', placeItems: 'center', background: (s.color || '#5BB6D9') + '22', color: s.color || '#5BB6D9', flexShrink: 0 }}>
                      <IconTag size={14} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>#{s.name}</span>
                  </button>
                ))}
                {trigger.type === 'symbol' && canCreateSymbol && (
                  <button type="button" onClick={createAndPick} style={{ ...dropItemStyle, color: 'var(--accent)' }}>
                    <span style={{ width: 26, height: 26, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)', flexShrink: 0 }}>
                      <IconPlus size={14} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Utwórz symbol „{trigger.query.trim()}"</span>
                  </button>
                )}
              </div>
            )}
            {trigger?.type === 'person' && personMatches.length === 0 && people.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Brak osób w bazie — dodaj je w module „Osoby".
              </div>
            )}

            {usedSymbols.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Symbole:</span>
                {usedSymbols.map(s => (
                  <Chip key={s.id} color={s.color || '#5BB6D9'} onClick={() => setSymbolIds(symbolIds.filter(id => id !== s.id))}>
                    {s.name} <IconClose size={11} />
                  </Chip>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Kategoria snu</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {categories.map(c => (
                <Chip key={c.id} color={c.color} active={category === c.id}
                  onClick={() => setCategory(category === c.id ? '' : c.id)}>
                  {c.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Emocje po obudzeniu <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— można wybrać kilka</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DREAM_EMOTIONS.map(em => (
                <Chip key={em.id} color={em.color} active={emotions.includes(em.id)}
                  onClick={() => toggle(emotions, setEmotions, em.id)}>
                  {em.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Osoby, które brały udział w śnie <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— {peopleIds.length > 0 ? `wybrano ${peopleIds.length}` : 'możesz też wpisać @ w treści'}</span></label>
            {people.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Brak osób — dodaj je w module „Osoby", a pojawią się tutaj i po wpisaniu @.
              </p>
            ) : (
              <>
                {/* Wybrane osoby — zawsze widoczne */}
                {peopleIds.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {people.filter(p => peopleIds.includes(p.id)).map(p => (
                      <button type="button" key={p.id} onClick={() => toggle(peopleIds, setPeopleIds, p.id)} style={personChip(p, true)}>
                        <PersonBubble title person={p} size={22} />{p.name}<IconClose size={11} />
                      </button>
                    ))}
                  </div>
                )}
                <input type="search" className="form-input" value={personQuery} onChange={e => setPersonQuery(e.target.value)}
                  placeholder="Szukaj osoby…" />
                {/* Podpowiedzi: przy wpisywaniu dopasowania ze wszystkich, inaczej bliscy; zawsze zwinięte do kilku */}
                {(() => {
                  const q = personQuery.trim().toLowerCase()
                  const pool = people.filter(p => !peopleIds.includes(p.id) &&
                    (q ? personForms(p).some(f => f.toLowerCase().includes(q)) || (p.name || '').toLowerCase().includes(q)
                       : showAllPeople || circleOf(p) === 'close'))
                  const list = showAllPeople || q ? pool : pool.slice(0, 8)
                  return (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, maxHeight: showAllPeople ? 220 : undefined, overflowY: showAllPeople ? 'auto' : undefined }}>
                        {list.map(p => (
                          <button type="button" key={p.id} onClick={() => { toggle(peopleIds, setPeopleIds, p.id); setPersonQuery('') }} style={personChip(p, false)}>
                            <PersonBubble title person={p} size={22} />{p.name}
                          </button>
                        ))}
                        {list.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nikogo nie znaleziono</span>}
                      </div>
                      {!q && pool.length > 8 && (
                        <button type="button" onClick={() => setShowAllPeople(v => !v)} style={{ background: 'none', border: 'none', padding: '6px 0 0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                          {showAllPeople ? 'Zwiń listę' : `Pokaż wszystkich (${people.filter(p => !peopleIds.includes(p.id)).length})`}
                        </button>
                      )}
                    </>
                  )
                })()}
              </>
            )}
          </div>

          <button type="button" onClick={() => setShowMore(v => !v)} style={{
            alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--accent)',
          }}>
            {showMore ? 'Ukryj szczegóły snu' : 'Szczegóły snu: pozycja, kolory, liczby, kategorie'}
          </button>

          {showMore && (
            <>
              <div className="form-group">
                <label>Gdzie jestem w śnie <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— to mówi, o kim jest sen</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DREAM_POSITIONS.map(o => (
                    <Chip key={o.id} color="#9B7CF0" active={position === o.id}
                      onClick={() => setPosition(position === o.id ? '' : o.id)}>{o.label}</Chip>
                  ))}
                </div>
                {position && <p style={hintStyle}>{DREAM_POSITIONS.find(o => o.id === position)?.hint}</p>}
              </div>

              <div className="form-group">
                <label>Główny element <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— kto lub co jest w centrum uwagi</span></label>
                <input type="text" className="form-input" value={mainElement} maxLength={120}
                  onChange={e => setMainElement(e.target.value)} placeholder="np. zamknięte drzwi, powódź, dziecko..." />
              </div>

              <div className="form-group">
                <label>Sfera snu</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DREAM_SPHERES.map(o => (
                    <Chip key={o.id} color="#5BB6D9" active={sphere === o.id}
                      onClick={() => setSphere(sphere === o.id ? '' : o.id)}>{o.label}</Chip>
                  ))}
                </div>
                {sphere && <p style={hintStyle}>{DREAM_SPHERES.find(o => o.id === sphere)?.hint}</p>}
              </div>

              <div className="form-group">
                <label>Barwa obrazu</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DREAM_VIVIDNESS.map(o => (
                    <Chip key={o.id} color="#7C8AF0" active={vividness === o.id}
                      onClick={() => setVividness(vividness === o.id ? '' : o.id)}>{o.label}</Chip>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Wyraźne kolory</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DREAM_COLORS.map(c => (
                    <Chip key={c.id} color={c.color} active={colors.includes(c.id)}
                      onClick={() => toggle(colors, setColors, c.id)}>{c.label}</Chip>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Wydźwięk snu</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DREAM_ATMOSPHERE.map(o => (
                    <Chip key={o.id} color="#E0B15A" active={atmosphere.includes(o.id)}
                      onClick={() => toggle(atmosphere, setAtmosphere, o.id)}>{o.label}</Chip>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Co pojawiło się w śnie <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— dotknij grupy</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DREAM_ELEMENTS.map(g => {
                    const n = elements.filter(e => e.startsWith(g.id + ':')).length
                    return (
                      <Chip key={g.id} color="#5FBF98" active={openGroup === g.id || n > 0}
                        onClick={() => setOpenGroup(openGroup === g.id ? null : g.id)}>
                        {g.label}{n > 0 ? ` (${n})` : ''}
                      </Chip>
                    )
                  })}
                </div>
                {openGroup && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, padding: 10, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    {DREAM_ELEMENTS.find(g => g.id === openGroup).items.map(item => {
                      const key = openGroup + ':' + item
                      return (
                        <Chip key={key} color="#5FBF98" active={elements.includes(key)}
                          onClick={() => toggle(elements, setElements, key)}>{item}</Chip>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Liczby <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— wpisz, a pokażę znaczenie z tabeli</span></label>
                <input type="text" className="form-input" value={numbers} maxLength={80}
                  onChange={e => setNumbers(e.target.value)} placeholder="np. 3, 12, 2010" />
                {numberMeanings(numbers).length > 0 && (
                  <div style={hintStyle}>
                    {numberMeanings(numbers).map(m => `${m.n} = ${m.meaning}`).join(' · ')}
                    <br />{NUMBER_CAVEAT}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Skąd może być ten sen</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DREAM_ORIGINS.map(o => (
                    <Chip key={o.id} color={o.color} active={origin === o.id}
                      onClick={() => setOrigin(origin === o.id ? '' : o.id)}>{o.label}</Chip>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Kategorie snu <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— może być kilka</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DREAM_KINDS.map(o => (
                    <Chip key={o.id} color={o.color} active={kinds.includes(o.id)}
                      onClick={() => toggle(kinds, setKinds, o.id)}>{o.label}</Chip>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Przed snem <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— gniew, pycha i alkohol osłabiają pamięć snów</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {BEFORE_SLEEP.map(o => (
                    <Chip key={o.id} color="#D98B5F" active={beforeSleep.includes(o.id)}
                      onClick={() => toggle(beforeSleep, setBeforeSleep, o.id)}>{o.label}</Chip>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Godzina przebudzenia <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— najlepsza pora na zapis to 4:00–5:00</span></label>
                <input type="time" className="form-input" value={wakeTime} onChange={e => setWakeTime(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Kontekst <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— nad czym Bóg teraz pracuje, o co się modlę</span></label>
                <textarea className="form-input" value={context} onChange={e => setContext(e.target.value)}
                  rows={2} placeholder="Co dzieje się w moim życiu w tym czasie..."
                  style={{ resize: 'vertical', minHeight: 56, lineHeight: 1.6 }} />
              </div>
            </>
          )}

          <button type="button" onClick={() => setShowModes(v => !v)} style={{
            alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--accent)',
          }}>
            {showModes ? 'Ukryj zapis rozszerzony' : 'Zapis rozszerzony: opowieść, mapa myśli, diagram, spirala'}
          </button>
          {showModes && (
            <DreamWriteModes dreamText={text}
              story={story} setStory={setStory} storyMoral={storyMoral} setStoryMoral={setStoryMoral}
              mindMap={mindMap} setMindMap={setMindMap} diagram={diagram} setDiagram={setDiagram}
              spiral={spiral} setSpiral={setSpiral} />
          )}

          <div className="form-group">
            <label>Interpretacja <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— opcjonalnie</span></label>
            <textarea className="form-input" value={interpretation} onChange={e => setInterpretation(e.target.value)}
              rows={4} placeholder="Co ten sen może oznaczać? Twoje przemyślenia, skojarzenia..."
              style={{ resize: 'vertical', minHeight: 90, lineHeight: 1.6 }} />
            <button type="button" onClick={() => setShowGuide(v => !v)} style={{
              marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--accent)',
            }}>
              {showGuide ? 'Ukryj pytania pomocnicze' : 'Pytania pomocnicze do interpretacji'}
            </button>
            {showGuide && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dotknij pytania, a wstawi się do interpretacji.</span>
                {GUIDE_QUESTIONS.map((g, i) => (
                  <div key={g.id}>
                    {(i === 0 || GUIDE_QUESTIONS[i - 1].group !== g.group) && (
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.16em', textTransform: 'uppercase', margin: '6px 0 4px' }}>{g.group}</div>
                    )}
                    <button type="button" onClick={() => setInterpretation(cur => appendQuestion(cur, g.q))} style={{
                      width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12, lineHeight: 1.5, color: 'var(--text-sub)',
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                    }}>{g.q}</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showMore && (
            <div className="form-group">
              <label>Zastosowanie <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— co mam z tym zrobić</span></label>
              <textarea className="form-input" value={application} onChange={e => setApplication(e.target.value)}
                rows={3} placeholder="Modlitwa, rozmowa, decyzja, a może poczekać..."
                style={{ resize: 'vertical', minHeight: 70, lineHeight: 1.6 }} />
            </div>
          )}

          <button type="submit" className="btn-save" disabled={saving || (!title.trim() && !text.trim())}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz zmiany' : 'Zapisz sen'}
          </button>
        </form>
      </div>
    </div>
  )
}

// Czy wpisana forma (np. odmieniona „Manueli") jest już rozpoznawana jako ta osoba.
// Odmiany łapie samo dopasowanie, więc ksywkę zapisujemy tylko dla form, których nie zna.
const formRecognized = (person, typed) => {
  const m = bestPersonMatch(typed.toLowerCase(), [person])
  return !!m && m.len === typed.length
}

// Pigułka osoby w wyborze uczestników snu.
const personChip = (p, on) => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 4px', borderRadius: 999,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
  border: `1px solid ${on ? (p.color || 'var(--accent)') : 'var(--border)'}`,
  background: on ? (p.color || 'var(--accent)') + '1e' : 'var(--surface2)',
  color: on ? (p.color || 'var(--accent)') : 'var(--text-sub)',
})

const hintStyle = { margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }

const dropItemStyle = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px',
  background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
}

/* ─── DreamStats — kalendarz-heatmapa dni ze snami (ciemniej = więcej snów) ─── */
