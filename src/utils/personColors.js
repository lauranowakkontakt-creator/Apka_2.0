// Wspólna paleta kolorów osób.
//
// Osoba jest współdzielona między modułami — Kalendarz, Modlitwa i Osoby czytają
// tę samą kolekcję `calendarPeople` — więc musi wyglądać wszędzie tak samo.
// Ta lista była skopiowana w trzech plikach; dorzucenie koloru w jednym z nich
// dawało osobę, która w innym module wyglądała inaczej.
//
// Osobny plik, a nie people.js: tamten ciąga Firebase, przez co nie da się go
// zaimportować w teście jednostkowym.
import { APP_COLORS } from './palette.js'

// Te same 50 kolorów co w całej aplikacji.
export const PERSON_COLORS = APP_COLORS
