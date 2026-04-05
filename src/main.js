import { fetchRoadReferenceNear } from './nvdbVegref.js'
import {
  initVegrefLive,
  vegrefNotifyGps,
  vegrefStopPipeline,
  vegrefReapplyLastToDom,
  vegrefHasLastDisplay,
  vegrefResetSessionCache,
  vegrefResetThrottle,
} from './vegrefLive.js'
import { ensureLeaflet, Leaflet } from './leafletLazy.js'
import { getSupabase, isSupabaseConfigured } from './supabaseClient.js'
import { syncLaunchSplash } from './launchTransition.js'
import appPackage from '../package.json'
import {
  buildCurrentUserFromSession,
  deleteSessionShareRow,
  fetchIncomingSessionShares,
  fetchUserAppState,
  sendSessionShare,
  upsertUserAppState,
} from './supabaseSync.js'
import { apiUrl, hintApiNotFound } from './apiBase.js'

const STORAGE_KEY_V2 = 'scanix-sessions-v2'
const LEGACY_STORAGE_KEY = 'count-clicker-v1'
const AUTH_USERS_KEY = 'scanix-users-v1'
const AUTH_SESSION_KEY = 'scanix-auth-session'
const AUTH_IDB_NAME = 'scanix-auth-v1'
const AUTH_IDB_VERSION = 1
const AUTH_IDB_STORE = 'kv'
const AUTH_IDB_KEY_USERS = 'users-v1'
const AUTH_IDB_KEY_SESSION = 'session-v1'
const SESSION_TITLE_MAX_LEN = 120
const SESSION_REGISTERED_NOTE_MAX_LEN = 2000
const AUTH_PASSWORD_MIN_LEN = 8
const AUTH_NAME_MAX_LEN = 120
const AUTH_SHORT_ID_LEN = 5


/**
 * @param {unknown} s
 * @returns {s is string}
 */
function isValidStoredShortId(s) {
  return typeof s === 'string' && /^[0-9]{5}$/.test(s)
}

/**
 * @param {Set<string>} used
 * @returns {string}
 */
function allocUniqueShortId(used) {
  for (let i = 0; i < 500; i++) {
    const n = Math.floor(Math.random() * 100000)
    const sid = String(n).padStart(AUTH_SHORT_ID_LEN, '0')
    if (!used.has(sid)) {
      used.add(sid)
      return sid
    }
  }
  for (let n = 0; n < 100000; n++) {
    const sid = String(n).padStart(AUTH_SHORT_ID_LEN, '0')
    if (!used.has(sid)) {
      used.add(sid)
      return sid
    }
  }
  return String(Date.now() % 100000).padStart(AUTH_SHORT_ID_LEN, '0')
}

/**
 * Sikrer unikt 5-sifret shortId per bruker (migrering + duplikatretting).
 * @param {unknown[]} users
 * @returns {{ users: unknown[], changed: boolean }}
 */
function ensureUserShortIds(users) {
  if (!Array.isArray(users)) return { users: [], changed: false }
  const out = users.map((u) =>
    u && typeof u === 'object' ? { ...u } : u,
  )
  const taken = new Set()
  let changed = false
  for (let i = 0; i < out.length; i++) {
    const u = out[i]
    if (!u || typeof u !== 'object') continue
    const row = /** @type {{ shortId?: string }} */ (u)
    const orig = users[i]
    const origSid =
      orig && typeof orig === 'object'
        ? /** @type {{ shortId?: string }} */ (orig).shortId
        : undefined
    const sid = row.shortId
    if (isValidStoredShortId(sid) && !taken.has(sid)) {
      taken.add(sid)
      if (origSid !== sid) changed = true
      continue
    }
    const next = allocUniqueShortId(taken)
    if (row.shortId !== next) changed = true
    row.shortId = next
  }
  return { users: out, changed }
}

/**
 * @param {string} userId
 * @returns {string}
 */
function sessionsKeyForUser(userId) {
  return `${STORAGE_KEY_V2}-user-${userId}`
}

function contactsStorageKeyForUser(userId) {
  return `scanix-contacts-v1-user-${userId}`
}

/** Lokal liste over session_shares-rader brukeren har åpnet (uleste = ikke i settet). */
function seenIncomingSharesKeyForUser(userId) {
  return `scanix-seen-incoming-shares-v1-user-${userId}`
}

/** @returns {Set<string>} */
function loadSeenIncomingShareIds() {
  if (!currentUser?.id) return new Set()
  try {
    const raw = localStorage.getItem(
      seenIncomingSharesKeyForUser(currentUser.id),
    )
    if (!raw) return new Set()
    const p = JSON.parse(raw)
    if (!Array.isArray(p)) return new Set()
    return new Set(p.filter((x) => typeof x === 'string' && x.length > 0))
  } catch {
    return new Set()
  }
}

/** @param {Set<string>} set */
function persistSeenIncomingShareIds(set) {
  if (!currentUser?.id) return
  try {
    localStorage.setItem(
      seenIncomingSharesKeyForUser(currentUser.id),
      JSON.stringify([...set]),
    )
  } catch {
    /* quota */
  }
}

/** Fjerner id-er som ikke lenger finnes (f.eks. etter «Fjern»). */
function pruneSeenIncomingSharesNotInRows(validIds) {
  if (!currentUser?.id) return
  const set = loadSeenIncomingShareIds()
  let changed = false
  for (const id of set) {
    if (!validIds.has(id)) {
      set.delete(id)
      changed = true
    }
  }
  if (changed) persistSeenIncomingShareIds(set)
}

/**
 * Marker deling som lest og oppdaterer badge (kun uleste teller).
 * @param {string} shareRowId
 */
function markIncomingShareSeen(shareRowId) {
  if (typeof shareRowId !== 'string' || !shareRowId || !currentUser?.id) return
  const set = loadSeenIncomingShareIds()
  if (set.has(shareRowId)) {
    void refreshIncomingSharesPanel()
    return
  }
  set.add(shareRowId)
  persistSeenIncomingShareIds(set)
  void refreshIncomingSharesPanel()
}

function uint8ToB64(u8) {
  let bin = ''
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
  return btoa(bin)
}

function b64ToUint8(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function randomSaltB64() {
  const s = new Uint8Array(16)
  crypto.getRandomValues(s)
  return uint8ToB64(s)
}

/**
 * @param {string} password
 * @param {string} saltB64
 * @returns {Promise<string>}
 */
async function hashPasswordWithSalt(password, saltB64) {
  const salt = b64ToUint8(saltB64)
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 150_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )
  return uint8ToB64(new Uint8Array(bits))
}

function loadUsersFromStorage() {
  const raw = localStorage.getItem(AUTH_USERS_KEY)
  if (!raw) return []
  try {
    const p = JSON.parse(raw)
    const arr = Array.isArray(p.users) ? p.users : []
    const { users, changed } = ensureUserShortIds(arr)
    if (changed) tryWriteUsersToStorage(users)
    return users
  } catch {
    return []
  }
}

/**
 * @returns {{ id: string, name: string, email: string, shortId?: string } | null}
 */
function loadAuthSession() {
  const raw = localStorage.getItem(AUTH_SESSION_KEY)
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (typeof p.userId !== 'string' || typeof p.email !== 'string') return null
    const name =
      typeof p.name === 'string' && p.name.trim()
        ? p.name.trim().slice(0, AUTH_NAME_MAX_LEN)
        : 'Bruker'
    const base = { id: p.userId, name, email: p.email }
    if (isValidStoredShortId(p.shortId)) {
      return { ...base, shortId: p.shortId }
    }
    return base
  } catch {
    return null
  }
}

/**
 * @param {{ id: string, name: string, email: string, shortId?: string }} u
 */
function saveAuthSession(u) {
  localStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({
      userId: u.id,
      name: u.name,
      email: u.email,
      ...(isValidStoredShortId(u.shortId) ? { shortId: u.shortId } : {}),
    }),
  )
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_KEY)
}

function tryWriteUsersToStorage(users) {
  try {
    localStorage.setItem(
      AUTH_USERS_KEY,
      JSON.stringify({ version: 1, users }),
    )
    return true
  } catch {
    return false
  }
}

function tryWriteAuthSession(u) {
  try {
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({
        userId: u.id,
        name: u.name,
        email: u.email,
        ...(isValidStoredShortId(u.shortId) ? { shortId: u.shortId } : {}),
      }),
    )
    return true
  } catch {
    return false
  }
}

function verifyUserInStorage(userId) {
  return loadUsersFromStorage().some((x) => x.id === userId)
}

function verifyAuthSessionForUser(userId) {
  const s = loadAuthSession()
  return s?.id === userId
}

function syncShortIdFromUsersToSession() {
  if (isSupabaseConfigured()) return
  if (!currentUser?.id) return
  if (isValidStoredShortId(currentUser.shortId)) return
  const users = loadUsersFromStorage()
  const row = users.find(
    (x) =>
      x &&
      typeof x === 'object' &&
      /** @type {{ id?: string }} */ (x).id === currentUser.id,
  )
  const sid =
    row && typeof row === 'object'
      ? /** @type {{ shortId?: string }} */ (row).shortId
      : undefined
  if (!isValidStoredShortId(sid)) return
  currentUser = { ...currentUser, shortId: sid }
  tryWriteAuthSession(currentUser)
  void backupAuthToIdb(users, currentUser)
}

function authStorageFailedUserMessage() {
  return 'Kunne ikke lagre på enheten. Sjekk at du ikke bruker privat nettlesing. Bruk også alltid samme adresse (samme domene og samme port), ellers finner ikke appen brukeren din.'
}

async function requestPersistedStorageIfSupported() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist()
  } catch {
    /* ignore */
  }
}

function openAuthIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(AUTH_IDB_NAME, AUTH_IDB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = /** @type {IDBDatabase} */ (e.target).result
      if (!db.objectStoreNames.contains(AUTH_IDB_STORE)) {
        db.createObjectStore(AUTH_IDB_STORE)
      }
    }
  })
}

/**
 * @param {string} key
 * @param {string} val
 */
async function idbPutString(key, val) {
  const db = await openAuthIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUTH_IDB_STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(AUTH_IDB_STORE).put(val, key)
  })
}

/** @param {string} key */
async function idbGetString(key) {
  const db = await openAuthIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUTH_IDB_STORE, 'readonly')
    const r = tx.objectStore(AUTH_IDB_STORE).get(key)
    r.onsuccess = () => resolve(typeof r.result === 'string' ? r.result : null)
    r.onerror = () => reject(r.error)
  })
}

/** @param {string} key */
async function idbDeleteKey(key) {
  const db = await openAuthIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUTH_IDB_STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(AUTH_IDB_STORE).delete(key)
  })
}

/**
 * Speiler brukerliste + innlogget sesjon til IndexedDB (ofte mer robust på mobil enn kun localStorage).
 * @param {unknown[]} users
 * @param {{ id: string, name: string, email: string, shortId?: string } | null} sessionUser
 */
async function backupAuthToIdb(users, sessionUser) {
  try {
    await idbPutString(
      AUTH_IDB_KEY_USERS,
      JSON.stringify({ version: 1, users }),
    )
    if (sessionUser) {
      await idbPutString(
        AUTH_IDB_KEY_SESSION,
        JSON.stringify({
          userId: sessionUser.id,
          name: sessionUser.name,
          email: sessionUser.email,
          ...(isValidStoredShortId(sessionUser.shortId)
            ? { shortId: sessionUser.shortId }
            : {}),
        }),
      )
    } else {
      await idbDeleteKey(AUTH_IDB_KEY_SESSION)
    }
  } catch {
    /* ignore */
  }
}

/** Gjenoppretter localStorage fra IDB hvis nøkler mangler (samme opprinnelse). */
async function restoreAuthFromIdbIfLocalEmpty() {
  try {
    const hasUsers = !!localStorage.getItem(AUTH_USERS_KEY)
    const hasSess = !!localStorage.getItem(AUTH_SESSION_KEY)
    if (hasUsers && hasSess) return

    const rawUsers = await idbGetString(AUTH_IDB_KEY_USERS)
    const rawSess = await idbGetString(AUTH_IDB_KEY_SESSION)

    if (!hasUsers && rawUsers) {
      const p = JSON.parse(rawUsers)
      if (Array.isArray(p.users) && p.users.length) {
        tryWriteUsersToStorage(p.users)
      }
    }

    if (!hasSess && rawSess) {
      const p = JSON.parse(rawSess)
      if (typeof p.userId === 'string' && typeof p.email === 'string') {
        tryWriteAuthSession({
          id: p.userId,
          name:
            typeof p.name === 'string' && p.name.trim()
              ? p.name.trim().slice(0, AUTH_NAME_MAX_LEN)
              : 'Bruker',
          email: p.email,
          ...(isValidStoredShortId(p.shortId) ? { shortId: p.shortId } : {}),
        })
      }
    }
  } catch {
    /* ignore */
  }
}

function isValidEmail(s) {
  if (typeof s !== 'string') return false
  const t = s.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

/** @type {{ id: string, name: string, email: string, shortId?: string } | null} */
let currentUser = null
/**
 * Maks punkt per Google Maps-lenke (offisiellt format med api=1).
 * Mobil: maks 3 waypoints → 5 punkt totalt (start + 3 mellom + slutt).
 * @see https://developers.google.com/maps/documentation/urls/get-started#directions-action
 */
const MAPS_DIR_MAX_POINTS_PER_LINK = 5

/** @type {{ id: string, label: string }[]} */
const OBJECT_CATEGORY_DEFS = [
  { id: 'broytestikker', label: 'Brøytestikker' },
  { id: 'skilt', label: 'Skilt' },
  { id: 'lys', label: 'Lys' },
  { id: 'hull_i_veg', label: 'Hull i veg' },
  { id: 'rekkverk', label: 'Rekkverk' },
  { id: 'stikkrenne', label: 'Stikkrenne' },
  { id: 'annet', label: 'Annet' },
]

function normalizeObjectCategoryList(arr) {
  if (!Array.isArray(arr)) return []
  const want = new Set(arr.filter((id) => typeof id === 'string'))
  return OBJECT_CATEGORY_DEFS.map((d) => d.id).filter((id) => want.has(id))
}

/** @param {string} id */
function getObjectCategoryLabel(id) {
  const d = OBJECT_CATEGORY_DEFS.find((x) => x.id === id)
  return d ? d.label : id
}

function defaultState() {
  return {
    count: 0,
    clickHistory: [],
    log: [],
    roadSide: null,
    photos: [],
    objectCategories: [],
    activeCategoryId: null,
  }
}

function nowIso() {
  return new Date().toISOString()
}

/**
 * @param {unknown} vr
 * @returns {{ road: string, compact: string, kortform: string } | null}
 */
function normalizePhotoVegref(vr) {
  if (!vr || typeof vr !== 'object') return null
  const o = /** @type {{ road?: unknown, compact?: unknown, kortform?: unknown }} */ (vr)
  const road = typeof o.road === 'string' ? o.road.trim() : ''
  const compact = typeof o.compact === 'string' ? o.compact.trim() : ''
  const kortform = typeof o.kortform === 'string' ? o.kortform.trim() : ''
  if (!road && !compact && !kortform) return null
  return { road, compact, kortform }
}

/**
 * @param {{ road: string, compact: string, kortform: string }} v
 */
function formatPhotoVegrefOverlayLinesHtml(v) {
  const parts = []
  if (v.road) {
    parts.push(
      `<div class="photo-vegref-overlay__road">${escapeHtml(v.road)}</div>`,
    )
  }
  if (v.compact) {
    parts.push(
      `<div class="photo-vegref-overlay__compact">${escapeHtml(v.compact)}</div>`,
    )
  }
  if (v.kortform) {
    parts.push(
      `<div class="photo-vegref-overlay__kf">${escapeHtml(v.kortform)}</div>`,
    )
  }
  return parts.join('')
}

/**
 * @param {{ road: string, compact: string, kortform: string }} v
 * @param {'thumb' | 'fullscreen'} variant
 */
function formatPhotoVegrefOverlayHtml(v, variant) {
  const inner = formatPhotoVegrefOverlayLinesHtml(v)
  if (!inner) return ''
  const cls =
    variant === 'fullscreen'
      ? 'photo-vegref-overlay photo-vegref-overlay--fullscreen'
      : 'photo-vegref-overlay photo-vegref-overlay--thumb'
  return `<div class="${cls}" aria-hidden="true">${inner}</div>`
}

function normalizePhoto(p) {
  if (!p || typeof p !== 'object') return null
  const dataUrl =
    typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:image/')
      ? p.dataUrl
      : null
  if (!dataUrl) return null
  const rawLat = p.lat != null ? p.lat : p.latitude
  const rawLng = p.lng != null ? p.lng : p.longitude
  const vegref = normalizePhotoVegref(
    /** @type {{ vegref?: unknown }} */ (p).vegref,
  )
  return {
    id: typeof p.id === 'string' ? p.id : crypto.randomUUID(),
    timestamp: typeof p.timestamp === 'string' ? p.timestamp : nowIso(),
    lat:
      rawLat != null && !Number.isNaN(Number(rawLat)) ? Number(rawLat) : null,
    lng:
      rawLng != null && !Number.isNaN(Number(rawLng)) ? Number(rawLng) : null,
    dataUrl,
    ...(vegref ? { vegref } : {}),
  }
}

function normalizeStandalonePhotosList(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map(normalizePhoto).filter(Boolean)
}

function mergeStandalonePhotoLists(a, b) {
  const m = new Map()
  for (const p of [...a, ...b]) {
    if (!p?.id) continue
    const ex = m.get(p.id)
    if (!ex) {
      m.set(p.id, p)
      continue
    }
    const ta = typeof ex.timestamp === 'string' ? ex.timestamp : ''
    const tb = typeof p.timestamp === 'string' ? p.timestamp : ''
    m.set(p.id, tb >= ta ? p : ex)
  }
  return [...m.values()].sort((x, y) => {
    const ta = typeof x.timestamp === 'string' ? x.timestamp : ''
    const tb = typeof y.timestamp === 'string' ? y.timestamp : ''
    return ta.localeCompare(tb)
  })
}

/**
 * Slår sammen to clickHistory-lister uten å miste oppføringer (f.eks. flere faner).
 * Eldre oppføringer uten `id` dedupliseres grovt på timestamp+koordinater.
 * @param {unknown[]} a
 * @param {unknown[]} b
 */
function mergeClickHistoryArrays(a, b) {
  const byId = new Map()
  const seenLegacy = new Set()
  for (const c of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    if (!c || typeof c !== 'object') continue
    const id = /** @type {{ id?: string }} */ (c).id
    if (typeof id === 'string' && id) {
      byId.set(id, c)
      continue
    }
    const ts = /** @type {{ timestamp?: string }} */ (c).timestamp ?? ''
    const lat = /** @type {{ lat?: number | null }} */ (c).lat
    const lng = /** @type {{ lng?: number | null }} */ (c).lng
    const key = `${ts}|${lat}|${lng}`
    if (seenLegacy.has(key)) continue
    seenLegacy.add(key)
    byId.set(`legacy:${key}`, c)
  }
  return [...byId.values()].sort(
    (x, y) =>
      new Date(
        /** @type {{ timestamp?: string }} */ (x).timestamp || 0,
      ).getTime() -
      new Date(/** @type {{ timestamp?: string }} */ (y).timestamp || 0).getTime(),
  )
}

/**
 * Slår sammen to økt-objekter fra localStorage (typisk to faner).
 * @param {ReturnType<typeof normalizeSession>} local
 * @param {ReturnType<typeof normalizeSession>} remote
 */
function mergeStoredSessionsPair(local, remote) {
  const mergedClicks = mergeClickHistoryArrays(
    local.clickHistory,
    remote.clickHistory,
  )
  const tLocal = new Date(local.updatedAt || 0).getTime()
  const tRemote = new Date(remote.updatedAt || 0).getTime()
  const base = tRemote >= tLocal ? { ...remote } : { ...local }
  return normalizeSession({
    ...base,
    clickHistory: mergedClicks,
    count: mergedClicks.length,
  })
}

function normalizeSession(p) {
  if (!p || typeof p !== 'object') return null
  const rs = p.roadSide
  const roadSide =
    rs === 'hoyre' || rs === 'venstre' || rs === 'begge' ? rs : null
  let title = null
  if (typeof p.title === 'string') {
    const t = p.title.trim().slice(0, SESSION_TITLE_MAX_LEN)
    if (t) title = t
  }
  let registeredNote = null
  if (typeof p.registeredNote === 'string') {
    const n = p.registeredNote.trim().slice(0, SESSION_REGISTERED_NOTE_MAX_LEN)
    if (n) registeredNote = n
  }
  const objectCategories = normalizeObjectCategoryList(p.objectCategories)
  let activeCategoryId = null
  if (
    typeof p.activeCategoryId === 'string' &&
    objectCategories.includes(p.activeCategoryId)
  ) {
    activeCategoryId = p.activeCategoryId
  } else if (objectCategories.length === 1) {
    activeCategoryId = objectCategories[0]
  } else if (objectCategories.length > 1) {
    activeCategoryId = objectCategories[0]
  }
  return {
    id: typeof p.id === 'string' ? p.id : crypto.randomUUID(),
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : nowIso(),
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : nowIso(),
    title,
    registeredNote,
    count: typeof p.count === 'number' ? p.count : 0,
    clickHistory: Array.isArray(p.clickHistory) ? p.clickHistory : [],
    log: Array.isArray(p.log) ? p.log : [],
    roadSide,
    photos: Array.isArray(p.photos)
      ? p.photos.map(normalizePhoto).filter(Boolean)
      : [],
    objectCategories,
    activeCategoryId,
  }
}

/**
 * Laster økter for innlogget bruker. Migrerer eldre `scanix-sessions-v2` til per-bruker-nøkkel én gang.
 * @param {string} userId
 */
function loadAppStateFromStorageForUser(userId) {
  const key = sessionsKeyForUser(userId)
  let rawV2 = localStorage.getItem(key)
  if (!rawV2) {
    const legacy = localStorage.getItem(STORAGE_KEY_V2)
    if (legacy) {
      rawV2 = legacy
      try {
        localStorage.setItem(key, legacy)
      } catch {
        /* quota */
      }
    }
  }
  if (rawV2) {
    try {
      const p = JSON.parse(rawV2)
      const sess = Array.isArray(p.sessions)
        ? p.sessions.map(normalizeSession).filter(Boolean)
        : []
      return {
        sessions: sess,
        currentSessionId:
          typeof p.currentSessionId === 'string' ? p.currentSessionId : null,
        standalonePhotos: normalizeStandalonePhotosList(p.standalonePhotos),
      }
    } catch {
      /* fall through */
    }
  }
  const rawLegacy = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (rawLegacy) {
    try {
      const p = JSON.parse(rawLegacy)
      const session = normalizeSession({
        id: crypto.randomUUID(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        count: p.count,
        clickHistory: p.clickHistory,
        log: p.log,
      })
      const blob = { version: 2, sessions: [session], currentSessionId: null }
      const migrated = JSON.stringify(blob)
      try {
        localStorage.setItem(STORAGE_KEY_V2, migrated)
        localStorage.setItem(key, migrated)
      } catch {
        /* quota */
      }
      return {
        sessions: [session],
        currentSessionId: null,
        standalonePhotos: [],
      }
    } catch {
      /* fall through */
    }
  }
  return { sessions: [], currentSessionId: null, standalonePhotos: [] }
}

function saveAppState() {
  if (!currentUser?.id) return
  const key = sessionsKeyForUser(currentUser.id)
  let diskSessions = []
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const disk = JSON.parse(raw)
      diskSessions = Array.isArray(disk.sessions)
        ? disk.sessions.map(normalizeSession).filter(Boolean)
        : []
    }
  } catch {
    /* ignore corrupt disk */
  }
  const diskById = new Map(diskSessions.map((s) => [s.id, s]))
  const memIds = new Set(sessions.map((s) => s.id))
  let mergedChanged = false
  const mergedSessions = sessions.map((local) => {
    const disk = diskById.get(local.id)
    if (!disk) return local
    const mergedClicks = mergeClickHistoryArrays(
      local.clickHistory,
      disk.clickHistory,
    )
    const localLen = local.clickHistory?.length ?? 0
    const diskLen = disk.clickHistory?.length ?? 0
    if (mergedClicks.length === localLen && localLen === diskLen) return local
    mergedChanged = true
    return {
      ...local,
      clickHistory: mergedClicks,
      count: mergedClicks.length,
      updatedAt: nowIso(),
    }
  })
  for (const d of diskSessions) {
    if (!memIds.has(d.id)) mergedSessions.push(d)
  }
  sessions = mergedSessions
  if (currentSessionId && mergedChanged) {
    const prevChLen = state.clickHistory.length
    state = loadCurrentSessionState()
    if (view === 'session' && map && state.clickHistory.length !== prevChLen) {
      rebuildMarkers()
      renderCount()
      renderLog()
      renderPhotosGallery()
      updateMapSharePanel()
    }
  }
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 2,
        sessions,
        currentSessionId,
        standalonePhotos,
      }),
    )
  } catch {
    /* quota */
  }
  if (isSupabaseConfigured()) scheduleSupabaseAppStatePush()
}

function loadCurrentSessionState() {
  if (!currentSessionId) return defaultState()
  const s = sessions.find((x) => x.id === currentSessionId)
  if (!s) return defaultState()
  const objectCategories = normalizeObjectCategoryList(s.objectCategories)
  let activeCategoryId = null
  if (
    typeof s.activeCategoryId === 'string' &&
    objectCategories.includes(s.activeCategoryId)
  ) {
    activeCategoryId = s.activeCategoryId
  } else if (objectCategories.length === 1) {
    activeCategoryId = objectCategories[0]
  } else if (objectCategories.length > 1) {
    activeCategoryId = objectCategories[0]
  }
  return {
    count: s.count,
    clickHistory: [...s.clickHistory],
    log: [...s.log],
    roadSide: s.roadSide ?? null,
    photos: Array.isArray(s.photos)
      ? s.photos.map(normalizePhoto).filter(Boolean)
      : [],
    objectCategories,
    activeCategoryId,
  }
}

function formatSessionTitle(session) {
  if (!session?.createdAt) return 'Oppdrag'
  return new Intl.DateTimeFormat('nb-NO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(session.createdAt))
}

function formatSessionDisplayTitle(session) {
  if (!session) return 'Oppdrag'
  if (typeof session.title === 'string' && session.title.trim()) {
    return session.title.trim().slice(0, SESSION_TITLE_MAX_LEN)
  }
  return formatSessionTitle(session)
}

/** @param {'hoyre' | 'venstre' | 'begge' | null | undefined} rs */
function formatRoadSideLabel(rs) {
  if (rs === 'hoyre') return 'Høyre side av vegen'
  if (rs === 'venstre') return 'Venstre side av vegen'
  if (rs === 'begge') return 'Begge sider av vegen'
  return ''
}

function sortSessionsByUpdated() {
  return [...sessions].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

let sessions = []
let currentSessionId = null
/** Bilder fra «Ta bilde» på forsiden (uten aktiv økt). */
let standalonePhotos = []
/** @type {'home' | 'menuSession' | 'menuUser' | 'menuMap' | 'menuContacts' | 'menuSettings' | 'menuPrivacy' | 'menuSupport' | 'session' | 'auth' | 'inbox' | 'photoAlbum' | 'receivedPhotos'} */
let view = 'home'
/** Faner under «Økten»: oversikt, gjenoppta, last ned, importer. */
let menuSessionTab = 'sessions'
/** Kart på meny-siden «Kart» (uten aktiv økt). */
let menuBrowseMap = null
/** Rad i session_shares mens brukeren forhåndsviser en delt økt (før lagre / forkast). */
let previewIncomingShareId = null
/** @type {'login' | 'register'} */
let authScreen = 'login'

/** @type {ReturnType<typeof defaultState>} */
let state

/** @type {ReturnType<typeof setTimeout> | null} */
let supabaseSaveTimer = null

/** Unngå dobbel nullstilling når `logoutUser` allerede håndterer UI etter `signOut`. */
let ignoreNextSupabaseSignedOut = false

function cancelSupabaseAppStatePush() {
  if (supabaseSaveTimer) {
    clearTimeout(supabaseSaveTimer)
    supabaseSaveTimer = null
  }
}

function scheduleSupabaseAppStatePush() {
  if (!isSupabaseConfigured() || !currentUser?.id) return
  const sb = getSupabase()
  if (!sb) return
  cancelSupabaseAppStatePush()
  supabaseSaveTimer = setTimeout(() => {
    supabaseSaveTimer = null
    const uid = currentUser?.id
    if (!uid) return
    void upsertUserAppState(sb, uid, {
      version: 2,
      sessions,
      currentSessionId,
      standalonePhotos,
    })
  }, 1600)
}

/** @param {import('@supabase/supabase-js').AuthError | Error | null} err */
function mapSupabaseAuthError(err) {
  const m = err && typeof err.message === 'string' ? err.message : ''
  if (m.includes('Invalid login credentials')) {
    return 'Ukjent e-post eller feil passord.'
  }
  if (
    m.includes('User already registered') ||
    m.includes('already been registered')
  ) {
    return 'E-posten er allerede registrert.'
  }
  if (m.includes('Password should be at least')) {
    return `Passord må minst ${AUTH_PASSWORD_MIN_LEN} tegn.`
  }
  if (m.includes('Email not confirmed')) {
    return 'Bekreft e-postadressen din (lenke i e-post), deretter logg inn.'
  }
  return m || 'Noe gikk galt. Prøv igjen.'
}

async function initAppStateFromStorage() {
  await restoreAuthFromIdbIfLocalEmpty()
  loadUsersFromStorage()

  const sb = getSupabase()
  if (sb) {
    const {
      data: { session },
      error: sessErr,
    } = await sb.auth.getSession()
    if (sessErr) console.warn('Supabase getSession:', sessErr.message)
    if (session?.user) {
      try {
        currentUser = await buildCurrentUserFromSession(sb, session)
        tryWriteAuthSession(currentUser)
        void backupAuthToIdb(loadUsersFromStorage(), currentUser)
        /* Disk først → rask forsida; sky-data hentes i bakgrunnen (hydrateUserAppStateFromRemote). */
        const diskApp = loadAppStateFromStorageForUser(currentUser.id)
        sessions = diskApp.sessions
        currentSessionId = diskApp.currentSessionId
        standalonePhotos = diskApp.standalonePhotos
      } catch (e) {
        console.warn('Supabase init:', e)
        const fb = loadAuthSession()
        if (fb) {
          currentUser = fb
          const diskApp = loadAppStateFromStorageForUser(currentUser.id)
          sessions = diskApp.sessions
          currentSessionId = diskApp.currentSessionId
          standalonePhotos = normalizeStandalonePhotosList(
            diskApp.standalonePhotos,
          )
        } else {
          currentUser = null
          clearAuthSession()
          sessions = []
          currentSessionId = null
          standalonePhotos = []
        }
      }
    } else {
      /* getSession() kan være null (lagring/timing) mens lokal sesjon fortsatt finnes – ikke slett den. */
      const fb = loadAuthSession()
      if (fb) {
        currentUser = fb
        const diskApp = loadAppStateFromStorageForUser(currentUser.id)
        sessions = diskApp.sessions
        currentSessionId = diskApp.currentSessionId
        standalonePhotos = normalizeStandalonePhotosList(
          diskApp.standalonePhotos,
        )
      } else {
        currentUser = null
        clearAuthSession()
        sessions = []
        currentSessionId = null
        standalonePhotos = []
      }
    }
  } else {
    currentUser = loadAuthSession()
    syncShortIdFromUsersToSession()
    const initialApp = currentUser
      ? loadAppStateFromStorageForUser(currentUser.id)
      : { sessions: [], currentSessionId: null, standalonePhotos: [] }
    sessions = initialApp.sessions
    currentSessionId = initialApp.currentSessionId
    standalonePhotos = normalizeStandalonePhotosList(
      initialApp.standalonePhotos,
    )
  }

  if (currentSessionId && !sessions.some((s) => s.id === currentSessionId)) {
    currentSessionId = null
  }
  state = loadCurrentSessionState()
  if (!currentUser) {
    view = 'auth'
  } else if (currentSessionId) {
    view = 'session'
  } else {
    view = 'home'
  }
}

/** Visninger der vi ikke overstyrer `view` ved sky-synk (bruker kan være i meny e.l.). */
function isViewLockedDuringRemoteHydrate() {
  return !['auth', 'home', 'session'].includes(view)
}

/**
 * Etter første tegning: hent app-tilstand fra Supabase og flett inn (tidligere blokkerte dette oppstart).
 */
async function hydrateUserAppStateFromRemote() {
  const sb = getSupabase()
  if (!sb || !currentUser?.id) return
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session?.user || session.user.id !== currentUser.id) return

  let remote
  try {
    remote = await fetchUserAppState(sb, session.user.id)
  } catch (e) {
    console.warn('hydrate app state:', e)
    return
  }
  if (!remote) return

  const diskApp = loadAppStateFromStorageForUser(currentUser.id)
  const nextSessions = remote.sessions.map(normalizeSession).filter(Boolean)
  let nextSessionId = remote.currentSessionId
  const nextStandalone = mergeStandalonePhotoLists(
    normalizeStandalonePhotosList(remote.standalonePhotos),
    diskApp.standalonePhotos,
  )

  if (nextSessionId && !nextSessions.some((s) => s.id === nextSessionId)) {
    nextSessionId = null
  }

  const prevSig = `${currentSessionId}|${sessions.map((s) => s.id).join(',')}|${standalonePhotos.length}`
  const viewBefore = view
  sessions = nextSessions
  currentSessionId = nextSessionId
  standalonePhotos = nextStandalone
  if (currentSessionId && !sessions.some((s) => s.id === currentSessionId)) {
    currentSessionId = null
  }
  state = loadCurrentSessionState()

  const nextSig = `${currentSessionId}|${sessions.map((s) => s.id).join(',')}|${standalonePhotos.length}`
  const dataChanged = prevSig !== nextSig

  if (isViewLockedDuringRemoteHydrate()) {
    if (view === 'session' && !currentSessionId) {
      view = 'home'
    }
  } else {
    if (!currentUser) {
      view = 'auth'
    } else if (currentSessionId) {
      view = 'session'
    } else {
      view = 'home'
    }
  }

  if (dataChanged || view !== viewBefore) {
    renderApp()
    bindListenersForCurrentView()
  }
}

await initAppStateFromStorage()

function formatNb(date) {
  return new Intl.DateTimeFormat('nb-NO', {
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(date)
}

/** Kompakt tid for loggliste (mindre rot enn full dato på hver linje). */
function formatLogTime(iso) {
  return new Intl.DateTimeFormat('nb-NO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(iso))
}

/**
 * Visningsversjon av loggtekst: rydder eldre «Tell opp / ny verdi»-formatering
 * uten å endre det som er lagret i localStorage.
 */
function formatLogMessageForDisplay(raw) {
  if (typeof raw !== 'string') return ''
  let s = raw.trim()
  const tellLegacy = s.match(
    /^Tell opp:\s*ny verdi\s*(\d+)\.\s*Posisjon:\s*(.+)$/is,
  )
  if (tellLegacy) {
    const rest = tellLegacy[2].replace(/\.\s*$/, '').trim()
    return `Oppført · ${tellLegacy[1]} · ${rest}`
  }
  if (s.startsWith('+Tell ·')) {
    return `Oppført ·${s.slice('+Tell ·'.length)}`
  }
  const angreLegacy = s.match(
    /^Angre:\s*verdi nå\s*(\d+)\.\s*Fjernet trykk.*$/is,
  )
  if (angreLegacy) {
    return `Angret · teller ${angreLegacy[1]}`
  }
  const nullLegacy = s.match(
    /^Nullstill:\s*verdi satt fra\s*(\d+)\s+til\s+0\..*$/is,
  )
  if (nullLegacy) {
    return `Nullstilt · var ${nullLegacy[1]}`
  }
  return s
}

function addLogEntry(state, entry) {
  const full = {
    id: crypto.randomUUID(),
    timestamp: nowIso(),
    ...entry,
  }
  state.log.unshift(full)
  if (state.log.length > 500) state.log.length = 500
}

let pinIcon = null
let userLocationIcon = null
function ensureSessionPinIcons() {
  if (pinIcon || !Leaflet) return
  pinIcon = Leaflet.divIcon({
    className: 'map-pin-wrap',
    html: '<div class="map-pin" aria-hidden="true"></div>',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -36],
  })
  userLocationIcon = Leaflet.divIcon({
    className: 'map-user-pin-wrap',
    html: '<div class="map-user-pin" aria-hidden="true"><div class="map-user-arrow"></div></div>',
    iconSize: [28, 34],
    iconAnchor: [14, 34],
  })
}

function getCurrentPositionOnce(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

function coordsFromPosition(pos) {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  }
}

/** Forklarer vanlige Geolocation-feil (kode 1/2/3) og sikker kontekst. */
function describeGeolocationFailure(err) {
  if (err === 'INSECURE') {
    return 'Usikker side (ikke HTTPS). Bruk https://-adressen Vite viser, eller åpne via localhost. Vanlig http til LAN-IP (f.eks. 192.168…) blokkerer GPS.'
  }
  if (err === 'NO_API') {
    return 'Nettleseren støtter ikke geolokasjon.'
  }
  const code = err && typeof err.code === 'number' ? err.code : null
  if (code === 1) {
    return 'Tilgang til posisjon ble avvist. Tillat plassering for dette nettstedet i nettleserinnstillingene.'
  }
  if (code === 2) {
    return 'Posisjon kunne ikke bestemmes (ofte innendørs, flymodus eller deaktivert GPS). Prøv utendørs eller slå på posisjonstjenester.'
  }
  if (code === 3) {
    return 'Tidsavbrudd ved GPS. Prøv igjen – evt. utendørs med fri sikt til himmelen.'
  }
  return 'Kunne ikke hente posisjon.'
}

/**
 * Prøver høy nøyaktighet først, deretter WiFi/celle med kortere timeout,
 * til slutt litt eldre cachet posisjon – fungerer bedre innendørs.
 */
async function getPosition() {
  if (!navigator.geolocation) {
    throw 'NO_API'
  }
  if (!window.isSecureContext) {
    throw 'INSECURE'
  }

  const attempts = [
    { enableHighAccuracy: true, timeout: 35000, maximumAge: 0 },
    { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
    { enableHighAccuracy: false, timeout: 28000, maximumAge: 0 },
    { enableHighAccuracy: false, timeout: 30000, maximumAge: 120000 },
  ]

  let lastErr = null
  for (const opts of attempts) {
    try {
      const pos = await getCurrentPositionOnce(opts)
      return coordsFromPosition(pos)
    } catch (e) {
      lastErr = e
      // Nytt forsøk hjelper ikke hvis brukeren har avvist tilgang
      if (e && e.code === 1) break
    }
  }
  throw lastErr
}

const markers = []
let map = null
/** Serialiserer kart-init (unngår dobbel Leaflet.map på #map ved parallelle kall). */
let sessionMapInitPromise = null
/** Leaflet for mottatte bilder (ikke økt-kartet). */
let receivedPhotosMap = null
let userLocationMarker = null
let userAccuracyCircle = null
let locationWatchId = null
/** Når watchPosition stopper å levere (vanlig på mobil), poller vi med getCurrentPosition. */
let drivingGpsStuckPollId = null

function clearDrivingGpsStuckPoll() {
  if (drivingGpsStuckPollId != null) {
    clearInterval(drivingGpsStuckPollId)
    drivingGpsStuckPollId = null
  }
}

/** Forside: GPS-watch som mater felles vegref-pipeline. */
let homeVegrefWatchId = null
let homeVegrefHasDisplayedResult = false
let homeVegrefSegKey = ''
let homeVegrefMeterAnim = null
let homeVegrefMeterFrom = 0
let homeVegrefMeterTo = 0
let homeVegrefMeterT0 = 0
let homeVegrefDisplayedMeter = null
let homeVegrefCompactS = '–'
let homeVegrefCompactD = '–'

/** KMT / vegreferanse-panelet – samme NVDB-kø som forsiden (`vegrefLive.js`). */
let kmtDialogOpen = false
/** Ikke bytt ut god visning med treff langt fra veikanten (sannsynlig støy). */
const HOME_VEGREF_MAX_DIST_SKIP_M = 95
const HOME_VEGREF_METER_TWEEN_MS = 220
/** Hopp mellom metertall oftere = færre tween-rammer (jevnere ved rask kjøring). */
const HOME_VEGREF_METER_SNAP = 240
let kmtCameraMode = false
/** @type {MediaStream | null} */
let kmtMediaStream = null
let kmtHasDisplayedResult = false
/** S/D/veilinje – brukes til å skille «samme strekning» fra veksling (da snapper vi meter). */
let kmtRefSegmentKey = ''
/** Sist viste metertall (for tween). */
let kmtDisplayedMeter = null
let kmtMeterAnim = null
let kmtMeterFrom = 0
let kmtMeterTo = 0
let kmtMeterT0 = 0
const KMT_METER_TWEEN_MS = 420
const KMT_METER_SNAP_IF_DELTA = 280
/** True når KMT er åpnet fra forsiden – bilder til album, tilbake → album (ikke økt). */
let kmtStandaloneFlow = false

/** Forsiden «AI dokumentering»: kamera + flertråds chat mot /api/analyze. */
let homeAiMediaStream = null
/** @type {string} */
let homeAiCapturedDataUrl = ''
/**
 * OpenAI-format meldinger for /api/analyze med `messages` (første user = bilde + tekst, deretter tekst + svar).
 * @type {Array<{ role: string, content: unknown }>}
 */
let homeAiApiMessages = []
/** Tekstbasert kontrakt-RAG mot /api/contract-chat (skiller fra VeiAi-tråden). */
let homeAiContractRagMode = false
/**
 * @type {Array<{ role: string, content: string }>}
 */
let homeAiRagMessages = []
/** Lydeffekt mens AI arbeider (AI dokumentering). */
let homeAiThinkingSoundTimer = 0
/** @type {AudioContext | null} */
let homeAiAudioContext = null
const HOME_AI_CAPTURE_MAX = 1600

/** Når true, hold kartutsnittet på den blå posisjonen (GPS). Slås av ved manuell panorering/zoom. */
let followUserOnMap = true
/** Siste kjente posisjon fra watchPosition (oppdateres hele tiden). */
let lastLiveCoords = null
/**
 * Siste rå GPS-fix fra watchPosition (coords før glatting og vei-snap).
 * Brukes som reserve; «Registrer» bruker primært fersk getCurrentPosition.
 */
let lastRawGpsFromWatch = null

const LIVE_POS_MAX_AGE_MS = 30000
/**
 * Hvis watch nettopp leverte en fix med god nok nøyaktighet, bruk den direkte for «Registrer»
 * (sparer typisk 200–800 ms vs. getCurrentPosition).
 */
const REGISTER_CLICK_FAST_PATH_MAX_MS = 2200

/** Sekvens for å ignorere utdaterte async OSRM-svar. */
let positionSeq = 0

const GPS_REJECT_M = 220
/** Maks. GPS-uncertainty (m) for at «Registrer» skal godtas og sette nål. */
const REGISTER_MAX_GPS_ACCURACY_M = 8
let navTargetLat = null
let navTargetLng = null
let navDisplayLat = null
let navDisplayLng = null
/** Meta for popup, zoom, heading (sist skrevne mål). */
let navLoopMeta = null

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toR = (d) => (d * Math.PI) / 180
  const dLat = toR(lat2 - lat1)
  const dLng = toR(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

function resetDrivingFilters() {
  navTargetLat = null
  navTargetLng = null
  navDisplayLat = null
  navDisplayLng = null
  navLoopMeta = null
  positionSeq = 0
  lastSnapAt = 0
  lastSnapFromLat = 0
  lastSnapFromLng = 0
  lastSnapResult = null
  traceBuffer = []
  driveZoomSticky = null
  lastRawGpsFromWatch = null
}

function zoomForDriving(accuracy) {
  if (accuracy < 22) return 18
  if (accuracy < 45) return 17
  if (accuracy < 75) return 16
  return 15
}

/**
 * Zoom som ikke flakser når ±verdiene svinger rundt grensene (22, 45, 75 m).
 * Reduserer hopp og flisbytte under følge-modus.
 */
let driveZoomSticky = null

function zoomForDrivingSticky(accuracy) {
  const r = Math.max(
    typeof accuracy === 'number' && !Number.isNaN(accuracy) ? accuracy : 20,
    8,
  )
  const ideal = zoomForDriving(r)
  if (driveZoomSticky == null) {
    driveZoomSticky = ideal
    return driveZoomSticky
  }
  if (ideal === driveZoomSticky) return driveZoomSticky
  if (ideal < driveZoomSticky) {
    if (
      (driveZoomSticky === 18 && r >= 28) ||
      (driveZoomSticky === 17 && r >= 52) ||
      (driveZoomSticky === 16 && r >= 82)
    ) {
      driveZoomSticky = ideal
    }
  } else {
    if (
      (driveZoomSticky === 15 && r < 70) ||
      (driveZoomSticky === 16 && r < 40) ||
      (driveZoomSticky === 17 && r < 18)
    ) {
      driveZoomSticky = ideal
    }
  }
  return driveZoomSticky
}
let lastSnapAt = 0
let lastSnapFromLat = 0
let lastSnapFromLng = 0
/** Siste vellykkede vei-justering (brukes ved throttling og når API er tregt). */
let lastSnapResult = null
/** Rå punkter for OSRM match (bedre å ligge på veikrysset enn nearest alene). */
let traceBuffer = []
const TRACE_MAX = 12

function pushTracePoint(lat, lng) {
  traceBuffer.push({ lat, lng })
  while (traceBuffer.length > TRACE_MAX) traceBuffer.shift()
}

function parseLastTracepoint(j) {
  const tps = j.tracepoints
  if (!tps?.length) return null
  for (let i = tps.length - 1; i >= 0; i--) {
    const tp = tps[i]
    if (tp?.location?.length >= 2) {
      return { lat: tp.location[1], lng: tp.location[0] }
    }
  }
  return null
}

function osrmBasePath() {
  return import.meta.env.DEV
    ? '/api/osrm'
    : 'https://router.project-osrm.org'
}

async function fetchOsrmJson(path) {
  const url = `${osrmBasePath()}${path}`
  const controller = new AbortController()
  const to = setTimeout(() => controller.abort(), 8000)
  try {
    const r = await fetch(url, { signal: controller.signal })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  } finally {
    clearTimeout(to)
  }
}

/**
 * Snapper rå GPS til veikart (OSRM). Bruker alltid rå koordinater – ikke glattet,
 * ellers kan punktet dras inn på bygning/tomt. Match med store radiuses tåler typisk ±30–50 m GPS-feil.
 */
async function snapToRoadNetwork(lat, lng, accuracy) {
  const now = Date.now()
  const moved = haversineM(lastSnapFromLat, lastSnapFromLng, lat, lng)
  const poorGps = accuracy > 28
  const minInterval = poorGps ? 350 : 750
  const minMove = poorGps ? 3 : 12
  if (now - lastSnapAt < minInterval && moved < minMove) {
    return lastSnapResult
  }
  lastSnapAt = now
  lastSnapFromLat = lat
  lastSnapFromLng = lng

  const rad = Math.min(65, Math.max(25, Math.round(accuracy * 1.2)))

  const traceForMatch = traceBuffer.slice(-8)
  if (traceForMatch.length >= 2) {
    const pts = traceForMatch.map((p) => `${p.lng},${p.lat}`).join(';')
    const radii = traceForMatch.map(() => rad).join(';')
    const j = await fetchOsrmJson(
      `/match/v1/driving/${pts}?radiuses=${radii}&overview=false&steps=false`,
    )
    const matched = j && parseLastTracepoint(j)
    if (matched) {
      lastSnapResult = matched
      return matched
    }
  }

  const jn = await fetchOsrmJson(`/nearest/v1/driving/${lng},${lat}`)
  const loc = jn?.waypoints?.[0]?.location
  if (loc && loc.length >= 2) {
    const res = { lat: loc[1], lng: loc[0] }
    lastSnapResult = res
    return res
  }

  return lastSnapResult
}

function applyHeadingToMarker(headingDeg) {
  if (!userLocationMarker) return
  const el = userLocationMarker.getElement?.()
  if (!el) return
  const arrow = el.querySelector('.map-user-arrow')
  if (!arrow) return
  if (headingDeg == null || Number.isNaN(headingDeg)) {
    arrow.style.transform = ''
    return
  }
  arrow.style.transform = `rotate(${headingDeg}deg)`
}

const PHOTO_MARKER_ICON_CACHE_MAX = 64
/** @type {Map<string, object>} */
const photoThumbnailIconCache = new Map()

function photoThumbnailIcon(dataUrl) {
  let icon = photoThumbnailIconCache.get(dataUrl)
  if (icon) return icon
  icon = Leaflet.divIcon({
    className: 'map-photo-marker-wrap',
    html: `<div class="map-photo-marker"><img src="${dataUrl}" alt="" /></div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -44],
  })
  if (photoThumbnailIconCache.size >= PHOTO_MARKER_ICON_CACHE_MAX) {
    const first = photoThumbnailIconCache.keys().next().value
    photoThumbnailIconCache.delete(first)
  }
  photoThumbnailIconCache.set(dataUrl, icon)
  return icon
}

/** Gruppering av identiske lagrede koordinater (kun visning – lagret GPS endres ikke). */
const MARKER_COINCIDENT_GROUP_DECIMALS = 5
const MARKER_COINCIDENT_BASE_RADIUS_M = 2.4
const MARKER_COINCIDENT_STEP_M = 0.35

function offsetLatLngForCoincidentIndex(
  lat,
  lng,
  indexInGroup,
  groupSize,
) {
  if (groupSize <= 1) return [lat, lng]
  if (indexInGroup === 0) return [lat, lng]
  const denom = Math.max(1, groupSize - 1)
  const angle = (2 * Math.PI * (indexInGroup - 1)) / denom
  const distM =
    MARKER_COINCIDENT_BASE_RADIUS_M +
    (indexInGroup - 1) * MARKER_COINCIDENT_STEP_M
  const northM = distM * Math.cos(angle)
  const eastM = distM * Math.sin(angle)
  const dLat = northM / 111320
  const cosLat = Math.cos((lat * Math.PI) / 180)
  const dLng = cosLat > 1e-6 ? eastM / (111320 * cosLat) : 0
  return [lat + dLat, lng + dLng]
}

function computeAllMarkerDisplayPositions() {
  const keyOf = (la, ln) =>
    `${la.toFixed(MARKER_COINCIDENT_GROUP_DECIMALS)},${ln.toFixed(MARKER_COINCIDENT_GROUP_DECIMALS)}`
  /** @type {Map<string, Array<{ kind: 'click' | 'photo', idx: number }>>} */
  const buckets = new Map()
  state.clickHistory.forEach((c, i) => {
    if (c.lat == null || c.lng == null) return
    const k = keyOf(c.lat, c.lng)
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k).push({ kind: 'click', idx: i })
  })
  state.photos.forEach((p, i) => {
    if (p.lat == null || p.lng == null) return
    const k = keyOf(p.lat, p.lng)
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k).push({ kind: 'photo', idx: i })
  })

  const clickLatLng = new Map()
  const photoLatLng = new Map()
  for (const arr of buckets.values()) {
    arr.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'click' ? -1 : 1
      return a.idx - b.idx
    })
    const size = arr.length
    arr.forEach((item, pos) => {
      const src =
        item.kind === 'click'
          ? state.clickHistory[item.idx]
          : state.photos[item.idx]
      const [dlat, dlng] = offsetLatLngForCoincidentIndex(
        src.lat,
        src.lng,
        pos,
        size,
      )
      if (item.kind === 'click') clickLatLng.set(item.idx, [dlat, dlng])
      else photoLatLng.set(item.idx, [dlat, dlng])
    })
  }
  return { clickLatLng, photoLatLng }
}

const sessionMarkerInteractionDefaults = Object.freeze({
  bubblingMouseEvents: false,
  riseOnHover: false,
})

function rebuildMarkers() {
  if (!map || !Leaflet) return
  ensureSessionPinIcons()
  const { clickLatLng, photoLatLng } = computeAllMarkerDisplayPositions()
  markers.forEach((m) => map.removeLayer(m))
  markers.length = 0
  state.clickHistory.forEach((c, i) => {
    if (c.lat == null || c.lng == null) return
    const ll = clickLatLng.get(i) || [c.lat, c.lng]
    const m = Leaflet.marker(ll, {
      icon: pinIcon,
      ...sessionMarkerInteractionDefaults,
    })
    const catPart =
      typeof c.category === 'string' && c.category
        ? `${escapeHtml(getObjectCategoryLabel(c.category))}<br>`
        : ''
    m.bindPopup(`Trykk #${i + 1}<br>${catPart}${formatNb(new Date(c.timestamp))}`)
    m.addTo(map)
    markers.push(m)
  })
  state.photos.forEach((ph, i) => {
    if (ph.lat == null || ph.lng == null) return
    const ll = photoLatLng.get(i) || [ph.lat, ph.lng]
    const m = Leaflet.marker(ll, {
      icon: photoThumbnailIcon(ph.dataUrl),
      ...sessionMarkerInteractionDefaults,
    })
    const t = ph.timestamp ? formatNb(new Date(ph.timestamp)) : ''
    const vr = ph.vegref && normalizePhotoVegref(ph.vegref)
    const vegLines = vr
      ? [vr.road, vr.compact, vr.kortform].filter(Boolean)
      : []
    const vegBlock =
      vegLines.length > 0
        ? `<span style="font-size:0.78rem;line-height:1.35;display:block;margin:0.35rem 0 0.25rem">${vegLines.map((x) => escapeHtml(x)).join('<br>')}</span>`
        : ''
    m.bindPopup(
      `<strong>Bilde #${i + 1}</strong><br>${t}${vegBlock}<br><img src="${ph.dataUrl}" alt="" style="max-width:220px;height:auto;border-radius:8px;margin-top:8px;display:block"/>`,
    )
    m.addTo(map)
    markers.push(m)
  })
}

function fitAllPins() {
  if (!map) return
  followUserOnMap = false
  const { clickLatLng, photoLatLng } = computeAllMarkerDisplayPositions()
  const pts = []
  state.clickHistory.forEach((c, i) => {
    if (c.lat == null || c.lng == null) return
    const ll = clickLatLng.get(i)
    if (ll) pts.push({ lat: ll[0], lng: ll[1] })
  })
  state.photos.forEach((p, i) => {
    if (p.lat == null || p.lng == null) return
    const ll = photoLatLng.get(i)
    if (ll) pts.push({ lat: ll[0], lng: ll[1] })
  })
  if (pts.length === 0) return
  if (pts.length === 1) {
    map.setView([pts[0].lat, pts[0].lng], 16)
    return
  }
  const b = Leaflet.latLngBounds(pts.map((p) => [p.lat, p.lng]))
  map.fitBounds(b, { padding: [40, 40], maxZoom: 17 })
}

/** Flytter kartet til gjeldende posisjon (blå markør / siste GPS). */
function centerMapOnUserPosition() {
  if (!map) return
  followUserOnMap = true
  const gpsEl = document.getElementById('gps-status')
  let lat = navDisplayLat
  let lng = navDisplayLng
  let acc =
    lastLiveCoords && typeof lastLiveCoords.accuracy === 'number'
      ? lastLiveCoords.accuracy
      : null
  if (lat == null || lng == null) {
    if (userLocationMarker) {
      const ll = userLocationMarker.getLatLng()
      lat = ll.lat
      lng = ll.lng
    } else if (lastLiveCoords) {
      lat = lastLiveCoords.lat
      lng = lastLiveCoords.lng
      acc = lastLiveCoords.accuracy
    }
  }
  if (lat != null && lng != null) {
    const r =
      acc != null && !Number.isNaN(Number(acc)) ? Number(acc) : 30
    map.flyTo([lat, lng], zoomForDrivingSticky(r), { duration: 0.75 })
    return
  }
  if (!window.isSecureContext || !navigator.geolocation) {
    if (gpsEl) {
      gpsEl.textContent = window.isSecureContext
        ? 'Kunne ikke hente posisjon for kart.'
        : 'Bruk https:// eller localhost for posisjon.'
    }
    return
  }
  if (gpsEl) gpsEl.textContent = 'Henter posisjon …'
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords
      map.flyTo([latitude, longitude], zoomForDrivingSticky(accuracy), {
        duration: 0.75,
      })
      if (gpsEl) {
        gpsEl.textContent =
          'Tillat posisjon – kartet følger deg. Dra i kartet for å se rundt; «Min posisjon» sentrerer igjen.'
      }
    },
    (err) => {
      if (gpsEl) gpsEl.textContent = describeGeolocationFailure(err)
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  )
}

function buildNavPopupLines(roadSnapped, r, spdKmh) {
  return [
    `<strong>${roadSnapped ? 'På vei (justert)' : 'Din posisjon'}</strong>`,
    `Nøyaktighet: ca. ${Math.round(r)} m`,
    spdKmh != null ? `Ca. ${spdKmh} km/t` : null,
  ].filter(Boolean)
}

function applyNavFrameVisuals() {
  const lat = navDisplayLat
  const lng = navDisplayLng
  const {
    accuracy: accIn,
    heading,
    speed,
    roadSnapped = false,
  } = navLoopMeta
  const r = Math.max(
    typeof accIn === 'number' && !Number.isNaN(accIn) ? accIn : 20,
    8,
  )
  lastLiveCoords = { lat, lng, accuracy: r, ts: Date.now() }

  const spdKmh =
    speed != null && !Number.isNaN(speed) && speed >= 0
      ? (speed * 3.6).toFixed(0)
      : null
  const popupLines = buildNavPopupLines(roadSnapped, r, spdKmh)

  userLocationMarker.setLatLng([lat, lng])
  userAccuracyCircle.setLatLng([lat, lng])
  userAccuracyCircle.setRadius(Math.min(r, 95))
  userLocationMarker.setPopupContent(popupLines.join('<br>'))
  applyHeadingToMarker(heading)
  if (followUserOnMap && map) {
    const z = zoomForDrivingSticky(r)
    const curZ = map.getZoom()
    const c = map.getCenter()
    const movedFromMapCenter = haversineM(lat, lng, c.lat, c.lng)
    const panOpts = { animate: true, duration: 0.22, easeLinearity: 0.38 }
    if (curZ !== z) {
      __dbgSetViewBurst += 1
      map.flyTo([lat, lng], z, { duration: 0.3, easeLinearity: 0.38 })
    } else if (movedFromMapCenter >= 0.26) {
      map.panTo([lat, lng], panOpts)
    }
  }
}

/**
 * Oppdaterer blå GPS-markør. Samme prinsipp som «Registrer»: direkte rå koordinater per fix.
 * Tidligere interpolerte vi med requestAnimationFrame mot navTarget; det ga prikk som hang etter
 * eller ikke flyttet seg, mens getPositionForClick() alltid traff riktig.
 */
function updateUserLocationOnMap(
  lat,
  lng,
  accuracy,
  {
    initial = false,
    heading = null,
    speed = null,
    roadSnapped = false,
    snapCorrection = false,
  } = {},
) {
  void initial
  void snapCorrection
  const r = Math.max(
    typeof accuracy === 'number' && !Number.isNaN(accuracy) ? accuracy : 20,
    8,
  )

  navTargetLat = lat
  navTargetLng = lng
  navLoopMeta = {
    accuracy,
    heading,
    speed,
    roadSnapped,
    snapCorrection,
  }

  if (!userLocationMarker || !userAccuracyCircle) {
    navDisplayLat = lat
    navDisplayLng = lng
    const spdKmh =
      speed != null && !Number.isNaN(speed) && speed >= 0
        ? (speed * 3.6).toFixed(0)
        : null
    const popupLines = buildNavPopupLines(roadSnapped, r, spdKmh)
    userAccuracyCircle = Leaflet.circle([lat, lng], {
      radius: Math.min(r, 95),
      color: '#3b82f6',
      fillColor: '#60a5fa',
      fillOpacity: 0.18,
      weight: 2,
    }).addTo(map)
    userLocationMarker = Leaflet.marker([lat, lng], {
      icon: userLocationIcon,
      zIndexOffset: 650,
      bubblingMouseEvents: false,
      riseOnHover: false,
    }).addTo(map)
    userLocationMarker.bindPopup(popupLines.join('<br>'))
    applyHeadingToMarker(heading)
    map.flyTo([lat, lng], zoomForDrivingSticky(r), {
      duration: 0.45,
      easeLinearity: 0.4,
    })
    applyNavFrameVisuals()
    return
  }

  navDisplayLat = lat
  navDisplayLng = lng
  applyNavFrameVisuals()
}

/**
 * Én fersk GPS-avlesning til «Registrer» – ikke cachet, ikke fra kartglatting/vei-snap.
 */
async function getFreshPositionForRegisterClick() {
  if (!navigator.geolocation) {
    throw 'NO_API'
  }
  if (!window.isSecureContext) {
    throw 'INSECURE'
  }
  const pos = await getCurrentPositionOnce({
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 12000,
  })
  return coordsFromPosition(pos)
}

/**
 * Posisjon for «Registrer»-trykk.
 * Bruker rå enhets-GPS: fersk getCurrentPosition (maximumAge: 0), ikke navTarget
 * (som kan være glattet og/eller OSRM-justert) og ikke interpolert visning (navDisplay*).
 * Rask bane: nylig watch-fix med god nok nøyaktighet brukes direkte (sparer ventetid).
 */
async function getPositionForClick() {
  const w = lastRawGpsFromWatch
  const now = Date.now()
  if (
    w &&
    now - w.ts < REGISTER_CLICK_FAST_PATH_MAX_MS &&
    typeof w.accuracy === 'number' &&
    w.accuracy <= REGISTER_MAX_GPS_ACCURACY_M &&
    w.lat != null &&
    w.lng != null &&
    !Number.isNaN(Number(w.lat)) &&
    !Number.isNaN(Number(w.lng))
  ) {
    return {
      lat: w.lat,
      lng: w.lng,
      accuracy: w.accuracy,
    }
  }
  try {
    return await getFreshPositionForRegisterClick()
  } catch {
    /* prøv reserve fra watch */
  }
  const watchFresh =
    lastRawGpsFromWatch &&
    Date.now() - lastRawGpsFromWatch.ts < LIVE_POS_MAX_AGE_MS
  if (
    watchFresh &&
    lastRawGpsFromWatch.lat != null &&
    lastRawGpsFromWatch.lng != null &&
    !Number.isNaN(Number(lastRawGpsFromWatch.lat)) &&
    !Number.isNaN(Number(lastRawGpsFromWatch.lng))
  ) {
    const a = lastRawGpsFromWatch.accuracy
    return {
      lat: lastRawGpsFromWatch.lat,
      lng: lastRawGpsFromWatch.lng,
      accuracy:
        typeof a === 'number' && !Number.isNaN(a) ? a : 20,
    }
  }
  return getPosition()
}

function stopLocationWatch() {
  clearDrivingGpsStuckPoll()
  lastRawGpsFromWatch = null
  if (locationWatchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(locationWatchId)
    locationWatchId = null
  }
}

function isKmtCameraUiPreferred() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  try {
    if (window.matchMedia('(pointer: coarse)').matches) return true
    if (window.matchMedia('(max-width: 720px)').matches) return true
  } catch {
    return false
  }
  return false
}

function cancelKmtMeterTween() {
  if (kmtMeterAnim != null) {
    cancelAnimationFrame(kmtMeterAnim)
    kmtMeterAnim = null
  }
}

function tickKmtMeterTween(now) {
  const el = document.getElementById('kmt-m')
  if (!el) {
    kmtMeterAnim = null
    return
  }
  const u = Math.min(1, (now - kmtMeterT0) / KMT_METER_TWEEN_MS)
  const ease = 1 - (1 - u) ** 3
  const v = Math.round(kmtMeterFrom + (kmtMeterTo - kmtMeterFrom) * ease)
  el.textContent = String(v)
  kmtDisplayedMeter = v
  syncKmtCompactLine()
  if (u < 1) {
    kmtMeterAnim = requestAnimationFrame(tickKmtMeterTween)
  } else {
    kmtMeterAnim = null
    el.textContent = String(kmtMeterTo)
    kmtDisplayedMeter = kmtMeterTo
    syncKmtCompactLine()
  }
}

function parseKmtMeterInt(m) {
  if (m == null) return null
  const t = String(m).trim()
  if (!t || t === '–' || t === '-') return null
  const n = parseInt(t.replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

function syncKmtCompactLine() {
  const compact = document.getElementById('kmt-ref-compact')
  if (!compact) return
  const s = document.getElementById('kmt-s')?.textContent?.trim() ?? '–'
  const d = document.getElementById('kmt-d')?.textContent?.trim() ?? '–'
  const m = document.getElementById('kmt-m')?.textContent?.trim() ?? '–'
  compact.textContent = `S ${s} · D ${d} · m ${m}`
}

function startKmtMeterTweenTo(targetInt) {
  const el = document.getElementById('kmt-m')
  if (!el) return
  const from = kmtDisplayedMeter != null ? kmtDisplayedMeter : targetInt
  if (from === targetInt) {
    el.textContent = String(targetInt)
    kmtDisplayedMeter = targetInt
    syncKmtCompactLine()
    cancelKmtMeterTween()
    return
  }
  cancelKmtMeterTween()
  kmtMeterFrom = from
  kmtMeterTo = targetInt
  kmtMeterT0 = performance.now()
  kmtMeterAnim = requestAnimationFrame(tickKmtMeterTween)
}

function stopKmtCameraStream() {
  cancelKmtMeterTween()
  const video = document.getElementById('kmt-video')
  if (video) {
    try {
      video.srcObject = null
    } catch {
      /* ignore */
    }
  }
  if (kmtMediaStream) {
    for (const t of kmtMediaStream.getTracks()) {
      try {
        t.stop()
      } catch {
        /* ignore */
      }
    }
    kmtMediaStream = null
  }
  kmtCameraMode = false
  document.getElementById('kmt-dialog')?.classList.remove('kmt-dialog--camera')
}

/**
 * @param {unknown} caps
 * @returns {string[]}
 */
function kmtFocusModesFromCaps(caps) {
  if (!caps || typeof caps !== 'object') return []
  const fm = /** @type {{ focusMode?: unknown }} */ (caps).focusMode
  if (Array.isArray(fm)) return fm.filter((x) => typeof x === 'string')
  if (typeof fm === 'string') return [fm]
  return []
}

/**
 * Prøver å sette lengst mulig fokusavstand (ofte «mot horisont») når enheten eksponerer focusDistance.
 * @param {MediaStreamTrack | undefined} track
 * @returns {Promise<boolean>} true hvis minst én constraint ble akseptert
 */
async function applyKmtFarFocusPreference(track) {
  if (!track || typeof track.applyConstraints !== 'function') return false
  try {
    const caps =
      typeof track.getCapabilities === 'function' ? track.getCapabilities() : {}
    const fd = caps && typeof caps === 'object' ? caps.focusDistance : null
    if (!fd || typeof fd !== 'object') {
      return false
    }
    const minV = typeof fd.min === 'number' && !Number.isNaN(fd.min) ? fd.min : null
    const maxV = typeof fd.max === 'number' && !Number.isNaN(fd.max) ? fd.max : null
    /** Typisk: større verdi = lenger bort (eller omvendt per OEM – prøver begge). */
    const candidates = []
    if (maxV != null) candidates.push(maxV)
    if (minV != null && minV !== maxV) candidates.push(minV)
    for (const v of candidates) {
      try {
        await track.applyConstraints({ advanced: [{ focusDistance: v }] })
        return true
      } catch {
        /* neste kandidat */
      }
    }
  } catch {
    /* ignore */
  }
  return false
}

/**
 * Ber om kontinuerlig autofokus når enheten støtter det (ofte mobil med bak-kamera).
 * @param {MediaStreamTrack | undefined} track
 */
async function applyKmtContinuousAutofocus(track) {
  if (!track || typeof track.applyConstraints !== 'function') return
  try {
    const caps =
      typeof track.getCapabilities === 'function' ? track.getCapabilities() : {}
    const modes = kmtFocusModesFromCaps(caps)
    if (modes.includes('continuous')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
      return
    }
    if (modes.includes('single-shot')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] })
    }
  } catch {
    /* enheter uten fokus-støtte ignorerer stille */
  }
}

/**
 * Punktfokus med normaliserte koordinater (0–1). Brukes for horisont/fjernmotiv og trykk-fokus.
 * @param {MediaStreamTrack | undefined} track
 * @param {number} nx
 * @param {number} ny
 */
async function applyKmtNormalizedPointFocus(track, nx, ny) {
  if (!track || typeof track.applyConstraints !== 'function') return
  const x = Math.min(1, Math.max(0, nx))
  const y = Math.min(1, Math.max(0, ny))
  const poi = { x, y }
  try {
    const caps =
      typeof track.getCapabilities === 'function' ? track.getCapabilities() : {}
    const modes = kmtFocusModesFromCaps(caps)

    /** @type {object[]} */
    const attempts = []
    if (modes.includes('single-shot')) {
      attempts.push({
        advanced: [{ focusMode: 'single-shot', pointsOfInterest: [poi] }],
      })
    }
    attempts.push({ advanced: [{ pointsOfInterest: [poi] }] })
    if (modes.includes('manual')) {
      attempts.push({
        advanced: [{ focusMode: 'manual', pointsOfInterest: [poi] }],
      })
    }

    for (const c of attempts) {
      try {
        await track.applyConstraints(c)
        return
      } catch {
        /* prøv neste */
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Punktfokus der nettleser/kamera støtter det (f.eks. Chrome på Android).
 * @param {MediaStreamTrack | undefined} track
 * @param {number} clientX
 * @param {number} clientY
 * @param {HTMLVideoElement | null} videoEl
 */
async function applyKmtPointFocus(track, clientX, clientY, videoEl) {
  if (!track || !videoEl || typeof track.applyConstraints !== 'function') return
  const rect = videoEl.getBoundingClientRect()
  const nx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5
  const ny = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5
  await applyKmtNormalizedPointFocus(track, nx, ny)
}

/**
 * @param {number} clientX
 * @param {number} clientY
 * @param {HTMLElement | null} stageEl
 */
function showKmtFocusRipple(clientX, clientY, stageEl) {
  if (!stageEl) return
  const r = stageEl.getBoundingClientRect()
  const dot = document.createElement('div')
  dot.className = 'kmt-focus-ripple'
  dot.setAttribute('aria-hidden', 'true')
  dot.style.left = `${clientX - r.left}px`
  dot.style.top = `${clientY - r.top}px`
  stageEl.appendChild(dot)
  window.setTimeout(() => {
    dot.remove()
  }, 600)
}

/**
 * Vent på videorammer etter fokusendring (synkron med faktisk kamerafeed).
 * @param {HTMLVideoElement} video
 * @param {number} n
 */
function waitForKmtVideoFrames(video, n) {
  const count = Math.max(1, Math.floor(n))
  return new Promise((resolve) => {
    let seen = 0
    const step = () => {
      if (seen >= count) {
        resolve()
        return
      }
      if (typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback(() => {
          seen += 1
          step()
        })
      } else {
        requestAnimationFrame(() => {
          seen += 1
          step()
        })
      }
    }
    step()
  })
}

/** Etter applyConstraints: la sensoren levere nye rammer før capture. */
async function waitForKmtCaptureSettle(video) {
  if (typeof video.requestVideoFrameCallback === 'function') {
    await waitForKmtVideoFrames(video, 14)
  } else {
    await new Promise((r) => setTimeout(r, 480))
  }
}

async function captureKmtCameraPhoto() {
  const video = document.getElementById('kmt-video')
  if (!video || video.readyState < 2) {
    const st = document.getElementById('kmt-status')
    if (st) st.textContent = 'Vent til kameraet er klart, prøv igjen.'
    return
  }
  const w = video.videoWidth
  const h = video.videoHeight
  if (w < 32 || h < 32) return

  const track = kmtMediaStream?.getVideoTracks?.()?.[0]
  if (track) {
    const farOk = await applyKmtFarFocusPreference(track)
    if (!farOk) {
      await applyKmtNormalizedPointFocus(track, 0.5, 0.28)
    }
    await waitForKmtCaptureSettle(video)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(video, 0, 0, w, h)

  /* Vegreferanse lagres som metadata + HTML-overlay, ikke innprintet piksler – skarp tekst ved zoom. */
  const roadLine =
    document.getElementById('kmt-road-line')?.textContent?.trim() || ''
  const s = document.getElementById('kmt-s')?.textContent?.trim() || '–'
  const d = document.getElementById('kmt-d')?.textContent?.trim() || '–'
  const m = document.getElementById('kmt-m')?.textContent?.trim() || '–'
  const kf = document.getElementById('kmt-kortform')?.textContent?.trim() || ''

  const line1 = roadLine.slice(0, 44) || 'Vegreferanse'
  const line2 =
    document.getElementById('kmt-ref-compact')?.textContent?.trim() ||
    `S ${s} · D ${d} · m ${m}`
  const line3 = kf.slice(0, 62)
  const vegref = normalizePhotoVegref({
    road: line1,
    compact: line2,
    kortform: line3,
  })

  let raw
  try {
    raw = canvas.toDataURL('image/jpeg', 0.95)
  } catch {
    const st = document.getElementById('kmt-status')
    if (st) st.textContent = 'Kunne ikke ta bilde.'
    return
  }
  let dataUrl
  try {
    dataUrl = await compressDataUrlToDataUrl(
      raw,
      KMT_CAPTURE_MAX_DIM,
      PHOTO_JPEG_QUALITY,
    )
  } catch {
    const st = document.getElementById('kmt-status')
    if (st) st.textContent = 'Kunne ikke komprimere bilde.'
    return
  }
  try {
    await addPhotoFromCompressedDataUrl(dataUrl, vegref ? { vegref } : {})
  } catch (err) {
    console.error(err)
    const stErr = document.getElementById('kmt-status')
    if (stErr) {
      stErr.textContent = 'Kunne ikke lagre bildet.'
      stErr.hidden = false
    }
    return
  }
  const stOk = document.getElementById('kmt-status')
  if (stOk) {
    stOk.textContent = 'Bilde lagret.'
    stOk.hidden = false
    window.setTimeout(() => {
      if (stOk.textContent === 'Bilde lagret.') {
        stOk.textContent = ''
        stOk.hidden = true
      }
    }, 2000)
  }
}

function setKmtLoading() {
  const st = document.getElementById('kmt-status')
  const line = document.getElementById('kmt-road-line')
  const s = document.getElementById('kmt-s')
  const d = document.getElementById('kmt-d')
  const m = document.getElementById('kmt-m')
  const kf = document.getElementById('kmt-kortform')
  if (st) {
    st.textContent = 'Henter vegreferanse …'
    st.hidden = false
  }
  if (line) line.textContent = '…'
  if (s) s.textContent = '–'
  if (d) d.textContent = '–'
  if (m) m.textContent = '–'
  if (kf) kf.textContent = ''
  syncKmtCompactLine()
}

function applyKmtResult(res) {
  const st = document.getElementById('kmt-status')
  const line = document.getElementById('kmt-road-line')
  const sEl = document.getElementById('kmt-s')
  const dEl = document.getElementById('kmt-d')
  const mEl = document.getElementById('kmt-m')
  const kf = document.getElementById('kmt-kortform')
  if (!line) return
  if (!res) {
    if (st) {
      st.textContent = 'Fant ingen vegreferanse for posisjonen.'
      st.hidden = false
    }
    cancelKmtMeterTween()
    kmtDisplayedMeter = null
    kmtRefSegmentKey = ''
    line.textContent = '–'
    if (sEl) sEl.textContent = '–'
    if (dEl) dEl.textContent = '–'
    if (mEl) mEl.textContent = '–'
    if (kf) kf.textContent = ''
    syncKmtCompactLine()
    return
  }
  if (st) {
    st.textContent = ''
    st.hidden = true
  }
  kmtHasDisplayedResult = true
  const segKey = `${res.roadLine}|${res.s}|${res.d}`
  const mInt = parseKmtMeterInt(res.m)
  const segmentChanged = segKey !== kmtRefSegmentKey
  kmtRefSegmentKey = segKey
  line.textContent = res.roadLine
  if (sEl) sEl.textContent = res.s
  if (dEl) dEl.textContent = res.d
  if (kf) kf.textContent = res.kortform || ''
  if (!mEl) {
    syncKmtCompactLine()
    return
  }
  if (mInt == null) {
    cancelKmtMeterTween()
    kmtDisplayedMeter = null
    mEl.textContent = res.m
    syncKmtCompactLine()
    return
  }
  if (segmentChanged || kmtDisplayedMeter == null) {
    cancelKmtMeterTween()
    kmtDisplayedMeter = mInt
    mEl.textContent = String(mInt)
    syncKmtCompactLine()
    return
  }
  const prev = kmtDisplayedMeter
  if (Math.abs(mInt - prev) > KMT_METER_SNAP_IF_DELTA) {
    cancelKmtMeterTween()
    kmtDisplayedMeter = mInt
    mEl.textContent = String(mInt)
    syncKmtCompactLine()
    return
  }
  startKmtMeterTweenTo(mInt)
}

function applyKmtError(err) {
  const st = document.getElementById('kmt-status')
  if (st) {
    const msg =
      err && typeof err.message === 'string'
        ? err.message.slice(0, 220)
        : 'Kunne ikke hente vegreferanse.'
    st.textContent = msg
    st.hidden = false
  }
  const line = document.getElementById('kmt-road-line')
  if (line) line.textContent = '–'
  const sEl = document.getElementById('kmt-s')
  const dEl = document.getElementById('kmt-d')
  const mEl = document.getElementById('kmt-m')
  const kf = document.getElementById('kmt-kortform')
  if (sEl) sEl.textContent = '–'
  if (dEl) dEl.textContent = '–'
  if (mEl) mEl.textContent = '–'
  if (kf) kf.textContent = ''
  syncKmtCompactLine()
}

function formatHomeVegrefMeterText(meterPart) {
  let mStr
  if (typeof meterPart === 'number' && Number.isFinite(meterPart)) {
    mStr = String(Math.round(meterPart))
  } else {
    const t = String(meterPart ?? '–').trim()
    mStr = t || '–'
  }
  const noMeter = mStr === '–' || mStr === '-'
  return noMeter ? mStr : `${mStr}M`
}

function setHomeVegrefCompactDom(s, d, meterPart) {
  const sEl = document.getElementById('home-vegref-s')
  const dEl = document.getElementById('home-vegref-d')
  const mEl = document.getElementById('home-vegref-meter')
  const ss = s != null ? String(s) : '–'
  const dd = d != null ? String(d) : '–'
  if (sEl) sEl.textContent = `S${ss}`
  if (dEl) dEl.textContent = `D${dd}`
  if (mEl) mEl.textContent = formatHomeVegrefMeterText(meterPart)
}

function cancelHomeVegrefMeterTween() {
  if (homeVegrefMeterAnim != null) {
    cancelAnimationFrame(homeVegrefMeterAnim)
    homeVegrefMeterAnim = null
  }
}

function tickHomeVegrefMeterTween(now) {
  const mEl = document.getElementById('home-vegref-meter')
  if (!mEl || view !== 'home') {
    homeVegrefMeterAnim = null
    return
  }
  const u = Math.min(1, (now - homeVegrefMeterT0) / HOME_VEGREF_METER_TWEEN_MS)
  const ease = 1 - (1 - u) ** 3
  const v = Math.round(
    homeVegrefMeterFrom + (homeVegrefMeterTo - homeVegrefMeterFrom) * ease,
  )
  mEl.textContent = formatHomeVegrefMeterText(v)
  homeVegrefDisplayedMeter = v
  if (u < 1) {
    homeVegrefMeterAnim = requestAnimationFrame(tickHomeVegrefMeterTween)
  } else {
    homeVegrefMeterAnim = null
    mEl.textContent = formatHomeVegrefMeterText(homeVegrefMeterTo)
    homeVegrefDisplayedMeter = homeVegrefMeterTo
  }
}

function startHomeVegrefMeterTweenTo(targetInt) {
  const mEl = document.getElementById('home-vegref-meter')
  if (!mEl) return
  const from =
    homeVegrefDisplayedMeter != null ? homeVegrefDisplayedMeter : targetInt
  if (from === targetInt) {
    mEl.textContent = formatHomeVegrefMeterText(targetInt)
    homeVegrefDisplayedMeter = targetInt
    cancelHomeVegrefMeterTween()
    return
  }
  cancelHomeVegrefMeterTween()
  homeVegrefMeterFrom = from
  homeVegrefMeterTo = targetInt
  homeVegrefMeterT0 = performance.now()
  homeVegrefMeterAnim = requestAnimationFrame(tickHomeVegrefMeterTween)
}

function stopHomeVegrefTracking() {
  if (homeVegrefWatchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(homeVegrefWatchId)
    homeVegrefWatchId = null
  }
  vegrefStopPipeline()
  cancelHomeVegrefMeterTween()
  homeVegrefSegKey = ''
  homeVegrefDisplayedMeter = null
}

/**
 * Felles GPS-inndata til NVDB-kø (forside + KMT): oppdaterer også lastLiveCoords for bilder.
 * @param {number} lat
 * @param {number} lng
 * @param {number} [accuracy]
 * @param {boolean} [forceImmediate]
 */
function feedVegrefFromGps(lat, lng, accuracy, forceImmediate) {
  if (lat == null || lng == null) return
  const acc = Math.max(
    typeof accuracy === 'number' && !Number.isNaN(accuracy) ? accuracy : 20,
    8,
  )
  lastLiveCoords = { lat, lng, accuracy: acc, ts: Date.now() }
  vegrefNotifyGps(lat, lng, { forceImmediate: !!forceImmediate })
}

function scheduleHomeVegrefLookup(lat, lng, forceImmediate, accuracy) {
  if (view !== 'home' || lat == null || lng == null) return
  feedVegrefFromGps(lat, lng, accuracy, forceImmediate)
}

function scheduleKmtVegrefLookup(lat, lng, forceImmediate, accuracy) {
  if (!kmtDialogOpen || lat == null || lng == null) return
  feedVegrefFromGps(lat, lng, accuracy, forceImmediate)
}

function setHomeVegrefPlaceholder(msg) {
  cancelHomeVegrefMeterTween()
  const prim = document.getElementById('home-vegref-primary')
  const typeEl = document.getElementById('home-vegref-type')
  const comp = document.getElementById('home-vegref-compact')
  if (prim) prim.textContent = msg
  if (typeEl) {
    typeEl.textContent = ''
    typeEl.hidden = true
  }
  if (comp) {
    const sEl = document.getElementById('home-vegref-s')
    const dEl = document.getElementById('home-vegref-d')
    const mEl = document.getElementById('home-vegref-meter')
    if (sEl) sEl.textContent = ''
    if (dEl) dEl.textContent = ''
    if (mEl) mEl.textContent = ''
    comp.hidden = true
  }
}

function applyHomeVegrefResult(res) {
  if (view !== 'home') return
  const prim = document.getElementById('home-vegref-primary')
  const typeEl = document.getElementById('home-vegref-type')
  const comp = document.getElementById('home-vegref-compact')
  if (!prim) return

  if (!res) {
    /* Ingen treff: ikke tøm eller vis feil – behold siste gode visning. */
    return
  }

  const dist = res.distToRoadM
  if (
    typeof dist === 'number' &&
    !Number.isNaN(dist) &&
    dist > HOME_VEGREF_MAX_DIST_SKIP_M &&
    homeVegrefHasDisplayedResult
  ) {
    /* Tvilsomt treff etter vi allerede viser noe – ignorer (unngår hopp/glitch). */
    return
  }

  const longDisplay = String(res.roadLineDisplay || '').trim()
  const longOfficial = String(res.roadLine || '').trim()
  const display = String(
    res.roadLineDisplayShort ||
      res.roadLineShort ||
      res.roadLineDisplay ||
      res.roadLine ||
      '',
  ).trim()
  const officialShort = String(res.roadLineShort || longOfficial || '').trim()
  if (!display && !officialShort) return

  homeVegrefHasDisplayedResult = true
  prim.textContent = display || officialShort
  if (typeEl) {
    const isStreet =
      longDisplay &&
      longOfficial &&
      longDisplay !== longOfficial &&
      officialShort
    if (isStreet) {
      typeEl.textContent = officialShort
      typeEl.hidden = false
    } else {
      typeEl.textContent = ''
      typeEl.hidden = true
    }
  }
  if (comp) {
    homeVegrefCompactS = res.s
    homeVegrefCompactD = res.d
    const segKey = `${longOfficial}|${res.s}|${res.d}`
    const mInt = parseKmtMeterInt(res.m)
    if (mInt == null) {
      cancelHomeVegrefMeterTween()
      homeVegrefSegKey = segKey
      homeVegrefDisplayedMeter = null
      setHomeVegrefCompactDom(res.s, res.d, res.m)
    } else {
      const segChanged = segKey !== homeVegrefSegKey
      homeVegrefSegKey = segKey
      if (segChanged || homeVegrefDisplayedMeter == null) {
        cancelHomeVegrefMeterTween()
        homeVegrefDisplayedMeter = mInt
        setHomeVegrefCompactDom(res.s, res.d, mInt)
      } else {
        const prev = homeVegrefDisplayedMeter
        if (Math.abs(mInt - prev) > HOME_VEGREF_METER_SNAP) {
          cancelHomeVegrefMeterTween()
          homeVegrefDisplayedMeter = mInt
          setHomeVegrefCompactDom(res.s, res.d, mInt)
        } else {
          startHomeVegrefMeterTweenTo(mInt)
        }
      }
    }
    comp.hidden = false
  }
}

function startHomeVegrefTracking() {
  stopHomeVegrefTracking()
  homeVegrefHasDisplayedResult = false
  if (!window.isSecureContext || !navigator.geolocation) {
    setHomeVegrefPlaceholder(
      window.isSecureContext
        ? 'Posisjon er ikke tilgjengelig i nettleseren.'
        : 'Bruk https:// for å se vegreferanse.',
    )
    return
  }
  if (vegrefHasLastDisplay()) {
    vegrefReapplyLastToDom()
  } else {
    setHomeVegrefPlaceholder('Henter posisjon …')
  }
  homeVegrefWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (view !== 'home') return
      const { latitude, longitude, accuracy } = pos.coords
      if (accuracy > GPS_REJECT_M) return
      scheduleHomeVegrefLookup(latitude, longitude, false, accuracy)
    },
    (err) => {
      if (view !== 'home') return
      /* Har vi allerede vegreferanse, ikke bytt til feilmelding (unngår glitch). */
      if (homeVegrefHasDisplayedResult || vegrefHasLastDisplay()) return
      setHomeVegrefPlaceholder(describeGeolocationFailure(err))
    },
    {
      enableHighAccuracy: true,
      maximumAge: 400,
      timeout: 20000,
    },
  )
}

async function openKmtDialog() {
  const dlg = document.getElementById('kmt-dialog')
  if (!dlg) return
  kmtDialogOpen = true
  vegrefResetThrottle()
  kmtHasDisplayedResult = false
  kmtRefSegmentKey = ''
  kmtDisplayedMeter = null
  cancelKmtMeterTween()
  stopKmtCameraStream()
  dlg.showModal()

  const video = document.getElementById('kmt-video')
  if (
    isKmtCameraUiPreferred() &&
    navigator.mediaDevices?.getUserMedia &&
    video
  ) {
    try {
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      }
      kmtMediaStream = stream
      video.srcObject = stream
      video.muted = true
      video.setAttribute('playsinline', '')
      video.playsInline = true
      await video.play()
      const vtrack = stream.getVideoTracks()[0]
      const farOk = await applyKmtFarFocusPreference(vtrack)
      if (!farOk) {
        await applyKmtContinuousAutofocus(vtrack)
      }
      /* Langsom AF mot nær motiv: etter kort delay, punktfokus i øvre tredjedel (typisk vei/horisont). */
      window.setTimeout(() => {
        if (!kmtDialogOpen) return
        const vt = kmtMediaStream?.getVideoTracks?.()?.[0]
        const vid = document.getElementById('kmt-video')
        if (vt && vid) void applyKmtNormalizedPointFocus(vt, 0.5, 0.26)
      }, 520)
      kmtCameraMode = true
      dlg.classList.add('kmt-dialog--camera')
    } catch {
      kmtCameraMode = false
      dlg.classList.remove('kmt-dialog--camera')
      const st = document.getElementById('kmt-status')
      if (st) {
        st.textContent = 'Kamera ikke tilgjengelig.'
        st.hidden = false
      }
    }
  } else {
    kmtCameraMode = false
    dlg.classList.remove('kmt-dialog--camera')
  }

  const lat0 = lastLiveCoords?.lat
  const lng0 = lastLiveCoords?.lng
  if (lat0 != null && lng0 != null) {
    scheduleKmtVegrefLookup(lat0, lng0, true)
  } else {
    const st = document.getElementById('kmt-status')
    if (st) {
      st.textContent = 'Venter på GPS …'
      st.hidden = false
    }
    void (async () => {
      try {
        const p = await getPosition()
        lastLiveCoords = {
          lat: p.lat,
          lng: p.lng,
          accuracy: p.accuracy,
          ts: Date.now(),
        }
        if (!kmtDialogOpen) return
        scheduleKmtVegrefLookup(p.lat, p.lng, true)
      } catch {
        if (!kmtDialogOpen) return
        const st2 = document.getElementById('kmt-status')
        if (st2) {
          st2.textContent =
            'GPS ikke tilgjengelig – vegreferanse og posisjon på bilder kan mangle.'
          st2.hidden = false
        }
      }
    })()
  }
}

async function handleDrivingPosition(pos, seq, gpsStatusEl, firstFixRef) {
  const { latitude, longitude, accuracy, heading, speed } = pos.coords
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return
  }
  const acc =
    typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0
      ? accuracy
      : 50

  lastRawGpsFromWatch = {
    lat: latitude,
    lng: longitude,
    accuracy: acc,
    ts: Date.now(),
  }

  const initial = firstFixRef.v
  if (firstFixRef.v) firstFixRef.v = false

  const headingDeg =
    heading != null && !Number.isNaN(heading) ? heading : null

  pushTracePoint(latitude, longitude)

  /**
   * Blå posisjon = samme rå GPS som «Registrer» bruker (via watch / getCurrentPosition).
   * Ikke bruk smoothToward her — dobbelt glatting + OSRM-snap ga markør som hang etter og
   * ikke stemte med nåler. OSRM brukes kun til vegreferanse/KMT, ikke til å flytte brukerikon.
   */
  updateUserLocationOnMap(latitude, longitude, acc, {
    initial,
    heading: headingDeg,
    speed,
    roadSnapped: false,
  })

  if (acc > GPS_REJECT_M) {
    if (gpsStatusEl) {
      gpsStatusEl.textContent = `Svakt signal (ca. ±${Math.round(
        acc,
      )} m) – kartet følger posisjonen din; prøv utendørs med fri sikt for bedre treff.`
    }
    if (kmtDialogOpen) {
      scheduleKmtVegrefLookup(latitude, longitude, false, acc)
    }
    return
  }

  const snapped = await snapToRoadNetwork(latitude, longitude, acc)
  if (seq !== positionSeq) return

  if (gpsStatusEl) {
    const snapTxt = snapped
      ? ' · vei funnet (kun referanse)'
      : ' · sanntid'
    gpsStatusEl.textContent = `Kjøring · nøyaktighet ca. ${Math.round(acc)} m${snapTxt}`
  }

  if (kmtDialogOpen) {
    const refLat = snapped ? snapped.lat : latitude
    const refLng = snapped ? snapped.lng : longitude
    scheduleKmtVegrefLookup(refLat, refLng, false, acc)
  }
}

/**
 * watchPosition med høy nøyaktighet for kjøring, glatting + vei-snap (OSRM).
 */
function requestLocationOnLoad(gpsStatusEl) {
  if (!window.isSecureContext || !navigator.geolocation) {
    if (gpsStatusEl) {
      gpsStatusEl.textContent = window.isSecureContext
        ? 'Nettleseren støtter ikke posisjon.'
        : 'Bruk https:// eller localhost for å kunne bruke posisjon.'
    }
    if (state.clickHistory.length) fitAllPins()
    return
  }

  if (gpsStatusEl) {
    gpsStatusEl.textContent =
      'Tillat posisjon – kartet følger deg. Dra i kartet for å se rundt; «Min posisjon» sentrerer igjen.'
  }

  resetDrivingFilters()
  const firstFixRef = { v: true }
  stopLocationWatch()
  locationWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const seq = ++positionSeq
      void handleDrivingPosition(pos, seq, gpsStatusEl, firstFixRef)
    },
    (err) => {
      if (gpsStatusEl) {
        gpsStatusEl.textContent = describeGeolocationFailure(err)
      }
      if (state.clickHistory.length) fitAllPins()
    },
    {
      enableHighAccuracy: true,
      /* 0 gir ofte færre oppdateringer på mobil; litt cache = jevnere strøm */
      maximumAge: 2000,
      timeout: 27000,
    },
  )

  clearDrivingGpsStuckPoll()
  const STALE_MS = 12000
  const POLL_MS = 6000
  drivingGpsStuckPollId = window.setInterval(() => {
    if (locationWatchId == null) return
    const w = lastRawGpsFromWatch
    if (w && Date.now() - w.ts < STALE_MS) return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const seq = ++positionSeq
        void handleDrivingPosition(pos, seq, gpsStatusEl, firstFixRef)
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
  }, POLL_MS)
}

function renderLog() {
  const el = document.getElementById('logg-list')
  if (!el) return
  const entries = state.log
  el.innerHTML = entries
    .map((e, i) => {
      const num = i + 1
      const msg = escapeHtml(formatLogMessageForDisplay(e.message)).replace(
        /\n/g,
        '<br />',
      )
      return `
      <li class="logg-item" aria-label="Logg ${num}">
        <span class="logg-item__num" aria-hidden="true">${num}</span>
        <div class="logg-item__body">
          <time datetime="${e.timestamp}">${formatLogTime(e.timestamp)}</time>
          <p class="logg-msg">${msg}</p>
        </div>
      </li>`
    })
    .join('')
}

function escapeHtml(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function syncSessionSheetAccuracy() {
  const src = document.getElementById('gps-status')
  const dst = document.getElementById('session-sheet-accuracy')
  if (!dst) return
  const t = (src?.textContent ?? '').trim()
  dst.textContent = t
  dst.toggleAttribute('hidden', t.length === 0)
}

/** Speiler GPS-status til sheet (nøyaktighet i mid/expanded). */
function wireSessionGpsSheetMirror(signal) {
  const src = document.getElementById('gps-status')
  if (!src) return
  syncSessionSheetAccuracy()
  const obs = new MutationObserver(() => syncSessionSheetAccuracy())
  obs.observe(src, { characterData: true, subtree: true, childList: true })
  signal.addEventListener('abort', () => obs.disconnect(), { once: true })
}

function animateSessionPinDrop() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const clickCount = state.clickHistory.filter(
    (c) => c.lat != null && c.lng != null,
  ).length
  if (clickCount === 0) return
  const idx = clickCount - 1
  const m = markers[idx]
  const el = m?.getElement?.()
  const pin = el?.querySelector?.('.map-pin')
  if (!pin) return
  pin.classList.remove('map-pin--drop')
  void pin.offsetWidth
  pin.classList.add('map-pin--drop')
  const done = () => {
    pin.classList.remove('map-pin--drop')
    pin.removeEventListener('animationend', done)
  }
  pin.addEventListener('animationend', done, { once: true })
}

function wireSessionBottomSheet(signal) {
  const sheet = document.getElementById('session-bottom-sheet')
  if (!sheet || !window.PointerEvent) return

  const collapsedH = 120
  const midH = 252
  const expandedMax = 440
  const expandedH = () =>
    Math.min(Math.round(window.innerHeight * 0.5), expandedMax)

  let dragState = null

  const heights = () => ({
    collapsed: collapsedH,
    mid: midH,
    expanded: expandedH(),
  })

  const applyHeight = (px, withTransition) => {
    sheet.style.transition = withTransition
      ? 'height 0.26s cubic-bezier(0.25, 0.1, 0.25, 1)'
      : 'none'
    sheet.style.height = `${px}px`
    document.documentElement.style.setProperty('--session-sheet-h', `${px}px`)
    queueMicrotask(() => {
      try {
        map?.invalidateSize()
      } catch {
        /* ignore */
      }
    })
  }

  const snapNearest = (h) => {
    const { collapsed, mid, expanded } = heights()
    const targets = [
      { state: 'collapsed', h: collapsed },
      { state: 'mid', h: mid },
      { state: 'expanded', h: expanded },
    ]
    let best = targets[0]
    let bestD = Math.abs(h - best.h)
    for (const t of targets) {
      const d = Math.abs(h - t.h)
      if (d < bestD) {
        bestD = d
        best = t
      }
    }
    sheet.dataset.sheetState = best.state
    applyHeight(best.h, true)
  }

  const handle = sheet.querySelector('.session-sheet-handle')
  handle?.setAttribute('tabindex', '0')
  handle?.setAttribute('role', 'slider')
  handle?.setAttribute('aria-orientation', 'vertical')
  handle?.setAttribute('aria-valuemin', '0')
  handle?.setAttribute('aria-valuemax', '2')

  const ariaFromState = (s) => {
    const v = s === 'collapsed' ? 0 : s === 'mid' ? 1 : 2
    handle?.setAttribute('aria-valuenow', String(v))
    handle?.setAttribute(
      'aria-valuetext',
      s === 'collapsed'
        ? 'Lukket'
        : s === 'mid'
          ? 'Halvveis'
          : 'Utvidet',
    )
  }

  const initial = sheet.dataset.sheetState === 'expanded'
    ? 'expanded'
    : sheet.dataset.sheetState === 'collapsed'
      ? 'collapsed'
      : 'mid'
  sheet.dataset.sheetState = initial
  applyHeight(
    initial === 'collapsed'
      ? collapsedH
      : initial === 'expanded'
        ? expandedH()
        : midH,
    false,
  )
  ariaFromState(sheet.dataset.sheetState)

  const onResize = () => {
    if (sheet.dataset.sheetState === 'expanded') {
      applyHeight(expandedH(), false)
    }
  }
  window.addEventListener('resize', onResize, { signal })

  handle?.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return
      dragState = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startH: sheet.getBoundingClientRect().height,
      }
      sheet.style.transition = 'none'
      try {
        handle.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    { signal },
  )

  handle?.addEventListener(
    'pointermove',
    (e) => {
      if (!dragState || e.pointerId !== dragState.pointerId) return
      const dy = dragState.startY - e.clientY
      const { collapsed, expanded } = heights()
      const maxH = expanded
      let nh = dragState.startH + dy
      nh = Math.max(collapsed, Math.min(nh, maxH))
      sheet.style.height = `${nh}px`
      document.documentElement.style.setProperty('--session-sheet-h', `${nh}px`)
    },
    { signal },
  )

  const endDrag = (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return
    dragState = null
    try {
      handle.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const h = sheet.getBoundingClientRect().height
    snapNearest(h)
    ariaFromState(sheet.dataset.sheetState)
  }

  handle?.addEventListener('pointerup', endDrag, { signal })
  handle?.addEventListener('pointercancel', endDrag, { signal })

  handle?.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const order = ['collapsed', 'mid', 'expanded']
        const cur = sheet.dataset.sheetState || 'mid'
        let i = order.indexOf(cur)
        if (e.key === 'ArrowUp') i = Math.min(order.length - 1, i + 1)
        else i = Math.max(0, i - 1)
        const next = order[i]
        sheet.dataset.sheetState = next
        const { collapsed, mid, expanded } = heights()
        const px =
          next === 'collapsed'
            ? collapsed
            : next === 'mid'
              ? mid
              : expanded
        applyHeight(px, true)
        ariaFromState(next)
      }
    },
    { signal },
  )
}

function renderCount() {
  const n = document.getElementById('count-display')
  if (!n) return
  const c = state.count
  const next =
    c === 0 ? 'Ingen registreringer enda' : `${c} registrert`
  n.classList.toggle('count-display--empty', c === 0)
  if (n.textContent !== next) {
    n.classList.remove('count-display--tick')
    void n.offsetWidth
    if (c > 0) n.classList.add('count-display--tick')
  }
  n.textContent = next
  const meta = document.getElementById('map-meta')
  if (meta) {
    const pins = state.clickHistory.filter(
      (c) => c.lat != null && c.lng != null,
    ).length
    const imgs = state.photos.filter(
      (p) => p.lat != null && p.lng != null,
    ).length
    const parts = []
    parts.push(
      pins === 0
        ? 'Ingen punkter ennå'
        : `${pins} ${pins === 1 ? 'punkt' : 'punkter'} på kartet`,
    )
    if (state.photos.length) {
      parts.push(
        `${state.photos.length} ${state.photos.length === 1 ? 'bilde' : 'bilder'}`,
      )
    }
    meta.textContent = parts.join(' · ')
  }
}

function flushCurrentSession() {
  if (!currentSessionId) return
  const idx = sessions.findIndex((s) => s.id === currentSessionId)
  if (idx === -1) return
  const cats = normalizeObjectCategoryList(state.objectCategories)
  const activeCat =
    typeof state.activeCategoryId === 'string' && cats.includes(state.activeCategoryId)
      ? state.activeCategoryId
      : cats.length
        ? cats[0]
        : null
  sessions[idx] = {
    ...sessions[idx],
    count: state.count,
    clickHistory: state.clickHistory,
    log: state.log,
    roadSide: state.roadSide ?? null,
    photos: Array.isArray(state.photos) ? state.photos : [],
    objectCategories: cats,
    activeCategoryId: activeCat,
    updatedAt: nowIso(),
  }
  saveAppState()
}

function persist() {
  flushCurrentSession()
  renderCount()
  renderLog()
  renderPhotosGallery()
  updateMapSharePanel()
}

function renderPhotosGallery() {
  const el = document.getElementById('photos-gallery')
  if (!el) return
  const strip = document.getElementById('session-photos-strip')
  const compact = el.classList.contains('photos-gallery--session')
  if (!state.photos.length) {
    el.innerHTML = ''
    if (strip) strip.hidden = true
    return
  }
  if (strip) strip.hidden = false
  el.innerHTML = state.photos
    .map((ph, i) => {
      const v = ph.vegref && normalizePhotoVegref(ph.vegref)
      const ov = v ? formatPhotoVegrefOverlayHtml(v, 'thumb') : ''
      const meta = compact
        ? ''
        : `<span class="photo-thumb-meta">#${i + 1} · ${formatNb(new Date(ph.timestamp))}</span>`
      return `
      <button type="button" class="photo-thumb-card" data-photo-id="${escapeHtml(ph.id)}">
        <span class="photo-thumb-frame">
          <img src="${ph.dataUrl}" alt="" class="photo-thumb-img" loading="lazy" decoding="async" />
          ${ov}
        </span>
        ${meta}
      </button>`
    })
    .join('')
}

/**
 * @param {string} dataUrl
 * @param {number} maxDim
 * @param {number} quality
 */
function compressDataUrlToDataUrl(dataUrl, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('image'))
    img.src = dataUrl
  })
}

const MAX_SESSION_PHOTOS = 32
/** Maks kant på lagrede bilder (album / opplasting). */
const PHOTO_MAX_DIM = 1920
const PHOTO_JPEG_QUALITY = 0.9
/** KMT-kamera: ekstra høy tak – nedskaling skjer først ved veldig store sensorer. */
const KMT_CAPTURE_MAX_DIM = 2560

/**
 * @param {string} dataUrl
 * @param {{ lat?: number | null, lng?: number | null, vegref?: { road: string, compact: string, kortform: string } | null }} [opts] Eksplisitte koord (f.eks. EXIF) brukes først. `vegref` vises som HTML-overlay (skarp ved zoom), ikke innprintet i pikslene.
 */
async function addPhotoFromCompressedDataUrl(dataUrl, opts = {}) {
  let lat = null
  let lng = null
  const oLat = opts.lat
  const oLng = opts.lng
  if (
    oLat != null &&
    oLng != null &&
    !Number.isNaN(Number(oLat)) &&
    !Number.isNaN(Number(oLng))
  ) {
    lat = Number(oLat)
    lng = Number(oLng)
  } else {
    try {
      if (lastLiveCoords && Date.now() - lastLiveCoords.ts < 120000) {
        lat = lastLiveCoords.lat
        lng = lastLiveCoords.lng
      } else {
        const p = await getPosition()
        lat = p.lat
        lng = p.lng
      }
    } catch {
      /* ingen GPS */
    }
    if (
      (lat == null || lng == null) &&
      kmtDialogOpen &&
      lastLiveCoords &&
      Date.now() - lastLiveCoords.ts < 120000
    ) {
      lat = lastLiveCoords.lat
      lng = lastLiveCoords.lng
    }
  }

  const entry = normalizePhoto({
    id: crypto.randomUUID(),
    timestamp: nowIso(),
    lat,
    lng,
    dataUrl,
    ...(opts.vegref ? { vegref: opts.vegref } : {}),
  })
  if (!entry) return

  if (kmtStandaloneFlow) {
    standalonePhotos.push(entry)
    let didShift = false
    while (standalonePhotos.length > MAX_SESSION_PHOTOS) {
      standalonePhotos.shift()
      didShift = true
    }
    saveAppState()
    if (view === 'photoAlbum') {
      if (didShift) {
        renderStandalonePhotoAlbumGallery()
      } else {
        appendStandalonePhotoAlbumCell(entry)
        syncPhotoAlbumChrome()
      }
    }
    return
  }

  if (!state.photos) state.photos = []
  state.photos.push(entry)
  while (state.photos.length > MAX_SESSION_PHOTOS) {
    state.photos.shift()
  }

  if (lat != null && lng != null) {
    addLogEntry(state, {
      message: `Bilde · ${state.photos.length} · med GPS`,
    })
  } else {
    addLogEntry(state, {
      message: `Bilde · ${state.photos.length} · uten GPS`,
    })
  }
  persist()
  if (map) await ensureLeaflet()
  rebuildMarkers()
}

/** Varsel når brukeren åpner http://172… – Safari blokkerer GPS til de bytter til https:// */
function insecureContextBannerHtml() {
  if (window.isSecureContext) return ''
  const p = window.location.port ? `:${window.location.port}` : ''
  const suggested = `https://${window.location.hostname}${p}/`
  return `<div class="secure-banner" role="alert">
    <strong>Du er på HTTP – GPS er av.</strong>
    Safari (og Chrome) tillater ikke posisjon fra <code>http://</code> til en IP-adresse.
    <p class="secure-banner-lead">Skriv inn dette i adresselinjen (bytt <code>http</code> → <code>https</code>):</p>
    <p class="secure-url-line"><code>${suggested}</code></p>
    <p class="secure-banner-steps">Kjør <code>npm run dev</code> på Mac (ikke <code>dev:http</code>). Første gang: trykk «Vis detaljer» → «besøk nettstedet» hvis Safari klager på sertifikat.</p>
  </div>`
}

function renderAuthHtml() {
  const isLogin = authScreen === 'login'
  return `<div class="view-auth view-promo-shell">
    <div class="promo-bg" aria-hidden="true"></div>
    <div class="auth-layout">
      <img src="/assets/app-logo.png" alt="Scanix" class="app-logo" decoding="async" fetchpriority="high" />
      <div class="auth-tabs-card" role="presentation">
        <div class="auth-tabs auth-tabs--pill" role="tablist" aria-label="Logg inn eller opprett bruker">
          <button type="button" role="tab" id="auth-tab-login" class="auth-tab ${isLogin ? 'auth-tab--active' : ''}" aria-selected="${isLogin ? 'true' : 'false'}">Logg inn</button>
          <button type="button" role="tab" id="auth-tab-register" class="auth-tab ${!isLogin ? 'auth-tab--active' : ''}" aria-selected="${!isLogin ? 'true' : 'false'}">Opprett bruker</button>
        </div>
      </div>
      <div class="auth-card auth-card--glass auth-card--form">
        <form id="form-auth-login" class="auth-form" aria-label="Logg inn" ${isLogin ? '' : 'hidden'}>
          <label class="auth-label">E-post
            <input type="email" id="auth-login-email" class="auth-input auth-input--glass" autocomplete="email" required />
          </label>
          <label class="auth-label">Passord
            <input type="password" id="auth-login-password" class="auth-input auth-input--glass" autocomplete="current-password" required />
          </label>
          <button type="submit" class="btn-auth-gradient">Logg inn</button>
        </form>
        <form id="form-auth-register" class="auth-form" aria-label="Registrer bruker" ${!isLogin ? '' : 'hidden'}>
          <label class="auth-label">Navn
            <input type="text" id="auth-reg-name" class="auth-input auth-input--glass" autocomplete="name" maxlength="${AUTH_NAME_MAX_LEN}" required />
          </label>
          <label class="auth-label">E-post
            <input type="email" id="auth-reg-email" class="auth-input auth-input--glass" autocomplete="email" required />
          </label>
          <label class="auth-label">Passord
            <input type="password" id="auth-reg-password" class="auth-input auth-input--glass" autocomplete="new-password" minlength="${AUTH_PASSWORD_MIN_LEN}" required />
          </label>
          <p class="auth-hint">Minst ${AUTH_PASSWORD_MIN_LEN} tegn.</p>
          <button type="submit" class="btn-auth-gradient btn-auth-gradient--teal">Opprett bruker</button>
        </form>
        <p id="auth-error" class="auth-error" role="alert" aria-live="polite"></p>
        <p class="auth-disclaimer">Passord lagres kryptert på denne enheten. Bruk kun på egen enhet du stoler på.</p>
      </div>
    </div>
  </div>`
}

function renderHomeHtml() {
  const shortIdStr =
    currentUser && isValidStoredShortId(currentUser.shortId)
      ? currentUser.shortId
      : ''
  const identity =
    currentUser &&
    shortIdStr &&
    `<div class="home-user-bar__identity">
      <div class="home-user-bar__shortid">
        <span class="home-user-bar__shortid-label">Bruker-ID</span>
        <span class="home-user-bar__shortid-value">${escapeHtml(shortIdStr)}</span>
      </div>
    </div>`
  const userBar =
    currentUser &&
    `<div class="home-user-bar">
      ${identity || ''}
      <div class="home-user-bar__actions">
        <button type="button" class="btn-home-hamburger" id="btn-home-drawer-open" aria-label="Flere funksjoner" aria-expanded="false" aria-controls="home-drawer">
          <span class="btn-home-hamburger__line" aria-hidden="true"></span>
          <span class="btn-home-hamburger__line" aria-hidden="true"></span>
          <span class="btn-home-hamburger__line" aria-hidden="true"></span>
        </button>
        <button type="button" class="btn-inbox-header btn-inbox-header--toolbar" id="btn-home-inbox" data-inbox-trigger hidden aria-label="Meldinger">
          <span class="btn-inbox-header__wrap">
            <svg class="btn-inbox-header__svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M22 8l-10 6L2 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="btn-inbox-header__badge" data-inbox-badge hidden></span>
          </span>
        </button>
        <button type="button" class="btn btn-text btn-logout" id="btn-logout">Logg ut</button>
      </div>
    </div>`
  return `<div class="view-home surface--home">
    ${userBar || ''}
    <div class="home-vegref" role="status" aria-live="off">
      <p id="home-vegref-primary" class="home-vegref__primary">Henter posisjon …</p>
      <p id="home-vegref-type" class="home-vegref__type" hidden></p>
      <div id="home-vegref-compact" class="home-vegref__compact" hidden>
        <div id="home-vegref-s" class="home-vegref__line home-vegref__line--s"></div>
        <div id="home-vegref-d" class="home-vegref__line home-vegref__line--d"></div>
        <div id="home-vegref-meter" class="home-vegref__meter"></div>
      </div>
    </div>
    <div class="home-main">
    <div class="home-bilde-stack">
      <div id="panel-home-bilde-camera" class="home-bilde-panel" role="region" aria-label="Bilde">
        <p class="home-bilde-panel__hint">Trykk kamera-ikonet nederst for å ta bilde til albumet.</p>
      </div>
      <div id="panel-home-bilde-ai" class="home-bilde-panel" role="region" aria-label="AI dokumentering" hidden>
        <div id="home-ai-fullscreen" class="home-ai-fullscreen">
          <p id="home-ai-status" class="home-ai-fs-status" role="status" aria-live="polite"></p>
          <div id="home-ai-stage-camera" class="home-ai-stage home-ai-stage--camera home-ai-stage--fs" hidden>
            <p class="home-bilde-panel__hint home-ai-camera-hint">Ta bilde, eller gå tilbake til chat.</p>
            <div class="home-ai-video-stage" id="home-ai-video-stage">
              <video id="home-ai-video" class="home-ai-video" playsinline muted autoplay></video>
              <button type="button" class="home-ai-capture-fab" id="btn-home-ai-capture">Ta bilde</button>
            </div>
            <div class="home-ai-camera-actions">
              <button type="button" class="btn btn-text home-ai-file-fallback" id="btn-home-ai-pick-file">Velg bilde fra filer</button>
              <button type="button" class="btn btn-text" id="btn-home-ai-back-to-chat">Tilbake til chat</button>
            </div>
            <input type="file" id="home-ai-image-fallback" class="visually-hidden" accept="image/*" tabindex="-1" aria-hidden="true" />
          </div>
          <div id="home-ai-stage-chat" class="home-ai-stage home-ai-stage--chat home-ai-gpt home-ai-gpt--fs home-ai-gpt--chatgpt">
            <header class="home-ai-gpt__header">
              <button type="button" class="home-ai-gpt__close" id="btn-home-ai-close-fs" aria-label="Lukk">
                <svg class="home-ai-gpt__close-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <div class="home-ai-gpt__title-wrap">
                <span class="home-ai-gpt__title">AI dokumentering</span>
              </div>
              <div class="home-ai-gpt__header-actions">
                <button type="button" class="home-ai-gpt__tool" id="btn-home-ai-open-camera">Ta bilde</button>
                <button type="button" class="home-ai-gpt__tool" id="btn-home-ai-pick-file-chat">Filer</button>
                <button type="button" class="home-ai-gpt__tool" id="btn-home-ai-pdf">PDF</button>
                <button type="button" class="home-ai-gpt__tool home-ai-gpt__tool--contract" id="btn-home-ai-contract-rag" title="Still spørsmål om kontrakten til AI">Kontrakt</button>
              </div>
            </header>
            <p id="home-ai-mode-hint" class="home-ai-gpt__mode-hint" role="note"></p>
            <div class="home-ai-gpt__context">
              <div class="home-ai-gpt__thumb-wrap" id="home-ai-thumb-wrap">
                <img id="home-ai-preview-img" class="home-ai-gpt__thumb" alt="Valgt bilde" width="72" height="72" hidden />
                <p id="home-ai-thumb-placeholder" class="home-ai-gpt__thumb-ph">Du kan skrive med en gang, eller legge ved bilde med «Ta bilde» / «Filer».</p>
              </div>
            </div>
            <div id="home-ai-chat-log" class="home-ai-gpt__scroll" role="log" aria-live="polite"></div>
            <div class="home-ai-gpt__composer">
              <div class="home-ai-gpt__input-shell">
                <label class="visually-hidden" for="home-ai-chat-input">Send melding til VeiAi</label>
                <textarea id="home-ai-chat-input" class="home-ai-gpt__textarea" rows="1" placeholder="Send melding til VeiAi"></textarea>
                <button type="button" class="home-ai-gpt__send" id="btn-home-ai-send" aria-label="Send melding til VeiAi">
                  <svg class="home-ai-gpt__send-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <dialog id="home-ai-pdf-dialog" class="home-ai-pdf-dialog" aria-labelledby="home-ai-pdf-dialog-title">
          <div class="home-ai-pdf-dialog__box">
            <h2 id="home-ai-pdf-dialog-title" class="home-ai-pdf-dialog__title">Oppsummert samtale</h2>
            <div id="home-ai-pdf-preview" class="home-ai-pdf-dialog__preview" tabindex="0"></div>
            <p id="home-ai-pdf-dialog-status" class="home-ai-pdf-dialog__status" role="status" aria-live="polite"></p>
            <div class="home-ai-pdf-dialog__actions">
              <button type="button" class="btn btn-secondary" id="btn-home-ai-pdf-exit">Avslutt</button>
              <button type="button" class="btn btn-home btn-home--primary" id="btn-home-ai-pdf-save">Lagre på enheten</button>
            </div>
          </div>
        </dialog>
      </div>
    </div>
    </div>
    <nav class="home-bottom-nav" aria-label="Hurtigvalg">
      <button type="button" class="home-bottom-nav__btn" id="btn-home-nav-new" aria-label="Ny registrering">
        <span class="home-bottom-nav__icon home-bottom-nav__icon--primary" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </span>
      </button>
      <button type="button" class="home-bottom-nav__btn" id="btn-home-nav-camera" aria-label="Ta bilde">
        <span class="home-bottom-nav__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </span>
      </button>
      <button type="button" class="home-bottom-nav__btn" id="btn-home-nav-ai" aria-label="AI dokumentering">
        <span class="home-bottom-nav__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>
        </span>
      </button>
      <button type="button" class="home-bottom-nav__btn" id="btn-home-nav-history" aria-label="Økter og historikk">
        <span class="home-bottom-nav__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
        </span>
      </button>
    </nav>
    <div class="home-drawer-backdrop" id="home-drawer-backdrop" hidden aria-hidden="true"></div>
    <aside class="home-drawer" id="home-drawer" hidden aria-hidden="true" aria-label="Meny">
      <div class="home-drawer__head">
        <span class="home-drawer__title">Meny</span>
        <button type="button" class="home-drawer__close" id="btn-home-drawer-close" aria-label="Lukk">×</button>
      </div>
      <nav class="home-drawer__nav home-drawer__nav--stack">
        <button type="button" class="home-drawer__link" id="home-drawer-session-hub">Økten</button>
        <button type="button" class="home-drawer__link" id="home-drawer-contract-ai">Spør om kontrakten</button>
        <button type="button" class="home-drawer__link" id="home-drawer-user">Bruker</button>
        <button type="button" class="home-drawer__link" id="home-drawer-map">Kart</button>
        <button type="button" class="home-drawer__link" id="home-drawer-contacts">Kontaktliste</button>
        <button type="button" class="home-drawer__link" id="home-drawer-messages">Meldinger</button>
        <button type="button" class="home-drawer__link" id="home-drawer-settings">Innstillinger</button>
        <button type="button" class="home-drawer__link" id="home-drawer-privacy">Personvern</button>
        <button type="button" class="home-drawer__link" id="home-drawer-support">Support</button>
      </nav>
    </aside>
  </div>`
}

function renderInboxHtml() {
  return `<div class="view-inbox surface view-panel-enter">
    <button type="button" class="btn btn-back" id="btn-back-from-inbox">← Meny</button>
    <h2 class="subview-title">Meldinger</h2>
    <p class="inbox-lead">Her vises økter og bilder noen har sendt til bruker-ID-en din. Åpne for å se innholdet. Når du er ferdig, velger du om det skal lagres på enheten.</p>
    <p id="incoming-shares-status" class="home-incoming__status" role="status" aria-live="polite"></p>
    <ul id="incoming-shares-list" class="home-incoming-list"></ul>
  </div>`
}

function buildSessionRowsReadOnlyHtml() {
  const list = sortSessionsByUpdated()
  if (list.length === 0) {
    return '<p class="sub-empty">Ingen lagrede økter ennå. Velg <strong>Ny registrering</strong> på forsiden.</p>'
  }
  const rows = list
    .map(
      (s) => `
    <li class="session-row session-row--readonly">
      <div class="session-row__meta">
        <span class="session-row__title">${escapeHtml(formatSessionDisplayTitle(s))}</span>
        <span class="session-row__stats">${s.count} trykk · oppdatert ${escapeHtml(
          new Intl.DateTimeFormat('nb-NO', {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date(s.updatedAt)),
        )}</span>
      </div>
    </li>`,
    )
    .join('')
  return `<ul class="session-list session-list--readonly">${rows}</ul>`
}

function buildSessionRowsResumeHtml() {
  const list = sortSessionsByUpdated()
  if (list.length === 0) {
    return '<p class="sub-empty">Ingen lagrede økter ennå. Velg <strong>Ny registrering</strong> på forsiden.</p>'
  }
  const rows = list
    .map(
      (s) => `
    <li class="session-row">
      <div class="session-row__meta">
        <span class="session-row__title">${escapeHtml(formatSessionDisplayTitle(s))}</span>
        <span class="session-row__stats">${s.count} trykk · oppdatert ${escapeHtml(
          new Intl.DateTimeFormat('nb-NO', {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date(s.updatedAt)),
        )}</span>
      </div>
      <div class="session-row__actions">
        <button type="button" class="btn btn-secondary session-row__action" data-resume-id="${s.id}">Gjenoppta</button>
        <button type="button" class="btn btn-session-delete session-row__action" data-delete-session-id="${s.id}" aria-label="Slett økt">Slett</button>
      </div>
    </li>`,
    )
    .join('')
  return `<ul class="session-list">${rows}</ul>`
}

function buildSessionRowsDownloadHtml() {
  const list = sortSessionsByUpdated()
  if (list.length === 0) {
    return '<p class="sub-empty">Ingen økter å laste ned ennå.</p>'
  }
  const rows = list
    .map(
      (s) => `
    <li class="session-row">
      <div class="session-row__meta">
        <span class="session-row__title">${escapeHtml(formatSessionDisplayTitle(s))}</span>
        <span class="session-row__stats">${s.count} trykk</span>
      </div>
      <button type="button" class="btn btn-secondary session-row__action" data-download-id="${s.id}">Last ned</button>
    </li>`,
    )
    .join('')
  return `<ul class="session-list">${rows}</ul>`
}

function renderMenuSessionHtml() {
  const tab = menuSessionTab
  const sessionsSel = tab === 'sessions'
  const resumeSel = tab === 'resume'
  const downloadSel = tab === 'download'
  const importSel = tab === 'import'
  return `<div class="view-sub view-menu-session surface view-panel-enter">
    <button type="button" class="btn btn-back" id="btn-back-from-menu-session">← Meny</button>
    <h2 class="subview-title">Økten</h2>
    <div class="menu-session-tabs" role="tablist" aria-label="Økt">
      <button type="button" role="tab" class="menu-session-tabs__tab${sessionsSel ? ' menu-session-tabs__tab--active' : ''}" id="menu-session-tab-sessions" data-menu-session-tab="sessions" aria-selected="${sessionsSel}" aria-controls="menu-session-panel-sessions">Økter</button>
      <button type="button" role="tab" class="menu-session-tabs__tab${resumeSel ? ' menu-session-tabs__tab--active' : ''}" id="menu-session-tab-resume" data-menu-session-tab="resume" aria-selected="${resumeSel}" aria-controls="menu-session-panel-resume">Gjenoppta økt</button>
      <button type="button" role="tab" class="menu-session-tabs__tab${downloadSel ? ' menu-session-tabs__tab--active' : ''}" id="menu-session-tab-download" data-menu-session-tab="download" aria-selected="${downloadSel}" aria-controls="menu-session-panel-download">Last ned økter</button>
      <button type="button" role="tab" class="menu-session-tabs__tab${importSel ? ' menu-session-tabs__tab--active' : ''}" id="menu-session-tab-import" data-menu-session-tab="import" aria-selected="${importSel}" aria-controls="menu-session-panel-import">Importer økt</button>
    </div>
    <div id="menu-session-panel-sessions" class="menu-session-panel" role="tabpanel" ${sessionsSel ? '' : 'hidden'} aria-labelledby="menu-session-tab-sessions">
      <p class="menu-session-panel__lead">Oversikt over lagrede økter på denne enheten.</p>
      ${buildSessionRowsReadOnlyHtml()}
    </div>
    <div id="menu-session-panel-resume" class="menu-session-panel" role="tabpanel" ${resumeSel ? '' : 'hidden'} aria-labelledby="menu-session-tab-resume">
      ${buildSessionRowsResumeHtml()}
    </div>
    <div id="menu-session-panel-download" class="menu-session-panel" role="tabpanel" ${downloadSel ? '' : 'hidden'} aria-labelledby="menu-session-tab-download">
      <p class="menu-session-panel__lead">Eksporter økt som HTML-fil.</p>
      ${buildSessionRowsDownloadHtml()}
    </div>
    <div id="menu-session-panel-import" class="menu-session-panel" role="tabpanel" ${importSel ? '' : 'hidden'} aria-labelledby="menu-session-tab-import">
      <p class="menu-session-panel__lead">Velg en Scanix-HTML-fil som du tidligere har eksportert.</p>
      <input type="file" id="menu-import-session-input" class="photo-input-hidden" accept=".html,text/html" />
      <button type="button" class="btn btn-secondary" id="btn-menu-import-pick">Velg fil …</button>
      <p id="menu-import-status" class="menu-import-status home-import-status" role="status" aria-live="polite"></p>
    </div>
  </div>`
}

function renderMenuUserHtml() {
  const name =
    currentUser && typeof currentUser.name === 'string'
      ? escapeHtml(currentUser.name)
      : '–'
  const shortIdStr =
    currentUser && isValidStoredShortId(currentUser.shortId)
      ? escapeHtml(currentUser.shortId)
      : ''
  const email =
    currentUser && typeof currentUser.email === 'string' && currentUser.email.trim()
      ? escapeHtml(currentUser.email.trim())
      : ''
  return `<div class="view-sub surface view-panel-enter">
    <button type="button" class="btn btn-back" id="btn-back-from-menu-user">← Meny</button>
    <h2 class="subview-title">Bruker</h2>
    <div class="menu-info-card">
      <p class="menu-info-card__row"><span class="menu-info-card__label">Navn</span> ${name}</p>
      ${email ? `<p class="menu-info-card__row"><span class="menu-info-card__label">E-post</span> ${email}</p>` : ''}
      ${
        shortIdStr
          ? `<p class="menu-info-card__row"><span class="menu-info-card__label">Bruker-ID</span> <span class="menu-user-shortid">${shortIdStr}</span></p>`
          : ''
      }
    </div>
    <p class="menu-user-hint">Logg ut via knappen øverst på forsiden.</p>
  </div>`
}

function renderMenuMapHtml() {
  return `<div class="view-sub view-menu-map surface view-panel-enter">
    <button type="button" class="btn btn-back" id="btn-back-from-menu-map">← Meny</button>
    <h2 class="subview-title">Kart</h2>
    <p class="menu-session-panel__lead">Utforsk kartet uten aktiv økt. For å registrere tellinger og bilder i sporet, start eller gjenoppta en økt.</p>
    <div class="menu-browse-map-wrap">
      <div id="menu-browse-map" class="menu-browse-map" aria-label="Kart"></div>
    </div>
  </div>`
}

function renderMenuContactsHtml() {
  const contacts = loadContacts()
  const body =
    contacts.length === 0
      ? '<p class="sub-empty">Ingen kontakter lagret ennå. Du kan legge til mottakere under <strong>Del økt</strong> i en aktiv økt, eller når du sender bilder fra albumet.</p>'
      : `<ul class="menu-contacts-list">${contacts
          .map((c) => {
            const lab =
              typeof c.label === 'string' && c.label.trim()
                ? escapeHtml(c.label.trim())
                : `Kontakt ${escapeHtml(c.shortId)}`
            return `<li class="menu-contact-row"><span class="menu-contact-row__name">${lab}</span><span class="menu-contact-row__id">ID ${escapeHtml(c.shortId)}</span></li>`
          })
          .join('')}</ul>`
  return `<div class="view-sub surface view-panel-enter">
    <button type="button" class="btn btn-back" id="btn-back-from-menu-contacts">← Meny</button>
    <h2 class="subview-title">Kontaktliste</h2>
    ${body}
  </div>`
}

function renderMenuSettingsHtml() {
  return `<div class="view-sub surface view-panel-enter">
    <button type="button" class="btn btn-back" id="btn-back-from-menu-settings">← Meny</button>
    <h2 class="subview-title">Innstillinger</h2>
    <p class="menu-info-prose">Her kommer app-innstillinger (språk, varsler, lagring) i en senere versjon.</p>
  </div>`
}

function renderMenuPrivacyHtml() {
  return `<div class="view-sub surface view-panel-enter">
    <button type="button" class="btn btn-back" id="btn-back-from-menu-privacy">← Meny</button>
    <h2 class="subview-title">Personvern</h2>
    <p class="menu-info-prose">Scanix lagrer økter og bilder lokalt på enheten din. Med innlogging kan data synkroniseres til din konto i henhold til tjenestens retningslinjer. Du kan når som helst slette lokale data ved å fjerne økter eller logge ut.</p>
  </div>`
}

function renderMenuSupportHtml() {
  return `<div class="view-sub surface view-panel-enter">
    <button type="button" class="btn btn-back" id="btn-back-from-menu-support">← Meny</button>
    <h2 class="subview-title">Support</h2>
    <p class="menu-info-prose">Trenger du hjelp? Beskriv problemet og enhet/nettleser i en e-post til appens leverandør, eller se dokumentasjonen som følger prosjektet.</p>
  </div>`
}

function syncPhotoAlbumChrome() {
  const share = document.getElementById('btn-photo-album-share')
  const marker = document.getElementById('btn-photo-album-marker')
  const deleteWrap = document.getElementById('photo-album-delete-wrap')
  const deleteBtn = document.getElementById('btn-photo-album-delete')
  if (marker) {
    marker.classList.toggle('photo-album__marker--on', photoAlbumMarkerMode)
    marker.setAttribute(
      'aria-pressed',
      photoAlbumMarkerMode ? 'true' : 'false',
    )
  }
  if (share) {
    const n = standalonePhotos.length
    const green = photoAlbumMarkerMode && photoAlbumSelectedIds.size > 0 && n > 0
    share.disabled = n === 0
    share.classList.toggle('photo-album__share--active', green)
  }
  if (deleteWrap && deleteBtn) {
    if (photoAlbumMarkerMode) {
      deleteWrap.hidden = false
      const sel = photoAlbumSelectedIds.size
      deleteBtn.disabled = sel === 0
      deleteBtn.textContent =
        sel <= 1 ? 'Slett bilde' : 'Slett bilder'
    } else {
      deleteWrap.hidden = true
      deleteBtn.disabled = true
      deleteBtn.textContent = 'Slett bilde'
    }
  }
  document.querySelector('.view-photo-album-wrap')?.classList.toggle(
    'view-photo-album-wrap--marker-mode',
    photoAlbumMarkerMode,
  )
}

function deleteSelectedStandalonePhotos() {
  if (!photoAlbumMarkerMode || photoAlbumSelectedIds.size === 0) return
  const ids = new Set(photoAlbumSelectedIds)
  const n = ids.size
  const ok =
    n === 1
      ? window.confirm(
          'Slette dette bildet? Det fjernes fra appen og kan ikke angres.',
        )
      : window.confirm(
          `Slette ${n} bilder? De fjernes fra appen og kan ikke angres.`,
        )
  if (!ok) return
  standalonePhotos = standalonePhotos.filter((p) => !ids.has(p.id))
  photoAlbumSelectedIds = new Set()
  saveAppState()
  renderStandalonePhotoAlbumGallery()
  syncPhotoAlbumChrome()
}

function renderStandalonePhotoAlbumGallery() {
  const el = document.getElementById('standalone-photos-gallery')
  if (!el) return
  if (!standalonePhotos.length) {
    el.innerHTML =
      '<p class="photo-album__empty">Ingen bilder ennå. Bruk «Ta bilde» på forsiden.</p>'
    syncPhotoAlbumChrome()
    return
  }
  el.innerHTML = standalonePhotos
    .map((ph) => {
      const sel = photoAlbumSelectedIds.has(ph.id)
      const cls = sel
        ? 'photo-album__cell photo-album__cell--selected'
        : 'photo-album__cell'
      const v = ph.vegref && normalizePhotoVegref(ph.vegref)
      const ov = v ? formatPhotoVegrefOverlayHtml(v, 'thumb') : ''
      return `<button type="button" class="${cls}" data-photo-id="${escapeHtml(ph.id)}" aria-pressed="${sel ? 'true' : 'false'}">
        <span class="photo-album__thumb-wrap">
          <img src="${ph.dataUrl}" alt="" class="photo-album__thumb" loading="lazy" decoding="async" />
          ${ov}
        </span>
      </button>`
    })
    .join('')
  syncPhotoAlbumChrome()
}

/**
 * Legg til ett miniatyr uten å bygge hele rutenettet på nytt (raskere ved mange bilder).
 * @param {NonNullable<ReturnType<typeof normalizePhoto>>} photo
 */
function appendStandalonePhotoAlbumCell(photo) {
  const el = document.getElementById('standalone-photos-gallery')
  if (!el || !photo?.id) return
  el.querySelector('.photo-album__empty')?.remove()
  const sel = photoAlbumSelectedIds.has(photo.id)
  const cls = sel
    ? 'photo-album__cell photo-album__cell--selected'
    : 'photo-album__cell'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = cls
  btn.dataset.photoId = photo.id
  btn.setAttribute('aria-pressed', sel ? 'true' : 'false')
  const wrap = document.createElement('span')
  wrap.className = 'photo-album__thumb-wrap'
  const img = document.createElement('img')
  img.src = photo.dataUrl
  img.alt = ''
  img.className = 'photo-album__thumb'
  img.loading = 'lazy'
  img.decoding = 'async'
  wrap.appendChild(img)
  const v = photo.vegref && normalizePhotoVegref(photo.vegref)
  if (v) {
    const tmp = document.createElement('div')
    tmp.innerHTML = formatPhotoVegrefOverlayHtml(v, 'thumb')
    const overlay = tmp.firstElementChild
    if (overlay) wrap.appendChild(overlay)
  }
  btn.appendChild(wrap)
  el.appendChild(btn)
}

/**
 * Bygger JSON som mottakers app kan importere som økt (kun bilder, ingen tellinger).
 * @param {NonNullable<ReturnType<typeof normalizePhoto>>[]} photos
 */
function standalonePhotosToShareSessionPayload(photos) {
  const ts = nowIso()
  const clean = photos.map((p) => {
    const o = {
      id: p.id,
      timestamp: p.timestamp,
      lat: p.lat,
      lng: p.lng,
      dataUrl: p.dataUrl,
    }
    const vr = p.vegref && normalizePhotoVegref(p.vegref)
    if (vr) o.vegref = vr
    return o
  })
  return {
    shareKind: 'standalonePhotos',
    createdAt: ts,
    updatedAt: ts,
    title: 'Delte bilder',
    count: 0,
    clickHistory: [],
    log: [],
    roadSide: null,
    photos: clean,
    objectCategories: [],
    activeCategoryId: null,
  }
}

function renderShareStandalonePhotosDialogHtml() {
  return `<dialog id="share-photos-dialog" class="share-session-dialog share-session-dialog--photos-send" aria-labelledby="share-photos-heading">
    <div class="share-session-dialog__inner share-session-dialog__inner--compact-photos">
      <div class="share-session-dialog__head">
        <h2 id="share-photos-heading" class="share-session-dialog__title share-session-dialog__title--compact">Send bilder</h2>
        <button type="button" class="share-session-dialog__close" id="btn-share-photos-close" aria-label="Lukk">×</button>
      </div>
      <p id="share-photos-contacts-empty" class="share-session-hint share-session-hint--photos-empty" hidden>Ingen kontakter lagret ennå.</p>
      <div id="share-photos-contacts-list" class="share-contacts-list"></div>
      <p class="share-session-subtitle share-session-subtitle--inline">Ny mottaker</p>
      <label class="share-session-label" for="share-photos-shortid">Bruker-ID (5 siffer)</label>
      <input type="text" id="share-photos-shortid" class="share-session-input" inputmode="numeric" maxlength="5" placeholder="f.eks. 00472" autocomplete="off" />
      <label class="share-session-label" for="share-photos-name">Navn (valgfritt)</label>
      <input type="text" id="share-photos-name" class="share-session-input" maxlength="${AUTH_NAME_MAX_LEN}" placeholder="Kallenavn" autocomplete="off" />
      <label class="share-session-check">
        <input type="checkbox" id="share-photos-save-contact" />
        Lagre i kontaktlisten
      </label>
      <button type="button" class="btn btn-secondary share-use-contact-btn" id="btn-share-photos-use-contact">Bruk som mottaker</button>
      <p id="share-photos-feedback" class="share-session-feedback share-session-feedback--photos" role="alert"></p>
      <div class="share-session-dialog__actions share-session-dialog__actions--photos-send">
        <button type="button" class="btn btn-home btn-home--primary" id="btn-share-photos-send">Send bilder</button>
      </div>
    </div>
  </dialog>`
}

function refreshShareStandaloneContactsList() {
  const listEl = document.getElementById('share-photos-contacts-list')
  const emptyEl = document.getElementById('share-photos-contacts-empty')
  if (!listEl || !emptyEl) return
  const contacts = loadContacts()
  if (!contacts.length) {
    emptyEl.hidden = false
    listEl.innerHTML = ''
    return
  }
  emptyEl.hidden = true
  listEl.innerHTML = contacts
    .map((c) => {
      const name =
        typeof c.label === 'string' && c.label.trim()
          ? escapeHtml(c.label.trim())
          : `Kontakt ${escapeHtml(c.shortId)}`
      const sel =
        shareStandaloneRecipientShortId === c.shortId
          ? ' share-contact-row--selected'
          : ''
      return `<button type="button" class="share-contact-row${sel}" data-share-photos-contact="${escapeHtml(c.shortId)}">
        <span class="share-contact-row__name">${name}</span>
        <span class="share-contact-row__id">ID ${escapeHtml(c.shortId)}</span>
      </button>`
    })
    .join('')
}

/**
 * @param {string} shortId
 * @param {string} [displayName]
 */
function setShareStandaloneRecipient(shortId, displayName) {
  shareStandaloneRecipientShortId = shortId
  shareStandaloneRecipientDisplayName =
    typeof displayName === 'string' && displayName.trim()
      ? displayName.trim()
      : ''
  refreshShareStandaloneContactsList()
}

function openShareStandalonePhotosDialog() {
  const useSelected =
    photoAlbumMarkerMode && photoAlbumSelectedIds.size > 0
  const list = useSelected
    ? standalonePhotos.filter((p) => photoAlbumSelectedIds.has(p.id))
    : [...standalonePhotos]
  if (!list.length) return
  shareStandalonePendingPhotos = list.map((p) => ({ ...p }))
  shareStandaloneRecipientShortId = null
  shareStandaloneRecipientDisplayName = null
  const dlg = document.getElementById('share-photos-dialog')
  const feedback = document.getElementById('share-photos-feedback')
  const shortInp = document.getElementById('share-photos-shortid')
  const nameInp = document.getElementById('share-photos-name')
  const saveCb = document.getElementById('share-photos-save-contact')
  if (feedback) feedback.textContent = ''
  if (shortInp) shortInp.value = ''
  if (nameInp) nameInp.value = ''
  if (saveCb) saveCb.checked = false
  refreshShareStandaloneContactsList()
  dlg?.showModal()
}

async function performShareStandalonePhotosSend() {
  const statusEl = document.getElementById('share-photos-feedback')
  const photos = shareStandalonePendingPhotos
  if (!photos?.length) {
    if (statusEl) statusEl.textContent = 'Ingen bilder å sende.'
    return
  }
  if (!shareStandaloneRecipientShortId) {
    if (statusEl) {
      statusEl.textContent =
        'Velg en kontakt, eller skriv bruker-ID og trykk «Bruk som mottaker».'
    }
    return
  }
  if (
    isValidStoredShortId(currentUser?.shortId) &&
    shareStandaloneRecipientShortId === currentUser.shortId
  ) {
    if (statusEl) {
      statusEl.textContent = 'Du kan ikke sende til din egen bruker-ID.'
    }
    return
  }

  const closeOk = () => {
    document.getElementById('share-photos-dialog')?.close()
    if (statusEl) statusEl.textContent = ''
    shareStandalonePendingPhotos = null
  }

  const sb = getSupabase()
  if (sb && isSupabaseConfigured()) {
    const payload = standalonePhotosToShareSessionPayload(photos)
    if (statusEl) statusEl.textContent = 'Sender til mottaker …'
    try {
      await sendSessionShare(sb, shareStandaloneRecipientShortId, payload)
      closeOk()
      return
    } catch (e) {
      if (statusEl) {
        statusEl.textContent = mapShareRpcError(/** @type {Error} */ (e))
      }
      return
    }
  }

  const html = await buildScanixExportHtml(
    [],
    [],
    null,
    photos,
    'Delte bilder',
    [],
    null,
  )
  const filename = `scanix-bilder-til-${shareStandaloneRecipientShortId}-${nowIso().slice(0, 19).replace(/:/g, '-')}.html`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const file = new File([blob], filename, { type: 'text/html' })
  const labelPart = shareStandaloneRecipientDisplayName
    ? ` (${shareStandaloneRecipientDisplayName})`
    : ''
  const text = `Scanix-bilder til bruker-ID ${shareStandaloneRecipientShortId}${labelPart}. Mottaker: åpne Scanix og trykk «Importer økt» på forsiden, eller åpne HTML-fila.`
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Scanix-bilder',
        text,
      })
      closeOk()
      return
    } catch (err) {
      if (/** @type {{ name?: string }} */ (err).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  closeOk()
}

function bindPhotoAlbumListeners() {
  if (photoAlbumAbort) photoAlbumAbort.abort()
  photoAlbumAbort = new AbortController()
  const { signal } = photoAlbumAbort

  document.getElementById('btn-photo-album-back')?.addEventListener(
    'click',
    () => {
      photoAlbumMarkerMode = false
      photoAlbumSelectedIds = new Set()
      view = 'home'
      renderApp()
      bindHomeListeners()
    },
    { signal },
  )

  document.getElementById('btn-photo-album-marker')?.addEventListener(
    'click',
    () => {
      photoAlbumMarkerMode = !photoAlbumMarkerMode
      if (!photoAlbumMarkerMode) {
        photoAlbumSelectedIds = new Set()
        document
          .querySelectorAll(
            '#standalone-photos-gallery .photo-album__cell--selected',
          )
          .forEach((cell) => {
            if (!(cell instanceof HTMLElement)) return
            cell.classList.remove('photo-album__cell--selected')
            cell.setAttribute('aria-pressed', 'false')
          })
      }
      syncPhotoAlbumChrome()
    },
    { signal },
  )

  document.getElementById('btn-photo-album-share')?.addEventListener(
    'click',
    () => {
      openShareStandalonePhotosDialog()
    },
    { signal },
  )

  document.getElementById('btn-photo-album-delete')?.addEventListener(
    'click',
    () => deleteSelectedStandalonePhotos(),
    { signal },
  )

  const sharePhotosDlg = document.getElementById('share-photos-dialog')
  sharePhotosDlg?.addEventListener(
    'close',
    () => {
      shareStandalonePendingPhotos = null
    },
    { signal },
  )
  document.getElementById('btn-share-photos-close')?.addEventListener(
    'click',
    () => sharePhotosDlg?.close(),
    { signal },
  )
  document.getElementById('btn-share-photos-send')?.addEventListener(
    'click',
    () => void performShareStandalonePhotosSend(),
    { signal },
  )
  document.getElementById('btn-share-photos-use-contact')?.addEventListener(
    'click',
    () => {
      const feedback = document.getElementById('share-photos-feedback')
      if (feedback) feedback.textContent = ''
      const raw =
        document.getElementById('share-photos-shortid')?.value ?? ''
      const only = raw.replace(/\D/g, '')
      if (only.length < 5) {
        if (feedback) {
          feedback.textContent =
            'Skriv inn 5 siffer (mottakers bruker-ID).'
        }
        return
      }
      const shortId = only.slice(-5)
      if (!isValidStoredShortId(shortId)) {
        if (feedback) feedback.textContent = 'Ugyldig bruker-ID.'
        return
      }
      if (
        isValidStoredShortId(currentUser?.shortId) &&
        shortId === currentUser.shortId
      ) {
        if (feedback) {
          feedback.textContent =
            'Du kan ikke bruke din egen bruker-ID som mottaker.'
        }
        return
      }
      const nameInp =
        document.getElementById('share-photos-name')?.value?.trim() ?? ''
      const saveCb = document.getElementById('share-photos-save-contact')
      if (saveCb?.checked) {
        upsertContactByShortId(shortId, nameInp)
        refreshShareStandaloneContactsList()
      }
      setShareStandaloneRecipient(shortId, nameInp || undefined)
    },
    { signal },
  )
  document.getElementById('share-photos-contacts-list')?.addEventListener(
    'click',
    (ev) => {
      const btn = ev.target.closest('[data-share-photos-contact]')
      if (!btn) return
      const raw = btn.getAttribute('data-share-photos-contact') || ''
      const digits = raw.replace(/\D/g, '')
      const sid =
        digits.length >= 5
          ? digits.slice(-5)
          : digits.length > 0
            ? digits.padStart(5, '0')
            : ''
      if (!isValidStoredShortId(sid)) return
      const fb = document.getElementById('share-photos-feedback')
      if (fb) fb.textContent = ''
      const contact = loadContacts().find((c) => c.shortId === sid)
      const lab =
        contact && typeof contact.label === 'string' && contact.label.trim()
          ? contact.label.trim()
          : undefined
      setShareStandaloneRecipient(sid, lab)
    },
    { signal },
  )

  document.getElementById('standalone-photos-gallery')?.addEventListener(
    'click',
    (ev) => {
      const btn = ev.target.closest('[data-photo-id]')
      if (!btn || !(btn instanceof HTMLElement)) return
      const id = btn.getAttribute('data-photo-id')
      if (!id) return
      if (photoAlbumMarkerMode) {
        if (photoAlbumSelectedIds.has(id)) {
          photoAlbumSelectedIds.delete(id)
          btn.classList.remove('photo-album__cell--selected')
          btn.setAttribute('aria-pressed', 'false')
        } else {
          photoAlbumSelectedIds.add(id)
          btn.classList.add('photo-album__cell--selected')
          btn.setAttribute('aria-pressed', 'true')
        }
        syncPhotoAlbumChrome()
        return
      }
      const ph = standalonePhotos.find((p) => p.id === id)
      if (ph?.dataUrl) openPhotoFullscreen(ph.dataUrl, ph.vegref)
    },
    { signal },
  )

  renderStandalonePhotoAlbumGallery()
}

function renderPhotoAlbumHtml() {
  return `<div class="view-photo-album-wrap">
    <div class="view-photo-album surface view-panel-enter" aria-label="Bilder uten økt">
      <header class="photo-album__top">
        <button type="button" class="photo-album__back btn btn-text" id="btn-photo-album-back" aria-label="Tilbake">←</button>
        <div class="photo-album__top-actions">
          <button type="button" class="photo-album__share" id="btn-photo-album-share" aria-label="Del bilder">Del</button>
          <button type="button" class="photo-album__marker" id="btn-photo-album-marker" aria-pressed="false">Marker</button>
        </div>
      </header>
      <div class="photo-album__body">
        <div id="standalone-photos-gallery" class="photo-album__grid" aria-live="polite"></div>
      </div>
    </div>
    <div class="photo-album__delete-wrap" id="photo-album-delete-wrap" hidden>
      <button type="button" class="btn-text btn-logout photo-album__delete-btn" id="btn-photo-album-delete" disabled>Slett bilde</button>
    </div>
    ${renderShareStandalonePhotosDialogHtml()}
  </div>`
}

function renderKmtDialogHtml() {
  return `<dialog id="kmt-dialog" class="kmt-dialog" aria-labelledby="kmt-heading">
      <div class="kmt-dialog__inner">
        <div class="kmt-dialog__head kmt-dialog__head--nav">
          <div class="kmt-dialog__head-start">
            <button type="button" class="kmt-dialog__back" id="btn-kmt-back" aria-label="Tilbake">←</button>
          </div>
          <h2 id="kmt-heading" class="kmt-dialog__title kmt-dialog__title--center">Ta bilde</h2>
          <div class="kmt-dialog__head-end" aria-hidden="true"></div>
        </div>
        <div id="kmt-panel-main">
          <p class="kmt-dialog__status kmt-dialog__status--floating" id="kmt-status" hidden></p>
          <div class="kmt-stack" id="kmt-stack">
            <div class="kmt-video-stage" id="kmt-video-stage">
              <video
                id="kmt-video"
                class="kmt-video"
                playsinline
                muted
                autoplay
                aria-label="Kameravisning"
              ></video>
              <div
                class="kmt-tap-focus-layer"
                id="kmt-tap-focus-layer"
                role="presentation"
                title="Trykk der du vil ha skarpt (nær eller langt unna)"
              ></div>
              <div class="kmt-ref-overlay" id="kmt-ref-overlay">
                <div class="kmt-ref-overlay__road" id="kmt-road-line">–</div>
                <div class="kmt-ref-overlay__compact" id="kmt-ref-compact">S – · D – · m –</div>
                <span class="visually-hidden" id="kmt-s">–</span>
                <span class="visually-hidden" id="kmt-d">–</span>
                <span class="visually-hidden" id="kmt-m">–</span>
                <div class="kmt-ref-overlay__kf" id="kmt-kortform"></div>
              </div>
              <button type="button" class="kmt-capture-fab" id="btn-kmt-capture">Ta bilde</button>
            </div>
          </div>
        </div>
      </div>
    </dialog>`
}

function renderIncomingShareSaveDialogHtml() {
  return `<dialog id="incoming-share-save-dialog" class="incoming-share-save-dialog" aria-labelledby="incoming-share-save-heading">
      <form method="dialog" class="incoming-share-save-dialog__inner">
        <h2 id="incoming-share-save-heading">Lagre delt økt?</h2>
        <p>Vil du beholde denne økten blant dine lagrede økter på denne enheten? Hvis ikke, fjernes den fra enheten og du finner den fortsatt i innboksen.</p>
        <div class="incoming-share-save-dialog__actions">
          <button type="submit" class="btn btn-home btn-home--primary" value="save">Lagre på enheten</button>
          <button type="submit" class="btn btn-secondary" value="discard">Ikke lagre</button>
          <button type="submit" class="btn btn-text" value="cancel">Avbryt</button>
        </div>
      </form>
    </dialog>`
}

/** Hoved-UI: begrens nettleser-zoom; bildevisning: ekstra viewport + programmatisk pinch. */
const VIEWPORT_CONTENT_MAIN =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover'
const VIEWPORT_CONTENT_IMAGE_ZOOM =
  'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, viewport-fit=cover'

/**
 * @param {boolean} active true når brukeren ser bilde i fullskjerm/lightbox og skal kunne zoome
 */
function setViewportAllowImageZoom(active) {
  const m = document.getElementById('meta-viewport')
  if (!m) return
  m.setAttribute(
    'content',
    active ? VIEWPORT_CONTENT_IMAGE_ZOOM : VIEWPORT_CONTENT_MAIN,
  )
}

/**
 * @param {TouchList | Touch[]} touches
 */
function touchPinchDistance(touches) {
  if (touches.length < 2) return 0
  const a = touches[0]
  const b = touches[1]
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.hypot(dx, dy)
}

/**
 * Pinch + pan på bilde (fungerer der nettleser-zoom ignoreres).
 * @param {HTMLElement} hostEl
 * @param {HTMLElement} panEl element som får translate + scale
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {{ reset: () => void }}
 */
function attachImagePinchZoom(hostEl, panEl, opts = {}) {
  const { signal } = opts
  const minScale = 1
  const maxScale = 5
  let scale = 1
  let tx = 0
  let ty = 0
  /** @type {'none' | 'pinch' | 'pan'} */
  let mode = 'none'
  let pinchBaseDist = 0
  let pinchBaseScale = 1
  let panStartClientX = 0
  let panStartClientY = 0
  let panStartTx = 0
  let panStartTy = 0

  function applyTransform() {
    panEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
  }

  function reset() {
    scale = 1
    tx = 0
    ty = 0
    mode = 'none'
    pinchBaseDist = 0
    panEl.style.transform = ''
  }

  /** @param {TouchEvent} e */
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      mode = 'pinch'
      pinchBaseDist = touchPinchDistance(e.touches)
      pinchBaseScale = scale
    } else if (e.touches.length === 1 && scale > 1.02) {
      mode = 'pan'
      panStartClientX = e.touches[0].clientX
      panStartClientY = e.touches[0].clientY
      panStartTx = tx
      panStartTy = ty
    }
  }

  /** @param {TouchEvent} e */
  function onTouchMove(e) {
    if (mode === 'pinch' && e.touches.length === 2 && pinchBaseDist > 0) {
      e.preventDefault()
      const d = touchPinchDistance(e.touches)
      scale = Math.min(
        maxScale,
        Math.max(minScale, pinchBaseScale * (d / pinchBaseDist)),
      )
      applyTransform()
    } else if (mode === 'pan' && e.touches.length === 1 && scale > 1.02) {
      e.preventDefault()
      const t = e.touches[0]
      tx = panStartTx + (t.clientX - panStartClientX)
      ty = panStartTy + (t.clientY - panStartClientY)
      applyTransform()
    }
  }

  /** @param {TouchEvent} e */
  function onTouchEnd(e) {
    if (e.touches.length === 0) {
      mode = 'none'
      pinchBaseDist = 0
    } else if (e.touches.length === 1) {
      if (mode === 'pinch') {
        mode = scale > 1.02 ? 'pan' : 'none'
        if (mode === 'pan') {
          panStartClientX = e.touches[0].clientX
          panStartClientY = e.touches[0].clientY
          panStartTx = tx
          panStartTy = ty
        }
      }
      pinchBaseDist = 0
    }
  }

  const opt = signal ? { signal } : undefined
  hostEl.addEventListener('touchstart', onTouchStart, { passive: true, ...opt })
  hostEl.addEventListener('touchmove', onTouchMove, { passive: false, ...opt })
  hostEl.addEventListener('touchend', onTouchEnd, { passive: true, ...opt })
  hostEl.addEventListener('touchcancel', onTouchEnd, { passive: true, ...opt })

  return { reset }
}

/** @type {{ reset: () => void } | null} */
let photoFullscreenPinchControls = null
/** @type {{ reset: () => void } | null} */
let receivedLightboxPinchControls = null

function renderPhotoFullscreenDialogHtml() {
  return `<dialog id="photo-fullscreen-dialog" class="photo-fullscreen-dialog" aria-label="Bilde i fullskjerm">
    <div class="photo-fullscreen-dialog__inner">
      <button type="button" class="photo-fullscreen-dialog__close" id="btn-photo-fullscreen-close" aria-label="Lukk">×</button>
      <div class="photo-fullscreen-dialog__frame photo-zoom-host" id="photo-fullscreen-zoom-host">
        <div class="photo-zoom-pan" id="photo-fullscreen-zoom-pan">
          <img id="photo-fullscreen-img" class="photo-fullscreen-dialog__img" alt="" draggable="false" />
          <div id="photo-fullscreen-vegref" class="photo-vegref-overlay photo-vegref-overlay--fullscreen" hidden aria-hidden="true"></div>
        </div>
      </div>
    </div>
  </dialog>`
}

/** @type {AbortController | null} */
let photoFullscreenWireAbort = null

/**
 * @param {string} dataUrl
 * @param {unknown} [vegrefRaw] lagret vegref-objekt; tekst vises som vektor-overlay (skarp ved zoom).
 */
function openPhotoFullscreen(dataUrl, vegrefRaw) {
  const dlg = document.getElementById('photo-fullscreen-dialog')
  const img = document.getElementById('photo-fullscreen-img')
  const vrLayer = document.getElementById('photo-fullscreen-vegref')
  if (!dlg || !img || typeof dataUrl !== 'string' || !dataUrl) return
  img.src = dataUrl
  const vr = vegrefRaw ? normalizePhotoVegref(vegrefRaw) : null
  if (vrLayer) {
    if (vr) {
      vrLayer.innerHTML = formatPhotoVegrefOverlayLinesHtml(vr)
      vrLayer.hidden = false
      vrLayer.setAttribute('aria-hidden', 'true')
    } else {
      vrLayer.innerHTML = ''
      vrLayer.hidden = true
    }
  }
  photoFullscreenPinchControls?.reset()
  setViewportAllowImageZoom(true)
  if (dlg instanceof HTMLDialogElement) dlg.showModal()
}

function closePhotoFullscreen() {
  const dlg = document.getElementById('photo-fullscreen-dialog')
  const img = document.getElementById('photo-fullscreen-img')
  const vrLayer = document.getElementById('photo-fullscreen-vegref')
  if (img) {
    img.removeAttribute('src')
  }
  if (vrLayer) {
    vrLayer.innerHTML = ''
    vrLayer.hidden = true
  }
  dlg?.close()
  photoFullscreenPinchControls?.reset()
  setViewportAllowImageZoom(false)
}

function wirePhotoFullscreenDialog() {
  const dlg = document.getElementById('photo-fullscreen-dialog')
  if (!dlg) return
  if (photoFullscreenWireAbort) photoFullscreenWireAbort.abort()
  photoFullscreenWireAbort = new AbortController()
  const { signal } = photoFullscreenWireAbort
  const host = document.getElementById('photo-fullscreen-zoom-host')
  const pan = document.getElementById('photo-fullscreen-zoom-pan')
  if (host && pan instanceof HTMLElement) {
    photoFullscreenPinchControls = attachImagePinchZoom(host, pan, { signal })
  }
  const onClose = () => closePhotoFullscreen()
  document.getElementById('btn-photo-fullscreen-close')?.addEventListener(
    'click',
    onClose,
    { signal },
  )
  dlg.addEventListener(
    'click',
    (ev) => {
      if (ev.target === dlg) onClose()
    },
    { signal },
  )
  dlg.addEventListener('cancel', (ev) => {
    ev.preventDefault()
    onClose()
  }, { signal })
}

function renderSessionHtml() {
  const s = sessions.find((x) => x.id === currentSessionId)
  const sessionCreated = s?.createdAt
  const sessionDatetimeHtml =
    sessionCreated && !Number.isNaN(new Date(sessionCreated).getTime())
      ? `<p class="session-top__datetime"><time datetime="${escapeHtml(sessionCreated)}">${escapeHtml(formatSessionTitle(s))}</time></p>`
      : ''
  const roadLabel = formatRoadSideLabel(state.roadSide)
  const roadBlock = roadLabel
    ? `<p class="session-road-side">${escapeHtml(roadLabel)}</p>`
    : ''
  const shareSessionOptions = sortSessionsByUpdated()
    .map((sess) => {
      const sel = sess.id === currentSessionId ? ' selected' : ''
      return `<option value="${escapeHtml(sess.id)}"${sel}>${escapeHtml(formatSessionDisplayTitle(sess))} · ${sess.count} registreringer</option>`
    })
    .join('')
  const previewBanner = previewIncomingShareId
    ? `<p class="session-preview-banner" role="status">Du ser på et <strong>delt oppdrag</strong>. Bruk <strong>← Meny</strong> eller <strong>Avslutt oppdrag</strong> for å lagre det på enheten eller forkaste.</p>`
    : ''
  return `<div class="app-stack app-stack--session">
    <header class="session-top">
      <div class="session-top__bar">
        <button type="button" class="btn btn-text btn-back-session" id="btn-back-menu">← Meny</button>
      </div>
      <div class="session-top__toolbar">
        ${sessionDatetimeHtml}
        <div class="session-top__tab-group session-top__tab-group--equal session-top__tab-group--icons" role="toolbar" aria-label="Handlinger i oppdraget">
          <button type="button" class="session-action-tab session-action-tab--icon" id="btn-kmt" aria-expanded="false" aria-controls="kmt-dialog" aria-label="Ta bilde">
            <svg class="session-action-tab__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="1.65"/>
            </svg>
          </button>
          <button type="button" class="session-action-tab session-action-tab--icon" id="btn-share-session" aria-controls="share-session-dialog" aria-label="Del oppdrag">
            <svg class="session-action-tab__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 6l-4-4-4 4" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 2v13" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>
            </svg>
          </button>
          <button type="button" class="session-action-tab session-action-tab--icon" id="btn-end-session" aria-label="Avslutt oppdrag">
            <svg class="session-action-tab__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 17l5-5-5-5" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M21 12H9" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        ${roadBlock ? `<div class="session-top__road">${roadBlock}</div>` : ''}
      </div>
    </header>
    ${previewBanner}

    <dialog id="share-session-dialog" class="share-session-dialog" aria-labelledby="share-session-heading">
      <div class="share-session-dialog__inner">
        <div class="share-session-dialog__head">
          <h2 id="share-session-heading" class="share-session-dialog__title">Del oppdrag</h2>
          <button type="button" class="share-session-dialog__close" id="btn-share-session-close" aria-label="Lukk">×</button>
        </div>
        <p class="share-session-dialog__lead">Hvem skal få oppdraget? Med <strong>innlogget konto</strong> sendes det til mottakers <strong>Mottatte delinger</strong>. Uten sky kan du også dele som HTML-fil (Importer / e-post).</p>
        <label class="share-session-label" for="share-session-select">Oppdrag som skal sendes</label>
        <select id="share-session-select" class="share-session-select">${shareSessionOptions}</select>
        <p class="share-session-subtitle">Kontaktliste</p>
        <p id="share-contacts-empty" class="share-session-hint">Du har ingen i kontaktlisten ennå. Legg til noen med bruker-ID under.</p>
        <div id="share-contacts-list" class="share-contacts-list"></div>
        <p class="share-session-subtitle">Legg til med bruker-ID</p>
        <p class="share-session-hint">5-sifret bruker-ID vises diskret øverst til venstre når mottaker er innlogget.</p>
        <label class="share-session-label" for="share-contact-shortid">Bruker-ID</label>
        <input type="text" id="share-contact-shortid" class="share-session-input" inputmode="numeric" maxlength="5" placeholder="f.eks. 00472" autocomplete="off" />
        <label class="share-session-label" for="share-contact-name">Navn (valgfritt)</label>
        <input type="text" id="share-contact-name" class="share-session-input" maxlength="${AUTH_NAME_MAX_LEN}" placeholder="Kallenavn" autocomplete="off" />
        <label class="share-session-check">
          <input type="checkbox" id="share-save-contact" />
          Lagre denne personen i kontaktlisten
        </label>
        <button type="button" class="btn btn-secondary share-use-contact-btn" id="btn-share-use-contact">Bruk som mottaker</button>
        <p id="share-recipient-status" class="share-recipient-status" role="status">Ingen mottaker valgt ennå.</p>
        <p id="share-session-feedback" class="share-session-feedback" role="alert"></p>
        <div class="share-session-dialog__actions">
          <button type="button" class="btn btn-secondary" id="btn-share-session-cancel">Lukk</button>
          <button type="button" class="btn btn-home btn-home--primary" id="btn-share-session-send">Send …</button>
        </div>
      </div>
    </dialog>

    <dialog id="session-end-dialog" class="session-end-dialog" aria-labelledby="session-end-heading">
      <div class="session-end-dialog__inner">
        <h2 id="session-end-heading" class="session-end-dialog__title">Avslutt oppdrag</h2>
        <div class="session-end-tabs" role="tablist" aria-label="Avslutt oppdrag">
          <button type="button" role="tab" class="session-end-tabs__tab session-end-tabs__tab--active" id="session-end-tab-quit" aria-selected="true" aria-controls="session-end-panel-quit">Lagre og avslutt</button>
          <button type="button" role="tab" class="session-end-tabs__tab" id="session-end-tab-pdf" aria-selected="false" aria-controls="session-end-panel-pdf">Eksporter PDF</button>
        </div>
        <div id="session-end-panel-quit" class="session-end-panel" role="tabpanel" aria-labelledby="session-end-tab-quit">
          <form id="session-end-form" class="session-end-form">
            <p class="session-end-dialog__lead">Gi oppdraget et navn om du vil – det vises i listen.</p>
            <label class="session-end-label" for="session-end-title">Navn (valgfritt)</label>
            <input type="text" id="session-end-title" class="session-end-input" maxlength="${SESSION_TITLE_MAX_LEN}" autocomplete="off" placeholder="F.eks. Kirkevegen nord" />
            <label class="session-end-label" for="session-end-registered-note">Hva registerte du? (valgfritt)</label>
            <textarea id="session-end-registered-note" class="session-end-textarea session-end-textarea--quit" rows="3" maxlength="${SESSION_REGISTERED_NOTE_MAX_LEN}" autocomplete="off" placeholder="Kort beskrivelse …"></textarea>
            <div class="session-end-dialog__actions">
              <button type="button" class="btn btn-secondary" id="session-end-cancel">Avbrytt uten lagring</button>
              <button type="submit" class="btn btn-home btn-home--primary session-end-dialog__submit" id="session-end-confirm">Lagre og avslutt</button>
            </div>
          </form>
        </div>
        <div id="session-end-panel-pdf" class="session-end-panel" role="tabpanel" aria-labelledby="session-end-tab-pdf" hidden>
          <p class="session-end-dialog__lead">Valgfrie merknader i rapporten. PDF lages på lokal server (feilmelding vises hvis den ikke kjører).</p>
          <label class="session-end-label" for="session-end-pdf-comments">Kommentarer til rapporten</label>
          <textarea id="session-end-pdf-comments" class="session-end-textarea" rows="4" maxlength="8000" placeholder="F.eks. observasjoner, vær …"></textarea>
          <p id="session-end-pdf-status" class="session-end-pdf-status" role="status"></p>
          <div class="session-end-dialog__actions session-end-dialog__actions--pdf">
            <button type="button" class="btn btn-secondary" id="session-end-pdf-cancel">Lukk</button>
            <button type="button" class="btn btn-home btn-home--primary" id="session-end-pdf-export">Eksporter som PDF</button>
          </div>
        </div>
      </div>
    </dialog>

    <div class="session-stage">
      <div class="session-map-stage">
        <section class="map-section surface map-section--hero" aria-label="Kart">
          <div class="section-head">
            <h2 class="section-head__title">Kart</h2>
            <span class="section-head__meta" id="map-meta"></span>
          </div>
          <div class="map-frame">
            <div id="map" class="map"></div>
            <p id="gps-status" class="gps-status map-gps-chip" role="status"></p>
            <button
              type="button"
              id="btn-map-locate"
              class="map-locate-btn"
              aria-label="Gå til min posisjon"
              title="Min posisjon"
            >
              <span class="map-locate-btn__icon" aria-hidden="true">⌂</span>
            </button>
          </div>
          <details class="map-section__more">
            <summary class="map-section__more-summary">Vis mer · kart og lenker</summary>
            <div class="map-section__more-inner">
              <div class="map-section__toolbar" role="tablist" aria-label="Kart og deling">
                <button type="button" class="map-section__tab map-section__tab--active" role="tab" id="tab-map-fit" aria-selected="true" aria-controls="map-panel-fit">Vis alle punkter</button>
                <button type="button" class="map-section__tab" role="tab" id="tab-map-share" aria-selected="false" aria-controls="map-panel-share">Del rute som lenke</button>
              </div>
              <div id="map-panel-fit" class="map-section__panel" role="tabpanel" aria-labelledby="tab-map-fit">
                <button type="button" id="btn-fit" class="btn btn-secondary btn-fit">Tilpass kartet til alle punkter</button>
              </div>
              <div id="map-panel-share" class="map-section__panel" role="tabpanel" aria-labelledby="tab-map-share" hidden>
                <p class="map-share-lead">Lenkene åpner i Google Maps med stopp i rekkefølge. På mobil er det maks fem stopp per lenke; ved flere punkter får du flere lenker etter hverandre.</p>
                <p id="map-share-empty" class="map-share-empty" hidden>Ingen posisjon ennå – registrer minst én gang med god dekning.</p>
                <p id="map-share-segments" class="map-share-segments" hidden></p>
                <div class="map-share-row map-share-row--textarea">
                  <textarea readonly class="map-share-textarea" id="map-share-urls" rows="4" autocomplete="off" spellcheck="false" aria-label="Google Maps-lenker"></textarea>
                  <button type="button" class="btn btn-secondary" id="btn-copy-map-link">Kopier</button>
                </div>
                <p id="map-share-copy-status" class="map-share-copy-status" role="status" aria-live="polite"></p>
                <button type="button" class="btn btn-secondary btn-share-map" id="btn-share-map-link">Del lenker …</button>
              </div>
            </div>
          </details>
        </section>
      </div>
    </div>

    <div
      id="session-bottom-sheet"
      class="session-bottom-sheet"
      data-sheet-state="mid"
      style="height:252px"
    >
      <div class="session-sheet-handle" aria-label="Juster panel">
        <span class="session-sheet-handle__bar" aria-hidden="true"></span>
      </div>
      <div class="session-bottom-sheet__body">
        <div class="session-sheet-tier session-sheet-tier--meta">
          <div
            id="count-display"
            class="count-display count-display--session-sheet"
            aria-live="polite"
          >Ingen registreringer enda</div>
          <p id="session-sheet-accuracy" class="session-sheet-accuracy" hidden></p>
        </div>
        <button type="button" id="btn-plus" class="btn btn-plus btn-register-dominant" aria-label="Registrer">
          <span class="btn-plus__inner">
            <span class="btn-plus__line">Registrer</span>
          </span>
        </button>
        <div class="session-sheet-tier session-sheet-tier--secondary">
          <button type="button" id="btn-minus" class="btn btn-minus btn-ghost-action" title="Angre siste" aria-label="Angre siste">Angre</button>
          <button type="button" id="btn-reset" class="btn btn-reset btn-ghost-action">Fjern alle</button>
        </div>
        <p class="session-sheet-tier session-sheet-tier--expanded-hint">Notater og nedlasting finner du under kartet.</p>
      </div>
    </div>

    <section
      class="session-photos-strip surface"
      id="session-photos-strip"
      hidden
      aria-label="Bilder fra oppdraget"
    >
      <div id="photos-gallery" class="photos-gallery photos-gallery--session"></div>
    </section>

    <section class="logg-folder surface" id="logg">
      <details class="logg-folder__collapse">
        <summary class="logg-folder__summary">
          <h2 id="logg-heading" class="section-head__title logg-folder__summary-title">Notater</h2>
        </summary>
        <div class="logg-folder__inner">
          <div class="logg-header">
            <span class="logg-header__spacer" aria-hidden="true"></span>
            <button type="button" id="btn-export" class="btn btn-secondary btn-export">Last ned som fil</button>
          </div>
          <details class="logg-details">
            <summary class="logg-details__summary">Eksport og iPhone</summary>
            <p class="logg-hint">«Last ned som fil» lager en HTML med kart og notater. <strong>På iPhone</strong> åpnes ofte et delingsark: velg <strong>Lagre i Filer</strong> og en mappe.</p>
          </details>
          <ul id="logg-list" class="logg-list"></ul>
        </div>
      </details>
    </section>
    <div id="session-toast" class="session-toast" role="status" aria-live="polite" hidden></div>
  </div>`
}

function renderApp() {
  const mount = document.querySelector('#app')
  if (!mount) {
    console.warn('renderApp: fant ikke #app')
    return
  }
  /** Fjern ev. gammelt AI-overlay lagt på body (unngå usynlig lag som blokkerer klikk). */
  document.querySelector('body > #home-ai-fullscreen')?.remove()
  const banner = insecureContextBannerHtml()
  let main = ''
  if (!currentUser) {
    main = renderAuthHtml()
  } else if (view === 'session') main = renderSessionHtml()
  else if (view === 'menuSession') main = renderMenuSessionHtml()
  else if (view === 'menuUser') main = renderMenuUserHtml()
  else if (view === 'menuMap') main = renderMenuMapHtml()
  else if (view === 'menuContacts') main = renderMenuContactsHtml()
  else if (view === 'menuSettings') main = renderMenuSettingsHtml()
  else if (view === 'menuPrivacy') main = renderMenuPrivacyHtml()
  else if (view === 'menuSupport') main = renderMenuSupportHtml()
  else if (view === 'inbox') main = renderInboxHtml()
  else if (view === 'photoAlbum') main = renderPhotoAlbumHtml()
  else if (view === 'receivedPhotos') main = renderReceivedPhotosHtml()
  else main = renderHomeHtml()
  const kmtShell =
    currentUser && (view === 'home' || view === 'session')
      ? renderKmtDialogHtml()
      : ''
  const incomingShareSaveShell = currentUser
    ? renderIncomingShareSaveDialogHtml()
    : ''
  const photoFullscreenShell = currentUser
    ? renderPhotoFullscreenDialogHtml()
    : ''
  mount.innerHTML = `${banner}<div class="app-body">${main}</div>${kmtShell}${incomingShareSaveShell}${photoFullscreenShell}`
  mount.classList.toggle(
    'app-root--home',
    Boolean(currentUser && view === 'home'),
  )
  syncLaunchSplash({ currentUser, view, appMount: mount })
  wirePhotoFullscreenDialog()
  if (view === 'menuMap') {
    queueMicrotask(() => void initMenuBrowseMap())
  } else {
    destroyMenuBrowseMap()
  }
}

let homeAbort = null
let authAbort = null
let menuSessionAbort = null
let menuUserAbort = null
let menuMapAbort = null
let menuContactsAbort = null
let menuInfoAbort = null
let inboxAbort = null
let sessionAbort = null
let photoAlbumAbort = null
let receivedPhotosAbort = null

let photoAlbumMarkerMode = false
/** @type {Set<string>} */
let photoAlbumSelectedIds = new Set()

/** @type {ReturnType<typeof setInterval> | null} */
let sessionSharePollId = null
/** @type {import('@supabase/supabase-js').RealtimeChannel | null} */
let sessionShareChannel = null
/** Midlertidig cache: share-id → payload (for knapper uten å sende hele JSON i DOM). */
const incomingSharePayloadCache = new Map()
/** Forrige antall mottatte delinger (null = ikke satt ennå; unngår animasjon ved første lasting). */
let lastIncomingShareCountForNotify = null

/** Mottaker valgt i «Del økt»-dialogen (5-sifret ID). */
let shareRecipientShortId = null
/** Visningsnavn for valgt mottaker (valgfritt). */
let shareRecipientDisplayName = null

/** Mottaker i «Del bilder» (forside-album). */
let shareStandaloneRecipientShortId = null
let shareStandaloneRecipientDisplayName = null
/** @type {Array<NonNullable<ReturnType<typeof normalizePhoto>>> | null} */
let shareStandalonePendingPhotos = null

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {import('@supabase/supabase-js').Session} session
 */
async function applySupabaseSessionAndNavigate(sb, session) {
  currentUser = await buildCurrentUserFromSession(sb, session)
  if (!tryWriteAuthSession(currentUser)) {
    currentUser = null
    void sb.auth.signOut()
    const errEl = document.getElementById('auth-error')
    if (errEl) errEl.textContent = authStorageFailedUserMessage()
    return
  }
  void requestPersistedStorageIfSupported()
  void backupAuthToIdb(loadUsersFromStorage(), currentUser)
  const remote = await fetchUserAppState(sb, session.user.id)
  const diskApp = loadAppStateFromStorageForUser(currentUser.id)
  if (remote) {
    sessions = remote.sessions.map(normalizeSession).filter(Boolean)
    currentSessionId = remote.currentSessionId
    standalonePhotos = mergeStandalonePhotoLists(
      normalizeStandalonePhotosList(remote.standalonePhotos),
      diskApp.standalonePhotos,
    )
  } else {
    sessions = diskApp.sessions
    currentSessionId = diskApp.currentSessionId
    standalonePhotos = diskApp.standalonePhotos
  }
  if (currentSessionId && !sessions.some((s) => s.id === currentSessionId)) {
    currentSessionId = null
  }
  state = loadCurrentSessionState()
  if (currentSessionId) {
    view = 'session'
  } else {
    view = 'home'
  }
  renderApp()
  if (view === 'session') {
    void initSessionMapAndWatch()
    bindSessionListeners()
  } else {
    bindHomeListeners()
  }
}

function bindAuthListeners() {
  if (authAbort) authAbort.abort()
  authAbort = new AbortController()
  const { signal } = authAbort
  const errEl = document.getElementById('auth-error')
  const formLogin = document.getElementById('form-auth-login')
  const formReg = document.getElementById('form-auth-register')
  const tabLogin = document.getElementById('auth-tab-login')
  const tabReg = document.getElementById('auth-tab-register')

  tabLogin?.addEventListener(
    'click',
    () => {
      authScreen = 'login'
      renderApp()
      bindAuthListeners()
    },
    { signal },
  )
  tabReg?.addEventListener(
    'click',
    () => {
      authScreen = 'register'
      renderApp()
      bindAuthListeners()
    },
    { signal },
  )

  formLogin?.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault()
      if (errEl) errEl.textContent = ''
      const emailInp = document.getElementById('auth-login-email')
      const passInp = document.getElementById('auth-login-password')
      const email = emailInp?.value?.trim() ?? ''
      const password = passInp?.value ?? ''
      if (!isValidEmail(email)) {
        if (errEl) errEl.textContent = 'Ugyldig e-post.'
        return
      }
      const sb = getSupabase()
      if (sb) {
        if (password.length < AUTH_PASSWORD_MIN_LEN) {
          if (errEl) {
            errEl.textContent = `Passord må minst ${AUTH_PASSWORD_MIN_LEN} tegn.`
          }
          return
        }
        const { data, error } = await sb.auth.signInWithPassword({
          email,
          password,
        })
        if (error || !data.session) {
          if (errEl) {
            errEl.textContent = mapSupabaseAuthError(
              error ?? new Error('Ingen sesjon'),
            )
          }
          return
        }
        await applySupabaseSessionAndNavigate(sb, data.session)
        return
      }
      const users = loadUsersFromStorage()
      const u = users.find((x) => x.emailLower === email.toLowerCase())
      if (!u) {
        if (errEl) errEl.textContent = 'Ukjent e-post eller feil passord.'
        return
      }
      if (!u.salt || password.length < AUTH_PASSWORD_MIN_LEN) {
        if (errEl) errEl.textContent = 'Ukjent e-post eller feil passord.'
        return
      }
      if (!u.passwordHash) {
        if (errEl) errEl.textContent = 'Ukjent e-post eller feil passord.'
        return
      }
      try {
        const hash = await hashPasswordWithSalt(password, u.salt)
        if (hash !== u.passwordHash) {
          if (errEl) errEl.textContent = 'Ukjent e-post eller feil passord.'
          return
        }
      } catch {
        if (errEl) errEl.textContent = 'Kunne ikke verifisere passord.'
        return
      }
      currentUser = {
        id: u.id,
        name:
          typeof u.name === 'string' && u.name.trim()
            ? u.name.trim().slice(0, AUTH_NAME_MAX_LEN)
            : 'Bruker',
        email: typeof u.email === 'string' ? u.email : email,
        ...(isValidStoredShortId(
          /** @type {{ shortId?: string }} */ (u).shortId,
        )
          ? { shortId: /** @type {{ shortId?: string }} */ (u).shortId }
          : {}),
      }
      if (!tryWriteAuthSession(currentUser)) {
        currentUser = null
        if (errEl) errEl.textContent = authStorageFailedUserMessage()
        return
      }
      if (!verifyAuthSessionForUser(u.id)) {
        clearAuthSession()
        currentUser = null
        if (errEl) {
          errEl.textContent =
            'Innlogging ble ikke bekreftet lagret. Prøv igjen, eller bruk nøyaktig samme nettadresse som sist.'
        }
        return
      }
      void requestPersistedStorageIfSupported()
      void backupAuthToIdb(loadUsersFromStorage(), currentUser)
      const app = loadAppStateFromStorageForUser(u.id)
      sessions = app.sessions
      currentSessionId = app.currentSessionId
      standalonePhotos = normalizeStandalonePhotosList(app.standalonePhotos)
      if (currentSessionId && !sessions.some((s) => s.id === currentSessionId)) {
        currentSessionId = null
      }
      state = loadCurrentSessionState()
      if (currentSessionId) {
        view = 'session'
      } else {
        view = 'home'
      }
      renderApp()
      if (view === 'session') {
        void initSessionMapAndWatch()
        bindSessionListeners()
      } else {
        bindHomeListeners()
      }
    },
    { signal },
  )

  formReg?.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault()
      if (errEl) errEl.textContent = ''
      const nameInp = document.getElementById('auth-reg-name')
      const emailInp = document.getElementById('auth-reg-email')
      const passInp = document.getElementById('auth-reg-password')
      const name = nameInp?.value?.trim() ?? ''
      const email = emailInp?.value?.trim() ?? ''
      const password = passInp?.value ?? ''
      if (!name || name.length < 1) {
        if (errEl) errEl.textContent = 'Skriv inn navn.'
        return
      }
      if (!isValidEmail(email)) {
        if (errEl) errEl.textContent = 'Ugyldig e-post.'
        return
      }
      if (password.length < AUTH_PASSWORD_MIN_LEN) {
        if (errEl) {
          errEl.textContent = `Passord må minst ${AUTH_PASSWORD_MIN_LEN} tegn.`
        }
        return
      }
      const sbReg = getSupabase()
      if (sbReg) {
        const { data, error } = await sbReg.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.slice(0, AUTH_NAME_MAX_LEN) },
          },
        })
        if (error) {
          if (errEl) errEl.textContent = mapSupabaseAuthError(error)
          return
        }
        if (!data.session) {
          if (errEl) {
            errEl.textContent =
              'Konto opprettet. Sjekk e-posten og bekreft adressen, deretter logg inn.'
          }
          return
        }
        await applySupabaseSessionAndNavigate(sbReg, data.session)
        saveAppState()
        return
      }
      const beforeSnap = loadUsersFromStorage()
      if (beforeSnap.some((x) => x.emailLower === email.toLowerCase())) {
        if (errEl) errEl.textContent = 'E-posten er allerede registrert.'
        return
      }
      let salt
      let passwordHash
      try {
        salt = randomSaltB64()
        passwordHash = await hashPasswordWithSalt(password, salt)
      } catch {
        if (errEl) errEl.textContent = 'Kunne ikke lagre passord. Prøv igjen.'
        return
      }
      const id = crypto.randomUUID()
      const newUser = {
        id,
        name: name.slice(0, AUTH_NAME_MAX_LEN),
        email,
        emailLower: email.toLowerCase(),
        salt,
        passwordHash,
      }
      const { users: toWrite } = ensureUserShortIds([...beforeSnap, newUser])
      if (!tryWriteUsersToStorage(toWrite)) {
        if (errEl) errEl.textContent = authStorageFailedUserMessage()
        return
      }
      const regRow = toWrite.find((x) => x && x.id === id)
      const regShort =
        regRow && typeof regRow === 'object'
          ? /** @type {{ shortId?: string }} */ (regRow).shortId
          : undefined
      const nextUser = {
        id,
        name: newUser.name,
        email: newUser.email,
        ...(isValidStoredShortId(regShort) ? { shortId: regShort } : {}),
      }
      if (!tryWriteAuthSession(nextUser)) {
        tryWriteUsersToStorage(beforeSnap)
        if (errEl) errEl.textContent = authStorageFailedUserMessage()
        return
      }
      if (!verifyUserInStorage(id) || !verifyAuthSessionForUser(id)) {
        clearAuthSession()
        tryWriteUsersToStorage(beforeSnap)
        if (errEl) {
          errEl.textContent =
            'Registrering ble ikke bekreftet lagret. Prøv igjen, eller bruk nøyaktig samme nettadresse som sist.'
        }
        return
      }
      currentUser = nextUser
      void requestPersistedStorageIfSupported()
      void backupAuthToIdb(loadUsersFromStorage(), currentUser)
      sessions = []
      currentSessionId = null
      standalonePhotos = []
      state = defaultState()
      view = 'home'
      saveAppState()
      renderApp()
      bindHomeListeners()
    },
    { signal },
  )
}

function openHomeDrawer() {
  const drawer = document.getElementById('home-drawer')
  const backdrop = document.getElementById('home-drawer-backdrop')
  const btn = document.getElementById('btn-home-drawer-open')
  drawer?.removeAttribute('hidden')
  backdrop?.removeAttribute('hidden')
  if (drawer) drawer.setAttribute('aria-hidden', 'false')
  if (backdrop) backdrop.setAttribute('aria-hidden', 'false')
  btn?.setAttribute('aria-expanded', 'true')
  requestAnimationFrame(() => {
    drawer?.classList.add('home-drawer--open')
    backdrop?.classList.add('home-drawer-backdrop--visible')
  })
}

function closeHomeDrawer() {
  const drawer = document.getElementById('home-drawer')
  const backdrop = document.getElementById('home-drawer-backdrop')
  const btn = document.getElementById('btn-home-drawer-open')
  drawer?.classList.remove('home-drawer--open')
  backdrop?.classList.remove('home-drawer-backdrop--visible')
  btn?.setAttribute('aria-expanded', 'false')
  window.setTimeout(() => {
    drawer?.setAttribute('hidden', '')
    backdrop?.setAttribute('hidden', '')
    if (drawer) drawer.setAttribute('aria-hidden', 'true')
    if (backdrop) backdrop.setAttribute('aria-hidden', 'true')
  }, 320)
}

/**
 * @param {'sessions' | 'resume' | 'download' | 'import'} tab
 */
function openMenuSession(tab) {
  closeHomeDrawer()
  menuSessionTab = tab
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuSession'
  saveAppState()
  renderApp()
  bindMenuSessionListeners()
}

function openMenuUserView() {
  closeHomeDrawer()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuUser'
  saveAppState()
  renderApp()
  bindMenuUserListeners()
}

function openMenuMapView() {
  closeHomeDrawer()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuMap'
  saveAppState()
  renderApp()
  bindMenuMapListeners()
}

function openMenuContactsView() {
  closeHomeDrawer()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuContacts'
  saveAppState()
  renderApp()
  bindMenuContactsListeners()
}

function openMenuSettingsView() {
  closeHomeDrawer()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuSettings'
  saveAppState()
  renderApp()
  bindMenuInfoListeners()
}

function openMenuPrivacyView() {
  closeHomeDrawer()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuPrivacy'
  saveAppState()
  renderApp()
  bindMenuInfoListeners()
}

function openMenuSupportView() {
  closeHomeDrawer()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuSupport'
  saveAppState()
  renderApp()
  bindMenuInfoListeners()
}

function bindHomeListeners() {
  if (homeAbort) homeAbort.abort()
  homeAbort = new AbortController()
  const { signal } = homeAbort
  const openInbox = () => openInboxView()
  document
    .getElementById('btn-home-inbox')
    ?.addEventListener('click', openInbox, { signal })
  document
    .getElementById('btn-logout')
    ?.addEventListener('click', () => logoutUser(), { signal })
  document
    .getElementById('btn-home-nav-new')
    ?.addEventListener('click', () => startNewSessionFromHome(), { signal })
  document
    .getElementById('btn-home-nav-camera')
    ?.addEventListener('click', () => openTaBildeFromHome(), { signal })
  document
    .getElementById('btn-home-nav-ai')
    ?.addEventListener('click', () => setHomeBildeSubTab('ai'), { signal })
  document
    .getElementById('btn-home-nav-history')
    ?.addEventListener('click', () => openMenuSession('sessions'), { signal })
  document.getElementById('btn-home-drawer-open')?.addEventListener(
    'click',
    () => openHomeDrawer(),
    { signal },
  )
  document.getElementById('btn-home-drawer-close')?.addEventListener(
    'click',
    () => closeHomeDrawer(),
    { signal },
  )
  document.getElementById('home-drawer-backdrop')?.addEventListener(
    'click',
    () => closeHomeDrawer(),
    { signal },
  )
  document.getElementById('home-drawer-session-hub')?.addEventListener(
    'click',
    () => openMenuSession('sessions'),
    { signal },
  )
  document.getElementById('home-drawer-contract-ai')?.addEventListener(
    'click',
    () => openHomeAiAskContract(),
    { signal },
  )
  document.getElementById('home-drawer-user')?.addEventListener(
    'click',
    () => openMenuUserView(),
    { signal },
  )
  document.getElementById('home-drawer-map')?.addEventListener(
    'click',
    () => openMenuMapView(),
    { signal },
  )
  document.getElementById('home-drawer-contacts')?.addEventListener(
    'click',
    () => openMenuContactsView(),
    { signal },
  )
  document.getElementById('home-drawer-messages')?.addEventListener(
    'click',
    () => {
      closeHomeDrawer()
      openInboxView()
    },
    { signal },
  )
  document.getElementById('home-drawer-settings')?.addEventListener(
    'click',
    () => openMenuSettingsView(),
    { signal },
  )
  document.getElementById('home-drawer-privacy')?.addEventListener(
    'click',
    () => openMenuPrivacyView(),
    { signal },
  )
  document.getElementById('home-drawer-support')?.addEventListener(
    'click',
    () => openMenuSupportView(),
    { signal },
  )
  bindKmtDialogListeners(signal)
  bindHomeAiDocumentationListeners(signal)
  setupSessionShareInbox()
  startHomeVegrefTracking()
}

/**
 * Pinner AI-fullskjerm til window.visualViewport (viktig på iOS): unngår glippe
 * nederst der forsiden skimtes, og at fixed-panelet blir for høyt når tastatur er åpent.
 */
function resetHomeAiPanelVisualViewport(panel) {
  panel.classList.remove('home-ai-panel--vv')
  panel.style.removeProperty('top')
  panel.style.removeProperty('left')
  panel.style.removeProperty('width')
  panel.style.removeProperty('height')
  panel.style.removeProperty('right')
  panel.style.removeProperty('bottom')
}

function applyHomeAiPanelVisualViewport(panel) {
  const vv = window.visualViewport
  if (!vv) return
  const h = Math.max(1, vv.height)
  panel.classList.add('home-ai-panel--vv')
  panel.style.top = `${vv.offsetTop}px`
  panel.style.left = `${vv.offsetLeft}px`
  panel.style.width = `${vv.width}px`
  panel.style.height = `${h}px`
  panel.style.right = 'auto'
  panel.style.bottom = 'auto'
}

function updateHomeAiPanelVisualViewport() {
  const panel = document.getElementById('panel-home-bilde-ai')
  if (!panel || panel.hidden) {
    if (panel) resetHomeAiPanelVisualViewport(panel)
    return
  }
  if (!window.visualViewport) return
  applyHomeAiPanelVisualViewport(panel)
}

function bindHomeAiPanelVisualViewport(signal) {
  const vv = window.visualViewport
  if (!vv) return
  const schedule = () => {
    requestAnimationFrame(() => updateHomeAiPanelVisualViewport())
  }
  vv.addEventListener('resize', schedule, { signal })
  vv.addEventListener('scroll', schedule, { signal })
  window.addEventListener('orientationchange', schedule, { signal })
}

function setHomeBildeSubTab(which) {
  const panelCam = document.getElementById('panel-home-bilde-camera')
  const panelAi = document.getElementById('panel-home-bilde-ai')
  if (!panelCam || !panelAi) return
  const isCam = which === 'camera'
  panelCam.hidden = !isCam
  panelAi.hidden = isCam
  if (isCam) {
    stopHomeAiCamera()
  } else {
    document.getElementById('home-ai-stage-chat')?.removeAttribute('hidden')
    document.getElementById('home-ai-stage-camera')?.setAttribute('hidden', '')
  }
  const navAi = document.getElementById('btn-home-nav-ai')
  navAi?.classList.toggle('home-bottom-nav__btn--active', !isCam)
  updateHomeAiPanelVisualViewport()
}

function stopHomeAiCamera() {
  const video = document.getElementById('home-ai-video')
  if (video) video.srcObject = null
  if (homeAiMediaStream) {
    for (const t of homeAiMediaStream.getTracks()) {
      try {
        t.stop()
      } catch {
        /* ignore */
      }
    }
    homeAiMediaStream = null
  }
}

async function startHomeAiCameraForPanel() {
  const video = document.getElementById('home-ai-video')
  if (!video || !navigator.mediaDevices?.getUserMedia) {
    const st = document.getElementById('home-ai-status')
    if (st) {
      st.textContent =
        'Kamera er ikke tilgjengelig. Bruk «Velg bilde fra filer».'
    }
    return
  }
  stopHomeAiCamera()
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
    homeAiMediaStream = stream
    video.srcObject = stream
    await video.play()
  } catch {
    const st = document.getElementById('home-ai-status')
    if (st) {
      st.textContent =
        'Kunne ikke starte kamera. Bruk «Velg bilde fra filer» eller sjekk tillatelser.'
    }
  }
}

function captureHomeAiFrameToDataUrl() {
  const video = document.getElementById('home-ai-video')
  if (!video || !video.videoWidth) return ''
  const w = video.videoWidth
  const h = video.videoHeight
  let tw = w
  let th = h
  const max = HOME_AI_CAPTURE_MAX
  if (w > max || h > max) {
    if (w >= h) {
      tw = max
      th = Math.round((h * max) / w)
    } else {
      th = max
      tw = Math.round((w * max) / h)
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(video, 0, 0, tw, th)
  return canvas.toDataURL('image/jpeg', 0.88)
}

function syncHomeAiModeHint(on) {
  const el = document.getElementById('home-ai-mode-hint')
  if (!el) return
  if (on) {
    el.textContent =
      'Skriv spørsmålet ditt nedenfor. Svarene bygger på kontraktsdokumentet som er indeksert på serveren.'
    el.classList.add('home-ai-gpt__mode-hint--contract')
  } else {
    el.innerHTML =
      'VeiAi hjelper med bilde og tekst fra veien. For å <strong>spørre om kontrakten</strong>, trykk «Kontrakt» over eller «Spør om kontrakten» i menyen.'
    el.classList.remove('home-ai-gpt__mode-hint--contract')
  }
}

function applyHomeAiContractRagUi(on) {
  const btn = document.getElementById('btn-home-ai-contract-rag')
  const input = document.getElementById('home-ai-chat-input')
  const label = document.querySelector('label[for="home-ai-chat-input"]')
  const sendBtn = document.getElementById('btn-home-ai-send')
  btn?.classList.toggle('home-ai-gpt__tool--active', on)
  if (input) {
    input.placeholder = on
      ? 'Skriv spørsmålet ditt om kontrakten …'
      : 'Send melding til VeiAi'
  }
  if (label) {
    label.textContent = on
      ? 'Send melding om kontrakten'
      : 'Send melding til VeiAi'
  }
  if (sendBtn) {
    sendBtn.setAttribute(
      'aria-label',
      on ? 'Send melding om kontrakten' : 'Send melding til VeiAi',
    )
  }
  syncHomeAiModeHint(on)
}

/**
 * Slår kontrakt-RAG av eller på (tekstspørsmål mot indeksert kontrakt).
 * @param {boolean} wantOn
 */
function setHomeAiContractRagEnabled(wantOn) {
  const log = document.getElementById('home-ai-chat-log')
  const st = document.getElementById('home-ai-status')
  if (wantOn) {
    homeAiContractRagMode = true
    homeAiRagMessages = []
    homeAiApiMessages = []
    homeAiCapturedDataUrl = ''
    syncHomeAiPreviewThumb()
    if (log) log.innerHTML = ''
    if (st) st.textContent = ''
    applyHomeAiContractRagUi(true)
  } else {
    homeAiContractRagMode = false
    homeAiRagMessages = []
    homeAiApiMessages = []
    if (log) log.innerHTML = ''
    if (st) st.textContent = ''
    applyHomeAiContractRagUi(false)
  }
}

function openHomeAiAskContract() {
  closeHomeDrawer()
  setHomeBildeSubTab('ai')
  setHomeAiContractRagEnabled(true)
  document.getElementById('home-ai-chat-input')?.focus()
}

function exitHomeAiContractRagUi() {
  if (!homeAiContractRagMode) return
  homeAiContractRagMode = false
  homeAiRagMessages = []
  applyHomeAiContractRagUi(false)
}

function enterHomeAiChatWithImage(dataUrl) {
  exitHomeAiContractRagUi()
  homeAiCapturedDataUrl = dataUrl
  homeAiApiMessages = []
  stopHomeAiCamera()
  const img = document.getElementById('home-ai-preview-img')
  if (img) img.src = dataUrl
  syncHomeAiPreviewThumb()
  document.getElementById('home-ai-stage-camera')?.setAttribute('hidden', '')
  document.getElementById('home-ai-stage-chat')?.removeAttribute('hidden')
  const log = document.getElementById('home-ai-chat-log')
  if (log) log.innerHTML = ''
  const st = document.getElementById('home-ai-status')
  if (st) st.textContent = ''
  document.getElementById('home-ai-chat-input')?.focus()
}

function retakeHomeAiDoc() {
  homeAiCapturedDataUrl = ''
  homeAiApiMessages = []
  homeAiRagMessages = []
  const log = document.getElementById('home-ai-chat-log')
  if (log) log.innerHTML = ''
  stopHomeAiCamera()
  syncHomeAiPreviewThumb()
  document.getElementById('home-ai-stage-camera')?.setAttribute('hidden', '')
  document.getElementById('home-ai-stage-chat')?.removeAttribute('hidden')
  const st = document.getElementById('home-ai-status')
  if (st) st.textContent = ''
}

/**
 * @param {'user' | 'assistant'} role
 * @param {string} html
 * @param {{ appearIn?: boolean }} [options]
 */
function appendHomeAiChatBubble(role, html, options) {
  const log = document.getElementById('home-ai-chat-log')
  if (!log) return
  const row = document.createElement('div')
  row.className = `home-ai-gpt__row home-ai-gpt__row--${role}`

  if (role === 'assistant') {
    const turn = document.createElement('div')
    turn.className = 'home-ai-gpt__turn'
    const avatar = document.createElement('div')
    avatar.className = 'home-ai-gpt__avatar'
    avatar.setAttribute('aria-hidden', 'true')
    avatar.innerHTML = '<span class="home-ai-gpt__avatar-mark"></span>'
    const bubble = document.createElement('div')
    bubble.className = 'home-ai-gpt__bubble home-ai-gpt__bubble--assistant'
    if (options?.appearIn) {
      bubble.classList.add('home-ai-gpt__bubble--appear-in')
    }
    bubble.innerHTML = html
    turn.appendChild(avatar)
    turn.appendChild(bubble)
    row.appendChild(turn)
  } else {
    const turn = document.createElement('div')
    turn.className = 'home-ai-gpt__turn home-ai-gpt__turn--user'
    const bubble = document.createElement('div')
    bubble.className = 'home-ai-gpt__bubble home-ai-gpt__bubble--user'
    bubble.innerHTML = html
    turn.appendChild(bubble)
    row.appendChild(turn)
  }

  log.appendChild(row)
  log.scrollTop = log.scrollHeight
}

function renderHomeAiStructuredHtml(data) {
  const problem = escapeHtml(String(data.problem ?? ''))
  const risk = escapeHtml(String(data.risk ?? ''))
  const action = escapeHtml(String(data.action ?? ''))
  const explanation = escapeHtml(String(data.explanation ?? ''))
  const report = escapeHtml(String(data.report ?? '')).replace(/\n/g, '<br />')
  return `
    <div class="home-ai-result home-ai-result--inchat">
      <div class="home-ai-result__block"><h3 class="home-ai-result__h">Problem</h3><p class="home-ai-result__p">${problem}</p></div>
      <div class="home-ai-result__block"><h3 class="home-ai-result__h">Risiko</h3><p class="home-ai-result__p">${risk}</p></div>
      <div class="home-ai-result__block"><h3 class="home-ai-result__h">Tiltak</h3><p class="home-ai-result__p">${action}</p></div>
      <div class="home-ai-result__block"><h3 class="home-ai-result__h">Forklaring</h3><p class="home-ai-result__p">${explanation}</p></div>
      <div class="home-ai-result__block home-ai-result__block--report"><h3 class="home-ai-result__h">Rapport</h3><p class="home-ai-result__p home-ai-result__report">${report}</p></div>
    </div>`
}

const HOME_AI_DEFAULT_FIRST_TEXT =
  'Se bildet og gi en kort veivokter-vurdering (sikkerhet, føre, praktiske tiltak).'

const HOME_AI_DEFAULT_NO_IMAGE_TEXT =
  'Gi en kort veivokter-vurdering ut fra beskrivelsen (ingen bilde vedlagt).'

function buildHomeAiUserText(text) {
  return `Brukerens beskrivelse:\n${String(text).trim()}`
}

function syncHomeAiPreviewThumb() {
  const img = document.getElementById('home-ai-preview-img')
  const ph = document.getElementById('home-ai-thumb-placeholder')
  const has = Boolean(homeAiCapturedDataUrl && homeAiCapturedDataUrl.length > 32)
  if (img) {
    if (has) {
      img.removeAttribute('hidden')
    } else {
      img.setAttribute('hidden', '')
      img.removeAttribute('src')
    }
  }
  if (ph) ph.hidden = has
}

function openHomeAiCameraStage() {
  document.getElementById('home-ai-stage-chat')?.setAttribute('hidden', '')
  document.getElementById('home-ai-stage-camera')?.removeAttribute('hidden')
  void startHomeAiCameraForPanel()
}

function backHomeAiChatFromCamera() {
  stopHomeAiCamera()
  document.getElementById('home-ai-stage-camera')?.setAttribute('hidden', '')
  document.getElementById('home-ai-stage-chat')?.removeAttribute('hidden')
}

function renderHomeAiFollowupReplyHtml(text) {
  const escaped = escapeHtml(String(text)).replace(/\n/g, '<br />')
  return `<div class="home-ai-gpt__reply"><p class="home-ai-gpt__reply-p">${escaped}</p></div>`
}

/**
 * Ord / tegn-biter for ChatGPT-lignende «streaming» av ferdig tekst.
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeForStream(text) {
  const m = String(text).match(/\S+|\s+/g)
  return m && m.length ? m : [String(text)]
}

/**
 * Tom assistent-rad klar for simulert streaming.
 * @returns {{ row: HTMLDivElement, pEl: HTMLParagraphElement } | null}
 */
function appendHomeAiAssistantStreamingShell() {
  const log = document.getElementById('home-ai-chat-log')
  if (!log) return null
  const row = document.createElement('div')
  row.className =
    'home-ai-gpt__row home-ai-gpt__row--assistant home-ai-gpt__row--streaming'
  const turn = document.createElement('div')
  turn.className = 'home-ai-gpt__turn'
  const avatar = document.createElement('div')
  avatar.className = 'home-ai-gpt__avatar'
  avatar.setAttribute('aria-hidden', 'true')
  avatar.innerHTML = '<span class="home-ai-gpt__avatar-mark"></span>'
  const bubble = document.createElement('div')
  bubble.className = 'home-ai-gpt__bubble home-ai-gpt__bubble--assistant'
  const wrap = document.createElement('div')
  wrap.className = 'home-ai-gpt__reply home-ai-gpt__reply--stream'
  const pEl = document.createElement('p')
  pEl.className = 'home-ai-gpt__reply-p'
  wrap.appendChild(pEl)
  bubble.appendChild(wrap)
  turn.appendChild(avatar)
  turn.appendChild(bubble)
  row.appendChild(turn)
  log.appendChild(row)
  log.scrollTop = log.scrollHeight
  return { row, pEl }
}

/**
 * Viser tekst ord for ord (simulert stream som ChatGPT når hele svar allerede er mottatt).
 * @param {HTMLParagraphElement} pEl
 * @param {string} fullText
 * @returns {Promise<void>}
 */
function streamHomeAiPlainTextIntoParagraph(pEl, fullText) {
  const tokens = tokenizeForStream(fullText)
  if (homeAiPrefersReducedMotion() || tokens.length === 0) {
    pEl.innerHTML = escapeHtml(fullText).replace(/\n/g, '<br />')
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    let i = 0
    let acc = ''
    const tick = () => {
      if (i >= tokens.length) {
        pEl.innerHTML = escapeHtml(fullText).replace(/\n/g, '<br />')
        const log = document.getElementById('home-ai-chat-log')
        if (log) log.scrollTop = log.scrollHeight
        resolve()
        return
      }
      let take = 1
      if (Math.random() > 0.45) take++
      if (Math.random() > 0.82) take++
      take = Math.min(take, tokens.length - i)
      for (let k = 0; k < take; k++) acc += tokens[i++]
      pEl.innerHTML =
        escapeHtml(acc).replace(/\n/g, '<br />') +
        '<span class="home-ai-gpt__stream-cursor" aria-hidden="true"></span>'
      const log = document.getElementById('home-ai-chat-log')
      if (log) log.scrollTop = log.scrollHeight
      const delay = 5 + Math.random() * 21
      setTimeout(tick, delay)
    }
    tick()
  })
}

/**
 * @param {string} fullText
 */
async function appendHomeAiAssistantPlainTextStreamed(fullText) {
  const shell = appendHomeAiAssistantStreamingShell()
  if (!shell) {
    appendHomeAiChatBubble(
      'assistant',
      renderHomeAiFollowupReplyHtml(fullText),
    )
    return
  }
  await streamHomeAiPlainTextIntoParagraph(shell.pEl, fullText)
  shell.row.classList.remove('home-ai-gpt__row--streaming')
}

function homeAiPrefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function ensureHomeAiAudioContext() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!homeAiAudioContext) homeAiAudioContext = new AC()
  if (homeAiAudioContext.state === 'suspended') {
    void homeAiAudioContext.resume()
  }
  return homeAiAudioContext
}

/** Diskrete «tenke»-klikk (lav volum), trigges etter brukerhandling (send). */
function playHomeAiThinkingTick() {
  const ctx = ensureHomeAiAudioContext()
  if (!ctx) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(720 + Math.random() * 140, t)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.065, t + 0.012)
  g.gain.linearRampToValueAtTime(0, t + 0.095)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.1)
}

function appendHomeAiTypingIndicator() {
  const log = document.getElementById('home-ai-chat-log')
  if (!log || log.querySelector('[data-home-ai-typing]')) return
  const row = document.createElement('div')
  row.className =
    'home-ai-gpt__row home-ai-gpt__row--assistant home-ai-gpt__typing-row'
  row.setAttribute('data-home-ai-typing', 'true')
  row.innerHTML = `<div class="home-ai-gpt__turn">
    <div class="home-ai-gpt__avatar" aria-hidden="true"><span class="home-ai-gpt__avatar-mark"></span></div>
    <div class="home-ai-gpt__typing" aria-hidden="true"><span></span><span></span><span></span></div>
  </div>`
  log.appendChild(row)
  log.scrollTop = log.scrollHeight
}

function removeHomeAiTypingIndicator() {
  document.querySelector('[data-home-ai-typing]')?.remove()
}

function startHomeAiThinkingUx() {
  const stage = document.getElementById('home-ai-stage-chat')
  stage?.classList.add('home-ai-gpt--thinking')
  stage?.setAttribute('aria-busy', 'true')
  appendHomeAiTypingIndicator()
  if (homeAiPrefersReducedMotion()) return
  playHomeAiThinkingTick()
  if (homeAiThinkingSoundTimer) {
    clearInterval(homeAiThinkingSoundTimer)
    homeAiThinkingSoundTimer = 0
  }
  homeAiThinkingSoundTimer = window.setInterval(() => {
    if (Math.random() > 0.42) playHomeAiThinkingTick()
  }, 460)
}

function stopHomeAiThinkingUx() {
  const stage = document.getElementById('home-ai-stage-chat')
  stage?.classList.remove('home-ai-gpt--thinking')
  stage?.removeAttribute('aria-busy')
  removeHomeAiTypingIndicator()
  if (homeAiThinkingSoundTimer) {
    clearInterval(homeAiThinkingSoundTimer)
    homeAiThinkingSoundTimer = 0
  }
}

async function sendHomeAiContractRagMessage() {
  const statusEl = document.getElementById('home-ai-status')
  const input = document.getElementById('home-ai-chat-input')
  const sendBtn = document.getElementById('btn-home-ai-send')
  const textRaw = input?.value?.trim() ?? ''
  const hadAssistant = homeAiRagMessages.some((m) => m.role === 'assistant')

  if (hadAssistant && !textRaw) {
    if (statusEl) statusEl.textContent = 'Skriv et oppfølgingsspørsmål.'
    return
  }
  if (!hadAssistant && !textRaw) {
    if (statusEl) statusEl.textContent = 'Skriv et spørsmål om kontrakten.'
    return
  }

  const bubbleHtml = escapeHtml(textRaw).replace(/\n/g, '<br />')
  appendHomeAiChatBubble('user', `<p class="home-ai-gpt__user-p">${bubbleHtml}</p>`)
  if (input) input.value = ''

  homeAiRagMessages.push({ role: 'user', content: textRaw })

  if (statusEl) statusEl.textContent = 'Kontrakt-AI tenker …'
  if (sendBtn) sendBtn.disabled = true
  startHomeAiThinkingUx()
  try {
    const r = await fetch(apiUrl('/api/contract-chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: homeAiRagMessages }),
    })
    let data = /** @type {Record<string, unknown>} */ ({})
    const ct = r.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      data = await r.json().catch(() => ({}))
    } else {
      await r.text().catch(() => '')
    }

    if (!r.ok) {
      homeAiRagMessages.pop()
      const err =
        data && typeof data.error === 'string' && data.error.trim()
          ? data.error
          : r.status === 503
            ? 'Kontrakt-RAG er ikke klar. Sjekk at PDF er indeksert på serveren.'
            : `Feil ${r.status}`
      if (statusEl) statusEl.textContent = err
      const log = document.getElementById('home-ai-chat-log')
      if (log?.lastElementChild) log.removeChild(log.lastElementChild)
      if (input) input.value = textRaw
      return
    }

    const reply =
      typeof data.reply === 'string' && data.reply.trim()
        ? data.reply.trim()
        : ''
    if (!reply) {
      homeAiRagMessages.pop()
      if (statusEl) statusEl.textContent = 'Tomt svar fra serveren.'
      const log = document.getElementById('home-ai-chat-log')
      if (log?.lastElementChild) log.removeChild(log.lastElementChild)
      if (input) input.value = textRaw
      return
    }

    homeAiRagMessages.push({ role: 'assistant', content: reply })
    stopHomeAiThinkingUx()
    await appendHomeAiAssistantPlainTextStreamed(reply)
    if (statusEl) statusEl.textContent = 'Ferdig.'
  } catch (e) {
    homeAiRagMessages.pop()
    if (statusEl) {
      statusEl.textContent =
        e && typeof e === 'object' && 'message' in e
          ? String(/** @type {{ message: string }} */ (e).message)
          : 'Noe gikk galt.'
    }
    const log = document.getElementById('home-ai-chat-log')
    if (log?.lastElementChild) log.removeChild(log.lastElementChild)
    if (input) input.value = textRaw
  } finally {
    stopHomeAiThinkingUx()
    if (sendBtn) sendBtn.disabled = false
  }
}

/** Oppfølging: API skal sende { reply }, men håndter JSON-lignende svar og tomme felt. */
function extractHomeAiFollowupReply(data) {
  if (!data || typeof data !== 'object') return ''
  if (typeof data.reply === 'string' && data.reply.trim()) return data.reply.trim()
  if (data.reply != null && String(data.reply).trim()) return String(data.reply).trim()
  const parts = ['problem', 'risk', 'action', 'explanation', 'report']
    .map((k) => data[k])
    .filter((x) => x != null && String(x).trim())
  if (parts.length) return parts.map((x) => String(x)).join('\n\n')
  return ''
}

async function sendHomeAiChatMessage() {
  if (homeAiContractRagMode) {
    await sendHomeAiContractRagMessage()
    return
  }
  const statusEl = document.getElementById('home-ai-status')
  const input = document.getElementById('home-ai-chat-input')
  const sendBtn = document.getElementById('btn-home-ai-send')
  const textRaw = input?.value?.trim() ?? ''
  const hasImage = Boolean(
    homeAiCapturedDataUrl && String(homeAiCapturedDataUrl).trim().length > 0,
  )

  const hadAssistantInThread = homeAiApiMessages.some(
    (m) => m.role === 'assistant',
  )
  if (hadAssistantInThread && !textRaw) {
    if (statusEl) statusEl.textContent = 'Skriv et oppfølgingsspørsmål.'
    return
  }

  let textForApi
  if (hadAssistantInThread) {
    textForApi = textRaw
  } else if (textRaw.length > 0) {
    textForApi = textRaw
  } else if (hasImage) {
    textForApi = HOME_AI_DEFAULT_FIRST_TEXT
  } else {
    textForApi = HOME_AI_DEFAULT_NO_IMAGE_TEXT
  }

  const bubbleHtml =
    textRaw.length > 0
      ? escapeHtml(textRaw).replace(/\n/g, '<br />')
      : hasImage
        ? '<em class="home-ai-gpt__em">(Ingen egen tekst – analyse av bildet)</em>'
        : '<em class="home-ai-gpt__em">(Tekstbasert – ingen bilde vedlagt)</em>'
  appendHomeAiChatBubble('user', `<p class="home-ai-gpt__user-p">${bubbleHtml}</p>`)
  if (input) input.value = ''

  const userBlock = buildHomeAiUserText(String(textForApi))
  const firstUserMessage = hasImage
    ? {
        role: 'user',
        content: [
          { type: 'text', text: userBlock },
          {
            type: 'image_url',
            image_url: { url: homeAiCapturedDataUrl, detail: 'high' },
          },
        ],
      }
    : { role: 'user', content: userBlock }

  if (hadAssistantInThread) {
    homeAiApiMessages.push({ role: 'user', content: textRaw })
  } else {
    homeAiApiMessages = [firstUserMessage]
  }

  /** Server: én user-melding = JSON-rapport; flere = { reply } */
  const requestWasFirstShot = homeAiApiMessages.length === 1

  if (statusEl) statusEl.textContent = 'VeiAi tenker …'
  if (sendBtn) sendBtn.disabled = true
  startHomeAiThinkingUx()
  try {
    let r = await fetch(apiUrl('/api/analyze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: homeAiApiMessages }),
    })
    let data = /** @type {Record<string, unknown>} */ ({})
    const ct = r.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      data = await r.json().catch(() => ({}))
    } else {
      await r.text().catch(() => '')
    }

    if (!r.ok && requestWasFirstShot) {
      homeAiApiMessages = []
      const legacyBody = hasImage
        ? { image: homeAiCapturedDataUrl, text: String(textForApi) }
        : { text: String(textForApi) }
      r = await fetch(apiUrl('/api/analyze'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(legacyBody),
      })
      const ct2 = r.headers.get('content-type') || ''
      if (ct2.includes('application/json')) {
        data = await r.json().catch(() => ({}))
      } else {
        await r.text().catch(() => '')
      }
      if (!r.ok) {
        const fromApi =
          data && typeof data.error === 'string' ? data.error : null
        const hint404 = r.status === 404 ? hintApiNotFound() : ''
        throw new Error(
          fromApi ||
            (r.status === 404
              ? `Fant ikke API (404).${hint404}`
              : `Feil ${r.status}`),
        )
      }
      homeAiApiMessages = [
        firstUserMessage,
        { role: 'assistant', content: JSON.stringify(data) },
      ]
      stopHomeAiThinkingUx()
      appendHomeAiChatBubble(
        'assistant',
        renderHomeAiStructuredHtml(
          /** @type {{ problem?: unknown, risk?: unknown, action?: unknown, explanation?: unknown, report?: unknown }} */ (
            data
          ),
        ),
        { appearIn: true },
      )
      if (statusEl) statusEl.textContent = 'Ferdig.'
      return
    }

    /**
     * Oppfølging via { messages } feiler ofte på eldre deploy / modellgrenser.
     * Fallback: samme legacy-endepunkt som første analyse, med [Oppfølging] + bilde.
     */
    if (!requestWasFirstShot) {
      const extracted = extractHomeAiFollowupReply(
        /** @type {Record<string, unknown>} */ (data),
      )
      if (!r.ok || !extracted.trim()) {
        homeAiApiMessages.pop()
        const legacyFollowBody = hasImage
          ? {
              image: homeAiCapturedDataUrl,
              text: `[Oppfølging] ${textRaw}`,
            }
          : { text: `[Oppfølging] ${textRaw}` }
        r = await fetch(apiUrl('/api/analyze'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(legacyFollowBody),
        })
        const ctF = r.headers.get('content-type') || ''
        if (ctF.includes('application/json')) {
          data = await r.json().catch(() => ({}))
        } else {
          await r.text().catch(() => '')
        }
        if (!r.ok) {
          const fromApi =
            data && typeof data.error === 'string' ? data.error : null
          const hint404 = r.status === 404 ? hintApiNotFound() : ''
          throw new Error(
            fromApi ||
              (r.status === 404
                ? `Fant ikke API (404).${hint404}`
                : `Feil ${r.status}`),
          )
        }
        homeAiApiMessages.push({ role: 'user', content: textRaw })
        homeAiApiMessages.push({
          role: 'assistant',
          content: JSON.stringify(data),
        })
        stopHomeAiThinkingUx()
        appendHomeAiChatBubble(
          'assistant',
          renderHomeAiStructuredHtml(
            /** @type {{ problem?: unknown, risk?: unknown, action?: unknown, explanation?: unknown, report?: unknown }} */ (
              data
            ),
          ),
          { appearIn: true },
        )
        if (statusEl) statusEl.textContent = 'Ferdig.'
        return
      }
    }

    if (!r.ok) {
      const fromApi =
        data && typeof data.error === 'string' ? data.error : null
      const hint404 = r.status === 404 ? hintApiNotFound() : ''
      throw new Error(
        fromApi ||
          (r.status === 404
            ? `Fant ikke API (404).${hint404}`
            : `Feil ${r.status}`),
      )
    }

    if (
      data &&
      typeof data === 'object' &&
      typeof data.error === 'string' &&
      data.error.trim() &&
      data.reply == null &&
      data.problem == null
    ) {
      throw new Error(data.error)
    }

    if (requestWasFirstShot) {
      homeAiApiMessages.push({
        role: 'assistant',
        content: JSON.stringify(data),
      })
      stopHomeAiThinkingUx()
      appendHomeAiChatBubble(
        'assistant',
        renderHomeAiStructuredHtml(
          /** @type {{ problem?: unknown, risk?: unknown, action?: unknown, explanation?: unknown, report?: unknown }} */ (
            data
          ),
        ),
        { appearIn: true },
      )
    } else {
      let reply = extractHomeAiFollowupReply(
        /** @type {Record<string, unknown>} */ (data),
      )
      if (!reply.trim()) {
        reply =
          'Ingen tekst i AI-svaret. Prøv å omformulere spørsmålet, eller send på nytt.'
      }
      homeAiApiMessages.push({ role: 'assistant', content: reply })
      stopHomeAiThinkingUx()
      await appendHomeAiAssistantPlainTextStreamed(reply)
    }
    if (statusEl) statusEl.textContent = 'Ferdig.'
  } catch (e) {
    const last = homeAiApiMessages[homeAiApiMessages.length - 1]
    if (last && last.role === 'user') {
      homeAiApiMessages.pop()
    }
    if (statusEl) {
      statusEl.textContent =
        e && typeof e === 'object' && 'message' in e
          ? String(/** @type {{ message: string }} */ (e).message)
          : 'Noe gikk galt.'
    }
    const log = document.getElementById('home-ai-chat-log')
    if (log?.lastElementChild) log.removeChild(log.lastElementChild)
    if (input) input.value = textRaw
  } finally {
    stopHomeAiThinkingUx()
    if (sendBtn) sendBtn.disabled = false
  }
}

function bindHomeAiDocumentationListeners(signal) {
  document.getElementById('btn-home-ai-capture')?.addEventListener(
    'click',
    () => {
      const dataUrl = captureHomeAiFrameToDataUrl()
      if (!dataUrl) {
        const st = document.getElementById('home-ai-status')
        if (st) st.textContent = 'Vent til kameraet viser bildet, og prøv igjen.'
        return
      }
      enterHomeAiChatWithImage(dataUrl)
    },
    { signal },
  )

  document.getElementById('btn-home-ai-pick-file')?.addEventListener(
    'click',
    () => document.getElementById('home-ai-image-fallback')?.click(),
    { signal },
  )

  document.getElementById('btn-home-ai-pick-file-chat')?.addEventListener(
    'click',
    () => document.getElementById('home-ai-image-fallback')?.click(),
    { signal },
  )

  document.getElementById('btn-home-ai-open-camera')?.addEventListener(
    'click',
    () => openHomeAiCameraStage(),
    { signal },
  )

  document.getElementById('btn-home-ai-back-to-chat')?.addEventListener(
    'click',
    () => backHomeAiChatFromCamera(),
    { signal },
  )

  document.getElementById('btn-home-ai-close-fs')?.addEventListener(
    'click',
    () => {
      stopHomeAiCamera()
      setHomeBildeSubTab('camera')
    },
    { signal },
  )

  document.getElementById('home-ai-image-fallback')?.addEventListener(
    'change',
    async (ev) => {
      const t = /** @type {HTMLInputElement} */ (ev.target)
      const file = t.files?.[0]
      if (!file || !file.type.startsWith('image/')) return
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(typeof r.result === 'string' ? r.result : '')
        r.onerror = () => reject(new Error('Fil'))
        r.readAsDataURL(file)
      }).catch(() => '')
      if (dataUrl) enterHomeAiChatWithImage(dataUrl)
      t.value = ''
    },
    { signal },
  )

  document.getElementById('btn-home-ai-pdf')?.addEventListener(
    'click',
    () => openHomeAiPdfDialog(),
    { signal },
  )

  document.getElementById('btn-home-ai-contract-rag')?.addEventListener(
    'click',
    () => {
      setHomeAiContractRagEnabled(!homeAiContractRagMode)
      document.getElementById('home-ai-chat-input')?.focus()
    },
    { signal },
  )

  syncHomeAiModeHint(false)

  bindHomeAiPanelVisualViewport(signal)
  updateHomeAiPanelVisualViewport()

  document.getElementById('btn-home-ai-pdf-exit')?.addEventListener(
    'click',
    () => exitHomeAiFromPdfDialog(),
    { signal },
  )

  document.getElementById('btn-home-ai-pdf-save')?.addEventListener(
    'click',
    () => void saveHomeAiPdfToDevice(),
    { signal },
  )

  document.getElementById('btn-home-ai-send')?.addEventListener(
    'click',
    () => void sendHomeAiChatMessage(),
    { signal },
  )

  const homeAiChatInput = document.getElementById('home-ai-chat-input')
  homeAiChatInput?.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key !== 'Enter' || ev.shiftKey) return
      ev.preventDefault()
      void sendHomeAiChatMessage()
    },
    { signal },
  )
  homeAiChatInput?.addEventListener(
    'focusin',
    () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => updateHomeAiPanelVisualViewport())
      })
    },
    { signal },
  )
}

function bindInboxListeners() {
  if (inboxAbort) inboxAbort.abort()
  inboxAbort = new AbortController()
  const { signal } = inboxAbort
  document
    .getElementById('btn-back-from-inbox')
    ?.addEventListener('click', () => goHome(), { signal })
  const incomingList = document.getElementById('incoming-shares-list')
  incomingList?.addEventListener(
    'click',
    async (ev) => {
      const openBtn = ev.target.closest('[data-open-share]')
      const dis = ev.target.closest('[data-dismiss-share]')
      const sb = getSupabase()
      const st = document.getElementById('incoming-shares-status')
      if (!sb || !currentUser) return
      if (openBtn) {
        const id = openBtn.getAttribute('data-open-share')
        if (!id) return
        await openIncomingSharePreview(id)
        return
      }
      if (dis) {
        const id = dis.getAttribute('data-dismiss-share')
        if (!id) return
        try {
          await deleteSessionShareRow(sb, id)
          incomingSharePayloadCache.delete(id)
          if (st) st.textContent = ''
          void refreshIncomingSharesPanel()
        } catch {
          if (st) st.textContent = 'Kunne ikke fjerne.'
        }
      }
    },
    { signal },
  )
  setupSessionShareInbox()
}

function setMenuSessionTab(tab) {
  menuSessionTab = tab
  renderApp()
  bindMenuSessionListeners()
}

function bindMenuSessionListeners() {
  if (menuSessionAbort) menuSessionAbort.abort()
  menuSessionAbort = new AbortController()
  const { signal } = menuSessionAbort
  document
    .getElementById('btn-back-from-menu-session')
    ?.addEventListener('click', () => goHome(), { signal })
  document.querySelectorAll('[data-menu-session-tab]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const t = btn.getAttribute('data-menu-session-tab')
        if (
          t === 'sessions' ||
          t === 'resume' ||
          t === 'download' ||
          t === 'import'
        ) {
          setMenuSessionTab(t)
        }
      },
      { signal },
    )
  })
  document.querySelectorAll('[data-resume-id]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const id = btn.getAttribute('data-resume-id')
        if (id) resumeSession(id)
      },
      { signal },
    )
  })
  document.querySelectorAll('[data-delete-session-id]').forEach((btn) => {
    btn.addEventListener(
      'click',
      (ev) => {
        ev.stopPropagation()
        const id = btn.getAttribute('data-delete-session-id')
        if (id) deleteStoredSession(id)
      },
      { signal },
    )
  })
  document.querySelectorAll('[data-download-id]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const id = btn.getAttribute('data-download-id')
        if (id) downloadSessionExport(id)
      },
      { signal },
    )
  })
  const importInput = document.getElementById('menu-import-session-input')
  document.getElementById('btn-menu-import-pick')?.addEventListener(
    'click',
    () => importInput?.click(),
    { signal },
  )
  importInput?.addEventListener(
    'change',
    async (ev) => {
      const input = ev.target
      const file = input.files?.[0]
      input.value = ''
      const st = document.getElementById('menu-import-status')
      if (!file) return
      if (st) st.textContent = 'Leser fil …'
      try {
        const text = await file.text()
        const res = importSessionFromExportHtml(text)
        if (!res.ok) {
          if (st) st.textContent = res.message
          return
        }
        if (st) st.textContent = 'Økt importert. Åpner den …'
        resumeSession(res.sessionId)
      } catch {
        if (st) st.textContent = 'Kunne ikke lese fila. Prøv igjen.'
      }
    },
    { signal },
  )
}

function bindMenuUserListeners() {
  if (menuUserAbort) menuUserAbort.abort()
  menuUserAbort = new AbortController()
  const { signal } = menuUserAbort
  document
    .getElementById('btn-back-from-menu-user')
    ?.addEventListener('click', () => goHome(), { signal })
}

function bindMenuMapListeners() {
  if (menuMapAbort) menuMapAbort.abort()
  menuMapAbort = new AbortController()
  const { signal } = menuMapAbort
  document
    .getElementById('btn-back-from-menu-map')
    ?.addEventListener('click', () => goHome(), { signal })
}

function bindMenuContactsListeners() {
  if (menuContactsAbort) menuContactsAbort.abort()
  menuContactsAbort = new AbortController()
  const { signal } = menuContactsAbort
  document
    .getElementById('btn-back-from-menu-contacts')
    ?.addEventListener('click', () => goHome(), { signal })
}

function bindMenuInfoListeners() {
  if (menuInfoAbort) menuInfoAbort.abort()
  menuInfoAbort = new AbortController()
  const { signal } = menuInfoAbort
  document
    .getElementById('btn-back-from-menu-settings')
    ?.addEventListener('click', () => goHome(), { signal })
  document
    .getElementById('btn-back-from-menu-privacy')
    ?.addEventListener('click', () => goHome(), { signal })
  document
    .getElementById('btn-back-from-menu-support')
    ?.addEventListener('click', () => goHome(), { signal })
}

async function logoutUser() {
  vegrefResetSessionCache()
  teardownSessionShareInbox()
  previewIncomingShareId = null
  lastIncomingShareCountForNotify = null
  syncInboxIndicators(0, { forceHide: true })
  flushCurrentSession()
  saveAppState()
  const sbOut = getSupabase()
  cancelSupabaseAppStatePush()
  if (sbOut && currentUser?.id) {
    await upsertUserAppState(sbOut, currentUser.id, {
      version: 2,
      sessions,
      currentSessionId,
    })
  }
  if (sbOut) {
    ignoreNextSupabaseSignedOut = true
    await sbOut.auth.signOut()
    queueMicrotask(() => {
      if (ignoreNextSupabaseSignedOut) ignoreNextSupabaseSignedOut = false
    })
  }
  destroyMap()
  currentSessionId = null
  state = defaultState()
  sessions = []
  standalonePhotos = []
  currentUser = null
  clearAuthSession()
  void backupAuthToIdb(loadUsersFromStorage(), null)
  authScreen = 'login'
  view = 'auth'
  renderApp()
  bindAuthListeners()
}

function navigateHomeClearSession() {
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'home'
  saveAppState()
  renderApp()
  bindHomeListeners()
}

function goHome() {
  navigateHomeClearSession()
}

function finalizeSessionAndGoHome(rawTitle, rawRegisteredNote) {
  flushCurrentSession()
  if (currentSessionId) {
    const idx = sessions.findIndex((s) => s.id === currentSessionId)
    if (idx !== -1) {
      const t =
        typeof rawTitle === 'string'
          ? rawTitle.trim().slice(0, SESSION_TITLE_MAX_LEN)
          : ''
      const n =
        typeof rawRegisteredNote === 'string'
          ? rawRegisteredNote.trim().slice(0, SESSION_REGISTERED_NOTE_MAX_LEN)
          : ''
      sessions[idx] = normalizeSession({
        ...sessions[idx],
        title: t || null,
        registeredNote: n || null,
      })
    }
  }
  navigateHomeClearSession()
}

/**
 * @returns {Promise<'save' | 'discard' | 'cancel'>}
 */
function showIncomingShareSaveDialog() {
  return new Promise((resolve) => {
    const dlg = document.getElementById('incoming-share-save-dialog')
    if (!dlg || !(dlg instanceof HTMLDialogElement)) {
      resolve('cancel')
      return
    }
    const onClose = () => {
      dlg.removeEventListener('close', onClose)
      const rv = dlg.returnValue
      if (rv === 'save') resolve('save')
      else if (rv === 'discard') resolve('discard')
      else resolve('cancel')
    }
    dlg.addEventListener('close', onClose)
    dlg.showModal()
  })
}

/**
 * @param {{ pendingTitle?: string }} [opts]
 * @returns {Promise<'cancel' | 'done'>}
 */
async function resolveIncomingSharePreviewLeaving(opts = {}) {
  const { pendingTitle, pendingRegisteredNote } = opts
  flushCurrentSession()
  const choice = await showIncomingShareSaveDialog()
  if (choice === 'cancel') return 'cancel'
  const sid = currentSessionId
  const shareRow = previewIncomingShareId
  previewIncomingShareId = null
  const sb = getSupabase()
  if (choice === 'save') {
    if (typeof pendingTitle === 'string' && sid) {
      const idx = sessions.findIndex((s) => s.id === sid)
      if (idx !== -1) {
        const t = pendingTitle.trim().slice(0, SESSION_TITLE_MAX_LEN)
        const n =
          typeof pendingRegisteredNote === 'string'
            ? pendingRegisteredNote.trim().slice(
                0,
                SESSION_REGISTERED_NOTE_MAX_LEN,
              )
            : ''
        sessions[idx] = normalizeSession({
          ...sessions[idx],
          title: t || null,
          registeredNote: n || null,
        })
      }
    }
    if (sb && shareRow) {
      try {
        await deleteSessionShareRow(sb, shareRow)
      } catch {
        /* rad kan allerede være borte */
      }
    }
    if (shareRow) incomingSharePayloadCache.delete(shareRow)
    saveAppState()
    void refreshIncomingSharesPanel()
    return 'done'
  }
  if (sid) {
    const idx = sessions.findIndex((s) => s.id === sid)
    if (idx !== -1) sessions.splice(idx, 1)
  }
  saveAppState()
  void refreshIncomingSharesPanel()
  return 'done'
}

function openInboxView() {
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'inbox'
  saveAppState()
  renderApp()
  bindInboxListeners()
}

/**
 * @param {unknown} payload
 */
function isPhotoOnlyIncomingSharePayload(payload) {
  const p = payload && typeof payload === 'object' ? payload : {}
  const photosArr = Array.isArray(/** @type {{ photos?: unknown }} */ (p).photos)
    ? /** @type {{ photos?: unknown[] }} */ (p).photos
    : []
  const clicksArr = Array.isArray(
    /** @type {{ clickHistory?: unknown }} */ (p).clickHistory,
  )
    ? /** @type {{ clickHistory?: unknown[] }} */ (p).clickHistory
    : []
  if (/** @type {{ shareKind?: string }} */ (p).shareKind === 'standalonePhotos') {
    return true
  }
  return photosArr.length > 0 && clicksArr.length === 0
}

function renderReceivedPhotosHtml() {
  return `<div class="view-received-photos" aria-label="Mottatte bilder">
    <header class="received-photos__header">
      <button type="button" class="btn btn-text received-photos__back" id="btn-received-photos-back" aria-label="Tilbake">←</button>
      <h1 class="received-photos__title">Mottatte bilder</h1>
    </header>
    <div class="received-photos__scroll">
      <div id="received-photos-feed" class="received-photos__feed"></div>
    </div>
    <button type="button" class="received-photos__map-tab" id="btn-received-photos-open-map" aria-label="Åpne kart i fullskjerm">Kart</button>
    <dialog id="received-photo-lightbox" class="received-photo-lightbox">
      <div class="received-photo-lightbox__inner">
        <button type="button" class="received-photo-lightbox__close" id="btn-received-photo-lightbox-close" aria-label="Lukk">×</button>
        <div class="received-photo-zoom-host photo-zoom-host" id="received-photo-zoom-host">
          <div class="photo-zoom-pan" id="received-photo-zoom-pan">
            <img id="received-photo-lightbox-img" class="received-photo-lightbox__img" alt="" draggable="false" />
          </div>
        </div>
      </div>
    </dialog>
    <dialog id="received-photos-map-dialog" class="received-photos-map-dialog" aria-label="Kart">
      <div class="received-photos-map-dialog__bar">
        <form method="dialog" class="received-photos-map-dialog__close-form">
          <button type="submit" class="btn btn-text received-photos-map-dialog__close" id="btn-received-photos-map-close" aria-label="Lukk kart">Lukk</button>
        </form>
      </div>
      <div class="received-photos-map-dialog__body">
        <div id="received-photos-map" class="received-photos-map received-photos-map--dialog"></div>
        <p id="received-photos-map-empty" class="received-photos-map-empty received-photos-map-empty--dialog" hidden>Ingen av bildene har GPS-posisjon – kart kan ikke vises. Trykk <strong>Lukk</strong> for å gå tilbake til bildene.</p>
      </div>
    </dialog>
  </div>`
}

const RECEIVED_PHOTOS_FEED_CHUNK = 5

function renderReceivedPhotosFeed() {
  const el = document.getElementById('received-photos-feed')
  if (!el) return
  const photos = Array.isArray(state.photos) ? state.photos : []
  if (!photos.length) {
    el.innerHTML =
      '<p class="received-photos__empty">Ingen bilder i delingen.</p>'
    return
  }
  el.innerHTML = ''
  let idx = 0
  const appendChunk = () => {
    const end = Math.min(idx + RECEIVED_PHOTOS_FEED_CHUNK, photos.length)
    const frag = document.createDocumentFragment()
    for (let i = idx; i < end; i++) {
      const ph = photos[i]
      if (!ph?.dataUrl) continue
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'received-photos__shot'
      btn.setAttribute('data-received-thumb-index', String(i))
      btn.setAttribute('aria-label', `Vis bilde ${i + 1} i fullskjerm`)
      const img = document.createElement('img')
      img.src = ph.dataUrl
      img.alt = ''
      img.className = 'received-photos__shot-img'
      img.loading = i < 8 ? 'eager' : 'lazy'
      img.decoding = 'async'
      btn.appendChild(img)
      frag.appendChild(btn)
    }
    el.appendChild(frag)
    idx = end
    if (idx < photos.length) {
      requestAnimationFrame(appendChunk)
    }
  }
  requestAnimationFrame(appendChunk)
}

function receivedPhotoMapPinIcon() {
  return Leaflet.divIcon({
    className: 'received-photos-pin',
    html: '<div class="received-photos-pin__shape" aria-hidden="true"></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28],
  })
}

async function ensureReceivedPhotosMap() {
  const wrap = document.getElementById('received-photos-map')
  const emptyEl = document.getElementById('received-photos-map-empty')
  if (!wrap) return
  const photos = Array.isArray(state.photos) ? state.photos : []
  const withLoc = photos.filter(
    (p) =>
      p &&
      p.lat != null &&
      p.lng != null &&
      !Number.isNaN(Number(p.lat)) &&
      !Number.isNaN(Number(p.lng)),
  )
  if (!withLoc.length) {
    destroyReceivedPhotosMap()
    if (emptyEl) emptyEl.hidden = false
    wrap.style.display = 'none'
    return
  }
  if (emptyEl) emptyEl.hidden = true
  wrap.style.display = ''
  if (!receivedPhotosMap) {
    await ensureLeaflet()
    receivedPhotosMap = Leaflet.map('received-photos-map', {
      zoomControl: true,
    }).setView([Number(withLoc[0].lat), Number(withLoc[0].lng)], 14)
    Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap-bidragsytere',
      maxZoom: 19,
    }).addTo(receivedPhotosMap)
    const bounds = Leaflet.latLngBounds([])
    withLoc.forEach((ph, i) => {
      const lat = Number(ph.lat)
      const lng = Number(ph.lng)
      bounds.extend([lat, lng])
      const m = Leaflet.marker([lat, lng], {
        icon: receivedPhotoMapPinIcon(),
      }).addTo(receivedPhotosMap)
      const t = ph.timestamp
        ? new Intl.DateTimeFormat('nb-NO', {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date(ph.timestamp))
        : ''
      const safeT = escapeHtml(t)
      m.bindPopup(
        `<div class="received-photos-map-popup"><strong>Bilde ${i + 1}</strong>${t ? `<br/>${safeT}` : ''}<br/><img src="${ph.dataUrl}" alt="" class="received-photos-map-popup__img" loading="lazy" decoding="async"/></div>`,
        { maxWidth: 280 },
      )
    })
    if (bounds.isValid()) {
      receivedPhotosMap.fitBounds(bounds, { padding: [44, 44], maxZoom: 16 })
    }
  }
  queueMicrotask(() => receivedPhotosMap?.invalidateSize())
  setTimeout(() => receivedPhotosMap?.invalidateSize(), 280)
}

function openReceivedPhotosMapFullscreen() {
  const dlg = document.getElementById('received-photos-map-dialog')
  if (!(dlg instanceof HTMLDialogElement)) return
  dlg.showModal()
  queueMicrotask(() => {
    void ensureReceivedPhotosMap().then(() => {
      receivedPhotosMap?.invalidateSize()
    })
  })
  setTimeout(() => receivedPhotosMap?.invalidateSize(), 400)
}

function bindReceivedPhotosListeners() {
  if (receivedPhotosAbort) receivedPhotosAbort.abort()
  receivedPhotosAbort = new AbortController()
  const { signal } = receivedPhotosAbort

  document.getElementById('btn-received-photos-back')?.addEventListener(
    'click',
    () => {
      void (async () => {
        if (previewIncomingShareId) {
          const r = await resolveIncomingSharePreviewLeaving({})
          if (r === 'cancel') return
        }
        navigateHomeClearSession()
      })()
    },
    { signal },
  )

  const mapDlg = document.getElementById('received-photos-map-dialog')
  document.getElementById('btn-received-photos-open-map')?.addEventListener(
    'click',
    () => openReceivedPhotosMapFullscreen(),
    { signal },
  )
  mapDlg?.addEventListener(
    'close',
    () => {
      destroyReceivedPhotosMap()
    },
    { signal },
  )

  const lb = document.getElementById('received-photo-lightbox')
  const lbImg = document.getElementById('received-photo-lightbox-img')
  const lbHost = document.getElementById('received-photo-zoom-host')
  const lbPan = document.getElementById('received-photo-zoom-pan')
  if (lbHost instanceof HTMLElement && lbPan instanceof HTMLElement) {
    receivedLightboxPinchControls = attachImagePinchZoom(lbHost, lbPan, {
      signal,
    })
  }
  document.getElementById('received-photos-feed')?.addEventListener(
    'click',
    (ev) => {
      const btn = ev.target.closest('[data-received-thumb-index]')
      if (!btn || !(btn instanceof HTMLElement)) return
      const idx = parseInt(btn.getAttribute('data-received-thumb-index') ?? '', 10)
      const photos = Array.isArray(state.photos) ? state.photos : []
      const ph = photos[idx]
      if (!ph?.dataUrl || !lb || !lbImg || !(lb instanceof HTMLDialogElement)) return
      receivedLightboxPinchControls?.reset()
      lbImg.src = ph.dataUrl
      setViewportAllowImageZoom(true)
      lb.showModal()
    },
    { signal },
  )
  document.getElementById('btn-received-photo-lightbox-close')?.addEventListener(
    'click',
    () => {
      if (lb instanceof HTMLDialogElement) lb.close()
    },
    { signal },
  )
  lb?.addEventListener(
    'click',
    (ev) => {
      if (ev.target === lb && lb instanceof HTMLDialogElement) lb.close()
    },
    { signal },
  )
  lb?.addEventListener(
    'close',
    () => {
      if (lbImg) lbImg.src = ''
      receivedLightboxPinchControls?.reset()
      setViewportAllowImageZoom(false)
    },
    { signal },
  )

  renderReceivedPhotosFeed()
}

/**
 * @param {string} shareRowId
 */
async function openIncomingSharePreview(shareRowId) {
  const sb = getSupabase()
  const st = document.getElementById('incoming-shares-status')
  if (!sb || !currentUser) {
    if (st) st.textContent = 'Du må være innlogget.'
    return
  }
  let payload = incomingSharePayloadCache.get(shareRowId)
  if (!payload) {
    if (st) st.textContent = 'Laster økt …'
    const { data, error } = await sb
      .from('session_shares')
      .select('session_payload')
      .eq('id', shareRowId)
      .maybeSingle()
    if (error || !data?.session_payload) {
      if (st) st.textContent = 'Kunne ikke laste økt.'
      return
    }
    payload = data.session_payload
    incomingSharePayloadCache.set(shareRowId, payload)
    if (st) st.textContent = ''
  }
  const session = buildSessionFromSharePayload(
    payload && typeof payload === 'object'
      ? /** @type {object} */ (payload)
      : {},
  )
  if (!session) {
    if (st) st.textContent = 'Ugyldig øktdata.'
    return
  }
  sessions.push(session)
  previewIncomingShareId = shareRowId
  currentSessionId = session.id
  state = loadCurrentSessionState()
  const finishPersistAndBadge = () => {
    saveAppState()
    markIncomingShareSeen(shareRowId)
  }
  if (isPhotoOnlyIncomingSharePayload(payload)) {
    destroyReceivedPhotosMap()
    view = 'receivedPhotos'
    renderApp()
    bindReceivedPhotosListeners()
    requestAnimationFrame(() => {
      requestAnimationFrame(finishPersistAndBadge)
    })
    return
  }
  view = 'session'
  renderApp()
  void initSessionMapAndWatch()
  bindSessionListeners()
  requestAnimationFrame(() => {
    requestAnimationFrame(finishPersistAndBadge)
  })
}

function startNewSessionFromHome() {
  commitNewSessionWithCategories(null, [])
}

/**
 * @param {'hoyre' | 'venstre' | 'begge' | null} roadSide
 * @param {string[]} categoryIds
 * @param {{ openKmtAfter?: boolean }} [opts]
 */
function commitNewSessionWithCategories(roadSide, categoryIds, opts = {}) {
  const objectCategories = normalizeObjectCategoryList(categoryIds)
  flushCurrentSession()
  const activeCategoryId = objectCategories[0] ?? null
  const s = normalizeSession({
    id: crypto.randomUUID(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    count: 0,
    clickHistory: [],
    log: [],
    roadSide,
    objectCategories,
    activeCategoryId,
  })
  sessions.push(s)
  currentSessionId = s.id
  state = {
    ...defaultState(),
    roadSide,
    objectCategories,
    activeCategoryId,
  }
  const catLabels = objectCategories.map(getObjectCategoryLabel).join(', ')
  const roadPart = formatRoadSideLabel(roadSide)
  let startMsg = 'Start'
  if (roadPart && catLabels) startMsg = `Start · ${roadPart} · Objekter: ${catLabels}`
  else if (roadPart) startMsg = `Start · ${roadPart}`
  else if (catLabels) startMsg = `Start · Objekter: ${catLabels}`
  addLogEntry(state, { message: startMsg })
  saveAppState()
  view = 'session'
  renderApp()
  void initSessionMapAndWatch()
  bindSessionListeners()
  if (opts.openKmtAfter === true) {
    queueMicrotask(() => void openKmtDialog())
  }
}

function openTaBildeFromHome() {
  kmtStandaloneFlow = true
  void openKmtDialog()
}

function deleteStoredSession(id) {
  const idx = sessions.findIndex((s) => s.id === id)
  if (idx === -1) return
  const sess = sessions[idx]
  const name = formatSessionDisplayTitle(sess)
  if (
    !window.confirm(
      `Slette økten «${name}»? All data for denne økten fjernes permanent.`,
    )
  ) {
    return
  }
  sessions.splice(idx, 1)
  if (currentSessionId === id) {
    currentSessionId = null
    state = defaultState()
    destroyMap()
  }
  saveAppState()
  renderApp()
  if (view === 'menuSession') bindMenuSessionListeners()
  else if (view === 'inbox') bindInboxListeners()
  else if (view === 'home') bindHomeListeners()
}

function resumeSession(id) {
  flushCurrentSession()
  currentSessionId = id
  state = loadCurrentSessionState()
  saveAppState()
  view = 'session'
  renderApp()
  void initSessionMapAndWatch()
  bindSessionListeners()
}

async function downloadSessionExport(sessionId) {
  const s = sessions.find((x) => x.id === sessionId)
  if (!s) return
  const html = await buildScanixExportHtml(
    s.clickHistory,
    s.log,
    s.roadSide,
    s.photos,
    s.title,
    s.objectCategories,
    s.registeredNote ?? null,
  )
  const filename = `scanix-økt-${s.createdAt.slice(0, 19).replace(/:/g, '-')}.html`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const file = new File([blob], filename, { type: 'text/html' })

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Scanix-økt',
        text: 'Eksportert økt fra Scanix',
      })
      return
    } catch (err) {
      if (err.name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function loadContacts() {
  if (!currentUser?.id) return []
  try {
    const raw = localStorage.getItem(
      contactsStorageKeyForUser(currentUser.id),
    )
    if (!raw) return []
    const p = JSON.parse(raw)
    if (!Array.isArray(p.contacts)) return []
    return p.contacts.filter(
      (c) =>
        c &&
        typeof c === 'object' &&
        isValidStoredShortId(
          /** @type {{ shortId?: string }} */ (c).shortId,
        ),
    )
  } catch {
    return []
  }
}

function saveContacts(contacts) {
  if (!currentUser?.id) return false
  try {
    localStorage.setItem(
      contactsStorageKeyForUser(currentUser.id),
      JSON.stringify({ version: 1, contacts }),
    )
    return true
  } catch {
    return false
  }
}

/**
 * @param {string} shortId
 * @param {string} label
 */
function upsertContactByShortId(shortId, label) {
  const trimmed =
    typeof label === 'string' && label.trim()
      ? label.trim().slice(0, AUTH_NAME_MAX_LEN)
      : ''
  const rest = loadContacts().filter((c) => c.shortId !== shortId)
  rest.push({
    shortId,
    label: trimmed,
    addedAt: nowIso(),
  })
  rest.sort((a, b) => a.shortId.localeCompare(b.shortId, 'nb'))
  return saveContacts(rest)
}

function parseScanixExportDataFromHtml(html) {
  if (typeof html !== 'string') return null
  const m = html.match(
    /<script\s+type="application\/json"\s+id="scanix-data">\s*([\s\S]*?)\s*<\/script>/i,
  )
  if (!m) return null
  try {
    const data = JSON.parse(m[1])
    if (!data || typeof data !== 'object') return null
    return data
  } catch {
    return null
  }
}

/**
 * @param {string} html
 * @returns {{ ok: true, sessionId: string } | { ok: false, message: string }}
 */
function importSessionFromExportHtml(html) {
  const data = parseScanixExportDataFromHtml(html)
  if (!data) {
    return {
      ok: false,
      message:
        'Kjenner ikke igjen fila. Velg en Scanix-eksport (HTML) med kart og logg.',
    }
  }
  const points = Array.isArray(data.points) ? data.points : []
  const rawLog = Array.isArray(data.log) ? data.log : []
  const photos = Array.isArray(data.photos) ? data.photos : []
  const log = rawLog.map((e) => {
    if (!e || typeof e !== 'object') {
      return { id: crypto.randomUUID(), timestamp: nowIso(), message: '' }
    }
    return {
      id: typeof e.id === 'string' ? e.id : crypto.randomUUID(),
      timestamp:
        typeof e.timestamp === 'string' ? e.timestamp : nowIso(),
      message:
        typeof e.message === 'string' ? e.message : String(e.message ?? ''),
    }
  })
  const catSet = new Set()
  for (const p of points) {
    if (p && typeof p === 'object' && typeof p.category === 'string') {
      catSet.add(p.category)
    }
  }
  const objectCategories = normalizeObjectCategoryList([...catSet])
  let activeCategoryId = null
  if (objectCategories.length === 1) activeCategoryId = objectCategories[0]
  else if (objectCategories.length > 1) activeCategoryId = objectCategories[0]
  const session = normalizeSession({
    id: crypto.randomUUID(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    title: 'Importert økt',
    count: points.length,
    clickHistory: points,
    log,
    roadSide: null,
    photos,
    objectCategories,
    activeCategoryId,
  })
  if (!session) {
    return { ok: false, message: 'Kunne ikke lese øktdata.' }
  }
  sessions.push(session)
  saveAppState()
  return { ok: true, sessionId: session.id }
}

/**
 * @param {object} sess
 */
function sessionToSharePayload(sess) {
  if (!sess || typeof sess !== 'object') return null
  return {
    id: sess.id,
    createdAt: sess.createdAt,
    updatedAt: sess.updatedAt,
    title: sess.title ?? null,
    registeredNote: sess.registeredNote ?? null,
    count: sess.count,
    clickHistory: Array.isArray(sess.clickHistory) ? sess.clickHistory : [],
    log: Array.isArray(sess.log) ? sess.log : [],
    roadSide: sess.roadSide ?? null,
    photos: Array.isArray(sess.photos) ? sess.photos : [],
    objectCategories: Array.isArray(sess.objectCategories)
      ? sess.objectCategories
      : [],
    activeCategoryId: sess.activeCategoryId ?? null,
  }
}

/**
 * @param {object} payload
 * @returns {ReturnType<typeof normalizeSession> | null}
 */
function buildSessionFromSharePayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  const photos = Array.isArray(payload.photos)
    ? payload.photos.map(normalizePhoto).filter(Boolean)
    : []
  return normalizeSession({
    ...payload,
    id: crypto.randomUUID(),
    createdAt:
      typeof payload.createdAt === 'string' ? payload.createdAt : nowIso(),
    updatedAt: nowIso(),
    photos,
    clickHistory: Array.isArray(payload.clickHistory)
      ? payload.clickHistory
      : [],
    log: Array.isArray(payload.log) ? payload.log : [],
    objectCategories: normalizeObjectCategoryList(
      Array.isArray(payload.objectCategories) ? payload.objectCategories : [],
    ),
  })
}

/**
 * @param {object} payload
 * @returns {{ ok: true, sessionId: string } | { ok: false, message: string }}
 */
function importSessionFromSharePayload(payload) {
  const session = buildSessionFromSharePayload(payload)
  if (!session) {
    return { ok: false, message: 'Kunne ikke lese delt økt.' }
  }
  sessions.push(session)
  saveAppState()
  return { ok: true, sessionId: session.id }
}

/** @param {import('@supabase/supabase-js').PostgrestError | Error} err */
function mapShareRpcError(err) {
  const m =
    err && typeof err.message === 'string' ? err.message : String(err ?? '')
  if (/Recipient not found/i.test(m)) {
    return 'Fant ingen bruker med den bruker-ID-en.'
  }
  if (/Cannot share to self/i.test(m)) {
    return 'Du kan ikke sende til deg selv.'
  }
  if (/Payload too large/i.test(m)) {
    return 'Innholdet er for stort til å sende (for mange bilder eller stor økt). Prøv færre bilder.'
  }
  if (/Invalid recipient id/i.test(m)) {
    return 'Ugyldig bruker-ID.'
  }
  if (/Sender profile missing/i.test(m)) {
    return 'Profilen din er ikke klar. Logg ut og inn igjen, og prøv på nytt.'
  }
  if (/Not authenticated/i.test(m)) {
    return 'Du må være innlogget.'
  }
  return 'Kunne ikke sende økt. Prøv igjen.'
}

function teardownSessionShareInbox() {
  incomingSharePayloadCache.clear()
  if (sessionSharePollId != null) {
    clearInterval(sessionSharePollId)
    sessionSharePollId = null
  }
  const sb = getSupabase()
  if (sessionShareChannel && sb) {
    void sb.removeChannel(sessionShareChannel)
    sessionShareChannel = null
  }
}

/**
 * Oppdaterer innboks-knapp + badge i header/forside. Kaller animasjon ved økning i antall (etter første lasting).
 * @param {number} incomingCount
 * @param {{ forceHide?: boolean }} [opts]
 */
function syncInboxIndicators(incomingCount, opts = {}) {
  const forceHide = opts.forceHide === true
  const show =
    !forceHide && Boolean(currentUser && isSupabaseConfigured())
  const n = Math.max(0, Math.floor(incomingCount))
  const label =
    n > 0
      ? `Meldinger, ${n} ${n === 1 ? 'ny' : 'nye'}`
      : 'Meldinger'
  document.querySelectorAll('[data-inbox-trigger]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return
    btn.hidden = !show
    btn.setAttribute('aria-label', label)
  })
  document.querySelectorAll('[data-inbox-badge]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return
    if (!show || n <= 0) {
      el.hidden = true
      el.textContent = ''
    } else {
      el.hidden = false
      el.textContent = n > 99 ? '99+' : String(n)
    }
  })
  if (
    show &&
    lastIncomingShareCountForNotify !== null &&
    n > lastIncomingShareCountForNotify
  ) {
    playInboxNotifyAnimation()
    playInboxReceiveSound()
  }
  if (show) {
    lastIncomingShareCountForNotify = n
  }
}

function playInboxNotifyAnimation() {
  const wraps = document.querySelectorAll('.btn-inbox-header__wrap')
  wraps.forEach((wrap) => {
    wrap.classList.remove('btn-inbox-header__wrap--ding')
    void wrap.getBoundingClientRect()
    wrap.classList.add('btn-inbox-header__wrap--ding')
  })
  document.querySelectorAll('.home-inbox-card').forEach((card) => {
    if (!(card instanceof HTMLElement)) return
    card.classList.remove('home-inbox-card--ding')
    void card.getBoundingClientRect()
    card.classList.add('home-inbox-card--ding')
  })
  window.setTimeout(() => {
    document
      .querySelectorAll('.btn-inbox-header__wrap--ding')
      .forEach((el) => el.classList.remove('btn-inbox-header__wrap--ding'))
    document
      .querySelectorAll('.home-inbox-card--ding')
      .forEach((el) => el.classList.remove('home-inbox-card--ding'))
  }, 820)
}

function setupSessionShareInbox() {
  teardownSessionShareInbox()
  if (!isSupabaseConfigured() || !currentUser?.id) {
    syncInboxIndicators(0)
    return
  }
  void refreshIncomingSharesPanel()
  sessionSharePollId = setInterval(() => {
    if (currentUser && isSupabaseConfigured()) {
      void refreshIncomingSharesPanel()
    }
  }, 22000)
  const sb = getSupabase()
  if (sb && currentUser.id) {
    sessionShareChannel = sb
      .channel(`session-shares-inbox:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_shares',
          filter: `to_user_id=eq.${currentUser.id}`,
        },
        () => {
          void refreshIncomingSharesPanel()
        },
      )
      .subscribe()
  }
}

async function refreshIncomingSharesPanel() {
  const listEl = document.getElementById('incoming-shares-list')
  const statusEl = document.getElementById('incoming-shares-status')
  const listReady = Boolean(listEl)

  if (!isSupabaseConfigured() || !currentUser?.id) {
    syncInboxIndicators(0)
    return
  }
  const sb = getSupabase()
  if (!sb) {
    syncInboxIndicators(0)
    return
  }
  if (listReady && statusEl) statusEl.textContent = 'Henter …'
  let rows
  try {
    rows = await fetchIncomingSessionShares(sb, currentUser.id)
  } catch {
    if (statusEl) statusEl.textContent = ''
    syncInboxIndicators(0)
    return
  }
  if (statusEl) statusEl.textContent = ''

  const validRowIds = new Set(
    rows
      .filter((r) => r && typeof r === 'object' && typeof r.id === 'string')
      .map((r) => /** @type {{ id: string }} */ (r).id),
  )
  pruneSeenIncomingSharesNotInRows(validRowIds)

  incomingSharePayloadCache.clear()
  for (const r of rows) {
    const pl = r && typeof r === 'object' ? r.session_payload : null
    if (
      r &&
      typeof r === 'object' &&
      typeof r.id === 'string' &&
      pl != null &&
      typeof pl === 'object'
    ) {
      incomingSharePayloadCache.set(r.id, pl)
    }
  }
  const seen = loadSeenIncomingShareIds()
  const unreadCount = rows.filter(
    (r) =>
      r &&
      typeof r === 'object' &&
      typeof r.id === 'string' &&
      !seen.has(r.id),
  ).length
  syncInboxIndicators(unreadCount)

  if (!listReady) return

  if (!rows.length) {
    listEl.innerHTML =
      '<li class="home-incoming-empty">Ingen mottatte delinger ennå. Når noen sender økt eller bilder til bruker-ID-en din, vises det her.</li>'
    return
  }
  listEl.innerHTML = rows
    .map((r) => {
      const id = typeof r.id === 'string' ? r.id : ''
      const dateStr = r.created_at
        ? new Intl.DateTimeFormat('nb-NO', {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date(r.created_at))
        : ''
      const fromName =
        typeof r.from_display_name === 'string' && r.from_display_name.trim()
          ? escapeHtml(r.from_display_name.trim())
          : `Bruker-ID ${escapeHtml(String(r.from_short_id ?? ''))}`
      let photoN = 0
      let clickN = 0
      let shareKind = ''
      const hasSummaryCols =
        r &&
        typeof r === 'object' &&
        ('photo_count' in r || 'click_count' in r || 'share_kind' in r)
      if (hasSummaryCols) {
        photoN = Math.max(0, Math.floor(Number(r.photo_count ?? 0)))
        clickN = Math.max(0, Math.floor(Number(r.click_count ?? 0)))
        shareKind = typeof r.share_kind === 'string' ? r.share_kind : ''
      } else {
        const rawPayload =
          r && typeof r === 'object' ? r.session_payload : null
        const pObj =
          rawPayload && typeof rawPayload === 'object' ? rawPayload : {}
        const photosArr = Array.isArray(pObj.photos) ? pObj.photos : []
        const clicksArr = Array.isArray(pObj.clickHistory)
          ? pObj.clickHistory
          : []
        photoN = photosArr.length
        clickN = clicksArr.length
        shareKind =
          typeof pObj.shareKind === 'string' ? pObj.shareKind : ''
      }
      const isPhotoShare =
        shareKind === 'standalonePhotos' ||
        (photoN > 0 && clickN === 0)
      const typeHint =
        isPhotoShare && photoN > 0
          ? `<span class="home-incoming-row__kind">${escapeHtml(String(photoN))} ${photoN === 1 ? 'bilde' : 'bilder'}</span>`
          : ''
      return `<li class="home-incoming-row" data-share-row="${escapeHtml(id)}">
        <div class="home-incoming-row__meta">
          <span class="home-incoming-row__from">Fra ${fromName}</span>
          <span class="home-incoming-row__date-line"><span class="home-incoming-row__date">${escapeHtml(dateStr)}</span>${typeHint}</span>
        </div>
        <div class="home-incoming-row__actions">
          <button type="button" class="btn btn-secondary btn-incoming-import" data-open-share="${escapeHtml(id)}">Åpne</button>
          <button type="button" class="btn btn-text btn-incoming-dismiss" data-dismiss-share="${escapeHtml(id)}">Fjern</button>
        </div>
      </li>`
    })
    .join('')
}

function getSessionForShareExport(sessionId) {
  flushCurrentSession()
  return sessions.find((x) => x.id === sessionId) ?? null
}

function updateShareRecipientStatus() {
  const el = document.getElementById('share-recipient-status')
  if (!el) return
  if (!shareRecipientShortId) {
    el.textContent = 'Ingen mottaker valgt ennå.'
    return
  }
  const name = shareRecipientDisplayName
    ? `${shareRecipientDisplayName} · `
    : ''
  el.textContent = `Valgt mottaker: ${name}bruker-ID ${shareRecipientShortId}`
}

function refreshShareContactsList() {
  const listEl = document.getElementById('share-contacts-list')
  const emptyEl = document.getElementById('share-contacts-empty')
  if (!listEl || !emptyEl) return
  const contacts = loadContacts()
  if (!contacts.length) {
    emptyEl.hidden = false
    listEl.innerHTML = ''
    return
  }
  emptyEl.hidden = true
  listEl.innerHTML = contacts
    .map((c) => {
      const name =
        typeof c.label === 'string' && c.label.trim()
          ? escapeHtml(c.label.trim())
          : `Kontakt ${escapeHtml(c.shortId)}`
      const sel =
        shareRecipientShortId === c.shortId
          ? ' share-contact-row--selected'
          : ''
      return `<button type="button" class="share-contact-row${sel}" data-share-contact="${escapeHtml(c.shortId)}" data-share-label="${escapeHtml(typeof c.label === 'string' ? c.label : '')}">
        <span class="share-contact-row__name">${name}</span>
        <span class="share-contact-row__id">ID ${escapeHtml(c.shortId)}</span>
      </button>`
    })
    .join('')
}

function openShareSessionDialog() {
  shareRecipientShortId = null
  shareRecipientDisplayName = null
  const dlg = document.getElementById('share-session-dialog')
  const sel = document.getElementById('share-session-select')
  const feedback = document.getElementById('share-session-feedback')
  const shortInp = document.getElementById('share-contact-shortid')
  const nameInp = document.getElementById('share-contact-name')
  const saveCb = document.getElementById('share-save-contact')
  if (feedback) feedback.textContent = ''
  if (shortInp) shortInp.value = ''
  if (nameInp) nameInp.value = ''
  if (saveCb) saveCb.checked = false
  if (sel && currentSessionId) sel.value = currentSessionId
  refreshShareContactsList()
  updateShareRecipientStatus()
  dlg?.showModal()
}

/**
 * @param {string} shortId
 * @param {string} [displayName]
 */
function setShareRecipient(shortId, displayName) {
  shareRecipientShortId = shortId
  shareRecipientDisplayName =
    typeof displayName === 'string' && displayName.trim()
      ? displayName.trim()
      : ''
  refreshShareContactsList()
  updateShareRecipientStatus()
}

async function performShareSessionSend() {
  const statusEl = document.getElementById('share-session-feedback')
  const sel = document.getElementById('share-session-select')
  const sessionId = sel?.value
  if (!sessionId || !shareRecipientShortId) {
    if (statusEl) {
      statusEl.textContent =
        'Velg hvilken økt som skal sendes, og hvem som er mottaker.'
    }
    return
  }
  if (
    isValidStoredShortId(currentUser?.shortId) &&
    shareRecipientShortId === currentUser.shortId
  ) {
    if (statusEl) statusEl.textContent = 'Du kan ikke sende til din egen bruker-ID.'
    return
  }
  const sess = getSessionForShareExport(sessionId)
  if (!sess) {
    if (statusEl) statusEl.textContent = 'Fant ikke økten.'
    return
  }
  const logShare = () => {
    addLogEntry(state, {
      message: `Del · sendt økt til bruker-ID ${shareRecipientShortId}`,
    })
    persist()
  }

  const sb = getSupabase()
  if (sb && isSupabaseConfigured()) {
    const payload = sessionToSharePayload(sess)
    if (!payload) {
      if (statusEl) statusEl.textContent = 'Kunne ikke forberede økt.'
      return
    }
    if (statusEl) statusEl.textContent = 'Sender til mottaker …'
    try {
      await sendSessionShare(sb, shareRecipientShortId, payload)
      document.getElementById('share-session-dialog')?.close()
      if (statusEl) statusEl.textContent = ''
      logShare()
      return
    } catch (e) {
      if (statusEl) statusEl.textContent = mapShareRpcError(/** @type {Error} */ (e))
      return
    }
  }

  const html = await buildScanixExportHtml(
    sess.clickHistory,
    sess.log,
    sess.roadSide,
    sess.photos,
    sess.title,
    sess.objectCategories,
    sess.registeredNote ?? null,
  )
  const filename = `scanix-til-${shareRecipientShortId}-${nowIso().slice(0, 19).replace(/:/g, '-')}.html`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const file = new File([blob], filename, { type: 'text/html' })
  const labelPart = shareRecipientDisplayName
    ? ` (${shareRecipientDisplayName})`
    : ''
  const text = `Scanix-økt til bruker-ID ${shareRecipientShortId}${labelPart}. Mottaker: åpne Scanix og trykk «Importer økt» på forsiden, eller åpne HTML-fila i nettleser.`
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Scanix-økt',
        text,
      })
      document.getElementById('share-session-dialog')?.close()
      if (statusEl) statusEl.textContent = ''
      logShare()
      return
    } catch (err) {
      if (err.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  document.getElementById('share-session-dialog')?.close()
  if (statusEl) statusEl.textContent = ''
  logShare()
}

let sessionToastHideTimer = null

function showSessionToast(message, durationMs = 2400) {
  const el = document.getElementById('session-toast')
  if (!el) return
  el.textContent = message
  el.hidden = false
  requestAnimationFrame(() => {
    el.classList.add('session-toast--visible')
  })
  window.clearTimeout(sessionToastHideTimer)
  sessionToastHideTimer = window.setTimeout(() => {
    el.classList.remove('session-toast--visible')
    sessionToastHideTimer = window.setTimeout(() => {
      el.hidden = true
    }, 320)
  }, durationMs)
}

async function initSessionMapAndWatch() {
  if (!sessionMapInitPromise) {
    sessionMapInitPromise = (async () => {
      try {
        if (map) {
          try {
            map.remove()
          } catch {
            /* ignore */
          }
          map = null
          markers.length = 0
          userLocationMarker = null
          userAccuracyCircle = null
        }
        const mapEl = document.getElementById('map')
        if (!mapEl) return
        await ensureLeaflet()
        ensureSessionPinIcons()
        followUserOnMap = true
        map = Leaflet.map(mapEl, {
          zoomControl: true,
          tapTolerance: 12,
        }).setView([59.9139, 10.7522], 13)
        map.on('dragstart', () => {
          followUserOnMap = false
        })
        map.on('zoomstart', (ev) => {
          if (ev.originalEvent) followUserOnMap = false
        })
        Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap-bidragsytere',
          maxZoom: 19,
        }).addTo(map)
        setTimeout(() => map?.invalidateSize(), 100)
        rebuildMarkers()
        renderCount()
        renderLog()
        renderPhotosGallery()
        updateMapSharePanel()
        const gpsEl = document.getElementById('gps-status')
        requestLocationOnLoad(gpsEl)
      } catch (e) {
        console.error('initSessionMapAndWatch', e)
      }
    })().finally(() => {
      sessionMapInitPromise = null
    })
  }
  await sessionMapInitPromise
}

function bindKmtDialogListeners(signal) {
  const kmtDlg = document.getElementById('kmt-dialog')
  const btnKmt = document.getElementById('btn-kmt')
  kmtDlg?.addEventListener(
    'close',
    () => {
      kmtDialogOpen = false
      stopKmtCameraStream()
      const goAlbum = kmtStandaloneFlow
      kmtStandaloneFlow = false
      if (goAlbum && currentUser) {
        view = 'photoAlbum'
        photoAlbumMarkerMode = false
        photoAlbumSelectedIds = new Set()
        renderApp()
        bindPhotoAlbumListeners()
      }
      vegrefStopPipeline()
      btnKmt?.setAttribute('aria-expanded', 'false')
    },
    { signal },
  )
  btnKmt?.addEventListener(
    'click',
    () => {
      kmtStandaloneFlow = false
      btnKmt.setAttribute('aria-expanded', 'true')
      void openKmtDialog()
    },
    { signal },
  )
  document.getElementById('btn-kmt-back')?.addEventListener(
    'click',
    () => {
      kmtDlg?.close()
    },
    { signal },
  )
  document.getElementById('btn-kmt-capture')?.addEventListener(
    'click',
    () => void captureKmtCameraPhoto(),
    { signal },
  )
  const tapLayer = document.getElementById('kmt-tap-focus-layer')
  const onTapFocus = (ev) => {
    if (!(ev instanceof PointerEvent)) return
    if (ev.pointerType === 'mouse' && ev.button !== 0) return
    const video = document.getElementById('kmt-video')
    const track = kmtMediaStream?.getVideoTracks?.()?.[0]
    if (!track || !video) return
    const stage = document.getElementById('kmt-video-stage')
    showKmtFocusRipple(ev.clientX, ev.clientY, stage)
    void applyKmtPointFocus(track, ev.clientX, ev.clientY, video)
  }
  tapLayer?.addEventListener('pointerup', onTapFocus, { signal })
}

/** @param {'quit' | 'pdf'} tab */
function setSessionEndDialogTab(tab) {
  const tabQuit = document.getElementById('session-end-tab-quit')
  const tabPdf = document.getElementById('session-end-tab-pdf')
  const panelQuit = document.getElementById('session-end-panel-quit')
  const panelPdf = document.getElementById('session-end-panel-pdf')
  const pdf = tab === 'pdf'
  tabQuit?.setAttribute('aria-selected', (!pdf).toString())
  tabPdf?.setAttribute('aria-selected', pdf.toString())
  tabQuit?.classList.toggle('session-end-tabs__tab--active', !pdf)
  tabPdf?.classList.toggle('session-end-tabs__tab--active', pdf)
  if (pdf) {
    panelQuit?.setAttribute('hidden', '')
    panelPdf?.removeAttribute('hidden')
  } else {
    panelQuit?.removeAttribute('hidden')
    panelPdf?.setAttribute('hidden', '')
  }
}

/**
 * Lagrer PDF på enheten (iOS: delingsark → Lagre i Filer). Fallback: nedlasting.
 * @param {Blob} blob
 * @param {string} filename
 */
async function shareOrDownloadPdfBlob(blob, filename) {
  const file = new File([blob], filename, { type: 'application/pdf' })
  let canShareFiles = false
  try {
    canShareFiles = Boolean(
      navigator.canShare && navigator.canShare({ files: [file] }),
    )
  } catch {
    canShareFiles = false
  }
  if (canShareFiles) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
      })
      return
    } catch (e) {
      if (e && /** @type {{ name?: string }} */ (e).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function collectHomeAiChatLinesForPdf() {
  const log = document.getElementById('home-ai-chat-log')
  if (!log) return []
  const out = []
  log.querySelectorAll('.home-ai-gpt__row').forEach((row) => {
    const user = row.classList.contains('home-ai-gpt__row--user')
    const text = row.innerText.replace(/\s*\n\s*/g, '\n').trim()
    if (text) out.push({ role: user ? 'user' : 'assistant', text })
  })
  return out
}

function formatHomeAiPdfPreviewText(lines) {
  if (!lines.length) return 'Ingen meldinger i samtalen ennå.'
  const assistantLabel = homeAiContractRagMode ? 'Kontrakt-AI' : 'VeiAi'
  return lines
    .map((l) => {
      const who = l.role === 'user' ? 'Bruker' : assistantLabel
      return `${who}\n${l.text}`
    })
    .join('\n\n')
}

function openHomeAiPdfDialog() {
  const dlg = document.getElementById('home-ai-pdf-dialog')
  const preview = document.getElementById('home-ai-pdf-preview')
  const statusEl = document.getElementById('home-ai-pdf-dialog-status')
  if (statusEl) statusEl.textContent = ''
  const lines = collectHomeAiChatLinesForPdf()
  if (preview) preview.textContent = formatHomeAiPdfPreviewText(lines)
  if (dlg instanceof HTMLDialogElement) dlg.showModal()
}

function exitHomeAiFromPdfDialog() {
  const dlg = document.getElementById('home-ai-pdf-dialog')
  if (dlg instanceof HTMLDialogElement) dlg.close()
  stopHomeAiCamera()
  setHomeBildeSubTab('camera')
}

async function saveHomeAiPdfToDevice() {
  const statusEl = document.getElementById('home-ai-pdf-dialog-status')
  const lines = collectHomeAiChatLinesForPdf()
  if (!lines.length) {
    if (statusEl) statusEl.textContent = 'Ingen samtale å lagre.'
    return
  }
  if (statusEl) statusEl.textContent = 'Genererer PDF …'
  try {
    const res = await fetch(apiUrl('/api/generate-ai-chat-pdf'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: homeAiContractRagMode
          ? 'Kontrakt – samtale'
          : 'VeiAi – dokumentering',
        generatedAtLabel: new Date().toLocaleString('nb-NO', {
          dateStyle: 'long',
          timeStyle: 'short',
        }),
        lines,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        typeof err.error === 'string' ? err.error : `HTTP ${res.status}`,
      )
    }
    const blob = await res.blob()
    const filename = homeAiContractRagMode
      ? `kontrakt-samtale-${new Date().toISOString().slice(0, 10)}.pdf`
      : `veiai-samtale-${new Date().toISOString().slice(0, 10)}.pdf`
    await shareOrDownloadPdfBlob(blob, filename)
    if (statusEl) {
      statusEl.textContent =
        'PDF er klar. På iPhone: velg «Lagre i Filer» i delingsarket om du blir spurt.'
    }
  } catch (e) {
    const msg =
      e && typeof e === 'object' && 'message' in e
        ? String(/** @type {{ message: string }} */ (e).message)
        : 'Ukjent feil'
    if (statusEl) {
      statusEl.textContent =
        msg === 'Failed to fetch' || msg.includes('NetworkError')
          ? 'Kunne ikke nå serveren. Start API (cd server, npm start, port 8787) og prøv igjen.'
          : msg
    }
  }
}

async function exportSessionReportPdf() {
  const statusEl = document.getElementById('session-end-pdf-status')
  const commentsEl = document.getElementById('session-end-pdf-comments')
  const titleInp = document.getElementById('session-end-title')
  const registeredNoteInp = document.getElementById('session-end-registered-note')
  const comments = commentsEl?.value ?? ''
  if (statusEl) statusEl.textContent = 'Genererer PDF …'
  const cats = normalizeObjectCategoryList(state.objectCategories)
  const payload = {
    appName: 'Scanix',
    appVersion: appPackage.version,
    userName:
      typeof currentUser?.name === 'string' && currentUser.name.trim()
        ? currentUser.name.trim()
        : 'Bruker',
    sessionTitle:
      typeof titleInp?.value === 'string' && titleInp.value.trim()
        ? titleInp.value.trim().slice(0, SESSION_TITLE_MAX_LEN)
        : null,
    registeredNote:
      typeof registeredNoteInp?.value === 'string' &&
      registeredNoteInp.value.trim()
        ? registeredNoteInp.value.trim().slice(0, SESSION_REGISTERED_NOTE_MAX_LEN)
        : null,
    comments,
    generatedAtLabel: new Date().toLocaleString('nb-NO', {
      dateStyle: 'long',
      timeStyle: 'short',
    }),
    roadSideLabel: formatRoadSideLabel(state.roadSide) || '',
    objectCategoryLabels: cats.map(getObjectCategoryLabel),
    clickHistory: state.clickHistory.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      timestamp: p.timestamp,
      categoryLabel: p.category ? getObjectCategoryLabel(p.category) : null,
    })),
    log: state.log.map((e) => ({
      timestamp: e.timestamp,
      message: formatLogMessageForDisplay(
        e && typeof e.message === 'string' ? e.message : '',
      ),
    })),
    photos: state.photos.map((p) => ({
      dataUrl: p.dataUrl,
      timestamp: p.timestamp,
    })),
  }
  try {
    const res = await fetch(apiUrl('/api/generate-report'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        typeof err.error === 'string' ? err.error : `HTTP ${res.status}`,
      )
    }
    const blob = await res.blob()
    await shareOrDownloadPdfBlob(
      blob,
      `scanix-rapport-${new Date().toISOString().slice(0, 10)}.pdf`,
    )
    if (statusEl) statusEl.textContent = 'PDF er lastet ned.'
  } catch (e) {
    const msg =
      e && typeof e === 'object' && 'message' in e && typeof e.message === 'string'
        ? e.message
        : 'Ukjent feil'
    if (statusEl) {
      statusEl.textContent =
        msg === 'Failed to fetch' || msg.includes('NetworkError')
          ? 'Kunne ikke nå PDF-tjenesten. Start API: åpne ny terminal, cd server, npm install, npm start (port 8787), deretter kjør npm run dev her.'
          : msg
    }
  }
}

function sessionCounterMinus(buttonEl) {
  triggerMinusFeedback(buttonEl)
  if (state.count <= 0) {
    addLogEntry(state, { message: 'Angret · ingen registreringer' })
    persist()
    return
  }
  state.count -= 1
  state.clickHistory.pop()
  rebuildMarkers()
  addLogEntry(state, {
    message: `Angret · teller ${state.count}`,
  })
  persist()
  if (state.clickHistory.length) fitAllPins()
  else centerMapWhenEmptyPins()
}

function sessionCounterReset(buttonEl) {
  triggerResetFeedback(buttonEl)
  const prev = state.count
  state.count = 0
  state.clickHistory = []
  rebuildMarkers()
  centerMapWhenEmptyPins()
  addLogEntry(state, {
    message: `Fjernet alle · var ${prev}`,
  })
  persist()
}

function bindSessionListeners() {
  if (sessionAbort) sessionAbort.abort()
  sessionAbort = new AbortController()
  const { signal } = sessionAbort

  bindKmtDialogListeners(signal)

  document.getElementById('app')?.addEventListener(
    'click',
    (ev) => {
      if (view !== 'session') return
      const el = ev.target
      if (!(el instanceof Element)) return
      const minusBtn = el.closest('#btn-minus')
      if (minusBtn) {
        ev.preventDefault()
        sessionCounterMinus(minusBtn)
        return
      }
      const resetBtn = el.closest('#btn-reset')
      if (resetBtn) {
        ev.preventDefault()
        sessionCounterReset(resetBtn)
      }
    },
    { signal },
  )

  const shareDlg = document.getElementById('share-session-dialog')
  document.getElementById('btn-share-session')?.addEventListener(
    'click',
    () => openShareSessionDialog(),
    { signal },
  )
  document.getElementById('btn-share-session-close')?.addEventListener(
    'click',
    () => shareDlg?.close(),
    { signal },
  )
  document.getElementById('btn-share-session-cancel')?.addEventListener(
    'click',
    () => shareDlg?.close(),
    { signal },
  )
  document.getElementById('btn-share-session-send')?.addEventListener(
    'click',
    () => void performShareSessionSend(),
    { signal },
  )
  document.getElementById('share-contacts-list')?.addEventListener(
    'click',
    (ev) => {
      const btn = ev.target.closest('[data-share-contact]')
      if (!btn) return
      const sid = btn.getAttribute('data-share-contact')
      const lab = btn.getAttribute('data-share-label') ?? ''
      if (!sid || !isValidStoredShortId(sid)) return
      const fb = document.getElementById('share-session-feedback')
      if (fb) fb.textContent = ''
      setShareRecipient(sid, lab || undefined)
    },
    { signal },
  )
  document.getElementById('btn-share-use-contact')?.addEventListener(
    'click',
    () => {
      const feedback = document.getElementById('share-session-feedback')
      if (feedback) feedback.textContent = ''
      const raw =
        document.getElementById('share-contact-shortid')?.value ?? ''
      const only = raw.replace(/\D/g, '')
      if (only.length < 5) {
        if (feedback) {
          feedback.textContent =
            'Skriv inn 5 siffer (mottakers bruker-ID).'
        }
        return
      }
      const shortId = only.slice(-5)
      if (!isValidStoredShortId(shortId)) {
        if (feedback) feedback.textContent = 'Ugyldig bruker-ID.'
        return
      }
      if (
        isValidStoredShortId(currentUser?.shortId) &&
        shortId === currentUser.shortId
      ) {
        if (feedback) {
          feedback.textContent =
            'Du kan ikke bruke din egen bruker-ID som mottaker.'
        }
        return
      }
      const nameInp =
        document.getElementById('share-contact-name')?.value?.trim() ?? ''
      const saveCb = document.getElementById('share-save-contact')
      if (saveCb?.checked) {
        upsertContactByShortId(shortId, nameInp)
        refreshShareContactsList()
      }
      setShareRecipient(shortId, nameInp || undefined)
    },
    { signal },
  )

  document
    .getElementById('btn-back-menu')
    ?.addEventListener(
      'click',
      () => {
        void (async () => {
          if (previewIncomingShareId) {
            const r = await resolveIncomingSharePreviewLeaving({})
            if (r === 'cancel') return
            navigateHomeClearSession()
            return
          }
          goHome()
        })()
      },
      { signal },
    )

  const sessionEndDialog = document.getElementById('session-end-dialog')
  const sessionEndTitleInput = document.getElementById('session-end-title')
  const sessionEndRegisteredNoteInput = document.getElementById(
    'session-end-registered-note',
  )
  document.getElementById('btn-end-session')?.addEventListener(
    'click',
    () => {
      const sess = sessions.find((x) => x.id === currentSessionId)
      if (sessionEndTitleInput) {
        sessionEndTitleInput.value =
          typeof sess?.title === 'string' && sess.title.trim()
            ? sess.title.trim().slice(0, SESSION_TITLE_MAX_LEN)
            : ''
      }
      if (sessionEndRegisteredNoteInput) {
        sessionEndRegisteredNoteInput.value =
          typeof sess?.registeredNote === 'string' && sess.registeredNote.trim()
            ? sess.registeredNote.trim().slice(
                0,
                SESSION_REGISTERED_NOTE_MAX_LEN,
              )
            : ''
      }
      setSessionEndDialogTab('quit')
      const pdfStatus = document.getElementById('session-end-pdf-status')
      if (pdfStatus) pdfStatus.textContent = ''
      sessionEndDialog?.showModal()
      queueMicrotask(() => sessionEndTitleInput?.focus())
    },
    { signal },
  )
  document.getElementById('session-end-tab-quit')?.addEventListener(
    'click',
    () => {
      setSessionEndDialogTab('quit')
      queueMicrotask(() => sessionEndTitleInput?.focus())
    },
    { signal },
  )
  document.getElementById('session-end-tab-pdf')?.addEventListener(
    'click',
    () => {
      setSessionEndDialogTab('pdf')
      queueMicrotask(() =>
        document.getElementById('session-end-pdf-comments')?.focus(),
      )
    },
    { signal },
  )
  document.getElementById('session-end-pdf-export')?.addEventListener(
    'click',
    () => {
      void exportSessionReportPdf()
    },
    { signal },
  )
  document.getElementById('session-end-pdf-cancel')?.addEventListener(
    'click',
    () => {
      sessionEndDialog?.close()
    },
    { signal },
  )
  document.getElementById('session-end-cancel')?.addEventListener(
    'click',
    () => {
      sessionEndDialog?.close()
    },
    { signal },
  )
  document.getElementById('session-end-form')?.addEventListener(
    'submit',
    (e) => {
      e.preventDefault()
      const v = sessionEndTitleInput?.value ?? ''
      const note = sessionEndRegisteredNoteInput?.value ?? ''
      sessionEndDialog?.close()
      if (previewIncomingShareId) {
        void (async () => {
          const r = await resolveIncomingSharePreviewLeaving({
            pendingTitle: v,
            pendingRegisteredNote: note,
          })
          if (r === 'cancel') {
            sessionEndDialog?.showModal()
            queueMicrotask(() => sessionEndTitleInput?.focus())
            return
          }
          navigateHomeClearSession()
        })()
        return
      }
      finalizeSessionAndGoHome(v, note)
    },
    { signal },
  )

  document.getElementById('btn-plus')?.addEventListener(
    'click',
    async (ev) => {
      const gpsEl = document.getElementById('gps-status')
      triggerTellOppFeedback(ev.currentTarget)
      if (gpsEl) {
        gpsEl.textContent = 'Henter posisjon …'
      }
      let lat
      let lng
      let accuracy
      let gpsErrorText = null
      try {
        const p = await getPositionForClick()
        lat = p.lat
        lng = p.lng
        accuracy = p.accuracy
      } catch (err) {
        gpsErrorText = describeGeolocationFailure(err)
        if (gpsEl) gpsEl.textContent = gpsErrorText
        lat = null
        lng = null
        accuracy = null
      }

      if (lat == null || lng == null) {
        addLogEntry(state, {
          message: `Ikke registrert · ${
            gpsErrorText ? gpsErrorText : 'ingen posisjon'
          }`,
        })
        persist()
        return
      }
      const accNum =
        typeof accuracy === 'number' && !Number.isNaN(accuracy) ? accuracy : null
      if (accNum == null) {
        if (gpsEl) {
          gpsEl.textContent =
            'Kunne ikke måle nøyaktighet. Prøv igjen om et øyeblikk.'
        }
        addLogEntry(state, {
          message: 'Ikke registrert – ukjent nøyaktighet',
        })
        persist()
        return
      }
      if (accNum > REGISTER_MAX_GPS_ACCURACY_M) {
        if (gpsEl) {
          gpsEl.textContent = `For usikkert (ca. ±${Math.round(accNum)} m). Trenger ca. ±${REGISTER_MAX_GPS_ACCURACY_M} m – vent på bedre dekning.`
        }
        addLogEntry(state, {
          message: `Ikke registrert – ca. ±${Math.round(accNum)} m (trenger ±${REGISTER_MAX_GPS_ACCURACY_M} m)`,
        })
        persist()
        return
      }

      if (gpsEl) {
        gpsEl.textContent = `Nøyaktighet ca. ${Math.round(accNum)} m`
      }

      state.count += 1
      const ts = nowIso()
      const id = crypto.randomUUID()
      const cats = normalizeObjectCategoryList(state.objectCategories)
      let categoryId = null
      if (cats.length === 1) {
        categoryId = cats[0]
      } else if (cats.length > 1) {
        categoryId =
          state.activeCategoryId && cats.includes(state.activeCategoryId)
            ? state.activeCategoryId
            : cats[0]
      }
      const clickEntry = { id, lat, lng, timestamp: ts }
      if (categoryId) clickEntry.category = categoryId
      state.clickHistory.push(clickEntry)

      rebuildMarkers()
      animateSessionPinDrop()
      if (map) {
        followUserOnMap = false
        map.flyTo([lat, lng], Math.max(map.getZoom(), 15), {
          duration: 0.5,
          easeLinearity: 0.45,
        })
      }

      const coordStr = `${lat.toFixed(5)}, ${lng.toFixed(5)} · nøyaktighet ca. ${Math.round(accNum)} m`
      const typePart =
        categoryId != null ? ` · ${getObjectCategoryLabel(categoryId)}` : ''
      addLogEntry(state, {
        message: `Oppført${typePart} · ${state.count} · ${coordStr}`,
      })
      persist()
      showSessionToast('Registrert ✓')
    },
    { signal },
  )

  document.getElementById('btn-fit')?.addEventListener(
    'click',
    () => {
      fitAllPins()
    },
    { signal },
  )

  document.getElementById('tab-map-fit')?.addEventListener(
    'click',
    () => setMapSectionTab('fit'),
    { signal },
  )
  document.getElementById('tab-map-share')?.addEventListener(
    'click',
    () => setMapSectionTab('share'),
    { signal },
  )
  document.getElementById('btn-copy-map-link')?.addEventListener(
    'click',
    () => {
      void copyMapShareUrlToClipboard()
    },
    { signal },
  )
  document.getElementById('btn-share-map-link')?.addEventListener(
    'click',
    () => {
      void shareMapRouteLink()
    },
    { signal },
  )

  document.getElementById('btn-map-locate')?.addEventListener(
    'click',
    () => {
      centerMapOnUserPosition()
    },
    { signal },
  )

  document.getElementById('btn-export')?.addEventListener(
    'click',
    async () => {
      const sess = sessions.find((x) => x.id === currentSessionId)
      const html = await buildScanixExportHtml(
        state.clickHistory,
        state.log,
        state.roadSide,
        state.photos,
        sess?.title ?? null,
        state.objectCategories,
        sess?.registeredNote ?? null,
      )
      const filename = `scanix-økt-${nowIso().slice(0, 19).replace(/:/g, '-')}.html`
      const blob = new Blob([html], {
        type: 'text/html;charset=utf-8',
      })
      const file = new File([blob], filename, { type: 'text/html' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Scanix-økt',
            text: 'Eksportert økt fra Scanix',
          })
          addLogEntry(state, {
            message: 'Eksport · delt',
          })
          persist()
          return
        } catch (err) {
          if (err.name === 'AbortError') return
        }
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      addLogEntry(state, {
        message: 'Eksport · nedlastet',
      })
      persist()
    },
    { signal },
  )

  document.getElementById('photos-gallery')?.addEventListener(
    'click',
    (ev) => {
      const card = ev.target.closest('[data-photo-id]')
      if (!card) return
      const id = card.getAttribute('data-photo-id')
      if (!id) return
      const ph = state.photos.find((p) => p.id === id)
      if (ph?.dataUrl) openPhotoFullscreen(ph.dataUrl, ph.vegref)
    },
    { signal },
  )

  wireSessionBottomSheet(signal)
  wireSessionGpsSheetMirror(signal)

  setupSessionShareInbox()
}

function bindListenersForCurrentView() {
  if (view !== 'home' || !currentUser) {
    stopHomeVegrefTracking()
  }
  if (!currentUser) {
    bindAuthListeners()
    return
  }
  if (view === 'session') {
    void initSessionMapAndWatch()
    bindSessionListeners()
  } else if (view === 'menuSession') {
    bindMenuSessionListeners()
  } else if (view === 'menuUser') {
    bindMenuUserListeners()
  } else if (view === 'menuMap') {
    bindMenuMapListeners()
  } else if (view === 'menuContacts') {
    bindMenuContactsListeners()
  } else if (view === 'menuSettings' || view === 'menuPrivacy' || view === 'menuSupport') {
    bindMenuInfoListeners()
  } else if (view === 'inbox') {
    bindInboxListeners()
  } else if (view === 'photoAlbum') {
    bindPhotoAlbumListeners()
  } else if (view === 'receivedPhotos') {
    bindReceivedPhotosListeners()
  } else {
    bindHomeListeners()
  }
}

function bootstrap() {
  initVegrefLive({
    haversineM,
    fetchRoadReferenceNear,
    getViewHome: () => view === 'home',
    getKmtOpen: () => kmtDialogOpen,
    applyHome: applyHomeVegrefResult,
    applyKmt: applyKmtResult,
    beforeNvdbFetch: () => {
      if (kmtDialogOpen && !kmtHasDisplayedResult) setKmtLoading()
      if (view === 'home' && !homeVegrefHasDisplayedResult) {
        setHomeVegrefPlaceholder('Henter vegreferanse …')
      }
    },
  })
  window.addEventListener('online', () => {
    if (
      lastLiveCoords &&
      Date.now() - lastLiveCoords.ts < 90000 &&
      (view === 'home' || kmtDialogOpen)
    ) {
      vegrefResetThrottle()
      vegrefNotifyGps(lastLiveCoords.lat, lastLiveCoords.lng, {
        forceImmediate: true,
      })
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && currentUser?.id) {
      void backupAuthToIdb(loadUsersFromStorage(), currentUser)
    }
  })
  const sbBoot = getSupabase()
  if (sbBoot) {
    sbBoot.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return
      if (ignoreNextSupabaseSignedOut) {
        ignoreNextSupabaseSignedOut = false
        return
      }
      cancelSupabaseAppStatePush()
      teardownSessionShareInbox()
      flushCurrentSession()
      destroyMap()
      vegrefResetSessionCache()
      currentSessionId = null
      state = defaultState()
      sessions = []
      standalonePhotos = []
      currentUser = null
      lastIncomingShareCountForNotify = null
      clearAuthSession()
      void backupAuthToIdb(loadUsersFromStorage(), null)
      authScreen = 'login'
      view = 'auth'
      renderApp()
      bindAuthListeners()
    })
  }
  renderApp()
  bindListenersForCurrentView()
  if (isSupabaseConfigured() && currentUser?.id) {
    void hydrateUserAppStateFromRemote()
  }
}

bootstrap()

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

window.addEventListener('beforeunload', () => {
  flushCurrentSession()
  stopLocationWatch()
})

function centerMapWhenEmptyPins() {
  if (!map) return
  if (lastLiveCoords && Date.now() - lastLiveCoords.ts < 120000) {
    followUserOnMap = true
    map.setView([lastLiveCoords.lat, lastLiveCoords.lng], 15)
  } else {
    followUserOnMap = false
    map.setView([59.9139, 10.7522], 13)
  }
}

function destroyReceivedPhotosMap() {
  if (receivedPhotosMap) {
    try {
      receivedPhotosMap.remove()
    } catch {
      /* ignore */
    }
    receivedPhotosMap = null
  }
}

function destroyMap() {
  destroyReceivedPhotosMap()
  kmtStandaloneFlow = false
  document.getElementById('kmt-dialog')?.close()
  kmtDialogOpen = false
  stopKmtCameraStream()
  vegrefStopPipeline()
  stopLocationWatch()
  resetDrivingFilters()
  followUserOnMap = true
  lastLiveCoords = null
  userLocationMarker = null
  userAccuracyCircle = null
  markers.length = 0
  if (map) {
    map.remove()
    map = null
  }
}

function destroyMenuBrowseMap() {
  if (menuBrowseMap) {
    try {
      menuBrowseMap.remove()
    } catch {
      /* ignore */
    }
    menuBrowseMap = null
  }
}

async function initMenuBrowseMap() {
  const el = document.getElementById('menu-browse-map')
  if (!el || menuBrowseMap) return
  await ensureLeaflet()
  menuBrowseMap = Leaflet.map('menu-browse-map', { zoomControl: true }).setView(
    [59.9139, 10.7522],
    13,
  )
  Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap-bidragsytere',
    maxZoom: 19,
  }).addTo(menuBrowseMap)
  window.setTimeout(() => {
    try {
      menuBrowseMap?.invalidateSize()
    } catch {
      /* ignore */
    }
  }, 120)
}

let feedbackAudioCtx = null
function getFeedbackAudioContext() {
  if (!feedbackAudioCtx) {
    feedbackAudioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return feedbackAudioCtx
}

/** Kort «opp»-klikk (lys tone som faller litt). */
function playCountClickSound() {
  try {
    const ctx = getFeedbackAudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, t)
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.07)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.11, t + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.1)
  } catch {
    /* stille feil */
  }
}

/** Lavere tone som faller – «går ned». */
function playMinusDownSound() {
  try {
    const ctx = getFeedbackAudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(480, t)
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.11)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.1, t + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.15)
  } catch {
    /* stille feil */
  }
}

/** Støy + filter + dump – «tømme søppel». */
function playResetTrashSound() {
  try {
    const ctx = getFeedbackAudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    const dur = 0.36
    const n = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) {
      const env = (1 - i / n) ** 1.2
      d[i] = (Math.random() * 2 - 1) * env * 0.5
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(2400, t)
    bp.frequency.exponentialRampToValueAtTime(350, t + 0.24)
    bp.Q.value = 0.9
    const g1 = ctx.createGain()
    g1.gain.setValueAtTime(0, t)
    g1.gain.linearRampToValueAtTime(0.15, t + 0.025)
    g1.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(bp)
    bp.connect(g1)
    g1.connect(ctx.destination)
    src.start(t)
    src.stop(t + dur)

    const osc = ctx.createOscillator()
    const g2 = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(88, t)
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.2)
    g2.gain.setValueAtTime(0, t)
    g2.gain.linearRampToValueAtTime(0.13, t + 0.018)
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
    osc.connect(g2)
    g2.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.26)
  } catch {
    /* stille feil */
  }
}

/** To korte toner – «ny melding» / mottatt delt økt (samme AudioContext som øvrige lyder). */
function playInboxReceiveSound() {
  try {
    const ctx = getFeedbackAudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    const chime = (start, f0, f1, peak) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      const t0 = t + start
      osc.frequency.setValueAtTime(f0, t0)
      osc.frequency.exponentialRampToValueAtTime(f1, t0 + 0.055)
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + 0.18)
    }
    chime(0, 587.33, 783.99, 0.095)
    chime(0.1, 880, 1046.5, 0.065)
  } catch {
    /* stille feil */
  }
}

function triggerButtonPulse(buttonEl, pulseClass) {
  if (!buttonEl?.classList) return
  buttonEl.classList.remove(pulseClass)
  void buttonEl.offsetWidth
  buttonEl.classList.add(pulseClass)
  const done = () => {
    buttonEl.classList.remove(pulseClass)
    buttonEl.removeEventListener('animationend', done)
  }
  buttonEl.addEventListener('animationend', done, { once: true })
}

function flashScreenRegisterAck() {
  if (typeof document === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  let el = document.getElementById('scanix-register-flash')
  if (!el) {
    el = document.createElement('div')
    el.id = 'scanix-register-flash'
    el.className = 'scanix-register-flash'
    el.setAttribute('aria-hidden', 'true')
    document.body.appendChild(el)
  }
  el.classList.remove('scanix-register-flash--animate')
  void el.offsetWidth
  el.classList.add('scanix-register-flash--animate')
  const clear = () => {
    el.classList.remove('scanix-register-flash--animate')
  }
  el.addEventListener('animationend', clear, { once: true })
  window.setTimeout(clear, 320)
}

function triggerTellOppFeedback(buttonEl) {
  if (navigator.vibrate) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigator.vibrate(18)
    } else {
      navigator.vibrate(42)
    }
  }
  flashScreenRegisterAck()
  playCountClickSound()
  triggerButtonPulse(buttonEl, 'btn-plus--pulse')
}

function triggerMinusFeedback(buttonEl) {
  if (navigator.vibrate) navigator.vibrate([10, 8, 14])
  playMinusDownSound()
  triggerButtonPulse(buttonEl, 'btn-minus--pulse')
}

function triggerResetFeedback(buttonEl) {
  if (navigator.vibrate) navigator.vibrate([30, 40, 50])
  playResetTrashSound()
  triggerButtonPulse(buttonEl, 'btn-reset--pulse')
}

/** Sikker JSON-innbygging i HTML (unngår </script> i data). */
function jsonForHtmlScript(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}

/** Leaflet-CSS for innebygd eksport: fjern relative bildestier som ikke finnes på file:// (iPhone Filer). */
function leafletCssForEmbeddedExport(css) {
  return css.replace(/url\(images\/[^)]+\)/g, 'none')
}

function escapeHtmlForExport(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Ett punkt: søk med nål (stabil URL). */
function buildGoogleMapsSinglePinUrl(lat, lng) {
  const la = Number(lat)
  const ln = Number(lng)
  const q = encodeURIComponent(`${la},${ln}`)
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

function encodeMapsLatLng(p) {
  return encodeURIComponent(
    `${Number(p.lat).toFixed(6)},${Number(p.lng).toFixed(6)}`,
  )
}

/**
 * Offisiell Universal Maps URL – støttes i app og nettleser (unlike path-only /dir/lat,lng/…).
 */
function buildGoogleMapsUrlForPointChunk(chunk) {
  if (!chunk.length) return ''
  if (chunk.length === 1) {
    return buildGoogleMapsSinglePinUrl(chunk[0].lat, chunk[0].lng)
  }
  const origin = encodeMapsLatLng(chunk[0])
  const destination = encodeMapsLatLng(chunk[chunk.length - 1])
  if (chunk.length === 2) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
  }
  const middle = chunk
    .slice(1, -1)
    .map((p) => encodeMapsLatLng(p))
    .join('%7C')
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${middle}&travelmode=driving`
}

/**
 * Overlappende biter (maks `maxPerChunk` punkt) – neste lenke starter der forrige sluttet.
 */
function splitValidPointsIntoMapRouteChunks(validPoints, maxPerChunk) {
  const v = validPoints
  if (!v.length) return []
  if (v.length === 1) return [v]
  const chunks = []
  let start = 0
  while (start < v.length) {
    const end = Math.min(start + maxPerChunk - 1, v.length - 1)
    chunks.push(v.slice(start, end + 1))
    if (end === v.length - 1) break
    start = end
  }
  return chunks
}

/** Én eller flere lenker – til sammen alle punkt. */
function buildGoogleMapsRouteUrlsForAllPoints(validPoints) {
  const chunks = splitValidPointsIntoMapRouteChunks(
    validPoints,
    MAPS_DIR_MAX_POINTS_PER_LINK,
  )
  return chunks.map((ch) => buildGoogleMapsUrlForPointChunk(ch))
}

function getValidClickHistoryPointsForMaps() {
  return state.clickHistory.filter(
    (p) =>
      p.lat != null &&
      p.lng != null &&
      !Number.isNaN(Number(p.lat)) &&
      !Number.isNaN(Number(p.lng)),
  )
}

function updateMapSharePanel() {
  const ta = document.getElementById('map-share-urls')
  if (!ta) return
  const valid = getValidClickHistoryPointsForMaps()
  const urls = buildGoogleMapsRouteUrlsForAllPoints(valid)
  ta.value = urls.join('\n\n')
  const empty = document.getElementById('map-share-empty')
  if (empty) {
    empty.hidden = valid.length > 0
  }
  const seg = document.getElementById('map-share-segments')
  if (seg) {
    if (valid.length > 0 && urls.length > 1) {
      seg.hidden = false
      seg.textContent = `Alle ${valid.length} punkt: ${urls.length} lenker (maks ${MAPS_DIR_MAX_POINTS_PER_LINK} stopp per lenke på mobil – Googles grense). Hver del starter der forrige slutter.`
    } else {
      seg.hidden = true
      seg.textContent = ''
    }
  }
  const copyBtn = document.getElementById('btn-copy-map-link')
  const shareBtn = document.getElementById('btn-share-map-link')
  const hasText = urls.length > 0 && ta.value.trim() !== ''
  if (copyBtn) copyBtn.disabled = !hasText
  if (shareBtn) shareBtn.disabled = !hasText
}

function setMapSectionTab(which) {
  const fitPanel = document.getElementById('map-panel-fit')
  const sharePanel = document.getElementById('map-panel-share')
  const tabFit = document.getElementById('tab-map-fit')
  const tabShare = document.getElementById('tab-map-share')
  if (!fitPanel || !sharePanel || !tabFit || !tabShare) return
  if (which === 'fit') {
    fitPanel.hidden = false
    sharePanel.hidden = true
    tabFit.setAttribute('aria-selected', 'true')
    tabShare.setAttribute('aria-selected', 'false')
    tabFit.classList.add('map-section__tab--active')
    tabShare.classList.remove('map-section__tab--active')
  } else {
    fitPanel.hidden = true
    sharePanel.hidden = false
    tabFit.setAttribute('aria-selected', 'false')
    tabShare.setAttribute('aria-selected', 'true')
    tabShare.classList.add('map-section__tab--active')
    tabFit.classList.remove('map-section__tab--active')
    updateMapSharePanel()
  }
}

async function copyMapShareUrlToClipboard() {
  const ta = document.getElementById('map-share-urls')
  const status = document.getElementById('map-share-copy-status')
  const text = ta?.value?.trim()
  if (!text) return
  const clearStatus = () => {
    if (status) status.textContent = ''
  }
  try {
    await navigator.clipboard.writeText(text)
    if (status) status.textContent = 'Kopiert til utklippstavlen'
    window.setTimeout(clearStatus, 2500)
  } catch {
    try {
      ta.focus()
      ta.select()
      document.execCommand('copy')
      if (status) status.textContent = 'Kopiert'
      window.setTimeout(clearStatus, 2500)
    } catch {
      /* ignore */
    }
  }
}

async function shareMapRouteLink() {
  const ta = document.getElementById('map-share-urls')
  const text = ta?.value?.trim()
  if (!text) return
  const urls = text.split(/\n\s*\n/).filter(Boolean)
  const firstUrl = urls[0] ?? ''
  if (navigator.share) {
    try {
      if (urls.length === 1 && firstUrl.startsWith('http')) {
        await navigator.share({
          title: 'Scanix – punkter i Google Maps',
          text: 'Åpne i Google Maps for å se alle registrerte punkt.',
          url: firstUrl,
        })
        return
      }
      await navigator.share({
        title: 'Scanix – punkter i Google Maps',
        text: `Alle punkt (${urls.length} lenker):\n\n${text}`,
      })
      return
    } catch (e) {
      if (e.name === 'AbortError') return
    }
  }
  await copyMapShareUrlToClipboard()
}

/** Statisk HTML med punkt + lenker – synlig selv uten JavaScript (f.eks. Filer-forhåndsvisning). */
function buildExportStaticPointsBlock(clickHistory) {
  const valid = clickHistory.filter(
    (p) =>
      p.lat != null &&
      p.lng != null &&
      !Number.isNaN(Number(p.lat)) &&
      !Number.isNaN(Number(p.lng)),
  )
  if (!valid.length) {
    return '<p class="scanix-static-note scanix-static-note--last">Ingen GPS-punkt med koordinater i denne eksporterte loggen.</p>'
  }

  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const p of valid) {
    const lat = Number(p.lat)
    const lng = Number(p.lng)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
  }
  const dLat = maxLat - minLat || 0.001
  const dLng = maxLng - minLng || 0.001
  const padLat = Math.max(dLat * 0.1, 0.0008)
  const padLng = Math.max(dLng * 0.1, 0.0008)
  const bbox = [
    minLng - padLng,
    minLat - padLat,
    maxLng + padLng,
    maxLat + padLat,
  ]
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.join(',')}&layer=mapnik`
  const googleRouteUrls = buildGoogleMapsRouteUrlsForAllPoints(valid)

  const intro = `<p class="scanix-static-hint">Koordinater og lenker for hvert trykk under. Røde nåler i <a href="#map">kartet nederst</a> på siden når JavaScript er på (i Filer: åpne i Safari).</p>`

  const items = valid
    .map((p, i) => {
      const lat = Number(p.lat)
      const lng = Number(p.lng)
      const pinUrl = buildGoogleMapsSinglePinUrl(lat, lng)
      const t = p.timestamp
        ? escapeHtmlForExport(
            new Date(p.timestamp).toLocaleString('nb-NO'),
          )
        : ''
      const tsAttr = p.timestamp
        ? escapeHtmlForExport(p.timestamp)
        : ''
      const cat =
        typeof p.category === 'string' && p.category
          ? ` · ${escapeHtmlForExport(getObjectCategoryLabel(p.category))}`
          : ''
      return (
        `<li><strong>Trykk #${i + 1}</strong>${cat}` +
        (t
          ? ` · <time datetime="${tsAttr}">${t}</time>`
          : '') +
        `<br><span>${lat.toFixed(6)}, ${lng.toFixed(6)}</span> · ` +
        `<a href="${escapeHtmlForExport(pinUrl)}" target="_blank" rel="noopener noreferrer">Google Maps med rød nål</a></li>`
      )
    })
    .join('')

  const routeExpl =
    valid.length > 1
      ? ` I rutevisning bruker Google bokstaver <strong>A, B, C …</strong> på stoppene: <strong>A = Trykk #1</strong>, <strong>B = Trykk #2</strong>, og så videre i samme rekkefølge som her (fortsetter på neste lenke om det er flere). Da er det <em>ikke</em> røde nåler, men bokstavmerker.`
      : ''

  let googleRouteBlock = ''
  if (googleRouteUrls.length === 1) {
    const routeLinkText =
      valid.length > 1 ? `Åpne som rute i Google Maps` : `Åpne i Google Maps`
    const routeIntro =
      valid.length > 1
        ? `<strong>Alle punkt i én Google Maps-rute:</strong>`
        : `<strong>Google Maps:</strong>`
    googleRouteBlock = `<p class="scanix-static-note">${routeIntro} <a href="${escapeHtmlForExport(googleRouteUrls[0])}" target="_blank" rel="noopener noreferrer">${routeLinkText}</a>.${routeExpl}</p>`
  } else if (googleRouteUrls.length > 1) {
    const links = googleRouteUrls
      .map(
        (u, i) =>
          `<a href="${escapeHtmlForExport(u)}" target="_blank" rel="noopener noreferrer">Delstrekning ${i + 1}</a>`,
      )
      .join(' · ')
    googleRouteBlock = `<p class="scanix-static-note"><strong>Google Maps – alle ${valid.length} punkt</strong> (${googleRouteUrls.length} lenker à maks ${MAPS_DIR_MAX_POINTS_PER_LINK} stopp per lenke; hver del starter der forrige slutter): ${links}.${routeExpl}</p>`
  }

  const footer = `<div class="scanix-static-footer">
${googleRouteBlock}
<p class="scanix-static-note"><strong>Rød nål per punkt:</strong> «Google Maps med rød nål» på hver rad viser ett trykk om gangen med vanlig rødt nålmerke.</p>
<p class="scanix-static-note scanix-static-note--last"><a href="${escapeHtmlForExport(osmEmbedUrl)}" target="_blank" rel="noopener noreferrer">OpenStreetMap-utsnitt</a> viser bare bakgrunn i området – ikke Scanix-punkter.</p>
</div>`

  return `${intro}<ul class="scanix-static-points">${items}</ul>${footer}`
}

function buildExportPhotosStaticBlock(photos) {
  if (!photos.length) {
    return '<p class="scanix-static-note">Ingen bilder i denne økten.</p>'
  }
  return photos
    .map((ph, i) => {
      const t = ph.timestamp
        ? escapeHtmlForExport(
            new Date(ph.timestamp).toLocaleString('nb-NO'),
          )
        : ''
      const pos =
        ph.lat != null && ph.lng != null
          ? escapeHtmlForExport(
              `${Number(ph.lat).toFixed(5)}, ${Number(ph.lng).toFixed(5)}`,
            )
          : 'ingen GPS'
      return `<figure class="scanix-export-photo"><figcaption>Bilde #${i + 1} · ${t} · ${pos}</figcaption><img src="${ph.dataUrl}" alt="Bilde ${i + 1}" /></figure>`
    })
    .join('')
}

/**
 * Frittstående HTML med innebygd Leaflet (ingen CDN).
 * Kart krever JavaScript + nett; Filer-forhåndsvisning på iPhone kjører ofte ikke JS – punktliste vises likevel.
 */
async function buildScanixExportHtml(
  clickHistory,
  logEntries,
  roadSide,
  photosIn = [],
  sessionTitle = null,
  objectCategoriesIn = null,
  sessionRegisteredNote = null,
) {
  const exportObjectCategories = normalizeObjectCategoryList(
    objectCategoriesIn ?? [],
  )
  const photos = Array.isArray(photosIn)
    ? photosIn.map(normalizePhoto).filter(Boolean)
    : []
  const generatedAt = new Date().toLocaleString('nb-NO', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
  const roadLabel = formatRoadSideLabel(roadSide)
  const roadMeta = roadLabel ? ` · Veg: ${roadLabel}` : ''
  const objMeta =
    exportObjectCategories.length > 0
      ? ` · Objekter: ${exportObjectCategories.map(getObjectCategoryLabel).map(escapeHtmlForExport).join(', ')}`
      : ''
  const photoMeta = photos.length
    ? ` · ${photos.length} ${photos.length === 1 ? 'bilde' : 'bilder'}`
    : ''
  const titleLine =
    typeof sessionTitle === 'string' && sessionTitle.trim()
      ? ` · Øktnavn: ${escapeHtmlForExport(
          sessionTitle.trim().slice(0, SESSION_TITLE_MAX_LEN),
        )}`
      : ''
  const registeredNoteLine =
    typeof sessionRegisteredNote === 'string' && sessionRegisteredNote.trim()
      ? ` · Hva registerte du: ${escapeHtmlForExport(
          sessionRegisteredNote.trim().slice(0, SESSION_REGISTERED_NOTE_MAX_LEN),
        )}`
      : ''
  const logForExport = Array.isArray(logEntries)
    ? logEntries.map((e) => ({
        ...e,
        message:
          e && typeof e.message === 'string'
            ? formatLogMessageForDisplay(e.message)
            : e?.message,
      }))
    : []
  const objectCategoryLabels = Object.fromEntries(
    OBJECT_CATEGORY_DEFS.map((d) => [d.id, d.label]),
  )
  const payload = jsonForHtmlScript({
    points: clickHistory,
    log: logForExport,
    photos,
    objectCategoryLabels,
  })
  const [leafletCssMod, leafletJsMod] = await Promise.all([
    import('leaflet/dist/leaflet.css?raw'),
    import('leaflet/dist/leaflet.js?raw'),
  ])
  const leafletCssRaw = leafletCssMod.default
  const leafletJsRaw = leafletJsMod.default
  const embeddedLeafletCss = leafletCssForEmbeddedExport(leafletCssRaw)
  const staticPointsHtml = buildExportStaticPointsBlock(clickHistory)
  const staticPhotosHtml = buildExportPhotosStaticBlock(photos)
  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scanix – eksportert logg</title>
  <style>
${embeddedLeafletCss}
  </style>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, "Segoe UI", sans-serif; background: #0f1218; color: #e8eaef; }
    header { padding: 0.75rem 1rem; background: #181c27; border-bottom: 1px solid #2a3142; }
    h1 { margin: 0; font-size: 1.2rem; font-weight: 600; }
    .meta { margin: 0.35rem 0 0; font-size: 0.82rem; color: #8b93a5; line-height: 1.35; }
    #map-wrap { position: relative; border-top: 1px solid #2a3142; background: #12151c; }
    .map-wrap__title { font-size: 0.98rem; font-weight: 600; margin: 0; padding: 0.55rem 1rem 0.35rem; color: #93c5fd; }
    #map { height: clamp(160px, 28vh, 260px); width: 100%; border-bottom: 1px solid #2a3142; }
    .scanix-file-hint { margin: 0; padding: 0.45rem 1rem 0.5rem; font-size: 0.78rem; color: #a8b0c4; background: #1e2433; border-bottom: 1px solid #2a3142; line-height: 1.35; }
    .scanix-map-error { margin: 0; padding: 0.55rem 1rem; font-size: 0.82rem; color: #fecaca; background: #3f1d1d; border-bottom: 1px solid #7f1d1d; display: none; }
    body.scanix-map-ok .scanix-file-hint { display: none; }
    .panel { padding: 0.65rem 1rem 1.25rem; max-width: 720px; margin: 0 auto; }
    .panel-static { padding-bottom: 0.65rem; border-bottom: 1px solid #2a3142; }
    .panel-log { padding-top: 0.5rem; }
    .scanix-static-hint { font-size: 0.82rem; color: #9aa3b5; margin: 0 0 0.35rem; line-height: 1.4; }
    .scanix-static-hint a { color: #93c5fd; }
    .scanix-static-note { font-size: 0.84rem; color: #8b93a5; margin: 0 0 0.4rem; line-height: 1.4; }
    .scanix-static-note--last { margin-bottom: 0; }
    .scanix-static-footer { margin-top: 0.5rem; padding-top: 0.45rem; border-top: 1px solid #2a3142; }
    .scanix-static-footer .scanix-static-note:last-child { margin-bottom: 0; }
    .scanix-static-points { list-style: none; margin: 0; padding: 0; font-size: 0.86rem; }
    .scanix-static-points li { padding: 0.45rem 0; border-bottom: 1px solid #2a3142; }
    .scanix-static-points li:first-child { padding-top: 0; }
    .scanix-static-points a { color: #93c5fd; }
    h2 { font-size: 0.98rem; margin: 0 0 0.35rem; color: #93c5fd; font-weight: 600; }
    .log-list { list-style: none; margin: 0; padding: 0; font-size: 0.86rem; }
    .log-list li { padding: 0.55rem 0; border-bottom: 1px solid #2a3142; }
    .log-list time { display: block; color: #60a5fa; font-size: 0.8rem; margin-bottom: 0.25rem; }
    .leaflet-container { background: #1a1d26; }
    .scanix-pin-wrap { background: transparent !important; border: none !important; }
  </style>
</head>
<body>
  <header>
    <h1>Scanix – eksportert logg</h1>
    <p class="meta">Generert ${generatedAt} · Røde nåler viser hvert registrert trykk med GPS.${roadMeta}${objMeta}${photoMeta}${titleLine}${registeredNoteLine}</p>
  </header>
  <div class="panel panel-static">
    <h2>Registrerte punkt</h2>
    ${staticPointsHtml}
  </div>
  <div class="panel panel-log">
    <h2>Tekstlogg</h2>
    <ul class="log-list" id="log-lines"></ul>
  </div>
  <div id="map-wrap">
    <h2 class="map-wrap__title">Kart</h2>
    <p id="scanix-map-error" class="scanix-map-error" role="alert"></p>
    <p class="scanix-file-hint">Får du ikke kart her: i <strong>Filer</strong> trykker du <strong>Del</strong> (rundt ikon med pil) og velger <strong>Åpne i Safari</strong> – forhåndsvisning i Filer kjører ofte ikke kart. Kart trenger internett.</p>
    <div id="map"></div>
  </div>
  <script type="application/json" id="scanix-data">${payload}</script>
  <script>
${leafletJsRaw}
  </script>
  <script>
(function () {
  var data = JSON.parse(document.getElementById('scanix-data').textContent)
  var points = data.points || []
  var log = data.log || []
  var labels = data.objectCategoryLabels || {}
  var mapErrorEl = document.getElementById('scanix-map-error')

  function showMapError(msg) {
    if (mapErrorEl) {
      mapErrorEl.textContent = msg
      mapErrorEl.style.display = 'block'
    }
  }

  function hideFileHint() {
    document.body.classList.add('scanix-map-ok')
  }

  function renderLog() {
    var ul = document.getElementById('log-lines')
    if (!ul) return
    function esc(s) {
      var d = document.createElement('div')
      d.textContent = s
      return d.innerHTML
    }
    if (!log.length) {
      ul.innerHTML = '<li>Ingen tekstlinjer.</li>'
    } else {
      log.forEach(function (entry) {
        var li = document.createElement('li')
        var time = entry.timestamp
          ? new Date(entry.timestamp).toLocaleString('nb-NO')
          : ''
        li.innerHTML =
          '<time datetime="' + esc(entry.timestamp || '') + '">' +
          esc(time) +
          '</time>' +
          esc(entry.message || '')
        ul.appendChild(li)
      })
    }
  }

  renderLog()

  try {
    if (typeof ${'L'} === 'undefined') {
      showMapError(
        'Kart kan ikke vises her (JavaScript for kart er ikke aktiv). I Filer: trykk Del → Åpne i Safari.',
      )
      return
    }

    var map = ${'L'}.map('map', { zoomControl: true })

    var osmLayer = ${'L'}.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      },
    )

    var cartoLayer = ${'L'}.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      },
    )

    function onFirstTile() {
      hideFileHint()
      osmLayer.off('tileload', onFirstTile)
      cartoLayer.off('tileload', onFirstTile)
    }

    osmLayer.on('tileload', onFirstTile)
    cartoLayer.on('tileload', onFirstTile)

    osmLayer.once('tileerror', function () {
      if (map.hasLayer(osmLayer)) {
        map.removeLayer(osmLayer)
        cartoLayer.addTo(map)
      }
    })

    osmLayer.addTo(map)

    var valid = points.filter(function (p) {
      return (
        p.lat != null &&
        p.lng != null &&
        !Number.isNaN(Number(p.lat)) &&
        !Number.isNaN(Number(p.lng))
      )
    })

    function escPopup(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    }

    var pinHtml =
      '<div style="display:flex;align-items:flex-end;justify-content:center;box-sizing:border-box;width:32px;height:40px">' +
      '<div style="width:28px;height:28px;flex-shrink:0;margin:0;background:linear-gradient(145deg,#ef4444,#b91c1c);border-radius:50% 50% 50% 0;transform:rotate(-45deg);transform-origin:50% 100%;border:3px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,.45)"></div></div>'
    var pinIcon = ${'L'}.divIcon({
      className: 'scanix-pin-wrap',
      html: pinHtml,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
    })

    var bounds = []
    valid.forEach(function (p, i) {
      var latlng = [Number(p.lat), Number(p.lng)]
      bounds.push(latlng)
      var t = p.timestamp
        ? new Date(p.timestamp).toLocaleString('nb-NO')
        : ''
      var catLine = ''
      if (p.category) {
        var lab = labels[p.category] || p.category
        catLine = escPopup(lab) + '<br>'
      }
      ${'L'}.marker(latlng, { icon: pinIcon })
        .addTo(map)
        .bindPopup('<strong>Trykk #' + (i + 1) + '</strong><br>' + catLine + escPopup(t))
    })

    if (bounds.length === 0) {
      map.setView([59.9139, 10.7522], 13)
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15)
    } else {
      map.fitBounds(${'L'}.latLngBounds(bounds), { padding: [48, 48], maxZoom: 17 })
    }

    map.whenReady(function () {
      setTimeout(function () {
        map.invalidateSize()
      }, 0)
      setTimeout(function () {
        map.invalidateSize()
      }, 200)
      setTimeout(function () {
        map.invalidateSize()
      }, 600)
    })

    window.addEventListener('pageshow', function () {
      setTimeout(function () {
        map.invalidateSize()
      }, 0)
    })
  } catch (e) {
    showMapError(
      'Kunne ikke vise kart: ' + (e && e.message ? e.message : 'ukjent feil'),
    )
  }
})()
  </script>
</body>
</html>`
}

window.addEventListener('storage', (ev) => {
  if (!currentUser?.id) return
  const syncKey = sessionsKeyForUser(currentUser.id)
  if (ev.key !== syncKey || !ev.newValue) return
  try {
    const p = JSON.parse(ev.newValue)
    const nextSessions = Array.isArray(p.sessions)
      ? p.sessions.map(normalizeSession).filter(Boolean)
      : []
    const prevById = new Map(sessions.map((s) => [s.id, s]))
    const nextById = new Map(nextSessions.map((s) => [s.id, s]))
    const allIds = new Set([...prevById.keys(), ...nextById.keys()])
    const mergedList = []
    for (const id of allIds) {
      const l = prevById.get(id)
      const r = nextById.get(id)
      if (!l) {
        mergedList.push(/** @type {NonNullable<typeof r>} */ (r))
        continue
      }
      if (!r) {
        mergedList.push(l)
        continue
      }
      const mergedSess = mergeStoredSessionsPair(l, r)
      mergedList.push(mergedSess)
    }
    sessions = mergedList
    if (Array.isArray(p.standalonePhotos)) {
      standalonePhotos = mergeStandalonePhotoLists(
        standalonePhotos,
        normalizeStandalonePhotosList(p.standalonePhotos),
      )
    }
    if (view === 'photoAlbum') {
      renderStandalonePhotoAlbumGallery()
    }
    const remoteCurrent =
      typeof p.currentSessionId === 'string' ? p.currentSessionId : null
    if (
      view === 'session' &&
      currentSessionId &&
      currentSessionId === remoteCurrent
    ) {
      const s = sessions.find((x) => x.id === currentSessionId)
      if (s) {
        state = {
          count: s.count,
          clickHistory: [...s.clickHistory],
          log: [...s.log],
          roadSide: s.roadSide ?? null,
          photos: Array.isArray(s.photos)
            ? s.photos.map(normalizePhoto).filter(Boolean)
            : [],
          objectCategories: normalizeObjectCategoryList(s.objectCategories),
          activeCategoryId:
            typeof s.activeCategoryId === 'string' &&
            normalizeObjectCategoryList(s.objectCategories).includes(
              s.activeCategoryId,
            )
              ? s.activeCategoryId
              : normalizeObjectCategoryList(s.objectCategories)[0] ?? null,
        }
        rebuildMarkers()
        renderCount()
        renderLog()
      }
    }
  } catch {
    /* ignore */
  }
})
