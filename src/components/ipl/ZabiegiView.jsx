import { useMemo } from 'react'
import { IconEdit, IconTrash } from '../Icons'
import { grupujZabiegi, nazwaStrefy, etykietaOwlosienia, etykietaOdrastania, strefyWord } from '../../utils/iplLogic'
import { dzienDlugi } from './wspolne'

// Historia zabiegów dzień po dniu.

export default function ZabiegiView({ wpisy, onEdit, onDelete }) {
  const dni = useMemo(() => grupujZabiegi(wpisy), [wpisy])
  if (dni.length === 0) {
    return (
      <div className="list-empty">
        <p>Brak zabiegów</p>
        <p className="list-empty-hint">Tu pojawi się historia — dzień po dniu, ze wszystkimi strefami.</p>
      </div>
    )
  }
  return (
    <div className="ipl-dni">
      {dni.map(d => (
        <section key={d.date} className="card ipl-dzien">
          <h4>{dzienDlugi(d.date)}<small>{d.wpisy.length} {strefyWord(d.wpisy.length)}</small></h4>
          <ul>
            {d.wpisy.map(w => (
              <li key={w.id}>
                <div className="ipl-dzien-tekst">
                  <strong>{nazwaStrefy(w.zone)}</strong>
                  <span>
                    {Number.isInteger(w.hair) ? etykietaOwlosienia(w.hair).toLowerCase() : 'bez oceny'}
                    {Number.isInteger(w.regrowth) ? ` · odrastało ${etykietaOdrastania(w.regrowth).toLowerCase()}` : ''}
                    {w.note ? ` · ${w.note}` : ''}
                  </span>
                </div>
                <div className="auto-row-akcje">
                  <button type="button" className="t-btn" aria-label={`Edytuj: ${nazwaStrefy(w.zone)}`} onClick={() => onEdit(w)}><IconEdit size={13} /></button>
                  <button type="button" className="t-btn delete" aria-label={`Usuń: ${nazwaStrefy(w.zone)}`} onClick={() => onDelete(w)}><IconTrash size={13} /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
