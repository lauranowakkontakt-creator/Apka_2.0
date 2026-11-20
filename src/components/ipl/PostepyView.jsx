import { useMemo } from 'react'
import { GRUPY, strefyGrupy, statStrefy, etykietaOwlosienia, etykietaOdrastania, dawnoTemu } from '../../utils/iplLogic'

// Postępy strefa po strefie: ile zabiegów, jak dawno, średni odstęp i czy
// owłosienie maleje. Strefy bez żadnego zabiegu są pominięte.

const TREND = { spada: 'maleje', stabilnie: 'bez zmian', rosnie: 'rośnie' }

export default function PostepyView({ wpisy, dzis, onPick }) {
  const grupy = useMemo(() => GRUPY.map(g => ({
    ...g,
    wiersze: strefyGrupy(g.id).map(z => ({ z, st: statStrefy(wpisy, z.id, dzis) })).filter(x => x.st.liczba > 0),
  })).filter(g => g.wiersze.length > 0), [wpisy, dzis])

  if (grupy.length === 0) {
    return (
      <div className="list-empty">
        <p>Brak danych do postępów</p>
        <p className="list-empty-hint">Po kilku zabiegach zobaczysz tu, jak zmienia się owłosienie i jak szybko odrasta.</p>
      </div>
    )
  }
  return (
    <div className="ipl-dni">
      {grupy.map(g => (
        <section key={g.id} className="card ipl-dzien">
          <h4>{g.label}</h4>
          <ul>
            {g.wiersze.map(({ z, st }) => (
              <li key={z.id}>
                <button type="button" className="ipl-postep" onClick={() => onPick(z.id)}>
                  <span className="ipl-dzien-tekst">
                    <strong>{z.label}</strong>
                    <span>
                      {st.liczba} {st.liczba === 1 ? 'zabieg' : 'zabiegów'} · {dawnoTemu(st.dniOdOstatniego)}
                      {st.sredniOdstep ? ` · co ${st.sredniOdstep} dni` : ''}
                    </span>
                  </span>
                  <span className="ipl-postep-wynik">
                    {st.ostatnieOwlosienie != null && <b>{etykietaOwlosienia(st.ostatnieOwlosienie)}</b>}
                    <small>{st.trend ? `owłosienie ${TREND[st.trend]}` : st.ostatnieOdrastanie ? `odrasta: ${etykietaOdrastania(st.ostatnieOdrastanie).toLowerCase()}` : ''}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
