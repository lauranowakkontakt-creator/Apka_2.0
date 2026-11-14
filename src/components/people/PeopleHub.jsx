import PersonBubble from '../PersonBubble'
import { useState, useEffect, useMemo } from 'react'
import { collection, query, addDoc, updateDoc, doc, Timestamp, orderBy } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import {
  IconEdit, IconTrash, IconClose, IconCalendar, IconPrayer,
  IconChevronRight, IconChevronLeft, IconUsers, IconEye, IconEyeOff, IconCheck, IconMoon,
  IconCash, IconTodo, IconArrowUp, IconArrowDown, IconPlus
} from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { setPersonHidden, setPersonCircle, purgePerson } from '../../utils/people'
import { CIRCLES, circleOf, circleCounts, visiblePeople } from '../../utils/personCircles'
import SegTabs from '../SegTabs'
import { PERSON_COLORS } from '../../utils/personColors'
import { IconPicker, ColorPicker } from '../Pickers'
import { getCategory, dreamPeopleIds } from '../../utils/dreams'
import { debtsForPerson, debtSummary, todosForPerson, linkCountsByPerson } from '../../utils/personLinks'
import { fmt } from '../../utils/currency'
import { bladSubskrypcji } from '../../utils/polaczenie'

const TODAY = () => format(new Date(), 'yyyy-MM-dd')
const initials = (name) => (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

export default function PeopleHub({ user, onOpenDream, setHeaderExtras }) {
  const [people, setPeople]         = useState([])
  const [events, setEvents]         = useState([])
  const [intentions, setIntentions] = useState([])
  const [dreams, setDreams]         = useState([])
  const [debts, setDebts]           = useState([])
  const [todos, setTodos]           = useState([])
  const [loading, setLoading]       = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [selectedId, setSelectedId] = useState(null)
  const [showForm, setShowForm]     = useState(false)
  const [editPerson, setEditPerson] = useState(null)
  const [circle, setCircle]         = useState('close')   // close | far | all
  const [q, setQ]                   = useState('')

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'calendarPeople'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => { setPeople(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      bladSubskrypcji('calendarPeople', { przyBledzie: () => setLoading(false) }))
  }, [user.uid])
  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'calendarEvents'), orderBy('date', 'asc'))
    return onSnapshot(q, snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('calendarEvents'))
  }, [user.uid])
  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'prayerIntentions'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => setIntentions(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('prayerIntentions'))
  }, [user.uid])
  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'dreams'), orderBy('date', 'desc'))
    return onSnapshot(q, snap => setDreams(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('dreams'))
  }, [user.uid])
  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'debtors'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setDebts(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('debtors'))
  }, [user.uid])
  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'todos'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => setTodos(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('todos'))
  }, [user.uid])

  const stats = useMemo(() => {
    const m = {}
    people.forEach(p => { m[p.id] = { events: 0, intentions: 0, dreams: 0, debts: 0, todos: 0 } })
    events.forEach(e => { if (e.personId && m[e.personId]) m[e.personId].events++ })
    intentions.forEach(i => { if (i.personId && m[i.personId]) m[i.personId].intentions++ })
    dreams.forEach(d => { dreamPeopleIds(d).forEach(pid => { if (m[pid]) m[pid].dreams++ }) })
    const links = linkCountsByPerson(people, debts, todos)
    people.forEach(p => { m[p.id].debts = links[p.id]?.debts || 0; m[p.id].todos = links[p.id]?.todos || 0 })
    return m
  }, [people, events, intentions, dreams, debts, todos])

  const toggleHidden = async (person, module) => {
    const field = module === 'calendar' ? 'hiddenInCalendar' : 'hiddenInPrayer'
    await setPersonHidden(user.uid, person.id, module, !person[field])
  }
  const toggleCircle = (person) => setPersonCircle(user.uid, person.id, circleOf(person) === 'far' ? 'close' : 'far')
  const counts = useMemo(() => circleCounts(people), [people])
  const shown = useMemo(() => visiblePeople(people, { circle, q }), [people, circle, q])
  const deletePersonH = async (id) => {
    const ok = await confirmDialog({
      title: 'Usunąć osobę trwale?',
      message: 'Usunie też WSZYSTKIE jej wydarzenia i prośby modlitewne. Tego nie da się cofnąć.'
    })
    if (!ok) return
    await purgePerson(user.uid, id)
    if (selectedId === id) setSelectedId(null)
  }

  // Górna belka („Apka"): liczba osób + ＋ Dodaj osobę.
  // Hook przed early-returnem (zasady hooków).
  useEffect(() => {
    setHeaderExtras?.(
      <>
        <span className="mod-header-stat"><IconUsers size={14} style={{ color: 'var(--accent)' }} /><span>{people.length}</span></span>
        <button className="hdr-btn accent" title="Dodaj osobę" onClick={() => { setEditPerson(null); setShowForm(true) }}><IconPlus size={17} /></button>
      </>
    )
    return () => setHeaderExtras?.(null)
  }, [people.length])

  if (loading) return <div className="list-loading">Ładowanie...</div>

  const selected = people.find(p => p.id === selectedId)

  return (
    <div className="people-hub">
      {selected ? (
        <PersonDetail
          uid={user.uid}
          person={selected}
          events={events.filter(e => e.personId === selected.id)}
          intentions={intentions.filter(i => i.personId === selected.id)}
          dreams={dreams.filter(d => dreamPeopleIds(d).includes(selected.id))}
          debts={debtsForPerson(debts, selected.id)}
          todos={todosForPerson(todos, selected.id)}
          onOpenDream={onOpenDream}
          onBack={() => setSelectedId(null)}
          onToggleHidden={toggleHidden}
          onToggleCircle={() => toggleCircle(selected)}
          onEdit={() => { setEditPerson(selected); setShowForm(true) }}
          onDelete={() => deletePersonH(selected.id)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {people.length > 0 && (
            <>
              <SegTabs active={circle} onChange={setCircle} items={[
                { id: 'close', label: `Bliscy (${counts.close})` },
                { id: 'far',   label: `Dalsi (${counts.far})` },
                { id: 'all',   label: `Wszyscy (${counts.all})` },
              ]} />
              <input type="search" className="form-input" value={q} onChange={e => setQ(e.target.value)}
                placeholder="Szukaj osoby (we wszystkich kręgach)…" />
            </>
          )}
          {people.length === 0 ? (
            <div className="list-empty">
              <p>Brak osób</p>
              <p className="list-empty-hint">Osoby dodane tutaj, w Kalendarzu lub w Modlitwie trafiają do wspólnej bazy</p>
            </div>
          ) : shown.length === 0 ? (
            <div className="list-empty">
              <p>{q.trim() ? 'Nikogo nie znaleziono' : circle === 'far' ? 'Brak osób w dalszym kręgu' : 'Brak osób w tym kręgu'}</p>
              {!q.trim() && circle === 'far' && <p className="list-empty-hint">Przenieś osobę przyciskiem ze strzałką przy jej nazwisku</p>}
            </div>
          ) : shown.map(p => {
            const s = stats[p.id] || { events: 0, intentions: 0 }
            return (
              <div key={p.id} onClick={() => setSelectedId(p.id)} style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${p.color || '#8b5cf6'}`,
                borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'
              }}>
                <PersonBubble person={p} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.name}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconCalendar size={11} /> {s.events}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconPrayer size={11} /> {s.intentions}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconMoon size={11} /> {s.dreams}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconTodo size={11} /> {s.todos}</span>
                    {s.debts > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--accent)' }}><IconCash size={11} /> {s.debts}</span>}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button className="t-btn" onClick={() => toggleCircle(p)} title={circleOf(p) === 'far' ? 'Przenieś do bliskich' : 'Przenieś do dalszych'}
                    style={{ padding: '4px 7px', fontSize: 10, fontWeight: 600 }}>
                    {circleOf(p) === 'far' ? <IconArrowUp size={12} /> : <IconArrowDown size={12} />}
                  </button>
                  <VisToggle active={!p.hiddenInCalendar} label="Kalendarz" Icon={IconCalendar} onClick={() => toggleHidden(p, 'calendar')} />
                  <VisToggle active={!p.hiddenInPrayer} label="Modlitwa" Icon={IconPrayer} onClick={() => toggleHidden(p, 'prayer')} />
                </div>
                <IconChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <PersonForm user={user} editData={editPerson} onClose={() => { setShowForm(false); setEditPerson(null) }} />
      )}
    </div>
  )
}

/* Mały przełącznik widoczności w module */
function VisToggle({ active, label, Icon, onClick }) {
  return (
    <button title={`${label}: ${active ? 'widoczna' : 'ukryta'}`} onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, padding: '4px 7px', borderRadius: 8, cursor: 'pointer',
      fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      background: active ? 'var(--accent-soft)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--text-muted)',
    }}>
      <Icon size={12} />
      {active ? <IconEye size={11} /> : <IconEyeOff size={11} />}
    </button>
  )
}

/* ─── PersonDetail ─────────────────────────────────────────────────────── */
function PersonDetail({ uid, person, events, intentions, dreams = [], debts = [], todos = [], onOpenDream, onBack, onToggleHidden, onToggleCircle, onEdit, onDelete }) {
  const today = TODAY()
  const personDreams = [...dreams].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const upcoming = events.filter(e => (e.dateEnd || e.date) >= today).sort((a, b) => a.date.localeCompare(b.date))
  const past     = events.filter(e => (e.dateEnd || e.date) < today).sort((a, b) => b.date.localeCompare(a.date))
  const activeInt = intentions.filter(i => i.status === 'active' || !i.status)
  const endedInt  = intentions.filter(i => i.status === 'ended')
  const activeDebts = debts.filter(d => !d.settled)
  const settledDebts = debts.filter(d => d.settled)
  const { theyOwe, iOwe, net } = debtSummary(debts)
  const activeTodos = todos.filter(t => !t.done)
  const doneTodos   = todos.filter(t => t.done)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Nagłówek osoby */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button aria-label="Wróć" className="t-btn" onClick={onBack} style={{ padding: '4px 8px' }}><IconChevronLeft size={18} /></button>
        <PersonBubble person={person} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{person.name}</p>
          {person.note && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{person.note}</p>}
        </div>
        <button className="t-btn" title="Edytuj" onClick={onEdit}><IconEdit size={15} /></button>
        <button className="t-btn delete" title="Usuń trwale" onClick={onDelete}><IconTrash size={15} /></button>
      </div>

      {/* Krąg: bliscy / dalsi (dalsi nie pokazują się na głównej liście) */}
      <button onClick={onToggleCircle} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, cursor: 'pointer',
        fontSize: 12, fontWeight: 600, fontFamily: 'inherit', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-sub)',
      }}>
        {circleOf(person) === 'far' ? <IconArrowUp size={13} /> : <IconArrowDown size={13} />}
        Krąg: {circleOf(person) === 'far' ? 'dalsi' : 'bliscy'}. Dotknij, żeby przenieść do {circleOf(person) === 'far' ? 'bliskich' : 'dalszych'}
      </button>

      {/* Widoczność w modułach */}
      <div style={{ display: 'flex', gap: 8 }}>
        <ModuleSwitch active={!person.hiddenInCalendar} label="Kalendarz" Icon={IconCalendar} onClick={() => onToggleHidden(person, 'calendar')} />
        <ModuleSwitch active={!person.hiddenInPrayer} label="Modlitwa" Icon={IconPrayer} onClick={() => onToggleHidden(person, 'prayer')} />
      </div>

      {/* Ważne informacje */}
      <InfoNotes uid={uid} person={person} />

      {/* Finanse / długi */}
      <Section title="Rozliczenia" icon={<IconCash size={13} />}>
        {activeDebts.length === 0 && settledDebts.length === 0 ? (
          <Empty>Brak wpisów — dodaj w module „Finanse → Dłużnicy"</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeDebts.length > 0 && (
              <div style={{
                fontSize: 13, fontWeight: 600, padding: '8px 10px', borderRadius: 8, background: 'var(--surface2)',
                color: net === 0 ? 'var(--text-muted)' : net > 0 ? 'var(--income)' : 'var(--expense)',
              }}>
                {net > 0 ? `${person.name} jest Ci winien(-a) ${fmt(net)}` :
                 net < 0 ? `Jesteś winna ${person.name} ${fmt(-net)}` :
                 'Wzajemne rozliczenia się bilansują'}
                {theyOwe > 0 && iOwe > 0 && (
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>
                    winien(-a) mi {fmt(theyOwe)} · jestem winna {fmt(iOwe)}
                  </span>
                )}
              </div>
            )}
            {activeDebts.map(d => <DebtRow key={d.id} debt={d} />)}
            {settledDebts.length > 0 && (
              <details>
                <summary style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, listStyle: 'none', padding: '4px 0' }}>
                  <IconChevronRight size={11} style={{ verticalAlign: 'middle' }} /> Rozliczone ({settledDebts.length})
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {settledDebts.map(d => <DebtRow key={d.id} debt={d} muted />)}
                </div>
              </details>
            )}
          </div>
        )}
      </Section>

      {/* Zadania */}
      <Section title="Zadania" icon={<IconTodo size={13} />}>
        {activeTodos.length === 0 && doneTodos.length === 0 ? (
          <Empty>Brak zadań z tą osobą</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Paged items={activeTodos}>{t => <TodoRow key={t.id} todo={t} />}</Paged>
            {doneTodos.length > 0 && (
              <details>
                <summary style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, listStyle: 'none', padding: '4px 0' }}>
                  <IconChevronRight size={11} style={{ verticalAlign: 'middle' }} /> Ukończone ({doneTodos.length})
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {doneTodos.map(t => <TodoRow key={t.id} todo={t} muted />)}
                </div>
              </details>
            )}
          </div>
        )}
      </Section>

      {/* Prośby modlitewne */}
      <Section title="Prośby modlitewne" icon={<IconPrayer size={13} />}>
        {activeInt.length === 0 && endedInt.length === 0 ? (
          <Empty>Brak próśb modlitewnych</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activeInt.map(i => (
              <Row key={i.id} color="#C9A24A">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{i.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <IconPrayer size={10} /> ×{i.prayedDates?.length || 0}
                    {i.eventId && <span style={{ color: '#a78bfa' }}>· z kalendarza</span>}
                  </div>
                </div>
              </Row>
            ))}
            {endedInt.map(i => (
              <Row key={i.id} color="var(--border)" muted>
                <IconCheck size={14} style={{ color: '#27AE60', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>{i.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>zakończona · <IconPrayer size={9} /> ×{i.prayedDates?.length || 0}</div>
                </div>
              </Row>
            ))}
          </div>
        )}
      </Section>

      {/* Sny */}
      <Section title="Sny" icon={<IconMoon size={13} />}>
        {personDreams.length === 0 ? (
          <Empty>Brak snów z tą osobą</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Paged items={personDreams}>{d => {
              const cat = getCategory(d.category)
              return (
                <div key={d.id} onClick={() => onOpenDream?.(d.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  background: 'var(--surface2)', borderLeft: `3px solid ${cat?.color || '#6366F1'}`,
                  borderRadius: 8, padding: '8px 10px',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {(() => { try { return format(parseISO(d.date), 'd MMM yy', { locale: pl }) } catch { return d.date } })()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.title || 'Sen bez tytułu'}
                    </div>
                    {cat && <div style={{ fontSize: 10, color: cat.color }}>{cat.label}</div>}
                  </div>
                  <IconChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
              )
            }}</Paged>
          </div>
        )}
      </Section>

      {/* Wydarzenia / wyjazdy */}
      <Section title="Wydarzenia i wyjazdy" icon={<IconCalendar size={13} />}>
        {upcoming.length === 0 && past.length === 0 ? (
          <Empty>Brak wydarzeń</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcoming.map(e => (
              <Row key={`${e.id}-${e.date}`} color={person.color || '#5FBF98'}>
                <div style={{ fontSize: 11, color: person.color || '#5FBF98', fontWeight: 700, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {format(parseISO(e.date), 'd MMM', { locale: pl })}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.title}</div>
                  {e.note && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{e.note}</div>}
                </div>
                {e.prayer?.enabled && <IconPrayer size={12} style={{ color: '#a78bfa', flexShrink: 0 }} />}
              </Row>
            ))}
            {past.length > 0 && (
              <details>
                <summary style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, listStyle: 'none', padding: '4px 0' }}>
                  <IconChevronRight size={11} style={{ verticalAlign: 'middle' }} /> Minione ({past.length})
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {past.map(e => (
                    <Row key={`${e.id}-${e.date}`} color={person.color || '#5FBF98'} muted>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {format(parseISO(e.date), 'd MMM yy', { locale: pl })}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{e.title}</div>
                    </Row>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </Section>
    </div>
  )
}

function ModuleSwitch({ active, label, Icon, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, cursor: 'pointer',
      fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      background: active ? 'var(--accent-soft)' : 'var(--surface2)',
      color: active ? 'var(--accent)' : 'var(--text-muted)',
    }}>
      <Icon size={14} /> {label} {active ? <IconEye size={13} /> : <IconEyeOff size={13} />}
    </button>
  )
}

/* Ważne informacje — edytowalna notatka per osoba */
function InfoNotes({ uid, person }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(person.info || '')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setText(person.info || ''); setEditing(false) }, [person.id])

  const save = async () => {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', uid, 'calendarPeople', person.id), { info: text.trim() })
      setEditing(false)
    } finally { setSaving(false) }
  }

  return (
    <Section title="Ważne informacje" icon={<IconEdit size={12} />}>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea className="form-input" value={text} onChange={e => setText(e.target.value)} rows={4} autoFocus
            placeholder="Co warto pamiętać o tej osobie..."
            style={{ width: '100%', margin: 0, fontSize: 13, resize: 'vertical', minHeight: 90, lineHeight: 1.5, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setText(person.info || ''); setEditing(false) }} style={{ padding: '7px 14px', fontSize: 12, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)' }}>Anuluj</button>
            <button className="btn-save" style={{ width: 'auto', margin: 0, padding: '7px 16px', fontSize: 12 }} disabled={saving} onClick={save}>{saving ? '...' : 'Zapisz'}</button>
          </div>
        </div>
      ) : person.info ? (
        <div onClick={() => setEditing(true)} style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', cursor: 'text', lineHeight: 1.5 }}>{person.info}</div>
      ) : (
        <button onClick={() => setEditing(true)} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Dodaj informacje</button>
      )}
    </Section>
  )
}

/* drobne helpery wizualne */
function Section({ title, icon, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 14 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon} {title}
      </div>
      {children}
    </div>
  )
}
function Row({ color, muted, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '8px 10px', opacity: muted ? 0.6 : 1 }}>
      {children}
    </div>
  )
}
// Długa lista po 5 pozycji: „Pokaż więcej" dodaje kolejne 5, „Zwiń" wraca do 5.
function Paged({ items, step = 5, children }) {
  const [shown, setShown] = useState(step)
  const list = items.slice(0, shown)
  const btn = { background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }
  return (
    <>
      {list.map(children)}
      {items.length > step && (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {shown < items.length && (
            <button type="button" style={btn} onClick={() => setShown(n => n + step)}>
              Pokaż więcej ({Math.min(step, items.length - shown)} z {items.length - shown} pozostałych)
            </button>
          )}
          {shown > step && <button type="button" style={{ ...btn, color: 'var(--text-muted)' }} onClick={() => setShown(step)}>Zwiń</button>}
        </div>
      )}
    </>
  )
}

function Empty({ children }) {
  return <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{children}</div>
}

function DebtRow({ debt, muted }) {
  const theyOwe = debt.direction === 'theyOwe'
  const color = muted ? 'var(--border)' : theyOwe ? '#5FBF98' : '#E0673E'
  const DirIcon = theyOwe ? IconArrowDown : IconArrowUp
  return (
    <Row color={color} muted={muted}>
      <DirIcon size={14} style={{ color: muted ? 'var(--text-muted)' : theyOwe ? '#5FBF98' : '#E0673E', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{theyOwe ? 'Winien(-a) mi' : 'Jestem winna'}</div>
        {debt.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{debt.notes}</div>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: muted ? 'var(--text-muted)' : theyOwe ? '#5FBF98' : '#E0673E', flexShrink: 0, textDecoration: muted ? 'line-through' : 'none' }}>
        {fmt(debt.amount || 0)}
      </div>
    </Row>
  )
}

function TodoRow({ todo, muted }) {
  return (
    <Row color={muted ? 'var(--border)' : 'var(--sky)'} muted={muted}>
      {todo.done && <IconCheck size={14} style={{ color: '#27AE60', flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, textDecoration: todo.done ? 'line-through' : 'none', color: todo.done ? 'var(--text-muted)' : 'var(--text)' }}>{todo.title}</div>
        {todo.dueDate && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <IconCalendar size={10} /> {(() => { try { return format(parseISO(todo.dueDate), 'd MMM yy', { locale: pl }) } catch { return todo.dueDate } })()}
          </div>
        )}
      </div>
    </Row>
  )
}

/* ─── PersonForm ───────────────────────────────────────────────────────── */
function PersonForm({ user, editData, onClose }) {
  const [name, setName]     = useState(editData?.name || '')
  const [note, setNote]     = useState(editData?.note || '')
  const [info, setInfo]     = useState(editData?.info || '')
  const [icon, setIcon]     = useState(editData?.icon || 'IcUsers')
  const [color, setColor]   = useState(editData?.color || PERSON_COLORS[Math.floor(Math.random() * PERSON_COLORS.length)])
  const [circleSel, setCircleSel] = useState(circleOf(editData))
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const data = { name: name.trim(), note: note.trim(), info: info.trim(), icon, color, circle: circleSel, updatedAt: Timestamp.now() }
    try {
      if (editData) {
        await updateDoc(doc(db, 'users', user.uid, 'calendarPeople', editData.id), data)
      } else {
        await addDoc(collection(db, 'users', user.uid, 'calendarPeople'), { ...data, createdAt: Timestamp.now() })
      }
      onClose()
    } catch { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{editData ? 'Edytuj osobę' : 'Nowa osoba'}</h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label>Imię / nazwa</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)}
              maxLength={60} placeholder="np. Mama, Zuzia, Przyjaciel Paweł..." />
          </div>

          <div className="form-group">
            <label>Kolor</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <div className="form-group">
            <label>Krąg <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— dalsi nie pokazują się na głównej liście</span></label>
            <SegTabs active={circleSel} onChange={setCircleSel} items={CIRCLES.map(c => ({ id: c.id, label: c.label }))} />
          </div>

          <div className="form-group">
            <label>Ikona</label>
            <IconPicker value={icon} onChange={setIcon} color={color} />
          </div>

          <div className="form-group">
            <label>Krótki opis (opcjonalnie)</label>
            <input type="text" className="form-input" value={note} onChange={e => setNote(e.target.value)}
              maxLength={120} placeholder="np. siostra, kolega z pracy..." />
          </div>

          <div className="form-group">
            <label>Ważne informacje (opcjonalnie)</label>
            <textarea className="form-input" value={info} onChange={e => setInfo(e.target.value)}
              rows={3} maxLength={1000} placeholder="Co warto pamiętać..." style={{ resize: 'vertical', minHeight: 70, lineHeight: 1.5 }} />
          </div>

          <button type="submit" className="btn-save" disabled={saving || !name.trim()}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz' : 'Dodaj osobę'}
          </button>
        </form>
      </div>
    </div>
  )
}
