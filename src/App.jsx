import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, USE_EMULATORS } from './firebase/config'
import Login from './components/Login'
import Pulpit from './components/Pulpit'
// Moduły ładowane leniwie — każdy trafia do osobnego chunka, więc start
// aplikacji (zwłaszcza na telefonie) nie ciągnie kodu wszystkich modułów naraz.
const Dashboard         = lazy(() => import('./components/Dashboard'))
const HabitsDashboard   = lazy(() => import('./components/habits/HabitsDashboard'))
const TodoDashboard     = lazy(() => import('./components/todo/TodoDashboard'))
const CalendarDashboard = lazy(() => import('./components/calendar/CalendarDashboard'))
const PrayerDashboard   = lazy(() => import('./components/prayer/PrayerDashboard'))
const BibleDashboard    = lazy(() => import('./components/bible/BibleDashboard'))
const PeopleHub         = lazy(() => import('./components/people/PeopleHub'))
const DreamDashboard    = lazy(() => import('./components/dream/DreamDashboard'))
const GratitudeDashboard = lazy(() => import('./components/gratitude/GratitudeDashboard'))
const MoodDashboard     = lazy(() => import('./components/mood/MoodDashboard'))
import SettingsDrawer from './components/SettingsDrawer'
import MoreSheet from './components/MoreSheet'
import ErrorBoundary from './components/ErrorBoundary'
import PasekPolaczenia from './components/PasekPolaczenia'
import { IconBudget, IconHabits, IconTodo, IconCalendar, IconPrayer, IconBook, IconSettings, IconHome, IconMore, IconUsers, IconMoon, IcSun, IconMood } from './components/Icons'
import { getModuleIcons, resolveIcon } from './utils/iconPrefs'
import { getLayout, saveLayout, applyLayout, visibleModules, navModules } from './utils/moduleLayout'
import { getCurrencyCode } from './utils/currency'
import { useRegularPaymentsProcessor } from './utils/regularPayments'

// Tryb lokalny (emulatory): logowanie Google jest pominięte — apka sama loguje
// się do emulatora Auth na jedno stałe konto lokalne. Zawsze to samo konto =
// zawsze te same dane, także po „Wyloguj". Prawdziwe konto z emulatora daje
// uid zgodne z regułami Firestore, więc lokalnie działają te same reguły
// dostępu co docelowo w chmurze. Hasło nic nie chroni — konto istnieje tylko
// w emulatorze na tym komputerze.
const LOCAL_EMAIL = 'laura@lokalnie.dev'
const LOCAL_PASSWORD = 'lokalnie-123'
const DEV_USER = { displayName: 'Laura', photoURL: null, email: LOCAL_EMAIL }
const asLocalUser = (u) => u ? { ...DEV_USER, uid: u.uid } : null

async function signInLocal() {
  try {
    await signInWithEmailAndPassword(auth, LOCAL_EMAIL, LOCAL_PASSWORD)
  } catch {
    // Pierwsze uruchomienie: konta jeszcze nie ma — zakładamy je.
    await createUserWithEmailAndPassword(auth, LOCAL_EMAIL, LOCAL_PASSWORD)
  }
}

const MODULE_ACCENTS = {
  home:     '#7C8AF0',
  budget:   '#33C3A6',
  habits:   '#E0B15A',
  todo:     '#5BB6D9',
  calendar: '#5FBF98',
  prayer:   '#C9A24A',
  bible:    '#4F74D9',
  people:   '#D98B5F',
  dream:    '#6366F1',
  gratitude:'#E8A33D',
  mood:     '#E8607A',
}

// Pełna lista modułów. To, które trafią na dolny pasek i czy w ogóle są
// widoczne, ustala użytkownik w Ustawieniach (patrz utils/moduleLayout).
function buildModules() {
  const prefs = getModuleIcons()
  return [
    { id: 'home',     label: 'Pulpit',    Icon: IconHome },
    { id: 'budget',   label: 'Finanse',   Icon: resolveIcon(prefs.budget,   IconBudget) },
    { id: 'habits',   label: 'Nawyki',    Icon: resolveIcon(prefs.habits,   IconHabits) },
    { id: 'todo',     label: 'To-do',     Icon: resolveIcon(prefs.todo,     IconTodo) },
    { id: 'calendar', label: 'Kalendarz', Icon: resolveIcon(prefs.calendar, IconCalendar) },
    { id: 'prayer',   label: 'Modlitwa',  Icon: resolveIcon(prefs.prayer,   IconPrayer) },
    { id: 'bible',    label: 'Biblia',    Icon: resolveIcon(prefs.bible,    IconBook) },
    { id: 'people',   label: 'Osoby',     Icon: resolveIcon(prefs.people,   IconUsers) },
    { id: 'dream',    label: 'Sen',       Icon: resolveIcon(prefs.dream,    IconMoon) },
    { id: 'gratitude',label: 'Wdzięcznik',Icon: resolveIcon(prefs.gratitude, IcSun) },
    { id: 'mood',     label: 'Nastrój',   Icon: resolveIcon(prefs.mood, IconMood) },
  ]
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // Po odświeżeniu wracamy do ostatnio otwartego modułu (walidacja po znanych id)
  const [activeModule, setActiveModule] = useState(() => {
    try {
      const saved = localStorage.getItem('mw_activeModule')
      return MODULE_ACCENTS[saved] ? saved : 'home'
    } catch { return 'home' }
  })
  useEffect(() => {
    try { localStorage.setItem('mw_activeModule', activeModule) } catch {}
  }, [activeModule])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  // Akcje modułu wstrzykiwane do górnej belki („Apka") — jeden pasek zamiast dwóch
  const [headerExtras, setHeaderExtras] = useState(null)
  // Przy WYJŚCIU z modułu czyścimy akcje w cleanupie. Efekty potomków (Dashboard
  // itd.) odpalają się przed efektem rodzica, więc gdyby rodzic czyścił w ciele
  // efektu, kasowałby przyciski dopiero co ustawione przez moduł (znikała belka).
  // Cleanup odpala się przy zmianie modułu — przed montażem efektu nowego modułu.
  useEffect(() => () => setHeaderExtras(null), [activeModule])
  const [baseModules, setBaseModules] = useState(() => buildModules())
  const [layout, setLayout] = useState(() => getLayout(buildModules().map(m => m.id)))
  const modules = useMemo(() => applyLayout(baseModules, layout), [baseModules, layout])
  const shown = useMemo(() => visibleModules(modules), [modules])

  const handleLayoutChange = useCallback((next) => {
    saveLayout(next)
    setLayout(next)
  }, [])

  // Gdy użytkownik ukryje moduł, w którym właśnie jest — wracamy na Pulpit,
  // żeby nie zostać w widoku, do którego nie ma już jak wrócić.
  useEffect(() => {
    if (modules.some(m => m.id === activeModule && m.hidden)) setActiveModule('home')
  }, [modules, activeModule])
  const [dreamFocus, setDreamFocus] = useState(null) // sen otwierany z innego modułu

  const openDream = (dreamId) => { setDreamFocus(dreamId); setActiveModule('dream'); setMoreOpen(false) }

  const handleModuleIconChange = () => setBaseModules(buildModules())

  // Auto-księgowanie regularnych płatności w tle — działa zawsze, nie tylko w zakładce „Regularne"
  useRegularPaymentsProcessor(user?.uid)

  // Zmiana waluty głównej/kursów: przeładowanie modułów (key), żeby przeliczyły sumy.
  const [currencyCode, setCurrencyCodeState] = useState(getCurrencyCode)
  const [currencyRev, setCurrencyRev] = useState(0)
  const handleCurrencyChange = useCallback((code) => {
    setCurrencyCodeState(code)
    setCurrencyRev(r => r + 1)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 8000)
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (USE_EMULATORS && !u) {
        signInLocal().catch((e) => {
          console.error('[firebase] Nie udało się zalogować do emulatora. Czy działa `npm run lokalnie`?', e)
          clearTimeout(timeout)
          setLoading(false)
        })
        return
      }
      clearTimeout(timeout)
      setUser(USE_EMULATORS ? asLocalUser(u) : u)
      setLoading(false)
    }, () => { clearTimeout(timeout); setLoading(false) })
    return () => { unsubscribe(); clearTimeout(timeout) }
  }, [])

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
    </div>
  )

  if (!user) return <Login />

  const accent = MODULE_ACCENTS[activeModule] || 'var(--primary)'
  const accentVars = {
    '--accent': accent,
    '--accent-soft': `color-mix(in oklab, ${accent} 15%, transparent)`,
  }

  const goTo = (id) => { setActiveModule(id); setMoreOpen(false); setDrawerOpen(false) }

  // Dolny pasek: pierwsze widoczne moduły z układu użytkownika + „Więcej"
  const navItems = navModules(modules)
  const slotCount = navItems.length + 1 // + „Więcej"
  const w = 100 / slotCount
  const inOverflow = !navItems.some(m => m.id === activeModule)
  const activeIdx = inOverflow ? navItems.length : navItems.findIndex(m => m.id === activeModule)

  return (
    <div className={`app app--glass app--${activeModule}`} style={accentVars}>
      <div className={`rev-bg rev-bg--${activeModule}`} aria-hidden="true"><span /><span /></div>

      {/* SIDEBAR — desktop only */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2l3 7h7l-5 5 2 7-7-4-7 4 2-7L2 9h7z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.1 }}>Apka 2.0</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2 }}>
              {user?.displayName || 'laura'}
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {modules.filter(m => !m.hidden).map(m => {
            const modAccent = MODULE_ACCENTS[m.id] || 'var(--primary)'
            const isActive = activeModule === m.id
            return (
              <button
                key={m.id}
                className={`sidebar-nav-item${isActive ? ' active' : ''}`}
                style={isActive ? { '--accent': modAccent, '--accent-soft': `color-mix(in oklab, ${modAccent} 15%, transparent)` } : {}}
                onClick={() => { setActiveModule(m.id); setDrawerOpen(false) }}
              >
                <m.Icon size={18}/>
                <span style={{ flex: 1 }}>{m.label}</span>
              </button>
            )
          })}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 99, background: 'var(--surface2)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-sub)', flexShrink: 0 }}>
            {user?.displayName?.[0]?.toUpperCase() || 'L'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.displayName || 'Laura'}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email || ''}</div>
          </div>
          <button className="icon-btn" style={{ width: 30, height: 30, flexShrink: 0 }} onClick={() => setDrawerOpen(true)}>
            <IconSettings size={14}/>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        {/* Topbar — desktop */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', margin: 0 }}>
              {modules.find(m => m.id === activeModule)?.label || ''}
            </h1>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              · {user?.displayName || 'laura'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {headerExtras}
            <button className="icon-btn" onClick={() => setDrawerOpen(true)}><IconSettings size={15}/></button>
          </div>
        </div>

        {/* Mobile header */}
        <div className="mobile-header">
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
              {modules.find(m => m.id === activeModule)?.label || ''}
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', marginTop: 2 }}>Apka 2.0</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {headerExtras}
            <button
              className="icon-btn"
              style={{ width: 34, height: 34, background: 'var(--accent-soft)', color: 'var(--accent)', border: 'none' }}
              onClick={() => setDrawerOpen(true)}
            >
              <IconSettings size={15}/>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="content" key={activeModule}>
          <div className="content-inner">
            {/* Nad treścią każdego modułu — brak sieci i padnięte subskrypcje
                dotyczą wszystkich tak samo, więc jedno miejsce zamiast banera
                w każdym module z osobna. */}
            <PasekPolaczenia />
            <ErrorBoundary moduleId={activeModule}>
            <Suspense fallback={<div className="loading-screen" style={{ minHeight: '40vh' }}><div className="spinner" /></div>}>
            {activeModule === 'home'     && <Pulpit key={`${currencyCode}-${currencyRev}`} user={user} onNavigate={goTo} visibleIds={shown.map(m => m.id)} />}
            {activeModule === 'budget'   && <Dashboard key={`${currencyCode}-${currencyRev}`} user={user} setHeaderExtras={setHeaderExtras} />}
            {activeModule === 'habits'   && <HabitsDashboard user={user} setHeaderExtras={setHeaderExtras} />}
            {activeModule === 'todo'     && <TodoDashboard user={user} setHeaderExtras={setHeaderExtras} />}
            {activeModule === 'calendar' && <CalendarDashboard user={user} setHeaderExtras={setHeaderExtras} />}
            {activeModule === 'prayer'   && <PrayerDashboard user={user} setHeaderExtras={setHeaderExtras} />}
            {activeModule === 'bible'    && <BibleDashboard user={user} setHeaderExtras={setHeaderExtras} />}
            {activeModule === 'people'   && <PeopleHub user={user} onOpenDream={openDream} setHeaderExtras={setHeaderExtras} />}
            {activeModule === 'dream'    && <DreamDashboard user={user} focusId={dreamFocus} onFocusConsumed={() => setDreamFocus(null)} setHeaderExtras={setHeaderExtras} />}
            {activeModule === 'gratitude'&& <GratitudeDashboard user={user} setHeaderExtras={setHeaderExtras} />}
            {activeModule === 'mood'     && <MoodDashboard user={user} setHeaderExtras={setHeaderExtras} />}
            </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>

      {/* Bottom nav — mobile */}
      <nav className="bottom-nav">
        <div className="bn-indicator" style={{ left: `calc(${(activeIdx + 0.5) * w}% - 12px)`, background: accent }}/>
        {navItems.map(m => {
          const isActive = activeModule === m.id
          const modAccent = MODULE_ACCENTS[m.id] || 'var(--primary)'
          return (
            <button
              key={m.id}
              className={`bottom-nav-item${isActive ? ' active' : ''}`}
              style={{ '--accent': modAccent }}
              onClick={() => goTo(m.id)}
            >
              <m.Icon size={21}/>
              <span>{m.label}</span>
            </button>
          )
        })}
        <button
          className={`bottom-nav-item${inOverflow || moreOpen ? ' active' : ''}`}
          style={{ '--accent': inOverflow ? accent : 'var(--primary)' }}
          onClick={() => setMoreOpen(o => !o)}
        >
          <IconMore size={21}/>
          <span>Więcej</span>
        </button>
      </nav>

      {/* Więcej — launcher wszystkich aplikacji */}
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        modules={modules}
        activeModule={activeModule}
        accents={MODULE_ACCENTS}
        onSelect={goTo}
        onSettings={() => { setMoreOpen(false); setDrawerOpen(true) }}
      />

      {/* Settings drawer */}
      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeModule={modules.find(m => m.id === activeModule)}
        modules={modules}
        onModuleChange={(id) => { setActiveModule(id); setDrawerOpen(false) }}
        user={user}
        onIconChange={handleModuleIconChange}
        onCurrencyChange={handleCurrencyChange}
        layout={layout}
        onLayoutChange={handleLayoutChange}
      />
    </div>
  )
}
