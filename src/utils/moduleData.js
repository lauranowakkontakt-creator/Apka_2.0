// Które dane należą do którego modułu — do „Wyczyść dane modułu".
// Kolekcje pod users/{uid}/… oraz pojedyncze dokumenty [kolekcja, id].
// Pilnuje tego test: każda kolekcja używana w kodzie musi być tu przypisana.
export const MODULE_DATA = {
  budget: {
    label: 'Finanse',
    what: 'konta, transakcje, regularne płatności, dłużników, cele, listę zakupów, kategorie i ustawienia dziesięciny',
    collections: ['accounts', 'transactions', 'regularPayments', 'debtors', 'savingsGoals', 'shoppingItems'],
    docs: [['settings', 'categories'], ['settings', 'shopCategories'], ['settings', 'tithe']],
  },
  habits: {
    label: 'Nawyki',
    what: 'nawyki, rutyny, kategorie nawyków, przerwy i własne powody przerw',
    collections: ['habits', 'habitRoutines', 'habitCategories', 'habitPauses'],
    docs: [['settings', 'habitPauses']],
  },
  todo: { label: 'To-do', what: 'zadania i listy', collections: ['todos', 'todoLists'], docs: [] },
  calendar: {
    label: 'Kalendarz', what: 'wydarzenia, kategorie i ustawienia kalendarza',
    collections: ['calendarEvents', 'calendarCategories'], docs: [['settings', 'calendar']],
  },
  prayer: { label: 'Modlitwa', what: 'intencje modlitewne', collections: ['prayerIntentions'], docs: [] },
  bible: { label: 'Biblia', what: 'notatki i postęp czytania', collections: ['bibleNotes'], docs: [['bible', 'progress']] },
  people: { label: 'Osoby', what: 'osoby (znikną też z kalendarza, modlitwy i snów)', collections: ['calendarPeople'], docs: [] },
  dream: { label: 'Sen', what: 'sny, kategorie, symbole i ćwiczenia pamięci', collections: ['dreams', 'dreamCategories', 'dreamSymbols', 'dreamMemory'], docs: [] },
  gratitude: { label: 'Wdzięcznik', what: 'wpisy wdzięczności', collections: ['gratitude'], docs: [] },
  mood: { label: 'Nastrój', what: 'wpisy nastroju', collections: ['moodLogs'], docs: [] },
}
