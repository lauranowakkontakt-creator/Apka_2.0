import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { IconClose } from './Icons'

const ConfirmContext = createContext(null)

let _openConfirm = null

export const confirmDialog = ({ title, message, confirmLabel = 'Usuń', danger = true }) =>
  new Promise((resolve) => _openConfirm?.({ title, message, confirmLabel, danger, resolve }))

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const confirmRef = useRef(null)

  const open = useCallback((opts) => setDialog(opts), [])

  useEffect(() => {
    _openConfirm = open
    return () => { _openConfirm = null }
  }, [open])

  useEffect(() => {
    if (!dialog) return
    const handleKey = (e) => { if (e.key === 'Escape') cancel() }
    window.addEventListener('keydown', handleKey)
    setTimeout(() => confirmRef.current?.focus(), 50)
    return () => window.removeEventListener('keydown', handleKey)
  }, [dialog])

  const confirm = () => { dialog?.resolve(true);  setDialog(null) }
  const cancel  = () => { dialog?.resolve(false); setDialog(null) }

  return (
    <ConfirmContext.Provider value={open}>
      {children}
      {dialog && (
        <div className="modal-overlay" data-own-esc style={{ zIndex: 3000 }} onClick={(e) => e.target === e.currentTarget && cancel()}>
          <div className="modal" style={{ maxWidth: 360, animation: 'modalIn .15s ease' }}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <h3 style={{ fontSize: 16 }}>{dialog.title}</h3>
              <button aria-label="Zamknij" className="modal-close" onClick={cancel}><IconClose size={16} /></button>
            </div>
            {dialog.message && (
              <p style={{ margin: '6px 20px 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {dialog.message}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, padding: '16px 20px 20px' }}>
              <button
                ref={confirmRef}
                onClick={confirm}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 'var(--radius)',
                  border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                  background: dialog.danger ? 'var(--expense)' : 'var(--income)',
                  color: '#fff',
                }}
              >{dialog.confirmLabel}</button>
              <button
                onClick={cancel}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 500, fontSize: 14,
                  background: 'transparent', color: 'var(--text-muted)',
                }}
              >Anuluj</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
