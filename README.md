# Apka 2.0

> Druga wersja „Apki", rozwijana osobno od pierwszej (repo `Aplikacja`).
> **Nie korzysta z bazy starej Apki** — na razie działa wyłącznie lokalnie,
> na emulatorach Firebase. Własny projekt Firebase dojdzie później.

Osobista aplikacja PWA: budżet, nawyki, to-do, kalendarz, modlitwa, Biblia,
osoby, sen, wdzięcznik, nastrój i auto (tankowania gazu i benzyny ze spalaniem,
naprawy, terminy OC i przeglądu) — w jednym miejscu, na telefonie.

React 18 + Vite + Firebase (Auth i Firestore). Hostowana na GitHub Pages.

---

## Szybki start

Wymagania: Node.js 20+ i **Java 21+** (emulator Firestore jest napisany
w Javie; na Macu: `brew install openjdk@21`).

```bash
npm install
npm run lokalnie   # apka: http://localhost:5173/Apka_2.0/
                   # podgląd bazy: http://127.0.0.1:4000
```

`npm run lokalnie` uruchamia emulatory Firebase (logowanie + baza) i serwer
Vite naraz. Nic nie wychodzi do chmury — projekt nazywa się `demo-apka2`,
a prefiks `demo-` gwarantuje, że Firebase nie połączy się z prawdziwym
serwerem.

- **Logowanie jest pominięte** — apka sama loguje się na stałe konto lokalne
  (`laura@lokalnie.dev`), więc po każdym uruchomieniu widzisz te same dane.
- **Dane zostają między uruchomieniami** — przy zamykaniu (**Ctrl+C**, raz
  i poczekaj na „Export complete") baza zapisuje się do `.dane-lokalne/`,
  a przy następnym starcie wczytuje. Ten katalog nie trafia do repo.
- **Czysty start** — usuń `.dane-lokalne/`.
- **Test na telefonie w tej samej sieci Wi‑Fi** — na razie niedostępny
  (emulatory słuchają tylko na tym komputerze).

## Polecenia

| Polecenie | Co robi |
|---|---|
| `npm run lokalnie` | **emulatory + apka** — tak pracujemy na co dzień |
| `npm run emulatory` | same emulatory (np. do `npm run preview`) |
| `npm run demo` | **tryb demo** — apka z losowymi danymi, bez Firebase i bez Javy (patrz niżej) |
| `npm run build:demo` | build trybu demo do `dist-demo/` (statyczne pliki, działają pod dowolnym adresem) |
| `npm run dev` | sam serwer Vite (bez emulatorów apka się nie zaloguje) |
| `npm run lint` | ESLint — łapie użycie nieistniejących nazw |
| `npm test` | testy jednostkowe (`node --test`, bez dodatkowych bibliotek) |
| `npm run e2e` | testy w przeglądarce (Playwright) na wersji demo: scenariusze Nastroju i Auta oraz połączenia między modułami, klikane jak przez człowieka + kontrola, czy nic na siebie nie nachodzi, nie wystaje w bok i nie łamie słów w połowie — na telefonie, małym telefonie i komputerze |
| `npm run build` | build produkcyjny do `dist/` |
| `npm run check` | **lint + testy + build.** To jest bramka przed pushem |
| `npm run preview` | podgląd zbudowanej wersji lokalnie |
| `npm run deploy` | `check` + publikacja na GitHub Pages — **zablokowane**, dopóki Apka 2.0 nie ma własnego projektu Firebase |

## Tryb demo (losowe dane do przeklikania)

```bash
npm run demo       # http://localhost:5173/
```

Cała apka działa jak zwykle, ale zamiast Firebase dostaje atrapę bazy
w pamięci przeglądarki ([`src/demo/`](src/demo/)), wypełnioną losowymi danymi
we wszystkich modułach — razem z przypadkami brzegowymi (bardzo długie nazwy,
kwota 0,01 i 12 599,99 zł, wydatek bez konta, w USD albo z usuniętą kategorią,
przeterminowane zadania, przerwa w nawykach). Kod aplikacji się nie zmienia:
w `vite --mode demo` aliasy podmieniają tylko importy `firebase/*`.

- Zmiany zapisują się w `localStorage`, więc przetrwają odświeżenie strony.
- Przycisk **DEMO** w prawym dolnym rogu: *Wylosuj nowe dane*, *Pusta baza*
  (żeby sprawdzić puste stany) i lista złapanych błędów (`console.error`,
  wyjątki, odrzucone Promise) z przyciskiem kopiowania — na telefonie nie ma
  konsoli.
- Atrapa jest celowo surowa tam, gdzie prawdziwy Firestore też jest: `orderBy`
  pomija dokumenty bez danego pola, `updateDoc` na nieistniejącym dokumencie
  rzuca `not-found`, a zapis z wartością `undefined` kończy się błędem.
  Jeśli coś wybucha w demo, najpewniej wybuchnie też na prawdziwej bazie.
- Zwykły `npm run build` nie zawiera ani linijki kodu demo.

## Przeniesienie snów ze starej Apki

Apka 2.0 nie łączy się ze starą bazą. Do jednorazowego przeniesienia snów jest osobna strona
[`public/stara-apka-eksport.html`](public/stara-apka-eksport.html) (po wdrożeniu: `/Apka_2.0/stara-apka-eksport.html`).
Po zalogowaniu tym samym kontem Google tylko czyta sny, symbole, kategorie i osoby ze starej bazy i zapisuje je do pliku
JSON, który wgrywa się w **Sen → ⋮ → Import snów**. Stara baza nie jest zmieniana.

## Wdrożenie

```bash
git pull --rebase      # zdalne repo bywa do przodu
npm run deploy
```

Dwie rzeczy, które regularnie mylą przy sprawdzaniu efektu:

- **Cache PWA.** Po wdrożeniu telefon potrafi jeszcze przez chwilę pokazywać
  starą wersję. Service worker ma `skipWaiting`, ale otwarta karta i tak musi
  zostać zamknięta i otwarta na nowo.
- **Reguły Firestore wdraża się osobno.** `npm run deploy` publikuje tylko
  aplikację. Po zmianie [`firestore.rules`](firestore.rules) trzeba dodatkowo:
  ```bash
  firebase deploy --only firestore:rules
  ```

Jest też [ręczny workflow](.github/workflows/deploy.yml) w zakładce Actions —
zapas na wypadek wygasnięcia klucza deployu.

---

## Struktura

```
src/
  App.jsx              przełączanie modułów, układ, górna belka
  firebase/config.js   inicjalizacja Firebase (patrz „Środowiska")
  components/
    Pulpit.jsx         ekran startowy — podsumowanie ze wszystkich modułów
    <modul>/           jeden katalog na moduł (budget, habits, prayer, …)
      <Modul>Dashboard.jsx   spinacz: dane z Firestore + nawigacja
      <Widok>.jsx            jeden widok = jeden plik
      wspolne.jsx            drobiazgi używane przez kilka widoków modułu
    …                  komponenty wspólne (Toast, ErrorBoundary, Icons…)
  utils/               CZYSTA LOGIKA — bez Reacta, bez Firebase
  styles/main.css      całość stylów
test/                  testy jednostkowe, jeden plik na moduł logiki
```

**Układ modułu.** `<Modul>Dashboard.jsx` tylko spina: subskrybuje Firestore
i trzyma stan nawigacji. Każdy widok mieszka we własnym pliku obok.
`wspolne.jsx` jest na to, czego używa kilka widoków naraz — importy „w bok"
między widokami szybko robią cykl. Jeśli w `wspolne.jsx` zostanie coś
z jednym konsumentem, to nie jest wspólne: wraca do tego pliku, który tego
używa.

Wyjątek: [`Icons.jsx`](src/components/Icons.jsx) ma ~1000 linii i tak
zostaje. To płaska biblioteka 219 komponentów SVG bez cienia stanu — dzielenie
jej dałoby 219 plików albo sztuczne grupy, a szuka się w niej po nazwie.

**Kluczowa zasada podziału:** w `src/utils/` mieszka logika, którą da się
przetestować bez przeglądarki i bez bazy — liczenie sald, serie nawyków,
sortowanie transakcji, parsowanie kwot. Komponenty odpowiadają za wyświetlanie
i za rozmowę z Firestore. Dlatego 300+ testów chodzi w ćwierć sekundy i nie
potrzebuje żadnego frameworka poza tym, co ma Node.

Dopisując logikę: jeśli da się ją policzyć z samych danych wejściowych, jej
miejsce jest w `utils/` razem z testem.

### Dane

Wszystko leży pod `users/{uid}/…` w Firestore — po jednej kolekcji na rodzaj
wpisu (`transactions`, `habits`, `prayerIntentions`, `dreams`, …).
Dostęp pilnują [reguły](firestore.rules): użytkownik widzi wyłącznie własne
poddrzewo, reszta bazy jest zamknięta.

Firestore działa z lokalnym cache w IndexedDB (`persistentLocalCache`), więc
apka pokazuje ostatnio pobrane dane także offline i startuje bez czekania
na sieć.

---

## Obsługa błędów

Trzy warstwy, każda na inny rodzaj awarii:

| Warstwa | Plik | Łapie |
|---|---|---|
| `bladSubskrypcji` | [`utils/polaczenie.js`](src/utils/polaczenie.js) | padnięte subskrypcje Firestore |
| `ErrorBoundary` | [`components/ErrorBoundary.jsx`](src/components/ErrorBoundary.jsx) | wyjątek w renderowaniu modułu |
| `log` | [`utils/logger.js`](src/utils/logger.js) | wszystko, co warto odnotować |

**Każde `onSnapshot` musi mieć `bladSubskrypcji` jako trzeci argument.**
Pilnuje tego test [`test/subskrypcje.test.js`](test/subskrypcje.test.js) — bez
tego padnięta subskrypcja jest całkowicie niema: Firestore po prostu przestaje
wołać callback, moduł zostaje na „Ładowanie…" bez końca i nic nie ląduje
w konsoli.

```js
onSnapshot(q, snap => {
  setRzeczy(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  setLoading(false)
}, bladSubskrypcji('rzeczy', { przyBledzie: () => setLoading(false) }))
```

`przyBledzie` służy do zgaszenia spinnera, żeby moduł pokazał pusty stan
zamiast wisieć. Reszta — log, rozróżnienie „brak sieci" od „awaria", zapalenie
paska u góry ekranu — dzieje się sama.

**Podgląd logów na telefonie:** Ustawienia → *Gdy coś nie działa* →
Diagnostyka. Widać tam ostatnie 200 zdarzeń z kodami błędów Firestore, z
przyciskiem kopiowania. Na telefonie nie ma konsoli, więc to jedyna droga,
żeby zobaczyć, co się naprawdę stało.

---

## Środowiska i sekrety

Apka 2.0 **nie ma żadnego domyślnego projektu w chmurze** — celowo, żeby
nigdy nie dotknąć bazy starej Apki (`aplikacja-0`). Logika jest
w [`src/firebase/config.js`](src/firebase/config.js):

- brak zmiennych `VITE_FB_*` → **tryb lokalny** (emulatory, projekt `demo-apka2`),
- komplet sześciu zmiennych `VITE_FB_*` → własny projekt Firebase.

Gdy powstanie nowy projekt Firebase dla Apki 2.0, jego dane wpisuje się
według wzoru z [`.env.example`](.env.example):

```bash
cp .env.example .env.production.local   # i uzupełnij sześć wartości
```

Podać trzeba **komplet sześciu**; przy niepełnym zestawie apka zostaje
w trybie lokalnym. `npm run deploy` sprawdza ten plik i odmawia publikacji
bez niego (albo gdy wpisany jest stary projekt `aplikacja-0`). Klucze webowe
Firebase nie są sekretem (trafiają do bundla) — danych pilnują reguły
Firestore. W konsoli przeglądarki widać przy starcie, do którego projektu
apka pisze.

Pliki `.env.*.local` oraz klucz deployu `.deploy_key` są w `.gitignore`
i nigdy nie mają trafić do repo.

---

## Testy

```bash
npm test              # wszystkie
node --test test/budgetMath.test.js    # jeden plik
```

Testy jednostkowe pokrywają `src/utils/`. Oprócz nich są testy strukturalne,
które pilnują całości aplikacji:

- [`appStructure.test.js`](test/appStructure.test.js) — nowy moduł jest podpięty
  wszędzie tam, gdzie trzeba (a jest tych miejsc pięć)
- [`subskrypcje.test.js`](test/subskrypcje.test.js) — każde `onSnapshot` ma obsługę błędu
- [`mobile-compat.test.js`](test/mobile-compat.test.js) — safe-area, `dvh`,
  prefiksy `-webkit-`, cele dotykowe, brak poziomego wychodzenia poza ekran
- [`no-emoji.test.js`](test/no-emoji.test.js) — ikony jako SVG, nie emoji

Do tego [lista testów ręcznych](docs/testy-reczne.md) — rzeczy, których nie da
się sprawdzić bez telefonu w ręku.

Osobno pilnowane są rzeczy, które kopiują się same z siebie: bąbelek osoby
(był w czterech kopiach) i paleta jej kolorów (w trzech). Osoba jest wspólna
dla modułów, więc ma jedną reprezentację i jedno źródło kolorów.

**Zasada:** każda nowa lub zmieniona logika dostaje test, a `npm run check`
przechodzi przed pushem.

`check` uruchamia trzy bramki i każda łapie co innego — dlatego są trzy:
lint widzi użycie nieistniejącej nazwy, ale nie import z nieistniejącego pliku;
build widzi jedno i drugie, ale nie widzi błędnych wyników; testy widzą wyniki,
ale nie to, czy apka się w ogóle zbuduje. To samo sprawdza [CI](.github/workflows/ci.yml) przy
każdym pushu.

## Zależności

Stan, otwarte luki i kolejność przyszłych aktualizacji major:
[`docs/zaleznosci.md`](docs/zaleznosci.md).
