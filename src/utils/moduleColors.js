// Kolory modułów — jedno miejsce dla całej apki (pasek nawigacji, tło,
// kafelki Pulpitu, wykresy w module).
//
// Każdy moduł ma własną barwę. Barwy są rozstawione po kole kolorów co
// najmniej o ~22°, żeby dwa moduły nigdy nie wyglądały jak „ten sam kolor
// w innym odcieniu”. Pilnuje tego test (test/moduleColors.test.js):
// dodając moduł, wybierz barwę z wolnego miejsca na kole.
//
//   barwa (°)   moduł
//      11       Nastrój      róż
//      50       Osoby        pomarańcz
//      73       Wdzięcznik   bursztyn
//      98       Modlitwa     złoto
//     128       Nawyki       limonka
//     153       Kalendarz    zieleń
//     176       Finanse      morski
//     212       To-do        cyjan
//     244       Auto         błękit
//     266       Biblia       niebieski
//     290       Pulpit       lawenda
//     320       Sen          fiolet
export const MODULE_ACCENTS = {
  home:      '#9E8EEF',
  budget:    '#33C3A6',
  habits:    '#A5CE6F',
  todo:      '#52C3D8',
  calendar:  '#6CCC8C',
  prayer:    '#CDB851',
  bible:     '#6F94EE',
  people:    '#D98B5F',
  dream:     '#C480D4',
  gratitude: '#E8A33D',
  mood:      '#E8607A',
  auto:      '#58ACED',
}
