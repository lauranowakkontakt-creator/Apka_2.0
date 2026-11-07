// Geometric SVG icon system — stroke-based, 24x24 viewBox
import { useId } from 'react'

// Znak marki „Apka" — pomarańczowa siatka-kula (wariant A z projektu ikony)
export const IconAppMark = ({ size = 28, rounded = true, style }) => {
  const uid = useId().replace(/:/g, '')
  const bg = `bg-${uid}`, glow = `glow-${uid}`, clip = `clip-${uid}`
  const rx = rounded ? 71.6 : 0
  return (
    <svg width={size} height={size} viewBox="0 0 320 320" style={{ display: 'block', ...style }}>
      <defs>
        <radialGradient id={bg} cx="32%" cy="26%" r="90%">
          <stop offset="0%" stopColor="#E8663A" />
          <stop offset="46%" stopColor="#D9532A" />
          <stop offset="100%" stopColor="#8F3417" />
        </radialGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE7D8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFE7D8" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clip}><rect width="320" height="320" rx={rx} ry={rx} /></clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="320" height="320" fill={`url(#${bg})`} />
        <g transform="translate(160,160)" stroke="#FBE9DF" fill="none">
          <ellipse rx="96" ry="96" strokeOpacity="0.55" strokeWidth="2" />
          <ellipse rx="60" ry="96" strokeOpacity="0.32" strokeWidth="1.6" />
          <ellipse rx="24" ry="96" strokeOpacity="0.32" strokeWidth="1.6" />
          <ellipse rx="96" ry="60" strokeOpacity="0.32" strokeWidth="1.6" />
          <ellipse rx="96" ry="24" strokeOpacity="0.32" strokeWidth="1.6" />
          <line x1="-96" y1="0" x2="96" y2="0" strokeOpacity="0.32" strokeWidth="1.6" />
          <line x1="0" y1="-96" x2="0" y2="96" strokeOpacity="0.32" strokeWidth="1.6" />
          <g stroke="#FFF3EB" strokeOpacity="0.85" strokeWidth="2">
            <line x1="0" y1="-96" x2="60" y2="46" />
            <line x1="-83" y1="-48" x2="83" y2="48" />
            <line x1="60" y1="46" x2="-83" y2="-48" />
          </g>
          <g fill="#FFF3EB" stroke="none">
            <circle cx="0" cy="-96" r="5.5" />
            <circle cx="60" cy="46" r="5.5" />
            <circle cx="-83" cy="-48" r="5" />
            <circle cx="83" cy="48" r="5" />
            <circle cx="0" cy="0" r="4" fill="#FFE7D8" />
            <circle cx="-60" cy="46" r="4" />
            <circle cx="24" cy="-88" r="3.2" fillOpacity="0.8" />
            <circle cx="-24" cy="88" r="3.2" fillOpacity="0.8" />
          </g>
        </g>
        <rect width="320" height="320" fill={`url(#${glow})`} opacity="0.10" />
      </g>
    </svg>
  )
}

const Icon = ({ children, size = 20, stroke = 1.5, style, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ verticalAlign: 'middle', ...style }}
    {...rest}
  >
    {children}
  </svg>
)

export const IconBudget = (p) => (
  <Icon {...p}>
    <rect x="2" y="7" width="20" height="13" rx="2.5" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <circle cx="16.5" cy="13.5" r="2" />
    <path d="M2 11h20" />
  </Icon>
)

export const IconHabits = (p) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M15 17l2 2 4-4" />
  </Icon>
)

export const IconMood = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="9" cy="10" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="0.6" fill="currentColor" stroke="none" />
    <path d="M8.5 14.5c1 1 2.2 1.5 3.5 1.5s2.5-.5 3.5-1.5" />
  </Icon>
)

export const IconTodo = (p) => (
  <Icon {...p}>
    <path d="M4 6.5l2 2 3-3.5" />
    <path d="M4 13l2 2 3-3.5" />
    <path d="M12 7h8" />
    <path d="M12 13.5h8" />
    <path d="M12 20h6" />
    <path d="M4 19.5l2 2 3-3.5" opacity="0.5" />
  </Icon>
)

export const IconCalendar = (p) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18" />
    <path d="M8 3v4M16 3v4" />
    <rect x="7" y="13" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" />
  </Icon>
)

export const IconPrayer = (p) => (
  <Icon {...p}>
    {/* Serce w otwartych dłoniach — modlitwa / ofiarowanie */}
    <path d="M12 8c1.1-1.9 4.2-1.7 4.2 1 0 2-2.2 3.6-4.2 5-2-1.4-4.2-3-4.2-5C7.8 6.3 10.9 6.1 12 8z" />
    <path d="M4.5 12.5c-.6 2.2 0 4.4 1.7 6L9 21" />
    <path d="M19.5 12.5c.6 2.2 0 4.4-1.7 6L15 21" />
  </Icon>
)

export const IconMoon = (p) => (
  <Icon {...p}>
    {/* Księżyc z gwiazdką — sny */}
    <path d="M20 13.5A8 8 0 1 1 10.5 4a6.2 6.2 0 0 0 9.5 9.5z" />
    <path d="M18 3.5l.6 1.6L20 5.7l-1.4.6L18 8l-.6-1.7L16 5.7l1.4-.6z" />
  </Icon>
)

export const IconSettings = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
  </Icon>
)

export const IconMore = (p) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
)

// Pionowe „trzy kropki" — trigger menu „Więcej" (spójnie w całej aplikacji)
export const IconMoreVert = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
)

export const IconPlus = (p) => (
  <Icon {...p} stroke={p.stroke || 2}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const IconClose = (p) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)

export const IconCheck = (p) => (
  <Icon {...p} stroke={p.stroke || 2}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Icon>
)

export const IconChevronLeft = (p) => (
  <Icon {...p}>
    <path d="M14 6l-6 6 6 6" />
  </Icon>
)

export const IconChevronRight = (p) => (
  <Icon {...p}>
    <path d="M10 6l6 6-6 6" />
  </Icon>
)

export const IconChevronDown = (p) => (
  <Icon {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
)

export const IconSearch = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </Icon>
)

export const IconArrowUp = (p) => (
  <Icon {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
)

export const IconArrowDown = (p) => (
  <Icon {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
)

export const IconReorder = (p) => (
  <Icon {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M4 5l-1.5 1.5M4 5l1.5 1.5M4 5v4" />
    <path d="M4 19l-1.5-1.5M4 19l1.5-1.5M4 19v-4" />
  </Icon>
)

export const IconTransfer = (p) => (
  <Icon {...p}>
    <path d="M4 8h13M14 5l3 3-3 3" />
    <path d="M20 16H7M10 13l-3 3 3 3" />
  </Icon>
)

export const IconEdit = (p) => (
  <Icon {...p}>
    <path d="M16 4l4 4-11 11H5v-4z" />
  </Icon>
)

export const IconTrash = (p) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Icon>
)

export const IconEye = (p) => (
  <Icon {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.5" />
  </Icon>
)

export const IconEyeOff = (p) => (
  <Icon {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3.2 3.9" />
    <path d="M6.3 7.9A16 16 0 0 0 2 12s3.5 6 10 6c1.4 0 2.7-.3 3.8-.7" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Icon>
)

export const IconFood = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

export const IconTransport = (p) => (
  <Icon {...p}>
    <rect x="3" y="8" width="18" height="9" rx="2" />
    <circle cx="7.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="16.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
    <path d="M3 12h18" />
  </Icon>
)

export const IconShopping = (p) => (
  <Icon {...p}>
    <path d="M5 8h14l-1 12H6z" />
    <path d="M9 8V5a3 3 0 0 1 6 0v3" />
  </Icon>
)

export const IconHome = (p) => (
  <Icon {...p}>
    <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
  </Icon>
)

export const IconHealth = (p) => (
  <Icon {...p}>
    <path d="M12 6v12M6 12h12" strokeWidth={p.stroke || 2.5} />
  </Icon>
)

export const IconWork = (p) => (
  <Icon {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </Icon>
)

export const IconBills = (p) => (
  <Icon {...p}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </Icon>
)

export const IconGift = (p) => (
  <Icon {...p}>
    <rect x="3" y="9" width="18" height="12" rx="1" />
    <path d="M3 13h18M12 9v12" />
    <path d="M12 9c-2-3-5-3-5-1s2 2 5 1zM12 9c2-3 5-3 5-1s-2 2-5 1z" />
  </Icon>
)

export const IconFuel = (p) => (
  <Icon {...p}>
    <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
    <path d="M4 21h12" />
    <path d="M15 9l2-2v9a2 2 0 0 0 2 2" />
    <path d="M15 13h2" />
  </Icon>
)

export const IconCoffee = (p) => (
  <Icon {...p}>
    <path d="M4 9h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
    <path d="M17 11h2a2 2 0 0 1 0 4h-2" />
    <path d="M8 3v3M12 3v3" />
  </Icon>
)

export const IconBank = (p) => (
  <Icon {...p}>
    <path d="M2 9l10-5 10 5" />
    <path d="M4 9v10M20 9v10M9 9v10M15 9v10" />
    <path d="M2 21h20" />
  </Icon>
)

export const IconCash = (p) => (
  <Icon {...p}>
    <rect x="2" y="7" width="20" height="11" rx="1.5" />
    <circle cx="12" cy="12.5" r="2.5" />
    <path d="M5 10v5M19 10v5" opacity="0.5" />
  </Icon>
)

export const IconCard = (p) => (
  <Icon {...p}>
    <rect x="2" y="6" width="20" height="13" rx="2" />
    <path d="M2 10h20" />
    <path d="M6 15h4" />
  </Icon>
)

export const IconSavings = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7v10M9 10h4.5a1.5 1.5 0 0 1 0 3H9.5a1.5 1.5 0 0 0 0 3H14" />
  </Icon>
)

export const IconBell = (p) => (
  <Icon {...p}>
    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </Icon>
)

export const IconFlame = (p) => (
  <Icon {...p}>
    <path d="M12 3s5 4 5 9a5 5 0 1 1-10 0c0-2 1-3.5 2-4 0 2 1 3 2 3 0-3 1-5 1-8z" />
  </Icon>
)

export const IconFlag = (p) => (
  <Icon {...p}>
    <path d="M5 21V4M5 4l12 2-2 4 2 4-12-2" />
  </Icon>
)

export const IconStar = (p) => (
  <Icon {...p}>
    <path d="M12 3l2.6 5.6 6.2.7-4.6 4.2 1.3 6.1L12 16.7l-5.5 2.9 1.3-6.1L3.2 9.3l6.2-.7z" />
  </Icon>
)

export const IconHeart = (p) => (
  <Icon {...p}>
    <path d="M12 20s-7-4.5-9-9c-1.5-3.5 1-7 4.5-7 2 0 3.5 1 4.5 2.5 1-1.5 2.5-2.5 4.5-2.5 3.5 0 6 3.5 4.5 7-2 4.5-9 9-9 9z" />
  </Icon>
)

export const IconArchive = (p) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
    <path d="M10 12h4" />
  </Icon>
)

export const IconRestore = (p) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
    <path d="M12 17v-5M9.5 14.5L12 12l2.5 2.5" />
  </Icon>
)

export const IconLogo = (p) => (
  <Icon {...p}>
    <path d="M12 3l9 9-9 9-9-9z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

export const IconEducation = (p) => (
  <Icon {...p}>
    <path d="M2 9l10-5 10 5-10 5z" />
    <path d="M6 11v5c0 2 3 3 6 3s6-1 6-3v-5" />
  </Icon>
)

export const IconEntertainment = (p) => (
  <Icon {...p}>
    <path d="M5 5l14 7-14 7z" />
  </Icon>
)

export const IconTravel = (p) => (
  <Icon {...p}>
    <path d="M22 16.5H2" />
    <path d="M12 3C9 3 6 5.5 6 9l-4 7.5h20L18 9c0-3.5-3-6-6-6z" />
    <path d="M9 16.5v3M15 16.5v3" />
  </Icon>
)

export const IconRepeat = (p) => (
  <Icon {...p}>
    <path d="M17 1l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 23l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Icon>
)

export const IconClothing = (p) => (
  <Icon {...p}>
    <path d="M9 3H5L2 9l3 1V21h14V10l3-1-3-6h-4" />
    <path d="M9 3a3 3 0 0 0 6 0" />
  </Icon>
)

export const IconPause = (p) => (
  <Icon {...p}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </Icon>
)

export const IconClock = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </Icon>
)

export const IconTrendUp = (p) => (
  <Icon {...p}>
    <path d="M3 17l5-5 4 4 9-9" />
    <path d="M14 7h6v6" />
  </Icon>
)

export const IconTrendDown = (p) => (
  <Icon {...p}>
    <path d="M3 7l5 5 4-4 9 9" />
    <path d="M14 17h6v-6" />
  </Icon>
)

export const IconGoogle = (p) => (
  <Icon {...p} stroke={0}>
    <path fill="#4285F4" stroke="none" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
    <path fill="#34A853" stroke="none" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.3 1.1-3.7 1.1-2.8 0-5.2-1.9-6-4.5H2.3v2.8C4.1 20.6 7.8 23 12 23z" />
    <path fill="#FBBC05" stroke="none" d="M6 14.2c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H2.3C1.5 8.8 1 10.3 1 12s.5 3.2 1.3 4.6L6 14.2z" />
    <path fill="#EA4335" stroke="none" d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1C17.5 2 15 1 12 1 7.8 1 4.1 3.4 2.3 7.4L6 10.2c.8-2.6 3.2-4.8 6-4.8z" />
  </Icon>
)

export const IconChart = (p) => (
  <Icon {...p}>
    <path d="M18 20V10M12 20V4M6 20v-6" />
  </Icon>
)

export const IconUsers = (p) => (
  <Icon {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
)

export const IconBook = (p) => (
  <Icon {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </Icon>
)

export const IconTag = (p) => (
  <Icon {...p}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </Icon>
)

export const IconNote = (p) => (
  <Icon {...p}>
    <path d="M5 3h14a1 1 0 0 1 1 1v11l-5 5H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M15 20v-5h5" />
    <path d="M8 8h8M8 12h5" />
  </Icon>
)

export const IcPin = (p) => (
  <Icon {...p}>
    <path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z" />
    <path d="M12 15v6" />
  </Icon>
)

// ── Extended icon set (110 icons) ──────────────────────────────────────────
export const IcWallet      = (p) => (<Icon {...p}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 11h5v4h-5a2 2 0 0 1 0-4z"/><circle cx="16.5" cy="13" r="0.8" fill="currentColor" stroke="none"/></Icon>)
export const IcCoins       = (p) => (<Icon {...p}><ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3"/><ellipse cx="15" cy="14" rx="6" ry="3"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-3"/></Icon>)
export const IcChart       = (p) => (<Icon {...p}><path d="M4 4v16h16"/><path d="M8 14l3-4 3 2 4-6"/></Icon>)
export const IcPieChart    = (p) => (<Icon {...p}><path d="M12 3v9h9a9 9 0 1 0-9 9"/><path d="M12 3a9 9 0 0 1 9 9h-9z"/></Icon>)
export const IcReceipt     = (p) => (<Icon {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/></Icon>)
export const IcTarget      = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></Icon>)
export const IcScale       = (p) => (<Icon {...p}><path d="M12 4v16M6 8h12"/><path d="M6 8l-3 6h6zM18 8l-3 6h6z"/><path d="M9 20h6"/></Icon>)
export const IcPercent     = (p) => (<Icon {...p}><path d="M19 5L5 19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></Icon>)
export const IcVault       = (p) => (<Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M12 8v1M12 15v1M16 12h-1M9 12H8"/></Icon>)
export const IcSofa        = (p) => (<Icon {...p}><path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M2 13a2 2 0 0 1 2 2v3h16v-3a2 2 0 0 1 2-2"/><path d="M4 18v2M20 18v2"/></Icon>)
export const IcBed         = (p) => (<Icon {...p}><path d="M3 18V7M3 12h18v6M21 18v-4a2 2 0 0 0-2-2"/><path d="M3 12V9a2 2 0 0 1 2-2h5v5"/></Icon>)
export const IcLamp        = (p) => (<Icon {...p}><path d="M8 3h8l3 7H5z"/><path d="M12 10v8M9 21h6"/></Icon>)
export const IcKey         = (p) => (<Icon {...p}><circle cx="8" cy="8" r="4"/><path d="M11 11l8 8M16 16l2-2M19 19l2-2"/></Icon>)
export const IcDoor        = (p) => (<Icon {...p}><rect x="5" y="3" width="14" height="18" rx="1"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/></Icon>)
export const IcWashing     = (p) => (<Icon {...p}><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="8" cy="6" r="0.8" fill="currentColor" stroke="none"/></Icon>)
export const IcPlant       = (p) => (<Icon {...p}><path d="M12 21v-7"/><path d="M12 14c-4 0-6-3-6-6 3 0 6 1 6 6zM12 12c0-4 2-7 6-7 0 4-2 7-6 7z"/></Icon>)
export const IcBroom       = (p) => (<Icon {...p}><path d="M15 4l-7 7M11 8l5 5"/><path d="M9 10l-5 5c-1 1-1 3 0 4s3 1 4 0l5-5z"/></Icon>)
export const IcTools       = (p) => (<Icon {...p}><path d="M14 7a3 3 0 0 0 4 4l3 3-3 3-3-3a3 3 0 0 1-4-4z"/><path d="M10 14l-6 6M5 5l4 4-1 1-4-4z"/></Icon>)
export const IcThermo      = (p) => (<Icon {...p}><path d="M10 13V5a2 2 0 0 1 4 0v8a4 4 0 1 1-4 0z"/><circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none"/></Icon>)
export const IcPizza       = (p) => (<Icon {...p}><path d="M12 3L3 19c4 2 14 2 18 0z"/><circle cx="10" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="14" cy="13" r="1" fill="currentColor" stroke="none"/></Icon>)
export const IcBurger      = (p) => (<Icon {...p}><path d="M4 8a8 8 0 0 1 16 0z"/><path d="M3 12h18M5 15h14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/></Icon>)
export const IcApple       = (p) => (<Icon {...p}><path d="M12 7c-2-3-7-2-7 3 0 4 3 11 7 11s7-7 7-11c0-5-5-6-7-3z"/><path d="M12 7V4M12 4c0-1 1-2 2-2"/></Icon>)
export const IcWine        = (p) => (<Icon {...p}><path d="M7 3h10l-1 6a4 4 0 0 1-8 0z"/><path d="M12 13v6M8 21h8"/></Icon>)
export const IcCup         = (p) => (<Icon {...p}><path d="M5 8h12v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2"/><path d="M8 3v2M12 3v2"/></Icon>)
export const IcIceCream    = (p) => (<Icon {...p}><path d="M8 9a4 4 0 0 1 8 0z"/><path d="M8 9l4 12 4-12"/></Icon>)
export const IcCake        = (p) => (<Icon {...p}><path d="M4 21v-7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7z"/><path d="M4 16h16M12 8V5M12 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></Icon>)
export const IcFish        = (p) => (<Icon {...p}><path d="M3 12c4-5 11-5 15 0-4 5-11 5-15 0z"/><path d="M18 12l3-3v6zM8 12h.01"/></Icon>)
export const IcEgg         = (p) => (<Icon {...p}><path d="M12 3c-3 0-6 5-6 10a6 6 0 0 0 12 0c0-5-3-10-6-10z"/></Icon>)
export const IcBread       = (p) => (<Icon {...p}><path d="M5 11a4 4 0 0 1 0-8h14a4 4 0 0 1 0 8v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/></Icon>)
export const IcCar         = (p) => (<Icon {...p}><path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5"/><path d="M3 13h18v4H3z"/><circle cx="7" cy="17" r="1.5" fill="currentColor" stroke="none"/><circle cx="17" cy="17" r="1.5" fill="currentColor" stroke="none"/></Icon>)
export const IcBus         = (p) => (<Icon {...p}><rect x="4" y="4" width="16" height="13" rx="2"/><path d="M4 11h16"/><circle cx="8" cy="20" r="1.4" fill="currentColor" stroke="none"/><circle cx="16" cy="20" r="1.4" fill="currentColor" stroke="none"/></Icon>)
export const IcTrain       = (p) => (<Icon {...p}><rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14"/><path d="M8 20l-2 2M16 20l2 2"/><circle cx="9" cy="14" r="0.8" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="0.8" fill="currentColor" stroke="none"/></Icon>)
export const IcPlane       = (p) => (<Icon {...p}><path d="M21 15l-8-3V5a1.5 1.5 0 0 0-3 0v7l-8 3v2l8-2v3l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-3l8 2z"/></Icon>)
export const IcBike        = (p) => (<Icon {...p}><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-7h5l-3 7M10 10l2-3h3"/></Icon>)
export const IcScooter     = (p) => (<Icon {...p}><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 18h7l3-9h2M15 9l-1 9"/></Icon>)
export const IcShip        = (p) => (<Icon {...p}><path d="M3 16l2-5h14l2 5"/><path d="M3 16c2 2 4 2 6 0s4-2 6 0 4 2 6 0"/><path d="M12 11V4M8 7h8"/></Icon>)
export const IcRocket      = (p) => (<Icon {...p}><path d="M12 3c3 2 5 6 5 10l-3 3h-4l-3-3c0-4 2-8 5-10z"/><circle cx="12" cy="10" r="1.6"/><path d="M9 18l-2 3M15 18l2 3"/></Icon>)
export const IcTaxi        = (p) => (<Icon {...p}><rect x="3" y="10" width="18" height="7" rx="1.5"/><path d="M6 10l1.5-4h9L18 10"/><path d="M9 4h6"/><circle cx="7" cy="20" r="1.2" fill="currentColor" stroke="none"/><circle cx="17" cy="20" r="1.2" fill="currentColor" stroke="none"/></Icon>)
export const IcParking     = (p) => (<Icon {...p}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 17V8h3.5a2.5 2.5 0 0 1 0 5H9"/></Icon>)
export const IcPill        = (p) => (<Icon {...p}><rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/></Icon>)
export const IcHeartbeat   = (p) => (<Icon {...p}><path d="M3 12h4l2-5 3 10 2-5h7"/></Icon>)
export const IcStethoscope = (p) => (<Icon {...p}><path d="M5 3v5a4 4 0 0 0 8 0V3"/><path d="M9 16a5 5 0 0 0 10 0v-2"/><circle cx="19" cy="11" r="2"/></Icon>)
export const IcTooth       = (p) => (<Icon {...p}><path d="M6 3c2 0 3 1 6 1s4-1 6-1c2 2 1 6 0 11-1 4-2 6-3 6s-1-4-3-4-2 4-3 4-2-2-3-6C5 9 4 5 6 3z"/></Icon>)
export const IcDumbbell    = (p) => (<Icon {...p}><path d="M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12"/></Icon>)
export const IcYoga        = (p) => (<Icon {...p}><circle cx="12" cy="5" r="2"/><path d="M12 7v6M5 20l7-4 7 4M7 12h10"/></Icon>)
export const IcBrain       = (p) => (<Icon {...p}><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5 3 3 0 0 0 2 4 3 3 0 0 0 5 1V4a2 2 0 0 0-3 0z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5 3 3 0 0 1-2 4 3 3 0 0 1-5 1"/></Icon>)
export const IcLeaf        = (p) => (<Icon {...p}><path d="M5 19c0-9 6-14 14-14 0 9-5 14-14 14z"/><path d="M5 19c3-4 7-7 11-9"/></Icon>)
export const IcDrop        = (p) => (<Icon {...p}><path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/></Icon>)
export const IcMoon        = (p) => (<Icon {...p}><path d="M20 13a8 8 0 1 1-9-9 6 6 0 0 0 9 9z"/></Icon>)
export const IcBriefcase   = (p) => (<Icon {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18"/></Icon>)
export const IcLaptop      = (p) => (<Icon {...p}><rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 20h20l-2-3H4z"/></Icon>)
export const IcPhoneDev    = (p) => (<Icon {...p}><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></Icon>)
export const IcMonitor     = (p) => (<Icon {...p}><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/></Icon>)
export const IcCode        = (p) => (<Icon {...p}><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13 5l-2 14"/></Icon>)
export const IcKeyboard    = (p) => (<Icon {...p}><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></Icon>)
export const IcServer      = (p) => (<Icon {...p}><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/></Icon>)
export const IcWifi        = (p) => (<Icon {...p}><path d="M2 8.5C5 6 8.3 4.7 12 4.7S19 6 22 8.5M5 12c4-3.4 10-3.4 14 0M8 15.5c2.4-2 5.6-2 8 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/></Icon>)
export const IcBattery     = (p) => (<Icon {...p}><rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2"/><rect x="4" y="9" width="9" height="6" rx="1" fill="currentColor" stroke="none"/></Icon>)
export const IcUser        = (p) => (<Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></Icon>)
export const IcUsersGrp    = (p) => (<Icon {...p}><circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5a3.5 3.5 0 0 1 0 7M18 20a6 6 0 0 0-3-5.2"/></Icon>)
export const IcChat        = (p) => (<Icon {...p}><path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></Icon>)
export const IcMail        = (p) => (<Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></Icon>)
export const IcHandshake   = (p) => (<Icon {...p}><path d="M2 12l4-4 6 3 6-3 4 4"/><path d="M6 8l4 5 2-1 2 1 4-5"/><path d="M10 13l2 2 2-2"/></Icon>)
export const IcSmile       = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="0.8" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="0.8" fill="currentColor" stroke="none"/><path d="M8.5 14.5a5 5 0 0 0 7 0"/></Icon>)
export const IcBaby        = (p) => (<Icon {...p}><circle cx="12" cy="7" r="4"/><path d="M9 7h.01M15 7h.01M10.5 9a2 2 0 0 0 3 0"/><path d="M6 21v-3a6 6 0 0 1 12 0v3"/></Icon>)
export const IcSun         = (p) => (<Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></Icon>)
export const IcCloud       = (p) => (<Icon {...p}><path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A4 4 0 0 1 17 18z"/></Icon>)
export const IcRain        = (p) => (<Icon {...p}><path d="M7 14a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A4 4 0 0 1 17 14z"/><path d="M8 18v2M12 18v3M16 18v2"/></Icon>)
export const IcSnow        = (p) => (<Icon {...p}><path d="M12 2v20M4 7l16 10M20 7L4 17"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/></Icon>)
export const IcTree        = (p) => (<Icon {...p}><path d="M12 2l5 7h-3l4 6H6l4-6H7z"/><path d="M12 15v6"/></Icon>)
export const IcFlower      = (p) => (<Icon {...p}><circle cx="12" cy="12" r="2.5"/><path d="M12 9.5c0-3 4-4 4-1.5M14.5 12c3 0 4 4 1.5 4M12 14.5c0 3-4 4-4 1.5M9.5 12c-3 0-4-4-1.5-4"/><path d="M12 14.5V21"/></Icon>)
export const IcMountain    = (p) => (<Icon {...p}><path d="M3 20l6-12 4 7 2-3 6 8z"/><path d="M9 8l2 3"/></Icon>)
export const IcWave        = (p) => (<Icon {...p}><path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></Icon>)
export const IcFire        = (p) => (<Icon {...p}><path d="M12 3s5 4 5 9a5 5 0 1 1-10 0c0-2 1-3.5 2-4 0 2 1 3 2 3 0-3 1-5 1-8z"/></Icon>)
export const IcBolt        = (p) => (<Icon {...p}><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></Icon>)
export const IcMusic       = (p) => (<Icon {...p}><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></Icon>)
export const IcCamera      = (p) => (<Icon {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/></Icon>)
export const IcBookOpen    = (p) => (<Icon {...p}><path d="M4 4h7a2 2 0 0 1 1 1v15a2 2 0 0 0-1-1H4z"/><path d="M20 4h-7a2 2 0 0 0-1 1v15a2 2 0 0 1 1-1h7z"/></Icon>)
export const IcGame        = (p) => (<Icon {...p}><rect x="2" y="7" width="20" height="10" rx="5"/><path d="M7 11v2M6 12h2"/><circle cx="16" cy="11" r="0.9" fill="currentColor" stroke="none"/><circle cx="18" cy="13" r="0.9" fill="currentColor" stroke="none"/></Icon>)
export const IcPalette     = (p) => (<Icon {...p}><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2 0-1.5 1-2 2.5-2H18a3 3 0 0 0 3-3c0-5-4-9-9-9z"/><circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="11" r="1" fill="currentColor" stroke="none"/></Icon>)
export const IcFilm        = (p) => (<Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></Icon>)
export const IcHeadphones  = (p) => (<Icon {...p}><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></Icon>)
export const IcMic         = (p) => (<Icon {...p}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></Icon>)
export const IcGlobe       = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></Icon>)
export const IcMapPin      = (p) => (<Icon {...p}><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></Icon>)
export const IcAlarm       = (p) => (<Icon {...p}><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M5 4L2 7M19 4l3 3"/></Icon>)
export const IcGift2       = (p) => (<Icon {...p}><rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M3 12h18M12 8v13"/><path d="M12 8C10 5 7 5 7 7s2 2 5 1zM12 8c2-3 5-3 5-1s-2 2-5 1z"/></Icon>)
export const IcRing        = (p) => (<Icon {...p}><circle cx="12" cy="15" r="6"/><path d="M9 9l3-6 3 6"/></Icon>)
export const IcShield      = (p) => (<Icon {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></Icon>)
export const IcGlasses     = (p) => (<Icon {...p}><circle cx="7" cy="14" r="3.5"/><circle cx="17" cy="14" r="3.5"/><path d="M3.5 12c1.5-1 3.5-1 5-0.5M10.5 13.5a2 2 0 0 1 3 0M17.5 12c1.5-1 3.5-1 5-0.5" strokeWidth="1.2"/><path d="M7 10.5V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.5"/></Icon>)
export const IcCross       = (p) => (<Icon {...p}><path d="M12 2v20"/><path d="M4 8h16"/></Icon>)
export const IcPray        = (p) => (<Icon {...p}><path d="M12 3l1.5 4.5h-3z"/><path d="M12 7.5V21"/><path d="M6 12.5l6-5 6 5"/></Icon>)

// ── Dodatkowe ikony (rozszerzona baza do wyboru) ──────────────────────────────
// Finanse
export const IcBanknote    = (p) => (<Icon {...p}><rect x="2" y="7" width="20" height="10" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/></Icon>)
export const IcTrendUp     = (p) => (<Icon {...p}><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></Icon>)
export const IcTrendDown   = (p) => (<Icon {...p}><path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/></Icon>)
export const IcCalculator  = (p) => (<Icon {...p}><rect x="5" y="2" width="14" height="20" rx="2"/><rect x="8" y="5" width="8" height="3" rx="1"/><path d="M9 12h.01M12 12h.01M15 12h.01M9 15h.01M12 15h.01M15 15h.01M9 18h.01M12 18h.01M15 18h.01"/></Icon>)
export const IcPiggy       = (p) => (<Icon {...p}><path d="M4 12c0-3.3 3.1-6 7-6 1.4 0 2.7.3 3.8.9L18 6l-.4 3c1 .9 1.4 2 1.4 3 0 3-3.1 5.5-7 5.5-1 0-1.9-.2-2.8-.5L6 19v-2.3C4.8 15.6 4 13.9 4 12z"/><circle cx="9" cy="11.5" r=".8" fill="currentColor" stroke="none"/><path d="M2 12h2"/></Icon>)
export const IcHandCoin    = (p) => (<Icon {...p}><circle cx="16" cy="7" r="3"/><path d="M3 15l4-1 4 1h3a1.5 1.5 0 0 1 0 3h-4"/><path d="M3 14v6"/></Icon>)
// Dom i przedmioty
export const IcTv          = (p) => (<Icon {...p}><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M12 18v3"/></Icon>)
export const IcFridge      = (p) => (<Icon {...p}><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 10h12M9 6v2M9 13v3"/></Icon>)
export const IcBath        = (p) => (<Icon {...p}><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M6 12V6a2 2 0 0 1 4 0"/><path d="M7 19l-1 2M18 19l1 2"/></Icon>)
export const IcTrash       = (p) => (<Icon {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></Icon>)
export const IcCandle      = (p) => (<Icon {...p}><rect x="8" y="9" width="8" height="12" rx="1"/><path d="M12 9V6"/><path d="M12 2c1.4 1.4 1.4 2.8 0 4-1.4-1.2-1.4-2.6 0-4z"/></Icon>)
export const IcClockWall   = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></Icon>)
export const IcChair       = (p) => (<Icon {...p}><path d="M6 11V5a2 2 0 0 1 2-2M18 11V5a2 2 0 0 0-2-2"/><path d="M5 11h14l-1.5 5h-11z"/><path d="M7 16v5M17 16v5"/></Icon>)
// Jedzenie
export const IcMilk        = (p) => (<Icon {...p}><path d="M8 8h8v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z"/><path d="M9.5 4h5L16 8H8z"/><path d="M10 13h4"/></Icon>)
export const IcBottle      = (p) => (<Icon {...p}><path d="M10 2h4v3l1 2v13a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V7l1-2z"/><path d="M9 12h6"/></Icon>)
export const IcCookie      = (p) => (<Icon {...p}><path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-4-4 4 4 0 0 1-4-4 1 1 0 0 0-1-1z"/><circle cx="9" cy="12" r=".8" fill="currentColor" stroke="none"/><circle cx="13.5" cy="15" r=".8" fill="currentColor" stroke="none"/><circle cx="15" cy="10.5" r=".8" fill="currentColor" stroke="none"/></Icon>)
export const IcMeat        = (p) => (<Icon {...p}><path d="M13 11l6-6a3 3 0 0 0-4-4l-5 5"/><circle cx="8.5" cy="15.5" r="5"/><path d="M4.5 19l-2 2M7 21l-1.5 1.5"/></Icon>)
export const IcTea         = (p) => (<Icon {...p}><path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 9h2a2 2 0 0 1 0 4h-2"/><path d="M8 3v2M11 3v2"/></Icon>)
export const IcCheese      = (p) => (<Icon {...p}><path d="M3 12l15-6 3 4v6H3z"/><circle cx="8" cy="15" r=".9" fill="currentColor" stroke="none"/><circle cx="13" cy="14" r=".9" fill="currentColor" stroke="none"/></Icon>)
export const IcSalad       = (p) => (<Icon {...p}><path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M6 15l1 5h10l1-5"/><path d="M9 11c-1-2 0-4 2-5M13 11c1-2 3-3 5-2"/></Icon>)
// Transport
export const IcTruck       = (p) => (<Icon {...p}><path d="M2 6h11v10H2z"/><path d="M13 9h4l4 3v4h-8z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></Icon>)
export const IcMotorbike   = (p) => (<Icon {...p}><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M5 17l4-5h6M8 12l-2-3H4M15 12l2-3h2"/></Icon>)
export const IcTraffic     = (p) => (<Icon {...p}><rect x="8" y="2" width="8" height="16" rx="3"/><circle cx="12" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="10" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1.2" fill="currentColor" stroke="none"/><path d="M12 18v4"/></Icon>)
export const IcAnchor      = (p) => (<Icon {...p}><circle cx="12" cy="5" r="2"/><path d="M12 7v13M5 13a7 7 0 0 0 14 0M4 13h3M17 13h3"/></Icon>)
export const IcWalk        = (p) => (<Icon {...p}><circle cx="13" cy="4" r="2"/><path d="M13 6l-2 5 3 3 1 6M11 11l-4 2M14 14l4 1"/></Icon>)
// Zdrowie i ciało
export const IcRun         = (p) => (<Icon {...p}><circle cx="14" cy="4" r="2"/><path d="M14 6l-3 3 1 4 2 5M12 9l-4 1-2 4M15 13l4 1"/></Icon>)
export const IcSwim        = (p) => (<Icon {...p}><circle cx="8" cy="7" r="2"/><path d="M10 8l3 2 3-2M3 17c1.5 1.4 3 1.4 4.5 0S10.5 15.6 12 17s3 1.4 4.5 0 3-1.4 4.5 0"/></Icon>)
export const IcSyringe     = (p) => (<Icon {...p}><path d="M17 2l5 5M20 5l-9 9-4 1-1 4M9 8l4 4M2 22l3-3"/></Icon>)
export const IcVirus       = (p) => (<Icon {...p}><circle cx="12" cy="12" r="4.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/></Icon>)
export const IcSoap        = (p) => (<Icon {...p}><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a3 3 0 0 1 6 0M16 4a1 1 0 0 0 0-2M19 7a1 1 0 0 0 0-2"/></Icon>)
export const IcBandage     = (p) => (<Icon {...p}><rect x="2" y="8" width="20" height="8" rx="4" transform="rotate(45 12 12)"/><path d="M10 10h.01M14 14h.01M14 10h.01M10 14h.01"/></Icon>)
// Praca i technologia
export const IcPrinter     = (p) => (<Icon {...p}><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><rect x="7" y="15" width="10" height="6"/><path d="M17 12h.01"/></Icon>)
export const IcMouse       = (p) => (<Icon {...p}><rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v3"/></Icon>)
export const IcRobot       = (p) => (<Icon {...p}><rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 4v4M10 4h4"/><circle cx="9.5" cy="13" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="13" r="1" fill="currentColor" stroke="none"/><path d="M10 16h4M3 12v3M21 12v3"/></Icon>)
export const IcBug         = (p) => (<Icon {...p}><path d="M8 8a4 4 0 0 1 8 0v4a4 4 0 0 1-8 0z"/><path d="M12 4V2M9 5L8 4M15 5l1-1M8 10H4M8 14H4M16 10h4M16 14h4M9 18l-2 2M15 18l2 2"/></Icon>)
export const IcFolder      = (p) => (<Icon {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></Icon>)
export const IcClipboard   = (p) => (<Icon {...p}><rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6M9 15h4"/></Icon>)
export const IcPen         = (p) => (<Icon {...p}><path d="M4 20l1.5-4L16 5.5 18.5 8 8 18.5z"/><path d="M14 7.5l2.5 2.5"/></Icon>)
export const IcIdea        = (p) => (<Icon {...p}><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.6.5 1 1.3 1 2.5h6c0-1.2.4-2 1-2.5A6 6 0 0 0 12 3z"/></Icon>)
// Ludzie i społeczność
export const IcPhoneCall   = (p) => (<Icon {...p}><path d="M6 3h3l2 5-2 1.5a11 11 0 0 0 5.5 5.5L18 13l3 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/></Icon>)
export const IcThumbsUp    = (p) => (<Icon {...p}><path d="M7 10v10H4V10z"/><path d="M7 10l4-7c1.3 0 2 .8 2 2v3h5a2 2 0 0 1 2 2.3l-1 6a2 2 0 0 1-2 1.7H7"/></Icon>)
export const IcGradCap     = (p) => (<Icon {...p}><path d="M2 9l10-4 10 4-10 4z"/><path d="M6 11v5c0 1.4 3 2.5 6 2.5s6-1.1 6-2.5v-5"/><path d="M22 9v5"/></Icon>)
export const IcPaw         = (p) => (<Icon {...p}><circle cx="6" cy="12" r="1.6"/><circle cx="10" cy="8.5" r="1.6"/><circle cx="14" cy="8.5" r="1.6"/><circle cx="18" cy="12" r="1.6"/><path d="M8.5 16.5c0-2 1.6-3.5 3.5-3.5s3.5 1.5 3.5 3.5a2.8 2.8 0 0 1-2.8 2.8h-1.4a2.8 2.8 0 0 1-2.8-2.8z"/></Icon>)
// Natura i pogoda
export const IcRainbow     = (p) => (<Icon {...p}><path d="M3 17a9 9 0 0 1 18 0"/><path d="M6 17a6 6 0 0 1 12 0"/><path d="M9 17a3 3 0 0 1 6 0"/></Icon>)
export const IcUmbrella    = (p) => (<Icon {...p}><path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><path d="M12 12v6a2 2 0 0 0 4 0"/><path d="M12 3V2"/></Icon>)
export const IcSprout      = (p) => (<Icon {...p}><path d="M12 21v-7"/><path d="M12 14c-3 0-5-2-5-5 2 0 5 1 5 5z"/><path d="M12 12c0-3 2-5 5-5 0 3-2 5-5 5z"/></Icon>)
export const IcMushroom    = (p) => (<Icon {...p}><path d="M4 11a8 8 0 0 1 16 0z"/><path d="M9 11v6a3 3 0 0 0 6 0v-6"/><circle cx="9" cy="8" r=".8" fill="currentColor" stroke="none"/><circle cx="14" cy="7.5" r=".8" fill="currentColor" stroke="none"/></Icon>)
export const IcWind        = (p) => (<Icon {...p}><path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 12h15a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 16h8a2.5 2.5 0 1 1-2.5 2.5"/></Icon>)
// Aktywności i hobby
export const IcGuitar      = (p) => (<Icon {...p}><path d="M15 3l6 6-2 2-1.5-1.5-4 4a4 4 0 1 1-4-4l4-4L12 4z"/><circle cx="9" cy="15" r="1.8"/></Icon>)
export const IcBasketball  = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.5 5.5c3 2.5 3 10.5 0 13M18.5 5.5c-3 2.5-3 10.5 0 13"/></Icon>)
export const IcSoccer      = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8.5l3.2 2.3-1.2 3.7h-4L8.8 10.8z"/><path d="M12 3v3M4.5 9l2.5 2M19.5 9l-2.5 2M7 20l1.5-3M17 20l-1.5-3"/></Icon>)
export const IcDice        = (p) => (<Icon {...p}><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/></Icon>)
export const IcTent        = (p) => (<Icon {...p}><path d="M12 4L3 20h18z"/><path d="M12 4v16M12 20l-4-6M12 20l4-6"/></Icon>)
export const IcTicket      = (p) => (<Icon {...p}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z"/><path d="M14 6v2M14 11v2M14 16v0"/></Icon>)
export const IcTrophy      = (p) => (<Icon {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3"/><path d="M12 13v4M9 21h6l-1-4h-4z"/></Icon>)
export const IcPuzzle      = (p) => (<Icon {...p}><path d="M10 4a2 2 0 0 1 4 0v1h3a1 1 0 0 1 1 1v3h1a2 2 0 0 1 0 4h-1v3a1 1 0 0 1-1 1h-3v1a2 2 0 0 1-4 0v-1H7a1 1 0 0 1-1-1v-3H5a2 2 0 0 1 0-4h1V6a1 1 0 0 1 1-1h3z"/></Icon>)
export const IcBooks       = (p) => (<Icon {...p}><path d="M5 5h4v15H5zM9 5h4v15H9z"/><path d="M13 6l4-1 3 14-4 1z"/></Icon>)
// Interfejs i różne
export const IcLock        = (p) => (<Icon {...p}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></Icon>)
export const IcCheckCircle = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></Icon>)
export const IcInfo        = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></Icon>)
export const IcQuestion    = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3 2.4c-.8.3-1 .9-1 1.6M12 16h.01"/></Icon>)
export const IcHourglass   = (p) => (<Icon {...p}><path d="M6 3h12M6 21h12M7 3v3l5 6-5 6v3M17 3v3l-5 6 5 6v3"/></Icon>)
export const IcCompass     = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></Icon>)

// ── Nowe ikony (do 250 w katalogu) ───────────────────────────────────────────
// Finanse
export const IcBasket       = (p) => (<Icon {...p}><path d="M4 9h16l-1.5 10a2 2 0 0 1-2 1.7h-9a2 2 0 0 1-2-1.7z"/><path d="M8 9l3-5M16 9l-3-5M9 13v4M12 13v4M15 13v4"/></Icon>)
export const IcShoppingBag  = (p) => (<Icon {...p}><path d="M5 8h14l-1 12H6z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></Icon>)
export const IcDiamond      = (p) => (<Icon {...p}><path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M9 4L8 9l4 11 4-11-1-5"/></Icon>)
export const IcInvoice      = (p) => (<Icon {...p}><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14h7M9 17h4"/></Icon>)
export const IcEuro         = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M15 8.5a4 4 0 1 0 0 7M7.5 11h5M7.5 13.5h5"/></Icon>)
export const IcGoldBar      = (p) => (<Icon {...p}><path d="M3 19l2.5-6h13l2.5 6z"/><path d="M8 13l2-6h4l2 6"/></Icon>)
// Dom
export const IcWindow       = (p) => (<Icon {...p}><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M4 12h16"/></Icon>)
export const IcShower       = (p) => (<Icon {...p}><path d="M5 21V7a4 4 0 0 1 4-4h1a3 3 0 0 1 3 3v1"/><path d="M9 7h8"/><path d="M10 11v1M13 11v1M16 11v1M11.5 15v1M14.5 15v1M13 19v1"/></Icon>)
export const IcIron         = (p) => (<Icon {...p}><path d="M3 18h18v-4a6 6 0 0 0-6-6H9a5 5 0 0 0-5 4z"/><path d="M8 8V5h9"/></Icon>)
export const IcHanger       = (p) => (<Icon {...p}><path d="M10 5a2 2 0 1 1 2 2v2"/><path d="M12 9l-8.5 6.5A1.5 1.5 0 0 0 4.4 18h15.2a1.5 1.5 0 0 0 .9-2.5z"/></Icon>)
export const IcBucket       = (p) => (<Icon {...p}><path d="M4 8l2 12h12l2-12"/><ellipse cx="12" cy="8" rx="8" ry="2"/><path d="M6 7a6 6 0 0 1 12 0"/></Icon>)
export const IcHammer       = (p) => (<Icon {...p}><path d="M13 3l8 8-3 3-8-8z"/><path d="M11.5 9.5L4 17a1.4 1.4 0 0 0 2 2l7.5-7.5"/></Icon>)
export const IcPlug         = (p) => (<Icon {...p}><path d="M9 3v5M15 3v5"/><path d="M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v4"/></Icon>)
// Jedzenie
export const IcCarrot       = (p) => (<Icon {...p}><path d="M16 8a3 3 0 0 0-4 0L3 21l13-9a3 3 0 0 0 0-4z"/><path d="M16 8l1-4M16 8l4-2M16 8l4 1"/><path d="M9 12l2 2M6.5 15.5L8 17"/></Icon>)
export const IcCherry       = (p) => (<Icon {...p}><circle cx="7" cy="17" r="3.5"/><circle cx="16.5" cy="18" r="3"/><path d="M7 13.5C8 9 11 5 16 3M16.5 15c0-4-1-8-.5-12M16 3l3 1"/></Icon>)
export const IcPot          = (p) => (<Icon {...p}><path d="M4 9h16v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/><path d="M2 11h2M20 11h2M6 6h12M12 4v2"/></Icon>)
export const IcCutlery      = (p) => (<Icon {...p}><path d="M5 3v5a2 2 0 0 0 4 0V3M7 3v18"/><path d="M17 21V3c-2 1-3 4-3 7v2h3"/></Icon>)
export const IcBeer         = (p) => (<Icon {...p}><path d="M6 8h10v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M16 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2"/><path d="M6 8a2.5 2.5 0 0 1 2.5-3 3 3 0 0 1 5 0A2.5 2.5 0 0 1 16 8"/><path d="M9.5 12v5M12.5 12v5"/></Icon>)
export const IcDonut        = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M6 9l1 .5M8.5 5.8l.5 1M15.5 5.8l-.5 1M18 9l-1 .5M17.5 15l-1-.5M6.5 15l1-.5"/></Icon>)
export const IcCandy        = (p) => (<Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M8 12L3 8v8zM16 12l5-4v8z"/></Icon>)
// Podróże
export const IcSuitcase     = (p) => (<Icon {...p}><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V4h6v3M8 7v13M16 7v13"/></Icon>)
export const IcMap          = (p) => (<Icon {...p}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></Icon>)
export const IcPassport     = (p) => (<Icon {...p}><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 10h6M12 7c-1 1.5-1 4.5 0 6M12 7c1 1.5 1 4.5 0 6M9 17h6"/></Icon>)
export const IcSailboat     = (p) => (<Icon {...p}><path d="M12 3v13M12 3l7 12h-7M12 6l-6 9h6"/><path d="M3 18h18l-2 3H5z"/></Icon>)
export const IcRoad         = (p) => (<Icon {...p}><path d="M8 3L4 21M16 3l4 18M12 4v2M12 10v3M12 17v3"/></Icon>)
export const IcTram         = (p) => (<Icon {...p}><rect x="5" y="6" width="14" height="13" rx="2"/><path d="M5 12h14M9 3h6M12 3v3M8 19l-2 2M16 19l2 2"/><circle cx="9" cy="15.5" r=".6" fill="currentColor"/><circle cx="15" cy="15.5" r=".6" fill="currentColor"/></Icon>)
export const IcPalm         = (p) => (<Icon {...p}><path d="M12 21c0-5 0-9-1-12M8 21h8"/><path d="M11 9C9 6 5 6 3 8c3-.5 5 0 8 1z"/><path d="M11 9c2-3 6-3 8-1-3-.3-5 0-8 1z"/><path d="M11 9c-1-3 0-5 2-6-1 2-1 4-2 6z"/></Icon>)
export const IcSignpost     = (p) => (<Icon {...p}><path d="M12 3v18M8 21h8"/><path d="M12 5h7l2 2-2 2h-7zM12 11H5l-2 2 2 2h7"/></Icon>)
export const IcCaravan      = (p) => (<Icon {...p}><path d="M3 16V8a2 2 0 0 1 2-2h11a4 4 0 0 1 4 4v6z"/><path d="M20 16h2M6 9h4v3H6zM13 9h3v7"/><circle cx="8" cy="18" r="2"/></Icon>)
// Zdrowie i sport
export const IcBone         = (p) => (<Icon {...p}><path d="M15 9l-6 6"/><circle cx="16.5" cy="5.5" r="2"/><circle cx="18.5" cy="7.5" r="2"/><circle cx="5.5" cy="16.5" r="2"/><circle cx="7.5" cy="18.5" r="2"/></Icon>)
export const IcGlassWater   = (p) => (<Icon {...p}><path d="M6 3h12l-1.5 17a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1z"/><path d="M6.7 10c2-1 3.5 1 5.3 0s3.3-1 5.3 0"/></Icon>)
export const IcSleep        = (p) => (<Icon {...p}><path d="M3 7h5l-5 6h5"/><path d="M11 12h4l-4 5h4"/><path d="M17 4h4l-4 4.5h4"/></Icon>)
export const IcTennis       = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6a9 9 0 0 1 0 12.8M18.4 5.6a9 9 0 0 0 0 12.8"/></Icon>)
export const IcMedKit       = (p) => (<Icon {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M12 10.5v6M9 13.5h6"/></Icon>)
export const IcBathScale    = (p) => (<Icon {...p}><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 10a4.5 4.5 0 0 1 7 0M12 10.5l1.2-2"/></Icon>)
// Praca i nauka
export const IcPaperclip    = (p) => (<Icon {...p}><path d="M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7"/></Icon>)
export const IcRuler        = (p) => (<Icon {...p}><path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></Icon>)
export const IcBackpack     = (p) => (<Icon {...p}><path d="M6 10a6 6 0 0 1 12 0v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M10 4V2.5h4V4M9 14h6v4H9z"/></Icon>)
export const IcAtom         = (p) => (<Icon {...p}><circle cx="12" cy="12" r="1.2" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/></Icon>)
export const IcFlask        = (p) => (<Icon {...p}><path d="M9 3h6M10 3v6L4.5 18.5A1.6 1.6 0 0 0 6 21h12a1.6 1.6 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/></Icon>)
export const IcPresentation = (p) => (<Icon {...p}><path d="M3 4h18M4 4v10h16V4M12 14v3M8 21l4-4 4 4"/><path d="M8 11l3-3 2 2 3-3"/></Icon>)
export const IcDocument     = (p) => (<Icon {...p}><path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/></Icon>)
// Ludzie
export const IcBalloon      = (p) => (<Icon {...p}><path d="M12 3a6 6 0 0 0-6 6c0 4 3 7 6 7s6-3 6-7a6 6 0 0 0-6-6z"/><path d="M12 16l-1 2h2zM12 18c0 2-2 2-2 4"/></Icon>)
export const IcCrown        = (p) => (<Icon {...p}><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/></Icon>)
export const IcStroller     = (p) => (<Icon {...p}><path d="M13 3a7 7 0 0 1 7 7h-7z"/><path d="M3 5h2l2 5h13a5 5 0 0 1-5 5H9a2 2 0 0 1-2-2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/></Icon>)
export const IcCat          = (p) => (<Icon {...p}><path d="M5 11V4l4 3h6l4-3v7a7 7 0 0 1-14 0z"/><circle cx="9.5" cy="12" r=".6" fill="currentColor"/><circle cx="14.5" cy="12" r=".6" fill="currentColor"/><path d="M11 15h2l-1 1zM2 14h3M2 17l3-1M22 14h-3M22 17l-3-1"/></Icon>)
export const IcDog          = (p) => (<Icon {...p}><path d="M8 5h8l1 3v6a5 5 0 0 1-10 0V8z"/><path d="M8 5L4 7l1 6 2.5-2M16 5l4 2-1 6-2.5-2"/><circle cx="10" cy="11" r=".6" fill="currentColor"/><circle cx="14" cy="11" r=".6" fill="currentColor"/><path d="M11 15h2l-1 1.2z"/></Icon>)
export const IcBird         = (p) => (<Icon {...p}><path d="M16 7h.01"/><path d="M3.5 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.5-2L3 18"/><path d="M20 7l2 .5-2 .5M8 18v3M12 18v3"/></Icon>)
export const IcFrown        = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r=".6" fill="currentColor"/><circle cx="15" cy="10" r=".6" fill="currentColor"/><path d="M8.5 16c1-1 2.2-1.5 3.5-1.5s2.5.5 3.5 1.5"/></Icon>)
export const IcHeartBroken  = (p) => (<Icon {...p}><path d="M12 20s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.5-8 11-8 11z"/><path d="M12 6.2l-1.5 4 3 2-1.5 3.5"/></Icon>)
export const IcHearts       = (p) => (<Icon {...p}><path d="M9 19s-6-3.5-6-8a3.3 3.3 0 0 1 6-2 3.3 3.3 0 0 1 6 2c0 4.5-6 8-6 8z"/><path d="M14 5.5A3.3 3.3 0 0 1 21 7.5c0 3.5-4 6.5-4 6.5"/></Icon>)
export const IcMegaphone    = (p) => (<Icon {...p}><path d="M3 10v4h3l9 5V5L6 10z"/><path d="M6 14l1.5 5h2.5L9 15.5M18 9a3 3 0 0 1 0 6"/></Icon>)
export const IcUserPlus     = (p) => (<Icon {...p}><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/></Icon>)
// Natura
export const IcCactus       = (p) => (<Icon {...p}><path d="M9 21V6a3 3 0 0 1 6 0v15"/><path d="M9 13H7a3 3 0 0 1-3-3V8M15 11h2a3 3 0 0 0 3-3V6M6 21h12"/></Icon>)
export const IcPineTree     = (p) => (<Icon {...p}><path d="M12 2l5 6h-3l5 6h-3l4 5H4l4-5H5l5-6H7z"/><path d="M12 19v3"/></Icon>)
export const IcButterfly    = (p) => (<Icon {...p}><path d="M12 8v11"/><path d="M12 11C10 5 4 3 3.5 6.5S6 12 12 12"/><path d="M12 11c2-6 8-8 8.5-4.5S18 12 12 12"/><path d="M12 12c-5 0-7 3-5.5 5s4.5 0 5.5-3M12 12c5 0 7 3 5.5 5s-4.5 0-5.5-3"/><path d="M12 8l-2-3M12 8l2-3"/></Icon>)
export const IcSunrise      = (p) => (<Icon {...p}><path d="M5 17a7 7 0 0 1 14 0M2 21h20M12 2v5M9.5 4.5L12 2l2.5 2.5M4 11l1.5 1.5M20 11l-1.5 1.5"/></Icon>)
export const IcPlanet       = (p) => (<Icon {...p}><circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="10.5" ry="3.2" transform="rotate(-20 12 12)"/></Icon>)
export const IcFeather      = (p) => (<Icon {...p}><path d="M20 4C11 4 6 10 6 18"/><path d="M20 4c0 9-6 14-14 14L3 21M10 14h5M13 10h4"/></Icon>)
export const IcCloudSun     = (p) => (<Icon {...p}><path d="M8 3v1.5M3.5 5.5l1 1M2 10h1.5M12.5 5.5l-1 1"/><path d="M5.2 12.5a3.5 3.5 0 0 1 6-3.5"/><path d="M8 20h9a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.4 1.5A3.3 3.3 0 0 0 8 20z"/></Icon>)
export const IcClover       = (p) => (<Icon {...p}><circle cx="12" cy="7.5" r="3.2"/><circle cx="7.5" cy="12" r="3.2"/><circle cx="16.5" cy="12" r="3.2"/><circle cx="12" cy="16.5" r="3.2"/><path d="M14 18l3 4"/></Icon>)
export const IcBee          = (p) => (<Icon {...p}><ellipse cx="12" cy="14.5" rx="5" ry="6"/><path d="M7.3 12.5h9.4M7.3 16.5h9.4M10.5 5l1.5 3.5L13.5 5"/><path d="M8 10C5 9 3 7 4 5s4 0 5 4M16 10c3-1 5-3 4-5s-4 0-5 4"/></Icon>)
export const IcSparkles     = (p) => (<Icon {...p}><path d="M10 3l1.5 4.5L16 9l-4.5 1.5L10 15l-1.5-4.5L4 9l4.5-1.5z"/><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"/></Icon>)
// Hobby
export const IcBrush        = (p) => (<Icon {...p}><path d="M18 3l3 3-9 9-3-3z"/><path d="M9 12c-3 0-5 2-5 5 0 1.5-1 2.5-2 3 4 1 10 0 10-5"/></Icon>)
export const IcScissors     = (p) => (<Icon {...p}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5L20 18M8.5 16.5L20 6"/></Icon>)
export const IcYarn         = (p) => (<Icon {...p}><circle cx="12" cy="12" r="8"/><path d="M6 7c4 1 8 5 9 12M9 4.6c3 2 6 6 7 13M18 6.5C15 8 11 13 10 20"/><path d="M20 12l2 4"/></Icon>)
export const IcChess        = (p) => (<Icon {...p}><path d="M6 21h12M7.5 18h9M8.5 18l.8-8h5.4l.8 8M7 4h2.5v2H11V4h2v2h1.5V4H17v4l-2 2H9L7 8z"/></Icon>)
export const IcPopcorn      = (p) => (<Icon {...p}><path d="M6 9l1.5 12h9L18 9z"/><path d="M10 9l.5 12M14 9l-.5 12"/><path d="M6 9a2 2 0 0 1 1-3.7 2.5 2.5 0 0 1 4.5-1.5 2.5 2.5 0 0 1 4 .5A2 2 0 0 1 18 9"/></Icon>)
export const IcPiano        = (p) => (<Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 14v5M12 14v5M16 14v5"/><path d="M7 5h2v9H7zM11 5h2v9h-2zM15 5h2v9h-2z" fill="currentColor"/></Icon>)
export const IcFishingRod   = (p) => (<Icon {...p}><path d="M4 21L18 4v11"/><path d="M18 15a2 2 0 1 1-2 2"/><circle cx="7.5" cy="16.5" r="1.8"/></Icon>)
// Różne
export const IcChurch       = (p) => (<Icon {...p}><path d="M12 2v4M10 4h4"/><path d="M7 21V11l5-4 5 4v10"/><path d="M3 21h18M3 21v-6l4-3M21 21v-6l-4-3M10 21v-4a2 2 0 0 1 4 0v4"/></Icon>)
export const IcDove         = (p) => (<Icon {...p}><path d="M3 15c3 0 5-1 7-4l3-5a3 3 0 0 1 5 1l2 1-2 1v3a7 7 0 0 1-7 7H6z"/><path d="M10 11C8 9 7 6 8 3c3 1 5 3 5 6"/></Icon>)
export const IcInfinity     = (p) => (<Icon {...p}><path d="M12 12c-2-3-4-4.5-6-4.5a4.5 4.5 0 0 0 0 9c2 0 4-1.5 6-4.5s4-4.5 6-4.5a4.5 4.5 0 0 1 0 9c-2 0-4-1.5-6-4.5z"/></Icon>)

// ── Katalog ikon — 250 ikon w 10 kategoriach po 25 ─────────────────────────
// Jeden katalog dla całej aplikacji: każdy wybór ikony (nawyki, kategorie,
// listy, osoby, moduły…) pokazuje te same ikony w tych samych kategoriach.
export const ICON_GROUPS = ['Finanse', 'Dom', 'Jedzenie', 'Podróże', 'Zdrowie i sport', 'Praca i nauka', 'Ludzie i zwierzęta', 'Natura', 'Hobby', 'Wiara i inne']

export const ICON_CATALOG = [
  // Finanse
  { key: 'IcWallet',      label: 'portfel',        group: 'Finanse', Component: IcWallet },
  { key: 'IcCoins',       label: 'monety',         group: 'Finanse', Component: IcCoins },
  { key: 'IcChart',       label: 'wykres',         group: 'Finanse', Component: IcChart },
  { key: 'IcPieChart',    label: 'kołowy',         group: 'Finanse', Component: IcPieChart },
  { key: 'IcReceipt',     label: 'paragon',        group: 'Finanse', Component: IcReceipt },
  { key: 'IcTarget',      label: 'cel',            group: 'Finanse', Component: IcTarget },
  { key: 'IcScale',       label: 'waga',           group: 'Finanse', Component: IcScale },
  { key: 'IcPercent',     label: 'procent',        group: 'Finanse', Component: IcPercent },
  { key: 'IcVault',       label: 'sejf',           group: 'Finanse', Component: IcVault },
  { key: 'IconSavings',   label: 'oszczędności',   group: 'Finanse', Component: IconSavings },
  { key: 'IconBank',      label: 'bank',           group: 'Finanse', Component: IconBank },
  { key: 'IconCash',      label: 'gotówka',        group: 'Finanse', Component: IconCash },
  { key: 'IconCard',      label: 'karta',          group: 'Finanse', Component: IconCard },
  { key: 'IcBanknote',    label: 'banknot',        group: 'Finanse', Component: IcBanknote },
  { key: 'IcTrendUp',     label: 'wzrost',         group: 'Finanse', Component: IcTrendUp },
  { key: 'IcTrendDown',   label: 'spadek',         group: 'Finanse', Component: IcTrendDown },
  { key: 'IcCalculator',  label: 'kalkulator',     group: 'Finanse', Component: IcCalculator },
  { key: 'IcPiggy',       label: 'skarbonka',      group: 'Finanse', Component: IcPiggy },
  { key: 'IcHandCoin',    label: 'datek',          group: 'Finanse', Component: IcHandCoin },
  { key: 'IcBasket',      label: 'koszyk',         group: 'Finanse', Component: IcBasket },
  { key: 'IcShoppingBag', label: 'torba',          group: 'Finanse', Component: IcShoppingBag },
  { key: 'IcDiamond',     label: 'diament',        group: 'Finanse', Component: IcDiamond },
  { key: 'IcInvoice',     label: 'faktura',        group: 'Finanse', Component: IcInvoice },
  { key: 'IcEuro',        label: 'euro',           group: 'Finanse', Component: IcEuro },
  { key: 'IcGoldBar',     label: 'złoto',          group: 'Finanse', Component: IcGoldBar },
  // Dom
  { key: 'IcSofa',        label: 'sofa',           group: 'Dom', Component: IcSofa },
  { key: 'IcBed',         label: 'łóżko',          group: 'Dom', Component: IcBed },
  { key: 'IcLamp',        label: 'lampa',          group: 'Dom', Component: IcLamp },
  { key: 'IcKey',         label: 'klucz',          group: 'Dom', Component: IcKey },
  { key: 'IcDoor',        label: 'drzwi',          group: 'Dom', Component: IcDoor },
  { key: 'IcWashing',     label: 'pralka',         group: 'Dom', Component: IcWashing },
  { key: 'IcPlant',       label: 'roślina',        group: 'Dom', Component: IcPlant },
  { key: 'IcBroom',       label: 'miotła',         group: 'Dom', Component: IcBroom },
  { key: 'IcTools',       label: 'narzędzia',      group: 'Dom', Component: IcTools },
  { key: 'IcThermo',      label: 'termometr',      group: 'Dom', Component: IcThermo },
  { key: 'IconHome',      label: 'dom',            group: 'Dom', Component: IconHome },
  { key: 'IcTv',          label: 'telewizor',      group: 'Dom', Component: IcTv },
  { key: 'IcFridge',      label: 'lodówka',        group: 'Dom', Component: IcFridge },
  { key: 'IcBath',        label: 'wanna',          group: 'Dom', Component: IcBath },
  { key: 'IcTrash',       label: 'kosz',           group: 'Dom', Component: IcTrash },
  { key: 'IcCandle',      label: 'świeca',         group: 'Dom', Component: IcCandle },
  { key: 'IcClockWall',   label: 'zegar',          group: 'Dom', Component: IcClockWall },
  { key: 'IcChair',       label: 'krzesło',        group: 'Dom', Component: IcChair },
  { key: 'IcWindow',      label: 'okno',           group: 'Dom', Component: IcWindow },
  { key: 'IcShower',      label: 'prysznic',       group: 'Dom', Component: IcShower },
  { key: 'IcIron',        label: 'żelazko',        group: 'Dom', Component: IcIron },
  { key: 'IcHanger',      label: 'wieszak',        group: 'Dom', Component: IcHanger },
  { key: 'IcBucket',      label: 'wiadro',         group: 'Dom', Component: IcBucket },
  { key: 'IcHammer',      label: 'młotek',         group: 'Dom', Component: IcHammer },
  { key: 'IcPlug',        label: 'wtyczka',        group: 'Dom', Component: IcPlug },
  // Jedzenie
  { key: 'IcPizza',       label: 'pizza',          group: 'Jedzenie', Component: IcPizza },
  { key: 'IcBurger',      label: 'burger',         group: 'Jedzenie', Component: IcBurger },
  { key: 'IcApple',       label: 'jabłko',         group: 'Jedzenie', Component: IcApple },
  { key: 'IcWine',        label: 'wino',           group: 'Jedzenie', Component: IcWine },
  { key: 'IcCup',         label: 'kubek',          group: 'Jedzenie', Component: IcCup },
  { key: 'IcIceCream',    label: 'lody',           group: 'Jedzenie', Component: IcIceCream },
  { key: 'IcCake',        label: 'ciasto',         group: 'Jedzenie', Component: IcCake },
  { key: 'IcFish',        label: 'ryba',           group: 'Jedzenie', Component: IcFish },
  { key: 'IcEgg',         label: 'jajko',          group: 'Jedzenie', Component: IcEgg },
  { key: 'IcBread',       label: 'chleb',          group: 'Jedzenie', Component: IcBread },
  { key: 'IconCoffee',    label: 'kawa',           group: 'Jedzenie', Component: IconCoffee },
  { key: 'IcMilk',        label: 'mleko',          group: 'Jedzenie', Component: IcMilk },
  { key: 'IcBottle',      label: 'butelka',        group: 'Jedzenie', Component: IcBottle },
  { key: 'IcCookie',      label: 'ciastko',        group: 'Jedzenie', Component: IcCookie },
  { key: 'IcMeat',        label: 'mięso',          group: 'Jedzenie', Component: IcMeat },
  { key: 'IcTea',         label: 'herbata',        group: 'Jedzenie', Component: IcTea },
  { key: 'IcCheese',      label: 'ser',            group: 'Jedzenie', Component: IcCheese },
  { key: 'IcSalad',       label: 'sałatka',        group: 'Jedzenie', Component: IcSalad },
  { key: 'IcCarrot',      label: 'marchewka',      group: 'Jedzenie', Component: IcCarrot },
  { key: 'IcCherry',      label: 'wiśnie',         group: 'Jedzenie', Component: IcCherry },
  { key: 'IcPot',         label: 'garnek',         group: 'Jedzenie', Component: IcPot },
  { key: 'IcCutlery',     label: 'sztućce',        group: 'Jedzenie', Component: IcCutlery },
  { key: 'IcBeer',        label: 'piwo',           group: 'Jedzenie', Component: IcBeer },
  { key: 'IcDonut',       label: 'pączek',         group: 'Jedzenie', Component: IcDonut },
  { key: 'IcCandy',       label: 'cukierek',       group: 'Jedzenie', Component: IcCandy },
  // Podróże
  { key: 'IcCar',         label: 'samochód',       group: 'Podróże', Component: IcCar },
  { key: 'IcBus',         label: 'autobus',        group: 'Podróże', Component: IcBus },
  { key: 'IcTrain',       label: 'pociąg',         group: 'Podróże', Component: IcTrain },
  { key: 'IcPlane',       label: 'samolot',        group: 'Podróże', Component: IcPlane },
  { key: 'IcBike',        label: 'rower',          group: 'Podróże', Component: IcBike },
  { key: 'IcScooter',     label: 'hulajnoga',      group: 'Podróże', Component: IcScooter },
  { key: 'IcShip',        label: 'statek',         group: 'Podróże', Component: IcShip },
  { key: 'IcRocket',      label: 'rakieta',        group: 'Podróże', Component: IcRocket },
  { key: 'IcTaxi',        label: 'taksówka',       group: 'Podróże', Component: IcTaxi },
  { key: 'IcParking',     label: 'parking',        group: 'Podróże', Component: IcParking },
  { key: 'IconFuel',      label: 'paliwo',         group: 'Podróże', Component: IconFuel },
  { key: 'IcTruck',       label: 'ciężarówka',     group: 'Podróże', Component: IcTruck },
  { key: 'IcMotorbike',   label: 'motor',          group: 'Podróże', Component: IcMotorbike },
  { key: 'IcTraffic',     label: 'sygnalizacja',   group: 'Podróże', Component: IcTraffic },
  { key: 'IcAnchor',      label: 'kotwica',        group: 'Podróże', Component: IcAnchor },
  { key: 'IcWalk',        label: 'spacer',         group: 'Podróże', Component: IcWalk },
  { key: 'IcSuitcase',    label: 'walizka',        group: 'Podróże', Component: IcSuitcase },
  { key: 'IcMap',         label: 'mapa',           group: 'Podróże', Component: IcMap },
  { key: 'IcPassport',    label: 'paszport',       group: 'Podróże', Component: IcPassport },
  { key: 'IcSailboat',    label: 'żaglówka',       group: 'Podróże', Component: IcSailboat },
  { key: 'IcRoad',        label: 'droga',          group: 'Podróże', Component: IcRoad },
  { key: 'IcTram',        label: 'tramwaj',        group: 'Podróże', Component: IcTram },
  { key: 'IcPalm',        label: 'palma',          group: 'Podróże', Component: IcPalm },
  { key: 'IcSignpost',    label: 'drogowskaz',     group: 'Podróże', Component: IcSignpost },
  { key: 'IcCaravan',     label: 'przyczepa',      group: 'Podróże', Component: IcCaravan },
  // Zdrowie i sport
  { key: 'IcPill',        label: 'tabletka',       group: 'Zdrowie i sport', Component: IcPill },
  { key: 'IcHeartbeat',   label: 'puls',           group: 'Zdrowie i sport', Component: IcHeartbeat },
  { key: 'IcStethoscope', label: 'stetoskop',      group: 'Zdrowie i sport', Component: IcStethoscope },
  { key: 'IcTooth',       label: 'ząb',            group: 'Zdrowie i sport', Component: IcTooth },
  { key: 'IcDumbbell',    label: 'hantle',         group: 'Zdrowie i sport', Component: IcDumbbell },
  { key: 'IcYoga',        label: 'joga',           group: 'Zdrowie i sport', Component: IcYoga },
  { key: 'IcBrain',       label: 'mózg',           group: 'Zdrowie i sport', Component: IcBrain },
  { key: 'IcLeaf',        label: 'liść',           group: 'Zdrowie i sport', Component: IcLeaf },
  { key: 'IcDrop',        label: 'kropla',         group: 'Zdrowie i sport', Component: IcDrop },
  { key: 'IcMoon',        label: 'księżyc',        group: 'Zdrowie i sport', Component: IcMoon },
  { key: 'IcRun',         label: 'bieganie',       group: 'Zdrowie i sport', Component: IcRun },
  { key: 'IcSwim',        label: 'pływanie',       group: 'Zdrowie i sport', Component: IcSwim },
  { key: 'IcSyringe',     label: 'zastrzyk',       group: 'Zdrowie i sport', Component: IcSyringe },
  { key: 'IcVirus',       label: 'wirus',          group: 'Zdrowie i sport', Component: IcVirus },
  { key: 'IcSoap',        label: 'mydło',          group: 'Zdrowie i sport', Component: IcSoap },
  { key: 'IcBandage',     label: 'plaster',        group: 'Zdrowie i sport', Component: IcBandage },
  { key: 'IcBasketball',  label: 'koszykówka',     group: 'Zdrowie i sport', Component: IcBasketball },
  { key: 'IcSoccer',      label: 'piłka',          group: 'Zdrowie i sport', Component: IcSoccer },
  { key: 'IcBone',        label: 'kość',           group: 'Zdrowie i sport', Component: IcBone },
  { key: 'IcGlassWater',  label: 'woda',           group: 'Zdrowie i sport', Component: IcGlassWater },
  { key: 'IcSleep',       label: 'sen',            group: 'Zdrowie i sport', Component: IcSleep },
  { key: 'IcTennis',      label: 'tenis',          group: 'Zdrowie i sport', Component: IcTennis },
  { key: 'IcMedKit',      label: 'apteczka',       group: 'Zdrowie i sport', Component: IcMedKit },
  { key: 'IcBathScale',   label: 'waga ciała',     group: 'Zdrowie i sport', Component: IcBathScale },
  { key: 'IconEye',       label: 'oko',            group: 'Zdrowie i sport', Component: IconEye },
  // Praca i nauka
  { key: 'IcBriefcase',   label: 'teczka',         group: 'Praca i nauka', Component: IcBriefcase },
  { key: 'IcLaptop',      label: 'laptop',         group: 'Praca i nauka', Component: IcLaptop },
  { key: 'IcPhoneDev',    label: 'telefon',        group: 'Praca i nauka', Component: IcPhoneDev },
  { key: 'IcMonitor',     label: 'monitor',        group: 'Praca i nauka', Component: IcMonitor },
  { key: 'IcCode',        label: 'kod',            group: 'Praca i nauka', Component: IcCode },
  { key: 'IcKeyboard',    label: 'klawiatura',     group: 'Praca i nauka', Component: IcKeyboard },
  { key: 'IcServer',      label: 'serwer',         group: 'Praca i nauka', Component: IcServer },
  { key: 'IcWifi',        label: 'wifi',           group: 'Praca i nauka', Component: IcWifi },
  { key: 'IcBattery',     label: 'bateria',        group: 'Praca i nauka', Component: IcBattery },
  { key: 'IconSearch',    label: 'szukaj',         group: 'Praca i nauka', Component: IconSearch },
  { key: 'IcPrinter',     label: 'drukarka',       group: 'Praca i nauka', Component: IcPrinter },
  { key: 'IcMouse',       label: 'myszka',         group: 'Praca i nauka', Component: IcMouse },
  { key: 'IcRobot',       label: 'robot',          group: 'Praca i nauka', Component: IcRobot },
  { key: 'IcBug',         label: 'błąd',           group: 'Praca i nauka', Component: IcBug },
  { key: 'IcFolder',      label: 'folder',         group: 'Praca i nauka', Component: IcFolder },
  { key: 'IcClipboard',   label: 'schowek',        group: 'Praca i nauka', Component: IcClipboard },
  { key: 'IcPen',         label: 'długopis',       group: 'Praca i nauka', Component: IcPen },
  { key: 'IcIdea',        label: 'pomysł',         group: 'Praca i nauka', Component: IcIdea },
  { key: 'IcPaperclip',   label: 'spinacz',        group: 'Praca i nauka', Component: IcPaperclip },
  { key: 'IcRuler',       label: 'linijka',        group: 'Praca i nauka', Component: IcRuler },
  { key: 'IcBackpack',    label: 'plecak',         group: 'Praca i nauka', Component: IcBackpack },
  { key: 'IcAtom',        label: 'atom',           group: 'Praca i nauka', Component: IcAtom },
  { key: 'IcFlask',       label: 'kolba',          group: 'Praca i nauka', Component: IcFlask },
  { key: 'IcPresentation', label: 'prezentacja',    group: 'Praca i nauka', Component: IcPresentation },
  { key: 'IcDocument',    label: 'dokument',       group: 'Praca i nauka', Component: IcDocument },
  // Ludzie i zwierzęta
  { key: 'IcUser',        label: 'osoba',          group: 'Ludzie i zwierzęta', Component: IcUser },
  { key: 'IcUsersGrp',    label: 'ludzie',         group: 'Ludzie i zwierzęta', Component: IcUsersGrp },
  { key: 'IcChat',        label: 'czat',           group: 'Ludzie i zwierzęta', Component: IcChat },
  { key: 'IcMail',        label: 'mail',           group: 'Ludzie i zwierzęta', Component: IcMail },
  { key: 'IcHandshake',   label: 'uścisk',         group: 'Ludzie i zwierzęta', Component: IcHandshake },
  { key: 'IcSmile',       label: 'uśmiech',        group: 'Ludzie i zwierzęta', Component: IcSmile },
  { key: 'IcBaby',        label: 'dziecko',        group: 'Ludzie i zwierzęta', Component: IcBaby },
  { key: 'IcRing',        label: 'pierścionek',    group: 'Ludzie i zwierzęta', Component: IcRing },
  { key: 'IconHeart',     label: 'serce',          group: 'Ludzie i zwierzęta', Component: IconHeart },
  { key: 'IcGlasses',     label: 'okulary',        group: 'Ludzie i zwierzęta', Component: IcGlasses },
  { key: 'IcPhoneCall',   label: 'rozmowa',        group: 'Ludzie i zwierzęta', Component: IcPhoneCall },
  { key: 'IcThumbsUp',    label: 'kciuk',          group: 'Ludzie i zwierzęta', Component: IcThumbsUp },
  { key: 'IcGradCap',     label: 'absolwent',      group: 'Ludzie i zwierzęta', Component: IcGradCap },
  { key: 'IcPaw',         label: 'łapka',          group: 'Ludzie i zwierzęta', Component: IcPaw },
  { key: 'IcBalloon',     label: 'balon',          group: 'Ludzie i zwierzęta', Component: IcBalloon },
  { key: 'IcCrown',       label: 'korona',         group: 'Ludzie i zwierzęta', Component: IcCrown },
  { key: 'IcStroller',    label: 'wózek',          group: 'Ludzie i zwierzęta', Component: IcStroller },
  { key: 'IcCat',         label: 'kot',            group: 'Ludzie i zwierzęta', Component: IcCat },
  { key: 'IcDog',         label: 'pies',           group: 'Ludzie i zwierzęta', Component: IcDog },
  { key: 'IcBird',        label: 'ptak',           group: 'Ludzie i zwierzęta', Component: IcBird },
  { key: 'IcFrown',       label: 'smutek',         group: 'Ludzie i zwierzęta', Component: IcFrown },
  { key: 'IcHeartBroken', label: 'złamane serce',  group: 'Ludzie i zwierzęta', Component: IcHeartBroken },
  { key: 'IcHearts',      label: 'serca',          group: 'Ludzie i zwierzęta', Component: IcHearts },
  { key: 'IcMegaphone',   label: 'megafon',        group: 'Ludzie i zwierzęta', Component: IcMegaphone },
  { key: 'IcUserPlus',    label: 'nowa osoba',     group: 'Ludzie i zwierzęta', Component: IcUserPlus },
  // Natura
  { key: 'IcSun',         label: 'słońce',         group: 'Natura', Component: IcSun },
  { key: 'IcCloud',       label: 'chmura',         group: 'Natura', Component: IcCloud },
  { key: 'IcRain',        label: 'deszcz',         group: 'Natura', Component: IcRain },
  { key: 'IcSnow',        label: 'śnieg',          group: 'Natura', Component: IcSnow },
  { key: 'IcTree',        label: 'drzewo',         group: 'Natura', Component: IcTree },
  { key: 'IcFlower',      label: 'kwiat',          group: 'Natura', Component: IcFlower },
  { key: 'IcMountain',    label: 'góra',           group: 'Natura', Component: IcMountain },
  { key: 'IcWave',        label: 'fala',           group: 'Natura', Component: IcWave },
  { key: 'IcFire',        label: 'ogień',          group: 'Natura', Component: IcFire },
  { key: 'IcBolt',        label: 'błyskawica',     group: 'Natura', Component: IcBolt },
  { key: 'IcRainbow',     label: 'tęcza',          group: 'Natura', Component: IcRainbow },
  { key: 'IcUmbrella',    label: 'parasol',        group: 'Natura', Component: IcUmbrella },
  { key: 'IcSprout',      label: 'kiełek',         group: 'Natura', Component: IcSprout },
  { key: 'IcMushroom',    label: 'grzyb',          group: 'Natura', Component: IcMushroom },
  { key: 'IcWind',        label: 'wiatr',          group: 'Natura', Component: IcWind },
  { key: 'IcCactus',      label: 'kaktus',         group: 'Natura', Component: IcCactus },
  { key: 'IcPineTree',    label: 'świerk',         group: 'Natura', Component: IcPineTree },
  { key: 'IcButterfly',   label: 'motyl',          group: 'Natura', Component: IcButterfly },
  { key: 'IcSunrise',     label: 'wschód',         group: 'Natura', Component: IcSunrise },
  { key: 'IcPlanet',      label: 'planeta',        group: 'Natura', Component: IcPlanet },
  { key: 'IcFeather',     label: 'pióro',          group: 'Natura', Component: IcFeather },
  { key: 'IcCloudSun',    label: 'pochmurno',      group: 'Natura', Component: IcCloudSun },
  { key: 'IcClover',      label: 'koniczyna',      group: 'Natura', Component: IcClover },
  { key: 'IcBee',         label: 'pszczoła',       group: 'Natura', Component: IcBee },
  { key: 'IcSparkles',    label: 'iskry',          group: 'Natura', Component: IcSparkles },
  // Hobby
  { key: 'IcMusic',       label: 'muzyka',         group: 'Hobby', Component: IcMusic },
  { key: 'IcCamera',      label: 'aparat',         group: 'Hobby', Component: IcCamera },
  { key: 'IcBookOpen',    label: 'książka',        group: 'Hobby', Component: IcBookOpen },
  { key: 'IcGame',        label: 'gra',            group: 'Hobby', Component: IcGame },
  { key: 'IcPalette',     label: 'paleta',         group: 'Hobby', Component: IcPalette },
  { key: 'IcFilm',        label: 'film',           group: 'Hobby', Component: IcFilm },
  { key: 'IcHeadphones',  label: 'słuchawki',      group: 'Hobby', Component: IcHeadphones },
  { key: 'IcMic',         label: 'mikrofon',       group: 'Hobby', Component: IcMic },
  { key: 'IconStar',      label: 'gwiazda',        group: 'Hobby', Component: IconStar },
  { key: 'IconShopping',  label: 'zakupy',         group: 'Hobby', Component: IconShopping },
  { key: 'IconClothing',  label: 'ubrania',        group: 'Hobby', Component: IconClothing },
  { key: 'IcGuitar',      label: 'gitara',         group: 'Hobby', Component: IcGuitar },
  { key: 'IcDice',        label: 'kość',           group: 'Hobby', Component: IcDice },
  { key: 'IcTent',        label: 'namiot',         group: 'Hobby', Component: IcTent },
  { key: 'IcTicket',      label: 'bilet',          group: 'Hobby', Component: IcTicket },
  { key: 'IcTrophy',      label: 'puchar',         group: 'Hobby', Component: IcTrophy },
  { key: 'IcPuzzle',      label: 'puzzle',         group: 'Hobby', Component: IcPuzzle },
  { key: 'IcBooks',       label: 'książki',        group: 'Hobby', Component: IcBooks },
  { key: 'IcBrush',       label: 'pędzel',         group: 'Hobby', Component: IcBrush },
  { key: 'IcScissors',    label: 'nożyczki',       group: 'Hobby', Component: IcScissors },
  { key: 'IcYarn',        label: 'włóczka',        group: 'Hobby', Component: IcYarn },
  { key: 'IcChess',       label: 'szachy',         group: 'Hobby', Component: IcChess },
  { key: 'IcPopcorn',     label: 'popcorn',        group: 'Hobby', Component: IcPopcorn },
  { key: 'IcPiano',       label: 'pianino',        group: 'Hobby', Component: IcPiano },
  { key: 'IcFishingRod',  label: 'wędka',          group: 'Hobby', Component: IcFishingRod },
  // Wiara i inne
  { key: 'IconMore',      label: 'inne',           group: 'Wiara i inne', Component: IconMore },
  { key: 'IconTag',       label: 'etykieta',       group: 'Wiara i inne', Component: IconTag },
  { key: 'IconBell',      label: 'dzwonek',        group: 'Wiara i inne', Component: IconBell },
  { key: 'IcAlarm',       label: 'budzik',         group: 'Wiara i inne', Component: IcAlarm },
  { key: 'IconCalendar',  label: 'kalendarz',      group: 'Wiara i inne', Component: IconCalendar },
  { key: 'IcShield',      label: 'tarcza',         group: 'Wiara i inne', Component: IcShield },
  { key: 'IcGlobe',       label: 'globus',         group: 'Wiara i inne', Component: IcGlobe },
  { key: 'IcMapPin',      label: 'pinezka',        group: 'Wiara i inne', Component: IcMapPin },
  { key: 'IconNote',      label: 'notatka',        group: 'Wiara i inne', Component: IconNote },
  { key: 'IcPin',         label: 'przypięcie',     group: 'Wiara i inne', Component: IcPin },
  { key: 'IconFlag',      label: 'flaga',          group: 'Wiara i inne', Component: IconFlag },
  { key: 'IconRepeat',    label: 'cyklicznie',     group: 'Wiara i inne', Component: IconRepeat },
  { key: 'IcCross',       label: 'krzyż',          group: 'Wiara i inne', Component: IcCross },
  { key: 'IcPray',        label: 'modlitwa',       group: 'Wiara i inne', Component: IcPray },
  { key: 'IconSettings',  label: 'ustawienia',     group: 'Wiara i inne', Component: IconSettings },
  { key: 'IcGift2',       label: 'prezent',        group: 'Wiara i inne', Component: IcGift2 },
  { key: 'IcLock',        label: 'kłódka',         group: 'Wiara i inne', Component: IcLock },
  { key: 'IcCheckCircle', label: 'ptaszek',        group: 'Wiara i inne', Component: IcCheckCircle },
  { key: 'IcInfo',        label: 'info',           group: 'Wiara i inne', Component: IcInfo },
  { key: 'IcQuestion',    label: 'pytanie',        group: 'Wiara i inne', Component: IcQuestion },
  { key: 'IcHourglass',   label: 'klepsydra',      group: 'Wiara i inne', Component: IcHourglass },
  { key: 'IcCompass',     label: 'kompas',         group: 'Wiara i inne', Component: IcCompass },
  { key: 'IcChurch',      label: 'kościół',        group: 'Wiara i inne', Component: IcChurch },
  { key: 'IcDove',        label: 'gołąb',          group: 'Wiara i inne', Component: IcDove },
  { key: 'IcInfinity',    label: 'nieskończoność', group: 'Wiara i inne', Component: IcInfinity },
]

// Key → Component lookup (for CatIcon)
const ICON_KEY_MAP = Object.fromEntries(ICON_CATALOG.map(ic => [ic.key, ic.Component]))

// Map from category id → SVG component
export const CATEGORY_ICON_MAP = {
  // Budget — expenses
  jedzenie: IcPizza,
  kawa: IcCup,
  miasto: IcCup,
  zakupy: IconShopping,
  transport: IcBus,
  auto: IcCar,
  dom: IcSofa,
  paliwo: IcCar,
  zdrowie: IcPill,
  praca: IcBriefcase,
  firma: IcBriefcase,
  rachunki: IcReceipt,
  edukacja: IcBookOpen,
  studia: IcBookOpen,
  rozrywka: IcFilm,
  przyjemnosci: IcFilm,
  prezenty: IcGift2,
  prezent: IcGift2,
  ubrania: IconClothing,
  subskrypcje: IconRepeat,
  wyjazdy: IcPlane,
  oszczednosci: IcVault,
  dziesiecina: IcCross,
  ofiara: IcCross,
  wynagrodzenie: IcBriefcase,
  stypendium: IcBookOpen,
  sprzedaz: IconShopping,
  freelance: IcLaptop,
  premia: IcBriefcase,
  zwrot: IconTransfer,
  transfer: IconTransfer,
  inwestycje: IcChart,
  inne: IconMore,
  restauracje: IcPizza,
  sport: IcDumbbell,
  zwierzeta: IconHeart,
  naprawy: IcTools,
  kosmetyki: IcDrop,
  alkohol: IcWine,
  elektronika: IcLaptop,
  ksiazki: IcBookOpen,
  wynajem: IcKey,
  // Habit categories (English IDs)
  health: IcPill,
  spirit: IcPray,
  learn: IcBookOpen,
  work: IcBriefcase,
  other: IconMore,
  // Prayer categories
  personal: IcPray,
  family: IcUsersGrp,
  others: IcUsersGrp,
  thanks: IconStar,
  spiritual: IcPray,
  general: IconMore,
  // Calendar slugs
  home: IcSofa,
  birthday: IcCake,
  study: IcBookOpen,
  meeting: IcHandshake,
  finance: IcWallet,
  prayer: IcPray,
  travel: IcPlane,
}

// Renderuje ikonę SVG kategorii — najpierw mapa po ID, potem po kluczu ikony.
// W aplikacji NIE używamy emotek: jeśli zapisana wartość nie jest znanym kluczem
// ikony (np. to emotka ze starszych danych), pokazujemy neutralną ikonę SVG —
// nigdy surowej emotki/tekstu.
export function CatIcon({ categoryId, emoji, size = 18, style }) {
  const Comp = CATEGORY_ICON_MAP[categoryId] || ICON_KEY_MAP[emoji]
  if (Comp) return <Comp size={size} style={style} />
  if (emoji) return <IconTag size={size} style={style} />
  return <span style={{ fontSize: size, lineHeight: 1, opacity: 0.4, ...style }}>·</span>
}
