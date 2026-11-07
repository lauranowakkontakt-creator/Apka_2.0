import { APP_COLORS } from './palette.js'
// Przelew między kontami — przesuwa pieniądze, więc nie liczy się jako przychód/wydatek.
export const isTransfer = (t) => t?.categoryId === 'transfer' || !!t?.transferTo || !!t?.transferFrom

// `icon` holds an SVG icon-catalog key (see Icons.jsx) — never an emoji.
// CatIcon resolves it via CATEGORY_ICON_MAP[id] first, then the icon key.
export const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'jedzenie',      label: 'Jedzenie',       icon: 'IcPizza',      color: '#C97A55' },
  { id: 'kawa',          label: 'Kawa / Cafe',     icon: 'IcCup',        color: '#A07B4F' },
  { id: 'restauracje',   label: 'Restauracje',     icon: 'IcPizza',      color: '#C97A55' },
  { id: 'zakupy',        label: 'Zakupy',          icon: 'IconShopping', color: '#D4A574' },
  { id: 'ubrania',       label: 'Ubrania',         icon: 'IconClothing', color: '#9B8FA8' },
  { id: 'transport',     label: 'Transport',       icon: 'IcBus',        color: '#9AAFB8' },
  { id: 'auto',          label: 'Auto',            icon: 'IcCar',        color: '#7A9E9A' },
  { id: 'paliwo',        label: 'Paliwo',          icon: 'IconFuel',     color: '#E0B570' },
  { id: 'dom',           label: 'Dom',             icon: 'IcSofa',       color: '#8A7E72' },
  { id: 'rachunki',      label: 'Rachunki',        icon: 'IcReceipt',    color: '#BAAE99' },
  { id: 'naprawy',       label: 'Naprawy',         icon: 'IcTools',      color: '#A07B4F' },
  { id: 'zdrowie',       label: 'Zdrowie',         icon: 'IcPill',       color: '#A8B5A0' },
  { id: 'kosmetyki',     label: 'Kosmetyki',       icon: 'IcDrop',       color: '#B89090' },
  { id: 'sport',         label: 'Sport',           icon: 'IcDumbbell',   color: '#A8B5A0' },
  { id: 'rozrywka',      label: 'Rozrywka',        icon: 'IcFilm',       color: '#C97A55' },
  { id: 'ksiazki',       label: 'Książki',         icon: 'IcBookOpen',   color: '#9AAFB8' },
  { id: 'edukacja',      label: 'Edukacja',        icon: 'IcBookOpen',   color: '#9AAFB8' },
  { id: 'elektronika',   label: 'Elektronika',     icon: 'IcLaptop',     color: '#7A9E9A' },
  { id: 'subskrypcje',   label: 'Subskrypcje',     icon: 'IconRepeat',   color: '#8A7E72' },
  { id: 'wyjazdy',       label: 'Wyjazdy',         icon: 'IcPlane',      color: '#E0B570' },
  { id: 'prezenty',      label: 'Prezenty',        icon: 'IcGift2',      color: '#D4A574' },
  { id: 'zwierzeta',     label: 'Zwierzęta',       icon: 'IconHeart',    color: '#A8B5A0' },
  { id: 'praca',         label: 'Praca',           icon: 'IcBriefcase',  color: '#BAAE99' },
  { id: 'firma',         label: 'Firma',           icon: 'IcBriefcase',  color: '#9AAFB8' },
  { id: 'dziesiecina',   label: 'Dziesięcina',     icon: 'IcCross',      color: '#C97A55' },
  { id: 'oszczednosci',  label: 'Oszczędności',    icon: 'IcVault',      color: '#A8B5A0' },
  { id: 'inne',          label: 'Inne',            icon: 'IconMore',     color: '#7A6E5C' },
]

export const DEFAULT_INCOME_CATEGORIES = [
  { id: 'wynagrodzenie', label: 'Wynagrodzenie',   icon: 'IcBriefcase',  color: '#A8B5A0' },
  { id: 'freelance',     label: 'Freelance',       icon: 'IcLaptop',     color: '#A8B5A0' },
  { id: 'premia',        label: 'Premia',          icon: 'IconStar',     color: '#E0B570' },
  { id: 'zwrot',         label: 'Zwrot',           icon: 'IconTransfer', color: '#9AAFB8' },
  { id: 'prezent',       label: 'Prezent',         icon: 'IcGift2',      color: '#D4A574' },
  { id: 'inwestycje',    label: 'Inwestycje',      icon: 'IcChart',      color: '#A8B5A0' },
  { id: 'wynajem',       label: 'Wynajem',         icon: 'IcKey',        color: '#C97A55' },
  { id: 'sprzedaz',      label: 'Sprzedaż',        icon: 'IconShopping', color: '#D4A574' },
  { id: 'stypendium',    label: 'Stypendium',      icon: 'IcBookOpen',   color: '#9AAFB8' },
  { id: 'inne',          label: 'Inne',            icon: 'IconMore',     color: '#7A6E5C' },
]

// Paleta kategorii = wspólna paleta aplikacji (50 kolorów, 10 w rzędzie).
export const CAT_COLORS = APP_COLORS

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [h * 360, s * 100, l * 100]
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function getSubcategoryColor(parentHex, index) {
  if (!parentHex?.startsWith('#')) return parentHex || '#888'
  const [h, s, l] = hexToHsl(parentHex)
  const offsets = [15, -12, 23, -19, 9, -6, 18, -8]
  const newL = Math.min(88, Math.max(22, l + offsets[index % offsets.length]))
  return hslToHex(h, s, newL)
}
