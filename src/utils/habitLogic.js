import { format, subDays, addDays } from 'date-fns'

// Powody pauz (wyjazd / choroba / inne) — każdy ma swój kolor,
// używany w siatce tygodnia i legendzie, żeby dni przerwy były czytelne.
export const PAUSE_REASONS = [
  { id: 'vacation', label: 'Wyjazd',           icon: 'IcPlane',  color: '#1E3A8A' }, // ciemny niebieski
  { id: 'illness',  label: 'Choroba',          icon: 'IcThermo', color: '#DC2626' }, // czerwony
  { id: 'malaise',  label: 'Złe samopoczucie', icon: 'IcCloud',  color: '#7C3AED' }, // fioletowy
  { id: 'other',    label: 'Inne',             icon: 'IconMore', color: '#64748B' }, // szary
]

// Wygląd powodu przerwy. Przyjmuje id powodu ALBO całą pauzę — własne powody
// (dopisane przez użytkowniczkę) nie są na liście wbudowanych, więc ich nazwa,
// kolor i ikona jadą w samej pauzie (reasonLabel / reasonColor / reasonIcon).
export function pauseReasonMeta(reasonOrPause) {
  const pauza = reasonOrPause && typeof reasonOrPause === 'object' ? reasonOrPause : null
  const id = pauza ? pauza.reason : reasonOrPause
  const wbudowany = PAUSE_REASONS.find(r => r.id === id)
  if (wbudowany) return wbudowany
  const inne = PAUSE_REASONS.find(r => r.id === 'other')
  if (!pauza) return inne
  return { id, label: pauza.reasonLabel || inne.label, icon: pauza.reasonIcon || inne.icon, color: pauza.reasonColor || inne.color }
}

// Lista powodów do wyboru: wbudowane (bez „Inne") + własne + „Inne" na końcu.
export function powodyPauz(wlasne = []) {
  const inne = PAUSE_REASONS.find(r => r.id === 'other')
  return [...PAUSE_REASONS.filter(r => r.id !== 'other'), ...wlasne.filter(r => r?.id && r?.label), inne]
}

// Zwraca pauzę obejmującą dany dzień (albo null)
export function pauseForDay(dateStr, pauses = []) {
  return pauses.find(p => dateStr >= p.from && dateStr <= p.to) || null
}

// Czy dany dzień mieści się w którejś z pauz (wyjazd/choroba)
export function isPausedDay(dateStr, pauses = []) {
  return pauses.some(p => dateStr >= p.from && dateStr <= p.to)
}

// Nawyk „wymagany" to podstawa dnia — tylko takie wchodzą do mianownika
// („zrobione 5 z 8"). Nawyki oznaczone jako dodatkowe nie podbijają celu:
// jak je zrobisz, liczą się na plus, jak nie — nic się nie dzieje.
// Brak pola = wymagany, żeby istniejące nawyki zachowały się jak dotąd.
export const isRequiredHabit = (habit) => habit?.optional !== true

// Rozliczenie dnia: ile trzeba, ile z tego zrobione i ile zrobione w ogóle.
// `doneTotal` liczy WSZYSTKO odhaczone tego dnia — także nawyki dodatkowe,
// poza harmonogramem i zrobione w trakcie przerwy. Dlatego wynik potrafi
// przebić cel (11 z 8) i o to chodzi: nadprogramowa robota ma być widoczna.
export function dayScore(habits = [], dateStr, pauses = []) {
  let required = 0, doneRequired = 0, doneTotal = 0
  for (const h of habits) {
    // Nawyk z celem liczbowym wnosi UŁAMEK: 10 z 20 minut to pół dnia. Bez
    // tego częściowa robota przepadała jako niezrobiona.
    const done = dayProgress(h, dateStr)
    doneTotal += done
    if (isRequiredHabit(h) && isHabitDue(h, dateStr, pauses) === 'due') {
      required++
      doneRequired += done
    }
  }
  // Procent liczymy z wymaganych i ucinamy na 100 — pasek postępu nie ma
  // sensu powyżej pełna, a sama nadwyżka widać w liczbach.
  const pct = required > 0 ? Math.min(100, Math.round((doneTotal / required) * 100)) : (doneTotal > 0 ? 100 : 0)
  // Licznik zaokrąglamy do pół jednostki: „4,5 z 6" czyta się dobrze, a
  // „4,37 z 6" już nie. Surowe sumy zostają w doneExact do dalszych rachunków.
  const pol = (x) => Math.round(x * 2) / 2
  return {
    required,
    doneRequired: pol(doneRequired),
    doneTotal: pol(doneTotal),
    doneExact: doneTotal,
    extra: Math.max(0, pol(doneTotal) - pol(doneRequired)),
    pct,
  }
}

// Jak pokazać dany dzień nawyku. Jeden wspólny słownik stanów dla siatki dni,
// siatki tygodnia i statystyk — żeby te same sytuacje wyglądały wszędzie tak samo.
//
//   'future-paused' — zaplanowany wyjazd/choroba (jeszcze przed terminem)
//   'future'        — zwykły przyszły dzień
//   'done-paused'   — ZROBIONE mimo wyjazdu/choroby (wyróżniamy obwódką powodu)
//   'done-bonus'    — zrobione poza planem (nawyk nie wypadał tego dnia)
//   'done'          — zrobione zgodnie z planem
//   'paused'        — dzień przerwy bez wykonania (nie kara)
//   'missed'        — wypadało, nie zrobione
//   'off'           — poza planem (wolne)
export function habitDayKind({ habit, dateStr, pauses = [], today, isDone }) {
  const done = isDone !== undefined
    ? isDone
    : isDayComplete(habit, dateStr)
  const status = isHabitDue(habit, dateStr, pauses)
  const paused = status === 'paused'
  if (dateStr > today) return paused ? 'future-paused' : 'future'
  if (done) return paused ? 'done-paused' : status !== 'due' ? 'done-bonus' : 'done'
  if (paused) return 'paused'
  return status === 'due' ? 'missed' : 'off'
}

export const isDoneKind = (kind) => kind.startsWith('done')

// Ustala kolejność sortowania nawyków — najpierw wg pola `order` (ustawianego
// ręcznie w „Kolejności"), potem wg czasu utworzenia jako stabilna rezerwa.
export function byHabitOrder(a, b) {
  const oa = a.order ?? Number.MAX_SAFE_INTEGER
  const ob = b.order ?? Number.MAX_SAFE_INTEGER
  if (oa !== ob) return oa - ob
  return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
}

// Rutyny (części dnia / dowolne grupy) — kolejność wg pola `order`, remis wg
// czasu utworzenia. Taki sam kontrakt jak byHabitOrder.
export function byRoutineOrder(a, b) {
  const oa = a.order ?? Number.MAX_SAFE_INTEGER
  const ob = b.order ?? Number.MAX_SAFE_INTEGER
  if (oa !== ob) return oa - ob
  return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
}

// Grupuje nawyki (lub dowolne elementy) w sekcje wg przypisanej rutyny.
// `items` — lista elementów; `routines` — lista grup; `keyOf(item)` zwraca id
// rutyny elementu. Zwraca sekcje w kolejności rutyn (tylko niepuste), a na końcu
// sekcję bez grupy (id:null), jeśli są nieprzypisane elementy.
// Gdy nie ma żadnych rutyn — zwraca jedną sekcję {id:null} ze wszystkimi
// elementami, więc widok wygląda jak wcześniej (rutyny są opcjonalne).
export function groupByRoutine(items = [], routines = [], keyOf = (x) => x.routineId) {
  const ordered = [...routines].sort(byRoutineOrder)
  const sections = ordered.map(r => ({ id: r.id, name: r.name, items: [] }))
  const byId = Object.fromEntries(sections.map(s => [s.id, s]))
  const none = { id: null, name: null, items: [] }
  for (const it of items) {
    const rid = keyOf(it)
    ;(byId[rid] || none).items.push(it)
  }
  const result = sections.filter(s => s.items.length > 0)
  if (none.items.length > 0) result.push(none)
  return result
}

// Status nawyku danego dnia:
//  'before-start' | 'after-end' | 'paused' | 'due' | 'off'
//  'due'  = obowiązkowy tego dnia (wg harmonogramu)
//  'off'  = poza harmonogramem → dostępny jako dodatkowy (nieobowiązkowy)
//  'paused' = w trakcie pauzy → każdy nawyk jest dodatkowy
export function isHabitDue(habit, dateStr, pauses = []) {
  if (habit.startDate && dateStr < habit.startDate) return 'before-start'
  if (habit.endDate && dateStr > habit.endDate) return 'after-end'
  if (isPausedDay(dateStr, pauses)) return 'paused'
  const days = habit.frequencyDays || [0, 1, 2, 3, 4, 5, 6]
  return days.includes(new Date(dateStr + 'T12:00:00').getDay()) ? 'due' : 'off'
}

// Etap życia nawyku — potrzebny liście „Edytuj nawyki", gdzie muszą być widoczne
// także nawyki, które jeszcze nie wystartowały (dotąd dało się je otworzyć dopiero
// od dnia startu, bo listy dnia w ogóle ich nie pokazywały).
//   'archived' — w archiwum
//   'planned'  — data startu jeszcze przed nami
//   'ended'    — po dacie zakończenia
//   'active'   — trwa
export function habitLifecycle(habit, today = format(new Date(), 'yyyy-MM-dd')) {
  if (habit?.archived) return 'archived'
  if (habit?.startDate && today < habit.startDate) return 'planned'
  if (habit?.endDate && today > habit.endDate) return 'ended'
  return 'active'
}

// Aktualna seria (streak).
//  - każdy odhaczony dzień liczy się (także bonusy: dni poza harmonogramem i w pauzie)
//  - pominięty dzień OBOWIĄZKOWY przerywa serię
//  - pominięte dni: poza harmonogramem, w pauzie oraz dzisiejszy (jeszcze nierobiony) NIE przerywają serii
export function getStreak(
  completedDates,
  frequencyDays = [0, 1, 2, 3, 4, 5, 6],
  pauses = [],
  startDate = null,
  today = format(new Date(), 'yyyy-MM-dd'),
) {
  if (!completedDates?.length) return 0
  const completed = new Set(completedDates)
  const freq = frequencyDays || [0, 1, 2, 3, 4, 5, 6]
  let streak = 0
  let check = new Date(today + 'T12:00:00')
  for (let i = 0; i < 730; i++) {
    const dateStr = format(check, 'yyyy-MM-dd')
    if (startDate && dateStr < startDate) break
    if (completed.has(dateStr)) { streak++; check = subDays(check, 1); continue } // zrobione (obowiązkowe lub bonus)
    if (isPausedDay(dateStr, pauses)) { check = subDays(check, 1); continue }      // pauza → przeskocz
    if (!freq.includes(check.getDay())) { check = subDays(check, 1); continue }    // poza harmonogramem → przeskocz
    if (dateStr === today) { check = subDays(check, 1); continue }                 // dzisiaj jeszcze nierobione → grace
    break                                                                          // pominięty dzień obowiązkowy → koniec
  }
  return streak
}

// ── Checklist (kroki) nawyku ──
// Nawyk może mieć kroki: checklist = [{ id, title }], a stan odhaczenia
// per dzień trzymamy w checklistDone = { 'yyyy-MM-dd': [stepId, ...] }.

// Przełącza jeden krok — zwraca nową listę odhaczonych id (bez mutacji)
export function toggleStepDone(doneIds = [], stepId) {
  return doneIds.includes(stepId) ? doneIds.filter(id => id !== stepId) : [...doneIds, stepId]
}

// Czy wszystkie kroki nawyku są odhaczone (pusta checklista → false)
export function isChecklistComplete(checklist = [], doneIds = []) {
  return checklist.length > 0 && checklist.every(s => doneIds.includes(s.id))
}

// Najdłuższa seria w historii — ta sama reguła co getStreak, ale skanujemy
// od pierwszego wykonania do dziś i szukamy najdłuższego nieprzerwanego ciągu.
export function getBestStreak(
  completedDates,
  frequencyDays = [0, 1, 2, 3, 4, 5, 6],
  pauses = [],
  startDate = null,
  today = format(new Date(), 'yyyy-MM-dd'),
) {
  if (!completedDates?.length) return 0
  const completed = new Set(completedDates)
  const freq = frequencyDays || [0, 1, 2, 3, 4, 5, 6]
  const first = [...completedDates].sort()[0]
  const start = startDate && startDate > first ? startDate : first
  let best = 0, current = 0
  let check = new Date(start + 'T12:00:00')
  while (format(check, 'yyyy-MM-dd') <= today) {
    const dateStr = format(check, 'yyyy-MM-dd')
    if (completed.has(dateStr)) { current++; if (current > best) best = current } // zrobione → liczy
    else if (isPausedDay(dateStr, pauses)) { /* pauza → most, nie zeruj */ }
    else if (!freq.includes(check.getDay())) { /* poza harmonogramem → most */ }
    else if (dateStr === today) { /* dzisiaj → grace */ }
    else { current = 0 }                                                          // pominięty obowiązkowy → zeruj
    check = addDays(check, 1)
  }
  return best
}

// ── Statystyki okresowe (tydzień / miesiąc / rok) ──

// Lista dni 'yyyy-MM-dd' od start do end włącznie (bezpiecznik: max 400 dni)
export function eachDayStr(start, end) {
  const out = []
  let d = new Date(start + 'T12:00:00')
  const last = new Date(end + 'T12:00:00')
  for (let i = 0; i < 400 && d <= last; i++) {
    out.push(format(d, 'yyyy-MM-dd'))
    d = addDays(d, 1)
  }
  return out
}

// Podsumowanie realizacji nawyków w zakresie dni [start..end]:
//  - expected  — ile razy nawyk był obowiązkowy (suma po dniach) + wykonania w pauzie
//  - done       — ile z tego wykonano
//  - pct        — procent realizacji (done/expected)
//  - completions — wszystkie odhaczenia (także dodatkowe poza planem / w pauzie)
//  - perfectDays — dni ze 100% wykonaniem dni obowiązkowych
//  - dueDays     — dni, w których cokolwiek było obowiązkowe
// Wykonanie nawyku w trakcie pauzy (wyjazd/choroba) liczy się jako „zrobione"
// i podbija procent — dzień przerwy bez wykonania nie jest karą (pomijany).
export function rangeStats(habits = [], pauses = [], start, end) {
  let expected = 0, done = 0, completions = 0, perfectDays = 0, dueDays = 0
  for (const d of eachDayStr(start, end)) {
    let dueCount = 0, dueDone = 0
    for (const h of habits) {
      // Postęp, nie zero-jedynka: nawyk na czas wnosi ułamek dnia.
      const progress = dayProgress(h, d)
      // `completions` liczy dni ZALICZONE w całości — to licznik „ile razy się
      // udało", więc połowa normy się tu nie liczy.
      if (isDayComplete(h, d)) completions++
      const status = isHabitDue(h, d, pauses)
      if (status === 'due') {
        dueCount++; expected++
        done += progress
        if (progress >= 1) dueDone++
      } else if (status === 'paused' && progress > 0) {
        // wykonane w trakcie wyjazdu/choroby — liczy się jako zrobione
        expected++; done += progress
      }
    }
    // Dzień perfekcyjny = każdy wymagany nawyk dowieziony do końca.
    if (dueCount > 0) { dueDays++; if (dueDone === dueCount) perfectDays++ }
  }
  return {
    expected,
    done: Math.round(done * 10) / 10,
    completions,
    perfectDays,
    dueDays,
    pct: expected ? Math.round((done / expected) * 100) : 0,
  }
}

// Podsumowanie ukończonego nawyku — to, co chce się zobaczyć, gdy nawyk
// zniknął z listy dnia: ile razy się udało, jak długa była najlepsza seria
// i w jakim okresie to trwało. Bez tego zakończony nawyk przepadał bez śladu.
export function habitCompletionSummary(habit, pauses = []) {
  const dates = habitDoneDates(habit)
  return {
    total: dates.length,
    first: dates[0] || habit?.startDate || null,
    last: dates[dates.length - 1] || null,
    best: getBestStreak(
      dates,
      habit?.frequencyDays,
      pauses,
      habit?.startDate || null,
      habit?.endDate || format(new Date(), 'yyyy-MM-dd'),
    ),
  }
}

// Nawyk dodatkowy („wyzwanie") — przeciwieństwo wymaganego. Osobny ekran,
// osobne liczenie: nie wchodzi do celu dnia ani do procentów okresu, a seria
// go nie dotyczy. Liczy się tylko to, ile razy się udało.
export const isOptionalHabit = (habit) => habit?.optional === true

// Postęp nawyku dodatkowego. ŚWIADOMIE bez serii i rekordu: przy wyzwaniu
// („ile razy w tym miesiącu") strike nie jest tym, co się chce wiedzieć, a
// przerwa w ciągu nie jest porażką.
//  - inRange — ile odhaczeń mieści się w [start, end]
//  - total   — ile w całej historii nawyku
//  - first   — pierwsze odhaczenie (null, gdy żadnego)
//  - last    — ostatnie odhaczenie (null, gdy żadnego)
export function optionalProgress(habit, start, end) {
  const dates = habitDoneDates(habit)
  const inRange = (start && end)
    ? dates.filter(d => d >= start && d <= end).length
    : dates.length
  return {
    inRange,
    total: dates.length,
    first: dates[0] || null,
    last: dates[dates.length - 1] || null,
  }
}

// Zestawienie wszystkich wyzwań w okresie — nagłówek ekranu „Dodatkowe".
// `habits` podajemy już przefiltrowane do dodatkowych.
export function optionalSummary(habits = [], start, end) {
  let done = 0, active = 0
  // Najlepszy dzień okresu — zamiast serii. Przy wyzwaniu „ile razy" nie ma
  // ciągu do pilnowania, ale jeden mocny dzień chce się zobaczyć.
  const perDay = new Map()
  for (const h of habits) {
    const p = optionalProgress(h, start, end)
    done += p.inRange
    if (p.inRange > 0) active++
    for (const d of habitDoneDates(h)) {
      if (start && end && (d < start || d > end)) continue
      perDay.set(d, (perDay.get(d) || 0) + 1)
    }
  }
  let bestDay = null
  // Remis rozstrzygamy na korzyść dnia WCZEŚNIEJSZEGO, żeby ta sama historia
  // zawsze dawała tę samą odpowiedź (Map trzyma kolejność wstawiania).
  for (const [date, count] of [...perDay].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (!bestDay || count > bestDay.count) bestDay = { date, count }
  }
  return { done, active, count: habits.length, bestDay }
}

// Ile wyzwań zaliczono danego dnia — do kratki kalendarza zbiorczego na ekranie
// Wyzwań. Osobno od dayScore, bo tam kratka znaczy „ile z planu dnia", a
// wyzwanie planu nie ma: liczy się samo „ile się udało".
export function optionalDayCount(habits = [], dateStr) {
  let n = 0
  for (const h of habits) {
    if (!isOptionalActiveOn(h, dateStr)) continue
    if (isDayComplete(h, dateStr)) n++
  }
  return n
}

// Numeracja `order` przy zapisie kolejności. Nawyki i wyzwania ustawia się w
// osobnych zakładkach, ale `order` jest jednym ciągiem w bazie — wyzwania idą
// PO nawykach, żeby obie grupy miały rozłączne numery. Gdyby każda zakładka
// numerowała się od zera, przestawienie wyzwań zmieniłoby kolejność nawyków.
export function habitOrderUpdates(required = [], optional = []) {
  return [...required, ...optional].map((h, i) => ({ id: h.id, order: i }))
}

// ── Nawyki na czas i na ilość ───────────────────────────────────────────────
// Część rzeczy nie jest „zrobione / nie zrobione", a mierzy się czasem albo
// liczbą: 20 minut medytacji, 30 stron, 2 litry wody. Taki nawyk trzyma cel
// dnia w `target`, jednostkę w `unit`, a wykonanie w `amounts` — mapie
// data → liczba. Nawyk BEZ celu liczbowego działa jak dotąd, czyli zaliczenie
// dnia trzyma `completedDates`; przy celu liczbowym zaliczenie PRZELICZA się z
// `amounts` (patrz `habitDoneDates`), bo zapisana lista nie wie o późniejszej
// zmianie celu. `completedDates` zapisujemy tam dalej, żeby stare dane i
// nawyki bez celu nie przestały działać.

// Jednostki do wyboru. Czas trzymamy ZAWSZE w minutach i formatujemy sami —
// dwie jednostki czasu („min" i „h") kazałyby przeliczać sumy w obie strony.
// Skróty nie odmieniają się przez przypadki, bo „2 strony / 5 stron / 1 strona"
// przy dowolnej liczbie i własnej jednostce dawałoby więcej błędów niż pożytku.
export const HABIT_UNITS = [
  { id: 'min',   label: 'minuty',       short: 'min',  time: true },
  { id: 'str',   label: 'strony',       short: 'str.' },
  { id: 'km',    label: 'kilometry',    short: 'km' },
  { id: 'l',     label: 'litry',        short: 'l' },
  { id: 'szt',   label: 'sztuki',       short: 'szt.' },
  { id: 'powt',  label: 'powtórzenia',  short: 'powt.' },
]

export const unitMeta = (unit) =>
  HABIT_UNITS.find(u => u.id === unit) || { id: unit, label: unit, short: unit }

// Czy nawyk ma cel liczbowy. Brak `target` = zwykłe odhaczanie, czyli wszystko,
// co istniało przed tą funkcją.
export const hasAmountGoal = (habit) => Number(habit?.target) > 0

// Ile zrobiono danego dnia. Liczba spod `amounts`, a dla nawyku odhaczanego —
// 1 albo 0, żeby reszta kodu nie musiała rozróżniać tych dwóch światów.
export function dayAmount(habit, dateStr) {
  if (hasAmountGoal(habit)) {
    const v = Number(habit?.amounts?.[dateStr])
    return Number.isFinite(v) && v > 0 ? v : 0
  }
  return (habit?.completedDates || []).includes(dateStr) ? 1 : 0
}

// Czy dzień ma WPISANĄ liczbę. Osobno od `dayAmount`, bo zero i brak wpisu to
// dwie różne rzeczy: przy braku wpisu wracamy do starego odhaczenia.
const hasAmountEntry = (habit, dateStr) =>
  Number.isFinite(Number(habit?.amounts?.[dateStr])) && Number(habit?.amounts?.[dateStr]) > 0

// Postęp dnia jako 0..1. Dla celu liczbowego połowa normy to połowa dnia —
// dzięki temu „10 z 20 minut" widać w celu dnia i w procentach okresu, zamiast
// przepadać jako niezrobione. Ucinamy na 1: nadwyżka nie ma podbijać średniej.
export function dayProgress(habit, dateStr) {
  if (!hasAmountGoal(habit)) {
    return (habit?.completedDates || []).includes(dateStr) ? 1 : 0
  }
  // Dzień bez wpisanej liczby, ale odhaczony — nawyk dostał cel liczbowy
  // PÓŹNIEJ, a stare odhaczenia nie mają się przez to wyzerować.
  if (!hasAmountEntry(habit, dateStr)) {
    return (habit?.completedDates || []).includes(dateStr) ? 1 : 0
  }
  const target = Number(habit.target)
  return Math.max(0, Math.min(1, dayAmount(habit, dateStr) / target))
}

// Czy dzień jest ZALICZONY, czyli cel osiągnięty w całości. Seria i kalendarze
// zostają binarne: ciąg ma oznaczać dni, w których norma została dowieziona,
// a nie dni, w których coś się zaczęło.
//
// Liczymy to ZAWSZE z wpisanej liczby, nigdy z zapisanego wcześniej
// odhaczenia: `completedDates` powstaje w chwili klikania, więc po zmianie celu
// zostawało nieaktualne i kalendarz w statystykach pokazywał dzień jako
// zrobiony, choć 15 minut przy nowym celu 30 to już tylko połowa.
export function isDayComplete(habit, dateStr) {
  if (!hasAmountGoal(habit)) return (habit?.completedDates || []).includes(dateStr)
  if (!hasAmountEntry(habit, dateStr)) return (habit?.completedDates || []).includes(dateStr)
  return dayAmount(habit, dateStr) >= Number(habit.target)
}

// Dni zaliczone — jedna lista dla serii, kalendarzy, siatek i archiwum.
// Dla nawyku odhaczanego to po prostu `completedDates`, a dla nawyku na czas
// albo ilość lista jest PRZELICZANA z wpisanych liczb, żeby nigdzie nie
// świeciło zaliczenie, którego dziś już nie ma.
export function habitDoneDates(habit) {
  const odhaczone = habit?.completedDates || []
  // Zawsze posortowane i zawsze nowa tablica: wołający biorą stąd pierwszą i
  // ostatnią datę, a sortowanie w miejscu mieszałoby dane z bazy.
  if (!hasAmountGoal(habit)) return [...odhaczone].sort()
  const amounts = habit?.amounts || {}
  const target = Number(habit.target)
  const dni = new Set()
  for (const [d, raw] of Object.entries(amounts)) {
    const v = Number(raw)
    if (Number.isFinite(v) && v > 0 && v >= target) dni.add(d)
  }
  // Odhaczenia z czasów przed celem liczbowym zostają — ale tylko tam, gdzie
  // nie ma wpisanej liczby, bo wpisana liczba jest ważniejsza.
  for (const d of odhaczone) if (!hasAmountEntry(habit, d)) dni.add(d)
  return [...dni].sort()
}

// Format liczby z jednostką. Czas sam rozbija się na godziny i minuty, bo
// „485 min" nic nie mówi, a „8 h 5 min" mówi wszystko.
export function formatAmount(value, unit) {
  const v = Number(value) || 0
  const meta = unitMeta(unit)
  if (!meta.time) {
    const zaokr = Math.round(v * 10) / 10
    return `${zaokr} ${meta.short}`
  }
  const total = Math.round(v)
  const h = Math.floor(total / 60), m = total % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

// Suma wykonania w okresie, w rozbiciu na jednostki — „ile czasu na to poszło".
// Jednostek nie mieszamy: minuty i strony nie sumują się do jednej liczby.
export function amountTotals(habits = [], start, end) {
  const perUnit = new Map()
  for (const h of habits) {
    if (!hasAmountGoal(h)) continue
    const unit = h.unit || 'szt'
    for (const [d, raw] of Object.entries(h.amounts || {})) {
      if (start && end && (d < start || d > end)) continue
      const v = Number(raw)
      if (!Number.isFinite(v) || v <= 0) continue
      perUnit.set(unit, (perUnit.get(unit) || 0) + v)
    }
  }
  return [...perUnit].map(([unit, total]) => ({ unit, total, label: formatAmount(total, unit) }))
}

// Krótka etykieta na przycisk w liście dnia. `formatAmount` dwa razy („0 min /
// 5 min") rozpychało kontrolkę tak, że nazwa nawyku zostawała przycięta do
// „Czas…". Tutaj jednostka pada RAZ, na końcu, a przy pustym dniu pokazujemy
// sam cel — zero po lewej nic nie wnosi.
export function amountShortLabel(current, target, unit) {
  const t = Number(target) || 0
  const c = Number(current) || 0
  const short = unitMeta(unit).short
  if (c <= 0) return `${t} ${short}`
  // Bez celu nie ma do czego porównywać — „5/0 szt." nic nie znaczy.
  if (t <= 0 || c === t) return `${c} ${short}`
  // Nadwyżkę pokazujemy jako „35/20 min", a nie samo „35 min" — inaczej nie
  // widać, że to więcej, niż było trzeba.
  return `${c}/${t} ${short}`
}

// Podsumowanie dorobku przed zamknięciem rozdziału („zacznij od nowa").
// Zbiera to, co warto zobaczyć, zanim nawyki zejdą do ukończonych: ile tego
// było, jak długo trwało i jaki był najlepszy ciąg. Liczby biorą się z całej
// historii, nie z okresu — zamykamy wszystko, co się nazbierało.
export function freshStartSummary(habits = [], pauses = []) {
  const lista = habits.filter(Boolean)
  let completions = 0, best = 0, from = null, to = null
  for (const h of lista) {
    const s = habitCompletionSummary(h, pauses)
    completions += s.total
    if (s.best > best) best = s.best
    // Granice bierzemy wprost z odhaczeń, a nie z `s.first` — tam jest fallback
    // na startDate, więc nawyk założony dawno i nigdy nierobiony cofałby
    // początek historii o lata.
    const dates = habitDoneDates(h)
    const pierwsze = dates[0], ostatnie = dates[dates.length - 1]
    if (pierwsze && (!from || pierwsze < from)) from = pierwsze
    if (ostatnie && (!to || ostatnie > to)) to = ostatnie
  }
  return {
    count: lista.length,
    completions,
    best,
    from,
    to,
    totals: amountTotals(lista),
  }
}

// Czy wyzwanie w ogóle ISTNIAŁO danego dnia. Logika wyzwań nie znała startDate
// ani endDate, więc kalendarz rysował cały miesiąc, a tydzień wchodził w
// poprzedni: wyzwanie założone w październiku pokazywało wrzesień tak, jakby
// było wtedy pomijane. Dzień przed startem to nie porażka — wtedy tej rzeczy
// jeszcze nie było.
export function isOptionalActiveOn(habit, dateStr) {
  if (!dateStr) return false
  if (habit?.startDate && dateStr < habit.startDate) return false
  if (habit?.endDate && dateStr > habit.endDate) return false
  return true
}

// Postęp dnia dla wyzwań: ile zaliczonych z tych, które tego dnia istniały.
// Osobno od dayScore, bo tam mianownik bierze się z harmonogramu („due"), a
// wyzwanie planu dnia nie ma — liczy się samo to, czy już istniało.
export function optionalDayScore(habits = [], dateStr) {
  let total = 0, done = 0
  for (const h of habits) {
    if (!isOptionalActiveOn(h, dateStr)) continue
    total++
    if (isDayComplete(h, dateStr)) done++
  }
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
}

// Skok jednego kliknięcia przy celu liczbowym. Stały skok (np. 5 minut) przy
// celu 60 znaczyłby dwanaście kliknięć — dlatego liczymy go z celu tak, żeby
// do pełna było zawsze mniej więcej cztery.
//
// Minuty są wyjątkiem: skok liczony z celu wychodził przy małej normie na
// jedną minutę, a klikanie minuta po minucie nie ma sensu — czas chodzi w
// piątkach. Dlatego dla `min` zaokrąglamy skok do pełnych pięciu minut i nigdy
// nie schodzimy niżej (przy celu 10 minut skok to 5, nie 3).
// Szybkie przyciski „+" pod polem kwoty. Dla czasu: +5, +15, +30, +60 min
// i +2 h; dla stron — porcje typowe dla czytania; dla reszty małe liczby.
export function szybkieDodatki(unit) {
  const meta = unitMeta(unit)
  if (meta.time) return [5, 15, 30, 60, 120].map(v => ({ v, label: v === 120 ? '+2h' : `+${v}` }))
  if (unit === 'str') return [5, 10, 20, 50].map(v => ({ v, label: `+${v}` }))
  return [1, 5, 10].map(v => ({ v, label: `+${v}` }))
}

// Tekst z pola kwoty → liczba ≥ 0. Puste pole to 0, przecinek działa jak kropka.
export function liczbaZPola(tekst) {
  const n = Number(String(tekst ?? '').replace(',', '.').trim())
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function amountStep(target, unit) {
  const t = Number(target) || 0
  const czas = unitMeta(unit).time === true
  if (t <= 0) return czas ? 5 : 1
  if (czas) return Math.max(5, Math.round(t / 4 / 5) * 5)
  return Math.max(1, Math.round(t / 4))
}

// Następna wartość po kliknięciu. Dokłada skok i NIE zatrzymuje się na celu:
// robota ponad normę ma się dać zapisać, bo właśnie ona najwięcej mówi o dniu.
// Wcześniej klik po osiągnięciu celu zerował dzień, więc nadwyżki nie dało się
// wbić inaczej niż ręcznie. Zerowanie przeniosło się do okna („Wyczyść").
//
// Pierwszy klik dociąga do pełnego celu, zamiast go przeskakiwać: przy celu 20
// i skoku 5 wartość 18 daje 20, a nie 23.
export function nextAmount(current, target, unit) {
  const t = Number(target) || 0
  const c = Number(current) || 0
  const skok = amountStep(t, unit)
  if (t <= 0) return c + skok
  if (c < t) return Math.min(t, c + skok)
  return c + skok
}

// Ile ponad cel. Zero, gdy normy jeszcze nie ma — ujemna „nadwyżka" nie ma sensu.
export function amountOver(current, target) {
  const t = Number(target) || 0
  const c = Number(current) || 0
  return c > t ? c - t : 0
}

// Statystyki nawyku mierzonego czasem albo ilością w zadanym okresie.
// Procent wykonania sam w sobie mówi tu za mało: przy „20 minut dziennie"
// chce się wiedzieć, ile tego było łącznie, ile wychodziło średnio w dniu, w
// którym w ogóle usiadłaś, i kiedy poszło najlepiej.
//  - total     — suma wykonania
//  - days      — ile dni z czymkolwiek
//  - fullDays  — ile dni z CAŁYM celem
//  - avg       — średnia z dni, w których coś było (nie z kalendarza: zera
//                zaniżałyby ją tym bardziej, im rzadszy nawyk)
//  - best      — najlepszy dzień { date, value }
export function amountStats(habit, start, end) {
  if (!hasAmountGoal(habit)) return null
  const target = Number(habit.target)
  const wpisy = Object.entries(habit.amounts || {})
    .map(([date, raw]) => ({ date, value: Number(raw) }))
    .filter(({ date, value }) =>
      Number.isFinite(value) && value > 0 &&
      (!start || !end || (date >= start && date <= end)))
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const total = wpisy.reduce((s, w) => s + w.value, 0)
  const fullDays = wpisy.filter(w => w.value >= target).length
  // Remis bierze dzień wcześniejszy, żeby ta sama historia zawsze dawała tę
  // samą odpowiedź.
  const best = wpisy.reduce((b, w) => (!b || w.value > b.value ? w : b), null)
  return {
    unit: habit.unit || 'szt',
    target,
    total,
    days: wpisy.length,
    fullDays,
    // Ile zrobione PONAD normę — przy nawyku na czas to często najciekawsza
    // liczba: pokazuje dni, w których poszło więcej, niż trzeba było.
    over: wpisy.reduce((s, w) => s + Math.max(0, w.value - target), 0),
    overDays: wpisy.filter(w => w.value > target).length,
    avg: wpisy.length ? Math.round(total / wpisy.length) : 0,
    best: best ? { date: best.date, value: best.value } : null,
  }
}

// Sortowanie zamkniętych nawyków: najświeższe u góry. Liczy się ostatni ślad —
// data zakończenia albo ostatnie odhaczenie, zależnie od tego, co późniejsze.
// Nawyk schowany do archiwum zwykle nie ma endDate, więc samo sortowanie po
// niej wrzucałoby go na koniec listy bez względu na to, jak długo był robiony.
export function lastTrace(habit) {
  const dates = habitDoneDates(habit)
  const ostatnie = dates[dates.length - 1] || null
  const koniec = habit?.endDate || null
  if (!ostatnie) return koniec
  if (!koniec) return ostatnie
  return koniec > ostatnie ? koniec : ostatnie
}

export function byRecentlyClosed(a, b) {
  const x = lastTrace(a), y = lastTrace(b)
  // Nawyki bez żadnego śladu lądują na końcu — nie ma czym ich umiejscowić.
  if (!x && !y) return (a?.name || '').localeCompare(b?.name || '', 'pl')
  if (!x) return 1
  if (!y) return -1
  if (x === y) return (a?.name || '').localeCompare(b?.name || '', 'pl')
  return x > y ? -1 : 1
}
