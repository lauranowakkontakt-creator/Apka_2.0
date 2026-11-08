// TRYB DEMO — atrapa `firebase/auth`. Zawsze zalogowana jedna osoba demo.
import './panel.js'

const DEMO_USER = { uid: 'demo-user', displayName: 'Laura', email: 'demo@apka.dev', photoURL: null }
let current = DEMO_USER
const subs = new Set()
const emit = () => subs.forEach(fn => setTimeout(() => fn(current), 0))

export const getAuth = () => ({ get currentUser() { return current } })
export class GoogleAuthProvider {}
export const connectAuthEmulator = () => {}
export function onAuthStateChanged(_auth, fn) {
  subs.add(fn)
  setTimeout(() => fn(current), 0)
  return () => subs.delete(fn)
}
const signIn = async () => { current = DEMO_USER; emit(); return { user: current } }
export const signInWithEmailAndPassword = signIn
export const createUserWithEmailAndPassword = signIn
export const signInWithPopup = signIn
export const signInWithRedirect = signIn
export const getRedirectResult = async () => null
export async function signOut() { current = null; emit() }
