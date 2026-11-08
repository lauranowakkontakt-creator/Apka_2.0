import { useState } from 'react'
import SegTabs from '../SegTabs'
import { IconArrowDown, IconArrowUp, IconClose, IconPlus } from '../Icons'
import { emptyMindMap, emptyScene, STORY_OPENING, STORY_TIPS } from '../../utils/dreamForms'
import { DiagramView, MindMapView, SpiralView } from './DreamDrawings'

// Edytory zaawansowanych form zapisu snu (podręcznik kursu 201, rozdz. 4.1 i 5.1):
// opowieść, mapa myśli, diagram historii i spirala. Stan trzyma formularz snu.

const TABS = [
  { id: 'story',   label: 'Opowieść' },
  { id: 'map',     label: 'Mapa' },
  { id: 'diagram', label: 'Diagram' },
  { id: 'spiral',  label: 'Spirala' },
]

const hint = { margin: '0 0 8px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }
const row = { display: 'flex', gap: 6, alignItems: 'center' }
const small = { padding: '4px 8px', flexShrink: 0 }

function AddBtn({ onClick, children }) {
  return (
    <button type="button" className="btn-add-account" onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '6px 10px' }}>
      <IconPlus size={12} /> {children}
    </button>
  )
}

function StoryEditor({ dreamText, story, setStory, moral, setMoral }) {
  const [tips, setTips] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={hint}>Opowiedz sen jak historię dla dziecka. Wzmacniaj szczegóły: pomaga to zauważyć, co łączy Cię z osobami, przedmiotami i żywiołami.</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {!story.trim() && <AddBtn onClick={() => setStory(STORY_OPENING)}>Zacznij: Dawno, dawno temu</AddBtn>}
        {!story.trim() && dreamText.trim() && <AddBtn onClick={() => setStory(STORY_OPENING + dreamText.trim().replace(/^./, c => c.toLowerCase()))}>Przepisz z treści snu</AddBtn>}
      </div>
      <textarea className="form-input" value={story} onChange={e => setStory(e.target.value)} rows={8}
        placeholder="Dawno, dawno temu, w krainie, która jeszcze nie istnieje…"
        style={{ resize: 'vertical', minHeight: 140, lineHeight: 1.6 }} />
      <input className="form-input" value={moral} maxLength={200} onChange={e => setMoral(e.target.value)} placeholder="Morał opowieści" />
      <button type="button" onClick={() => setTips(v => !v)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
        {tips ? 'Ukryj wskazówki' : 'Wskazówki z podręcznika'}
      </button>
      {tips && (
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 1.7, color: 'var(--text-sub)' }}>
          {STORY_TIPS.map(t => <li key={t}>{t}</li>)}
        </ol>
      )}
    </div>
  )
}

function MindMapEditor({ map, setMap }) {
  const m = map || emptyMindMap()
  const setBranch = (i, patch) => setMap({ ...m, branches: m.branches.map((b, k) => k === i ? { ...b, ...patch } : b) })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={hint}>Sedno snu w chmurze pośrodku, od niej gałęzie (np. osoby, miejsca, emocje), a z nich szczegóły. Uwalnia od myślenia liniowego i ułatwia znalezienie tematu snu.</p>
      <input className="form-input" value={m.center} maxLength={60} onChange={e => setMap({ ...m, center: e.target.value })} placeholder="Sedno snu (chmura w środku)" />
      {m.branches.map((b, i) => (
        <div key={i} style={{ padding: 10, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={row}>
            <input className="form-input" value={b.text} maxLength={40} placeholder={`Gałąź ${i + 1}`} style={{ flex: 1, minWidth: 0 }}
              onChange={e => setBranch(i, { text: e.target.value })} />
            <button type="button" className="t-btn delete" title="Usuń gałąź" style={small}
              onClick={() => setMap({ ...m, branches: m.branches.filter((_, k) => k !== i) })}><IconClose size={14} /></button>
          </div>
          {b.leaves.map((l, j) => (
            <div key={j} style={{ ...row, marginLeft: 16 }}>
              <input className="form-input" value={l} maxLength={40} placeholder="Szczegół" style={{ flex: 1, minWidth: 0 }}
                onChange={e => setBranch(i, { leaves: b.leaves.map((x, k) => k === j ? e.target.value : x) })} />
              <button type="button" className="t-btn delete" title="Usuń szczegół" style={small}
                onClick={() => setBranch(i, { leaves: b.leaves.filter((_, k) => k !== j) })}><IconClose size={14} /></button>
            </div>
          ))}
          <div style={{ marginLeft: 16 }}><AddBtn onClick={() => setBranch(i, { leaves: [...b.leaves, ''] })}>szczegół</AddBtn></div>
        </div>
      ))}
      <div><AddBtn onClick={() => setMap({ ...m, branches: [...m.branches, { text: '', leaves: [] }] })}>gałąź</AddBtn></div>
      <MindMapView map={m} />
    </div>
  )
}

function DiagramEditor({ scenes, setScenes }) {
  const list = scenes?.length ? scenes : []
  const set = (i, patch) => setScenes(list.map((s, k) => k === i ? { ...s, ...patch } : s))
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= list.length) return
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]]
    setScenes(next)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={hint}>Szybki zapis przebiegu: kolejne sceny w kolejności wydarzeń, a pod każdą notatki (emocje, kolory, osoby).</p>
      {list.map((s, i) => (
        <div key={i} style={{ padding: 10, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={row}>
            <input className="form-input" value={s.text} maxLength={120} placeholder={`Scena ${i + 1}`} style={{ flex: 1, minWidth: 0 }}
              onChange={e => set(i, { text: e.target.value })} />
            <button type="button" className="t-btn" title="Wyżej" style={small} disabled={i === 0} onClick={() => move(i, -1)}><IconArrowUp size={14} /></button>
            <button type="button" className="t-btn" title="Niżej" style={small} disabled={i === list.length - 1} onClick={() => move(i, 1)}><IconArrowDown size={14} /></button>
            <button type="button" className="t-btn delete" title="Usuń scenę" style={small} onClick={() => setScenes(list.filter((_, k) => k !== i))}><IconClose size={14} /></button>
          </div>
          {s.notes.map((n, j) => (
            <div key={j} style={{ ...row, marginLeft: 16 }}>
              <input className="form-input" value={n} maxLength={120} placeholder="Notatka" style={{ flex: 1, minWidth: 0 }}
                onChange={e => set(i, { notes: s.notes.map((x, k) => k === j ? e.target.value : x) })} />
              <button type="button" className="t-btn delete" title="Usuń notatkę" style={small}
                onClick={() => set(i, { notes: s.notes.filter((_, k) => k !== j) })}><IconClose size={14} /></button>
            </div>
          ))}
          <div style={{ marginLeft: 16 }}><AddBtn onClick={() => set(i, { notes: [...s.notes, ''] })}>notatka</AddBtn></div>
        </div>
      ))}
      <div><AddBtn onClick={() => setScenes([...list, emptyScene()])}>scena</AddBtn></div>
      <DiagramView scenes={list} />
    </div>
  )
}

function SpiralEditor({ spiral, setSpiral }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={hint}>Zacznij pisać od środka: pierwsze zdanie jest w centrum spirali, kolejne zawijają się na zewnątrz. Rozluźnia myślenie lewą półkulą i dobrze działa, gdy nie wiesz, od czego zacząć.</p>
      <textarea className="form-input" value={spiral} onChange={e => setSpiral(e.target.value)} rows={6}
        placeholder="Miałam sen. Leciałam samolotem…" style={{ resize: 'vertical', minHeight: 110, lineHeight: 1.6 }} />
      <SpiralView text={spiral} />
    </div>
  )
}

export default function DreamWriteModes({ dreamText, story, setStory, storyMoral, setStoryMoral, mindMap, setMindMap, diagram, setDiagram, spiral, setSpiral }) {
  const [tab, setTab] = useState('story')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SegTabs items={TABS} active={tab} onChange={setTab} />
      {tab === 'story' && <StoryEditor dreamText={dreamText} story={story} setStory={setStory} moral={storyMoral} setMoral={setStoryMoral} />}
      {tab === 'map' && <MindMapEditor map={mindMap} setMap={setMindMap} />}
      {tab === 'diagram' && <DiagramEditor scenes={diagram} setScenes={setDiagram} />}
      {tab === 'spiral' && <SpiralEditor spiral={spiral} setSpiral={setSpiral} />}
    </div>
  )
}
