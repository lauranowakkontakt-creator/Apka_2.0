import { collection, getDocs, getDoc, doc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { format } from 'date-fns'

// Wszystkie podkolekcje użytkownika
const COLLECTIONS = [
  'accounts', 'transactions', 'regularPayments', 'savingsGoals', 'shoppingItems', 'debtors',
  'habits', 'habitPauses', 'habitCategories', 'habitRoutines',
  'dreams', 'dreamCategories', 'dreamSymbols', 'dreamMemory',
  'moodLogs', 'todos', 'todoLists',
  'calendarEvents', 'calendarPeople', 'calendarCategories',
  'prayerIntentions', 'prayerPeople', 'bibleNotes',
  'notes', 'gratitude', 'memories',
]
// Pojedyncze dokumenty
const SINGLE_DOCS = [
  ['bible', 'progress'],
  ['settings', 'categories'],
  ['settings', 'shopCategories'],
  ['settings', 'tithe'],
  ['settings', 'calendar'],
  ['settings', 'habitPauses'],
]

// Firestore Timestamp → ISO string (czytelne i odtwarzalne)
function serialize(value) {
  if (value == null) return value
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(serialize)
  if (typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value)) out[k] = serialize(value[k])
    return out
  }
  return value
}

// Zapis pliku działający też na telefonie. Na urządzeniach dotykowych klasyczne
// pobranie przez <a download> jest ignorowane przez iOS Safari / PWA (klik w blob
// nic nie robi lub otwiera podgląd), więc używamy Web Share API — arkusz
// „Udostępnij" z opcją „Zapisz w Plikach". Na desktopie zostaje zwykłe pobranie.
// Zwraca false, gdy użytkownik anuluje udostępnianie (żeby nie pokazywać „Gotowe").
async function download(filename, content, type) {
  const blob = new Blob([content], { type })
  const coarse = typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)').matches
  if (coarse && typeof File !== 'undefined' && navigator.canShare) {
    const file = new File([blob], filename, { type })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename })
        return true
      } catch (e) {
        if (e?.name === 'AbortError') return false // anulowano — nie błąd
        // inny błąd → spróbuj klasycznego pobrania poniżej
      }
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return true
}

// Daty w czasie LOKALNYM. toISOString() liczy w UTC, więc wpis dodany po
// północy (00:00–02:00) trafiał do pliku z datą poprzedniego dnia.
const stamp = () => format(new Date(), 'yyyy-MM-dd')

// Pełna kopia wszystkich danych do JSON
export async function exportAllJSON(uid) {
  const data = { exportedAt: new Date().toISOString(), version: 1 }
  for (const name of COLLECTIONS) {
    const snap = await getDocs(collection(db, 'users', uid, name))
    data[name] = snap.docs.map(d => ({ id: d.id, ...serialize(d.data()) }))
  }
  data.singles = {}
  for (const [col, id] of SINGLE_DOCS) {
    const d = await getDoc(doc(db, 'users', uid, col, id))
    if (d.exists()) data.singles[`${col}/${id}`] = serialize(d.data())
  }
  return download(`moj-swiat-kopia-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json')
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Eksport transakcji do CSV (np. do Excela)
export async function exportTransactionsCSV(uid) {
  const [snap, accSnap] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'transactions')),
    getDocs(collection(db, 'users', uid, 'accounts')),
  ])
  // Nazwa konta zamiast id — plik ma być czytelny w Excelu i wracać przez import
  const accName = Object.fromEntries(accSnap.docs.map(d => [d.id, d.data().name]))
  const rows = snap.docs.map(d => {
    const t = d.data()
    const date = t.date?.toDate ? format(t.date.toDate(), 'yyyy-MM-dd') : ''
    const typ = t.categoryId === 'transfer' ? 'przelew wewnętrzny' : t.type === 'income' ? 'przychód' : 'wydatek'
    return [date, typ, t.type === 'expense' ? -t.amount : t.amount, t.currency || 'PLN', t.category, t.subcategoryLabel || '', t.subsubcategoryLabel || '', t.description || '', accName[t.accountId] || t.accountId || '']
  }).sort((a, b) => b[0].localeCompare(a[0]))
  const header = ['Data', 'Typ', 'Kwota', 'Waluta', 'Kategoria', 'Podkategoria', 'Pod-podkategoria', 'Opis', 'Konto']
  const csv = '﻿' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n')
  return download(`moj-swiat-transakcje-${stamp()}.csv`, csv, 'text/csv;charset=utf-8')
}
