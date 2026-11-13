import { useState } from 'react'
import { updateDoc, doc } from 'firebase/firestore'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { db } from '../../firebase/config'
import { CatIcon, IconClose, IconArchive, IconRestore, IconCheck, IconFlame } from '../Icons'
import { habitCompletionSummary, amountTotals, amountStats, formatAmount,
  hasAmountGoal, byRecentlyClosed, lastTrace, isOptionalHabit,
  habitDoneDates } from '../../utils/habitLogic'
import { habitPeriodLabel } from '../../utils/habitStats'
import HabitTimeline from './HabitTimeline'
import SegTabs from '../SegTabs'

// „Ukończone i archiwum" — wszystko, co już się skończyło.
//
// Ekran jest zbudowany jak podsumowanie, a nie jak lista do zarządzania: na
// górze dorobek (ile tego było, ile czasu poszło) i oś czasu, bo to ich się tu
// szuka; dopiero pod spodem pozycje z akcjami. Wcześniej oś czasu była doklejona
// na samym dole, pod dwiema listami, więc trzeba było się do niej przewijać.
//
// Ukończone i archiwum rozdziela przełącznik, nie dwie sekcje jedna pod drugą:
// to dwa różne stany tej samej rzeczy i rzadko ogląda się je naraz.
const fmtDate = (d) => (d ? format(new Date(d + 'T12:00:00'), 'd MMM yyyy', { locale: pl }) : null)

export default function HabitArchive({ user, habits = [], endedHabits = [], pauses = [], onEdit, onClose }) {
  const patch = (h, data) => updateDoc(doc(db, 'users', user.uid, 'habits', h.id), data)
  const restore = (h) => patch(h, { archived: false })
  const archive = (h) => patch(h, { archived: true })
  const reopen  = (h) => patch(h, { endDate: null })

  const ukonczone = [...endedHabits].sort(byRecentlyClosed)
  const schowane  = [...habits].sort(byRecentlyClosed)
  const zamkniete = [...endedHabits, ...habits]
  const empty = zamkniete.length === 0

  const [tab, setTab] = useState(ukonczone.length > 0 ? 'ended' : 'archived')
  const lista = tab === 'ended' ? ukonczone : schowane

  const sumy = amountTotals(zamkniete)
  const odhaczen = zamkniete.reduce((n, h) => n + habitDoneDates(h).length, 0)
  const rekord = zamkniete.reduce((m, h) => Math.max(m, habitCompletionSummary(h, pauses).best), 0)

  const liczba = (wartosc, opis, kolor, Icon) => (
    <div style={{ minWidth: 64 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: kolor || 'var(--text)' }}>
        {Icon && <Icon size={13} />}
        <span style={{ fontSize: 19, fontWeight: 700, lineHeight: 1 }}>{wartosc}</span>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 4 }}>
        {opis}
      </div>
    </div>
  )

  const pozycja = (h) => {
    const s = habitCompletionSummary(h, pauses)
    const color = h.color || 'var(--accent)'
    const okres = habitPeriodLabel(s.first, s.last)
    const miary = hasAmountGoal(h) ? amountStats(h) : null
    const slad = lastTrace(h)

    return (
      <div key={h.id} style={{
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 12, borderLeft: `3px solid ${color}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => onEdit(h)} title="Otwórz nawyk"
            style={{
              flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              background: 'none', border: 'none', padding: 0, textAlign: 'left',
              fontFamily: 'inherit', color: 'var(--text)',
            }}>
            <span className="habit-emoji" style={{
              background: color + '1A', border: `1px solid ${color}40`, color, flexShrink: 0,
            }}>
              <CatIcon categoryId={null} emoji={h.emoji} size={15} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {h.name}
              </span>
              <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                {isOptionalHabit(h) && 'wyzwanie · '}
                {okres || (slad ? fmtDate(slad) : 'bez historii')}
              </span>
            </span>
          </button>

          {/* Akcje: ikony, nie przyciski z napisami — przy czterech pozycjach
              napisy robiły z listy ścianę tekstu. */}
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            {tab === 'ended' ? (
              <>
                <button className="icon-btn" title="Wznów — zdejmij datę zakończenia"
                  onClick={() => reopen(h)} style={{ width: 30, height: 30 }}>
                  <IconRestore size={14} />
                </button>
                <button className="icon-btn" title="Przenieś do archiwum"
                  onClick={() => archive(h)} style={{ width: 30, height: 30 }}>
                  <IconArchive size={14} />
                </button>
              </>
            ) : (
              <button className="icon-btn" title="Przywróć na listę dnia"
                onClick={() => restore(h)} style={{ width: 30, height: 30 }}>
                <IconRestore size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Dorobek pozycji — liczby zamiast zdania, żeby dało się je porównać
            między nawykami bez czytania. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10, paddingLeft: 2 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text)' }}>
            {s.total}<span style={{ color: 'var(--text-muted)' }}>x zrobione</span>
          </span>
          {s.best > 0 && (
            <span className="mono" style={{ fontSize: 11, color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconFlame size={11} />{s.best}<span style={{ color: 'var(--text-muted)' }}> rekord</span>
            </span>
          )}
          {miary && miary.total > 0 && (
            <span className="mono" style={{ fontSize: 11, color }}>
              {formatAmount(miary.total, miary.unit)}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Ukończone i archiwum</h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>

        <div className="form">
          {empty ? (
            <div style={{ textAlign: 'center', padding: '18px 0' }}>
              <div style={{ display: 'grid', placeItems: 'center', marginBottom: 10, color: 'var(--text-muted)' }}>
                <IconArchive size={26} />
              </div>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600 }}>Nic tu jeszcze nie ma</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Trafiają tu nawyki, które ukończysz albo schowasz do archiwum.
                Historia zostaje — każdy da się stąd wznowić.
              </p>
            </div>
          ) : (
            <>
              {/* Dorobek — pierwsze, co widać, bo po to się tu wchodzi. */}
              <div className="card" style={{
                padding: 16, marginBottom: 12,
                borderTop: '2px solid color-mix(in oklab, var(--accent) 80%, transparent)',
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
                  {liczba(odhaczen, 'odhaczeń', 'var(--accent)', IconCheck)}
                  {rekord > 0 && liczba(rekord, 'rekord serii', 'var(--warn)', IconFlame)}
                  {liczba(zamkniete.length, 'zamkniętych', undefined, IconArchive)}
                  {sumy.map(t => (
                    <div key={t.unit} style={{ minWidth: 64 }}>
                      <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{t.label}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 4 }}>
                        na to poszło
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16 }}>
                  <HabitTimeline habits={zamkniete} />
                </div>
              </div>

              <SegTabs
                items={[
                  { id: 'ended', label: `Ukończone (${ukonczone.length})` },
                  { id: 'archived', label: `Archiwum (${schowane.length})` },
                ]}
                active={tab} onChange={setTab} style={{ marginBottom: 10 }}
              />

              <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {tab === 'ended'
                  ? 'Nawyki po dacie zakończenia. Zeszły z listy dnia, ale wynik zostaje — wznów albo schowaj do archiwum.'
                  : 'Schowane ręcznie. Nie liczą się do serii ani statystyk; przywróć, żeby wróciły na listę dnia.'}
              </p>

              {lista.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic', margin: 0 }}>
                  {tab === 'ended' ? 'Nie masz ukończonych nawyków.' : 'Archiwum jest puste.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lista.map(pozycja)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
