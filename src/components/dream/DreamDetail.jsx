import PersonBubble from '../PersonBubble'
import { findDreamCategory, getEmotion } from '../../utils/dreams'
import { IconCalendar, IconChevronLeft, IconEdit, IconMoon, IconTag, IconTrash, IconUsers } from '../Icons'
import { Chip, DreamText, fmtDate, SymbolChip } from './wspolne'
import {
  DREAM_POSITIONS, DREAM_SPHERES, DREAM_ORIGINS, DREAM_KINDS, DREAM_VIVIDNESS, DREAM_ATMOSPHERE, DREAM_COLORS,
  DREAM_ELEMENTS, BEFORE_SLEEP, dreamKindIds, numberMeanings, findIn,
} from '../../utils/dreamJackson'

// Pojedynczy sen w całości, z podświetlonymi osobami i symbolami.

export default function DreamDetail({ dream, categories, peopleById, symbolsById, onBack, onOpenSymbol, onEdit, onDelete }) {
  const cat = findDreamCategory(categories, dream.category)
  const participants = (dream.peopleIds || []).map(id => peopleById[id]).filter(Boolean)
  const mentioned = (dream.mentionIds || []).filter(id => !(dream.peopleIds || []).includes(id))
    .map(id => peopleById[id]).filter(Boolean)
  const linkedPeople = [...new Set([...(dream.peopleIds || []), ...(dream.mentionIds || [])])]
    .map(id => peopleById[id]).filter(Boolean)
  const details = [
    ['Pozycja', findIn(DREAM_POSITIONS, dream.position)?.label],
    ['Sfera', findIn(DREAM_SPHERES, dream.sphere)?.label],
    ['Barwa obrazu', findIn(DREAM_VIVIDNESS, dream.vividness)?.label],
    ['Główny element', dream.mainElement],
    ['Liczby', dream.numbers],
    ['Przebudzenie', dream.wakeTime],
    ['Kontekst', dream.context],
  ].filter(([, v]) => v)
  const colorList = (dream.colors || []).map(id => findIn(DREAM_COLORS, id)).filter(Boolean)
  const nums = numberMeanings(dream.numbers)
  const atmos = (dream.atmosphere || []).map(id => findIn(DREAM_ATMOSPHERE, id)).filter(Boolean)
  const elementList = (dream.elements || []).map(e => {
    const [gid, ...rest] = e.split(':')
    const g = DREAM_ELEMENTS.find(x => x.id === gid)
    return g ? { id: e, label: rest.join(':'), group: g.label } : null
  }).filter(Boolean)
  const tagList = [
    findIn(DREAM_ORIGINS, dream.origin),
    ...dreamKindIds(dream).map(id => findIn(DREAM_KINDS, id)),
    ...(dream.beforeSleep || []).map(id => findIn(BEFORE_SLEEP, id) && { ...findIn(BEFORE_SLEEP, id), color: '#D98B5F' }),
  ].filter(Boolean)
  const syms = (dream.symbolIds || []).map(id => symbolsById[id]).filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="t-btn" onClick={onBack} style={{ padding: '4px 8px' }}><IconChevronLeft size={18} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{dream.title || 'Sen bez tytułu'}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconCalendar size={12} /> {fmtDate(dream.date)}
          </p>
        </div>
        <button className="t-btn" title="Edytuj" onClick={onEdit}><IconEdit size={15} /></button>
        <button className="t-btn delete" title="Usuń" onClick={onDelete}><IconTrash size={15} /></button>
      </div>

      {(cat || dream.emotions?.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {cat && <Chip color={cat.color} active>{cat.label}</Chip>}
          {dream.emotions?.map(eid => {
            const e = getEmotion(eid); if (!e) return null
            return <Chip key={eid} color={e.color} active>{e.label}</Chip>
          })}
        </div>
      )}

      {dream.text && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 16 }}>
          <DreamText text={dream.text} highlightPeople={linkedPeople} highlightSymbols={syms} onOpenSymbol={onOpenSymbol} />
        </div>
      )}

      {(details.length > 0 || colorList.length > 0 || tagList.length > 0 || elementList.length > 0 || atmos.length > 0) && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.16em', textTransform: 'uppercase' }}>Szczegóły snu</div>
          {details.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)', minWidth: 96 }}>{k}</span>
              <span style={{ fontWeight: 500 }}>{v}</span>
            </div>
          ))}
          {colorList.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {colorList.map(c => <Chip key={c.id} color={c.color} active>{c.label}</Chip>)}
            </div>
          )}
          {colorList.some(c => c.plus) && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {colorList.filter(c => c.plus).map(c => `${c.label}: dobrze: ${c.plus}; źle: ${c.minus}`).join(' · ')}
            </div>
          )}
          {nums.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {nums.map(m => `${m.n} = ${m.meaning}`).join(' · ')}. Znaczenie zależy od kontekstu snu.
            </div>
          )}
          {atmos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {atmos.map(a => <Chip key={a.id} color="#E0B15A">{a.label}</Chip>)}
            </div>
          )}
          {elementList.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {elementList.map(e => <Chip key={e.id} color="#5FBF98">{e.label}</Chip>)}
            </div>
          )}
          {tagList.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tagList.map(t => <Chip key={t.id} color={t.color}>{t.label}</Chip>)}
            </div>
          )}
        </div>
      )}

      {dream.interpretation && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: 'var(--r)', padding: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconMoon size={12} /> Interpretacja
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-sub)' }}>{dream.interpretation}</p>
        </div>
      )}

      {dream.application && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid #5FBF98', borderRadius: 'var(--r)', padding: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 10 }}>Zastosowanie</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-sub)' }}>{dream.application}</p>
        </div>
      )}

      {syms.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconTag size={12} /> Symbole
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {syms.map(s => <SymbolChip key={s.id} symbol={s} onClick={() => onOpenSymbol(s.id)} />)}
          </div>
        </div>
      )}

      {(participants.length > 0 || mentioned.length > 0) && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconUsers size={12} /> Osoby w śnie
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {participants.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PersonBubble title person={p} size={30} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>uczestnik</span>
              </div>
            ))}
            {mentioned.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.8 }}>
                <PersonBubble title person={p} size={30} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>wspomniana</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Formularz snu ───────────────────────────────────────────────────────── */
