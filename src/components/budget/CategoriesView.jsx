import { useState, useEffect, useMemo } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, CAT_COLORS, getSubcategoryColor } from '../../utils/categories'
import { CatIcon, IconClose, IconTrash, IconTag, IconEdit, IconSearch, IconChevronDown, IconArrowUp, IconArrowDown, ICON_CATALOG } from '../Icons'
import { confirmDialog } from '../ConfirmModal'
import { toast } from '../Toast'
import { bladSubskrypcji } from '../../utils/polaczenie'

export default function CategoriesView({ user, onClose }) {
  const [tab, setTab]               = useState('expense')
  const [expCats, setExpCats]       = useState(DEFAULT_EXPENSE_CATEGORIES)
  const [incCats, setIncCats]       = useState(DEFAULT_INCOME_CATEGORIES)
  const [showAdd, setShowAdd]       = useState(false)
  const [editCat, setEditCat]       = useState(null)
  const [loading, setLoading]       = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [expanded, setExpanded]     = useState(new Set())
  const [editSubcat, setEditSubcat] = useState(null) // { catId, subcat }
  const [addingSubcat, setAddingSubcat] = useState(null) // catId
  // Trzeci poziom: pod-podkategorie (subcategories wewnątrz podkategorii)
  const [expandedSub, setExpandedSub] = useState(new Set())
  const [editSS, setEditSS]     = useState(null)  // { catId, subId, item }
  const [addingSS, setAddingSS] = useState(null)  // { catId, subId }

  useEffect(() => {
    return onSnapshot(doc(db, 'users', user.uid, 'settings', 'categories'), d => {
      if (d.exists()) {
        if (d.data().expense?.length) setExpCats(d.data().expense)
        if (d.data().income?.length)  setIncCats(d.data().income)
      }
      setLoading(false)
    }, bladSubskrypcji('settings/categories'))
  }, [user.uid])

  const save = async (type, cats) => {
    await setDoc(doc(db, 'users', user.uid, 'settings', 'categories'), {
      expense: type === 'expense' ? cats : expCats,
      income:  type === 'income'  ? cats : incCats,
    }, { merge: true })
  }

  const cats    = tab === 'expense' ? expCats : incCats
  const setCats = tab === 'expense' ? setExpCats : setIncCats

  const deleteCat = async (id) => {
    const ok = await confirmDialog({ title: 'Usunąć kategorię?', message: 'Podkategorie zostaną usunięte razem.' })
    if (!ok) return
    const next = cats.filter(c => c.id !== id)
    setCats(next); save(tab, next)
  }

  const move = (id, dir) => {
    const arr = [...cats]
    const i = arr.findIndex(c => c.id === id)
    if (i + dir < 0 || i + dir >= arr.length) return
    ;[arr[i], arr[i + dir]] = [arr[i + dir], arr[i]]
    setCats(arr); save(tab, arr)
  }

  const addCat = (cat) => {
    const next = [...cats, cat]
    setCats(next); save(tab, next); setShowAdd(false)
  }

  const updateCat = (updated) => {
    const next = cats.map(c => c.id === updated.id ? updated : c)
    setCats(next); save(tab, next); setEditCat(null)
  }

  const addSubcat = (catId, subcat) => {
    const next = cats.map(c => c.id === catId
      ? { ...c, subcategories: [...(c.subcategories || []), subcat] }
      : c)
    setCats(next); save(tab, next); setAddingSubcat(null)
  }

  const updateSubcat = (catId, updated) => {
    const next = cats.map(c => c.id === catId
      // {...s, ...updated}: formularz nie zna pod-podkategorii — nie wolno ich zgubić
      ? { ...c, subcategories: (c.subcategories || []).map(s => s.id === updated.id ? { ...s, ...updated } : s) }
      : c)
    setCats(next); save(tab, next); setEditSubcat(null)
  }

  const mapSub = (catId, subId, fn) => cats.map(c => c.id !== catId ? c
    : { ...c, subcategories: (c.subcategories || []).map(s => s.id === subId ? fn(s) : s) })

  const addSS = (catId, subId, item) => {
    const next = mapSub(catId, subId, s => ({ ...s, subcategories: [...(s.subcategories || []), item] }))
    setCats(next); save(tab, next); setAddingSS(null)
  }
  const updateSS = (catId, subId, item) => {
    const next = mapSub(catId, subId, s => ({ ...s, subcategories: (s.subcategories || []).map(x => x.id === item.id ? { ...x, ...item } : x) }))
    setCats(next); save(tab, next); setEditSS(null)
  }
  const deleteSS = async (catId, subId, id) => {
    const ok = await confirmDialog({ title: 'Usunąć pod-podkategorię?' })
    if (!ok) return
    const next = mapSub(catId, subId, s => ({ ...s, subcategories: (s.subcategories || []).filter(x => x.id !== id) }))
    setCats(next); save(tab, next)
  }
  const toggleSub = (id) => setExpandedSub(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const deleteSubcat = async (catId, subcatId) => {
    const ok = await confirmDialog({ title: 'Usunąć podkategorię?', message: 'Jej pod-podkategorie zostaną usunięte razem.' })
    if (!ok) return
    const next = cats.map(c => c.id === catId
      ? { ...c, subcategories: (c.subcategories || []).filter(s => s.id !== subcatId) }
      : c)
    setCats(next); save(tab, next)
  }

  const toggleExpanded = (id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const switchTab = (t) => {
    setTab(t); setShowAdd(false); setEditCat(null); setEditSubcat(null); setAddingSubcat(null)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-tall">
        <div className="modal-header">
          <h3><IconTag size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Kategorie</h3>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>

        <div className="habit-view-tabs" style={{ marginBottom: 12 }}>
          <button className={`habit-view-tab ${tab === 'expense' ? 'active' : ''}`} onClick={() => switchTab('expense')}>Wydatki</button>
          <button className={`habit-view-tab ${tab === 'income'  ? 'active' : ''}`} onClick={() => switchTab('income')}>Dochody</button>
        </div>

        {loading ? <div className="list-loading">Ładowanie...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cats.map((cat, i) => {
              const isExpanded = expanded.has(cat.id)
              const subcats = cat.subcategories || []
              return (
                <div key={cat.id}>
                  {editCat?.id === cat.id ? (
                    <CategoryForm tab={tab} initial={cat} onSave={updateCat} onCancel={() => setEditCat(null)} />
                  ) : (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: isExpanded ? '10px 10px 0 0' : 10, padding: '8px 12px'
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 9,
                        background: cat.color + '33', border: `1.5px solid ${cat.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: cat.color, flexShrink: 0
                      }}>
                        <CatIcon categoryId={cat.id} emoji={cat.icon} size={18} />
                      </div>
                      <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{cat.label}</span>
                      {subcats.length > 0 && (
                        <span style={{ fontSize: 11, color: cat.color, fontWeight: 600, background: cat.color + '22', borderRadius: 99, padding: '1px 7px' }}>
                          {subcats.length}
                        </span>
                      )}
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="t-btn" onClick={() => move(cat.id, -1)} disabled={i === 0} style={{ opacity: i === 0 ? 0.3 : 1 }}><IconArrowUp size={13} /></button>
                        <button className="t-btn" onClick={() => move(cat.id, +1)} disabled={i === cats.length - 1} style={{ opacity: i === cats.length - 1 ? 0.3 : 1 }}><IconArrowDown size={13} /></button>
                        <button className="t-btn" onClick={() => { setEditCat(cat); setShowAdd(false) }}><IconEdit size={13} /></button>
                        <button className="t-btn delete" onClick={() => deleteCat(cat.id)}><IconTrash size={13} /></button>
                        <button
                          className="t-btn"
                          onClick={() => { toggleExpanded(cat.id); setAddingSubcat(null); setEditSubcat(null) }}
                          style={{ color: isExpanded ? cat.color : 'var(--text-muted)' }}
                          title="Podkategorie"
                        >
                          <IconChevronDown size={13} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                        </button>
                      </div>
                    </div>
                  )}

                  {isExpanded && !editCat && (
                    <div style={{
                      borderLeft: `2px solid ${cat.color}`,
                      borderRight: '1px solid var(--border)',
                      borderBottom: '1px solid var(--border)',
                      borderRadius: '0 0 10px 10px',
                      padding: '8px 10px',
                      background: cat.color + '08',
                      display: 'flex', flexDirection: 'column', gap: 5
                    }}>
                      {subcats.map((sub, si) => {
                        const subColor = getSubcategoryColor(cat.color, si)
                        const isEditingThis = editSubcat?.catId === cat.id && editSubcat?.subcat.id === sub.id
                        return (
                          <div key={sub.id}>
                            {isEditingThis ? (
                              <SubcategoryForm
                                initial={sub}
                                parentColor={cat.color}
                                onSave={updated => updateSubcat(cat.id, updated)}
                                onCancel={() => setEditSubcat(null)}
                              />
                            ) : (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                background: 'var(--surface)', borderRadius: 8,
                                padding: '6px 10px',
                                border: `1px solid ${subColor}44`,
                                borderLeft: `3px solid ${subColor}`
                              }}>
                                <div style={{
                                  width: 26, height: 26, borderRadius: 6,
                                  background: subColor + '30', border: `1.5px solid ${subColor}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: subColor, flexShrink: 0
                                }}>
                                  <CatIcon categoryId="" emoji={sub.icon} size={13} />
                                </div>
                                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{sub.label}</span>
                                {(sub.subcategories || []).length > 0 && (
                                  <span style={{ fontSize: 10, color: subColor, fontWeight: 600, background: subColor + '22', borderRadius: 99, padding: '1px 6px' }}>{sub.subcategories.length}</span>
                                )}
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="t-btn" onClick={() => { setEditSubcat({ catId: cat.id, subcat: sub }); setAddingSubcat(null) }}><IconEdit size={12} /></button>
                                  <button className="t-btn delete" onClick={() => deleteSubcat(cat.id, sub.id)}><IconTrash size={12} /></button>
                                  <button className="t-btn" title="Pod-podkategorie" onClick={() => { toggleSub(sub.id); setAddingSS(null); setEditSS(null) }}
                                    style={{ color: expandedSub.has(sub.id) ? subColor : 'var(--text-muted)' }}>
                                    <IconChevronDown size={12} style={{ transform: expandedSub.has(sub.id) ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                                  </button>
                                </div>
                              </div>
                            )}
                            {expandedSub.has(sub.id) && !isEditingThis && (
                              <div style={{ margin: '4px 0 2px 14px', paddingLeft: 8, borderLeft: `2px solid ${subColor}66`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {(sub.subcategories || []).map(ss => (
                                  editSS?.subId === sub.id && editSS.item.id === ss.id ? (
                                    <SubcategoryForm key={ss.id} initial={ss} level={3} parentColor={subColor}
                                      onSave={u => updateSS(cat.id, sub.id, u)} onCancel={() => setEditSS(null)} />
                                  ) : (
                                    <div key={ss.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', borderRadius: 7, padding: '5px 8px', border: `1px solid ${subColor}33` }}>
                                      <CatIcon categoryId="" emoji={ss.icon} size={12} />
                                      <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{ss.label}</span>
                                      <button className="t-btn" onClick={() => { setEditSS({ catId: cat.id, subId: sub.id, item: ss }); setAddingSS(null) }}><IconEdit size={11} /></button>
                                      <button className="t-btn delete" onClick={() => deleteSS(cat.id, sub.id, ss.id)}><IconTrash size={11} /></button>
                                    </div>
                                  )
                                ))}
                                {addingSS?.subId === sub.id ? (
                                  <SubcategoryForm isNew level={3} parentColor={subColor}
                                    onSave={item => addSS(cat.id, sub.id, item)} onCancel={() => setAddingSS(null)} />
                                ) : !editSS && (
                                  <button onClick={() => { setAddingSS({ catId: cat.id, subId: sub.id }); setEditSS(null) }}
                                    style={{ background: 'transparent', border: `1px dashed ${subColor}66`, borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 11, color: subColor, textAlign: 'left' }}>
                                    + Dodaj pod-podkategorię
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {addingSubcat === cat.id ? (
                        <SubcategoryForm
                          isNew
                          parentColor={cat.color}
                          onSave={subcat => addSubcat(cat.id, subcat)}
                          onCancel={() => setAddingSubcat(null)}
                        />
                      ) : (
                        !editSubcat && (
                          <button
                            onClick={() => { setAddingSubcat(cat.id); setEditSubcat(null) }}
                            style={{
                              background: 'transparent', border: `1px dashed ${cat.color}66`,
                              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                              fontSize: 12, color: cat.color, textAlign: 'left', marginTop: 2
                            }}
                          >
                            + Dodaj podkategorię
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {showAdd ? (
              <CategoryForm tab={tab} onSave={addCat} onCancel={() => setShowAdd(false)} isNew />
            ) : (
              !editCat && (
                <button className="btn-add-account" onClick={() => setShowAdd(true)}>+ Dodaj kategorię</button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryForm({ tab, initial, onSave, onCancel, isNew }) {
  const [label, setLabel]           = useState(initial?.label ?? '')
  const [icon, setIcon]             = useState(initial?.icon ?? 'IcWallet')
  const [color, setColor]           = useState(initial?.color ?? CAT_COLORS[0])
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const handleSave = () => {
    if (!label.trim()) { setError('Wpisz nazwę'); return }
    const id = isNew
      ? `custom_${label.trim().toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`
      : initial.id
    onSave({ id, label: label.trim(), icon, color, subcategories: initial?.subcategories || [] })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ICON_CATALOG
    return ICON_CATALOG.filter(ic => ic.label.toLowerCase().includes(q) || ic.group.toLowerCase().includes(q))
  }, [search])

  const groups = useMemo(() => {
    const map = {}
    for (const ic of filtered) {
      if (!map[ic.group]) map[ic.group] = []
      map[ic.group].push(ic)
    }
    return map
  }, [filtered])

  const currentEntry = ICON_CATALOG.find(ic => ic.key === icon)

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
        {isNew ? `Nowa kategoria (${tab === 'expense' ? 'wydatek' : 'dochód'})` : 'Edytuj kategorię'}
      </p>
      <div className="form-group" style={{ margin: 0 }}>
        <label>Nazwa</label>
        <input type="text" className="form-input" value={label} onChange={e => setLabel(e.target.value)}
          placeholder="np. Hobby, Siłownia..." maxLength={30} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label>Ikona</label>
        <button type="button" onClick={() => setPickerOpen(v => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CatIcon categoryId="" emoji={icon} size={18} />
          </div>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', textAlign: 'left' }}>{currentEntry ? currentEntry.label : icon}</span>
          <span style={{ display: 'inline-flex', color: 'var(--text-muted)' }}><IconChevronDown size={13} style={{ transform: pickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} /></span>
        </button>
        {pickerOpen && (
          <div style={{ marginTop: 6, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconSearch size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input type="text" className="form-input" placeholder="Szukaj ikony..." value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ margin: 0, fontSize: 13, border: 'none', background: 'transparent', padding: '2px 0' }} />
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto', padding: '10px 10px 4px' }}>
              {Object.entries(groups).map(([group, icons]) => (
                <div key={group} style={{ marginBottom: 14 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{group}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {icons.map(ic => {
                      const Ic = ic.Component
                      const selected = icon === ic.key
                      return (
                        <button key={ic.key} type="button" title={ic.label}
                          onClick={() => { setIcon(ic.key); setPickerOpen(false); setSearch('') }}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                            width: 54, padding: '7px 4px', borderRadius: 9, cursor: 'pointer',
                            background: selected ? color + '33' : 'var(--surface)',
                            border: `1.5px solid ${selected ? color : 'var(--border)'}`,
                            color: selected ? color : 'var(--text-muted)', transition: 'all 0.1s'
                          }}>
                          <Ic size={18} />
                          <span style={{ fontSize: 9, lineHeight: 1.2, textAlign: 'center', color: selected ? color : 'var(--text-muted)' }}>{ic.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {Object.keys(groups).length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>Brak wyników</p>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label>Kolor</label>
        <div className="color-picker">
          {CAT_COLORS.map(c => (
            <button key={c} type="button" className={`color-dot ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
      {error && <p className="form-error" style={{ margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-save" onClick={handleSave} style={{ flex: 1 }}>{isNew ? 'Dodaj' : 'Zapisz'}</button>
        <button type="button" onClick={onCancel} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--radius)', padding: 12, cursor: 'pointer', fontSize: 14 }}>Anuluj</button>
      </div>
    </div>
  )
}

function SubcategoryForm({ initial, onSave, onCancel, isNew, parentColor, level = 2 }) {
  const [label, setLabel]           = useState(initial?.label ?? '')
  const [icon, setIcon]             = useState(initial?.icon ?? 'IcWallet')
  const [search, setSearch]         = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError]           = useState('')
  const color = parentColor || CAT_COLORS[0]

  const handleSave = () => {
    if (!label.trim()) { setError('Wpisz nazwę'); return }
    const id = isNew
      ? `${level === 3 ? 'ss' : 'sub'}_${label.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`
      : initial.id
    onSave({ id, label: label.trim(), icon })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? ICON_CATALOG.filter(ic => ic.label.toLowerCase().includes(q) || ic.group.toLowerCase().includes(q)) : ICON_CATALOG
  }, [search])

  const groups = useMemo(() => {
    const map = {}
    for (const ic of filtered) {
      if (!map[ic.group]) map[ic.group] = []
      map[ic.group].push(ic)
    }
    return map
  }, [filtered])

  const currentEntry = ICON_CATALOG.find(ic => ic.key === icon)

  return (
    <div style={{ background: 'var(--surface2)', borderLeft: `3px solid ${color}`, border: '1px solid var(--border)', borderRadius: '0 10px 10px 0', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
        {level === 3 ? (isNew ? 'Nowa pod-podkategoria' : 'Edytuj pod-podkategorię') : (isNew ? 'Nowa podkategoria' : 'Edytuj podkategorię')}
      </p>
      <input type="text" className="form-input" value={label} onChange={e => setLabel(e.target.value)}
        placeholder="np. Paliwo, Parking..." maxLength={30} style={{ fontSize: 13 }} />
      <button type="button" onClick={() => setPickerOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '7px 10px', cursor: 'pointer'
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          <CatIcon categoryId="" emoji={icon} size={15} />
        </div>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', textAlign: 'left' }}>{currentEntry ? currentEntry.label : icon}</span>
        <span style={{ display: 'inline-flex', color: 'var(--text-muted)' }}><IconChevronDown size={12} style={{ transform: pickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} /></span>
      </button>
      {pickerOpen && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconSearch size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input type="text" className="form-input" placeholder="Szukaj..." value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ margin: 0, fontSize: 12, border: 'none', background: 'transparent', padding: '2px 0' }} />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', padding: '8px 8px 4px' }}>
            {Object.entries(groups).map(([group, icons]) => (
              <div key={group} style={{ marginBottom: 10 }}>
                <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{group}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {icons.map(ic => {
                    const Ic = ic.Component
                    const sel = icon === ic.key
                    return (
                      <button key={ic.key} type="button" title={ic.label}
                        onClick={() => { setIcon(ic.key); setPickerOpen(false); setSearch('') }}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                          width: 46, padding: '5px 3px', borderRadius: 7, cursor: 'pointer',
                          background: sel ? color + '33' : 'var(--surface)',
                          border: `1.5px solid ${sel ? color : 'var(--border)'}`,
                          color: sel ? color : 'var(--text-muted)'
                        }}>
                        <Ic size={15} />
                        <span style={{ fontSize: 8, lineHeight: 1.2, textAlign: 'center' }}>{ic.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {error && <p className="form-error" style={{ margin: 0, fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-save" onClick={handleSave} style={{ flex: 1, padding: 10, fontSize: 13 }}>{isNew ? 'Dodaj' : 'Zapisz'}</button>
        <button type="button" onClick={onCancel} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--radius)', padding: 10, cursor: 'pointer', fontSize: 13 }}>Anuluj</button>
      </div>
    </div>
  )
}
