import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore'

// Konfiguracja środowiska — Apka 2.0.
//
// Apka 2.0 jest CAŁKOWICIE odcięta od bazy starej Apki (repo Aplikacja).
// Nie ma tu żadnego domyślnego projektu w chmurze. Są dwa tryby:
//
//  1. TRYB LOKALNY (domyślny) — brak zmiennych VITE_FB_* w .env.
//     Apka łączy się z emulatorami Firebase na tym komputerze
//     (`npm run lokalnie`). Projekt nazywa się „demo-apka2": prefiks demo-
//     sprawia, że SDK i emulatory nigdy nie kontaktują się z prawdziwą chmurą.
//     Dane leżą w katalogu .dane-lokalne/ (poza repo).
//
//  2. WŁASNY PROJEKT — komplet sześciu zmiennych VITE_FB_* (patrz .env.example).
//     Do użycia, gdy powstanie nowy, osobny projekt Firebase dla Apki 2.0.
//
// Klucze webowe Firebase nie są sekretem (lądują w bundlu); dane chronią
// reguły Firestore (firestore.rules).
const fromEnv = {
  apiKey:            import.meta.env.VITE_FB_API_KEY,
  authDomain:        import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FB_APP_ID,
}

export const LOCAL_PROJECT_ID = 'demo-apka2'

// Konfiguracja dla emulatorów — wartości nie muszą być prawdziwe.
const LOCAL_CONFIG = {
  apiKey: 'demo-api-key',
  authDomain: `${LOCAL_PROJECT_ID}.firebaseapp.com`,
  projectId: LOCAL_PROJECT_ID,
  storageBucket: `${LOCAL_PROJECT_ID}.appspot.com`,
  messagingSenderId: '0',
  appId: 'demo-app',
}

// Podstawiamy komplet albo nic. Wymieszanie połówek dwóch projektów daje
// błędy uwierzytelniania, które bardzo trudno zdiagnozować.
const hasFullEnvConfig = Object.values(fromEnv).every(v => typeof v === 'string' && v.length > 0)

// Tryb lokalny: brak własnego projektu albo jawne VITE_USE_EMULATORS=1.
export const USE_EMULATORS = !hasFullEnvConfig || import.meta.env.VITE_USE_EMULATORS === '1'
export const firebaseConfig = hasFullEnvConfig ? fromEnv : LOCAL_CONFIG

// Widoczne w konsoli, do którego projektu apka faktycznie pisze.
console.info(`[firebase] projekt: ${firebaseConfig.projectId}${USE_EMULATORS ? ' (emulatory lokalne)' : ' (z .env)'}`)

export const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Firestore z twardszym transportem i lokalnym cache — leczy „czasami nic się
// nie ładuje, a odświeżanie nie pomaga":
//  - experimentalAutoDetectLongPolling: gdy sieć/proxy/bloker/VPN blokuje
//    strumień WebChannel (typowa przyczyna wiszącego onSnapshot), SDK sam
//    wykrywa problem i przechodzi na long-polling, zamiast wisieć w nieskończoność.
//  - persistentLocalCache (IndexedDB, wiele kart): dane z poprzedniej wizyty
//    pokazują się od razu z cache — nawet zanim sieć odpowie i nawet offline —
//    więc moduł nie zostaje pusty, dopóki połączenie się nie odświeży.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

// Podpięcie emulatorów (porty jak w firebase.json). Musi się wykonać przed
// pierwszym zapytaniem — dlatego tutaj, zaraz po inicjalizacji.
if (USE_EMULATORS) {
  // Emulatory słuchają na 127.0.0.1. „localhost" bywa rozwiązywany na IPv6
  // (::1) i wtedy połączenie nie dochodzi — zamieniamy go na adres IPv4.
  // Inny host (np. IP komputera przy teście z telefonu) zostaje bez zmian.
  const h = typeof location !== 'undefined' ? location.hostname : ''
  const host = !h || h === 'localhost' ? '127.0.0.1' : h
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, host, 8080)
}
