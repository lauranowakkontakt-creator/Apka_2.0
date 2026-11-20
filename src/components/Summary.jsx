import { fmt, getCurrencyCode } from '../utils/currency'
import CurrencyTiles from './budget/CurrencyTiles'
const hide = '••••'

// Kafelki na komputerze — liczone tak samo jak „Saldo kont" na telefonie
// (waluta główna, a nie zawsze złotówki; inwestycje osobnym kafelkiem).
export default function Summary({ income, expenses, balance, privateMode, totalsByCurrency, hasAccounts, investTotalsByCurrency, fmtAcc }) {
  const p = privateMode
  const cur = getCurrencyCode()
  const entries = Object.entries(totalsByCurrency || {})
  const tylkoGlowna = entries.length === 0 || (entries.length === 1 && entries[0][0] === cur)
  const totalPLN = totalsByCurrency?.[cur] ?? 0
  const inwestycje = Object.entries(investTotalsByCurrency || {})
  const kolumny = 3 + (hasAccounts ? 1 : 0) + (inwestycje.length ? 1 : 0)

  return (
    <div className="summary-grid" style={{ gridTemplateColumns: kolumny > 4 ? "repeat(auto-fit, minmax(150px, 1fr))" : `repeat(${kolumny}, 1fr)` }}>
      {hasAccounts && (
        <div className={`summary-card balance ${totalPLN >= 0 ? 'positive' : 'negative'}`}>
          <span className="summary-label">Saldo kont</span>
          {p ? <span className="summary-amount">{hide}</span> : (
            tylkoGlowna
              ? <span className="summary-amount">{`${totalPLN >= 0 ? '+' : ''}${fmt(totalPLN)}`}</span>
              : <CurrencyTiles totals={totalsByCurrency} privateMode={p} compact />
          )}
        </div>
      )}
      {inwestycje.length > 0 && (
        <div className="summary-card balance">
          <span className="summary-label">Inwestycje</span>
          <span className="summary-amount">{p ? hide : inwestycje.map(([c, v]) => (fmtAcc ? fmtAcc(v, c) : fmt(v))).join(' · ')}</span>
        </div>
      )}
      <div className="summary-card income">
        <span className="summary-label">Przychody</span>
        <span className="summary-amount">{p ? hide : `+${fmt(income)}`}</span>
      </div>
      <div className="summary-card expenses">
        <span className="summary-label">Wydatki</span>
        <span className="summary-amount">{p ? hide : `-${fmt(expenses)}`}</span>
      </div>
      <div className={`summary-card balance ${balance >= 0 ? 'positive' : 'negative'}`}>
        <span className="summary-label">Saldo miesiąca</span>
        <span className="summary-amount">{p ? hide : `${balance >= 0 ? '+' : ''}${fmt(balance)}`}</span>
      </div>
    </div>
  )
}
