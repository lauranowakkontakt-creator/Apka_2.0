import { db } from '../../firebase/config'
import { zaplanowane, zaIleDni, dataPL } from '../../utils/prayerAnswered'
import { confirmDialog } from '../ConfirmModal'
import { toast } from '../Toast'
import IntentionForm from './IntentionForm'
import RequestCard from './RequestCard'
import ZakonczProsbe from './ZakonczProsbe'
import { TODAY, toggleChecklistItem } from './wspolne'
import { arrayRemove, arrayUnion, doc } from 'firebase/firestore'
import { deleteDoc, updateDoc } from '../../utils/zapis'
import { useMemo, useState } from 'react'

// Zakładka „Zaplanowane” — prośby, których okno modlitwy jeszcze się nie
// zaczęło. Same wejdą do „Dziś” w swoim dniu. Modlić się można i wcześniej
// (przycisk działa jak zwykle), ale nic tu nie świeci jako zaległe.

export default function PlannedView({ user, intentions, people, carMode }) {
  const [editItem, setEditItem] = useState(null)
  const [konczona, setKonczona] = useState(null)
  const today = TODAY()
  const hiddenIds = useMemo(() => new Set(people.filter(p => p.hiddenInPrayer).map(p => p.id)), [people])
  const lista = useMemo(
    () => zaplanowane(intentions, today).filter(i => !(i.personId && hiddenIds.has(i.personId))),
    [intentions, today, hiddenIds]
  )

  const ref = (id) => doc(db, 'users', user.uid, 'prayerIntentions', id)
  const togglePrayed = async (item, date) => {
    const d = date || today
    try {
      await updateDoc(ref(item.id), { prayedDates: item.prayedDates?.includes(d) ? arrayRemove(d) : arrayUnion(d) })
    } catch { toast.error('Nie udało się zapisać modlitwy') }
  }
  const addNote = (id, text) => updateDoc(ref(id), { notes: arrayUnion({ text, date: today, id: Date.now().toString() }) })
  const editNote = async (item, note, text) => {
    await updateDoc(ref(item.id), { notes: arrayRemove(note) })
    await updateDoc(ref(item.id), { notes: arrayUnion({ ...note, text }) })
  }
  const deleteNote = (item, note) => updateDoc(ref(item.id), { notes: arrayRemove(note) })
  const deleteItem = async (id) => {
    if (await confirmDialog({ title: 'Usunąć prośbę?' })) await deleteDoc(ref(id))
  }

  // Grupy po dniu startu: „od 29.11 · za 12 dni”.
  const grupy = []
  for (const i of lista) {
    const g = grupy[grupy.length - 1]
    if (g?.od === i.scheduleFrom) g.items.push(i)
    else grupy.push({ od: i.scheduleFrom, items: [i] })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {lista.length === 0 ? (
        <div className="list-empty">
          <p>Nic nie czeka na później</p>
          <p className="list-empty-hint">Prośba z datą „Od kiedy” w przyszłości pojawi się tutaj, a w swoim dniu sama przejdzie do „Dziś”</p>
        </div>
      ) : grupy.map(g => (
        <div key={g.od} className="pray-planned-section">
          <div className="pray-planned-head">od {dataPL(g.od)} · {zaIleDni(g.od, today)}</div>
          {g.items.map(item => (
            <RequestCard
              key={item.id}
              item={item}
              user={user}
              carMode={carMode}
              viewDate={today}
              onTogglePrayed={togglePrayed}
              onAddNote={addNote}
              onToggleChecklistItem={(it, id) => toggleChecklistItem(user.uid, it, id)}
              onEditNote={editNote}
              onDeleteNote={deleteNote}
              onArchive={setKonczona}
              onEdit={() => setEditItem(item)}
              onDelete={deleteItem}
              showPerson
              person={people.find(p => p.id === item.personId)}
            />
          ))}
        </div>
      ))}

      {editItem && (
        <IntentionForm user={user} editData={editItem} personId={editItem.personId} people={people}
          allIntentions={intentions} onClose={() => setEditItem(null)} />
      )}
      {konczona && (
        <ZakonczProsbe user={user} item={konczona} person={people.find(p => p.id === konczona.personId)}
          onClose={() => setKonczona(null)} />
      )}
    </div>
  )
}
