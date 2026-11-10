import { db } from '../../firebase/config'
import { bladSubskrypcji } from '../../utils/polaczenie'
import { onSnapshot } from '../../utils/subskrypcje'
import {
  MEMORY_GOAL_DAYS, MEMORY_MAX_DETAILS, MEMORY_MIN_DETAILS, MEMORY_ROOMS,
  cleanMemoryDetails, memoryEntryValid, memoryStreak,
} from '../../utils/dreamForms'
import { confirmDialog } from '../ConfirmModal'
import { IconCheck, IconTrash } from '../Icons'
import { toast } from '../Toast'
import { Chip, TODAY, fmtDate } from './wspolne'
import { Timestamp, collection, doc, orderBy, query } from 'firebase/firestore'
import { addDoc, deleteDoc } from '../../utils/zapis'
import { useEffect, useMemo, useState } from 'react'

// Ćwiczenie pamięci (podręcznik kursu 201, rozdz. 4.3–4.4): wybierz pokój w domu,
// przejdź się po nim, zamknij oczy i przypomnij sobie 5–7 szczegółów.
// Codziennie przez tydzień. Trenuje to pamięć obrazów, a sny są obrazami.

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 14 }

export default function DreamMemory({ user }) {
  const [entries, setEntries] = useState([])
  const [room, setRoom] = useState('')
  const [details, setDetails] = useState(Array(MEMORY_MAX_DETAILS).fill(''))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'dreamMemory'), orderBy('date', 'desc'))
    return onSnapshot(q, snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji('dreamMemory'))
  }, [user.uid])

  const today = TODAY()
  const streak = useMemo(() => memoryStreak(entries.map(e => e.date), today), [entries, today])
  const doneToday = entries.some(e => e.date === today)
  const filled = cleanMemoryDetails(details).length
  const valid = memoryEntryValid(room, details)

  const save = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'users', user.uid, 'dreamMemory'), {
        date: today, room: room.trim(), details: cleanMemoryDetails(details), createdAt: Timestamp.now(),
      })
      setRoom(''); setDetails(Array(MEMORY_MAX_DETAILS).fill(''))
      toast.success('Ćwiczenie zapisane')
    } catch (err) {
      toast.error('Nie udało się zapisać: ' + (err?.message || 'błąd'))
    }
    setSaving(false)
  }

  const remove = async (e) => {
    const ok = await confirmDialog({ title: 'Usunąć to ćwiczenie?', message: `${e.room}, ${fmtDate(e.date)}` })
    if (!ok) return
    try { await deleteDoc(doc(db, 'users', user.uid, 'dreamMemory', e.id)) } catch { toast.error('Nie udało się usunąć') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Seria: {Math.min(streak, MEMORY_GOAL_DAYS)} z {MEMORY_GOAL_DAYS} dni</div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          {Array.from({ length: MEMORY_GOAL_DAYS }, (_, i) => (
            <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < streak ? 'var(--accent)' : 'var(--border)' }} />
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Nie pamiętamy snów, bo nie nauczono nas, jak je zapamiętywać. Wspomnienie to obraz, sny też. Ćwicz codziennie przez tydzień, każdego dnia w innym pokoju (niektóre możesz powtórzyć).
          {streak >= MEMORY_GOAL_DAYS && ' Tydzień zaliczony!'}
        </p>
      </div>

      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{doneToday ? 'Dzisiejsze ćwiczenie zrobione, możesz dodać kolejne' : 'Ćwiczenie na dziś'}</div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 1.7, color: 'var(--text-sub)' }}>
          <li>Wybierz pokój w swoim domu i przejdź się po nim. Zwróć uwagę na każdy zakamarek: meble, zasłony, lampy. Możesz użyć dotyku.</li>
          <li>Usiądź lub połóż się wygodnie i zamknij oczy.</li>
          <li>Przypomnij sobie 5–7 szczegółów i wpisz je poniżej.</li>
        </ol>

        <input className="form-input" value={room} maxLength={40} placeholder="Który pokój?" onChange={e => setRoom(e.target.value)} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {MEMORY_ROOMS.map(r => <Chip key={r} color="#7C8AF0" active={room === r} onClick={() => setRoom(r)}>{r}</Chip>)}
        </div>

        {details.map((d, i) => (
          <input key={i} className="form-input" value={d} maxLength={100} onChange={e => setDetails(details.map((x, k) => k === i ? e.target.value : x))}
            placeholder={`Szczegół ${i + 1}${i >= MEMORY_MIN_DETAILS ? ' (opcjonalnie)' : ''}`} />
        ))}
        <button type="button" className="btn-save" disabled={!valid || saving} onClick={save}>
          {saving ? 'Zapisywanie...' : `Zapisz ćwiczenie (${filled}/${MEMORY_MIN_DETAILS}+)`}
        </button>
      </div>

      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Czas zmierzchu</div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.7 }}>
          Chwila tuż przed zaśnięciem i krótkie momenty przebudzenia. Przygotuj się spokojnie do snu, powiedz sobie, że chcesz zapamiętać moment przebudzenia, i po obudzeniu zapisz sen od razu. Najlepsza pora na zapamiętanie to 4:00–5:00 rano.
        </p>
      </div>

      {entries.length > 0 && (
        <>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.16em', textTransform: 'uppercase', margin: '4px 2px 0' }}>Historia</div>
          {entries.map(e => (
            <div key={e.id} style={{ ...card, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <IconCheck size={16} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.room} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {fmtDate(e.date)}</span></div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6 }}>{(e.details || []).join(' · ')}</div>
              </div>
              <button className="t-btn delete" title="Usuń" onClick={() => remove(e)}><IconTrash size={13} /></button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
