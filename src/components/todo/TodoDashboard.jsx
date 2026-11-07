import { db } from '../../firebase/config'
import { bladSubskrypcji } from '../../utils/polaczenie'
import { nextOccurrence, pOrder, zadaniaUkonczone } from '../../utils/todoLogic'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { confirmDialog } from '../ConfirmModal'
import { CatIcon, IconChevronDown, IconChevronLeft, IconChevronRight, IconEdit, IconPlus, IconStar } from '../Icons'
import StatTiles from '../StatTiles'
import { toast } from '../Toast'
import ListForm from './ListForm'
import TodoCalendar from './TodoCalendar'
import TodoForm from './TodoForm'
import TodoItem from './TodoItem'
import TodoMenu from './TodoMenu'
import TodoStats from './TodoStats'
import { format, isToday, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Timestamp, collection, deleteDoc, doc, orderBy, query, updateDoc } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { useEffect, useState } from 'react'

// Moduł To-do — spinacz. Dane z Firestore, filtry i wybór widoku;
// wyświetlanie oddane komponentom w plikach obok.

export default function TodoDashboard({ user, setHeaderExtras }) {
  const [todos, setTodos]           = useState([])
  const [lists, setLists]           = useState([])
  const [people, setPeople]         = useState([])
  const [loading, setLoading]       = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [view, setView]             = useState('main') // main | stats | done (z menu ⋮)
  const [activeList, setActiveList] = useState(null)
  const [showForm, setShowForm]     = useState(false)
  const [editTodo, setEditTodo]     = useState(null)
  const [formDefaultDue, setFormDefaultDue] = useState('')
  const [showDone, setShowDone]     = useState(false)
  const [showListForm, setShowListForm] = useState(false)
  const [editList, setEditList]       = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showLists, setShowLists]   = useState(false)
  // Filtr „Wybrane" — zadania oznaczone gwiazdką, żeby przy długiej liście nie
  // szukać tego, co naprawdę chcesz dziś zrobić.
  const [tylkoWybrane, setTylkoWybrane] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'todos'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => { setTodos(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      bladSubskrypcji('todos', { przyBledzie: () => setLoading(false) }))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'todoLists'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setLists(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('todoLists'))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'calendarPeople'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setPeople(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('calendarPeople'))
  }, [user.uid])

  const peopleById = Object.fromEntries(people.map(p => [p.id, p]))

  const toggleDone = async (todo) => {
    // Zadanie cykliczne: zamiast „zrobione" przesuwamy na kolejny termin i odznaczamy podzadania
    if (!todo.done && todo.recurrence) {
      const base = todo.dueDate ? parseISO(todo.dueDate) : new Date()
      const next = nextOccurrence(base, todo.recurrence)
      await updateDoc(doc(db, 'users', user.uid, 'todos', todo.id), {
        dueDate: format(next, 'yyyy-MM-dd'),
        subtasks: (todo.subtasks || []).map(s => ({ ...s, done: false })),
        done: false, doneAt: null, lastDoneAt: Timestamp.now(), updatedAt: Timestamp.now()
      })
      toast.success(`Przeniesiono na ${format(next, 'd MMM', { locale: pl })}`)
      return
    }
    await updateDoc(doc(db, 'users', user.uid, 'todos', todo.id), {
      done: !todo.done, doneAt: todo.done ? null : Timestamp.now(), updatedAt: Timestamp.now()
    })
  }

  const toggleStar = async (todo) => {
    await updateDoc(doc(db, 'users', user.uid, 'todos', todo.id), { starred: !todo.starred, updatedAt: Timestamp.now() })
  }

  const toggleSubtask = async (todo, subId) => {
    const subtasks = (todo.subtasks || []).map(s => s.id === subId ? { ...s, done: !s.done } : s)
    await updateDoc(doc(db, 'users', user.uid, 'todos', todo.id), { subtasks, updatedAt: Timestamp.now() })
  }

  const handleDelete = async (id) => {
    const ok = await confirmDialog({ title: 'Usunąć zadanie?' })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'todos', id))
  }

  // Wybrane (gwiazdka) zawsze na górze, dalej jak dotąd: termin, potem priorytet.
  const sortActive = (arr) => [...arr].sort((a, b) => {
    if (!!a.starred !== !!b.starred) return a.starred ? -1 : 1
    const aDate = a.dueDate ? parseISO(a.dueDate) : null
    const bDate = b.dueDate ? parseISO(b.dueDate) : null
    if (aDate && bDate) return aDate - bDate
    if (aDate) return -1
    if (bDate) return 1
    return (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3)
  })

  const byList   = activeList ? todos.filter(t => t.listId === activeList) : todos
  const bySearch = searchQuery.trim() ? byList.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase())) : byList
  const filtered = tylkoWybrane ? bySearch.filter(t => t.starred) : bySearch
  const ileWybranych = byList.filter(t => t.starred && !t.done).length
  const active   = sortActive(filtered.filter(t => !t.done))
  const done     = filtered.filter(t => t.done)
  // Osobny ekran ukończonych pokazuje wszystko, bo nie ma tam wyboru listy
  // ani szukajki — filtry z widoku głównego nie miałyby czym sterować.
  const ukonczone = zadaniaUkonczone(todos)

  // Górna belka („Apka"): [⋮ Więcej — z Analizą][＋ Nowe zadanie].
  // Hook przed early-returnem (zasady hooków).
  const handleMenu = (id) => {
    if (id === 'stats')   setView('stats')
    if (id === 'search')  { setShowSearch(s => !s); setSearchQuery('') }
    // Osobny ekran, a nie przełącznik sekcji „Zrobione" na dole listy:
    // przy zwiniętej sekcji i długiej liście kliknięcie nie dawało nic widocznego.
    if (id === 'done')    setView('done')
    if (id === 'newlist') setShowListForm(true)
  }
  useEffect(() => {
    setHeaderExtras?.(
      <>
        <TodoMenu onAction={handleMenu} />
        <button className="hdr-btn accent" title="Nowe zadanie"
          onClick={() => { setEditTodo(null); setFormDefaultDue(''); setShowForm(true) }}>
          <IconPlus size={17} />
        </button>
      </>
    )
    return () => setHeaderExtras?.(null)
  }, [])

  if (loading) return <div className="list-loading">Ładowanie...</div>

  const activeListObj = lists.find(l => l.id === activeList)
  const activeListColor = activeListObj?.color || 'var(--sky)'

  const dueToday = active.filter(t => t.dueDate && isToday(parseISO(t.dueDate)))
  const highCount = active.filter(t => t.priority === 'high').length

  const listRow = (isActive, color) => ({
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 8,
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: isActive ? 700 : 500, textAlign: 'left',
    background: isActive ? (color || 'var(--sky)') + '1c' : 'transparent', border: 'none',
    color: isActive ? (color || 'var(--sky)') : 'var(--text-sub)',
  })

  return (
    <div className="todo-dashboard">
      {view === 'stats' ? (
        <>
          <div className="rev-subhead">
            <button className="rev-back" onClick={() => setView('main')} title="Wróć"><IconChevronLeft size={18} /></button>
            <div className="rev-subhead-title">Analiza i statystyki</div>
          </div>
          <TodoStats todos={todos} lists={lists} />
        </>
      ) : view === 'done' ? (
        <>
          <div className="rev-subhead">
            <button className="rev-back" onClick={() => setView('main')} title="Wróć"><IconChevronLeft size={18} /></button>
            <div className="rev-subhead-title">Ukończone zadania</div>
          </div>
          {ukonczone.length === 0 ? (
            <div className="list-empty">
              <p>Brak ukończonych zadań</p>
              <p className="list-empty-hint">Odhaczone zadania pojawią się tutaj</p>
            </div>
          ) : (
            <div style={{ marginBottom: 80 }}>
              <div className="kicker" style={{ marginBottom: 10 }}>Zrobione · {ukonczone.length}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ukonczone.map(todo => (
                  <TodoItem key={todo.id} todo={todo} lists={lists} peopleById={peopleById}
                    onToggle={toggleDone} onToggleSubtask={toggleSubtask}
                    onEdit={() => { setEditTodo(todo); setShowForm(true) }}
                    onDelete={handleDelete} onStar={toggleStar} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <StatTiles tiles={[
            { label: 'Aktywne', value: active.length },
            { label: 'Na dziś', value: dueToday.length, color: dueToday.length ? 'var(--accent)' : undefined },
            { label: 'Ukończone', value: done.length },
          ]} />

          {showSearch && (
            <div style={{ padding: '0 0 12px' }}>
              <input className="form-input" placeholder="Szukaj zadań..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} style={{ margin: 0 }} />
            </div>
          )}
          {/* Wybór listy (kategorie) — zwinięte, rozwijasz „Listy" */}
          <div style={{ position: 'relative', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setShowLists(s => !s)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 99, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              border: `1px solid ${activeListObj ? activeListColor : 'var(--border-strong)'}`,
              background: activeListObj ? activeListColor + '1c' : 'var(--surface2)',
              color: activeListObj ? activeListColor : 'var(--text-sub)',
            }}>
              {activeListObj ? <><CatIcon categoryId={null} emoji={activeListObj.icon} size={13} /> {activeListObj.name}</> : 'Wszystkie zadania'}
              <IconChevronDown size={13} style={{ opacity: 0.7 }} />
            </button>
            <button onClick={() => setTylkoWybrane(v => !v)} aria-pressed={tylkoWybrane}
              title={tylkoWybrane ? 'Pokaż wszystkie zadania' : 'Pokaż tylko wybrane (z gwiazdką)'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 99, cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                border: `1px solid ${tylkoWybrane ? 'var(--warn)' : 'var(--border-strong)'}`,
                background: tylkoWybrane ? 'color-mix(in oklab, var(--warn) 16%, transparent)' : 'var(--surface2)',
                color: tylkoWybrane ? 'var(--warn)' : 'var(--text-sub)',
              }}>
              <IconStar size={13} style={tylkoWybrane ? { fill: 'currentColor' } : undefined} /> Wybrane{ileWybranych ? ` · ${ileWybranych}` : ''}
            </button>
            {activeListObj && (
              <button className="icon-btn" style={{ width: 32, height: 32 }} title="Edytuj listę" onClick={() => setEditList(activeListObj)}><IconEdit size={13} /></button>
            )}
            {showLists && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 200, minWidth: 230, background: 'var(--popover-bg)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 6, boxShadow: '0 10px 30px rgba(0,0,0,.4)', display: 'flex', flexDirection: 'column', gap: 2 }}
                onClick={() => setShowLists(false)}>
                <button onClick={() => setActiveList(null)} style={listRow(!activeList, 'var(--sky)')}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--sky)', flexShrink: 0 }} /> Wszystkie
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{todos.filter(t => !t.done).length || ''}</span>
                </button>
                {lists.map(l => {
                  const cnt = todos.filter(t => !t.done && t.listId === l.id).length
                  return (
                    <button key={l.id} onClick={() => setActiveList(l.id)} style={listRow(activeList === l.id, l.color)}>
                      <CatIcon categoryId={null} emoji={l.icon} size={13} /> {l.name}
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{cnt || ''}</span>
                    </button>
                  )
                })}
                <button onClick={() => setShowListForm(true)} style={{ ...listRow(false), color: 'var(--text-muted)', borderTop: '1px solid var(--border)', borderRadius: 0, marginTop: 2, paddingTop: 8 }}>
                  <IconPlus size={13} /> Nowa lista
                </button>
              </div>
            )}
          </div>

          {/* Active tasks */}
          {active.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="kicker" style={{ marginBottom: 10 }}>Aktywne · {active.length}</div>
              <div data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {active.map(todo => (
                  <TodoItem key={todo.id} todo={todo} lists={lists} peopleById={peopleById}
                    onToggle={toggleDone} onToggleSubtask={toggleSubtask}
                    onEdit={() => { setEditTodo(todo); setShowForm(true) }}
                    onDelete={handleDelete} onStar={toggleStar} />
                ))}
              </div>
            </div>
          )}

          {tylkoWybrane && active.length === 0 && (
            <div className="list-empty">
              <p>Brak wybranych zadań</p>
              <p className="list-empty-hint">Kliknij gwiazdkę przy zadaniu, żeby trafiło tutaj</p>
            </div>
          )}
          {!tylkoWybrane && active.length === 0 && done.length === 0 && (
            <div className="list-empty">
              <p>Brak zadań</p>
              <p className="list-empty-hint">Kliknij „+" u góry, aby dodać zadanie</p>
            </div>
          )}

          {/* Done tasks */}
          {done.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <button onClick={() => setShowDone(v => !v)} style={{
                fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 6
              }}>
                {showDone ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />} Zrobione ({done.length})
              </button>
              {showDone && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: 0.55 }}>
                  {done.map(todo => (
                    <TodoItem key={todo.id} todo={todo} lists={lists} peopleById={peopleById}
                      onToggle={toggleDone} onToggleSubtask={toggleSubtask}
                      onEdit={() => { setEditTodo(todo); setShowForm(true) }}
                      onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Kalendarz pod zadaniami */}
          <div style={{ marginTop: 8, marginBottom: 80 }}>
            <div className="kicker" style={{ marginBottom: 10 }}>Kalendarz</div>
            <TodoCalendar
              todos={todos} lists={lists}
              onToggle={toggleDone}
              onEdit={(t) => { setEditTodo(t); setShowForm(true) }}
              onAddOnDay={(dateStr) => { setEditTodo(null); setFormDefaultDue(dateStr); setShowForm(true) }}
            />
          </div>
        </>
      )}

      {showForm && (
        <TodoForm user={user} lists={lists} people={people} editData={editTodo} defaultListId={activeList} defaultDueDate={formDefaultDue}
          onClose={() => { setShowForm(false); setEditTodo(null); setFormDefaultDue('') }} />
      )}
      {showListForm && <ListForm user={user} onClose={() => setShowListForm(false)} />}
      {editList && <ListForm user={user} onClose={() => setEditList(null)} editData={editList} />}
    </div>
  )
}

/* ─── TodoItem ─── */
