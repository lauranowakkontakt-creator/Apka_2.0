import { purgePerson, setPersonHidden } from '../../utils/people'
import { getNeglect } from '../../utils/prayerStats'
import { confirmDialog } from '../ConfirmModal'
import { CatIcon, IconArchive, IconCheck, IconChevronDown, IconChevronRight, IconEdit, IconPrayer, IconRestore, IconTrash } from '../Icons'
import { TODAY } from './wspolne'
import { differenceInDays, parseISO } from 'date-fns'
import { useMemo, useState } from 'react'
import { dniTemu } from '../../utils/prayerList'

// Lista osób, za które się modlisz — wejście do modułu Modlitwa.
// Sortowanie: najbardziej zaniedbani u góry (patrz utils/prayerStats).

export default function PeopleView({ user, people, intentions, carMode, onSelect, onAdd, onEdit }) {
  const [showArchive, setShowArchive] = useState(false)
  const today = TODAY()

  const archivedPeople = people.filter(p => p.hiddenInPrayer)

  const withStats = useMemo(() => people.filter(p => !p.hiddenInPrayer).map(p => {
    const active = intentions.filter(i => i.personId === p.id && (i.status === 'active' || !i.status))
    const all    = intentions.filter(i => i.personId === p.id)
    const allDates = all.flatMap(i => i.prayedDates || [])
    const lastDate = allDates.length ? [...allDates].sort().reverse()[0] : null
    const days = lastDate ? differenceInDays(new Date(), parseISO(lastDate)) : null
    const prayedToday = allDates.includes(today)
    return { ...p, activeCount: active.length, totalPrays: allDates.length, days, prayedToday }
  }).sort((a, b) => {
    // Osoby bez aktywnych próśb na samym dole
    const aHas = a.activeCount > 0, bHas = b.activeCount > 0
    if (aHas !== bHas) return aHas ? -1 : 1
    // Reszta wg liczby modlitw (najwięcej u góry)
    if (b.totalPrays !== a.totalPrays) return b.totalPrays - a.totalPrays
    return a.name.localeCompare(b.name)
  }), [people, intentions, today])

  // Podpowiedź: najbardziej zaniedbana osoba z aktywną prośbą, jeszcze nie dziś
  const suggestion = useMemo(() => {
    const cand = withStats.filter(p => p.activeCount > 0 && !p.prayedToday)
    if (!cand.length) return null
    return [...cand].sort((a, b) => (b.days ?? 99999) - (a.days ?? 99999))[0]
  }, [withStats])

  const archivePersonH = async (id, e) => { e.stopPropagation(); await setPersonHidden(user.uid, id, 'prayer', true) }
  const restorePersonH = async (id, e) => { e.stopPropagation(); await setPersonHidden(user.uid, id, 'prayer', false) }
  const handleDeletePerson = async (id, e) => {
    e.stopPropagation()
    const ok = await confirmDialog({
      title: 'Usunąć osobę trwale?',
      message: 'Usunie też WSZYSTKIE jej prośby modlitewne i wydarzenia w Kalendarzu. Tego nie da się cofnąć. (Aby tylko ukryć w modlitwie — użyj Ukryj.)'
    })
    if (!ok) return
    await purgePerson(user.uid, id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {carMode && (
        <button className="btn-add-account" onClick={onAdd}>+ Dodaj osobę</button>
      )}

      {!carMode && suggestion && (
        <button onClick={() => onSelect(suggestion)} style={{
          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer',
          background: 'linear-gradient(135deg, var(--surface), color-mix(in oklab, var(--accent) 12%, var(--surface)))',
          border: '1px solid color-mix(in oklab, var(--accent) 30%, var(--border))',
          borderRadius: 12, padding: '11px 14px',
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'color-mix(in oklab, var(--accent) 16%, transparent)', color: 'var(--accent)' }}>
            <IconPrayer size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)' }}>Pomódl się dziś za</div>
            <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {suggestion.name}
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>
                {suggestion.days === null ? ' · jeszcze nie modlono' : ` · ${dniTemu(suggestion.days) || 'dziś'}`}
              </span>
            </div>
          </div>
          <IconChevronRight size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        </button>
      )}

      {withStats.length === 0 && archivedPeople.length === 0 && (
        <div className="list-empty">
          <p>Brak osób</p>
          <p className="list-empty-hint">Dodaj osoby za które chcesz się modlić</p>
        </div>
      )}

      {withStats.map(p => {
          const neglect = getNeglect(p.activeCount > 0 ? p.days : -1)
          const isNeglected  = p.activeCount > 0 && !p.prayedToday && neglect.level >= 4
          const isAtRisk     = p.activeCount > 0 && !p.prayedToday && neglect.level === 3
          const borderColor  = isNeglected ? neglect.color : isAtRisk ? neglect.color : p.prayedToday ? '#27AE60' : 'transparent'
          return (
            <div key={p.id} onClick={() => onSelect(p)} style={{
              background: isNeglected ? neglect.color + '0D' : 'var(--surface)',
              border: `1px solid ${isNeglected ? neglect.color + '55' : isAtRisk ? neglect.color + '44' : 'var(--border)'}`,
              borderLeft: `3px solid ${borderColor}`,
              borderRadius: 12, padding: carMode ? '16px 18px' : '12px 14px',
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'
            }}>
              <div style={{ width: carMode ? 54 : 44, height: carMode ? 54 : 44, borderRadius: 12, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#8b5cf6' }}>
                <CatIcon categoryId={null} emoji={p.icon || 'IcUsers'} size={carMode ? 28 : 22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <p style={{ margin: 0, fontSize: carMode ? 19 : 14, fontWeight: 600 }}>{p.name}</p>
                  {p.prayedToday && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(39,174,96,0.15)', color: '#27AE60', display: 'inline-flex', alignItems: 'center', gap: 2 }}><IconCheck size={9} /> dziś</span>}
                  {(isNeglected || isAtRisk) && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: neglect.color + '22', color: neglect.color, fontWeight: 700 }}>
                      L{neglect.level} · {neglect.label}
                    </span>
                  )}
                </div>
                <p style={{ margin: '3px 0 0', fontSize: carMode ? 13 : 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  <span>{p.activeCount} {p.activeCount === 1 ? 'prośba' : p.activeCount < 5 ? 'prośby' : 'próśb'}</span>
                  {p.totalPrays > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      · <IconPrayer size={11} style={{ color: 'var(--accent)' }} /> ×{p.totalPrays}
                    </span>
                  )}
                  {p.days === 0 && <span>· modlono dziś</span>}
                  {p.days !== null && p.days > 0 && <span>· {dniTemu(p.days)}</span>}
                  {p.days === null && p.activeCount > 0 && <span>· jeszcze nie modlono</span>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button className="t-btn" title="Edytuj" onClick={e => { e.stopPropagation(); onEdit(p) }}><IconEdit size={13} /></button>
                <button className="t-btn" title="Ukryj w modlitwie (zostaje w bazie Osób)" onClick={e => archivePersonH(p.id, e)}><IconArchive size={13} /></button>
                <button className="t-btn delete" title="Usuń trwale (z prośbami i wydarzeniami)" onClick={e => handleDeletePerson(p.id, e)}><IconTrash size={13} /></button>
              </div>
              <IconChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
          )
        })}

      {archivedPeople.length > 0 && (
        <div>
          <button onClick={() => setShowArchive(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '9px 12px', cursor: 'pointer',
            background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10,
            color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', marginTop: 4,
          }}>
            <IconArchive size={13} />
            <span style={{ flex: 1, textAlign: 'left' }}>Ukryte w modlitwie ({archivedPeople.length})</span>
            {showArchive ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </button>
          {showArchive && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {archivedPeople.map(p => {
                const all = intentions.filter(i => i.personId === p.id)
                const prays = all.flatMap(i => i.prayedDates || []).length
                return (
                  <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.75 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#8b5cf6' }}>
                      <CatIcon categoryId={null} emoji={p.icon || 'IcUsers'} size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {p.name}
                        <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: 'var(--surface3)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Ukr.</span>
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        {all.length} {all.length === 1 ? 'prośba' : 'próśb'} · <IconPrayer size={10} /> ×{prays}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button className="t-btn" title="Pokaż w modlitwie" onClick={e => restorePersonH(p.id, e)}><IconRestore size={13} /></button>
                      <button className="t-btn delete" title="Usuń trwale" onClick={e => handleDeletePerson(p.id, e)}><IconTrash size={13} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

    </div>
  )
}

/* ─── PersonDetailView ───────────────────────────────────────────────────── */
