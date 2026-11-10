// Zamykanie „wierzchniej warstwy" — okna, szuflady ustawień albo arkusza „Więcej".
//
// Apka ma kilkadziesiąt okien (.modal-overlay) i każde zamyka się własnym
// przyciskiem. Zamiast dopisywać obsługę klawisza Esc i przycisku „wstecz"
// do każdego z osobna, jedno miejsce znajduje to, co jest na wierzchu,
// i klika jego przycisk zamknięcia — czyli robi dokładnie to, co zrobiłby
// użytkownik, więc okno sprząta po sobie tak samo jak zwykle.
//
// Czysta funkcja: dostaje dokument (albo jego atrapę w teście) i zwraca,
// czy coś zamknęła.
export function zamknijWierzchniaWarstwe(dokument) {
  const okna = dokument.querySelectorAll('.modal-overlay')
  // Okno otwarte z innego okna stoi w dokumencie dalej — zamykamy od końca.
  for (let i = okna.length - 1; i >= 0; i--) {
    const zamknij = okna[i].querySelector('.modal-close')
    if (zamknij) { zamknij.click(); return true }
  }
  const tlo = dokument.querySelector('.drawer-overlay') || dokument.querySelector('.more-overlay.open')
  if (tlo) { tlo.click(); return true }
  return false
}
