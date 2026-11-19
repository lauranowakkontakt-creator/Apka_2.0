import { IconClose, IconPlus, IconEdit, IconTrash } from '../Icons'
import { nazwaStrefy, wpisyStrefy, statStrefy, etykietaOwlosienia, etykietaOdrastania, dawnoTemu } from '../../utils/iplLogic'
import { dzien } from './wspolne'

// Karta jednej strefy: ostatni zabieg, średni odstęp, trend owłosienia i cała
// historia tej strefy.

const TREND = {
  spada:     { tekst: 'Włosów ubywa', klasa: 'dobrze' },
  stabilnie: { tekst: 'Bez zmian',    klasa: '' },
  rosnie:    { tekst: 'Włosów przybywa', klasa: 'uwaga' },
}

export default function StrefaSheet({ strefaId, wpisy, dzis, onClose, onAdd, onEdit, onDelete }) {
  const lista = wpisyStrefy(wpisy, strefaId)
  const st = statStrefy(wpisy, strefaId, dzis)
  const trend = st.trend ? TREND[st.trend] : null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{nazwaStrefy(strefaId)}</h3>
          <button type="button" className="modal-close" aria-label="Zamknij" onClick={onClose}><IconClose size={16} /></button>
        </div>

        {lista.length === 0 ? (
          <div className="list-empty">
            <p>Jeszcze bez zabiegu</p>
            <p className="list-empty-hint">Zapisz pierwszy — potem pojawi się tu historia i średni odstęp.</p>
          </div>
        ) : (
          <>
            <div className="ipl-fakty">
              <div><span>Ostatnio</span><strong>{dawnoTemu(st.dniOdOstatniego)}</strong></div>
              <div><span>Zabiegi</span><strong>{st.liczba}</strong></div>
              <div><span>Średni odstęp</span><strong>{st.sredniOdstep ? `${st.sredniOdstep} dni` : '–'}</strong></div>
              <div><span>Owłosienie</span><strong>{etykietaOwlosienia(st.ostatnieOwlosienie)}</strong></div>
              <div><span>Odrastanie</span><strong>{etykietaOdrastania(st.ostatnieOdrastanie)}</strong></div>
              <div><span>Trend</span><strong className={trend?.klasa}>{trend?.tekst || '–'}</strong></div>
            </div>
            <div className="auto-lista" style={{ marginTop: 14 }}>
              {lista.map(w => (
                <div key={w.id} className="auto-row">
                  <i style={{ background: 'var(--accent)' }} />
                  <div className="auto-row-main">
                    <strong>{dzien(w.date)}</strong>
                    <span>
                      {Number.isInteger(w.hair) ? `owłosienie: ${etykietaOwlosienia(w.hair).toLowerCase()}` : 'bez oceny owłosienia'}
                      {Number.isInteger(w.regrowth) ? ` · odrastało ${etykietaOdrastania(w.regrowth).toLowerCase()}` : ''}
                    </span>
                    {w.note && <span className="auto-row-note">{w.note}</span>}
                  </div>
                  <div className="auto-row-akcje">
                    <button type="button" className="t-btn" aria-label="Edytuj zabieg" onClick={() => onEdit(w)}><IconEdit size={13} /></button>
                    <button type="button" className="t-btn delete" aria-label="Usuń zabieg" onClick={() => onDelete(w)}><IconTrash size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <button type="button" className="btn-save" style={{ marginTop: 16 }} onClick={onAdd}>
          <IconPlus size={15} style={{ verticalAlign: '-3px', marginRight: 4 }} /> Dodaj zabieg tej strefy
        </button>
      </div>
    </div>
  )
}
