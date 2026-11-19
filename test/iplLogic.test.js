import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const L = await import('../src/utils/iplLogic.js')
const G = await import('../src/components/ipl/modelGeometria.js')
const {
  ZONY, ZONY_PO_ID, GRUPY, dniMiedzy, wpisyStrefy, ostatniePoStrefach, statStrefy, pasmoStrefy,
  przedzialDni, grupujZabiegi, podsumowanie, wpisyZabiegu, strefyWord, dawnoTemu, nazwaStrefy,
} = L

const w = (zone, date, hair = null, regrowth = null, id = `${zone}-${date}`) => ({ id, zone, date, hair, regrowth })

test('strefy: unikalne id, każda w istniejącej grupie, jest ich dużo', () => {
  assert.ok(ZONY.length >= 30, `za mało stref: ${ZONY.length}`)
  assert.equal(new Set(ZONY.map(z => z.id)).size, ZONY.length, 'zdublowane id strefy')
  assert.equal(new Set(ZONY.map(z => z.label)).size, ZONY.length, 'zdublowana nazwa strefy')
  const grupy = new Set(GRUPY.map(g => g.id))
  for (const z of ZONY) assert.ok(grupy.has(z.group), `strefa ${z.id} w nieznanej grupie ${z.group}`)
})

test('strefy: każda strefa ma kształt na modelu i odwrotnie', () => {
  const ids = ZONY.map(z => z.id).sort()
  assert.deepEqual(Object.keys(G.KSZTALTY).sort(), ids)
})

test('strefy: pary prawa/lewa są po obu stronach osi rysunku', () => {
  const x = (d) => Number(/M(-?[\d.]+)/.exec(d)[1])
  for (const z of ZONY.filter(z => z.strona)) {
    const k = G.KSZTALTY[z.id]
    const srodek = z.group === 'twarz' ? G.TWARZ.cx : G.SRODEK   // twarz to osobna wstawka z własną osią
    const sr = k.typ === 'ellipse' ? k.cx : k.typ === 'rect' ? k.x + k.w / 2 : x(k.d)
    // tułowiowe połówki zaczynają się przy osi, więc sprawdzamy tylko kierunek
    if (z.baza === 'bikini') { assert.ok(z.strona === 'p' ? k.x < srodek : k.x >= srodek, z.id); continue }
    assert.ok(z.strona === 'p' ? sr < srodek : sr > srodek, `${z.id}: prawa ma być z lewej strony rysunku`)
  }
})

test('dniMiedzy: liczy dni kalendarzowe, także przez zmianę czasu i lata', () => {
  assert.equal(dniMiedzy('2026-03-20', '2026-03-30'), 10)   // zmiana czasu na letni
  assert.equal(dniMiedzy('2025-12-30', '2026-01-02'), 3)
  assert.equal(dniMiedzy('2026-05-10', '2026-05-10'), 0)
  assert.equal(dniMiedzy('śmieci', '2026-05-10'), null)
})

test('ostatniePoStrefach: najnowszy wpis każdej strefy', () => {
  const o = ostatniePoStrefach([w('szyja', '2026-10-01', 2), w('szyja', '2026-10-20', 1), w('broda', '2026-10-05', 3)])
  assert.equal(o.szyja.date, '2026-10-20')
  assert.equal(o.broda.hair, 3)
})

test('statStrefy: liczba zabiegów, średni odstęp i dni od ostatniego', () => {
  const wpisy = [w('udo-g-p', '2026-10-01', 3), w('udo-g-p', '2026-10-15', 2), w('udo-g-p', '2026-11-01', 1), w('broda', '2026-10-30', 1)]
  const s = statStrefy(wpisy, 'udo-g-p', '2026-11-05')
  assert.equal(s.liczba, 3)
  assert.equal(s.dniOdOstatniego, 4)
  assert.equal(s.sredniOdstep, 16)   // (14 + 17) / 2 = 15,5 → 16
  assert.equal(s.ostatnieOwlosienie, 1)
})

test('statStrefy: dwa wpisy z jednego dnia to jeden zabieg', () => {
  const s = statStrefy([w('szyja', '2026-10-01', 2, null, 'a'), w('szyja', '2026-10-01', 2, null, 'b')], 'szyja', '2026-10-10')
  assert.equal(s.liczba, 1)
  assert.equal(s.sredniOdstep, null)
})

test('statStrefy: trend owłosienia — spada, rośnie, stabilnie, brak danych', () => {
  const t = (poziomy) => statStrefy(poziomy.map((h, i) => w('szyja', `2026-0${i + 1}-10`, h)), 'szyja', '2026-09-01').trend
  assert.equal(t([3, 2, 1]), 'spada')
  assert.equal(t([1, 2, 3]), 'rosnie')
  assert.equal(t([2, 2, 2]), 'stabilnie')
  assert.equal(t([2]), null)
  assert.equal(t([3, 3, 1, 1]), 'spada')   // przy czterech wpisach porównujemy pary
  assert.equal(statStrefy([w('szyja', '2026-01-10', null), w('szyja', '2026-02-10', null)], 'szyja', '2026-03-01').trend, null)
})

test('statStrefy: ostatnie odrastanie bierze najnowszą ocenę, nie ostatni wpis bez oceny', () => {
  const s = statStrefy([w('szyja', '2026-10-01', 2, 3), w('szyja', '2026-10-20', 1, null)], 'szyja', '2026-10-25')
  assert.equal(s.ostatnieOdrastanie, 3)
  assert.equal(s.ostatnieOwlosienie, 1)
})

test('statStrefy: strefa bez wpisów', () => {
  const s = statStrefy([], 'szyja', '2026-10-25')
  assert.equal(s.liczba, 0); assert.equal(s.ostatni, null); assert.equal(s.dniOdOstatniego, null)
})

test('przedzialDni i pasmoStrefy: kolory modelu w trzech trybach', () => {
  assert.equal(przedzialDni(0).id, 'swiezo')
  assert.equal(przedzialDni(7).id, 'swiezo')
  assert.equal(przedzialDni(8).id, 'niedawno')
  assert.equal(przedzialDni(30).id, 'dawno')
  assert.equal(przedzialDni(31).id, 'bardzo-dawno')
  assert.equal(przedzialDni(null), null)
  const wpis = w('szyja', '2026-10-01', 2, 3)
  assert.equal(pasmoStrefy('ostatnio', wpis, '2026-10-20'), 2)    // 19 dni
  assert.equal(pasmoStrefy('owlosienie', wpis, '2026-10-20'), 2)
  assert.equal(pasmoStrefy('odrastanie', wpis, '2026-10-20'), 2)  // szybko
  assert.equal(pasmoStrefy('owlosienie', w('szyja', '2026-10-01'), '2026-10-20'), null)
  assert.equal(pasmoStrefy('ostatnio', undefined, '2026-10-20'), null)
})

test('grupujZabiegi: dni od najnowszego, wpisy jednego dnia razem', () => {
  const g = grupujZabiegi([w('a', '2026-10-01'), w('b', '2026-10-15'), w('c', '2026-10-01')])
  assert.deepEqual(g.map(d => d.date), ['2026-10-15', '2026-10-01'])
  assert.equal(g[1].wpisy.length, 2)
})

test('podsumowanie: zabiegi, strefy zrobione, ostatni dzień', () => {
  const wpisy = [w('szyja', '2026-11-02'), w('broda', '2026-11-02'), w('szyja', '2026-10-10'), w('nieznana', '2026-10-10')]
  const p = podsumowanie(wpisy, '2026-11-05')
  assert.equal(p.zabiegi, 2)
  assert.equal(p.zabiegiMiesiac, 1)
  assert.equal(p.strefyZrobione, 2)          // „nieznana” nie liczy się do stref
  assert.equal(p.strefyRazem, ZONY.length)
  assert.equal(p.dniOdOstatniego, 3)
  assert.equal(p.ostatniaLiczbaStref, 2)
  assert.equal(podsumowanie([], '2026-11-05').ostatniDzien, null)
})

test('wpisyZabiegu: jeden wpis na strefę, bez duplikatów i nieznanych stref', () => {
  const wpisy = wpisyZabiegu({ strefy: ['szyja', 'szyja', 'broda', 'wymyslona'], date: '2026-11-01', hair: 2, regrowth: null, note: '  ok  ' })
  assert.deepEqual(wpisy.map(x => x.zone), ['szyja', 'broda'])
  assert.deepEqual(wpisy[0], { zone: 'szyja', date: '2026-11-01', hair: 2, regrowth: null, note: 'ok' })
  assert.equal(wpisyZabiegu({ strefy: ['szyja'], date: 'x', hair: undefined, regrowth: undefined }).at(0).hair, null)
})

test('odmiana i opisy', () => {
  assert.deepEqual([1, 2, 5, 12, 22, 34].map(strefyWord), ['strefa', 'strefy', 'stref', 'stref', 'strefy', 'strefy'])
  assert.equal(dawnoTemu(0), 'dziś'); assert.equal(dawnoTemu(1), 'wczoraj'); assert.equal(dawnoTemu(9), '9 dni temu'); assert.equal(dawnoTemu(null), '')
  assert.equal(nazwaStrefy('udo-g-p'), 'Udo prawe (góra)')
  assert.equal(nazwaStrefy('xxx'), 'Nieznana strefa')
  assert.ok(ZONY_PO_ID.intymne)
})

test('wpisyStrefy: tylko ta strefa, od najnowszego', () => {
  const l = wpisyStrefy([w('a', '2026-01-01'), w('b', '2026-01-02'), w('a', '2026-03-01')], 'a')
  assert.deepEqual(l.map(x => x.date), ['2026-03-01', '2026-01-01'])
})

test('moduł IPL jest podpięty: aplikacja, Pulpit, kopia, czyszczenie, demo', () => {
  const r = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
  assert.match(r('src/App.jsx'), /id: 'ipl'/)
  assert.match(r('src/App.jsx'), /activeModule === 'ipl'/)
  assert.match(r('src/components/Pulpit.jsx'), /shows\('ipl'\)/)
  assert.match(r('src/utils/dataExport.js'), /'iplZabiegi'/)
  assert.match(r('src/utils/moduleData.js'), /iplZabiegi/)
  assert.match(r('src/demo/seed.js'), /iplZabiegi/)
})
