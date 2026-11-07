import { useState, useEffect } from 'react'
import { collection, doc, getDoc, getDocs, setDoc, writeBatch, query, where, limit } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { wPaczkach } from '../../utils/zapisWPaczkach'
import { restartPolaczenia } from '../../utils/restartPolaczenia'
import { planImportCleanup } from '../../utils/importCleanup'
import { toast } from '../Toast'

// „Cofnij import": usuwa transakcje dodane importem (source: 'import'),
// konta, które po tym zostają puste i mają saldo 0, oraz kategorie z importu,
// których nic już nie używa. Ręcznie dodanych transakcji nie rusza.
export default function ImportCleanup({ user }) {
  const [plan, setPlan]   = useState(null)
  const [open, setOpen]   = useState(false)
  const [busy, setBusy]   = useState(false)
  const [done, setDone]   = useState(null)
  const [prog, setProg]   = useState('')

  const load = async () => {
    const base = ['users', user.uid]
    const [tx, acc, cats] = await Promise.all([
      getDocs(collection(db, ...base, 'transactions')),
      getDocs(collection(db, ...base, 'accounts')),
      getDoc(doc(db, ...base, 'settings', 'categories')),
    ])
    setPlan(planImportCleanup(
      tx.docs.map(d => ({ id: d.id, ...d.data() })),
      acc.docs.map(d => ({ id: d.id, ...d.data() })),
      cats.exists() ? cats.data() : null,
    ))
  }
  // Najpierw tylko 1 odczyt: czy w ogóle był import. Pełne wczytanie (tysiące
  // odczytów z dziennego limitu Firebase) dopiero po kliknięciu „Cofnij import".
  const [hasImport, setHasImport] = useState(false)
  useEffect(() => {
    getDocs(query(collection(db, 'users', user.uid, 'transactions'), where('source', '==', 'import'), limit(1)))
      .then(s => setHasImport(!s.empty)).catch(() => setHasImport(false))
  }, [user.uid])

  if (!hasImport) return done ? <p className="imp-hint">{done}</p> : null
  if (!plan) return (
    <div className="imp-cleanup">
      <div className="imp-cleanup-head">
        <span>W apce są transakcje z wcześniejszego importu (z pliku Excel/CSV).</span>
        <button type="button" className="imp-link" onClick={() => { setOpen(true); load().catch(() => toast.error('Nie udało się wczytać danych')) }}>Cofnij import</button>
      </div>
      {open && <p className="imp-hint">Sprawdzam, co usunąć…</p>}
    </div>
  )
  if (!plan.transactions.length) return null

  const run = async () => {
    setBusy(true)
    const base = ['users', user.uid]
    try {
      const refs = [...plan.transactions.map(id => doc(db, ...base, 'transactions', id)), ...plan.accounts.map(a => doc(db, ...base, 'accounts', a.id))]
      await wPaczkach(refs, { makeBatch: () => writeBatch(db), onStall: restartPolaczenia, apply: (b, r) => b.delete(r), onProgress: (d, t) => setProg(`${d} / ${t}`) })
      if (plan.categories) await setDoc(doc(db, ...base, 'settings', 'categories'), plan.categories)
      const msg = `Usunięto ${plan.transactions.length} transakcji z importu${plan.accounts.length ? ` i ${plan.accounts.length} pustych kont` : ''}.`
      toast.success(msg); setDone(msg); setOpen(false); setPlan(null); setHasImport(false)
    } catch (e) {
      console.error('Cofanie importu:', e)
      toast.error(`Nie udało się (${e?.code || 'błąd'}). Spróbuj ponownie — usunie resztę.`)
      load().catch(() => {})
    }
    setBusy(false)
  }

  return (
    <div className="imp-cleanup">
      <div className="imp-cleanup-head">
        <span><b>{plan.transactions.length}</b> transakcji z wcześniejszego importu{plan.files.length ? ` (${plan.files.join(', ')})` : ''}</span>
        {!open && <button type="button" className="imp-link" onClick={() => setOpen(true)}>Cofnij import</button>}
      </div>
      {open && (
        <div className="confirm-box">
          <p>Usunę:</p>
          <ul>
            <li>{plan.transactions.length} zaimportowanych transakcji (ręcznie dodane zostają),</li>
            {plan.accounts.length > 0 && <li>{plan.accounts.length} kont, które zostaną puste i mają saldo 0: {plan.accounts.map(a => a.name).join(', ')},</li>}
            {plan.removedCats > 0 && <li>{plan.removedCats} kategorii z importu, których nic już nie używa.</li>}
          </ul>
          <div className="row">
            <button type="button" className="btn-save danger" disabled={busy} onClick={run}>{busy ? `Usuwam… ${prog}` : 'Usuń'}</button>
            <button type="button" className="imp-link" disabled={busy} onClick={() => setOpen(false)}>Anuluj</button>
          </div>
        </div>
      )}
    </div>
  )
}
