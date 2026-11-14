// TRYB DEMO — losowe dane do przeklikania całej apki.
//
// Wszystko jest losowane przy każdym „Wylosuj nowe dane", ale celowo z domieszką
// przypadków brzegowych, które najczęściej rozjeżdżają UI: bardzo długie nazwy,
// kwoty 0,01 i sześciocyfrowe, wpisy bez konta, obce waluty, daty w przeszłości
// i przyszłości, puste notatki, zadania przeterminowane, nawyki z przerwą.

import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../utils/categories.js'
import { DREAM_EMOTIONS } from '../utils/dreamLogic.js'
import { BIBLE_BOOKS, chapterKey } from '../utils/bibleData.js'

// kopia DEFAULT_CATEGORIES z components/calendar/wspolne.jsx
const CAL_CATEGORIES = [
  { slug: 'work',     label: 'Praca',     icon: 'IcBriefcase', color: '#3b82f6' },
  { slug: 'home',     label: 'Dom',       icon: 'IcSofa',      color: '#10b981' },
  { slug: 'health',   label: 'Zdrowie',   icon: 'IconHeart',   color: '#ef4444' },
  { slug: 'birthday', label: 'Urodziny',  icon: 'IcCake',      color: '#f59e0b' },
  { slug: 'study',    label: 'Nauka',     icon: 'IcBookOpen',  color: '#8b5cf6' },
  { slug: 'sport',    label: 'Sport',     icon: 'IcDumbbell',  color: '#14b8a6' },
  { slug: 'family',   label: 'Rodzina',   icon: 'IcUsersGrp',  color: '#ec4899' },
  { slug: 'meeting',  label: 'Spotkania', icon: 'IcHandshake', color: '#6366f1' },
  { slug: 'travel',   label: 'Wyjazdy',   icon: 'IcPlane',     color: '#C94B28' },
  { slug: 'finance',  label: 'Finanse',   icon: 'IcWallet',    color: '#84cc16' },
  { slug: 'prayer',   label: 'Modlitwa',  icon: 'IcPray',      color: '#a78bfa' },
  { slug: 'other',    label: 'Inne',      icon: 'IconMore',    color: '#607D8B' },
]

const UID = 'demo-user'
const base = (c) => `users/${UID}/${c}`

// ── Losowanie ───────────────────────────────────────────────────────────────
const rnd = Math.random
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const chance = (p) => rnd() < p
const sample = (arr, n) => [...arr].sort(() => rnd() - 0.5).slice(0, Math.max(0, Math.min(n, arr.length)))
const money = (a, b) => Math.round((a + rnd() * (b - a)) * 100) / 100
let idc = 0
const id = (p) => `${p}-${(++idc).toString(36)}-${Math.random().toString(36).slice(2, 6)}`

// ── Daty ────────────────────────────────────────────────────────────────────
const DAY = 86400000
const today = new Date(); today.setHours(12, 0, 0, 0)
const daysAgo = (n) => new Date(today.getTime() - n * DAY)
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const isoAgo = (n) => iso(daysAgo(n))
const withTime = (d, h = int(7, 21), m = int(0, 59)) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x }

// ── Teksty ──────────────────────────────────────────────────────────────────
const LONG = 'Bardzo długi opis, żeby sprawdzić, czy tekst się ładnie zawija i nie rozpycha karty na telefonie — jeszcze trochę słów, i jeszcze, i jeszcze jedno zdanie na zapas'
const PEOPLE = [
  ['Mama', 'IcHearts', '#E8607A'], ['Tata', 'IcUser', '#3B82F6'], ['Ola', 'IcFlower', '#9B7CF0'],
  ['Kuba', 'IcGame', '#14B8A6'], ['Babcia Zosia', 'IcCandle', '#E0B15A'], ['Ks. Marek', 'IcChurch', '#C9A24A'],
  ['Magda z pracy', 'IcBriefcase', '#5BB6D9'], ['Bartłomiej Grzegorz Wiśniewski-Kowalczyk', 'IcUsers', '#D98B5F'],
]
const SHOPS = ['Biedronka', 'Lidl', 'Żabka', 'Rossmann', 'Allegro', 'Orlen', 'Zalando', 'IKEA', 'Apteka', 'Empik', 'Kaufland', '']

export function seedDemoData(put, Timestamp) {
  idc = 0
  const ts = (d) => Timestamp.fromDate(d)
  const created = (n = int(1, 200)) => ts(daysAgo(n))

  // ── Osoby ────────────────────────────────────────────────────────────────
  const people = PEOPLE.map(([name, icon, color], i) => {
    const pid = id('osoba')
    put(base('calendarPeople'), pid, {
      name, icon, color,
      note: i === 0 ? 'Urodziny w maju, lubi storczyki' : (chance(0.4) ? 'Notatka o osobie' : ''),
      info: i === 7 ? LONG : (chance(0.3) ? 'tel. 600 100 200' : ''),
      createdAt: created(300 - i), updatedAt: created(10),
    })
    return { id: pid, name, color }
  })

  // ── Finanse: konta ───────────────────────────────────────────────────────
  const accounts = [
    { name: 'mBank osobiste', type: 'bank', typeName: 'Konto bankowe', currency: 'PLN', color: '#33C3A6', balance: money(2500, 9000) },
    { name: 'Portfel', type: 'cash', typeName: 'Gotówka', currency: 'PLN', color: '#E0B15A', balance: money(40, 400) },
    { name: 'Revolut EUR', type: 'revolut', typeName: 'Revolut/Mobile', currency: 'EUR', color: '#5BB6D9', balance: money(50, 800) },
    { name: 'Konto oszczędnościowe z bardzo długą nazwą', type: 'savings', typeName: 'Oszczędności', currency: 'PLN', color: '#7C8AF0', balance: money(10000, 60000) },
    { name: 'XTB', type: 'investment', typeName: 'Inwestycje', currency: 'PLN', color: '#D98B5F', balance: money(8000, 20000), invested: money(7000, 15000) },
    { name: 'Karta kredytowa', type: 'card', typeName: 'Karta', currency: 'PLN', color: '#E05A2B', balance: -money(100, 1500) },
  ].map((a, i) => {
    const aid = id('konto')
    put(base('accounts'), aid, { ...a, order: i, createdAt: created(400) })
    return { id: aid, ...a }
  })
  const [bank, cash, eur, savings] = accounts

  // ── Finanse: transakcje (ok. 14 miesięcy) ────────────────────────────────
  const exp = DEFAULT_EXPENSE_CATEGORIES.filter(c => c.id !== 'dziesiecina' && c.id !== 'oszczednosci')
  const inc = DEFAULT_INCOME_CATEGORIES
  const tx = (o) => {
    const tid = id('tx')
    put(base('transactions'), tid, {
      subcategoryId: null, subcategoryLabel: null, subsubcategoryId: null, subsubcategoryLabel: null,
      tithe: false, createdAt: o.date, updatedAt: o.date, ...o,
    })
    return tid
  }
  const catFields = (c) => ({ category: c.label, categoryId: c.id, categoryIcon: c.icon })

  for (let back = 420; back >= 0; back--) {
    const d = daysAgo(back)
    // wypłata 10. dnia miesiąca
    if (d.getDate() === 10) {
      tx({ type: 'income', amount: money(6200, 7400), ...catFields(inc[0]), currency: 'PLN', description: 'Wypłata', date: ts(withTime(d, 9)), accountId: bank.id, tithe: true })
    }
    if (chance(0.06)) {
      const c = pick(inc.slice(1))
      tx({ type: 'income', amount: money(50, 2500), ...catFields(c), currency: 'PLN', description: chance(0.5) ? 'Zlecenie' : '', date: ts(withTime(d)), accountId: pick([bank.id, cash.id]), tithe: chance(0.5) })
    }
    // 0–4 wydatków dziennie
    const n = pick([0, 1, 1, 1, 2, 2, 3])
    for (let k = 0; k < n; k++) {
      const c = pick(exp)
      // Duże wydatki rzadko — inaczej rok wychodzi na kilkusetprocentowym minusie.
      const big = ['elektronika', 'wyjazdy', 'naprawy', 'auto'].includes(c.id) && chance(0.15)
      const acc = chance(0.08) ? null : pick([bank, bank, bank, cash, eur, accounts[5]])
      const currency = acc?.currency || 'PLN'
      const amount = big ? money(150, 3200) : money(4, 180)
      tx({
        type: 'expense', amount: currency === 'EUR' ? Math.round(amount / 4.3 * 100) / 100 : amount,
        ...catFields(c), currency,
        description: chance(0.02) ? LONG : (chance(0.7) ? pick(SHOPS) : ''),
        date: ts(withTime(d)), accountId: acc?.id ?? null,
      })
    }
    // przelew na oszczędności raz w miesiącu
    if (d.getDate() === 12) {
      const amt = money(300, 1200)
      const shared = { ...catFields({ id: 'transfer', label: 'Przelew', icon: 'IconTransfer' }), date: ts(withTime(d, 10)), tithe: false }
      tx({ ...shared, type: 'expense', amount: amt, currency: 'PLN', description: `→ ${savings.name}`, transferTo: savings.id, accountId: bank.id })
      tx({ ...shared, type: 'income', amount: amt, currency: 'PLN', description: `← ${bank.name}`, transferFrom: bank.id, accountId: savings.id })
    }
    // dziesięcina co miesiąc
    if (d.getDate() === 15 && back > 0) {
      tx({ type: 'expense', amount: money(600, 700), category: 'Dziesięcina', categoryId: 'dziesiecina', categoryIcon: 'IcCross', currency: 'PLN', description: 'Parafia', date: ts(withTime(d, 11)), accountId: bank.id })
    }
  }
  // przypadki brzegowe
  tx({ type: 'expense', amount: 0.01, ...catFields(exp[0]), currency: 'PLN', description: 'Grosik (test minimalnej kwoty)', date: ts(withTime(daysAgo(1))), accountId: cash.id })
  tx({ type: 'expense', amount: 12599.99, ...catFields(exp.find(c => c.id === 'dom')), currency: 'PLN', description: 'Wkład własny (test dużej kwoty)', date: ts(withTime(daysAgo(40))), accountId: savings.id })
  tx({ type: 'expense', amount: 23.5, category: 'Kategoria, której już nie ma', categoryId: 'usunieta-kategoria', categoryIcon: 'IconMore', currency: 'PLN', description: 'Stara kategoria (test)', date: ts(withTime(daysAgo(3))), accountId: bank.id })
  tx({ type: 'expense', amount: 59.99, ...catFields(exp.find(c => c.id === 'subskrypcje')), currency: 'USD', description: 'Wydatek w USD', date: ts(withTime(daysAgo(2))), accountId: null })
  tx({ type: 'expense', amount: 42, ...catFields(exp[1]), currency: 'PLN', description: 'Z importu', bankDescription: 'PLATNOSC KARTA 42,00 PLN KAWIARNIA SLOWIK WARSZAWA', source: 'import', importedFrom: 'wyciag.xlsx', date: ts(withTime(daysAgo(5))), accountId: bank.id })

  // ── Finanse: regularne płatności ─────────────────────────────────────────
  const thisMonth = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`
  ;[
    { type: 'expense', name: 'Czynsz', amount: 1850, cat: 'rachunki', frequency: 'monthly', dayOfMonth: 5, autoAdd: false, done: true },
    { type: 'expense', name: 'Netflix', amount: 49, cat: 'subskrypcje', frequency: 'monthly', dayOfMonth: 20, autoAdd: false },
    { type: 'expense', name: 'Siłownia', amount: 139, cat: 'sport', frequency: 'monthly', dayOfMonth: 1, autoAdd: false },
    { type: 'expense', name: 'Ubezpieczenie auta', amount: 1240, cat: 'auto', frequency: 'yearly', dayOfMonth: 14, autoAdd: false },
    { type: 'expense', name: 'Kieszonkowe', amount: 50, cat: 'inne', frequency: 'weekly', dayOfMonth: 1, autoAdd: false },
    { type: 'income', name: 'Wynajem pokoju', amount: 1100, cat: 'wynajem', frequency: 'monthly', dayOfMonth: 28, autoAdd: false },
  ].forEach(p => {
    const c = [...exp, ...inc].find(x => x.id === p.cat) || exp[0]
    put(base('regularPayments'), id('stala'), {
      type: p.type, name: p.name, amount: p.amount,
      category: c.label, categoryId: c.id, categoryIcon: c.icon,
      subcategoryId: null, subcategoryLabel: null,
      frequency: p.frequency, dayOfMonth: p.dayOfMonth, accountId: bank.id, autoAdd: p.autoAdd,
      dateFrom: null, dateTo: null, donePeriods: p.done ? [thisMonth] : [],
      createdAt: created(200), updatedAt: created(20),
    })
  })

  // ── Finanse: dłużnicy, cele, zakupy, dziesięcina ─────────────────────────
  ;[
    { name: 'Kuba', direction: 'theyOwe', amount: 120, notes: 'Pizza', settled: false },
    { name: 'Ola', direction: 'iOwe', amount: 45.5, notes: '', settled: false },
    { name: 'Magda z pracy', direction: 'theyOwe', amount: 300, notes: 'Bilety na koncert', settled: true },
    { name: 'Bartłomiej Grzegorz Wiśniewski-Kowalczyk', direction: 'theyOwe', amount: 15000, notes: LONG, settled: false },
  ].forEach(d => put(base('debtors'), id('dlug'), { ...d, createdAt: created(60), updatedAt: created(5) }))

  ;[
    { name: 'Wakacje w Grecji', color: '#5BB6D9', noTarget: false, targetAmount: 8000, currentAmount: money(1000, 6000), notes: '' },
    { name: 'Poduszka finansowa', color: '#33C3A6', noTarget: false, targetAmount: 30000, currentAmount: 30000, notes: 'Cel osiągnięty' },
    { name: 'Skarbonka bez celu', color: '#E0B15A', noTarget: true, targetAmount: 0, currentAmount: money(50, 900), notes: '' },
  ].forEach(g => put(base('savingsGoals'), id('cel'), { ...g, createdAt: created(90), updatedAt: created(3) }))

  ;['Mleko', 'Chleb', 'Proszek do prania', 'Prezent dla Mamy', 'Bateria AA', 'Bardzo długa nazwa produktu do kupienia w sklepie budowlanym na weekend', 'Kawa ziarnista', 'Szampon']
    .forEach((name, i) => {
      const c = pick(exp)
      put(base('shoppingItems'), id('zakup'), {
        name, category: c.id, note: i === 3 ? 'coś ładnego' : '',
        estimatedPrice: chance(0.7) ? money(3, 120) : 0,
        status: i < 2 ? 'bought' : 'planned', createdAt: created(int(0, 20)),
      })
    })

  // Podkategorie (jedna z własnym kolorem), żeby było co edytować i kolorować.
  const PODKAT = {
    jedzenie: [{ id: 'sub_sklep', label: 'Sklep', icon: 'IcBasket', color: null }, { id: 'sub_dowoz', label: 'Dowóz', icon: 'IcTruck', color: '#5BB6D9' }, { id: 'sub_slodycze', label: 'Słodycze', icon: 'IcCandy', color: null }],
    auto: [{ id: 'sub_serwis', label: 'Serwis', icon: 'IcTools', color: null, subcategories: [{ id: 'ss_opony', label: 'Opony', icon: 'IcCar' }] }, { id: 'sub_parking', label: 'Parking', icon: 'IcParking', color: null }],
  }
  put(base('settings'), 'categories', {
    expense: DEFAULT_EXPENSE_CATEGORIES.map(c => PODKAT[c.id] ? { ...c, subcategories: PODKAT[c.id] } : c),
    income: DEFAULT_INCOME_CATEGORIES,
  })
  for (let i = 0; i < 30; i++) {
    const catId = pick(['jedzenie', 'auto'])
    const c = exp.find(x => x.id === catId)
    const sub = pick(PODKAT[catId])
    tx({ type: 'expense', amount: money(8, 160), ...catFields(c), subcategoryId: sub.id, subcategoryLabel: sub.label, currency: 'PLN', description: '', date: ts(withTime(daysAgo(int(0, 60)))), accountId: bank.id })
  }

  put(base('settings'), 'tithe', { enabled: true, percent: 10, carryOver: money(-50, 150) })

  // ── Nawyki ───────────────────────────────────────────────────────────────
  const habitCats = [['Zdrowie', '#5FBF98', 'IcHeartbeat'], ['Duchowość', '#C9A24A', 'IcPray'], ['Rozwój', '#7C8AF0', 'IcBookOpen']]
    .map(([name, color, icon]) => { const hid = id('kat'); put(base('habitCategories'), hid, { name, color, icon, createdAt: created(100) }); return hid })
  const routines = ['Rano', 'Po pracy', 'Wieczór']
    .map((name, order) => { const rid = id('rutyna'); put(base('habitRoutines'), rid, { name, order, createdAt: created(100) }); return rid })

  const habitDefs = [
    { name: 'Modlitwa poranna', emoji: 'IcPray', color: '#C9A24A', category: habitCats[1], routineId: routines[0], p: 0.9 },
    { name: 'Woda', emoji: 'IcGlassWater', color: '#5BB6D9', category: habitCats[0], routineId: routines[0], p: 0.8, target: 8, unit: 'szklanki' },
    { name: 'Spacer', emoji: 'IcWalk', color: '#5FBF98', category: habitCats[0], routineId: routines[1], p: 0.6, target: 30, unit: 'min' },
    { name: 'Czytanie', emoji: 'IcBookOpen', color: '#7C8AF0', category: habitCats[2], routineId: routines[2], p: 0.5, frequency: 'weekdays' },
    { name: 'Siłownia', emoji: 'IcDumbbell', color: '#E05A2B', category: habitCats[0], routineId: routines[1], p: 0.7, frequency: 'custom', frequencyDays: [1, 3, 5] },
    { name: 'Rachunek sumienia', emoji: 'IcCandle', color: '#9B7CF0', category: habitCats[1], routineId: routines[2], p: 0.55,
      checklist: [{ id: 'k1', title: 'Podziękowanie' }, { id: 'k2', title: 'Przejrzenie dnia' }, { id: 'k3', title: 'Postanowienie' }] },
    { name: 'Bez telefonu przed snem (opcjonalny)', emoji: 'IcPhoneDev', color: '#94A3B8', category: habitCats[2], routineId: null, p: 0.3, optional: true },
    { name: 'Nawyk z bardzo długą nazwą, który powinien się zawinąć w dwóch liniach', emoji: 'IcTarget', color: '#D98B5F', category: null, routineId: null, p: 0.4 },
    { name: 'Nowy nawyk (od dziś)', emoji: 'IcSprout', color: '#84CC16', category: habitCats[0], routineId: routines[0], p: 0, start: 0 },
    { name: 'Stary nawyk (archiwum)', emoji: 'IcHourglass', color: '#64748B', category: habitCats[2], routineId: null, p: 0.5, archived: true, end: 30 },
  ]
  const FREQ = { daily: [0, 1, 2, 3, 4, 5, 6], weekdays: [1, 2, 3, 4, 5], weekend: [0, 6] }
  habitDefs.forEach(h => {
    const frequency = h.frequency || 'daily'
    const frequencyDays = h.frequencyDays || FREQ[frequency]
    const startBack = h.start ?? int(60, 160)
    const completedDates = [], amounts = {}, checklistDone = {}
    for (let b = startBack; b >= (h.end ?? 0); b--) {
      const d = daysAgo(b)
      if (!frequencyDays.includes(d.getDay())) continue
      if (b >= 20 && b <= 26) continue // przerwa (urlop) — patrz habitPauses
      if (!chance(b === 0 ? h.p * 0.6 : h.p)) {
        if (h.checklist && chance(0.4)) checklistDone[iso(d)] = [h.checklist[0].id]
        continue
      }
      completedDates.push(iso(d))
      if (h.target) amounts[iso(d)] = chance(0.75) ? h.target + int(0, 3) : int(1, h.target - 1)
      if (h.checklist) checklistDone[iso(d)] = h.checklist.map(s => s.id)
    }
    put(base('habits'), id('nawyk'), {
      name: h.name, emoji: h.emoji, color: h.color, category: h.category, frequency, frequencyDays,
      optional: !!h.optional, target: h.target ?? null, unit: h.unit ?? null,
      startDate: isoAgo(startBack), endDate: h.end ? isoAgo(h.end) : null,
      checklist: h.checklist || [], routineId: h.routineId,
      completedDates: completedDates.filter(d => !h.target || amounts[d] >= h.target), amounts, checklistDone,
      archived: !!h.archived, createdAt: created(startBack), updatedAt: created(1),
    })
  })
  put(base('habitPauses'), id('pauza'), { from: isoAgo(26), to: isoAgo(20), reason: 'vacation', reasonLabel: 'Wyjazd', reasonIcon: 'IcPlane', reasonColor: '#1E3A8A', createdAt: created(27) })
  put(base('habitPauses'), id('pauza'), { from: isoAgo(70), to: isoAgo(68), reason: 'illness', reasonLabel: 'Choroba', reasonIcon: 'IcThermo', reasonColor: '#DC2626', createdAt: created(70) })

  // ── To-do ────────────────────────────────────────────────────────────────
  const lists = [['Praca', 'IcBriefcase', '#5BB6D9'], ['Dom', 'IcSofa', '#5FBF98'], ['Zakupy i sprawy', 'IcShoppingBag', '#E0B15A']]
    .map(([name, icon, color]) => { const lid = id('lista'); put(base('todoLists'), lid, { name, icon, color, createdAt: created(120) }); return lid })
  const TODOS = ['Zadzwonić do lekarza', 'Opłacić rachunek za prąd', 'Wysłać raport', 'Umyć okna', 'Odebrać paczkę', 'Kupić prezent na urodziny', 'Zrobić przegląd auta',
    'Przygotować prezentację', 'Napisać maila do szefa', 'Posprzątać piwnicę', 'Oddać książki do biblioteki', 'Zapisać się na kurs', 'Wymienić żarówkę', LONG,
    'Podlać kwiaty', 'Zaplanować wakacje', 'Zrobić zakupy na weekend', 'Odnowić dowód', 'Zadzwonić do Babci', 'Uporządkować zdjęcia']
  TODOS.forEach((title, i) => {
    const done = chance(0.3)
    const due = pick([null, -10, -3, -1, 0, 0, 0, 1, 2, 5, 14, 40])
    put(base('todos'), id('zadanie'), {
      title, note: chance(0.3) ? 'Notatka do zadania' : '',
      listId: chance(0.15) ? null : pick(lists), priority: pick(['high', 'medium', 'low']),
      dueDate: due === null ? null : isoAgo(-due),
      recurrence: i === 14 ? 'weekly' : i === 18 ? 'monthly' : null,
      subtasks: chance(0.3) ? [{ id: 's1', title: 'Pierwszy krok', done: true }, { id: 's2', title: 'Drugi krok', done: false }, { id: 's3', title: 'Trzeci krok', done: false }] : [],
      peopleIds: chance(0.2) ? [pick(people).id] : [],
      done, doneAt: done ? created(int(0, 10)) : null, starred: !done && chance(0.2),
      createdAt: created(int(1, 60)), updatedAt: created(1),
    })
  })

  // ── Kalendarz ────────────────────────────────────────────────────────────
  const calCats = CAL_CATEGORIES.map(({ slug, ...c }, i) => {
    const cid = id(`kal-${slug}`)
    put(base('calendarCategories'), cid, { ...c, createdAt: Timestamp.fromMillis(Date.now() - 1e9 + i * 10) })
    return { id: cid, ...c }
  })
  put(base('settings'), 'calendar', { seededCategories: true })
  const EVENTS = ['Spotkanie zespołu', 'Dentysta', 'Kolacja u rodziców', 'Trening', 'Webinar', 'Msza', 'Kino', 'Wizyta u fryzjera', 'Przegląd auta', 'Wyjazd służbowy', 'Imieniny', 'Zebranie wspólnoty']
  for (let i = 0; i < 40; i++) {
    const cat = pick(calCats)
    const person = chance(0.25) ? pick(people) : null
    const d = daysAgo(int(-45, 45))
    const allDay = chance(0.3)
    const sh = int(7, 19)
    const multi = chance(0.08)
    put(base('calendarEvents'), id('wyd'), {
      title: i === 0 ? LONG : pick(EVENTS), date: iso(d),
      dateEnd: multi ? iso(new Date(d.getTime() + int(1, 4) * DAY)) : null,
      startTime: allDay ? null : `${pad(sh)}:${pick(['00', '15', '30', '45'])}`,
      endTime: allDay || chance(0.4) ? null : `${pad(sh + int(1, 2))}:00`,
      note: chance(0.3) ? 'Pamiętać o dokumentach' : '',
      categoryId: cat.id, categoryIcon: cat.icon, color: person?.color || cat.color,
      personId: person?.id || null, personName: person?.name || null,
      who: chance(0.1) ? 'Ania, Piotrek' : null,
      recurrence: null, recurUntil: null, prayer: null,
      createdAt: created(50), updatedAt: created(2),
    })
  }
  // wydarzenia cykliczne + dzisiejsze
  const bday = calCats.find(c => c.label === 'Urodziny') || calCats[0]
  const sport = calCats.find(c => c.label === 'Sport') || calCats[0]
  const recurring = [
    { title: 'Urodziny Mamy', date: iso(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())), recurrence: 'yearly', cat: bday, person: people[0] },
    { title: 'Urodziny Kuby', date: iso(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 3)), recurrence: 'yearly', cat: bday, person: people[3] },
    { title: 'Basen', date: isoAgo(60), recurrence: 'weekly', cat: sport, startTime: '18:00', endTime: '19:00' },
    { title: 'Spotkanie dziś', date: iso(today), recurrence: null, cat: calCats[0], startTime: '16:30', endTime: '17:30' },
  ]
  recurring.forEach(e => put(base('calendarEvents'), id('wyd'), {
    title: e.title, date: e.date, dateEnd: null, startTime: e.startTime || null, endTime: e.endTime || null,
    note: '', categoryId: e.cat.id, categoryIcon: e.cat.icon, color: e.person?.color || e.cat.color,
    personId: e.person?.id || null, personName: e.person?.name || null, who: null,
    recurrence: e.recurrence, recurUntil: null, prayer: null, createdAt: created(100), updatedAt: created(5),
  }))

  // ── Modlitwa ─────────────────────────────────────────────────────────────
  const INTENTIONS = ['O zdrowie dla Babci', 'Za egzamin Kuby', 'O pokój w rodzinie', 'O dobrą pracę dla Oli', 'Za zmarłego Dziadka', 'O mądrość w decyzjach',
    'Dziękczynienie za rok', 'Za parafię', 'O nawrócenie', 'Za przyjaciół z liceum', 'Intencja o bardzo długim tytule, który testuje zawijanie tekstu w karcie prośby', 'Za chorych']
  INTENTIONS.forEach((title, i) => {
    const ended = i >= 9
    const prayedDates = [...new Set(Array.from({ length: int(0, 40) }, () => isoAgo(int(0, 90))))].sort()
    const listMode = i === 2
    const checklist = listMode ? [{ id: 'c1', text: 'Mama' }, { id: 'c2', text: 'Tata' }, { id: 'c3', text: 'Rodzeństwo' }] : []
    put(base('prayerIntentions'), id('prosba'), {
      title, noteMode: listMode ? 'list' : 'text', note: listMode ? '' : (chance(0.5) ? 'Szczegóły intencji' : ''),
      checklist, checklistDone: listMode ? ['c1'] : [],
      personId: chance(0.5) ? pick(people).id : null,
      priority: int(1, 5), dateTo: i === 1 ? isoAgo(-7) : (i === 5 ? isoAgo(3) : null),
      tags: sample(['rodzina', 'zdrowie', 'praca', 'wdzięczność'], int(0, 2)),
      status: ended ? 'ended' : 'active', endedAt: ended ? created(int(1, 30)) : null,
      prayedDates,
      notes: chance(0.4) ? [{ id: 'n1', text: 'Jest lepiej, dzięki Bogu', date: isoAgo(5) }, { id: 'n2', text: 'Rozmawiałam dziś', date: isoAgo(20) }] : [],
      createdAt: created(int(30, 200)), updatedAt: created(1),
    })
  })

  // ── Biblia ───────────────────────────────────────────────────────────────
  const counts = {}
  const readBooks = sample(BIBLE_BOOKS, 12)
  readBooks.forEach((b, i) => {
    const upto = i < 4 ? b.chapters : int(1, b.chapters)
    for (let c = 1; c <= upto; c++) counts[chapterKey(b.id, c)] = chance(0.1) ? 2 : 1
  })
  put(base('bible'), 'progress', { counts, notes: { [chapterKey(readBooks[0].id, 1)]: 'Piękny fragment' }, startDate: isoAgo(120), updatedAt: Timestamp.now() })
  ;[['J', 3, 16, null, 'Tak Bóg umiłował świat…'], ['Ps', 23, 1, 4, 'Pan jest moim pasterzem'], ['Rz', 8, 28, null, LONG], ['Mt', 5, null, null, 'Błogosławieństwa — cały rozdział']]
    .forEach(([bookName, chapter, verse, verseEnd, text], i) => {
      const book = BIBLE_BOOKS.find(b => b.id.toLowerCase() === bookName.toLowerCase())?.id || BIBLE_BOOKS[i].id
      put(base('bibleNotes'), id('werset'), { book, chapter, verse, verseEnd, text, number: i + 1, createdAt: created(40 - i), updatedAt: created(5) })
    })

  // ── Sen ──────────────────────────────────────────────────────────────────
  const symbols = [['Woda', '#5BB6D9'], ['Dom z dzieciństwa', '#D98B5F'], ['Lot', '#7C8AF0'], ['Pies', '#E0B15A'], ['Szkoła', '#9B7CF0'], ['Pociąg', '#64748B']]
    .map(([name, color], i) => { const sid = id('symbol'); put(base('dreamSymbols'), sid, { name, color, ...(i === 0 ? { meaning: 'Oczyszczenie, ale też emocje, które mnie zalewają.' } : {}), createdAt: created(100) }); return sid })
  ;['Salon', 'Kuchnia', 'Sypialnia'].forEach((room, i) =>
    put(base('dreamMemory'), id('cwicz'), { date: isoAgo(i), room, details: ['okno', 'zasłony w kratę', 'lampa', 'fotel', 'dywan'], createdAt: created(i) }))
  const customDreamCat = id('senkat')
  put(base('dreamCategories'), customDreamCat, { label: 'Powracający', color: '#14B8A6', createdAt: created(100) })
  const DREAMS = ['Lot nad miastem', 'Egzamin bez przygotowania', 'Spotkanie z Babcią', 'Zgubiona walizka', 'Dom nad morzem', 'Spóźniony pociąg', 'Pies, który mówił', '']
  for (let i = 0; i < 18; i++) {
    put(base('dreams'), id('sen'), {
      title: i === 0 ? 'Sen o bardzo długim tytule, który powinien się zawinąć na karcie' : pick(DREAMS),
      date: isoAgo(int(0, 120)),
      text: chance(0.2) ? LONG + '. ' + LONG : 'Byłam w miejscu, które znałam, ale wszystko było trochę inne.',
      interpretation: chance(0.4) ? 'Może chodzi o stres w pracy.' : '',
      category: pick([null, 'zwykly', 'przyjemny', 'koszmar', 'proroczy', customDreamCat]),
      emotions: sample(DREAM_EMOTIONS.map(e => e.id), int(0, 3)),
      peopleIds: chance(0.4) ? sample(people.map(p => p.id), int(1, 2)) : [],
      mentionIds: [],
      symbolIds: sample(symbols, int(0, 3)),
      createdAt: created(int(0, 120)), updatedAt: created(1),
    })
  }

  // ── Wdzięcznik ───────────────────────────────────────────────────────────
  const THANKS = ['Słońce rano', 'Dobra kawa', 'Rozmowa z Mamą', 'Spokojny wieczór', 'Udany trening', 'Pomoc koleżanki', 'Msza', 'Smaczny obiad', 'Spacer z psem', 'Zdrowie', LONG]
  for (let b = 0; b < 45; b++) {
    if (chance(0.3)) continue
    for (let k = 0; k < int(1, 3); k++) put(base('gratitude'), id('dzieki'), { date: isoAgo(b), text: pick(THANKS), createdAt: ts(withTime(daysAgo(b))) })
  }

  // ── Nastrój ──────────────────────────────────────────────────────────────
  const MOODS = [['awful', 'okropny', 1, '#E05A2B'], ['bad', 'źle', 2, '#F59E0B'], ['ok', 'ok', 3, '#94A3B8'], ['good', 'dobrze', 4, '#5FBF98'], ['great', 'świetnie', 5, '#3B82F6']]
  const MOOD_PEOPLE = people.slice(0, 4).map(p => p.id)
  const EMO = ['spokój', 'wdzięczność', 'radość', 'ciekawość', 'miłość', 'nadzieja', 'zmęczenie', 'frustracja', 'lęk', 'smutek']
  for (let b = 0; b < 60; b++) {
    if (chance(0.35)) continue
    const [mood, moodLabel, moodValue, moodColor] = pick([MOODS[1], MOODS[2], MOODS[3], MOODS[3], MOODS[4], chance(0.2) ? MOODS[0] : MOODS[2]])
    put(base('moodLogs'), id('nastroj'), {
      date: isoAgo(b), time: b === 0 ? '08:15' : null, mood, moodValue, moodLabel, moodColor,
      emotions: sample(EMO, int(0, 3)),
      factors: sample(['dom', 'praca', 'studia', 'kościół', 'spotkanie', 'sport', 'natura'], int(0, 3)),
      peopleIds: chance(0.4) ? sample(MOOD_PEOPLE, int(1, 2)) : [],
      ratings: Object.fromEntries(sample(['energia', 'spokój', 'relacje'], int(0, 3)).map(k => [k, int(1, 5)])),
      note: chance(0.3) ? 'Dzień jak co dzień' : '', createdAt: ts(withTime(daysAgo(b))),
    })
  }

  // Sen: noce i drzemki; cykl: cztery okresy co ~29 dni; okres życia do statystyk
  const hm = (m) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`
  for (let b = 0; b < 40; b++) {
    if (chance(0.2)) continue
    const start = 22 * 60 + int(0, 150), minutes = int(300, 540)
    put(base('sleepLogs'), id('sen'), { date: isoAgo(b), type: 'night', start: hm(start), end: hm(start + minutes), minutes, wakeups: int(0, 3), quality: int(2, 5), createdAt: ts(daysAgo(b)) })
    if (chance(0.2)) put(base('sleepLogs'), id('drzemka'), { date: isoAgo(b), type: 'nap', start: '14:10', end: '14:40', minutes: 30, wakeups: 0, quality: null, createdAt: ts(daysAgo(b)) })
  }
  ;[96, 67, 39, 10].forEach(b => put(base('cycleLogs'), id('cykl'), { start: isoAgo(b), end: isoAgo(b - 4), createdAt: ts(daysAgo(b)) }))
  put(base('settings'), 'mood', { emotions: [], factors: [{ id: 'egzamin', label: 'egzamin', color: '#E6C04A' }], ratingCats: [],
    okresy: [{ id: 'o1', label: 'sesja', color: '#5FBF98', from: isoAgo(30), to: isoAgo(18) }] })

  // ── Auto: gaz do pełna co ~400 km, benzyna rzadko; naprawy; terminy ─────
  let licznik = 148200
  for (let b = 84; b >= 0; b -= 7) {
    const km = int(340, 460); licznik += km
    const litry = Math.round(km * (9.2 + rnd() * 1.6)) / 100, cenaLpg = 2.95 + rnd() * 0.3
    put(base('carFuel'), id('gaz'), { date: isoAgo(b), fuel: 'lpg', liters: Math.round(litry * 100) / 100, price: Math.round(litry * cenaLpg * 100) / 100, odometer: licznik, full: b !== 35, note: b === 21 ? 'Trasa do Babci' : '', createdAt: ts(daysAgo(b)) })
    if (b % 28 === 0) {
      const lpb = Math.round(km * 4 * (0.8 + rnd() * 0.4)) / 100
      put(base('carFuel'), id('pb'), { date: isoAgo(b), fuel: 'pb', liters: lpb, price: Math.round(lpb * 6.45 * 100) / 100, odometer: licznik, full: true, note: '', createdAt: ts(daysAgo(b)) })
    }
  }
  put(base('carFuel'), id('gaz'), { date: isoAgo(3), fuel: 'lpg', liters: 12, price: 36.6, odometer: null, full: false, note: 'Bez licznika — liczy się tylko do wydatków', createdAt: ts(daysAgo(3)) })
  ;[[70, 'Wymiana oleju i filtrów', 380, 148650], [41, 'Opony zimowe — wymiana', 160, 149900], [12, 'Klocki hamulcowe przód', 420, 151300], [200, 'Przegląd instalacji gazowej', 150, null]]
    .forEach(([b, title, cost, odometer]) => put(base('carRepairs'), id('naprawa'), { date: isoAgo(b), title, cost, odometer, note: title.startsWith('Opony') ? 'Letnie w piwnicy, półka po lewej' : '', createdAt: ts(daysAgo(b)) }))
  put(base('settings'), 'car', { name: 'Opel Astra 1.6 LPG', plate: 'WA 12345', year: '2014', ocDo: iso(new Date(today.getTime() + 18 * DAY)), przegladDo: iso(new Date(today.getTime() + 140 * DAY)), acDo: '', notes: 'Olej 5W-30 · opony 205/55 R16' })

  // ── Notatki ──────────────────────────────────────────────────────────────
  ;[['Lista książek', 'Quo Vadis\nLalka\nMistrz i Małgorzata', ['książki'], true],
    ['Pomysły na prezenty', 'Mama — storczyk\nKuba — gra planszowa', ['prezenty', 'rodzina'], false],
    ['Hasło do Wi-Fi u Babci', 'zapytać Tatę', [], false],
    ['Notatka z bardzo długim tytułem, która sprawdza, czy nagłówek się zawija poprawnie', LONG, ['test'], false],
    ['', 'Notatka bez tytułu', [], false]]
    .forEach(([title, content, tags, pinned]) => put(base('notes'), id('notatka'), { title, content, tags, pinned, createdAt: created(int(1, 90)), updatedAt: created(int(0, 5)) }))
}
