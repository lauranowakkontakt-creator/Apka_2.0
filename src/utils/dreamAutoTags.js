// Automatyczne oznaczanie snów, w których nic nie otagowano (np. pisanych na zmęczeniu).
// Czysta logika bez Firebase. Własne tagi użytkowniczki (symbole, emocje, kategoria) mają
// zawsze pierwszeństwo — to uzupełnia tylko to, czego brakuje.
//
// Symbole wybieramy tak, jak uczy kurs 201: szukamy tego, co w śnie ważne (osoby w roli,
// motyw, miejsce, pojazd, zwierzę, żywioł), a nie każdego przedmiotu z opisu. Telefon, pokój
// czy jedzenie to zwykle tło (drugi plan), więc ich nie oznaczamy.
//
// W regułach: `<` = początek słowa, `>` = koniec słowa (Unicode — działa z polskimi literami);
// `(?<!…)` i `(?<=…)` zostają zwykłymi lookbehindami.

const rx = (p) => new RegExp(p.replace(/(?<!\?)</g, '(?<![\\p{L}\\p{N}])').replace(/>/g, '(?![\\p{L}\\p{N}])'), 'giu')

// ─── Symbole ────────────────────────────────────────────────────────────────
// [nazwa, wzorzec, min. liczba wystąpień, waga, podpowiedź z kursu]
// Waga: motywy i role ważą więcej niż rekwizyty.
const POJAZD = 'Kurs: pojazdy zwykle odnoszą się do służby lub powołania.'
const BUDYNEK = 'Kurs: budynki często odnoszą się do budowania.'
const DEFS = [
  // role i osoby (kurs: kim jest postać, jaką rolę odgrywa, czy ją znasz)
  ['Pastor', '<pastor', 1, 4, ''],
  ['Lider', '<lider', 1, 4, ''],
  ['Policja', '<polic|<radiowóz', 1, 4, ''],
  ['Nauczyciel', '<nauczyciel|<wykładow', 1, 3, ''],
  ['Szef', '<szef|<dyrektor', 1, 3, ''],
  ['Dziecko', '<dzieck|<dzieci>|<dzieciom|<chłopczyk|<chłopiec|<dziewczynk|<noworodk', 1, 3, ''],
  ['Nieznajomy', '<(?:jakiś|jakiegoś|jakimś|jakiejś) (?:gość|gościu|facet|typek|ziomek|mężczyzn|człowiek|pani)|<nieznajom|<obc(?:y|ych|ego)>|<podejrzan|<bezdomn|<porywacz', 1, 4, ''],
  // motywy i działania (kurs: akcja, pozycja śniącego, plany wroga)
  ['Ucieczka', '<ucieka|<uciec|<uciek|<goni|<gonił|<gonić|<ścigan|<ścigał', 1, 5, ''],
  ['Ukrywanie', '<chowa|<chowan|<schow|<ukry|<kryć|<krył', 1, 4, ''],
  ['Ochrona', '<chroni|<ochron|<obron|<ratow|<uratow|<ratunk', 1, 4, ''],
  ['Walka', '<walcz|<szarp|<bił>|<zaatak|<raniłam|<ranić|<pobit|<pobił|<zranił|<nożownik', 1, 5, ''],
  ['Zagrożenie', '<zabi|<morder|<zabój|<napastnik|<włamywacz|<porwa|<złodziej|<atak>', 1, 5, ''],
  ['Strata', '<zgubi|<zgubił|<ukradl|<ukradł|<okradl|<okradli|<zagini|<brakowało|<zniknęł', 1, 4, ''],
  ['Oszustwo', '<oszuk|<okłam|<kłamst|<oszust|<nie zgadza', 1, 5, ''],
  ['Spóźnienie', '<spóźni|<nie zdąż|<za późno', 1, 4, ''],
  ['Rywalizacja', '<wygra|<przegra|<wyścig|<konkurs|<ścigał', 1, 4, ''],
  ['Odrzucenie', '<wystawili|<wystawił|<zostawili mnie|<odepchnęła|<odrzuc|<zostawił mnie', 1, 4, ''],
  ['Egzamin', '<matur|<egzamin|<ocen(?:ę|y|a|ie)>|<punktów', 1, 4, ''],
  ['Śmierć', '<nie żyje|<zmarł|<umarł|<zginął|<zginęło|<zastrzeli|<zabił>|<zabiła>|<zabity|<zabici|<pogrzeb', 1, 5, ''],
  ['Wypadek', '<wypadek|<wypadku|<wypadł|<rozbił|<rozbiło|<potrąc|<spadł|<spadłam|<zarzuciło', 1, 4, ''],
  ['Wojna', '<wojn', 1, 4, ''],
  ['Choroba', '<chor(?:a|y|ą|e)>|<wymiot|<ból|<bolała|<kuśtykał', 2, 3, ''],
  ['Ślub', '<ślub|<wesel|<narzeczon|<małżeńst|<męż(?:a|em|owi|u)>|<mąż>|<żon(?:a|ę|ą|y)>', 1, 4, ''],
  ['Randka', '<randk', 1, 4, ''],
  ['Bliźnięta', '<bliźni', 1, 3, ''],
  ['Ciąża i poród', '<ciąż|<rodziłam|<poród|<noworodk', 1, 4, ''],
  // miejsca i budynki
  ['Dom', '<dom(?:u|em|ek|ku|ie|y|ów)?>|<mieszkani|<domk', 1, 3, BUDYNEK],
  ['Kościół', '<kości(?:ół|oła|ele|ołem)|<nabożeń|<uwielbieni', 1, 3, ''],
  ['Szkoła', '<szkoł|<lekcj|<klas(?:a|ę|y)>|<studi', 1, 3, 'Kurs: sny o etapach życia pokazują miejsca, w których kiedyś mieszkałaś, szkoły, dawne miejsca pracy.'],
  ['Sklep', '<sklep|<centrum handlow|<hotel', 1, 3, BUDYNEK],
  ['Park rozrywki', '<park(?:u|i|iem)? rozrywk|<kolejk(?:a|ę|i)> górsk|<wesołe miasteczko', 1, 3, ''],
  ['Most', '<most>|<moście|<mostu', 1, 3, ''],
  ['Jaskinia', '<jaskini|<podziemi|<piwnic', 1, 3, ''],
  ['Schody i winda', '<schod|<wind(?:a|ę|y|ą)>|<klatk(?:a|ę|i|ą|ach) schod|<klatk(?:a|ę|i|ą)>', 1, 3, ''],
  ['Wieżowiec', '<wieżowc|<wieżowiec|<blok(?:u|iem)?>', 1, 3, BUDYNEK],
  ['Drzwi', '<drzwi', 2, 2, ''],
  ['Klucze', '<klucz', 1, 3, ''],
  // pojazdy (kurs: służba, powołanie)
  ['Auto', '<auto>|<auta>|<autem|<samoch|<opel|<radiowóz', 1, 3, POJAZD],
  ['Samolot', '<samolot', 1, 4, POJAZD],
  ['Helikopter', '<helikopter', 1, 4, POJAZD],
  ['Rower', '<rower', 1, 3, POJAZD],
  ['Motocykl', '<motor>|<motorem|<motocykl|<motorzyst', 1, 4, POJAZD],
  ['Pociąg', '<pociąg', 1, 3, POJAZD],
  // przyroda i żywioły
  ['Woda', '<wod(?:a|ą|ę|y|zie)>|<basen|<jacuzzi|<morz|<ocean|<rzek|<jezior|<staw>|<powódź|<wodospad', 1, 4, ''],
  ['Góry', '<gór(?:y|ami|ach|om)>|<wspin', 1, 3, ''],
  ['Las', '<las>|<lesie|<lasu|<drzew|<ogród|<ogródk', 1, 3, ''],
  ['Burza', '<burz|<sztorm|<tornad|<trzęsieni', 1, 4, ''],
  ['Śnieg', '<śnieg', 1, 3, ''],
  ['Ogień', '<pożar|<płon|<zaczęło się palić|<ogień|<ognia', 1, 4, ''],
  ['Światło', '<światł|<zorz|<latark', 1, 3, ''],
  ['Ciemność', '<ciemn', 1, 4, ''],
  // zwierzęta (kurs: lista zwierząt)
  ['Kot', '<kot(?:ek|ka|ku|a|em|y|ów|ki)?>|<kotk|<kocie', 1, 4, ''],
  ['Mysz', '<mysz', 1, 3, ''],
  ['Pies', '<pies>|<psy>|<psów|<psa>|<psem', 1, 4, ''],
  ['Lew', '<lew>|<lwa>|<lwem|<lwi', 1, 4, ''],
  ['Koń', '<koń>|<konia', 1, 4, ''],
  ['Wąż', '<wąż|<węż', 1, 4, ''],
  ['Pająk', '<pająk', 1, 4, ''],
  ['Żaba', '<żab', 1, 3, ''],
  ['Ptak', '<ptak|<orzeł|<orła|<kaczk', 1, 3, ''],
  ['Zwierzę', '<zwierz(?:ę|ęcia|ęciem|ęta)>', 1, 3, ''],
  // ciało i ubranie
  ['Zęby', '<zęb', 1, 4, ''],
  ['Krew', '<krew|<krwi>|<krwaw|<wnętrzności', 1, 4, ''],
  ['Potwór', '<potwor|<potwór|<monstr|<straszydł', 1, 5, ''],
  ['Gaz pieprzowy', '<gaz pieprzow', 1, 3, ''],
  ['Włosy', '<włos', 1, 3, ''],
  ['Nagość', '<naga>|<nago>|<nagi>|<rozebr|<w samej bieliźnie', 1, 4, ''],
  ['Ubranie', '<sukni|<bluz|<strój|<buty|<z buta|<płaszcz|<przebra', 2, 2, ''],
  // rzeczy ważne tylko, gdy są osią snu
  ['Broń', '<broń|<broni>|<pistolet|<nóż|<nożem|<strzel|<rewolwer', 1, 4, ''],
  ['Pieniądze', '<zł>|<pieniąd|<tysięcy|<rachun|<płac|<płat|<kart(?:a|ę|y|ą)>', 2, 3, ''],
  ['Laptop', '<laptop|<komputer|<dysk', 2, 2, ''],
  ['Torba', '<torb|<plecak|<walizk', 2, 2, ''],
  // duchowe
  ['Modlitwa', '<modl|<na językach|<uwielbieni', 1, 4, ''],
  ['Demon', '<demon|<duchy>|<duchów|<diabe|<szatan', 1, 5, ''],
  ['Jezus', '<jezus|<chrystus|<duch święty', 1, 4, ''],
  ['Anioł', '<anioł|<aniołow', 1, 4, ''],
].map(([name, p, min, weight, hint]) => ({ name, re: rx(p), min, weight, hint }))

export const AUTO_SYMBOL_NAMES = DEFS.map(d => d.name)
export const autoSymbolHint = (name) => DEFS.find(d => d.name === name)?.hint || ''

const count = (re, text) => (text.match(re) || []).length

// Do ilu symboli maksymalnie na sen — kurs: sen ma jedną główną myśl, nie samą listę rzeczy.
const MAX_SYMBOLS = 8

export function autoSymbols(text, title = '') {
  const found = []
  for (const d of DEFS) {
    const n = count(d.re, text)
    const inTitle = count(d.re, title) > 0
    if (n >= d.min || inTitle) found.push({ name: d.name, score: (inTitle ? 100 : 0) + n * 3 + d.weight })
  }
  return found.sort((a, b) => b.score - a.score).slice(0, MAX_SYMBOLS).map(f => f.name)
}

// ─── Emocje (tylko to, co piszesz o sobie) ──────────────────────────────────
const EMO = {
  lek: rx('byłam przerażon|byłam wystraszon|byłam przestraszon|wystraszona>|przerażona>|przestraszył[ao]? mnie|<bałam się|<boję się|<panikowałam|atak paniki|ataku paniki|czułam strach|taki strach|<boję>'),
  niepokoj: rx('czułam niepokój|byłam zaniepokojon|byłam zestresowan|zaczęłam odczuwać niepokój'),
  smutek: rx('było mi przykro|zrobiło mi się przykro|(?<!nie )byłam smutna|było mi smutno|<płakałam|lecieć mi łzy|ukrywałam łzy|byłam załamana|zrozpaczona|zaczęłam płakać|odeszłam z płaczem|chciało mi się płakać'),
  zlosc: rx('<wkurzyłam|<zdenerwowałam się|(?<!nie )byłam zła|byłam wkurzona|<zła na|strzeliłam focha|byłam wściekła|<wkurzona>'),
  wstyd: rx('odczuwałam wstyd|było mi głupio|zawstydzon|było mi wstyd'),
  radosc: rx('cieszyłam się|byłam szczęśliwa|byłam zadowolona|byłam w pozytywnym szoku|<śmiałam się'),
  spokoj: rx('byłam spokojna|czułam spokój|<spokojnie>'),
  milosc: rx('z takiej miłości'),
  zdezorientowanie: rx('nie ogarniałam|nie wiedziałam,? co (?:mam )?(?:robić|zrobić)|byłam w szoku|zdziwiłam się|byłam oszołomiona'),
}
export function autoEmotions(text) {
  const sc = Object.entries(EMO).map(([id, re]) => [count(re, text), id]).filter(([n]) => n > 0).sort((a, b) => b[0] - a[0])
  return sc.slice(0, 3).map(([, id]) => id)
}

// ─── Kategoria wbudowana (jak w Twojej Apce: Przyjemny, Koszmar, Duchowy…) ──
const NEG = rx('przerażon|<panik|napastnik|<atakow|<atak>|<zabi|<morder|<zabój|<zastrzel|<włamywacz|<porwa|<strach|<bałam|<molest|<obmacyw|<gwałc|<ucieka|<goni|<zranił|<raniłam')
const POS = rx('<piękn|<przytul|<objęła|z miłości|<zadowol|<cieszył|<śmiał|<radoś|<świetnie|<pokochał|<uwielbieni|<dumn|zależy na mnie|<spokojn')
const SPIR = rx('<modl|<demon|<duchy>|<duchów|<diabe|w imieniu jezusa|na językach|duch święty')
const FAM = rx('<mama>|<mamy>|<mamę|<tata>|<rodzic|<dziadk|<babci|<kuzyn|<brat>|<siostr|<ojciec')

export function autoCategory(text) {
  if (count(SPIR, text) >= 1) return 'duchowy'
  if (count(NEG, text) >= 3) return 'koszmar'
  if (count(POS, text) >= 1 && count(NEG, text) === 0) return 'przyjemny'
  if (count(FAM, text) >= 3) return 'o_bliskich'
  return 'zwykly'
}

// ─── Kolory (tylko wprost nazwane) i liczby z tabeli kursu ──────────────────
const COLORS = {
  czerwony: rx('<czerwon'), niebieski: rx('<niebiesk'), zielony: rx('<zielon'), brazowy: rx('<brązow'),
  zloty: rx('<złot|<bursztyn'), purpurowy: rx('<purpur|<fiolet'), pomaranczowy: rx('<pomarańcz'), srebrny: rx('<srebrn'),
  zolty: rx('<żółt'), rozowy: rx('<różow'), szary: rx('<szar(?:y|a|e|ą|ym)>(?! szereg)'), bialy: rx('<biał(?:y|a|ą|e|ym|ej)>'),
}
export const autoColors = (text) => Object.entries(COLORS).filter(([, re]) => count(re, text) > 0).map(([id]) => id)

const TABLE_NUMBERS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 25, 30, 37, 40, 111, 120, 153, 666, 888, 1500])
export function autoNumbers(text) {
  const out = []
  for (const m of text.matchAll(/(?<![\d:.,])(\d{1,4})(?![\d:.,]| ?zł| ?tys| ?km| ?min| ?metr)/g)) {
    const n = Number(m[1])
    if (TABLE_NUMBERS.has(n) && !out.includes(n)) out.push(n)
  }
  return out.join(', ')
}

// ─── Całość ─────────────────────────────────────────────────────────────────
export function autoTags({ title = '', text = '' }) {
  return {
    symbols: autoSymbols(text, title),
    emotions: autoEmotions(text),
    category: autoCategory(text),
    colors: autoColors(text),
    numbers: autoNumbers(text),
  }
}

// Uzupełnia TYLKO braki: własne symbole, emocje, kategoria (poza „zwykły"), kolory i liczby zostają.
// Zwraca nowe sny oraz nazwy użytych symboli automatycznych.
export function applyAutoTags(dreams) {
  const used = new Set()
  let filled = 0
  const out = dreams.map(d => {
    const t = autoTags({ title: d.title, text: d.extra?.originalText || d.text })
    const extra = { ...(d.extra || {}) }
    let symbolNames = d.symbolNames || []
    if (!symbolNames.length && t.symbols.length) { symbolNames = t.symbols; t.symbols.forEach(n => used.add(n)) }
    if (!extra.emotions?.length && t.emotions.length) extra.emotions = t.emotions
    if (!extra.colors?.length && t.colors.length) extra.colors = t.colors
    if (!extra.numbers && t.numbers) extra.numbers = t.numbers
    // Własną kategorię (np. „Zwykły" wybrany świadomie przy otagowanym śnie) zostawiamy.
    const hasOwnTags = !!(d.symbolNames?.length || d.extra?.emotions?.length)
    const category = d.categoryName ? d.category : (!d.category || (d.category === 'zwykly' && !hasOwnTags)) ? t.category : d.category
    if (symbolNames !== (d.symbolNames || []) || extra.emotions !== d.extra?.emotions || category !== d.category) filled++
    return { ...d, symbolNames, category, extra }
  })
  return { dreams: out, usedSymbols: [...used], filled }
}
