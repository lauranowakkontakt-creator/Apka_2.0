import { db } from '../../firebase/config'
import { wspomnienieZProsby } from '../../utils/prayerAnswered'
import { IcStones, IconArchive, IconClose } from '../Icons'
import { toast } from '../Toast'
import WspomnikForm from '../wspomnik/WspomnikForm'
import { TODAY } from './wspolne'
import { Timestamp, doc, updateDoc } from 'firebase/firestore'
import { useState } from 'react'

// Zakończenie prośby: „Bóg wysłuchał” albo zwykłe archiwum. Wysłuchana prośba
// od razu proponuje wpis we Wspomniku — z gotowym szkicem (tytuł, osoba, od
// kiedy i ile razy się modliłam), który można poprawić przed zapisem.
//
// `tylkoWspomnik` — prośba jest już w archiwum, chcemy tylko dopisać ją do
// Wspomnika (przycisk w Archiwum).

export default function ZakonczProsbe({ user, item, person, onClose, tylkoWspomnik = false }) {
  const [krok, setKrok]       = useState(tylkoWspomnik ? 'wspomnik' : 'wybor')
  const [notatka, setNotatka] = useState(item.endedNote || '')
  const [saving, setSaving]   = useState(false)
  const ref = doc(db, 'users', user.uid, 'prayerIntentions', item.id)

  const zakoncz = async (wysluchana) => {
    if (saving) return
    setSaving(true)
    try {
      await updateDoc(ref, {
        status: 'ended', endedAt: Timestamp.now(),
        endedNote: notatka.trim() || null,
        answered: wysluchana,
        ...(wysluchana ? { answeredAt: TODAY() } : {}),
      })
    } catch {
      toast.error('Nie udało się zapisać')
      setSaving(false)
      return
    }
    if (wysluchana) setKrok('wspomnik')
    else { toast.success('Prośba w archiwum'); onClose() }
  }

  if (krok === 'wspomnik') {
    return (
      <WspomnikForm
        user={user}
        prefill={{ ...wspomnienieZProsby(item, person, TODAY(), notatka), intentionId: item.id }}
        onSaved={(id) => updateDoc(ref, {
          remembranceId: id, answered: true, ...(item.answeredAt ? {} : { answeredAt: TODAY() }),
        })}
        onClose={onClose}
      />
    )
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Zakończyć prośbę?</h3>
          <button aria-label="Zamknij" className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
            {item.title}{person ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {person.name}</span> : null}
          </p>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Jak to się skończyło? (opcjonalnie)</label>
            <textarea className="form-input" rows={3} value={notatka} onChange={e => setNotatka(e.target.value)}
              maxLength={1000} placeholder="np. Wyniki wyszły dobre, operacja niepotrzebna"
              style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>
          <button type="button" className="btn-save pray-answered-btn" disabled={saving} onClick={() => zakoncz(true)}>
            <IcStones size={16} /> Bóg wysłuchał
          </button>
          <p style={{ margin: '-4px 0 0', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            Prośba trafi do archiwum, a we Wspomniku czeka gotowy wpis do poprawienia.
          </p>
          <button type="button" className="pray-archive-btn" disabled={saving} onClick={() => zakoncz(false)}>
            <IconArchive size={14} /> Tylko przenieś do archiwum
          </button>
        </div>
      </div>
    </div>
  )
}
