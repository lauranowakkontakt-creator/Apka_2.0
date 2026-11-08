// Pola zapisu snu wg metody Johna Paula Jacksona — czyste dane, bez Firebase.
// Źródło: „Zrozumienie snów i wizji", Kurs 201 (Streams / Sny i Wizje), rozdziały
// 3.2, 3.4, 4.3, 5.2, 5.4, 6.1, 6.3 i 8.1. Nazwy kategorii, pozycji, składowych
// i tabela liczb są z podręcznika. Podręcznik NIE podaje znaczeń kolorów
// (tabela jest do wypełnienia przez uczestnika), dlatego aplikacja ich nie zgaduje.

// ─── Gdzie jestem w śnie (rozdz. 3.4) → odpowiada na pytanie „o kim jest sen" ──
export const DREAM_POSITIONS = [
  { id: 'obserwator', label: 'Obserwator', hint: 'Widzę akcję, nie biorę w niej udziału' },
  { id: 'uczestnik',  label: 'Uczestnik',  hint: 'Jestem częścią snu, ale uwaga nie jest na mnie' },
  { id: 'centrum',    label: 'W centrum uwagi', hint: 'Wszystko kręci się wokół mnie' },
  { id: 'zmiana',     label: 'Zmieniam rolę', hint: 'Np. z obserwatora stałam się uczestnikiem' },
]

// ─── Sfera snu (rozdz. 3.2) ────────────────────────────────────────────────
export const DREAM_SPHERES = [
  { id: 'wewnetrzny', label: 'Wewnętrzny', hint: 'O moim sercu i relacji z Bogiem' },
  { id: 'zewnetrzny', label: 'Zewnętrzny', hint: 'O kimś lub czymś innym: ludzie, miasta, kościoły. Zwykle skłania do modlitwy' },
]

// ─── Trzy źródła snów (rozdz. 5.3) ─────────────────────────────────────────
export const DREAM_ORIGINS = [
  { id: 'bog',      label: 'Od Boga',             color: '#C9A24A' },
  { id: 'dusza',    label: 'Z duszy ludzkiej',    color: '#5BB6D9' },
  { id: 'demony',   label: 'Z królestwa demonów', color: '#7C8AF0' },
  { id: 'nie_wiem', label: 'Nie wiem',            color: '#9E9E9E' },
]

// ─── Dwadzieścia kategorii snów (rozdz. 5.2) — sen może mieć kilka ─────────
export const DREAM_KINDS = [
  { id: 'uzdrowienia',  label: 'Uzdrowienia' },
  { id: 'oczyszczenia', label: 'Oczyszczenia' },
  { id: 'powolania',    label: 'Powołania' },
  { id: 'ostrzegawczy', label: 'Ostrzegawczy' },
  { id: 'falszywy',     label: 'Fałszywy' },
  { id: 'cialo',        label: 'Źródłem jest ciało' },
  { id: 'chemiczny',    label: 'Pod wpływem związków chemicznych' },
  { id: 'stan',         label: 'Ujawniający nasz stan' },
  { id: 'odwaga',       label: 'Dodający odwagi' },
  { id: 'korekta',      label: 'Korekty' },
  { id: 'kierunek',     label: 'Nadający kierunek' },
  { id: 'wstawienniczy', label: 'Wstawienniczy' },
  { id: 'proroczy',     label: 'Proroczy i objawiający' },
  { id: 'mroczny',      label: 'Mroczny' },
  { id: 'walka',        label: 'Walki duchowej' },
  { id: 'lekowy',       label: 'Lękowy' },
  { id: 'wynalazek',    label: 'Inwencji (wynalazków)' },
  { id: 'slowo_wiedzy', label: 'Ze słowem wiedzy' },
  { id: 'uwalniajacy',  label: 'Uwalniający' },
  { id: 'z_duszy',      label: 'Z duszy' },
].map(k => ({ ...k, color: '#9B7CF0' }))

// ─── Barwa obrazu (rozdz. 3.4 F.5 i 8.2) ───────────────────────────────────
export const DREAM_VIVIDNESS = [
  { id: 'kolorowy',     label: 'Kolorowy' },
  { id: 'stonowany',    label: 'Stonowany' },
  { id: 'czarno_bialy', label: 'Czarno-biały' },
]

// ─── Wydźwięk / atmosfera snu (rozdz. 3.4 G) ───────────────────────────────
export const DREAM_ATMOSPHERE = [
  { id: 'strach', label: 'Strach' },
  { id: 'beznadzieja', label: 'Beznadzieja' },
  { id: 'niepokoj', label: 'Niepokój' },
  { id: 'spokoj', label: 'Spokój' },
  { id: 'oczekiwanie', label: 'Oczekiwanie' },
  { id: 'nieprzyjemna', label: 'Nieprzyjemna' },
  { id: 'zlowieszcza', label: 'Złowieszcza' },
  { id: 'ekscytujaca', label: 'Ekscytująca' },
  { id: 'beztroska', label: 'Beztroska' },
  { id: 'neutralna', label: 'Neutralna' },
]

// ─── Kolory (rozdz. 6.1, tabela). plus/minus tylko tam, gdzie je podałaś ────
export const DREAM_COLORS = [
  { id: 'czerwony',  label: 'Czerwony',  color: '#E66A4E', plus: 'namaszczenie, odkupienie', minus: 'gniew, wojna' },
  { id: 'niebieski', label: 'Niebieski', color: '#5B8DEF', plus: 'objawienie', minus: 'depresja, izolacja' },
  { id: 'zielony',   label: 'Zielony',   color: '#5FBF98' },
  { id: 'brazowy',   label: 'Brązowy',   color: '#9C7A5B' },
  { id: 'zloty',     label: 'Złoty, bursztyn', color: '#C9A24A' },
  { id: 'purpurowy', label: 'Purpurowy', color: '#9B4FD6' },
  { id: 'pomaranczowy', label: 'Pomarańczowy', color: '#EA964B' },
  { id: 'srebrny',   label: 'Srebrny',   color: '#A9B1BC' },
  { id: 'zolty',     label: 'Żółty',     color: '#E6C04A' },
  { id: 'rozowy',    label: 'Różowy',    color: '#E8607A' },
  { id: 'szary',     label: 'Szary',     color: '#8A8F98' },
  { id: 'bialy',     label: 'Biały',     color: '#D8D8D8' },
]

// ─── Tabela liczb (rozdz. 8.1). Znaczenie zależy od kontekstu snu ───────────
export const NUMBER_TABLE = [
  [1, 'Bóg'], [2, 'Pomnożenie / podzielenie'], [3, 'Trójca'], [4, 'Boże dzieła'],
  [5, 'Łaska / odkupienie'], [6, 'Człowiek'], [7, 'Perfekcja / doskonałość'],
  [8, 'Nowe początki (Nauczyciel)'], [9, 'Sąd (Ewangelista)'],
  [10, 'Podróż / przygoda / pustynia (Pastor)'], [11, 'Okres przejściowy (Prorok)'],
  [12, 'Rząd (Apostoł)'], [13, 'Bunt'], [14, 'Podwójne namaszczenie'],
  [15, 'Wytchnienie / miłosierdzie'], [16, 'Ustanowienie nowych początków'], [17, 'Elekcja'],
  [25, 'Rozpoczęcie szkolenia do służby'], [30, 'Rozpoczęcie służby'],
  [37, 'Pierworodny / liczba pierwsza'], [40, 'Pokolenie i rządy, które się dopełniły'],
  [111, 'Mój umiłowany syn'], [120, 'Śmierć dla ciała'], [153, 'Pomnożenie królestwa'],
  [666, 'Pełnia nieprawości'], [888, 'Zmartwychwstanie'], [1500, 'Światło, moc, autorytet'],
].map(([n, meaning]) => ({ n, meaning }))

export const NUMBER_CAVEAT =
  'Liczby mają znaczenie, ale to kontekst snu daje pełnię znaczenia. Nie nadawaj im więcej, niż znaczą.'

// Liczby występujące w tekście (całe liczby, nie fragmenty) → wpisy z tabeli.
export function numberMeanings(text) {
  if (!text) return []
  const found = new Set((String(text).match(/\d+/g) || []).map(Number))
  return NUMBER_TABLE.filter(e => found.has(e.n))
}

// ─── Składowe snu (rozdz. 6.1, 6.3, 8.1) — co się pojawiło ──────────────────
export const DREAM_ELEMENTS = [
  { id: 'postacie', label: 'Postacie', items: [
    'Znana osoba', 'Nieznana osoba', 'Postać bez twarzy', 'Osoba z konkretnym imieniem',
    'Martwa osoba', 'Małżonek', 'Dziecko', 'Rodzic' ] },
  { id: 'pojazdy', label: 'Środki transportu', items: [
    'Samolot', 'Helikopter', 'Samochód', 'Autobus', 'Samochód ciężarowy', 'Traktor', 'Taksówka',
    'Limuzyna', 'Pociąg', 'Statek / łódź', 'Łódź podwodna', 'Rower', 'Motocykl', 'Metro',
    'Rydwan', 'Statek kosmiczny', 'Kolejka górska' ] },
  { id: 'budynki', label: 'Budynki', items: [
    'Dom', 'Zamek', 'Namiot', 'Wieżowiec', 'Budynek biurowy', 'Hotel', 'Centrum handlowe',
    'Stadion', 'Szpital', 'Stacja paliw', 'Gospodarstwo rolne', 'Stodoła / magazyn', 'Teatr' ] },
  { id: 'pomieszczenia', label: 'Pomieszczenia w domu', items: [
    'Łazienka', 'Kuchnia', 'Salon', 'Strych', 'Piwnica', 'Sypialnia', 'Okna', 'Fundament',
    'Dach', 'Hol', 'Schody', 'Winda', 'Ganek', 'Garaż', 'Ogród' ] },
  { id: 'zwierzeta', label: 'Zwierzęta', items: [
    'Wąż', 'Koń', 'Wół / krowa', 'Szczur', 'Pająk', 'Pszczoła / szerszeń', 'Muchy', 'Wilki',
    'Czarna pantera', 'Tygrys', 'Orzeł', 'Owca', 'Koza', 'Osioł', 'Ośmiornica', 'Aligator',
    'Słoń', 'Wieloryb', 'Niedźwiedź', 'Kot', 'Małpa', 'Żaba' ] },
  { id: 'pogoda', label: 'Pogoda', items: [
    'Burza', 'Chmury', 'Tornado', 'Wiatr', 'Deszcz', 'Trzęsienie ziemi', 'Śnieg' ] },
  { id: 'cialo', label: 'Części ciała', items: [
    'Udo', 'Nos', 'Ręka', 'Ramię', 'Zęby', 'Unieruchomienie części ciała', 'Broda', 'Włosy',
    'Nagość', 'Szyja', 'Bok' ] },
  { id: 'ubrania', label: 'Odzież', items: [
    'Płaszcz', 'Strój kąpielowy', 'Odzież narodowa', 'Suknia ślubna', 'Buty',
    'Ubranie, które nie pasuje' ] },
  { id: 'przedmioty', label: 'Przedmioty i narzędzia', items: [
    'Nóż', 'Miecz', 'Pistolet', 'Pierścionek' ] },
  { id: 'inne', label: 'Inne', items: [
    'Doświadczenie seksualne', 'Pieniądze', 'Drzewa', 'Uprawy', 'Latanie', 'Czynność powtarzająca się',
    'Etap życia (stary dom, szkoła)', 'Sen świadomy' ] },
]

// Co było przed snem (rozdz. 4.3 i kat. 6–7). Gniew, pycha i alkohol osłabiają też pamięć snów.
export const BEFORE_SLEEP = [
  { id: 'gniew', label: 'Gniew w sercu' },
  { id: 'pycha', label: 'Pycha' },
  { id: 'alkohol', label: 'Alkohol' },
  { id: 'leki', label: 'Leki' },
  { id: 'ciezki_posilek', label: 'Ciężki posiłek' },
  { id: 'bol_choroba', label: 'Ból / choroba' },
  { id: 'niepokoj', label: 'Zasypiałam w niepokoju' },
]

// ─── Pytania pomocnicze do interpretacji (rozdz. 3.4, 6.1) ─────────────────
export const GUIDE_QUESTIONS = [
  { id: 'tytul', group: 'Sen jako całość', q: 'Jaki tytuł nadać temu snu?' },
  { id: 'gdzie', group: 'Sen jako całość', q: 'Gdzie jestem w tym śnie? Kto jest w centrum uwagi, o kim jest sen?' },
  { id: 'drugi-plan', group: 'Sen jako całość', q: 'Co jest drugim planem (niezbędnym kontekstem), a co tylko szczegółem?' },
  { id: 'najprostsza', group: 'Sen jako całość', q: 'Jak wygląda sen sprowadzony do najprostszej formy?' },
  { id: 'motyw', group: 'Sen jako całość', q: 'Jaki przedmiot lub myśl wraca najczęściej albo została ze mną po przebudzeniu?' },
  { id: 'karykatura', group: 'Sen jako całość', q: 'Co zostało wyolbrzymione? (Sny są jak karykatury: wzmacniają, żeby zwrócić uwagę, nie po to, by mówić, że tak dokładnie jest.)' },
  { id: 'kontekst', group: 'Kontekst', q: 'Nad czym Bóg pracuje teraz w moim życiu i jakie cele mi dał?' },
  { id: 'kolor-kontekst', group: 'Kontekst', q: 'Jaki kolor miał główny symbol i co mówi o jego znaczeniu lub celu?' },
  { id: 'wydzwiek', group: 'Kontekst', q: 'Jaki był wydźwięk snu: strach, niepokój, spokój, oczekiwanie? Czy znaczenie symbolu jest dobre czy złe w tym kontekście?' },
  { id: 'osoba-relacja', group: 'Osoby', q: 'Co łączy mnie z tą osobą, co ją wyróżnia i co może dla mnie reprezentować?' },
  { id: 'osoba-uczucia', group: 'Osoby', q: 'Lubię ją, nie lubię czy jestem neutralna? Czy moje uczucia wobec niej są biblijne?' },
  { id: 'osoba-imie', group: 'Osoby', q: 'Czy imię lub stanowisko tej osoby ma znaczenie? Czy to imię jest w Piśmie?' },
  { id: 'twarz', group: 'Osoby', q: 'Postać bez twarzy: czy twarz była ciemna czy jasna, czy postać pomagała czy przeszkadzała?' },
  { id: 'gra-slow', group: 'Szczegóły', q: 'Czy nazwa przedmiotu brzmi jak inne słowo (gra słów)?' },
  { id: 'liczby', group: 'Szczegóły', q: 'Czy w śnie były liczby? Co mówi tabela liczb i czy nie nadaję im większego znaczenia, niż mają?' },
  { id: 'powtarza', group: 'Szczegóły', q: 'Czy ten motyw wraca w innych snach? (Sprawdź zakładkę Symbole.)' },
  { id: 'zrodlo', group: 'Rozeznanie', q: 'Z jakiego źródła może być ten sen: od Boga, z mojej duszy czy z królestwa demonów?' },
  { id: 'czekac', group: 'Co dalej', q: 'Nie każdy sen zinterpretuję od razu. Co robię w czasie aktywnego czekania: modlitwa, Słowo, rozmowa z zaufanym doradcą?' },
]

export const findIn = (list, id) => list.find(x => x.id === id)

// Dodaje pytanie do tekstu interpretacji (bez duplikatów).
export function appendQuestion(current, q) {
  const text = current || ''
  if (text.includes(q)) return text
  const sep = text && !text.endsWith('\n') ? '\n\n' : ''
  return text + sep + q + '\n'
}

// Kategorie snu: nowe pole `kinds` (tablica); starszy zapis `kind` (pojedynczy) też czytamy.
export const dreamKindIds = (d) => d?.kinds?.length ? d.kinds : (d?.kind ? [d.kind] : [])

// Czy sen ma wypełnione jakiekolwiek pola rozszerzone — do rozwinięcia sekcji w formularzu.
export const hasJacksonFields = (d) => !!d && !!(
  d.position || d.sphere || d.origin || d.vividness || d.mainElement || d.numbers || d.application ||
  d.context || d.wakeTime || dreamKindIds(d).length || d.colors?.length || d.beforeSleep?.length ||
  d.atmosphere?.length || d.elements?.length
)
