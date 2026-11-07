import { IconChevronLeft, IconChevronRight } from '../Icons'
import { addDays, addMonths, format, getDaysInMonth, parseISO, startOfMonth, subMonths } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { AnalizaRoku, Rozwijana, Ranking } from '../Analityka'
import { getEmotion } from '../../utils/dreamLogic'

// Statystyki snów: częstotliwość zapisywania i najczęstsze symbole.

const DREAM_WD = ['P', 'W', 'Ś', 'C', 'P', 'S', 'N']
export default function DreamStats({ dreams }) {
  const [month, setMonth] = useState(new Date())

  // Liczba snów na dzień (klucz yyyy-MM-dd)
  const counts = useMemo(() => {
    const m = {}
    dreams.forEach(d => { if (d.date) m[d.date] = (m[d.date] || 0) + 1 })
    return m
  }, [dreams])

  const mStart = startOfMonth(month)
  const lead   = (mStart.getDay() + 6) % 7
  const total  = getDaysInMonth(month)
  const cells  = [...Array.from({ length: lead }, () => null),
                  ...Array.from({ length: total }, (_, i) => format(addDays(mStart, i), 'yyyy-MM-dd'))]
  const monthKey     = format(month, 'yyyy-MM')
  const monthDreams  = dreams.filter(d => d.date?.startsWith(monthKey)).length
  const daysWithDream = Object.keys(counts).filter(k => k.startsWith(monthKey)).length
  const todayStr     = format(new Date(), 'yyyy-MM-dd')
  const shade = (lvl) => lvl === 0 ? 'var(--surface2)' : `color-mix(in oklab, var(--accent) ${28 + lvl * 22}%, var(--surface2))`

  const wpisy = useMemo(() => dreams.filter(d => d.date).map(d => ({ klucz: d.date })), [dreams])
  const KOL = ['#6366F1', '#5BB6D9', '#C47BD9', '#5FBF98', '#E0B15A', '#E07A9B', '#9AA3B8']
  const ranking = (rok, pole) => {
    const m = {}
    dreams.filter(d => d.date?.startsWith(String(rok))).forEach(d => {
      const v = d[pole]
      ;(Array.isArray(v) ? v : v ? [v] : []).forEach(x => { m[x] = (m[x] || 0) + 1 })
    })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([id, wartosc], i) => {
      const em = pole === 'emotions' ? getEmotion(id) : null
      return { nazwa: em?.label || id, wartosc, kolor: em?.color || KOL[i % KOL.length] }
    })
  }
  const fmtSny = (v) => `${v} ${v === 1 ? 'sen' : v % 10 >= 2 && v % 10 <= 4 && (v % 100 < 12 || v % 100 > 14) ? 'sny' : 'snów'}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AnalizaRoku id="sen" wpisy={wpisy} jednostka={['sen', 'sny', 'snów']} kolor="#6366F1" tytulDni="Noce ze snem">
        {(rok) => (
          <Rozwijana id="sen-emocje" tytul={`Emocje w snach · ${rok}`} podsumowanie={ranking(rok, 'emotions')[0]?.nazwa}>
            <Ranking pozycje={ranking(rok, 'emotions')} fmt={fmtSny} pusty="Brak oznaczonych emocji" />
          </Rozwijana>
        )}
      </AnalizaRoku>

      <Rozwijana id="sen-kal" tytul="Kalendarz miesiąca" podsumowanie={`${monthDreams} w ${format(month, 'LLLL', { locale: pl })}`}>
      {/* Podsumowanie miesiąca */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="card card-pad" style={{ padding: 14 }}>
          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Sny w miesiącu</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{monthDreams}</div>
        </div>
        <div className="card card-pad" style={{ padding: 14 }}>
          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Dni ze snem</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{daysWithDream}</div>
        </div>
      </div>

      {/* Kalendarz-heatmapa */}
      <div className="card card-pad" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button className="icon-btn" onClick={() => setMonth(m => subMonths(m, 1))} title="Poprzedni miesiąc"><IconChevronLeft size={16} /></button>
          <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'capitalize' }}>{format(month, 'LLLL yyyy', { locale: pl })}</div>
          <button className="icon-btn" onClick={() => setMonth(m => addMonths(m, 1))} title="Następny miesiąc"><IconChevronRight size={16} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
          {DREAM_WD.map((l, i) => <div key={i} style={{ textAlign: 'center', fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>{l}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
          {cells.map((c, idx) => {
            if (!c) return <div key={'b' + idx} />
            const n = counts[c] || 0
            const lvl = Math.min(n, 3)
            const isToday = c === todayStr
            return (
              <div key={c}
                title={`${format(parseISO(c), 'd MMM', { locale: pl })}${n ? ` • ${n} ${n === 1 ? 'sen' : 'sny'}` : ''}`}
                style={{
                  aspectRatio: '1', borderRadius: 6, background: shade(lvl),
                  boxShadow: isToday ? '0 0 0 1.5px var(--accent)' : 'none',
                  display: 'grid', placeItems: 'center',
                  fontSize: 11, fontWeight: 600, color: n >= 2 ? '#fff' : 'var(--text-muted)',
                }}>
                {format(parseISO(c), 'd')}
              </div>
            )
          })}
        </div>

        {/* Legenda intensywności */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 12, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>mniej</span>
          {[0, 1, 2, 3].map(lvl => <div key={lvl} style={{ width: 11, height: 11, borderRadius: 3, background: shade(lvl) }} />)}
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>więcej</span>
        </div>
      </div>
      </Rozwijana>
    </div>
  )
}
