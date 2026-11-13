import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Rozwijana } from '../Analityka'
import { IconTrash } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { nastrojDni, znacznikiDni, wplywZnacznikow, nastrojWGrupach, ocenyCzynnikow, pomagaSzkodzi, skrajneGrupy, MIN_DNI } from '../../utils/moodFactors'
import { chwileDoAnalizy } from '../../utils/moodEntry'
import { senDnia, kubelekSnu, KUBELKI_SNU } from '../../utils/sleepLogic'
import { statystykiCyklu, fazaDnia, FAZY, KOLEJNOSC_FAZ } from '../../utils/cycleLogic'
import { findFactor, fmt10, CUSTOM_COLORS, TODAY } from './wspolne'

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
              {p.dni}× · średnio {fmt10(p.z)}
              {p.bez !== null && <> · bez: {fmt10(p.bez)}</>}
            </div>
            {p.ocena && (
              <div className="wplyw-ocena">Twoja ocena:
                {p.ocena.lepiej > 0 && <b className="plus">↑ lepiej {p.ocena.lepiej}×</b>}
                {p.ocena.gorzej > 0 && <b className="minus">↓ gorzej {p.ocena.gorzej}×</b>}
              </div>
            )}
          </div>
        )
      })}
      {pozycje.length > 6 && (
        <button type="button" className="an-more" onClick={() => setWszystko(v => !v)}>{wszystko ? 'Pokaż mniej' : `Pokaż wszystkie (${pozycje.length})`}</button>
      )}
      <p className="mood-note">Liczba po prawej to różnica nastroju (skala 1–10) między chwilami z tym czynnikiem a pozostałymi — dlatego praca i spotkanie tego samego dnia się nie zlewają. Wynik pojawia się od {MIN_DNI} chwil po każdej stronie.</p>
    </div>
  )
}

export default function MoodInsights({ logs, sleepLogs, okresy, people, ust, zapiszUst }) {
  const okresyZycia = useMemo(() => ust.okresy || [], [ust.okresy])
  const dane = useMemo(() => {
    const nastroj = nastrojDni(logs)
    // Czynniki i osoby porównujemy CHWILAMI (każda ma swój nastrój), okresy
    // życia — dniami, bo trwają całymi dniami.
    const chw = chwileDoAnalizy(logs)
    const wplyw = [
      ...wplywZnacznikow(nastrojDni(chw), znacznikiDni(chw)),
      ...wplywZnacznikow(nastroj, znacznikiDni(logs, okresyZycia)).filter(w => w.klucz[0] === 'o'),
    ]
    const opisz = (w) => {
      const [typ, id] = [w.klucz[0], w.klucz.slice(2)]
      if (typ === 'p') { const o = people.find(p => p.id === id); return o ? { ...w, nazwa: o.name, kolor: o.color || '#8b5cf6' } : null }
      if (typ === 'o') { const o = okresyZycia.find(x => x.id === id); return o ? { ...w, nazwa: o.label, kolor: o.color } : null }
      const c = findFactor(id, ust.factors); return { ...w, nazwa: c.label, kolor: c.color }
    }
    const oceny = ocenyCzynnikow(logs)
    const opisane = wplyw.map(opisz).filter(Boolean).map(w => ({ ...w, ocena: oceny.get(w.klucz) || null }))
    const stat = statystykiCyklu(okresy)
    return {
      dniZNastrojem: nastroj.size,
      chwil: chw.length,
      ...pomagaSzkodzi(opisane),
      wszystkie: opisane,
      czynniki: opisane.filter(w => w.klucz[0] !== 'p'),
      osoby: opisane.filter(w => w.klucz[0] === 'p'),
      sen: nastrojWGrupach(nastroj, d => kubelekSnu(senDnia(sleepLogs, d).noc), KUBELKI_SNU),
      cykl: nastrojWGrupach(nastroj, d => fazaDnia(okresy, d, stat), KOLEJNOSC_FAZ).map(g => ({ ...g, nazwa: FAZY[g.grupa].nazwa })),
    }
  }, [logs, sleepLogs, okresy, people, ust.factors, okresyZycia])

  const sen = skrajneGrupy(dane.sen)
  const cykl = skrajneGrupy(dane.cykl)
  const nazwaSnu = (g) => g.grupa === 'poniżej 6 h' ? 'krótszej niż 6 h' : g.grupa === '8 h i więcej' ? 'co najmniej 8 h' : `${g.grupa}`

  return (
    <>
      <section className="wn-grid">
        <WnKarta tytul="Co Ci pomaga" ton="plus" pozycje={dane.pomaga}
          pusto="Jeszcze nic wyraźnego. Zaznaczaj w chwilach, co się działo i z kim — po kilku razach tu się pojawi." />
        <WnKarta tytul="Co Ci szkodzi" ton="minus" pozycje={dane.szkodzi}
          pusto="Nic nie odstaje w dół — albo jest jeszcze za mało wpisów, żeby to zobaczyć." />
      </section>

      {(sen || cykl) && (
        <section className="wn-zdania">
          {sen && <p><i style={{ background: 'var(--info)' }} />Po nocy <b>{nazwaSnu(sen.najlepsza)}</b> masz średnio <b>{fmt10(sen.najlepsza.srednia)}</b>, a po nocy {nazwaSnu(sen.najgorsza)} — <b>{fmt10(sen.najgorsza.srednia)}</b>.</p>}
          {cykl && <p><i style={{ background: FAZY[cykl.najgorsza.grupa].kolor }} />Najtrudniej jest Ci w fazie <b>{FAZY[cykl.najgorsza.grupa].nazwa.toLowerCase()}</b> ({fmt10(cykl.najgorsza.srednia)}), najlepiej — <b>{FAZY[cykl.najlepsza.grupa].nazwa.toLowerCase()}</b> ({fmt10(cykl.najlepsza.srednia)}).</p>}
        </section>
      )}
      <p className="mood-note wn-stopka">Wnioski z wszystkich Twoich wpisów ({dane.chwil} {dane.chwil === 1 ? 'chwila' : dane.chwil < 5 ? 'chwile' : 'chwil'}). Liczba przy czynniku to o ile wyższy lub niższy jest nastrój (skala 1–10), gdy to się działo.</p>

      <Rozwijana id="nastroj-szczegoly" tytul="Szczegóły: wszystkie czynniki i osoby" podsumowanie={`${dane.wszystkie.length}`}>
        <ListaWplywu pozycje={dane.wszystkie} pusty="Zaznaczaj w chwilach, co się działo i z kim, a tu pojawi się porównanie." />
      </Rozwijana>
      <Rozwijana id="nastroj-okresy" tytul="Okresy w życiu" podsumowanie={okresyZycia.length ? `${okresyZycia.length}` : 'np. żałoba, sesja'}>
        <OkresyZycia okresy={okresyZycia} zapisz={(lista) => zapiszUst({ okresy: lista })} />
      </Rozwijana>
    </>
  )
}

// Karta „pomaga / szkodzi”: nazwa, różnica i pasek długości różnicy.
function WnKarta({ tytul, ton, pozycje, pusto }) {
  const max = Math.max(0.5, ...pozycje.map(p => Math.abs(p.roznica)))
  return (
    <div className={`wn-karta ${ton}`}>
      <h4>{ton === 'plus' ? '↑' : '↓'} {tytul}</h4>
      {pozycje.length ? (
        <ul>
          {pozycje.map(p => (
            <li key={p.klucz}>
              <span className="wn-nazwa"><i style={{ background: p.kolor }} />{p.nazwa}</span>
              <span className="wn-liczba">{fmtRoznicy(p.roznica)}</span>
              <span className="wn-pasek" aria-hidden="true"><span style={{ width: `${(Math.abs(p.roznica) / max) * 100}%` }} /></span>
            </li>
          ))}
        </ul>
      ) : <p className="wn-pusto">{pusto}</p>}
    </div>
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
