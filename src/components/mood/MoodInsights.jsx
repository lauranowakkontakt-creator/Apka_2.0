import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Rozwijana } from '../Analityka'
import { IconTrash } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { nastrojDni, znacznikiDni, wplywZnacznikow, nastrojWGrupach, MIN_DNI } from '../../utils/moodFactors'
import { senDnia, kubelekSnu, KUBELKI_SNU } from '../../utils/sleepLogic'
import { statystykiCyklu, fazaDnia, FAZY, KOLEJNOSC_FAZ } from '../../utils/cycleLogic'
import { findFactor, to10, fmt10, CUSTOM_COLORS, TODAY } from './wspolne'

// „Co wpływa na nastrój" — porównanie dni z czynnikiem i bez niego, liczone
// z całej historii (miesiąc to za mało dni, żeby cokolwiek porównywać).

const roznica10 = (r) => (r * 9) / 4
const fmtRoznicy = (r) => `${r >= 0 ? '+' : '−'}${Math.abs(roznica10(r)).toFixed(1).replace('.', ',')}`
const dataKrotko = (k) => format(new Date(k + 'T12:00:00'), 'd MMM yyyy', { locale: pl })

// Lista z paskami rozchodzącymi się od środka: w prawo = lepiej, w lewo = gorzej.
function ListaWplywu({ pozycje, pusty }) {
  const [wszystko, setWszystko] = useState(false)
  if (!pozycje.length) return <div className="an-pusty">{pusty}</div>
  const max = Math.max(0.5, ...pozycje.filter(p => p.pewne).map(p => Math.abs(p.roznica)))
  const lista = wszystko ? pozycje : pozycje.slice(0, 6)
  return (
    <div className="wplyw">
      {lista.map(p => {
        const szer = p.roznica === null ? 0 : Math.min(50, (Math.abs(p.roznica) / max) * 50)
        const lepiej = (p.roznica ?? 0) >= 0
        return (
          <div key={p.klucz} className={`wplyw-row${p.pewne ? '' : ' slabe'}`}>
            <div className="wplyw-top">
              <span className="wplyw-name"><i style={{ background: p.kolor }} />{p.nazwa}</span>
              <span className="wplyw-delta">{p.pewne ? fmtRoznicy(p.roznica) : 'za mało dni'}</span>
            </div>
            <div className="wplyw-track" aria-hidden="true">
              {p.pewne && <div style={{ width: `${szer}%`, [lepiej ? 'left' : 'right']: '50%', background: lepiej ? 'var(--income)' : 'var(--expense)',
                borderRadius: lepiej ? '0 4px 4px 0' : '4px 0 0 4px' }} />}
            </div>
            <div className="wplyw-sub">
              {p.dni} {p.dni === 1 ? 'dzień' : 'dni'} · średnio {fmt10(p.z)}
              {p.bez !== null && <> · bez: {fmt10(p.bez)}</>}
            </div>
          </div>
        )
      })}
      {pozycje.length > 6 && (
        <button type="button" className="an-more" onClick={() => setWszystko(v => !v)}>{wszystko ? 'Pokaż mniej' : `Pokaż wszystkie (${pozycje.length})`}</button>
      )}
      <p className="mood-note">Liczba po prawej to różnica średniego nastroju (skala 1–10) między dniami z tym czynnikiem a pozostałymi. Wynik pojawia się od {MIN_DNI} dni po każdej stronie.</p>
    </div>
  )
}

// Średni nastrój w rozłącznych grupach (fazy cyklu, długość snu).
function ListaGrup({ grupy, kolor, pusty }) {
  if (!grupy.length) return <div className="an-pusty">{pusty}</div>
  return (
    <div className="wplyw">
      {grupy.map(g => (
        <div key={g.grupa} className={`wplyw-row${g.dni >= MIN_DNI ? '' : ' slabe'}`}>
          <div className="wplyw-top">
            <span className="wplyw-name"><i style={{ background: kolor(g.grupa) }} />{g.nazwa || g.grupa}</span>
            <span className="wplyw-delta">{fmt10(g.srednia)}</span>
          </div>
          <div className="wplyw-track plain" aria-hidden="true"><div style={{ width: `${(to10(g.srednia) / 10) * 100}%`, left: 0, background: kolor(g.grupa), borderRadius: 4 }} /></div>
          <div className="wplyw-sub">{g.dni} {g.dni === 1 ? 'dzień' : 'dni'} z wpisem{g.dni < MIN_DNI ? ' · za mało, żeby porównywać' : ''}</div>
        </div>
      ))}
    </div>
  )
}

export default function MoodInsights({ logs, sleepLogs, okresy, people, ust, zapiszUst }) {
  const okresyZycia = useMemo(() => ust.okresy || [], [ust.okresy])
  const dane = useMemo(() => {
    const nastroj = nastrojDni(logs)
    const wplyw = wplywZnacznikow(nastroj, znacznikiDni(logs, okresyZycia))
    const opisz = (w) => {
      const [typ, id] = [w.klucz[0], w.klucz.slice(2)]
      if (typ === 'p') { const o = people.find(p => p.id === id); return o ? { ...w, nazwa: o.name, kolor: o.color || '#8b5cf6' } : null }
      if (typ === 'o') { const o = okresyZycia.find(x => x.id === id); return o ? { ...w, nazwa: o.label, kolor: o.color } : null }
      const c = findFactor(id, ust.factors); return { ...w, nazwa: c.label, kolor: c.color }
    }
    const opisane = wplyw.map(opisz).filter(Boolean)
    const stat = statystykiCyklu(okresy)
    return {
      dniZNastrojem: nastroj.size,
      czynniki: opisane.filter(w => w.klucz[0] !== 'p'),
      osoby: opisane.filter(w => w.klucz[0] === 'p'),
      sen: nastrojWGrupach(nastroj, d => kubelekSnu(senDnia(sleepLogs, d).noc), KUBELKI_SNU),
      cykl: nastrojWGrupach(nastroj, d => fazaDnia(okresy, d, stat), KOLEJNOSC_FAZ).map(g => ({ ...g, nazwa: FAZY[g.grupa].nazwa })),
    }
  }, [logs, sleepLogs, okresy, people, ust.factors, okresyZycia])

  const KOLORY_SNU = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD']

  return (
    <>
      <Rozwijana id="nastroj-czynniki" tytul="Co wpływa na nastrój" domyslnie podsumowanie={`${dane.czynniki.length} czynników`}>
        <ListaWplywu pozycje={dane.czynniki} pusty="Zaznaczaj we wpisach, co się działo (praca, studia, kościół, spotkanie…), a tu pojawi się porównanie." />
      </Rozwijana>
      <Rozwijana id="nastroj-osoby" tytul="Ludzie a nastrój" domyslnie podsumowanie={`${dane.osoby.length} osób`}>
        <ListaWplywu pozycje={dane.osoby} pusty="Zaznaczaj we wpisach, z kim byłaś, a zobaczysz, przy kim czujesz się lepiej." />
      </Rozwijana>
      <Rozwijana id="nastroj-sen" tytul="Sen a nastrój" podsumowanie={dane.sen.length ? `${dane.sen.reduce((s, g) => s + g.dni, 0)} dni` : 'brak danych'}>
        <ListaGrup grupy={dane.sen} kolor={g => KOLORY_SNU[KUBELKI_SNU.indexOf(g)] || 'var(--info)'}
          pusty="Zapisuj noce w zakładce Sen — porównamy nastrój po krótkich i długich nocach." />
      </Rozwijana>
      <Rozwijana id="nastroj-cykl" tytul="Cykl a nastrój" podsumowanie={dane.cykl.length ? `${dane.cykl.length} faz` : 'brak danych'}>
        <ListaGrup grupy={dane.cykl} kolor={g => FAZY[g]?.kolor || 'var(--accent)'}
          pusty="Zaznacz okres w zakładce Cykl — zobaczysz średni nastrój w każdej fazie." />
      </Rozwijana>
      <Rozwijana id="nastroj-okresy" tytul="Okresy w życiu" podsumowanie={okresyZycia.length ? `${okresyZycia.length}` : 'np. żałoba, sesja'}>
        <OkresyZycia okresy={okresyZycia} zapisz={(lista) => zapiszUst({ okresy: lista })} />
      </Rozwijana>
    </>
  )
}

// Dłuższe sytuacje (żałoba, sesja, choroba w rodzinie, urlop). Mają daty od–do
// i liczą się dla każdego dnia w zakresie — nie trzeba ich zaznaczać codziennie.
function OkresyZycia({ okresy, zapisz }) {
  const [label, setLabel] = useState('')
  const [from, setFrom]   = useState(TODAY())
  const [to, setTo]       = useState('')

  const dodaj = (e) => {
    e.preventDefault()
    const nazwa = label.trim()
    if (!nazwa || !from || (to && to < from)) return
    zapisz([...okresy, { id: `o${Date.now().toString(36)}`, label: nazwa, color: CUSTOM_COLORS[okresy.length % CUSTOM_COLORS.length], from, to: to || null }])
    setLabel(''); setTo('')
  }
  const usun = async (o) => {
    const ok = await confirmDialog({ title: `Usunąć okres „${o.label}"?` })
    if (ok) zapisz(okresy.filter(x => x.id !== o.id))
  }
  const zakoncz = (o) => zapisz(okresy.map(x => (x.id === o.id ? { ...x, to: TODAY() } : x)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p className="mood-note" style={{ margin: 0 }}>Coś, co trwa dłużej i może ciążyć albo pomagać — np. żałoba, sesja, urlop. W statystykach wyżej zobaczysz, jak wyglądał nastrój w tym czasie na tle reszty.</p>
      {okresy.map(o => (
        <div key={o.id} className="sleep-row">
          <i style={{ background: o.color }} />
          <div className="sleep-row-main">
            <strong>{o.label}</strong>
            <span>{dataKrotko(o.from)} – {o.to ? dataKrotko(o.to) : 'trwa'}</span>
          </div>
          {!o.to && <button type="button" className="mood-chip add" onClick={() => zakoncz(o)}>zakończ dziś</button>}
          <button type="button" className="t-btn delete" aria-label={`Usuń ${o.label}`} onClick={() => usun(o)}><IconTrash size={12} /></button>
        </div>
      ))}
      <form className="form" onSubmit={dodaj} style={{ gap: 10 }}>
        <div className="form-group">
          <label htmlFor="okres-nazwa">Nowy okres</label>
          <input id="okres-nazwa" className="form-input" value={label} onChange={e => setLabel(e.target.value)} maxLength={30} placeholder="np. żałoba" />
        </div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="okres-od">Od</label>
            <input id="okres-od" type="date" className="form-input" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="okres-do">Do (puste = trwa)</label>
            <input id="okres-do" type="date" className="form-input" value={to} min={from} onChange={e => setTo(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="mood-btn-ghost" disabled={!label.trim()}>Dodaj okres</button>
      </form>
    </div>
  )
}
