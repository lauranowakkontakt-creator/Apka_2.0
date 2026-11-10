import PersonBubble from '../PersonBubble'
import { dreamPeopleIds, findDreamCategory, findDreamEmotion } from '../../utils/dreams'
import { IconCalendar, IconChevronRight } from '../Icons'
import { Chip, fmtDate, SymbolChip } from './wspolne'

// Kafelek snu na liście.

export default function DreamCard({ dream: d, categories, emotions, peopleById, symbolsById, onClick }) {
  const cat = findDreamCategory(categories, d.category)
  const linked = dreamPeopleIds(d).map(id => peopleById[id]).filter(Boolean)
  const syms = (d.symbolIds || []).map(id => symbolsById[id]).filter(Boolean)
  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${cat?.color || 'var(--accent)'}`,
      borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{d.title || 'Sen bez tytułu'}</p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconCalendar size={11} /> {fmtDate(d.date)}
          </p>
        </div>
        {cat && <Chip color={cat.color}>{cat.label}</Chip>}
        <IconChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 4 }} />
      </div>
      {d.text && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {d.text}
        </p>
      )}
      {(d.emotions?.length > 0 || syms.length > 0 || linked.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {d.emotions?.slice(0, 3).map(eid => {
            const e = findDreamEmotion(emotions, eid); if (!e) return null
            return <Chip key={eid} color={e.color}>{e.label}</Chip>
          })}
          {syms.slice(0, 3).map(s => <SymbolChip key={s.id} symbol={s} />)}
          {linked.length > 0 && (
            <div style={{ display: 'flex', marginLeft: 'auto', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {linked.slice(0, 4).map(p => (
                <PersonBubble title key={p.id} person={p} size={24} />
              ))}
              {linked.length > 4 && (
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--surface3)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                }}>+{linked.length - 4}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Widok Symbole (katalog + sny danego symbolu) ───────────────────────── */
