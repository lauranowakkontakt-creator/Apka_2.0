import { getNeglect, podsumowanieOkresu, statystykiOsob } from '../../utils/prayerStats'
import { CatIcon, IconCheck, IconPrayer } from '../Icons'
import StatSummary from '../StatSummary'
import { TODAY, kicker } from './wspolne'
import { addDays, format, getDaysInMonth, startOfMonth, subDays } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { AnalizaRoku, Rozwijana } from '../Analityka'
import { dniTemu } from '../../utils/prayerList'

// Statystyki: podsumowanie miesiąca i roku, kalendarz dni modlitwy,
// zestawienie per osoba. Samo liczenie siedzi w utils/prayerStats.js.

export default function StatsView({ intentions, people, allPrayedDates, streak }) {
  const today    = TODAY()
  const [showAllPeople, setShowAllPeople] = useState(false)

  // „W liczbach" — ten miesiąc i ten rok. Samo liczenie w utils/prayerStats.js,
  // razem z testami na przypadki, których stąd nie dało się sprawdzić.
  const summary = useMemo(() => ({
    month: podsumowanieOkresu(intentions, format(new Date(), 'yyyy-MM')),
    year:  podsumowanieOkresu(intentions, format(new Date(), 'yyyy')),
  }), [intentions])

  // Kalendarz bieżącego miesiąca — dni z modlitwą podświetlone (czytelniejsze niż heatmapa)
  const calMonth   = new Date()
  const calMLabel  = (() => { const l = format(calMonth, 'LLLL', { locale: pl }); return l.charAt(0).toUpperCase() + l.slice(1) })()
  const mStart     = startOfMonth(calMonth)
  const firstDow   = (mStart.getDay() + 6) % 7
  const calCells   = Array.from({ length: getDaysInMonth(calMonth) }, (_, i) => {
    const d = format(addDays(mStart, i), 'yyyy-MM-dd')
    return { date: d, dayNum: i + 1, prayed: allPrayedDates.has(d), isToday: d === today, future: d > today }
  })

  // Każde odhaczenie prośby danego dnia = jedna modlitwa
  const wpisyModl = useMemo(() => intentions.flatMap(i => (i.prayedDates || []).map(k => ({ klucz: k }))), [intentions])

  const personStats = useMemo(
    () => statystykiOsob(people, intentions, today),
    [people, intentions, today]
  )

  // Regularność %
  const totalDays = 30
  const prayedDays = Array.from({ length: totalDays }, (_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd'))
    .filter(d => allPrayedDates.has(d)).length
  const regularPct = Math.round((prayedDays / totalDays) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <StatSummary title="Modlitwa w liczbach" month={summary.month} year={summary.year} />

      <AnalizaRoku id="modl" wpisy={wpisyModl} jednostka={['modlitwa', 'modlitwy', 'modlitw']} kolor="#C9A24A" tytulDni="Dni z modlitwą" />

      <Rozwijana id="modl-kal" tytul={`Kalendarz · ${calMLabel}`} podsumowanie={`${regularPct}% · seria ${streak}`}>

      {/* Aktywność modlitwy — kalendarz miesiąca */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 16 }}>
        {kicker(`Aktywność modlitwy · ${calMLabel}`)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
          {['P', 'W', 'Ś', 'C', 'P', 'S', 'N'].map((l, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>{l}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
          {Array.from({ length: firstDow }, (_, i) => <div key={'e' + i} />)}
          {calCells.map(c => (
            <div key={c.date} title={`${c.dayNum} ${calMLabel}${c.prayed ? ' · modlono' : ''}`} style={{
              height: 30, borderRadius: 7, display: 'grid', placeItems: 'center',
              fontSize: 11, fontWeight: c.isToday ? 700 : 500,
              background: c.prayed ? '#C9A24A' : c.future ? 'transparent' : 'var(--surface2)',
              border: c.isToday ? '1.5px solid #C9A24A' : c.future ? '1px dashed var(--border)' : '1px solid transparent',
              color: c.prayed ? '#fff' : 'var(--text-muted)',
            }}>{c.dayNum}</div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 14 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#C9A24A' }}>{regularPct}%</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>regularność</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{streak}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>seria dni</div>
          </div>
        </div>
      </div>
      </Rozwijana>

      {/* Person stats full list */}
      {personStats.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 16 }}>
          {kicker('Osoby — jak często się modliłam')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(showAllPeople ? personStats : personStats.slice(0, 6)).map(p => {
              const neglect = getNeglect(p.activeCount > 0 && !p.prayedToday ? p.days : -1)
              const isNeglected     = p.activeCount > 0 && !p.prayedToday && neglect.level >= 4
              const isAtRisk        = p.activeCount > 0 && !p.prayedToday && neglect.level === 3
              return (
                <div key={p.id} style={{
                  background: isNeglected ? neglect.color + '08' : 'var(--surface2)',
                  border: `1px solid ${isNeglected ? neglect.color + '44' : isAtRisk ? neglect.color + '33' : 'var(--border)'}`,
                  borderRadius: 10, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                    <CatIcon categoryId={null} emoji={p.icon || 'IcUsers'} size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{p.name}</p>
                      {p.prayedToday && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(39,174,96,0.15)', color: '#27AE60' }}><IconCheck size={9} /> dziś</span>}
                      {(isNeglected || isAtRisk) && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: neglect.color + '20', color: neglect.color, fontWeight: 700 }}>
                          L{neglect.level} · {neglect.label}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <IconPrayer size={10} /> ×{p.totalPrays} · {p.totalIntentions} {p.totalIntentions === 1 ? 'prośba' : 'próśb'}
                      {p.days === 0 && ' · modlono dziś'}
                      {p.days !== null && p.days > 0 && ` · ${dniTemu(p.days)}`}
                      {p.days === null && p.activeCount > 0 && ' · jeszcze nie modlono'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
          {personStats.length > 6 && (
            <button onClick={() => setShowAllPeople(v => !v)} style={{
              marginTop: 10, width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-muted)',
            }}>
              {showAllPeople ? 'Pokaż mniej' : `Pokaż wszystkie (${personStats.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── ArchiveView ────────────────────────────────────────────────────────── */
