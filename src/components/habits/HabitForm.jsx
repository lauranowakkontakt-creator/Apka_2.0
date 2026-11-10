import { useState, useEffect } from 'react'
import { collection, doc, Timestamp, query, orderBy } from 'firebase/firestore'
import { addDoc, updateDoc, deleteDoc } from '../../utils/zapis'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { format } from 'date-fns'
import { CatIcon, IconClose, IconTrash, IconArchive, IconRestore, IconEdit, IconPlus, IconCheck } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { IconPicker, ColorPicker } from '../Pickers'
import { APP_COLORS } from '../../utils/palette'
import { toast } from '../Toast'
import HabitCategoryManager from './HabitCategoryManager'
import RoutineManager from './RoutineManager'
import { byRoutineOrder, HABIT_UNITS, unitMeta, formatAmount, habitLifecycle } from '../../utils/habitLogic'
import { bladSubskrypcji } from '../../utils/polaczenie'

export const HABIT_CATEGORIES = [
  { id: 'health',  label: 'Zdrowie',   icon: 'IcDrop' },
  { id: 'spirit',  label: 'Duchowość', icon: 'IcPray' },
  { id: 'learn',   label: 'Nauka',     icon: 'IcBookOpen' },
  { id: 'sport',   label: 'Sport',     icon: 'IcYoga' },
  { id: 'work',    label: 'Praca',     icon: 'IcBriefcase' },
  { id: 'other',   label: 'Inne',      icon: 'IcTarget' },
]
export const DEFAULT_HABIT_CATEGORIES = HABIT_CATEGORIES

const FREQ_DAYS = [
  { id: 1, label: 'Pn' }, { id: 2, label: 'Wt' }, { id: 3, label: 'Śr' },
  { id: 4, label: 'Cz' }, { id: 5, label: 'Pt' }, { id: 6, label: 'So' }, { id: 0, label: 'Nd' },
]

export default function HabitForm({ user, onClose, editData }) {
  const [name, setName]           = useState(editData?.name || '')
  const [iconKey, setIconKey]     = useState(editData?.emoji || 'IcTarget')
  const [color, setColor]         = useState(editData?.color || APP_COLORS[12])
  const [category, setCategory]   = useState(editData?.category || 'health')
  const [frequency, setFrequency] = useState(editData?.frequency || 'daily')
  const [freqDays, setFreqDays]   = useState(editData?.frequencyDays || [1,2,3,4,5,6,0])
  const [startDate, setStartDate] = useState(editData?.startDate || format(new Date(), 'yyyy-MM-dd'))
  const [hasEnd, setHasEnd]       = useState(!!editData?.endDate)
  const [endDate, setEndDate]     = useState(editData?.endDate || '')
  const [checklist, setChecklist] = useState(editData?.checklist || [])
  const [stepInput, setStepInput] = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [customCats, setCustomCats] = useState([])
  const [showCatMgr, setShowCatMgr] = useState(false)
  const [routineId, setRoutineId] = useState(editData?.routineId || null)
  // Wymagany = wchodzi do celu dnia. Dodatkowy = liczy się tylko na plus.
  const [optional, setOptional]   = useState(editData?.optional === true)
  // Miara: odhaczenie (jak dotad) albo cel liczbowy. Rozpoznajemy po `target`,
  // zeby istniejace nawyki zostaly tym, czym byly.
  const [mierzone, setMierzone]   = useState(Number(editData?.target) > 0)
  const [target, setTarget]       = useState(editData?.target ? String(editData.target) : '')
  const [unit, setUnit]           = useState(editData?.unit || 'min')
  const [wlasnaJedn, setWlasnaJedn] = useState(
    editData?.unit && !HABIT_UNITS.some(u => u.id === editData.unit) ? editData.unit : ''
  )
  const [routines, setRoutines]   = useState([])
  const [showRoutineMgr, setShowRoutineMgr] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'habitCategories'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setCustomCats(snap.docs.map(d => ({ id: d.id, label: d.data().name, icon: d.data().icon || 'IcTag', color: d.data().color }))), bladSubskrypcji('habitCategories'))
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'habitRoutines'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setRoutines(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byRoutineOrder)), bladSubskrypcji('habitRoutines'))
  }, [user.uid])

  const categories = [...HABIT_CATEGORIES, ...customCats]

  const toggleDay = (id) =>
    setFreqDays(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])

  const addStep = () => {
    const t = stepInput.trim()
    if (!t) return
    setChecklist(prev => [...prev, { id: Date.now().toString(36), title: t }])
    setStepInput('')
  }
  const removeStep = (id) => setChecklist(prev => prev.filter(s => s.id !== id))

  const getFreqDays = () => {
    if (frequency === 'daily')    return [0,1,2,3,4,5,6]
    if (frequency === 'weekdays') return [1,2,3,4,5]
    if (frequency === 'weekend')  return [0,6]
    return freqDays
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Wpisz nazwę'); return }
    if (frequency === 'custom' && freqDays.length === 0) { setError('Wybierz co najmniej 1 dzień'); return }
    setSaving(true)
    const data = {
      name: name.trim(), emoji: iconKey, color, category, frequency, frequencyDays: getFreqDays(), optional,
      // Cel liczbowy: null zdejmuje miare i nawyk wraca do zwyklego odhaczania.
      target: mierzone && Number(target) > 0 ? Number(target) : null,
      unit: mierzone ? (unit === '__wlasna' ? (wlasnaJedn.trim() || 'szt') : unit) : null,
      startDate, endDate: hasEnd && endDate ? endDate : null,
      checklist, routineId: routineId || null,
      updatedAt: Timestamp.now()
    }
    try {
      if (editData) {
        await updateDoc(doc(db, 'users', user.uid, 'habits', editData.id), data)
      } else {
        await addDoc(collection(db, 'users', user.uid, 'habits'), { ...data, completedDates: [], archived: false, createdAt: Timestamp.now() })
      }
      onClose()
    } catch { setError('Błąd zapisu'); setSaving(false) }
  }

  const handleDelete = async () => {
    const ok = await confirmDialog({ title: `Usunąć nawyk "${editData.name}"?`, message: "Utracisz całą historię aktywności." })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'habits', editData.id))
    onClose()
  }

  // Ukończenie nawyku jednym kliknięciem. Dotąd dawało się to zrobić tylko
  // okrężnie: wejść w datę zakończenia i ustawić dzisiejszą ręcznie. Pod spodem
  // to ta sama rzecz (endDate), bo cały moduł — cykl życia, archiwum, oś czasu —
  // czyta właśnie ją; druga flaga rozjechałaby się z nią przy pierwszej edycji.
  const handleFinish = async () => {
    const dzis = format(new Date(), 'yyyy-MM-dd')
    const skonczony = habitLifecycle(editData, dzis) === 'ended'
    await updateDoc(doc(db, 'users', user.uid, 'habits', editData.id), {
      endDate: skonczony ? null : dzis,
    })
    // Dzisiejszy dzień jest OSTATNIM dniem nawyku, nie pierwszym po nim — więc
    // z listy dnia schodzi dopiero jutro i dziś jeszcze da się go odhaczyć.
    // Bez tej informacji klik w „Ukończ" wygląda, jakby nic nie zrobił.
    if (skonczony) toast.success('Nawyk wrócił do codzienności.')
    else toast.success('Nawyk ukończony. Dziś jest jego ostatnim dniem — z listy zejdzie od jutra.')
    onClose()
  }

  const handleArchive = async () => {
    await updateDoc(doc(db, 'users', user.uid, 'habits', editData.id), { archived: !editData.archived })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{editData ? 'Edytuj nawyk' : 'Nowy nawyk'}</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="form">

          {/* Nazwa — na samej górze, obok podgląd ikony w wybranym kolorze */}
          <div className="form-group">
            <label>Nazwa</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color, border: `2px solid ${color}`, flexShrink: 0 }}>
                <CatIcon categoryId={null} emoji={iconKey} size={24} />
              </div>
              <input type="text" className="form-input" value={name} autoFocus={!editData}
                onChange={e => setName(e.target.value)} placeholder="np. Czytanie, Bieganie..." maxLength={40} style={{ margin: 0, flex: 1 }} />
            </div>
          </div>

          {/* Ikona */}
          <div className="form-group">
            <label>Ikona</label>
            <IconPicker value={iconKey} onChange={setIconKey} color={color} />
          </div>

          {/* Kolor */}
          <div className="form-group">
            <label>Kolor</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          {/* Kategoria */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ margin: 0 }}>Kategoria</label>
              <button type="button" onClick={() => setShowCatMgr(true)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
                color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, fontFamily: 'inherit',
              }}>
                <IconEdit size={12} /> Zarządzaj
              </button>
            </div>
            <div className="habit-cat-grid" style={{ marginTop: 8 }}>
              {categories.map(cat => (
                <button key={cat.id} type="button"
                  className={`habit-cat-btn ${category === cat.id ? 'active' : ''}`}
                  onClick={() => setCategory(cat.id)}
                >
                  <CatIcon categoryId={cat.id} emoji={cat.icon} size={16} />
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Rutyna (część dnia) — opcjonalna */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ margin: 0 }}>Rutyna <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— część dnia (opcjonalnie)</span></label>
              <button type="button" onClick={() => setShowRoutineMgr(true)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
                color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, fontFamily: 'inherit',
              }}>
                <IconEdit size={12} /> Zarządzaj
              </button>
            </div>
            <div className="habit-cat-grid" style={{ marginTop: 8 }}>
              <button type="button"
                className={`habit-cat-btn ${!routineId ? 'active' : ''}`}
                onClick={() => setRoutineId(null)}>
                <span>Bez grupy</span>
              </button>
              {routines.map(r => (
                <button key={r.id} type="button"
                  className={`habit-cat-btn ${routineId === r.id ? 'active' : ''}`}
                  onClick={() => setRoutineId(r.id)}>
                  <span>{r.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Wymagany czy dodatkowy — decyduje o mianowniku „zrobione X z Y" */}
          <div className="form-group">
            <label>Rodzaj</label>
            <div className="type-toggle" style={{ gap: 6 }}>
              <button type="button" className={`type-btn ${!optional ? 'active expense' : ''}`}
                onClick={() => setOptional(false)}>Wymagany</button>
              <button type="button" className={`type-btn ${optional ? 'active expense' : ''}`}
                onClick={() => setOptional(true)}>Wyzwanie</button>
            </div>
            <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45 }}>
              {optional
                ? 'Osobny ekran pod flagą w belce. Nie wchodzi do celu dnia ani do procentów okresu i nie ma serii — liczy się tylko, ile razy się udało.'
                : 'Podstawa dnia — wchodzi do celu „zrobione X z Y".'}
            </p>
          </div>

          {/* Jak mierzysz — odhaczenie albo cel na czas / ilość */}
          <div className="form-group">
            <label>Jak mierzysz</label>
            <div className="type-toggle" style={{ gap: 6 }}>
              <button type="button" className={`type-btn ${!mierzone ? 'active expense' : ''}`}
                onClick={() => setMierzone(false)}>Odhaczenie</button>
              <button type="button" className={`type-btn ${mierzone ? 'active expense' : ''}`}
                onClick={() => setMierzone(true)}>Czas / ilość</button>
            </div>

            {!mierzone ? (
              <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Zwykły haczyk — zrobione albo nie.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input type="number" className="form-input" inputMode="numeric" min="1" step="1"
                    value={target} onChange={e => setTarget(e.target.value)}
                    placeholder="np. 20" style={{ margin: 0, flex: '0 0 96px' }} />
                  <select className="form-input" value={unit === '__wlasna' || wlasnaJedn ? '__wlasna' : unit}
                    onChange={e => { setUnit(e.target.value); if (e.target.value !== '__wlasna') setWlasnaJedn('') }}
                    style={{ margin: 0, flex: 1 }}>
                    {HABIT_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                    <option value="__wlasna">inna (wpisz)</option>
                  </select>
                </div>
                {(unit === '__wlasna' || wlasnaJedn) && (
                  <input type="text" className="form-input" value={wlasnaJedn} maxLength={12}
                    onChange={e => setWlasnaJedn(e.target.value)}
                    placeholder="np. kubki, rozdziały" style={{ marginTop: 6 }} />
                )}
                <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  {Number(target) > 0
                    ? `Cel na dzień: ${formatAmount(Number(target), unit === '__wlasna' ? (wlasnaJedn.trim() || 'szt') : unit)}. Połowa normy liczy się jako pół dnia, a zaliczony jest dzień z całym celem.`
                    : 'Podaj cel na dzień — np. 20 minut albo 30 stron. Połowa normy będzie się liczyć jako pół dnia.'}
                </p>
                {unitMeta(unit).time && (
                  <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--text-muted)' }}>
                    Czas podajesz w minutach; sumy pokazują się jako godziny.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Częstotliwość */}
          <div className="form-group">
            <label>Częstotliwość</label>
            <div className="type-toggle" style={{ flexWrap: 'wrap', gap: 6 }}>
              {[
                { id: 'daily',    label: 'Codziennie' },
                { id: 'weekdays', label: 'Pon–Pt' },
                { id: 'weekend',  label: 'Sob–Nd' },
                { id: 'custom',   label: 'Własne' },
              ].map(f => (
                <button key={f.id} type="button"
                  className={`type-btn ${frequency === f.id ? 'active expense' : ''}`}
                  onClick={() => setFrequency(f.id)}
                >{f.label}</button>
              ))}
            </div>
            {frequency === 'custom' && (
              <div className="freq-days-picker">
                {FREQ_DAYS.map(d => (
                  <button key={d.id} type="button"
                    className={`freq-day-btn ${freqDays.includes(d.id) ? 'active' : ''}`}
                    onClick={() => toggleDay(d.id)}
                  >{d.label}</button>
                ))}
              </div>
            )}
          </div>

          {/* Kroki (checklist) */}
          <div className="form-group">
            <label>Kroki nawyku (opcjonalnie)</label>
            {checklist.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {checklist.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', borderRadius: 8, padding: '7px 10px' }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{s.title}</span>
                    <button type="button" className="t-btn delete" onClick={() => removeStep(s.id)}><IconTrash size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" className="form-input" value={stepInput} onChange={e => setStepInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStep() } }}
                placeholder="Dodaj krok, np. 10 pompek..." maxLength={100} style={{ flex: 1, margin: 0 }} />
              <button type="button" className="btn-save" style={{ width: 'auto', margin: 0, padding: '0 14px' }} onClick={addStep}><IconPlus size={16} /></button>
            </div>
            {checklist.length > 0 && (
              <p style={{ margin: '6px 2px 0', fontSize: 11, color: 'var(--text-muted)' }}>
                Odhaczenie wszystkich kroków oznaczy nawyk jako zrobiony danego dnia.
              </p>
            )}
          </div>

          {/* Daty */}
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Data rozpoczęcia</label>
              <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Data zakończenia</label>
              <select className="form-input" value={hasEnd ? 'yes' : 'no'} onChange={e => setHasEnd(e.target.value === 'yes')}>
                <option value="no">Bez końca</option>
                <option value="yes">Ustaw datę</option>
              </select>
              {hasEnd && <input type="date" className="form-input" style={{ marginTop: 6 }} value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />}
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Zapisywanie...' : editData ? 'Zapisz zmiany' : 'Dodaj nawyk'}
          </button>

          {editData && !editData.archived && (
            <button type="button" className="btn-outline" style={{ width: '100%', marginTop: 8 }}
              onClick={handleFinish}>
              {habitLifecycle(editData, format(new Date(), 'yyyy-MM-dd')) === 'ended'
                ? <><IconRestore size={14} /> Wznów nawyk</>
                : <><IconCheck size={14} /> Ukończ nawyk</>}
            </button>
          )}

          {editData && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={handleArchive}>
                {editData.archived
                  ? <><IconRestore size={14} /> Przywróć</>
                  : <><IconArchive size={14} /> Archiwizuj</>}
              </button>
              <button type="button" className="btn-outline danger" style={{ flex: 1 }} onClick={handleDelete}>
                <IconTrash size={14} /> Usuń
              </button>
            </div>
          )}
        </form>
      </div>
      {showCatMgr && <HabitCategoryManager user={user} onClose={() => setShowCatMgr(false)} />}
      {showRoutineMgr && <RoutineManager user={user} onClose={() => setShowRoutineMgr(false)} />}
    </div>
  )
}
