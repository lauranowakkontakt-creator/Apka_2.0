import { db } from '../../firebase/config'
import { zapiszWiele } from '../../firebase/lite'
import {
  parseDreamFile, planDreamImport, planRelink, suggestNewPeople, suggestSymbols, withAliases,
} from '../../utils/dreamImport'
import { SYMBOL_COLORS } from '../../utils/dreams'
import { applyAutoTags, autoSymbolHint } from '../../utils/dreamAutoTags'
import { PERSON_COLORS } from '../../utils/personColors'
import { log } from '../../utils/logger'
import { wPaczkach } from '../../utils/zapisWPaczkach'
import { toast } from '../Toast'
import { collection, getDocs } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'

// Import snów z pliku (Dreamy, kopia z tej apki, ogólna lista JSON) oraz dopasowanie
// osób i symboli w snach, które już są. Wzorowane na imporcie budżetu: najpierw plan
// i podgląd, zapis dopiero po kliknięciu, nic nie jest nadpisywane ani usuwane.

const hint = { margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }
const section = { fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.16em', textTransform: 'uppercase', margin: '6px 2px 0' }
const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 'var(--r-sm)', fontSize: 13 }

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function Check({ checked, onChange, children, sub }) {
  return (
    <label style={{ ...rowStyle, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span style={{ flex: 1, minWidth: 0 }}>{children}{sub && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{sub}</span>}</span>
    </label>
  )
}

export default function DreamImport({ user, onDone }) {
  const [base, setBase] = useState(null)         // { people, symbols, dreams }
  const [loadErr, setLoadErr] = useState('')
  const [mode, setMode] = useState('file')       // file | import | relink
  const [file, setFile] = useState(null)         // { name, parsed }
  const [error, setError] = useState('')
  const [tag, setTag] = useState(true)
  const [autoOn, setAutoOn] = useState(true)   // uzupełniaj brakujące oznaczenia (symbole, emocje, kategoria)
  const [peopleOff, setPeopleOff] = useState(() => new Set())
  const [choices, setChoices] = useState({})     // słowo (mała litera) → id osoby
  const [newPeople, setNewPeople] = useState({}) // rdzeń nazwy → { on, name }
  const [symbolOn, setSymbolOn] = useState(() => new Set())
  const [progress, setProgress] = useState(null)
  const [waiting, setWaiting] = useState(null)

  useEffect(() => {
    let alive = true
    const b = ['users', user.uid]
    Promise.all(['calendarPeople', 'dreamSymbols', 'dreams', 'dreamCategories'].map(c => getDocs(collection(db, ...b, c))))
      .then(([p, s, d, c]) => {
        if (!alive) return
        setBase({
          people: p.docs.map(x => ({ id: x.id, ...x.data() })),
          symbols: s.docs.map(x => ({ id: x.id, ...x.data() })),
          dreams: d.docs.map(x => ({ id: x.id, ...x.data() })),
          categories: c.docs.map(x => ({ id: x.id, ...x.data() })),
        })
      })
      .catch(e => alive && setLoadErr(`Nie udało się wczytać danych (${e?.code || e?.name || 'błąd'}). Sprawdź połączenie i spróbuj ponownie.`))
    return () => { alive = false }
  }, [user.uid])

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const parsed = parseDreamFile(await f.text())
    if (parsed.error) { setError(parsed.error); return }
    setError(''); setFile({ name: f.name, parsed }); setMode('import')
    setPeopleOff(new Set()); setChoices({}); setNewPeople({}); setSymbolOn(new Set())
  }

  // Osoby i symbole podane w pliku. Osoba o tej samej nazwie co już istniejąca dostaje tylko brakujące ksywki;
  // pozostałe są dodawane. Symbol o istniejącej nazwie jest pomijany.
  const fromFile = useMemo(() => {
    if (!base || !file) return { newPeople: [], aliasUpdates: [], newSymbols: [], newCategories: [], peopleBase: base?.people || [] }
    const byName = new Map(base.people.map(p => [(p.name || '').toLowerCase(), p]))
    const newPeople = [], aliasUpdates = []
    let peopleBase = base.people
    file.parsed.people.forEach((fp, i) => {
      const ex = byName.get(fp.name.toLowerCase())
      if (ex) {
        const have = new Set((ex.aliases || []).map(a => a.toLowerCase()))
        const add = fp.aliases.filter(a => !have.has(a.toLowerCase()))
        if (add.length) {
          aliasUpdates.push({ id: ex.id, aliases: [...(ex.aliases || []), ...add] })
          peopleBase = peopleBase.map(p => p.id === ex.id ? { ...p, aliases: [...(p.aliases || []), ...add] } : p)
        }
      } else {
        newPeople.push({ id: `imp-person-${slug(fp.name)}`, name: fp.name, aliases: fp.aliases, note: fp.note,
          color: fp.color || PERSON_COLORS[(i * 7 + fp.name.length) % PERSON_COLORS.length], isNew: true })
      }
    })
    const haveSym = new Set(base.symbols.map(x => (x.name || '').toLowerCase()))
    const newSymbols = file.parsed.symbols.filter(x => !haveSym.has(x.name.toLowerCase()))
      .map((x, i) => ({ id: `imp-sym-${slug(x.name)}`, name: x.name, meaning: x.meaning, color: x.color || SYMBOL_COLORS[i % SYMBOL_COLORS.length], isNew: true }))
    const haveCat = new Set((base.categories || []).map(x => (x.label || x.name || '').toLowerCase()))
    const newCategories = file.parsed.categories.filter(x => !haveCat.has(x.name.toLowerCase()))
      .map((x, i) => ({ id: `imp-cat-${slug(x.name)}`, label: x.name, color: x.color || SYMBOL_COLORS[i % SYMBOL_COLORS.length] }))
    return { newPeople, aliasUpdates, newSymbols, newCategories, peopleBase: [...peopleBase, ...newPeople] }
  }, [base, file])

  // Kandydaci z samego pliku (liczone raz po wczytaniu).
  const texts = useMemo(() => file?.parsed.dreams.map(d => d.text) || [], [file])
  const candPeople = useMemo(() => base && file ? suggestNewPeople(texts, fromFile.peopleBase, { exclude: [...base.symbols, ...fromFile.newSymbols].map(x => x.name) }) : [], [base, file, texts, fromFile])
  const candSymbols = useMemo(() => base && file ? suggestSymbols(texts, { people: fromFile.peopleBase, symbols: [...base.symbols, ...fromFile.newSymbols] }) : [], [base, file, texts, fromFile])

  // Osoby i symbole wybrane do importu (nowe dostają stałe id, żeby ponowny import trafiał w te same dokumenty).
  const chosenNewPeople = useMemo(() => candPeople
    .filter(c => newPeople[c.name]?.on && (newPeople[c.name].name || c.name).trim())
    .map((c, i) => {
      const name = (newPeople[c.name].name || c.name).trim()
      return { id: `imp-person-${slug(name)}`, name, aliases: c.forms.filter(f => f.toLowerCase() !== name.toLowerCase()),
        color: PERSON_COLORS[(i * 7 + name.length) % PERSON_COLORS.length], isNew: true }
    }), [candPeople, newPeople])
  const chosenNewSymbols = useMemo(() => candSymbols.filter(c => symbolOn.has(c.word))
    .map((c, i) => ({ id: `imp-sym-${slug(c.word)}`, name: c.word, color: SYMBOL_COLORS[i % SYMBOL_COLORS.length], isNew: true })), [candSymbols, symbolOn])

  const peopleUse = useMemo(() => {
    if (!base) return []
    const all = [...fromFile.peopleBase.filter(p => !peopleOff.has(p.id)), ...chosenNewPeople]
    return withAliases(all, choices)
  }, [base, fromFile, peopleOff, chosenNewPeople, choices])
  const symbolsUse = useMemo(() => base ? [...base.symbols, ...fromFile.newSymbols, ...chosenNewSymbols] : [], [base, fromFile, chosenNewSymbols])

  // Sny bez własnych tagów dostają symbole, emocje i kategorię; Twoje tagi zostają nietknięte.
  const prepared = useMemo(() => {
    if (!file) return { dreams: [], usedSymbols: [], filled: 0 }
    return autoOn ? applyAutoTags(file.parsed.dreams) : { dreams: file.parsed.dreams, usedSymbols: [], filled: 0 }
  }, [file, autoOn])
  const autoNewSymbols = useMemo(() => {
    if (!base) return []
    const have = new Set([...base.symbols, ...fromFile.newSymbols, ...chosenNewSymbols].map(x => (x.name || '').toLowerCase()))
    return prepared.usedSymbols.filter(n => !have.has(n.toLowerCase()))
      .map((n, i) => ({ id: `imp-sym-${slug(n)}`, name: n, meaning: autoSymbolHint(n), color: SYMBOL_COLORS[i % SYMBOL_COLORS.length], isNew: true, auto: true }))
  }, [base, fromFile, chosenNewSymbols, prepared])
  const symbolsAll = useMemo(() => [...symbolsUse, ...autoNewSymbols], [symbolsUse, autoNewSymbols])

  const importPlan = useMemo(() => mode === 'import' && base && file
    ? planDreamImport({ dreams: prepared.dreams, existing: base.dreams, people: peopleUse, symbols: symbolsAll, categories: [...(base.categories || []).map(x => ({ id: x.id, label: x.label || x.name })), ...fromFile.newCategories], options: { tag } })
    : null, [mode, base, file, prepared, peopleUse, symbolsAll, fromFile, tag])
  const relinkPlan = useMemo(() => mode === 'relink' && base
    ? planRelink({ dreams: base.dreams, people: peopleUse, symbols: base.symbols, options: { tag } })
    : null, [mode, base, peopleUse, tag])

  const nameOf = (id) => peopleUse.find(p => p.id === id)?.name || '—'
  const colorOf = (id) => peopleUse.find(p => p.id === id)?.color || 'var(--accent)'

  const run = async () => {
    setError(''); setWaiting(null)
    const b = ['users', user.uid]
    const now = new Date()
    const writes = []
    const perPerson = importPlan?.perPerson || relinkPlan?.perPerson || {}
    // Osoby i symbole podane w pliku zapisujemy zawsze; zaznaczone podpowiedzi tylko, gdy coś do nich trafiło.
    if (importPlan) {
      for (const p of fromFile.newPeople) writes.push({ path: [...b, 'calendarPeople', p.id], data: { name: p.name, note: p.note || '', info: '', icon: 'IcUsers', color: p.color, aliases: p.aliases, createdAt: now, updatedAt: now } })
      for (const u of fromFile.aliasUpdates) writes.push({ path: [...b, 'calendarPeople', u.id], data: { aliases: u.aliases }, merge: true })
      for (const x of fromFile.newCategories) writes.push({ path: [...b, 'dreamCategories', x.id], data: { label: x.label, color: x.color, createdAt: now } })
      for (const x of fromFile.newSymbols) writes.push({ path: [...b, 'dreamSymbols', x.id], data: { name: x.name, color: x.color, ...(x.meaning ? { meaning: x.meaning } : {}), createdAt: now } })
    }
    // Nowe osoby i symbole z podpowiedzi zapisujemy tylko wtedy, gdy faktycznie coś do nich trafiło.
    for (const p of chosenNewPeople) if (perPerson[p.id]) writes.push({ path: [...b, 'calendarPeople', p.id], data: { name: p.name, note: '', info: '', icon: 'IcUsers', color: p.color, aliases: p.aliases, createdAt: now, updatedAt: now } })
    for (const s of [...chosenNewSymbols, ...autoNewSymbols]) if (importPlan?.perSymbol[s.id]) writes.push({ path: [...b, 'dreamSymbols', s.id], data: { name: s.name, color: s.color, ...(s.meaning ? { meaning: s.meaning } : {}), createdAt: now } })
    // Odmiana wskazana w pytaniach o niejednoznaczne słowa → zapamiętana jako ksywka osoby.
    const aliasById = {}
    for (const [form, id] of Object.entries(choices)) if (id && base.people.some(p => p.id === id)) (aliasById[id] ||= []).push(form)
    for (const [id, forms] of Object.entries(aliasById)) {
      const cur = base.people.find(p => p.id === id)?.aliases || []
      writes.push({ path: [...b, 'calendarPeople', id], data: { aliases: [...new Set([...cur, ...forms])] }, merge: true })
    }
    const total0 = writes.length
    if (importPlan) for (const d of importPlan.toAdd) writes.push({ path: [...b, 'dreams', d.id], data: { ...d.data, createdAt: now, updatedAt: now } })
    if (relinkPlan) for (const u of relinkPlan.updates) writes.push({ path: [...b, 'dreams', u.id], data: { ...u.data, updatedAt: now }, merge: true })
    const total = writes.length - total0
    setProgress({ done: 0, total })
    try {
      await zapiszWiele(writes, {
        wPaczkach,
        onProgress: (d) => { setWaiting(null); setProgress({ done: Math.max(0, d - total0), total }) },
        onWait: (code, proba) => { setWaiting({ proba, code }); log.warn('import', 'paczka zapisu ponawiana', { code, proba }) },
      })
      toast.success(importPlan ? `Zaimportowano ${total} snów` : `Zaktualizowano ${total} snów`)
      onDone()
    } catch (e) {
      log.blad('import', 'Import snów nie powiódł się', e)
      const code = e?.code || 'błąd'
      setError(code === 'resource-exhausted'
        ? 'Firebase odrzuca zapisy: wyczerpany dzienny limit darmowego planu (resource-exhausted). Spróbuj jutro, dopisze tylko brakujące.'
        : `Import przerwany (${code}). To, co się zapisało, zostaje. Uruchom import jeszcze raz, a dopisze tylko brakujące.`)
      setProgress(null); setWaiting(null)
    }
  }

  if (loadErr) return <div className="form"><p className="form-error">{loadErr}</p></div>
  if (!base) return <div className="list-loading">Wczytuję dane…</div>
  const busy = !!progress

  if (mode === 'file') {
    return (
      <div className="form">
        <p className="imp-hint">
          Wgraj plik JSON ze snami. Rozumiem eksport z <b>Dreamy</b>, kopię z tej apki (pole <code>dreams</code>) i zwykłą listę snów
          z polami tytuł, data i treść. Treść zostaje taka, jaką ją napisałaś, a sny, które już masz, pomijam.
        </p>
        <label className="imp-drop">
          <input type="file" accept=".json,application/json" onChange={onFile} hidden />
          <span className="imp-drop-title">Wybierz plik JSON ze snami</span>
          <span className="imp-drop-sub">z telefonu lub komputera</span>
        </label>
        {error && <p className="form-error">{error}</p>}
        <p className="imp-hint">
          Masz sny w <b>starej Apce</b> (z własnymi tytułami, kategoriami, emocjami i symbolami)? Pobierz je <a href={`${import.meta.env.BASE_URL}stara-apka-eksport.html`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>na tej stronie</a>,
          a potem wgraj powstały plik tutaj. Wgraj go <b>przed</b> snami z Dreamy: ten sam sen z dwóch źródeł zostanie wtedy w wersji ze starej Apki.
        </p>
        <p className="imp-hint">Masz już sny w apce i dodałaś nową osobę albo symbol? Dopasuję je do snów, które już są.</p>
        <button type="button" className="btn-add-account" onClick={() => { setMode('relink'); setPeopleOff(new Set()); setChoices({}); setNewPeople({}); setSymbolOn(new Set()) }}>
          Dopasuj osoby i symbole w zapisanych snach ({base.dreams.length})
        </button>
      </div>
    )
  }

  const plan = importPlan || relinkPlan
  const count = importPlan ? importPlan.toAdd.length : relinkPlan.updates.length
  const perPerson = plan.perPerson
  const peopleRows = Object.entries(perPerson).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n)
  const ambiguous = importPlan?.ambiguous || []

  return (
    <div className="form">
      {file && mode === 'import' && (
        <div className="imp-file">
          <span className="imp-file-name">{file.name}</span>
          {!busy && <button type="button" className="imp-link" onClick={() => { setMode('file'); setFile(null) }}>zmień</button>}
        </div>
      )}
      {mode === 'relink' && !busy && <button type="button" className="imp-link" onClick={() => setMode('file')}>wróć</button>}

      <div className="imp-plan">
        <div className="imp-plan-row"><span>{importPlan ? 'Sny do dodania' : 'Sny do uzupełnienia'}</span><b>{count}</b></div>
        {importPlan && (
          <>
            <div className="imp-plan-sub">{Object.entries(importPlan.years).sort().map(([y, n]) => `${y}: ${n}`).join(' · ')}</div>
            <div className="imp-plan-row"><span>Już są w apce, pominę</span><b>{importPlan.dup}</b></div>
            {file.parsed.skipped > 0 && <div className="imp-plan-row"><span>Wpisy bez daty lub treści, pominę</span><b>{file.parsed.skipped}</b></div>}
          </>
        )}
        {importPlan && (fromFile.newPeople.length > 0 || fromFile.aliasUpdates.length > 0) && (
          <>
            <div className="imp-plan-row"><span>Nowe osoby z pliku</span><b>{fromFile.newPeople.length}</b></div>
            <div className="imp-plan-sub">{fromFile.newPeople.map(p => p.name).join(', ')}</div>
            {fromFile.aliasUpdates.length > 0 && <div className="imp-plan-sub">Dopiszę ksywki u {fromFile.aliasUpdates.length} osób, które już masz.</div>}
          </>
        )}
        {importPlan && fromFile.newSymbols.length > 0 && (
          <>
            <div className="imp-plan-row"><span>Nowe symbole z pliku</span><b>{fromFile.newSymbols.length}</b></div>
            <div className="imp-plan-sub">{fromFile.newSymbols.map(x => x.name).join(', ')}</div>
          </>
        )}
        {importPlan && fromFile.newCategories.length > 0 && (
          <>
            <div className="imp-plan-row"><span>Nowe kategorie snów z pliku</span><b>{fromFile.newCategories.length}</b></div>
            <div className="imp-plan-sub">{fromFile.newCategories.map(x => x.label).join(', ')}</div>
          </>
        )}
        <div className="imp-plan-row"><span>Znalezione osoby</span><b>{peopleRows.length}</b></div>
      </div>

      <Check checked={tag} onChange={setTag} sub="Przy imionach w tekście pojawi się @, dzięki czemu będą podświetlone i klikalne. Samo słowo zostaje bez zmian.">
        Oznacz osoby w tekście
      </Check>

      {importPlan && (
        <Check checked={autoOn} onChange={setAutoOn}
          sub={`Sny, w których nic nie otagowałaś, dostaną symbole (ważne motywy, role, miejsca, pojazdy, zwierzęta), emocje i kategorię. Twoje własne tagi zostają bez zmian.${prepared.filled ? ` Dotyczy ${prepared.filled} snów.` : ''}`}>
          Uzupełnij brakujące oznaczenia
        </Check>
      )}

      {peopleRows.length > 0 && (
        <>
          <div style={section}>Osoby znalezione w snach</div>
          <p style={hint}>Odznacz te, których nie chcesz łączyć ze snami.</p>
          {peopleRows.map(r => (
            <Check key={r.id} checked={!peopleOff.has(r.id)}
              onChange={on => setPeopleOff(s => { const n = new Set(s); on ? n.delete(r.id) : n.add(r.id); return n })}>
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: colorOf(r.id), marginRight: 8 }} />
              {nameOf(r.id)} <span style={{ color: 'var(--text-muted)' }}>· {r.n} {r.n === 1 ? 'sen' : 'snów'}</span>
            </Check>
          ))}
        </>
      )}

      {ambiguous.length > 0 && (
        <>
          <div style={section}>Nie wiem, o kogo chodzi</div>
          <p style={hint}>Pasuje do kilku osób. Wskaż właściwą, a zapamiętam to jako ksywkę.</p>
          {ambiguous.map(a => (
            <div key={a.word} style={rowStyle}>
              <span style={{ flex: 1 }}>„{a.word}” <span style={{ color: 'var(--text-muted)' }}>· {a.count}×</span></span>
              <select className="form-input" style={{ width: 'auto', maxWidth: 170 }} value={choices[a.word.toLowerCase()] || ''}
                onChange={e => setChoices(c => ({ ...c, [a.word.toLowerCase()]: e.target.value }))}>
                <option value="">pomiń</option>
                {a.ids.map(id => <option key={id} value={id}>{base.people.find(p => p.id === id)?.name || id}</option>)}
              </select>
            </div>
          ))}
        </>
      )}

      {importPlan && candPeople.length > 0 && (
        <>
          <div style={section}>Imiona, których nie ma w Osobach</div>
          <p style={hint}>Zaznacz te, które mam dodać jako nowe osoby (możesz poprawić imię). Reszta zostanie zwykłym tekstem.</p>
          {candPeople.map(c => {
            const st = newPeople[c.name] || { on: false, name: c.name }
            return (
              <div key={c.name} style={{ ...rowStyle, opacity: st.on ? 1 : 0.85 }}>
                <input type="checkbox" checked={!!st.on} onChange={e => setNewPeople(m => ({ ...m, [c.name]: { ...st, on: e.target.checked } }))} />
                <input className="form-input" value={st.name} maxLength={40} style={{ flex: 1, minWidth: 0 }}
                  onChange={e => setNewPeople(m => ({ ...m, [c.name]: { ...st, name: e.target.value } }))} />
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.count} {c.count === 1 ? 'sen' : 'snów'}</span>
              </div>
            )
          })}
        </>
      )}

      {importPlan && candSymbols.length > 0 && (
        <>
          <div style={section}>Częste słowa, które mogą być symbolami</div>
          <p style={hint}>Dotknij, żeby dodać jako symbol (np. dom, woda). Sny z tym słowem zostaną z nim połączone.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {candSymbols.map(c => {
              const on = symbolOn.has(c.word)
              return (
                <span key={c.word} onClick={() => setSymbolOn(s => { const n = new Set(s); on ? n.delete(c.word) : n.add(c.word); return n })}
                  style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                    border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-sub)' }}>
                  {c.word} · {c.count}
                </span>
              )
            })}
          </div>
        </>
      )}

      {busy && (
        <div className="imp-progress" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
          <div style={{ width: `${progress.total ? (100 * progress.done / progress.total) : 100}%` }} />
          <span>{progress.done} / {progress.total}</span>
        </div>
      )}
      {busy && waiting && <p className="imp-hint">Serwer nie odpowiada (kod: {waiting.code}), ponawiam ({waiting.proba}/5)…</p>}
      {error && <p className="form-error">{error}</p>}
      <button type="button" className="btn-save" disabled={busy || !count} onClick={run}>
        {busy ? 'Zapisuję…' : !count ? 'Nic nowego do dodania' : importPlan ? `Importuj ${count} snów` : `Uzupełnij ${count} snów`}
      </button>
    </div>
  )
}

