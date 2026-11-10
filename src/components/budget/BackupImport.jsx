import { useState, useEffect } from 'react'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../../utils/categories'
import { planBackupImport, EXTRA_COLLECTIONS, EXTRA_SINGLES, OTHER_COLLECTIONS, OTHER_SINGLES } from '../../utils/backupImport'
import { wPaczkach } from '../../utils/zapisWPaczkach'
import { zapiszWiele } from '../../firebase/lite'
import { log } from '../../utils/logger'
import { toast } from '../Toast'

// Druga ścieżka importu: kopia JSON z apki (także uzupełniona o historię).
// Najpierw liczy plan na podstawie tego, co już jest w bazie, i pokazuje go;
// zapis dopiero po kliknięciu. Firestore sam zamienia Date na Timestamp.
export default function BackupImport({ user, backup, fileName, onBack, onDone }) {
  const [plan, setPlan]       = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [progress, setProgress] = useState(null)   // { done, total }
  const [error, setError]     = useState('')
  const [waiting, setWaiting] = useState(null)   // numer ponowienia, gdy serwer odpowiada wolno

  useEffect(() => {
    let alive = true
    const base = ['users', user.uid]
    Promise.all([
      getDocs(collection(db, ...base, 'accounts')),
      getDocs(collection(db, ...base, 'transactions')),
      getDoc(doc(db, ...base, 'settings', 'categories')),
      Promise.all(EXTRA_COLLECTIONS.map(c => getDocs(collection(db, ...base, c)))),
      Promise.all([...EXTRA_SINGLES, ...OTHER_SINGLES].map(k => getDoc(doc(db, ...base, ...k.split('/'))))),
      Promise.all(OTHER_COLLECTIONS.map(c => getDocs(collection(db, ...base, c)))),
    ]).then(([accSnap, txSnap, catDoc, extraSnaps, singleDocs, otherSnaps]) => {
      if (!alive) return
      const current = {
        accounts: accSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        transactions: txSnap.docs.map(d => {
          const t = d.data()
          return { id: d.id, type: t.type, amount: t.amount, accountId: t.accountId, date: t.date?.toDate?.() }
        }),
        categories: catDoc.exists() ? catDoc.data() : null,
        extras: Object.fromEntries(EXTRA_COLLECTIONS.map((c, i) => [c, extraSnaps[i].docs.map(d => ({ id: d.id }))])),
        singles: Object.fromEntries([...EXTRA_SINGLES, ...OTHER_SINGLES].map((k, i) => [k, singleDocs[i].exists() ? singleDocs[i].data() : null]).filter(([, v]) => v)),
        other: Object.fromEntries(OTHER_COLLECTIONS.map((c, i) => [c, otherSnaps[i].docs.map(d => ({ id: d.id }))])),
      }
      setPlan(planBackupImport(backup, current,
        { expense: DEFAULT_EXPENSE_CATEGORIES, income: DEFAULT_INCOME_CATEGORIES }))
    }).catch(e => {
      console.error('Import kopii: nie udało się wczytać bazy', e)
      if (!alive) return
      // Kod błędu wprost na ekranie — na telefonie nie ma konsoli.
      const code = e?.code || e?.name || 'nieznany'
      setLoadErr(code === 'permission-denied'
        ? 'Baza odmówiła dostępu (permission-denied). Sprawdź, czy w Firebase jest utworzona baza Firestore i wgrane reguły.'
        : `Nie udało się wczytać obecnych danych (${code}). Sprawdź połączenie i spróbuj ponownie.`)
    })
    return () => { alive = false }
  }, [user.uid, backup])

  const run = async () => {
    setError(''); setWaiting(null)
    const base = ['users', user.uid]
    const strip = ({ id, ...rest }) => [id, rest]
    // Wszystkie zapisy w kolejności: konta i kategorie przed transakcjami, żeby
    // przerwany import nie zostawił transakcji wskazujących na brakujące konto.
    const writes = []
    for (const a of plan.newAccounts) { const [id, data] = strip(a); writes.push({ path: [...base, 'accounts', id], data }) }
    if (plan.categories) writes.push({ path: [...base, 'settings', 'categories'], data: plan.categories, merge: true })
    for (const c of EXTRA_COLLECTIONS) for (const x of plan.extras?.[c] || []) { const [id, data] = strip(x); writes.push({ path: [...base, c, id], data }) }
    for (const [k, v] of Object.entries(plan.singles || {})) writes.push({ path: [...base, ...k.split('/')], data: v })
    // Pozostałe moduły (nawyki, to-do, kalendarz, sen…) — po id, jak w kopii
    for (const [c, list] of Object.entries(plan.other || {})) for (const x of list) { const [id, data] = strip(x); writes.push({ path: [...base, c, id], data }) }
    for (const [k, v] of Object.entries(plan.otherSingles || {})) writes.push({ path: [...base, ...k.split('/')], data: v })
    // To samo id co w kopii → ponowny import trafia w te same dokumenty i nic nie dubluje
    for (const t of plan.transactions) { const [id, data] = strip(t); writes.push({ path: [...base, 'transactions', id], data }) }
    const total = plan.transactions.length
    const otherCount = (plan.otherSummary || []).reduce((n, m) => n + m.count, 0)
    const pre = writes.length - total
    setProgress({ done: 0, total })
    try {
      await zapiszWiele(writes, {
        wPaczkach,
        onProgress: (d) => { setWaiting(null); setProgress({ done: Math.max(0, d - pre), total }) },
        onWait: (code, proba) => { setWaiting({ proba, code }); log.warn('import', 'paczka zapisu ponawiana', { code, proba }) },
      })
      toast.success(otherCount ? `Zaimportowano ${total} transakcji i ${otherCount} wpisów z pozostałych modułów` : `Zaimportowano ${total} transakcji`)
      onDone()
    } catch (e) {
      log.blad('import', 'Import kopii nie powiódł się', e)
      const code = e?.code || 'błąd'
      setError(code === 'resource-exhausted'
        ? 'Firebase odrzuca zapisy: wyczerpany dzienny limit darmowego planu (kod: resource-exhausted). Limit zeruje się codziennie ok. 9:00 — wtedy uruchom import jeszcze raz, dopisze tylko brakujące. Od razu pomoże przejście na plan Blaze.'
        : code === 'timeout'
        ? 'Serwer nie odpowiedział na zapis (kod: timeout). To, co się zapisało, zostaje — spróbuj za chwilę, dopisze tylko brakujące.'
        : `Import przerwany (${code}). To, co się zapisało, zostaje — uruchom import jeszcze raz, a dopisze tylko brakujące.`)
      setProgress(null); setWaiting(null)
    }
  }

  if (loadErr) return <div className="form"><p className="form-error">{loadErr}</p>
    <button type="button" className="imp-link" onClick={onBack}>wróć</button></div>
  if (!plan) return <div className="list-loading">Porównuję kopię z danymi w apce…</div>

  const { newAccounts, transactions, newCategories, skipped, years } = plan
  const EXTRA_LABELS = { regularPayments: 'Regularne płatności', shoppingItems: 'Lista zakupów', savingsGoals: 'Cele oszczędnościowe', debtors: 'Dłużnicy' }
  const extraRows = EXTRA_COLLECTIONS.map(c => [c, plan.extras?.[c] || []]).filter(([, l]) => l.length)
  const extraCount = extraRows.reduce((n, [, l]) => n + l.length, 0) + Object.keys(plan.singles || {}).length
  const otherRows = plan.otherSummary || []
  const otherAny = otherRows.length > 0
  const transfers = transactions.filter(t => t.categoryId === 'transfer').length
  const busy = !!progress

  return (
    <div className="form">
      <div className="imp-file">
        <span className="imp-file-name">{fileName}</span>
        {!busy && <button type="button" className="imp-link" onClick={onBack}>zmień</button>}
      </div>

      <p className="imp-hint">
        Kopia danych ze wszystkich modułów — dopiszę tylko to, czego w apce
        jeszcze nie ma. Niczego nie usuwam ani nie nadpisuję, a salda kont
        zostają bez zmian.
      </p>

      <div className="imp-plan">
        <div className="imp-plan-row"><span>Nowe transakcje</span><b>{transactions.length}</b></div>
        {transfers > 0 && <div className="imp-plan-sub">w tym {transfers} nóg przelewów między kontami (nie liczą się jako wydatek ani przychód)</div>}
        {Object.keys(years).length > 0 && (
          <div className="imp-plan-sub">
            {Object.entries(years).sort().map(([y, n]) => `${y}: ${n}`).join(' · ')}
          </div>
        )}
        <div className="imp-plan-row"><span>Już są w apce — pominę</span><b>{skipped.sameId + skipped.sameContent}</b></div>
        {skipped.invalid > 0 && <div className="imp-plan-row"><span>Uszkodzone wpisy — pominę</span><b>{skipped.invalid}</b></div>}
        <div className="imp-plan-row"><span>Nowe konta</span><b>{newAccounts.length}</b></div>
        {newAccounts.length > 0 && <div className="imp-plan-sub">{newAccounts.map(a => `${a.name} (${a.currency || 'PLN'})`).join(', ')}</div>}
        <div className="imp-plan-row"><span>Nowe kategorie</span><b>{newCategories.length}</b></div>
        {newCategories.length > 0 && <div className="imp-plan-sub">{newCategories.map(c => c.label).join(', ')}</div>}
        {extraRows.map(([c, l]) => (
          <div key={c}>
            <div className="imp-plan-row"><span>{EXTRA_LABELS[c]}</span><b>{l.length}</b></div>
            <div className="imp-plan-sub">{l.map(x => x.name || x.category || x.label || '—').join(', ')}</div>
          </div>
        ))}
        {plan.singles?.['settings/tithe'] && <div className="imp-plan-row"><span>Ustawienia dziesięciny</span><b>tak</b></div>}
        {otherAny && <div className="imp-plan-sub" style={{ marginTop: 10 }}>Pozostałe moduły — nowe wpisy:</div>}
        {otherRows.map(m => (
          <div key={m.id} className="imp-plan-row">
            <span>{m.label}</span><b>{m.count || 'ustawienia'}</b>
          </div>
        ))}
      </div>

      {busy && (
        <div className="imp-progress" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
          <div style={{ width: `${progress.total ? (100 * progress.done / progress.total) : 100}%` }} />
          <span>{progress.done} / {progress.total}</span>
        </div>
      )}
      {busy && <p className="imp-hint">{waiting ? (waiting.code === 'resource-exhausted'
        ? `Firebase odrzuca zapisy: wyczerpany dzienny limit darmowego planu (kod: resource-exhausted). Ponawiam (${waiting.proba}/5)…`
        : `Serwer nie odpowiada (kod: ${waiting.code}) — ponawiam (${waiting.proba}/5)…`) : 'Zapisuję paczkami po 250. Gdyby coś przerwało, przy kolejnym imporcie dopiszę tylko brakujące.'}</p>}
      {error && <p className="form-error">{error}</p>}
      <button type="button" className="btn-save" disabled={busy || (!transactions.length && !newAccounts.length && !newCategories.length && !extraCount && !otherAny)} onClick={run}>
        {busy ? 'Importowanie…' : transactions.length ? `Importuj ${transactions.length} transakcji` : extraCount || newAccounts.length || newCategories.length || otherAny ? 'Importuj' : 'Nic nowego do dodania'}
      </button>
    </div>
  )
}
