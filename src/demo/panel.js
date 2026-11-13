// TRYB DEMO — pływający przycisk „DEMO" w rogu ekranu.
//
//  - Wylosuj nowe dane / Pusta baza — podmienia bazę w localStorage i przeładowuje.
//  - Licznik błędów — łapie console.error, window.onerror i nieobsłużone
//    odrzucenia Promise, żeby na telefonie (bez konsoli) od razu było widać,
//    że coś poszło nie tak i co dokładnie.
import { __resetDemo } from './firestore.js'

const errors = []
let badge, list, panel

function fmt(args) {
  return args.map(a => {
    if (a instanceof Error) return `${a.name}: ${a.message}${a.stack ? '\n' + a.stack.split('\n').slice(1, 4).join('\n') : ''}`
    if (typeof a === 'object') { try { return JSON.stringify(a) } catch { return String(a) } }
    return String(a)
  }).join(' ')
}

function record(kind, text) {
  // React w trybie dev powtarza część ostrzeżeń — nie dublujemy identycznych pod rząd.
  if (errors.length && errors[errors.length - 1].text === text) { errors[errors.length - 1].n++; render(); return }
  errors.push({ kind, text, n: 1, at: new Date().toLocaleTimeString('pl-PL') })
  render()
}

const origError = console.error.bind(console)
console.error = (...args) => { origError(...args); record('console.error', fmt(args)) }
const origWarn = console.warn.bind(console)
console.warn = (...args) => { origWarn(...args); const t = fmt(args); if (/\[demo\]|Warning:/.test(t)) record('console.warn', t) }
window.addEventListener('error', e => record('błąd JS', `${e.message} (${e.filename?.split('/').pop()}:${e.lineno})`))
window.addEventListener('unhandledrejection', e => record('Promise', fmt([e.reason])))

function render() {
  if (!badge) return
  const n = errors.length
  badge.querySelector('.demo-count').textContent = n ? ` · ${n} ${n === 1 ? 'błąd' : n < 5 ? 'błędy' : 'błędów'}` : ''
  badge.style.background = n ? '#C62828' : '#4F46E5'
  if (list) {
    list.innerHTML = ''
    if (!n) { list.textContent = 'Brak złapanych błędów'; return }
    for (const e of [...errors].reverse()) {
      const row = document.createElement('div')
      row.style.cssText = 'border-top:1px solid #333;padding:6px 0;white-space:pre-wrap;word-break:break-word'
      row.textContent = `[${e.at}] ${e.kind}${e.n > 1 ? ` ×${e.n}` : ''}\n${e.text}`
      list.appendChild(row)
    }
  }
}

function btn(label, onClick) {
  const b = document.createElement('button')
  b.textContent = label
  b.style.cssText = 'flex:1;min-width:120px;padding:8px 10px;border-radius:8px;border:1px solid #555;background:#2a2a35;color:#fff;font:600 12px system-ui;cursor:pointer'
  b.onclick = onClick
  return b
}

function mount() {
  badge = document.createElement('button')
  badge.className = 'demo-badge'
  badge.innerHTML = 'DEMO<span class="demo-count"></span>'
  badge.title = 'Tryb demo — losowe dane'
  badge.style.cssText = 'position:fixed;z-index:2147483000;right:8px;bottom:calc(env(safe-area-inset-bottom, 0px) + 78px);padding:4px 9px;border-radius:999px;border:0;color:#fff;font:700 11px system-ui;letter-spacing:.05em;box-shadow:0 2px 8px rgba(0,0,0,.4);cursor:pointer;opacity:.9'
  badge.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'flex' : 'none' }

  panel = document.createElement('div')
  panel.style.cssText = 'position:fixed;z-index:2147483001;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom, 0px) + 110px);margin-left:auto;max-width:520px;max-height:70vh;display:none;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:#17171f;color:#eee;font:12px/1.4 system-ui;box-shadow:0 8px 30px rgba(0,0,0,.6)'
  const title = document.createElement('div')
  title.innerHTML = '<b>Tryb demo</b> — dane są losowe i zapisują się tylko w tej przeglądarce. Klikaj śmiało, nic nie trafia do prawdziwej bazy.'
  const row = document.createElement('div')
  row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap'
  row.append(
    btn('Wylosuj nowe dane', () => { __resetDemo(); location.reload() }),
    btn('Pusta baza', () => { __resetDemo({ empty: true }); location.reload() }),
    btn('Kopiuj błędy', (ev) => {
      const b = ev.currentTarget
      const txt = errors.map(e => `[${e.at}] ${e.kind}${e.n > 1 ? ` ×${e.n}` : ''}\n${e.text}`).join('\n\n') || 'Brak błędów'
      // Bez alert()/prompt() — w części podglądów są zablokowane.
      const fallback = () => {
        const ta = document.createElement('textarea')
        ta.value = txt
        ta.style.cssText = 'width:100%;min-height:120px;font:11px ui-monospace,monospace'
        list.prepend(ta); ta.focus(); ta.select()
      }
      Promise.resolve(navigator.clipboard?.writeText(txt)).then(
        () => { if (!navigator.clipboard) return fallback(); b.textContent = 'Skopiowano'; setTimeout(() => { b.textContent = 'Kopiuj błędy' }, 1500) },
        fallback,
      )
    }),
    btn('Wyczyść listę', () => { errors.length = 0; render() }),
  )
  list = document.createElement('div')
  list.style.cssText = 'overflow:auto;font:11px/1.4 ui-monospace,monospace;color:#f4b4b4'
  panel.append(title, row, list)
  document.body.append(badge, panel)
  render()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
else mount()
