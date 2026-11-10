import { db } from '../../firebase/config'
import { toggleChecked } from '../../utils/prayerList'
import { toast } from '../Toast'
import { format } from 'date-fns'
import { doc } from 'firebase/firestore'
import { updateDoc } from '../../utils/zapis'

// Drobiazgi używane przez kilka widoków Modlitwy naraz.
// Osobny plik zamiast duplikatów albo importu „w bok" między widokami —
// tak nie powstaje cykl importów przy kolejnym podziale.

export const TODAY = () => format(new Date(), 'yyyy-MM-dd')

// Odhaczenie pojedynczego punktu listy przy prośbie. Potrzebują tego dwa
// widoki — „Dziś" i szczegóły osoby — więc przyjmuje uid zamiast domykać się
// nad stanem któregokolwiek z nich.
export async function toggleChecklistItem(uid, item, id) {
  try {
    await updateDoc(doc(db, 'users', uid, 'prayerIntentions', item.id), {
      checklistDone: toggleChecked(item.checklistDone || [], id),
    })
  } catch {
    // Odhaczenie punktu to drobna akcja — nie wywracamy przez nią widoku.
    // Ale i nie połykamy jej bez słowa: wcześniej `.catch(() => {})` sprawiał,
    // że nieudany zapis wyglądał identycznie jak udany.
    toast.error('Nie udało się zapisać odhaczenia')
  }
}

export const kicker = (t) => (
  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{ display: 'inline-block', width: 14, height: 2, borderRadius: 2, background: 'var(--accent)', opacity: 0.6 }} />
    {t}
  </div>
)
