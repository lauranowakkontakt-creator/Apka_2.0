import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { IconAppMark, IconSettings } from './Icons'

export default function Header({ user, modules, activeModule, onModuleChange, onSettingsOpen }) {
  const handleLogout = () => signOut(auth)
  const displayName = user.displayName?.split(' ')[0] || 'Laura'

  return (
    <header className="header">
      {/* Logo mark */}
      <div className="header-left">
        <div className="header-logo-mark">
          <IconAppMark size={28} />
        </div>
        <div className="header-logo-text">
          <span className="header-logo-name">Apka 2.0</span>
          <span className="header-logo-sub">{displayName.toLowerCase()}</span>
        </div>
      </div>

      {/* Module nav — center */}
      <nav className="header-modules">
        {modules.filter(m => !m.hidden).map(m => (
          <button
            key={m.id}
            className={`module-btn ${activeModule === m.id ? 'active' : ''} ${m.soon ? 'soon' : ''}`}
            onClick={() => !m.soon && onModuleChange(m.id)}
            title={m.soon ? `${m.label} — wkrótce` : m.label}
          >
            <m.Icon size={18} />
            <span className="module-label">{m.label}</span>
            {m.soon && <span className="soon-badge">wkrótce</span>}
          </button>
        ))}
      </nav>

      {/* Right: avatar + settings */}
      <div className="header-right">
        <button className="settings-btn" onClick={onSettingsOpen} title="Ustawienia">
          <IconSettings size={17} />
        </button>
        {user.photoURL
          ? <img src={user.photoURL} alt="" className="avatar" />
          : <div className="avatar-placeholder">{displayName[0]}</div>
        }
      </div>
    </header>
  )
}
