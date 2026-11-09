import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, orderBy, Timestamp, doc, setDoc, getDoc, writeBatch, increment } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { fmt, parseAmount, getCurrencyCode } from '../../utils/currency'
import { byAccountOrder } from '../../utils/accountOrder'
import { DEFAULT_EXPENSE_CATEGORIES } from '../../utils/categories'
import {
  normalizeTitheSettings, tithePool, titheTotalDue, nextCarryOver, ensureTitheCategory,
  DEFAULT_PERCENT, TITHE_CATEGORY, TITHE_CATEGORY_ID,
} from '../../utils/titheLogic'
import { CatIcon, IconPrayer, IconSettings, IconClose, IconCheck, IconChevronLeft } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { toast } from '../Toast'
import { bladSubskrypcji } from '../../utils/polaczenie'

/* Dziesięcina — pula z zaznaczonych przychodów.
   Przychody oznaczone „do dziesięciny" zbierają się aż do oddania; po wpłacie
   dostają `titheSettledAt` i pula rusza od zera. Procent ustawia użytkownik. */
export default function TitheView({ user, onClose }) {
  const [settings, setSettings] = useState(null) // null = jeszcze nie wiadomo
  const [incomes, setIncomes]   = useState([])
  const [accounts, setAccounts] = useState([])
  const [view, setView]         = useState('main') // main | settings | pay

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid, 'settings', 'tithe'))
      .then(d => setSettings(normalizeTitheSettings(d.exists() ? d.data() : null)))
      .catch(() => setSettings(normalizeTitheSettings(null)))
  }, [user.uid])

  // Wszystkie przychody oznaczone do dziesięciny i jeszcze nierozliczone.
  // Bez ograniczenia do miesiąca — pula zbiera się do momentu oddania.
  //
  // Świadomie tylko JEDEN filtr równościowy i bez orderBy: Firestore wymagałby
  // wtedy złożonego indeksu, którego nikt by nie założył, i widok wywalałby się
  // na telefonie. Typ i kolejność domykamy po stronie klienta — puli i tak
  // nigdy nie jest dużo, bo znika po każdej wpłacie.
  useEffect(() => {
    const q = query(
      collection(db, 'users', user.uid, 'transactions'),
      where('tithe', '==', true)
    )
    return onSnapshot(q,
      snap => setIncomes(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
      ),
      bladSubskrypcji('titheIncomes', { przyBledzie: () => setIncomes([]) }))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'accounts'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('accounts'))
  }, [user.uid])

  const pool = useMemo(() => tithePool(incomes), [incomes])
  const due  = useMemo(
    () => titheTotalDue(pool.base, settings?.percent || DEFAULT_PERCENT, settings?.carryOver || 0),
    [pool.base, settings]
  )

  const saveSettings = async (next) => {
    setSettings(next)
    await setDoc(doc(db, 'users', user.uid, 'settings', 'tithe'), next, { merge: true })
  }

  // Włączenie funkcji dopisuje kategorię „Dziesięcina" do kategorii wydatków —
  // bez niej nie byłoby jak zaksięgować wpłaty.
  const enable = async (percent) => {
    const ref = doc(db, 'users', user.uid, 'settings', 'categories')
    const snap = await getDoc(ref).catch(() => null)
    const current = snap?.exists() && snap.data().expense?.length
      ? snap.data().expense
      : DEFAULT_EXPENSE_CATEGORIES
    const withTithe = ensureTitheCategory(current)
    if (withTithe !== current) {
      await setDoc(ref, { expense: withTithe }, { merge: true }).catch(() => {})
    }
    await saveSettings({ enabled: true, percent, carryOver: 0 })
    toast.success('Dziesięcina włączona')
    setView('main')
  }

  const disable = async () => {
    const ok = await confirmDialog({
      title: 'Wyłączyć dziesięcinę?',
      message: 'Zapisane wpłaty i oznaczenia przychodów zostają — znika tylko ten widok i pytanie przy przychodzie.',
      confirmLabel: 'Wyłącz',
    })
    if (!ok) return
    await saveSettings({ ...settings, enabled: false })
    onClose()
  }

  if (!settings) {
    return (
      <Shell onClose={onClose}>
        <div className="list-loading">Ładowanie...</div>
      </Shell>
    )
  }

  if (!settings.enabled) {
    return (
      <Shell onClose={onClose}>
        <TitheOnboarding onEnable={enable} />
      </Shell>
    )
  }

  if (view === 'settings') {
    return (
      <Shell onClose={onClose} onBack={() => setView('main')} title="Ustawienia dziesięciny">
        <TitheSettings
          settings={settings}
          onSave={async (pct) => { await saveSettings({ ...settings, percent: pct }); setView('main') }}
          onDisable={disable}
        />
      </Shell>
    )
  }

  if (view === 'pay') {
    return (
      <Shell onClose={onClose} onBack={() => setView('main')} title="Oddaj dziesięcinę">
        <TithePayment
          user={user} accounts={accounts} due={due} items={pool.items}
          onDone={async (paid) => {
            // Niedopłata nie może zniknąć razem z wyczyszczoną pulą — reszta
            // przechodzi na następne rozliczenie (nadpłata analogicznie, na minus).
            await saveSettings({ ...settings, carryOver: nextCarryOver(due, paid) })
            setView('main')
          }}
        />
      </Shell>
    )
  }

  return (
    <Shell onClose={onClose} onSettings={() => setView('settings')}>
      <div className="tithe-content">
        <div className="tithe-hero">
          <div className="tithe-hero-label">Do oddania ({settings.percent}%)</div>
          <div className="tithe-hero-amount">{fmt(due)}</div>
          <div className="tithe-hero-sub">
            z {fmt(pool.base)} · {pool.count} {pool.count === 1 ? 'przychód' : 'przychodów'} w puli
          </div>
          {!!settings.carryOver && (
            <div className="tithe-carry">
              {settings.carryOver > 0
                ? `w tym ${fmt(settings.carryOver)} zaległości z poprzedniego razu`
                : `z uwzględnieniem nadpłaty ${fmt(-settings.carryOver)}`}
            </div>
          )}
        </div>

        {pool.count === 0 && !(due > 0) ? (
          <p className="tithe-note">
            Pula jest pusta. Przy dodawaniu przychodu zaznacz „Wlicz do dziesięciny",
            a kwota pojawi się tutaj.
          </p>
        ) : (
          <>
            {pool.count > 0 && <div className="tithe-pool-label">W puli</div>}
            <div className="tithe-pool-list">
              {pool.items.map(t => (
                <div key={t.id} className="tithe-pool-item">
                  <span className="tithe-pool-icon">
                    <CatIcon categoryId={t.categoryId} subcategoryId={t.subcategoryId} emoji={t.categoryIcon} size={14} />
                  </span>
                  <div className="tithe-pool-main">
                    <div className="tithe-pool-title">{t.description || t.category || 'Przychód'}</div>
                    <div className="tithe-pool-meta">
                      {t.date?.toDate ? format(t.date.toDate(), 'd MMM yyyy', { locale: pl }) : ''}
                    </div>
                  </div>
                  <strong className="tithe-pool-amount">{fmt(t.amount)}</strong>
                </div>
              ))}
            </div>

            <button className="btn-save" onClick={() => setView('pay')} disabled={!(due > 0)}>
              Oddaj {fmt(due)}
            </button>
            <p className="tithe-note">
              Po zapisaniu wpłaty te przychody znikną z puli — kolejna dziesięcina liczy się od nowa.
            </p>
          </>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children, onClose, onBack, onSettings, title }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {onBack && (
              <button className="t-btn" style={{ width: 26, height: 26 }} onClick={onBack} title="Wróć">
                <IconChevronLeft size={14} />
              </button>
            )}
            <IconPrayer size={17} /> {title || 'Dziesięcina'}
          </h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {onSettings && (
              <button className="t-btn" onClick={onSettings} title="Ustawienia"><IconSettings size={15} /></button>
            )}
            <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function TitheOnboarding({ onEnable }) {
  const [pct, setPct] = useState(String(DEFAULT_PERCENT))
  const [busy, setBusy] = useState(false)
  const value = parseAmount(pct)
  const valid = value > 0 && value <= 100

  return (
    <div className="form">
      <p className="pause-info">
        Dziesięcina liczy się z przychodów, które sama zaznaczysz — przy każdym przychodzie
        pojawi się pytanie „Wlicz do dziesięciny". Zaznaczone kwoty zbierają się w puli,
        a po oddaniu pula rusza od zera.
      </p>
      <div className="form-group">
        <label>Twój procent</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="text" inputMode="decimal" className="form-input" value={pct}
            onChange={e => setPct(e.target.value)} style={{ maxWidth: 120 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-muted)' }}>%</span>
        </div>
      </div>
      <button className="btn-save" disabled={!valid || busy}
        onClick={async () => { setBusy(true); await onEnable(value); setBusy(false) }}>
        {busy ? 'Włączanie...' : 'Włącz dziesięcinę'}
      </button>
      <p className="tithe-note">
        Kategoria wydatku „Dziesięcina" dopisze się automatycznie.
      </p>
    </div>
  )
}

function TitheSettings({ settings, onSave, onDisable }) {
  const [pct, setPct] = useState(String(settings.percent))
  const [busy, setBusy] = useState(false)
  const value = parseAmount(pct)
  const valid = value > 0 && value <= 100

  return (
    <div className="form">
      <div className="form-group">
        <label>Procent dziesięciny</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="text" inputMode="decimal" className="form-input" value={pct}
            onChange={e => setPct(e.target.value)} style={{ maxWidth: 120 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-muted)' }}>%</span>
        </div>
      </div>
      <button className="btn-save" disabled={!valid || busy}
        onClick={async () => { setBusy(true); await onSave(value); setBusy(false) }}>
        {busy ? 'Zapisywanie...' : 'Zapisz'}
      </button>
      <button type="button" className="tithe-disable" onClick={onDisable}>
        Wyłącz dziesięcinę
      </button>
    </div>
  )
}

/* Zapis wpłaty: wydatek w kategorii „Dziesięcina" + oznaczenie przychodów
   z puli jako rozliczonych. Wszystko jednym batchem, żeby nie dało się
   zaksięgować wpłaty bez wyczyszczenia puli (ani odwrotnie). */
function TithePayment({ user, accounts, due, items, onDone }) {
  const [amount, setAmount]   = useState(String(due).replace('.', ','))
  const [accountId, setAccountId] = useState('')
  const [date, setDate]       = useState(format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote]       = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')

  const ordered = [...accounts].sort(byAccountOrder)
  useEffect(() => { if (!accountId && ordered[0]) setAccountId(ordered[0].id) }, [accounts]) // eslint-disable-line

  const value = parseAmount(amount)

  const save = async () => {
    if (!(value > 0)) { setError('Podaj kwotę'); return }
    if (!accountId)   { setError('Wybierz konto'); return }
    setBusy(true); setError('')
    try {
      const batch = writeBatch(db)
      const txRef = doc(collection(db, 'users', user.uid, 'transactions'))
      batch.set(txRef, {
        type: 'expense',
        amount: value,
        category: TITHE_CATEGORY.label,
        categoryId: TITHE_CATEGORY_ID,
        categoryIcon: TITHE_CATEGORY.icon,
        currency: getCurrencyCode(),
        description: note.trim() || 'Dziesięcina',
        date: Timestamp.fromDate(new Date(date)),
        accountId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      batch.update(doc(db, 'users', user.uid, 'accounts', accountId), { balance: increment(-value) })
      const settledAt = Timestamp.now()
      items.forEach(t => {
        // `tithe: false` gasi flagę, po której filtruje zapytanie o pulę —
        // bez tego rozliczone przychody wracałyby w wynikach już zawsze
        // i transfer rósłby z każdym miesiącem. Fakt rozliczenia zostaje
        // zapisany w titheSettledAt.
        batch.update(doc(db, 'users', user.uid, 'transactions', t.id), {
          tithe: false, titheSettledAt: settledAt, titheSettledTxId: txRef.id,
        })
      })
      await batch.commit()
      toast.success('Dziesięcina zapisana')
      onDone(value)
    } catch {
      setError('Nie udało się zapisać')
      setBusy(false)
    }
  }

  return (
    <div className="form">
      <div className="form-group">
        <label>Kwota</label>
        <input type="text" inputMode="decimal" className="form-input" value={amount}
          onChange={e => setAmount(e.target.value)} autoFocus />
      </div>
      <div className="form-group">
        <label>Z konta</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ordered.map(a => (
            <button key={a.id} type="button"
              className={`account-chip ${accountId === a.id ? 'active' : ''}`}
              onClick={() => setAccountId(a.id)}>
              {accountId === a.id && <IconCheck size={10} style={{ marginRight: 4, verticalAlign: '-1px' }} />}
              {a.name}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label>Data</label>
        <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Opis <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcjonalnie)</span></label>
        <input type="text" className="form-input" placeholder="np. zbiórka niedzielna"
          value={note} onChange={e => setNote(e.target.value)} />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="btn-save" onClick={save} disabled={busy}>
        {busy ? 'Zapisywanie...' : 'Zapisz wpłatę'}
      </button>
      <p className="tithe-note">
        Rozliczy {items.length} {items.length === 1 ? 'przychód' : 'przychodów'} z puli.
        {value > 0 && value < due && ` Brakujące ${fmt(due - value)} zostanie doliczone następnym razem.`}
        {value > due && ` Nadpłata ${fmt(value - due)} pomniejszy następną dziesięcinę.`}
      </p>
    </div>
  )
}
