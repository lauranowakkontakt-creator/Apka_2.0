import { useState, useEffect, useMemo } from 'react'
import { collection, doc, getDoc, getDocs, setDoc, query, orderBy, where, Timestamp, increment, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { format } from 'date-fns'
import { fmt, getCurrencyCode } from '../../utils/currency'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../../utils/categories'
import { byAccountOrder } from '../../utils/accountOrder'
import {
  decodeBytes, parseCSV, findHeaderRow, guessMapping, FIELDS,
  rowsToTransactions, markDuplicates, balanceDeltas,
} from '../../utils/budgetImport'
import { IconClose, IconCheck } from '../Icons'
import BackupImport from './BackupImport'
import ImportCleanup from './ImportCleanup'
import CategoryReview from './CategoryReview'
import { readXlsx, isZip } from '../../utils/xlsxReader'
import { buildReview, defaultDecisions, resolveReview, assignCategory, reviewKeys, guessAccountType } from '../../utils/importReview'
import { isBackup } from '../../utils/backupImport'
import { toast } from '../Toast'
import { wPaczkach } from '../../utils/zapisWPaczkach'
import { restartPolaczenia } from '../../utils/restartPolaczenia'
import { log } from '../../utils/logger'

const PREVIEW_LIMIT = 300
const ACC_COLORS = ['#C94B28', '#6B9E72', '#4A90D9', '#9B59B6', '#E67E22', '#1ABC9C', '#E74C3C', '#F39C12']

// Import transakcji z CSV: wybór pliku → dopasowanie kolumn i podgląd → zapis.
export default function ImportView({ user, onClose }) {
  const [step, setStep]         = useState('file')   // file | preview | review | backup
  const [sheets, setSheets]     = useState(null)      // arkusze .xlsx: [{ name, rows }]
  const [sheetIdx, setSheetIdx] = useState(0)
  const [dec, setDec]           = useState(null)      // decyzje z ekranu kategorii
  const [progress, setProgress] = useState(null)
  const [backup, setBackup]     = useState(null)
  const [fileName, setFileName] = useState('')
  const [pasted, setPasted]     = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [rows, setRows]         = useState([])        // wszystkie wiersze pliku
  const [headerIdx, setHeaderIdx] = useState(0)
  const [mapping, setMapping]   = useState({})
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [updateBalance, setUpdateBalance] = useState(false)
  const [expCats, setExpCats]   = useState(DEFAULT_EXPENSE_CATEGORIES)
  const [incCats, setIncCats]   = useState(DEFAULT_INCOME_CATEGORIES)
  // Czy w bazie są zapisane własne kategorie. Jeśli nie, ekran zatwierdzania
  // startuje od zera (same kategorie z pliku), a nie od wbudowanych domyślnych.
  const [ownCats, setOwnCats]   = useState(false)
  const [existing, setExisting] = useState([])
  // 'loading' | 'ok' | 'error' — dopóki nie wiemy, co już jest w bazie,
  // nie pozwalamy importować (inaczej duplikaty przeszłyby niezauważone).
  const [existingState, setExistingState] = useState('ok')
  const [overrides, setOverrides] = useState({})      // line → { include?, categoryId? }
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    getDocs(query(collection(db, 'users', user.uid, 'accounts'), orderBy('createdAt', 'asc')))
      .then(snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byAccountOrder)
        setAccounts(list)
        if (list.length) setAccountId(id => id || list[0].id)
      }).catch(() => {})
    getDoc(doc(db, 'users', user.uid, 'settings', 'categories'))
      .then(d => {
        if (!d.exists()) return
        setOwnCats(!!(d.data().expense?.length || d.data().income?.length))
        if (d.data().expense?.length) setExpCats(d.data().expense)
        if (d.data().income?.length)  setIncCats(d.data().income)
      }).catch(() => {})
  }, [user.uid])

  const account = accounts.find(a => a.id === accountId)

  const loadText = (text, name) => {
    // Kopia JSON z apki → osobna ścieżka (konta, kategorie, przelewy).
    if (/^\s*[{[]/.test(text)) {
      let data = null
      try { data = JSON.parse(text) } catch { /* nie JSON — spróbuj jako CSV */ }
      if (data) {
        if (!isBackup(data)) { setError('To nie wygląda na kopię z apki (brak listy transakcji i kont).'); return }
        setBackup(data); setFileName(name); setError(''); setStep('backup')
        return
      }
    }
    loadRows(parseCSV(text), name)
  }

  const loadRows = (all, name) => {
    if (!all.length) { setError('Plik jest pusty albo nie wygląda na CSV.'); return }
    let h = findHeaderRow(all)
    if (h < 0) h = 0
    setRows(all)
    setHeaderIdx(h)
    setMapping(guessMapping(all[h]))
    setFileName(name)
    setOverrides({})
    setDec(null)
    setError('')
    setStep('preview')
  }

  // .xlsx: wybieramy arkusz z najwięcej wierszami pod rozpoznanym nagłówkiem
  // (w skoroszycie z podsumowaniami to zwykle arkusz „Transakcje").
  const loadXlsx = (list, name) => {
    let best = -1, bestRows = -1
    list.forEach((sh, i) => {
      const h = findHeaderRow(sh.rows)
      if (h >= 0 && sh.rows.length - h > bestRows) { best = i; bestRows = sh.rows.length - h }
    })
    if (best < 0) best = 0
    setSheets(list)
    setSheetIdx(best)
    loadRows(list[best]?.rows || [], name)
  }

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const buf = new Uint8Array(await f.arrayBuffer())
      if (isZip(buf)) { loadXlsx(await readXlsx(buf), f.name); return }
      setSheets(null)
      loadText(decodeBytes(buf), f.name)
    } catch (err) {
      console.error('Odczyt pliku:', err)
      setError(err?.message?.startsWith('To nie') ? err.message : 'Nie udało się odczytać pliku.')
    }
  }

  const header = rows[headerIdx] || []
  const dataRows = useMemo(() => rows.slice(headerIdx + 1), [rows, headerIdx])

  const parsed = useMemo(() => rowsToTransactions(dataRows, mapping, {
    expenseCats: expCats, incomeCats: incCats, accounts,
    defaultCurrency: account?.currency || getCurrencyCode(),
  }), [dataRows, mapping, expCats, incCats, accounts, account])

  // Istniejące transakcje z zakresu dat pliku — do wykrywania duplikatów.
  const range = useMemo(() => {
    if (!parsed.items.length) return null
    let min = parsed.items[0].date, max = min
    for (const t of parsed.items) { if (t.date < min) min = t.date; if (t.date > max) max = t.date }
    const a = new Date(min); a.setHours(0, 0, 0, 0)
    const b = new Date(max); b.setHours(23, 59, 59, 999)
    return [a.getTime(), b.getTime()]
  }, [parsed])

  useEffect(() => {
    if (!range) { setExisting([]); setExistingState('ok'); return }
    let alive = true
    setExistingState('loading')
    getDocs(query(collection(db, 'users', user.uid, 'transactions'),
      where('date', '>=', Timestamp.fromMillis(range[0])),
      where('date', '<=', Timestamp.fromMillis(range[1]))))
      .then(snap => {
        if (!alive) return
        setExisting(snap.docs.map(d => ({ ...d.data(), date: d.data().date?.toDate?.() })))
        setExistingState('ok')
      }).catch(e => {
        console.warn('Import: nie udało się pobrać istniejących transakcji', e?.code, e?.message)
        if (alive) { setExisting([]); setExistingState('error') }
      })
    return () => { alive = false }
  }, [user.uid, range?.[0], range?.[1]]) // eslint-disable-line

  const items = useMemo(() => markDuplicates(parsed.items, existing).map(it => {
    const o = overrides[it.line] || {}
    return {
      ...it,
      include: o.include ?? !it.duplicate,
      categoryId: o.categoryId ?? it.categoryId,
      subcategoryId: o.categoryId ? null : it.subcategoryId,
      accountId: it.accountId || accountId || null,
    }
  }), [parsed, existing, overrides, accountId])

  const chosen = items.filter(i => i.include)
  const dupCount = items.filter(i => i.duplicate).length
  const sumIn  = chosen.filter(i => i.type === 'income' && !i.transfer).reduce((s, i) => s + i.amount, 0)
  const sumOut = chosen.filter(i => i.type === 'expense' && !i.transfer).reduce((s, i) => s + i.amount, 0)
  // Plik z własnymi kategoriami → przed importem ekran zatwierdzania.
  const reviewMode = mapping.category != null

  const appCats = useMemo(() => ownCats ? { expense: expCats, income: incCats } : { expense: [], income: [] }, [ownCats, expCats, incCats])
  const review = useMemo(() => reviewMode ? buildReview(chosen) : null, [reviewMode, items]) // eslint-disable-line
  const storeKey = `mw_importReview:${fileName}:${dataRows.length}`

  // Decyzje zapisujemy na bieżąco — zatwierdzanie ~150 pozycji to praca,
  // której nie wolno stracić przez przypadkowe zamknięcie okna.
  useEffect(() => {
    if (!dec) return
    try { localStorage.setItem(storeKey, JSON.stringify(dec)) } catch { /* pełna pamięć / tryb prywatny */ }
  }, [dec, storeKey])

  const startReview = () => {
    const def = defaultDecisions(review, appCats, accounts)
    let saved = null
    try { saved = JSON.parse(localStorage.getItem(storeKey) || 'null') } catch { saved = null }
    const keep = (base, extra) => {
      const out = { ...base }
      for (const k of Object.keys(extra || {})) if (k in base) out[k] = { ...base[k], ...extra[k] }
      return out
    }
    const prev = dec || saved
    setDec({
      cats: keep(def.cats, prev?.cats),
      subs: keep(def.subs, prev?.subs),
      accs: keep(def.accs, prev?.accs),
      approved: { ...(prev?.approved || {}) },
    })
    setStep('review')
  }

  const keys = review ? reviewKeys(review) : []
  const left = dec ? keys.filter(k => !dec.approved[k]).length : keys.length
  const hasAmount = mapping.amount != null || mapping.debit != null || mapping.credit != null

  const setOv = (line, patch) => setOverrides(o => ({ ...o, [line]: { ...o[line], ...patch } }))
  const setAll = (include) => setOverrides(o => {
    const n = { ...o }
    for (const it of items) n[it.line] = { ...n[it.line], include }
    return n
  })

  const doImportReviewed = async () => {
    if (!chosen.length || left) return
    setSaving(true); setError('')
    const base = ['users', user.uid]
    try {
      const res = resolveReview(review, dec, appCats)
      // 1. Nowe konta (saldo 0 — historia nie zmienia sald, chyba że włączono)
      const accMap = {}
      const newAccs = review.accounts.filter(a => (dec.accs[a.name]?.target || 'new') === 'new')
      if (newAccs.length) {
        const b = writeBatch(db)
        newAccs.forEach((a, i) => {
          const ref = doc(collection(db, ...base, 'accounts'))
          const type = guessAccountType(a.name)
          b.set(ref, {
            name: a.name, type, typeName: { bank: 'Konto bankowe', cash: 'Gotówka', revolut: 'Revolut/Mobile', investment: 'Inwestycje' }[type],
            balance: 0, currency: a.currency || 'PLN', color: ACC_COLORS[i % ACC_COLORS.length], createdAt: Timestamp.now(),
          })
          accMap[a.name] = ref.id
        })
        await b.commit()
      }
      for (const a of review.accounts) {
        const t = dec.accs[a.name]?.target
        if (t?.startsWith('app:')) accMap[a.name] = t.slice(4)
      }
      // 2. Kategorie (istniejące + nowe, ze zmienionymi nazwami)
      await setDoc(doc(db, ...base, 'settings', 'categories'), res.categories, { merge: true })
      // 3. Transakcje
      const now = Timestamp.now()
      // Referencje (id) tworzymy raz z góry — ponowienie zawieszonej paczki
      // trafia w te same dokumenty, więc nie zdubluje transakcji.
      const writes = chosen.map(it => {
          const data = {
            type: it.type,
            amount: it.amount,
            ...assignCategory(it, res),
            currency: it.currency,
            // Opis krótki: Twoja notatka z arkusza. Długi tekst z wyciągu zostaje
            // w bankDescription (do wyszukiwania), a lista pokazuje kategorię.
            description: reviewMode ? (it.raw?.note || (it.transfer ? (it.raw?.subcategory || '') : '')) : it.description,
            ...(reviewMode && it.raw?.bank ? { bankDescription: it.raw.bank.slice(0, 200) } : {}),
            date: Timestamp.fromDate(it.date),
            accountId: accMap[it.raw?.account] || it.accountId || null,
            tithe: false,
            source: 'import',
            importedFrom: it.raw?.source ? `${fileName} · ${it.raw.source}` : fileName,
            createdAt: now,
            updatedAt: now,
          }
          if (it.dateApprox) data.dateApprox = true
          if (it.raw?.detail) data.detail = it.raw.detail
          if (it.transfer && it.raw?.subcategory) data.transferComment = it.raw.subcategory
          return [doc(collection(db, ...base, 'transactions')), data]
      })
      await wPaczkach(writes, {
        makeBatch: () => writeBatch(db), onStall: restartPolaczenia,
        apply: (b, [ref, data]) => b.set(ref, data),
        onProgress: (done) => setProgress({ done, total: chosen.length }),
        onWait: (code, proba) => log.warn('import', 'paczka zapisu ponawiana', { code, proba }),
      })
      if (updateBalance) {
        const deltas = balanceDeltas(chosen.map(it => ({ ...it, accountId: accMap[it.raw?.account] || it.accountId })))
        const b = writeBatch(db)
        let any = false
        for (const [id, delta] of Object.entries(deltas)) {
          if (!delta) continue
          b.update(doc(db, ...base, 'accounts', id), { balance: increment(delta) }); any = true
        }
        if (any) await b.commit()
      }
      try { localStorage.removeItem(storeKey) } catch { /* bez znaczenia */ }
      toast.success(`Zaimportowano ${chosen.length} ${plural(chosen.length)}`)
      onClose()
    } catch (e) {
      console.error('Import nie powiódł się:', e)
      setError(`Błąd zapisu (${e?.code || 'błąd'}). Część transakcji mogła się zapisać — przy ponownym imporcie zapisane wcześniej będą oznaczone jako „już jest".`)
      setSaving(false); setProgress(null)
    }
  }

  const doImport = async () => {
    if (!chosen.length) return
    setSaving(true); setError('')
    const catOf = (it) => (it.type === 'income' ? incCats : expCats).find(c => c.id === it.categoryId)
    try {
      const now = Timestamp.now()
      const writes = chosen.map(it => {
          const cat = catOf(it)
          const sub = cat?.subcategories?.find(s => s.id === it.subcategoryId)
          return [doc(collection(db, 'users', user.uid, 'transactions')), {
            type: it.type,
            amount: it.amount,
            category: cat?.label || it.categoryId,
            categoryId: it.categoryId,
            categoryIcon: cat?.icon || 'IconMore',
            subcategoryId: sub?.id || null,
            subcategoryLabel: sub?.label || null,
            currency: it.currency,
            description: it.description,
            date: Timestamp.fromDate(it.date),
            accountId: it.accountId,
            tithe: false,
            source: 'import',
            createdAt: now,
            updatedAt: now,
          }]
      })
      await wPaczkach(writes, { makeBatch: () => writeBatch(db), onStall: restartPolaczenia, apply: (b, [ref, data]) => b.set(ref, data) })
      if (updateBalance) {
        const deltas = balanceDeltas(chosen)
        const batch = writeBatch(db)
        let any = false
        for (const [id, delta] of Object.entries(deltas)) {
          if (!accounts.some(a => a.id === id) || !delta) continue
          batch.update(doc(db, 'users', user.uid, 'accounts', id), { balance: increment(delta) })
          any = true
        }
        if (any) await batch.commit()
      }
      toast.success(`Zaimportowano ${chosen.length} ${plural(chosen.length)}`)
      onClose()
    } catch (e) {
      console.error('Import nie powiódł się:', e)
      setError('Błąd zapisu. Część transakcji mogła się zapisać — sprawdź listę przed ponownym importem.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal modal-tall imp-modal">
        <div className="modal-header">
          <div>
            <p className="modal-kicker">Finanse</p>
            <h3>Import transakcji</h3>
          </div>
          <button className="modal-close" onClick={onClose} disabled={saving}><IconClose size={16} /></button>
        </div>

        {step === 'file' && (
          <div className="form">
            <p className="imp-hint">
              Wgraj arkusz Excel (.xlsx), wyciąg CSV z banku (mBank, PKO, ING,
              Santander, Millennium, Pekao, Revolut…), eksport CSV z tej apki albo
              kopię danych JSON. Przed zapisem zobaczysz podgląd, a gdy plik ma
              własne kategorie — zatwierdzisz każdą z nich.
            </p>
            <label className="imp-drop">
              <input type="file" accept=".csv,.txt,.json,.xlsx,text/csv,text/plain,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFile} hidden />
              <span className="imp-drop-title">Wybierz plik Excel, CSV lub JSON</span>
              <span className="imp-drop-sub">z telefonu lub komputera</span>
            </label>
            <button type="button" className="imp-link" onClick={() => setShowPaste(v => !v)}>
              {showPaste ? 'Schowaj wklejanie' : 'albo wklej dane z arkusza'}
            </button>
            {showPaste && (
              <>
                <textarea className="form-input imp-paste" rows={6} value={pasted}
                  onChange={e => setPasted(e.target.value)}
                  placeholder={'Data;Kwota;Opis\n2026-11-02;-23,40;Biedronka\n2026-11-03;4500,00;Wynagrodzenie'} />
                <button type="button" className="btn-save" disabled={!pasted.trim()}
                  onClick={() => loadText(pasted, 'wklejone dane')}>Dalej</button>
              </>
            )}
            {error && <p className="form-error">{error}</p>}
            <ImportCleanup user={user} />
          </div>
        )}

        {step === 'backup' && backup && (
          <BackupImport user={user} backup={backup} fileName={fileName}
            onBack={() => { setBackup(null); setStep('file') }} onDone={onClose} />
        )}

        {step === 'preview' && (
          <div className="form">
            <div className="imp-file">
              <span className="imp-file-name">{fileName}</span>
              <button type="button" className="imp-link" onClick={() => { setStep('file'); setRows([]) }}>zmień</button>
            </div>

            {sheets && sheets.length > 1 && (
              <div className="form-group">
                <label>Arkusz</label>
                <select className="form-input imp-select" value={sheetIdx}
                  onChange={e => { const i = Number(e.target.value); setSheetIdx(i); loadRows(sheets[i].rows, fileName) }}>
                  {sheets.map((sh, i) => <option key={i} value={i}>{sh.name} ({sh.rows.length} wierszy)</option>)}
                </select>
              </div>
            )}

            {accounts.length > 0 && (
              <div className="form-group">
                <label>{mapping.account != null ? 'Konto dla wierszy bez konta' : 'Na konto'}</label>
                <div className="account-chips">
                  {accounts.map(acc => (
                    <button key={acc.id} type="button"
                      className={`account-chip ${accountId === acc.id ? 'active' : ''}`}
                      onClick={() => setAccountId(acc.id)}>{acc.name}</button>
                  ))}
                </div>
                <button type="button" className={`tithe-toggle${updateBalance ? ' on' : ''}`}
                  onClick={() => setUpdateBalance(v => !v)} aria-pressed={updateBalance}>
                  <span className="tithe-toggle-box">{updateBalance && <IconCheck size={12} />}</span>
                  <span className="tithe-toggle-text">
                    Zmień saldo konta
                    <span className="tithe-toggle-hint">
                      Zostaw wyłączone, jeśli saldo konta już uwzględnia te operacje (np. import starej historii).
                    </span>
                  </span>
                </button>
              </div>
            )}

            <details className="imp-map">
              <summary>Kolumny w pliku {(!hasAmount || mapping.date == null) && <b className="imp-warn">— do ustawienia</b>}</summary>
              <div className="imp-map-grid">
                <span className="imp-map-label">Nagłówek w wierszu</span>
                <select className="form-input imp-select" value={headerIdx}
                  onChange={e => { const h = Number(e.target.value); setHeaderIdx(h); setMapping(guessMapping(rows[h])); setOverrides({}) }}>
                  {rows.slice(0, 40).map((r, i) => (
                    <option key={i} value={i}>{i + 1}: {r.slice(0, 3).join(' | ').slice(0, 40)}</option>
                  ))}
                </select>
                {FIELDS.map(f => (
                  <FieldSelect key={f.id} field={f} header={header} value={mapping[f.id]}
                    onChange={v => setMapping(m => { const n = { ...m }; if (v == null) delete n[f.id]; else n[f.id] = v; return n })} />
                ))}
              </div>
            </details>

            {(mapping.date == null || !hasAmount) ? (
              <p className="form-error">Wskaż kolumnę z datą i z kwotą (rozwiń „Kolumny w pliku").</p>
            ) : (
              <>
                {existingState === 'loading' && <p className="imp-hint imp-checking">Sprawdzam, co już jest w apce…</p>}
                {existingState === 'error' && <p className="form-error">Nie udało się sprawdzić, które transakcje już są w apce — duplikaty nie zostaną wykryte.</p>}
                <div className="imp-summary">
                  <span><b>{chosen.length}</b> z {items.length} do importu</span>
                  {dupCount > 0 && <span className="imp-dup-note">{dupCount} już jest w apce</span>}
                  <span className="t-amount income">+{fmt(sumIn, account?.currency)}</span>
                  <span className="t-amount expense">−{fmt(sumOut, account?.currency)}</span>
                </div>
                <div className="imp-bulk">
                  <button type="button" className="imp-link" onClick={() => setAll(true)}>zaznacz wszystkie</button>
                  <button type="button" className="imp-link" onClick={() => setAll(false)}>odznacz wszystkie</button>
                </div>

                {parsed.errors.length > 0 && (
                  <details className="imp-errors">
                    <summary>Pominięte wiersze: {parsed.errors.length}</summary>
                    <ul>
                      {parsed.errors.slice(0, 50).map(e => <li key={e.line}>wiersz {e.line + headerIdx + 1}: {e.reason}</li>)}
                    </ul>
                  </details>
                )}

                <ul className="imp-list">
                  {items.slice(0, PREVIEW_LIMIT).map(it => {
                    const cats = it.type === 'income' ? incCats : expCats
                    return (
                      <li key={it.line} className={`imp-row${it.include ? '' : ' off'}`}>
                        <input type="checkbox" checked={it.include}
                          onChange={e => setOv(it.line, { include: e.target.checked })} aria-label="Importuj" />
                        <div className="imp-row-main">
                          <div className="imp-row-top">
                            <span className="imp-row-date">{format(it.date, 'dd.MM.yyyy')}</span>
                            <span className={`t-amount ${it.type}`}>
                              {it.type === 'income' ? '+' : '−'}{fmt(it.amount, it.currency)}
                            </span>
                          </div>
                          <div className="imp-row-desc">{it.description || <i>bez opisu</i>}
                            {it.duplicate && <span className="imp-dup">już jest</span>}</div>
                          {reviewMode ? (
                            <div className="imp-row-cat">
                              {it.transfer ? 'Przelew między kontami' : [it.raw?.category, it.raw?.subcategory].filter(Boolean).join(' → ')}
                              {it.raw?.account && <> · {it.raw.account}</>}
                              {it.dateApprox && <span className="imp-dup">data przybliżona</span>}
                            </div>
                          ) : (
                            <select className="form-input imp-select" value={it.categoryId}
                              onChange={e => setOv(it.line, { categoryId: e.target.value })}>
                              {cats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {items.length > PREVIEW_LIMIT && (
                  <p className="imp-hint">…i {items.length - PREVIEW_LIMIT} kolejnych{reviewMode ? '.' : ' (zaimportują się z kategorią dobraną automatycznie).'}</p>
                )}
              </>
            )}

            {error && <p className="form-error">{error}</p>}
            {reviewMode ? (
              <button type="button" className="btn-save" disabled={!chosen.length || !review || existingState === 'loading'} onClick={startReview}>
                {existingState === 'loading' ? 'Sprawdzam duplikaty…' : `Dalej: zatwierdź kategorie (${chosen.length} ${plural(chosen.length)})`}
              </button>
            ) : (
              <button type="button" className="btn-save" disabled={saving || !chosen.length || existingState === 'loading'} onClick={doImport}>
                {saving ? 'Importowanie...' : existingState === 'loading' ? 'Sprawdzam duplikaty…' : `Importuj ${chosen.length} ${plural(chosen.length)}`}
              </button>
            )}
          </div>
        )}

        {step === 'review' && review && dec && (
          <div className="form">
            <div className="imp-file">
              <span className="imp-file-name">{fileName} · {chosen.length} {plural(chosen.length)}</span>
              {!saving && <button type="button" className="imp-link" onClick={() => setStep('preview')}>wróć do podglądu</button>}
            </div>
            <p className="imp-hint">
              Zatwierdź każdą kategorię i podkategorię. Możesz zmienić nazwę, połączyć
              kategorię z inną albo przenieść podkategorię gdzie indziej. Ta sama
              nazwa co inna podkategoria w tym samym miejscu = połączenie ich w jedną.
              Postęp zapisuje się sam — możesz przerwać i wrócić później.
            </p>
            <CategoryReview review={review} dec={dec} setDec={setDec} appCats={appCats} accounts={accounts} />

            <button type="button" className={`tithe-toggle${updateBalance ? ' on' : ''}`}
              onClick={() => setUpdateBalance(v => !v)} aria-pressed={updateBalance}>
              <span className="tithe-toggle-box">{updateBalance && <IconCheck size={12} />}</span>
              <span className="tithe-toggle-text">
                Zmień salda kont
                <span className="tithe-toggle-hint">
                  Zostaw wyłączone przy imporcie historii — salda istniejących kont już ją zawierają, a nowe konta dostaną saldo 0.
                </span>
              </span>
            </button>

            {progress && (
              <div className="imp-progress" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
                <div style={{ width: `${100 * progress.done / progress.total}%` }} />
                <span>{progress.done} / {progress.total}</span>
              </div>
            )}
            {error && <p className="form-error">{error}</p>}
            <div className="rev-footer">
              {left > 0 ? (
                <button type="button" className="btn-save" disabled={saving}
                  onClick={() => setDec(d => ({ ...d, approved: { ...d.approved, ...Object.fromEntries(keys.map(k => [k, true])) } }))}>
                  Zatwierdź wszystkie ({left})
                </button>
              ) : (
                <button type="button" className="btn-save" disabled={saving || !chosen.length} onClick={doImportReviewed}>
                  {saving ? 'Importowanie…' : `Importuj ${chosen.length} ${plural(chosen.length)}`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FieldSelect({ field, header, value, onChange }) {
  return (
    <>
      <span className="imp-map-label">{field.label}</span>
      <select className="form-input imp-select" value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}>
        <option value="">— brak —</option>
        {header.map((h, i) => <option key={i} value={i}>{h || `kolumna ${i + 1}`}</option>)}
      </select>
    </>
  )
}

function plural(n) {
  if (n === 1) return 'transakcję'
  const d = n % 10, dd = n % 100
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'transakcje'
  return 'transakcji'
}
