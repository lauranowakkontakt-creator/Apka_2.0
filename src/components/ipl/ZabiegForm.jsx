import { useState } from 'react'
import { collection, doc, Timestamp } from 'firebase/firestore'
import { updateDoc, writeBatch } from '../../utils/zapis'
import { db } from '../../firebase/config'
import { toast } from '../Toast'
import { IconClose } from '../Icons'
import {
  GRUPY, ZONY, strefyGrupy, nazwaStrefy, OWLOSIENIE, ODRASTANIE, wpisyZabiegu, strefyWord,
  statStrefy, dawnoTemu,
} from '../../utils/iplLogic'
import { TODAY } from './wspolne'

// Zabieg: data, które strefy, owłosienie i szybkość odrastania. Zabieg kilku
// stref naraz zapisuje się jako osobny wpis dla każdej strefy (z tą samą datą).
// Przy edycji zmieniasz jeden wpis — strefy wtedy się nie zmieniają.

export default function ZabiegForm({ user, wpisy, startStrefy = [], wpis, onClose }) {
  const [date, setDate]         = useState(wpis?.date || TODAY())
  const [strefy, setStrefy]     = useState(wpis ? [wpis.zone] : startStrefy)
  const [hair, setHair]         = useState(Number.isInteger(wpis?.hair) ? wpis.hair : null)
  const [regrowth, setRegrowth] = useState(Number.isInteger(wpis?.regrowth) ? wpis.regrowth : null)
  const [note, setNote]         = useState(wpis?.note || '')
  const [saving, setSaving]     = useState(false)

  const przelacz = (id) => setStrefy(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const grupaWszystkie = (grupa) => {
    const ids = strefyGrupy(grupa).map(z => z.id)
    setStrefy(s => ids.every(id => s.includes(id)) ? s.filter(id => !ids.includes(id)) : [...new Set([...s, ...ids])])
  }

  // Podpowiedź dla jednej wybranej strefy: kiedy był poprzedni raz.
  const poprzedni = strefy.length === 1 && !wpis ? statStrefy(wpisy, strefy[0], date) : null

  const zapisz = async (e) => {
    e.preventDefault()
    if (strefy.length === 0) { toast.error('Zaznacz co najmniej jedną strefę'); return }
    setSaving(true)
    try {
      if (wpis) {
        await updateDoc(doc(db, 'users', user.uid, 'iplZabiegi', wpis.id), { date, hair, regrowth, note: note.trim() })
      } else {
        const batch = writeBatch(db)
        for (const w of wpisyZabiegu({ strefy, date, hair, regrowth, note })) {
          batch.set(doc(collection(db, 'users', user.uid, 'iplZabiegi')), { ...w, createdAt: Timestamp.now() })
        }
        await batch.commit()
      }
      onClose()
    } catch { toast.error('Nie udało się zapisać'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{wpis ? 'Edycja zabiegu' : 'Nowy zabieg'}</h3>
          <button type="button" className="modal-close" aria-label="Zamknij" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form className="form" onSubmit={zapisz}>
          <div className="form-group">
            <label htmlFor="ipl-data">Data</label>
            <input id="ipl-data" type="date" className="form-input" value={date} max={TODAY()} onChange={e => e.target.value && setDate(e.target.value)} />
          </div>

          {wpis ? (
            <div className="form-group">
              <label>Strefa</label>
              <div className="ipl-strefa-nazwa">{nazwaStrefy(wpis.zone)}</div>
            </div>
          ) : (
            <div className="form-group">
              <label>Strefy ({strefy.length} z {ZONY.length})</label>
              <div className="ipl-wybor">
                {GRUPY.map(g => {
                  const lista = strefyGrupy(g.id)
                  const wszystkie = lista.every(z => strefy.includes(z.id))
                  return (
                    <div key={g.id} className="ipl-wybor-grupa">
                      <div className="ipl-wybor-glowa">
                        <span>{g.label}</span>
                        <button type="button" className="ipl-link" onClick={() => grupaWszystkie(g.id)}>{wszystkie ? 'Wyczyść' : 'Zaznacz wszystko'}</button>
                      </div>
                      <div className="ipl-chipy">
                        {lista.map(z => (
                          <button key={z.id} type="button" className={`ipl-chip${strefy.includes(z.id) ? ' active' : ''}`} aria-pressed={strefy.includes(z.id)} onClick={() => przelacz(z.id)}>
                            {z.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Owłosienie przed zabiegiem</label>
            <div className="ipl-chipy">
              {OWLOSIENIE.map(o => (
                <button key={o.v} type="button" className={`ipl-chip${hair === o.v ? ' active' : ''}`} aria-pressed={hair === o.v} onClick={() => setHair(hair === o.v ? null : o.v)}>
                  {o.label}
                </button>
              ))}
            </div>
            <p className="auto-wskazowka">{hair == null ? 'Opcjonalnie — dzięki temu zobaczysz, czy włosów ubywa.' : OWLOSIENIE[hair].opis}</p>
          </div>

          <div className="form-group">
            <label>Jak szybko odrastały od ostatniego razu</label>
            <div className="ipl-chipy">
              {ODRASTANIE.map(o => (
                <button key={o.v} type="button" className={`ipl-chip${regrowth === o.v ? ' active' : ''}`} aria-pressed={regrowth === o.v} onClick={() => setRegrowth(regrowth === o.v ? null : o.v)}>
                  {o.label}
                </button>
              ))}
            </div>
            {poprzedni?.ostatni && (
              <p className="auto-wskazowka">Poprzednio: {dawnoTemu(poprzedni.dniOdOstatniego)}{poprzedni.sredniOdstep ? ` · średnio co ${poprzedni.sredniOdstep} dni` : ''}.</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="ipl-notatka">Notatka (opcjonalnie)</label>
            <input id="ipl-notatka" type="text" className="form-input" maxLength={160} placeholder="np. poziom mocy, reakcja skóry" value={note} onChange={e => setNote(e.target.value)} />
          </div>

          <button type="submit" className="btn-save" disabled={saving || strefy.length === 0}>
            {saving ? 'Zapisywanie…' : wpis ? 'Zapisz zmiany' : strefy.length > 0 ? `Zapisz zabieg (${strefy.length} ${strefyWord(strefy.length)})` : 'Zapisz zabieg'}
          </button>
        </form>
      </div>
    </div>
  )
}
