import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, addDoc, setDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { DREAM_CATEGORIES, DREAM_EMOTIONS, mergeDreamCategories, mergeDreamEmotions } from '../../utils/dreams'
import { IconTrash, IconEdit } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { ColorPicker } from '../Pickers'
import { APP_COLORS } from '../../utils/palette'
import { toast } from '../Toast'
import { bladSubskrypcji } from '../../utils/polaczenie'

// Dwie listy do zarządzania: kategorie snów i emocje po obudzeniu. Obie działają
// tak samo: wbudowane można edytować (nazwa, kolor — zapis jako nadpisanie pod tym
// samym id) i przywrócić do domyślnych, własne można dodawać, edytować i usuwać.
const KINDS = {
  categories: {
    coll: 'dreamCategories', title: 'Kategorie snów', single: 'kategorię', newTitle: 'Nowa kategoria',
    builtin: DREAM_CATEGORIES, merge: mergeDreamCategories, placeholder: 'np. Podróżny, O pracy...',
    removeMsg: 'Sny z tej kategorii zostaną, ale stracą przypisanie.',
  },
  emotions: {
    coll: 'dreamEmotions', title: 'Emocje po obudzeniu', single: 'emocję', newTitle: 'Nowa emocja',
    builtin: DREAM_EMOTIONS, merge: mergeDreamEmotions, placeholder: 'np. Nuda, Fascynacja...',
    removeMsg: 'Sny z tą emocją zostaną, ale emocja zniknie z ich opisu.',
  },
}

export default function DreamCategoryManager({ user }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <ItemList user={user} kind="categories" />
      <ItemList user={user} kind="emotions" />
    </div>
  )
}


function ItemList({ user, kind }) {
  const K = KINDS[kind]
  const [docs, setDocs] = useState([])
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, K.coll), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() }))), bladSubskrypcji(K.coll))
  }, [user.uid, K.coll])

  const items = useMemo(() => K.merge(docs), [K, docs])
  const builtinIds = useMemo(() => new Set(K.builtin.map(b => b.id)), [K])

  const remove = async (c) => {
    const ok = await confirmDialog({ title: `Usunąć „${c.label}"?`, message: K.removeMsg })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, K.coll, c.id)).catch(() => toast.error('Nie udało się usunąć'))
  }
  const restore = async (c) => {
    await deleteDoc(doc(db, 'users', user.uid, K.coll, c.id))
      .then(() => toast.success('Przywrócono domyślne'))
      .catch(() => toast.error('Nie udało się przywrócić'))
  }

  return (
    <section>
      <h4 style={{ margin: '0 0 4px', fontSize: 16 }}>{K.title}</h4>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
        Wbudowane możesz przemianować i przekolorować, własne dodać, zmienić albo usunąć.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(c => editId === c.id ? (
          <ItemForm key={c.id} user={user} K={K} initial={c} builtin={builtinIds.has(c.id)} onDone={() => setEditId(null)} />
        ) : (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderLeft: `3px solid ${c.color || '#9E9E9E'}`, borderRadius: 10, padding: '9px 12px',
          }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, background: c.color || '#9E9E9E' }} />
            <span style={{ flex: 1, fontSize: 14, minWidth: 0, wordBreak: 'break-word' }}>
              {c.label}
              <span style={{ marginLeft: 8, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>
                {c.custom ? 'własna' : c.edited ? 'zmieniona' : 'wbudowana'}
              </span>
            </span>
            <button className="t-btn" title="Edytuj" aria-label={`Edytuj ${c.label}`} onClick={() => setEditId(c.id)}><IconEdit size={13} /></button>
            {c.custom
              ? <button className="t-btn delete" title="Usuń" aria-label={`Usuń ${c.label}`} onClick={() => remove(c)}><IconTrash size={13} /></button>
              : c.edited && <button className="t-btn" title="Przywróć domyślne" aria-label={`Przywróć domyślne ${c.label}`} onClick={() => restore(c)} style={{ fontSize: 11 }}>↺</button>}
          </div>
        ))}

        {adding ? (
          <ItemForm user={user} K={K} onDone={() => setAdding(false)} isNew />
        ) : (
          <button className="btn-add-account" onClick={() => setAdding(true)}>+ {K.newTitle}</button>
        )}
      </div>
    </section>
  )
}

function ItemForm({ user, K, initial, onDone, isNew, builtin }) {
  const [label, setLabel] = useState(initial?.label || '')
  const [color, setColor] = useState(initial?.color || APP_COLORS[48])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    const name = label.trim()
    if (!name) { setErr('Wpisz nazwę'); return }
    setSaving(true)
    try {
      const data = { label: name, color }
      if (isNew) await addDoc(collection(db, 'users', user.uid, K.coll), { ...data, createdAt: Timestamp.now() })
      // merge: dla wbudowanej tworzy nadpisanie, dla własnej zostawia createdAt
      else await setDoc(doc(db, 'users', user.uid, K.coll, initial.id), builtin ? { ...data, createdAt: Timestamp.now() } : data, { merge: true })
      onDone()
    } catch {
      setErr('Nie udało się zapisać'); setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{isNew ? K.newTitle : `Edytuj ${K.single}`}</p>
      <div className="form-group" style={{ margin: 0 }}>
        <label>Nazwa</label>
        <input type="text" className="form-input" value={label} autoFocus maxLength={30}
          onChange={e => setLabel(e.target.value)} placeholder={K.placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save() } }} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label>Kolor</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      {err && <p className="form-error" style={{ margin: 0 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-save" style={{ flex: 1, margin: 0 }} onClick={save} disabled={saving}>
          {saving ? 'Zapisywanie...' : isNew ? 'Dodaj' : 'Zapisz'}
        </button>
        <button type="button" onClick={onDone} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--r-sm)', padding: 12, cursor: 'pointer', fontSize: 14 }}>
          Anuluj
        </button>
      </div>
    </div>
  )
}
