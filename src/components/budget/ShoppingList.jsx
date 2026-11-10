import { useState, useEffect } from 'react'
import { collection, query, addDoc, updateDoc, deleteDoc, doc, Timestamp, orderBy, setDoc, increment, writeBatch } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { format } from 'date-fns'
import { DonutStat } from '../ChartPrimitives'
import { fmt, getCurrencyCode, parseAmount } from '../../utils/currency'
import { EXPENSE_CATEGORIES } from '../TransactionForm'
import { CatIcon, IconTrash, IconClose, IconTag, IconShopping, IconCheck } from '../Icons'
import { DEFAULT_COLOR } from '../../utils/palette'
import { IconPicker, ColorPicker } from '../Pickers'
import { confirmDialog } from '../ConfirmModal'
import { bladSubskrypcji } from '../../utils/polaczenie'

const COLORS = ['#C94B28','#6366f1','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6']

export default function ShoppingList({ user }) {
  const [items, setItems]       = useState([])
  const [shopCats, setShopCats] = useState(null)
  const [loading, setLoading]   = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [showAdd, setShowAdd]   = useState(false)
  const [showTx, setShowTx]     = useState(null)
  const [showCatMgr, setShowCatMgr] = useState(false)
  const [tab, setTab]           = useState('planned')

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'shoppingItems'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, bladSubskrypcji('shoppingItems'))
  }, [user.uid])

  useEffect(() => {
    return onSnapshot(doc(db, 'users', user.uid, 'settings', 'shopCategories'), d => {
      if (d.exists() && d.data().categories?.length) {
        setShopCats(d.data().categories)
      } else {
        setShopCats(EXPENSE_CATEGORIES)
      }
    }, bladSubskrypcji('settings/shopCategories'))
  }, [user.uid])

  const planned = items.filter(i => i.status !== 'bought')
  const bought  = items.filter(i => i.status === 'bought')

  const handleDelete = async (id) => {
    const ok = await confirmDialog({ title: 'Usunąć produkt?', confirmLabel: 'Usuń' })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'shoppingItems', id))
  }

  const handleBuy = async (item, actualPrice) => {
    await updateDoc(doc(db, 'users', user.uid, 'shoppingItems', item.id), {
      status: 'bought',
      boughtPrice: parseAmount(actualPrice) || item.estimatedPrice || 0,
      boughtDate: format(new Date(), 'yyyy-MM-dd')
    })
  }

  const categories = shopCats || EXPENSE_CATEGORIES

  const catMap = {}
  planned.forEach(i => {
    const c = categories.find(c => c.id === i.category)
    const key = c?.label || 'Inne'
    catMap[key] = (catMap[key] || 0) + (i.estimatedPrice || 0)
  })
  const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value })).filter(d => d.value > 0)

  if (loading || shopCats === null) return <div className="list-loading">Ładowanie...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
            {planned.length} do kupienia · szacunkowo {fmt(planned.reduce((s, i) => s + (i.estimatedPrice || 0), 0))}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="icon-btn" onClick={() => setShowCatMgr(true)} title="Kategorie zakupów"><IconTag size={15} /></button>
          <button className="btn-add-habit" onClick={() => setShowAdd(true)}>+ Dodaj</button>
        </div>
      </div>

      <div className="habit-view-tabs">
        <button className={`habit-view-tab ${tab === 'planned' ? 'active' : ''}`} onClick={() => setTab('planned')}>Do kupienia ({planned.length})</button>
        <button className={`habit-view-tab ${tab === 'bought'  ? 'active' : ''}`} onClick={() => setTab('bought')}>Kupione ({bought.length})</button>
      </div>

      {tab === 'planned' && (
        <>
          {planned.length === 0 ? (
            <div className="list-empty"><p>Lista pusta</p><p className="list-empty-hint">Kliknij "+ Dodaj" aby dodać produkt</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {planned.map(item => {
                const cat = categories.find(c => c.id === item.category)
                return (
                  <div key={item.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {cat?.icon ? <CatIcon categoryId={null} emoji={cat.icon} size={22} /> : <IconShopping size={22} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{item.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                        {cat?.label}{item.estimatedPrice ? ` · ~${fmt(item.estimatedPrice)}` : ''}
                        {item.note ? ` · ${item.note}` : ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setShowTx(item)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '5px 10px', background: 'rgba(39,174,96,0.15)', border: '1px solid #27AE6060', borderRadius: 8, color: '#27AE60', cursor: 'pointer', fontWeight: 700 }}>
                        Kup <IconCheck size={13} />
                      </button>
                      <button className="t-btn delete" onClick={() => handleDelete(item.id)}><IconTrash size={13} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {pieData.length > 0 && (
            <div className="chart-section" style={{ marginTop: 8 }}>
              <h3 className="chart-title">Kategorie zakupów (szacunkowo)</h3>
              <DonutStat
                data={pieData}
                colors={pieData.map((_, i) => COLORS[i % COLORS.length])}
                size={170} thickness={24}
              />
            </div>
          )}
        </>
      )}

      {tab === 'bought' && (
        bought.length === 0 ? (
          <div className="list-empty"><p>Brak kupionych produktów</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bought.map(item => {
              const cat = categories.find(c => c.id === item.category)
              return (
                <div key={item.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.75 }}>
                  {cat?.icon ? <CatIcon categoryId={null} emoji={cat.icon} size={22} /> : <IconShopping size={22} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, textDecoration: 'line-through', color: 'var(--text-muted)' }}>{item.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                      {item.boughtDate} · zapłacono {fmt(item.boughtPrice || 0)}
                    </p>
                  </div>
                  <button className="t-btn delete" onClick={() => handleDelete(item.id)}><IconTrash size={13} /></button>
                </div>
              )
            })}
          </div>
        )
      )}

      {showAdd && <AddItemModal user={user} categories={categories} onClose={() => setShowAdd(false)} />}
      {showTx && <BuyModal item={showTx} user={user} categories={categories} onBuy={handleBuy} onClose={() => setShowTx(null)} />}
      {showCatMgr && <ShopCategoryManager user={user} categories={shopCats} onClose={() => setShowCatMgr(false)} />}
    </div>
  )
}

/* ─── ShopCategoryManager ─── */
function ShopCategoryManager({ user, categories, onClose }) {
  const [showAdd, setShowAdd] = useState(false)
  const cats = categories || EXPENSE_CATEGORIES

  const save = async (next) => {
    await setDoc(doc(db, 'users', user.uid, 'settings', 'shopCategories'), { categories: next })
  }

  const handleDelete = async (id) => {
    const ok = await confirmDialog({ title: 'Usunąć kategorię?' })
    if (!ok) return
    save(cats.filter(c => c.id !== id))
  }

  const handleAdd = (cat) => {
    save([...cats, cat])
    setShowAdd(false)
  }

  const handleReset = async () => {
    const ok = await confirmDialog({ title: 'Przywrócić domyślne?', message: 'Wszystkie własne kategorie zostaną usunięte.', confirmLabel: 'Przywróć', danger: false })
    if (!ok) return
    await setDoc(doc(db, 'users', user.uid, 'settings', 'shopCategories'), { categories: EXPENSE_CATEGORIES })
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-tall">
        <div className="modal-header">
          <h3><IconTag size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Kategorie zakupów</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
            {cats.map(cat => (
              <div key={cat.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '8px 12px'
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: (cat.color || '#C94B28') + '33', border: `1.5px solid ${cat.color || '#C94B28'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {cat.icon ? <CatIcon categoryId={null} emoji={cat.icon} size={18} /> : <IconTag size={18} />}
                </div>
                <span style={{ flex: 1, fontSize: 14 }}>{cat.label}</span>
                <button className="t-btn delete" onClick={() => handleDelete(cat.id)}><IconTrash size={13} /></button>
              </div>
            ))}
          </div>

          {showAdd ? (
            <AddShopCategoryForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} existingIds={cats.map(c => c.id)} />
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-add-account" style={{ flex: 1 }} onClick={() => setShowAdd(true)}>+ Dodaj kategorię</button>
              <button onClick={handleReset}
                style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
                Resetuj
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── AddShopCategoryForm ─── */
function AddShopCategoryForm({ onAdd, onCancel, existingIds }) {
  const [label, setLabel]   = useState('')
  const [icon, setIcon]     = useState('IconShopping')
  const [color, setColor]   = useState(DEFAULT_COLOR)
  const [error, setError]   = useState('')

  const handleAdd = () => {
    if (!label.trim()) { setError('Wpisz nazwę'); return }
    const id = `shop_${label.trim().toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`
    onAdd({ id, label: label.trim(), icon, color })
  }

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Nowa kategoria</p>

      <div className="form-group" style={{ margin: 0 }}>
        <label>Nazwa</label>
        <input type="text" className="form-input" value={label} onChange={e => setLabel(e.target.value)}
          placeholder="np. Elektronika, Owoce..." maxLength={30} />
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label>Ikona</label>
        <IconPicker value={icon} onChange={setIcon} color={color} />
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label>Kolor</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      {error && <p className="form-error" style={{ margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-save" onClick={handleAdd} style={{ flex: 1 }}>Dodaj</button>
        <button type="button" onClick={onCancel}
          style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--radius)', padding: 12, cursor: 'pointer', fontSize: 14 }}>
          Anuluj
        </button>
      </div>
    </div>
  )
}

/* ─── AddItemModal ─── */
function AddItemModal({ user, categories, onClose }) {
  const [name, setName]           = useState('')
  const [category, setCategory]   = useState(categories[0]?.id || 'inne')
  const [estimatedPrice, setPrice] = useState('')
  const [note, setNote]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [showCatMgr, setShowCatMgr] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Wpisz nazwę produktu'); return }
    setSaving(true)
    await addDoc(collection(db, 'users', user.uid, 'shoppingItems'), {
      name: name.trim(), category, note: note.trim(),
      estimatedPrice: parseAmount(estimatedPrice) || 0,
      status: 'planned',
      createdAt: Timestamp.now()
    })
    onClose()
  }

  return (
    <>
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Dodaj do listy</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={handleAdd} className="form">
          <div className="form-group">
            <label>Produkt</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="np. Masło, Słuchawki..." maxLength={80} />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ margin: 0 }}>Kategoria</label>
              <button type="button" onClick={() => setShowCatMgr(true)}
                style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textDecoration: 'underline' }}>
                + zarządzaj
              </button>
            </div>
            <div className="mood-emotions">
              {categories.map(c => (
                <button key={c.id} type="button"
                  className={`mood-emotion-btn ${category === c.id ? 'active' : ''}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...(category === c.id ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--text)' } : {}) }}
                  onClick={() => setCategory(c.id)}
                ><CatIcon categoryId={null} emoji={c.icon} size={15} /> {c.label}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Szacowana cena (opcjonalnie)</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" className="form-input" value={estimatedPrice} onChange={e => setPrice(e.target.value)} placeholder="0,00" />
          </div>

          <div className="form-group">
            <label>Notatka (opcjonalnie)</label>
            <input type="text" className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="np. marki, rozmiar..." maxLength={100} />
          </div>

          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Dodawanie...' : 'Dodaj do listy'}
          </button>
        </form>
      </div>
    </div>

    {showCatMgr && (
      <ShopCategoryManager user={user} categories={categories} onClose={() => setShowCatMgr(false)} />
    )}
    </>
  )
}

/* ─── BuyModal ─── */
function BuyModal({ item, user, categories, onBuy, onClose }) {
  const [price, setPrice]       = useState(item.estimatedPrice?.toString() || '')
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState([])
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'accounts'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('accounts'))
  }, [user.uid])

  const handleConfirm = async () => {
    setSaving(true)
    const actualPrice = parseAmount(price) || 0
    if (actualPrice > 0) {
      const cat = categories.find(c => c.id === item.category) || { label: 'Zakupy', id: 'zakupy', icon: 'IconShopping' }
      // Atomowo: transakcja zakupu + saldo konta w jednym batchu
      const batch = writeBatch(db)
      batch.set(doc(collection(db, 'users', user.uid, 'transactions')), {
        type: 'expense', amount: actualPrice,
        category: cat.label, categoryId: cat.id, categoryIcon: cat.icon,
        description: item.name,
        date: Timestamp.now(), accountId: accountId || null,
        createdAt: Timestamp.now(), updatedAt: Timestamp.now()
      })
      if (accountId) {
        batch.update(doc(db, 'users', user.uid, 'accounts', accountId), { balance: increment(-actualPrice) })
      }
      await batch.commit()
    }
    await onBuy(item, price)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconCheck size={16} /> Kupione: {item.name}</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <div className="form">
          <div className="form-group">
            <label>Zapłacona cena ({getCurrencyCode()})</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" className="form-input amount-input" value={price}
              onChange={e => setPrice(e.target.value)} />
          </div>

          {accounts.length > 0 && (
            <div className="form-group">
              <label>Konto (opcjonalne)</label>
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

          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0' }}>
            Zakup zostanie dodany do wydatków jako transakcja.
          </p>

          <button className="btn-save" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Zapisywanie...' : 'Potwierdź zakup'}
          </button>
        </div>
      </div>
    </div>
  )
}
