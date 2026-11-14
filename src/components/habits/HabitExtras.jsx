import { useState } from 'react'
import { format, addDays, subDays, addMonths, addYears } from 'date-fns'
import { pl } from 'date-fns/locale'
import { CatIcon, IconFlag, IconCheck, IconPlus, IconStar, IconEdit, IconChevronLeft, IconChevronRight } from '../Icons'
import { optionalProgress, optionalSummary, optionalDayCount, hasAmountGoal,
  amountTotals, isOptionalActiveOn, optionalDayScore, isDayComplete,
  amountShortLabel, dayAmount, amountStats, formatAmount, pauseForDay, pauseReasonMeta } from '../../utils/habitLogic'
import { habitPeriodLabel, optionalRange, optionalBuckets } from '../../utils/habitStats'
import { BarChartSVG, Ring } from '../ChartPrimitives'
import StatTiles from '../StatTiles'
import SegTabs from '../SegTabs'
import MonthCalendar from './MonthCalendar'
import AmountStepper from './AmountStepper'
import AmountSheet from './AmountSheet'

// Ekran „Wyzwania" — cele poboczne. Wchodzi się tu flagą w belce, tak samo jak
// twarzą w Nastrój: osobny widok W MIEJSCU treści Nawyków, nie nakładka
// (nakładce belka aplikacji zasłaniała własny pasek).
//
// Podział ekranu jest TAKI SAM jak w Nawykach: „Dziś" to zwarta lista do
// odhaczania, a siatki dni i liczby siedzą w osobnych „Statystykach”. Kalendarz
// pod każdą pozycją listy dnia zjadał cały ekran — na telefonie trzy wyzwania
// znaczyły trzy przewinięcia, żeby dojść do czwartego.
//
// Czym wyzwanie różni się od nawyku wymaganego:
//  - nie wchodzi do celu dnia ani do procentów okresu,
//  - NIE MA serii ani rekordu — liczy się „ile razy”, a przerwa w ciągu nie
//    jest porażką; zamiast strike jest licznik i najlepszy dzień,
//  - wykres pokazuje LICZBĘ zaliczeń, nie procent: nie ma planu, z którego
//    dałoby się policzyć „ile z ilu”,
//  - pusta kratka nie jest porażką, tylko dniem, w którym się nie zdarzyło,
//    więc nie ma tu obwódek „pominięte”. Pauzy (wyjazd, choroba) są wspólne
//    z Nawykami i widać je w kalendarzach także tutaj.
//
// Dzień jest wspólny z listą dnia Nawyków (ten sam `selectedDay` z modułu), więc
// przejście tam i z powrotem nie gubi miejsca, w którym jesteś.
export default function HabitExtras({
  habits = [], archived = [], today, selectedDay, onSelectDay, onToggle, onSetAmount, onEdit, onAdd, pauses = [],
}) {
  const [tab, setTab]       = useState('today')
  const [amountFor, setAmountFor] = useState(null)   // wyzwanie w oknie „ile dziś"
  const [period, setPeriod] = useState('month')
  // Statystyki mają własną kotwicę — strzałkami cofasz się o miesiąc albo rok,
  // niezależnie od dnia wybranego na liście „Dziś".
  const [kotwica, setKotwica] = useState(selectedDay)
  const kotwicaDate = new Date(kotwica + 'T12:00:00')
  const przesun = (kier) => setKotwica(format(period === 'year' ? addYears(kotwicaDate, kier) : addMonths(kotwicaDate, kier), 'yyyy-MM-dd'))
  const naKoncu = period === 'year' ? format(kotwicaDate, 'yyyy') >= today.slice(0, 4) : format(kotwicaDate, 'yyyy-MM') >= today.slice(0, 7)

  const selDate  = new Date(selectedDay + 'T12:00:00')
  const isToday  = selectedDay === today
  const isFuture = selectedDay > today
  const dayLabel = format(selDate, 'EEEE, d MMMM', { locale: pl })

  // Na liście dnia liczymy miesiąc wybranego dnia, w Statystykach — okres spod strzałek.
  const { start, end } = tab !== 'today' ? optionalRange(period, kotwica) : optionalRange('month', selectedDay)
  const dzien = optionalDayScore(habits, selectedDay)
  const sum     = optionalSummary(habits, start, end)
  const okresLabel = period === 'year'
    ? format(kotwicaDate, 'yyyy')
    : format(kotwicaDate, 'LLLL yyyy', { locale: pl })

  // Dzień w pauzie (wyjazd / choroba ustawione w Nawykach) dostaje kolor powodu.
  const pauzaDnia = (d) => { const p = pauseForDay(d, pauses); return p ? pauseReasonMeta(p) : null }

  const fmtDzien = (d) => format(new Date(d + 'T12:00:00'), 'd MMM', { locale: pl })

  // Kratka dnia dla JEDNEGO wyzwania. Wypełniona = zaliczone; pusta to tylko
  // dzień, w którym się nie zdarzyło, dlatego bez obwódek „pominięte”.
  const cellForHabit = (habit, color) => (d) => {
    // Dzień przed startem wyzwania (albo po jego końcu) to nie porażka — wtedy
    // tej rzeczy jeszcze nie było. Bez tego wyzwanie założone w październiku
    // pokazywało wrzesień tak, jakby był pomijany.
    if (!isOptionalActiveOn(habit, d)) {
      return { bg: 'transparent', border: '1px solid transparent', color: 'var(--text-muted)',
        ring: false, title: `${d} — poza wyzwaniem` }
    }
    const pz = pauzaDnia(d)
    if (isDayComplete(habit, d)) {
      return { bg: color, border: pz ? `2px solid ${pz.color}` : `1px solid ${color}`, color: '#fff', ring: d === today, title: `${d} — zaliczone${pz ? ` (${pz.label.toLowerCase()})` : ''}` }
    }
    if (pz) return { bg: pz.color + '33', border: `1px ${d > today ? 'dashed' : 'solid'} ${pz.color}66`, color: 'var(--text-muted)', ring: d === today, title: `${d} — ${pz.label.toLowerCase()}` }
    return {
      bg: 'transparent',
      border: d > today ? '1px dashed var(--border)' : '1px solid var(--border)',
      color: 'var(--text-muted)',
      ring: d === today,
      title: d,
    }
  }

  // Kratka zbiorcza — im więcej wyzwań zaliczonych tego dnia, tym mocniejszy
  // kolor. Skalę liczymy do liczby wyzwań, więc „pełny” dzień to wszystkie.
  const cellForAll = (d) => {
    const n = optionalDayCount(habits, d)
    // Dzień, w którym żadne wyzwanie jeszcze nie istniało, zostaje pusty bez
    // ramki — inaczej wyglądałby jak dzień bez wyniku.
    if (!habits.some(h => isOptionalActiveOn(h, d))) {
      return { bg: 'transparent', border: '1px solid transparent', color: 'var(--text-muted)',
        ring: d === today, title: `${d} — poza wyzwaniami` }
    }
    const pz = pauzaDnia(d)
    if (n === 0 && pz) {
      return { bg: pz.color + '33', border: `1px ${d > today ? 'dashed' : 'solid'} ${pz.color}66`, color: 'var(--text-muted)', ring: d === today, title: `${d} — ${pz.label.toLowerCase()}` }
    }
    if (n === 0) {
      return {
        bg: 'transparent',
        border: d > today ? '1px dashed var(--border)' : '1px solid var(--border)',
        color: 'var(--text-muted)', ring: d === today, title: d > today ? d : `${d} — nic`,
      }
    }
    const udzial = Math.min(1, n / Math.max(1, habits.length))
    return {
      bg: `color-mix(in oklab, var(--accent) ${Math.round(22 + udzial * 78)}%, var(--surface2))`,
      border: pz ? `2px solid ${pz.color}` : '1px solid transparent',
      color: udzial > 0.55 ? '#fff' : 'var(--text)',
      ring: d === today,
      title: `${d} — ${n} ${n === 1 ? 'zaliczenie' : 'zaliczenia'}`,
    }
  }

  if (habits.length === 0 && archived.length === 0) {
    return (
      <div className="card" style={{ padding: 22, textAlign: 'center' }}>
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 10, color: 'var(--text-muted)' }}>
          <IconFlag size={26} />
        </div>
        <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600 }}>Nie masz jeszcze wyzwań</p>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Wyzwanie to cel poboczny — nie psuje procentów dnia i nie ma serii.
          Zrobisz, to się liczy; nie zrobisz, nic się nie dzieje.
          Zakładasz je jak zwykły nawyk, wybierając „Rodzaj: Wyzwanie".
        </p>
        <button className="t-btn" onClick={onAdd}
          style={{ width: 'auto', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <IconPlus size={14} /> Nowe wyzwanie
        </button>
      </div>
    )
  }

  const ikona = (h, size = 15) => {
    const color = h.color || 'var(--accent)'
    return (
      <span className="habit-emoji" style={{
        background: color + '1A', border: `1px solid ${color + '40'}`, color, flexShrink: 0,
      }}>
        <CatIcon categoryId={null} emoji={h.emoji} size={size} />
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {amountFor && (
        <AmountSheet habit={amountFor} dateStr={selectedDay} onSet={onSetAmount}
          onClose={() => setAmountFor(null)} />
      )}
      <SegTabs
        items={[{ id: 'today', label: 'Dziś' }, { id: 'stats', label: 'Statystyki' }]}
        active={tab} onChange={setTab}
      />

      {tab === 'today' && (
        <>
          {/* Hero — ten sam układ co na liście dnia Nawyków: postęp dnia obok
              mini-kalendarza miesiąca. Wyzwania mają wyglądać jak nawyki;
              różni je to, co liczymy, nie to, jak to wygląda. */}
          <div className="habit-hero" data-stagger style={{ margin: 0 }}>
            <div className="card card-hover-glow habit-hero-progress" style={{
              borderTop: '2px solid color-mix(in oklab, var(--accent) 80%, transparent)',
              background: 'linear-gradient(140deg, var(--surface) 45%, color-mix(in oklab, var(--accent) 7%, var(--surface)) 100%)',
            }}>
              <Ring value={dzien.pct} size={64} thickness={6} color="var(--accent)" label="dziś" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-sub)', textTransform: 'capitalize', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {dayLabel}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{dzien.done}</span>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/ {dzien.total}</span>
                </div>
                {/* Bez serii — przy wyzwaniu przerwa w ciągu nie jest porażką. */}
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 5 }}>
                  {sum.done}x w tym miesiącu
                </div>
              </div>
            </div>

            <div className="card card-hover-glow habit-hero-cal">
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-sub)', textTransform: 'capitalize', textAlign: 'center', marginBottom: 6 }}>
                {format(selDate, 'LLL yyyy', { locale: pl })}
              </div>
              <MonthCalendar month={selDate} renderCell={cellForAll} cellH={15} gap={2} font={7.5} maxWidth={240} />
            </div>
          </div>

          {/* Nawigator dnia — ten sam wzorzec co na liście dnia Nawyków. */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r)', padding: '10px 14px',
          }}>
            <button aria-label="Poprzedni" className="month-btn" style={{ width: 32, height: 32 }}
              onClick={() => onSelectDay(format(subDays(selDate, 1), 'yyyy-MM-dd'))}><IconChevronLeft size={16} /></button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{dayLabel}</div>
              {isToday && (
                <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 2 }}>Dziś</div>
              )}
            </div>
            {/* W przyszłość nie puszczamy — nie da się zaliczyć czegoś, co się nie stało. */}
            <button aria-label="Następny" className="month-btn" style={{ width: 32, height: 32, opacity: isToday ? 0.3 : 1 }}
              disabled={isToday}
              onClick={() => onSelectDay(format(addDays(selDate, 1), 'yyyy-MM-dd'))}><IconChevronRight size={16} /></button>
          </div>

          {/* Zwarta lista do odhaczania — jedna linijka na wyzwanie, bez siatek.
              Archiwalnych tu nie ma: schowanego wyzwania sie nie zalicza. */}
          {habits.length === 0 && (
            <div className="list-empty"><p>Wszystkie wyzwania są w archiwum — szukaj ich w ⋮ „Ukończone i archiwum".</p></div>
          )}
          {habits.map(h => {
            const done = isDayComplete(h, selectedDay)
            const color = h.color || 'var(--accent)'
            const p = optionalProgress(h, start, end)
            return (
              <div key={h.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 11 }}>
                <button onClick={() => onEdit(h)} title="Edytuj"
                  style={{
                    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer',
                    background: 'none', border: 'none', padding: 0, textAlign: 'left', fontFamily: 'inherit', color: 'var(--text)',
                  }}>
                  {ikona(h)}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.name}
                    </span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {p.inRange}x w okresie · {p.total}x łącznie
                    </span>
                  </span>
                </button>
                {/* Liczba jest OSOBNYM przyciskiem, obok — nie w środku przycisku
                    z nazwą. Button w buttonie to nieprawidłowy HTML: przeglądarka
                    przebudowuje drzewo i klik nie dociera tam, gdzie powinien. */}
                {hasAmountGoal(h) && (
                  <button type="button" className="mono" disabled={isFuture}
                    onClick={() => setAmountFor(h)}
                    title="Ustaw dokładnie (odejmij, wpisz, wyczyść)"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
                      fontSize: 10.5, fontWeight: 600, padding: '4px 8px', borderRadius: 7,
                      background: color + '1c', border: `1px solid ${color}44`, color,
                      cursor: isFuture ? 'default' : 'pointer', opacity: isFuture ? 0.45 : 1,
                      fontFamily: 'inherit',
                    }}>
                    <IconEdit size={11} />
                    {amountShortLabel(dayAmount(h, selectedDay), h.target, h.unit)}
                  </button>
                )}
                {hasAmountGoal(h) ? (
                  <AmountStepper habit={h} dateStr={selectedDay} onSet={onSetAmount} disabled={isFuture} size={36} />
                ) : (
                  <button
                    onClick={() => !isFuture && onToggle(h, selectedDay)}
                    disabled={isFuture}
                    title={isFuture ? 'Przyszły dzień' : done ? 'Odznacz ten dzień' : 'Zalicz ten dzień'}
                    aria-pressed={done}
                    style={{
                      width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                      cursor: isFuture ? 'default' : 'pointer', opacity: isFuture ? 0.4 : 1,
                      display: 'grid', placeItems: 'center',
                      background: done ? color : 'var(--surface2)',
                      border: `1px solid ${done ? color : 'var(--border)'}`,
                      color: done ? '#fff' : 'var(--text-muted)',
                    }}>
                    <IconCheck size={16} />
                  </button>
                )}
              </div>
            )
          })}
        </>
      )}

      {tab === 'stats' && (
        <>
          <SegTabs
            items={[{ id: 'month', label: 'Miesiąc' }, { id: 'year', label: 'Rok' }]}
            active={period} onChange={setPeriod}
          />
          {/* Przewijanie okresu — wstecz bez ograniczeń, do przodu do bieżącego. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="icon-btn" onClick={() => przesun(-1)} title={period === 'year' ? 'Poprzedni rok' : 'Poprzedni miesiąc'}><IconChevronLeft size={16} /></button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{okresLabel}</span>
            <button className="icon-btn" onClick={() => przesun(1)} disabled={naKoncu} style={{ opacity: naKoncu ? 0.3 : 1 }} title={period === 'year' ? 'Następny rok' : 'Następny miesiąc'}><IconChevronRight size={16} /></button>
          </div>
          {/* „Ile na to poszlo" — sumy czasu i ilosci, kazda jednostka osobno. */}
          {amountTotals(habits, start, end).length > 0 && (
            <div className="card" style={{ padding: 14, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {amountTotals(habits, start, end).map(t => (
                <div key={t.unit}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>
                    w tym okresie
                  </div>
                </div>
              ))}
            </div>
          )}
          <StatTiles tiles={[
            { Icon: IconCheck, value: sum.done, label: 'zaliczeń', color: 'var(--accent)' },
            { Icon: IconFlag,  value: `${sum.active}/${sum.count}`, label: 'ruszyło' },
            { Icon: IconStar,  value: sum.bestDay ? sum.bestDay.count : '—',
              label: sum.bestDay ? `najlepszy ${fmtDzien(sum.bestDay.date)}` : 'brak zaliczeń' },
          ]} />

          {/* Ten sam podział co w statystykach Nawyków: miesiąc widać jako
              kalendarz, tydzień i rok jako słupki — kratki na cały rok byłyby
              nieczytelne. */}
          <div className="card" style={{ padding: 14 }}>
            {period === 'month' ? (
              <>
                <MonthCalendar month={kotwicaDate} renderCell={cellForAll} cellH={30} gap={4} font={11} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 8.5, color: 'var(--text-muted)' }}>mniej</span>
                  {[0, 0.35, 0.6, 0.85, 1].map((v, i) => (
                    <div key={i} style={{
                      width: 9, height: 9, borderRadius: 2,
                      background: v === 0 ? 'var(--surface2)' : `color-mix(in oklab, var(--accent) ${Math.round(22 + v * 78)}%, var(--surface2))`,
                    }} />
                  ))}
                  <span style={{ fontSize: 8.5, color: 'var(--text-muted)' }}>więcej</span>
                </div>
              </>
            ) : (
              <BarChartSVG data={optionalBuckets(habits, period, kotwica)} accent="var(--accent)" height={130}
                fmt={(v) => `${v} ${v === 1 ? 'raz' : 'razy'}`} />
            )}
          </div>

          {/* Karty wyzwań — jak karty nawyków w statystykach: siatka dni przy
              miesiącu, przy roku sam licznik. */}
          <div data-stagger style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
            {habits.map(h => {
              const p = optionalProgress(h, start, end)
              const color = h.color || 'var(--accent)'
              const okres = habitPeriodLabel(p.first, p.last)
              return (
                <div key={h.id} className="card hover" style={{ padding: 14, cursor: 'pointer' }}
                  onClick={() => onEdit(h)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    {ikona(h, 15)}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {p.inRange}x w okresie · {p.total}x łącznie
                      </div>
                    </div>
                  </div>
                  {/* Przy wyzwaniu na czas sam licznik dni mowi za malo —
                      liczy sie, ile tego bylo i ile wychodzilo w dniu. */}
                  {(() => {
                    const m = amountStats(h, start, end)
                    if (!m || m.days === 0) return null
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                        <div>
                          <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, color }}>
                            {formatAmount(m.total, m.unit)}
                          </div>
                          <div style={{ fontSize: 8.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>łącznie</div>
                        </div>
                        <div>
                          <div className="mono" style={{ fontSize: 12.5, fontWeight: 700 }}>
                            {formatAmount(m.avg, m.unit)}
                          </div>
                          <div style={{ fontSize: 8.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>średnio</div>
                        </div>
                        {m.best && (
                          <div>
                            <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>
                              {formatAmount(m.best.value, m.unit)}
                            </div>
                            <div style={{ fontSize: 8.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>rekord</div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {period === 'month'
                    ? <MonthCalendar month={kotwicaDate} renderCell={cellForHabit(h, color)} cellH={18} gap={3} font={8} />
                    : okres && <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{okres}</div>}
                </div>
              )
            })}
          </div>

        </>
      )}
    </div>
  )
}
