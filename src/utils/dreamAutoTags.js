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

import { NUMBER_TABLE } from './dreamJackson.js'

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
  ['Zagrożenie', '<zabi|<morder|<zabój|<napastnik|<włamywacz|<porwa|<złodziej|<atak(?! paniki)>', 1, 5, ''],
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
  ['Woda', '<wod(?:a|ą|ę|y|zie)>|<jacuzzi|<ocean|<staw>|<oczko wodne', 1, 4, ''],
  ['Góry', '(?<!z )<gór(?:y|ami|ach|om)>|<wspin', 1, 3, ''],
  ['Las', '<las>|<lesie|<lasu|<drzew|<ogród|<ogródk', 1, 3, ''],
  ['Burza', '<burz|<sztorm|<trzęsieni', 1, 4, ''],
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
  // ── zjawiska, przyroda, krajobraz (kurs: zwracaj uwagę na każdy szczegół, bo każdy może coś znaczyć) ──
  ['Wodospad', '<wodospad', 1, 4, ''],
  ['Morze', '<morz(?:e|a|u|em)>|<morsk|<przypływ', 1, 3, ''],
  ['Rzeka', '<rzek(?:a|i|ę|ą|ach|ę)>|<potok|<strumyk', 1, 3, ''],
  ['Jezioro', '<jezior|<staw(?:u|em)>', 1, 3, ''],
  ['Basen', '<basen|<pływal', 1, 3, ''],
  ['Powódź', '<powódź|<powodzi|<zalan|<zalewa|<zalało', 1, 4, ''],
  ['Deszcz', '<deszcz|<pada>|<padał|<ulew|<kropi|<mokr', 1, 3, ''],
  ['Huragan', '<huragan|<wichur|<orkan|<nawałnic|<cyklon', 1, 4, ''],
  ['Tornado', '<lej>|<leja>|<lejem|<leju|<tornad|<trąb(?:a|ę|y|ą) powietrzn|<trąby powietrzn|<wir>|<wiry>|<wirem', 1, 5, ''],
  ['Kataklizm', '<kataklizm|<katastrof|<apokalips|<koniec świata|<końca świata|<armagedon|<żywioł|<żywioły', 1, 5, ''],
  ['Wybuch', '<wybuch|<eksplozj|<huk>|<huku|<huknię|<fala uderzeniow|<bomb|<granat|<detonac', 1, 5, ''],
  ['Fala', '<fal(?:a|e|ę|ą|i|ami)>|<tsunami', 1, 4, ''],
  ['Wiatr', '<wiatr|<wiał|<powiew', 1, 3, ''],
  ['Grad', '<grad>|<gradu|<gradem', 1, 3, ''],
  ['Mgła', '<mgł|<zamglon', 1, 3, ''],
  ['Chmury', '<chmur', 1, 3, ''],
  ['Tęcza', '<tęcz', 1, 4, ''],
  ['Błyskawica', '<błyskawic|<piorun|<grzmot|<zagrzmi', 1, 4, ''],
  ['Trzęsienie ziemi', '<trzęsieni|<wstrząs|<ziemia się trzęsł|<ziemia się zatrzęsł', 1, 5, ''],
  ['Lawina', '<lawin|<osuwisk|<tsunami', 1, 4, ''],
  ['Wulkan', '<wulkan|<lawa>|<lawy>', 1, 4, ''],
  ['Meteoryt', '<meteor|<kometa|<komety|<spadając[ae] gwiazd|<asteroid', 1, 4, ''],
  ['Niebo', '<nieb(?:o|a|ie|em)>|<niebiesk(?:ie|im) nieb', 1, 3, ''],
  ['Słońce', '<słońc|<słonecz|<wschód słońca|<zachód słońca|<zaćmieni', 1, 3, ''],
  ['Księżyc', '<księżyc|<księżyca|<księżycu', 1, 3, ''],
  ['Gwiazdy', '<gwiazd(?:a|y|ę|ami|ach)>|<gwiazdk|<galaktyk|<kosmos', 1, 3, ''],
  ['Planeta', '<planet(?:a|y|ę|ami)>|<statek kosmiczn|<ufo>|<obc(?:y|ych) planet', 1, 3, ''],
  ['Pustynia', '<pustyn', 1, 3, ''],
  ['Plaża', '<plaż|<piasek|<piasku|<piasku|<wydm', 1, 3, ''],
  ['Wyspa', '<wysp(?:a|y|ę|ie|ą)>|<półwysep', 1, 3, ''],
  ['Pole i łąka', '<pole>|<pola>|<polu>|<łąk|<polan|<zboże|<zbóż|<pszenic|<kukurydz', 1, 3, ''],
  ['Drzewo', '<drzew(?:o|a|em|ie|u|ami|ach)>|<drzewk|<dąb>|<dębu|<palm|<choink|<sosn|<wierzb|<brzoz|<topol', 1, 4, ''],
  ['Kwiaty', '<kwiat|<róża|<róży|<róże|<tulipan|<lilia|<słonecznik|<bukiet|<wieniec', 1, 3, ''],
  ['Trawa', '<traw(?:a|y|ę|ie|ą)>|<mech>|<krzak|<zaroś|<chwast', 1, 2, ''],
  ['Kamień', '<kami(?:eń|enia|eniu|eniem|enie|eni)>|<kamyk|<głaz|<bruk|<żwir', 1, 3, ''],
  ['Skała', '<skał(?:a|y|ę|ą|ach)>|<urwisk|<klif|<szczyt|<przepaść|<przepaśc', 1, 4, ''],
  ['Lód', '<lód>|<lodu>|<lodem|<lodow|<zamarz|<lodowc|<sopel', 1, 3, ''],
  ['Mróz i zimno', '<zimn|<mróz|<mrozu|<chłód|<chłodn|<marzłam|<marzł|<zmarzł|<lodowat|<dreszcz', 1, 3, ''],
  ['Gorąco', '<gorąc|<upał|<żar>|<żaru|<skwar|<poci(?:łam|ć)', 1, 3, ''],
  ['Cisza', '<cisza|<ciszy|<ciszę|<cichy|<cicho>|<w ciszy', 1, 3, ''],
  ['Hałas i krzyk', '<hałas|<krzyk|<krzycz|<krzyczał|<wrzask|<wrzesz', 1, 3, ''],
  ['Piękno', '<piękn|<cudown|<zachwyc|<cud>|<cudu>|<niesamowic', 1, 3, ''],
  ['Brzydota i brud', '<brzydk|<brud|<obrzydl|<śmierdz|<smród|<śmieci|<wstrętn|<zgnił|<gnijąc', 1, 3, ''],
  ['Wielkość', '<ogrom|<gigant|<olbrzym|<wielki(?:e|ego|ej|ą)?>|<ogromn|<kolosaln', 1, 3, ''],
  ['Mały rozmiar', '<malutk|<maleńk|<miniatur|<kieszonkow|<zmniejsz', 1, 3, ''],
  ['Wysokość', '<wysok|<wieża>|<wieży>|<wieżę>|<wieżą>|<z góry>|<dach(?:u|em|y)?>', 1, 3, ''],
  ['Głębia', '<głęb|<otchłań|<dno>|<studni|<studzien', 1, 3, ''],
  ['Pustka', '<pust(?:y|a|e|ka|ki|ce|ym|ą|ej)>|<pustk|<opuszczon|<wymarł', 1, 3, ''],
  ['Ruina i zniszczenie', '<ruin|<zniszczon|<zrujnow|<zawali|<runął|<runęł|<runęła|<rozpad|<zburz|<spalon|<połamany|<zepsut|<pęknięt|<rozbit', 1, 4, ''],
  ['Błoto', '<błot|<bagn|<grzęzł|<utkn', 1, 3, ''],
  ['Dym i popiół', '<dym>|<dymu>|<dymem|<popiół|<popiołu|<zadymion|<kurz>|<kurzu', 1, 3, ''],
  ['Ciężar', '<ciężk|<ciężar|<przygniot|<uciążl', 1, 3, ''],
  ['Blask i jasność', '<jasn|<blask|<błysk|<świeci|<lśni|<jaśni|<olśni', 1, 3, ''],
  ['Cień', '<cień>|<cienia>|<cieniu>|<cienie>|<sylwetk', 1, 3, ''],
  // ── rzeczy i budowle (kurs: rzeczy bywają znakami; zwykłe drobiazgi pomijamy, a te bywają symbolami) ──
  ['Okno', '<okn(?:o|a|em|ie|u)>', 1, 3, ''],
  ['Brama i płot', '<brama>|<bramy>|<bramę|<bramą|<furtk|<płot|<ogrodzeni|<szlaban|<krat(?:a|y|ę|ami)>', 1, 3, ''],
  ['Droga', '<drog(?:a|ą|ę|i|ze)>|<ulic|<ścieżk|<szlak|<autostrad|<skrzyżowani|<rondo|<chodnik', 1, 3, ''],
  ['Ściana i mur', '<ścian|<mur(?:u|em|y)?>|<mury>|<barier', 1, 3, ''],
  ['Stół', '<stół|<stołu|<stole|<stołem|<ławk|<biurk', 1, 2, ''],
  ['Lustro', '<lustr|<odbici', 1, 4, ''],
  ['Zegar', '<zegar|<zegarek|<budzik|<minuty>', 1, 3, ''],
  ['Książka', '<książk|<biblia|<biblii|<biblię|<notatnik|<gazet', 1, 3, ''],
  ['Krzyż', '<krzyż', 1, 4, ''],
  ['Korona', '<koron|<tron>|<tronu|<berło|<królow|<król>|<króla|<książę|<książęc|<księżnicz', 1, 4, ''],
  ['Pierścień', '<pierścion|<obrączk|<biżuter|<naszyjnik|<bransolet|<kolczyk|<łańcuszek|<złoto|<złota>|<złotą>|<diament', 1, 3, ''],
  ['Lina i łańcuch', '<lin(?:a|y|ę|ą|ach)>|<łańcuch|<sznur|<kajdan|<więzieni|<cela>|<celi>|<łańcuchy', 1, 3, ''],
  ['Prezent', '<prezent|<paczk|<pudełk|<skrzyn|<szkatuł|<kufer', 1, 3, ''],
  ['Lampa i świeca', '<lamp|<świec(?:a|e|ę|ach|ami)>|<pochodni|<latarni', 1, 3, ''],
  ['Muzyka', '<muzyk|<piosenk|<śpiew|<śpiewa|<gitar|<pianin|<skrzypc|<organ(?:y|ach)>|<trąb|<dzwon|<bębn', 1, 3, ''],
  ['Taniec', '<tańcz|<taniec|<tańca|<tańc', 1, 3, ''],
  ['Flaga', '<flag(?:a|i|ę|ą)>|<sztandar|<proporc', 1, 3, ''],
  ['Mapa', '<map(?:a|y|ę|ie|ą)>|<kompas|<nawigacj', 1, 3, ''],
  ['Namiot', '<namiot|<obóz>|<obozie|<ognisk', 1, 3, ''],
  ['Statek i łódź', '<statek|<statku|<łódź|<łodzi|<łódk|<kajak|<jacht|<prom>|<promie|<okręt|<żagl', 1, 3, POJAZD],
  ['Autobus i tramwaj', '<autobus|<tramwaj|<metro>|<tir>|<ciężarów|<wagon|<peron|<dworc', 1, 3, POJAZD],
  ['Hulajnoga i skuter', '<hulajnog|<skuter|<quad|<deskorolk|<wózek>|<wózka', 1, 2, POJAZD],
  ['Narzędzia', '<młot|<siekier|<piła>|<piłą|<śrubokręt|<łopat|<kilof|<drabin|<gwóźdź|<gwoździ|<haczyk', 1, 3, ''],
  ['Miecz i tarcza', '<miecz|<tarcz(?:a|y|ę|ą)>|<łuk>|<łuku>|<strzał(?:a|y|ę|ami)>|<włócz', 1, 4, ''],
  ['Sieć', '<siec(?:i|ią)>|<sieć>|<pajęczyn|<pułap(?:ka|ki|ce)>|<sidł', 1, 3, ''],
  ['Wino i chleb', '<wino>|<winem>|<wina>|<winogron|<chleb|<bochen|<kielich|<komuni|<kielicha', 1, 4, ''],
  ['Owoce', '<jabłk|<owoc|<gruszk|<truskaw|<winogr|<banan|<pomarańcz|<cytryn|<śliwk|<wiśni', 1, 3, ''],
  ['Miód i mleko', '<miód|<miodu|<mleko|<mleka|<mlecz', 1, 3, ''],
  ['Mięso', '<mięs|<kotlet|<kiełbas|<szynk', 1, 2, ''],
  // ── przemoc i zagrożenie (kurs: kim jest napastnik, co robi, jaką postawę przyjmuje śniąca) ──
  ['Zabójstwo', '<zabi(?:ł|ła|li|ły|ć|ty|ci|ta|te|cie|ja|jać|ją|ć)>|<zamord|<zastrzel|<zadźg|<chciał mnie zabić|<chce mnie zabić|<chcieli mnie zabić|<zabójc', 1, 5, ''],
  ['Dźgnięcie', '<dźgn|<dźga|<zadźg|<pchnął nożem|<wbił nóż|<wbiła nóż|<ugodzi|<kłuj|<pchnięt', 1, 5, ''],
  ['Zaatakowanie', '<zaatak|<atak(?!(?:i|ów)? paniki)(?:u|i|ować|ował|owała|owali|owały|ują)?>|<atakow|<atakuj|<atakował|<napad(?:ł|ła|li|ły|ać|u)>|<napadn|<rzucił się na mnie|<rzucił się na|<rzuciła się na|<rzucali się na|<rzucił się z', 1, 5, ''],
  ['Przytrzymanie', '<przytrzym|<złapał mnie|<złapała mnie|<złapali mnie|<chwycił mnie|<chwycili mnie|<trzymał mnie|<trzymali mnie|<unieruchom|<związał|<związan|<nie mogłam się ruszyć|<przycisn|<przygwoździ|<przytrzym', 1, 5, ''],
  ['Duszenie', '<dusi|<udusi|<dusił|<dusiła|<dławi|<podduszon|<zadusi|<nie mogłam oddychać|<zakneblow|<zakryć usta|<zatkał mi usta', 1, 5, ''],
  ['Bicie i uderzenie', '<bił>|<bili>|<biła>|<bije>|<pobi|<uderzył|<uderzyła|<uderzyli|<uderzyły|<uderzać|<uderzał|<kopn|<kopał|<kopali|<policzek|<spoliczkow|<pięści|<pięścią|<ciosy>|<cios>|<ciosem|<walnął|<walnęła|<sprał', 1, 5, ''],
  ['Gwałt i molestowanie', '<gwałc|<gwałt|<molest|<obmacy|<napastow|<zgwałc|<dobierał się|<dotykał mnie|<próba gwałtu|<rozbier(?:ał|ać) mnie', 1, 5, ''],
  ['Tortury', '<tortur|<katow|<męcz|<przesłuch|<torturow', 1, 5, ''],
  ['Porwanie', '<porwa|<porwan|<uprowad|<wciągn(?:ął|ęli|ęła) mnie do (?:auta|samochodu)|<w bagażniku', 1, 5, ''],
  ['Pościg i łapanka', '<ścigał|<goni(?:ł|ła|li|ć)>|<gonił mnie|<gonili mnie|<łapali mnie|<szukał mnie|<szukali mnie|<polowa(?:ł|li|nie)', 1, 4, ''],
  ['Krzywda', '<skrzywdz|<krzywd|<zranił|<zraniła|<zranion|<poturbow|<okaleczy|<pocięt|<ciął|<pociął|<cięła|<poparzy', 1, 4, ''],
  // ── więcej zwierząt (kurs: lista zwierząt) — osobno, żeby symbol nazywał to, co naprawdę się śniło ──
  ['Ryba', '<ryb(?:a|y|ę|ą|ki|ek|om|ami|ach)>|<rybk', 1, 4, ''],
  ['Delfin', '<delfin', 1, 4, ''], ['Rekin', '<rekin', 1, 4, ''], ['Wieloryb', '<wieloryb', 1, 4, ''],
  ['Wilk', '<wilk', 1, 4, ''], ['Lis', '<lis>|<lisa>|<lisem|<lisy>', 1, 4, ''],
  ['Niedźwiedź', '<niedźwie|<miś>|<misia|<misiem', 1, 4, ''],
  ['Słoń', '<słoń>|<słonia|<słoni>|<słonie>', 1, 4, ''], ['Żyrafa', '<żyraf', 1, 4, ''],
  ['Małpa', '<małp|<goryl|<szympans', 1, 4, ''], ['Zebra', '<zebr', 1, 4, ''],
  ['Krowa', '<krow(?:a|y|ę|ą)>|<byk>|<byka>|<byki>', 1, 3, ''], ['Świnia', '<świni|<prosiak|<wieprz', 1, 3, ''],
  ['Owca', '<owc(?:a|e|y|ą)>|<baran|<jagni|<baranek', 1, 4, ''], ['Koza', '<kozł|<kozy>|<koza>|<kozę|<kozą', 1, 3, ''],
  ['Kura', '<kur(?:a|y|ę|ą|ach|czak)>|<kurczak|<kurnik', 1, 3, ''], ['Kogut', '<kogut|<kogucie', 1, 4, ''],
  ['Gołąb', '<gołąb|<gołęb', 1, 5, ''], ['Sowa', '<sowa>|<sowy>|<sową|<sowę', 1, 4, ''],
  ['Kruk', '<wron|<kruk|<kruki', 1, 4, ''], ['Mewa', '<mewa>|<mewy>|<mewę|<mew>', 1, 3, ''],
  ['Orzeł', '<sokół|<sokoł|<jastrz|<orł|<orze[łl]>', 1, 4, ''], ['Jaskółka', '<jaskółk', 1, 3, ''],
  ['Motyl', '<motyl', 1, 4, ''], ['Pszczoła', '<pszczoł|<osa>|<osy>|<osę|<szerszeń', 1, 4, ''],
  ['Mucha', '<mucha>|<muchy>|<muchę|<komar|<pluskw', 1, 3, ''], ['Mrówki', '<mrówk', 1, 3, ''],
  ['Robaki', '<robak|<robaki|<karaluch|<szarańcz|<gąsienic|<larw', 1, 3, ''],
  ['Szczur', '<szczur', 1, 4, ''], ['Królik', '<królik|<zając|<zająca', 1, 4, ''], ['Chomik', '<chomik|<wiewiór', 1, 3, ''],
  ['Tygrys', '<tygrys', 1, 4, ''], ['Pantera', '<pantera|<pantery|<lampart|<gepard|<puma>|<jaguar', 1, 4, ''],
  ['Krokodyl', '<krokodyl|<aligator', 1, 4, ''], ['Żółw', '<żółw', 1, 4, ''], ['Jaszczurka', '<jaszczur|<kameleon|<gekon', 1, 4, ''],
  ['Jeleń', '<jeleń|<jelenia|<sarn|<łoś>|<łosia', 1, 4, ''], ['Dzik', '<dzik', 1, 4, ''],
  ['Smok', '<smok|<smoka|<smoki', 1, 5, ''], ['Dinozaur', '<dinozaur', 1, 4, ''], ['Jednorożec', '<jednoroż|<feniks', 1, 4, ''],
  // ── ciało (kurs: części ciała i ich stan) ──
  ['Oczy', '<oczy>|<oczu>|<oczami|<oko>|<oka>|<ślep|<niewidom|<okular', 1, 3, ''],
  ['Serce', '<serc(?:e|a|u|em)>|<serduszk|<bicie serca|<puls', 1, 3, ''],
  ['Głos', '<głos(?:u|em|ie)?>|<szept|<szeptał|<krzyknął', 1, 2, ''],
  ['Rana i blizna', '<ran(?:a|y|ę|ą)>|<ranny|<ranna|<blizn|<siniak|<opuchn|<zadrap|<kulał|<kuśtyk|<bandaż|<gips', 1, 3, ''],
  ['Łzy', '<łez|<łzy>|<łzami|<płacz', 1, 3, ''],
  ['Twarz i maska', '<maska|<maski>|<maskę|<maską|<twarz>|<twarzy>|<bez twarzy|<przebran', 1, 3, ''],
  ['Białe ubranie', '<biał(?:ą|a|e|y) (?:sukni|koszul|szat|bluz|ubra|sukienk)|<szat(?:a|y|ę|ami)>|<welon', 1, 4, ''],
  ['Sukienka', '<sukienk|<spódnic|<garnitur|<koszul|<kurtk|<czapk|<kapelusz|<okular', 1, 2, ''],
  ['Buty', '<buty>|<butów|<butach|<butami|<but>|<klapk|<szpilk|<boso>|<bosa>|<bosy>|<bosą|<obuwi', 1, 3, ''],
  // ── stany i zdarzenia, które pomaga zauważyć ──
  ['Zamknięcie', '<zamknięt|<zamknął|<zamknęł|<zaryglow|<uwięzion|<więzień|<klatce>|<klatkę|<w klatce|<pułapk', 1, 4, ''],
  ['Latanie', '<latał|<latam|<latać|<unosi|<lewitow|<fruw|<szybowa|<unosiłam|<poleciał|<poleciałam', 1, 4, ''],
  ['Spadanie', '<spadał|<spadam|<spadać|<spada>|<spadało|<lecieć w dół|<runęł|<upadł|<przewróc|<zjechał|<wpadł', 1, 4, ''],
  ['Tonięcie', '<ton(?:ęła|ęłam|ął|ie|ąć|ęli)>|<topi|<utop|<zatop|<zanurz|<nurk|<tonął', 1, 4, ''],
  ['Pływanie', '<pływ|<płynęł|<płynie>|<przepłyn', 1, 3, ''],
  ['Wspinaczka', '<wspin|<wchodz(?:iłam|ić|imy) na|<wdrapa|<schodz(?:iłam|ić) z', 1, 3, ''],
  ['Chodzenie bez celu', '<błąka|<zgubiłam się|<nie wiedziałam gdzie|<labirynt|<kluczy|<w kółko', 1, 4, ''],
  ['Pogoń za czasem', '<pośpiech|<śpieszy|<śpieszyć|<musiałam szybko|<prędko|<w biegu|<biegn|<biegła|<biegałam|<biegał', 1, 3, ''],
  ['Tłum', '<tłum|<tłumie|<tłumu|<zgromadzen|<publicz|<widown|<wszyscy patrz|<ludzi zbiegają|<ludzie zbiegają|<setki ludzi|<tysiące ludzi', 1, 3, ''],
  ['Wesele i impreza', '<impreza|<imprez|<przyjęci|<urodzin|<bal>|<balu>|<zabaw(?:a|y|ę|ie)>|<uroczysto|<świętowa|<bankiet|<koncert', 1, 3, ''],
  ['Więzienie i sąd', '<więzieni|<sąd>|<sądzie|<sądu|<wyrok|<kar(?:a|y|ę)>|<skazan|<areszt|<proces>|<sędzi', 1, 4, ''],
  ['Szpital', '<szpital|<lekarz|<lekarsk|<pielęgniar|<operacj|<karetk|<pogotowi|<apteka|<tablet(?:k|ki)>', 1, 4, ''],
  ['Praca', '<praca>|<pracy>|<pracę|<pracowa|<szef|<biuro|<biurze|<firm(?:a|y|ie|ę)>|<zmian(?:a|y|ę)> w pracy', 1, 3, ''],
].map(([name, p, min, weight, hint]) => ({ name, re: rx(p), min, weight, hint }))

export const AUTO_SYMBOL_NAMES = DEFS.map(d => d.name)
export const autoSymbolHint = (name) => {
  const num = /^Liczba (\d+)$/.exec(name)
  if (num) return NUMBER_TABLE.find(e => e.n === Number(num[1]))?.meaning || ''
  return DEFS.find(d => d.name === name)?.hint || ''
}

const count = (re, text) => (text.match(re) || []).length

// Do ilu symboli maksymalnie na sen — kurs: sen ma jedną główną myśl, nie samą listę rzeczy.
const MAX_SYMBOLS = 14

// Liczby (kurs: liczby w snach mają znaczenie) — każda wspomniana liczba to osobny symbol „Liczba N".
// Pomijamy godziny, kwoty, lata, jednostki i numery długie.
const NUM_WORDS = [
  [2, 'dwa|dwie|dwóch|dwoje|dwojga|dwójk'], [3, 'trzy|trzech|troje|trojga|trójk'], [4, 'cztery|czterech|czworo'],
  [5, 'pięć|pięciu|pięcioro'], [6, 'sześć|sześciu'], [7, 'siedem|siedmiu'], [8, 'osiem|ośmiu'],
  [9, 'dziewięć|dziewięciu'], [10, 'dziesięć|dziesięciu'], [11, 'jedenaście|jedenastu'], [12, 'dwanaście|dwunastu'],
  [13, 'trzynaście|trzynastu'], [20, 'dwadzieścia|dwudziestu'], [40, 'czterdzieści|czterdziestu'], [100, 'sto>|stu>'],
].map(([n, p]) => [n, rx('<(?:' + p.replace(/>$/, '') + ')' + (p.endsWith('>') ? '>' : ''))])
export function numbersInText(text) {
  const freq = new Map()
  const add = (n) => freq.set(n, (freq.get(n) || 0) + 1)
  for (const m of text.matchAll(/(?<![\d:.,/-])(\d{1,4})(?![\d:.,/-]| ?zł| ?tys| ?km| ?min| ?metr| ?proc| ?%| ?godz| ?lat| ?r\.)/g)) {
    const n = Number(m[1])
    if (n > 0 && !(n >= 1900 && n <= 2100)) add(n)
  }
  for (const [n, re] of NUM_WORDS) { const c = count(re, text); for (let i = 0; i < c; i++) add(n) }
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([n]) => n)
}
const MAX_LICZBY = 5

// Słowa z tekstu, które dały dany symbol automatyczny (np. Rywalizacja ← „wygrać", Lider ← „liderem").
// Służy do podkreślania symboli w treści snu. `names` — nazwy symboli przypiętych do snu.
// Zwraca { 'nazwa małymi': ['formy małymi', …] }; symbole spoza listy automatycznych są pomijane.
const wholeWord = (text, m) => {
  const tail = (text.slice(m.index + m[0].length).match(/^[\p{L}\p{N}]*/u) || [''])[0]
  return (m[0] + tail).toLowerCase()
}
export function autoSymbolWords(text, names = []) {
  const out = {}
  if (!text) return out
  for (const name of names) {
    const low = String(name).toLowerCase()
    const forms = new Set()
    const num = /^liczba (\d+)$/.exec(low)
    if (num) {
      const n = Number(num[1])
      for (const m of text.matchAll(/(?<![\p{L}\p{N}:.,/-])\d{1,4}(?![\p{L}\p{N}:.,/-])/gu)) if (Number(m[0]) === n) forms.add(m[0])
      const w = NUM_WORDS.find(([k]) => k === n)
      if (w) for (const m of text.matchAll(w[1])) forms.add(wholeWord(text, m))
    } else {
      const d = DEFS.find(x => x.name.toLowerCase() === low)
      if (d) for (const m of text.matchAll(d.re)) forms.add(wholeWord(text, m))
    }
    if (forms.size) out[low] = [...forms]
  }
  return out
}

export function autoSymbols(text, title = '') {
  const found = []
  for (const d of DEFS) {
    const n = count(d.re, text)
    const inTitle = count(d.re, title) > 0
    if (n >= d.min || inTitle) found.push({ name: d.name, score: (inTitle ? 100 : 0) + n * 3 + d.weight })
  }
  const names = found.sort((a, b) => b.score - a.score).slice(0, MAX_SYMBOLS).map(f => f.name)
  return [...names, ...numbersInText(title + ' ' + text).slice(0, MAX_LICZBY).map(n => `Liczba ${n}`)]
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
const NEG = rx('<dźgn|<dusi|<udusi|<przytrzym|<zaatak|<napad(?:ł|ła|li)>|<zgwałc|<tortur|<pobi|<zabił|<zabiła|<kopn|<uderzy|<unieruchom|<zastrzel|przerażon|<panik|napastnik|<atakow|<atak>|<zabi|<morder|<zabój|<zastrzel|<włamywacz|<porwa|<strach|<bałam|<molest|<obmacyw|<gwałc|<ucieka|<goni|<zranił|<raniłam')
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
  return numbersInText(text).filter(n => TABLE_NUMBERS.has(n)).sort((a, b) => a - b).join(', ')
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
    const t = autoTags({ title: d.title, text: d.text })
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
