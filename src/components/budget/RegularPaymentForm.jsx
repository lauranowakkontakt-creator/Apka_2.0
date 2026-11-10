import { useState, useEffect } from 'react'
import { collection, doc, Timestamp, orderBy, query, getDoc } from 'firebase/firestore'
import { addDoc, updateDoc } from '../../utils/zapis'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { format } from 'date-fns'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, kolorPodkategorii } from '../../utils/categories'
import { getCurrencyCode, parseAmount } from '../../utils/currency'
import { CatIcon, IconClose } from '../Icons'
import { bladSubskrypcji } from '../../utils/polaczenie'

const FREQUENCIES = [
  { id: 'monthly', label: 'Co miesiąc' },
  { id: 'weekly',  label: 'Co tydzień' },
  { id: 'yearly',  label: 'Co rok' },
]

export default function RegularPaymentForm({ user, onClose, editData }) {
  const [type, setType]           = useState(editData?.type || 'expense')
  const [name, setName]           = useState(editData?.name || '')
  const [amount, setAmount]       = useState(editData?.amount?.toString() || '')
  const [category, setCategory]   = useState(editData?.categoryId || '')
  const [subcategoryId, setSubcategoryId] = useState(editData?.subcategoryId || '')
  const [frequency, setFrequency] = useState(editData?.frequency || 'monthly')
  const [dayOfMonth, setDay]      = useState(editData?.dayOfMonth?.toString() || '1')
  const [accountId, setAccountId] = useState(editData?.accountId || '')
  const [autoAdd, setAutoAdd]     = useState(editData?.autoAdd ?? false)
  const [dateFrom, setDateFrom]   = useState(editData?.dateFrom || '')
  const [dateTo, setDateTo]       = useState(editData?.dateTo || '')
  const [accounts, setAccounts]   = useState([])
  const [expCats, setExpCats]     = useState(DEFAULT_EXPENSE_CATEGORIES)
  const [incCats, setIncCats]     = useState(DEFAULT_INCOME_CATEGORIES)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const categories = type === 'expense' ? expCats : incCats

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'accounts'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('accounts'))
  }, [user.uid])

  // Reset podkategorii gdy zmienia się kategoria lub typ
  useEffect(() => { if (!editData) setSubcategoryId('') }, [category, type]) // eslint-disable-line

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid, 'settings', 'categories')).then(d => {
      if (d.exists()) {
        if (d.data().expense?.length) setExpCats(d.data().expense)
        if (d.data().income?.length)  setIncCats(d.data().income)
      }
    })
  }, [user.uid])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Wpisz nazwę'); return }
    if (!(parseAmount(amount) > 0)) { setError('Podaj kwotę'); return }
    if (!category) { setError('Wybierz kategorię'); return }
    setSaving(true)
    const cat = categories.find(c => c.id === category)
    const subcat = cat?.subcategories?.find(s => s.id === subcategoryId)
    const data = {
      type, name: name.trim(), amount: parseAmount(amount),
      category: cat?.label || category, categoryId: category,
      categoryIcon: cat?.icon || 'IconRepeat',
      subcategoryId: subcat?.id || null,
      subcategoryLabel: subcat?.label || null,
      frequency, dayOfMonth: Math.min(31, Math.max(1, parseInt(dayOfMonth, 10) || 1)),
      accountId: accountId || null,
      autoAdd,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      updatedAt: Timestamp.now()
    }
    // Od kiedy działa auto-księgowanie. Dzięki temu nadrabianie pominiętych
    // okresów nie sięga wstecz przed dzień, w którym auto zostało włączone.
    if (!autoAdd) data.autoSince = null
    else if (!editData?.autoAdd) data.autoSince = format(new Date(), 'yyyy-MM-dd')
    try {
      if (editData) {
        await updateDoc(doc(db, 'users', user.uid, 'regularPayments', editData.id), data)
      } else {
        await addDoc(collection(db, 'users', user.uid, 'regularPayments'), { ...data, createdAt: Timestamp.now(), donePeriods: [] })
      }
      onClose()
    } catch { setError('Błąd zapisu'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{editData ? 'Edytuj płatność' : 'Regularna płatność'}</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="form">
          <div className="type-toggle">
            <button type="button" className={`type-btn ${type === 'expense' ? 'active expense' : ''}`} onClick={() => setType('expense')}>Wydatek</button>
            <button type="button" className={`type-btn ${type === 'income' ? 'active income' : ''}`} onClick={() => setType('income')}>Przychód</button>
          </div>

          <div className="form-group">
            <label>Nazwa (np. Spotify, Czynsz)</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} maxLength={50} />
          </div>

          <div className="form-group">
            <label>Kwota ({getCurrencyCode()})</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Kategoria</label>
            <div className="category-icons-grid">
              {categories.map(cat => (
                <button key={cat.id} type="button"
                  className={`cat-icon-btn ${category === cat.id ? 'active' : ''}`}
                  onClick={() => setCategory(cat.id)}
                >
                  <div className="cat-circle" style={{ background: category === cat.id ? cat.color : cat.color + '33', borderColor: category === cat.id ? cat.color : 'transparent', color: category === cat.id ? '#fff' : cat.color }}>
                    <CatIcon categoryId={cat.id} emoji={cat.icon} size={18} />
                  </div>
                  <span className="cat-label">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {(() => {
            const selectedCat = categories.find(c => c.id === category)
            const subcats = selectedCat?.subcategories || []
            if (!subcats.length) return null
            return (
              <div className="form-group">
                <label>Podkategoria <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcjonalna)</span></label>
                <div className="category-icons-grid">
                  {subcats.map((sub, si) => {
                    const subColor = kolorPodkategorii(sub, selectedCat.color, si)
                    const active = subcategoryId === sub.id
                    return (
                      <button key={sub.id} type="button"
                        className={`cat-icon-btn ${active ? 'active' : ''}`}
                        onClick={() => setSubcategoryId(active ? '' : sub.id)}
                      >
                        <div className="cat-circle" style={{
                          background: active ? subColor : subColor + '33',
                          borderColor: active ? subColor : 'transparent',
                          color: active ? '#fff' : subColor
                        }}>
                          <CatIcon categoryId="" emoji={sub.icon} size={18} />
                        </div>
                        <span className="cat-label">{sub.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {accounts.length > 0 && (
            <div className="form-group">
              <label>Konto</label>
              <div className="account-chips">
                <button type="button" className={`account-chip ${!accountId ? 'active' : ''}`} onClick={() => setAccountId('')}>Bez konta</button>
                {accounts.map(acc => (
                  <button key={acc.id} type="button"
                    className={`account-chip ${accountId === acc.id ? 'active' : ''}`}
                    style={accountId === acc.id ? { borderColor: acc.color, background: acc.color + '22' } : {}}
                    onClick={() => setAccountId(acc.id)}
                  >{acc.name}</button>
                ))}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label>Częstotliwość</label>
              <select className="form-input" value={frequency} onChange={e => setFrequency(e.target.value)}>
                {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            {frequency === 'monthly' && (
              <div className="form-group" style={{width:100}}>
                <label>Dzień mies.</label>
                <input type="number" min="1" max="31" className="form-input" value={dayOfMonth} onChange={e => setDay(e.target.value)} />
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label>Obowiązuje od</label>
              <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label>Do (opcjonalnie)</label>
              <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>

          {/* Auto-add toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Automatyczne dodawanie</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {autoAdd ? 'Transakcja tworzona automatycznie; okresy pominięte, gdy apka była zamknięta, są nadrabiane' : 'Ręczne odznaczenie czy płatność wykonana'}
              </p>
            </div>
            <button type="button" className={`bmi-toggle ${autoAdd ? 'on' : ''}`} onClick={() => setAutoAdd(v => !v)} />
          </div>

          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz zmiany' : 'Dodaj płatność'}
          </button>
        </form>
      </div>
    </div>
  )
}
