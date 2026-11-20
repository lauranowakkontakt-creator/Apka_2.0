import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, doc } from 'firebase/firestore'
import { onSnapshot } from '../../utils/subskrypcje'
import { db } from '../../firebase/config'
import { usunZCofnieciem } from '../../utils/usunZCofnieciem'
import useFallbackTimeout from '../../utils/useFallbackTimeout'
import { bladSubskrypcji } from '../../utils/polaczenie'
import SegTabs from '../SegTabs'
import StatTiles from '../StatTiles'
import { IconPlus, IconSettings } from '../Icons'
import { ostatniePoStrefach, podsumowanie, dawnoTemu, aktywneStrefy, oczyscUkryte, ZONY } from '../../utils/iplLogic'
import { TODAY } from './wspolne'
import IplModel, { IplTwarz, NASYCENIE, wypelnienie } from './IplModel'
import ZabiegForm from './ZabiegForm'
import WyborStref from './WyborStref'
import StrefaSheet from './StrefaSheet'
import ZabiegiView from './ZabiegiView'
import PostepyView from './PostepyView'

// IPL (depilator): na modelu ciała zaznaczasz, co i kiedy depilowałaś, z jakim
// owłosieniem i jak szybko odrastało. Cała matematyka siedzi w utils/iplLogic.js.

const ZAKLADKI = [
  { id: 'model',   label: 'Model' },
  { id: 'zabiegi', label: 'Zabiegi' },
  { id: 'postepy', label: 'Postępy' },
]
const TRYBY = [
  { id: 'ostatnio',   label: 'Ostatnio' },
  { id: 'owlosienie', label: 'Owłosienie' },
  { id: 'odrastanie', label: 'Odrastanie' },
]
const LEGENDY = {
  ostatnio:   ['do 7 dni', '8–14 dni', '15–30 dni', 'ponad 30'],
  owlosienie: ['gładko', 'meszek', 'średnie', 'gęste'],
  odrastanie: ['wolno', 'średnio', 'szybko'],
}

export default function IplDashboard({ user, setHeaderExtras }) {
  const [wpisy, setWpisy]     = useState([])
  const [loading, setLoading] = useState(true)
  useFallbackTimeout(() => setLoading(false))
  const [tab, setTab]         = useState('model')
  const [tryb, setTryb]       = useState('ostatnio')
  const [strefaId, setStrefaId] = useState(null)   // otwarta karta strefy
  const [formularz, setFormularz] = useState(null) // { strefy?: [...], wpis? }
  const [ukryte, setUkryte]   = useState([])      // strefy wyłączone w ustawieniach
  const [wybor, setWybor]     = useState(false)    // okno „Śledzone strefy”

  useEffect(() => {
    const u = onSnapshot(query(collection(db, 'users', user.uid, 'iplZabiegi'), orderBy('date', 'desc')), s => {
      setWpisy(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false)
    }, bladSubskrypcji('iplZabiegi', { przyBledzie: () => setLoading(false) }))
    const ust = onSnapshot(doc(db, 'users', user.uid, 'settings', 'ipl'),
      s => setUkryte(oczyscUkryte(s.data()?.ukryte)), bladSubskrypcji('settings/ipl'))
    return () => { u(); ust() }
  }, [user.uid])

  useEffect(() => {
    setHeaderExtras?.(
      <button className="hdr-btn accent" title="Nowy zabieg" aria-label="Nowy zabieg" onClick={() => setFormularz({ strefy: [] })}>
        <IconPlus size={17} />
      </button>
    )
    return () => setHeaderExtras?.(null)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dzis = TODAY()
  const ostatnie = useMemo(() => ostatniePoStrefach(wpisy), [wpisy])
  const suma = useMemo(() => podsumowanie(wpisy, dzis, ukryte), [wpisy, dzis, ukryte])
  const aktywne = useMemo(() => aktywneStrefy(ukryte), [ukryte])
  const maTwarz = aktywne.some(z => z.group === 'twarz')

  if (loading) return <div className="list-loading">Ładowanie...</div>

  const usun = async (wpis) => {
    await usunZCofnieciem(doc(db, 'users', user.uid, 'iplZabiegi', wpis.id), 'Usunięto zabieg')
  }

  return (
    <div className="ipl" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StatTiles tiles={[
        { label: 'Ostatni zabieg', value: suma.ostatniDzien ? dawnoTemu(suma.dniOdOstatniego) : '–' },
        { label: 'Strefy zrobione', value: `${suma.strefyZrobione}/${suma.strefyRazem}` },
        { label: 'Zabiegi w tym miesiącu', value: String(suma.zabiegiMiesiac) },
      ]} />

      <SegTabs items={ZAKLADKI} active={tab} onChange={setTab} />

      {tab === 'model' && (
        <>
          <div className="card ipl-model-karta">
            <div className="ipl-gora">
              {maTwarz && <IplTwarz ostatnie={ostatnie} tryb={tryb} dzis={dzis} wybrana={strefaId} onPick={setStrefaId} ukryte={ukryte} />}
              <div className="ipl-opcje">
                <div className="ipl-tryby" role="group" aria-label="Co pokazują kolory">
                  {TRYBY.map(t => (
                    <button key={t.id} type="button" className={`ipl-chip${tryb === t.id ? ' active' : ''}`} aria-pressed={tryb === t.id} onClick={() => setTryb(t.id)}>{t.label}</button>
                  ))}
                </div>
                <Legenda tryb={tryb} />
              </div>
            </div>
            <IplModel ostatnie={ostatnie} tryb={tryb} dzis={dzis} wybrana={strefaId} onPick={setStrefaId} ukryte={ukryte} />
          </div>
          {wpisy.length === 0 ? (
            <div className="list-empty">
              <p>Brak zabiegów</p>
              <p className="list-empty-hint">Dotknij strefy na modelu albo użyj „+”, żeby zapisać pierwszy zabieg — z datą, owłosieniem i szybkością odrastania.</p>
            </div>
          ) : (
            <p className="auto-wskazowka">Dotknij strefy, żeby zobaczyć jej historię. Kolor pokazuje {tryb === 'ostatnio' ? 'jak dawno była depilowana' : tryb === 'owlosienie' ? 'ostatnie zapisane owłosienie' : 'ostatnio zapisaną szybkość odrastania'}.</p>
          )}
          <button type="button" className="btn-add-account" onClick={() => setFormularz({ strefy: [] })}>
            <IconPlus size={15} style={{ verticalAlign: '-3px', marginRight: 4 }} /> Dodaj zabieg
          </button>
          <button type="button" className="ipl-wybierz" onClick={() => setWybor(true)}>
            <IconSettings size={15} /> Wybierz śledzone strefy <span>{aktywne.length} z {ZONY.length}</span>
          </button>
        </>
      )}

      {tab === 'zabiegi' && (
        <ZabiegiView wpisy={wpisy} onEdit={(wpis) => setFormularz({ wpis })} onDelete={usun} />
      )}

      {tab === 'postepy' && (
        <PostepyView wpisy={wpisy} dzis={dzis} onPick={setStrefaId} />
      )}

      {strefaId && (
        <StrefaSheet
          strefaId={strefaId} wpisy={wpisy} dzis={dzis}
          onClose={() => setStrefaId(null)}
          onAdd={() => { const id = strefaId; setStrefaId(null); setFormularz({ strefy: [id] }) }}
          onEdit={(wpis) => { setStrefaId(null); setFormularz({ wpis }) }}
          onDelete={usun}
        />
      )}
      {formularz && (
        <ZabiegForm user={user} wpisy={wpisy} ukryte={ukryte} startStrefy={formularz.strefy} wpis={formularz.wpis} onClose={() => setFormularz(null)} />
      )}
      {wybor && <WyborStref user={user} ukryte={ukryte} wpisy={wpisy} onClose={() => setWybor(false)} />}
    </div>
  )
}

function Legenda({ tryb }) {
  const nazwy = LEGENDY[tryb], nasycenie = NASYCENIE[tryb]
  return (
    <ul className="ipl-legenda" aria-label="Legenda kolorów">
      {nazwy.map((n, i) => (
        <li key={n}><i style={{ background: wypelnienie(nasycenie[i]) }} />{n}</li>
      ))}
      <li><i style={{ background: wypelnienie(null) }} />brak</li>
    </ul>
  )
}
