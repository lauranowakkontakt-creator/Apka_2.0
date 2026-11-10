import { useState } from 'react'
import { collection, doc, Timestamp } from 'firebase/firestore'
import { addDoc, updateDoc } from '../../utils/zapis'
import { db } from '../../firebase/config'
import { CURRENCIES as CURRENCY_LIST, parseAmount } from '../../utils/currency'
import { IconClose, IconBank, IconCash, IconCard, IconRepeat, IconSavings, IconTrendUp, IconPlus } from '../Icons'
import { ColorPicker } from '../Pickers'
import { DEFAULT_COLOR } from '../../utils/palette'

const ACCOUNT_TYPES = [
  { id: 'bank',       label: 'Konto bankowe', Icon: IconBank },
  { id: 'cash',       label: 'Gotówka',        Icon: IconCash },
  { id: 'card',       label: 'Karta',          Icon: IconCard },
  { id: 'revolut',    label: 'Revolut/Mobile', Icon: IconRepeat },
  { id: 'savings',    label: 'Oszczędności',   Icon: IconSavings },
  { id: 'investment', label: 'Inwestycje',      Icon: IconTrendUp },
]

const CURRENCIES = CURRENCY_LIST.map(c => c.code)

export default function AccountForm({ user, onClose, editData }) {
  // Konto z zapisanym typem spoza listy traktujemy jako „własny"
  const isKnownType = (t) => ACCOUNT_TYPES.some(at => at.id === t)
  const [name, setName]         = useState(editData?.name || '')
  const [type, setType]         = useState(editData ? (isKnownType(editData.type) ? editData.type : 'custom') : 'bank')
  const [customType, setCustomType] = useState(editData && !isKnownType(editData.type) ? (editData.typeName || '') : '')
  const [balance, setBalance]   = useState(editData?.balance?.toString() || '0')
  const [invested, setInvested] = useState(editData?.invested?.toString() || '')
  const [currency, setCurrency] = useState(editData?.currency || 'PLN')
  const [color, setColor]       = useState(editData?.color || DEFAULT_COLOR)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Wpisz nazwę konta'); return }
    if (type === 'custom' && !customType.trim()) { setError('Wpisz nazwę własnego typu'); return }
    setSaving(true)
    const typeName = type === 'custom'
      ? customType.trim()
      : (ACCOUNT_TYPES.find(t => t.id === type)?.label || type)
    // Dla własnego typu zapisujemy slug jako type, żeby filtry/ikony działały
    const storedType = type === 'custom' ? `custom:${customType.trim().toLowerCase()}` : type
    const data = { name: name.trim(), type: storedType, typeName, balance: parseAmount(balance) || 0, currency, color }
    // Inwestycje: zapisujemy dodatkowo kwotę wpłaconą (koszt) do liczenia zysku.
    if (type === 'investment') data.invested = parseAmount(invested) || 0
    try {
      if (editData) {
        await updateDoc(doc(db, 'users', user.uid, 'accounts', editData.id), data)
      } else {
        await addDoc(collection(db, 'users', user.uid, 'accounts'), { ...data, createdAt: Timestamp.now() })
      }
      onClose()
    } catch {
      setError('Błąd zapisu'); setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{editData ? 'Edytuj konto' : 'Nowe konto'}</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="form">
          {/* Typ konta */}
          <div className="form-group">
            <label>Typ konta</label>
            <div className="account-type-grid">
              {ACCOUNT_TYPES.map(t => (
                <button key={t.id} type="button"
                  className={`account-type-btn ${type === t.id ? 'active' : ''}`}
                  onClick={() => setType(t.id)}
                >
                  <t.Icon size={18} />
                  <span>{t.label}</span>
                </button>
              ))}
              <button type="button"
                className={`account-type-btn ${type === 'custom' ? 'active' : ''}`}
                onClick={() => setType('custom')}
              >
                <IconPlus size={18} />
                <span>Własny</span>
              </button>
            </div>
            {type === 'custom' && (
              <input type="text" className="form-input" value={customType}
                onChange={e => setCustomType(e.target.value)}
                placeholder="np. Kryptowaluty, Pożyczka, PayPal..." maxLength={30}
                style={{ marginTop: 8 }} />
            )}
          </div>

          {/* Nazwa */}
          <div className="form-group">
            <label>Nazwa (np. ING, Gotówka)</label>
            <input type="text" className="form-input" value={name}
              onChange={e => setName(e.target.value)} placeholder="Nazwa konta" maxLength={30} />
          </div>

          {/* Saldo / wartość i waluta */}
          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label>{type === 'investment' ? 'Aktualna wartość' : 'Aktualne saldo'}</label>
              <input type="number" inputMode="decimal" step="0.01" className="form-input" value={balance}
                onChange={e => setBalance(e.target.value)} />
            </div>
            <div className="form-group" style={{width:100}}>
              <label>Waluta</label>
              <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Inwestycje: ile łącznie wpłacone (koszt), do liczenia zysku/straty */}
          {type === 'investment' && (
            <div className="form-group">
              <label>Wpłacone łącznie (koszt)</label>
              <input type="number" inputMode="decimal" step="0.01" className="form-input" value={invested}
                onChange={e => setInvested(e.target.value)} placeholder="ile w sumie włożyłaś" />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                Wartość aktualizujesz później przyciskiem „Aktualizuj wartość".
              </p>
            </div>
          )}

          {/* Kolor */}
          <div className="form-group">
            <label>Kolor</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz zmiany' : 'Dodaj konto'}
          </button>
        </form>
      </div>
    </div>
  )
}
