import { useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import { pl } from 'date-fns/locale'
import SegTabs from '../SegTabs'
import StatTiles from '../StatTiles'
import { LineAreaSVG, BarChartSVG } from '../ChartPrimitives'
import { senDnia, sredniaSnu, fmtCzas, fmtGodziny, kubelekSnu, KUBELKI_SNU } from '../../utils/sleepLogic'
import { statystykiCyklu, posortowane, roznicaDni, fazaDnia, FAZY, KOLEJNOSC_FAZ } from '../../utils/cycleLogic'
import { nastrojDni, nastrojWGrupach, MIN_DNI } from '../../utils/moodFactors'
import { kicker, fmt10, to10 } from './wspolne'

// Statystyki zakładek „Sen" i „Cykl" w widoku „Analiza i statystyki".
// Nastrój ma swoje (MoodPage), a tu reszta — żeby analiza obejmowała
// wszystkie zakładki modułu, nie tylko sam nastrój.

const naMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null }
const hhmm = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
// Średnia godzina na kole doby — 23:30 i 0:30 dają 0:00, a nie 12:00.
function sredniaGodzina(godziny) {
  const t = godziny.map(naMin).filter(v => v !== null)
  if (!t.length) return null
  const kat = (v) => (v / 1440) * 2 * Math.PI
  const x = t.reduce((s, v) => s + Math.cos(kat(v)), 0), y = t.reduce((s, v) => s + Math.sin(kat(v)), 0)
  return hhmm((Math.atan2(y, x) / (2 * Math.PI)) * 1440)
}

// Paski „ile razy / średnio” — ten sam wygląd co „Najczęściej czułaś”.
function Paski({ pozycje }) {
  const max = Math.max(1, ...pozycje.map(p => p.wartosc))
  return (
    <ul className="wn-emocje">
      {pozycje.map(p => (
        <li key={p.klucz}>
          <span className="wn-nazwa"><i style={{ background: p.kolor }} />{p.nazwa}</span>
          <span className="wn-pasek" aria-hidden="true"><span style={{ width: `${(p.wartosc / max) * 100}%`, background: p.kolor }} /></span>
          <span className="wn-liczba">{p.opis}</span>
        </li>
      ))}
    </ul>
  )
}

const OKRESY_SNU = [{ id: 30, label: '30 dni' }, { id: 90, label: '90 dni' }, { id: 365, label: 'Rok' }]

export function StatystykiSnu({ sleepLogs, moodLogs }) {
  const [ile, setIle] = useState(30)
  const dni = useMemo(() => Array.from({ length: ile }, (_, i) => format(subDays(new Date(), ile - 1 - i), 'yyyy-MM-dd')), [ile])
  const s = useMemo(() => {
    const zakres = new Set(dni)
    const noce = sleepLogs.filter(l => l.type !== 'nap' && zakres.has(l.date))
    const sr = sredniaSnu(sleepLogs, dni)
    const dzienne = dni.map(d => ({ d, ...senDnia(sleepLogs, d) }))
    const zNoca = dzienne.filter(x => x.maNoc)
    const jakosci = zNoca.filter(x => x.jakosc)
    const kubelki = KUBELKI_SNU.map(k => ({ k, n: zNoca.filter(x => kubelekSnu(x.noc) === k).length }))
    const nastroj = nastrojDni(moodLogs)
    const nastrojWgSnu = nastrojWGrupach(new Map([...nastroj].filter(([d]) => zakres.has(d))), d => kubelekSnu(senDnia(sleepLogs, d).noc), KUBELKI_SNU)
    // Przy dłuższym okresie wykres dzień po dniu jest nieczytelny — średnie tygodni.
    const tygodnie = []
    for (let i = 0; i < dni.length; i += 7) {
      const t = dni.slice(i, i + 7), w = sredniaSnu(sleepLogs, t)
      tygodnie.push({ label: format(new Date(t[0] + 'T12:00:00'), 'd.MM'), value: w.noc ? Math.round((w.noc / 60) * 10) / 10 : 0 })
    }
    return {
      sr, zNoca, dzienne, kubelki, nastrojWgSnu, tygodnie,
      jakosc: jakosci.length ? jakosci.reduce((a, x) => a + x.jakosc, 0) / jakosci.length : null,
      zasypianie: sredniaGodzina(noce.map(l => l.start)),
      pobudka: sredniaGodzina(noce.map(l => l.end)),
      najdluzsza: zNoca.length ? zNoca.reduce((a, b) => (b.noc > a.noc ? b : a)) : null,
      najkrotsza: zNoca.length ? zNoca.reduce((a, b) => (b.noc < a.noc ? b : a)) : null,
    }
  }, [sleepLogs, moodLogs, dni])

  const kolorKubelka = ['var(--expense)', 'var(--warn)', 'var(--info)', 'var(--income)']
  const dzienSl = (d) => format(new Date(d + 'T12:00:00'), 'd MMM', { locale: pl })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SegTabs items={OKRESY_SNU} active={ile} onChange={setIle} style={{ maxWidth: 300 }} />

      {!s.zNoca.length ? (
        <div className="card an-pusty" style={{ padding: 14 }}>Brak zapisanych nocy w tym okresie. Dodaj je w zakładce „Sen”.</div>
      ) : (
        <>
          <StatTiles tiles={[
            { label: 'średnio na noc', value: `${fmtGodziny(s.sr.noc)} h`, color: 'var(--info)' },
            { label: 'pobudki na noc', value: (s.sr.pobudki || 0).toFixed(1).replace('.', ',') },
            { label: 'jakość snu', value: s.jakosc ? `${s.jakosc.toFixed(1).replace('.', ',')}/5` : '–' },
          ]} />
          <StatTiles tiles={[
            { label: 'zasypiasz średnio', value: s.zasypianie || '–' },
            { label: 'wstajesz średnio', value: s.pobudka || '–' },
            { label: s.sr.drzemki ? `drzemki · ${fmtCzas(s.sr.minutyDrzemek)}` : 'drzemki', value: s.sr.drzemki || 0 },
          ]} />

          <div className="card" style={{ padding: 14 }}>
            {kicker(ile === 30 ? 'Długość snu noc po nocy' : 'Średnia długość snu tydzień po tygodniu', { marginBottom: 8 })}
            {ile === 30 ? (
              <LineAreaSVG
                data={s.dzienne.filter(x => x.maNoc).map(x => ({ label: format(new Date(x.d + 'T12:00:00'), 'd.MM'), value: Math.round((x.noc / 60) * 10) / 10 }))}
                height={140} min={3} max={11} yTicks={[4, 6, 8, 10]} accent="var(--info)"
                fmtValue={v => `${String(v).replace('.', ',')} h`} />
            ) : (
              <BarChartSVG data={s.tygodnie} height={130} accent="var(--info)" fmt={v => (v ? `${String(v).replace('.', ',')} h` : '')} />
            )}
          </div>

          <div className="card" style={{ padding: 14 }}>
            {kicker('Ile śpisz — liczba nocy', { marginBottom: 10 })}
            <Paski pozycje={s.kubelki.map((k, i) => ({
              klucz: k.k, nazwa: k.k, kolor: kolorKubelka[i], wartosc: k.n,
              opis: `${k.n}×`,
            }))} />
            {s.najdluzsza && s.najkrotsza && s.najdluzsza.d !== s.najkrotsza.d && (
              <p className="mood-note" style={{ margin: '10px 0 0' }}>
                Najdłużej: <b>{fmtCzas(s.najdluzsza.noc)}</b> ({dzienSl(s.najdluzsza.d)}) · najkrócej: <b>{fmtCzas(s.najkrotsza.noc)}</b> ({dzienSl(s.najkrotsza.d)})
              </p>
            )}
          </div>

          {s.nastrojWgSnu.length > 0 && (
            <div className="card" style={{ padding: 14 }}>
              {kicker('Nastrój po takiej nocy', { marginBottom: 10 })}
              <Paski pozycje={s.nastrojWgSnu.map(g => ({
                klucz: g.grupa, nazwa: g.grupa, kolor: kolorKubelka[KUBELKI_SNU.indexOf(g.grupa)], wartosc: to10(g.srednia),
                opis: `${fmt10(g.srednia)}/10`,
              }))} />
              <p className="mood-note" style={{ margin: '10px 0 0' }}>Średni nastrój (1–10) w dni po nocy danej długości.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function StatystykiCyklu({ okresy, moodLogs }) {
  const s = useMemo(() => {
    const stat = statystykiCyklu(okresy)
    const p = posortowane(okresy)
    const cykle = []
    for (let i = 1; i < p.length; i++) {
      const d = roznicaDni(p[i - 1].start, p[i].start)
      if (d >= 15 && d <= 60) cykle.push({ start: p[i - 1].start, dlugosc: d })
    }
    const okresyDl = p.filter(o => o.end && o.end >= o.start).map(o => roznicaDni(o.start, o.end) + 1).filter(d => d <= 14)
    const wgFaz = nastrojWGrupach(nastrojDni(moodLogs), d => fazaDnia(okresy, d, stat), KOLEJNOSC_FAZ)
    return { stat, cykle: cykle.slice(-12), okresyDl, wgFaz, liczbaOkresow: p.length }
  }, [okresy, moodLogs])

  if (!okresy.length) {
    return <div className="card an-pusty" style={{ padding: 14 }}>Brak zapisanych okresów. Zaznacz pierwszy w zakładce „Cykl”.</div>
  }

  const { stat } = s
  const zmiennosc = stat.najkrotszy !== null && stat.najdluzszy !== null ? stat.najdluzszy - stat.najkrotszy : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StatTiles tiles={[
        { label: stat.zDanych ? 'średni cykl' : 'cykl (domyślnie)', value: `${stat.dlugoscCyklu} dni`, color: FAZY.menstruacja.kolor },
        { label: 'średni okres', value: `${stat.dlugoscOkresu} dni` },
        { label: 'zapisane okresy', value: s.liczbaOkresow },
      ]} />

      {s.cykle.length > 0 && (
        <div className="card" style={{ padding: 14 }}>
          {kicker('Długość kolejnych cykli', { marginBottom: 8 })}
          <BarChartSVG data={s.cykle.map(c => ({ label: format(new Date(c.start + 'T12:00:00'), 'LLL', { locale: pl }), value: c.dlugosc }))}
            height={130} accent={FAZY.menstruacja.kolor} fmt={v => `${v} dni`} />
          {zmiennosc !== null && (
            <p className="mood-note" style={{ margin: '10px 0 0' }}>
              Ostatnie cykle: od <b>{stat.najkrotszy}</b> do <b>{stat.najdluzszy}</b> dni
              {zmiennosc <= 3 ? ' — bardzo regularnie.' : zmiennosc <= 7 ? ' — w normie wahań.' : ' — dość nieregularnie, prognoza jest mniej pewna.'}
            </p>
          )}
        </div>
      )}

      {s.wgFaz.length > 0 ? (
        <div className="card" style={{ padding: 14 }}>
          {kicker('Nastrój w fazach cyklu', { marginBottom: 10 })}
          <Paski pozycje={s.wgFaz.map(g => ({
            klucz: g.grupa, nazwa: FAZY[g.grupa].nazwa.toLowerCase(), kolor: FAZY[g.grupa].kolor, wartosc: to10(g.srednia),
            opis: g.dni >= MIN_DNI ? `${fmt10(g.srednia)}/10` : 'za mało dni',
          }))} />
          <p className="mood-note" style={{ margin: '10px 0 0' }}>Średni nastrój (1–10) z dni w każdej fazie. Wynik jest pewniejszy od {MIN_DNI} dni z wpisem.</p>
        </div>
      ) : (
        <div className="card an-pusty" style={{ padding: 14 }}>Gdy będą wpisy nastroju z dni po zapisanym okresie, zobaczysz tu nastrój w każdej fazie.</div>
      )}
    </div>
  )
}
