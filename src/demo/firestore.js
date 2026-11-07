// TRYB DEMO — atrapa `firebase/firestore` działająca w pamięci przeglądarki.
//
// Podpinana wyłącznie w `vite --mode demo` (alias w vite.config.js). Kod
// aplikacji się nie zmienia: importuje `firebase/firestore` jak zwykle, a tu
// dostaje ten sam zestaw funkcji, tylko że dane leżą w obiekcie JS
// i zapisują się do localStorage (przetrwają odświeżenie strony).
//
// Zachowanie odwzorowuje Firestore tam, gdzie to ma znaczenie dla błędów UI:
//  - orderBy POMIJA dokumenty bez danego pola (tak robi prawdziwa baza),
//  - updateDoc na nieistniejącym dokumencie rzuca błąd `not-found`,
//  - setDoc z { merge: true } scala zagnieżdżone mapy,
//  - updateDoc rozumie ścieżki z kropką (`amounts.2026-01-01`),
//  - increment / arrayUnion / arrayRemove / deleteField / serverTimestamp.

import { seedDemoData } from './seed.js'

const STORAGE_KEY = 'apka_demo_db_v2'

// ── Timestamp ───────────────────────────────────────────────────────────────
export class Timestamp {
  constructor(seconds, nanoseconds = 0) {
    this.seconds = seconds
    this.nanoseconds = nanoseconds
  }
  static now() { return Timestamp.fromMillis(Date.now()) }
  static fromDate(d) { return Timestamp.fromMillis(d.getTime()) }
  static fromMillis(ms) {
    const s = Math.floor(ms / 1000)
    return new Timestamp(s, Math.round((ms - s * 1000) * 1e6))
  }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6) }
  toDate() { return new Date(this.toMillis()) }
  isEqual(o) { return o instanceof Timestamp && o.seconds === this.seconds && o.nanoseconds === this.nanoseconds }
  valueOf() { return String(this.toMillis()).padStart(16, '0') }
  toJSON() { return { __ts: this.toMillis() } }
}

// ── Sentinele ───────────────────────────────────────────────────────────────
const SENTINEL = Symbol('sentinel')
const sentinel = (kind, value) => ({ [SENTINEL]: kind, value })
export const serverTimestamp = () => sentinel('serverTimestamp')
export const increment = (n) => sentinel('increment', n)
export const arrayUnion = (...items) => sentinel('arrayUnion', items)
export const arrayRemove = (...items) => sentinel('arrayRemove', items)
export const deleteField = () => sentinel('deleteField')

// ── Magazyn ─────────────────────────────────────────────────────────────────
// Mapa: ścieżka kolekcji → Map(id → dane)
let store = new Map()

const clone = (v) => {
  if (v instanceof Timestamp) return new Timestamp(v.seconds, v.nanoseconds)
  if (v instanceof Date) return Timestamp.fromDate(v)
  if (Array.isArray(v)) return v.map(clone)
  if (v && typeof v === 'object') {
    const o = {}
    for (const k of Object.keys(v)) o[k] = clone(v[k])
    return o
  }
  return v
}

const revive = (v) => {
  if (Array.isArray(v)) return v.map(revive)
  if (v && typeof v === 'object') {
    if (typeof v.__ts === 'number' && Object.keys(v).length === 1) return Timestamp.fromMillis(v.__ts)
    const o = {}
    for (const k of Object.keys(v)) o[k] = revive(v[k])
    return o
  }
  return v
}

let saveTimer = null
function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      const obj = {}
      for (const [coll, docs] of store) obj[coll] = Object.fromEntries(docs)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
    } catch (e) { console.warn('[demo] nie udało się zapisać do localStorage', e) }
  }, 150)
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const obj = revive(JSON.parse(raw))
    store = new Map(Object.entries(obj).map(([c, docs]) => [c, new Map(Object.entries(docs))]))
    return true
  } catch { return false }
}

// Wywoływane przez seed: zapis surowego dokumentu z pominięciem nasłuchów.
export function __rawSet(collPath, id, data) {
  if (!store.has(collPath)) store.set(collPath, new Map())
  store.get(collPath).set(id, clone(data))
}

export function __resetDemo({ empty = false } = {}) {
  store = new Map()
  if (!empty) seedDemoData(__rawSet, Timestamp)
  try {
    const obj = {}
    for (const [coll, docs] of store) obj[coll] = Object.fromEntries(docs)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch { /* brak miejsca — trudno */ }
}

if (!load()) __resetDemo()

// ── Referencje ──────────────────────────────────────────────────────────────
let autoId = 0
const newId = () => `demo${Date.now().toString(36)}${(autoId++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

const joinPath = (parts) => parts.flat().map(String).join('/')

class CollectionRef {
  constructor(path) { this.type = 'collection'; this.path = path; this.id = path.split('/').pop() }
}
class DocRef {
  constructor(path) {
    this.type = 'document'
    this.path = path
    const parts = path.split('/')
    this.id = parts.pop()
    this.parent = new CollectionRef(parts.join('/'))
  }
}
class Query {
  constructor(coll, constraints) { this.type = 'query'; this.coll = coll; this.constraints = constraints }
}

export const getFirestore = () => ({ __demo: true })
export const initializeFirestore = () => ({ __demo: true })
export const persistentLocalCache = () => ({})
export const persistentMultipleTabManager = () => ({})
export const connectFirestoreEmulator = () => {}
export const enableNetwork = async () => {}
export const disableNetwork = async () => {}

export function collection(parent, ...segments) {
  const base = parent && parent.path ? [parent.path] : []
  const path = joinPath([...base, ...segments])
  if (path.split('/').length % 2 !== 1) throw new Error(`[demo] ścieżka kolekcji ma parzystą liczbę segmentów: ${path}`)
  return new CollectionRef(path)
}

export function doc(parent, ...segments) {
  if (parent instanceof CollectionRef && segments.length === 0) return new DocRef(`${parent.path}/${newId()}`)
  const base = parent && parent.path ? [parent.path] : []
  const path = joinPath([...base, ...segments])
  if (path.split('/').length % 2 !== 0) throw new Error(`[demo] ścieżka dokumentu ma nieparzystą liczbę segmentów: ${path}`)
  return new DocRef(path)
}

export const where = (field, op, value) => ({ kind: 'where', field, op, value })
export const orderBy = (field, dir = 'asc') => ({ kind: 'orderBy', field, dir })
export const limit = (n) => ({ kind: 'limit', n })
export const limitToLast = (n) => ({ kind: 'limitToLast', n })
export const startAfter = (...v) => ({ kind: 'noop', v })
export const documentId = () => '__name__'

export function query(base, ...constraints) {
  if (base instanceof Query) return new Query(base.coll, [...base.constraints, ...constraints])
  return new Query(base, constraints)
}

// ── Odczyt ──────────────────────────────────────────────────────────────────
const getPath = (obj, field) => field.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

const cmpKey = (v) => {
  if (v instanceof Timestamp) return [3, v.toMillis()]
  if (v === null) return [0, 0]
  if (typeof v === 'boolean') return [1, v ? 1 : 0]
  if (typeof v === 'number') return [2, v]
  if (typeof v === 'string') return [4, v]
  return [5, JSON.stringify(v)]
}
const compare = (a, b) => {
  const [ta, va] = cmpKey(a), [tb, vb] = cmpKey(b)
  if (ta !== tb) return ta - tb
  return va < vb ? -1 : va > vb ? 1 : 0
}
const eq = (a, b) => compare(a, b) === 0 && cmpKey(a)[0] === cmpKey(b)[0]

function matches(data, id, w) {
  const v = w.field === '__name__' ? id : getPath(data, w.field)
  switch (w.op) {
    case '==': return v !== undefined && eq(v, w.value)
    case '!=': return v !== undefined && !eq(v, w.value)
    case '<':  return v !== undefined && cmpKey(v)[0] === cmpKey(w.value)[0] && compare(v, w.value) < 0
    case '<=': return v !== undefined && cmpKey(v)[0] === cmpKey(w.value)[0] && compare(v, w.value) <= 0
    case '>':  return v !== undefined && cmpKey(v)[0] === cmpKey(w.value)[0] && compare(v, w.value) > 0
    case '>=': return v !== undefined && cmpKey(v)[0] === cmpKey(w.value)[0] && compare(v, w.value) >= 0
    case 'array-contains': return Array.isArray(v) && v.some(x => eq(x, w.value))
    case 'array-contains-any': return Array.isArray(v) && v.some(x => w.value.some(y => eq(x, y)))
    case 'in': return v !== undefined && w.value.some(y => eq(v, y))
    case 'not-in': return v !== undefined && !w.value.some(y => eq(v, y))
    default: throw new Error(`[demo] nieobsługiwany operator where: ${w.op}`)
  }
}

class DocSnap {
  constructor(ref, data) { this.ref = ref; this.id = ref.id; this._data = data; this.metadata = { fromCache: false, hasPendingWrites: false } }
  exists() { return this._data !== undefined }
  data() { return this._data === undefined ? undefined : clone(this._data) }
  get(field) { return this._data === undefined ? undefined : clone(getPath(this._data, field)) }
}

class QuerySnap {
  constructor(docs) {
    this.docs = docs
    this.size = docs.length
    this.empty = docs.length === 0
    this.metadata = { fromCache: false, hasPendingWrites: false }
  }
  forEach(fn) { this.docs.forEach(fn) }
  docChanges() { return this.docs.map((d, i) => ({ type: 'added', doc: d, oldIndex: -1, newIndex: i })) }
}

function runQuery(q) {
  const coll = q instanceof Query ? q.coll : q
  const constraints = q instanceof Query ? q.constraints : []
  const docs = store.get(coll.path) || new Map()
  let rows = [...docs.entries()]
  for (const c of constraints) if (c.kind === 'where') rows = rows.filter(([id, d]) => matches(d, id, c))
  const orders = constraints.filter(c => c.kind === 'orderBy')
  // Prawdziwy Firestore nie zwraca dokumentów, którym brakuje pola z orderBy.
  for (const o of orders) rows = rows.filter(([, d]) => getPath(d, o.field) !== undefined)
  if (orders.length) {
    rows.sort((a, b) => {
      for (const o of orders) {
        const r = compare(getPath(a[1], o.field), getPath(b[1], o.field))
        if (r) return o.dir === 'desc' ? -r : r
      }
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
    })
  } else {
    rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  }
  for (const c of constraints) {
    if (c.kind === 'limit') rows = rows.slice(0, c.n)
    if (c.kind === 'limitToLast') rows = rows.slice(-c.n)
  }
  return new QuerySnap(rows.map(([id, d]) => new DocSnap(new DocRef(`${coll.path}/${id}`), d)))
}

function readDoc(ref) {
  const coll = store.get(ref.parent.path)
  return new DocSnap(ref, coll ? coll.get(ref.id) : undefined)
}

// Lekkie opóźnienie, żeby spinner „Ładowanie…" mignął jak w prawdziwej apce.
const tick = () => new Promise(r => setTimeout(r, 30))

export async function getDocs(q) { await tick(); return runQuery(q) }
export async function getDoc(ref) { await tick(); return readDoc(ref) }
export const getDocsFromCache = getDocs
export const getDocFromCache = getDoc
export const getDocsFromServer = getDocs
export const getDocFromServer = getDoc

// ── Nasłuchy ────────────────────────────────────────────────────────────────
const listeners = new Set()

export function onSnapshot(target, ...args) {
  let opts = null
  if (args[0] && typeof args[0] === 'object' && typeof args[0] !== 'function' && !('next' in args[0])) opts = args.shift()
  let [onNext, onError] = args
  if (onNext && typeof onNext === 'object') { onError = onNext.error; onNext = onNext.next }
  void opts
  const l = {
    target,
    fire() {
      try { onNext(target instanceof DocRef ? readDoc(target) : runQuery(target)) }
      catch (e) { console.error('[demo] wyjątek w callbacku onSnapshot', e); if (onError) onError(e) }
    },
  }
  listeners.add(l)
  setTimeout(() => { if (listeners.has(l)) l.fire() }, 40)
  return () => { listeners.delete(l) }
}

let notifyScheduled = false
const dirty = new Set()
function notify(collPath) {
  dirty.add(collPath)
  persist()
  if (notifyScheduled) return
  notifyScheduled = true
  queueMicrotask(() => {
    notifyScheduled = false
    const paths = new Set(dirty); dirty.clear()
    for (const l of [...listeners]) {
      const p = l.target instanceof DocRef ? l.target.parent.path : (l.target instanceof Query ? l.target.coll.path : l.target.path)
      if (paths.has(p)) l.fire()
    }
  })
}

// ── Zapis ───────────────────────────────────────────────────────────────────
const isSentinel = (v) => v && typeof v === 'object' && SENTINEL in v

function applySentinel(current, s) {
  switch (s[SENTINEL]) {
    case 'serverTimestamp': return Timestamp.now()
    case 'increment': return (typeof current === 'number' ? current : 0) + s.value
    case 'arrayUnion': {
      const arr = Array.isArray(current) ? [...current] : []
      for (const it of s.value) if (!arr.some(x => eq(x, it) && JSON.stringify(x) === JSON.stringify(it))) arr.push(clone(it))
      return arr
    }
    case 'arrayRemove': {
      const arr = Array.isArray(current) ? current : []
      return arr.filter(x => !s.value.some(it => JSON.stringify(clone(it)) === JSON.stringify(x)))
    }
    default: return undefined
  }
}

// Rozwiązuje sentinele w danych do setDoc (bez merge).
function resolveAll(v) {
  if (isSentinel(v)) return v[SENTINEL] === 'deleteField' ? undefined : applySentinel(undefined, v)
  if (v instanceof Timestamp || v instanceof Date) return clone(v)
  if (Array.isArray(v)) return v.map(resolveAll)
  if (v && typeof v === 'object') {
    const o = {}
    for (const k of Object.keys(v)) { const r = resolveAll(v[k]); if (r !== undefined) o[k] = r }
    return o
  }
  return v
}

const isPlainObj = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Timestamp) && !(v instanceof Date) && !isSentinel(v)

function deepMerge(target, patch) {
  const out = { ...target }
  for (const k of Object.keys(patch)) {
    const v = patch[k]
    if (isSentinel(v)) {
      if (v[SENTINEL] === 'deleteField') delete out[k]
      else out[k] = applySentinel(out[k], v)
    } else if (isPlainObj(v)) {
      out[k] = deepMerge(isPlainObj(out[k]) ? out[k] : {}, v)
    } else {
      out[k] = resolveAll(v)
    }
  }
  return out
}

function setPath(obj, dotted, value) {
  const keys = dotted.split('.')
  const out = { ...obj }
  let cur = out
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = isPlainObj(cur[keys[i]]) ? { ...cur[keys[i]] } : {}
    cur = cur[keys[i]]
  }
  const last = keys[keys.length - 1]
  if (isSentinel(value)) {
    if (value[SENTINEL] === 'deleteField') delete cur[last]
    else cur[last] = applySentinel(cur[last], value)
  } else {
    cur[last] = resolveAll(value)
  }
  return out
}

const notFound = (ref) => Object.assign(new Error(`[demo] No document to update: ${ref.path}`), { code: 'not-found', name: 'FirebaseError' })

function checkData(data, where) {
  const bad = (v, p) => {
    if (v === undefined) throw Object.assign(new Error(`[demo] ${where}: pole „${p}" ma wartość undefined — prawdziwy Firestore odrzuciłby ten zapis`), { code: 'invalid-argument' })
    if (Array.isArray(v)) v.forEach((x, i) => bad(x, `${p}[${i}]`))
    else if (isPlainObj(v)) for (const k of Object.keys(v)) bad(v[k], p ? `${p}.${k}` : k)
  }
  bad(data, '')
}

function writeSet(ref, data, opts) {
  checkData(data, `setDoc(${ref.path})`)
  if (!store.has(ref.parent.path)) store.set(ref.parent.path, new Map())
  const coll = store.get(ref.parent.path)
  const prev = coll.get(ref.id)
  coll.set(ref.id, opts && (opts.merge || opts.mergeFields) ? deepMerge(prev || {}, data) : resolveAll(data))
  notify(ref.parent.path)
}

function writeUpdate(ref, data) {
  checkData(data, `updateDoc(${ref.path})`)
  const coll = store.get(ref.parent.path)
  if (!coll || !coll.has(ref.id)) throw notFound(ref)
  let cur = coll.get(ref.id)
  for (const k of Object.keys(data)) cur = setPath(cur, k, data[k])
  coll.set(ref.id, cur)
  notify(ref.parent.path)
}

function writeDelete(ref) {
  const coll = store.get(ref.parent.path)
  if (coll) coll.delete(ref.id)
  notify(ref.parent.path)
}

export async function addDoc(collRef, data) {
  const ref = doc(collRef)
  writeSet(ref, data)
  await tick()
  return ref
}
export async function setDoc(ref, data, opts) { writeSet(ref, data, opts); await tick() }
export async function updateDoc(ref, data, ...rest) {
  // Wariant updateDoc(ref, 'pole', wartość, 'pole2', wartość2…)
  if (typeof data === 'string') {
    const obj = { [data]: rest[0] }
    for (let i = 1; i < rest.length; i += 2) obj[rest[i]] = rest[i + 1]
    data = obj
  }
  writeUpdate(ref, data); await tick()
}
export async function deleteDoc(ref) { writeDelete(ref); await tick() }

export function writeBatch() {
  const ops = []
  const b = {
    set(ref, data, opts) { ops.push(() => writeSet(ref, data, opts)); return b },
    update(ref, data) { ops.push(() => writeUpdate(ref, data)); return b },
    delete(ref) { ops.push(() => writeDelete(ref)); return b },
    async commit() {
      // Atomowo: najpierw sprawdzamy updateDoc na brakujących dokumentach.
      const snapshot = new Map([...store].map(([k, v]) => [k, new Map(v)]))
      try { ops.forEach(op => op()) }
      catch (e) { store = snapshot; throw e }
      await tick()
    },
  }
  return b
}

export async function runTransaction(_db, fn) {
  const tx = {
    get: (ref) => Promise.resolve(readDoc(ref)),
    set(ref, data, opts) { writeSet(ref, data, opts); return tx },
    update(ref, data) { writeUpdate(ref, data); return tx },
    delete(ref) { writeDelete(ref); return tx },
  }
  return fn(tx)
}

export async function getCountFromServer(q) {
  const s = runQuery(q)
  return { data: () => ({ count: s.size }) }
}
