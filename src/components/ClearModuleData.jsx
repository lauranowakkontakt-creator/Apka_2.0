import { useState } from 'react'
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config'
import { MODULE_DATA } from '../utils/moduleData'
import { wPaczkach } from '../utils/zapisWPaczkach'
import { restartPolaczenia } from '../utils/restartPolaczenia'
import { confirmDialog } from './ConfirmModal'
import { toast } from './Toast'

// Trwałe wyczyszczenie danych jednego modułu — zawsze po pytaniu „czy na pewno".
export default function ClearModuleData({ uid }) {
  const [busy, setBusy] = useState(null)
  const [prog, setProg] = useState('')

  const clear = async (id) => {
    const m = MODULE_DATA[id]
    setBusy(id)
    try {
      const base = ['users', uid]
      const snaps = await Promise.all(m.collections.map(c => getDocs(collection(db, ...base, c))))
      const refs = snaps.flatMap(s => s.docs.map(d => d.ref)).concat(m.docs.map(([c, d]) => doc(db, ...base, c, d)))
      const count = snaps.reduce((n, s) => n + s.size, 0)
      const ok = await confirmDialog({
        title: `Wyczyścić cały moduł ${m.label}?`,
        message: `Trwale usunę ${count ? `${count} wpisów: ` : ''}${m.what}. Tego nie da się cofnąć. Jeśli chcesz mieć kopię, najpierw użyj „Pobierz pełną kopię” powyżej.`,
        confirmLabel: 'Tak, usuń wszystko',
      })
      if (!ok) { setBusy(null); return }
      setProg('')
      await wPaczkach(refs, { makeBatch: () => writeBatch(db), onStall: restartPolaczenia, apply: (b, r) => b.delete(r), onProgress: (d, t) => setProg(`${d} / ${t}`) })
      // Sprawdź, czy nic nie zostało (np. wpis dodany w trakcie) — i dokończ
      for (let runda = 0; runda < 3; runda++) {
        const left = (await Promise.all(m.collections.map(c => getDocs(collection(db, ...base, c))))).flatMap(s => s.docs.map(d => d.ref))
        if (!left.length) break
        await wPaczkach(left, { makeBatch: () => writeBatch(db), onStall: restartPolaczenia, apply: (b, r) => b.delete(r) })
      }
      toast.success(`Wyczyszczono: ${m.label}`)
    } catch (e) {
      console.error('Czyszczenie modułu:', e)
      toast.error(`Nie udało się (${e?.code || 'błąd'}). Spróbuj ponownie — usunie resztę.`)
    }
    setBusy(null)
  }

  const btn = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8,
    padding: '10px 14px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)',
    color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 6,
  }
  return (
    <div>
      {Object.entries(MODULE_DATA).map(([id, m]) => (
        <button key={id} style={btn} disabled={!!busy} onClick={() => clear(id)}>
          <span>{m.label}</span>
          <span style={{ fontSize: 11, color: 'var(--expense)' }}>{busy === id ? `Usuwam… ${prog}` : 'Wyczyść'}</span>
        </button>
      ))}
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 2px 0', lineHeight: 1.45 }}>
        Usuwa wszystkie dane wybranego modułu. Przed usunięciem zawsze zapytam, czy na pewno.
      </p>
    </div>
  )
}
