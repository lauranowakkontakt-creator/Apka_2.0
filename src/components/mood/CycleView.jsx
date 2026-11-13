import { useState, useMemo } from 'react'
import { collection, addDoc, deleteDoc, updateDoc, doc, Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { db } from '../../firebase/config'
import StatTiles from '../StatTiles'
import { IconTrash, IconClose } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { statystykiCyklu, dzienCyklu, fazaCyklu, prognozaCyklu, zakresyFaz, posortowane, fazaDnia, roznicaDni,
  FAZY, KOLEJNOSC_FAZ } from '../../utils/cycleLogic'
import { nastrojDni, nastrojWGrupach, MIN_DNI } from '../../utils/moodFactors'
import { kicker, fmt10, TODAY } from './wspolne'

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
      <div className="card cycle-hero">
        {dzien ? (
          <>
            <div className="cycle-day"><span>{dzien}</span><small>dzień cyklu</small></div>
            <div className="cycle-hero-txt">
              <strong><i style={{ background: f.kolor }} />{f.nazwa}</strong>
              <span>{prog.dniDo > 0 ? `Następny okres za ok. ${prog.dniDo} ${dni(prog.dniDo)} · ${dzienSlownie(prog.nastepny)}`
                : prog.dniDo === 0 ? 'Okres spodziewany dzisiaj'
                : `Okres spóźnia się ${-prog.dniDo} ${dni(-prog.dniDo)}`}</span>
            </div>
          </>
        ) : (
          <div className="cycle-hero-txt">
            <strong>Brak aktualnych danych</strong>
            <span>Ostatni zapisany okres był ponad dwa miesiące temu. Zaznacz nowy, żeby wznowić liczenie.</span>
          </div>
        )}
      </div>

      {dzien && (
        <div className="card" style={{ padding: 16 }}>
          {kicker('Gdzie jesteś w cyklu', { marginBottom: 12 })}
          <div className="cycle-bar" role="img" aria-label={`Dzień ${dzien} z ${stat.dlugoscCyklu}, ${f.nazwa}`}>
            {zakresy.map(z => (
              <div key={z.faza} style={{ flex: z.do - z.od + 1, background: FAZY[z.faza].kolor, opacity: z.faza === faza ? 1 : 0.4 }} />
            ))}
            <span className="cycle-marker" style={{ left: `${Math.min(100, ((dzien - 0.5) / stat.dlugoscCyklu) * 100)}%` }} />
          </div>
          <div className="cycle-legend">
            {zakresy.map(z => (
              <span key={z.faza} className={z.faza === faza ? 'on' : ''}><i style={{ background: FAZY[z.faza].kolor }} />{FAZY[z.faza].nazwa} <small>{z.od === z.do ? z.od : `${z.od}–${z.do}`}</small></span>
            ))}
          </div>
        </div>
      )}

      {f && (
        <div className="card" style={{ padding: 16 }}>
          {kicker('Czego się dziś spodziewać', { marginBottom: 10 })}
          <p className="cycle-opis">{f.opis}</p>
          {mojaFaza && mojaFaza.dni >= MIN_DNI && (
            <p className="cycle-opis moje">U Ciebie w tej fazie średni nastrój to <strong>{fmt10(mojaFaza.srednia)}/10</strong> (z {mojaFaza.dni} dni z wpisem).</p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {trwa
          ? <button type="button" className="mood-btn-ghost" onClick={() => zakoncz(trwa)}>Okres skończył się dziś</button>
          : <button type="button" className="mood-btn-ghost" onClick={() => setFormularz(true)}>Okres się zaczął</button>}
        {trwa && <button type="button" className="mood-btn-ghost" onClick={() => setFormularz(true)}>Dodaj inny okres</button>}
      </div>

      <StatTiles tiles={[
        { label: stat.zDanych ? 'Średni cykl' : 'Cykl (domyślnie)', value: `${stat.dlugoscCyklu} dni` },
        { label: 'Średni okres', value: `${stat.dlugoscOkresu} dni` },
        { label: 'Zapisane cykle', value: stat.liczbaCykli },
      ]} />
      {stat.zDanych && stat.najkrotszy !== stat.najdluzszy && (
        <p className="mood-note">Ostatnie cykle trwały od {stat.najkrotszy} do {stat.najdluzszy} dni — prognoza może się o tyle przesunąć.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {kicker('Historia')}
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

      <p className="mood-note">To szacunek z kalendarza, oparty na Twoich zapisach i typowym przebiegu cyklu. Nie zastąpi lekarza i nie nadaje się do planowania ani zapobiegania ciąży.</p>

      {formularz && <CycleForm user={user} okresy={okresy} onClose={() => setFormularz(false)} />}
    </div>
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
