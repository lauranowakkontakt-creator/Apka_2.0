import { useState, useMemo } from 'react'
import { collection, addDoc, deleteDoc, updateDoc, doc, Timestamp } from 'firebase/firestore'
import { format, startOfMonth, getDaysInMonth, addMonths, addDays } from 'date-fns'
import { pl } from 'date-fns/locale'
import { db } from '../../firebase/config'
import { Rozwijana } from '../Analityka'
import { IconTrash, IconClose, IconChevronLeft, IconChevronRight } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { statystykiCyklu, dzienCyklu, fazaCyklu, prognozaCyklu, zakresyFaz, posortowane, fazaDnia, roznicaDni, kalendarzCyklu, czyOkres,
  FAZY, KOLEJNOSC_FAZ } from '../../utils/cycleLogic'
import { nastrojDni, nastrojWGrupach, MIN_DNI } from '../../utils/moodFactors'
import { fmt10, TODAY } from './wspolne'

const dzienSlownie = (k) => format(new Date(k + 'T12:00:00'), 'd MMMM', { locale: pl })
const dni = (n) => (n === 1 ? 'dzień' : 'dni')

// Zakładka „Cykl": dzień cyklu, faza, prognoza i czego się dziś spodziewać.
export default function CycleView({ user, okresy, moodLogs, formularz, setFormularz }) {
  const today = TODAY()
  const stat = statystykiCyklu(okresy)
  const dzien = dzienCyklu(okresy, today)
  const faza = fazaCyklu(dzien, stat.dlugoscCyklu, stat.dlugoscOkresu)
  const prog = prognozaCyklu(okresy, today)
  const historia = useMemo(() => posortowane(okresy).reverse(), [okresy])
  const trwa = historia.find(o => !o.end && roznicaDni(o.start, today) < 14)

  // Jej własne dane: średni nastrój w każdej fazie.
  const wgFaz = useMemo(() => nastrojWGrupach(nastrojDni(moodLogs), d => fazaDnia(okresy, d, stat), KOLEJNOSC_FAZ), [moodLogs, okresy]) // eslint-disable-line react-hooks/exhaustive-deps
  const mojaFaza = wgFaz.find(g => g.grupa === faza)

  const zakoncz = (o) => updateDoc(doc(db, 'users', user.uid, 'cycleLogs', o.id), { end: today })
  const usun = async (o) => {
    const ok = await confirmDialog({ title: `Usunąć okres z ${dzienSlownie(o.start)}?` })
    if (ok) await deleteDoc(doc(db, 'users', user.uid, 'cycleLogs', o.id))
  }

  if (!okresy.length) {
    return (
      <div className="card cycle-empty">
        <strong>Śledzenie cyklu</strong>
        <p>Zaznacz pierwszy dzień ostatniego okresu. Po dwóch zapisanych okresach apka zacznie liczyć Twoją średnią
          długość cyklu, a już od pierwszego pokaże dzień cyklu, fazę i czego się spodziewać.</p>
        <button type="button" className="mood-btn-main" onClick={() => setFormularz(true)}>Zaznacz początek okresu</button>
        {formularz && <CycleForm user={user} okresy={okresy} onClose={() => setFormularz(false)} />}
      </div>
    )
  }

  const f = faza ? FAZY[faza] : null
  const zakresy = zakresyFaz(stat.dlugoscCyklu, stat.dlugoscOkresu)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Pierścień cyklu: łuki faz, kropka = dziś, w środku dzień cyklu */}
      <section className="card cycle-hero">
        <CycleRing dzien={dzien} dlugosc={stat.dlugoscCyklu} zakresy={zakresy} faza={faza} />
        <div className="cycle-hero-txt">
          {f ? <strong><i style={{ background: f.kolor }} />{f.nazwa}</strong> : <strong>Brak aktualnych danych</strong>}
          <span>{!dzien ? 'Ostatni okres był ponad dwa miesiące temu — zaznacz nowy.'
            : prog.dniDo > 0 ? <>Okres za <b>{prog.dniDo} {dni(prog.dniDo)}</b> · {dzienSlownie(prog.nastepny)}</>
            : prog.dniDo === 0 ? 'Okres spodziewany dzisiaj'
            : <>Okres spóźnia się <b>{-prog.dniDo} {dni(-prog.dniDo)}</b></>}</span>
          <span className="cycle-mini">cykl ~{stat.dlugoscCyklu} dni{stat.zDanych ? '' : ' (domyślnie)'} · okres ~{stat.dlugoscOkresu} dni</span>
          {trwa
            ? <button type="button" className="mood-btn-ghost sm" onClick={() => zakoncz(trwa)}>Okres skończył się dziś</button>
            : <button type="button" className="mood-btn-ghost sm" onClick={() => setFormularz(true)}>Okres się zaczął</button>}
        </div>
      </section>

      <CycleCalendar okresy={okresy} stat={stat} today={today} />

      {f && (
        <section className="card cycle-today">
          <div className="cycle-today-head"><i style={{ background: f.kolor }} />Czego się dziś spodziewać</div>
          <p className="cycle-opis">{f.opis}</p>
          {mojaFaza && mojaFaza.dni >= MIN_DNI && (
            <p className="cycle-opis moje">Twój średni nastrój w tej fazie: <strong>{fmt10(mojaFaza.srednia)}/10</strong> <small>({mojaFaza.dni} dni)</small></p>
          )}
        </section>
      )}

      {dzien && (
        <div className="cycle-legend">
          {zakresy.map(z => (
            <span key={z.faza} className={z.faza === faza ? 'on' : ''}><i style={{ background: FAZY[z.faza].kolor }} />{FAZY[z.faza].nazwa} <small>{z.od === z.do ? z.od : `${z.od}–${z.do}`}</small></span>
          ))}
        </div>
      )}

      {stat.zDanych && stat.najkrotszy !== stat.najdluzszy && (
        <p className="mood-note" style={{ margin: 0 }}>Ostatnie cykle: od {stat.najkrotszy} do {stat.najdluzszy} dni — o tyle może przesunąć się prognoza.</p>
      )}

      <Rozwijana id="cykl-historia" tytul="Historia" podsumowanie={`${historia.length} ${historia.length === 1 ? 'okres' : 'okresów'}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {trwa && <button type="button" className="mood-btn-ghost sm" onClick={() => setFormularz(true)}>Dodaj inny okres</button>}
        {historia.map((o, i) => {
          const nast = historia[i - 1]
          return (
            <div key={o.id} className="sleep-row">
              <i style={{ background: FAZY.menstruacja.kolor }} />
              <div className="sleep-row-main">
                <strong>{dzienSlownie(o.start)} {o.start.slice(0, 4)}</strong>
                <span>{o.end ? `okres ${roznicaDni(o.start, o.end) + 1} dni` : 'bez daty końca'}{nast ? ` · cykl ${roznicaDni(o.start, nast.start)} dni` : ''}</span>
              </div>
              <button type="button" className="t-btn delete" aria-label="Usuń okres" onClick={() => usun(o)}><IconTrash size={12} /></button>
            </div>
          )
        })}
      </div>
      </Rozwijana>

      <p className="mood-note">To szacunek z kalendarza, oparty na Twoich zapisach i typowym przebiegu cyklu. Nie zastąpi lekarza i nie nadaje się do planowania ani zapobiegania ciąży.</p>

      {formularz && <CycleForm user={user} okresy={okresy} onClose={() => setFormularz(false)} />}
    </div>
  )
}

const klucz = (d) => format(d, 'yyyy-MM-dd')
const krotko = (k) => format(new Date(k + 'T12:00:00'), 'd MMM', { locale: pl })

// Mały kalendarz: zapisane okresy, przewidywane okresy i okno owulacji
// z JEJ średniej długości cyklu — kilka miesięcy do przodu.
function CycleCalendar({ okresy, stat, today }) {
  const [miesiac, setMiesiac] = useState(() => startOfMonth(new Date()))
  const kal = useMemo(() => kalendarzCyklu(okresy, today, 6), [okresy, today])
  const start = startOfMonth(miesiac)
  const pusteNaPoczatku = (start.getDay() + 6) % 7
  const dniM = Array.from({ length: getDaysInMonth(start) }, (_, i) => klucz(addDays(start, i)))
  const nazwa = format(start, 'LLLL yyyy', { locale: pl })
  return (
    <section className="card cyc-cal">
      <div className="cyc-cal-head">
        <button type="button" className="mood-cal-nav" aria-label="Poprzedni miesiąc" onClick={() => setMiesiac(m => addMonths(m, -1))}><IconChevronLeft size={14} /></button>
        <strong>{nazwa.charAt(0).toUpperCase() + nazwa.slice(1)}</strong>
        <button type="button" className="mood-cal-nav" aria-label="Następny miesiąc" onClick={() => setMiesiac(m => addMonths(m, 1))}><IconChevronRight size={14} /></button>
      </div>
      <div className="cyc-cal-grid">
        {['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'].map(d => <span key={d} className="mood-cal-dow">{d}</span>)}
        {Array.from({ length: pusteNaPoczatku }, (_, i) => <span key={'e' + i} />)}
        {dniM.map(d => {
          const okres = czyOkres(okresy, d, stat.dlugoscOkresu) && d <= today
          const prog = !okres && kal.prognoza.has(d)
          const owu = !okres && !prog && kal.owulacja.has(d)
          return (
            <span key={d} className={`cyc-day${okres ? ' okres' : ''}${prog ? ' prog' : ''}${owu ? ' owu' : ''}${d === today ? ' today' : ''}`}
              aria-label={`${Number(d.slice(8))}${okres ? ', okres' : prog ? ', przewidywany okres' : owu ? ', okolice owulacji' : ''}`}>
              {Number(d.slice(8))}
            </span>
          )
        })}
      </div>
      <div className="cyc-cal-legend">
        <span><i className="okres" />okres</span><span><i className="prog" />przewidywany</span><span><i className="owu" />owulacja</span>
      </div>
      {kal.starty.length > 0 && (
        <p className="cyc-cal-next">Kolejne okresy: {kal.starty.slice(0, 3).map(krotko).join(' · ')}
          <small>{stat.zDanych ? `wg Twojej średniej: cykl ${stat.dlugoscCyklu} dni, okres ${stat.dlugoscOkresu} dni` : 'na razie wg typowych 28 dni — dokładniej po 2 zapisanych okresach'}</small>
        </p>
      )}
    </section>
  )
}

// Pierścień cyklu. Łuki faz od góry zgodnie z ruchem wskazówek; bieżąca faza
// pełnym kolorem, pozostałe przygaszone, kropka na dzisiejszym dniu.
function CycleRing({ dzien, dlugosc, zakresy, faza, size = 116 }) {
  const r = 44, sw = 10, C = 2 * Math.PI * r
  const przerwa = 1.6
  const kat = (d) => ((d - 1) / dlugosc) * 2 * Math.PI - Math.PI / 2
  const kd = dzien ? kat(Math.min(dzien, dlugosc) + 0.5) : null
  return (
    <svg className="cycle-ring" width={size} height={size} viewBox="0 0 120 120" role="img"
      aria-label={dzien ? `Dzień ${dzien} z ${dlugosc}` : 'Brak danych o cyklu'}>
      <g transform="rotate(-90 60 60)">
        {zakresy.map(z => {
          const dl = ((z.do - z.od + 1) / dlugosc) * C
          const off = ((z.od - 1) / dlugosc) * C
          return <circle key={z.faza} cx="60" cy="60" r={r} fill="none" stroke={FAZY[z.faza].kolor} strokeWidth={sw}
            strokeDasharray={`${Math.max(0.1, dl - przerwa)} ${C}`} strokeDashoffset={-off}
            opacity={!dzien || z.faza === faza ? 1 : 0.32} />
        })}
      </g>
      {kd !== null && <circle cx={60 + Math.cos(kd) * r} cy={60 + Math.sin(kd) * r} r="7.5" fill="var(--text)" stroke="var(--surface)" strokeWidth="3" />}
      <text x="60" y="57" textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--text)">{dzien || '–'}</text>
      <text x="60" y="76" textAnchor="middle" fontSize="9.5" fill="var(--text-muted)">{dzien ? `z ${dlugosc} dni` : 'cykl'}</text>
    </svg>
  )
}

function CycleForm({ user, okresy, onClose }) {
  const [start, setStart] = useState(TODAY())
  const [end, setEnd]     = useState('')
  const [blad, setBlad]   = useState('')
  const [saving, setSaving] = useState(false)

  const zapisz = async (e) => {
    e.preventDefault()
    if (!start) return
    if (okresy.some(o => o.start === start)) { setBlad('Okres z tym początkiem jest już zapisany'); return }
    if (end && end < start) { setBlad('Koniec nie może być przed początkiem'); return }
    setSaving(true)
    try {
      await addDoc(collection(db, 'users', user.uid, 'cycleLogs'), { start, end: end || null, createdAt: Timestamp.now() })
      onClose()
    } catch { setBlad('Nie udało się zapisać'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ textAlign: 'left' }}>
        <div className="modal-header">
          <h3>Okres</h3>
          <button type="button" className="modal-close" aria-label="Zamknij" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form className="form" onSubmit={zapisz}>
          <div className="form-group">
            <label htmlFor="cykl-od">Pierwszy dzień</label>
            <input id="cykl-od" type="date" className="form-input" value={start} max={TODAY()} onChange={e => setStart(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="cykl-do">Ostatni dzień (można dopisać później)</label>
            <input id="cykl-do" type="date" className="form-input" value={end} min={start} max={TODAY()} onChange={e => setEnd(e.target.value)} />
          </div>
          {blad && <div className="form-error">{blad}</div>}
          <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Zapisywanie…' : 'Zapisz'}</button>
        </form>
      </div>
    </div>
  )
}
