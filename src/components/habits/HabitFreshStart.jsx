import { useState } from 'react'
import { doc } from 'firebase/firestore'
import { writeBatch } from '../../utils/zapis'
import { format } from 'date-fns'
import { db } from '../../firebase/config'
import { CatIcon, IconClose, IconCheck, IconFlame, IconStar } from '../Icons'
import { freshStartSummary, isOptionalHabit, habitDoneDates } from '../../utils/habitLogic'
import { habitPeriodLabel } from '../../utils/habitStats'
import HabitTimeline from './HabitTimeline'
import { toast } from '../Toast'

// „Zacznij od nowa" — zamknięcie rozdziału jednym ruchem, zamiast wchodzenia w
// każdy nawyk po kolei i ustawiania daty zakończenia.
//
// Najpierw POKAZUJEMY dorobek, dopiero potem go zamykamy: inaczej miesiące
// pracy znikają z listy dnia bez jednego podsumowania. To, co tu widać, zostaje
// potem w „Ukończone i archiwum" — nic nie jest kasowane.
//
// Zamknięcie to endDate = dziś, czyli dokładnie to samo, co „Ukończ nawyk" przy
// pojedynczej pozycji. Każdy da się później wznowić.
export default function HabitFreshStart({ user, habits = [], pauses = [], onClose }) {
  const [wybrane, setWybrane] = useState(() => new Set(habits.map(h => h.id)))
  const [zapis, setZapis] = useState(false)

  const doZamkniecia = habits.filter(h => wybrane.has(h.id))
  const s = freshStartSummary(doZamkniecia, pauses)
  const okres = habitPeriodLabel(s.from, s.to)

  const przelacz = (id) => setWybrane(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const zamknij = async () => {
    if (doZamkniecia.length === 0) return
    setZapis(true)
    try {
      const dzis = format(new Date(), 'yyyy-MM-dd')
      const batch = writeBatch(db)
      for (const h of doZamkniecia) {
        batch.update(doc(db, 'users', user.uid, 'habits', h.id), { endDate: dzis })
      }
      await batch.commit()
      toast.success(`Zamknięte: ${doZamkniecia.length}. Znajdziesz je w „Ukończone i archiwum".`)
      onClose()
    } catch {
      setZapis(false)
      toast.error('Nie udało się zamknąć — spróbuj jeszcze raz.')
    }
  }

  const kafelek = (wartosc, opis, Icon, kolor) => (
    <div style={{ minWidth: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: kolor || 'var(--text)' }}>
        {Icon && <Icon size={13} />}
        <span style={{ fontSize: 18, fontWeight: 700 }}>{wartosc}</span>
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>
        {opis}
      </div>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Zacznij od nowa</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>

        <div className="form">
          {habits.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Nie masz aktywnych nawyków — nie ma czego zamykać.
            </p>
          ) : (
            <>
              <p className="pause-info">
                Zamyka wybrane nawyki na dziś i czyści listę dnia. Nic nie znika:
                wszystko ląduje w „Ukończone i archiwum" z całą historią, a każdy
                nawyk da się stamtąd wznowić.
              </p>

              {/* Dorobek — to, co zamykasz */}
              {doZamkniecia.length > 0 && (
                <div className="card" style={{ padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Co masz za sobą{okres ? ` · ${okres}` : ''}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
                    {kafelek(s.completions, 'odhaczeń', IconCheck, 'var(--accent)')}
                    {kafelek(s.best, 'rekord serii', IconFlame, 'var(--warn)')}
                    {kafelek(s.count, 'nawyków', IconStar)}
                    {s.totals.map(t => (
                      <div key={t.unit} style={{ minWidth: 72 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{t.label}</div>
                        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>
                          na to poszło
                        </div>
                      </div>
                    ))}
                  </div>
                  {s.from && (
                    <div style={{ marginTop: 14 }}>
                      <HabitTimeline habits={doZamkniecia} />
                    </div>
                  )}
                </div>
              )}

              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 7 }}>
                Co zamykasz ({doZamkniecia.length} z {habits.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {habits.map(h => {
                  const zazn = wybrane.has(h.id)
                  const color = h.color || 'var(--accent)'
                  return (
                    <button key={h.id} type="button" onClick={() => przelacz(h.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                        background: 'var(--surface2)', borderRadius: 10, padding: '8px 10px',
                        border: `1px solid ${zazn ? color + '66' : 'var(--border)'}`,
                        opacity: zazn ? 1 : 0.5, textAlign: 'left', fontFamily: 'inherit', color: 'var(--text)',
                      }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center',
                        background: zazn ? color : 'transparent', border: `1.5px solid ${zazn ? color : 'var(--border-strong)'}`,
                        color: '#fff',
                      }}>
                        {zazn && <IconCheck size={11} />}
                      </span>
                      <span style={{
                        width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'grid', placeItems: 'center',
                        background: color + '1c', border: `1px solid ${color}40`, color,
                      }}>
                        <CatIcon categoryId={null} emoji={h.emoji} size={13} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {h.name}
                      </span>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {isOptionalHabit(h) ? 'wyzwanie · ' : ''}{habitDoneDates(h).length}x
                      </span>
                    </button>
                  )
                })}
              </div>

              <button className="btn-save" onClick={zamknij} disabled={zapis || doZamkniecia.length === 0}>
                {zapis ? 'Zamykanie...' : `Zamknij rozdział (${doZamkniecia.length})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
