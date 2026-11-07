import { disableNetwork, enableNetwork } from 'firebase/firestore'
import { db } from '../firebase/config'
import { log } from './logger'

// Rozłącz i połącz Firestore na nowo — to samo, co daje zamknięcie i otwarcie
// apki, gdy strumień zapisów stanie. Oczekujące zapisy zostają w kolejce
// i idą od nowa po ponownym połączeniu.
export async function restartPolaczenia() {
  log.warn('firestore', 'restart połączenia (zawieszony zapis)')
  await disableNetwork(db)
  await enableNetwork(db)
}
