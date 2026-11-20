import { useState } from 'react'
import { doc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { setDoc } from '../../utils/zapis'
import { toast } from '../Toast'
import { IconClose } from '../Icons'
import { GRUPY, ZONY, strefyGrupy, oczyscUkryte, strefyWord } from '../../utils/iplLogic'

// Wybór, które części ciała w ogóle śledzisz. Wyłączone strefy znikają z modelu,
// formularza i liczników; zapisane wcześniej zabiegi zostają w historii.

export default function WyborStref({ user, ukryte, wpisy, onClose }) {
  const [wylaczone, setWylaczone] = useState(() => new Set(ukryte))
  const [saving, setSaving]       = useState(false)

  const przelacz = (id) => setWylaczone(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const grupa = (g, wlacz) => setWylaczone(s => {
    const n = new Set(s)
    for (const z of strefyGrupy(g)) { if (wlacz) n.delete(z.id); else n.add(z.id) }
    return n
  })

  const aktywne = ZONY.length - wylaczone.size
  // Wyłączane strefy, w których są już zapisane zabiegi — uprzedzamy, że zostają w historii.
  const zHistoria = [...wylaczone].filter(id => wpisy.some(w => w.zone === id)).length

  const zapisz = async () => {
    if (aktywne === 0) { toast.error('Zostaw co najmniej jedną strefę'); return }
    setSaving(true)
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'ipl'), { ukryte: oczyscUkryte([...wylaczone]) }, { merge: true })
      onClose()
    } catch { toast.error('Nie udało się zapisać'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Śledzone strefy</h3>
          <button type="button" className="modal-close" aria-label="Zamknij" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <div className="form">
          <p className="auto-wskazowka">Zaznacz części ciała, które depilujesz. Pozostałe znikną z modelu i z formularza.</p>
          <div className="ipl-wybor">
            {GRUPY.map(g => {
              const lista = strefyGrupy(g.id)
              const wszystkie = lista.every(z => !wylaczone.has(z.id))
              return (
                <div key={g.id} className="ipl-wybor-grupa">
                  <div className="ipl-wybor-glowa">
                    <span>{g.label}</span>
                    <button type="button" className="ipl-link" onClick={() => grupa(g.id, !wszystkie)}>{wszystkie ? 'Wyłącz wszystko' : 'Włącz wszystko'}</button>
                  </div>
                  <div className="ipl-chipy">
                    {lista.map(z => (
                      <button key={z.id} type="button" className={`ipl-chip${wylaczone.has(z.id) ? '' : ' active'}`} aria-pressed={!wylaczone.has(z.id)} onClick={() => przelacz(z.id)}>
                        {z.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          {zHistoria > 0 && (
            <p className="auto-wskazowka">{zHistoria} wyłączon{zHistoria === 1 ? 'a strefa ma' : 'e strefy mają'} zapisane zabiegi — zostają w historii.</p>
          )}
          <button type="button" className="btn-save" disabled={saving || aktywne === 0} onClick={zapisz}>
            {saving ? 'Zapisywanie…' : `Zapisz (${aktywne} ${strefyWord(aktywne)})`}
          </button>
        </div>
      </div>
    </div>
  )
}
