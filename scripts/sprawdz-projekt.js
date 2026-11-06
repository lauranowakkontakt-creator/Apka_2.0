// Bramka przed publikacją: bez własnego projektu Firebase w .env.production
// (albo .env.production.local) zbudowana apka łączyłaby się z emulatorami
// na localhost — na telefonie byłaby pusta i nic by nie zapisywała.
import { readFileSync, existsSync } from 'node:fs'

const PLIKI = ['.env.production', '.env.production.local']
const KLUCZE = ['VITE_FB_API_KEY', 'VITE_FB_AUTH_DOMAIN', 'VITE_FB_PROJECT_ID',
  'VITE_FB_STORAGE_BUCKET', 'VITE_FB_MESSAGING_SENDER_ID', 'VITE_FB_APP_ID']

const tresc = PLIKI.filter(f => existsSync(f)).map(f => readFileSync(f, 'utf8')).join('\n')
const brak = KLUCZE.filter(k => !new RegExp(`^${k}=\\S+`, 'm').test(tresc))
if (brak.length) {
  console.error(`\n✖ Deploy zablokowany: Apka 2.0 nie ma jeszcze własnego projektu Firebase.`)
  console.error(`  Uzupełnij .env.production (wzór: .env.example). Brakuje: ${brak.join(', ')}\n`)
  process.exit(1)
}
if (/^VITE_FB_PROJECT_ID=aplikacja-0\s*$/m.test(tresc)) {
  console.error('\n✖ Deploy zablokowany: aplikacja-0 to baza STAREJ Apki. Apka 2.0 ma mieć własny projekt.\n')
  process.exit(1)
}
