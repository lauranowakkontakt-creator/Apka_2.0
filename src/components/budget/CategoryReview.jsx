import { useState } from 'react'
import { IconCheck } from '../Icons'
import { NO_SUB } from '../../utils/importReview'

// Ekran zatwierdzania kategorii, podkategorii i kont z pliku przed importem.
// Każdą pozycję trzeba zatwierdzić; zmiana nazwy albo miejsca cofa
// zatwierdzenie tej pozycji, żeby nic nie przeszło „przy okazji".
export default function CategoryReview({ review, dec, setDec, appCats, accounts }) {
  const [onlyOpen, setOnlyOpen] = useState(false)

  const setCat = (key, patch) => setDec(d => ({
    ...d, cats: { ...d.cats, [key]: { ...d.cats[key], ...patch } }, approved: { ...d.approved, [key]: false },
  }))
  const setSub = (key, patch) => setDec(d => ({
    ...d, subs: { ...d.subs, [key]: { ...d.subs[key], ...patch } }, approved: { ...d.approved, [key]: false },
  }))
  const setAcc = (name, patch) => setDec(d => ({ ...d, accs: { ...d.accs, [name]: { ...d.accs[name], ...patch } } }))
  const toggle = (key) => setDec(d => ({ ...d, approved: { ...d.approved, [key]: !d.approved[key] } }))
  const approveCat = (c) => setDec(d => {
    const a = { ...d.approved, [c.key]: true }
    for (const s of c.subs) a[s.key] = true
    return { ...d, approved: a }
  })

  const catName = (c) => (dec.cats[c.key]?.name || '').trim() || c.label
  const total = review.cats.reduce((n, c) => n + 1 + c.subs.length, 0)
  const done = review.cats.reduce((n, c) => n + (dec.approved[c.key] ? 1 : 0) + c.subs.filter(s => dec.approved[s.key]).length, 0)

  return (
    <div className="rev">
      {review.accounts.length > 0 && (
        <section className="rev-section">
          <h4 className="rev-h">Konta z pliku</h4>
          {review.accounts.map(a => {
            const d = dec.accs[a.name] || { target: 'new' }
            return (
              <div key={a.name} className="rev-acc">
                <div className="rev-acc-name">{a.name} <span className="rev-count">{a.count}</span></div>
                <select className="form-input imp-select" value={d.target} onChange={e => setAcc(a.name, { target: e.target.value })}>
                  <option value="new">Nowe konto: {a.name} ({a.currency})</option>
                  {accounts.map(x => <option key={x.id} value={`app:${x.id}`}>→ {x.name} ({x.currency || 'PLN'})</option>)}
                </select>
              </div>
            )
          })}
        </section>
      )}

      {review.transfers > 0 && (
        <p className="imp-hint">{review.transfers} przelewów między Twoimi kontami wejdzie jako „Przelew" — bez kategorii, nie liczą się jako wydatek ani przychód.</p>
      )}

      <div className="rev-progress">
        <span>Zatwierdzono <b>{done}</b> z {total}</span>
        <button type="button" className="imp-link" onClick={() => setOnlyOpen(v => !v)}>
          {onlyOpen ? 'pokaż wszystkie' : 'pokaż tylko niezatwierdzone'}
        </button>
      </div>

      {['expense', 'income'].map(type => {
        const list = review.cats.filter(c => c.type === type)
        if (!list.length) return null
        const others = (c) => list.filter(x => x.key !== c.key)
        const app = appCats[type] || []
        return (
          <section key={type} className="rev-section">
            <h4 className="rev-h">{type === 'expense' ? 'Wydatki' : 'Przychody'}</h4>
            {list.map(c => {
              const d = dec.cats[c.key] || { name: c.label, target: 'new' }
              const subsOpen = c.subs.filter(s => !dec.approved[s.key])
              if (onlyOpen && dec.approved[c.key] && !subsOpen.length) return null
              const appTarget = d.target.startsWith('app:') ? app.find(a => `app:${a.id}` === d.target) : null
              const merged = d.target.startsWith('file:')
              return (
                <div key={c.key} className={`rev-cat${dec.approved[c.key] ? ' ok' : ''}`}>
                  <div className="rev-row">
                    <Approve on={dec.approved[c.key]} onClick={() => toggle(c.key)} />
                    <input className="form-input rev-name" value={d.name} disabled={merged}
                      onChange={e => setCat(c.key, { name: e.target.value })} aria-label="Nazwa kategorii" />
                    <span className="rev-count">{c.count}</span>
                  </div>
                  <select className="form-input imp-select rev-target" value={d.target}
                    onChange={e => setCat(c.key, { target: e.target.value })}>
                    <option value="new">Nowa kategoria</option>
                    {app.length > 0 && <optgroup label="Kategoria w apce">
                      {app.map(a => <option key={a.id} value={`app:${a.id}`}>{a.label}</option>)}
                    </optgroup>}
                    {others(c).length > 0 && <optgroup label="Połącz z kategorią z pliku">
                      {others(c).map(o => <option key={o.key} value={`file:${o.key}`}>{catName(o)}</option>)}
                    </optgroup>}
                  </select>
                  {appTarget && d.name.trim() && d.name.trim() !== appTarget.label && (
                    <p className="rev-note">Zmieni nazwę „{appTarget.label}" w apce na „{d.name.trim()}".</p>
                  )}

                  <ul className="rev-subs">
                    {c.subs.map(s => {
                      if (onlyOpen && dec.approved[s.key]) return null
                      const sd = dec.subs[s.key] || { name: s.label, parent: 'same' }
                      return (
                        <li key={s.key} className={`rev-sub${dec.approved[s.key] ? ' ok' : ''}`}>
                          <div className="rev-row">
                            <Approve on={dec.approved[s.key]} onClick={() => toggle(s.key)} />
                            <input className="form-input rev-name" value={sd.name} placeholder={NO_SUB}
                              disabled={sd.parent === 'none'}
                              onChange={e => setSub(s.key, { name: e.target.value })} aria-label="Nazwa podkategorii" />
                            <span className="rev-count">{s.count}</span>
                          </div>
                          <select className="form-input imp-select" value={sd.parent}
                            onChange={e => setSub(s.key, { parent: e.target.value })}>
                            <option value="same">w: {catName(c)}</option>
                            <option value="none">bez podkategorii (zostaje w: {catName(c)})</option>
                            {others(c).length > 0 && <optgroup label="Przenieś do kategorii z pliku">
                              {others(c).map(o => <option key={o.key} value={`file:${o.key}`}>{catName(o)}</option>)}
                            </optgroup>}
                            {app.length > 0 && <optgroup label="Przenieś do kategorii w apce">
                              {app.map(a => <option key={a.id} value={`app:${a.id}`}>{a.label}</option>)}
                            </optgroup>}
                          </select>
                          {s.examples.length > 0 && <p className="rev-ex">np. {s.examples.join(' · ')}</p>}
                        </li>
                      )
                    })}
                  </ul>
                  {(!dec.approved[c.key] || subsOpen.length > 0) && (
                    <button type="button" className="imp-link" onClick={() => approveCat(c)}>
                      zatwierdź „{catName(c)}" razem z podkategoriami
                    </button>
                  )}
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

function Approve({ on, onClick }) {
  return (
    <button type="button" className={`rev-ok${on ? ' on' : ''}`} onClick={onClick}
      aria-pressed={!!on} title={on ? 'Zatwierdzone — kliknij, żeby cofnąć' : 'Zatwierdź'}>
      {on && <IconCheck size={13} />}
    </button>
  )
}
