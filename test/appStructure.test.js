import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Testy spójności aplikacji jako całości: czy nowy moduł jest podpięty wszędzie
// tam, gdzie trzeba, czy nazwa się zgadza i czy usunięte rzeczy naprawdę znikły.
// Wcześniej dodanie modułu wymagało pamiętania o pięciu miejscach naraz.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

// Wszystkie pliki źródłowe — do testów pilnujących, że czegoś NIE MA nigdzie
// w kodzie (np. drugiej kopii wspólnego komponentu).
function zrodlaSrc(katalog = join(ROOT, 'src')) {
  const wynik = []
  for (const nazwa of readdirSync(katalog)) {
    const p = join(katalog, nazwa)
    if (statSync(p).isDirectory()) wynik.push(...zrodlaSrc(p))
    else if (/\.jsx?$/.test(nazwa)) wynik.push(p)
  }
  return wynik
}

// Skleja wszystkie pliki modułu w jeden tekst. Testy strukturalne mają pilnować
// tego, CZY coś w module jest — nie tego, w którym dokładnie pliku, bo inaczej
// każdy podział dużego komponentu wywala je bez żadnej realnej regresji.
const readModule = (katalog) => readdirSync(join(ROOT, katalog))
  .filter(f => f.endsWith('.jsx') || f.endsWith('.js'))
  .map(f => read(join(katalog, f)))
  .join('\n')

const APP    = read('src/App.jsx')
const PULPIT = read('src/components/Pulpit.jsx')
const HTML   = read('index.html')
const VITE   = read('vite.config.js')

// Id modułów z buildModules() w App.jsx
const moduleIds = [...APP.matchAll(/\{\s*id:\s*'([a-z]+)'\s*,\s*label:/g)].map(m => m[1])

test('App: buildModules zwiera komplet modułów, w tym nowe', () => {
  for (const id of ['home', 'budget', 'habits', 'calendar', 'gratitude']) {
    assert.ok(moduleIds.includes(id), `brak modułu ${id} w buildModules`)
  }
  assert.equal(new Set(moduleIds).size, moduleIds.length, 'zdublowane id modułu')
})

test('App: każdy moduł ma kolor akcentu', () => {
  const accents = read('src/utils/moduleColors.js').match(/export const MODULE_ACCENTS = \{[\s\S]*?\n\}/)?.[0] || ''
  for (const id of moduleIds) {
    assert.match(accents, new RegExp(`${id}\\s*:`), `moduł ${id} nie ma koloru w MODULE_ACCENTS`)
  }
})

test('App: każdy moduł poza Pulpitem ma leniwy import i jest renderowany', () => {
  for (const id of moduleIds) {
    if (id === 'home') continue
    assert.match(APP, new RegExp(`activeModule === '${id}'`), `moduł ${id} nie jest renderowany`)
  }
  // Nowe moduły dokładamy jako osobne chunki — inaczej rosłoby wejście na telefonie.
  assert.match(APP, /lazy\(\(\) => import\('\.\/components\/gratitude\/GratitudeDashboard'\)\)/)
})

test('App: kolejność i ukrywanie modułów idzie przez moduleLayout', () => {
  assert.match(APP, /from '\.\/utils\/moduleLayout'/)
  assert.match(APP, /navModules\(modules\)/)
  // Stała lista modułów na pasku zniknęła — decyduje układ użytkownika.
  assert.ok(!APP.includes('PRIMARY_NAV'), 'PRIMARY_NAV powinno zniknąć na rzecz układu użytkownika')
})

test('App: ukrycie aktywnego modułu cofa na Pulpit', () => {
  // Bez tego użytkownik zostaje w widoku, do którego nie ma już jak wrócić.
  assert.match(APP, /m\.hidden\)\) setActiveModule\('home'\)/)
})

test('Pulpit: pokazuje tylko moduły zostawione przez użytkownika', () => {
  assert.match(PULPIT, /visibleIds/)
  const cards = (PULPIT.match(/<PulpitCard/g) || []).length
  const guards = (PULPIT.match(/\{shows\('/g) || []).length
  assert.equal(guards, cards, 'każda karta Pulpitu musi być pod warunkiem shows()')
  assert.ok(cards >= 6, `spodziewano się co najmniej 6 kart, jest ${cards}`)
})

test('Pulpit: agenda pomija pozycje z ukrytych modułów', () => {
  assert.match(PULPIT, /items\.filter\(it => shows\(it\.module\)\)/)
})

test('Nazwa aplikacji to Apka 2.0 — wszędzie', () => {
  assert.match(HTML, /<title>Apka 2\.0<\/title>/)
  assert.match(HTML, /content="Apka 2\.0"/)
  assert.match(VITE, /name: 'Apka 2\.0'/)
  assert.match(VITE, /short_name: 'Apka 2\.0'/)
  const stale = walk(join(ROOT, 'src'))
    .filter(f => read(f.replace(ROOT + '/', '')).includes('Mój Świat'))
  assert.deepEqual(stale, [], 'gdzieś została stara nazwa')
})

test('Wdzięcznik nie ma czarnej belki .mod-header', () => {
  // .mod-header ma nieprzezroczyste tło i psuł szklany nagłówek w tym module.
  const f = 'src/components/gratitude/GratitudeDashboard.jsx'
  assert.ok(!read(f).includes('mod-header'), `${f} nadal używa .mod-header`)
})

test('Dziesięcina: nie ma już osobnej ofiary', () => {
  const cats  = read('src/utils/categories.js')
  const tithe = read('src/components/budget/TitheView.jsx')
  assert.ok(!cats.includes("id: 'ofiara'"), 'kategoria „ofiara" nadal na liście wyboru')
  assert.ok(!/ofiara/i.test(tithe), 'widok dziesięciny nadal wspomina ofiarę')
})

test('Dziesięcina: procent od użytkownika, podstawa z zaznaczonych przychodów', () => {
  const tithe = read('src/components/budget/TitheView.jsx')
  const form  = read('src/components/TransactionForm.jsx')
  assert.ok(!tithe.includes('* 0.10'), 'procent nie może być zaszyty na sztywno')
  assert.match(tithe, /settings\.percent/)
  // Zaznaczenie przy przychodzie + rozliczanie puli po wpłacie
  assert.match(form, /tithe: type === 'income' \? tithe : false/)
  assert.match(tithe, /titheSettledAt/)
})

test('Kalendarz: klik w dzień pokazuje, co się dzieje', () => {
  const cal = readModule('src/components/calendar')
  assert.match(cal, /<DayDetail/)
  assert.match(cal, /function DayDetail\(/)
  // Pusty dzień podpowiada najbliższe wydarzenia zamiast pokazywać nic.
  assert.match(cal, /upcomingEvents\(/)
})

test('Nawyki: dzień zrobiony mimo wyjazdu ma własne oznaczenie', () => {
  const logic = read('src/utils/habitLogic.js')
  assert.match(logic, /'done-paused'/)
  for (const f of ['src/components/habits/HabitDayGrid.jsx',
                   'src/components/habits/HabitsDashboard.jsx']) {
    assert.match(read(f), /done-paused/, `${f} nie wyróżnia dnia z przerwy`)
  }
})

test('Nastrój jest osobną aplikacją — nie siedzi już w Nawykach', () => {
  assert.ok(moduleIds.includes('mood'), 'brak modułu Nastrój w buildModules')
  assert.match(APP, /lazy\(\(\) => import\('\.\/components\/mood\/MoodDashboard'\)\)/)
  const habits = read('src/components/habits/HabitsDashboard.jsx')
  assert.ok(!/MoodDashboard/.test(habits), 'Nawyki nadal ładują Nastrój')
  assert.ok(!/hdr-mood/.test(habits), 'w belce Nawyków nadal jest twarz nastroju')
  assert.ok(!/moodLogs/.test(habits), 'Nawyki nadal czytają wpisy nastroju')
})

test('Nowe kolekcje wchodzą do kopii danych', () => {
  const exp = read('src/utils/dataExport.js')
  for (const col of ['gratitude', 'memories']) {
    assert.match(exp, new RegExp(`'${col}'`), `kolekcja ${col} nie jest eksportowana`)
  }
})

test('Wdzięczność bez serii i rekordów — to nie wyścig', () => {
  const logic  = read('src/utils/gratitudeLogic.js')
  const grat   = read('src/components/gratitude/GratitudeDashboard.jsx')
  assert.ok(!/streak/i.test(logic), 'logika wdzięczności nadal liczy serie')
  assert.ok(!/Seria|Rekord/.test(grat), 'Wdzięcznik nadal pokazuje serię lub rekord')
  assert.ok(!/gratStat\.streak/.test(PULPIT), 'Pulpit nadal pokazuje serię wdzięczności')
})

test('Wdzięcznik: przypominajka i przeglądanie wpisów', () => {
  const f = 'src/components/gratitude/GratitudeDashboard.jsx'
  const src = read(f)
  assert.match(src, /pickBySeed/, `${f}: brak losowej przypominajki`)
  assert.match(src, /recall-card/, `${f}: brak karty przypominajki`)
  assert.match(src, /neighbors\(/, `${f}: brak skakania między wpisami`)
  assert.match(src, /reader-nav/, `${f}: brak strzałek w podglądzie`)
})

test('Wspomnik zniknął z aplikacji — bez sierot po module', () => {
  // Moduł usunięty na życzenie. Kolekcja 'memories' zostaje w kopii danych
  // (dataExport), żeby stare wpisy nie wyparowały z backupu.
  assert.ok(!existsSync(join(ROOT, 'src/components/memories')), 'katalog modułu nadal istnieje')
  assert.ok(!existsSync(join(ROOT, 'src/utils/memoryLogic.js')), 'logika Wspomnika nadal istnieje')
  for (const [name, src] of [['App.jsx', APP], ['Pulpit.jsx', PULPIT]]) {
    assert.ok(!/memories|Wspomnik/i.test(src), `${name} nadal odwołuje się do Wspomnika`)
  }
})

test('To-do: „Ukończone zadania" z menu otwierają osobny ekran', () => {
  // Wcześniej ta pozycja tylko przełączała zwiniętą sekcję na dole listy,
  // więc przy długiej liście kliknięcie nie dawało nic widocznego.
  const todo = read('src/components/todo/TodoDashboard.jsx')
  assert.match(todo, /id === 'done'\)\s*setView\('done'\)/, 'menu nadal nie przełącza widoku')
  assert.match(todo, /view === 'done'/, 'brak osobnego widoku ukończonych')
  assert.match(todo, /Brak ukończonych zadań/, 'brak pustego stanu na ekranie ukończonych')
  assert.match(read('src/components/todo/TodoMenu.jsx'), /'Ukończone zadania'/)
})

test('Biblia: reset i licznik pod trzema kropkami, start sam się włącza', () => {
  const bible = read('src/components/bible/BibleDashboard.jsx')
  assert.match(bible, /<BibleMenu/, 'brak menu ⋮ w Biblii')
  assert.match(bible, /resetProgress/, 'brak resetu postępów')
  // Licznik nie może już siedzieć na głównym ekranie — tylko w oknie z menu.
  assert.match(bible, /showJourney/)
  // Start ustawia się po odhaczeniu pierwszego rozdziału, bez żadnego przycisku.
  assert.match(bible, /stats\.read > 0 && !progress\.startDate/)
  assert.match(APP, /activeModule === 'bible'.*setHeaderExtras/)
})

test('Biblia: reset naprawdę kasuje rozdziały (nie merge pustą mapą)', () => {
  // setDoc({ counts: {} }, { merge: true }) SCALA mapy — nie skasowałoby
  // odhaczonych rozdziałów, a reset i tak pokazałby sukces.
  const bible = read('src/components/bible/BibleDashboard.jsx')
  const reset = bible.slice(bible.indexOf('const resetProgress'), bible.indexOf('// Górna belka'))
  assert.match(reset, /updateDoc\(ref, \{ counts: \{\}/, 'reset musi używać updateDoc')
  assert.ok(!/setDoc\(ref, \{ counts: \{\}[^)]*merge: true/.test(reset),
    'reset nadal kasuje rozdziały przez merge — to nic nie robi')
})

test('Dziesięcina: niedopłata nie znika razem z pulą', () => {
  const tithe = read('src/components/budget/TitheView.jsx')
  assert.match(tithe, /nextCarryOver\(due, paid\)/, 'brak przeniesienia reszty na następne rozliczenie')
  assert.match(tithe, /titheTotalDue\(/, 'kwota do oddania musi uwzględniać zaległość')
  // Rozliczone przychody muszą wypaść z zapytania, inaczej rośnie ono bez końca.
  assert.match(tithe, /tithe: false, titheSettledAt/)
})

test('Modlitwa: opis albo lista do odhaczania', () => {
  // Czytamy CAŁY moduł, nie pojedynczy plik: widoki Modlitwy siedzą w osobnych
  // plikach obok PrayerDashboard.jsx i przy kolejnym podziale test nie ma
  // padać tylko dlatego, że kod przeniósł się o plik dalej. Sprawdzamy, że
  // funkcja jest w module — nie gdzie dokładnie.
  const pray = readModule('src/components/prayer')
  assert.match(pray, /note-mode-btn/, 'brak przełącznika Opis / Lista')
  assert.match(pray, /function PrayerChecklist\(/, 'brak listy przy prośbie')
  // Odhaczanie punkt po punkcie zapisuje sie od razu.
  assert.match(pray, /checklistDone: toggleChecked/)
})

test('Modlitwa: odhaczanie dostępne w obu widokach, które go używają', () => {
  // Regresja: toggleChecklistItem było zamknięte w PersonDetailView, a widok
  // „Dziś" i tak podawał tę nazwę do RequestCard — czyli sięgał po zmienną
  // spoza swojego zakresu i wywalał się ReferenceError-em przy każdej liście
  // próśb. Funkcja musi być wspólna, nie lokalna dla jednego widoku.
  const wspolne = read('src/components/prayer/wspolne.jsx')
  assert.match(wspolne, /export async function toggleChecklistItem\(uid,/,
    'toggleChecklistItem musi być wspólne i brać uid, nie domykać się nad jednym widokiem')

  for (const plik of ['TodayView.jsx', 'PersonDetailView.jsx']) {
    const kod = read(`src/components/prayer/${plik}`)
    assert.match(kod, /toggleChecklistItem/, `${plik} nie podaje odhaczania do karty prośby`)
    assert.match(kod, /from '\.\/wspolne'/, `${plik} musi importować je z wspolne.jsx`)
  }
})

test('Modlitwa: filtry „Dziś" spięte z logiką, a tagi zapisują się przy prośbie', () => {
  // Filtrowanie i porządek listy mają zostać w utils/prayerFilters.js — tam da
  // się je przetestować bez przeglądarki. Widok ma je tylko wywołać; gdyby
  // kolejność wróciła do inline'owego sort() w JSX, żaden test jej nie pilnuje.
  const pray = readModule('src/components/prayer')
  assert.match(pray, /from '\.\.\/\.\.\/utils\/prayerFilters'/, 'moduł nie sięga po logikę filtrów')
  for (const fn of ['filterIntentions', 'sortIntentions', 'groupByPerson']) {
    assert.match(pray, new RegExp(fn), `widok nie używa ${fn}`)
  }
  // Tag bez zapisu na dokumencie prośby nie ma jak przeżyć odświeżenia.
  const form = read('src/components/prayer/IntentionForm.jsx')
  assert.match(form, /tags: normalizeTags\(/, 'formularz nie zapisuje tagów prośby')
})

test('Modlitwa: notatki widoczne pod prośbą bez klikania', () => {
  // Notatki pisze się po to, żeby mieć je przed oczami przy kolejnej modlitwie.
  // Domyślnie schowane za guzikiem były w praktyce niewidoczne.
  const card = read('src/components/prayer/RequestCard.jsx')
  assert.match(card, /showNotes, setShowNotes\]\s*=\s*useState\(true\)/, 'notatki muszą startować rozwinięte')
})

test('Nawyki: cel z wymaganych, licznik ze wszystkiego zrobionego', () => {
  const logic  = read('src/utils/habitLogic.js')
  const habits = read('src/components/habits/HabitsDashboard.jsx')
  const form   = read('src/components/habits/HabitForm.jsx')
  assert.match(logic, /export function dayScore/)
  assert.match(form, /setOptional/, 'brak wyboru wymagany / wyzwanie')
  // Pulpit i modul licza tak samo — jedna funkcja, nie dwie kopie. Oba podaja
  // jej liste BEZ wyzwan: wczesniej Pulpit dostawal wszystkie nawyki, wiec
  // odhaczone wyzwanie podbijalo mu „zrobione", choc celem nie bylo.
  assert.match(habits, /dayScore\(filtered, TODAY, pauses\)/)
  assert.match(habits, /requiredActive\s*=\s*activeHabits\.filter\(\s*\n?\s*h => isRequiredHabit\(h\)/,
    'lista dnia musi wychodzic od nawykow wymaganych')
  assert.match(PULPIT, /dayScore\(habits\.filter\(isRequiredHabit\), today, pauses\)/)
  assert.ok(!/function isDueOn/.test(PULPIT), 'Pulpit nie moze miec wlasnej kopii logiki nawykow')
})

test('Nawyki: archiwum siedzi w menu ⋮, nie na dole ekranu', () => {
  // Wczesniej trzeba bylo przewinac cala liste dnia, zeby je w ogole zobaczyc.
  const menu   = read('src/components/habits/HabitMenu.jsx')
  const habits = read('src/components/habits/HabitsDashboard.jsx')
  const arch   = read('src/components/habits/HabitArchive.jsx')
  assert.match(menu, /id: 'archive'/, 'brak pozycji „Archiwum" w menu Nawykow')
  assert.match(menu, /hasArchive/, 'pozycja ma sie chowac, gdy archiwum jest puste')
  assert.match(habits, /id === 'archive'\) setShowArchive\(true\)/, 'menu nie otwiera archiwum')
  assert.ok(!habits.includes('btn-show-archived'), 'przycisk archiwum nadal wisi pod lista dnia')
  assert.match(arch, /archived: false/, 'z archiwum musi dac sie przywrocic nawyk')
})

test('Nastroj: kafelki licza sie z wybranego okresu, nie z calej historii', () => {
  const mood = read('src/components/mood/MoodDashboard.jsx')
  assert.match(mood, /from '\.\.\/\.\.\/utils\/moodStats'/, 'statystyki nastroju bez wydzielonej logiki')
  assert.match(mood, /tileMode/, 'kafelki nie wiedza, jaki okres jest na ekranie')
  // Analiza nastroju: tylko Miesiąc i Rok (bez Tygodnia i „Łącznie").
  assert.match(mood, /items=\{\[\{ id: 'month', label: 'Miesiąc' \}, \{ id: 'year', label: 'Rok' \}\]\}/)
  // Suma wszystkiego liczona obok przelacznika okresu byla wlasnie tym bledem.
  assert.ok(!/const moodCount = logs\.length/.test(mood), 'kafelki znow licza z calej historii')
})

test('Wykres slupkowy sam przerzedza etykiety osi X', () => {
  // Przy 31 dniach kolumna ma ~7 px: dwucyfrowy dzien byl obcinany i wygladal
  // jak inna liczba. TodoStats robil to wczesniej po swojemu, co drugi dzien.
  const chart = read('src/components/ChartPrimitives.jsx')
  const stats = read('src/components/todo/TodoStats.jsx')
  assert.match(chart, /labelStep/, 'BarChartSVG nie przerzedza etykiet')
  assert.ok(!/i % 2 === 1/.test(stats), 'TodoStats znow chowa co druga etykiete')
})

test('Nawyki: edycja wszystkich nawykow siedzi w menu, nie w liscie dnia', () => {
  const menu    = read('src/components/habits/HabitMenu.jsx')
  const manager = read('src/components/habits/HabitManager.jsx')
  const habits  = read('src/components/habits/HabitsDashboard.jsx')
  // Wejscie z menu „trzy kropki"
  assert.match(menu, /id: 'manage'/, 'brak pozycji „Edytuj nawyki" w menu Nawykow')
  assert.match(habits, /id === 'manage'.*setShowManager\(true\)/, 'menu nie otwiera listy nawykow')
  assert.match(habits, /<HabitManager[\s\S]*habits=\{habits\}/, 'lista musi dostac WSZYSTKIE nawyki, nie tylko aktywne')
  // Nawyk, ktory jeszcze nie wystartowal, ma byc na liscie do edycji —
  // wczesniej dalo sie go otworzyc dopiero od dnia startu.
  assert.match(manager, /habitLifecycle/, 'lista nie rozroznia zaplanowanych / zakonczonych')
  assert.match(manager, /'planned'/)
  assert.match(manager, /<HabitForm/, 'z listy musi dac sie otworzyc formularz')
  // Klik w nawyk na liscie dnia nie moze juz otwierac formularza.
  const day = habits.slice(habits.indexOf('const renderCard'), habits.indexOf('const grid ='))
  assert.ok(!/setEditHabit/.test(day), 'karta dnia nadal otwiera edycje po kliknieciu')
})

test('Pulpit: pierscienie nie najezdzaja na tekst', () => {
  // Ring stoi w kontenerze flex obok napisow — bez flexShrink zapadal sie
  // ponizej swojego rozmiaru, a SVG wychodzilo poza pudelko.
  const chart = read('src/components/ChartPrimitives.jsx')
  assert.match(chart, /width: size, height: size, flexShrink: 0/)
})

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(jsx?|css)$/.test(name)) out.push(p)
  }
  return out
}

test('Osoba wygląda tak samo we wszystkich modułach', () => {
  // „Bąbelek" osoby był skopiowany CZTERY razy — w Kalendarzu, Śnie, Osobach
  // i jako wspólny komponent — a kopie zdążyły się rozjechać: część nie
  // pokazywała ikony osoby, część miała inny rozmiar czcionki. Osoba jest
  // współdzielona między modułami (jedna kolekcja `calendarPeople`), więc
  // ma jedną reprezentację.
  const wlasneKopie = []
  for (const plik of zrodlaSrc()) {
    if (plik.endsWith('components/PersonBubble.jsx')) continue
    const kod = readFileSync(plik, 'utf8')
    if (/function (Bubble|PersonBubble)\s*\(/.test(kod)) {
      wlasneKopie.push(plik.replace(ROOT + '/', ''))
    }
  }
  assert.deepEqual(wlasneKopie, [], 'własne kopie bąbelka osoby zamiast components/PersonBubble')
})

test('Paleta kolorów osób ma jedno źródło', () => {
  // Ta sama lista siedziała w trzech plikach; dorzucenie koloru w jednym
  // dawało osobę wyglądającą inaczej w innym module.
  const wlasneKopie = []
  for (const plik of zrodlaSrc()) {
    if (plik.endsWith('utils/personColors.js')) continue
    const kod = readFileSync(plik, 'utf8')
    if (/const PERSON_COLORS\s*=\s*\[/.test(kod)) wlasneKopie.push(plik.replace(ROOT + '/', ''))
  }
  assert.deepEqual(wlasneKopie, [], 'własne kopie palety zamiast utils/personColors.js')
})

test('Wyzwania: wlasny ekran pod flaga w belce, obok nastroju', () => {
  // Wyzwania maja byc tam, gdzie nastroj — przelacznik w belce i widok W MIEJSCU
  // tresci, nie nakladka (nakladce belka aplikacji zaslaniala wlasny pasek).
  const habits = read('src/components/habits/HabitsDashboard.jsx')
  const extras = read('src/components/habits/HabitExtras.jsx')
  assert.match(habits, /import HabitExtras from '\.\/HabitExtras'/)
  assert.match(habits, /if \(extrasOpen\) \{/, 'brak renderu widoku wyzwan')
  assert.match(habits, /<HabitExtras/)
  // Flaga przełącza w obie strony; menu ⋮ działa też na ekranie wyzwań.
  assert.match(habits, /setExtrasOpen\(o => !o\)/)
  assert.match(habits, /extras=\{extrasOpen\}/)
  assert.match(habits, /\{modale\}/, 'okna spod ⋮ muszą działać także w Wyzwaniach')
  // Na ekranie wyzwan swiadomie NIE MA serii ani rekordu.
  assert.ok(!/getStreak|getBestStreak|IconFlame/.test(extras),
    'wyzwania nie maja miec serii — liczy sie „ile razy"')
  assert.match(extras, /optionalProgress/)
  // Dzien jest WSPOLNY z lista dnia Nawykow — inaczej przejscie tam i z powrotem
  // gubiloby miejsce, w ktorym jestes.
  assert.match(habits, /selectedDay=\{selectedDay\}/)
  assert.match(habits, /onSelectDay=\{setSelectedDay\}/)
  assert.match(extras, /onSelectDay\(format\(subDays/, 'brak cofania dnia')
  assert.match(extras, /onSelectDay\(format\(addDays/, 'brak przewijania dnia w przod')
  // W przyszlosc nie wolno — nie da sie zaliczyc czegos, co sie nie stalo.
  assert.match(extras, /disabled=\{isToday\}/)
  assert.match(extras, /disabled=\{isFuture\}/)
  // Statystyki okresu: przelacznik tydzien/miesiac/rok i wykres liczby zaliczen.
  assert.match(extras, /optionalRange/)
  assert.match(extras, /optionalBuckets/)
  assert.match(extras, /<SegTabs/)
  assert.match(extras, /<BarChartSVG/)
  // Dni, ktore sie udaly, pokazujemy TA SAMA siatka co w Nawykach — nie druga
  // wlasna kopia kalendarza.
  assert.match(extras, /import MonthCalendar from '\.\/MonthCalendar'/)
  assert.match(extras, /renderCell=\{cellForHabit\(h, color\)\}/, 'brak siatki dni przy wyzwaniu')
  assert.match(extras, /renderCell=\{cellForAll\}/, 'brak kalendarza zbiorczego')
  // Ten sam podzial co w statystykach Nawykow: miesiac jako kalendarz,
  // tydzien i rok jako slupki.
  assert.match(extras, /period === 'month'/)
  assert.ok(!/function MonthCalendar/.test(extras), 'wyzwania nie moga miec wlasnej kopii kalendarza')
})

test('Wyzwania: lista dnia jest zwarta, siatki siedza w Statystykach', () => {
  // Kalendarz pod kazda pozycja listy dnia zjadal caly ekran — na telefonie
  // trzy wyzwania znaczyly trzy przewiniecia, zeby dojsc do czwartego.
  // Podzial jest teraz taki jak w Nawykach: lista do odhaczania osobno,
  // siatki i liczby w drugiej zakladce.
  const extras = read('src/components/habits/HabitExtras.jsx')
  assert.match(extras, /items=\{\[\{ id: 'today', label: 'Dziś' \}, \{ id: 'stats', label: 'Statystyki' \}\]\}/,
    'brak zakladek Dzis / Statystyki')
  // Nawigator dnia nalezy do zakladki „Dzis", kalendarze do „Statystyk".
  const dzis  = extras.split("tab === 'stats'")[0]
  const staty = extras.split("tab === 'stats'")[1] || ''
  assert.match(dzis, /onSelectDay\(format\(subDays/, 'nawigator dnia musi byc w zakladce Dzis')
  // Kalendarz w zakladce "Dzis" jest JEDEN, w hero — tak samo jak w Nawykach.
  // Zakazana jest siatka pod kazda pozycja listy, bo to ona zjadala ekran.
  const lista = dzis.split('Zwarta lista do odhaczania')[1] || ''
  assert.ok(!/<MonthCalendar/.test(lista), 'lista dnia nie moze miec kalendarza pod kazda pozycja')
  assert.equal((dzis.match(/<MonthCalendar/g) || []).length, 1, 'w hero jeden kalendarz, nie wiecej')
  assert.match(staty, /<MonthCalendar/, 'siatki dni naleza do Statystyk')
  assert.match(staty, /<StatTiles/)
})

test('Wyzwania: statystyki okresu licza sie bez nich', () => {
  const stats  = read('src/utils/habitStats.js')
  const habits = read('src/components/habits/HabitsDashboard.jsx')
  // statBuckets dostawal wszystkie nawyki, wiec nieodhaczone wyzwanie zanizalo
  // slupek trendu, mimo ze cel dnia je pomijal.
  assert.match(stats, /habits\.filter\(isRequiredHabit\)/, 'trend musi odsiewac wyzwania')
  assert.match(habits, /rangeStats\(requiredActive, pauses, start, endClamped\)/)
  assert.match(habits, /statBuckets\(requiredActive,/)
})

test('Statystyki ogolne nie mieszaja sie z tym, co zamkniete', () => {
  // Zamkniete nawyki dotycza czegos, co sie skonczylo — w ogolnych statystykach
  // mieszaly sie z tym, co robisz teraz. Ich liczby i os czasu mieszkaja w
  // "Ukonczone i archiwum".
  const habits  = read('src/components/habits/HabitsDashboard.jsx')
  const extras  = read('src/components/habits/HabitExtras.jsx')
  const archive = read('src/components/habits/HabitArchive.jsx')
  for (const [plik, src] of [['HabitsDashboard', habits], ['HabitExtras', extras]]) {
    assert.ok(!/<HabitTimeline/.test(src), `${plik}: os czasu nalezy do archiwum, nie do statystyk`)
    assert.ok(!/<HabitTimeline/.test(src), `${plik}: historia nalezy do archiwum`)
  }
  assert.match(archive, /<HabitTimeline/, 'archiwum musi pokazywac os czasu')
  // Agregaty okresu dalej licza sie tylko z aktywnych.
  assert.match(habits, /rangeStats\(requiredActive, pauses, start, endClamped\)/)
  assert.match(habits, /statBuckets\(requiredActive,/)
  assert.ok(!/rangeStats\(archived/.test(habits), 'archiwum nie moze wchodzic do procentow')
})

test('Wyzwania: samo archiwum tez otwiera ekran', () => {
  // Pusty stan konczyl prace komponentu, wiec przy zerowej liczbie AKTYWNYCH
  // wyzwan archiwum bylo nieosiagalne.
  const extras = read('src/components/habits/HabitExtras.jsx')
  assert.match(extras, /habits\.length === 0 && archived\.length === 0/)
})

test('Nawyki i wyzwania rozdzielone w edycji i w kolejnosci', () => {
  const manager = read('src/components/habits/HabitManager.jsx')
  const reorder = read('src/components/habits/HabitReorderModal.jsx')
  for (const [plik, src] of [['HabitManager', manager], ['HabitReorderModal', reorder]]) {
    assert.match(src, /import SegTabs from '\.\.\/SegTabs'/, `${plik}: zakladki przez wspolny SegTabs`)
    assert.match(src, /isOptionalHabit/, `${plik}: brak podzialu na wyzwania`)
    assert.match(src, /Wyzwania \(/, `${plik}: brak zakladki Wyzwania`)
  }
  // Kolejnosc zapisuje OBIE grupy, nie tylko otwarta zakladke.
  assert.match(reorder, /habitOrderUpdates\(grupy\.required, grupy\.optional\)/)
  // Zakladki pokazujemy tylko wtedy, gdy wyzwania w ogole sa — pusta zakladka myli.
  assert.match(manager, /wyzwaniaAll\.length > 0 &&/)
  assert.match(reorder, /maWyzwania && \(/)
})

test('Archiwum: os czasu liczona w habitStats, nie w komponencie', () => {
  const archive  = read('src/components/habits/HabitArchive.jsx')
  const timeline = read('src/components/habits/HabitTimeline.jsx')
  assert.match(archive, /import HabitTimeline from '\.\/HabitTimeline'/)
  // Zamkniete = ukonczone + zarchiwizowane, jedna wspolna os.
  assert.match(archive, /zamkniete = \[\.\.\.endedHabits, \.\.\.habits\]/)
  assert.match(archive, /amountTotals\(zamkniete\)/, 'brak sum "na to poszlo" w archiwum')
  assert.match(timeline, /timelineLanes/)
  assert.match(timeline, /timelineTicks/)
  // Komponent nie moze sam liczyc skali — inaczej nie da sie tego przetestowac.
  assert.ok(!/differenceInCalendarDays/.test(timeline),
    'matematyka osi nalezy do habitStats, nie do komponentu')
})

test('Nawyk mozna ukonczyc jednym klikniecieem, bez grzebania w dacie', () => {
  // Dotad dawalo sie to zrobic tylko okreznie: wejsc w date zakonczenia i
  // ustawic dzisiejsza recznie.
  const form = read('src/components/habits/HabitForm.jsx')
  assert.match(form, /const handleFinish = async/)
  assert.match(form, /Ukończ nawyk/)
  assert.match(form, /Wznów nawyk/, 'ukonczenie musi byc odwracalne')
  // Pod spodem to endDate, bo cykl zycia, archiwum i os czasu czytaja wlasnie ja.
  assert.match(form, /endDate: skonczony \? null : dzis/)
  assert.ok(!/completed: true/.test(form), 'druga flaga rozjechalaby sie z endDate')
  // endDate = DZIS znaczy "dzis jest ostatnim dniem", wiec nawyk schodzi z listy
  // dopiero jutro. Bez komunikatu klik w "Ukoncz" wyglada, jakby nic nie zrobil.
  assert.match(form, /ostatnim dniem/, 'brak wyjasnienia, ze nawyk zejdzie od jutra')
})

test('Nawyki na czas / ilosc: cel w formularzu, pasek zamiast haczyka', () => {
  const form    = read('src/components/habits/HabitForm.jsx')
  const habits  = read('src/components/habits/HabitsDashboard.jsx')
  const extras  = read('src/components/habits/HabitExtras.jsx')
  const stepper = read('src/components/habits/AmountStepper.jsx')

  // Formularz zapisuje cel i jednostke; null zdejmuje miare.
  assert.match(form, /target: mierzone && Number\(target\) > 0 \? Number\(target\) : null/)
  assert.match(form, /unit: mierzone \?/)
  assert.match(form, /HABIT_UNITS\.map/, 'brak listy jednostek do wyboru')
  assert.match(form, /__wlasna/, 'brak wlasnej jednostki')

  // Haczyk nie umie powiedziec "10 z 20 minut" — mierzony nawyk dostaje pasek.
  for (const [plik, src] of [['HabitsDashboard', habits], ['HabitExtras', extras]]) {
    assert.match(src, /hasAmountGoal\(h(abit)?\) \?/, `${plik}: brak przelaczenia na pasek`)
    assert.match(src, /<AmountStepper/, `${plik}: brak AmountStepper`)
  }
  // Jeden komponent wpisywania na oba ekrany, nie dwie kopie.
  assert.match(stepper, /dayAmount/)
  assert.match(stepper, /dayProgress/)
  // Kontrolka to JEDEN przycisk wielkosci haczyka. Trzy ("-", pasek, "+")
  // zjadaly tyle szerokosci, ze nazwy zostawaly jako "Czas z B..." i "Psychol...".
  assert.match(stepper, /nextAmount/, 'klik ma cyklicznie dokladac skok')
  assert.match(stepper, /conic-gradient/, 'postep pokazuje pierscien')
  assert.ok(!/title=\{`−/.test(stepper), 'przycisk "−" ma nie wrocic')
  assert.equal((stepper.match(/<button/g) || []).length, 1, 'dokladnie jeden przycisk')
  // Liczba stoi PRZY NAZWIE, gdzie jest na nia miejsce — i jest KLIKALNA,
  // bo tam siedzi precyzyjne ustawianie ("-", "+", pole).
  assert.match(habits, /amountShortLabel\(dayAmount\(habit, selectedDay\)/)
  assert.match(extras, /amountShortLabel\(dayAmount\(h, selectedDay\)/)
  assert.match(habits, /setAmountFor\(\{ habit, date: selectedDay \}\)/)
  assert.match(extras, /setAmountFor\(h\)/)
  // Pusty dzien pokazuje "+", inaczej pierscien wyglada jak kontrolka tylko do
  // patrzenia i nie widac, ze cokolwiek da sie dodac.
  assert.match(stepper, /<IconPlus/)
})

test('Czas/ilosc: dodawanie I odejmowanie jest mozliwe', () => {
  // Po zwinieciu kontrolki do jednego przycisku zostalo samo dodawanie skoku —
  // nie dalo sie odjac ani wpisac konkretnej liczby.
  const sheet  = read('src/components/habits/AmountSheet.jsx')
  const habits = read('src/components/habits/HabitsDashboard.jsx')
  const extras = read('src/components/habits/HabitExtras.jsx')
  assert.match(sheet, /setWartosc\(w => Math\.max\(0, w - skok\)\)/, 'brak odejmowania')
  assert.match(sheet, /setWartosc\(w => w \+ skok\)/, 'brak dodawania')
  // Pole tekstowe z klawiaturą numeryczną: puste pole nie wraca do „0".
  assert.match(sheet, /inputMode="numeric" value=\{tekst\}/, 'brak pola na konkretna liczbe')
  assert.match(sheet, /szybkieDodatki\(unit\)/, 'brak szybkich przycisków +5 +15 +30…')
  assert.match(sheet, /Cały cel/)
  assert.match(sheet, /Wyczyść/)
  // Okno jest podpiete w obu modulach, nie tylko w Nawykach.
  for (const [plik, src] of [['HabitsDashboard', habits], ['HabitExtras', extras]]) {
    assert.match(src, /<AmountSheet/, `${plik}: brak okna ustawiania`)
  }
  // W liscie dnia chip siedzi w karcie, wiec klik nie moze przy okazji odpalac
  // tego, co jest pod spodem. Na ekranie wyzwan chip stoi OBOK przycisku z
  // nazwa (patrz test o buttonie w buttonie), wiec nie ma czego zatrzymywac.
  assert.match(habits, /e\.stopPropagation\(\)/)
})

test('Nawyki na czas: amounts trzymane w zgodzie z completedDates', () => {
  // completedDates czytaja seria, kalendarze i archiwum. Gdyby zapis amounts ich
  // nie ruszal, dowieziony cel nie budowalby serii, a kalendarz pokazywalby
  // pominiety dzien.
  const habits = read('src/components/habits/HabitsDashboard.jsx')
  assert.match(habits, /const setDayAmount = async/)
  assert.match(habits, /\[`amounts\.\$\{date\}`\]: value > 0 \? value : deleteField\(\)/,
    'zero musi czyscic pole, nie zostawiac pustego wpisu')
  assert.match(habits, /completedDates: value >= target && target > 0 \? arrayUnion\(date\) : arrayRemove\(date\)/,
    'caly cel wpisuje dzien, mniej go zdejmuje')
  assert.match(habits, /onSetAmount=\{setDayAmount\}/, 'ekran wyzwan nie dostaje zapisu wartosci')
})

test('Nawyki na czas: sumy "ile na to poszlo" w obu statystykach', () => {
  const habits = read('src/components/habits/HabitsDashboard.jsx')
  const extras = read('src/components/habits/HabitExtras.jsx')
  assert.match(habits, /amountTotals\(requiredActive, start, endClamped\)/)
  assert.match(extras, /amountTotals\(habits, start, end\)/)
})

test('Kolejnosc ukladamy tylko dla tego, co robisz teraz', () => {
  // Ukonczone siedza dalej w activeHabits (nie sa zarchiwizowane), wiec bez
  // filtra wchodzily do ukladania i zajmowaly miejsca, ktorych juz nie uzywasz.
  const habits = read('src/components/habits/HabitsDashboard.jsx')
  assert.match(habits, /reorderable = activeHabits\.filter\(h => habitLifecycle\(h, TODAY\) !== 'ended'\)/)
  assert.match(habits, /<HabitReorderModal user=\{user\} habits=\{reorderable\}/)
  assert.match(habits, /canReorder=\{\(extrasOpen \? extraHabits\.length : reorderable\.length\) > 1\}/)
})

test('Zacznij od nowa: najpierw dorobek, potem zamkniecie', () => {
  const fresh  = read('src/components/habits/HabitFreshStart.jsx')
  const habits = read('src/components/habits/HabitsDashboard.jsx')
  const menu   = read('src/components/habits/HabitMenu.jsx')

  assert.match(menu, /label: 'Zacznij od nowa'/)
  assert.match(menu, /canFresh \?/, 'pozycja tylko wtedy, gdy jest co zamykac')
  assert.match(habits, /<HabitFreshStart/)
  assert.match(habits, /habits=\{reorderable\}/, 'zamykamy to, co aktywne, nie archiwum')

  // Podsumowanie MUSI byc widoczne przed zamknieciem — inaczej miesiace pracy
  // znikaja z listy dnia bez jednego zestawienia.
  assert.match(fresh, /freshStartSummary/)
  assert.match(fresh, /<HabitTimeline/)
  assert.match(fresh, /Co masz za sobą/)

  // Zamkniecie to endDate = dzis, czyli to samo co "Ukoncz nawyk" — zadnego
  // kasowania i kazdy da sie wznowic.
  assert.match(fresh, /batch\.update\(doc\(db, 'users', user\.uid, 'habits', h\.id\), \{ endDate: dzis \}\)/)
  assert.ok(!/deleteDoc|archived: true/.test(fresh), 'zamkniecie nie moze kasowac ani archiwizowac')
  // Wybor jest po stronie uzytkownika — domyslnie wszystko, ale da sie odznaczyc.
  assert.match(fresh, /new Set\(habits\.map\(h => h\.id\)\)/)
})

test('Wyzwania: ekran wyglada jak Nawyki — hero z postepem i kalendarzem', () => {
  const extras = read('src/components/habits/HabitExtras.jsx')
  const dzis = extras.split("tab === 'stats'")[0]
  assert.match(dzis, /<Ring value=\{dzien\.pct\}/, 'brak pierscienia postepu dnia')
  assert.match(dzis, /className="habit-hero"/, 'hero ma ten sam uklad dwoch kart co Nawyki')
  // Seria swiadomie NIE wraca — przy wyzwaniu przerwa w ciagu nie jest porazka.
  assert.ok(!/getStreak|IconFlame/.test(extras), 'wyzwania nie maja serii')
})

test('Wyzwania nie istnieja przed swoim startem', () => {
  // Wyzwanie zalozone w pazdzierniku pokazywalo wrzesien tak, jakby byl pomijany.
  const extras = read('src/components/habits/HabitExtras.jsx')
  assert.match(extras, /isOptionalActiveOn/, 'kratki musza znac zycie wyzwania')
  assert.match(extras, /poza wyzwaniem/)
  assert.match(extras, /poza wyzwaniami/)
})

test('Rok w statystykach to 12 kratek, nie 365 na nawyk', () => {
  // 365 kratek NA NAWYK dawalo przy kilkunastu nawykach ponad cztery tysiace
  // elementow i zacinajace sie przewijanie na telefonie.
  const habits = read('src/components/habits/HabitsDashboard.jsx')
  assert.match(habits, /statPeriod === 'year' \?/)
  assert.match(habits, /habitYearMonths\(habit, statYear, pauses, today\)/)
  // HabitDayGrid zostaje dla tygodnia — tam dzien po dniu ma sens.
  assert.match(habits, /<HabitDayGrid/)
})

test('Analiza dotyczy tego, co robisz teraz — bez ukonczonych', () => {
  // Ukonczone zostaja w activeHabits (ukonczenie to endDate, nie archiwizacja),
  // wiec bez filtra wchodzily do statystyk i kart razem z aktualnymi.
  const habits = read('src/components/habits/HabitsDashboard.jsx')
  assert.match(habits, /isRequiredHabit\(h\) && habitLifecycle\(h, TODAY\) !== 'ended'/)
  // Kalendarz zbiorczy w statystykach tez — inaczej liczylby zamkniete nawyki.
  assert.match(habits, /renderCell=\{aggCellFor\(requiredActive\)\}/)
  assert.ok(!/aggCellFor\(activeHabits\)/.test(habits.split("view === 'stats'")[1] || ''),
    'statystyki nie moga brac activeHabits')
})

test('Analiza: karta nawyku rozwija historie, a nie formularz', () => {
  // Klik w karte otwieral edycje — w analizie chce sie zobaczyc, JAK nawyk
  // szedl, a nie go zmieniac. Edycja siedzi w "Edytuj nawyki".
  const habits = read('src/components/habits/HabitsDashboard.jsx')
  // "view === 'stats'" wystepuje kilka razy (przycisk powrotu, sekcja) — bierzemy
  // wszystko od OSTATNIEGO wystapienia, czyli wlasciwa sekcje statystyk.
  const czesci = habits.split("view === 'stats'")
  const staty = czesci[czesci.length - 1]
  assert.match(staty, /onClick=\{\(\) => setOpenStat\(rozwiniety \? null : habit\.id\)\}/)
  assert.ok(!/onClick=\{\(\) => \{ setEditHabit\(habit\); setShowForm\(true\) \}\}/.test(staty),
    'karta w analizie nie moze otwierac formularza')
  // Siatka i legenda chowaja sie do rozwiniecia — wczesniej kazda karta niosla
  // pelna siatke i ekran trzeba bylo przewijac.
  assert.match(staty, /\{rozwiniety && \(<>/)
  assert.match(staty, /\{openStat && statPeriod !== 'year' && \(/, 'legenda tylko przy rozwinietej karcie')
})

test('Statystyki czasu i ilosci widac w obu modulach', () => {
  const habits = read('src/components/habits/HabitsDashboard.jsx')
  const extras = read('src/components/habits/HabitExtras.jsx')
  for (const [plik, src] of [['HabitsDashboard', habits], ['HabitExtras', extras]]) {
    assert.match(src, /amountStats\(/, `${plik}: brak statystyk czasu/ilosci`)
    assert.match(src, /średnio/, `${plik}: brak sredniej`)
  }
  // Suma widoczna od razu, bez rozwijania — to ona mowi najwiecej o takim nawyku.
  assert.match(habits, /miary && miary\.total > 0/)
})

test('Czas/ilosc: robote ponad norme da sie zapisac i widac ja', () => {
  // Klik po osiagnieciu celu zerowal dzien, wiec nadwyzki nie dalo sie wbic
  // inaczej niz recznie w oknie.
  const logic   = read('src/utils/habitLogic.js')
  const stepper = read('src/components/habits/AmountStepper.jsx')
  const habits  = read('src/components/habits/HabitsDashboard.jsx')
  assert.ok(!/if \(c >= t\) return 0/.test(logic), 'klik po celu nie moze zerowac dnia')
  assert.match(logic, /export function amountOver/)
  // Pierscien jest juz pelny, wiec nadwyzke pokazuje druga obwodka i liczba.
  assert.match(stepper, /boxShadow: ponad > 0/)
  assert.match(stepper, /ponad > 0\s*\n?\s*\? teraz/)
  // W rozwinietej karcie nadwyzka ma wlasny kafelek.
  assert.match(habits, /miary\.over > 0 &&/)
  assert.match(habits, /ponad cel · \{miary\.overDays\} dni/)
})

test('Liczba otwierajaca okno nie moze byc buttonem w buttonie', () => {
  // Na ekranie wyzwan chip siedzial WEWNATRZ przycisku z nazwa. Button w
  // buttonie to nieprawidlowy HTML — przegladarka przebudowuje drzewo i klik
  // nie dociera tam, gdzie powinien, wiec okna nie dalo sie otworzyc, a przez
  // to nie bylo jak odjac ani wyczyscic dnia.
  const extras = read('src/components/habits/HabitExtras.jsx')
  const lista = (extras.split('Zwarta lista do odhaczania')[1] || '').split("tab === 'stats'")[0]
  const otwarcie = lista.indexOf('setAmountFor(h)')
  const nazwa = lista.indexOf('onClick={() => onEdit(h)}')
  assert.ok(otwarcie > 0 && nazwa > 0, 'oba przyciski musza byc w liscie')
  // Przycisk z liczba zaczyna sie PO zamknieciu przycisku z nazwa.
  const koniecNazwy = lista.indexOf('</button>', nazwa)
  assert.ok(otwarcie > koniecNazwy, 'chip musi byc OBOK przycisku nazwy, nie w srodku')
  // Jest wyraznie przyciskiem, nie etykieta — inaczej nikt nie zgadnie, ze klika.
  for (const [plik, src] of [['HabitExtras', extras], ['HabitsDashboard', read('src/components/habits/HabitsDashboard.jsx')]]) {
    assert.match(src, /title="Ustaw dokładnie \(odejmij, wpisz, wyczyść\)"/, `${plik}: chip ma mowic, co robi`)
    assert.match(src, /<IconEdit size=\{1[01]\} \/>/, `${plik}: chip ma ikone`)
  }
})

test('Okno ustawiania mowi, co zapisze', () => {
  const sheet = read('src/components/habits/AmountSheet.jsx')
  assert.match(sheet, /Zapisz \$\{formatAmount\(wartosc, unit\)\}/)
  assert.match(sheet, /Zapisz — nic dziś/, 'po "Wyczysc" widac, ze zapisze zero')
})

test('Ukonczone i archiwum: dorobek na gorze, pozycje pod spodem', () => {
  // Os czasu byla doklejona na SAMYM DOLE, pod dwiema listami, wiec trzeba bylo
  // sie do niej przewijac — a to po nia sie tu wchodzi.
  const archive = read('src/components/habits/HabitArchive.jsx')
  const osIdx = archive.indexOf('<HabitTimeline')
  const listaIdx = archive.indexOf('{lista.map(pozycja)}')
  assert.ok(osIdx > 0 && listaIdx > 0)
  assert.ok(osIdx < listaIdx, 'podsumowanie i os czasu musza byc PRZED lista pozycji')

  // Dwa stany tej samej rzeczy rozdziela przelacznik, nie dwie sekcje pod soba.
  assert.match(archive, /<SegTabs/)
  assert.match(archive, /Ukończone \(\$\{ukonczone\.length\}\)/)
  assert.match(archive, /Archiwum \(\$\{schowane\.length\}\)/)
  // Najswiezsze u gory — lista bez porzadku byla nie do przegladniecia.
  assert.match(archive, /sort\(byRecentlyClosed\)/)
  // Nawyk na czas pokazuje tez, ile go bylo.
  assert.match(archive, /amountStats\(h\)/)
  // Akcje jako ikony: przy kilku pozycjach napisy robily ze sciane tekstu.
  assert.ok(!/smallBtn/.test(archive), 'stare przyciski z napisami maja zniknac')
})

test('Apka 2.0 nie łączy się z bazą starej Apki (aplikacja-0)', () => {
  const hits = walk(join(ROOT, 'src'))
    .filter(f => read(f.replace(ROOT + '/', '')).includes('aplikacja-0'))
  assert.deepEqual(hits, [], 'w kodzie jest odwołanie do projektu starej Apki')
  assert.ok(!read('.firebaserc').includes('aplikacja-0'), '.firebaserc wskazuje starą Apkę')
  const cfg = read('src/firebase/config.js')
  assert.match(cfg, /LOCAL_PROJECT_ID = 'demo-/, 'projekt lokalny musi mieć prefiks demo-')
})
