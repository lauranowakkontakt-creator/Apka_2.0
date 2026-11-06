import { IconBudget, IconHabits } from './Icons'

const MODULES = [
  { id: 'budget', label: 'Budżet', Icon: IconBudget },
  { id: 'habits', label: 'Nawyki', Icon: IconHabits },
]

export default function Navigation({ active, onChange }) {
  return (
    <>
      {/* Sidebar na desktop */}
      <nav className="sidebar">
        <div className="sidebar-logo">Apka 2.0</div>
        {MODULES.map(m => (
          <button
            key={m.id}
            className={`sidebar-item ${active === m.id ? 'active' : ''}`}
            onClick={() => onChange(m.id)}
          >
            <span className="nav-icon"><m.Icon size={20} /></span>
            <span className="nav-label">{m.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom nav na mobile */}
      <nav className="bottom-nav">
        {MODULES.map(m => (
          <button
            key={m.id}
            className={`bottom-nav-item ${active === m.id ? 'active' : ''}`}
            onClick={() => onChange(m.id)}
          >
            <span className="nav-icon"><m.Icon size={20} /></span>
            <span className="nav-label">{m.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
