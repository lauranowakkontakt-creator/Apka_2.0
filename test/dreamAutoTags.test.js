import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autoTags, applyAutoTags, autoSymbols, autoNumbers, AUTO_SYMBOL_NAMES } from '../src/utils/dreamAutoTags.js'

// Sny z ostatnich dni (pisane na zmęczeniu, bez tagów).
const REPREZENTUJ = 'Byliśmy jako grupa pod odpięła dwóch liderów jakiś i każdy był pod którymś liderem i kazano nam podejść do okienka i przedstawiciel od każdego lidera miał podejść i wypowiedzieć się dlaczego to jego lider powinien wygrać. I było ciśnięcie po moim liderze że nic nie potrafi i do niczego nie doszedł. Wtedy powiedziałam że ratował tych którzy nie mieli szans i których nikt nie chciał i nawet nie zastanawiałam się czy wygrałam czy nie ale wzięłam kartkę i zaczęłam na niej pisać wygrałam.'
const NIE_ZLAPIESZ = 'Kogoś chroniłam z jeszcze jedną osobą ale ktoś go gonił więc próbowaliśmy zrobić różne zmyłki by nie złapano go.'
const OSZUKUJESZ = 'Byłam w jakimś sklepie ze znajomym i płacił za coś co tam kupił i na terminalu pisało 30 przyłożył kartę i poszedł. Wzięłam mu rachunek i patrzę że się nie zgadza bo pisało 30 a ponabijało mu różne rzeczy i wyszło prawie 50. Zauważyłam to i poszłam mu powiedzieć że coś jest nie tak i wyszłam z tym terminalem i wróciłam do lady.'
const KOTEK = 'Uciekałam przed jakimś ziomkiem który chciał mnie dopaść i próbowałam się schować w jakimś parku rozrywki by widzieć jak będzie nadciągał. Uciekając i chowając się i tak mnie jakoś dorwał, szarpaliśmy się ale że to było miejsce publiczne to ktoś go powstrzymał i uciekłam do jakiegoś sklepu. Chodziłam ale tam też mnie znalazł i próbował zabić ale udawało mi się go unikać i nawet jak się rzucał na mnie z taką złością i nienawiścią w twarzy.'
const ODPOWIEDZ = 'Byłam w mieszkaniu jakimś było chyba moje i dowiedziałam się nie wiem skąd, że idzie po mnie ktoś by mnie zabić. Próbowałam zadzwonić do kogoś i myślałam czy mam jakiegoś znajomego z policji ale nie miałam. Finalnie policję jakoś powiadomiłam i czekałam aż przejdzie, otworzyłam okno by wrazie czego przez nie uciec. Było zimno. Otworzyły się drzwi a w nich jakiś mężczyzna, więc już wiedziałam że policja nie zdąży przyjechać. Podszedł do mnie jeszcze próbowałam uciekać ale nie było dokąd więc tylko się broniłam ale nieskutecznie bo mnie zabił.'
const POTWOR = 'Byłam w jakimś ciemnym miejscu nie było nic i tylko z ciemności, rzucił się na mnie potwór, wygląd jego był taki jakby miał pysk ale obdarty że skóry i otwarty na wszystkie strony i tabulo widać jego wnętrzności i krew i zęby na wierzchu.'

test('Reprezentuj: lider, rywalizacja, ochrona — bez drobiazgów', () => {
  const s = autoSymbols(REPREZENTUJ, 'Reprezentuj')
  assert.ok(s.includes('Lider'))
  assert.ok(s.includes('Rywalizacja'))
  assert.ok(s.includes('Ochrona'))
  assert.ok(!s.includes('Telefon'))
})

test('Nie złapiesz go: ochrona i ucieczka (pościg)', () => {
  const s = autoSymbols(NIE_ZLAPIESZ, 'Nie złapiesz go')
  assert.ok(s.includes('Ochrona'))
  assert.ok(s.includes('Ucieczka'))
})

test('Czemu oszukujesz: sklep, oszustwo, pieniądze i liczba 30 z tabeli kursu', () => {
  const t = autoTags({ title: 'Czemu oszukujesz', text: OSZUKUJESZ })
  assert.ok(t.symbols.includes('Sklep'))
  assert.ok(t.symbols.includes('Oszustwo'))
  assert.ok(t.symbols.includes('Pieniądze'))
  assert.equal(t.numbers, '30')   // 50 nie ma w tabeli
})

test('Kotek i myszka: kot i mysz z tytułu, ucieczka, walka, park rozrywki', () => {
  const s = autoSymbols(KOTEK, 'Kotek i myszka')
  for (const n of ['Kot', 'Mysz', 'Ucieczka', 'Walka', 'Park rozrywki', 'Sklep', 'Ukrywanie']) assert.ok(s.includes(n), n)
  assert.ok(s.length <= 14)
})

test('Odpowiedz na pytanie: policja, zagrożenie, ucieczka, dom', () => {
  const s = autoSymbols(ODPOWIEDZ, 'Odpowiedz na pytanie')
  for (const n of ['Policja', 'Zagrożenie', 'Ucieczka', 'Dom', 'Śmierć']) assert.ok(s.includes(n), n)
})

test('Potworze, czy mnie złapiesz: potwór, ciemność, krew, zęby', () => {
  const s = autoSymbols(POTWOR, 'Potworze czy mnie złapiesz')
  for (const n of ['Potwór', 'Ciemność', 'Krew', 'Zęby']) assert.ok(s.includes(n), n)
})

test('telefon, pokój i jedzenie nie są symbolami', () => {
  assert.ok(!AUTO_SYMBOL_NAMES.some(n => ['Telefon', 'Pokój', 'Jedzenie', 'Zdjęcia'].includes(n)))
  assert.deepEqual(autoSymbols('Wyciągnęłam telefon, weszłam do pokoju i zjadłam obiad', ''), [])
})

test('liczby: tylko z tabeli kursu, bez godzin i cen', () => {
  assert.equal(autoNumbers('o 9:00 zapłaciłam 280 zł i było 12 osób, a numer 18'), '12')
  assert.equal(autoNumbers('trzy auta'), '3')
})

test('applyAutoTags uzupełnia tylko braki i szanuje własne tagi', () => {
  const dreams = [
    { title: 'Bez tagów', text: KOTEK, category: 'zwykly', extra: {} },
    { title: 'Z tagami', text: KOTEK, category: 'zwykly', symbolNames: ['moje'], extra: { emotions: ['smutek'] } },
    { title: 'Własna kategoria', text: KOTEK, category: 'przyjemny', extra: {} },
    { title: 'Własna custom', text: KOTEK, categoryName: 'Moja', extra: {} },
  ]
  const { dreams: out, usedSymbols } = applyAutoTags(dreams)
  assert.ok(out[0].symbolNames.includes('Ucieczka'))
  assert.ok(out[0].category)
  assert.deepEqual(out[1].symbolNames, ['moje'])
  assert.deepEqual(out[1].extra.emotions, ['smutek'])
  assert.equal(out[1].category, 'zwykly')      // otagowany sen: kategoria zostaje
  assert.equal(out[2].category, 'przyjemny')
  assert.equal(out[3].categoryName, 'Moja')
  assert.ok(usedSymbols.includes('Ucieczka'))
})

const KATAKLIZM = 'Zaczęły nadchodzić ciemne chmury i utworzył się ogromny lej, potem fala uderzeniowa i huknięcie. Patrzyłam z góry, a z ziemi wydobywał się ogień. Spadł deszcz, a obok był wodospad, góry, drzewo i wielki kamień. Było zimno i pięknie. Mieliśmy 7 minut, a potem trzy osoby.'
test('konkretne rzeczczowniki i zjawiska: wodospad, góry, deszcz, kamień, zimno, piękno', () => {
  const s = autoSymbols(KATAKLIZM, '')
  for (const n of ['Wodospad', 'Góry', 'Deszcz', 'Kamień', 'Drzewo', 'Chmury', 'Tornado', 'Wybuch', 'Ogień']) assert.ok(s.includes(n), n)
  const t = autoSymbols('Było zimno i pięknie.', '')
  assert.ok(t.includes('Mróz i zimno') && t.includes('Piękno'))
})
test('„z góry" to nie Góry; fala to nie morze', () => {
  const s = autoSymbols('Patrzyłam z góry, nadeszła fala.', '')
  assert.ok(!s.includes('Góry'))
  assert.ok(!s.includes('Morze'))
  assert.ok(s.includes('Fala'))
})
test('liczby jako symbole (cyfry i słowa), bez godzin i kwot', () => {
  const s = autoSymbols('Było 7 osób, trzy auta, o 12:30 za 50 zł, w 2021 roku.', '')
  assert.ok(s.includes('Liczba 7'))
  assert.ok(s.includes('Liczba 3'))
  assert.ok(!s.includes('Liczba 12'))
  assert.ok(!s.includes('Liczba 50'))
  assert.ok(!s.includes('Liczba 2021'))
})

test('przemoc: dźgnął, zaatakował, przytrzymał, zabił, udusił', () => {
  const s = autoSymbols('Mężczyzna mnie zaatakował, przytrzymał i dźgnął nożem, potem próbował mnie udusić. Zabił też mojego kota.', '')
  for (const n of ['Zaatakowanie', 'Przytrzymanie', 'Dźgnięcie', 'Duszenie', 'Zabójstwo']) assert.ok(s.includes(n), n)
})

test('atak to zaatakowanie, ale atak paniki i fala uderzeniowa nie', () => {
  assert.ok(autoSymbols('Był atak na mnie.', '').includes('Zaatakowanie'))
  assert.ok(!autoSymbols('Miałam atak paniki.', '').includes('Zaatakowanie'))
  assert.ok(!autoSymbols('Nadeszła fala uderzeniowa.', '').includes('Bicie i uderzenie'))
  assert.ok(autoSymbols('Uderzył mnie w twarz.', '').includes('Bicie i uderzenie'))
})

import { autoSymbolWords } from '../src/utils/dreamAutoTags.js'
import { tokenizeDreamText } from '../src/utils/dreamLogic.js'
test('słowa, które dały symbol: wygrać → Rywalizacja, dwóch → Liczba 2, liderem → Lider', () => {
  const t = 'Dwóch liderów, pod liderem. Miał wygrać, a ja ratowałam. Było 7 osób.'
  const w = autoSymbolWords(t, ['Rywalizacja', 'Liczba 2', 'Lider', 'Ochrona', 'Liczba 7', 'Mój własny'])
  assert.ok(w['rywalizacja'].includes('wygrać'))
  assert.ok(w['liczba 2'].includes('dwóch'))
  assert.ok(w['lider'].includes('liderem'))
  assert.ok(w['ochrona'].includes('ratowałam'))
  assert.deepEqual(w['liczba 7'], ['7'])
  assert.equal(w['mój własny'], undefined)
})
test('tokenizer podkreśla dodatkowe formy symbolu (words)', () => {
  const segs = tokenizeDreamText('Miał wygrać zawody', [], [{ id: 's', name: 'Rywalizacja', words: ['wygrać'], color: '#f00' }])
  assert.ok(segs.some(s => s.kind === 'symbol' && s.t === 'wygrać' && s.id === 's'))
})
