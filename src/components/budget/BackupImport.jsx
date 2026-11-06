import { useState, useEffect } from 'react'
import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../../utils/categories'
import { planBackupImport } from '../../utils/backupImport'
import { chunk } from '../../utils/budgetImport'
import { toast } from '../Toast'

// Druga ścieżka importu: kopia JSON z apki (także uzupełniona o historię).
// Najpierw liczy plan na podstawie tego, co już jest w bazie, i pokazuje go;
// zapis dopiero po kliknięciu. Firestore sam zamienia Date na Timestamp.
export default function BackupImport({ user, backup, fileName, onBack, onDone }) {
  const [plan, setPlan]       = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [progress, setProgress] = useState(null)   // { done, total }
  const [error, setError]     = useState('')

  useEffect(() => {
    let alive = true
    const base = ['users', user.uid]
    Promise.all([
      getDocs(collection(db, ...base, 'accounts')),
      getDocs(collection(db, ...base, 'transactions')),
      getDoc(doc(db, ...base, 'settings', 'categories')),
    ]).then(([accSnap, txSnap, catDoc]) => {
      if (!alive) return
      const current = {
        accounts: accSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        transactions: txSnap.docs.map(d => {
          const t = d.data()
          return { id: d.id, type: t.type, amount: t.amount, accountId: t.accountId, date: t.date?.toDate?.() }
        }),
        categories: catDoc.exists() ? catDoc.data() : null,
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
    setError('')
    const total = plan.transactions.length
    setProgress({ done: 0, total })
    const base = ['users', user.uid]
    const strip = ({ id, ...rest }) => [id, rest]
    try {
      // Kolejność: konta i kategorie przed transakcjami, żeby przerwany import
      // nie zostawił transakcji wskazujących na nieistniejące konto.
      if (plan.newAccounts.length) {
        const b = writeBatch(db)
        for (const a of plan.newAccounts) {
          const [id, data] = strip(a)
          b.set(doc(db, ...base, 'accounts', id), data)
        }
        await b.commit()
      }
      if (plan.categories) {
        await setDoc(doc(db, ...base, 'settings', 'categories'), plan.categories, { merge: true })
      }
      let done = 0
      for (const part of chunk(plan.transactions, 400)) {
        const b = writeBatch(db)
        for (const t of part) {
          const [id, data] = strip(t)
          // To samo id co w kopii → ponowny import trafia w te same dokumenty
          b.set(doc(db, ...base, 'transactions', id), data)
        }
        await b.commit()
        done += part.length
        setProgress({ done, total })
      }
      toast.success(`Zaimportowano ${total} transakcji`)
      onDone()
    } catch (e) {
      console.error('Import kopii nie powiódł się:', e)
      setError(`Import przerwany (${e?.code || 'błąd'}). To, co się zapisało, zostaje — uruchom import jeszcze raz, a dopisze tylko brakujące.`)
      setProgress(null)
    }
  }

  if (loadErr) return <div className="form"><p className="form-error">{loadErr}</p>
    <button type="button" className="imp-link" onClick={onBack}>wróć</button></div>
  if (!plan) return <div className="list-loading">Porównuję kopię z danymi w apce…</div>

  const { newAccounts, transactions, newCategories, skipped, years } = plan
  const transfers = transactions.filter(t => t.categoryId === 'transfer').length
  const busy = !!progress

  return (
    <div className="form">
      <div className="imp-file">
        <span className="imp-file-name">{fileName}</span>
        {!busy && <button type="button" className="imp-link" onClick={onBack}>zmień</button>}
      </div>

      <p className="imp-hint">
        Kopia danych — dopiszę tylko to, czego w apce jeszcze nie ma. Niczego nie
        usuwam ani nie nadpisuję, a salda kont zostają bez zmian.
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
      </div>

      {busy && (
        <div className="imp-progress" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
          <div style={{ width: `${progress.total ? (100 * progress.done / progress.total) : 100}%` }} />
          <span>{progress.done} / {progress.total}</span>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
      <button type="button" className="btn-save" disabled={busy || (!transactions.length && !newAccounts.length && !newCategories.length)} onClick={run}>
        {busy ? 'Importowanie…' : transactions.length ? `Importuj ${transactions.length} transakcji` : 'Nic nowego do dodania'}
      </button>
    </div>
  )
}
