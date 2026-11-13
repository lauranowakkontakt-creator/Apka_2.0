import { test } from 'node:test'
import assert from 'node:assert/strict'

const { nastrojDni, znacznikiDni, wplywZnacznikow, nastrojWGrupach } = await import('../src/utils/moodFactors.js')

const logi = [
  { date: '2026-10-01', moodValue: 5, factors: ['sport'], peopleIds: ['ania'] },
  { date: '2026-10-01', moodValue: 3, factors: ['praca'] },                // ten sam dzień
  { date: '2026-10-02', moodValue: 4, factors: ['sport'] },
  { date: '2026-10-03', moodValue: 5, factors: ['sport'] },
  { date: '2026-10-04', moodValue: 2, factors: ['praca'] },
  { date: '2026-10-05', moodValue: 2, factors: [] },
  { date: '2026-10-06', moodValue: 3 },
  { date: '2026-10-07', factors: ['sport'] },                               // bez oceny
]

test('nastrojDni — kilka wpisów jednego dnia to jedna średnia', () => {
  const n = nastrojDni(logi)
  assert.equal(n.get('2026-10-01'), 4)
  assert.equal(n.size, 6)                 // dzień bez oceny nie wchodzi
})

test('znacznikiDni — czynniki, osoby i okresy życia', () => {
  const z = znacznikiDni(logi, [{ id: 'zal', from: '2026-10-04', to: null }, { id: 'sesja', from: '2026-10-01', to: '2026-10-02' }])
  assert.deepEqual([...z.get('2026-10-01')].sort(), ['f:praca', 'f:sport', 'o:sesja', 'p:ania'])
  assert.ok(z.get('2026-10-06').has('o:zal'), 'okres bez daty końca trwa nadal')
  assert.ok(!z.get('2026-10-03').has('o:sesja'))
  assert.ok(!z.get('2026-10-03').has('o:zal'))
})

test('wplywZnacznikow — średnia dni z czynnikiem kontra pozostałe', () => {
  const w = wplywZnacznikow(nastrojDni(logi), znacznikiDni(logi))
  const sport = w.find(x => x.klucz === 'f:sport')
  assert.equal(sport.dni, 3)
  assert.equal(sport.dniBez, 3)
  assert.equal(sport.z, 13 / 3)           // dni 1, 2, 3: 4 + 4 + 5
  assert.equal(sport.bez, 7 / 3)          // dni 4, 5, 6: 2 + 2 + 3
  assert.ok(sport.pewne)
  assert.equal(w[0].klucz, 'f:sport', 'pewny wynik stoi przed niepewnymi')
})

test('wplywZnacznikow — za mało dni to wynik niepewny, nie ranking', () => {
  const w = wplywZnacznikow(nastrojDni(logi), znacznikiDni(logi))
  assert.equal(w.find(x => x.klucz === 'p:ania').pewne, false)
  assert.equal(w.find(x => x.klucz === 'f:praca').pewne, false)   // tylko 2 dni
})

test('nastrojWGrupach — rozłączne grupy w zadanej kolejności', () => {
  const g = nastrojWGrupach(nastrojDni(logi), d => (d <= '2026-10-03' ? 'początek' : d <= '2026-10-05' ? 'środek' : null), ['środek', 'początek'])
  assert.deepEqual(g.map(x => x.grupa), ['środek', 'początek'])
  assert.equal(g[0].srednia, 2)
  assert.equal(g[1].dni, 3)
})

test('ocenyCzynnikow — zliczenie „lepiej / gorzej” z wpisów', async () => {
  const { ocenyCzynnikow } = await import('../src/utils/moodFactors.js')
  const o = ocenyCzynnikow([
    { factorEffects: { praca: -1, spotkanie: 1 } },
    { factorEffects: { praca: -1 } },
    { factorEffects: { praca: 1, sport: 0 } },
    {},
  ])
  assert.deepEqual(o.get('f:praca'), { lepiej: 1, gorzej: 2 })
  assert.deepEqual(o.get('f:spotkanie'), { lepiej: 1, gorzej: 0 })
  assert.equal(o.has('f:sport'), false)
})

test('pomagaSzkodzi — tylko pewne i zauważalne, najmocniejsze na górze', async () => {
  const { pomagaSzkodzi } = await import('../src/utils/moodFactors.js')
  const w = [
    { klucz: 'f:sport', roznica: 1.2, pewne: true },
    { klucz: 'f:spotkanie', roznica: 0.6, pewne: true },
    { klucz: 'f:dom', roznica: 0.1, pewne: true },        // szum
    { klucz: 'f:praca', roznica: -0.9, pewne: true },
    { klucz: 'p:x', roznica: 2, pewne: false },           // za mało danych
  ]
  const { pomaga, szkodzi } = pomagaSzkodzi(w)
  assert.deepEqual(pomaga.map(x => x.klucz), ['f:sport', 'f:spotkanie'])
  assert.deepEqual(szkodzi.map(x => x.klucz), ['f:praca'])
})

test('skrajneGrupy — najlepsza i najgorsza, ale nie z garstki dni', async () => {
  const { skrajneGrupy } = await import('../src/utils/moodFactors.js')
  const g = [{ grupa: 'a', srednia: 4, dni: 5 }, { grupa: 'b', srednia: 2.5, dni: 4 }, { grupa: 'c', srednia: 1, dni: 1 }]
  const s = skrajneGrupy(g)
  assert.equal(s.najlepsza.grupa, 'a')
  assert.equal(s.najgorsza.grupa, 'b')
  assert.equal(skrajneGrupy([{ grupa: 'a', srednia: 3, dni: 5 }, { grupa: 'b', srednia: 3.1, dni: 5 }]), null)
})
