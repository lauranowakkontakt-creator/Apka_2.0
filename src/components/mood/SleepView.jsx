import { useState, useMemo } from 'react'
import { collection, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { format, subDays } from 'date-fns'
import { pl } from 'date-fns/locale'
import { db } from '../../firebase/config'
import StatTiles from '../StatTiles'
import SegTabs from '../SegTabs'
import { BarChartSVG } from '../ChartPrimitives'
import { IconTrash, IconClose, IconPlus, IcMoon } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { minutySnu, fmtCzas, fmtGodziny, senDnia, sredniaSnu } from '../../utils/sleepLogic'
import { kicker, Skala5, TODAY } from './wspolne'

// Zakładka „Sen": długość nocy, pobudki i drzemki.
// Dwie drogi zapisu: stoper („Idę spać" → „Wstałam") albo wpisanie godzin ręcznie.

const KLUCZ_STOPERA = 'mw_sleepStart'
const czytajStoper = () => { try { return JSON.parse(localStorage.getItem(KLUCZ_STOPERA) || 'null') } catch { return null } }
const zapiszStoper = (v) => { try { v ? localStorage.setItem(KLUCZ_STOPERA, JSON.stringify(v)) : localStorage.removeItem(KLUCZ_STOPERA) } catch { /* tryb prywatny */ } }

export default function SleepView({ user, logs, formularz, setFormularz }) {
  const today = TODAY()
  const [stoper, setStoper] = useState(czytajStoper)

  const dni7 = useMemo(() => Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')), [today]) // eslint-disable-line react-hooks/exhaustive-deps
  const sr7 = sredniaSnu(logs, dni7)
  const ostatnia = senDnia(logs, today)
  const wykres = dni7.map(d => ({ label: format(new Date(d + 'T12:00:00'), 'EEEEEE', { locale: pl }), value: Math.round((senDnia(logs, d).noc / 60) * 10) / 10, active: d === today }))
  const ostatnie = useMemo(() => [...logs].sort((a, b) => (b.date + (b.end || '')).localeCompare(a.date + (a.end || ''))).slice(0, 20), [logs])

  const start = () => { const v = { at: Date.now() }; zapiszStoper(v); setStoper(v) }
  const stop = () => {
    const od = new Date(stoper.at), teraz = new Date()
    const min = Math.round((teraz - od) / 60000)
    // Krótki sen zaczęty w ciągu dnia to drzemka; resztę traktujemy jak noc.
    const drzemka = min < 180 && od.getHours() >= 9 && od.getHours() < 20
    setFormularz({ type: drzemka ? 'nap' : 'night', start: format(od, 'HH:mm'), end: format(teraz, 'HH:mm'), zeStopera: true })
  }
  const anulujStoper = () => { zapiszStoper(null); setStoper(null) }

  const usun = async (l) => {
    const ok = await confirmDialog({ title: l.type === 'nap' ? 'Usunąć drzemkę?' : 'Usunąć zapis nocy?' })
    if (ok) await deleteDoc(doc(db, 'users', user.uid, 'sleepLogs', l.id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Stoper */}
      <div className="card sleep-timer">
        <IcMoon size={22} />
        {stoper ? (
          <>
            <div className="sleep-timer-txt">
              <strong>Śpisz od {format(new Date(stoper.at), 'HH:mm')}</strong>
              <span>Po przebudzeniu dotknij „Wstałam"</span>
            </div>
            <button type="button" className="mood-btn-main" onClick={stop}>Wstałam</button>
            <button type="button" className="t-btn" aria-label="Anuluj stoper" onClick={anulujStoper}><IconClose size={13} /></button>
          </>
        ) : (
          <>
            <div className="sleep-timer-txt">
              <strong>{ostatnia.maNoc ? `Ostatnia noc: ${fmtCzas(ostatnia.noc)}` : 'Zmierz sen albo drzemkę'}</strong>
              <span>{ostatnia.maNoc
                ? `${ostatnia.pobudki ? `pobudki: ${ostatnia.pobudki}` : 'bez pobudek'}${ostatnia.liczbaDrzemek ? ` · drzemki dziś: ${fmtCzas(ostatnia.drzemki)}` : ''}`
                : 'Dotknij, gdy się kładziesz — czas policzy się sam'}</span>
            </div>
            <button type="button" className="mood-btn-main" onClick={start}>Idę spać</button>
          </>
        )}
      </div>

      <StatTiles tiles={[
        { label: 'Średnio noc · 7 dni', value: sr7.noc ? `${fmtGodziny(sr7.noc)} h` : '—' },
        { label: 'Pobudki / noc', value: sr7.pobudki === null ? '—' : sr7.pobudki.toFixed(1).replace('.', ',') },
        { label: 'Drzemki · 7 dni', value: sr7.drzemki },
      ]} />

      <div className="card" style={{ padding: 16 }}>
        {kicker('Długość nocy · ostatnie 7 dni', { marginBottom: 10 })}
        {sr7.nocy > 0
          ? <BarChartSVG data={wykres} height={130} accent="var(--info)" fmt={v => `${String(v).replace('.', ',')} h`} />
          : <div className="an-pusty">Brak zapisanych nocy z ostatniego tygodnia</div>}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="mood-btn-ghost" onClick={() => setFormularz({ type: 'night' })}><IconPlus size={14} /> Noc</button>
        <button type="button" className="mood-btn-ghost" onClick={() => setFormularz({ type: 'nap' })}><IconPlus size={14} /> Drzemka</button>
      </div>

      {ostatnie.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {kicker('Ostatnie zapisy')}
          {ostatnie.map(l => (
            <div key={l.id} className="sleep-row">
              <i style={{ background: l.type === 'nap' ? 'var(--warn)' : 'var(--info)' }} />
              <div className="sleep-row-main">
                <strong>{fmtCzas(l.minutes)}</strong>
                <span>{l.type === 'nap' ? 'drzemka' : 'noc'} · {format(new Date(l.date + 'T12:00:00'), 'd MMM', { locale: pl })} · {l.start}–{l.end}
                  {l.type !== 'nap' && l.wakeups > 0 ? ` · pobudki: ${l.wakeups}` : ''}{l.quality ? ` · jakość ${l.quality}/5` : ''}</span>
              </div>
              <button type="button" className="t-btn delete" aria-label="Usuń zapis" onClick={() => usun(l)}><IconTrash size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {formularz && (
        <SleepForm user={user} dane={formularz} onClose={() => setFormularz(null)}
          onSaved={() => { if (formularz.zeStopera) anulujStoper(); setFormularz(null) }} />
      )}
    </div>
  )
}

function SleepForm({ user, dane, onClose, onSaved }) {
  const teraz = new Date()
  const [type, setType]       = useState(dane.type || 'night')
  const [date, setDate]       = useState(TODAY())
  const [start, setStart]     = useState(dane.start || (dane.type === 'nap' ? format(new Date(teraz - 30 * 60000), 'HH:mm') : '23:00'))
  const [end, setEnd]         = useState(dane.end || (dane.type === 'nap' ? format(teraz, 'HH:mm') : '07:00'))
  const [wakeups, setWakeups] = useState(0)
  const [quality, setQuality] = useState(0)
  const [saving, setSaving]   = useState(false)
  const min = minutySnu(start, end)

  const zapisz = async (e) => {
    e.preventDefault()
    if (!min || !date) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'users', user.uid, 'sleepLogs'), {
        date, type, start, end, minutes: min,
        wakeups: type === 'night' ? wakeups : 0, quality: quality || null, createdAt: Timestamp.now(),
      })
      onSaved()
    } catch { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{type === 'nap' ? 'Drzemka' : 'Sen w nocy'}</h3>
          <button type="button" className="modal-close" aria-label="Zamknij" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form className="form" onSubmit={zapisz}>
          <SegTabs items={[{ id: 'night', label: 'Noc' }, { id: 'nap', label: 'Drzemka' }]} active={type} onChange={setType} />
          <div className="form-group">
            <label htmlFor="sen-data">{type === 'nap' ? 'Dzień' : 'Dzień pobudki'}</label>
            <input id="sen-data" type="date" className="form-input" value={date} max={TODAY()} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="sen-od">Zasnęłam</label>
              <input id="sen-od" type="time" className="form-input" value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="sen-do">Obudziłam się</label>
              <input id="sen-do" type="time" className="form-input" value={end} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="sleep-total">Razem <strong>{fmtCzas(min)}</strong></div>
          {type === 'night' && (
            <div className="mood-row">
              <span>Pobudki w nocy</span>
              <div className="sleep-stepper">
                <button type="button" aria-label="Mniej pobudek" onClick={() => setWakeups(w => Math.max(0, w - 1))}>−</button>
                <strong>{wakeups}</strong>
                <button type="button" aria-label="Więcej pobudek" onClick={() => setWakeups(w => Math.min(20, w + 1))}>+</button>
              </div>
            </div>
          )}
          <div className="mood-row">
            <span>Jak się wyspałam</span>
            <Skala5 value={quality} onChange={setQuality} color="var(--info)" />
          </div>
          <button type="submit" className="btn-save" disabled={saving || !min}>{saving ? 'Zapisywanie…' : 'Zapisz'}</button>
        </form>
      </div>
    </div>
  )
}
