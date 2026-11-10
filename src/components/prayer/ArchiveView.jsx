import { db } from '../../firebase/config'
import { archiwalneNotatki, odmianaNotatek, przeszukiwalneTeksty, zawartoscArchiwalna } from '../../utils/prayerArchive'
import { findPrio } from '../../utils/prayerStats'
import { confirmDialog } from '../ConfirmModal'
import { CatIcon, IconCalendar, IconCheck, IconEdit, IconPrayer, IconRepeat, IconTrash } from '../Icons'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import { doc } from 'firebase/firestore'
import { deleteDoc, updateDoc } from '../../utils/zapis'
import { useMemo, useState } from 'react'

// Archiwum zakończonych próśb, z możliwością przywrócenia.

export default function ArchiveView({ user, intentions, people }) {
  const [search, setSearch]       = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [notesId, setNotesId]     = useState(null)

  const ended = intentions.filter(i => i.status === 'ended')

  // Szukamy też po treści notatek i punktów listy — skoro archiwum je pokazuje,
  // to szukanie tylko po tytule byłoby kłamstwem wyszukiwarki.
  const filtered = search.trim()
    ? ended.filter(i => przeszukiwalneTeksty(i).some(t => t.toLowerCase().includes(search.trim().toLowerCase())))
    : ended

  const byPerson = useMemo(() => {
    const map = {}
    filtered.forEach(i => {
      const key = i.personId || '__none__'
      if (!map[key]) map[key] = []
      map[key].push(i)
    })
    return map
  }, [filtered])

  const restoreItem = async (item) => {
    await updateDoc(doc(db, 'users', user.uid, 'prayerIntentions', item.id), {
      status: 'active', endedAt: null, autoArchived: null
    })
  }

  const deleteItem = async (item) => {
    // Usuwanie prośby z notatkami to skasowanie zapisków z wielu miesięcy —
    // liczba w pytaniu jest po to, żeby nie zrobiło się tego odruchowo.
    const notatki = archiwalneNotatki(item)
    const ok = await confirmDialog({
      title: 'Usunąć trwale?',
      message: notatki.length
        ? `Prośba zostanie usunięta z archiwum razem z ${notatki.length} ${odmianaNotatek(notatki.length)}. Tego nie da się cofnąć.`
        : 'Prośba zostanie usunięta z archiwum.',
    })
    if (!ok) return
    await deleteDoc(doc(db, 'users', user.uid, 'prayerIntentions', item.id))
  }

  const totalPrays = ended.reduce((s, i) => s + (i.prayedDates?.length || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1 }}>{ended.length}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 4 }}>Zarchiwizowanych</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#C9A24A', lineHeight: 1 }}>{totalPrays}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 4 }}>Łącznie modlono</div>
        </div>
      </div>

      {ended.length === 0 ? (
        <div className="list-empty">
          <p>Brak zarchiwizowanych próśb</p>
          <p className="list-empty-hint">Zarchiwizowane prośby będą tutaj widoczne</p>
        </div>
      ) : (
        <>
          <input
            type="text"
            className="form-input"
            placeholder="Szukaj w archiwum..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ margin: 0 }}
          />

          {filtered.length === 0 && (
            <div className="list-empty"><p>Brak wyników</p></div>
          )}

          {Object.entries(byPerson).map(([personId, items]) => {
            const person = personId === '__none__' ? null : people.find(p => p.id === personId)
            const groupPrays = items.reduce((s, i) => s + (i.prayedDates?.length || 0), 0)
            return (
              <div key={personId}>
                {/* Person header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {person && (
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6', flexShrink: 0 }}>
                      <CatIcon categoryId={null} emoji={person.icon || 'IcUsers'} size={14} />
                    </div>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                    {person ? person.name : 'Bez osoby'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {items.length} {items.length === 1 ? 'prośba' : 'próśb'} · <IconPrayer size={10} />×{groupPrays}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {items.map(item => (
                    <KartaArchiwum
                      key={item.id}
                      item={item}
                      historiaOtwarta={expandedId === item.id}
                      notatkiOtwarte={notesId === item.id}
                      onHistoria={() => setExpandedId(v => v === item.id ? null : item.id)}
                      onNotatki={() => setNotesId(v => v === item.id ? null : item.id)}
                      onPrzywroc={() => restoreItem(item)}
                      onUsun={() => deleteItem(item)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// Pojedyncza prośba w archiwum. Osobny komponent, bo pokazuje już cztery
// rodzaje treści (opis albo lista, notatka końcowa, dziennik notatek, historia
// modlitw) i wciśnięty w pętlę widoku robił się nieczytelny.
function KartaArchiwum({ item, historiaOtwarta, notatkiOtwarte, onHistoria, onNotatki, onPrzywroc, onUsun }) {
  const { notatki, lista, maOpis } = zawartoscArchiwalna(item)
  const prio = findPrio(item.priority || 3)

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '10px 14px', opacity: 0.75,
      display: 'flex', flexDirection: 'column', gap: 4
    }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{item.title}</p>
        {item.autoArchived && (
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'var(--surface3)', color: 'var(--text-muted)' }}>auto</span>
        )}
        {prio && (
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: prio.color + '22', color: prio.color }}>
            P{item.priority || 3}
          </span>
        )}
      </div>

      {/* Lista do odhaczania zostaje widoczna razem z tym, co było odhaczone —
          bez ptaszków archiwum gubi połowę treści prośby. Tylko do czytania:
          zarchiwizowanej prośby się nie prowadzi, od tego jest przywrócenie. */}
      {lista && (
        <div className="pray-list" style={{ marginTop: 2 }}>
          <div className="pray-list-head">
            <span className="pray-list-count">{lista.done} z {lista.total}</span>
          </div>
          <div className="pray-list-items">
            {lista.punkty.map(p => (
              <div key={p.id} className={`pray-list-item readonly${p.zrobione ? ' done' : ''}`}>
                <span className="pray-list-box">{p.zrobione && <IconCheck size={11} />}</span>
                <span className="pray-list-text" style={{ fontSize: 11 }}>{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {maOpis && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{item.note}</p>
      )}
      {item.endedNote && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>„{item.endedNote}"</p>
      )}

      {/* Meta + akcje w jednym wierszu (ikony przy treści, nie wypchnięte na bok) */}
      <div style={{ display: 'flex', gap: 10, marginTop: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><IconPrayer size={10} /> ×{item.prayedDates?.length || 0}</span>
        {item.endedAt && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {format(item.endedAt.toDate?.() || new Date(item.endedAt), 'd.MM.yyyy', { locale: pl })}
          </span>
        )}
        {notatki.length > 0 && (
          <button type="button" onClick={onNotatki} style={{ fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <IconEdit size={10} /> {notatki.length} {odmianaNotatek(notatki.length)}{notatkiOtwarte ? ' · ukryj' : ' · pokaż'}
          </button>
        )}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
          {item.prayedDates?.length > 0 && (
            <button className="t-btn" title="Historia" onClick={onHistoria}>
              <IconCalendar size={11} />
            </button>
          )}
          <button className="t-btn" title="Przywróć" onClick={onPrzywroc}>
            <IconRepeat size={11} />
          </button>
          <button className="t-btn delete" title="Usuń" onClick={onUsun}>
            <IconTrash size={12} />
          </button>
        </div>
      </div>

      {/* Dziennik notatek: to tu ląduje wszystko, co dopisywało się przy
          kolejnych modlitwach. Archiwum go nie pokazywało i wyglądało to jak
          skasowanie zapisków razem z prośbą. */}
      {notatkiOtwarte && notatki.length > 0 && (
        <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Notatki</div>
          {notatki.map(n => (
            <div key={n.id} style={{ background: 'var(--bg)', borderRadius: 8, padding: '7px 10px' }}>
              <p style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap' }}>{n.text}</p>
              {n.date && <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>{n.date}</p>}
            </div>
          ))}
        </div>
      )}

      {historiaOtwarta && item.prayedDates?.length > 0 && (
        <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Historia modlitw</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[...item.prayedDates].sort().reverse().slice(0, 20).map(d => (
              <span key={d} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--surface3)', color: 'var(--text-muted)' }}>
                {format(parseISO(d), 'd.MM.yy')}
              </span>
            ))}
            {item.prayedDates.length > 20 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{item.prayedDates.length - 20} więcej</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── IntentionForm ──────────────────────────────────────────────────────── */
