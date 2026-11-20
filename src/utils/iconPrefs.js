import { ICON_CATALOG } from '../components/Icons'

export const getModuleIcons = () => {
  try { return JSON.parse(localStorage.getItem('mw_module_icons') || '{}') }
  catch { return {} }
}

export const saveModuleIcon = (id, key) => {
  const c = getModuleIcons()
  try { localStorage.setItem('mw_module_icons', JSON.stringify({ ...c, [id]: key })) } catch { /* tryb prywatny */ }
}

// Zastępuje wszystkie ikony naraz (gdy przyszły z innego urządzenia).
export const replaceModuleIcons = (icons) => {
  try { localStorage.setItem('mw_module_icons', JSON.stringify(icons || {})) } catch { /* tryb prywatny */ }
}

export const resolveIcon = (key, Fallback) => {
  if (!key) return Fallback
  const e = ICON_CATALOG.find(ic => ic.key === key)
  return e?.Component || Fallback
}
