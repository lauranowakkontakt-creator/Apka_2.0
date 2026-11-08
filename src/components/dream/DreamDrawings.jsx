import { useMemo } from 'react'
import { mindMapLayout, spiralGeometry } from '../../utils/dreamForms'

// Rysunki snu z podręcznika kursu 201: mapa myśli, diagram historii, spirala.
// Same widoki (bez edycji) — używane w podglądzie formularza i w szczegółach snu.

const NODE = {
  center: { rx: 58, ry: 40, fill: 'var(--accent-soft)', stroke: 'var(--accent)' },
  branch: { rx: 50, ry: 30, fill: 'var(--surface2)', stroke: 'var(--border-strong)' },
  leaf:   { w: 100, h: 46,    fill: 'var(--surface)',  stroke: 'var(--border-strong)' },
}

function NodeText({ lines, x, y, bold }) {
  const lh = 15
  const top = y - ((lines.length - 1) * lh) / 2
  return lines.map((t, i) => (
    <text key={i} x={x} y={top + i * lh + 5} textAnchor="middle"
      style={{ fontSize: 13, fontWeight: bold ? 700 : 500, fill: 'var(--text)' }}>{t}</text>
  ))
}

export function MindMapView({ map }) {
  const layout = useMemo(() => mindMapLayout(map), [map])
  if (!layout) return null
  const { nodes, edges, box } = layout
  return (
    <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} style={{ width: '100%', height: 'auto', maxHeight: 460 }} role="img" aria-label="Mapa myśli snu">
      {edges.map((e, i) => (
        <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} style={{ stroke: 'var(--border-strong)', strokeWidth: 1.5 }} />
      ))}
      {nodes.map(n => n.kind === 'leaf' ? (
        <g key={n.id}>
          <rect x={n.x - NODE.leaf.w / 2} y={n.y - NODE.leaf.h / 2} width={NODE.leaf.w} height={NODE.leaf.h} rx={6}
            style={{ fill: NODE.leaf.fill, stroke: NODE.leaf.stroke }} />
          <NodeText lines={n.lines} x={n.x} y={n.y} />
        </g>
      ) : (
        <g key={n.id}>
          <ellipse cx={n.x} cy={n.y} rx={NODE[n.kind].rx} ry={NODE[n.kind].ry}
            style={{ fill: NODE[n.kind].fill, stroke: NODE[n.kind].stroke, strokeWidth: n.kind === 'center' ? 2 : 1 }} />
          <NodeText lines={n.lines} x={n.x} y={n.y} bold={n.kind === 'center'} />
        </g>
      ))}
    </svg>
  )
}

// Diagram historii: oś czasu scen od góry do dołu, notatki jako odgałęzienia.
// (Na telefonie pionowo czyta się lepiej niż rybia ości z podręcznika.)
export function DiagramView({ scenes }) {
  if (!scenes?.length) return null
  return (
    <div style={{ position: 'relative', paddingLeft: 18 }}>
      <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: 'var(--border-strong)' }} />
      {scenes.map((s, i) => (
        <div key={i} style={{ position: 'relative', marginBottom: 12 }}>
          <span style={{ position: 'absolute', left: -18, top: 4, width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)' }} />
          <div style={{ fontSize: 13, fontWeight: 600 }}>{s.text || `Scena ${i + 1}`}</div>
          {s.notes?.map((n, j) => (
            <div key={j} style={{ position: 'relative', marginTop: 4, marginLeft: 12, paddingLeft: 12, fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.5, borderLeft: '1px solid var(--border-strong)' }}>{n}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

// Spirala: tekst biegnie od środka na zewnątrz. Duże spirale przewija się w poziomie.
export function SpiralView({ text }) {
  const t = (text || '').replace(/\s+/g, ' ').trim()
  const geo = useMemo(() => spiralGeometry(t), [t])
  if (!t) return null
  return (
    <div style={{ overflow: 'auto', maxHeight: 460, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)' }}>
      <svg width={geo.size} height={geo.size} viewBox={`0 0 ${geo.size} ${geo.size}`} role="img" aria-label="Spirala snu" style={{ display: 'block', margin: '0 auto' }}>
        <defs><path id="dream-spiral-path" d={geo.d} /></defs>
        <text style={{ fontSize: 13, fill: 'var(--text)' }}>
          <textPath href="#dream-spiral-path">{t}</textPath>
        </text>
      </svg>
    </div>
  )
}
