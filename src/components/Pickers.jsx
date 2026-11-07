// Wspólne wybieraki ikony i koloru — te same w całej aplikacji.
//
// Dotąd każdy formularz miał własną kopię: inną liczbę kolumn, inny zestaw
// kolorów, gdzieniegdzie pasek wyszukiwania, gdzieniegdzie podpisy. Teraz
// wszędzie jest jedno: 300 ikon w 10 kategoriach (zakładki zamiast szukania)
// i 50 kolorów ułożonych odcieniami, po 10 w rzędzie.
import { useState } from 'react'
import { ICON_CATALOG, ICON_GROUPS } from './Icons'
import { PALETTE_ROWS } from '../utils/palette'

const groupOf = (key) => ICON_CATALOG.find(ic => ic.key === key)?.group

export function IconPicker({ value, onChange, color = 'var(--accent)' }) {
  const [group, setGroup] = useState(() => groupOf(value) || ICON_GROUPS[0])
  const icons = ICON_CATALOG.filter(ic => ic.group === group)

  return (
    <div className="pick" style={{ '--pick': color }}>
      <div className="pick-tabs" role="tablist">
        {ICON_GROUPS.map(g => (
          <button key={g} type="button" role="tab" aria-selected={g === group}
            className={`pick-tab ${g === group ? 'active' : ''}`}
            onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>
      <div className="pick-icons">
        {icons.map(ic => {
          const Ic = ic.Component
          const on = ic.key === value
          return (
            <button key={ic.key} type="button" title={ic.label} aria-label={ic.label}
              className={`pick-icon ${on ? 'active' : ''}`}
              onClick={() => onChange(ic.key)}>
              <Ic size={17} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ColorPicker({ value, onChange }) {
  const v = (value || '').toLowerCase()
  return (
    <div className="pick-colors">
      {PALETTE_ROWS.flat().map(c => (
        <button key={c} type="button" aria-label={c}
          className={`pick-color ${c.toLowerCase() === v ? 'active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)} />
      ))}
    </div>
  )
}
