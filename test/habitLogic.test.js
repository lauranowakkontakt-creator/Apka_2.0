import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPausedDay, isHabitDue, getStreak, getBestStreak, toggleStepDone, isChecklistComplete,
  PAUSE_REASONS, pauseReasonMeta, pauseForDay, byHabitOrder, eachDayStr, rangeStats,
  byRoutineOrder, groupByRoutine, habitDayKind, isDoneKind, isRequiredHabit, dayScore,
  habitLifecycle, habitCompletionSummary, isOptionalHabit, optionalProgress,
  optionalSummary, optionalDayCount, habitOrderUpdates, hasAmountGoal, dayAmount,
  dayProgress, isDayComplete, formatAmount, amountShortLabel, amountTotals, unitMeta,
  HABIT_UNITS, freshStartSummary, isOptionalActiveOn, optionalDayScore,
  amountStep, nextAmount, amountStats, amountOver, lastTrace, byRecentlyClosed,
  habitDoneDates } from '../src/utils/habitLogic.js'

test('byRoutineOrder: sortuje wg order, remis wg createdAt', () => {
  const a = { id: 'a', order: 2 }, b = { id: 'b', order: 0 }, c = { id: 'c', order: 1 }
  assert.deepEqual([a, b, c].sort(byRoutineOrder).map(x => x.id), ['b', 'c', 'a'])
})

test('groupByRoutine: sekcje w kolejności rutyn + „bez grupy" na końcu', () => {
  const routines = [{ id: 'wiecz', name: 'Wieczór', order: 2 }, { id: 'poranek', name: 'Poranek', order: 0 }]
  const habits = [
    { id: 'h1', routineId: 'poranek' },
    { id: 'h2', routineId: 'wiecz' },
    { id: 'h3', routineId: 'poranek' },
    { id: 'h4', routineId: null },       // bez grupy
    { id: 'h5', routineId: 'nieistnieje' }, // osierocone → bez grupy
  ]
  const g = groupByRoutine(habits, routines)
  assert.deepEqual(g.map(s => s.id), ['poranek', 'wiecz', null])
  assert.deepEqual(g[0].items.map(h => h.id), ['h1', 'h3'])
  assert.deepEqual(g[1].items.map(h => h.id), ['h2'])
  assert.deepEqual(g[2].items.map(h => h.id), ['h4', 'h5'])
})

test('groupByRoutine: pomija puste rutyny', () => {
  const routines = [{ id: 'a', name: 'A', order: 0 }, { id: 'b', name: 'B', order: 1 }]
  const g = groupByRoutine([{ id: 'h1', routineId: 'b' }], routines)
  assert.deepEqual(g.map(s => s.id), ['b'])
})

test('groupByRoutine: brak rutyn → jedna sekcja bez grupy ze wszystkim', () => {
  const g = groupByRoutine([{ id: 'h1', routineId: null }, { id: 'h2', routineId: 'x' }], [])
  assert.equal(g.length, 1)
  assert.equal(g[0].id, null)
  assert.deepEqual(g[0].items.map(h => h.id), ['h1', 'h2'])
})

test('groupByRoutine: własny keyOf (np. elementy {h})', () => {
  const routines = [{ id: 'p', name: 'Poranek', order: 0 }]
  const items = [{ h: { routineId: 'p' }, status: 'due' }]
  const g = groupByRoutine(items, routines, x => x.h.routineId)
  assert.deepEqual(g.map(s => s.id), ['p'])
})

// Punkt odniesienia: 2026-07-06 to poniedziałek (getDay() === 1)
const TODAY = '2026-07-06'
const DAILY = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS = [1, 2, 3, 4, 5]

// ---------- isPausedDay ----------
test('isPausedDay — wykrywa dzień w zakresie pauzy (włącznie z krańcami)', () => {
  const pauses = [{ from: '2026-07-04', to: '2026-07-05' }]
  assert.equal(isPausedDay('2026-07-03', pauses), false)
  assert.equal(isPausedDay('2026-07-04', pauses), true)
  assert.equal(isPausedDay('2026-07-05', pauses), true)
  assert.equal(isPausedDay('2026-07-06', pauses), false)
  assert.equal(isPausedDay('2026-07-06', []), false)
})

test('isPausedDay/pauseForDay — rozpoznaje pauzę zaplanowaną w przyszłości', () => {
  // Kalendarz nawyków pokazuje wyjazd już przed terminem, więc logika pauzy
  // musi działać dla dat przyszłych (czysty test zakresu — bez „dziś").
  const future = [{ from: '2099-12-24', to: '2099-12-31', reason: 'vacation' }]
  assert.equal(isPausedDay('2099-12-27', future), true)
  assert.equal(isPausedDay('2099-12-23', future), false)
  assert.equal(pauseForDay('2099-12-27', future)?.reason, 'vacation')
})

// ---------- isHabitDue ----------
test('isHabitDue — przed startem i po końcu', () => {
  const h = { frequencyDays: DAILY, startDate: '2026-07-05', endDate: '2026-07-10' }
  assert.equal(isHabitDue(h, '2026-07-04'), 'before-start')
  assert.equal(isHabitDue(h, '2026-07-11'), 'after-end')
})

test('isHabitDue — due w dniu harmonogramu, off poza nim', () => {
  const h = { frequencyDays: WEEKDAYS }
  assert.equal(isHabitDue(h, '2026-07-06'), 'due')   // poniedziałek
  assert.equal(isHabitDue(h, '2026-07-05'), 'off')   // niedziela
})

test('isHabitDue — pauza nadpisuje harmonogram (każdy nawyk dodatkowy)', () => {
  const h = { frequencyDays: DAILY }
  const pauses = [{ from: '2026-07-06', to: '2026-07-06' }]
  assert.equal(isHabitDue(h, '2026-07-06', pauses), 'paused')
})

// ---------- getStreak ----------
test('getStreak — brak wykonań to 0', () => {
  assert.equal(getStreak([], DAILY, [], null, TODAY), 0)
  assert.equal(getStreak(undefined, DAILY, [], null, TODAY), 0)
})

test('getStreak — codzienny: kolejne dni się liczą', () => {
  assert.equal(getStreak(['2026-07-06', '2026-07-05'], DAILY, [], null, TODAY), 2)
})

test('getStreak — dziś jeszcze nierobione nie przerywa serii (grace)', () => {
  // dziś (pon) nie zrobione, ale wczoraj i przedwczoraj tak
  assert.equal(getStreak(['2026-07-05', '2026-07-04'], DAILY, [], null, TODAY), 2)
})

test('getStreak — pominięty dzień OBOWIĄZKOWY przerywa serię', () => {
  // codzienny: brak 07-05 przerywa
  assert.equal(getStreak(['2026-07-06', '2026-07-04'], DAILY, [], null, TODAY), 1)
})

test('getStreak — weekend poza harmonogramem nie przerywa serii', () => {
  // nawyk na dni robocze; pon zrobiony, pt zrobiony, weekend pominięty (off)
  assert.equal(getStreak(['2026-07-06', '2026-07-03'], WEEKDAYS, [], null, TODAY), 2)
})

test('getStreak — dodatkowe wykonanie w dzień poza harmonogramem DOLICZA się do serii', () => {
  // nawyk na dni robocze, ale zrobiony też w sobotę i niedzielę (bonus)
  const done = ['2026-07-06', '2026-07-05', '2026-07-04', '2026-07-03']
  assert.equal(getStreak(done, WEEKDAYS, [], null, TODAY), 4)
})

test('getStreak — pauza nie przerywa serii, a wykonanie w pauzie doliczy bonus', () => {
  const pauses = [{ from: '2026-07-04', to: '2026-07-05' }]
  // codzienny: 07-06 i 07-03 zrobione, 04-05 w pauzie (pominięte, nie przerywają)
  assert.equal(getStreak(['2026-07-06', '2026-07-03'], DAILY, pauses, null, TODAY), 2)
  // dodatkowe wykonanie w pauzie (07-05) też się liczy
  assert.equal(getStreak(['2026-07-06', '2026-07-05', '2026-07-03'], DAILY, pauses, null, TODAY), 3)
})

test('getStreak — nie liczy dni sprzed startDate', () => {
  assert.equal(getStreak(['2026-07-06', '2026-07-05'], DAILY, [], '2026-07-06', TODAY), 1)
})

// ---------- getBestStreak ----------
test('getBestStreak — brak wykonań to 0', () => {
  assert.equal(getBestStreak([], DAILY, [], null, TODAY), 0)
})

test('getBestStreak — najdłuższy nieprzerwany ciąg (codzienny)', () => {
  const done = ['2026-07-01', '2026-07-02', '2026-07-03'] // po nich luka
  assert.equal(getBestStreak(done, DAILY, [], null, TODAY), 3)
})

test('getBestStreak — weekend (off) łączy ciąg tygodni roboczych', () => {
  // pełny tydzień roboczy 29.06–03.07, weekend pominięty nie zeruje
  const done = ['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03']
  assert.equal(getBestStreak(done, WEEKDAYS, [], null, TODAY), 5)
})

// ---------- checklist (kroki nawyku) ----------
test('toggleStepDone — dodaje i zdejmuje krok bez mutacji wejścia', () => {
  const before = ['a']
  const plus = toggleStepDone(before, 'b')
  assert.deepEqual(plus, ['a', 'b'])
  assert.deepEqual(before, ['a'])
  assert.deepEqual(toggleStepDone(plus, 'a'), ['b'])
  assert.deepEqual(toggleStepDone(undefined, 'x'), ['x'])
})

test('isChecklistComplete — komplet kroków zalicza, pusta checklista nie', () => {
  const checklist = [{ id: 'a', title: 'Krok A' }, { id: 'b', title: 'Krok B' }]
  assert.equal(isChecklistComplete(checklist, ['a']), false)
  assert.equal(isChecklistComplete(checklist, ['a', 'b']), true)
  assert.equal(isChecklistComplete(checklist, ['b', 'a', 'c']), true)
  assert.equal(isChecklistComplete([], []), false)
  assert.equal(isChecklistComplete(undefined, undefined), false)
})

// ---------- pauzy (kolory / powody) ----------
test('pauseReasonMeta — zwraca powód po id, „inne" jako fallback', () => {
  assert.equal(pauseReasonMeta('vacation').label, 'Wyjazd')
  assert.equal(pauseReasonMeta('illness').label, 'Choroba')
  assert.equal(pauseReasonMeta('nieznane').id, 'other')
  PAUSE_REASONS.forEach(r => assert.match(r.color, /^#[0-9A-Fa-f]{6}$/))
})

test('pauseForDay — zwraca pauzę obejmującą dzień albo null', () => {
  const pauses = [{ from: '2026-07-04', to: '2026-07-06', reason: 'illness' }]
  assert.equal(pauseForDay('2026-07-05', pauses)?.reason, 'illness')
  assert.equal(pauseForDay('2026-07-03', pauses), null)
  assert.equal(pauseForDay('2026-07-05', []), null)
})

// ---------- byHabitOrder ----------
test('byHabitOrder — sortuje wg order, brak order na koniec, remis wg createdAt', () => {
  const a = { id: 'a', order: 2 }
  const b = { id: 'b', order: 0 }
  const c = { id: 'c' } // brak order
  const d = { id: 'd', order: 0, createdAt: { seconds: 50 } }
  const e = { id: 'e', order: 0, createdAt: { seconds: 10 } }
  assert.deepEqual([a, b, c].sort(byHabitOrder).map(x => x.id), ['b', 'a', 'c'])
  assert.deepEqual([d, e].sort(byHabitOrder).map(x => x.id), ['e', 'd'])
})

// ---------- eachDayStr ----------
test('eachDayStr — lista dni włącznie z krańcami', () => {
  assert.deepEqual(eachDayStr('2026-07-04', '2026-07-06'), ['2026-07-04', '2026-07-05', '2026-07-06'])
  assert.deepEqual(eachDayStr('2026-07-06', '2026-07-06'), ['2026-07-06'])
  assert.deepEqual(eachDayStr('2026-07-07', '2026-07-06'), [])
})

// ---------- rangeStats ----------
test('rangeStats — liczy expected/done/pct dla nawyku codziennego', () => {
  // codzienny, zrobiony 2 z 3 dni
  const h = { frequencyDays: DAILY, completedDates: ['2026-07-04', '2026-07-06'] }
  const s = rangeStats([h], [], '2026-07-04', '2026-07-06')
  assert.equal(s.expected, 3)
  assert.equal(s.done, 2)
  assert.equal(s.pct, 67)
  assert.equal(s.completions, 2)
})

test('rangeStats — dni 100% tylko gdy wszystkie obowiązkowe zrobione', () => {
  const h1 = { frequencyDays: DAILY, completedDates: ['2026-07-04', '2026-07-05'] }
  const h2 = { frequencyDays: DAILY, completedDates: ['2026-07-04'] }
  const s = rangeStats([h1, h2], [], '2026-07-04', '2026-07-05')
  // 04: oba zrobione → 100%; 05: tylko h1 → nie
  assert.equal(s.perfectDays, 1)
  assert.equal(s.dueDays, 2)
})

test('rangeStats — wykonanie w pauzie (wyjazd) liczy się jako zrobione i podbija procent', () => {
  const pauses = [{ from: '2026-07-05', to: '2026-07-05', reason: 'vacation' }]
  const h = { frequencyDays: DAILY, completedDates: ['2026-07-05'] }
  const s = rangeStats([h], pauses, '2026-07-05', '2026-07-05')
  assert.equal(s.expected, 1)    // wykonane w wyjeździe wchodzi do bilansu
  assert.equal(s.done, 1)
  assert.equal(s.completions, 1)
  assert.equal(s.pct, 100)
})

test('rangeStats — pauza bez wykonania nie jest karą (pomijana)', () => {
  const pauses = [{ from: '2026-07-05', to: '2026-07-05', reason: 'illness' }]
  const h = { frequencyDays: DAILY, completedDates: [] }
  const s = rangeStats([h], pauses, '2026-07-05', '2026-07-05')
  assert.equal(s.expected, 0)
  assert.equal(s.done, 0)
  assert.equal(s.pct, 0)
})

test('rangeStats — pusty zakres nawyków to zera', () => {
  const s = rangeStats([], [], '2026-07-04', '2026-07-06')
  assert.deepEqual(s, { expected: 0, done: 0, completions: 0, perfectDays: 0, dueDays: 0, pct: 0 })
})

// ── habitDayKind — wspólny język stanów dnia (w tym „zrobione mimo wyjazdu") ──

test('habitDayKind — zrobione w trakcie wyjazdu ma własny stan', () => {
  const habit = { completedDates: ['2026-08-27'], frequencyDays: [0,1,2,3,4,5,6] }
  const pauses = [{ from: '2026-08-25', to: '2026-08-29', reason: 'vacation' }]
  assert.equal(habitDayKind({ habit, dateStr: '2026-08-27', pauses, today: '2026-08-31' }), 'done-paused')
  // ten sam nawyk, ten sam dzień, ale bez pauzy → zwykłe „zrobione"
  assert.equal(habitDayKind({ habit, dateStr: '2026-08-27', pauses: [], today: '2026-08-31' }), 'done')
})

test('habitDayKind — dzień przerwy bez wykonania to nie pominięcie', () => {
  const habit = { completedDates: [], frequencyDays: [0,1,2,3,4,5,6] }
  const pauses = [{ from: '2026-08-25', to: '2026-08-29', reason: 'illness' }]
  assert.equal(habitDayKind({ habit, dateStr: '2026-08-27', pauses, today: '2026-08-31' }), 'paused')
  assert.equal(habitDayKind({ habit, dateStr: '2026-08-30', pauses, today: '2026-08-31' }), 'missed')
})

test('habitDayKind — zrobione poza planem to bonus', () => {
  // nawyk tylko w poniedziałki (1); 2026-08-27 to czwartek
  const habit = { completedDates: ['2026-08-27'], frequencyDays: [1] }
  assert.equal(habitDayKind({ habit, dateStr: '2026-08-27', pauses: [], today: '2026-08-31' }), 'done-bonus')
})

test('habitDayKind — przyszłość, w tym zaplanowany wyjazd', () => {
  const habit = { completedDates: [], frequencyDays: [0,1,2,3,4,5,6] }
  const pauses = [{ from: '2026-09-10', to: '2026-09-14', reason: 'vacation' }]
  assert.equal(habitDayKind({ habit, dateStr: '2026-09-12', pauses, today: '2026-08-31' }), 'future-paused')
  assert.equal(habitDayKind({ habit, dateStr: '2026-09-20', pauses, today: '2026-08-31' }), 'future')
})

test('habitDayKind — isDone można podać z zewnątrz', () => {
  const habit = { completedDates: [], frequencyDays: [0,1,2,3,4,5,6] }
  assert.equal(habitDayKind({ habit, dateStr: '2026-08-27', pauses: [], today: '2026-08-31', isDone: true }), 'done')
})

test('isDoneKind — wszystkie warianty zrobionego', () => {
  assert.ok(isDoneKind('done'))
  assert.ok(isDoneKind('done-paused'))
  assert.ok(isDoneKind('done-bonus'))
  assert.ok(!isDoneKind('paused'))
  assert.ok(!isDoneKind('missed'))
})

// ── Wymagane vs dodatkowe: podstawa dnia i nadprogramowa robota ──────────────

test('isRequiredHabit — brak pola znaczy wymagany', () => {
  assert.ok(isRequiredHabit({}))
  assert.ok(isRequiredHabit({ optional: false }))
  assert.ok(!isRequiredHabit({ optional: true }))
})

test('dayScore — mianownik to tylko wymagane na dziś', () => {
  const every = [0,1,2,3,4,5,6]
  const habits = [
    { name: 'a', frequencyDays: every },                    // wymagany, niezrobiony
    { name: 'b', frequencyDays: every, completedDates: ['2026-08-29'] },
    { name: 'c', frequencyDays: every, optional: true },    // dodatkowy — poza celem
    { name: 'd', frequencyDays: [3] },                      // nie wypada dziś (sobota)
  ]
  const s = dayScore(habits, '2026-08-29', [])
  assert.equal(s.required, 2, 'tylko wymagane wypadające dziś')
  assert.equal(s.doneRequired, 1)
  assert.equal(s.doneTotal, 1)
})

test('dayScore — nadprogramowe podbijają licznik ponad cel (11 z 8)', () => {
  const every = [0,1,2,3,4,5,6]
  const day = '2026-08-29'
  const habits = []
  for (let i = 0; i < 8; i++) habits.push({ frequencyDays: every, completedDates: [day] })
  // trzy dodatkowe, poza celem, też zrobione
  for (let i = 0; i < 3; i++) habits.push({ frequencyDays: every, optional: true, completedDates: [day] })
  const s = dayScore(habits, day, [])
  assert.equal(s.required, 8)
  assert.equal(s.doneTotal, 11, 'licznik ma pokazać 11 przy celu 8')
  assert.equal(s.extra, 3)
  assert.equal(s.pct, 100, 'pasek nie przekracza pełna')
})

test('dayScore — nawyk zrobiony poza harmonogramem liczy się na plus', () => {
  const habits = [
    { frequencyDays: [1], completedDates: ['2026-08-29'] }, // sobota, plan na poniedziałek
    { frequencyDays: [0,1,2,3,4,5,6] },                     // wymagany, niezrobiony
  ]
  const s = dayScore(habits, '2026-08-29', [])
  assert.equal(s.required, 1)
  assert.equal(s.doneRequired, 0)
  assert.equal(s.doneTotal, 1)
  assert.equal(s.extra, 1)
})

test('dayScore — dzień bez wymaganych', () => {
  // doneExact to surowa suma postepow (nawyki na czas wnosza ulamki); doneTotal
  // jest ta sama liczba zaokraglona do pol jednostki pod licznik w UI.
  assert.deepEqual(dayScore([], '2026-08-29', []),
    { required: 0, doneRequired: 0, doneTotal: 0, doneExact: 0, extra: 0, pct: 0 })
  // nic nie było wymagane, ale coś zrobione → pełny pasek, nie dzielenie przez zero
  const s = dayScore([{ frequencyDays: [1], completedDates: ['2026-08-29'] }], '2026-08-29', [])
  assert.equal(s.pct, 100)
})

test('dayScore — przerwa zdejmuje wymagania, ale robota nadal się liczy', () => {
  const every = [0,1,2,3,4,5,6]
  const pauses = [{ from: '2026-08-28', to: '2026-08-30', reason: 'vacation' }]
  const habits = [
    { frequencyDays: every, completedDates: ['2026-08-29'] },
    { frequencyDays: every },
  ]
  const s = dayScore(habits, '2026-08-29', pauses)
  assert.equal(s.required, 0, 'w przerwie nic nie jest wymagane')
  assert.equal(s.doneTotal, 1, 'ale zrobione nadal widać')
})

test('habitLifecycle: nawyk ze startem w przyszłości jest „zaplanowany"', () => {
  const today = '2026-09-01'
  assert.equal(habitLifecycle({ startDate: '2026-09-08' }, today), 'planned')
  assert.equal(habitLifecycle({ startDate: '2026-09-01' }, today), 'active')
  assert.equal(habitLifecycle({ startDate: '2026-08-01' }, today), 'active')
  assert.equal(habitLifecycle({}, today), 'active')
})

test('habitLifecycle: koniec i archiwum', () => {
  const today = '2026-09-01'
  assert.equal(habitLifecycle({ endDate: '2026-08-31' }, today), 'ended')
  assert.equal(habitLifecycle({ endDate: '2026-09-01' }, today), 'active')
  // Archiwum wygrywa z datami — inaczej zarchiwizowany nawyk gubiłby się w „zakończonych".
  assert.equal(habitLifecycle({ archived: true, startDate: '2026-09-08' }, today), 'archived')
  assert.equal(habitLifecycle({ archived: true, endDate: '2026-08-31' }, today), 'archived')
})

test('habitCompletionSummary: ukończony nawyk ma swój wynik do pokazania', () => {
  const habit = {
    frequencyDays: [0, 1, 2, 3, 4, 5, 6],
    startDate: '2026-08-01',
    endDate: '2026-08-05',
    completedDates: ['2026-08-02', '2026-08-03', '2026-08-04', '2026-08-01'],
  }
  const s = habitCompletionSummary(habit)
  assert.equal(s.total, 4)
  assert.equal(s.first, '2026-08-01', 'pierwszy dzień liczymy z posortowanych dat')
  assert.equal(s.last, '2026-08-04')
  // Rekord liczymy do daty zakończenia, nie do dziś — inaczej dni po końcu
  // nawyku zerowałyby serię i zakończony nawyk wyglądałby na porażkę.
  assert.equal(s.best, 4)
})

test('habitCompletionSummary: nawyk bez odhaczeń nie wybucha', () => {
  const s = habitCompletionSummary({ startDate: '2026-08-01', endDate: '2026-08-05' })
  assert.equal(s.total, 0)
  assert.equal(s.best, 0)
  assert.equal(s.last, null)
  assert.equal(s.first, '2026-08-01', 'bez odhaczeń zostaje data startu')
})

// ---------- wyzwania (nawyki dodatkowe) ----------
// Wyzwanie to cel poboczny: nie wchodzi do celu dnia ani do procentow okresu,
// nie ma serii. Liczy sie wylacznie to, ile razy sie udalo.

test('isOptionalHabit: tylko jawna flaga czyni wyzwanie', () => {
  assert.ok(isOptionalHabit({ optional: true }))
  assert.ok(!isOptionalHabit({ optional: false }))
  // Brak pola = zwykly nawyk wymagany, inaczej stare nawyki zmienilyby rodzaj.
  assert.ok(!isOptionalHabit({}))
  assert.ok(!isOptionalHabit(undefined))
})

test('optionalProgress: liczy odhaczenia w okresie i w calej historii', () => {
  const h = { completedDates: ['2026-08-30', '2026-09-02', '2026-09-20', '2026-10-01'] }
  const p = optionalProgress(h, '2026-09-01', '2026-09-30')
  assert.equal(p.inRange, 2, 'tylko wrzesien')
  assert.equal(p.total, 4)
  assert.equal(p.first, '2026-08-30', 'pierwsze odhaczenie bez wzgledu na okres')
  assert.equal(p.last, '2026-10-01', 'ostatnie odhaczenie bez wzgledu na okres')
})

test('optionalProgress: granice okresu sa domkniete z obu stron', () => {
  const h = { completedDates: ['2026-09-01', '2026-09-30'] }
  assert.equal(optionalProgress(h, '2026-09-01', '2026-09-30').inRange, 2)
})

test('optionalProgress: bez okresu liczy wszystko, bez odhaczen nie wybucha', () => {
  assert.equal(optionalProgress({ completedDates: ['2026-09-02'] }).inRange, 1)
  const puste = optionalProgress({}, '2026-09-01', '2026-09-30')
  assert.deepEqual(puste, { inRange: 0, total: 0, first: null, last: null })
})

test('optionalProgress: nie sortuje w miejscu daty wejsciowej', () => {
  // Komponent dostaje habit z Firestore i renderuje go dalej — mutacja tablicy
  // pod spodem zmienialaby kolejnosc danych poza ta funkcja.
  const dates = ['2026-09-20', '2026-09-02']
  optionalProgress({ completedDates: dates }, '2026-09-01', '2026-09-30')
  assert.deepEqual(dates, ['2026-09-20', '2026-09-02'])
})

test('optionalSummary: zbiera wyzwania i liczy, ile w ogole ruszylo', () => {
  const habits = [
    { completedDates: ['2026-09-03', '2026-09-10'] },
    { completedDates: ['2026-09-04'] },
    { completedDates: [] },
    { completedDates: ['2026-08-01'] },           // poza okresem — nie ruszylo
  ]
  const s = optionalSummary(habits, '2026-09-01', '2026-09-30')
  assert.equal(s.done, 3, 'suma odhaczen w okresie')
  assert.equal(s.active, 2, 'ile wyzwan ma w okresie choc jedno odhaczenie')
  assert.equal(s.count, 4)
})

test('optionalSummary: brak wyzwan daje zera, nie NaN', () => {
  assert.deepEqual(optionalSummary([], '2026-09-01', '2026-09-30'),
    { done: 0, active: 0, count: 0, bestDay: null })
})

test('optionalSummary: najlepszy dzien zamiast serii', () => {
  const habits = [
    { completedDates: ['2026-09-03', '2026-09-10'] },
    { completedDates: ['2026-09-10'] },
    { completedDates: ['2026-09-10'] },
  ]
  const s = optionalSummary(habits, '2026-09-01', '2026-09-30')
  assert.deepEqual(s.bestDay, { date: '2026-09-10', count: 3 })
})

test('optionalSummary: najlepszy dzien tylko z okresu', () => {
  // Mocny dzien z sierpnia nie moze wygrac we wrzesniowym podsumowaniu.
  const habits = [
    { completedDates: ['2026-08-15', '2026-09-04'] },
    { completedDates: ['2026-08-15'] },
    { completedDates: ['2026-08-15'] },
  ]
  const s = optionalSummary(habits, '2026-09-01', '2026-09-30')
  assert.deepEqual(s.bestDay, { date: '2026-09-04', count: 1 })
})

test('optionalSummary: remis idzie do dnia wczesniejszego, zawsze tak samo', () => {
  const habits = [{ completedDates: ['2026-09-20'] }, { completedDates: ['2026-09-04'] }]
  const s = optionalSummary(habits, '2026-09-01', '2026-09-30')
  assert.deepEqual(s.bestDay, { date: '2026-09-04', count: 1 })
})

test('wyzwanie nie wchodzi do celu dnia, ale widac je jako nadwyzke', () => {
  const every = [0, 1, 2, 3, 4, 5, 6]
  const day = '2026-09-02'
  const habits = [
    { frequencyDays: every, completedDates: [day] },
    { frequencyDays: every, completedDates: [] },
    { frequencyDays: every, optional: true, completedDates: [day] },
  ]
  const s = dayScore(habits, day)
  assert.equal(s.required, 2, 'wyzwanie nie podbija mianownika')
  assert.equal(s.doneRequired, 1)
  assert.equal(s.doneTotal, 2, 'licznik widzi takze zrobione wyzwanie')
  assert.equal(s.extra, 1, 'nadwyzka = zrobione wyzwanie')
})

test('optionalDayCount: liczy wyzwania zaliczone danego dnia', () => {
  const habits = [
    { completedDates: ['2026-09-02', '2026-09-03'] },
    { completedDates: ['2026-09-02'] },
    { completedDates: [] },
  ]
  assert.equal(optionalDayCount(habits, '2026-09-02'), 2)
  assert.equal(optionalDayCount(habits, '2026-09-03'), 1)
  assert.equal(optionalDayCount(habits, '2026-09-04'), 0)
})

test('optionalDayCount: pusta lista i brak pola nie wybuchaja', () => {
  assert.equal(optionalDayCount([], '2026-09-02'), 0)
  assert.equal(optionalDayCount([{}, undefined], '2026-09-02'), 0)
})

// ---------- kolejnosc: nawyki i wyzwania osobno ----------

test('habitOrderUpdates: wyzwania numeruja sie PO nawykach', () => {
  const req = [{ id: 'a' }, { id: 'b' }]
  const opt = [{ id: 'x' }, { id: 'y' }]
  assert.deepEqual(habitOrderUpdates(req, opt), [
    { id: 'a', order: 0 }, { id: 'b', order: 1 },
    { id: 'x', order: 2 }, { id: 'y', order: 3 },
  ])
})

test('habitOrderUpdates: numery sa rozlaczne, zadna grupa nie nadpisuje drugiej', () => {
  // Gdyby kazda zakladka numerowala sie od zera, przestawienie wyzwan
  // zmienialoby kolejnosc nawykow.
  const u = habitOrderUpdates([{ id: 'a' }], [{ id: 'x' }])
  const numery = u.map(x => x.order)
  assert.equal(new Set(numery).size, numery.length)
})

test('habitOrderUpdates: puste grupy nie wybuchaja', () => {
  assert.deepEqual(habitOrderUpdates([], []), [])
  assert.deepEqual(habitOrderUpdates([{ id: 'a' }], []), [{ id: 'a', order: 0 }])
  assert.deepEqual(habitOrderUpdates([], [{ id: 'x' }]), [{ id: 'x', order: 0 }])
  assert.deepEqual(habitOrderUpdates(), [])
})

// ---------- nawyki na czas i na ilosc ----------
// Czesc rzeczy mierzy sie czasem albo liczba (20 min medytacji, 30 stron).
// Polowa normy ma sie liczyc jako polowa dnia, zamiast przepadac.

test('hasAmountGoal: decyduje target, brak = zwykle odhaczanie', () => {
  assert.ok(hasAmountGoal({ target: 20 }))
  assert.ok(!hasAmountGoal({}))
  assert.ok(!hasAmountGoal({ target: 0 }))
  assert.ok(!hasAmountGoal({ target: null }))
  assert.ok(!hasAmountGoal(undefined))
})

test('dayAmount: czyta amounts, a dla odhaczanego daje 1 albo 0', () => {
  const czas = { target: 20, unit: 'min', amounts: { '2026-10-01': 15 } }
  assert.equal(dayAmount(czas, '2026-10-01'), 15)
  assert.equal(dayAmount(czas, '2026-10-02'), 0)
  // Nawyk bez celu — reszta kodu nie musi rozrozniac tych dwoch swiatow.
  const zwykly = { completedDates: ['2026-10-01'] }
  assert.equal(dayAmount(zwykly, '2026-10-01'), 1)
  assert.equal(dayAmount(zwykly, '2026-10-02'), 0)
})

test('dayAmount: smieci w danych traktujemy jak zero', () => {
  const h = { target: 20, amounts: { a: 'duzo', b: -5, c: null, d: NaN } }
  for (const k of ['a', 'b', 'c', 'd']) assert.equal(dayAmount(h, k), 0)
})

test('dayProgress: polowa normy to polowa dnia', () => {
  const h = { target: 20, unit: 'min', amounts: { '2026-10-01': 10 } }
  assert.equal(dayProgress(h, '2026-10-01'), 0.5)
})

test('dayProgress: nadwyzka ucieta na 1, zeby nie podbijala sredniej', () => {
  const h = { target: 20, amounts: { '2026-10-01': 60 } }
  assert.equal(dayProgress(h, '2026-10-01'), 1)
})

test('dayProgress: nawyk bez celu dziala jak dotad', () => {
  const h = { completedDates: ['2026-10-01'] }
  assert.equal(dayProgress(h, '2026-10-01'), 1)
  assert.equal(dayProgress(h, '2026-10-02'), 0)
})

test('isDayComplete: zaliczony tylko cel dowieziony do konca', () => {
  const h = { target: 20, amounts: { '2026-10-01': 19, '2026-10-02': 20, '2026-10-03': 25 } }
  assert.ok(!isDayComplete(h, '2026-10-01'), '19 z 20 to jeszcze nie zaliczone')
  assert.ok(isDayComplete(h, '2026-10-02'))
  assert.ok(isDayComplete(h, '2026-10-03'))
})

test('dayScore: nawyk na czas wnosi ulamek dnia', () => {
  const every = [0, 1, 2, 3, 4, 5, 6]
  const d = '2026-10-01'
  const habits = [
    { frequencyDays: every, completedDates: [d] },                          // 1
    { frequencyDays: every, target: 20, unit: 'min', amounts: { [d]: 10 } }, // 0,5
    { frequencyDays: every, completedDates: [] },                           // 0
  ]
  const s = dayScore(habits, d)
  assert.equal(s.required, 3)
  assert.equal(s.doneTotal, 1.5, 'polowa normy liczy sie jako pol dnia')
  assert.equal(s.pct, 50)
})

test('dayScore: licznik zaokraglony do pol jednostki, surowa suma w doneExact', () => {
  const every = [0, 1, 2, 3, 4, 5, 6]
  const d = '2026-10-01'
  // 1/3 normy — "0,33 z 1" czytaloby sie zle na pasku.
  const habits = [{ frequencyDays: every, target: 30, amounts: { [d]: 10 } }]
  const s = dayScore(habits, d)
  assert.equal(s.doneTotal, 0.5)
  assert.ok(Math.abs(s.doneExact - 1 / 3) < 1e-9)
  assert.equal(s.pct, 33)
})

test('rangeStats: czesciowe wykonanie podnosi procent, ale nie licznik udanych dni', () => {
  const every = [0, 1, 2, 3, 4, 5, 6]
  const h = { frequencyDays: every, startDate: '2026-10-01', target: 20, unit: 'min',
    amounts: { '2026-10-01': 20, '2026-10-02': 10 } }
  const r = rangeStats([h], [], '2026-10-01', '2026-10-02')
  assert.equal(r.expected, 2)
  assert.equal(r.done, 1.5, 'pelny dzien + pol dnia')
  assert.equal(r.pct, 75)
  assert.equal(r.completions, 1, 'tylko jeden dzien dowieziony do konca')
})

test('rangeStats: dzien perfekcyjny wymaga calej normy', () => {
  const every = [0, 1, 2, 3, 4, 5, 6]
  const h = { frequencyDays: every, startDate: '2026-10-01', target: 20,
    amounts: { '2026-10-01': 10 } }
  assert.equal(rangeStats([h], [], '2026-10-01', '2026-10-01').perfectDays, 0)
  const pelny = { ...h, amounts: { '2026-10-01': 20 } }
  assert.equal(rangeStats([pelny], [], '2026-10-01', '2026-10-01').perfectDays, 1)
})

test('formatAmount: czas rozbija sie na godziny i minuty', () => {
  // "485 min" nic nie mowi, "8 h 5 min" mowi wszystko.
  assert.equal(formatAmount(485, 'min'), '8 h 5 min')
  assert.equal(formatAmount(60, 'min'), '1 h')
  assert.equal(formatAmount(45, 'min'), '45 min')
  assert.equal(formatAmount(0, 'min'), '0 min')
})

test('formatAmount: pozostale jednostki to liczba i skrot bez odmiany', () => {
  assert.equal(formatAmount(30, 'str'), '30 str.')
  assert.equal(formatAmount(1, 'str'), '1 str.')
  assert.equal(formatAmount(2.5, 'l'), '2.5 l')
  // Wlasna jednostka przechodzi bez zmian.
  assert.equal(formatAmount(7, 'kubki'), '7 kubki')
})

test('unitMeta: nieznana jednostka nie wybucha, wraca jako wlasna', () => {
  assert.equal(unitMeta('min').time, true)
  assert.equal(unitMeta('kubki').short, 'kubki')
  assert.ok(HABIT_UNITS.every(u => u.id && u.label && u.short))
})

test('amountTotals: sumuje wykonanie w okresie, jednostek nie miesza', () => {
  const habits = [
    { target: 20, unit: 'min', amounts: { '2026-10-01': 20, '2026-10-02': 30, '2026-09-30': 99 } },
    { target: 10, unit: 'min', amounts: { '2026-10-01': 15 } },
    { target: 30, unit: 'str', amounts: { '2026-10-01': 40 } },
    { completedDates: ['2026-10-01'] },  // bez celu — nie wchodzi do sum
  ]
  const t = amountTotals(habits, '2026-10-01', '2026-10-31')
  const minuty = t.find(x => x.unit === 'min')
  const strony = t.find(x => x.unit === 'str')
  assert.equal(minuty.total, 65, 'wrzesien poza okresem')
  assert.equal(minuty.label, '1 h 5 min')
  assert.equal(strony.total, 40)
  assert.equal(t.length, 2, 'nawyk bez celu nie tworzy trzeciej jednostki')
})

test('amountTotals: bez danych zwraca pusta liste', () => {
  assert.deepEqual(amountTotals([], '2026-10-01', '2026-10-31'), [])
  assert.deepEqual(amountTotals([{ completedDates: ['2026-10-01'] }], '2026-10-01', '2026-10-31'), [])
})

test('amountShortLabel: jednostka pada raz, pusty dzien pokazuje sam cel', () => {
  // "0 min / 5 min" rozpychalo kontrolke tak, ze nazwa nawyku zostawala
  // przycieta do "Czas...".
  assert.equal(amountShortLabel(0, 5, 'min'), '5 min')
  assert.equal(amountShortLabel(2, 5, 'min'), '2/5 min')
  assert.equal(amountShortLabel(5, 5, 'min'), '5 min')
  assert.equal(amountShortLabel(7, 5, 'min'), '7/5 min', 'nadwyzke widac wzgledem celu')
  assert.equal(amountShortLabel(10, 30, 'str'), '10/30 str.')
})

test('amountShortLabel: smieci i brak celu nie wybuchaja', () => {
  assert.equal(amountShortLabel(undefined, undefined, 'min'), '0 min')
  assert.equal(amountShortLabel(null, 20, 'min'), '20 min')
  assert.equal(amountShortLabel(5, 0, 'szt'), '5 szt.')
})

// ---------- zamkniecie rozdzialu ("zacznij od nowa") ----------

test('freshStartSummary: zbiera dorobek z calej historii', () => {
  const every = [0, 1, 2, 3, 4, 5, 6]
  const habits = [
    { name: 'A', frequencyDays: every, startDate: '2026-01-01',
      completedDates: ['2026-01-01', '2026-01-02', '2026-01-03'] },
    { name: 'B', frequencyDays: every, startDate: '2026-02-01',
      completedDates: ['2026-02-10'] },
  ]
  const s = freshStartSummary(habits)
  assert.equal(s.count, 2)
  assert.equal(s.completions, 4, 'suma wszystkich odhaczen')
  assert.equal(s.best, 3, 'najdluzszy ciag z calego zbioru')
  assert.equal(s.from, '2026-01-01', 'najstarsze odhaczenie')
  assert.equal(s.to, '2026-02-10', 'najnowsze odhaczenie')
})

test('freshStartSummary: dolacza sumy czasu i ilosci', () => {
  const habits = [
    { name: 'Medytacja', target: 20, unit: 'min', amounts: { '2026-01-01': 20, '2026-01-02': 45 } },
    { name: 'Czytanie', target: 10, unit: 'str', amounts: { '2026-01-01': 30 } },
  ]
  const s = freshStartSummary(habits)
  const min = s.totals.find(t => t.unit === 'min')
  assert.equal(min.label, '1 h 5 min')
  assert.equal(s.totals.length, 2, 'jednostek nie mieszamy')
})

test('freshStartSummary: pusto i smieci nie wybuchaja', () => {
  const pusty = freshStartSummary([])
  assert.equal(pusty.count, 0)
  assert.equal(pusty.completions, 0)
  assert.equal(pusty.best, 0)
  assert.equal(pusty.from, null)
  assert.deepEqual(pusty.totals, [])
  assert.equal(freshStartSummary([null, undefined]).count, 0)
  assert.equal(freshStartSummary().count, 0)
})

test('freshStartSummary: nawyk bez odhaczen nie psuje granic okresu', () => {
  const habits = [
    { name: 'A', completedDates: ['2026-03-01'] },
    { name: 'B', startDate: '2020-01-01', completedDates: [] },
  ]
  const s = freshStartSummary(habits)
  // Granice biora sie z ODHACZEN — nawyk, ktorego nigdy nie zrobiono, nie moze
  // cofac poczatku historii o szesc lat.
  assert.equal(s.from, '2026-03-01')
  assert.equal(s.to, '2026-03-01')
})

// ---------- wyzwanie nie istnieje przed swoim startem ----------
// Logika wyzwan nie znala startDate, wiec kalendarz rysowal caly miesiac, a
// tydzien wchodzil w poprzedni: wyzwanie zalozone w pazdzierniku pokazywalo
// wrzesien tak, jakby bylo wtedy pomijane.

test('isOptionalActiveOn: przed startem wyzwania jeszcze nie bylo', () => {
  const h = { startDate: '2026-10-01' }
  assert.ok(!isOptionalActiveOn(h, '2026-09-30'), 'wrzesien jest przed startem')
  assert.ok(isOptionalActiveOn(h, '2026-10-01'), 'dzien startu juz sie liczy')
  assert.ok(isOptionalActiveOn(h, '2026-10-15'))
})

test('isOptionalActiveOn: po dacie konca wyzwania juz nie ma', () => {
  const h = { startDate: '2026-10-01', endDate: '2026-10-31' }
  assert.ok(isOptionalActiveOn(h, '2026-10-31'), 'dzien konca to jeszcze ostatni dzien')
  assert.ok(!isOptionalActiveOn(h, '2026-11-01'))
})

test('isOptionalActiveOn: bez dat wyzwanie istnieje zawsze', () => {
  assert.ok(isOptionalActiveOn({}, '2026-10-01'))
  assert.ok(!isOptionalActiveOn({}, null), 'bez daty nie ma czego sprawdzac')
})

test('optionalDayCount: dzien przed startem nie liczy sie wcale', () => {
  const habits = [
    { startDate: '2026-10-01', completedDates: ['2026-09-20', '2026-10-02'] },
  ]
  // Odhaczenie sprzed startu (np. po zmianie daty) nie moze wracac na wykres.
  assert.equal(optionalDayCount(habits, '2026-09-20'), 0)
  assert.equal(optionalDayCount(habits, '2026-10-02'), 1)
})

test('optionalDayScore: mianownik to wyzwania, ktore tego dnia istnialy', () => {
  const habits = [
    { startDate: '2026-10-01', completedDates: ['2026-10-02'] },
    { startDate: '2026-10-01', completedDates: [] },
    { startDate: '2026-11-01', completedDates: [] },   // jeszcze nie istnieje
  ]
  const s = optionalDayScore(habits, '2026-10-02')
  assert.equal(s.total, 2, 'listopadowe wyzwanie nie wchodzi do pazdziernika')
  assert.equal(s.done, 1)
  assert.equal(s.pct, 50)
})

test('optionalDayScore: wyzwanie na czas zalicza sie dopiero po calym celu', () => {
  const habits = [{ startDate: '2026-10-01', target: 20, unit: 'min', amounts: { '2026-10-02': 10 } }]
  assert.equal(optionalDayScore(habits, '2026-10-02').done, 0, 'polowa normy to jeszcze nie zaliczone')
  const pelne = [{ startDate: '2026-10-01', target: 20, amounts: { '2026-10-02': 20 } }]
  assert.equal(optionalDayScore(pelne, '2026-10-02').done, 1)
})

test('optionalDayScore: dzien bez zadnych wyzwan daje zera, nie NaN', () => {
  const s = optionalDayScore([{ startDate: '2026-11-01' }], '2026-10-02')
  assert.deepEqual(s, { total: 0, done: 0, pct: 0 })
  assert.deepEqual(optionalDayScore([], '2026-10-02'), { total: 0, done: 0, pct: 0 })
})

// ---------- jeden przycisk zamiast trzech ----------
// "-", pasek i "+" zjadaly tyle miejsca, ze nazwy nawykow zostawaly jako
// "Czas z B..." i "Psychol...".

test('amountStep: do pelna zawsze okolo czterech klikniec', () => {
  assert.equal(amountStep(20), 5)
  assert.equal(amountStep(60), 15, 'staly skok 5 znaczylby dwanascie klikniec')
  assert.equal(amountStep(4), 1)
  assert.equal(amountStep(1), 1, 'skok nie moze byc zerowy')
  assert.equal(amountStep(0), 1)
  assert.equal(amountStep(undefined), 1)
})

test('nextAmount: dokłada skok az do celu', () => {
  assert.equal(nextAmount(0, 20), 5)
  assert.equal(nextAmount(5, 20), 10)
  assert.equal(nextAmount(15, 20), 20)
})

test('nextAmount: nie zatrzymuje sie na celu — robote ponad norme da sie zapisac', () => {
  // Wczesniej klik po osiagnieciu celu zerowal dzien, wiec nadwyzki nie dalo
  // sie wbic inaczej niz recznie.
  assert.equal(nextAmount(20, 20), 25)
  assert.equal(nextAmount(25, 20), 30)
})

test('nextAmount: pierwszy klik dociaga do pelnego celu, nie przeskakuje', () => {
  // Cel 10, skok 3 (round(10/4)=3): 0-3-6-9-10, nie 12.
  assert.equal(amountStep(10), 3)
  assert.equal(nextAmount(9, 10), 10)
  // Dopiero od pelnej normy skok jest pelny.
  assert.equal(nextAmount(10, 10), 13)
})

test('nextAmount: brak celu i smieci nie wybuchaja', () => {
  assert.equal(nextAmount(5, 0), 6, 'bez celu skok wynosi 1')
  assert.equal(nextAmount(undefined, 20), 5)
  assert.equal(nextAmount(null, null), 1)
})

test('amountStep: minuty chodza w piatkach, nie po jednej', () => {
  // Cel 10 minut dawal skok 3 (round(10/4)) i klikanie minuta po minucie.
  assert.equal(amountStep(10, 'min'), 5)
  assert.equal(amountStep(4, 'min'), 5, 'mala norma tez nie schodzi pod 5 minut')
  assert.equal(amountStep(20, 'min'), 5)
  assert.equal(amountStep(60, 'min'), 15, 'przy duzym celu nadal okolo czterech klikniec')
  assert.equal(amountStep(90, 'min'), 25, 'skok zostaje wielokrotnoscia piatki')
  assert.equal(amountStep(0, 'min'), 5)
})

test('amountStep: pozostale jednostki licza sie po staremu', () => {
  assert.equal(amountStep(10, 'str'), 3)
  assert.equal(amountStep(4, 'szt'), 1)
})

test('nextAmount: nawyk na minuty dokłada piatki', () => {
  assert.equal(nextAmount(0, 20, 'min'), 5)
  assert.equal(nextAmount(5, 20, 'min'), 10)
  // Pierwszy klik nadal dociaga do pelnej normy, zamiast ja przeskakiwac.
  assert.equal(nextAmount(18, 20, 'min'), 20)
  // A ponad norme idzie pelnym skokiem.
  assert.equal(nextAmount(20, 20, 'min'), 25)
  // Cel 10 minut: dwa kliki do pelna, zamiast czterech po trzy minuty.
  assert.equal(nextAmount(0, 10, 'min'), 5)
  assert.equal(nextAmount(5, 10, 'min'), 10)
})

// ---------- zaliczenie dnia przelicza sie z wpisanych liczb ----------
// `completedDates` zapisuje sie w chwili klikania, wiec po PODNIESIENIU celu
// kalendarz w statystykach swiecil dzien jako zrobiony, choc przy nowej normie
// zrobiony nie byl.

test('isDayComplete: po zmianie celu liczy sie wpisana liczba, nie stare odhaczenie', () => {
  // 15 minut bylo calym celem, gdy cel wynosil 15 — po podniesieniu do 30 to
  // dopiero polowa.
  const habit = { target: 30, unit: 'min', amounts: { '2026-10-02': 15 }, completedDates: ['2026-10-02'] }
  assert.equal(isDayComplete(habit, '2026-10-02'), false)
  assert.equal(dayProgress(habit, '2026-10-02'), 0.5)
  // Obnizenie celu dziala tak samo — dzien zalicza sie sam, bez przeklikiwania.
  const nizszy = { target: 10, unit: 'min', amounts: { '2026-10-02': 15 }, completedDates: [] }
  assert.equal(isDayComplete(nizszy, '2026-10-02'), true)
})

test('isDayComplete: dzien bez wpisanej liczby zostaje przy starym odhaczeniu', () => {
  // Nawyk dostal cel liczbowy POZNIEJ: dni odhaczone wczesniej nie maja zadnej
  // liczby i nie moga sie przez to wyzerowac.
  const habit = { target: 20, unit: 'min', amounts: {}, completedDates: ['2026-09-01'] }
  assert.equal(isDayComplete(habit, '2026-09-01'), true)
  assert.equal(dayProgress(habit, '2026-09-01'), 1)
  assert.equal(isDayComplete(habit, '2026-09-02'), false)
})

test('habitDoneDates: lista zaliczonych dni liczy sie z amounts', () => {
  const habit = {
    target: 20, unit: 'min',
    amounts: { '2026-10-01': 20, '2026-10-02': 5, '2026-10-03': 45 },
    completedDates: ['2026-10-01', '2026-10-02', '2026-09-30'],
  }
  // 2026-10-02 wypada (5 z 20), 2026-10-03 wchodzi mimo braku odhaczenia,
  // a 2026-09-30 zostaje — nie ma tam wpisanej liczby.
  assert.deepEqual(habitDoneDates(habit), ['2026-09-30', '2026-10-01', '2026-10-03'])
})

test('habitDoneDates: nawyk bez celu to posortowane odhaczenia i nowa tablica', () => {
  const dates = ['2026-10-03', '2026-10-01']
  const habit = { completedDates: dates }
  assert.deepEqual(habitDoneDates(habit), ['2026-10-01', '2026-10-03'])
  assert.deepEqual(dates, ['2026-10-03', '2026-10-01'], 'nie sortujemy danych z bazy w miejscu')
  assert.deepEqual(habitDoneDates({}), [])
})

test('rangeStats: podniesiony cel odbiera zaliczenie staremu dniu', () => {
  const habit = {
    frequencyDays: [0, 1, 2, 3, 4, 5, 6], target: 30, unit: 'min',
    amounts: { '2026-10-01': 15, '2026-10-02': 30 },
    completedDates: ['2026-10-01', '2026-10-02'],
  }
  const s = rangeStats([habit], [], '2026-10-01', '2026-10-02')
  assert.equal(s.completions, 1, 'tylko dzien z pelna nowa norma')
  assert.equal(s.perfectDays, 1)
})

test('amountOver: liczy tylko to, co ponad norme', () => {
  assert.equal(amountOver(35, 20), 15)
  assert.equal(amountOver(20, 20), 0)
  assert.equal(amountOver(10, 20), 0, 'ujemna nadwyzka nie ma sensu')
  assert.equal(amountOver(undefined, 20), 0)
})

test('amountShortLabel: nadwyzke widac jako 35/20, nie samo 35', () => {
  // Samo "35 min" nie mowi, ze to wiecej, niz bylo trzeba.
  assert.equal(amountShortLabel(35, 20, 'min'), '35/20 min')
  assert.equal(amountShortLabel(20, 20, 'min'), '20 min')
})

// ---------- statystyki nawyku na czas / ilosc ----------

test('amountStats: sumuje okres i liczy dni z calym celem', () => {
  const h = { target: 20, unit: 'min', amounts: {
    '2026-10-01': 20, '2026-10-02': 10, '2026-10-03': 30, '2026-09-30': 99,
  } }
  const s = amountStats(h, '2026-10-01', '2026-10-31')
  assert.equal(s.total, 60, 'wrzesien poza okresem')
  assert.equal(s.days, 3)
  assert.equal(s.fullDays, 2, 'tylko 20 i 30 dowiozly cel')
  assert.equal(s.unit, 'min')
})

test('amountStats: srednia liczy sie z dni, w ktorych cos bylo', () => {
  // Zera z kalendarza zanizalyby ja tym bardziej, im rzadszy nawyk.
  const h = { target: 20, unit: 'min', amounts: { '2026-10-01': 30, '2026-10-05': 10 } }
  const s = amountStats(h, '2026-10-01', '2026-10-31')
  assert.equal(s.avg, 20, '(30+10)/2, a nie /31 dni miesiaca')
})

test('amountStats: najlepszy dzien, remis do wczesniejszego', () => {
  const h = { target: 10, amounts: { '2026-10-01': 25, '2026-10-09': 25, '2026-10-05': 10 } }
  assert.deepEqual(amountStats(h, '2026-10-01', '2026-10-31').best,
    { date: '2026-10-01', value: 25 })
})

test('amountStats: nawyk bez celu nie ma takich statystyk', () => {
  assert.equal(amountStats({ completedDates: ['2026-10-01'] }, '2026-10-01', '2026-10-31'), null)
})

test('amountStats: pusty okres i smieci nie wybuchaja', () => {
  const h = { target: 20, amounts: { '2026-10-01': 'duzo', '2026-10-02': -5, '2026-10-03': null } }
  const s = amountStats(h, '2026-10-01', '2026-10-31')
  assert.equal(s.total, 0)
  assert.equal(s.days, 0)
  assert.equal(s.avg, 0, 'zadnego dzielenia przez zero')
  assert.equal(s.best, null)
})

test('amountStats: nadwyzka ponad norme liczona osobno', () => {
  const h = { target: 20, unit: 'min', amounts: {
    '2026-10-01': 35, '2026-10-02': 20, '2026-10-03': 10, '2026-10-04': 50,
  } }
  const s = amountStats(h, '2026-10-01', '2026-10-31')
  assert.equal(s.over, 45, '15 ponad w pierwszym dniu i 30 w czwartym')
  assert.equal(s.overDays, 2, 'dokladnie rownie z celem to nie nadwyzka')
  assert.equal(s.total, 115, 'suma liczy calosc, takze nadwyzke')
})

// ---------- porzadek w "Ukonczone i archiwum" ----------

test('lastTrace: ostatni slad to pozniejsza z dwoch dat', () => {
  assert.equal(lastTrace({ endDate: '2026-09-30', completedDates: ['2026-10-05'] }), '2026-10-05')
  assert.equal(lastTrace({ endDate: '2026-10-20', completedDates: ['2026-10-05'] }), '2026-10-20')
  // Nawyk schowany do archiwum zwykle nie ma endDate.
  assert.equal(lastTrace({ completedDates: ['2026-10-05', '2026-01-01'] }), '2026-10-05')
  assert.equal(lastTrace({ endDate: '2026-10-20' }), '2026-10-20')
  assert.equal(lastTrace({}), null)
})

test('byRecentlyClosed: najswiezsze u gory', () => {
  const lista = [
    { name: 'Stary', completedDates: ['2025-01-01'] },
    { name: 'Nowy', completedDates: ['2026-10-01'] },
    { name: 'Sredni', endDate: '2026-05-01' },
  ].sort(byRecentlyClosed)
  assert.deepEqual(lista.map(h => h.name), ['Nowy', 'Sredni', 'Stary'])
})

test('byRecentlyClosed: bez sladu na koniec, remis alfabetycznie', () => {
  const lista = [
    { name: 'Bez sladu' },
    { name: 'Zebra', completedDates: ['2026-10-01'] },
    { name: 'Alfa', completedDates: ['2026-10-01'] },
  ].sort(byRecentlyClosed)
  assert.deepEqual(lista.map(h => h.name), ['Alfa', 'Zebra', 'Bez sladu'])
})

import { szybkieDodatki, liczbaZPola } from '../src/utils/habitLogic.js'

test('szybkieDodatki — czas: +5 +15 +30 +60 +2h', () => {
  assert.deepEqual(szybkieDodatki('min').map(x => x.label), ['+5', '+15', '+30', '+60', '+2h'])
  assert.equal(szybkieDodatki('min').at(-1).v, 120)
  assert.deepEqual(szybkieDodatki('km').map(x => x.v), [1, 5, 10])
  assert.deepEqual(szybkieDodatki('własna').map(x => x.v), [1, 5, 10])
})

test('liczbaZPola — puste pole to zero, bez wiodącego zera', () => {
  assert.equal(liczbaZPola(''), 0)
  assert.equal(liczbaZPola('045'), 45)
  assert.equal(liczbaZPola('2,5'), 2.5)
  assert.equal(liczbaZPola('abc'), 0)
  assert.equal(liczbaZPola('-3'), 0)
})
