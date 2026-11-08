// Treści „Nauki o snach" — czysta wiedza, BEZ Firebase i bez Reacta.
// Każda lekcja ma `origin`:
//   'jackson' — metoda z kursu Johna Paula Jacksona (Streams Ministries),
//   'nauka'   — ustalenia badań nad snem / praktyka kliniczna,
//   'biblia'  — podstawa biblijna.
// Dzięki temu w aplikacji zawsze widać, skąd pochodzi dana wskazówka.

export const ORIGINS = {
  jackson: { label: 'Jackson / Streams', color: '#C9A24A' },
  nauka:   { label: 'Badania nad snem',  color: '#5BB6D9' },
  biblia:  { label: 'Biblia',            color: '#9CCB5E' },
}

// ─── Zapamiętywanie snów ────────────────────────────────────────────────────
export const RECALL_TIPS = [
  { id: 'od-razu', origin: 'jackson', title: 'Zapisz od razu',
    text: 'Zapisuj sen od razu, z datą i tytułem.' },
  { id: 'budzik', origin: 'jackson', title: 'Łagodny budzik',
    text: 'Gwałtowny budzik wyrzuca sen z pamięci. Wybierz cichy, narastający dźwięk.' },
  { id: 'ostrozne', origin: 'jackson', title: 'Co według Jacksona osłabia pamięć snów',
    text: 'Alkohol, nierozwiązany gniew i pycha.' },
]

// ─── Metoda: 4 kroki i zasady czytania ──────────────────────────────────────
export const STEPS = [
  { id: 'objawienie', n: 1, title: 'Objawienie', origin: 'jackson',
    text: 'Samo otrzymanie i zapisanie snu: treść, data, tytuł, emocje, kolory, liczby, osoby. Tu jeszcze niczego nie tłumaczysz.' },
  { id: 'interpretacja', n: 2, title: 'Interpretacja', origin: 'jackson',
    text: 'Szukanie głównej myśli snu i znaczenia symboli — w modlitwie, w kontekście Twojego życia i Twojego „słownika". Według kursu interpretacja jest darem, nie techniką.' },
  { id: 'zastosowanie', n: 3, title: 'Zastosowanie', origin: 'jackson',
    text: 'Co mam z tym zrobić? Zmiana postawy, modlitwa, rozmowa, decyzja, a czasem po prostu cierpliwe czekanie.' },
  { id: 'ogloszenie', n: 4, title: 'Ogłoszenie', origin: 'jackson',
    text: 'Czy i komu to przekazać — i kiedy. Przy snach o innych osobach: ostrożnie, z pokorą, bez nacisku i bez narzucania własnej interpretacji.' },
]

export const PRINCIPLES = [
  { id: 'przypowiesc', origin: 'jackson', title: 'Sen jak przypowieść',
    text: 'Ma jedną główną myśl. Rozbieranie każdego szczegółu na części może ją zasłonić. Zapytaj najpierw: o co chodzi w całej historii?' },
  { id: 'jedna-noc', origin: 'jackson', title: 'Kilka snów jednej nocy',
    text: 'Zwykle to różne sceny tego samego tematu (kurs mówi o 80–90%). Czytaj je razem, nie osobno.' },
  { id: 'pozycja', origin: 'jackson', title: 'Obserwator czy uczestnik?',
    text: 'Obserwujesz kogoś innego — sen zwykle nie jest o Tobie. Jesteś w centrum — jest o Tobie. Główny element to ten, bez którego cała historia się rozpada.' },
  { id: 'slownik', origin: 'jackson', title: 'Twój własny słownik',
    text: 'Znaczenie zależy od kultury, rodziny i Twojej historii. Ten sam obraz znaczy co innego dla każdego. Dlatego w aplikacji symbole (#) masz własne i widzisz, w których snach wracają.' },
  { id: 'wlasne-sny', origin: 'jackson', title: 'Własne sny są najtrudniejsze',
    text: 'Emocje zaburzają ocenę, zwłaszcza przy snach o sobie i bliskich. Warto porozmawiać z kimś zaufanym i dojrzałym.' },
]

// ─── Rodzaje snów ───────────────────────────────────────────────────────────
// Trzy źródła według Tertuliana (cytowane przez Jacksona) oraz rodzaje snów
// z jego kursu. Pełna lista ok. 20 rodzajów jest w podręczniku kursu — tu tylko
// te, które mamy potwierdzone w opracowaniu.
export const DREAM_SOURCES = [
  { id: 'demony', title: 'Demoniczne', text: 'Sny inspirowane przez złe duchy — niepokój, zniechęcenie, strach bez owocu.' },
  { id: 'dusza', title: 'Z duszy', text: 'Tworzone przez własne myśli, pragnienia i przeżycia. Według Jacksona dusza nie potrafi sama zinterpretować tego, co duchowe.' },
  { id: 'bog', title: 'Od Boga', text: 'Sny prorocze i objawiające. Według kursu pochodzą spoza śniącego.' },
]

export const DREAM_KINDS = [
  { id: 'uzdrawiajacy', title: 'Uzdrawiający', text: 'Przynosi ulgę, pokój, wewnętrzne uzdrowienie.' },
  { id: 'oczyszczajacy', title: 'Oczyszczający', text: 'Porządkuje emocje; często gwałtowny lub nieprzyjemny, ale po nim jest lżej.' },
  { id: 'powolania', title: 'Powołania', text: 'Mówi o drodze życia, misji, kierunku.' },
  { id: 'ostrzegawczy', title: 'Ostrzegawczy', text: 'Wskazuje na zagrożenie lub błąd, którego można uniknąć.' },
  { id: 'falszywy', title: 'Fałszywy', text: 'Wprowadza w błąd, schlebia albo straszy bez podstaw.' },
  { id: 'cielesny', title: 'Cielesny', text: 'Wynika z potrzeb ciała: pęcherz, zimno, głód, ból.' },
  { id: 'chemiczny', title: 'Chemiczny', text: 'Po lekach, alkoholu, ciężkim jedzeniu. Wynik reakcji organizmu, nie przesłanie.' },
  { id: 'ciemny', title: 'Ciemny', text: 'Czarno-biały lub przytłumiony; według kursu pokazuje plany wroga (patrz uwagi krytyczne).' },
  { id: 'duszy', title: 'Duszy', text: 'Wyraża własne pragnienia i obawy śniącego.' },
]

// ─── Kolory i liczby ────────────────────────────────────────────────────────
// Znaczenia z kursu Jacksona — zawsze dwubiegunowe (dobre / złe).
// Podajemy tylko te, które mamy potwierdzone; reszta jest w podręczniku kursu.
export const DREAM_COLORS = [
  { id: 'czerwony', label: 'Czerwony', color: '#E66A4E', plus: 'namaszczenie, odkupienie', minus: 'gniew, wojna' },
  { id: 'niebieski', label: 'Niebieski', color: '#5B8DEF', plus: 'objawienie', minus: 'depresja, izolacja' },
]

export const NUMBER_RULE =
  'Liczby mają znaczenie, ale nie wolno im nadawać więcej znaczenia, niż mają (Jackson). Unikaj sztuczek w rodzaju sumowania cyfr — sam Jackson przestrzegał przed nadinterpretacją liczb.'

// ─── Pytania pomocnicze do interpretacji ────────────────────────────────────
// Klik w pytanie wstawia je do pola „Interpretacja" w formularzu snu.
export const GUIDE_QUESTIONS = [
  { id: 'glowna-mysl', group: 'Sen jako całość', q: 'Jaka jest główna myśl tej historii w jednym zdaniu?' },
  { id: 'element', group: 'Sen jako całość', q: 'Który element jest centralny — taki, bez którego sen by się rozpadł?' },
  { id: 'pozycja', group: 'Sen jako całość', q: 'Czy byłam obserwatorką, czy uczestniczką? Czyj to sen?' },
  { id: 'inne-sny', group: 'Sen jako całość', q: 'Czy tej nocy lub ostatnio śniły mi się inne sceny na ten sam temat?' },
  { id: 'emocja', group: 'Emocje i szczegóły', q: 'Co czułam w śnie, a co po obudzeniu? Czy te emocje się różniły?' },
  { id: 'kolory', group: 'Emocje i szczegóły', q: 'Jakie kolory były wyraźne? Co dla mnie znaczą (dobrze i źle)?' },
  { id: 'liczby', group: 'Emocje i szczegóły', q: 'Czy pojawiły się liczby? Czy nie nadaję im większego znaczenia, niż mają?' },
  { id: 'slownik', group: 'Mój słownik', q: 'Co dla mnie osobiście znaczy główny symbol (osoba, miejsce, przedmiot)? Co mi się z nim kojarzy?' },
  { id: 'powtarza', group: 'Mój słownik', q: 'Czy ten symbol albo motyw wraca w innych snach? (Sprawdź zakładkę Symbole.)' },
  { id: 'kontekst', group: 'Moje życie', q: 'Co działo się w ostatnich dniach, czym się martwiłam lub cieszyłam?' },
  { id: 'cialo', group: 'Moje życie', q: 'Czy to mógł być sen cielesny lub chemiczny — jedzenie, leki, alkohol, ból, choroba, zmęczenie?' },
  { id: 'zrodlo', group: 'Rozeznanie', q: 'Jaki jest owoc tego snu — pokój i jasność czy lęk i zamęt? Z jakiego źródła może pochodzić?' },
  { id: 'pismo', group: 'Rozeznanie', q: 'Czy wniosek, do którego dochodzę, zgadza się z Pismem Świętym?' },
  { id: 'zastosowanie', group: 'Co dalej', q: 'Co mam z tym zrobić? Modlitwa, rozmowa, decyzja, a może poczekać?' },
  { id: 'ogloszenie', group: 'Co dalej', q: 'Czy i komu to przekazać? Czy to na pewno nie jest sen o mnie samej?' },
]

// ─── Uwagi krytyczne ────────────────────────────────────────────────────────
export const CRITICAL_NOTES = [
  { id: 'niefalsyfikowalny', title: 'System trudno obalić',
    text: 'Kolor oznacza Boga, brak koloru oznacza wroga albo nic, a każdy kolor ma sens dodatni i ujemny. Każdą interpretację da się obronić, więc żadnej nie da się naprawdę sprawdzić.' },
  { id: 'czarno-biale', title: 'Czarno-białe sny',
    text: 'Teza, że czarno-białe sny są demoniczne, nie zgadza się z badaniami: osoby, które wychowały się przy czarno-białej telewizji, częściej zgłaszają czarno-białe sny (m.in. Murzyn 2008), co wskazuje na wpływ kulturowy, nie duchowy. Traktuj brak koloru jako informację o pamięci, nie o źródle snu.' },
  { id: 'liczby', title: 'Sumowanie cyfr',
    text: 'Przykład z numerem boeinga (7+4+7=18 jako „nowe życie") przeczy przestrodze samego Jacksona o nadinterpretacji liczb.' },
  { id: 'autorytet', title: 'Kryterium ostateczne',
    text: 'Ostatecznym sprawdzianem jest „objawienie Ducha Świętego" interpretatora, którego nie da się zweryfikować z zewnątrz. Dlatego przy ważnych decyzjach szukaj potwierdzenia w Piśmie, w radzie dojrzałych osób i w realnych faktach, nie tylko w samym śnie.' },
  { id: 'psychologia', title: 'Psychologia',
    text: 'Jackson odrzucał Freuda i Junga, ale sam korzysta z podobnych pomysłów: osobisty słownik symboli, sen jako uzupełnienie jawy, rozróżnienie obserwator/uczestnik. Zapisywanie, uwaga na emocje i kontekst życia oraz ostrożność wobec sztywnych słowników pasują też do podejścia klinicznego.' },
  { id: 'bezpieczenstwo', title: 'Ostrożność',
    text: 'Sen nie jest diagnozą ani wyrokiem. Nie podejmuj na jego podstawie decyzji medycznych, finansowych ani dotyczących relacji bez rozmowy z kimś zaufanym. Przy powracających koszmarach lub lęku, który utrudnia życie, warto skonsultować się ze specjalistą.' },
]

export const SOURCES = [
  { label: 'Understanding Dreams & Visions — podręcznik nauczyciela (kurs 201)', url: 'https://pdfcoffee.com/udav-teacher-manual-2015-pdf-free.html' },
  { label: 'Streams Ministries — Dreams and Mysteries S2 E10', url: 'https://streamsministries.com/wp-content/uploads/Dreams-and-Mysteries-S2-E10.pdf' },
  { label: 'CBS News — Local Man Interprets Dreams According To The Bible', url: 'https://www.cbsnews.com/texas/news/local-man-interprets-dreams-according-to-the-bible/' },
]

// Wstawia pytanie do tekstu interpretacji: nowa linia, bez duplikatów.
export function appendQuestion(current, q) {
  const text = current || ''
  if (text.includes(q)) return text
  const sep = text && !text.endsWith('\n') ? '\n\n' : ''
  return text + sep + q + '\n'
}
