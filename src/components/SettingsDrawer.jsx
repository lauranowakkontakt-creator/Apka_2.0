import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { IconClose, IconChevronLeft, IconEye, IconEyeOff, IconReorder } from './Icons'
import { useDragReorder, DragHandle } from './DragReorder'
import { IconPicker } from './Pickers'
import { saveModuleIcon, getModuleIcons } from '../utils/iconPrefs'
import { moveModuleTo, toggleHidden, isHidden, FIXED_FIRST, NAV_SLOTS } from '../utils/moduleLayout'
import { CURRENCIES, getCurrencyCode, setCurrencyCode, getRates, setRate, parseAmount } from '../utils/currency'
import { exportAllJSON, exportTransactionsCSV } from '../utils/dataExport'
import { toast } from './Toast'
import Diagnostyka from './Diagnostyka'
import ClearModuleData from './ClearModuleData'

export default function SettingsDrawer({ open, onClose, activeModule, modules, onModuleChange, onIconChange, onCurrencyChange, user, layout, onLayoutChange }) {
  const handleLogout = () => { signOut(auth); onClose() }
  const displayName = user.displayName || 'Laura'
  const initials = displayName[0]?.toUpperCase() || 'L'
  const [pickerModule, setPickerModule] = useState(null)

  return (
    <>
      {open && <div className="drawer-overlay" onClick={onClose} />}
      <aside className={`drawer ${open ? 'open' : ''}`}>
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-user">
            {user.photoURL
              ? <img src={user.photoURL} alt="" className="drawer-avatar" />
              : <div className="drawer-avatar-placeholder">{initials}</div>
            }
            <div>
              <div className="drawer-name">{displayName}</div>
              <div className="drawer-email">{user.email || ''}</div>
            </div>
          </div>
          <button className="drawer-close" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>

        {/* Moduły */}
        <div className="drawer-section">
          <p className="drawer-section-title">Moduły</p>
          <div className="drawer-apps-grid">
            {modules.filter(m => !m.hidden).map(m => (
              <button
                key={m.id}
                className={`drawer-app-btn ${activeModule?.id === m.id ? 'active' : ''} ${m.soon ? 'soon' : ''}`}
                onClick={() => !m.soon && onModuleChange(m.id)}
              >
                <span className="drawer-app-icon"><m.Icon size={22} /></span>
                <span className="drawer-app-label">{m.label}</span>
                {m.soon && <span className="drawer-soon">wkrótce</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Układ aplikacji — kolejność i ukrywanie */}
        {layout && onLayoutChange && (
          <div className="drawer-section">
            <p className="drawer-section-title">Twoje aplikacje</p>
            <ModuleLayoutPanel modules={modules} layout={layout} onChange={onLayoutChange} />
          </div>
        )}

        {/* Ikony aplikacji */}
        <div className="drawer-section">
          <p className="drawer-section-title">Ikony aplikacji</p>
          {pickerModule ? (
            <IconPickerPanel
              module={pickerModule}
              onPick={(key) => {
                saveModuleIcon(pickerModule.id, key)
                onIconChange?.()
                setPickerModule(null)
              }}
              onCancel={() => setPickerModule(null)}
            />
          ) : (
            <div className="drawer-icon-list">
              {modules.filter(m => !m.hidden && !m.soon).map(m => (
                <button key={m.id} className="drawer-icon-row" onClick={() => setPickerModule(m)}>
                  <span className="drawer-icon-preview"><m.Icon size={20} /></span>
                  <span className="drawer-icon-label">{m.label}</span>
                  <span className="drawer-icon-change">Zmień →</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ustawienia bieżącego modułu */}
        {activeModule && !activeModule.soon && (
          <div className="drawer-section">
            <p className="drawer-section-title">Ustawienia — {activeModule.label}</p>
            <div className="drawer-settings-list">
              {activeModule.id === 'budget' && <BudgetSettings onCurrencyChange={onCurrencyChange} />}
              {activeModule.id === 'habits' && <HabitsSettings />}
            </div>
          </div>
        )}

        {/* Kopia danych */}
        <div className="drawer-section">
          <p className="drawer-section-title">Kopia danych</p>
          <DataBackup uid={user.uid} />
        </div>

        {/* Czyszczenie danych modułu */}
        <div className="drawer-section">
          <p className="drawer-section-title">Wyczyść dane modułu</p>
          <ClearModuleData uid={user.uid} />
        </div>

        {/* Diagnostyka */}
        <div className="drawer-section">
          <p className="drawer-section-title">Gdy coś nie działa</p>
          <Diagnostyka />
        </div>

        {/* Footer */}
        <div className="drawer-footer">
          <button className="drawer-logout" onClick={handleLogout}>Wyloguj się</button>
          <p className="drawer-version">Apka · v1.0</p>
        </div>
      </aside>
    </>
  )
}

function DataBackup({ uid }) {
  const [busy, setBusy] = useState(null)
  const run = async (kind, fn) => {
    setBusy(kind)
    try {
      const ok = await fn(uid)
      if (ok !== false) toast.success('Gotowe')
    }
    catch (e) { console.error('Eksport danych nie powiódł się:', e); toast.error('Nie udało się pobrać') }
    setBusy(null)
  }
  const btn = {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '12px 14px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)',
    color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 6,
  }
  return (
    <div>
      <button style={btn} disabled={busy} onClick={() => run('json', exportAllJSON)}>
        <span>Pobierz pełną kopię</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{busy === 'json' ? '...' : 'JSON'}</span>
      </button>
      <button style={btn} disabled={busy} onClick={() => run('csv', exportTransactionsCSV)}>
        <span>Eksport transakcji</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{busy === 'csv' ? '...' : 'CSV'}</span>
      </button>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 2px 0', lineHeight: 1.45 }}>
        Kopia zapisuje wszystkie Twoje dane na telefon/komputer. Trzymaj ją w bezpiecznym miejscu.
      </p>
    </div>
  )
}

function IconPickerPanel({ module, onPick, onCancel }) {
  // Ten sam wybierak co w formularzach: 10 kategorii, 10 ikon w rzędzie.
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={onCancel} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}><IconChevronLeft size={13} /> Wróć</button>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Ikona: {module.label}</span>
      </div>
      <IconPicker value={getModuleIcons()[module.id]} onChange={onPick} />
    </div>
  )
}

function BudgetSettings({ onCurrencyChange }) {
  const [current, setCurrent] = useState(getCurrencyCode)
  const [rates, setRates] = useState(getRates)

  const handleSelect = (code) => {
    setCurrent(code)
    setCurrencyCode(code)
    onCurrencyChange?.(code)
  }
  const handleRate = (code, value) => {
    const v = parseAmount(value)
    if (!(v > 0)) return
    setRate(code, v)
    setRates(getRates())
    onCurrencyChange?.(current)
  }

  return (
    <>
      <div className="drawer-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        <span className="drawer-item-label">Waluta główna</span>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {CURRENCIES.map(c => (
            <button key={c.code} onClick={() => handleSelect(c.code)} style={{
              padding: '4px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
              background: current === c.code ? 'var(--accent)' : 'var(--surface2)',
              color: current === c.code ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${current === c.code ? 'var(--accent)' : 'var(--border)'}`,
              fontWeight: current === c.code ? 700 : 400,
            }}>
              {c.code} <span style={{ opacity: 0.7 }}>{c.symbol}</span>
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          W tej walucie liczą się sumy, statystyki i łączny majątek. Pozostałe waluty są przeliczane po kursach poniżej.
        </span>
      </div>
      <div className="drawer-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
        <span className="drawer-item-label">Kursy (w zł za 1 jednostkę)</span>
        {CURRENCIES.filter(c => c.code !== 'PLN').map(c => (
          <label key={`${c.code}-${rates[c.code]}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 40 }}>{c.code}</span>
            <input type="text" inputMode="decimal" className="form-input" style={{ width: 90, padding: '4px 8px' }}
              defaultValue={String(rates[c.code]).replace('.', ',')}
              onBlur={e => handleRate(c.code, e.target.value)} />
          </label>
        ))}
      </div>
      <DrawerItem label="Początek miesiąca" value="1. dzień" />
    </>
  )
}

function HabitsSettings() {
  return (
    <>
      <DrawerItem label="Przypomnienia" value="wyłączone" />
      <DrawerItem label="Tydzień zaczyna się" value="w poniedziałek" />
    </>
  )
}

function DrawerItem({ label, value, action }) {
  return (
    <div className={`drawer-item ${action ? 'clickable' : ''}`}>
      <span className="drawer-item-label">{label}</span>
      {value && <span className="drawer-item-value">{value}</span>}
      {action && <span className="drawer-item-arrow">›</span>}
    </div>
  )
}


/* Kolejność i widoczność aplikacji. Pierwsze widoczne moduły lądują na dolnym
   pasku telefonu, reszta zostaje w „Więcej". Pulpit jest przypięty na górze —
   to launcher, więc ani go nie przesuwamy, ani nie ukrywamy. */
function ModuleLayoutPanel({ modules, layout, onChange }) {
  const order = layout.order.filter(id => modules.some(m => m.id === id))
  const byId = new Map(modules.map(m => [m.id, m]))
  const movable = order.filter(id => id !== FIXED_FIRST)

  const drag = useDragReorder(movable.length, (from, to) =>
    onChange({ ...layout, order: moveModuleTo(layout.order, movable[from], movable[to]) }))
  const hide = (id) => onChange(toggleHidden(layout, id))

  // Ile pozycji z góry trafia na dolny pasek (Pulpit zajmuje jeden slot).
  const navIds = order.filter(id => !isHidden(layout, id)).slice(0, NAV_SLOTS)

  return (
    <div>
      <p className="drawer-hint">
        <IconReorder size={12} /> Kolejność decyduje, co masz pod ręką — pierwsze {NAV_SLOTS} widoczne
        aplikacje siedzą na dolnym pasku. Okiem chowasz te, których nie używasz: znikają z paska,
        z „Więcej" i z Pulpitu.
      </p>

      <div className="mod-layout-list">
        {order.map((id, i) => {
          const m = byId.get(id)
          if (!m) return null
          const pinned = id === FIXED_FIRST
          const hidden = isHidden(layout, id)
          const onBar = navIds.includes(id)
          const idx = movable.indexOf(id)
          return (
            <div key={id} className={`mod-layout-row${hidden ? ' hidden' : ''}`} {...(idx >= 0 ? drag.wiersz(idx) : {})}>
              <DragHandle disabled={pinned} {...(idx >= 0 ? drag.uchwyt(idx) : {})} />
              <span className="mod-layout-num">{i + 1}</span>
              <span className="mod-layout-icon"><m.Icon size={17} /></span>
              <span className="mod-layout-label">
                {m.label}
                {pinned && <span className="mod-layout-badge">zawsze</span>}
                {!pinned && onBar && <span className="mod-layout-badge">na pasku</span>}
              </span>
              <button type="button" className={`icon-btn mod-layout-btn${hidden ? '' : ' on'}`}
                title={pinned ? 'Pulpitu nie da się ukryć' : hidden ? 'Pokaż' : 'Ukryj'}
                disabled={pinned} onClick={() => hide(id)}>
                {hidden ? <IconEyeOff size={13} /> : <IconEye size={13} />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
