import { useState, useEffect, useRef } from 'react'
import { collection, doc, Timestamp, orderBy, query, getDoc, getDocs, limit, increment, writeBatch } from 'firebase/firestore'
import { onSnapshot } from '../utils/subskrypcje'
import { db } from '../firebase/config'
import { format } from 'date-fns'
import { getCurrencyCode, parseAmount, CURRENCIES } from '../utils/currency'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, getSubcategoryColor, isTransfer } from '../utils/categories'
import useFallbackTimeout from '../utils/useFallbackTimeout'
import { byAccountOrder } from '../utils/accountOrder'
import { CatIcon, IconClose, IconCheck } from './Icons'
import { normalizeTitheSettings } from '../utils/titheLogic'
import { bladSubskrypcji } from '../utils/polaczenie'

export const EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES
export const INCOME_CATEGORIES  = DEFAULT_INCOME_CATEGORIES

export default function TransactionForm({ user, onClose, editData, defaultType, defaultAccountId, defaultCurrency }) {
  const [type, setType]             = useState(editData?.type || defaultType || 'expense')
  const [amount, setAmount]         = useState(editData?.amount?.toString() || '')
  const [category, setCategory]     = useState(editData?.categoryId || '')
  const [subcategoryId, setSubcategoryId] = useState(editData?.subcategoryId || '')
  const [subsubId, setSubsubId] = useState(editData?.subsubcategoryId || '')
  const [description, setDescription] = useState(editData?.description || '')
  const [date, setDate]             = useState(editData?.date ? format(editData.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
  const [accountId, setAccountId]   = useState(editData?.accountId || defaultAccountId || '')
  const [currency, setCurrency]     = useState(editData?.currency || defaultCurrency || getCurrencyCode())
  const [accounts, setAccounts]     = useState([])
  const [accountUsage, setAccountUsage] = useState({ income: {}, expense: {} })
  const [showAllAccounts, setShowAllAccounts] = useState(false)
  const [expCats, setExpCats]       = useState(DEFAULT_EXPENSE_CATEGORIES)
  const [incCats, setIncCats]       = useState(DEFAULT_INCOME_CATEGORIES)
  const [catsLoaded, setCatsLoaded] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  // Dziesięcina: przy przychodzie pytamy, czy kwota wchodzi do puli.
  const [titheOn, setTitheOn]       = useState(false)
  const [tithe, setTithe]           = useState(editData?.tithe === true)

  const categories = type === 'expense' ? expCats : incCats
  // Edycja przelewu między kontami: zostaje przelewem (bez kategorii, poza sumami).
  // Wcześniej formularz pokazywał go jak wydatek bez kategorii i zapis go psuł.
  const transferEdit = !!editData && isTransfer(editData)

  // Zabezpieczenie: gdyby snapshot kategorii nie odpowiedział (brak sieci, zimny
  // start), po `ms` i tak pokaż domyślne, żeby formularz nie utknął na spinnerze.
  useFallbackTimeout(() => setCatsLoaded(true))

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid, 'settings', 'tithe'))
      .then(d => setTitheOn(normalizeTitheSettings(d.exists() ? d.data() : null).enabled))
      .catch(() => setTitheOn(false))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'accounts'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('accounts'))
  }, [user.uid])

  // Użycie kont z ostatnich transakcji, osobno dla przychodów i wydatków.
  // Świeższe transakcje ważą więcej (1/(1+i)) → na górze lądują konta „częste
  // LUB ostatnio używane", a nie tylko te z największą liczbą wpisów kiedykolwiek.
  useEffect(() => {
    getDocs(query(collection(db, 'users', user.uid, 'transactions'), orderBy('createdAt', 'desc'), limit(200)))
      .then(snap => {
        const u = { income: {}, expense: {} }
        snap.docs.forEach((d, i) => {
          const data = d.data()
          const a = data.accountId
          if (!a) return
          const t = data.type === 'income' ? 'income' : 'expense'
          u[t][a] = (u[t][a] || 0) + 1 / (1 + i)
        })
        setAccountUsage(u)
      }).catch(() => {})
  }, [user.uid])

  // Kolejność kont w formularzu: najczęściej/ostatnio używane dla bieżącego typu
  // na górze (drugi typ jako słaby tie-break), a przy remisie ręczna kolejność
  // z zakładki Konta. Dzięki temu przy przychodzie nie trzeba szukać konta.
  const usageScore = (id) => {
    const same  = accountUsage[type]?.[id] || 0
    const other = accountUsage[type === 'income' ? 'expense' : 'income']?.[id] || 0
    return same * 10 + other
  }
  const sortedAccounts = [...accounts].sort((a, b) =>
    (usageScore(b.id) - usageScore(a.id)) || byAccountOrder(a, b))

  // Domyślnie wybierz najczęściej/ostatnio używane konto (brak opcji „bez konta").
  // Gdy formularz otwarto z portfela innej waluty (np. EUR), bierzemy najczęstsze
  // konto w tej walucie — inaczej wybór konta złotówkowego przestawiłby walutę.
  useEffect(() => {
    if (!accountId && !editData && accounts.length) {
      const wWalucie = defaultCurrency ? sortedAccounts.filter(a => (a.currency || 'PLN') === defaultCurrency) : []
      setAccountId((wWalucie[0] || sortedAccounts[0]).id)
    }
  }, [accounts, accountUsage]) // eslint-disable-line

  // Load custom categories — na żywo (onSnapshot), żeby nowo dodane/zmienione
  // kategorie pojawiały się od razu, bez „zacinania" na starych domyślnych.
  useEffect(() => {
    return onSnapshot(doc(db, 'users', user.uid, 'settings', 'categories'), d => {
      if (d.exists()) {
        if (d.data().expense?.length) setExpCats(d.data().expense)
        if (d.data().income?.length)  setIncCats(d.data().income)
      }
      setCatsLoaded(true)
    }, bladSubskrypcji('settings/categories'))
  }, [user.uid])

  // Reset kategorii/podkategorii TYLKO przy realnej zmianie przez użytkownika.
  // Przy pierwszym renderze (edycja) kategorie własne mogą jeszcze nie być
  // wczytane — reset na starcie kasowałby zapisany wybór z edytowanej transakcji.
  const firstType = useRef(true)
  useEffect(() => {
    if (firstType.current) { firstType.current = false; return }
    if (!categories.find(c => c.id === category)) setCategory('')
  }, [type])

  const firstCat = useRef(true)
  useEffect(() => {
    if (firstCat.current) { firstCat.current = false; return }
    setSubcategoryId('')
  }, [category])

  const firstSub = useRef(true)
  useEffect(() => {
    if (firstSub.current) { firstSub.current = false; return }
    setSubsubId('')
  }, [subcategoryId])

  // Waluta podąża za wybranym portfelem: wybór konta EUR ustawia walutę na EUR.
  // Synchronizujemy dopiero, gdy konta są wczytane, i tylko raz na dane konto —
  // dzięki temu przy edycji zapisana waluta transakcji zostaje nietknięta,
  // dopóki użytkowniczka sama nie przełączy konta. Przy nowej transakcji
  // (także tej dodawanej z poziomu konta) walutę bierzemy z tego konta.
  // Ręczny selektor obok kwoty i tak ma ostatnie słowo.
  const syncedAcc = useRef(editData ? (editData.accountId || null) : null)
  useEffect(() => {
    if (!accountId || syncedAcc.current === accountId) return
    const acc = accounts.find(a => a.id === accountId)
    if (!acc) return
    syncedAcc.current = accountId
    if (acc.currency) setCurrency(acc.currency)
  }, [accountId, accounts]) // eslint-disable-line

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!(parseAmount(amount) > 0)) { setError('Podaj prawidłową kwotę'); return }
    if (!category && !transferEdit) { setError('Wybierz kategorię'); return }
    setSaving(true); setError('')
    const cat = categories.find(c => c.id === category)
    const subcat = cat?.subcategories?.find(s => s.id === subcategoryId)
    const subsub = subcat?.subcategories?.find(s => s.id === subsubId)
    const data = {
      type, amount: parseAmount(amount),
      category: cat?.label || category,
      categoryId: category,
      categoryIcon: cat?.icon || 'IconMore',
      subcategoryId: subcat?.id || null,
      subcategoryLabel: subcat?.label || null,
      subsubcategoryId: subsub?.id || null,
      subsubcategoryLabel: subsub?.label || null,
      currency,
      description: description.trim(),
      date: Timestamp.fromDate(new Date(date)),
      accountId: accountId || null,
      // Znacznik dziesięciny trzymamy tylko przy przychodach — przy wydatku
      // pole nie ma sensu i zaśmiecałoby zapytania o pulę.
      tithe: type === 'income' ? tithe : false,
      updatedAt: Timestamp.now()
    }
    if (transferEdit) {
      Object.assign(data, { category: 'Przelew', categoryId: 'transfer', categoryIcon: 'IconTransfer',
        subcategoryId: null, subcategoryLabel: null, subsubcategoryId: null, subsubcategoryLabel: null, tithe: false })
    }
    try {
      // Jeden atomowy zapis (writeBatch): transakcja + korekty sald razem.
      // Przerwanie w połowie nie zostawi konta z rozjechanym saldem.
      const batch = writeBatch(db)
      const delta = type === 'income' ? parseAmount(amount) : -parseAmount(amount)
      if (editData) {
        batch.update(doc(db, 'users', user.uid, 'transactions', editData.id), data)
        const reversal = editData.type === 'income' ? -editData.amount : editData.amount
        // Konto transakcji mogło zostać usunięte — update na nieistniejącym
        // dokumencie wywala cały batch i edycji nie dałoby się nigdy zapisać
        // Istnienie konta sprawdzamy po wczytanej liście (bez strzału do sieci,
        // który przy słabym połączeniu potrafił zawisnąć i blokować zapis)
        const accExists = (id) => !!id && accounts.some(a => a.id === id)
        if (editData.accountId && editData.accountId === accountId) {
          // To samo konto: jedna korekta — dwa update'y na tym samym dokumencie
          // w batchu nadpisałyby się nawzajem zamiast zsumować
          if (accExists(accountId)) {
            batch.update(doc(db, 'users', user.uid, 'accounts', accountId), { balance: increment(reversal + delta) })
          }
        } else {
          if (accExists(editData.accountId)) {
            batch.update(doc(db, 'users', user.uid, 'accounts', editData.accountId), { balance: increment(reversal) })
          }
          if (accExists(accountId)) {
            batch.update(doc(db, 'users', user.uid, 'accounts', accountId), { balance: increment(delta) })
          }
        }
      } else {
        batch.set(doc(collection(db, 'users', user.uid, 'transactions')), { ...data, createdAt: Timestamp.now() })
        if (accountId) {
          batch.update(doc(db, 'users', user.uid, 'accounts', accountId), { balance: increment(delta) })
        }
      }
      await batch.commit()
      onClose()
    } catch { setError('Błąd zapisu. Spróbuj ponownie.'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{transferEdit ? 'Edytuj przelew' : editData ? 'Edytuj transakcję' : 'Nowa transakcja'}</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="form">
          {transferEdit && (
            <p className="form-hint" style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Przelew między Twoimi kontami ({type === 'income' ? 'wpływ' : 'wypływ'}) — nie liczy się do przychodów ani wydatków.
            </p>
          )}
          {!transferEdit && <div className="type-toggle">
            <button type="button" className={`type-btn ${type === 'expense' ? 'active expense' : ''}`} onClick={() => setType('expense')}>Wydatek</button>
            <button type="button" className={`type-btn ${type === 'income' ? 'active income' : ''}`} onClick={() => setType('income')}>Przychód</button>
          </div>}

          {type === 'income' && titheOn && !transferEdit && (
            <button type="button" className={`tithe-toggle${tithe ? ' on' : ''}`}
              onClick={() => setTithe(v => !v)} aria-pressed={tithe}>
              <span className="tithe-toggle-box">{tithe && <IconCheck size={12} />}</span>
              <span className="tithe-toggle-text">
                Wlicz do dziesięciny
                <span className="tithe-toggle-hint">kwota trafi do puli w module Dziesięcina</span>
              </span>
            </button>
          )}

          <div className="form-group">
            <label>Kwota</label>
            {/* Waluta obok kwoty (nie pod) — jedna linia, bez dodatkowego wiersza. */}
            <div className="amount-row">
              <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0,00"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="form-input amount-input" />
              <select className="form-input currency-select" value={currency}
                onChange={e => setCurrency(e.target.value)} aria-label="Waluta">
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
          </div>

          {!transferEdit && <div className="form-group">
            <label>Kategoria</label>
            {!catsLoaded ? (
              <div className="list-loading">Ładowanie...</div>
            ) : (
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
            )}
          </div>}

          {!transferEdit && (() => {
            const selectedCat = categories.find(c => c.id === category)
            const subcats = selectedCat?.subcategories || []
            if (!subcats.length) return null
            return (
              <div className="form-group">
                <label>Podkategoria <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcjonalna)</span></label>
                <div className="category-icons-grid">
                  {subcats.map((sub, si) => {
                    const subColor = getSubcategoryColor(selectedCat.color, si)
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

          {!transferEdit && (() => {
            const sub = categories.find(c => c.id === category)?.subcategories?.find(s => s.id === subcategoryId)
            const list = sub?.subcategories || []
            if (!list.length) return null
            const color = categories.find(c => c.id === category)?.color || '#888888'
            return (
              <div className="form-group">
                <label>Pod-podkategoria <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcjonalna)</span></label>
                <div className="account-chips">
                  {list.map(ss => (
                    <button key={ss.id} type="button"
                      className={`account-chip ${subsubId === ss.id ? 'active' : ''}`}
                      style={subsubId === ss.id ? { borderColor: color, background: color + '22' } : {}}
                      onClick={() => setSubsubId(subsubId === ss.id ? '' : ss.id)}
                    >{ss.label}</button>
                  ))}
                </div>
              </div>
            )
          })()}

          {accounts.length > 0 && (() => {
            const top = sortedAccounts.slice(0, 4)
            const visible = showAllAccounts
              ? sortedAccounts
              : (accountId && !top.some(a => a.id === accountId)
                  ? [...top, sortedAccounts.find(a => a.id === accountId)].filter(Boolean)
                  : top)
            return (
              <div className="form-group">
                <label>Konto</label>
                <div className="account-chips">
                  {visible.map(acc => (
                    <button key={acc.id} type="button"
                      className={`account-chip ${accountId === acc.id ? 'active' : ''}`}
                      style={accountId === acc.id ? { borderColor: acc.color, background: acc.color + '22' } : {}}
                      onClick={() => setAccountId(acc.id)}
                    >{acc.name}</button>
                  ))}
                  {sortedAccounts.length > 4 && (
                    <button type="button" className="account-chip" onClick={() => setShowAllAccounts(v => !v)}>
                      {showAllAccounts ? '− mniej' : `+${sortedAccounts.length - 4} więcej`}
                    </button>
                  )}
                </div>
              </div>
            )
          })()}

          <div className="form-group">
            <label>Opis (opcjonalny)</label>
            <input type="text" placeholder="np. Biedronka, Spotify..."
              value={description} onChange={e => setDescription(e.target.value)}
              className="form-input" maxLength={100} />
          </div>

          <div className="form-group">
            <label>Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" />
          </div>

          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz zmiany' : 'Dodaj transakcję'}
          </button>
        </form>
      </div>
    </div>
  )
}
