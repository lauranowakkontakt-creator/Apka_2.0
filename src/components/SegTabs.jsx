// Wspólne zakładki segmentowe z płynnym suwakiem — jedyny wygląd zakładek
// w całej aplikacji (aktywna = akcent modułu).
// items: [{ id, label, icon? }] · size="lg" — wariant powiększony (tryb auto)
export default function SegTabs({ items, active, onChange, style, size }) {
  const idx = Math.max(0, items.findIndex(i => i.id === active))
  const w = 100 / items.length
  return (
    <div className={`seg${size === 'lg' ? ' seg-lg' : ''}`} style={style} role="tablist">
      <div className="seg-thumb" style={{ left: `calc(${idx * w}% + 4px)`, width: `calc(${w}% - 8px)` }} />
      {items.map(it => (
        <button key={it.id} type="button" role="tab" aria-selected={it.id === active} className={it.id === active ? 'active' : ''} onClick={() => onChange?.(it.id)}>
          {it.icon}{it.label}
        </button>
      ))}
    </div>
  )
}
