import { useState, useEffect, useMemo } from 'react'
import { collection, doc, getDoc, getDocs, query, orderBy, where, Timestamp, increment, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { format } from 'date-fns'
import { fmt, getCurrencyCode } from '../../utils/currency'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../../utils/categories'
import { byAccountOrder } from '../../utils/accountOrder'
import {
  decodeBytes, parseCSV, findHeaderRow, guessMapping, FIELDS,
  rowsToTransactions, markDuplicates, balanceDeltas, chunk,
} from '../../utils/budgetImport'
import { IconClose, IconCheck } from '../Icons'
import BackupImport from './BackupImport'
import { isBackup } from '../../utils/backupImport'
import { toast } from '../Toast'

const PREVIEW_LIMIT = 300

// Import transakcji z CSV: wybór pliku → dopasowanie kolumn i podgląd → zapis.
export default function ImportView({ user, onClose }) {
  const [step, setStep]         = useState('file')   // file | preview | backup
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
  const [existing, setExisting] = useState([])
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
    const all = parseCSV(text)
    if (!all.length) { setError('Plik jest pusty albo nie wygląda na CSV.'); return }
    let h = findHeaderRow(all)
    if (h < 0) h = 0
    setRows(all)
    setHeaderIdx(h)
    setMapping(guessMapping(all[h]))
    setFileName(name)
    setOverrides({})
    setError('')
    setStep('preview')
  }

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const buf = new Uint8Array(await f.arrayBuffer())
      loadText(decodeBytes(buf), f.name)
    } catch { setError('Nie udało się odczytać pliku.') }
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
    if (!range) { setExisting([]); return }
    let alive = true
    getDocs(query(collection(db, 'users', user.uid, 'transactions'),
      where('date', '>=', Timestamp.fromMillis(range[0])),
      where('date', '<=', Timestamp.fromMillis(range[1]))))
      .then(snap => {
        if (!alive) return
        setExisting(snap.docs.map(d => ({ ...d.data(), date: d.data().date?.toDate?.() })))
      }).catch(() => alive && setExisting([]))
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
  const sumIn  = chosen.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0)
  const sumOut = chosen.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0)
  const hasAmount = mapping.amount != null || mapping.debit != null || mapping.credit != null

  const setOv = (line, patch) => setOverrides(o => ({ ...o, [line]: { ...o[line], ...patch } }))
  const setAll = (include) => setOverrides(o => {
    const n = { ...o }
    for (const it of items) n[it.line] = { ...n[it.line], include }
    return n
  })

  const doImport = async () => {
    if (!chosen.length) return
    setSaving(true); setError('')
    const catOf = (it) => (it.type === 'income' ? incCats : expCats).find(c => c.id === it.categoryId)
    try {
      const now = Timestamp.now()
      for (const part of chunk(chosen)) {
        const batch = writeBatch(db)
        for (const it of part) {
          const cat = catOf(it)
          const sub = cat?.subcategories?.find(s => s.id === it.subcategoryId)
          batch.set(doc(collection(db, 'users', user.uid, 'transactions')), {
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
          })
        }
        await batch.commit()
      }
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
            <p className="modal-kicker">Budżet</p>
            <h3>Import transakcji</h3>
          </div>
          <button className="modal-close" onClick={onClose} disabled={saving}><IconClose size={16} /></button>
        </div>

        {step === 'file' && (
          <div className="form">
            <p className="imp-hint">
              Wgraj wyciąg CSV z banku (mBank, PKO, ING, Santander, Millennium,
              Pekao, Revolut…), eksport CSV z tej apki albo kopię danych JSON
              (np. kopię uzupełnioną o historię). Przed zapisem zobaczysz podgląd.
            </p>
            <label className="imp-drop">
              <input type="file" accept=".csv,.txt,.json,text/csv,text/plain,application/json" onChange={onFile} hidden />
              <span className="imp-drop-title">Wybierz plik CSV lub JSON</span>
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

            {accounts.length > 0 && (
              <div className="form-group">
                <label>Na konto</label>
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
                          <select className="form-input imp-select" value={it.categoryId}
                            onChange={e => setOv(it.line, { categoryId: e.target.value })}>
                            {cats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {items.length > PREVIEW_LIMIT && (
                  <p className="imp-hint">…i {items.length - PREVIEW_LIMIT} kolejnych (zaimportują się z kategorią dobraną automatycznie).</p>
                )}
              </>
            )}

            {error && <p className="form-error">{error}</p>}
            <button type="button" className="btn-save" disabled={saving || !chosen.length} onClick={doImport}>
              {saving ? 'Importowanie...' : `Importuj ${chosen.length} ${plural(chosen.length)}`}
            </button>
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
