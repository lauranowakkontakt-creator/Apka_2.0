import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, setDoc, doc, Timestamp } from 'firebase/firestore'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { bladSubskrypcji } from '../../utils/polaczenie'
import SegTabs from '../SegTabs'
import StatTiles from '../StatTiles'
import { confirmDialog } from '../ConfirmModal'
import { toast } from '../Toast'
import { IconPlus, IconEdit, IconTrash, IconClose, IcCar } from '../Icons'
import {
  PALIWA, paliwo, spalanie, spalaniePoTankowaniu, kosztNa100, cenaZaLitr, wydatkiMiesiaca,
  ostatniLicznik, przejechane, terminyAuta, fmt1, fmtZl, fmtKm, liczba,
} from '../../utils/carLogic'

// Auto: tankowania gazu i benzyny z liczeniem spalania, naprawy oraz
// najważniejsze dane auta (OC, przegląd).
//
// Spalanie liczymy „od pełna do pełna”, osobno dla każdego paliwa — auto na
// gaz pali jedno i drugie naraz. Cała matematyka siedzi w utils/carLogic.js.

const TODAY = () => format(new Date(), 'yyyy-MM-dd')
const dzien = (d) => { try { return format(parseISO(d), 'd MMM yyyy', { locale: pl }) } catch { return d || '' } }
const ZAKLADKI = [
  { id: 'paliwo',  label: 'Paliwo' },
  { id: 'naprawy', label: 'Naprawy' },
  { id: 'auto',    label: 'Auto' },
]

export default function AutoDashboard({ user, setHeaderExtras }) {
  const [tankowania, setTankowania] = useState([])
  const [naprawy, setNaprawy]       = useState([])
  const [auto, setAuto]             = useState({})
  const [loading, setLoading]       = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [tab, setTab]               = useState('paliwo')
  const [okno, setOkno]             = useState(null) // { typ: 'paliwo' | 'naprawa', wpis? }

  useEffect(() => {
    const baza = ['users', user.uid]
    const subs = [
      onSnapshot(query(collection(db, ...baza, 'carFuel'), orderBy('date', 'desc')), s => {
        setTankowania(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false)
      }, bladSubskrypcji('carFuel', { przyBledzie: () => setLoading(false) })),
      onSnapshot(query(collection(db, ...baza, 'carRepairs'), orderBy('date', 'desc')),
        s => setNaprawy(s.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('carRepairs')),
      onSnapshot(doc(db, ...baza, 'settings', 'car'), s => setAuto(s.data() || {}), bladSubskrypcji('settings/car')),
    ]
    return () => subs.forEach(u => u())
  }, [user.uid])

  useEffect(() => {
    setHeaderExtras?.(
      <button className="hdr-btn accent" title="Nowe tankowanie" aria-label="Nowe tankowanie" onClick={() => setOkno({ typ: 'paliwo' })}>
        <IconPlus size={17} />
      </button>
    )
    return () => setHeaderExtras?.(null)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dzis = TODAY()
  const miesiac = dzis.slice(0, 7)
  const lpg = useMemo(() => spalanie(tankowania, 'lpg'), [tankowania])
  const pb  = useMemo(() => spalanie(tankowania, 'pb'), [tankowania])
  const poTankowaniu = useMemo(() => spalaniePoTankowaniu(tankowania), [tankowania])
  const koszt100 = useMemo(() => kosztNa100(tankowania), [tankowania])
  const terminy = useMemo(() => terminyAuta(auto, dzis), [auto, dzis])
  const pilne = terminy.filter(t => t.stan === 'po' || t.stan === 'blisko')

  if (loading) return <div className="list-loading">Ładowanie...</div>

  const usun = async (kolekcja, wpis, pytanie) => {
    const ok = await confirmDialog({ title: pytanie })
    if (!ok) return
    try { await deleteDoc(doc(db, 'users', user.uid, kolekcja, wpis.id)) } catch { toast.error('Nie udało się usunąć') }
  }

  return (
    <div className="auto" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {pilne.length > 0 && (
        <div className="auto-alerty">
          {pilne.map(t => (
            <button key={t.pole} type="button" className={`auto-alert ${t.stan}`} onClick={() => setTab('auto')}>
              <strong>{t.label}</strong>
              <span>{t.opis} · {dzien(t.data)}</span>
            </button>
          ))}
        </div>
      )}

      <StatTiles tiles={[
        { label: 'Gaz l/100 km', value: fmt1(lpg.srednie), color: paliwo('lpg').color },
        { label: 'Benzyna l/100 km', value: fmt1(pb.srednie), color: paliwo('pb').color },
        { label: 'Koszt 100 km', value: koszt100 == null ? '–' : `${fmt1(koszt100)} zł` },
      ]} />

      <SegTabs items={ZAKLADKI} active={tab} onChange={setTab} />

      {tab === 'paliwo' && (
        <>
          <div className="auto-podsumowanie">
            <span>W tym miesiącu <b>{fmtZl(wydatkiMiesiaca(tankowania, miesiac))}</b></span>
            {przejechane(tankowania) > 0 && <span>Przejechane <b>{fmtKm(przejechane(tankowania))}</b></span>}
          </div>
          {(lpg.szacunkowe || pb.szacunkowe) && (
            <p className="auto-wskazowka">Spalanie jest na razie szacunkowe. Dokładny wynik pojawi się po dwóch tankowaniach „do pełna” z wpisanym stanem licznika.</p>
          )}
          {tankowania.length === 0 ? (
            <div className="list-empty">
              <p>Brak tankowań</p>
              <p className="list-empty-hint">Dodaj pierwsze przyciskiem „+”. Żeby apka policzyła spalanie, tankuj do pełna i wpisuj stan licznika.</p>
            </div>
          ) : (
            <div className="auto-lista">
              {tankowania.map(t => {
                const p = paliwo(t.fuel), cena = cenaZaLitr(t), na100 = poTankowaniu[t.id]
                return (
                  <div key={t.id} className="auto-row">
                    <i style={{ background: p.color }} />
                    <div className="auto-row-main">
                      <strong>{fmt1(liczba(t.liters))} l · {fmtZl(t.price)}</strong>
                      <span>
                        {p.krotko} · {dzien(t.date)}
                        {cena ? ` · ${cena.toFixed(2).replace('.', ',')} zł/l` : ''}
                        {liczba(t.odometer) > 0 ? ` · ${fmtKm(t.odometer)}` : ''}
                        {t.full ? ' · do pełna' : ''}
                      </span>
                      {t.note && <span className="auto-row-note">{t.note}</span>}
                    </div>
                    {na100 != null && <em className="auto-row-wynik" style={{ color: p.color }}>{fmt1(na100)}<small>l/100 km</small></em>}
                    <div className="auto-row-akcje">
                      <button type="button" className="t-btn" aria-label="Edytuj tankowanie" onClick={() => setOkno({ typ: 'paliwo', wpis: t })}><IconEdit size={13} /></button>
                      <button type="button" className="t-btn delete" aria-label="Usuń tankowanie" onClick={() => usun('carFuel', t, 'Usunąć to tankowanie?')}><IconTrash size={13} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'naprawy' && (
        <>
          <button type="button" className="btn-add-account" onClick={() => setOkno({ typ: 'naprawa' })}>
            <IconPlus size={15} style={{ verticalAlign: '-3px', marginRight: 4 }} /> Dodaj naprawę lub serwis
          </button>
          <div className="auto-podsumowanie">
            <span>W tym roku <b>{fmtZl(wydatkiMiesiaca(naprawy, dzis.slice(0, 4), 'cost'))}</b></span>
            <span>Razem <b>{fmtZl(naprawy.reduce((s, n) => s + liczba(n.cost), 0))}</b></span>
          </div>
          {naprawy.length === 0 ? (
            <div className="list-empty">
              <p>Brak napraw</p>
              <p className="list-empty-hint">Zapisuj tu naprawy, wymiany oleju, opon i przeglądy — z datą, kosztem i stanem licznika.</p>
            </div>
          ) : (
            <div className="auto-lista">
              {naprawy.map(n => (
                <div key={n.id} className="auto-row">
                  <i style={{ background: 'var(--accent)' }} />
                  <div className="auto-row-main">
                    <strong>{n.title}</strong>
                    <span>{dzien(n.date)}{liczba(n.cost) > 0 ? ` · ${fmtZl(n.cost)}` : ''}{liczba(n.odometer) > 0 ? ` · ${fmtKm(n.odometer)}` : ''}</span>
                    {n.note && <span className="auto-row-note">{n.note}</span>}
                  </div>
                  <div className="auto-row-akcje">
                    <button type="button" className="t-btn" aria-label="Edytuj naprawę" onClick={() => setOkno({ typ: 'naprawa', wpis: n })}><IconEdit size={13} /></button>
                    <button type="button" className="t-btn delete" aria-label="Usuń naprawę" onClick={() => usun('carRepairs', n, 'Usunąć tę naprawę?')}><IconTrash size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'auto' && (
        <DaneAuta user={user} auto={auto} terminy={terminy} licznik={ostatniLicznik(tankowania, naprawy)} />
      )}

      {okno?.typ === 'paliwo' && (
        <FormularzTankowania user={user} wpis={okno.wpis} tankowania={tankowania} onClose={() => setOkno(null)} />
      )}
      {okno?.typ === 'naprawa' && (
        <FormularzNaprawy user={user} wpis={okno.wpis} licznik={ostatniLicznik(tankowania, naprawy)} onClose={() => setOkno(null)} />
      )}
    </div>
  )
}

// ── Tankowanie ───────────────────────────────────────────────────────────────
function FormularzTankowania({ user, wpis, tankowania, onClose }) {
  const ostatnie = tankowania[0]
  const [fuel, setFuel]         = useState(wpis?.fuel || ostatnie?.fuel || 'lpg')
  const [date, setDate]         = useState(wpis?.date || TODAY())
  const [liters, setLiters]     = useState(wpis ? String(wpis.liters ?? '').replace('.', ',') : '')
  const [price, setPrice]       = useState(wpis ? String(wpis.price ?? '').replace('.', ',') : '')
  const [odometer, setOdometer] = useState(wpis?.odometer ? String(wpis.odometer) : '')
  const [full, setFull]         = useState(wpis ? !!wpis.full : true)
  const [note, setNote]         = useState(wpis?.note || '')
  const [saving, setSaving]     = useState(false)

  const litry = liczba(liters), kwota = liczba(price), licznik = Math.round(liczba(odometer))
  const najwyzszy = ostatniLicznik(tankowania.filter(t => t.id !== wpis?.id), [])
  // Podgląd: spalanie od poprzedniego pełnego baku tego paliwa, zanim zapiszesz
  const podglad = useMemo(() => {
    if (!full || !litry || !licznik) return null
    const inne = tankowania.filter(t => t.id !== wpis?.id)
    return spalaniePoTankowaniu([...inne, { id: '__nowe', date, fuel, liters: litry, odometer: licznik, full: true }]).__nowe ?? null
  }, [tankowania, wpis, full, litry, licznik, date, fuel])

  const zapisz = async (e) => {
    e.preventDefault()
    if (!litry) { toast.error('Wpisz, ile litrów zatankowałaś'); return }
    setSaving(true)
    const dane = { date, fuel, liters: litry, price: kwota, odometer: licznik || null, full, note: note.trim() }
    try {
      if (wpis) await updateDoc(doc(db, 'users', user.uid, 'carFuel', wpis.id), dane)
      else await addDoc(collection(db, 'users', user.uid, 'carFuel'), { ...dane, createdAt: Timestamp.now() })
      onClose()
    } catch { toast.error('Nie udało się zapisać'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{wpis ? 'Edycja tankowania' : 'Nowe tankowanie'}</h3>
          <button type="button" className="modal-close" aria-label="Zamknij" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form className="form" onSubmit={zapisz}>
          <SegTabs items={PALIWA.map(p => ({ id: p.id, label: p.label }))} active={fuel} onChange={setFuel} />
          <div className="auto-form-2">
            <div className="form-group">
              <label htmlFor="auto-litry">Litry</label>
              <input id="auto-litry" type="text" inputMode="decimal" className="form-input" placeholder="np. 38,5" value={liters} onChange={e => setLiters(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="auto-kwota">Zapłacono (zł)</label>
              <input id="auto-kwota" type="text" inputMode="decimal" className="form-input" placeholder="np. 115,00" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
          </div>
          {litry > 0 && kwota > 0 && <div className="auto-form-info">Cena: <b>{(kwota / litry).toFixed(2).replace('.', ',')} zł/l</b></div>}
          <div className="auto-form-2">
            <div className="form-group">
              <label htmlFor="auto-licznik">Stan licznika (km)</label>
              <input id="auto-licznik" type="text" inputMode="numeric" className="form-input" placeholder={najwyzszy ? `ostatnio ${najwyzszy}` : 'np. 123456'} value={odometer} onChange={e => setOdometer(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="auto-data">Data</label>
              <input id="auto-data" type="date" className="form-input" value={date} max={TODAY()} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <label className="mood-switch">
            <input type="checkbox" checked={full} onChange={e => setFull(e.target.checked)} />
            <span className="mood-switch-ui" aria-hidden="true" />
            <span>Do pełna<small>Spalanie liczy się między dwoma pełnymi bakami</small></span>
          </label>
          {podglad != null && (
            <div className="auto-form-wynik">Od ostatniego pełnego baku: <b>{fmt1(podglad)} l/100 km</b></div>
          )}
          {licznik > 0 && najwyzszy > 0 && licznik - najwyzszy > 1500 && (
            <p className="auto-wskazowka uwaga">Od ostatniego wpisu wychodzi {fmtKm(licznik - najwyzszy)}. Jeśli to pomyłka w liczniku, spalanie policzy się źle.</p>
          )}
          {licznik > 0 && najwyzszy > 0 && licznik < najwyzszy && date >= (ostatnie?.date || '') && (
            <p className="auto-wskazowka uwaga">Licznik jest niższy niż ostatnio ({fmtKm(najwyzszy)}) — sprawdź, czy dobrze wpisany.</p>
          )}
          {!licznik && <p className="auto-wskazowka">Bez stanu licznika tankowanie policzy się tylko do wydatków, nie do spalania.</p>}
          <div className="form-group">
            <label htmlFor="auto-notatka">Notatka (opcjonalnie)</label>
            <input id="auto-notatka" type="text" className="form-input" maxLength={120} placeholder="np. stacja, trasa" value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Zapisywanie…' : 'Zapisz'}</button>
        </form>
      </div>
    </div>
  )
}

// ── Naprawa / serwis ─────────────────────────────────────────────────────────
function FormularzNaprawy({ user, wpis, licznik, onClose }) {
  const [title, setTitle]       = useState(wpis?.title || '')
  const [date, setDate]         = useState(wpis?.date || TODAY())
  const [cost, setCost]         = useState(wpis?.cost ? String(wpis.cost).replace('.', ',') : '')
  const [odometer, setOdometer] = useState(wpis?.odometer ? String(wpis.odometer) : '')
  const [note, setNote]         = useState(wpis?.note || '')
  const [saving, setSaving]     = useState(false)

  const zapisz = async (e) => {
    e.preventDefault()
    if (!title.trim()) { toast.error('Wpisz, co było robione'); return }
    setSaving(true)
    const dane = { title: title.trim(), date, cost: liczba(cost), odometer: Math.round(liczba(odometer)) || null, note: note.trim() }
    try {
      if (wpis) await updateDoc(doc(db, 'users', user.uid, 'carRepairs', wpis.id), dane)
      else await addDoc(collection(db, 'users', user.uid, 'carRepairs'), { ...dane, createdAt: Timestamp.now() })
      onClose()
    } catch { toast.error('Nie udało się zapisać'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{wpis ? 'Edycja naprawy' : 'Nowa naprawa lub serwis'}</h3>
          <button type="button" className="modal-close" aria-label="Zamknij" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form className="form" onSubmit={zapisz}>
          <div className="form-group">
            <label htmlFor="auto-n-tytul">Co było robione</label>
            <input id="auto-n-tytul" type="text" className="form-input" maxLength={100} placeholder="np. Wymiana oleju i filtrów" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="auto-form-2">
            <div className="form-group">
              <label htmlFor="auto-n-koszt">Koszt (zł)</label>
              <input id="auto-n-koszt" type="text" inputMode="decimal" className="form-input" placeholder="np. 350" value={cost} onChange={e => setCost(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="auto-n-data">Data</label>
              <input id="auto-n-data" type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="auto-n-licznik">Stan licznika (km, opcjonalnie)</label>
            <input id="auto-n-licznik" type="text" inputMode="numeric" className="form-input" placeholder={licznik ? `ostatnio ${licznik}` : 'np. 123456'} value={odometer} onChange={e => setOdometer(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="auto-n-notatka">Notatka (opcjonalnie)</label>
            <textarea id="auto-n-notatka" className="form-input" rows={3} maxLength={500} placeholder="Warsztat, części, co sprawdzić następnym razem…" value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Zapisywanie…' : 'Zapisz'}</button>
        </form>
      </div>
    </div>
  )
}

// ── Dane auta i terminy ──────────────────────────────────────────────────────
function DaneAuta({ user, auto, terminy, licznik }) {
  const [f, setF] = useState(null) // null = pokazujemy zapisane; obiekt = edycja
  const [saving, setSaving] = useState(false)
  const v = f || auto
  const zmien = (pole) => (e) => setF({ ...v, [pole]: e.target.value })

  const zapisz = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'car'), {
        name: (v.name || '').trim(), plate: (v.plate || '').trim().toUpperCase(), year: (v.year || '').trim(),
        ocDo: v.ocDo || '', przegladDo: v.przegladDo || '', acDo: v.acDo || '', notes: (v.notes || '').trim(),
      }, { merge: true })
      setF(null)
      toast.success('Dane auta zapisane')
    } catch { toast.error('Nie udało się zapisać') }
    setSaving(false)
  }

  return (
    <>
      <div className="card auto-karta">
        <div className="auto-karta-glowa">
          <span className="auto-karta-ikona"><IcCar size={20} /></span>
          <div>
            <strong>{auto.name || 'Moje auto'}</strong>
            <span>{[auto.plate, auto.year, licznik ? fmtKm(licznik) : ''].filter(Boolean).join(' · ') || 'Uzupełnij dane poniżej'}</span>
          </div>
        </div>
        <div className="auto-terminy">
          {terminy.map(t => (
            <div key={t.pole} className={`auto-termin ${t.stan}`}>
              <span>{t.label}</span>
              <strong>{t.stan === 'brak' ? '–' : dzien(t.data)}</strong>
              <em>{t.opis}</em>
            </div>
          ))}
        </div>
      </div>

      <form className="form card auto-dane" onSubmit={zapisz}>
        <div className="form-group">
          <label htmlFor="auto-nazwa">Auto</label>
          <input id="auto-nazwa" type="text" className="form-input" maxLength={60} placeholder="np. Opel Astra 1.6 LPG" value={v.name || ''} onChange={zmien('name')} />
        </div>
        <div className="auto-form-2">
          <div className="form-group">
            <label htmlFor="auto-rej">Nr rejestracyjny</label>
            <input id="auto-rej" type="text" className="form-input" maxLength={12} placeholder="np. WA 12345" value={v.plate || ''} onChange={zmien('plate')} />
          </div>
          <div className="form-group">
            <label htmlFor="auto-rok">Rocznik</label>
            <input id="auto-rok" type="text" inputMode="numeric" className="form-input" maxLength={4} placeholder="np. 2014" value={v.year || ''} onChange={zmien('year')} />
          </div>
        </div>
        <div className="auto-form-2">
          <div className="form-group">
            <label htmlFor="auto-oc">OC ważne do</label>
            <input id="auto-oc" type="date" className="form-input" value={v.ocDo || ''} onChange={zmien('ocDo')} />
          </div>
          <div className="form-group">
            <label htmlFor="auto-przeglad">Przegląd ważny do</label>
            <input id="auto-przeglad" type="date" className="form-input" value={v.przegladDo || ''} onChange={zmien('przegladDo')} />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="auto-ac">AC ważne do (opcjonalnie)</label>
          <input id="auto-ac" type="date" className="form-input" value={v.acDo || ''} onChange={zmien('acDo')} />
        </div>
        <div className="form-group">
          <label htmlFor="auto-uwagi">Notatki (opcjonalnie)</label>
          <textarea id="auto-uwagi" className="form-input" rows={3} maxLength={800} placeholder="Ubezpieczyciel i nr polisy, rozmiar opon, olej…" value={v.notes || ''} onChange={zmien('notes')} style={{ resize: 'vertical' }} />
        </div>
        <button type="submit" className="btn-save" disabled={saving || !f}>{saving ? 'Zapisywanie…' : f ? 'Zapisz dane auta' : 'Zapisane'}</button>
      </form>
    </>
  )
}

