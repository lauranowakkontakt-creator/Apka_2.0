import { useState, useEffect } from 'react'
import { collection, query, addDoc, updateDoc, deleteDoc, doc, Timestamp, orderBy } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { fmt, parseAmount } from '../../utils/currency'
import { IconEdit, IconTrash, IconClose, IconSavings } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { ColorPicker } from '../Pickers'
import { APP_COLORS } from '../../utils/palette'
import { toast } from '../Toast'
import { bladSubskrypcji } from '../../utils/polaczenie'

export default function SavingsGoals({ user, onClose }) {
  const [goals, setGoals]       = useState([])
  const [loading, setLoading]   = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [showForm, setShowForm] = useState(false)
  const [editGoal, setEditGoal] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'savingsGoals'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, bladSubskrypcji('savingsGoals'))
  }, [user.uid])

  const handleDelete = async (id) => {
    const ok = await confirmDialog({ title: 'Usunąć cel oszczędnościowy?' })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'savingsGoals', id))
  }

  const goalsWithTarget = goals.filter(g => !g.noTarget)
  const totalTarget = goalsWithTarget.reduce((s, g) => s + (g.targetAmount || 0), 0)
  const totalSaved  = goals.reduce((s, g) => s + (g.currentAmount || 0), 0)

  return (
    <>
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal modal-tall">
          <div className="modal-header">
            <h3><IconSavings size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />Cele oszczędnościowe</h3>
            <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
          </div>

          {loading ? <div className="list-loading">Ładowanie...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {goals.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px' }}>Cel łączny</p>
                    <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{fmt(totalTarget)}</p>
                  </div>
                  <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px' }}>Odłożone łącznie</p>
                    <p style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--income)' }}>{fmt(totalSaved)}</p>
                  </div>
                </div>
              )}

              <button className="btn-add-account" onClick={() => { setEditGoal(null); setShowForm(true) }}>
                + Dodaj cel
              </button>

              {goals.length === 0 ? (
                <div className="list-empty">
                  <p>Brak celów oszczędnościowych</p>
                  <p className="list-empty-hint">Dodaj np. wakacje, nowy telefon, wkład własny</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {goals.map(goal => {
                    const color = goal.color || '#3B82F6'
                    const pct = (!goal.noTarget && goal.targetAmount > 0)
                      ? Math.min(100, ((goal.currentAmount || 0) / goal.targetAmount) * 100)
                      : null
                    const remaining = pct !== null ? Math.max(0, (goal.targetAmount || 0) - (goal.currentAmount || 0)) : null
                    return (
                      <div key={goal.id} style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderLeft: `4px solid ${color}`, borderRadius: 14, padding: 14,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: pct !== null ? 10 : 0 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                            background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color,
                          }}>
                            <IconSavings size={19} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.name}</p>
                            {goal.notes && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.notes}</p>}
                            {goal.noTarget && (
                              <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--income)' }}>
                                {fmt(goal.currentAmount || 0)} odłożone
                              </p>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button className="t-btn" onClick={() => { setEditGoal(goal); setShowForm(true) }}><IconEdit size={13} /></button>
                            <button className="t-btn delete" onClick={() => handleDelete(goal.id)}><IconTrash size={13} /></button>
                          </div>
                        </div>

                        {pct !== null && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                              <span style={{ color: 'var(--income)', fontWeight: 700 }}>{fmt(goal.currentAmount || 0)}</span>
                              <span style={{ color: 'var(--text-muted)' }}>cel: {fmt(goal.targetAmount || 0)}</span>
                            </div>
                            <div className="progress-bar-wrap" style={{ height: 8, borderRadius: 6 }}>
                              <div className="progress-bar" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--income)' : color, borderRadius: 6 }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                              <span style={{ fontWeight: 600 }}>{Math.round(pct)}%</span>
                              {pct < 100 && <span>brakuje {fmt(remaining)}</span>}
                              {pct >= 100 && <span style={{ color: 'var(--income)', fontWeight: 600 }}>Cel osiągnięty!</span>}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {showForm && (
        <GoalForm user={user} editData={editGoal} onClose={() => { setShowForm(false); setEditGoal(null) }} />
      )}
    </>
  )
}

function GoalForm({ user, editData, onClose }) {
  const [name, setName]         = useState(editData?.name || '')
  const [color, setColor]       = useState(editData?.color || APP_COLORS[17])
  const [noTarget, setNoTarget] = useState(editData?.noTarget ?? false)
  const [target, setTarget]     = useState(editData?.targetAmount?.toString() || '')
  const [current, setCurrent]   = useState(editData?.currentAmount?.toString() || '')
  const [notes, setNotes]       = useState(editData?.notes || '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Wpisz nazwę celu'); return }
    if (!noTarget && (!(parseAmount(target) > 0))) { setError('Podaj kwotę docelową'); return }
    setSaving(true)
    const data = {
      name: name.trim(),
      color,
      noTarget,
      targetAmount: noTarget ? 0 : parseAmount(target),
      currentAmount: parseAmount(current) || 0,
      notes: notes.trim(),
      updatedAt: Timestamp.now()
    }
    try {
      if (editData) {
        await updateDoc(doc(db, 'users', user.uid, 'savingsGoals', editData.id), data)
      } else {
        await addDoc(collection(db, 'users', user.uid, 'savingsGoals'), { ...data, createdAt: Timestamp.now() })
      }
      onClose()
    } catch { setError('Błąd zapisu'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{editData ? 'Edytuj cel' : 'Nowy cel'}</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="form">

          <div className="form-group">
            <label>Nazwa celu</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)}
              placeholder="np. Wakacje, Nowy laptop, Wkład własny..." autoFocus maxLength={50} />
          </div>

          <div className="form-group">
            <label>Kolor</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={noTarget} onChange={e => setNoTarget(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
              Odkładanie bez celu kwotowego
            </label>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Zaznacz, jeśli chcesz tylko śledzić ile odkładasz, bez konkretnej docelowej kwoty.
            </p>
          </div>

          {!noTarget && (
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Cel (kwota)</label>
                <input type="number" step="0.01" min="0" className="form-input" value={target}
                  onChange={e => setTarget(e.target.value)} placeholder="0,00" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Odłożone dotąd</label>
                <input type="number" step="0.01" min="0" className="form-input" value={current}
                  onChange={e => setCurrent(e.target.value)} placeholder="0,00" />
              </div>
            </div>
          )}

          {noTarget && (
            <div className="form-group">
              <label>Odłożone dotąd</label>
              <input type="number" inputMode="decimal" step="0.01" min="0" className="form-input" value={current}
                onChange={e => setCurrent(e.target.value)} placeholder="0,00" />
            </div>
          )}

          <div className="form-group">
            <label>Notatka (opcjonalna)</label>
            <input type="text" className="form-input" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="np. do kiedy, na co konkretnie..." maxLength={100} />
          </div>

          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz zmiany' : 'Dodaj cel'}
          </button>
        </form>
      </div>
    </div>
  )
}
