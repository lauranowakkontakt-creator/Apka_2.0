# Testy ręczne

Rzeczy, których nie sprawdzi `npm test` — bo wymagają prawdziwej przeglądarki,
prawdziwego telefonu albo prawdziwie zerwanej sieci.

Przechodzi się to **przed wdrożeniem**, a w całości po zmianie w Firebase,
w service workerze albo po aktualizacji major.

## 1. Sanity po wdrożeniu (2 minuty, za każdym razem)

- [ ] Apka otwiera się na telefonie i **pokazuje nową wersję**
      (jeśli nie: zamknij kartę do końca i otwórz na nowo — cache PWA)
- [ ] Pulpit pokazuje dane, nie same puste kafelki
- [ ] Przełączenie między trzema modułami — każdy się ładuje
- [ ] Dodanie i skasowanie jednej transakcji — saldo konta zgadza się po obu

## 2. Sieć i błędy

Najbardziej newralgiczne, bo tu było najwięcej cichych awarii.

- [ ] **Tryb samolotowy przy otwartej apce** → pasek u góry: „Brak połączenia —
      pokazuję ostatnio pobrane dane". Moduły dalej pokazują treść z cache,
      nie kręcący się w nieskończoność spinner
- [ ] **Wyjście z trybu samolotowego** → pasek znika **sam**, bez odświeżania
- [ ] **Start apki od zera bez sieci** → moduły pokazują dane z poprzedniej
      wizyty; żaden nie wisi na „Ładowanie…"
- [ ] **Dodanie wpisu offline, potem włączenie sieci** → wpis dojeżdża do bazy
- [ ] Ustawienia → *Gdy coś nie działa* → Diagnostyka: są wpisy, „Kopiuj logi"
      naprawdę wkleja się gdzie indziej

## 3. Kwoty (walidacja wejścia)

W dowolnym formularzu z kwotą — transakcja, dług, cel oszczędnościowy:

- [ ] `12,50` → przyjęte jako 12,50
- [ ] `1 200` → przyjęte jako 1200
- [ ] `1.200,50` → przyjęte jako 1200,50
- [ ] `12zł` → **błąd**, nie ciche 12
- [ ] `1,200,50` → **błąd** (niejednoznaczne), nie ciche 1,20
- [ ] puste pole → błąd, formularz się nie zapisuje
- [ ] Klawiatura numeryczna sama otwiera się na telefonie

## 4. Uprawnienia i logowanie

- [ ] Wylogowanie i ponowne zalogowanie przez Google działa
- [ ] Po zalogowaniu widać **swoje** dane, nie pusto
- [ ] Po dłuższej przerwie (wygasła sesja) apka mówi, że wygasło logowanie,
      zamiast pokazywać puste moduły

## 5. Telefon (po zmianach w stylach)

- [ ] Nic nie wychodzi poza ekran w poziomie — przewiń każdy moduł do końca
- [ ] Dolny pasek nie wchodzi pod wskaźnik gestów (iPhone bez przycisku)
- [ ] Górna belka nie wchodzi pod notch
- [ ] Obrót ekranu i powrót — tekst nie puchnie
- [ ] Modal/szuflada: tło pod spodem **nie** przewija się razem z zawartością
- [ ] Da się powiększyć gestem (dostępność)
- [ ] **„Wstecz" na Androidzie** przy otwartym formularzu zamyka formularz,
      nie apkę; kolejne „wstecz" wraca z modułu na Pulpit, a dopiero z Pulpitu
      wychodzi z apki
- [ ] Na komputerze **Esc** zamyka otwarte okno, ustawienia i „Więcej"

## 6. Dane

- [ ] Ustawienia → Kopia danych → eksport tworzy plik z sensowną zawartością
- [ ] Import tej kopii odtwarza dane

## 7. Wydajność (po większych zmianach)

- [ ] Start apki na telefonie do pierwszej treści: **poniżej ~3 sekund**
- [ ] Przewijanie długiej listy (transakcje, sny) jest płynne
- [ ] Przełączanie modułów nie zacina się

Rozmiar bundla widać w podsumowaniu każdego przebiegu
[CI](../.github/workflows/ci.yml) — nagły przyrost o kilkaset kB oznacza,
że coś ciężkiego weszło do wspólnego chunka.

---

## Gdy coś nie działa u użytkownika

1. Ustawienia → *Gdy coś nie działa* → Diagnostyka → **Kopiuj logi**
2. W logach szukaj wpisów `ERROR [firestore]` — nazwa kolekcji mówi, który
   moduł padł, a kod błędu mówi dlaczego:

| Kod | Znaczenie | Co robić |
|---|---|---|
| `permission-denied` | reguły odmówiły dostępu | sprawdź, czy `firestore.rules` są wdrożone; sprawdź, czy sesja nie wygasła |
| `unauthenticated` | brak ważnego logowania | wyloguj się i zaloguj ponownie |
| `unavailable` | sieć albo transport zablokowany | zwykle mija samo; sprawdź VPN, bloker reklam, firmowe proxy |
| `failed-precondition` | brakuje indeksu w Firestore | w logu jest link tworzący indeks jednym kliknięciem |
