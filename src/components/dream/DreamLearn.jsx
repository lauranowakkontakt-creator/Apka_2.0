import { useState } from 'react'
import SegTabs from '../SegTabs'
import {
  ORIGINS, RECALL_TIPS, STEPS, PRINCIPLES, DREAM_SOURCES, DREAM_KINDS,
  DREAM_COLORS, NUMBER_RULE, CRITICAL_NOTES, SOURCES,
} from '../../utils/dreamLessons'
import { Chip } from './wspolne'

// Nauka o snach: zapamiętywanie, metoda (Jackson + badania), rodzaje, kolory,
// uwagi krytyczne i źródła. Same treści siedzą w utils/dreamLessons.js.

const TABS = [
  { id: 'recall', label: 'Zapisz' },
  { id: 'method', label: 'Metoda' },
  { id: 'kinds',  label: 'Rodzaje' },
  { id: 'notes',  label: 'Uwagi' },
]

const card = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--r)', padding: 14,
}
const h = {
  fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.16em',
  textTransform: 'uppercase', margin: '4px 2px 0',
}

function Lesson({ item, num }) {
  const o = ORIGINS[item.origin]
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        {num != null && <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{num}.</span>}
        <span style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</span>
        {o && <Chip color={o.color}>{o.label}</Chip>}
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text-sub)' }}>{item.text}</p>
    </div>
  )
}

function Plain({ title, text }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text-sub)' }}>{text}</p>
    </div>
  )
}

export default function DreamLearn() {
  const [tab, setTab] = useState('recall')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SegTabs items={TABS} active={tab} onChange={setTab} />

      {tab === 'recall' && (
        <>
          <p style={{ margin: '2px 2px 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Jak zapamiętać i dobrze zapisać sen. Zapisuj w aplikacji zaraz po przebudzeniu.
          </p>
          {RECALL_TIPS.map(t => <Lesson key={t.id} item={t} />)}
        </>
      )}

      {tab === 'method' && (
        <>
          <div style={h}>Cztery kroki</div>
          {STEPS.map(s => <Lesson key={s.id} item={s} num={s.n} />)}
          <div style={h}>Zasady czytania snu</div>
          {PRINCIPLES.map(p => <Lesson key={p.id} item={p} />)}
          <p style={{ margin: '2px 2px 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Pytania pomocnicze znajdziesz w formularzu snu, w polu „Interpretacja".
          </p>
        </>
      )}

      {tab === 'kinds' && (
        <>
          <div style={h}>Trzy źródła snów (Tertulian)</div>
          {DREAM_SOURCES.map(s => <Plain key={s.id} title={s.title} text={s.text} />)}
          <div style={h}>Rodzaje snów w kursie</div>
          {DREAM_KINDS.map(k => <Plain key={k.id} title={k.title} text={k.text} />)}
          <div style={h}>Kolory</div>
          {DREAM_COLORS.map(c => (
            <div key={c.id} style={{ ...card, borderLeft: `3px solid ${c.color}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: c.color, marginBottom: 6 }}>{c.label}</div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-sub)' }}>Dobrze: {c.plus}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-sub)' }}>Źle: {c.minus}</p>
            </div>
          ))}
          <div style={h}>Liczby</div>
          <Plain title="Ostrożnie z liczbami" text={NUMBER_RULE} />
        </>
      )}

      {tab === 'notes' && (
        <>
          <p style={{ margin: '2px 2px 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Metoda Jacksona to system religijny, nie teoria snu. Poniżej to, co warto mieć na uwadze.
          </p>
          {CRITICAL_NOTES.map(n => <Plain key={n.id} title={n.title} text={n.text} />)}
          <div style={h}>Źródła</div>
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SOURCES.map(s => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: 'var(--accent)', lineHeight: 1.5 }}>{s.label}</a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
