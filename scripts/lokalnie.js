// `npm run lokalnie` — cała Apka 2.0 na tym komputerze, bez chmury.
//
// Startuje emulatory Firebase (Auth + Firestore) i serwer Vite. Dane trzyma
// w .dane-lokalne/ — wczytuje je przy starcie i zapisuje przy wyjściu
// (Ctrl+C). Panel emulatorów z podglądem bazy: http://127.0.0.1:4000
//
// `npm run lokalnie -- --tylko-emulatory` — same emulatory (np. gdy Vite
// odpalasz osobno albo testujesz `npm run preview`).
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const DANE = '.dane-lokalne'
const tylkoEmulatory = process.argv.includes('--tylko-emulatory')

const args = ['firebase', 'emulators:start', '--project', 'demo-apka2', '--export-on-exit', DANE]
// --import wywala się na pustym/nieistniejącym katalogu — tylko gdy jest co wczytać.
if (existsSync(`${DANE}/firebase-export-metadata.json`)) args.push('--import', DANE)

const procesy = []
const uruchom = (cmd, a) => {
  const p = spawn(cmd, a, { stdio: 'inherit', shell: process.platform === 'win32' })
  procesy.push(p)
  return p
}

const emulatory = uruchom('npx', args)
emulatory.on('exit', (code) => {
  procesy.forEach(p => p !== emulatory && p.kill('SIGTERM'))
  process.exit(code ?? 0)
})

if (!tylkoEmulatory) uruchom('npx', ['vite'])

// Ctrl+C trafia do wszystkich procesów z grupy; czekamy, aż emulatory
// zapiszą dane i same się zamkną — dopiero wtedy wychodzimy.
process.on('SIGINT', () => {})
process.on('SIGTERM', () => procesy.forEach(p => p.kill('SIGTERM')))
