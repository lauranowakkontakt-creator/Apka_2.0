import { useState, useMemo, useRef } from 'react'
import { IconChevronLeft, IconChevronRight } from './Icons'
import { useMounted } from './ChartPrimitives'
import { MIESIACE_KROTKO, MIESIACE_PELNE, DNI_TYG_KROTKO, dniMiesiaca, zmiana, kluczDnia, lataZDanych, miesiaceRoku,
  podsumujMiesiace, miesiaceMinione, dniMinione, mapaDni, wgDniaTygodnia, najdluzszaSeria, doTegoDnia } from '../utils/analityka'

// Wspólne klocki analiz „miesiąc / rok" — jeden wygląd statystyk we wszystkich
// modułach. Liczenie siedzi w utils/analityka.js.
//
// Uwaga na dotyk: w main.css elementy z atrybutem `title` mają na ekranach
// dotykowych wyłączone zdarzenia. Klikalne komórki używają więc aria-label.

const czytaj = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1' } catch { return d } }
const zapisz = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0') } catch { /* tryb prywatny */ } }

/**
 * Rozwijana sekcja. Treść montuje się dopiero przy pierwszym otwarciu i potem
 * zostaje (zwijanie nie przelicza wykresów od nowa), więc długi ekran
 * statystyk nie zacina się przy wejściu. Stan otwarcia pamiętamy per `id`.
 */
export function Rozwijana({ id, tytul, podsumowanie, domyslnie = false, akcja, children }) {
  const klucz = `mw_rozw_${id}`
  const [open, setOpen] = useState(() => (id ? czytaj(klucz, domyslnie) : domyslnie))
  const zamontowana = useRef(open)
  if (open) zamontowana.current = true
  const toggle = () => setOpen(o => { const n = !o; if (id) zapisz(klucz, n); return n })
  return (
    <section className={`rozw${open ? ' open' : ''}`}>
      <div className="rozw-head">
        <button type="button" className="rozw-btn" onClick={toggle} aria-expanded={open}>
          <span className="rozw-title">{tytul}</span>
          {!open && podsumowanie != null && <span className="rozw-sum">{podsumowanie}</span>}
          <IconChevronRight size={15} className="rozw-chev" />
        </button>
        {open && akcja}
      </div>
      <div className="rozw-body" aria-hidden={!open}>
        <div className="rozw-inner">
          {zamontowana.current && <div className="rozw-content">{children}</div>}
        </div>
      </div>
    </section>
  )
}

/**
 * Sekcja zawsze rozwinięta — karta z tytułem. Używana w analizach Finansów,
 * gdzie wszystko ma być widać bez klikania. Przyjmuje te same propsy co
 * Rozwijana (id, podsumowanie, domyslnie są ignorowane), `szeroka` rozciąga
 * kartę na całą szerokość siatki `.an-grid`.
 */
export function Sekcja({ tytul, akcja, szeroka = false, children }) {
  return (
    <section className={`sek${szeroka ? ' wide' : ''}`}>
      <div className="sek-head">
        <span className="sek-title">{tytul}</span>
        {akcja}
      </div>
      <div className="sek-body">{children}</div>
    </section>
  )
}

/** Przełącznik roku ze strzałkami. `lata` od najnowszego. */
export function WyborRoku({ lata, rok, onChange }) {
  const i = lata.indexOf(rok)
  return (
    <div className="an-rok">
      <button type="button" className="icon-btn" disabled={i < 0 || i >= lata.length - 1}
        onClick={() => onChange(lata[i + 1])} aria-label="Poprzedni rok"><IconChevronLeft size={16} /></button>
      <span className="an-rok-val">{rok}</span>
      <button type="button" className="icon-btn" disabled={i <= 0}
        onClick={() => onChange(lata[i - 1])} aria-label="Następny rok"><IconChevronRight size={16} /></button>
    </div>
  )
}

/** Mała plakietka zmiany: ↑ 12% / ↓ 8%. `odwrotnie` — gdy wzrost jest zły (np. wydatki). */
export function Delta({ pct, odwrotnie = false, wzgledem }) {
  if (pct === null || pct === undefined) return null
  const dobrze = odwrotnie ? pct < 0 : pct > 0
  const cls = pct === 0 ? 'zero' : dobrze ? 'up' : 'down'
  return (
    <span className={`an-delta ${cls}`}>
      {pct > 0 ? '↑' : pct < 0 ? '↓' : '='} {Math.abs(pct)}%{wzgledem ? <span className="an-delta-vs"> vs {wzgledem}</span> : null}
    </span>
  )
}

/** Siatka kafli: [{ label, value, sub?, color?, delta?: { pct, odwrotnie, wzgledem } }] */
export function Kafle({ items, min = 140 }) {
  return (
    <div className="an-kafle" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))` }}>
      {items.filter(Boolean).map((k, i) => (
        <div key={i} className="an-kafel">
          <div className="an-kafel-label">{k.label}</div>
          <div className="an-kafel-val" style={k.color ? { color: k.color } : undefined}>{k.value}</div>
          {(k.sub || k.delta) && (
            <div className="an-kafel-sub">
              {k.delta && <Delta {...k.delta} />}
              {k.sub && <span>{k.sub}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * 12 miesięcy roku jako słupki, z cieniem poprzedniego roku za każdym słupkiem.
 * Dotknięcie miesiąca pokazuje jego liczby w nagłówku (bez dymków, które
 * nachodziły na siebie). Przyszłe miesiące są wyszarzone; `trwajacy` (indeks
 * bieżącego miesiąca) wyłącza dla niego procent zmiany.
 */
export function MiesiaceRoku({ wartosci, poprzedni, rok, kolor = 'var(--accent)', fmt = (v) => String(Math.round(v)),
  odwrotnie = false, minione = 12, wybrany, onWybierz, trwajacy = null }) {
  const on = useMounted(80)
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...wartosci, ...(poprzedni || [0])) * 1.08
  const aktywny = hover ?? wybrany ?? (minione > 0 ? minione - 1 : 0)
  const v = wartosci[aktywny] ?? 0
  const p = poprzedni?.[aktywny]
  // Trwający miesiąc nie jest jeszcze porównywalny z pełnym miesiącem rok temu.
  const pct = poprzedni && aktywny !== trwajacy ? zmiana(v, p) : null
  return (
    <div className="an-mies">
      <div className="an-mies-cap">
        <span className="an-mies-cap-m">{MIESIACE_PELNE[aktywny]} {rok}</span>
        <span className="an-mies-cap-v" style={{ color: kolor }}>{fmt(v)}</span>
        {poprzedni && p > 0 && <span className="an-mies-cap-p">{rok - 1}: {fmt(p)}</span>}
        <Delta pct={pct} odwrotnie={odwrotnie} />
        {aktywny === trwajacy && <span className="an-mies-cap-p">· miesiąc trwa</span>}
      </div>
      <div className="an-mies-bars">
        {wartosci.map((val, i) => {
          const przyszly = i >= minione
          const akt = i === aktywny
          return (
            <button type="button" key={i} className={`an-mies-col${akt ? ' akt' : ''}${przyszly ? ' fut' : ''}`}
              aria-label={`${MIESIACE_PELNE[i]}: ${fmt(val)}`}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onClick={() => onWybierz?.(i === wybrany ? null : i)}>
              <div className="an-mies-track">
                {poprzedni && <div className="an-mies-ghost" style={{ height: on ? `${(poprzedni[i] / max) * 100}%` : 0 }} />}
                <div className="an-mies-bar" style={{
                  height: on ? `${(val / max) * 100}%` : 0,
                  background: akt ? kolor : `color-mix(in oklab, ${kolor} 50%, var(--surface3))`,
                  transitionDelay: `${i * 0.03}s`,
                }} />
              </div>
              <span className="an-mies-lbl">{MIESIACE_KROTKO[i]}</span>
            </button>
          )
        })}
      </div>
      {poprzedni && (
        <div className="an-legenda">
          <span><i style={{ background: kolor }} />{rok}</span>
          <span><i className="ghost" />{rok - 1}</span>
        </div>
      )}
    </div>
  )
}

/**
 * „Rok w pikselach": 12 wierszy (miesiące) × 31 kolumn (dni). Kolor dnia daje
 * `kolorDnia(klucz)` (null = brak wpisu). Dotknięcie dnia pokazuje `opisDnia`.
 */
export function RokWPikselach({ rok, kolorDnia, opisDnia, legenda, dzis }) {
  const [sel, setSel] = useState(null)
  const wiersze = useMemo(() => Array.from({ length: 12 }, (_, m) => {
    const n = dniMiesiaca(rok, m)
    return Array.from({ length: 31 }, (_, d) => {
      if (d >= n) return null
      const k = `${rok}-${String(m + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`
      return { k, c: kolorDnia(k), fut: dzis && k > dzis }
    })
  }), [rok, kolorDnia, dzis])
  const fmtDzien = (k) => { const [, m, d] = k.split('-').map(Number); return `${d} ${MIESIACE_KROTKO[m - 1]} ${rok}` }
  return (
    <div className="an-pix">
      <div className="an-pix-grid">
        <span />
        {Array.from({ length: 31 }, (_, d) => <span key={d} className="an-pix-dnum">{(d + 1) % 5 === 0 || d === 0 ? d + 1 : ''}</span>)}
        {wiersze.map((row, m) => [
          <span key={`l${m}`} className="an-pix-mlbl">{MIESIACE_KROTKO[m]}</span>,
          ...row.map((c, d) => c === null
            ? <span key={`${m}-${d}`} className="an-pix-cell none" />
            : <button type="button" key={c.k} aria-label={fmtDzien(c.k)}
                className={`an-pix-cell${c.fut ? ' fut' : ''}${c.k === dzis ? ' today' : ''}${sel === c.k ? ' sel' : ''}`}
                style={c.c ? { background: c.c } : undefined}
                onClick={() => setSel(s => s === c.k ? null : c.k)} />),
        ])}
      </div>
      <div className="an-pix-foot">
        <span className="an-pix-info">{sel ? <><b>{fmtDzien(sel)}</b> · {opisDnia ? opisDnia(sel) : ''}</> : 'Dotknij dnia, by zobaczyć szczegóły'}</span>
        {legenda && <span className="an-legenda">{legenda.map(([c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</span>}
      </div>
    </div>
  )
}

/** Rozkład na dni tygodnia (pn–nd), najmocniejszy dzień podświetlony. */
export function DniTygodnia({ wartosci, kolor = 'var(--accent)', fmt = (v) => String(Math.round(v)) }) {
  const max = Math.max(1, ...wartosci)
  const top = wartosci.indexOf(Math.max(...wartosci))
  return (
    <div className="an-dt">
      {wartosci.map((v, i) => (
        <div key={i} className={`an-dt-col${i === top && v > 0 ? ' top' : ''}`}>
          <span className="an-dt-v">{v > 0 ? fmt(v) : ''}</span>
          <div className="an-dt-track"><div className="an-dt-bar" style={{ height: `${(v / max) * 100}%`, background: i === top ? kolor : `color-mix(in oklab, ${kolor} 40%, var(--surface3))` }} /></div>
          <span className="an-dt-lbl">{DNI_TYG_KROTKO[i]}</span>
        </div>
      ))}
    </div>
  )
}

/** Ranking z paskami udziału: [{ nazwa, wartosc, kolor?, sub?, delta? }]. */
export function Ranking({ pozycje, fmt = (v) => String(Math.round(v)), limit = 6, pusty = 'Brak danych' }) {
  const [wszystko, setWszystko] = useState(false)
  if (!pozycje.length) return <div className="an-pusty">{pusty}</div>
  const suma = pozycje.reduce((s, p) => s + p.wartosc, 0) || 1
  const max = Math.max(...pozycje.map(p => p.wartosc)) || 1
  const lista = wszystko ? pozycje : pozycje.slice(0, limit)
  return (
    <div className="an-rank">
      {lista.map((p, i) => (
        <div key={p.nazwa + i} className="an-rank-row">
          <div className="an-rank-top">
            <span className="an-rank-name"><i style={{ background: p.kolor || 'var(--accent)' }} />{p.nazwa}</span>
            <span className="an-rank-val">{fmt(p.wartosc)} <small>{Math.round((p.wartosc / suma) * 100)}%</small></span>
          </div>
          <div className="an-rank-track"><div style={{ width: `${(p.wartosc / max) * 100}%`, background: p.kolor || 'var(--accent)' }} /></div>
          {(p.sub || p.delta) && <div className="an-rank-sub">{p.delta && <Delta {...p.delta} />}{p.sub}</div>}
        </div>
      ))}
      {pozycje.length > limit && (
        <button type="button" className="an-more" onClick={() => setWszystko(v => !v)}>
          {wszystko ? 'Pokaż mniej' : `Pokaż wszystkie (${pozycje.length})`}
        </button>
      )}
    </div>
  )
}

/**
 * Gotowy blok „rok w liczbach" dla modułów liczących wpisy po dniach
 * (nawyki, modlitwa, sny, wdzięczność, zadania). Rozwijane sekcje:
 * podsumowanie roku, miesiąc po miesiącu, rok w pikselach, dni tygodnia.
 *
 * wpisy:     [{ klucz: 'yyyy-MM-dd', wartosc? }] — jeden wpis = jedno zdarzenie
 * jednostka: [1, 2–4, 5+] np. ['sen', 'sny', 'snów']
 * kolorDnia: (klucz, liczba) => kolor | null — domyślnie odcienie akcentu
 * dodatkoweKafle: (rok) => [...] — kafle specyficzne dla modułu
 * children:  (rok) => dodatkowe sekcje modułu (np. ranking)
 */
export function AnalizaRoku({ id, wpisy, jednostka = ['wpis', 'wpisy', 'wpisów'], kolor = 'var(--accent)', kolorDnia, opisDnia,
  legenda, dodatkoweKafle, children, tytulDni = 'Dni z wpisem' }) {
  const teraz = new Date()
  const dzis = kluczDnia(teraz)
  const lata = useMemo(() => lataZDanych(wpisy.map(w => w.klucz), teraz), [wpisy]) // eslint-disable-line react-hooks/exhaustive-deps
  const [rok, setRok] = useState(lata[0])
  const odm = (n) => { const a = Math.abs(n) % 100, b = a % 10; return n === 1 ? jednostka[0] : (b >= 2 && b <= 4 && (a < 12 || a > 14)) ? jednostka[1] : jednostka[2] }

  const d = useMemo(() => {
    const mies = miesiaceRoku(wpisy, rok)
    const prev = miesiaceRoku(wpisy, rok - 1)
    const pods = podsumujMiesiace(mies, rok, teraz)
    const mapa = mapaDni(wpisy.filter(w => w.klucz?.startsWith(String(rok))))
    const dniZ = mapa.size
    const minioneDni = dniMinione(rok, teraz)
    const trwa = rok === teraz.getFullYear()
    const prevOkres = trwa ? doTegoDnia(wpisy, rok - 1, teraz) : prev.reduce((a, b) => a + b, 0)
    return {
      mies, prev, pods, mapa, dniZ, minioneDni, trwa, prevOkres,
      maPoprzedni: prev.some(v => v > 0),
      seria: najdluzszaSeria([...mapa.keys()]),
      tydz: wgDniaTygodnia(wpisy.filter(w => w.klucz?.startsWith(String(rok)))),
      maxDzien: Math.max(1, ...mapa.values()),
    }
  }, [wpisy, rok]) // eslint-disable-line react-hooks/exhaustive-deps

  const domyslnyKolor = (k) => {
    const n = d.mapa.get(k)
    if (!n) return null
    const lvl = Math.min(1, n / d.maxDzien)
    return `color-mix(in oklab, ${kolor} ${Math.round(45 + lvl * 55)}%, var(--surface3))`
  }
  const kd = kolorDnia ? (k) => kolorDnia(k, d.mapa.get(k) || 0) : domyslnyKolor
  const fmtN = (v) => (Math.round(v * 10) / 10).toLocaleString('pl-PL')
  const vs = rok - 1
  const minM = miesiaceMinione(rok, teraz)

  return (
    <div className="an-stack">
      <WyborRoku lata={lata} rok={rok} onChange={setRok} />
      <Kafle items={[
        { label: `W roku ${rok}`, value: `${d.pods.suma.toLocaleString('pl-PL')}`, sub: odm(d.pods.suma),
          delta: d.maPoprzedni ? { pct: zmiana(d.pods.suma, d.prevOkres), wzgledem: vs } : null },
        { label: 'Średnio / miesiąc', value: fmtN(d.pods.srednia), sub: minM ? `z ${minM} mies.` : null },
        { label: tytulDni, value: `${d.dniZ}`, sub: d.minioneDni ? `${Math.round((d.dniZ / d.minioneDni) * 100)}% dni roku` : null },
        { label: 'Najlepszy miesiąc', value: d.pods.najlepszy !== null ? MIESIACE_PELNE[d.pods.najlepszy] : '—', sub: d.pods.najlepszy !== null ? `${d.mies[d.pods.najlepszy]} ${odm(d.mies[d.pods.najlepszy])}` : null },
        { label: 'Najdłuższa seria', value: `${d.seria}`, sub: d.seria === 1 ? 'dzień z rzędu' : 'dni z rzędu' },
        ...(dodatkoweKafle ? dodatkoweKafle(rok) : []),
      ]} />
      {d.trwa && d.maPoprzedni && <p className="an-note" style={{ marginTop: -4 }}>Porównanie z {rok - 1} dotyczy tego samego okresu (1 stycznia – dziś).</p>}

      <Rozwijana id={`${id}-mies`} tytul="Miesiąc po miesiącu" domyslnie
        podsumowanie={`${MIESIACE_KROTKO[Math.max(0, minM - 1)]}: ${d.mies[Math.max(0, minM - 1)] || 0}`}>
        <MiesiaceRoku rok={rok} wartosci={d.mies} poprzedni={d.maPoprzedni ? d.prev : null} kolor={kolor}
          minione={minM} trwajacy={d.trwa ? minM - 1 : null} fmt={(v) => `${Math.round(v)} ${odm(Math.round(v))}`} />
      </Rozwijana>

      <Rozwijana id={`${id}-pix`} tytul="Rok w pikselach" podsumowanie={`${d.dniZ} dni`}>
        <RokWPikselach rok={rok} dzis={dzis} kolorDnia={kd} legenda={legenda}
          opisDnia={opisDnia || ((k) => { const n = d.mapa.get(k) || 0; return n ? `${n} ${odm(n)}` : 'brak wpisu' })} />
      </Rozwijana>

      <Rozwijana id={`${id}-dt`} tytul="Dni tygodnia"
        podsumowanie={d.tydz.some(v => v > 0) ? `najczęściej: ${DNI_TYG_KROTKO[d.tydz.indexOf(Math.max(...d.tydz))]}` : null}>
        <DniTygodnia wartosci={d.tydz} kolor={kolor} />
      </Rozwijana>

      {children && children(rok)}
    </div>
  )
}

/**
 * Wykres kołowy (donut) z legendą. Dotknięcie wycinka albo pozycji z listy
 * wybiera kategorię: środek koła pokazuje jej kwotę i udział, a pod spodem
 * rozwijają się szczegóły z `szczegoly(pozycja)`. Drobne pozycje ponad `limit`
 * łączą się w „Pozostałe”, żeby koło zostało czytelne.
 *
 * pozycje: [{ nazwa, wartosc, kolor, delta? }] — od największej
 */
export function DonutSzczegoly({ pozycje, fmt = (v) => String(Math.round(v)), szczegoly, limit = 7, rozmiar = 210, grubosc = 30, srodek = 'Razem', pusty = 'Brak danych', legenda = 'lista' }) {
  const on = useMounted(100)
  const [sel, setSel] = useState(null)
  const [hover, setHover] = useState(null)
  const dane = useMemo(() => {
    if (pozycje.length <= limit + 1) return pozycje
    const reszta = pozycje.slice(limit)
    return [...pozycje.slice(0, limit), {
      nazwa: 'Pozostałe', wartosc: reszta.reduce((s, p) => s + p.wartosc, 0), kolor: '#6B7088', grupa: reszta,
    }]
  }, [pozycje, limit])
  if (!dane.length) return <div className="an-pusty">{pusty}</div>
  const suma = dane.reduce((s, p) => s + p.wartosc, 0) || 1
  const r = (rozmiar - grubosc) / 2 - 4
  const C = 2 * Math.PI * r
  const przerwa = dane.length > 1 ? Math.min(0.012 * C, 4) : 0
  let acc = 0
  const segs = dane.map((p, i) => {
    const frac = p.wartosc / suma
    const len = Math.max(0.5, frac * C - przerwa)
    const s = { ...p, i, frac, len, offset: -acc * C }
    acc += frac
    return s
  })
  const akt = hover ?? sel
  const pokaz = akt !== null ? dane[akt] : null
  const wybor = (i) => setSel(s => s === i ? null : i)
  const wybrana = sel !== null ? dane[sel] : null
  return (
    <div className="an-donut">
      <div className="an-donut-top">
        <div className="an-donut-svg" style={{ width: rozmiar, height: rozmiar }}>
          <svg width={rozmiar} height={rozmiar} viewBox={`0 0 ${rozmiar} ${rozmiar}`} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={rozmiar / 2} cy={rozmiar / 2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={grubosc} opacity={0.45} />
            {segs.map(s => (
              <circle key={s.i} cx={rozmiar / 2} cy={rozmiar / 2} r={r} fill="none" stroke={s.kolor}
                strokeWidth={akt === s.i ? grubosc + 8 : grubosc}
                strokeDasharray={on ? `${s.len} ${C - s.len}` : `0 ${C}`} strokeDashoffset={s.offset}
                opacity={akt === null || akt === s.i ? 1 : 0.35}
                onMouseEnter={() => setHover(s.i)} onMouseLeave={() => setHover(null)} onClick={() => wybor(s.i)}
                style={{ cursor: 'pointer', transition: `stroke-dasharray .8s var(--ease) ${s.i * 0.05}s, stroke-width .2s, opacity .2s` }} />
            ))}
          </svg>
          <div className="an-donut-center">
            {pokaz ? (
              <>
                <span className="an-donut-c1">{pokaz.nazwa}</span>
                <span className="an-donut-c2" style={{ color: pokaz.kolor }}>{fmt(pokaz.wartosc)}</span>
                <span className="an-donut-c3">{Math.round((pokaz.wartosc / suma) * 1000) / 10}%</span>
              </>
            ) : (
              <>
                <span className="an-donut-c1">{srodek}</span>
                <span className="an-donut-c2">{fmt(suma)}</span>
                <span className="an-donut-c3">dotknij wycinka</span>
              </>
            )}
          </div>
        </div>
        {legenda === 'chipy' ? (
          <div className="an-donut-chips">
            {dane.map((p, i) => (
              <button type="button" key={p.nazwa + i} className={`an-chip${sel === i ? ' sel' : ''}${akt !== null && akt !== i ? ' dim' : ''}`}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => wybor(i)}>
                <i style={{ background: p.kolor }} />{p.nazwa}<b>{Math.round((p.wartosc / suma) * 100)}%</b>
              </button>
            ))}
          </div>
        ) : (
        <div className="an-donut-leg">
          {dane.map((p, i) => (
            <button type="button" key={p.nazwa + i} className={`an-donut-row${sel === i ? ' sel' : ''}${akt !== null && akt !== i ? ' dim' : ''}`}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => wybor(i)}>
              <i style={{ background: p.kolor }} />
              <span className="an-donut-name">{p.nazwa}</span>
              <span className="an-donut-val">{fmt(p.wartosc)}</span>
              <span className="an-donut-pct">{Math.round((p.wartosc / suma) * 100)}%</span>
            </button>
          ))}
        </div>
        )}
      </div>
      {wybrana && (
        <div className="an-donut-det" key={wybrana.nazwa} style={{ '--det-color': wybrana.kolor }}>
          <div className="an-donut-det-head">
            <span className="an-donut-det-name"><i style={{ background: wybrana.kolor }} />{wybrana.nazwa}</span>
            <button type="button" className="an-donut-det-x" onClick={() => setSel(null)} aria-label="Zamknij szczegóły">×</button>
          </div>
          {wybrana.grupa
            ? <Ranking pozycje={wybrana.grupa} fmt={fmt} limit={20} />
            : szczegoly ? szczegoly(wybrana) : null}
        </div>
      )}
    </div>
  )
}

/**
 * Tabela „pozycja × lata" (np. kategorie albo rodzaje snów w kolejnych latach)
 * z sumą na końcu. `dane` pochodzi z rozbijWgLat. Przy wielu latach tabela
 * przewija się poziomo, a pierwsza kolumna zostaje na miejscu.
 */
export function TabelaLat({ dane, fmt = (v) => String(Math.round(v)), limit = 10, kolory = {}, pusty = 'Brak danych' }) {
  const [wszystko, setWszystko] = useState(false)
  if (!dane.wiersze.length) return <div className="an-pusty">{pusty}</div>
  const lista = wszystko ? dane.wiersze : dane.wiersze.slice(0, limit)
  const sumyLat = dane.lata.map(r => dane.wiersze.reduce((s, w) => s + (w.poLatach[r] || 0), 0))
  const razem = sumyLat.reduce((a, b) => a + b, 0)
  return (
    <div className="an-lata-wrap">
      <table className="an-tabela an-tabela-lata">
        <thead><tr><th></th>{dane.lata.map(r => <th key={r}>{r}</th>)}<th>Razem</th></tr></thead>
        <tbody>
          {lista.map(w => (
            <tr key={w.nazwa}>
              <td><i className="an-lata-dot" style={{ background: kolory[w.nazwa] || 'var(--accent)' }} />{w.nazwa}</td>
              {dane.lata.map(r => <td key={r} style={w.poLatach[r] ? undefined : { color: 'var(--text-muted)' }}>{w.poLatach[r] ? fmt(w.poLatach[r]) : '·'}</td>)}
              <td style={{ fontWeight: 700 }}>{fmt(w.suma)}</td>
            </tr>
          ))}
          <tr className="an-lata-sum">
            <td>Razem</td>{sumyLat.map((v, i) => <td key={i}>{fmt(v)}</td>)}<td>{fmt(razem)}</td>
          </tr>
        </tbody>
      </table>
      {dane.wiersze.length > limit && (
        <button type="button" className="an-more" onClick={() => setWszystko(v => !v)}>
          {wszystko ? 'Pokaż mniej' : `Pokaż wszystkie (${dane.wiersze.length})`}
        </button>
      )}
    </div>
  )
}
