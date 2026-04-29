import { registerSW } from 'virtual:pwa-register'
import {
  bearingDeg,
  clearSegmentNearCache,
  fetchRoadReferenceNearOnline,
  fetchRoadPositionDirect,
  normalizeSurfacePreference,
} from './nvdbVegref.js'
import {
  appendOfflineBundledSegments,
  getOfflineVegrefMeta,
  hasOfflineVegrefPackage,
  importOfflineVegrefPackage,
  mergeNvdbSegmentsIntoOfflineDb,
  resolveOfflineRoadReferenceNear,
  recomputeOfflinePackageCoverageBboxIfMissing,
  syncOfflinePackageCoverageFromMeta,
  isLatLngInsideOfflinePackageCoverage,
} from './vegrefLocal.js'
import {
  abortPrefetchInFlight,
  initPrefetch,
  resetPrefetch,
  prefetchNotifyGps,
  isLatLngInsidePrefetchCoverage,
} from './vegrefPrefetch.js'
import {
  initDelegator,
  resolveVegref,
  setDelegatorAllowOnlineFallback,
} from './vegrefDelegator.js'
import {
  bboxIsValid,
  expandBboxKm,
  estimateAreaKm2,
  fetchNvdbSegmentsForBbox,
} from './nvdbSegmentertBulk.js'
import {
  initVegrefLive,
  vegrefNotifyGps,
  vegrefStopPipeline,
  vegrefReapplyLastToDom,
  vegrefHasLastDisplay,
  vegrefResetSessionCache,
  vegrefResetThrottle,
  vegrefClearSegmentLock,
  vegrefGetLastSpeed,
  vegrefHydrateFromPersisted,
} from './vegrefLive.js'
import {
  APP_MAP_MAX_ZOOM,
  APP_MAP_TILE_IMG_FILTER,
  APP_MAP_TILE_LAYER_DATA_SAVER,
  applyAppMapTileContrastToDom,
  createAppBasemapLayer,
  ensureLeaflet,
  nudgeMaptilerBasemapResize,
  ensureLeafletMarkerCluster,
  getRasterBasemapTileSpec,
  Leaflet,
} from './leafletLazy.js'
import { getSessionMapDarkPreference } from './sessionMapBasemapPref.js'
import {
  SESSION_MAP_THEME_DOT_POS_KEY,
  syncMapThemeDockDom,
  wireMapThemeDock,
} from './mapThemeDock.js'
import { attachRasterBasemapViewportSwWarm } from './mapBasemapSwWarm.js'
import { getSupabase, isSupabaseConfigured } from './supabaseClient.js'
import {
  postScanixDebugIngest,
  postScanixDebugPayload,
  isScanixDebugIngestAllowed,
} from './scanixDebugIngest.js'
import { syncLaunchSplash } from './launchTransition.js'
import { initScreenWakeLock } from './screenWakeLock.js'
import {
  initNativeNetworkStatusListener,
  isCapacitorNativePlatform,
  onNativeWifiOrEthernet,
} from './nativeNetworkMetered.js'
import {
  initHomeWeather,
  refreshHomeWeatherOnHomeEnter,
  resetHomeWeather,
  scheduleHomeWeatherFromPosition,
} from './homeWeather.js'
import { getVegrefMetrics, logVegrefMetric } from './vegrefMetrics.js'
import {
  getVegrefDebugTraceEntries,
  isVegrefDebugTraceEnabled,
  setVegrefDebugTraceEnabled,
  vegrefDebugTrace,
  clearVegrefDebugTrace,
} from './vegrefDebugTrace.js'
import {
  traceHomeVegrefAnomalies,
  resetVegrefAnomalyState,
} from './vegrefDebugAnomalies.js'
import {
  isRegisterTraceDebugEnabled,
  isRegisterTraceDebugPersisted,
  regtraceLocalStorageWrite,
  regtraceRebuildMarkers,
  regtraceSessionAfterPersistFlush,
  setRegtracePersistReason,
  setRegisterTraceDebugPersisted,
} from './registerTraceDebug.js'
import {
  compressAppStateJsonForLocalStorage,
  decompressAppStateJsonFromLocalStorage,
} from './appStateStorageCodec.js'
import {
  isRegisterNetworkDebugPersisted,
  registerNetLogRegisterTap,
  registerNetLogSupabasePushSkipped,
  registerNetLogVegrefEnrich,
  registerNetSetActiveVegrefClickId,
  setRegisterNetworkDebugPersisted,
} from './registerNetworkDebug.js'
import {
  HAPTIC_PROFILES,
  previewHapticFeedback,
  readHapticEnabled,
  readHapticProfileId,
  triggerHapticAiReply,
  triggerHapticMark,
  triggerHapticPhoto,
  writeHapticEnabled,
  writeHapticProfileId,
} from './hapticFeedback.js'
import {
  attachClickPopupVoiceLongPress,
  splitTranscriptToLabelComment,
} from './voiceClickPopup.js'
import appPackage from '../package.json'
import {
  buildCurrentUserFromSession,
  deleteSessionShareRow,
  fetchIncomingSessionShares,
  fetchStandalonePhotosForFolder,
  sendSessionShare,
} from './supabaseSync.js'
import {
  fetchRemoteUserAppState,
  isRemoteAppStateDataEnabled,
  isScanixCloudApiConfigured,
  upsertRemoteUserAppState,
} from './remoteAppStateBackend.js'
import {
  cloudFetchStorageUsageSummary,
  cloudGetSessionSharePayload,
  cloudGetSignedReadUrlForPhotoPath,
  cloudProbeAppStateExists,
} from './scanixCloudApi.js'
import {
  getPhotoDataUrl,
  isPhotoBlobStoreAvailable,
  prunePhotoBlobsExcept,
  putPhotoDataUrl,
} from './photoBlobStore.js'
import {
  enqueuePhotoStorageUpload,
  ensureStorageFullPathParallelToThumb,
  ensureStorageThumbPathParallelToFull,
  getHeavyCloudTrafficDeferralReason,
  getPhotoUploadQueueCount,
  getPhotoUploadQueueDeferralUi,
  makeThumbDataUrlFromDataUrl,
  PHOTO_STORAGE_BUCKET,
  preparePhotosArrayForShareRpc,
  readPhotoUploadAllowOnCellular,
  sanitizeUserAppStateForSupabasePayload,
  setPhotoStorageUploadCallbacks,
  shouldDeferPhotoUploadOnNetwork,
  tryDrainPhotoUploadQueue,
  writePhotoUploadAllowOnCellular,
} from './photoStorageUpload.js'
import {
  estimateDelskyOverlayDurationMs,
  runDelskySyncWithOverlay,
} from './delskyUploadOverlay.js'
import {
  isMinDownloadBuild,
  isMinDownloadMode,
  setPilotMinDownloadUserPref,
} from './buildFlags.js'
import { refreshNativeNetworkStatus } from './nativeNetworkMetered.js'
import { apiUrl } from './apiBase.js'
import {
  configureAdvancedRegister,
  renderAdvancedRegisterIntroHtml,
  renderAdvancedRegisterSessionHtml,
  renderAdvancedRegisterReportHtml,
  bindAdvancedRegister,
  invalidateAdvRegMapSize,
} from './advancedRegister.js'
import {
  downloadExcelSheetGrid,
  downloadFrictionMeasurementsXlsx,
  excelAoaToXlsxBlob,
  loadExcelSheetState,
  resetExcelSheetState,
  saveExcelSheetState,
} from './excelSheetExport.js'
import {
  renderFinnObjekterHtml,
  initFinnObjekterMap,
  destroyFinnObjekterMap,
  bindFinnObjekterListeners,
} from './finnObjekter.js'
import {
  createEmptyFollowUpRoute,
  getRoadSuggestionsForDatalist,
  loadFollowUpRoutes,
  mergeFollowUpRoutesByUpdatedAt,
  normalizeFollowUpRoutesList,
  normalizeRoadToken,
  parseFollowUpRoutesImport,
  recordRoadSuggestion,
  resolveFollowUpPoint,
  saveFollowUpRoutes,
  serializeFollowUpRoutesExport,
} from './followUpRoute.js'

const STORAGE_KEY_V2 = 'scanix-sessions-v2'
const STORAGE_KEY_DEVICE_FALLBACK = 'scanix-sessions-v2-device-fallback'
const STORAGE_KEY_CORE_SUFFIX = 'scanix-sessions-v2-core'
const STORAGE_KEY_EMERGENCY_DELTA = 'scanix-sessions-v2-emergency-delta'
const STORAGE_DEBUG_TRACE_KEY = 'scanix-storage-debug-trace-v1'
const STORAGE_DEBUG_TRACE_ENABLED_KEY = 'scanix-storage-debug-enabled-v1'
const STORAGE_DEBUG_TRACE_MAX = 180
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
/** Kart-popup for enkeltregistrering: valgfri tittel + kommentar. */
const CLICK_ENTRY_LABEL_MAX_LEN = 120
const CLICK_ENTRY_COMMENT_MAX_LEN = 1200
const AUTH_PASSWORD_MIN_LEN = 8
const AUTH_NAME_MAX_LEN = 120
const AUTH_SHORT_ID_LEN = 5
const OFFLINE_VEGREF_MANIFEST_URL = '/offline/vegref-manifest.json'

/** Når `true`: vegref-pakke følger med web-/app-bygget (public/offline), ikke hentes fra ekstern URL. */
function isBundledOfflineVegref() {
  try {
    return import.meta.env.VITE_OFFLINE_VEGREF_BUNDLED === '1'
  } catch {
    return false
  }
}

// #region agent log (debug ff8b7b — fjern etter verifisert fiks)
/** @param {string} hypothesisId @param {string} location @param {string} message @param {Record<string, unknown>} [data] */
function scanixDebugFreezeLog(hypothesisId, location, message, data = {}) {
  if (!isScanixDebugIngestAllowed()) return
  try {
    let body = ''
    try {
      body = JSON.stringify({
        sessionId: 'ff8b7b',
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      })
    } catch {
      body = JSON.stringify({
        sessionId: 'ff8b7b',
        hypothesisId,
        location,
        message: String(message).slice(0, 120),
        data: {},
        timestamp: Date.now(),
      })
    }
    postScanixDebugIngest(body)
  } catch {
    /* aldri kast fra feillogg — unngå sekundærkrasj i error-handlere */
  }
}
// #endregion

/**
 * I innebygd-modus: tillat kun relative stier eller same-origin (ingen CDN-URL i manifest).
 * @param {string} url
 */
function assertBundledSafeDataUrl(url) {
  if (!isBundledOfflineVegref()) return
  const s = String(url).trim()
  if (!s) throw new Error('Tom data-URL')
  if (s.startsWith('/')) return
  if (typeof window === 'undefined' || !window.location?.origin) return
  try {
    const u = new URL(s, window.location.origin)
    if (u.origin === window.location.origin) return
  } catch {
    /* fallthrough */
  }
  throw new Error(
    'Innebygd vegref-modus: manifest må bruke relative dataUrl-er (f.eks. /offline/...), ikke ekstern vert.',
  )
}

let offlineVegrefReady = false
let offlineVegrefMeta = null
let offlineVegrefSyncBusy = false
let offlineVegrefSyncError = ''
let offlineVegrefSyncStatus = 'Ikke lastet ned'


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

/** Lokal nøkkel når brukerprofil/sesjon midlertidig mangler. */
function sessionsKeyForCurrentContext() {
  return currentUser?.id
    ? sessionsKeyForUser(currentUser.id)
    : STORAGE_KEY_DEVICE_FALLBACK
}

/**
 * Per bruker/enhet: liten «nødsnapshot» skrevet synkront ved app-lukk.
 * Brukes hvis full (asynkron) save ikke rekker ferdig før iOS dreper appen.
 */
function emergencyDeltaKeyForCurrentContext() {
  return `${sessionsKeyForCurrentContext()}-${STORAGE_KEY_EMERGENCY_DELTA}`
}

function coreSnapshotKeyForCurrentContext() {
  return `${sessionsKeyForCurrentContext()}-${STORAGE_KEY_CORE_SUFFIX}`
}

/**
 * @param {string} userId
 */
function coreSnapshotKeyForUser(userId) {
  return `${sessionsKeyForUser(userId)}-${STORAGE_KEY_CORE_SUFFIX}`
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

async function refreshOfflineVegrefState() {
  offlineVegrefMeta = await getOfflineVegrefMeta().catch(() => null)
  if (offlineVegrefMeta && !offlineVegrefMeta.coverageBbox) {
    await recomputeOfflinePackageCoverageBboxIfMissing().catch(() => null)
    offlineVegrefMeta = await getOfflineVegrefMeta().catch(() => null)
  }
  syncOfflinePackageCoverageFromMeta(offlineVegrefMeta)
  offlineVegrefReady = Boolean(offlineVegrefMeta)
  if (offlineVegrefReady) {
    abortPrefetchInFlight()
  }
  if (offlineVegrefMeta) {
    const version =
      typeof offlineVegrefMeta.version === 'string'
        ? offlineVegrefMeta.version
        : 'ukjent'
    const count =
      typeof offlineVegrefMeta.count === 'number' ? offlineVegrefMeta.count : 0
    offlineVegrefSyncStatus = `Klar (${version}, ${count} segmenter)`
  } else {
    offlineVegrefSyncStatus = 'Ikke lastet ned'
  }
}

function rerenderIfViewingSettings() {
  if (view !== 'menuSettings') return
  renderApp()
  bindListenersForCurrentView()
}

/** @type {Promise<object | null> | null} */
let offlineVegrefEnsurePromise = null

/**
 * @param {{ force?: boolean }} [options]
 *   `force: true` laster ned på nytt selv om pakke finnes (knappen «Oppdater offline-pakke»).
 */
async function ensureOfflineVegrefPackage(options = {}) {
  const force = Boolean(options.force)
  if (!force && offlineVegrefEnsurePromise) {
    return offlineVegrefEnsurePromise
  }
  const p = ensureOfflineVegrefPackageImpl(options)
  if (!force) {
    offlineVegrefEnsurePromise = p
    void p.finally(() => {
      if (offlineVegrefEnsurePromise === p) offlineVegrefEnsurePromise = null
    })
  }
  return p
}

async function ensureOfflineVegrefPackageImpl(options = {}) {
  const force = Boolean(options.force)
  await refreshOfflineVegrefState()
  if (offlineVegrefReady && !force) return offlineVegrefMeta

  offlineVegrefSyncBusy = true
  offlineVegrefSyncError = ''
  offlineVegrefSyncStatus = isBundledOfflineVegref()
    ? 'Installerer innebygd vegreferanse-pakke …'
    : 'Laster ned offline vegreferanse ...'
  rerenderIfViewingSettings()
  try {
    /** @type {object | null} */
    let manifest = null
    try {
      const r = await fetch(OFFLINE_VEGREF_MANIFEST_URL, { cache: 'no-store' })
      if (!r.ok) {
        offlineVegrefSyncStatus = 'Offline-pakke ikke tilgjengelig'
        return null
      }
      manifest = await r.json()
    } catch {
      offlineVegrefSyncStatus = 'Kunne ikke hente offline-manifest'
      return null
    }
    const dataUrl =
      manifest && typeof manifest.dataUrl === 'string' ? manifest.dataUrl : ''
    const regionTiles = Array.isArray(manifest.regionTiles)
      ? manifest.regionTiles
      : []
    const tileUrls = regionTiles
      .map((t) =>
        t && typeof t.dataUrl === 'string' ? t.dataUrl.trim() : '',
      )
      .filter(Boolean)
    if (!dataUrl && tileUrls.length === 0) {
      offlineVegrefSyncStatus = 'Manifest mangler datafil'
      return null
    }
    try {
      const versionStr =
        typeof manifest.version === 'string' && manifest.version.trim()
          ? manifest.version.trim()
          : 'unknown'
      const generatedAtStr =
        typeof manifest.generatedAt === 'string' ? manifest.generatedAt : null

      if (tileUrls.length > 0) {
        for (let ti = 0; ti < tileUrls.length; ti += 1) {
          const url = tileUrls[ti]
          assertBundledSafeDataUrl(url)
          offlineVegrefSyncStatus = isBundledOfflineVegref()
            ? `Installerer flis ${ti + 1} av ${tileUrls.length} …`
            : `Laster flis ${ti + 1} av ${tileUrls.length} …`
          rerenderIfViewingSettings()
          const dataRes = await fetch(url, { cache: 'no-store' })
          if (!dataRes.ok) {
            offlineVegrefSyncStatus = 'Kunne ikke laste offline-flis'
            return null
          }
          const pkg = await dataRes.json()
          const segs = Array.isArray(pkg?.segments) ? pkg.segments : []
          if (ti === 0) {
            await importOfflineVegrefPackage({
              version: versionStr,
              generatedAt: generatedAtStr,
              segments: segs,
            })
          } else {
            await appendOfflineBundledSegments(segs)
          }
        }
        await refreshOfflineVegrefState()
        return offlineVegrefMeta
      }

      if (dataUrl) {
        assertBundledSafeDataUrl(dataUrl)
        const dataRes = await fetch(dataUrl, { cache: 'no-store' })
        if (!dataRes.ok) {
          offlineVegrefSyncStatus = 'Kunne ikke laste offline-data'
          return null
        }
        const pkg = await dataRes.json()
        const segs = Array.isArray(pkg?.segments) ? pkg.segments : []
        if (!segs.length) {
          offlineVegrefSyncStatus = 'Offline-data er tom'
          return null
        }
        await importOfflineVegrefPackage({
          version: versionStr,
          generatedAt: generatedAtStr,
          segments: segs,
        })
        await refreshOfflineVegrefState()
        return offlineVegrefMeta
      }
    } catch (e) {
      if (isBundledOfflineVegref() && e instanceof Error && e.message.includes('Innebygd')) {
        offlineVegrefSyncError = e.message
      } else {
        offlineVegrefSyncError =
          isBundledOfflineVegref()
            ? 'Installasjon av innebygd offline-data feilet.'
            : 'Nedlasting eller import av offline-data feilet.'
      }
      offlineVegrefSyncStatus = 'Offline-import feilet'
      return null
    }
  } finally {
    offlineVegrefSyncBusy = false
    rerenderIfViewingSettings()
  }
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
 * @param {unknown} tsRaw
 * @returns {string}
 */
function formatPhotoOverlayTimestamp(tsRaw) {
  const ts = typeof tsRaw === 'string' ? tsRaw.trim() : ''
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('nb-NO', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return d.toISOString().replace('T', ' ').slice(0, 19)
  }
}

/**
 * Mappe-navn per vei for album / eksport (virtuell sti: images/NAME/).
 * @param {string} [name]
 */
function normalizeRoadFolderName(name) {
  if (!name) return 'UKJENT_VEG'

  return String(name)
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
}

/**
 * NVDB-kilde for mappe (KMT): samme korte kjede som getVegrefHomeMirrorStrings.folderSeed — fra skjult felt satt i applyKmtResult.
 * @param {{ vegref?: { road: string, compact: string, kortform: string } | null }} [opts]
 */
function resolveKmtPhotoFolderSeed(opts = {}) {
  const el =
    typeof document !== 'undefined'
      ? document.getElementById('kmt-road-folder-src')
      : null
  const fromDom = el?.textContent?.trim() || ''
  if (fromDom) return fromDom
  if (opts.vegref) {
    const v = normalizePhotoVegref(opts.vegref)
    if (v?.road) return v.road
  }
  return ''
}

/**
 * @param {{ road: string, compact: string, kortform: string }} v
 */
function formatPhotoVegrefOverlayLinesHtml(v, noteOpt, timestampTextOpt = '') {
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
  if (typeof noteOpt === 'string' && noteOpt.trim()) {
    const n = noteOpt.trim().slice(0, 800)
    if (n) {
      parts.push(
        `<div class="photo-vegref-overlay__note">${escapeHtml(n)}</div>`,
      )
    }
  }
  if (typeof timestampTextOpt === 'string' && timestampTextOpt.trim()) {
    parts.push(
      `<div class="photo-vegref-overlay__time">${escapeHtml(timestampTextOpt.trim())}</div>`,
    )
  }
  return parts.join('')
}

/**
 * @param {{ road: string, compact: string, kortform: string }} v
 * @param {'thumb' | 'fullscreen'} variant
 */
function formatPhotoVegrefOverlayHtml(v, variant, noteOpt, timestampTextOpt = '') {
  const inner = formatPhotoVegrefOverlayLinesHtml(v, noteOpt, timestampTextOpt)
  if (!inner) return ''
  const cls =
    variant === 'fullscreen'
      ? 'photo-vegref-overlay photo-vegref-overlay--fullscreen'
      : 'photo-vegref-overlay photo-vegref-overlay--thumb'
  return `<div class="${cls}" aria-hidden="true">${inner}</div>`
}

/** Miniatyr-overlay: vegreferanse og/eller valgfri kommentar. */
function formatPhotoThumbOverlayHtml(ph) {
  const v = ph?.vegref && normalizePhotoVegref(ph.vegref)
  const note = typeof ph?.note === 'string' ? ph.note : ''
  const ts =
    ph?.captureWithVegrefDateTime === true
      ? formatPhotoOverlayTimestamp(ph?.timestamp)
      : ''
  if (!v && !note.trim()) return ''
  return formatPhotoVegrefOverlayHtml(
    v || { road: '', compact: '', kortform: '' },
    'thumb',
    note,
    ts,
  )
}

/**
 * Primær tittel på album-rad (samme logikk som mappe-badge FV…).
 * @param {{ imageFolder?: string | null, vegref?: unknown, note?: string }} ph
 */
function formatPhotoAlbumRowTitle(ph) {
  if (ph?.imageFolder && String(ph.imageFolder).trim()) {
    return String(ph.imageFolder).trim()
  }
  const v = ph?.vegref && normalizePhotoVegref(ph.vegref)
  if (v?.road) {
    const r = v.road
    return r.length > 40 ? `${r.slice(0, 38)}…` : r
  }
  const note = typeof ph?.note === 'string' ? ph.note.trim() : ''
  if (note) return note.length > 28 ? `${note.slice(0, 26)}…` : note
  return 'Bilde'
}

/**
 * Sekundær linje under tittel (kompakt vegref / notat).
 * @param {{ vegref?: unknown, note?: string }} ph
 * @param {string} [titleStr] — unngå duplikat når tittel = samme som hint
 */
function formatPhotoAlbumRowHint(ph, titleStr = '') {
  const v = ph?.vegref && normalizePhotoVegref(ph.vegref)
  let hint = ''
  if (v?.compact) hint = v.compact
  else if (v?.kortform) hint = v.kortform
  else if (v?.road) hint = v.road
  if (!hint) {
    const note = typeof ph?.note === 'string' ? ph.note.trim() : ''
    if (note) hint = note.length > 52 ? `${note.slice(0, 50)}…` : note
  }
  if (!hint) return 'Trykk for å åpne'
  if (titleStr && hint === titleStr) {
    const note = typeof ph?.note === 'string' ? ph.note.trim() : ''
    if (note && note !== titleStr)
      return note.length > 52 ? `${note.slice(0, 50)}…` : note
    return 'Trykk for å åpne'
  }
  return hint
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
  const hasFolderKey = 'imageFolder' in p
  const rawFolder = /** @type {{ imageFolder?: unknown }} */ (p).imageFolder
  const imageFolder =
    hasFolderKey && typeof rawFolder === 'string'
      ? normalizeRoadFolderName(rawFolder)
      : null
  const imagePath =
    imageFolder != null ? `images/${imageFolder}/` : null
  const rawNote = /** @type {{ note?: unknown }} */ (p).note
  const note =
    typeof rawNote === 'string' && rawNote.trim()
      ? rawNote.trim().slice(0, 800)
      : undefined
  const thumbDataUrl =
    typeof /** @type {{ thumbDataUrl?: unknown }} */ (p).thumbDataUrl ===
      'string' &&
    /** @type {{ thumbDataUrl?: string }} */ (p).thumbDataUrl.startsWith(
      'data:image/',
    )
      ? /** @type {{ thumbDataUrl: string }} */ (p).thumbDataUrl
      : null
  const storageFullPath =
    typeof /** @type {{ storageFullPath?: unknown }} */ (p)
      .storageFullPath === 'string' &&
    /** @type {{ storageFullPath?: string }} */ (p).storageFullPath.trim()
      ? /** @type {{ storageFullPath: string }} */ (p).storageFullPath.trim()
      : null
  const storageThumbPath =
    typeof /** @type {{ storageThumbPath?: unknown }} */ (p)
      .storageThumbPath === 'string' &&
    /** @type {{ storageThumbPath?: string }} */ (p).storageThumbPath.trim()
      ? /** @type {{ storageThumbPath: string }} */ (p).storageThumbPath.trim()
      : null
  const captureWithVegrefDateTime =
    /** @type {{ captureWithVegrefDateTime?: unknown }} */ (p)
      .captureWithVegrefDateTime === true
  return /** @type {NonNullable<ReturnType<typeof normalizePhoto>>} */ (
    ensureStorageFullPathParallelToThumb(
      ensureStorageThumbPathParallelToFull({
        id: typeof p.id === 'string' ? p.id : crypto.randomUUID(),
        timestamp: typeof p.timestamp === 'string' ? p.timestamp : nowIso(),
        lat:
          rawLat != null && !Number.isNaN(Number(rawLat)) ? Number(rawLat) : null,
        lng:
          rawLng != null && !Number.isNaN(Number(rawLng)) ? Number(rawLng) : null,
        dataUrl,
        ...(vegref ? { vegref } : {}),
        ...(note ? { note } : {}),
        ...(imageFolder != null && imagePath != null
          ? { imageFolder, imagePath }
          : {}),
        ...(thumbDataUrl ? { thumbDataUrl } : {}),
        ...(storageFullPath ? { storageFullPath } : {}),
        ...(storageThumbPath ? { storageThumbPath } : {}),
        ...(captureWithVegrefDateTime ? { captureWithVegrefDateTime: true } : {}),
      }),
    )
  )
}

/**
 * Som normalizePhoto, men beholder metadata uten piksel (etter lett sky-synk).
 * `pixelPending` settes når dataUrl mangler — hentes ved åpning av bilde-mappe / økt.
 * @param {unknown} p
 */
function normalizePhotoOrSkeleton(p) {
  const full = normalizePhoto(p)
  if (full) return full
  if (!p || typeof p !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (p)
  const id = typeof o.id === 'string' ? o.id : null
  if (!id) return null
  const rawLat = o.lat != null ? o.lat : o.latitude
  const rawLng = o.lng != null ? o.lng : o.longitude
  const vegref = normalizePhotoVegref(o.vegref)
  const hasFolderKey = 'imageFolder' in o
  const rawFolder = o.imageFolder
  const imageFolder =
    hasFolderKey && typeof rawFolder === 'string'
      ? normalizeRoadFolderName(rawFolder)
      : null
  const imagePath =
    imageFolder != null ? `images/${imageFolder}/` : null
  const rawNote = o.note
  const note =
    typeof rawNote === 'string' && rawNote.trim()
      ? rawNote.trim().slice(0, 800)
      : undefined
  const thumbDataUrl =
    typeof o.thumbDataUrl === 'string' && o.thumbDataUrl.startsWith('data:image/')
      ? o.thumbDataUrl
      : null
  const storageFullPath =
    typeof o.storageFullPath === 'string' && o.storageFullPath.trim()
      ? o.storageFullPath.trim()
      : null
  const storageThumbPath =
    typeof o.storageThumbPath === 'string' && o.storageThumbPath.trim()
      ? o.storageThumbPath.trim()
      : null
  const captureWithVegrefDateTime = o.captureWithVegrefDateTime === true
  if (thumbDataUrl || storageFullPath || storageThumbPath) {
    const pathPair = /** @type {{ storageFullPath?: string, storageThumbPath?: string }} */ (
      ensureStorageFullPathParallelToThumb(
        ensureStorageThumbPathParallelToFull({
          ...(storageFullPath ? { storageFullPath } : {}),
          ...(storageThumbPath ? { storageThumbPath } : {}),
        }),
      )
    )
    const augFull =
      typeof pathPair.storageFullPath === 'string'
        ? pathPair.storageFullPath.trim()
        : null
    const augThumb =
      typeof pathPair.storageThumbPath === 'string'
        ? pathPair.storageThumbPath.trim()
        : null
    const pixelPending = !thumbDataUrl && Boolean(augFull)
    return /** @type {NonNullable<ReturnType<typeof normalizePhotoOrSkeleton>>} */ ({
      id,
      timestamp: typeof o.timestamp === 'string' ? o.timestamp : nowIso(),
      lat:
        rawLat != null && !Number.isNaN(Number(rawLat)) ? Number(rawLat) : null,
      lng:
        rawLng != null && !Number.isNaN(Number(rawLng)) ? Number(rawLng) : null,
      ...(thumbDataUrl ? { thumbDataUrl } : {}),
      ...(augFull ? { storageFullPath: augFull } : {}),
      ...(augThumb ? { storageThumbPath: augThumb } : {}),
      ...(pixelPending ? { pixelPending: true } : {}),
      ...(vegref ? { vegref } : {}),
      ...(note ? { note } : {}),
      ...(captureWithVegrefDateTime ? { captureWithVegrefDateTime: true } : {}),
      ...(imageFolder != null && imagePath != null
        ? { imageFolder, imagePath }
        : {}),
    })
  }
  return {
    id,
    timestamp: typeof o.timestamp === 'string' ? o.timestamp : nowIso(),
    lat:
      rawLat != null && !Number.isNaN(Number(rawLat)) ? Number(rawLat) : null,
    lng:
      rawLng != null && !Number.isNaN(Number(rawLng)) ? Number(rawLng) : null,
    pixelPending: true,
    ...(vegref ? { vegref } : {}),
    ...(note ? { note } : {}),
    ...(captureWithVegrefDateTime ? { captureWithVegrefDateTime: true } : {}),
    ...(imageFolder != null && imagePath != null
      ? { imageFolder, imagePath }
      : {}),
  }
}

function normalizeStandalonePhotosList(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map(normalizePhotoOrSkeleton).filter(Boolean)
}

/**
 * Fyller inn dataUrl fra IndexedDB for poster lagret med idbImage.
 * @param {unknown[]} raw
 */
async function hydratePhotoRecordsArray(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const p = /** @type {Record<string, unknown>} */ (item)
    let dataUrl =
      typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:image/')
        ? p.dataUrl
        : null
    const id = typeof p.id === 'string' ? p.id : null
    if (!dataUrl && id) {
      try {
        const fromIdb = await getPhotoDataUrl(id)
        if (
          typeof fromIdb === 'string' &&
          fromIdb.startsWith('data:image/')
        ) {
          dataUrl = fromIdb
        }
      } catch {
        /* ignore */
      }
    }
    if (dataUrl) {
      out.push({ ...p, dataUrl })
      continue
    }
    const skel = normalizePhotoOrSkeleton(p)
    if (skel) out.push(skel)
  }
  return out
}

/**
 * @param {unknown} disk
 */
async function hydrateSessionsFromDiskJson(disk) {
  if (!disk || typeof disk !== 'object') return []
  const rawSessions = /** @type {{ sessions?: unknown }} */ (disk).sessions
  if (!Array.isArray(rawSessions)) return []
  const out = []
  for (const s of rawSessions) {
    if (!s || typeof s !== 'object') continue
    const o = /** @type {Record<string, unknown>} */ (s)
    const photos = Array.isArray(o.photos)
      ? await hydratePhotoRecordsArray(o.photos)
      : []
    const n = normalizeSession({ ...o, photos })
    if (n) out.push(n)
  }
  return out
}

/**
 * Parser lagret JSON uten IndexedDB: trengs for sammenslåing av clickHistory
 * (flere faner) uten å laste alle bilder inn i minnet på nytt ved hvert lagringsskritt.
 * @param {unknown} disk
 * @returns {{
 *   clickById: Map<string, unknown[]>,
 *   rawById: Map<string, Record<string, unknown>>,
 * }}
 */
function parseDiskSessionsLite(disk) {
  /** @type {Map<string, unknown[]>} */
  const clickById = new Map()
  /** @type {Map<string, Record<string, unknown>>} */
  const rawById = new Map()
  if (!disk || typeof disk !== 'object') return { clickById, rawById }
  const raw = /** @type {{ sessions?: unknown }} */ (disk).sessions
  if (!Array.isArray(raw)) return { clickById, rawById }
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue
    const o = /** @type {Record<string, unknown>} */ (s)
    const id = typeof o.id === 'string' ? o.id : null
    if (!id) continue
    const ch = o.clickHistory
    clickById.set(id, Array.isArray(ch) ? ch : [])
    rawById.set(id, o)
  }
  return { clickById, rawById }
}

function photoRecordHasPixelData(p) {
  return (
    typeof p?.dataUrl === 'string' && p.dataUrl.startsWith('data:image/')
  )
}

/** Miniatyr (full eller lavoppløst) for liste, kart-popup og album-rader. */
function photoListThumbDataUrl(ph) {
  if (!ph || typeof ph !== 'object') return ''
  if (
    typeof /** @type {{ dataUrl?: string }} */ (ph).dataUrl === 'string' &&
    /** @type {{ dataUrl?: string }} */ (ph).dataUrl.startsWith('data:image/')
  ) {
    return /** @type {{ dataUrl: string }} */ (ph).dataUrl
  }
  if (
    typeof /** @type {{ thumbDataUrl?: string }} */ (ph).thumbDataUrl ===
      'string' &&
    /** @type {{ thumbDataUrl?: string }} */ (ph).thumbDataUrl.startsWith(
      'data:image/',
    )
  ) {
    return /** @type {{ thumbDataUrl: string }} */ (ph).thumbDataUrl
  }
  return ''
}

/**
 * Data-URL for fullskjerm: bruk lokal full piksel når den finnes, men ikke
 * «lås» til miniatyr når full finnes i sky (samme streng som thumbDataUrl,
 * eller kun thumb i minnet mens storageFullPath er satt).
 * @param {{ dataUrl?: string, thumbDataUrl?: string, storageFullPath?: string } | null | undefined} ph
 */
function photoFullscreenLocalPixelUrl(ph) {
  if (!ph || typeof ph !== 'object') return ''
  const data =
    typeof ph.dataUrl === 'string' && ph.dataUrl.startsWith('data:image/')
      ? ph.dataUrl
      : ''
  const thumb =
    typeof ph.thumbDataUrl === 'string' &&
    ph.thumbDataUrl.startsWith('data:image/')
      ? ph.thumbDataUrl
      : ''
  const hasStorage =
    typeof ph.storageFullPath === 'string' && ph.storageFullPath.trim() !== ''
  if (data && thumb && data === thumb) return ''
  if (data) return data
  if (thumb && hasStorage) return ''
  if (thumb) return thumb
  return ''
}

/**
 * Kun eksplisitt miniatyr for kart-pin og kart-popup (aldri full `dataUrl`).
 * @param {unknown} ph
 */
function photoMapThumbDataUrl(ph) {
  if (!ph || typeof ph !== 'object') return ''
  if (
    typeof /** @type {{ thumbDataUrl?: string }} */ (ph).thumbDataUrl ===
      'string' &&
    /** @type {{ thumbDataUrl: string }} */ (ph).thumbDataUrl.startsWith(
      'data:image/',
    )
  ) {
    return /** @type {{ thumbDataUrl: string }} */ (ph).thumbDataUrl
  }
  return ''
}

/**
 * Kart-pin og kart-popup: WebKit dekoder hele bildet til minne per `<img>`.
 * «Miniatyr» som er hundrevis av KB base64 (eller full JPEG feillagret som thumb)
 * gir titalls MB i Xcode — bruk kun kompakte data-URL-er her.
 */
const SESSION_MAP_THUMB_DATA_URL_MAX_CHARS = 132_000

/**
 * @param {unknown} ph
 */
function sessionMapDisplayThumbDataUrl(ph) {
  const u = photoMapThumbDataUrl(ph)
  if (!u || u.length > SESSION_MAP_THUMB_DATA_URL_MAX_CHARS) return ''
  return u
}

function photoRecordHasListThumb(ph) {
  return Boolean(photoListThumbDataUrl(ph))
}

/**
 * Lagrer piksel-dataUrl i IndexedDB når den finnes i minnet (én gang per id).
 * @param {unknown} ph
 */
async function persistPhotoPixelsToIdbIfNeeded(ph) {
  if (!ph || typeof ph !== 'object') return
  const id = /** @type {{ id?: unknown }} */ (ph).id
  if (typeof id !== 'string' || !id) return
  if (!photoRecordHasPixelData(/** @type {{ dataUrl?: string }} */ (ph)))
    return
  if (!(await isPhotoBlobStoreAvailable())) return
  try {
    await putPhotoDataUrl(
      id,
      /** @type {{ dataUrl: string }} */ (ph).dataUrl,
    )
  } catch (e) {
    console.warn('persistPhotoPixelsToIdbIfNeeded', id, e)
  }
}

/** @param {{ photos?: unknown[] } | null | undefined} sess */
async function persistSessionPhotoPixelsToIdb(sess) {
  if (!sess?.photos?.length) return
  for (const ph of sess.photos) {
    await persistPhotoPixelsToIdbIfNeeded(ph)
  }
}

async function persistAllAppPhotoPixelsToIdb() {
  for (const p of standalonePhotos) await persistPhotoPixelsToIdbIfNeeded(p)
  for (const s of sessions) {
    for (const p of s.photos || []) await persistPhotoPixelsToIdbIfNeeded(p)
  }
}

/**
 * Fyller inn dataUrl fra IndexedDB for alle økt- og standalone-bilder som mangler piksel.
 * @returns {boolean} true hvis noe ble oppdatert
 */
async function hydrateAllAppPhotoPixelsFromIdb() {
  if (!(await isPhotoBlobStoreAvailable())) return false
  let changed = false
  /** @param {unknown} ph */
  const patch = async (ph) => {
    if (!ph || typeof ph !== 'object') return
    if (photoRecordHasPixelData(/** @type {{ dataUrl?: string }} */ (ph)))
      return
    const id = /** @type {{ id?: unknown }} */ (ph).id
    if (typeof id !== 'string' || !id) return
    try {
      const blob = await getPhotoDataUrl(id)
      if (typeof blob === 'string' && blob.startsWith('data:image/')) {
        /** @type {{ dataUrl: string, pixelPending?: boolean }} */ (ph).dataUrl =
          blob
        if ('pixelPending' in ph)
          delete /** @type {{ pixelPending?: boolean }} */ (ph).pixelPending
        changed = true
      }
    } catch {
      /* ignore */
    }
  }
  for (const p of standalonePhotos) await patch(p)
  for (const s of sessions) {
    for (const p of s.photos || []) await patch(p)
  }
  return changed
}

/**
 * @param {{ dataUrl?: string, thumbDataUrl?: string, pixelPending?: boolean }} ph
 * @param {string} imgClass
 * @param {{ mapView?: boolean }} [opts] mapView: bare thumbDataUrl (aldri full bilde i kart-popup)
 */
function photoPreviewImgHtml(ph, imgClass, opts = {}) {
  const cls =
    typeof imgClass === 'string' && imgClass.trim() ? imgClass.trim() : 'home-dash-card__preview'
  const src = opts.mapView
    ? sessionMapDisplayThumbDataUrl(ph)
    : photoListThumbDataUrl(ph)
  if (src) {
    return `<img src="${src}" alt="" class="${escapeHtml(cls)}" loading="lazy" decoding="async" />`
  }
  return `<span class="${escapeHtml(cls)} photo-preview--pending" role="status" aria-label="Laster"></span>`
}

function mergeStandalonePhotoLists(a, b) {
  const m = new Map()
  /** @param {unknown} x */
  const prefer = (x, y) => {
    const px = photoRecordHasPixelData(
      /** @type {{ dataUrl?: string }} */ (x),
    )
    const py = photoRecordHasPixelData(
      /** @type {{ dataUrl?: string }} */ (y),
    )
    if (px && !py) return x
    if (!px && py) return y
    const tx = photoRecordHasListThumb(/** @type {{ dataUrl?: string, thumbDataUrl?: string }} */ (x))
    const ty = photoRecordHasListThumb(/** @type {{ dataUrl?: string, thumbDataUrl?: string }} */ (y))
    if (tx && !ty) return x
    if (!tx && ty) return y
    const ta =
      typeof /** @type {{ timestamp?: string }} */ (x).timestamp === 'string'
        ? /** @type {{ timestamp?: string }} */ (x).timestamp
        : ''
    const tb =
      typeof /** @type {{ timestamp?: string }} */ (y).timestamp === 'string'
        ? /** @type {{ timestamp?: string }} */ (y).timestamp
        : ''
    return tb >= ta ? y : x
  }
  for (const p of [...a, ...b]) {
    if (!p?.id) continue
    const ex = m.get(p.id)
    m.set(p.id, ex ? prefer(ex, p) : p)
  }
  return [...m.values()].sort((x, y) => {
    const ta = typeof x.timestamp === 'string' ? x.timestamp : ''
    const tb = typeof y.timestamp === 'string' ? y.timestamp : ''
    return ta.localeCompare(tb)
  })
}

/**
 * Samme id kan finnes både som sky-skall (storage-stier) og lokalt miniatyr.
 * `mergeStandalonePhotoLists` velger én post helhetlig — da mistes ofte `storageFullPath`
 * og fullskjerm faller tilbake til thumb. Fletter piksel/stier fra begge.
 * @param {NonNullable<ReturnType<typeof normalizePhotoOrSkeleton>>} a
 * @param {NonNullable<ReturnType<typeof normalizePhotoOrSkeleton>>} b
 */
function mergeNormalizedPhotoPairForIndex(a, b) {
  const primary =
    mergeStandalonePhotoLists(
      /** @type {NonNullable<ReturnType<typeof normalizePhotoOrSkeleton>>[]} */ ([
        a,
      ]),
      /** @type {NonNullable<ReturnType<typeof normalizePhotoOrSkeleton>>[]} */ ([
        b,
      ]),
    )[0] || b
  const secondary = primary === a ? b : a
  const pa = /** @type {Record<string, unknown>} */ (primary)
  const sb = /** @type {Record<string, unknown>} */ (secondary)
  const out = { ...pa }

  const pickTrimmed = (key) => {
    const v = pa[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
    const v2 = sb[key]
    return typeof v2 === 'string' && v2.trim() ? v2.trim() : ''
  }
  const sf = pickTrimmed('storageFullPath')
  const st = pickTrimmed('storageThumbPath')
  if (sf) out.storageFullPath = sf
  else delete out.storageFullPath
  if (st) out.storageThumbPath = st
  else delete out.storageThumbPath

  const duP =
    typeof pa.dataUrl === 'string' && pa.dataUrl.startsWith('data:image/')
  const duS =
    typeof sb.dataUrl === 'string' && sb.dataUrl.startsWith('data:image/')
  if (duP) out.dataUrl = pa.dataUrl
  else if (duS) out.dataUrl = sb.dataUrl
  else delete out.dataUrl

  const ttP =
    typeof pa.thumbDataUrl === 'string' &&
    pa.thumbDataUrl.startsWith('data:image/')
  const ttS =
    typeof sb.thumbDataUrl === 'string' &&
    sb.thumbDataUrl.startsWith('data:image/')
  if (ttP) out.thumbDataUrl = pa.thumbDataUrl
  else if (ttS) out.thumbDataUrl = sb.thumbDataUrl
  else delete out.thumbDataUrl

  const paired = ensureStorageFullPathParallelToThumb(
    ensureStorageThumbPathParallelToFull(out),
  )
  const pr = /** @type {Record<string, unknown>} */ (paired)
  const augFull =
    typeof pr.storageFullPath === 'string' && pr.storageFullPath.trim()
      ? pr.storageFullPath.trim()
      : null
  const hasThumbData =
    typeof pr.thumbDataUrl === 'string' &&
    pr.thumbDataUrl.startsWith('data:image/')
  const hasFullPixel =
    typeof pr.dataUrl === 'string' && pr.dataUrl.startsWith('data:image/')
  if (hasFullPixel) delete pr.pixelPending
  else if (augFull && !hasThumbData) pr.pixelPending = true
  else delete pr.pixelPending

  return /** @type {NonNullable<ReturnType<typeof normalizePhotoOrSkeleton>>} */ (
    pr
  )
}

const MAX_FRICTION_MEASUREMENTS = 200

/**
 * @param {unknown} x
 * @returns {{ vegnavn: string, vegnr: string, s: string, d: string, meter: string } | null}
 */
function normalizeFrictionVegSnap(x) {
  if (!x || typeof x !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (x)
  const vegnavn =
    typeof o.vegnavn === 'string'
      ? o.vegnavn.trim()
      : typeof o.vegnavn === 'number'
        ? String(o.vegnavn)
        : ''
  const vegnr =
    typeof o.vegnr === 'string'
      ? o.vegnr.trim()
      : typeof o.vegnr === 'number' && Number.isFinite(o.vegnr)
        ? String(o.vegnr)
        : ''
  /** @param {unknown} v */
  const sdStr = (v) => {
    if (v === undefined || v === null) return ''
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
    if (typeof v === 'string') {
      const t = v.trim()
      if (t === '–' || t === '-') return ''
      return t
    }
    return ''
  }
  const s = sdStr(o.s)
  const d = sdStr(o.d)
  let meter = ''
  if (typeof o.meter === 'string') {
    const t = o.meter.trim()
    meter = t === '–' || t === '-' ? '' : t
  } else if (typeof o.meter === 'number' && Number.isFinite(o.meter)) {
    meter = String(Math.round(o.meter))
  }
  if (!vegnavn && !vegnr && !s && !d && !meter) return null
  return { vegnavn, vegnr, s, d, meter }
}

/**
 * NVDB `kortform` når S/D/meter ikke ligger i strekning-objektet (typisk posisjon-API).
 * @param {string} kf
 */
function parseKortformSdMeterForFriction(kf) {
  if (typeof kf !== 'string') return { s: '', d: '', meter: '' }
  const t = kf.trim()
  if (!t) return { s: '', d: '', meter: '' }
  const sM = t.match(/\bS\s*(\d+)/i)
  const dM = t.match(/\bD\s*(\d+)/i)
  const mM = t.match(/\bm\s*(\d+)/i)
  return {
    s: sM ? sM[1] : '',
    d: dM ? dM[1] : '',
    meter: mM ? mM[1] : '',
  }
}

/**
 * @param {object | null} r
 * @returns {{ vegnavn: string, vegnr: string, s: string, d: string, meter: string } | null}
 */
function vegrefPosisjonToFrictionSnap(r) {
  if (!r || typeof r !== 'object') return null
  const o = /** @type {{ roadLineDisplay?: string, roadLine?: string, roadLineShort?: string, roadLineDisplayShort?: string, s?: string | number, d?: string | number, m?: string | number, kortform?: string }} */ (
    r
  )
  const vegnavn = String(o.roadLineDisplay || o.roadLine || '').trim()
  const vegnr = String(
    o.roadLineShort || o.roadLineDisplayShort || '',
  ).trim()
  const sRaw = o.s
  const dRaw = o.d
  const mRaw = o.m
  const dash = (v) =>
    v === '–' || v === '-' || v === undefined || v === null
  let s = dash(sRaw) ? '' : String(sRaw).trim()
  let d = dash(dRaw) ? '' : String(dRaw).trim()
  let meter = dash(mRaw) ? '' : String(mRaw).trim()
  const kortform = typeof o.kortform === 'string' ? o.kortform.trim() : ''
  if ((!s || !d || !meter) && kortform) {
    const p = parseKortformSdMeterForFriction(kortform)
    if (!s && p.s) s = p.s
    if (!d && p.d) d = p.d
    if (!meter && p.meter) meter = p.meter
  }
  if (!vegnavn && !vegnr && !s && !d && !meter) return null
  return { vegnavn, vegnr, s, d, meter }
}

/**
 * @param {unknown} p
 * @returns {{ id: string, createdAt: string, distanceM: number, value: number, pathLatLngs: number[][], startLat: number | null, startLng: number | null, endLat: number | null, endLng: number | null, sessionId?: string, startVegref?: { vegnavn: string, vegnr: string, s: string, d: string, meter: string }, endVegref?: { vegnavn: string, vegnr: string, s: string, d: string, meter: string } } | null}
 */
function normalizeFrictionMeasurement(p) {
  if (!p || typeof p !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (p)
  const id = typeof o.id === 'string' && o.id ? o.id : null
  if (!id) return null
  const createdAt =
    typeof o.createdAt === 'string' && o.createdAt ? o.createdAt : nowIso()
  const distanceM =
    typeof o.distanceM === 'number' && Number.isFinite(o.distanceM)
      ? o.distanceM
      : 0
  const value =
    typeof o.value === 'number' && Number.isFinite(o.value) ? o.value : null
  if (value == null) return null
  let pathLatLngs = []
  if (Array.isArray(o.pathLatLngs)) {
    pathLatLngs = o.pathLatLngs
      .map((pair) => {
        if (!Array.isArray(pair) || pair.length < 2) return null
        const lat = Number(pair[0])
        const lng = Number(pair[1])
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return [lat, lng]
      })
      .filter(Boolean)
  }
  let startLat =
    typeof o.startLat === 'number' && Number.isFinite(o.startLat)
      ? o.startLat
      : null
  let startLng =
    typeof o.startLng === 'number' && Number.isFinite(o.startLng)
      ? o.startLng
      : null
  let endLat =
    typeof o.endLat === 'number' && Number.isFinite(o.endLat) ? o.endLat : null
  let endLng =
    typeof o.endLng === 'number' && Number.isFinite(o.endLng) ? o.endLng : null
  if (
    pathLatLngs.length >= 2 &&
    (startLat == null ||
      startLng == null ||
      endLat == null ||
      endLng == null)
  ) {
    const a = pathLatLngs[0]
    const b = pathLatLngs[pathLatLngs.length - 1]
    if (startLat == null) startLat = a[0]
    if (startLng == null) startLng = a[1]
    if (endLat == null) endLat = b[0]
    if (endLng == null) endLng = b[1]
  }
  const sessionId =
    typeof o.sessionId === 'string' && o.sessionId ? o.sessionId : undefined
  const startVegref = normalizeFrictionVegSnap(o.startVegref) ?? undefined
  const endVegref = normalizeFrictionVegSnap(o.endVegref) ?? undefined
  return {
    id,
    createdAt,
    distanceM,
    value,
    pathLatLngs,
    startLat,
    startLng,
    endLat,
    endLng,
    ...(sessionId ? { sessionId } : {}),
    ...(startVegref ? { startVegref } : {}),
    ...(endVegref ? { endVegref } : {}),
  }
}

/** @param {unknown} arr */
function normalizeFrictionMeasurementsList(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map(normalizeFrictionMeasurement).filter(Boolean)
}

/**
 * @param {unknown[]} a
 * @param {unknown[]} b
 */
function mergeFrictionMeasurementLists(a, b) {
  const m = new Map()
  for (const raw of [...a, ...b]) {
    const n = normalizeFrictionMeasurement(raw)
    if (!n) continue
    const ex = m.get(n.id)
    if (!ex) {
      m.set(n.id, n)
      continue
    }
    const ta = new Date(ex.createdAt).getTime()
    const tb = new Date(n.createdAt).getTime()
    m.set(n.id, tb >= ta ? n : ex)
  }
  return [...m.values()].sort(
    (x, y) =>
      new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime(),
  )
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
 * Øktlogg (nyeste først i UI). Slår sammen sky + lokal uten å miste linjer.
 * @param {unknown[]} a
 * @param {unknown[]} b
 */
function mergeSessionLogArrays(a, b) {
  const byId = new Map()
  for (const e of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    if (!e || typeof e !== 'object') continue
    const id = /** @type {{ id?: string }} */ (e).id
    if (typeof id === 'string' && id) {
      byId.set(id, e)
      continue
    }
    const ts = String(/** @type {{ timestamp?: string }} */ (e).timestamp ?? '')
    byId.set(`legacy:${ts}:${byId.size}`, e)
  }
  return [...byId.values()].sort(
    (x, y) =>
      new Date(
        /** @type {{ timestamp?: string }} */ (y).timestamp || 0,
      ).getTime() -
      new Date(/** @type {{ timestamp?: string }} */ (x).timestamp || 0).getTime(),
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
  const mergedPhotos = mergeStandalonePhotoLists(
    normalizeStandalonePhotosList(local.photos),
    normalizeStandalonePhotosList(remote.photos),
  )
  const mergedLog = mergeSessionLogArrays(local.log, remote.log)
  const tLocal = new Date(local.updatedAt || 0).getTime()
  const tRemote = new Date(remote.updatedAt || 0).getTime()
  const base = tRemote >= tLocal ? { ...remote } : { ...local }
  return normalizeSession({
    ...base,
    clickHistory: mergedClicks,
    log: mergedLog,
    count: mergedClicks.length,
    photos: mergedPhotos,
  })
}

/**
 * Sky + disk: samme økt-id kan ha ulikt innhold (synk-feil, avbrudd). Vi mister aldri bilder ved å slå sammen per id.
 * @param {ReturnType<typeof normalizeSession>[]} remoteSessions
 * @param {ReturnType<typeof normalizeSession>[]} diskSessions
 */
function mergeRemoteAndDiskSessions(remoteSessions, diskSessions) {
  const diskById = new Map(diskSessions.map((s) => [s.id, s]))
  const remoteById = new Map(remoteSessions.map((s) => [s.id, s]))
  const allIds = new Set([...diskById.keys(), ...remoteById.keys()])
  const merged = []
  for (const id of allIds) {
    const d = diskById.get(id)
    const r = remoteById.get(id)
    if (!d) merged.push(/** @type {NonNullable<typeof r>} */ (r))
    else if (!r) merged.push(d)
    else merged.push(mergeStoredSessionsPair(d, r))
  }
  return merged.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
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
      ? p.photos.map(normalizePhotoOrSkeleton).filter(Boolean)
      : [],
    objectCategories,
    activeCategoryId,
  }
}

/**
 * Rask, lett serialisering for lokal "core"-persist (synkron/robust ved app-lukk).
 * Vi tar med nok felt til at økter vises/gjenopptas; tunge bildebytes holdes ute.
 * @param {unknown} ph
 */
function toCorePhotoSnapshot(ph) {
  if (!ph || typeof ph !== 'object') return null
  const p = /** @type {Record<string, unknown>} */ (ph)
  const id = typeof p.id === 'string' ? p.id : ''
  if (!id) return null
  return {
    id,
    timestamp: typeof p.timestamp === 'string' ? p.timestamp : nowIso(),
    lat: typeof p.lat === 'number' ? p.lat : 0,
    lng: typeof p.lng === 'number' ? p.lng : 0,
    ...(typeof p.note === 'string' && p.note.trim() ? { note: p.note } : {}),
    ...(typeof p.vegref === 'string' && p.vegref.trim() ? { vegref: p.vegref } : {}),
    ...(typeof p.storageFullPath === 'string' && p.storageFullPath.trim()
      ? { storageFullPath: p.storageFullPath }
      : {}),
    ...(typeof p.storageThumbPath === 'string' && p.storageThumbPath.trim()
      ? { storageThumbPath: p.storageThumbPath }
      : {}),
    ...(typeof p.thumbDataUrl === 'string' && p.thumbDataUrl.startsWith('data:image/')
      ? { thumbDataUrl: p.thumbDataUrl }
      : {}),
    ...(typeof p.imageFolder === 'string' && p.imageFolder.trim()
      ? { imageFolder: p.imageFolder }
      : {}),
    ...(typeof p.imagePath === 'string' && p.imagePath.trim()
      ? { imagePath: p.imagePath }
      : {}),
  }
}

/**
 * @param {typeof sessions[number]} s
 */
function toCoreSessionSnapshot(s) {
  if (!s || typeof s !== 'object') return null
  const photos = Array.isArray(s.photos)
    ? s.photos.map((p) => toCorePhotoSnapshot(p)).filter(Boolean)
    : []
  return {
    id: s.id,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    title: s.title ?? null,
    registeredNote: s.registeredNote ?? null,
    count: typeof s.count === 'number' ? s.count : 0,
    clickHistory: Array.isArray(s.clickHistory) ? s.clickHistory : [],
    log: Array.isArray(s.log) ? s.log : [],
    roadSide: s.roadSide ?? null,
    photos,
    objectCategories: Array.isArray(s.objectCategories) ? s.objectCategories : [],
    activeCategoryId: s.activeCategoryId ?? null,
  }
}

function writeCoreSnapshotSync(reason = 'core') {
  try {
    const key = coreSnapshotKeyForCurrentContext()
    const payload = {
      version: 1,
      at: nowIso(),
      reason,
      currentSessionId: typeof currentSessionId === 'string' ? currentSessionId : null,
      lastResumeSessionId:
        typeof lastResumeSessionId === 'string' ? lastResumeSessionId : null,
      sessions: sessions
        .map((s) => toCoreSessionSnapshot(s))
        .filter(Boolean),
    }
    localStorage.setItem(key, JSON.stringify(payload))
    appendStorageDebugTrace('core_snapshot_written', {
      key,
      reason,
      sessionsCount: payload.sessions.length,
    })
  } catch (e) {
    appendStorageDebugTrace('core_snapshot_write_failed', {
      reason,
      errorName: e?.name || null,
      errorMessage: e instanceof Error ? e.message : String(e),
    })
  }
}

/**
 * @param {string} userId
 */
function readCoreSnapshotForUser(userId) {
  const key =
    userId === STORAGE_KEY_DEVICE_FALLBACK
      ? `${STORAGE_KEY_DEVICE_FALLBACK}-${STORAGE_KEY_CORE_SUFFIX}`
      : coreSnapshotKeyForUser(userId)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { sessions: [], currentSessionId: null, lastResumeSessionId: null }
    const p = JSON.parse(raw)
    const rows = Array.isArray(p?.sessions) ? p.sessions : []
    const sess = rows.map((x) => normalizeSession(x)).filter(Boolean)
    return {
      sessions: sess,
      currentSessionId:
        typeof p?.currentSessionId === 'string' ? p.currentSessionId : null,
      lastResumeSessionId:
        typeof p?.lastResumeSessionId === 'string' ? p.lastResumeSessionId : null,
    }
  } catch {
    return { sessions: [], currentSessionId: null, lastResumeSessionId: null }
  }
}

/**
 * Laster økter for innlogget bruker. Migrerer eldre `scanix-sessions-v2` til per-bruker-nøkkel én gang.
 * Bildedata kan ligge i IndexedDB (idbImage); metadata i JSON.
 * @param {string} userId
 */
async function loadAppStateFromStorageForUser(userId) {
  needsAppStateDiskMerge = false
  const isDeviceFallbackLoad = userId === STORAGE_KEY_DEVICE_FALLBACK
  const key =
    isDeviceFallbackLoad
      ? STORAGE_KEY_DEVICE_FALLBACK
      : sessionsKeyForUser(userId)
  let rawV2 = localStorage.getItem(key)
  const core = readCoreSnapshotForUser(userId)
  // Bruker-kontekst: hvis per-bruker nøkkel mangler, prøv enhets-fallback (f.eks. før auth ble klar).
  if (!rawV2 && !isDeviceFallbackLoad) {
    const fallbackRaw = localStorage.getItem(STORAGE_KEY_DEVICE_FALLBACK)
    if (fallbackRaw) {
      rawV2 = fallbackRaw
      try {
        localStorage.setItem(key, fallbackRaw)
      } catch {
        /* quota */
      }
    }
  }
  appendStorageDebugTrace('load_begin', {
    userIdArg: userId || null,
    key,
    hasRawV2: Boolean(rawV2),
    isDeviceFallbackLoad,
  })
  // #region agent log
  fetch('http://127.0.0.1:7637/ingest/e58399ea-bfe1-456f-9512-3bdae1c6fc15',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ff8b7b'},body:JSON.stringify({sessionId:'ff8b7b',runId:'pre-fix',hypothesisId:'H4',location:'main.js:loadAppStateFromStorageForUser:start',message:'load_app_state_begin',data:{userIdPresent:Boolean(userId),key,hasRawV2:Boolean(rawV2)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
      const jsonStr = await decompressAppStateJsonFromLocalStorage(rawV2)
      const p = JSON.parse(jsonStr)
      let sess = await hydrateSessionsFromDiskJson(p)
      const rawStandalone = Array.isArray(p.standalonePhotos)
        ? p.standalonePhotos
        : []
      let hydratedStandalone = await hydratePhotoRecordsArray(rawStandalone)
      // Bruker-kontekst: slå sammen med enhets-fallback for å unngå at økter
      // "forsvinner" når auth/session har vekslet mellom nøkler.
      if (!isDeviceFallbackLoad) {
        const fallbackRaw = localStorage.getItem(STORAGE_KEY_DEVICE_FALLBACK)
        if (fallbackRaw && fallbackRaw !== rawV2) {
          try {
            const fallbackJson =
              await decompressAppStateJsonFromLocalStorage(fallbackRaw)
            const fp = JSON.parse(fallbackJson)
            const fallbackSess = await hydrateSessionsFromDiskJson(fp)
            sess = mergeRemoteAndDiskSessions(sess, fallbackSess)
            const fallbackStandalone = Array.isArray(fp.standalonePhotos)
              ? fp.standalonePhotos
              : []
            const hydratedFallbackStandalone =
              await hydratePhotoRecordsArray(fallbackStandalone)
            hydratedStandalone = mergeStandalonePhotoLists(
              normalizeStandalonePhotosList(hydratedStandalone),
              normalizeStandalonePhotosList(hydratedFallbackStandalone),
            )
          } catch {
            /* ignore corrupt fallback */
          }
        }
      }
      if (core.sessions.length > 0) {
        sess = mergeRemoteAndDiskSessions(sess, core.sessions)
        appendStorageDebugTrace('load_core_merged', {
          key,
          coreSessions: core.sessions.length,
        })
      }
      const emergency = readEmergencySessionDeltaForUser(userId)
      if (emergency.session) {
        sess = mergeRemoteAndDiskSessions(sess, [emergency.session])
        appendStorageDebugTrace('load_emergency_delta_merged', {
          key,
          mergedSessionId: emergency.session.id,
        })
      }
      appendStorageDebugTrace('load_success', {
        key,
        sessionsLoaded: Array.isArray(sess) ? sess.length : 0,
        standaloneLoaded: Array.isArray(hydratedStandalone)
          ? hydratedStandalone.length
          : 0,
      })
      return {
        sessions: sess,
        currentSessionId:
          emergency.currentSessionId ||
          core.currentSessionId ||
          (typeof p.currentSessionId === 'string' ? p.currentSessionId : null),
        standalonePhotos: normalizeStandalonePhotosList(hydratedStandalone),
        frictionMeasurements: normalizeFrictionMeasurementsList(
          p.frictionMeasurements,
        ),
        frictionActiveSessionId:
          typeof p.frictionActiveSessionId === 'string'
            ? p.frictionActiveSessionId
            : null,
        frictionPreviousSessionId:
          typeof p.frictionPreviousSessionId === 'string'
            ? p.frictionPreviousSessionId
            : null,
        lastResumeSessionId:
          emergency.lastResumeSessionId ||
          core.lastResumeSessionId ||
          (typeof p.lastResumeSessionId === 'string'
            ? p.lastResumeSessionId
            : null),
      }
    } catch (e) {
      appendStorageDebugTrace('load_parse_failed', {
        key,
        errorName: e?.name || null,
        errorMessage: e instanceof Error ? e.message : String(e),
      })
      // #region agent log
      fetch('http://127.0.0.1:7637/ingest/e58399ea-bfe1-456f-9512-3bdae1c6fc15',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ff8b7b'},body:JSON.stringify({sessionId:'ff8b7b',runId:'pre-fix',hypothesisId:'H5',location:'main.js:loadAppStateFromStorageForUser:rawV2Catch',message:'load_app_state_parse_failed',data:{key,errorName:e?.name||null,errorMessage:e instanceof Error ? e.message : String(e)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
        frictionMeasurements: [],
        frictionActiveSessionId: null,
        frictionPreviousSessionId: null,
        lastResumeSessionId: null,
      }
    } catch {
      /* fall through */
    }
  }
  let hadLegacy = false
  try {
    hadLegacy = Boolean(localStorage.getItem(LEGACY_STORAGE_KEY))
  } catch {
    hadLegacy = false
  }
  const emergencyOnly = readEmergencySessionDeltaForUser(userId)
  if (emergencyOnly.session) {
    appendStorageDebugTrace('load_emergency_only_return', {
      key,
      sessionId: emergencyOnly.session.id,
    })
    return {
      sessions: [emergencyOnly.session],
      currentSessionId: emergencyOnly.currentSessionId || null,
      standalonePhotos: [],
      frictionMeasurements: [],
      frictionActiveSessionId: null,
      frictionPreviousSessionId: null,
      lastResumeSessionId: emergencyOnly.lastResumeSessionId || null,
    }
  }
  if (core.sessions.length > 0) {
    appendStorageDebugTrace('load_core_only_return', {
      key,
      coreSessions: core.sessions.length,
    })
    return {
      sessions: core.sessions,
      currentSessionId: core.currentSessionId,
      standalonePhotos: [],
      frictionMeasurements: [],
      frictionActiveSessionId: null,
      frictionPreviousSessionId: null,
      lastResumeSessionId: core.lastResumeSessionId,
    }
  }
  appendStorageDebugTrace('load_empty_return', { key, hadLegacy })
  return {
    sessions: [],
    currentSessionId: null,
    standalonePhotos: [],
    frictionMeasurements: [],
    frictionActiveSessionId: null,
    frictionPreviousSessionId: null,
    lastResumeSessionId: null,
  }
}

/** @type {ReturnType<typeof setTimeout> | null} */
let appStatePersistDebounce = null
/** @type {Promise<void>} */
let appStateSaveChain = Promise.resolve()
/**
 * Annen fane/vindu skrev app-state (`storage`); da må vi lese disk og slå sammen clickHistory
 * før flush. Én fane: spar stor getItem+parse mellom hver debouncet lagring.
 */
let needsAppStateDiskMerge = false

/** Nyeste logg først (`unshift`); for økter som ikke er åpne, spar plass på disk. */
const LOCAL_DISK_INACTIVE_SESSION_LOG_MAX = 120

/**
 * @param {typeof sessions[number]} s
 */
function trimSessionForLocalDiskPersist(s) {
  if (!s || typeof s !== 'object') return s
  if (currentSessionId && s.id === currentSessionId) return s
  const log = Array.isArray(s.log) ? s.log : []
  if (log.length <= LOCAL_DISK_INACTIVE_SESSION_LOG_MAX) return s
  return {
    ...s,
    log: log.slice(0, LOCAL_DISK_INACTIVE_SESSION_LOG_MAX),
  }
}

/**
 * Skriver økter + metadata til localStorage; store bilder i IndexedDB for å unngå localStorage-kvote.
 */
async function flushLocalStorageAppState(key) {
  // #region agent log
  const __flushT0 = performance.now()
  // #endregion
  let useIdb = await isPhotoBlobStoreAvailable()

  /**
   * @param {NonNullable<ReturnType<typeof normalizePhotoOrSkeleton>>} p
   */
  const serializePhoto = async (p) => {
    if (!photoRecordHasPixelData(p)) {
      const id = typeof p.id === 'string' ? p.id : null
      if (id && useIdb) {
        try {
          const fromIdb = await getPhotoDataUrl(id)
          if (
            typeof fromIdb === 'string' &&
            fromIdb.startsWith('data:image/')
          ) {
            return await serializePhoto(
              /** @type {NonNullable<ReturnType<typeof normalizePhoto>>} */ ({
                ...p,
                dataUrl: fromIdb,
              }),
            )
          }
        } catch {
          /* ignore */
        }
      }
      const thumbRaw =
        typeof /** @type {{ thumbDataUrl?: string }} */ (p).thumbDataUrl ===
          'string' &&
        /** @type {{ thumbDataUrl?: string }} */ (p).thumbDataUrl.startsWith(
          'data:image/',
        )
          ? /** @type {{ thumbDataUrl: string }} */ (p).thumbDataUrl
          : ''
      const thumbOk =
        Boolean(thumbRaw) &&
        thumbRaw.length <= SESSION_MAP_THUMB_DATA_URL_MAX_CHARS
      const pathOk =
        typeof /** @type {{ storageFullPath?: string }} */ (p)
          .storageFullPath === 'string' &&
        Boolean(
          /** @type {{ storageFullPath?: string }} */ (p).storageFullPath?.trim(),
        )
      if (thumbOk || pathOk) {
        return {
          id: p.id,
          timestamp: p.timestamp,
          lat: p.lat,
          lng: p.lng,
          ...(thumbOk
            ? {
                thumbDataUrl: thumbRaw,
              }
            : {}),
          ...(pathOk
            ? {
                storageFullPath:
                  /** @type {{ storageFullPath: string }} */ (p)
                    .storageFullPath.trim(),
                ...(typeof /** @type {{ storageThumbPath?: string }} */ (p)
                  .storageThumbPath === 'string' &&
                /** @type {{ storageThumbPath?: string }} */ (
                  p
                ).storageThumbPath.trim()
                  ? {
                      storageThumbPath:
                        /** @type {{ storageThumbPath: string }} */ (p)
                          .storageThumbPath.trim(),
                    }
                  : {}),
              }
            : {}),
          ...(p.vegref ? { vegref: p.vegref } : {}),
          ...(p.note ? { note: p.note } : {}),
          ...(p.imageFolder != null
            ? { imageFolder: p.imageFolder, imagePath: p.imagePath }
            : {}),
        }
      }
      return {
        id: p.id,
        timestamp: p.timestamp,
        lat: p.lat,
        lng: p.lng,
        ...(p.vegref ? { vegref: p.vegref } : {}),
        ...(p.note ? { note: p.note } : {}),
        ...(p.imageFolder != null
          ? { imageFolder: p.imageFolder, imagePath: p.imagePath }
          : {}),
        pixelPending: true,
      }
    }
    if (!useIdb) {
      return {
        id: p.id,
        timestamp: p.timestamp,
        lat: p.lat,
        lng: p.lng,
        dataUrl: /** @type {{ dataUrl: string }} */ (p).dataUrl,
        ...(p.vegref ? { vegref: p.vegref } : {}),
        ...(p.note ? { note: p.note } : {}),
        ...(p.imageFolder != null
          ? { imageFolder: p.imageFolder, imagePath: p.imagePath }
          : {}),
      }
    }
    try {
      await putPhotoDataUrl(p.id, /** @type {{ dataUrl: string }} */ (p).dataUrl)
      return {
        id: p.id,
        timestamp: p.timestamp,
        lat: p.lat,
        lng: p.lng,
        idbImage: true,
        ...(p.vegref ? { vegref: p.vegref } : {}),
        ...(p.note ? { note: p.note } : {}),
        ...(p.imageFolder != null
          ? { imageFolder: p.imageFolder, imagePath: p.imagePath }
          : {}),
      }
    } catch (e) {
      console.warn('putPhotoDataUrl', e)
      return {
        id: p.id,
        timestamp: p.timestamp,
        lat: p.lat,
        lng: p.lng,
        dataUrl: /** @type {{ dataUrl: string }} */ (p).dataUrl,
        ...(p.vegref ? { vegref: p.vegref } : {}),
        ...(p.note ? { note: p.note } : {}),
        ...(p.imageFolder != null
          ? { imageFolder: p.imageFolder, imagePath: p.imagePath }
          : {}),
      }
    }
  }

  const sessionsOut = await Promise.all(
    sessions.map(async (s) => {
      const row = trimSessionForLocalDiskPersist(s)
      const photoInputs = row.photos || []
      const photos = await Promise.all(photoInputs.map((ph) => serializePhoto(ph)))
      return { ...row, photos }
    }),
  )
  const standaloneOut = await Promise.all(
    standalonePhotos.map((ph) => serializePhoto(ph)),
  )

  const payload = {
    version: 2,
    sessions: sessionsOut,
    currentSessionId,
    standalonePhotos: standaloneOut,
    frictionMeasurements,
    frictionActiveSessionId,
    frictionPreviousSessionId,
    lastResumeSessionId:
      typeof lastResumeSessionId === 'string' ? lastResumeSessionId : null,
  }
  try {
    // #region agent log
    const __j0 = performance.now()
    const __json = JSON.stringify(payload)
    regtraceLocalStorageWrite(__json, payload)
    const __jsonMs = performance.now() - __j0
    const __c0 = performance.now()
    const toStore = await compressAppStateJsonForLocalStorage(__json)
    const __compressMs = performance.now() - __c0
    const __s0 = performance.now()
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7637/ingest/e58399ea-bfe1-456f-9512-3bdae1c6fc15',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ff8b7b'},body:JSON.stringify({sessionId:'ff8b7b',runId:'pre-fix',hypothesisId:'H2',location:'main.js:flushLocalStorageAppState:beforeSetItem',message:'localstorage_set_attempt',data:{key,sessionsCount:sessionsOut.length,standaloneCount:standaloneOut.length,storedLen:toStore.length,useIdb},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    appendStorageDebugTrace('flush_setitem_attempt', {
      key,
      sessionsToStore: sessionsOut.length,
      standaloneToStore: standaloneOut.length,
      storedLen: toStore.length,
      useIdb,
    })
    localStorage.setItem(key, toStore)
    appendStorageDebugTrace('flush_setitem_ok', {
      key,
      storedLen: toStore.length,
    })
    // #region agent log
    const __setMs = performance.now() - __s0
    const __total = performance.now() - __flushT0
    if (__jsonMs > 70 || __setMs > 70 || __total > 120) {
      scanixDebugFreezeLog('H3', 'main.js:flushLocalStorageAppState', 'slow_persist', {
        jsonMs: Math.round(__jsonMs * 10) / 10,
        compressMs: Math.round(__compressMs * 10) / 10,
        setMs: Math.round(__setMs * 10) / 10,
        totalMs: Math.round(__total * 10) / 10,
        jsonLen: __json.length,
        storedLen: toStore.length,
        sessionCount: sessionsOut.length,
        photoSlots:
          sessionsOut.reduce((n, s) => n + (s.photos?.length || 0), 0) +
          standaloneOut.length,
      })
    }
    // #endregion
  } catch (e) {
    appendStorageDebugTrace('flush_setitem_failed', {
      key,
      errorName: e?.name || null,
      errorMessage: e instanceof Error ? e.message : String(e),
    })
    // #region agent log
    fetch('http://127.0.0.1:7637/ingest/e58399ea-bfe1-456f-9512-3bdae1c6fc15',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ff8b7b'},body:JSON.stringify({sessionId:'ff8b7b',runId:'pre-fix',hypothesisId:'H2',location:'main.js:flushLocalStorageAppState:catch',message:'localstorage_set_failed',data:{key,errorName:e?.name||null,errorMessage:e instanceof Error ? e.message : String(e)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    showSessionToast(
      'Kunne ikke lagre data lokalt (lagringsplass full?). Noe kan mangle etter oppdatering.',
      5200,
    )
    throw e
  }

  if (useIdb) {
    const keepIds = new Set()
    for (const p of standalonePhotos) keepIds.add(p.id)
    for (const s of sessions) {
      for (const p of s.photos || []) keepIds.add(p.id)
    }
    try {
      await prunePhotoBlobsExcept(keepIds)
    } catch (e) {
      console.warn('prunePhotoBlobsExcept', e)
    }
  }
}

/**
 * @param {{ skipDiskMerge?: boolean }} [opts]
 */
async function saveAppStateWorker(opts = {}) {
  const skipDiskMerge = Boolean(opts.skipDiskMerge)
  const key = sessionsKeyForCurrentContext()
  appendStorageDebugTrace('save_worker_start', {
    key,
    sessionsCount: sessions.length,
    currentSessionId,
    skipDiskMerge,
  })
  // #region agent log
  fetch('http://127.0.0.1:7637/ingest/e58399ea-bfe1-456f-9512-3bdae1c6fc15',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ff8b7b'},body:JSON.stringify({sessionId:'ff8b7b',runId:'pre-fix',hypothesisId:'H3',location:'main.js:saveAppStateWorker:start',message:'save_worker_start',data:{userId:currentUser?.id||null,key,sessionsCount:sessions.length,currentSessionId},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  /** @type {typeof sessions} */
  let mergedSessions = sessions
  let mergedChanged = false
  if (needsAppStateDiskMerge && !skipDiskMerge) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const jsonStr = await decompressAppStateJsonFromLocalStorage(raw)
        const disk = JSON.parse(jsonStr)
        const { clickById, rawById } = parseDiskSessionsLite(disk)
        const memIds = new Set(sessions.map((s) => s.id))
        const merged = sessions.map((local) => {
          const diskClicks = clickById.get(local.id)
          if (!diskClicks) return local
          const mergedClicks = mergeClickHistoryArrays(
            local.clickHistory,
            diskClicks,
          )
          const localLen = local.clickHistory?.length ?? 0
          const diskLen = diskClicks.length
          if (mergedClicks.length === localLen && localLen === diskLen) return local
          mergedChanged = true
          return {
            ...local,
            clickHistory: mergedClicks,
            count: mergedClicks.length,
            updatedAt: nowIso(),
          }
        })
        /** @type {typeof sessions} */
        const extra = []
        for (const [id, row] of rawById) {
          if (memIds.has(id)) continue
          const photos = Array.isArray(row.photos)
            ? await hydratePhotoRecordsArray(row.photos)
            : []
          const n = normalizeSession({ ...row, photos })
          if (n) extra.push(n)
        }
        mergedSessions = extra.length ? [...merged, ...extra] : merged
      }
    } catch {
      /* ignore corrupt disk */
    } finally {
      needsAppStateDiskMerge = false
    }
  }
  if (needsAppStateDiskMerge && skipDiskMerge) {
    appendStorageDebugTrace('save_worker_skip_disk_merge', { key })
  }
  sessions = mergedSessions
  if (currentSessionId && mergedChanged) {
    const prevChLen = state.clickHistory.length
    state = loadCurrentSessionState()
    if (view === 'session' && map && state.clickHistory.length !== prevChLen) {
      rebuildMarkers('storage_merge_remote_clicks')
      renderCount()
      renderLog()
      renderPhotosGallery()
      updateMapSharePanel()
    }
  }
  try {
    writeCoreSnapshotSync(skipDiskMerge ? 'worker_fast_close' : 'worker')
    await flushLocalStorageAppState(key)
    appendStorageDebugTrace('save_worker_ok', { key })
  } catch {
    appendStorageDebugTrace('save_worker_failed', { key })
    /* toast allerede vist */
  }
  if (isRemoteAppStateDataEnabled()) scheduleSupabaseAppStatePush()
}

function saveAppState() {
  appendStorageDebugTrace('save_scheduled', {
    key: sessionsKeyForCurrentContext(),
    sessionsCount: sessions.length,
    currentSessionId,
  })
  // #region agent log
  fetch('http://127.0.0.1:7637/ingest/e58399ea-bfe1-456f-9512-3bdae1c6fc15',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ff8b7b'},body:JSON.stringify({sessionId:'ff8b7b',runId:'pre-fix',hypothesisId:'H3',location:'main.js:saveAppState:schedule',message:'save_debounce_scheduled',data:{userId:currentUser?.id||null,currentSessionId,sessionsCount:sessions.length,debounceMs:220,key:sessionsKeyForCurrentContext()},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  clearTimeout(appStatePersistDebounce)
  appStatePersistDebounce = setTimeout(() => {
    appStatePersistDebounce = null
    appStateSaveChain = appStateSaveChain
      .then(() => saveAppStateWorker())
      .catch((e) => console.warn('saveAppState:', e))
  }, 220)
}

function forceSaveAppStateNow(reason = 'force') {
  appendStorageDebugTrace('save_force_now', { reason })
  writeCoreSnapshotSync(`force_${reason}`)
  writeEmergencySessionDelta(reason)
  if (appStatePersistDebounce) {
    clearTimeout(appStatePersistDebounce)
    appStatePersistDebounce = null
  }
  appStateSaveChain = appStateSaveChain
    .then(() =>
      saveAppStateWorker({
        // Ved app-lukk er tid kritisk; hopp over tung disk-merge og skriv direkte.
        skipDiskMerge: true,
      }),
    )
    .catch((e) => console.warn(`forceSaveAppStateNow(${reason})`, e))
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
      ? s.photos.map(normalizePhotoOrSkeleton).filter(Boolean)
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
/** Siste økt brukeren var i (for «Fortsett» på forsiden); persisteres i localStorage. */
let lastResumeSessionId = null
/** Siste økt som ble oppdatert i minne, brukt for nødsnapshot ved app-lukk. */
let lastTouchedSessionId = null

function stashActiveSessionForResumeBeforeLeave() {
  if (
    currentSessionId &&
    sessions.some((s) => s.id === currentSessionId)
  ) {
    lastResumeSessionId = currentSessionId
  }
}

/**
 * Økt-id for «Fortsett siste økt»: lagret verdi hvis den finnes, ellers nyeste `updatedAt`.
 * @returns {string | null}
 */
function resolveResumeSessionId() {
  const fromMem =
    typeof lastResumeSessionId === 'string' ? lastResumeSessionId.trim() : ''
  if (fromMem && sessions.some((s) => s.id === fromMem)) return fromMem
  if (!sessions.length) return null
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt || 0).getTime() -
      new Date(a.updatedAt || a.createdAt || 0).getTime(),
  )
  return sorted[0]?.id ?? null
}
/** Bilder fra «Ta bilde» på forsiden (uten aktiv økt). */
let standalonePhotos = []
/** Lagrede friksjonsmålinger (start–stopp + verdi), per bruker i app-lagring. */
let frictionMeasurements = []
/** @type {'home' | 'menuSession' | 'menuUser' | 'menuMap' | 'menuFriction' | 'menuPhotos' | 'menuContacts' | 'menuTrafficGroup' | 'menuSettings' | 'menuHaptics' | 'menuOfflineVegref' | 'menuPrivacy' | 'menuSupport' | 'menuExcelExport' | 'menuFollowUpRoute' | 'followUpRouteEdit' | 'session' | 'auth' | 'inbox' | 'sharedSessionReview' | 'photoAlbum' | 'receivedPhotos'} */
let view = 'home'
/** Innboks: hele DelSky-hub vs. kun innkommende meldinger (fra varslingsikon). */
/** @type {'delsky' | 'messages'} */
let inboxUiMode = 'delsky'
const DELSKY_QUOTA_BYTES = 50 * 1024 * 1024 * 1024
const DELSKY_USAGE_POLL_MS = 20_000
/** @type {{
 * usedBytes: number,
 * quotaBytes: number,
 * percent: number,
 * bySource: { r2Bytes: number, supabaseBytes: number },
 * updatedAt: number,
 * status: 'idle' | 'loading' | 'ready' | 'error',
 * isNearLimit: boolean,
 * isOverLimit: boolean
 * }} */
let delskyStorageUsage = {
  usedBytes: 0,
  quotaBytes: DELSKY_QUOTA_BYTES,
  percent: 0,
  bySource: { r2Bytes: 0, supabaseBytes: 0 },
  updatedAt: 0,
  status: 'idle',
  isNearLimit: false,
  isOverLimit: false,
}
/** @type {ReturnType<typeof setInterval> | null} */
let delskyUsagePollId = null
/** @type {ReturnType<typeof setTimeout> | null} */
let delskyUsageDebouncedRefresh = null
/** @type {'oversikt' | 'kart'} */
let sharedSessionReviewTab = 'oversikt'
/** Faner under «Økten»: oversikt, gjenoppta, last ned, importer. */
let menuSessionTab = 'sessions'
/** Kart på meny-siden «Kart» (uten aktiv økt). */
let menuBrowseMap = null
/** Oppfølgingsrute (redigering / fullskjerm). */
let followUpEditMap = null
let followUpFsMap = null
/** @type {import('leaflet').Layer | null} */
let followUpEditCluster = null
/** @type {import('leaflet').Layer | null} */
let followUpFsCluster = null
/** @type {import('leaflet').Marker[]} */
let followUpLeafletMarkers = []
/** @type {{ id: string, title: string, createdAt: string, updatedAt: string, markers: object[] } | null} */
let followUpDraft = null
/** @type {ReturnType<typeof setInterval> | null} */
let followUpPulseTimer = null
/** @type {AbortController | null} */
let followUpRouteAbort = null
/** Fullskjerm kart for friksjonsmåling (hamburger-meny). */
let frictionMap = null
/** @type {number | null} */
let frictionWatchId = null
let frictionMeasuring = false
/** @type {Array<{ lat: number, lng: number }>} */
let frictionPoints = []
/** @type {import('leaflet').Polyline | null} */
let frictionTrackPreview = null
/** @type {import('leaflet').Polyline | null} */
let frictionRouteLine = null
/** @type {import('leaflet').Marker | null} */
let frictionStartMarker = null
/** @type {import('leaflet').Marker | null} */
let frictionEndMarker = null
/** @type {import('leaflet').Marker | null} */
let frictionValueMarker = null
let frictionDistanceM = 0
/** @type {number | null} */
let frictionValueSaved = null
/** Etter stopp: strekning klar for verdi / visning. */
let frictionSegmentComplete = false
/** @type {import('leaflet').LayerGroup | null} */
let frictionHistoryLayerGroup = null
/** @type {Map<string, import('leaflet').Polyline>} */
let frictionHistoryPolylines = new Map()
/** Økt for nye friksjonsmålinger (lagre / Excel for «denne økta»). */
let frictionActiveSessionId = null
/** Forrige økt-id før «Ny økt» — kan gjenopptas. */
let frictionPreviousSessionId = null
/**
 * Øker ved hver Start; brukes så async NVDB-svar ikke blandes mellom strekninger.
 */
let frictionSegmentGeneration = 0
/** NVDB ved Start-trykk (samme API som forsiden / posisjon). */
let frictionPendingStartVegref = null
/** NVDB ved Stopp-trykk. */
let frictionPendingStopVegref = null

function ensureFrictionSessionId() {
  if (!frictionActiveSessionId) frictionActiveSessionId = crypto.randomUUID()
  return frictionActiveSessionId
}

/**
 * @param {{ frictionActiveSessionId?: string | null, frictionPreviousSessionId?: string | null } | null | undefined} diskApp
 */
function applyFrictionSessionIdsFromDisk(diskApp) {
  if (!diskApp) {
    frictionActiveSessionId = null
    frictionPreviousSessionId = null
    return
  }
  frictionActiveSessionId =
    typeof diskApp.frictionActiveSessionId === 'string' &&
    diskApp.frictionActiveSessionId
      ? diskApp.frictionActiveSessionId
      : null
  frictionPreviousSessionId =
    typeof diskApp.frictionPreviousSessionId === 'string' &&
    diskApp.frictionPreviousSessionId
      ? diskApp.frictionPreviousSessionId
      : null
}

/**
 * @param {{ frictionActiveSessionId?: string | null, frictionPreviousSessionId?: string | null } | null | undefined} diskApp
 * @param {{ frictionActiveSessionId?: string | null, frictionPreviousSessionId?: string | null } | null | undefined} remote
 */
function mergeFrictionSessionStateFromRemote(diskApp, remote) {
  const dA = diskApp?.frictionActiveSessionId
  const dP = diskApp?.frictionPreviousSessionId
  const r = remote && typeof remote === 'object' ? remote : null
  const rA = r?.frictionActiveSessionId
  const rP = r?.frictionPreviousSessionId
  return {
    frictionActiveSessionId:
      typeof dA === 'string' && dA
        ? dA
        : typeof rA === 'string' && rA
          ? rA
          : null,
    frictionPreviousSessionId:
      typeof dP === 'string' && dP
        ? dP
        : typeof rP === 'string' && rP
          ? rP
          : null,
  }
}

function emptyRemoteUserAppState() {
  return {
    sessions: [],
    currentSessionId: null,
    standalonePhotos: [],
    frictionMeasurements: [],
    frictionActiveSessionId: null,
    frictionPreviousSessionId: null,
    followUpRoutes: [],
  }
}

/**
 * Bygg `user_app_state`-payload der kun gitte lokale økter skrives inn i fjern-tilstanden;
 * alle andre økter som allerede ligger i sky beholdes uendret.
 * @param {ReturnType<typeof emptyRemoteUserAppState> & { sessions?: unknown[] }} remoteRow
 * @param {Set<string>} sessionIds
 * @param {boolean} includeStandalone merge inn lokale «Ta bilde»-bilder (etter opplasting)
 */
function buildPartialUserAppStatePayloadFromRemote(
  remoteRow,
  sessionIds,
  includeStandalone,
) {
  const r = remoteRow && typeof remoteRow === 'object' ? remoteRow : null
  const remoteSessRaw = Array.isArray(r?.sessions) ? r.sessions : []
  const remoteSessArr = remoteSessRaw.map(normalizeSession).filter(Boolean)
  const remoteById = new Map(remoteSessArr.map((s) => [s.id, s]))
  for (const sid of sessionIds) {
    const loc = sessions.find((s) => s.id === sid)
    if (!loc) continue
    const prev = remoteById.get(sid)
    const merged = prev ? mergeStoredSessionsPair(loc, prev) : loc
    remoteById.set(sid, normalizeSession(merged))
  }
  const nextSessions = [...remoteById.values()].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  const remoteStandalone = normalizeStandalonePhotosList(
    Array.isArray(r?.standalonePhotos) ? r.standalonePhotos : [],
  )
  const nextStandalone = includeStandalone
    ? mergeStandalonePhotoLists(remoteStandalone, standalonePhotos)
    : remoteStandalone
  const nextFriction = mergeFrictionMeasurementLists(
    normalizeFrictionMeasurementsList(
      Array.isArray(r?.frictionMeasurements) ? r.frictionMeasurements : [],
    ),
    frictionMeasurements,
  )
  const mergedFrictionIds = mergeFrictionSessionStateFromRemote(
    {
      frictionActiveSessionId,
      frictionPreviousSessionId,
    },
    r,
  )
  let nextCur =
    typeof r?.currentSessionId === 'string' ? r.currentSessionId : null
  if (nextCur && !nextSessions.some((s) => s.id === nextCur)) nextCur = null
  const remoteFollowUp = Array.isArray(r?.followUpRoutes)
    ? r.followUpRoutes
    : []
  return sanitizeUserAppStateForSupabasePayload({
    version: 2,
    sessions: nextSessions,
    currentSessionId: nextCur,
    standalonePhotos: nextStandalone,
    frictionMeasurements: nextFriction,
    frictionActiveSessionId: mergedFrictionIds.frictionActiveSessionId,
    frictionPreviousSessionId: mergedFrictionIds.frictionPreviousSessionId,
    followUpRoutes: remoteFollowUp,
  })
}

/**
 * Bygg full delsky-payload fra eksisterende fjern-rad og erstatt kun `followUpRoutes`
 * (brukes ved eksplisitt «send oppfølgingsruter» — øvrig innhold tas uendret fra sky).
 * @param {ReturnType<typeof emptyRemoteUserAppState> & { sessions?: unknown[] }} remoteRow
 * @param {unknown[]} followUpRoutes
 */
function buildFullDelskyPayloadFromRemoteWithFollowUpRoutes(
  remoteRow,
  followUpRoutes,
) {
  const r =
    remoteRow && typeof remoteRow === 'object' ? remoteRow : emptyRemoteUserAppState()
  const remoteSessRaw = Array.isArray(r.sessions) ? r.sessions : []
  const remoteSessArr = remoteSessRaw.map(normalizeSession).filter(Boolean)
  const nextSessions = [...remoteSessArr].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  let nextCur =
    typeof r.currentSessionId === 'string' ? r.currentSessionId : null
  if (nextCur && !nextSessions.some((s) => s.id === nextCur)) nextCur = null
  const nextStandalone = normalizeStandalonePhotosList(
    Array.isArray(r.standalonePhotos) ? r.standalonePhotos : [],
  )
  const nextFriction = normalizeFrictionMeasurementsList(
    Array.isArray(r.frictionMeasurements) ? r.frictionMeasurements : [],
  )
  const fa =
    typeof r.frictionActiveSessionId === 'string'
      ? r.frictionActiveSessionId
      : null
  const fp =
    typeof r.frictionPreviousSessionId === 'string'
      ? r.frictionPreviousSessionId
      : null
  return sanitizeUserAppStateForSupabasePayload({
    version: 2,
    sessions: nextSessions,
    currentSessionId: nextCur,
    standalonePhotos: nextStandalone,
    frictionMeasurements: nextFriction,
    frictionActiveSessionId: fa,
    frictionPreviousSessionId: fp,
    followUpRoutes: Array.isArray(followUpRoutes) ? followUpRoutes : [],
  })
}

/** Rad i session_shares mens brukeren forhåndsviser en delt økt (før lagre / forkast). */
let previewIncomingShareId = null
/** @type {'login' | 'register'} */
let authScreen = 'login'

/** @type {ReturnType<typeof defaultState>} */
let state

/** @type {ReturnType<typeof setTimeout> | null} */
let supabaseSaveTimer = null
/** Begrenser «Lagret i delsky»-toast ved stille metadata-synk. */
let lastDelskyStateSyncToastAt = 0
/** Økter som skal flettes inn i delsky ved neste push (typisk etter bildeopplasting). */
let sessionIdsPendingPartialCloudPush = /** @type {Set<string>} */ (new Set())
/** Frittstående bilder: flett lokale inn i sky-vedlegg ved neste push. */
let standalonePhotosPendingPartialCloudPush = false

/**
 * Én gangs kø når sky er tom men enheten har økter (f.eks. første innlogging etter bare lokalt arbeid).
 */
function queueDelskyBaselineFromLocalSessions() {
  if (!isRemoteAppStateDataEnabled() || !currentUser?.id) return
  if (!sessions.length) return
  for (const s of sessions) {
    if (s?.id) sessionIdsPendingPartialCloudPush.add(s.id)
  }
  if (standalonePhotos.length) standalonePhotosPendingPartialCloudPush = true
}

/** Unngå dobbel nullstilling når `logoutUser` allerede håndterer UI etter `signOut`. */
let ignoreNextSupabaseSignedOut = false

function cancelSupabaseAppStatePush() {
  if (supabaseSaveTimer) {
    clearTimeout(supabaseSaveTimer)
    supabaseSaveTimer = null
  }
}

/**
 * Bilder som er «skall» i minnet (ingen dataUrl ennå) men allerede har `storageFullPath`
 * kan trygt være med i `user_app_state`-payload — filene ligger i bucket.
 * Blokker kun når piksel ikke er i sky OG ikke lokalt ferdig representert (da kan upsert viske ut bilder).
 * @param {unknown} p
 */
function photoBlocksUserAppStateCloudUpsert(p) {
  if (!p || typeof p !== 'object') return false
  if (!/** @type {{ pixelPending?: boolean }} */ (p).pixelPending) return false
  const path = /** @type {{ storageFullPath?: string }} */ (p).storageFullPath
  if (typeof path === 'string' && path.trim()) return false
  return true
}

function appStateHasRemotePhotoSkeletons() {
  for (const p of standalonePhotos) {
    if (photoBlocksUserAppStateCloudUpsert(p)) return true
  }
  for (const s of sessions) {
    for (const p of s.photos || []) {
      if (photoBlocksUserAppStateCloudUpsert(p)) return true
    }
  }
  return false
}

/** Skjelett-sjekk begrenset til økter som faktisk skal i payload (+ ev. standalone). */
function appStateHasRemotePhotoSkeletonsPartial(sessionIds, includeStandalone) {
  if (includeStandalone) {
    for (const p of standalonePhotos) {
      if (photoBlocksUserAppStateCloudUpsert(p)) return true
    }
  }
  const idSet = new Set(sessionIds)
  for (const s of sessions) {
    if (!idSet.has(s.id)) continue
    for (const p of s.photos || []) {
      if (photoBlocksUserAppStateCloudUpsert(p)) return true
    }
  }
  return false
}

/** Antall bilder som blokkerer full `user_app_state`-upsert (skall uten sky-sti). */
function countRemotePhotoSkeletons() {
  let n = 0
  for (const p of standalonePhotos) {
    if (photoBlocksUserAppStateCloudUpsert(p)) n += 1
  }
  for (const s of sessions) {
    for (const p of s.photos || []) {
      if (photoBlocksUserAppStateCloudUpsert(p)) n += 1
    }
  }
  return n
}

function countRemotePhotoSkeletonsPartial(sessionIds, includeStandalone) {
  let n = 0
  if (includeStandalone) {
    for (const p of standalonePhotos) {
      if (photoBlocksUserAppStateCloudUpsert(p)) n += 1
    }
  }
  const idSet = new Set(sessionIds)
  for (const s of sessions) {
    if (!idSet.has(s.id)) continue
    for (const p of s.photos || []) {
      if (photoBlocksUserAppStateCloudUpsert(p)) n += 1
    }
  }
  return n
}

/**
 * Økter med minst ett bilde-skall uten storage blokkerte tidligere *hele* køen — da kom ingenting til Mac.
 * @param {Set<string>} sessionScope
 * @returns {{ ready: Set<string>, blocked: Set<string> }}
 */
function partitionSessionsForCloudPush(sessionScope) {
  const ready = new Set()
  const blocked = new Set()
  for (const sid of sessionScope) {
    if (appStateHasRemotePhotoSkeletonsPartial(new Set([sid]), false)) {
      blocked.add(sid)
    } else {
      ready.add(sid)
    }
  }
  return { ready, blocked }
}

function scheduleSupabaseAppStatePush() {
  if (isMinDownloadMode()) return
  if (!isRemoteAppStateDataEnabled()) {
    registerNetLogSupabasePushSkipped('remote_app_state_not_configured')
    return
  }
  if (!currentUser?.id) {
    registerNetLogSupabasePushSkipped('no_logged_in_user')
    return
  }
  if (!isScanixCloudApiConfigured()) {
    const sb = getSupabase()
    if (!sb) {
      registerNetLogSupabasePushSkipped('no_supabase_client')
      return
    }
  }
  cancelSupabaseAppStatePush()
  supabaseSaveTimer = setTimeout(() => {
    supabaseSaveTimer = null
    const uid = currentUser?.id
    if (!uid) {
      registerNetLogSupabasePushSkipped('no_user_id_after_timer')
      return
    }
    void (async () => {
      await refreshNativeNetworkStatus()
      const heavyDefer = getHeavyCloudTrafficDeferralReason()
      if (heavyDefer === 'offline') {
        registerNetLogSupabasePushSkipped('offline')
        return
      }
      if (heavyDefer === 'metered') {
        registerNetLogSupabasePushSkipped('metered_heavy_cloud')
        syncPhotoUploadDeferralBanner()
        try {
          if (
            typeof sessionStorage !== 'undefined' &&
            sessionStorage.getItem('scanix-delsky-metered-hint') !== '1'
          ) {
            sessionStorage.setItem('scanix-delsky-metered-hint', '1')
            showSessionToast(
              'Du er på mobilnett. Økter og bilder til delsky venter til Wi‑Fi — eller slå på «Tillat opplasting på mobilnett» under Innstillinger → Offline (kan bruke mye mobildata).',
              8500,
            )
          }
        } catch {
          /* ignore */
        }
        return
      }
      const runDebouncedSupabasePush = async () => {
        try {
          await tryDrainPhotoUploadQueue({ userId: uid })
        } catch (e) {
          console.warn('tryDrainPhotoUploadQueue', e)
        }
        syncPhotoUploadDeferralBanner()
        const sessionScope = new Set(sessionIdsPendingPartialCloudPush)
        const includeStandalone = standalonePhotosPendingPartialCloudPush
        if (sessionScope.size === 0 && !includeStandalone) {
          return
        }
        const { ready: readySessions, blocked: blockedSessions } =
          partitionSessionsForCloudPush(sessionScope)
        const standalonePhotosBlocked =
          includeStandalone &&
          appStateHasRemotePhotoSkeletonsPartial(new Set(), true)
        const pushStandalone = includeStandalone && !standalonePhotosBlocked
        if (readySessions.size === 0 && !pushStandalone) {
          registerNetLogSupabasePushSkipped('photo_skeletons_block_full_upsert', {
            pixelPendingCount: countRemotePhotoSkeletonsPartial(
              sessionScope,
              includeStandalone,
            ),
            blockedSessionCount: blockedSessions.size,
            note: 'DelSky: alle økter i køen (og ev. frittstående bilder) vent på piksel/storage — ingen deler sendt.',
          })
          return 'skip'
        }
        if (blockedSessions.size > 0) {
          console.warn(
            `[Scanix] DelSky: hopper over ${blockedSessions.size} økt(er) med uferdige bilder; sender ${readySessions.size} klare + frittstående=${pushStandalone}.`,
          )
        }
        let remoteRow
        try {
          remoteRow = await fetchRemoteUserAppState(uid, { mode: 'full' })
        } catch (e) {
          console.warn('fetchUserAppState (partial push)', e)
          return 'skip'
        }
        const payload = buildPartialUserAppStatePayloadFromRemote(
          remoteRow ?? emptyRemoteUserAppState(),
          readySessions,
          pushStandalone,
        )
        await upsertRemoteUserAppState(uid, payload)
        for (const id of readySessions) {
          sessionIdsPendingPartialCloudPush.delete(id)
        }
        if (pushStandalone) standalonePhotosPendingPartialCloudPush = false
        return 'ok'
      }
      try {
        const pushOutcome = await runDebouncedSupabasePush()
        /* Ingen fullskjerm-sky her — kun stille auto-synk. Sky-animasjon brukes ved «Del oppdrag» / send til mottaker. */
        if (pushOutcome === 'ok') {
          const now = Date.now()
          if (now - lastDelskyStateSyncToastAt > 35_000) {
            lastDelskyStateSyncToastAt = now
            showSessionToast('Økter lagret i delsky.', 2200)
          }
        }
      } catch (e) {
        console.warn('supabase auto push', e)
      }
    })()
  }, 4500)
}

function syncPhotoUploadDeferralBanner() {
  const el = document.getElementById('home-photo-upload-deferral')
  if (!el) return
  const d =
    isRemoteAppStateDataEnabled() && currentUser?.id
      ? getPhotoUploadQueueDeferralUi()
      : null
  el.classList.remove(
    'home-photo-upload-deferral--offline',
    'home-photo-upload-deferral--cellular',
  )
  if (!d) {
    el.innerHTML = ''
    el.hidden = true
    el.setAttribute('aria-hidden', 'true')
    return
  }
  el.classList.add(
    d.reason === 'offline'
      ? 'home-photo-upload-deferral--offline'
      : 'home-photo-upload-deferral--cellular',
  )
  el.hidden = false
  el.setAttribute('aria-hidden', 'false')
  const msg =
    d.reason === 'offline'
      ? `Bilder venter på nett (${d.count})`
      : `Bilder venter på Wi‑Fi (${d.count})`
  el.innerHTML = `<span class="home-photo-upload-deferral__inner">${escapeHtml(msg)}</span>`
}

/**
 * @param {string | null | undefined} sid
 */
function notePartialCloudPushForSessionId(sid) {
  if (typeof sid !== 'string' || !sid) return
  if (!isRemoteAppStateDataEnabled() || !currentUser?.id) return
  sessionIdsPendingPartialCloudPush.add(sid)
}

/**
 * Marker hvilken økt (eller frittstående bilder) som trenger delsky-fletting etter opplasting.
 * @param {string} photoId
 */
function notePartialCloudPushForPhotoId(photoId) {
  if (typeof photoId !== 'string' || !photoId) return
  let inSession = false
  for (const s of sessions) {
    for (const ph of s.photos || []) {
      if (ph && /** @type {{ id?: string }} */ (ph).id === photoId) {
        sessionIdsPendingPartialCloudPush.add(s.id)
        inSession = true
        break
      }
    }
    if (inSession) break
  }
  if (!inSession) {
    for (const ph of standalonePhotos) {
      if (ph && /** @type {{ id?: string }} */ (ph).id === photoId) {
        standalonePhotosPendingPartialCloudPush = true
        break
      }
    }
  }
}

setPhotoStorageUploadCallbacks((photoId, paths, usageDeltaBytes = 0) => {
  for (const s of sessions) {
    for (const ph of s.photos || []) {
      if (ph && /** @type {{ id?: string }} */ (ph).id === photoId) {
        Object.assign(ph, paths)
      }
    }
  }
  for (const ph of standalonePhotos) {
    if (ph && /** @type {{ id?: string }} */ (ph).id === photoId) {
      Object.assign(ph, paths)
    }
  }
  notePartialCloudPushForPhotoId(photoId)
  if (isScanixCloudApiConfigured() && usageDeltaBytes > 0) {
    bumpDelskyUsageOptimistic(usageDeltaBytes)
    scheduleDelskyUsageRefreshSoon()
  }
  saveAppState()
  scheduleSupabaseAppStatePush()
  syncPhotoUploadDeferralBanner()
})

/**
 * Sørg for at alle bilder i økta står i opplastingskøen (når de mangler storage-sti).
 * @param {string} sessionId
 */
function enqueuePhotosInSessionForStorageUpload(sessionId) {
  const sess = sessions.find((s) => s.id === sessionId)
  if (!sess?.photos?.length) return
  for (const ph of sess.photos) {
    if (!ph || typeof ph !== 'object') continue
    const id = /** @type {{ id?: string }} */ (ph).id
    if (typeof id !== 'string' || !id) continue
    const path = /** @type {{ storageFullPath?: string }} */ (ph).storageFullPath
    if (typeof path === 'string' && path.trim()) continue
    enqueuePhotoStorageUpload(id)
  }
}

/**
 * Brukertrykk: lagre gjeldende oppdrag til innlogget brukers DelSky (user_app_state + bilder).
 * Ikke det samme som «Del oppdrag» til annen mottaker.
 */
async function pushCurrentSessionToMyDelsky() {
  if (isMinDownloadMode()) {
    showSessionToast('DelSky er av i prøvedrift uten sky.', 2800)
    return
  }
  if (!currentUser?.id) {
    showSessionToast('Logg inn for å bruke DelSky.', 2800)
    return
  }
  if (!isRemoteAppStateDataEnabled()) {
    showSessionToast(
      'DelSky krever sky-backend: sett VITE_SCANIX_CLOUD_API_BASE_URL (egen API + R2) eller VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY i .env, bygg på nytt.',
      6200,
    )
    return
  }
  if (previewIncomingShareId) {
    showSessionToast('Lagre delt oppdrag på enheten først (Avslutt oppdrag).', 3200)
    return
  }
  if (!currentSessionId) return

  flushCurrentSession()
  const sid = currentSessionId
  const uid = currentUser.id
  if (!isScanixCloudApiConfigured()) {
    const sb = getSupabase()
    if (!sb) {
      showSessionToast('Ingen forbindelse til DelSky.', 2400)
      return
    }
  }

  try {
    await hydrateAllAppPhotoPixelsFromIdb()
  } catch (e) {
    console.warn('hydrateAllAppPhotoPixelsFromIdb (delsky push)', e)
  }

  enqueuePhotosInSessionForStorageUpload(sid)

  await refreshNativeNetworkStatus()
  const heavyDefer = getHeavyCloudTrafficDeferralReason()
  if (heavyDefer === 'offline') {
    showSessionToast('Offline – kan ikke sende til DelSky.', 2800)
    return
  }
  if (heavyDefer === 'metered') {
    showSessionToast(
      'På mobilnett: slå på «Tillat synk på mobilnett» under Innstillinger → Offline, eller bruk Wi‑Fi.',
      5200,
    )
    return
  }

  cancelSupabaseAppStatePush()

  const q0 = getPhotoUploadQueueCount()
  /** @type {'skip' | 'ok' | void} */
  let outcome
  const runPush = async () => {
    try {
      await tryDrainPhotoUploadQueue({ userId: uid })
    } catch (e) {
      console.warn('tryDrainPhotoUploadQueue (delsky push)', e)
    }
    syncPhotoUploadDeferralBanner()
    const scope = new Set([sid])
    if (appStateHasRemotePhotoSkeletonsPartial(scope, false)) {
      registerNetLogSupabasePushSkipped('photo_skeletons_block_full_upsert', {
        pixelPendingCount: countRemotePhotoSkeletonsPartial(scope, false),
        note: 'DelSky-manuell push: vent til bildene i denne økta har piksel eller er lastet opp.',
      })
      showSessionToast(
        'Noen bilder mangler miniatyr/piksel – vent litt og prøv igjen.',
        4200,
      )
      return 'skip'
    }
    let remoteRow
    try {
      remoteRow = await fetchRemoteUserAppState(uid, { mode: 'full' })
    } catch (e) {
      console.warn('fetchUserAppState (delsky push)', e)
      showSessionToast('Kunne ikke hente gjeldende delsky-data. Prøv igjen.', 3200)
      return 'skip'
    }
    const payload = buildPartialUserAppStatePayloadFromRemote(
      remoteRow ?? emptyRemoteUserAppState(),
      scope,
      false,
    )
    await upsertRemoteUserAppState(uid, payload)
    sessionIdsPendingPartialCloudPush.delete(sid)
    return 'ok'
  }

  const sessForEstimate = sessions.find((x) => x.id === sid)
  const payloadForEstimate = sanitizeUserAppStateForSupabasePayload({
    version: 2,
    sessions: sessForEstimate ? [sessForEstimate] : [],
    currentSessionId: null,
    standalonePhotos: [],
    frictionMeasurements: [],
    frictionActiveSessionId: null,
    frictionPreviousSessionId: null,
  })
  const overlayMs = estimateDelskyOverlayDurationMs(
    payloadForEstimate,
    Math.max(1, q0),
  )
  try {
    await runDelskySyncWithOverlay(async () => {
      outcome = await runPush()
    }, overlayMs)
  } catch (e) {
    console.warn('pushCurrentSessionToMyDelsky', e)
    showSessionToast('Kunne ikke sende til DelSky.', 2800)
    scheduleSupabaseAppStatePush()
    return
  }
  scheduleSupabaseAppStatePush()
  if (outcome === 'ok') {
    showSessionToast(
      'Oppdraget er i DelSky. Åpne DelSky på Mac/nett – økten oppdateres der.',
      4200,
    )
  }
}

async function pushFollowUpRoutesToDelsky() {
  if (isMinDownloadMode()) return
  const uid = currentUser?.id
  if (!uid) {
    showSessionToast('Logg inn for å bruke DelSky.', 2800)
    return
  }
  const sb = getSupabase()
  if (!isRemoteAppStateDataEnabled() || (!isScanixCloudApiConfigured() && !sb)) {
    showSessionToast(
      'DelSky krever sky-backend (VITE_SCANIX_CLOUD_API_BASE_URL eller Supabase URL+nøkkel). Bygg på nytt etter env er satt.',
      5200,
    )
    return
  }
  await refreshNativeNetworkStatus()
  const heavyDefer = getHeavyCloudTrafficDeferralReason()
  if (heavyDefer === 'offline') {
    showSessionToast('Offline – kan ikke sende til delsky.', 2800)
    return
  }
  if (heavyDefer === 'metered') {
    showSessionToast(
      'På mobilnett: slå på «Tillat synk på mobilnett» under Innstillinger → Offline, eller bruk Wi‑Fi.',
      5200,
    )
    return
  }
  cancelSupabaseAppStatePush()
  const routes = loadFollowUpRoutes(uid)
  const payloadForEstimate = { version: 2, followUpRoutes: routes }
  const overlayMs = estimateDelskyOverlayDurationMs(payloadForEstimate, 0)
  /** @type {'ok' | 'skip' | void} */
  let outcome
  try {
    await runDelskySyncWithOverlay(async () => {
      let remoteRow
      try {
        remoteRow = await fetchRemoteUserAppState(uid, { mode: 'full' })
      } catch (e) {
        console.warn('fetchUserAppState (followUp push)', e)
        showSessionToast(
          'Kunne ikke hente gjeldende delsky-data. Prøv igjen.',
          3200,
        )
        outcome = 'skip'
        return
      }
      if (!remoteRow) {
        showSessionToast(
          'Fant ingen delsky-tilstand å oppdatere (nettfeil eller ingen data i sky ennå). Synk økter til delsky først, eller prøv igjen.',
          5200,
        )
        outcome = 'skip'
        return
      }
      const payload = buildFullDelskyPayloadFromRemoteWithFollowUpRoutes(
        remoteRow,
        routes,
      )
      await upsertRemoteUserAppState(uid, payload)
      outcome = 'ok'
    }, overlayMs)
  } catch (e) {
    console.warn('pushFollowUpRoutesToDelsky', e)
    showSessionToast('Kunne ikke sende oppfølgingsruter til delsky.', 3200)
    scheduleSupabaseAppStatePush()
    return
  }
  scheduleSupabaseAppStatePush()
  if (outcome === 'ok') {
    showSessionToast('Oppfølgingsruter er lagret i delsky.', 3800)
  }
}

async function pullFollowUpRoutesFromDelsky() {
  if (isMinDownloadMode()) return
  const uid = currentUser?.id
  if (!uid) {
    showSessionToast('Logg inn for å bruke DelSky.', 2800)
    return
  }
  const sb = getSupabase()
  if (!isRemoteAppStateDataEnabled() || (!isScanixCloudApiConfigured() && !sb)) {
    showSessionToast(
      'DelSky krever sky-backend (VITE_SCANIX_CLOUD_API_BASE_URL eller Supabase URL+nøkkel). Bygg på nytt etter env er satt.',
      5200,
    )
    return
  }
  await refreshNativeNetworkStatus()
  const heavyDefer = getHeavyCloudTrafficDeferralReason()
  if (heavyDefer === 'offline') {
    showSessionToast('Offline – kan ikke hente fra delsky.', 2800)
    return
  }
  if (heavyDefer === 'metered') {
    showSessionToast(
      'På mobilnett: slå på «Tillat synk på mobilnett» under Innstillinger → Offline, eller bruk Wi‑Fi.',
      5200,
    )
    return
  }
  const overlayMs = estimateDelskyOverlayDurationMs({ version: 2 }, 0)
  /** @type {'ok' | 'skip' | void} */
  let outcome
  try {
    await runDelskySyncWithOverlay(async () => {
      let remoteRow
      try {
        remoteRow = await fetchRemoteUserAppState(uid, { mode: 'full' })
      } catch (e) {
        console.warn('fetchUserAppState (followUp pull)', e)
        showSessionToast('Kunne ikke hente fra delsky. Prøv igjen.', 3200)
        outcome = 'skip'
        return
      }
      if (!remoteRow) {
        showSessionToast('Ingen delsky-tilstand å hente.', 2800)
        outcome = 'skip'
        return
      }
      const remoteRoutes = normalizeFollowUpRoutesList(remoteRow.followUpRoutes)
      if (!remoteRoutes.length) {
        showSessionToast('Ingen oppfølgingsruter ligger i delsky ennå.', 3600)
        outcome = 'skip'
        return
      }
      const merged = mergeFollowUpRoutesByUpdatedAt(
        loadFollowUpRoutes(uid),
        remoteRoutes,
      )
      saveFollowUpRoutes(uid, merged)
      outcome = 'ok'
    }, overlayMs)
  } catch (e) {
    console.warn('pullFollowUpRoutesFromDelsky', e)
    showSessionToast('Kunne ikke hente oppfølgingsruter fra delsky.', 3200)
    return
  }
  if (outcome === 'ok') {
    showSessionToast('Oppfølgingsruter er oppdatert fra delsky.', 3800)
    refreshFollowUpSavedListDom()
  }
}

/**
 * WebKit (iOS) gir ofte bare «Load failed» / «Failed to fetch» ved nett/CORS-feil mot API.
 * @param {string} raw
 */
function mapFetchErrorToUserMessage(raw) {
  if (typeof raw !== 'string') return ''
  const m = raw.trim()
  if (!m) return ''
  const lower = m.toLowerCase()
  if (
    lower.includes('load failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('the internet connection appears to be offline')
  ) {
    return 'Kunne ikke koble til serveren. Sjekk Wi‑Fi eller mobilnett og prøv igjen.'
  }
  return m
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
  const net = mapFetchErrorToUserMessage(m)
  if (net !== m) return net
  return m || 'Noe gikk galt. Prøv igjen.'
}

/**
 * getSession() kan henge (nett/DNS) og blokkerer hele main.js via top-level await.
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {number} [ms]
 */
async function getSupabaseSessionWithTimeout(sb, ms = 8000) {
  try {
    return await Promise.race([
      sb.auth.getSession(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('getSession timeout')), ms),
      ),
    ])
  } catch (e) {
    console.warn(
      'Scanix: getSession avbrutt etter',
      ms,
      'ms — fortsetter med lokal sesjon om den finnes.',
      e,
    )
    return { data: { session: null }, error: null }
  }
}

/**
 * @template T
 * @param {Promise<T>} p
 * @param {number} ms
 * @param {string} label
 */
async function awaitWithTimeout(p, ms, label) {
  return Promise.race([
    p,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timeout (${ms}ms)`)),
        ms,
      ),
    ),
  ])
}

/** Må være i tråd med `fetchTimeoutMs` i supabaseClient (auth bruker samme fetch). */
const AUTH_SIGN_IN_TIMEOUT_MS = 90_000
/**
 * Etter JWT: profil (inntil ~42s) + `user_app_state` (inntil ~92s) kan kjøre etter hverandre.
 */
const AUTH_APPLY_SESSION_TIMEOUT_MS = 185_000

async function initAppStateFromStorage() {
  await restoreAuthFromIdbIfLocalEmpty()
  loadUsersFromStorage()

  const sb = getSupabase()
  if (sb) {
    const {
      data: { session },
      error: sessErr,
    } = await getSupabaseSessionWithTimeout(sb)
    if (sessErr) console.warn('Supabase getSession:', sessErr.message)
    if (session?.user) {
      try {
        currentUser = await awaitWithTimeout(
          buildCurrentUserFromSession(sb, session),
          12_000,
          'buildCurrentUserFromSession',
        )
        tryWriteAuthSession(currentUser)
        void backupAuthToIdb(loadUsersFromStorage(), currentUser)
        void requestPersistedStorageIfSupported()
        /* Disk først → rask forsida; sky-data hentes i bakgrunnen (hydrateUserAppStateFromRemote). */
        const diskApp = await loadAppStateFromStorageForUser(currentUser.id)
        sessions = diskApp.sessions
        currentSessionId = diskApp.currentSessionId
        standalonePhotos = diskApp.standalonePhotos
        frictionMeasurements = diskApp.frictionMeasurements
        applyFrictionSessionIdsFromDisk(diskApp)
        lastResumeSessionId =
          typeof diskApp.lastResumeSessionId === 'string'
            ? diskApp.lastResumeSessionId
            : null
      } catch (e) {
        console.warn('Supabase init:', e)
        const fb = loadAuthSession()
        if (fb) {
          currentUser = fb
          void requestPersistedStorageIfSupported()
          const diskApp = await loadAppStateFromStorageForUser(currentUser.id)
          sessions = diskApp.sessions
          currentSessionId = diskApp.currentSessionId
          standalonePhotos = diskApp.standalonePhotos
          frictionMeasurements = diskApp.frictionMeasurements
          applyFrictionSessionIdsFromDisk(diskApp)
          lastResumeSessionId =
            typeof diskApp.lastResumeSessionId === 'string'
              ? diskApp.lastResumeSessionId
              : null
        } else {
          currentUser = null
          clearAuthSession()
          sessions = []
          currentSessionId = null
          standalonePhotos = []
          frictionMeasurements = []
          applyFrictionSessionIdsFromDisk(null)
          lastResumeSessionId = null
        }
      }
    } else {
      /* getSession() kan være null (lagring/timing) mens lokal sesjon fortsatt finnes – ikke slett den. */
      const fb = loadAuthSession()
      if (fb) {
        currentUser = fb
        void requestPersistedStorageIfSupported()
        const diskApp = await loadAppStateFromStorageForUser(currentUser.id)
        sessions = diskApp.sessions
        currentSessionId = diskApp.currentSessionId
        standalonePhotos = diskApp.standalonePhotos
        frictionMeasurements = diskApp.frictionMeasurements
        applyFrictionSessionIdsFromDisk(diskApp)
        lastResumeSessionId =
          typeof diskApp.lastResumeSessionId === 'string'
            ? diskApp.lastResumeSessionId
            : null
      } else {
        currentUser = null
        clearAuthSession()
        sessions = []
        currentSessionId = null
        standalonePhotos = []
        frictionMeasurements = []
        applyFrictionSessionIdsFromDisk(null)
        lastResumeSessionId = null
      }
    }
  } else {
    currentUser = loadAuthSession()
    if (currentUser) void requestPersistedStorageIfSupported()
    syncShortIdFromUsersToSession()
    const initialApp = currentUser
      ? await loadAppStateFromStorageForUser(currentUser.id)
      : await loadAppStateFromStorageForUser(STORAGE_KEY_DEVICE_FALLBACK)
    sessions = initialApp.sessions
    currentSessionId = initialApp.currentSessionId
    standalonePhotos = initialApp.standalonePhotos
    frictionMeasurements = initialApp.frictionMeasurements
    applyFrictionSessionIdsFromDisk(initialApp)
    lastResumeSessionId =
      typeof initialApp.lastResumeSessionId === 'string'
        ? initialApp.lastResumeSessionId
        : null
  }

  if (currentSessionId && !sessions.some((s) => s.id === currentSessionId)) {
    currentSessionId = null
  }
  if (
    lastResumeSessionId &&
    !sessions.some((s) => s.id === lastResumeSessionId)
  ) {
    lastResumeSessionId = null
  }
  state = loadCurrentSessionState()
  if (!currentUser) {
    view = 'auth'
  } else if (currentSessionId) {
    view = 'session'
  } else {
    view = 'home'
  }

  try {
    if (await isPhotoBlobStoreAvailable()) {
      if (await hydrateAllAppPhotoPixelsFromIdb()) {
        state = loadCurrentSessionState()
      }
    }
  } catch (e) {
    console.warn('hydrateAllAppPhotoPixelsFromIdb (init)', e)
  }
}

/** Visninger der vi ikke overstyrer `view` ved sky-synk (bruker kan være i meny e.l.). */
function isViewLockedDuringRemoteHydrate() {
  return !['auth', 'home', 'session'].includes(view)
}

/**
 * Fingerprint så hydrate oppdager endringer *inne* i økter (ikke bare liste av id-er).
 * Uten dette ble ikke renderApp/saveAppState kjørt når telefon oppdaterte samme økt-id på Mac.
 * @param {typeof sessions} sessArr
 * @param {string | null} curSid
 */
function hydrateMergeFingerprint(
  sessArr,
  curSid,
  standaloneLen,
  frictionLen,
  frictionAct,
  frictionPrev,
) {
  const sessPart = [...sessArr]
    .map((s) => {
      const ph = (s.photos || []).length
      const lg = (s.log || []).length
      const ch = (s.clickHistory || []).length
      return `${s.id}:${String(s.updatedAt || '')}:${s.count}:${ch}:${ph}:${lg}`
    })
    .sort()
    .join(';')
  return `${curSid ?? ''}|${sessPart}|${standaloneLen}|${frictionLen}|${frictionAct ?? ''}|${frictionPrev ?? ''}`
}

/**
 * Hent user_app_state til flette-hydrate.
 * Nettleser: ikke stopp med confirm på «mobilnett» — da kommer aldri økter fra telefon inn på Mac/web uten at bruker forstår hvorfor.
 * Native: behold Wi‑Fi/mobil-gate som ved annen tung delsky-trafikk.
 * @param {string} userId
 */
async function fetchUserAppStateForHydrate(userId) {
  await refreshNativeNetworkStatus()
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null
  }
  if (isCapacitorNativePlatform()) {
    return fetchUserAppStateWithNetworkGate(userId)
  }
  return fetchUserAppStateWithTimeBudget(userId)
}

/** @type {ReturnType<typeof setTimeout> | null} */
let hydrateAfterAuthDebounceTimer = null

/** @type {Promise<void> | null} */
let hydrateUserAppStateFromRemoteInFlight = null

/** Unngå gjentatte gule hydrate-advarsler i konsollen (bootstrap + auto-hydrate). */
let hydrateAuthSessionWarned = false

function scheduleHydrateUserAppStateFromRemote() {
  if (isMinDownloadMode() || !isRemoteAppStateDataEnabled() || !currentUser?.id)
    return
  if (hydrateAfterAuthDebounceTimer) clearTimeout(hydrateAfterAuthDebounceTimer)
  hydrateAfterAuthDebounceTimer = setTimeout(() => {
    hydrateAfterAuthDebounceTimer = null
    void hydrateUserAppStateFromRemote()
  }, 450)
}

/**
 * Mac/nett: tom øktliste + innlogging → ett stille forsøk på å hente delsky (samme som «Hent fra sky»).
 * Unngås på native; telefon har eget lokalt lager.
 */
function scheduleBrowserHomeAutoHydrateIfEmpty() {
  if (isCapacitorNativePlatform()) return
  if (!isRemoteAppStateDataEnabled() || !currentUser?.id || isMinDownloadMode())
    return
  if (sessions.length > 0) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  try {
    if (typeof sessionStorage !== 'undefined') {
      const k = `scanix-home-autohyd:${currentUser.id}`
      if (sessionStorage.getItem(k) === '1') return
      sessionStorage.setItem(k, '1')
    }
  } catch {
    /* ignore */
  }
  window.setTimeout(() => {
    void hydrateUserAppStateFromRemote()
  }, 700)
}

/**
 * På Mac/nett kan første `getSession()` time ut eller være null mens JWT fortsatt kan gjenopprettes —
 * da ble `user_app_state` aldri hentet og øktlista forble tom.
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 */
async function resolveSupabaseSessionForHydrate(sb) {
  const uid = currentUser?.id
  if (!uid) return null
  const tryGet = async () => {
    const {
      data: { session: s },
    } = await getSupabaseSessionWithTimeout(sb, 14_000)
    return s?.user?.id === uid ? s : null
  }
  let session = await tryGet()
  if (session) {
    hydrateAuthSessionWarned = false
    return session
  }
  try {
    const { data, error } = await sb.auth.refreshSession()
    if (error && !String(error.message || '').includes('Auth session missing')) {
      console.warn('Scanix: hydrate refreshSession:', error.message)
    }
    if (data.session?.user?.id === uid) {
      hydrateAuthSessionWarned = false
      return data.session
    }
  } catch (e) {
    console.warn('Scanix: hydrate refreshSession', e)
  }
  session = await tryGet()
  if (session) {
    hydrateAuthSessionWarned = false
    return session
  }
  if (!hydrateAuthSessionWarned) {
    hydrateAuthSessionWarned = true
    console.warn(
      '[Scanix] hydrate: ingen Supabase-sesjon (getSession/refresh). Appen tror du er innlogget, men nettleseren har ikke JWT — økter fra delsky hentes ikke. Åpne menyen og logg inn på nytt (samme bruker som på telefon).',
    )
  }
  return null
}

/**
 * Etter første tegning: hent app-tilstand fra Supabase og flett inn (tidligere blokkerte dette oppstart).
 */
async function hydrateUserAppStateFromRemote() {
  if (hydrateUserAppStateFromRemoteInFlight) {
    return hydrateUserAppStateFromRemoteInFlight
  }
  hydrateUserAppStateFromRemoteInFlight = (async () => {
    if (isMinDownloadMode()) return
    const sb = getSupabase()
    if (!sb || !currentUser?.id) return
    const session = await resolveSupabaseSessionForHydrate(sb)
  if (!session?.user || session.user.id !== currentUser.id) return
  const localSessionCountBeforeHydrate = sessions.length

  let remote
  try {
    remote = await fetchUserAppStateForHydrate(session.user.id)
  } catch (e) {
    console.warn('hydrate app state:', e)
    return
  }
  if (!remote) {
    console.warn(
      '[Scanix] hydrate: ingen tilstand fra delsky (henting ga null). Lokale data på enheten brukes. Vanlige årsaker: mobilnett uten godkjenning, offline, timeout (typisk etter ~90 s ved treg linje eller svært store økter), manglende data i sky, eller API-feil — se logger rett over. Hvis opplasting er blokkert av ventende bilder, sendes ikke ny payload til sky før det er løst (sjekk [Scanix regnet] supabase_push_skipped).',
    )
    return
  }

  const diskApp = await loadAppStateFromStorageForUser(currentUser.id)
  const remoteSessions = remote.sessions.map(normalizeSession).filter(Boolean)
  const diskSessions = diskApp.sessions.map(normalizeSession).filter(Boolean)
  const nextSessions = mergeRemoteAndDiskSessions(remoteSessions, diskSessions)
  let nextSessionId = remote.currentSessionId
  const nextStandalone = mergeStandalonePhotoLists(
    normalizeStandalonePhotosList(remote.standalonePhotos),
    diskApp.standalonePhotos,
  )
  const nextFriction = mergeFrictionMeasurementLists(
    normalizeFrictionMeasurementsList(remote.frictionMeasurements),
    diskApp.frictionMeasurements,
  )

  if (nextSessionId && !nextSessions.some((s) => s.id === nextSessionId)) {
    nextSessionId =
      typeof diskApp.currentSessionId === 'string' &&
      nextSessions.some((s) => s.id === diskApp.currentSessionId)
        ? diskApp.currentSessionId
        : null
  }

  const localSessionIdBefore = currentSessionId
  const previewShareOpen =
    typeof previewIncomingShareId === 'string' && previewIncomingShareId.length > 0
  if (
    typeof localSessionIdBefore === 'string' &&
    nextSessions.some((s) => s.id === localSessionIdBefore)
  ) {
    nextSessionId = localSessionIdBefore
  } else if (localSessionIdBefore == null) {
    /* Ikke ta i bruk fjernens «currentSessionId» når lokalt ingen økt er valgt — unngår hopp inn i annen økt / glitch på forsida. */
    nextSessionId = null
  } else if (
    previewShareOpen &&
    typeof localSessionIdBefore === 'string' &&
    sessions.some((s) => s.id === localSessionIdBefore) &&
    !nextSessions.some((s) => s.id === localSessionIdBefore)
  ) {
    /* «Del oppdrag»-forhåndsvisning: økta finnes bare lokalt (ny uuid) til den er lagret på disk —
     * mergeRemoteAndDiskSessions inneholder den ikke. Uten dette nullstilles currentSessionId og
     * renderApp() riv ned kartet (oppleves som «tilbake til forsiden»). */
    nextSessionId = localSessionIdBefore
  }

  const prevSig = hydrateMergeFingerprint(
    sessions,
    currentSessionId,
    standalonePhotos.length,
    frictionMeasurements.length,
    frictionActiveSessionId,
    frictionPreviousSessionId,
  )
  const viewBefore = view
  const sessionsBeforeRemoteAssign = sessions
  sessions = nextSessions
  if (
    previewShareOpen &&
    typeof localSessionIdBefore === 'string' &&
    !sessions.some((s) => s.id === localSessionIdBefore)
  ) {
    const ghost = sessionsBeforeRemoteAssign.find(
      (s) => s.id === localSessionIdBefore,
    )
    if (ghost) {
      sessions = [ghost, ...sessions]
    }
  }
  currentSessionId = nextSessionId
  standalonePhotos = nextStandalone
  frictionMeasurements = nextFriction
  const mergedFrictionIds = mergeFrictionSessionStateFromRemote(
    diskApp,
    remote,
  )
  frictionActiveSessionId = mergedFrictionIds.frictionActiveSessionId
  frictionPreviousSessionId = mergedFrictionIds.frictionPreviousSessionId
  if (currentSessionId && !sessions.some((s) => s.id === currentSessionId)) {
    currentSessionId = null
  }
  {
    const lr =
      typeof diskApp.lastResumeSessionId === 'string'
        ? diskApp.lastResumeSessionId.trim()
        : ''
    if (lr && sessions.some((s) => s.id === lr)) {
      lastResumeSessionId = lr
    }
  }
  state = loadCurrentSessionState()

  let idbPixelsHydrated = false
  try {
    idbPixelsHydrated = await hydrateAllAppPhotoPixelsFromIdb()
  } catch (e) {
    console.warn('hydrateAllAppPhotoPixelsFromIdb', e)
  }
  if (idbPixelsHydrated) {
    state = loadCurrentSessionState()
  }

  const nextSig = hydrateMergeFingerprint(
    sessions,
    currentSessionId,
    standalonePhotos.length,
    frictionMeasurements.length,
    frictionActiveSessionId,
    frictionPreviousSessionId,
  )
  const dataChanged = prevSig !== nextSig || idbPixelsHydrated

  if (nextSessions.length > localSessionCountBeforeHydrate) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(
          `scanix-home-autohyd:${currentUser.id}`,
        )
      }
    } catch {
      /* ignore */
    }
    if (localSessionCountBeforeHydrate === 0 && nextSessions.length > 0) {
      console.info(
        `[Scanix] hydrate: hentet ${nextSessions.length} økt(er) fra delsky (Mac/nett hadde tom liste).`,
      )
      showSessionToast(
        `Hentet ${nextSessions.length} økter fra delsky. Åpne «Økten» i menyen for lista.`,
        4500,
      )
    }
  }

  if (isViewLockedDuringRemoteHydrate()) {
    if (view === 'session' && !currentSessionId) {
      view = 'home'
    }
  } else {
    if (!currentUser) {
      view = 'auth'
    } else if (viewBefore === 'home') {
      view = 'home'
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
  /* Alltid lagre når vi faktisk fikk sky-data — unngår at fingerprint-tilfeldigheter utelater save. */
  if (dataChanged || remoteSessions.length > 0) {
    saveAppState()
  }
  })().finally(() => {
    hydrateUserAppStateFromRemoteInFlight = null
  })
  return hydrateUserAppStateFromRemoteInFlight
}

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
/** Variant for registrering som venter på posisjon eller vegreferanse. */
let pendingPinIcon = null
let userLocationIcon = null
function ensureSessionPinIcons() {
  if (pinIcon || !Leaflet) return
  pinIcon = Leaflet.divIcon({
    className: 'map-pin-wrap',
    html: '<div class="map-pin" aria-hidden="true"></div>',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  })
  pendingPinIcon = Leaflet.divIcon({
    className: 'map-pin-wrap',
    html: '<div class="map-pin map-pin--pending" aria-hidden="true"></div>',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  })
  userLocationIcon = Leaflet.divIcon({
    className: 'map-user-pin-wrap',
    html:
      '<div class="map-user-pin" aria-hidden="true">' +
      '<div class="map-user-arrow" aria-hidden="true">' +
      '<svg class="map-user-arrow-svg" viewBox="-32 -32 64 64" width="64" height="64" focusable="false">' +
      '<path class="map-user-arrow-wedge" d="M0 0 L20 -28 A36 36 0 0 1 -20 -28 Z" fill="rgba(10,132,255,0.42)"/>' +
      '</svg></div>' +
      '<div class="map-user-dot"></div></div>',
    iconSize: [64, 64],
    iconAnchor: [32, 32],
    popupAnchor: [0, -12],
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
/** Klikk- og fotomarkører (ikke brukerposisjon). */
let sessionMarkerClusterGroup = /** @type {import('leaflet').Layer | null} */ (null)
let map = null
/** Bakgrunnslag på øktkartet (byttes ved mørkt/lys underlag). */
let sessionBasemapLayer = /** @type {import('leaflet').Layer | null} */ (null)
/** Avregistrer raster-flis-varming (Service Worker-cache) for øktkart. */
let sessionBasemapSwWarmDetach = /** @type {null | (() => void)} */ (null)

function detachSessionBasemapSwWarm() {
  sessionBasemapSwWarmDetach?.()
  sessionBasemapSwWarmDetach = null
}

function attachSessionBasemapSwWarmIfRaster(tileLayer) {
  detachSessionBasemapSwWarm()
  if (!map || !tileLayer || typeof tileLayer.getTileUrl !== 'function') return
  sessionBasemapSwWarmDetach = attachRasterBasemapViewportSwWarm(
    Leaflet,
    map,
    /** @type {import('leaflet').TileLayer} */ (tileLayer),
  )
}
/** Siste `dark` satt på `sessionBasemapLayer` (for gjenbruk av container). */
let sessionBasemapDarkApplied = false
/** Serialiserer kart-init (unngår dobbel Leaflet.map på #map ved parallelle kall). */
let sessionMapInitPromise = null
/** Leaflet for mottatte bilder (ikke økt-kartet). */
let receivedPhotosMap = null
/** Leaflet for forhåndsvisning av delt økt (dashboard, kart-fane). */
let sharedReviewMap = null
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

/** Siste lagrede NVDB-treff for forsiden (offline / rask gjenoppretting). */
const VEGREF_PERSIST_KEY = 'scanix-vegref-last-v1'

/** Dedupliser `home_ui`-linjer i vegrefDebugTrace (unngå å fylle buffer ved hver ramme). */
let vegrefDebugLastHomeSig = ''
let vegrefDebugLastHomeAt = 0

/**
 * @param {object} res
 */
function maybeTraceHomeVegrefApply(res) {
  if (!isVegrefDebugTraceEnabled() || !res || view !== 'home') return
  const sig = `${res.nvdbId}|${String(res.m)}|${String(res.roadLineDisplay || res.roadLine || '').slice(0, 80)}`
  const now = Date.now()
  if (now - vegrefDebugLastHomeAt < 1100 && sig === vegrefDebugLastHomeSig) return
  vegrefDebugLastHomeAt = now
  vegrefDebugLastHomeSig = sig
  vegrefDebugTrace('home_ui', {
    source: String(
      /** @type {{ _vegrefMeta?: { source?: string } }} */ (res)._vegrefMeta
        ?.source || '',
    ),
    nvdbId: res.nvdbId != null ? String(res.nvdbId) : null,
    m: res.m != null ? String(res.m) : null,
    s: res.s != null ? String(res.s) : null,
    d: res.d != null ? String(res.d) : null,
    primary: String(res.roadLineDisplay || res.roadLine || '').slice(0, 180),
  })
}

/** Throttle for inkrementell lagring av vegnett mens brukeren kjører (samme NVDB-kall som vegreferanse). */
let lastDrivingVegnetMergeAt = 0
/** @type {number | null} */
let lastDrivingVegnetMergeLat = null
/** @type {number | null} */
let lastDrivingVegnetMergeLng = null
const DRIVING_VEGNET_MERGE_MIN_MS = 90_000
const DRIVING_VEGNET_MERGE_MIN_MOVE_M = 450
const DRIVING_VEGNET_MERGE_MIN_SPEED_MPS = 2.5

/** Forside: GPS-watch som mater felles vegref-pipeline. */
let homeVegrefWatchId = null
let homeVegrefHasDisplayedResult = false
/** Siste autoritative NVDB-meter (for ekstrapolasjonsretning). */
let homeVegrefPrevAuthMeter = null
/** +1 / −1 langs strekningen — fra to siste NVDB-metere. */
let homeVegrefMeterExtrapDir = 1
/** @type {number | null} */
let homeVegrefMeterLiveRaf = null
let homeVegrefMeterLiveLastTs = 0
/** Når farten er lav: ikke spinne rAF 60 Hz — sjekk igjen etter et øyeblikk. */
/** @type {ReturnType<typeof setTimeout> | null} */
let homeVegrefMeterLiveSlowTimer = null

let homeVegrefSegKey = ''
/** Behold sekundær gatelinje (type) på samme segment når NVDB veksler mellom beriket og kort svar. */
let homeVegrefStickyStreetLine = ''
let homeVegrefStickySegKey = ''
/** Siste wall-clock når GPS hadde brukbar nøyaktighet (for coast/stale). */
let homeVegrefLastRawGpsWallMs = 0
/** Siste wall-clock for **alle** fiks med gyldige koord (også >220 m) — inst/ekstrap når pipelinen ikke kjører. */
let homeVegrefAnyGpsWallMs = 0
/** Siste kjente kjørefart for coast når GPS mangler. */
let homeVegrefCoastSpeedMps = 0
let homeVegrefCoastStartedAt = 0
/** Hastighet ut fra to siste GPS-fiks (uavhengig av NVDB-pipeline) — jevn meter-ekstrap. */
let homeVegrefGpsInstSpeedMps = 0
let homeVegrefGpsSpeedLat = /** @type {number | null} */ (null)
let homeVegrefGpsSpeedLng = /** @type {number | null} */ (null)
let homeVegrefGpsSpeedTs = /** @type {number | null} */ (null)
/** Pipelinen gir m=– men vi holder siste meter + live-extrap (da trengs coast når OS-rapportert fart ≈0). */
let homeVegrefHoldNullDashExtrap = false
let homeVegrefMeterAnim = null
let homeVegrefMeterFrom = 0
let homeVegrefMeterTo = 0
let homeVegrefMeterT0 = 0
let homeVegrefDisplayedMeter = null
/** NVDB-id for siste viste metertall — brukes til å holde telling når API midlertidig mangler meter (samme veistrekning). */
let homeVegrefMeterNvdbId = /** @type {string | number | null} */ (null)
let homeVegrefCompactS = '–'
let homeVegrefCompactD = '–'
/** Speiler siste NVDB-linjer for Excel-kolonner (Vegvei / Vegnr). */
let homeVegrefExcelVegvei = ''
let homeVegrefExcelVegnr = ''
let homeVegrefLastDistSkipAt = 0
const HOME_VEGREF_DIST_SKIP_TIMEOUT_MS = 12000
/** Siste gang vi startet meter-tween eller snap (begrenser unødvendige oppdateringer på samme strekning). */
let homeVegrefLastMeterUiCommitAt = 0
/** Min tid mellom tween-steg; senkes dynamisk ved god nøyaktighet + fart (se shouldSkip…). */
const HOME_VEGREF_METER_MIN_TWEEN_GAP_MS = 255
/** Etter app resume / tilbake til forsiden: ikke stopp live-ekstrap som «parkert» før GPS/pipeline har kjørt igjen. */
let homeVegrefMeterResumeUntil = 0
/** Første tidspunkt null-meter med hold (timeout mot hold_null — ikke lenger banner-tekst). */
let homeVegrefMeterNullSinceMs = 0
let homeVegrefStartupToken = 0
let homeVegrefStartupStartedAt = 0
let homeVegrefStartupFirstGpsAt = 0
let homeVegrefStartupFirstLookupAt = 0
let homeVegrefStartupFirstRenderAt = 0
let homeVegrefStartupFirstRenderSource = ''
let homeVegrefLastStableRes = null
let homeVegrefLastStableAt = 0
/** Siste treff med gyldig meter — brukes til null-hold (ikke overskrives av m=–). */
let homeVegrefLastMeterStableRes = null
/** Siste gyldige distToRoadM (fra NVDB-match med m). Brukes til å forkorte
 *  hold_null-varigheten når bilen allerede driver fra linjen — da er
 *  segmentbytte sannsynligvis nært forestående og videre hold gir kun
 *  visuell «fryse»-effekt. */
let homeVegrefLastValidDistToRoadM = null
/** Klasse-hysterese: huske sist aksepterte vegklasse (EV/RV/FV) for å dempe kortvarige PV-flips. */
let homeVegrefLastHighClassRank = -1
let homeVegrefLastHighClassAt = 0
/** Kryss/rundkjøring-flagg: brukes for å sette sekundærchip mens vi holder forrige hovedlinje. */
let homeVegrefCrossingActive = false
let homeVegrefUiUncertain = false
/** Siste viste usikkerhetstekst (unngår repeterende DOM ved hvert GPS-tick). */
let homeVegrefUncertainLastLabel = ''
/** Debug-metrikk for tuning av smoothness. */
let homeVegrefJitterWindow = /** @type {number[]} */ ([])
let homeVegrefLastJitterLoggedAt = 0
let homeVegrefFrameSkips = 0
let homeVegrefFrameTicks = 0
let homeVegrefSwitchPendingAt = 0
let homeVegrefSwitchPendingFrom = ''
let homeVegrefSwitchPendingTo = ''
/** @type {Array<{ lat: number, lng: number, accuracy: number, timestamp: number, headingDeg: number | null }>} */
let homeVegrefGpsBuffer = []
const HOME_VEGREF_GPS_BUFFER_MAX = 5
const HOME_VEGREF_STALE_REUSE_MS = 8 * 60 * 1000
const HOME_VEGREF_UNCERTAIN_HOLD_MS = 6_000
/** Ingen fersk GPS-callback → vurder coast for meter-ekstrapolasjon (tunnel / tapt fix). */
const HOME_VEGREF_GPS_STALE_MS = 1500
/** GPS-accuracy over dette regnes som «effektivt stale» for coast: iOS sender
 *  ofte dead-reckonede posisjoner i tunnel med acc 80–300 m. Da fortsetter
 *  `homeVegrefLastRawGpsWallMs`-stempling slik at vanlig stale-timer aldri
 *  utløses, men treffene er ubrukelige til vegref-oppslag. */
const HOME_VEGREF_COAST_ACC_FLOOR_M = 80
/** Min fart for å huske coast-hastighet (typisk kjøring, gange = 1,4 m/s). */
const HOME_VEGREF_COAST_MIN_SPEED_MPS = 1.2
/** Maks varighet for estimert telling etter tapt GPS. */
const HOME_VEGREF_COAST_MAX_MS = 120_000

/** KMT / vegreferanse-panelet – samme NVDB-kø som forsiden (`vegrefLive.js`). */
let kmtDialogOpen = false
/** Dynamisk terskel: dårligere GPS → tillat litt større avstand før vi ignorerer treff. */
function getHomeVegrefMaxDistSkipM(accuracyM) {
  const a =
    typeof accuracyM === 'number' && !Number.isNaN(accuracyM) ? accuracyM : 28
  return a > 30 ? 80 : 50
}

/**
 * Startup-metrikk for første vegref på forsiden.
 * Kan senere kopieres ut via eksisterende vegref-debug.
 * @param {string} type
 * @param {Record<string, unknown>} [extra]
 */
function logHomeVegrefStartupMetric(type, extra = {}) {
  if (!homeVegrefStartupStartedAt) return
  logVegrefMetric({
    type: `home-startup-${type}`,
    sinceStartMs: Math.max(0, Date.now() - homeVegrefStartupStartedAt),
    firstGpsMs:
      homeVegrefStartupFirstGpsAt > 0
        ? homeVegrefStartupFirstGpsAt - homeVegrefStartupStartedAt
        : null,
    firstLookupMs:
      homeVegrefStartupFirstLookupAt > 0
        ? homeVegrefStartupFirstLookupAt - homeVegrefStartupStartedAt
        : null,
    firstRenderMs:
      homeVegrefStartupFirstRenderAt > 0
        ? homeVegrefStartupFirstRenderAt - homeVegrefStartupStartedAt
        : null,
    firstRenderSource: homeVegrefStartupFirstRenderSource || null,
    ...extra,
  })
}

function resetHomeVegrefRuntimeState() {
  homeVegrefGpsBuffer = []
  homeVegrefUiUncertain = false
  homeVegrefUncertainLastLabel = ''
  homeVegrefMeterNullSinceMs = 0
  homeVegrefLastMeterStableRes = null
  homeVegrefLastValidDistToRoadM = null
  homeVegrefLastHighClassRank = -1
  homeVegrefLastHighClassAt = 0
  homeVegrefCrossingActive = false
  homeVegrefJitterWindow = []
  homeVegrefLastJitterLoggedAt = 0
  homeVegrefFrameSkips = 0
  homeVegrefFrameTicks = 0
  homeVegrefSwitchPendingAt = 0
  homeVegrefSwitchPendingFrom = ''
  homeVegrefSwitchPendingTo = ''
  homeVegrefHoldNullDashExtrap = false
  homeVegrefGpsInstSpeedMps = 0
  homeVegrefGpsSpeedLat = null
  homeVegrefGpsSpeedLng = null
  homeVegrefGpsSpeedTs = null
  homeVegrefAnyGpsWallMs = 0
  resetHomeVegrefMeterUiHold()
}

function noteHomeVegrefDisplayJitter(displayedMeter) {
  if (typeof displayedMeter !== 'number' || !Number.isFinite(displayedMeter)) return
  homeVegrefJitterWindow.push(displayedMeter)
  while (homeVegrefJitterWindow.length > 24) homeVegrefJitterWindow.shift()
  const now = Date.now()
  if (now - homeVegrefLastJitterLoggedAt < 2200 || homeVegrefJitterWindow.length < 8) {
    return
  }
  const deltas = []
  for (let i = 1; i < homeVegrefJitterWindow.length; i += 1) {
    deltas.push(Math.abs(homeVegrefJitterWindow[i] - homeVegrefJitterWindow[i - 1]))
  }
  const mean = deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length)
  const variance =
    deltas.reduce((acc, d) => acc + (d - mean) * (d - mean), 0) /
    Math.max(1, deltas.length)
  const stddev = Math.sqrt(Math.max(0, variance))
  const skipRate =
    homeVegrefFrameTicks > 0
      ? Math.round((homeVegrefFrameSkips / homeVegrefFrameTicks) * 1000) / 10
      : 0
  vegrefDebugTrace('display_quality', {
    jitterStdDevM: Math.round(stddev * 100) / 100,
    jitterMeanM: Math.round(mean * 100) / 100,
    frameSkipRatePct: skipRate,
  })
  homeVegrefLastJitterLoggedAt = now
}

/**
 * Oppdaterer momentanfart fra Geolocation (ofte 1 Hz+) uavhengig av vegref-pipelinen.
 * @param {number} lat
 * @param {number} lng
 * @param {number | undefined} timestamp
 */
/**
 * Hver Geolocation-fiks med gyldige koord (også når nøyaktighet er for dårlig til NVDB).
 * Holder inst-fart og coast-hastighet i live slik meter-ekstrap ikke «dør» i dekningssvikt.
 * @param {number} lat
 * @param {number} lng
 * @param {number | undefined} timestamp
 */
function noteHomeVegrefAnyGpsFix(lat, lng, timestamp) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
  homeVegrefAnyGpsWallMs = Date.now()
  updateHomeVegrefGpsInstSpeedMps(lat, lng, timestamp)
  const gInst = homeVegrefGpsInstSpeedMps
  if (gInst >= HOME_VEGREF_COAST_MIN_SPEED_MPS * 1.05) {
    homeVegrefCoastSpeedMps = Math.max(homeVegrefCoastSpeedMps, gInst * 0.97)
  }
}

function updateHomeVegrefGpsInstSpeedMps(lat, lng, timestamp) {
  const ts =
    typeof timestamp === 'number' && Number.isFinite(timestamp)
      ? timestamp
      : Date.now()
  if (
    homeVegrefGpsSpeedLat != null &&
    homeVegrefGpsSpeedLng != null &&
    homeVegrefGpsSpeedTs != null
  ) {
    const dt = (ts - homeVegrefGpsSpeedTs) / 1000
    if (dt > 0.055 && dt < 6) {
      const d = haversineM(
        homeVegrefGpsSpeedLat,
        homeVegrefGpsSpeedLng,
        lat,
        lng,
      )
      if (d >= 0.12 && d < 900) {
        const inst = Math.min(d / dt, 78)
        if (Number.isFinite(inst) && inst >= 0.16) {
          homeVegrefGpsInstSpeedMps = inst
        }
      }
    }
  }
  homeVegrefGpsSpeedLat = lat
  homeVegrefGpsSpeedLng = lng
  homeVegrefGpsSpeedTs = ts
}

/**
 * Rangerer vegklasse for hysterese. Høyere = viktigere.
 * EV=4, RV=3, FV=2, KV=1, PV=0, ukjent=-1.
 * @param {unknown} res
 * @returns {number}
 */
function homeVegrefRoadClassRank(res) {
  const r = /** @type {{ roadLineShort?: unknown, roadLine?: unknown, road?: unknown, roadLineDisplayShort?: unknown }} */ (
    res || {}
  )
  const s = String(
    r.roadLineShort || r.roadLineDisplayShort || r.roadLine || r.road || '',
  )
    .trim()
    .toUpperCase()
  if (!s) return -1
  if (/^E\s*V?\d/.test(s) || s.startsWith('EV')) return 4
  if (s.startsWith('RV')) return 3
  if (s.startsWith('FV') || /^F\s*\d/.test(s)) return 2
  if (s.startsWith('KV')) return 1
  if (s.startsWith('PV')) return 0
  return -1
}

/**
 * Detekterer om nvdbId refererer til kryss-del (KD...). Brukes for å
 * beholde forrige hovedtraseé-visning mens vi passerer kryss/rundkjøring.
 * @param {unknown} nid
 * @returns {boolean}
 */
function homeVegrefIsCrossingNvdbId(nid) {
  if (nid == null) return false
  return /(^|[^A-Z])KD\d+/i.test(String(nid))
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {number} accuracy
 * @param {number | undefined} timestamp
 * @param {number | null | undefined} headingDeg
 */
function pushHomeVegrefGpsSample(lat, lng, accuracy, timestamp, headingDeg) {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(accuracy)
  ) {
    return
  }
  const sample = {
    lat,
    lng,
    accuracy: Math.max(0, accuracy),
    timestamp:
      typeof timestamp === 'number' && Number.isFinite(timestamp)
        ? timestamp
        : Date.now(),
    headingDeg:
      typeof headingDeg === 'number' && Number.isFinite(headingDeg)
        ? headingDeg
        : null,
  }
  homeVegrefGpsBuffer.push(sample)
  if (homeVegrefGpsBuffer.length > HOME_VEGREF_GPS_BUFFER_MAX) {
    homeVegrefGpsBuffer.splice(
      0,
      homeVegrefGpsBuffer.length - HOME_VEGREF_GPS_BUFFER_MAX,
    )
  }
}

/**
 * Rå GPS ved forsiktig gange (god nøyaktighet) — lavere lag enn median-buffer.
 * Stillestående (lav / null fart) beholder buffer for stabilitet.
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} accuracy
 * @param {number | null | undefined} heading
 * @param {ReturnType<typeof getBufferedHomeVegrefFix>} buffered
 */
function pickHomeVegrefInputCoords(latitude, longitude, accuracy, heading, buffered) {
  const spd = vegrefGetLastSpeed()
  const acc =
    typeof accuracy === 'number' && !Number.isNaN(accuracy) ? accuracy : 28
  if (spd > 0.55 && spd < 3.4 && acc <= 24) {
    return {
      refLat: latitude,
      refLng: longitude,
      refAccuracy: acc,
      refHeading:
        typeof heading === 'number' && Number.isFinite(heading) ? heading : null,
    }
  }
  return {
    refLat: buffered?.lat ?? latitude,
    refLng: buffered?.lng ?? longitude,
    refAccuracy: buffered?.accuracy ?? acc,
    refHeading:
      buffered?.headingDeg != null && Number.isFinite(buffered.headingDeg)
        ? buffered.headingDeg
        : typeof heading === 'number' && Number.isFinite(heading)
          ? heading
          : null,
  }
}

function getBufferedHomeVegrefFix() {
  if (!homeVegrefGpsBuffer.length) return null
  const recent = [...homeVegrefGpsBuffer]
    .filter((s) => Date.now() - s.timestamp < 20_000)
    .slice(-HOME_VEGREF_GPS_BUFFER_MAX)
  if (!recent.length) return homeVegrefGpsBuffer[homeVegrefGpsBuffer.length - 1]
  const byLat = [...recent].sort((a, b) => a.lat - b.lat)
  const byLng = [...recent].sort((a, b) => a.lng - b.lng)
  const byAcc = [...recent].sort((a, b) => a.accuracy - b.accuracy)
  const mid = Math.floor(recent.length / 2)
  const newest = recent[recent.length - 1]
  const headings = recent
    .map((s) => s.headingDeg)
    .filter((h) => typeof h === 'number' && Number.isFinite(h))
  return {
    lat: byLat[mid].lat,
    lng: byLng[mid].lng,
    accuracy: byAcc[mid].accuracy,
    timestamp: newest.timestamp,
    headingDeg: headings.length ? headings[headings.length - 1] : null,
  }
}
/** Siste nøyaktighet brukt til dist-skip (oppdateres i feedVegrefFromGps). */
let lastVegrefGpsAccuracyM = 28

/**
 * Segment-identitet uten oscillerende veilinje-tekst (flakser mellom NVDB-svar).
 * @param {object | null | undefined} res
 */
function homeVegrefSegmentIdentityKey(res) {
  if (!res || typeof res !== 'object') return ''
  const s = String(/** @type {{ s?: unknown }} */ (res).s ?? '').trim()
  const d = String(/** @type {{ d?: unknown }} */ (res).d ?? '').trim()
  const nidRaw = /** @type {{ nvdbId?: unknown }} */ (res).nvdbId
  const n =
    nidRaw != null && String(nidRaw).trim() !== '' ? String(nidRaw).trim() : ''
  const kf = String(/** @type {{ kortform?: unknown }} */ (res).kortform ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
  if (n) return `${s}|${d}|${n}`
  if (kf) return `${s}|${d}|k:${kf}`
  return `${s}|${d}|`
}

/**
 * Samme veg så lenge S/D og NVDB-id samsvar (der begge er satt).
 * @param {object | null | undefined} a
 * @param {object | null | undefined} b
 */
function homeVegrefSameRoadGeometry(a, b) {
  if (!a || !b) return false
  if (String(a.s) !== String(b.s) || String(a.d) !== String(b.d)) return false
  const na = a.nvdbId != null ? String(a.nvdbId).trim() : ''
  const nb = b.nvdbId != null ? String(b.nvdbId).trim() : ''
  return na === nb
}

/**
 * Samme kjørebane når NVDB går fra vls: til kf: (segmentering) med uendret S/D — da skal veinavn
 * fortsatt kunne låses fra forrige stabile treff.
 */
function homeVegrefVlsKfSegmentUpgradeSameSd(a, b) {
  if (!a || !b) return false
  if (String(a.s) !== String(b.s) || String(a.d) !== String(b.d)) return false
  const na = a.nvdbId != null ? String(a.nvdbId).trim() : ''
  const nb = b.nvdbId != null ? String(b.nvdbId).trim() : ''
  if (!na || !nb || na === nb) return false
  const isVls = (id) => /^vls:/i.test(id)
  const isKf = (id) => /^kf:/i.test(id)
  return (isVls(na) && isKf(nb)) || (isKf(na) && isVls(nb))
}

/** Stabilt treff matcher nåværende for veinavn-lås (eksakt geometri eller vls/kf-oppgradering). */
function homeVegrefStableMatchesForNameLatch(stab, res) {
  if (homeVegrefSameRoadGeometry(stab, res)) return true
  return homeVegrefVlsKfSegmentUpgradeSameSd(stab, res)
}

/** @param {string} key */
function homeVegrefParseSegKey(key) {
  if (!key || typeof key !== 'string') return null
  const i1 = key.indexOf('|')
  const i2 = key.indexOf('|', i1 + 1)
  if (i1 < 0 || i2 < 0) return null
  return {
    s: key.slice(0, i1),
    d: key.slice(i1 + 1, i2),
    n: key.slice(i2 + 1),
  }
}

/**
 * Siste m-start–m-slutt i kf:-id (siste treff i strengen — unngår å lese kryss-del feil).
 * @param {string | number | null | undefined} id
 * @returns {[number, number] | null}
 */
function homeVegrefExtractLastMeterRange(id) {
  const s = String(id ?? '')
  if (!s || /\bKD\d*\b/i.test(s)) return null
  let best = /** @type {[number, number] | null} */ (null)
  const re = /m(\d+)-(\d+)/g
  let m
  while ((m = re.exec(s)) !== null) {
    best = [+m[1], +m[2]]
  }
  return best && best[0] <= best[1] ? best : null
}

/**
 * Overlapp eller «nesten»-grense mellom to kf-fragmenter (NVDB kan ha hull i meternummerering).
 */
function homeVegrefMeterRangesTouch(idA, idB) {
  const ra = homeVegrefExtractLastMeterRange(idA)
  const rb = homeVegrefExtractLastMeterRange(idB)
  if (!ra || !rb) return false
  const [a0, a1] = ra
  const [b0, b1] = rb
  const SLACK_M = 42
  return a0 <= b1 + SLACK_M && b0 <= a1 + SLACK_M
}

/**
 * @param {string} prevKey
 * @param {string} newKey
 */
function homeVegrefKfNeighborSegKeys(prevKey, newKey) {
  const a = homeVegrefParseSegKey(prevKey)
  const b = homeVegrefParseSegKey(newKey)
  if (!a || !b) return false
  if (a.s !== b.s || a.d !== b.d) return false
  return homeVegrefMeterRangesTouch(a.n, b.n)
}

/**
 * Samme veilinje for null-hold (unngå PV/FV-flipp med utvidet lås).
 * @param {object} res
 * @param {object} ref
 */
function homeVegrefLooseSameVegLine(res, ref) {
  if (!res || !ref) return false
  if (String(res.s ?? '').trim() !== String(ref.s ?? '').trim()) return false
  if (String(res.d ?? '').trim() !== String(ref.d ?? '').trim()) return false
  const ra = String(res.road ?? '').trim().replace(/\s+/g, '').toLowerCase()
  const rb = String(ref.road ?? '').trim().replace(/\s+/g, '').toLowerCase()
  if (ra && rb && ra !== rb) return false
  return true
}

/**
 * @param {object} res
 * @param {unknown} nid
 */
function homeVegrefNullHoldNvdbAligned(res, nid) {
  if (nid == null) return true
  if (homeVegrefMeterNvdbId == null) return true
  if (String(nid) === String(homeVegrefMeterNvdbId)) return true
  const ref = homeVegrefLastMeterStableRes || homeVegrefLastStableRes
  if (
    ref &&
    homeVegrefLooseSameVegLine(res, ref) &&
    homeVegrefMeterRangesTouch(nid, homeVegrefMeterNvdbId)
  ) {
    return true
  }
  return false
}

/** Kontekst: høy fart + god GPS → tål større avstand før vi slipper null-hold (projeksjon ved segmentgrense). */
function homeVegrefHoldNullMaxDistM() {
  const spd = vegrefGetLastSpeed()
  const acc = lastVegrefGpsAccuracyM
  if (spd >= 14 && acc <= 10) return 58
  if (spd >= 10 && acc <= 12) return 52
  if (spd >= 6) return 44
  return 30
}

function homeVegrefHoldNullMaxDurationMs() {
  const spd = vegrefGetLastSpeed()
  /* Forkort hold_null når forrige gyldige treff allerede hadde elevert
     distToRoadM (bilen drev fra fragmentlinjen). I praksis betyr det at
     segmentbyttet er like rundt hjørnet — videre hold forlenger bare den
     visuelle «fryse»-fasen før snap. */
  const prevDist = homeVegrefLastValidDistToRoadM
  const drifting = typeof prevDist === 'number' && prevDist >= 15
  if (drifting) {
    if (spd >= 14) return 1400
    if (spd >= 8) return 1100
    return 900
  }
  if (spd >= 14) return 5200
  if (spd >= 8) return 4200
  return 3000
}

/** Min tid mellom tween-commits — høyere = roligere tall (færre kjedede tweens). */
function homeVegrefMeterMinTweenGapMs() {
  const acc = lastVegrefGpsAccuracyM
  const spd = vegrefGetLastSpeed()
  /* Kjøring: kortere gap — offline/NVDB tikker typisk ~10–20 m per sek; for lang
     pause ga opplevd «80–100 m mellom hvert tall» når post-commit også demper. */
  if (spd >= 16 && acc <= 12) return 88
  if (spd >= 12 && acc <= 12) return 104
  if (spd >= 10 && acc <= 14) return 118
  if (spd >= 8 && acc <= 12) return 190
  /* 22–36 km/t: tidligere falt vi i 220 ms-grenen → opplevd treg meter. */
  if (spd >= 6 && spd < 10 && acc <= 16) return 130
  if (spd >= 5 && acc <= 15) return 245
  /* Gange (~1–1,6 m/s): la NVDB slippe til oftere — telleren føltes treg. */
  if (spd >= 0.85 && spd < 3.2 && acc <= 18) return 132
  if (spd > 0.5 && spd < 3 && acc <= 16) return 155
  return HOME_VEGREF_METER_MIN_TWEEN_GAP_MS
}

/** Dynamisk tween-varighet: litt lengre tween = jevnere opplevd meter. */
function homeVegrefMeterTweenMs() {
  const spd = vegrefGetLastSpeed()
  if (spd > 25) return 90
  if (spd > 18) return 102
  if (spd > 15) return 118
  if (spd > 6) return 145
  if (spd >= 0.85 && spd < 3.2) return 112
  if (spd > 0.5 && spd < 3) return 124
  return 160
}
/**
 * Snap-terskel: over dette hoppes direkte (veiskifte/teleport).
 * Ved høy fart er store δ normalt, så tillat mer tween.
 */
function homeVegrefMeterSnapThreshold() {
  const spd = vegrefGetLastSpeed()
  if (spd > 25) return 420
  if (spd > 15) return 260
  return 240
}
/**
 * Dødbånd for meter på samme segment: ignorer små hopp fra GPS/NVDB-støy.
 * Større ved dårlig nøyaktighet og litt større ved høy fart (meter endrer seg fort, men vi vil fortsatt dempe støy).
 */
function homeVegrefMeterDeadbandM() {
  const acc = lastVegrefGpsAccuracyM
  const spd = vegrefGetLastSpeed()
  let d = 3.6 + Math.min(10, acc * 0.17)
  if (spd > 28) d += 6.5
  else if (spd > 18) d += 3.8
  /* Fix H1: ved reell bevegelse og god nøyaktighet er Δm reell distanse, ikke støy.
     Uten denne krympingen havner typiske 4–8 m NVDB-inkrementer under deadband
     og UI står stille i flere sekunder ved normal kjørefart. */
  if (spd >= 3 && acc <= 15) {
    d = Math.max(2.35, Math.min(d, 2.95 + acc * 0.1))
  } else if (spd >= 3 && acc <= 20) {
    /* Litt videre nøyaktighet (12–20 m): fortsatt kjøring — hold dødbånd nede, men ikke så stramt som ≤15 m. */
    d = Math.max(2.5, Math.min(d, 3.7 + acc * 0.095))
  } else if (spd > 0.45 && spd < 3 && acc <= 15) {
    /* Gange med grei GPS: litt strammere dødbånd enn «default» for lav fart. */
    d = Math.max(2.05, Math.min(d, 2.65 + acc * 0.105))
  }
  return Math.min(18, d)
}

/**
 * Hopp-guardrail: begrenser urealistiske meterhopp på samme segment.
 * Segmentbytte får passere raskt for korrekt veiidentitet.
 * @param {number} target
 * @param {number | null} displayed
 * @param {boolean} segChanged
 */
function guardrailHomeVegrefTargetMeter(target, displayed, segChanged) {
  if (displayed == null || segChanged) return target
  const delta = target - displayed
  const absDelta = Math.abs(delta)
  if (!Number.isFinite(absDelta) || absDelta <= 0) return target
  const spd = Math.max(0, vegrefGetLastSpeed())
  const acc = Number.isFinite(lastVegrefGpsAccuracyM) ? lastVegrefGpsAccuracyM : 22
  const maxStep = Math.max(16, Math.min(135, 14 + spd * 1.45 + Math.max(0, acc - 8) * 0.32))
  if (absDelta <= maxStep) return target
  return Math.round(displayed + Math.sign(delta) * maxStep)
}
/**
 * @param {number} mInt
 * @param {number} displayed
 * @param {boolean} segChanged
 * @param {() => number} snapFn
 * @param {number} lastCommitMs
 */
function shouldSkipVegrefMeterDisplayUpdate(
  mInt,
  displayed,
  segChanged,
  snapFn,
  lastCommitMs,
) {
  let skip = false
  let skipReason = 'no'
  if (segChanged) {
    skip = false
    skipReason = 'segChanged'
  } else {
    const delta = Math.abs(mInt - displayed)
    const snap = snapFn()
    if (delta >= snap) {
      skip = false
      skipReason = 'delta_ge_snap'
    } else if (mInt < displayed) {
      /* NVDB vil lavere m enn det vi viser (rygging / korreksjon ned): ikke throttlé. */
      skip = false
      skipReason = 'mInt_lt_displayed'
    } else if (delta < homeVegrefMeterDeadbandM()) {
      skip = true
      skipReason = 'deadband'
    } else if (Date.now() - lastCommitMs < homeVegrefMeterMinTweenGapMs()) {
      skip = true
      skipReason = 'min_tween_gap'
    } else if (lastCommitMs > 0) {
      const age = Date.now() - lastCommitMs
      const spd = vegrefGetLastSpeed()
      const slack =
        spd >= 14
          ? Math.min(48, 11 + spd * 1.05)
          : spd >= 10
            ? Math.min(40, 9.5 + spd * 0.95)
            : Math.min(26, 7.1 + spd * 0.62)
      const postCommitHoldMs =
        spd >= 14
          ? 62
          : spd >= 10
            ? 88
            : spd >= 6
              ? 118
              : spd >= 0.85 && spd < 3.4
                ? 155
                : 265
      if (age < postCommitHoldMs && delta < slack) {
        skip = true
        skipReason = 'post_commit_slack'
      } else {
        skip = false
        skipReason = 'pass_end'
      }
    } else {
      skip = false
      skipReason = 'pass_no_last_commit'
    }
  }
  // #region agent log
  if (
    view === 'home' &&
    typeof mInt === 'number' &&
    typeof displayed === 'number' &&
    (mInt < displayed || mInt > displayed + 8)
  ) {
    postScanixDebugPayload({
      sessionId: 'ff8b7b',
      hypothesisId: 'H1',
      location: 'main.js:shouldSkipVegrefMeterDisplayUpdate',
      message: 'meter_skip_decision',
      data: {
        mInt,
        displayed,
        segChanged,
        skip,
        skipReason,
        deadband: Math.round(homeVegrefMeterDeadbandM() * 10) / 10,
      },
      timestamp: Date.now(),
    })
  }
  // #endregion
  return skip
}

/** Maks nedover-korreksjon på samme segment vi aksepter uten tween (NVDB henger bak extrap). */
function homeVegrefMeterSameSegDownIgnoreM() {
  const spd = vegrefGetLastSpeed()
  return Math.min(62, Math.max(36, 24 + spd * 2.1))
}

/**
 * Maks avstand (m) vi tillater at vist meter ligger **over** NVDB med kun
 * live-ekstrap før vi tween'er. Uten tak ble UI «sittende fast» (f.eks. 8648)
 * mens m sank i titalls meter → én lang tween = opplevd stort hopp.
 */
function homeVegrefMeterSameSegDownMaxExtrapOnlyGapM() {
  const spd = vegrefGetLastSpeed()
  return Math.min(26, Math.max(14, 11 + spd * 0.55))
}

/** Én tween ned mot NVDB: maks steg (m) slik at rygging blir flere korte rull i stedet for ett kjempehopp. */
function homeVegrefMeterBackwardTweenChunkM() {
  const spd = vegrefGetLastSpeed()
  return Math.min(20, Math.max(11, 8 + spd * 0.5))
}

/**
 * NVDB m endret seg vs forrige autentiske m: sett ekstrap-retning.
 * Når **mInt < det vi viser**, aldri +1 — offline kan oscillere (7731↔7737)
 * mens displayed henger høyt; da må ikke mikroopptick flipp til forover-ekstrap.
 * @param {number} mInt
 * @param {number | null | undefined} uiDisplayed nåværende homeVegrefDisplayedMeter før prevAuth oppdateres
 */
function homeVegrefSetExtrapDirFromNvdbVsDisplayed(mInt, uiDisplayed) {
  if (homeVegrefPrevAuthMeter == null || homeVegrefPrevAuthMeter === mInt) return
  if (
    typeof uiDisplayed === 'number' &&
    Number.isFinite(uiDisplayed) &&
    mInt < uiDisplayed
  ) {
    homeVegrefMeterExtrapDir = -1
    return
  }
  if (
    typeof uiDisplayed === 'number' &&
    Number.isFinite(uiDisplayed) &&
    mInt > uiDisplayed
  ) {
    homeVegrefMeterExtrapDir = 1
    return
  }
  homeVegrefMeterExtrapDir = mInt > homeVegrefPrevAuthMeter ? 1 : -1
}

let kmtCameraMode = false
/** @type {MediaStream | null} */
let kmtMediaStream = null
/** Digital zoom / pan (preview); vegreferanse ligger i samme transform-lag som video). */
let kmtZoomScale = 1
let kmtZoomPanPx = 0
let kmtZoomPanPy = 0
/** @type {string | null} */
let kmtMainCameraDeviceId = null
/** @type {string | null} */
let kmtWideLensDeviceId = null
let kmtUsingWideLens = false
let kmtWideSwitchInFlight = false
let kmtHasDisplayedResult = false
/** S/D/veilinje – brukes til å skille «samme strekning» fra veksling (da snapper vi meter). */
let kmtRefSegmentKey = ''
/** Sist viste metertall (for tween). */
let kmtDisplayedMeter = null
let kmtLastMeterUiCommitAt = 0
let kmtMeterAnim = null
let kmtMeterFrom = 0
let kmtMeterTo = 0
let kmtMeterT0 = 0
function kmtMeterTweenMs() {
  const spd = vegrefGetLastSpeed()
  if (spd > 25) return 105
  if (spd > 15) return 145
  if (spd > 6) return 205
  return 300
}
function kmtMeterSnapThreshold() {
  const spd = vegrefGetLastSpeed()
  if (spd > 25) return 600
  if (spd > 15) return 400
  return 280
}
/** True når KMT er åpnet fra forsiden – bilder til album, tilbake → album (ikke økt). */
let kmtStandaloneFlow = false

/** Forsiden «AI dokumentering»: kamera + kontrakt-RAG mot /api/contract-chat (tekst og/eller bilde). */
let homeAiMediaStream = null
/** @type {string} */
let homeAiCapturedDataUrl = ''
/** Tekstbasert kontrakt-RAG mot /api/contract-chat (skiller fra VeiAi-tråden). */
let homeAiContractRagMode = true
/**
 * @type {Array<{ role: string, content: string | unknown[] }>}
 */
let homeAiRagMessages = []
/** Lydeffekt mens AI arbeider (AI dokumentering). */
let homeAiThinkingSoundTimer = 0
/** Animert grønn fyll på kontrakt-pillen under API-kall. */
let homeAiContractPillProgressTimer = 0
/** Siste AI-oppsummering for PDF (unngår dobbelt kall ved «Lagre»). */
let homeAiPdfSummaryCache = null
/** @type {AudioContext | null} */
let homeAiAudioContext = null
/** Layout-høyde (px) fanget når AI åpnes – brukes til panelhøyde slik at den IKKE krymper når tastatur senker innerHeight (da skimtes forsiden). */
let homeAiLayoutHeightPx = 0
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
const REGISTER_CLICK_FAST_PATH_MAX_MS = 5000

/** Sekvens for å ignorere utdaterte async OSRM-svar. */
let positionSeq = 0

const GPS_REJECT_M = 220
/** «God nok» GPS-uncertainty (m): under dette er ikke pendingGps. Over → lagres med pending-flagg. */
const REGISTER_MAX_GPS_ACCURACY_M = 25

/** Maks. alder på registrering som kan få oppgradert posisjon fra ny GPS-fix. */
const PENDING_GPS_UPGRADE_WINDOW_MS = 60000
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

/**
 * @param {object[]} segments
 * @param {number} lat
 * @param {number} lng
 * @param {number | undefined} speedMps
 */
function maybeMergeNvdbSegmentsWhileDriving(segments, lat, lng, speedMps) {
  if (!Array.isArray(segments) || segments.length === 0) return
  if (getVegrefDataMode() === 'minimal') return
  /* Ferdig offline-pakke: ikke fyll IndexedDB med rå segment-fetches fra nett. */
  if (offlineVegrefReady) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  const s =
    typeof speedMps === 'number' && !Number.isNaN(speedMps) ? speedMps : 0
  if (s < DRIVING_VEGNET_MERGE_MIN_SPEED_MPS) return

  const now = Date.now()
  if (lastDrivingVegnetMergeAt > 0) {
    const dt = now - lastDrivingVegnetMergeAt
    if (dt < DRIVING_VEGNET_MERGE_MIN_MS) {
      if (lastDrivingVegnetMergeLat == null || lastDrivingVegnetMergeLng == null) {
        return
      }
      const moved = haversineM(
        lastDrivingVegnetMergeLat,
        lastDrivingVegnetMergeLng,
        lat,
        lng,
      )
      if (moved < DRIVING_VEGNET_MERGE_MIN_MOVE_M) return
    }
  }

  void mergeNvdbSegmentsIntoOfflineDb(segments)
    .then(() => {
      lastDrivingVegnetMergeAt = Date.now()
      lastDrivingVegnetMergeLat = lat
      lastDrivingVegnetMergeLng = lng
      void refreshOfflineVegrefState()
    })
    .catch(() => {})
}

const SCANIX_SURFACE_PREF_KEY = 'scanix-surface-preference'
/** Legacy: «1» = bruker har eksplisitt valgt hyppig NVDB / «høy data». */
const SCANIX_VEGREF_DATA_NORMAL_KEY = 'scanix-vegref-data-normal'
/** Eksplisitt valg av spar-data-modus. Fravær av begge nøkler = minimal (lav databruk). */
const SCANIX_VEGREF_DATA_MINIMAL_KEY = 'scanix-vegref-data-minimal'

/** @returns {'minimal' | 'normal'} */
function getVegrefDataMode() {
  try {
    if (typeof localStorage === 'undefined') return 'minimal'
    if (localStorage.getItem(SCANIX_VEGREF_DATA_NORMAL_KEY) === '1') {
      return 'normal'
    }
    if (localStorage.getItem(SCANIX_VEGREF_DATA_MINIMAL_KEY) === '1') {
      return 'minimal'
    }
    return 'minimal'
  } catch {
    return 'minimal'
  }
}

/** @param {'minimal' | 'normal'} mode */
function setVegrefDataMode(mode) {
  try {
    if (typeof localStorage === 'undefined') return
    if (mode === 'minimal') {
      localStorage.setItem(SCANIX_VEGREF_DATA_MINIMAL_KEY, '1')
      localStorage.removeItem(SCANIX_VEGREF_DATA_NORMAL_KEY)
    } else {
      localStorage.removeItem(SCANIX_VEGREF_DATA_MINIMAL_KEY)
      localStorage.setItem(SCANIX_VEGREF_DATA_NORMAL_KEY, '1')
    }
  } catch {
    /* ignore */
  }
}

function getSurfacePreference() {
  try {
    if (typeof localStorage === 'undefined') return 'motor'
    const raw = localStorage.getItem(SCANIX_SURFACE_PREF_KEY)
    const p = normalizeSurfacePreference(raw)
    /* Migrer f.eks. eldre «balanced» til motor ved lesing */
    if (raw != null && raw !== p) {
      localStorage.setItem(SCANIX_SURFACE_PREF_KEY, p)
    }
    return p
  } catch {
    return 'motor'
  }
}

function setSurfacePreference(pref) {
  const p = normalizeSurfacePreference(pref)
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SCANIX_SURFACE_PREF_KEY, p)
    }
  } catch {
    /* ignore */
  }
  return p
}

function syncSessionMapRootDarkClass(on) {
  document
    .getElementById('session-map-root')
    ?.classList.toggle('session-map-basemap-dark', on)
}

function syncSessionMapDarkButton() {
  syncMapThemeDockDom(getSessionMapDarkPreference())
}

async function replaceSessionMapBasemapIfNeeded() {
  if (!map || !Leaflet) return
  const want = getSessionMapDarkPreference()
  if (sessionBasemapLayer && want === sessionBasemapDarkApplied) {
    syncSessionMapRootDarkClass(want)
    syncSessionMapDarkButton()
    return
  }
  detachSessionBasemapSwWarm()
  try {
    if (sessionBasemapLayer) {
      map.removeLayer(sessionBasemapLayer)
    }
  } catch {
    /* ignore */
  }
  sessionBasemapLayer = await createAppBasemapLayer(
    Leaflet,
    APP_MAP_TILE_LAYER_DATA_SAVER,
    { dark: want },
  )
  sessionBasemapLayer.addTo(map)
  attachSessionBasemapSwWarmIfRaster(sessionBasemapLayer)
  sessionBasemapDarkApplied = want
  syncSessionMapRootDarkClass(want)
  syncSessionMapDarkButton()
  setTimeout(() => {
    map?.invalidateSize()
    nudgeMaptilerBasemapResize(map)
  }, 60)
}

/**
 * NVDB-oppslag for vegreferanse + valgfri lokal cache av rå segmenter under kjøring.
 * @param {number} lat
 * @param {number} lng
 * @param {Parameters<typeof fetchRoadReferenceNearOnline>[2]} opts
 */
function fetchRoadReferenceNearForApp(lat, lng, opts) {
  return fetchRoadReferenceNearOnline(lat, lng, {
    ...opts,
    onRawSegments: (objs) => {
      maybeMergeNvdbSegmentsWhileDriving(objs, lat, lng, opts.speed)
    },
  })
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
  let z = 15
  if (accuracy < 22) z = 18
  else if (accuracy < 45) z = 17
  else if (accuracy < 75) z = 16
  return Math.min(z, APP_MAP_MAX_ZOOM)
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
const TRACE_MAX = 22

function normalizeTraceTimestampMs(timestamp) {
  const ts =
    typeof timestamp === 'number' && Number.isFinite(timestamp)
      ? Math.round(timestamp)
      : Date.now()
  return ts > 0 ? ts : Date.now()
}

function buildTraceTimestampsSec(trace) {
  const out = []
  let prev = 0
  for (const p of trace) {
    const sec = Math.max(prev + 1, Math.floor(p.timestampMs / 1000))
    out.push(sec)
    prev = sec
  }
  return out.join(';')
}

function mapMatchRadiusM(accuracy) {
  const a =
    typeof accuracy === 'number' && Number.isFinite(accuracy)
      ? Math.max(8, accuracy)
      : 25
  /* God GPS: strammere radius → renere match. Dårlig GPS: større radius → færre bom-treff. */
  if (a <= 18) return Math.min(52, Math.max(18, Math.round(a * 0.95)))
  if (a <= 35) return Math.min(68, Math.max(22, Math.round(a * 1.05)))
  return Math.min(78, Math.max(24, Math.round(a * 1.12)))
}

function getMapboxAccessToken() {
  const raw = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
  return typeof raw === 'string' && raw.trim() ? raw.trim() : ''
}

function pushTracePoint(lat, lng, timestamp, accuracy) {
  const tsMs = normalizeTraceTimestampMs(timestamp)
  const last = traceBuffer[traceBuffer.length - 1]
  if (last) {
    const d = haversineM(last.lat, last.lng, lat, lng)
    const dtMs = Math.max(0, tsMs - last.timestampMs)
    const mergeDist = Math.max(
      2,
      Math.min(8, mapMatchRadiusM(accuracy ?? last.accuracy) * 0.12),
    )
    if (d < mergeDist && dtMs < 2500) {
      last.lat = lat
      last.lng = lng
      last.timestampMs = Math.max(last.timestampMs + 1, tsMs)
      last.accuracy =
        typeof accuracy === 'number' && Number.isFinite(accuracy)
          ? accuracy
          : last.accuracy
      return
    }
  }
  traceBuffer.push({
    lat,
    lng,
    timestampMs: last ? Math.max(last.timestampMs + 1, tsMs) : tsMs,
    accuracy:
      typeof accuracy === 'number' && Number.isFinite(accuracy)
        ? accuracy
        : null,
  })
  while (traceBuffer.length > TRACE_MAX) traceBuffer.shift()
}

function parseLastMatchedPoint(j) {
  const tps = j?.tracepoints
  if (!tps?.length) return null
  for (let i = tps.length - 1; i >= 0; i--) {
    const tp = tps[i]
    if (tp?.location?.length >= 2) {
      return { lat: tp.location[1], lng: tp.location[0] }
    }
  }
  return null
}

/** Offentlig OSRM (samme som Vite-proxy / server default). Brukes som fallback når backend-proxy feiler. */
const OSRM_PUBLIC_ORIGIN = 'https://router.project-osrm.org'

function osrmBasePath() {
  if (import.meta.env.DEV) return '/api/osrm'
  const raw = import.meta.env.VITE_API_BASE
  if (typeof raw === 'string' && raw.trim()) return apiUrl('/api/osrm')
  return OSRM_PUBLIC_ORIGIN
}

async function fetchJsonWithRetry(
  url,
  { timeoutMs = 12_000, maxAttempts = 3 } = {},
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController()
    const to = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const r = await fetch(url, { signal: controller.signal })
      clearTimeout(to)
      if (!r.ok) {
        if (attempt < maxAttempts - 1) {
          await new Promise((res) => setTimeout(res, 350 * (attempt + 1)))
        }
        continue
      }
      try {
        return await r.json()
      } catch {
        if (attempt < maxAttempts - 1) {
          await new Promise((res) => setTimeout(res, 350 * (attempt + 1)))
        }
      }
    } catch {
      clearTimeout(to)
      if (attempt < maxAttempts - 1) {
        await new Promise((res) => setTimeout(res, 350 * (attempt + 1)))
      }
    }
  }
  return null
}

async function fetchOsrmJson(path) {
  const base = osrmBasePath()
  const primary = await fetchJsonWithRetry(`${base}${path}`, {
    // OSRM er kun "nice to have" for refsnap; aldri la dette fryse meteren.
    timeoutMs: 2200,
    maxAttempts: 1,
  })
  if (primary) return primary
  /* Render (eller annen backend) kan ikke nå OSRM → proxy gir 502. Hent direkte fra nettleseren (CORS tillatt på project-osrm). */
  if (base === OSRM_PUBLIC_ORIGIN) return null
  return fetchJsonWithRetry(`${OSRM_PUBLIC_ORIGIN}${path}`, {
    timeoutMs: 12_000,
    maxAttempts: 2,
  })
}

async function fetchMapboxJson(path) {
  return fetchJsonWithRetry(`https://api.mapbox.com${path}`)
}

/**
 * Snapper rå GPS til veikart (Mapbox/OSRM). Bruker alltid rå koordinater – ikke glattet,
 * ellers kan punktet dras inn på bygning/tomt. Match med store radiuses tåler typisk ±30–50 m GPS-feil.
 */
async function snapToRoadNetwork(lat, lng, accuracy) {
  const acc =
    typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : 50
  /* Ved svært grov posisjon: ikke trekk punktet inn på feil vei — bruk rå posisjon / siste treff. */
  if (acc > 95) {
    return lastSnapResult
  }
  const now = Date.now()
  const moved = haversineM(lastSnapFromLat, lastSnapFromLng, lat, lng)
  const poorGps = acc > 28
  const minInterval = poorGps ? 350 : 750
  const minMove = poorGps ? 3 : 12
  if (now - lastSnapAt < minInterval && moved < minMove) {
    return lastSnapResult
  }
  lastSnapAt = now
  lastSnapFromLat = lat
  lastSnapFromLng = lng

  const rad = mapMatchRadiusM(acc)

  const traceForMatch = traceBuffer.slice(-12)
  /* Match kan gi grovt feil treff når ± er stor — nearest er ofte tryggere da. */
  if (traceForMatch.length >= 2 && acc <= 88) {
    const pts = traceForMatch.map((p) => `${p.lng},${p.lat}`).join(';')
    const radii = traceForMatch
      .map((p) => mapMatchRadiusM(p.accuracy ?? rad))
      .join(';')
    const timestamps = buildTraceTimestampsSec(traceForMatch)
    const mapboxToken = getMapboxAccessToken()
    if (mapboxToken) {
      const jm = await fetchMapboxJson(
        `/matching/v5/mapbox/driving/${pts}?radiuses=${radii}&timestamps=${timestamps}&tidy=true&steps=false&overview=false&access_token=${encodeURIComponent(mapboxToken)}`,
      )
      const matchedMapbox = jm && parseLastMatchedPoint(jm)
      if (matchedMapbox) {
        lastSnapResult = matchedMapbox
        return matchedMapbox
      }
    }
    const j = await fetchOsrmJson(
      `/match/v1/driving/${pts}?radiuses=${radii}&timestamps=${timestamps}&gaps=ignore&tidy=true&overview=false&steps=false`,
    )
    const matchedOsrm = j && parseLastMatchedPoint(j)
    if (matchedOsrm) {
      lastSnapResult = matchedOsrm
      return matchedOsrm
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
    arrow.style.opacity = '0'
    return
  }
  arrow.style.opacity = '1'
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
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -34],
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

/** Leaflet: mørk kort-popup på øktkart (matcher forsideskall). */
const SESSION_MAP_POPUP_OPTIONS = Object.freeze({
  className: 'session-map-popup-wrap',
  maxWidth: 300,
})

/**
 * Vegref + statuslinjer for popup (BEM: session-map-popup__*).
 * @param {{ vegrefAtClick?: { vegnr?: string, meter?: string, s?: string, d?: string }, pendingGps?: boolean, pendingVegref?: boolean, lat?: unknown, lng?: unknown }} c
 */
function buildSessionMapPopupVegrefHtml(c) {
  const statusMsgs = []
  if (c.pendingGps && (c.lat == null || c.lng == null)) {
    statusMsgs.push('Venter på posisjon …')
  } else if (c.pendingGps) {
    statusMsgs.push('Upresis posisjon (oppdateres ved bedre GPS)')
  }
  const v = c.vegrefAtClick
  const hasVegObj = v && typeof v === 'object'
  const nr = hasVegObj && typeof v.vegnr === 'string' ? v.vegnr.trim() : ''
  const m = hasVegObj && typeof v.meter === 'string' ? v.meter.trim() : ''
  const s = hasVegObj && typeof v.s === 'string' ? v.s.trim() : ''
  const d = hasVegObj && typeof v.d === 'string' ? v.d.trim() : ''
  const hasMain = Boolean(nr || m)
  const hasSd = Boolean(s && d)
  if (c.pendingVegref && !hasMain && !hasSd) {
    statusMsgs.push('Venter på vegreferanse …')
  }

  const rows = []
  if (nr) {
    rows.push(
      `<div class="session-map-popup__dl-row"><dt class="session-map-popup__dt">Vegnr</dt><dd class="session-map-popup__dd">${escapeHtml(nr)}</dd></div>`,
    )
  }
  if (m) {
    rows.push(
      `<div class="session-map-popup__dl-row"><dt class="session-map-popup__dt">Meter</dt><dd class="session-map-popup__dd session-map-popup__dd--tabular">${escapeHtml(m)}</dd></div>`,
    )
  }
  if (hasSd) {
    const sdKort = `S${s}D${d}`
    rows.push(
      `<div class="session-map-popup__dl-row"><dt class="session-map-popup__dt">S/D</dt><dd class="session-map-popup__dd session-map-popup__dd--tabular session-map-popup__dd--sd-kort">${escapeHtml(sdKort)}</dd></div>`,
    )
  }

  let html = ''
  if (statusMsgs.length) {
    html += `<div class="session-map-popup__status" role="status">${statusMsgs
      .map(
        (msg) =>
          `<p class="session-map-popup__status-line">${escapeHtml(msg)}</p>`,
      )
      .join('')}</div>`
  }
  if (rows.length) {
    html += `<section class="session-map-popup__veg" aria-label="Vegreferanse"><dl class="session-map-popup__dl">${rows.join('')}</dl></section>`
  }
  return html
}

/**
 * @param {object} c clickHistory entry
 * @param {number} index 0-basert
 */
function buildSessionClickPopupHtml(c, index) {
  const n = index + 1
  const defaultTitle = String(n)
  const labelRaw =
    typeof c.label === 'string'
      ? c.label.trim().slice(0, CLICK_ENTRY_LABEL_MAX_LEN)
      : ''
  const displayTitle = labelRaw || defaultTitle
  const catLabel =
    typeof c.category === 'string' && c.category
      ? getObjectCategoryLabel(c.category)
      : ''
  const vegHtml = buildSessionMapPopupVegrefHtml(c)
  const timeStr =
    c.timestamp && !Number.isNaN(Date.parse(c.timestamp))
      ? formatNb(new Date(c.timestamp))
      : ''
  const isoAttr =
    c.timestamp && !Number.isNaN(Date.parse(c.timestamp))
      ? escapeHtml(c.timestamp)
      : ''
  const idAttr =
    typeof c.id === 'string' && c.id ? escapeHtml(c.id) : ''
  const commentRaw =
    typeof c.comment === 'string'
      ? c.comment.trim().slice(0, CLICK_ENTRY_COMMENT_MAX_LEN)
      : ''
  const commentBlock = commentRaw
    ? `<section class="session-map-popup__comment" aria-label="Kommentar"><p class="session-map-popup__comment-text">${escapeHtml(commentRaw)}</p></section>`
    : ''

  const micSvg = `<svg class="session-map-popup__voice-mic-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`

  return `<article class="session-map-popup session-map-popup--click" data-scanix-click-id="${idAttr}" data-scanix-click-idx="${index}" tabindex="0" aria-expanded="false" aria-label="Registrering på kart">
    <div class="session-map-popup__main">
      <header class="session-map-popup__head">
        <span class="session-map-popup__eyebrow">Registrering</span>
        <h2 class="session-map-popup__title">${escapeHtml(displayTitle)}</h2>
      </header>
      ${
        catLabel
          ? `<p class="session-map-popup__chip-wrap"><span class="session-map-popup__chip">${escapeHtml(catLabel)}</span></p>`
          : ''
      }
      ${vegHtml}
      ${commentBlock}
      ${
        timeStr
          ? `<footer class="session-map-popup__foot"><time class="session-map-popup__time" datetime="${isoAttr}">${escapeHtml(timeStr)}</time></footer>`
          : ''
      }
      <p class="session-map-popup__edit-hint">Dobbelttrykk for å redigere. Langt trykk for diktering. <button type="button" class="session-map-popup__edit-fallback">Rediger</button></p>
    </div>
    <div class="session-map-popup__voice-ui" hidden>
      <div class="session-map-popup__voice-toolbar">
        <button type="button" class="session-map-popup__voice-stop btn btn-text" aria-label="Stopp diktering uten å lagre">Stopp</button>
        <div class="session-map-popup__voice-wave" aria-hidden="true"></div>
        <span class="session-map-popup__voice-mic" aria-hidden="true">${micSvg}</span>
      </div>
      <p class="session-map-popup__voice-status" role="status" aria-live="polite">
        <span class="session-map-popup__voice-status-msg"></span><span class="session-map-popup__voice-status-dots-wrap" aria-hidden="true"><span class="session-map-popup__voice-status-dot">.</span><span class="session-map-popup__voice-status-dot">.</span><span class="session-map-popup__voice-status-dot">.</span></span>
      </p>
    </div>
  </article>`
}

/**
 * @param {object} ph photo entry
 * @param {number} index 0-basert
 * @param {{ mapView?: boolean }} [opts] Kart: bare miniatyr i popup (tung JPEG først ved behov).
 */
function buildSessionPhotoPopupHtml(ph, index, opts = {}) {
  const mapView = Boolean(opts.mapView)
  const idAttr =
    typeof ph.id === 'string' && ph.id ? escapeHtml(ph.id) : ''
  const n = index + 1
  const timeStr =
    ph.timestamp && !Number.isNaN(Date.parse(ph.timestamp))
      ? formatNb(new Date(ph.timestamp))
      : ''
  const isoAttr =
    ph.timestamp && !Number.isNaN(Date.parse(ph.timestamp))
      ? escapeHtml(ph.timestamp)
      : ''
  const vr = ph.vegref && normalizePhotoVegref(ph.vegref)
  const vegLines = vr
    ? [vr.road, vr.compact, vr.kortform].filter(Boolean)
    : []
  const vegLabels = ['Strekning', 'Kompakt', 'Kortform']
  let vegSection = ''
  if (vegLines.length) {
    const rows = vegLines
      .map((line, idx) => {
        const lab = vegLabels[idx] || `Linje ${idx + 1}`
        return `<div class="session-map-popup__dl-row"><dt class="session-map-popup__dt">${escapeHtml(lab)}</dt><dd class="session-map-popup__dd">${escapeHtml(line)}</dd></div>`
      })
      .join('')
    vegSection = `<section class="session-map-popup__veg" aria-label="Vegreferanse"><dl class="session-map-popup__dl">${rows}</dl></section>`
  }

  return `<article class="session-map-popup session-map-popup--photo" data-scanix-photo-id="${idAttr}">
    <header class="session-map-popup__head">
      <span class="session-map-popup__eyebrow">Bilde</span>
      <h2 class="session-map-popup__title">Bilde #${n}</h2>
    </header>
    ${vegSection}
    <div class="session-map-popup__media">
      ${photoPreviewImgHtml(ph, 'session-map-popup__img', mapView ? { mapView: true } : {})}
    </div>
    ${
      timeStr
        ? `<footer class="session-map-popup__foot"><time class="session-map-popup__time" datetime="${isoAttr}">${escapeHtml(timeStr)}</time></footer>`
        : ''
    }
  </article>`
}

/** Index i state.clickHistory under redigering i dialog (eller -1). */
let clickEntryEditTargetIndex = -1

function resolveClickHistoryIndexFromPopupDataset(card) {
  const id = card.dataset.scanixClickId
  if (id) {
    const ix = state.clickHistory.findIndex((x) => x.id === id)
    if (ix >= 0) return ix
  }
  const ix = Number(card.dataset.scanixClickIdx)
  if (Number.isFinite(ix) && state.clickHistory[ix]) return ix
  return -1
}

function openClickEntryEditDialogFromCard(card) {
  if (!(card instanceof HTMLElement)) return
  const idx = resolveClickHistoryIndexFromPopupDataset(card)
  if (idx < 0 || !state.clickHistory[idx]) return
  const c = state.clickHistory[idx]
  clickEntryEditTargetIndex = idx
  const dlg = document.getElementById('click-entry-edit-dialog')
  const titleInp = document.getElementById('click-entry-edit-title')
  const commentTa = document.getElementById('click-entry-edit-comment')
  if (
    !dlg ||
    !(titleInp instanceof HTMLInputElement) ||
    !(commentTa instanceof HTMLTextAreaElement)
  ) {
    return
  }
  titleInp.value = typeof c.label === 'string' ? c.label : ''
  commentTa.value = typeof c.comment === 'string' ? c.comment : ''
  map?.closePopup()
  dlg.showModal()
}

function applyClickEntryEditFromDialog() {
  const idx = clickEntryEditTargetIndex
  if (idx < 0 || !state.clickHistory[idx]) return
  const titleInp = document.getElementById('click-entry-edit-title')
  const commentTa = document.getElementById('click-entry-edit-comment')
  const label =
    titleInp instanceof HTMLInputElement
      ? titleInp.value.trim().slice(0, CLICK_ENTRY_LABEL_MAX_LEN)
      : ''
  const comment =
    commentTa instanceof HTMLTextAreaElement
      ? commentTa.value.trim().slice(0, CLICK_ENTRY_COMMENT_MAX_LEN)
      : ''
  const prev = state.clickHistory[idx]
  const next = { ...prev }
  if (label) next.label = label
  else delete next.label
  if (comment) next.comment = comment
  else delete next.comment
  state.clickHistory[idx] = next
  clickEntryEditTargetIndex = -1
  document.getElementById('click-entry-edit-dialog')?.close()
  persist('session:click_entry_edit_save')
  if (view === 'session' && map) {
    rebuildMarkers('click_entry_edit_save')
  }
  showSessionToast('Lagret')
}

function applyClickEntryVoiceTranscript(idx, raw) {
  if (idx < 0 || !state.clickHistory[idx]) return
  const prev = state.clickHistory[idx]
  const existingComment =
    typeof prev.comment === 'string' ? prev.comment.trim() : ''
  const { label, comment } = splitTranscriptToLabelComment(
    raw,
    existingComment,
    CLICK_ENTRY_LABEL_MAX_LEN,
    CLICK_ENTRY_COMMENT_MAX_LEN,
  )
  const next = { ...prev }
  if (label) next.label = label
  if (comment !== null) {
    if (comment) next.comment = comment
    else delete next.comment
  }
  state.clickHistory[idx] = next
  persist('session:click_entry_voice')
  if (view === 'session' && map) {
    rebuildMarkers('click_entry_voice')
  }
  showSessionToast('Lagret')
}

function wireClickEntryEditDialogListeners(signal) {
  document.getElementById('click-entry-edit-save')?.addEventListener(
    'click',
    () => applyClickEntryEditFromDialog(),
    { signal },
  )
  document.getElementById('click-entry-edit-cancel')?.addEventListener(
    'click',
    () => {
      clickEntryEditTargetIndex = -1
      document.getElementById('click-entry-edit-dialog')?.close()
    },
    { signal },
  )
  const dlg = document.getElementById('click-entry-edit-dialog')
  dlg?.addEventListener(
    'cancel',
    (ev) => {
      ev.preventDefault()
      clickEntryEditTargetIndex = -1
      dlg.close()
    },
    { signal },
  )
}

function attachSessionClickPopupEditGestures(card) {
  if (!map) return
  const ac = new AbortController()
  const { signal } = ac
  const open = (e) => {
    e.preventDefault()
    e.stopPropagation()
    openClickEntryEditDialogFromCard(card)
  }
  let lastTouchEnd = 0
  card.addEventListener('dblclick', open, { signal })
  card.addEventListener(
    'touchend',
    (e) => {
      const t = Date.now()
      if (t - lastTouchEnd < 320) {
        open(e)
        lastTouchEnd = 0
      } else {
        lastTouchEnd = t
      }
    },
    { signal, passive: false },
  )
  card
    .querySelector('.session-map-popup__edit-fallback')
    ?.addEventListener('click', open, { signal })
  attachClickPopupVoiceLongPress(card, {
    signal,
    getClickIndex: () => resolveClickHistoryIndexFromPopupDataset(card),
    onApplyTranscript: (ix, text) => applyClickEntryVoiceTranscript(ix, text),
    onCancel: () => {},
    triggerHaptic: () => triggerHapticMark(),
    toast: (msg) => showSessionToast(msg),
    onSpeechUnsupported: () => {
      showSessionToast(
        'Stemmegjenkjenning støttes ikke her. Bruk Rediger og tastaturets mikrofon.',
      )
      openClickEntryEditDialogFromCard(card)
    },
  })
  const onClose = () => ac.abort()
  map.once('popupclose', onClose)
}

async function hydrateSessionPhotoMapThumbInPopup(photoCard) {
  const pid = photoCard.dataset.scanixPhotoId
  if (!pid) return
  const ph = state.photos.find((p) => p && typeof p === 'object' && p.id === pid)
  if (!ph || typeof ph !== 'object') return
  if (sessionMapDisplayThumbDataUrl(ph)) return

  const rawThumb = photoMapThumbDataUrl(ph)
  if (rawThumb.length > SESSION_MAP_THUMB_DATA_URL_MAX_CHARS) {
    try {
      const compact = await makeThumbDataUrlFromDataUrl(rawThumb, {
        maxEdge: 200,
        quality: 0.78,
      })
      Object.assign(/** @type {Record<string, unknown>} */ (ph), {
        thumbDataUrl: compact,
      })
      await persistPhotoPixelsToIdbIfNeeded(ph)
      persist('session:photo_map_thumb_legacy_shrink')
      const media = photoCard.querySelector('.session-map-popup__media')
      if (media) {
        media.innerHTML = photoPreviewImgHtml(ph, 'session-map-popup__img', {
          mapView: true,
        })
      }
      if (view === 'session' && map) {
        rebuildMarkers('photo_map_thumb_legacy_shrink')
      }
    } catch (err) {
      console.warn('hydrateSessionPhotoMapThumbInPopup legacy thumb shrink', err)
    }
    return
  }

  const wrap = photoCard.querySelector('.session-map-popup__media')
  if (!wrap?.querySelector('.photo-preview--pending')) return

  let full =
    photoRecordHasPixelData(/** @type {{ dataUrl?: string }} */ (ph))
      ? /** @type {{ dataUrl: string }} */ (ph).dataUrl
      : ''
  if (!full && (await isPhotoBlobStoreAvailable())) {
    try {
      const fromIdb = await getPhotoDataUrl(pid)
      if (typeof fromIdb === 'string' && fromIdb.startsWith('data:image/')) {
        full = fromIdb
        Object.assign(/** @type {Record<string, unknown>} */ (ph), {
          dataUrl: fromIdb,
        })
      }
    } catch {
      /* ignore */
    }
  }
  if (!full) return
  try {
    const thumb = await makeThumbDataUrlFromDataUrl(full, {
      maxEdge: 200,
      quality: 0.78,
    })
    Object.assign(/** @type {Record<string, unknown>} */ (ph), {
      thumbDataUrl: thumb,
    })
    await persistPhotoPixelsToIdbIfNeeded(ph)
    persist('session:photo_map_thumb_hydrate')
    wrap.innerHTML = photoPreviewImgHtml(ph, 'session-map-popup__img', {
      mapView: true,
    })
    if (view === 'session' && map) {
      rebuildMarkers('photo_map_thumb_hydrate')
    }
  } catch (err) {
    console.warn('hydrateSessionPhotoMapThumbInPopup', err)
  }
}

function onSessionMapPopupOpen(e) {
  if (!map) return
  const popup = /** @type {{ getElement?: () => HTMLElement | undefined }} */ (
    e.popup
  )
  const el = popup.getElement?.()
  if (!el) return
  const clickCard = el.querySelector(
    '.session-map-popup--click[data-scanix-click-idx]',
  )
  if (clickCard instanceof HTMLElement) {
    attachSessionClickPopupEditGestures(clickCard)
  }
  const photoCard = el.querySelector(
    '.session-map-popup--photo[data-scanix-photo-id]',
  )
  if (photoCard instanceof HTMLElement) {
    void hydrateSessionPhotoMapThumbInPopup(photoCard)
  }
}

/**
 * Legger inn kompakt vegref på trykket — **kun lokalt** (`resolveVegref` uten nett).
 * Kartmarkør skal ikke vente på NVDB /posisjon; ved bom slås pending av (vanlig pin).
 * @param {string} clickId
 * @param {number} lat
 * @param {number} lng
 */
async function enrichClickEntryWithVegrefFromPosisjon(clickId, lat, lng) {
  registerNetSetActiveVegrefClickId(clickId)
  try {
    const { result: localRes } = await resolveVegref(lat, lng, { accuracyM: 28, allowNet: false })
    const snap = vegrefPosisjonToFrictionSnap(localRes)

    if (snap) {
      registerNetLogVegrefEnrich(clickId, {
        path: 'local_resolveVegref',
        note: 'Ingen NVDB HTTP — treff fra offline/lokal pipeline (da vises ikke nvdb_posisjon).',
      })
    }
    if (!snap) {
      registerNetLogVegrefEnrich(clickId, {
        path: 'no_vegref_snap_local_only',
        note: 'Ingen lokalt treff — pendingVegref av for kart (ingen nettvent på markør).',
      })
      const missIdx = state.clickHistory.findIndex((x) => x.id === clickId)
      if (missIdx >= 0) {
        state.clickHistory[missIdx] = {
          ...state.clickHistory[missIdx],
          pendingVegref: false,
        }
        persist('session:click_vegref_pending_cleared_local_miss')
        if (view === 'session' && map) {
          rebuildMarkers('click_vegref_local_miss')
        }
      }
      return
    }
    const idx = state.clickHistory.findIndex((x) => x.id === clickId)
    if (idx < 0) return
    state.clickHistory[idx] = {
      ...state.clickHistory[idx],
      vegrefAtClick: {
        vegnavn: snap.vegnavn,
        vegnr: snap.vegnr,
        meter: snap.meter,
        s: snap.s,
        d: snap.d,
      },
      pendingVegref: false,
    }
    persist('session:click_vegref_enriched')
    if (view === 'session' && map) {
      rebuildMarkers('click_vegref_enriched')
    }
  } catch (e) {
    console.warn('enrichClickEntryWithVegrefFromPosisjon', e)
    const errIdx = state.clickHistory.findIndex((x) => x.id === clickId)
    if (errIdx >= 0) {
      state.clickHistory[errIdx] = {
        ...state.clickHistory[errIdx],
        pendingVegref: false,
      }
      persist('session:click_vegref_pending_cleared_error')
      if (view === 'session' && map) {
        rebuildMarkers('click_vegref_enrich_error')
      }
    }
  } finally {
    registerNetSetActiveVegrefClickId(null)
  }
}

/** @type {Promise<void> | null} */
let enrichPendingClicksPromise = null

/**
 * Beriker registreringer som mangler vegreferanse — **lokalt først** (samme som resolveVegref uten nett i enrich-funksjonen).
 */
function enrichPendingClicks() {
  if (enrichPendingClicksPromise) return enrichPendingClicksPromise
  enrichPendingClicksPromise = (async () => {
    const ids = state.clickHistory
      .filter(
        (c) =>
          c &&
          c.pendingVegref === true &&
          c.lat != null &&
          c.lng != null &&
          Number.isFinite(Number(c.lat)) &&
          Number.isFinite(Number(c.lng)),
      )
      .map((c) => c.id)
    for (const id of ids) {
      const c = state.clickHistory.find((x) => x.id === id)
      if (!c || !c.pendingVegref) continue
      await enrichClickEntryWithVegrefFromPosisjon(
        id,
        Number(c.lat),
        Number(c.lng),
      )
    }
  })().finally(() => {
    enrichPendingClicksPromise = null
  })
  return enrichPendingClicksPromise
}

/**
 * Oppgraderer pending registreringer når bedre GPS-fix kommer (innen tidsvindu).
 */
function maybeFixPendingGps(lat, lng, accuracy) {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    typeof accuracy !== 'number' ||
    accuracy > REGISTER_MAX_GPS_ACCURACY_M ||
    !state.clickHistory.length
  ) {
    return
  }
  const now = Date.now()
  let changed = false
  for (let i = 0; i < state.clickHistory.length; i++) {
    const c = state.clickHistory[i]
    if (!c || !c.pendingGps) continue
    const t = c.timestamp ? Date.parse(c.timestamp) : 0
    const inWindow = t && now - t <= PENDING_GPS_UPGRADE_WINDOW_MS
    if (!inWindow) continue
    state.clickHistory[i] = {
      ...c,
      lat,
      lng,
      gpsAccuracyM: accuracy,
      pendingGps: false,
      positionSource: 'watch-upgrade',
    }
    changed = true
  }
  if (changed) {
    persist('session:pending_gps_watch_upgrade')
    if (view === 'session' && map) {
      rebuildMarkers('pending_gps_watch_upgrade')
    }
    void enrichPendingClicks()
  }
}

const sessionMarkerInteractionDefaults = Object.freeze({
  bubblingMouseEvents: false,
  riseOnHover: false,
})

/**
 * @param {string} [regtraceNote] — når `scanix-register-trace` / `?regtrace=1`: logg årsak til kart-oppbygging.
 */
function rebuildMarkers(regtraceNote) {
  if (!map || !Leaflet) return
  if (regtraceNote) {
    regtraceRebuildMarkers(regtraceNote, {
      clicks: state.clickHistory?.length ?? 0,
      photos: state.photos?.length ?? 0,
    })
  }
  ensureSessionPinIcons()
  const { clickLatLng, photoLatLng } = computeAllMarkerDisplayPositions()
  if (sessionMarkerClusterGroup) {
    try {
      /** @type {{ clearLayers?: () => void }} */ (sessionMarkerClusterGroup).clearLayers?.()
    } catch {
      /* ignore */
    }
  } else {
    markers.forEach((m) => {
      try {
        map.removeLayer(m)
      } catch {
        /* ignore */
      }
    })
  }
  markers.length = 0
  const addMarker = (/** @type {import('leaflet').Marker} */ m) => {
    if (sessionMarkerClusterGroup) {
      /** @type {{ addLayer: (x: import('leaflet').Marker) => void }} */ (
        sessionMarkerClusterGroup
      ).addLayer(m)
    } else {
      m.addTo(map)
    }
    markers.push(m)
  }
  state.clickHistory.forEach((c, i) => {
    if (c.lat == null || c.lng == null) return
    const ll = clickLatLng.get(i) || [c.lat, c.lng]
    const usePending =
      Boolean(c.pendingGps || c.pendingVegref) &&
      pendingPinIcon != null
    const m = Leaflet.marker(ll, {
      icon: usePending ? pendingPinIcon : pinIcon,
      ...sessionMarkerInteractionDefaults,
    })
    m.bindPopup(() => {
      let ix = -1
      if (typeof c.id === 'string' && c.id) {
        ix = state.clickHistory.findIndex((x) => x && x.id === c.id)
      }
      if (ix < 0) ix = state.clickHistory.indexOf(c)
      if (ix < 0) {
        return '<article class="session-map-popup"><p>Registrering finnes ikke lenger.</p></article>'
      }
      return buildSessionClickPopupHtml(state.clickHistory[ix], ix)
    }, SESSION_MAP_POPUP_OPTIONS)
    addMarker(m)
  })
  state.photos.forEach((ph, i) => {
    if (ph.lat == null || ph.lng == null) return
    const ll = photoLatLng.get(i) || [ph.lat, ph.lng]
    const mapThumb = sessionMapDisplayThumbDataUrl(ph)
    const m = Leaflet.marker(ll, {
      icon: mapThumb ? photoThumbnailIcon(mapThumb) : pinIcon,
      ...sessionMarkerInteractionDefaults,
    })
    m.bindPopup(() => {
      let ix = -1
      if (typeof ph.id === 'string' && ph.id) {
        ix = state.photos.findIndex((x) => x && x.id === ph.id)
      }
      if (ix < 0) ix = state.photos.indexOf(ph)
      if (ix < 0) {
        return '<article class="session-map-popup session-map-popup--photo"><p>Bilde finnes ikke lenger.</p></article>'
      }
      return buildSessionPhotoPopupHtml(state.photos[ix], ix, {
        mapView: true,
      })
    }, SESSION_MAP_POPUP_OPTIONS)
    addMarker(m)
  })
}

function fitAllPins() {
  if (!map) return
  followUserOnMap = false
  syncSessionMapExploreButton()
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
    map.setView([pts[0].lat, pts[0].lng], APP_MAP_MAX_ZOOM)
    return
  }
  const b = Leaflet.latLngBounds(pts.map((p) => [p.lat, p.lng]))
  map.fitBounds(b, { padding: [40, 40], maxZoom: APP_MAP_MAX_ZOOM })
}

function syncSessionMapExploreButton() {
  const btn = document.getElementById('btn-map-explore')
  if (!btn) return
  const show = Boolean(map) && followUserOnMap
  btn.hidden = !show
  btn.setAttribute('aria-hidden', show ? 'false' : 'true')
}

/** Flytter kartet til gjeldende posisjon (blå markør / siste GPS). */
function centerMapOnUserPosition() {
  if (!map) return
  followUserOnMap = true
  syncSessionMapExploreButton()
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
          'Tillat posisjon – kartet følger deg. Dra i kartet eller trykk «Fri kart» for å utforske; ⌂ «Min posisjon» følger GPS igjen.'
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
      color: 'rgba(10, 132, 255, 0.4)',
      fillColor: '#0a84ff',
      fillOpacity: 0.11,
      weight: 1,
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
    timeout: 3500,
  })
  return coordsFromPosition(pos)
}

/**
 * Posisjon for «Registrer»-trykk.
 * Bruker rå enhets-GPS: fersk getCurrentPosition (maximumAge: 0), ikke navTarget
 * (som kan være glattet og/eller OSRM-justert) og ikke interpolert visning (navDisplay*).
 * Rask bane: nylig watch-fix med god nok nøyaktighet brukes direkte (sparer ventetid).
 * Deretter eldre watch-fix (unngår lang getCurrentPosition-ventetid), så fersk fix.
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
      positionSource: 'watch-fresh',
    }
  }
  const wStale = lastRawGpsFromWatch
  if (
    wStale &&
    now - wStale.ts < LIVE_POS_MAX_AGE_MS &&
    wStale.lat != null &&
    wStale.lng != null &&
    !Number.isNaN(Number(wStale.lat)) &&
    !Number.isNaN(Number(wStale.lng))
  ) {
    const a = wStale.accuracy
    return {
      lat: wStale.lat,
      lng: wStale.lng,
      accuracy:
        typeof a === 'number' && !Number.isNaN(a) ? a : 50,
      positionSource: 'watch-stale',
    }
  }
  try {
    const c = await getFreshPositionForRegisterClick()
    return { ...c, positionSource: 'fresh' }
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
      positionSource: 'watch-stale',
    }
  }
  const p = await getPosition()
  return { ...p, positionSource: 'fallback' }
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

let kmtMeterTweenDur = 380
function tickKmtMeterTween(now) {
  const el = document.getElementById('kmt-m')
  if (!el) {
    kmtMeterAnim = null
    return
  }
  const u = Math.min(1, (now - kmtMeterT0) / kmtMeterTweenDur)
  const ease = 1 - (1 - u) ** 3
  const v = Math.round(kmtMeterFrom + (kmtMeterTo - kmtMeterFrom) * ease)
  el.textContent = formatHomeVegrefMeterText(v)
  kmtDisplayedMeter = v
  syncKmtCompactLine()
  if (u < 1) {
    kmtMeterAnim = requestAnimationFrame(tickKmtMeterTween)
  } else {
    kmtMeterAnim = null
    el.textContent = formatHomeVegrefMeterText(kmtMeterTo)
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
  const mSeg = /^m/i.test(m) ? m : m === '–' || m === '-' ? m : `m${m}`
  compact.textContent = `S ${s} · D ${d} · ${mSeg}`
}

function startKmtMeterTweenTo(targetInt) {
  const el = document.getElementById('kmt-m')
  if (!el) return
  const from = kmtDisplayedMeter != null ? kmtDisplayedMeter : targetInt
  if (from === targetInt) {
    el.textContent = formatHomeVegrefMeterText(targetInt)
    kmtDisplayedMeter = targetInt
    syncKmtCompactLine()
    cancelKmtMeterTween()
    return
  }
  cancelKmtMeterTween()
  kmtMeterFrom = from
  kmtMeterTo = targetInt
  kmtMeterT0 = performance.now()
  kmtMeterTweenDur = kmtMeterTweenMs()
  kmtMeterAnim = requestAnimationFrame(tickKmtMeterTween)
}

/** iPhone / iPod / iPad (inkl. iPadOS med «Macintosh»-UA). */
function kmtIsAppleMobileWebKit() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPod/.test(ua)) return true
  if (/iPad/.test(ua)) return true
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    return true
  return false
}

/**
 * Om enheten rapporterer at torch kan styres (WebKit på iOS gir ofte ikke `torch === true`).
 * @param {MediaStreamTrack | undefined} track
 */
function kmtTorchReadCaps(track) {
  if (!track || typeof track.getCapabilities !== 'function') return false
  try {
    const caps = track.getCapabilities()
    if (!caps || typeof caps !== 'object') return false
    const t = /** @type {{ torch?: unknown }} */ (caps).torch
    if (t === true) return true
    if (Array.isArray(t)) return t.includes(true)
    if (t && typeof t === 'object') {
      const o = /** @type {{ min?: unknown, max?: unknown }} */ (t)
      if (o.min === true || o.max === true) return true
      if (o.min === false && o.max === true) return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Vis blits-kontroll når vi med rimelighet kan styre lommelykt (prioritet: iOS Safari).
 * @param {MediaStreamTrack | undefined} track
 */
function kmtTorchUiEnabled(track) {
  if (kmtTorchReadCaps(track)) return true
  if (!track || track.kind !== 'video') return false
  const sup = navigator.mediaDevices?.getSupportedConstraints?.()
  if (sup?.torch === true) return true
  /* Eldre iOS / rare WebKit-Bygg: ingen `torch` i supportedConstraints, men bakkamera kan likevel ta torch. */
  if (kmtIsAppleMobileWebKit()) {
    try {
      const st = track.getSettings?.()
      if (st && st.facingMode === 'environment') return true
    } catch {
      /* ignore */
    }
  }
  return false
}

/**
 * @param {boolean} on
 */
async function setKmtTorch(on) {
  const track = kmtMediaStream?.getVideoTracks?.()?.[0]
  if (!track || typeof track.applyConstraints !== 'function') return false
  const want = !!on
  try {
    await track.applyConstraints({ advanced: [{ torch: want }] })
    return true
  } catch {
    /* prøv flat constraint (noen WebKit-versjoner) */
  }
  try {
    await track.applyConstraints({ torch: want })
    return true
  } catch {
    return false
  }
}

function syncKmtTorchUi() {
  const btn = document.getElementById('btn-kmt-torch')
  if (!(btn instanceof HTMLButtonElement)) return
  const track = kmtMediaStream?.getVideoTracks?.()?.[0]
  const ok = kmtTorchUiEnabled(track)
  btn.disabled = !ok
  if (!ok) {
    btn.setAttribute('aria-pressed', 'false')
    btn.classList.remove('kmt-torch-btn--on')
  }
}

function resetKmtCameraExtrasDom() {
  const note = document.getElementById('kmt-photo-note')
  if (note instanceof HTMLTextAreaElement) note.value = ''
  const btn = document.getElementById('btn-kmt-torch')
  if (btn instanceof HTMLButtonElement) {
    btn.setAttribute('aria-pressed', 'false')
    btn.classList.remove('kmt-torch-btn--on')
    btn.disabled = true
  }
}

async function stopKmtCameraStream() {
  cancelKmtMeterTween()
  const video = document.getElementById('kmt-video')
  const stream = kmtMediaStream
  const vt = stream?.getVideoTracks?.()?.[0]
  const torchBtn = document.getElementById('btn-kmt-torch')
  const userTorchOn =
    torchBtn instanceof HTMLButtonElement &&
    torchBtn.getAttribute('aria-pressed') === 'true'
  const shouldTorchOff =
    vt &&
    typeof vt.applyConstraints === 'function' &&
    (userTorchOn ||
      kmtTorchReadCaps(vt) ||
      (navigator.mediaDevices?.getSupportedConstraints?.()?.torch === true &&
        kmtIsAppleMobileWebKit()))
  if (shouldTorchOff && vt) {
    try {
      await vt.applyConstraints({ advanced: [{ torch: false }] })
    } catch {
      /* ignore */
    }
    try {
      await vt.applyConstraints({ torch: false })
    } catch {
      /* ignore */
    }
  }
  if (video) {
    try {
      video.srcObject = null
    } catch {
      /* ignore */
    }
  }
  if (stream) {
    for (const t of stream.getTracks()) {
      try {
        t.stop()
      } catch {
        /* ignore */
      }
    }
    kmtMediaStream = null
  }
  kmtCameraMode = false
  const kmtDlg = document.getElementById('kmt-dialog')
  kmtDlg?.classList.remove('kmt-dialog--camera', 'kmt-dialog--camera-warmup')
  resetKmtPreviewZoom()
  kmtWideLensDeviceId = null
  kmtMainCameraDeviceId = null
  kmtUsingWideLens = false
  kmtWideSwitchInFlight = false
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

function resetKmtPreviewZoom() {
  kmtZoomScale = 1
  kmtZoomPanPx = 0
  kmtZoomPanPy = 0
  const inner = document.getElementById('kmt-video-zoom-inner')
  if (inner) {
    inner.style.setProperty('--kmt-zoom', '1')
    inner.style.setProperty('--kmt-pan-x', '0px')
    inner.style.setProperty('--kmt-pan-y', '0px')
  }
}

/**
 * @param {number} vw
 * @param {number} vh
 * @param {number} dispW
 * @param {number} dispH
 */
function kmtVideoCoverSourceRect(vw, vh, dispW, dispH) {
  const r = Math.max(dispW / vw, dispH / vh)
  const sw = dispW / r
  const sh = dispH / r
  const sx = (vw - sw) / 2
  const sy = (vh - sh) / 2
  return { sx, sy, sw, sh }
}

function applyKmtPreviewZoomStyle() {
  const inner = document.getElementById('kmt-video-zoom-inner')
  const stage = document.getElementById('kmt-video-stage')
  if (!inner || !stage) return
  const sw = stage.clientWidth
  const sh = stage.clientHeight
  let z = Math.max(1, Math.min(3, kmtZoomScale))
  kmtZoomScale = z
  if (z <= 1.001) {
    kmtZoomPanPx = 0
    kmtZoomPanPy = 0
  } else {
    const maxPanX = (sw * (z - 1)) / 2
    const maxPanY = (sh * (z - 1)) / 2
    kmtZoomPanPx = Math.max(-maxPanX, Math.min(maxPanX, kmtZoomPanPx))
    kmtZoomPanPy = Math.max(-maxPanY, Math.min(maxPanY, kmtZoomPanPy))
  }
  inner.style.setProperty('--kmt-zoom', String(z))
  inner.style.setProperty('--kmt-pan-x', `${kmtZoomPanPx}px`)
  inner.style.setProperty('--kmt-pan-y', `${kmtZoomPanPy}px`)
}

function getKmtEffectiveZoom() {
  return (kmtUsingWideLens ? 0.5 : 1) * kmtZoomScale
}

function getKmtMinEffectiveZoom() {
  return kmtWideLensDeviceId && kmtMainCameraDeviceId ? 0.5 : 1
}

/**
 * Holder zoom-opplevelsen stabil på tvers av hovedkamera og vidvinkel.
 * Når brukeren zoomer langt nok ut, byttes det automatisk til vidvinkel.
 * @param {number} nextEffectiveZoom
 */
async function setKmtEffectiveZoom(nextEffectiveZoom) {
  const canAutoWide = Boolean(kmtWideLensDeviceId && kmtMainCameraDeviceId)
  const minZoom = canAutoWide ? 0.5 : 1
  const effective = Math.max(minZoom, Math.min(3, nextEffectiveZoom))

  if (canAutoWide && !kmtUsingWideLens && effective < 0.9) {
    await switchKmtWideCamera(true, effective)
    return
  }
  if (canAutoWide && kmtUsingWideLens && effective >= 1.02) {
    await switchKmtWideCamera(false, effective)
    return
  }

  kmtZoomScale = kmtUsingWideLens ? effective / 0.5 : effective
  applyKmtPreviewZoomStyle()
}

/**
 * @param {HTMLVideoElement} video
 * @returns {{ sx: number, sy: number, sw: number, sh: number } | null}
 */
function computeKmtCaptureSourceRect(video) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (vw < 32 || vh < 32) return null
  const rw = video.clientWidth
  const rh = video.clientHeight
  if (rw < 2 || rh < 2) {
    return { sx: 0, sy: 0, sw: vw, sh: vh }
  }
  const cover = kmtVideoCoverSourceRect(vw, vh, rw, rh)
  const z = Math.max(1, Math.min(3, kmtZoomScale))
  const dw = cover.sw / z
  const dh = cover.sh / z
  const maxPanSrcX = (cover.sw - dw) / 2
  const maxPanSrcY = (cover.sh - dh) / 2
  const stage = document.getElementById('kmt-video-stage')
  const sw = stage?.clientWidth ?? rw
  const sh = stage?.clientHeight ?? rh
  const maxPanStageX = (sw * (z - 1)) / 2
  const maxPanStageY = (sh * (z - 1)) / 2
  let nx = 0
  let ny = 0
  if (maxPanStageX > 0 && maxPanSrcX > 0) {
    nx = Math.max(-1, Math.min(1, kmtZoomPanPx / maxPanStageX))
  }
  if (maxPanStageY > 0 && maxPanSrcY > 0) {
    ny = Math.max(-1, Math.min(1, kmtZoomPanPy / maxPanStageY))
  }
  let outSx = cover.sx + cover.sw / 2 - dw / 2 + nx * maxPanSrcX
  let outSy = cover.sy + cover.sh / 2 - dh / 2 + ny * maxPanSrcY
  outSx = Math.max(cover.sx, Math.min(cover.sx + cover.sw - dw, outSx))
  outSy = Math.max(cover.sy, Math.min(cover.sy + cover.sh - dh, outSy))
  return { sx: outSx, sy: outSy, sw: dw, sh: dh }
}

/** Hopper punktfokus rett etter knipe-zoom. */
let kmtSkipNextTapFocus = false

async function switchKmtWideCamera(wantWide, keepEffectiveZoom = null) {
  if (!kmtWideLensDeviceId || !kmtMainCameraDeviceId) return false
  const video = document.getElementById('kmt-video')
  if (!video || !navigator.mediaDevices?.getUserMedia) return false
  if (kmtWideSwitchInFlight) return false
  if (wantWide === kmtUsingWideLens) {
    if (typeof keepEffectiveZoom === 'number' && Number.isFinite(keepEffectiveZoom)) {
      kmtZoomScale = wantWide ? keepEffectiveZoom / 0.5 : keepEffectiveZoom
      applyKmtPreviewZoomStyle()
    }
    return true
  }
  const deviceId = wantWide ? kmtWideLensDeviceId : kmtMainCameraDeviceId
  const nextEffective =
    typeof keepEffectiveZoom === 'number' && Number.isFinite(keepEffectiveZoom)
      ? Math.max(getKmtMinEffectiveZoom(), Math.min(3, keepEffectiveZoom))
      : getKmtEffectiveZoom()
  kmtWideSwitchInFlight = true
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false,
    })
    const old = kmtMediaStream
    if (old) {
      for (const t of old.getTracks()) {
        try {
          t.stop()
        } catch {
          /* ignore */
        }
      }
    }
    kmtMediaStream = newStream
    video.srcObject = newStream
    video.muted = true
    await video.play()
    kmtUsingWideLens = wantWide
    kmtZoomScale = wantWide ? nextEffective / 0.5 : nextEffective
    kmtZoomPanPx = 0
    kmtZoomPanPy = 0
    applyKmtPreviewZoomStyle()
    const vtrack = newStream.getVideoTracks()[0]
    const farOk = await applyKmtFarFocusPreference(vtrack)
    if (!farOk) await applyKmtContinuousAutofocus(vtrack)
    syncKmtTorchUi()
    return true
  } catch {
    const st = document.getElementById('kmt-status')
    if (st) {
      st.textContent = 'Kunne ikke bytte kamera.'
      st.hidden = false
    }
    return false
  } finally {
    kmtWideSwitchInFlight = false
  }
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

/** Kort «lukker»-blink ved lagring (ikke treg UI). */
function triggerKmtCaptureFlash() {
  if (typeof window.matchMedia === 'function') {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    } catch {
      /* ignore */
    }
  }
  const el = document.getElementById('kmt-capture-flash')
  if (!el) return
  el.classList.remove('kmt-capture-flash--pulse')
  void el.offsetWidth
  el.classList.add('kmt-capture-flash--pulse')
  window.setTimeout(() => {
    el.classList.remove('kmt-capture-flash--pulse')
  }, 110)
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

  const crop = computeKmtCaptureSourceRect(video)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  if (crop && crop.sw > 8 && crop.sh > 8) {
    canvas.width = Math.round(crop.sw)
    canvas.height = Math.round(crop.sh)
    ctx.drawImage(
      video,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      canvas.width,
      canvas.height,
    )
  } else {
    canvas.width = w
    canvas.height = h
    ctx.drawImage(video, 0, 0, w, h)
  }
  triggerKmtCaptureFlash()

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
    dataUrl = await compressDataUrlToJpegUnderBytes(raw, {
      maxBytes: PHOTO_STORAGE_TARGET_MAX_BYTES,
      maxEdge: PHOTO_MAX_DIM,
      minQuality: PHOTO_STORAGE_MIN_JPEG_QUALITY,
      minEdge: PHOTO_STORAGE_MIN_EDGE,
    })
  } catch {
    const st = document.getElementById('kmt-status')
    if (st) st.textContent = 'Kunne ikke komprimere bilde.'
    return
  }
  const noteEl = document.getElementById('kmt-photo-note')
  const rawNote = noteEl instanceof HTMLTextAreaElement ? noteEl.value : ''
  const noteTrim =
    typeof rawNote === 'string' && rawNote.trim()
      ? rawNote.trim().slice(0, 800)
      : ''
  /** @type {{ vegref?: NonNullable<ReturnType<typeof normalizePhotoVegref>>, note?: string, captureWithVegrefDateTime?: boolean }} */
  const addOpts = {}
  if (vegref) addOpts.vegref = vegref
  if (noteTrim) addOpts.note = noteTrim
  addOpts.captureWithVegrefDateTime = true
  try {
    await addPhotoFromCompressedDataUrl(dataUrl, addOpts)
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

/**
 * Samme strengavledning som applyHomeVegrefResult (primær, type, mappe) — for KMT-speil.
 * @param {unknown} res
 * @returns {{ primary: string, typeLine: string, folderSeed: string } | null}
 */
function getVegrefHomeMirrorStrings(res) {
  if (!res || typeof res !== 'object') return null
  const r = /** @type {{ roadLineDisplay?: unknown, roadLine?: unknown, roadLineDisplayShort?: unknown, roadLineShort?: unknown }} */ (
    res
  )
  const longDisplay = String(r.roadLineDisplay || '').trim()
  const longOfficial = String(r.roadLine || '').trim()
  const display = String(
    r.roadLineDisplayShort ||
      r.roadLineShort ||
      r.roadLineDisplay ||
      r.roadLine ||
      '',
  ).trim()
  const officialShort = String(r.roadLineShort || longOfficial || '').trim()
  if (!display && !officialShort) return null
  const primary = display || officialShort
  const isStreet =
    longDisplay &&
    longOfficial &&
    longDisplay !== longOfficial &&
    officialShort
  const typeLine = isStreet ? officialShort : ''
  const folderSeed =
    String(
      r.roadLineShort || r.roadLineDisplayShort || r.roadLine || '',
    ).trim() || longOfficial
  return { primary, typeLine, folderSeed }
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
  const folderSrcEl = document.getElementById('kmt-road-folder-src')
  if (folderSrcEl) folderSrcEl.textContent = ''
  if (s) s.textContent = '–'
  if (d) d.textContent = '–'
  if (m) m.textContent = '–'
  if (kf) {
    kf.textContent = ''
    kf.hidden = true
  }
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
    kmtLastMeterUiCommitAt = 0
    kmtRefSegmentKey = ''
    line.textContent = '–'
    const folderSrcEl = document.getElementById('kmt-road-folder-src')
    if (folderSrcEl) folderSrcEl.textContent = ''
    if (sEl) sEl.textContent = '–'
    if (dEl) dEl.textContent = '–'
    if (mEl) mEl.textContent = '–'
    if (kf) {
      kf.textContent = ''
      kf.hidden = true
    }
    syncKmtCompactLine()
    return
  }
  if (st) {
    st.textContent = ''
    st.hidden = true
  }
  kmtHasDisplayedResult = true
  const skipM = Boolean(
    /** @type {{ skipMeterUpdate?: boolean }} */ (res).skipMeterUpdate,
  )
  const segKey = `${res.roadLine}|${res.s}|${res.d}`
  const segmentChanged = segKey !== kmtRefSegmentKey
  kmtRefSegmentKey = segKey
  const mirror = getVegrefHomeMirrorStrings(res)
  const folderSrcEl = document.getElementById('kmt-road-folder-src')
  if (mirror) {
    line.textContent = mirror.primary
    if (folderSrcEl) folderSrcEl.textContent = mirror.folderSeed
    if (kf) {
      kf.textContent = mirror.typeLine
      kf.hidden = !mirror.typeLine
    }
  } else {
    line.textContent = '–'
    if (folderSrcEl) folderSrcEl.textContent = ''
    if (kf) {
      kf.textContent = ''
      kf.hidden = true
    }
  }
  if (sEl) sEl.textContent = res.s
  if (dEl) dEl.textContent = res.d
  if (!mEl) {
    syncKmtCompactLine()
    return
  }
  if (skipM && kmtHasDisplayedResult && kmtDisplayedMeter != null) {
    mEl.textContent = formatHomeVegrefMeterText(kmtDisplayedMeter)
    syncKmtCompactLine()
    return
  }
  const mInt = parseKmtMeterInt(res.m)
  const mTarget =
    mInt != null ? guardrailHomeVegrefTargetMeter(mInt, kmtDisplayedMeter, segmentChanged) : null
  if (mTarget == null) {
    cancelKmtMeterTween()
    kmtDisplayedMeter = null
    kmtLastMeterUiCommitAt = 0
    mEl.textContent = formatHomeVegrefMeterText(res.m)
    syncKmtCompactLine()
    return
  }
  if (kmtDisplayedMeter == null) {
    cancelKmtMeterTween()
    kmtDisplayedMeter = mTarget
    kmtLastMeterUiCommitAt = Date.now()
    mEl.textContent = formatHomeVegrefMeterText(mTarget)
    syncKmtCompactLine()
    return
  }
  const delta = Math.abs(mTarget - kmtDisplayedMeter)
  const snap = kmtMeterSnapThreshold()
  if (delta >= snap) {
    cancelKmtMeterTween()
    kmtDisplayedMeter = mTarget
    kmtLastMeterUiCommitAt = Date.now()
    mEl.textContent = formatHomeVegrefMeterText(mTarget)
    syncKmtCompactLine()
    return
  }
  if (
    shouldSkipVegrefMeterDisplayUpdate(
      mTarget,
      kmtDisplayedMeter,
      segmentChanged,
      kmtMeterSnapThreshold,
      kmtLastMeterUiCommitAt,
    )
  ) {
    mEl.textContent = formatHomeVegrefMeterText(kmtDisplayedMeter)
    syncKmtCompactLine()
    return
  }
  kmtLastMeterUiCommitAt = Date.now()
  startKmtMeterTweenTo(mTarget)
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
  if (kf) {
    kf.textContent = ''
    kf.hidden = true
  }
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
  return noMeter ? mStr : `m${mStr}`
}

/**
 * Forside: færre tekstbytt under fart, men **ekte** heltall (m543), ikke fast 10 m-grid.
 * Intern `homeVegrefDisplayedMeter` endres ikke her.
 */
function formatHomeVegrefMeterTextForHomeUi(internalInt) {
  if (typeof internalInt !== 'number' || !Number.isFinite(internalInt)) {
    resetHomeVegrefMeterUiHold()
    return formatHomeVegrefMeterText(internalInt)
  }
  const now = Date.now()
  const instUi =
    typeof homeVegrefGpsInstSpeedMps === 'number' &&
    Number.isFinite(homeVegrefGpsInstSpeedMps) &&
    homeVegrefGpsInstSpeedMps > 0
      ? homeVegrefGpsInstSpeedMps
      : 0
  const spd = Math.max(vegrefGetLastSpeed(), instUi)
  const ri = Math.round(internalInt)
  if (spd < 2.05) {
    homeVegrefMeterUiHoldInt = ri
    homeVegrefMeterUiHoldWallMs = now
    return formatHomeVegrefMeterText(ri)
  }
  const prev = homeVegrefMeterUiHoldInt
  const age = prev != null ? now - homeVegrefMeterUiHoldWallMs : 99999
  const delta = prev != null ? Math.abs(ri - prev) : 999
  if (prev != null && ri < prev && spd >= 0.75) {
    homeVegrefMeterUiHoldInt = ri
    homeVegrefMeterUiHoldWallMs = now
    return formatHomeVegrefMeterText(ri)
  }
  const minStep = spd >= 24 ? 3 : spd >= 14 ? 2 : spd >= 6 ? 2 : 1
  const maxHoldMs = spd >= 24 ? 95 : spd >= 14 ? 130 : spd >= 6 ? 200 : 320
  if (prev == null || delta >= minStep || age >= maxHoldMs) {
    homeVegrefMeterUiHoldInt = ri
    homeVegrefMeterUiHoldWallMs = now
    return formatHomeVegrefMeterText(ri)
  }
  return formatHomeVegrefMeterText(prev)
}

function setHomeVegrefCompactDom(s, d, meterPart) {
  const sEl = document.getElementById('home-vegref-s')
  const dEl = document.getElementById('home-vegref-d')
  const mEl = document.getElementById('home-vegref-meter')
  const ss = s != null ? String(s) : '–'
  const dd = d != null ? String(d) : '–'
  if (sEl) sEl.textContent = `S${ss}`
  if (dEl) dEl.textContent = `D${dd}`
  if (mEl) {
    if (typeof meterPart === 'number' && Number.isFinite(meterPart)) {
      noteHomeVegrefDisplayJitter(meterPart)
      mEl.textContent = formatHomeVegrefMeterTextForHomeUi(meterPart)
    } else {
      resetHomeVegrefMeterUiHold()
      mEl.textContent = formatHomeVegrefMeterText(meterPart)
    }
  }
}

function cancelHomeVegrefMeterTween() {
  if (homeVegrefMeterAnim != null) {
    cancelAnimationFrame(homeVegrefMeterAnim)
    homeVegrefMeterAnim = null
  }
}

/** Siste heltall skrevet til meter-DOM under live-extrap (unngå 60 Hz tekstflimmer). */
let homeVegrefMeterLiveLastDomInt = /** @type {number | null} */ (null)
let homeVegrefMeterLiveLastDomWallMs = 0
/** Debug: throttle tick-logg for bakover-ekstrap (session ff8b7b). */
let __dbgMeterTickLogMs = 0
/** Siste viste metertall på forsiden (myk «hold» — ikke samme som intern state). */
let homeVegrefMeterUiHoldInt = /** @type {number | null} */ (null)
let homeVegrefMeterUiHoldWallMs = 0

function resetHomeVegrefMeterUiHold() {
  homeVegrefMeterUiHoldInt = null
  homeVegrefMeterUiHoldWallMs = 0
}

function cancelHomeVegrefMeterLiveExtrap() {
  if (homeVegrefMeterLiveRaf != null) {
    cancelAnimationFrame(homeVegrefMeterLiveRaf)
    homeVegrefMeterLiveRaf = null
  }
  if (homeVegrefMeterLiveSlowTimer != null) {
    clearTimeout(homeVegrefMeterLiveSlowTimer)
    homeVegrefMeterLiveSlowTimer = null
  }
  homeVegrefMeterLiveLastTs = 0
  homeVegrefMeterLiveLastDomInt = null
  homeVegrefMeterLiveLastDomWallMs = 0
  resetHomeVegrefMeterUiHold()
}

function scheduleHomeVegrefMeterLiveRecheck() {
  if (homeVegrefMeterLiveSlowTimer != null) return
  homeVegrefMeterLiveSlowTimer = setTimeout(() => {
    homeVegrefMeterLiveSlowTimer = null
    if (view !== 'home' || homeVegrefDisplayedMeter == null) return
    if (homeVegrefMeterAnim != null) return
    startHomeVegrefMeterLiveExtrap()
  }, 200)
}

/** Unngå at pipelinens «stillestående» stopper ekstrap rett etter resume (GPS er ofte 0–800 ms etter). */
function markHomeVegrefMeterResumeBoost(ms = 2600) {
  homeVegrefMeterResumeUntil = Date.now() + ms
}

/** Synk klokke + start ekstrap på nytt når appen kommer tilbake fra bakgrunn (iOS throttler rAF). */
function bumpHomeVegrefMeterAfterForeground() {
  if (view !== 'home') return
  markHomeVegrefMeterResumeBoost()
  if (homeVegrefDisplayedMeter == null || homeVegrefMeterAnim != null) return
  startHomeVegrefMeterLiveExtrap()
}

function tickHomeVegrefMeterLive() {
  if (homeVegrefMeterLiveRaf == null) return
  // #region agent log
  const __tickT0 = performance.now()
  let __tickDtRaw = 0
  // #endregion
  if (view !== 'home') {
    cancelHomeVegrefMeterLiveExtrap()
    return
  }
  if (homeVegrefMeterAnim != null) {
    homeVegrefMeterLiveRaf = null
    return
  }
  const mEl = document.getElementById('home-vegref-meter')
  if (!mEl || homeVegrefDisplayedMeter == null) {
    cancelHomeVegrefMeterLiveExtrap()
    return
  }
  const nowWall = Date.now()
  const staleMs =
    homeVegrefLastRawGpsWallMs > 0 ? nowWall - homeVegrefLastRawGpsWallMs : 0
  const staleAnyMs =
    homeVegrefAnyGpsWallMs > 0 ? nowWall - homeVegrefAnyGpsWallMs : 999999
  /* Effektivt stale: enten ingen fersk callback på X ms, ELLER siste GPS har
     så dårlig accuracy at den ikke gir brukbar vegref-lookup (tunnel:
     iOS dead-reckon med 80–300 m acc). I begge tilfeller skal coasten ta
     over slik at meteren fortsetter å telle jevnt. */
  const accStale =
    typeof lastVegrefGpsAccuracyM === 'number' &&
    Number.isFinite(lastVegrefGpsAccuracyM) &&
    lastVegrefGpsAccuracyM > HOME_VEGREF_COAST_ACC_FLOOR_M
  const gpsStale = staleMs > HOME_VEGREF_GPS_STALE_MS || accStale
  if (
    gpsStale &&
    homeVegrefLastStableRes &&
    homeVegrefCoastSpeedMps >= HOME_VEGREF_COAST_MIN_SPEED_MPS
  ) {
    if (!homeVegrefCoastStartedAt) homeVegrefCoastStartedAt = nowWall
  } else {
    homeVegrefCoastStartedAt = 0
  }
  const coastAge =
    homeVegrefCoastStartedAt > 0 ? nowWall - homeVegrefCoastStartedAt : 0
  const coastOk =
    gpsStale &&
    homeVegrefCoastStartedAt > 0 &&
    coastAge <= HOME_VEGREF_COAST_MAX_MS &&
    homeVegrefLastStableRes &&
    homeVegrefCoastSpeedMps >= HOME_VEGREF_COAST_MIN_SPEED_MPS

  let spd = vegrefGetLastSpeed()
  /* GPS-øyeblikksfart oppdateres hver watch-callback; pipelinens lastSpeed
     kan ligge flere hundre ms bak — bruk max for jevn «telle telle» i UI. */
  const gpsInst =
    homeVegrefGpsInstSpeedMps > 0.12 &&
    homeVegrefAnyGpsWallMs > 0 &&
    staleAnyMs < 3500
      ? homeVegrefGpsInstSpeedMps
      : 0
  if (gpsInst > 0) {
    spd = Math.max(spd, gpsInst * 0.96)
  }
  if (coastOk && spd < 0.8) {
    spd = homeVegrefCoastSpeedMps
  }
  if (!coastOk && lastVegrefGpsAccuracyM > 55 && spd > 22) {
    spd = 22
  }
  if (
    homeVegrefHoldNullDashExtrap &&
    spd < 0.85 &&
    homeVegrefCoastSpeedMps >= HOME_VEGREF_COAST_MIN_SPEED_MPS * 0.92
  ) {
    spd = Math.max(spd, homeVegrefCoastSpeedMps * 0.94)
  }
  /* iOS/Geolocation gir ofte én eller flere «0 m/s»-ticks mellom fiks under
     kjøring; da stoppet vi RAF her og meteren frøs på siste heltall til neste
     NVDB. Bruk nylig coast-hastighet når GPS fortsatt er fersk. */
  if (
    spd < 0.85 &&
    homeVegrefCoastSpeedMps >= 2.5 &&
    homeVegrefAnyGpsWallMs > 0 &&
    staleAnyMs < 5200
  ) {
    spd = Math.max(spd, homeVegrefCoastSpeedMps * 0.87)
  }
  const spdRun = Math.max(spd, gpsInst * 0.88)
  /* Ikke stopp ekstrap kun fordi pipelinen rapporterer <0,55 m/s — da fryser
     telleren ved saktefart og rygging. Stopp når posisjonen er stillestående,
     eller når både pipeline og GPS-inst er ekstremt lave (parkert / ingen bevegelse). */
  const instQuiet = homeVegrefGpsInstSpeedMps < 0.14
  const resumeBoost = Date.now() < homeVegrefMeterResumeUntil
  /* Viktig: ikke OR-inn vegrefIsStationary() her. Den bruker lastSpeed fra
   * pipelinen (ofte 0 på iOS mellom fiks) + segmentConfidence — uavhengig av
   * spdRun som allerede er hevet av coast/gpsInst over. Da stoppet RAF selv
   * ved tydelig kjøring → meter «henger» til neste treff. Stopp bare når
   * både effektiv fart og GPS-inst er ekstremt lave. */
  const authM = homeVegrefPrevAuthMeter
  const needDownCatch =
    homeVegrefMeterExtrapDir < 0 &&
    typeof authM === 'number' &&
    Number.isFinite(authM) &&
    homeVegrefDisplayedMeter != null &&
    homeVegrefDisplayedMeter > authM + 1
  if (
    !resumeBoost &&
    spdRun < 0.11 &&
    instQuiet &&
    homeVegrefGpsInstSpeedMps < 0.2 &&
    !needDownCatch
  ) {
    homeVegrefMeterLiveRaf = null
    scheduleHomeVegrefMeterLiveRecheck()
    return
  }
  spd = spdRun
  const now = performance.now()
  const dtRaw = homeVegrefMeterLiveLastTs
    ? (now - homeVegrefMeterLiveLastTs) / 1000
    : 0
  homeVegrefFrameTicks += 1
  if (dtRaw > 0.09) homeVegrefFrameSkips += 1
  // #region agent log
  __tickDtRaw = dtRaw
  // #endregion
  homeVegrefMeterLiveLastTs = now
  /* Lang rAF-pause: ikke bruk hele dt (hopper for langt), men ~0,36 s per
   * frame slik at telleren starter igjen uten flere «døde» frames. */
  const dt =
    dtRaw <= 0 ? 0 : dtRaw > 2.5 ? Math.min(dtRaw, 0.36) : dtRaw
  if (dtRaw > 2.5) {
    // #region agent log
    scanixDebugFreezeLog('H2', 'main.js:tickHomeVegrefMeterLive', 'large_dt_capped', {
      dtRaw: Math.round(dtRaw * 1000) / 1000,
      dtUsed: Math.round(dt * 1000) / 1000,
      frameMs: Math.round((performance.now() - __tickT0) * 10) / 10,
    })
    // #endregion
  }
  if (dt > 0) {
    /* Signert ekstrap langs strekningen: +1 ved økende NVDB-meter, −1 ved
       synkende (typisk kjøring «tilbake» langs samme fragment). Alltid +1
       etter hard segmentbytte og etter soft grense med mInt < vist (fragment
       med motsatt nummerering — da snapper vi og fortsetter forover). */
    const extrapDirEff = homeVegrefMeterExtrapDir < 0 ? -1 : 1
    const delta = spd * dt
    const v = Math.round(homeVegrefDisplayedMeter + extrapDirEff * delta)
    homeVegrefDisplayedMeter = v
    // #region agent log
    if (
      extrapDirEff < 0 &&
      view === 'home' &&
      Date.now() - __dbgMeterTickLogMs > 400
    ) {
      __dbgMeterTickLogMs = Date.now()
      postScanixDebugPayload({
        sessionId: 'ff8b7b',
        hypothesisId: 'H3',
        location: 'main.js:tickHomeVegrefMeterLive',
        message: 'meter_extrap_minus_one_tick',
        data: {
          v,
          spd: Math.round(spd * 100) / 100,
          extrapDir: homeVegrefMeterExtrapDir,
        },
        timestamp: Date.now(),
      })
    }
    // #endregion
    const wall = Date.now()
    const domMs =
      spd > 22
        ? 26
        : spd > 15
          ? 34
          : spd > 10
            ? 52
            : spd > 2.8
              ? 62
              : spd >= 0.85
                ? 72
                : 118
    if (
      homeVegrefMeterLiveLastDomInt === null ||
      wall - homeVegrefMeterLiveLastDomWallMs >= domMs
    ) {
      mEl.textContent = formatHomeVegrefMeterTextForHomeUi(v)
      noteHomeVegrefDisplayJitter(v)
      homeVegrefMeterLiveLastDomWallMs = wall
      homeVegrefMeterLiveLastDomInt = v
    }
  }
  // #region agent log
  {
    const __z = performance.now() - __tickT0
    if (__z > 34 || __tickDtRaw > 1.65) {
      scanixDebugFreezeLog('H2', 'main.js:tickHomeVegrefMeterLive', 'slow_or_gap_tick', {
        frameMs: Math.round(__z * 10) / 10,
        dtRaw: Math.round(__tickDtRaw * 1000) / 1000,
        spd: Math.round(spd * 100) / 100,
        stationaryBypass: Date.now() < homeVegrefMeterResumeUntil,
      })
    }
  }
  // #endregion
  homeVegrefMeterLiveRaf = requestAnimationFrame(tickHomeVegrefMeterLive)
}

function startHomeVegrefMeterLiveExtrap() {
  if (view !== 'home' || homeVegrefDisplayedMeter == null) return
  cancelHomeVegrefMeterLiveExtrap()
  homeVegrefMeterLiveLastTs = performance.now()
  homeVegrefMeterLiveRaf = requestAnimationFrame(tickHomeVegrefMeterLive)
}

let homeVegrefMeterTweenDur = 260
function tickHomeVegrefMeterTween(now) {
  const mEl = document.getElementById('home-vegref-meter')
  if (!mEl || view !== 'home') {
    homeVegrefMeterAnim = null
    return
  }
  const u = Math.min(1, (now - homeVegrefMeterT0) / homeVegrefMeterTweenDur)
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
    startHomeVegrefMeterLiveExtrap()
  }
}

/**
 * @param {number} targetInt
 * @param {number} [overrideDurMs] Valgfri fast tween-varighet (ms). Brukes ved
 * segmentovergang med stor meter-delta slik at vi får en rask synlig animasjon
 * i stedet for øyeblikkelig hopp.
 */
function startHomeVegrefMeterTweenTo(targetInt, overrideDurMs) {
  const mEl = document.getElementById('home-vegref-meter')
  if (!mEl) return
  cancelHomeVegrefMeterLiveExtrap()
  resetHomeVegrefMeterUiHold()
  const from =
    homeVegrefDisplayedMeter != null ? homeVegrefDisplayedMeter : targetInt
  if (from === targetInt) {
    mEl.textContent = formatHomeVegrefMeterText(targetInt)
    homeVegrefDisplayedMeter = targetInt
    cancelHomeVegrefMeterTween()
    startHomeVegrefMeterLiveExtrap()
    return
  }
  logVegrefMetric({
    type: 'home-meter-tween',
    from,
    to: targetInt,
    accuracyM: lastVegrefGpsAccuracyM,
  })
  cancelHomeVegrefMeterTween()
  homeVegrefMeterFrom = from
  homeVegrefMeterTo = targetInt
  homeVegrefMeterT0 = performance.now()
  homeVegrefMeterTweenDur =
    typeof overrideDurMs === 'number' &&
    Number.isFinite(overrideDurMs) &&
    overrideDurMs > 0
      ? overrideDurMs
      : homeVegrefMeterTweenMs()
  homeVegrefMeterAnim = requestAnimationFrame(tickHomeVegrefMeterTween)
}

function stopHomeVegrefTracking() {
  if (homeVegrefWatchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(homeVegrefWatchId)
    homeVegrefWatchId = null
  }
  resetHomeWeather()
  cancelHomeVegrefMeterTween()
  cancelHomeVegrefMeterLiveExtrap()
  /* Don't reset vegref pipeline or UI state — preserve last known position so
     returning to home doesn't trigger a cold-start freeze. */
}

/**
 * Felles GPS-inndata til NVDB-kø (forside + KMT): oppdaterer også lastLiveCoords for bilder.
 * @param {number} lat
 * @param {number} lng
 * @param {number} [accuracy]
 * @param {boolean} [forceImmediate]
 * @param {number} [timestamp] GPS-fix tid (GeolocationPosition.timestamp)
 * @param {number | null} [userHeadingDeg] retning i grader [0,360), fra coords.heading
 */
function feedVegrefFromGps(
  lat,
  lng,
  accuracy,
  forceImmediate,
  timestamp,
  userHeadingDeg,
) {
  if (lat == null || lng == null) return
  noteHomeVegrefAnyGpsFix(lat, lng, timestamp)
  const acc = Math.max(
    typeof accuracy === 'number' && !Number.isNaN(accuracy) ? accuracy : 20,
    8,
  )
  lastVegrefGpsAccuracyM = acc
  lastLiveCoords = { lat, lng, accuracy: acc, ts: Date.now() }
  vegrefNotifyGps(lat, lng, {
    forceImmediate: !!forceImmediate,
    accuracyM: acc,
    timestamp,
    userHeadingDeg:
      typeof userHeadingDeg === 'number' && !Number.isNaN(userHeadingDeg)
        ? userHeadingDeg
        : null,
  })
  const headingForPrefetch =
    typeof userHeadingDeg === 'number' && !Number.isNaN(userHeadingDeg)
      ? userHeadingDeg
      : null
  prefetchNotifyGps(lat, lng, headingForPrefetch, vegrefGetLastSpeed())
  const s = vegrefGetLastSpeed()
  const gInst = homeVegrefGpsInstSpeedMps
  if (s >= HOME_VEGREF_COAST_MIN_SPEED_MPS) {
    homeVegrefCoastSpeedMps = s
  } else if (gInst >= HOME_VEGREF_COAST_MIN_SPEED_MPS * 1.05) {
    homeVegrefCoastSpeedMps = Math.max(homeVegrefCoastSpeedMps, gInst * 0.97)
  } else if (s < 0.42) {
    /* Ikke nullstill coast på én «0 m/s»-tick fra iOS under kjøring — da
       stopper hold_null-ekstrap for tidlig. */
    homeVegrefCoastSpeedMps = Math.max(0, homeVegrefCoastSpeedMps * 0.86 - 0.08)
  }
}

function scheduleHomeVegrefLookup(
  lat,
  lng,
  forceImmediate,
  accuracy,
  timestamp,
  userHeadingDeg,
) {
  if (
    (view !== 'home' &&
      view !== 'menuExcelExport' &&
      view !== 'followUpRouteEdit' &&
      view !== 'menuFollowUpRoute') ||
    lat == null ||
    lng == null
  )
    return
  feedVegrefFromGps(
    lat,
    lng,
    accuracy,
    forceImmediate,
    timestamp,
    userHeadingDeg,
  )
}

function scheduleKmtVegrefLookup(
  lat,
  lng,
  forceImmediate,
  accuracy,
  timestamp,
  userHeadingDeg,
) {
  if (!kmtDialogOpen || lat == null || lng == null) return
  feedVegrefFromGps(
    lat,
    lng,
    accuracy,
    forceImmediate,
    timestamp,
    userHeadingDeg,
  )
}

function shouldPersistHomeVegrefRes(res) {
  if (!res || typeof res !== 'object') return false
  const line = String(res.roadLine || '').trim()
  if (/^Posisjon\s+[\d.]+°N/i.test(line)) return false
  return true
}

function maybePersistHomeVegref(res) {
  if (!res || view !== 'home' || !homeVegrefHasDisplayedResult || !lastLiveCoords) {
    return
  }
  if (!shouldPersistHomeVegrefRes(res)) return
  try {
    localStorage.setItem(
      VEGREF_PERSIST_KEY,
      JSON.stringify({
        lat: lastLiveCoords.lat,
        lng: lastLiveCoords.lng,
        res,
        savedAt: Date.now(),
      }),
    )
  } catch {
    /* quota / privat modus */
  }
}

function syncHomeVegrefExcelFromRes(res) {
  const mir = getVegrefHomeMirrorStrings(res)
  if (!mir) return
  const longDisplay = String(
    /** @type {{ roadLineDisplay?: unknown }} */ (res).roadLineDisplay || '',
  ).trim()
  homeVegrefExcelVegvei = longDisplay || mir.primary
  homeVegrefExcelVegnr =
    mir.typeLine ||
    String(
      /** @type {{ roadLineShort?: unknown, roadLine?: unknown }} */ (res)
        .roadLineShort ||
        res.roadLine ||
        '',
    ).trim() ||
    ''
}

function getHomeVegrefExcelSnapshot() {
  const s =
    homeVegrefCompactS === '–' || homeVegrefCompactS == null
      ? ''
      : String(homeVegrefCompactS)
  const d =
    homeVegrefCompactD === '–' || homeVegrefCompactD == null
      ? ''
      : String(homeVegrefCompactD)
  let meter = ''
  if (
    homeVegrefDisplayedMeter != null &&
    Number.isFinite(Number(homeVegrefDisplayedMeter))
  ) {
    meter = String(Math.round(homeVegrefDisplayedMeter))
  }
  return {
    vegvei: homeVegrefExcelVegvei || '',
    vegnr: homeVegrefExcelVegnr || '',
    s,
    d,
    meter,
  }
}

function setHomeVegrefPlaceholder(msg) {
  vegrefDebugTrace('home_placeholder', { msg: String(msg).slice(0, 200) })
  cancelHomeVegrefMeterTween()
  homeVegrefDisplayedMeter = null
  homeVegrefMeterNvdbId = null
  homeVegrefLastMeterStableRes = null
  const prim = document.getElementById('home-vegref-primary')
  const typeEl = document.getElementById('home-vegref-type')
  const comp = document.getElementById('home-vegref-compact')
  const host = document.getElementById('home-vegref')
  if (host) host.classList.remove('home-vegref--uncertain')
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

function setHomeVegrefUncertainUi(active, label) {
  const resolvedActive = !!active
  const resolvedLabel = resolvedActive ? label || 'Usikker posisjon' : ''
  if (!resolvedActive && !homeVegrefUiUncertain) return
  if (
    resolvedActive &&
    homeVegrefUiUncertain &&
    resolvedLabel === homeVegrefUncertainLastLabel
  ) {
    return
  }

  const host = document.getElementById('home-vegref')
  const typeEl = document.getElementById('home-vegref-type')
  if (host) host.classList.toggle('home-vegref--uncertain', resolvedActive)
  if (typeEl) {
    if (resolvedActive) {
      typeEl.textContent = resolvedLabel
      typeEl.hidden = false
    } else if (homeVegrefUiUncertain) {
      typeEl.textContent = ''
      typeEl.hidden = true
    }
  }
  homeVegrefUiUncertain = resolvedActive
  homeVegrefUncertainLastLabel = resolvedActive ? resolvedLabel : ''
}

function showHomeVegrefUncertainFallback(reason, accuracyM) {
  const recentStable =
    homeVegrefLastStableRes &&
    Date.now() - homeVegrefLastStableAt <= HOME_VEGREF_UNCERTAIN_HOLD_MS
      ? homeVegrefLastStableRes
      : null
  if (recentStable) {
    applyHomeVegrefResult(recentStable)
    setHomeVegrefUncertainUi(
      true,
      accuracyM != null && Number.isFinite(accuracyM)
        ? `Usikker posisjon (ca. ±${Math.round(accuracyM)} m)`
        : 'Usikker posisjon',
    )
    logVegrefMetric({
      type: 'home-uncertain-hold',
      reason,
      accuracyM:
        typeof accuracyM === 'number' && Number.isFinite(accuracyM)
          ? Math.round(accuracyM)
          : null,
    })
    return true
  }
  return false
}

function applyHomeVegrefResult(res) {
  if (!res) return
  // #region agent log
  const __applyT0 = performance.now()
  // #endregion

  /* [Klasse-hysterese] Demp kortvarige demote-flips (f.eks. FV→PV som bare
     varer 1 tick). Hvis forrige stabile vegklasse var EV/RV/FV og ny er
     lavere (KV/PV) innenfor ~1,3 s, ignorer tikken — neste NVDB-oppslag bør
     gjenopprette hovedlinjen. Slik unngås PV-flicker langs EV/RV/FV. */
  try {
    const newRank = homeVegrefRoadClassRank(res)
    const prevSegKeyTmp = homeVegrefSegKey
    const newSegKeyTmp = homeVegrefSegmentIdentityKey(res)
    const segChangedTmp = newSegKeyTmp !== prevSegKeyTmp
    const softTmp =
      segChangedTmp && homeVegrefKfNeighborSegKeys(prevSegKeyTmp, newSegKeyTmp)
    const dt = Date.now() - homeVegrefLastHighClassAt
    if (
      segChangedTmp &&
      !softTmp &&
      newRank >= 0 &&
      homeVegrefLastHighClassRank >= 2 &&
      newRank < homeVegrefLastHighClassRank &&
      dt >= 0 &&
      dt < 1300
    ) {
      vegrefDebugTrace('class_guard', {
        prevRank: homeVegrefLastHighClassRank,
        newRank,
        dtMs: dt,
        rejectedNid:
          res && res.nvdbId != null ? String(res.nvdbId) : null,
        rejectedRoad: String(
          /** @type {{ roadLineShort?: unknown }} */ (res).roadLineShort ||
            /** @type {{ roadLine?: unknown }} */ (res).roadLine ||
            '',
        ),
      })
      return
    }
  } catch {}

  /* [KD kryss-hold] Hvis NVDB svarer med et KD-segment (kryss/rundkjøring)
     og vi har et nylig stabilt hovedspor med samme S/D, bytt res til ref
     slik at meter og veilinje beholdes mens vi passerer. Nvdb kan returnere
     m:"–" i KD-fragmenter selv med lav distToRoadM — da fryser meteret
     permanent uten dette holdet. */
  const _crossRawNid = res && res.nvdbId != null ? res.nvdbId : null
  if (homeVegrefIsCrossingNvdbId(_crossRawNid)) {
    const ref = homeVegrefLastMeterStableRes
    const distToRoadForCross =
      typeof /** @type {any} */ (res).distToRoadM === 'number' &&
      Number.isFinite(/** @type {any} */ (res).distToRoadM)
        ? /** @type {any} */ (res).distToRoadM
        : null
    const sdMatch =
      ref &&
      String(/** @type {any} */ (ref).s ?? '') === String(res.s ?? '') &&
      String(/** @type {any} */ (ref).d ?? '') === String(res.d ?? '')
    if (ref && sdMatch && (distToRoadForCross == null || distToRoadForCross <= 45)) {
      vegrefDebugTrace('crossing_hold', {
        nid: String(_crossRawNid),
        refNid:
          /** @type {any} */ (ref).nvdbId != null
            ? String(/** @type {any} */ (ref).nvdbId)
            : null,
        distToRoadM:
          distToRoadForCross != null
            ? Math.round(distToRoadForCross * 10) / 10
            : null,
      })
      homeVegrefCrossingActive = true
      res = /** @type {any} */ ({
        .../** @type {any} */ (ref),
        _vegrefMeta: {
          .../** @type {any} */ (ref)._vegrefMeta || {},
          crossing: true,
          crossingNvdbId: String(_crossRawNid),
        },
      })
    } else {
      homeVegrefCrossingActive = false
    }
  } else {
    homeVegrefCrossingActive = false
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
  const hasSdPair =
    res.s != null &&
    res.d != null &&
    String(res.s).trim() !== '' &&
    String(res.d).trim() !== ''
  if (!display && !officialShort && !hasSdPair) return

  let longDisplayEff = longDisplay
  let longOfficialEff = longOfficial
  let displayEff = display
  let officialShortEff = officialShort
  const stab = homeVegrefLastStableRes
  const stabSrc = stab
    ? String(
        /** @type {{ _vegrefMeta?: { source?: string } }} */ (stab)._vegrefMeta
          ?.source || '',
      )
    : ''
  if (
    stab &&
    stabSrc !== 'coord-fallback' &&
    homeVegrefStableMatchesForNameLatch(
      /** @type {{ s?: unknown, d?: unknown, nvdbId?: unknown }} */ (stab),
      res,
    ) &&
    !longDisplay
  ) {
    const ld = String(
      /** @type {{ roadLineDisplay?: unknown }} */ (stab).roadLineDisplay || '',
    ).trim()
    if (ld) {
      longDisplayEff = ld
      longOfficialEff =
        String(/** @type {{ roadLine?: unknown }} */ (stab).roadLine || '').trim() ||
        longOfficialEff
      displayEff =
        String(
          /** @type {{ roadLineDisplayShort?: unknown, roadLineShort?: unknown, roadLineDisplay?: unknown, roadLine?: unknown }} */ (
            stab
          ).roadLineDisplayShort ||
            stab.roadLineShort ||
            stab.roadLineDisplay ||
            stab.roadLine ||
            '',
        ).trim() || displayEff
      officialShortEff =
        String(/** @type {{ roadLineShort?: unknown }} */ (stab).roadLineShort || '')
          .trim() ||
        String(/** @type {{ roadLine?: unknown }} */ (stab).roadLine || '').trim() ||
        officialShortEff
    }
  }

  if (!homeVegrefStartupFirstRenderAt) {
    homeVegrefStartupFirstRenderAt = Date.now()
    homeVegrefStartupFirstRenderSource = String(
      /** @type {{ _vegrefMeta?: { source?: string } }} */ (res)._vegrefMeta
        ?.source || 'unknown',
    )
    logHomeVegrefStartupMetric('first-render', {
      source: homeVegrefStartupFirstRenderSource,
      roadLine: displayEff || officialShortEff || '',
    })
  }

  syncHomeVegrefExcelFromRes(res)

  const segKeyId = homeVegrefSegmentIdentityKey(res)
  const prevHomeSegKey = homeVegrefSegKey
  const segChanged = segKeyId !== homeVegrefSegKey
  const softSegChange =
    segChanged && homeVegrefKfNeighborSegKeys(prevHomeSegKey, segKeyId)
  if (segChanged) {
    homeVegrefSwitchPendingAt = Date.now()
    homeVegrefSwitchPendingFrom = prevHomeSegKey || ''
    homeVegrefSwitchPendingTo = segKeyId || ''
  }
  if (segChanged && !softSegChange) {
    vegrefClearSegmentLock()
    cancelHomeVegrefMeterTween()
    cancelHomeVegrefMeterLiveExtrap()
    resetHomeVegrefMeterUiHold()
    homeVegrefMeterExtrapDir = 1
    homeVegrefPrevAuthMeter = null
    homeVegrefStickyStreetLine = ''
    homeVegrefStickySegKey = ''
    homeVegrefLastMeterStableRes = null
    homeVegrefLastValidDistToRoadM = null
  } else if (segChanged && softSegChange) {
    /* Nabokf på samme S/D: ikke nullstill meter/tween — unngår brudd ved fragmentgrense. */
  }

  const segBreakForMeter = segChanged && !softSegChange

  const mInt = parseKmtMeterInt(res.m)
  const mTarget =
    mInt != null
      ? guardrailHomeVegrefTargetMeter(mInt, homeVegrefDisplayedMeter, segBreakForMeter)
      : null
  const nid = res.nvdbId != null ? res.nvdbId : null

  if (view !== 'home') {
    homeVegrefHasDisplayedResult = true
    homeVegrefCompactS = res.s
    homeVegrefCompactD = res.d
    if (mTarget != null) {
      homeVegrefMeterNullSinceMs = 0
      homeVegrefDisplayedMeter = mTarget
      if (nid != null) homeVegrefMeterNvdbId = nid
    }
    const earlyMeta = String(
      /** @type {{ _vegrefMeta?: { source?: string } }} */ (res)._vegrefMeta
        ?.source || '',
    )
    if (mInt != null && earlyMeta !== 'coord-fallback') {
      homeVegrefLastMeterStableRes = res
    }
    homeVegrefSegKey = segKeyId
    if (view === 'menuExcelExport') refreshExcelSheetLiveVegref()
    // #region agent log
    {
      const __d = performance.now() - __applyT0
      if (__d > 55) {
        scanixDebugFreezeLog('H1', 'main.js:applyHomeVegrefResult', 'slow_apply_branch', {
          ms: Math.round(__d * 10) / 10,
          branch: 'not_home',
          view,
        })
      }
    }
    // #endregion
    return
  }

  const prim = document.getElementById('home-vegref-primary')
  const typeEl = document.getElementById('home-vegref-type')
  const comp = document.getElementById('home-vegref-compact')
  if (!prim) {
    // #region agent log
    {
      const __d = performance.now() - __applyT0
      if (__d > 55) {
        scanixDebugFreezeLog('H1', 'main.js:applyHomeVegrefResult', 'slow_apply_branch', {
          ms: Math.round(__d * 10) / 10,
          branch: 'no_prim',
          view,
        })
      }
    }
    // #endregion
    return
  }

  homeVegrefHasDisplayedResult = true
  if (mInt != null) {
    homeVegrefMeterNullSinceMs = 0
    homeVegrefHoldNullDashExtrap = false
    setHomeVegrefUncertainUi(false, '')
    if (homeVegrefSwitchPendingAt > 0 && homeVegrefSwitchPendingTo === segKeyId) {
      vegrefDebugTrace('switch_latency', {
        latencyMs: Math.max(0, Date.now() - homeVegrefSwitchPendingAt),
        fromSeg: homeVegrefSwitchPendingFrom || null,
        toSeg: homeVegrefSwitchPendingTo || null,
        softSegChange,
      })
      homeVegrefSwitchPendingAt = 0
      homeVegrefSwitchPendingFrom = ''
      homeVegrefSwitchPendingTo = ''
    }
  }
  prim.textContent = displayEff || officialShortEff
  if (typeEl) {
    const isStreet =
      longDisplayEff &&
      longOfficialEff &&
      longDisplayEff !== longOfficialEff &&
      officialShortEff
    if (isStreet) {
      typeEl.textContent = officialShortEff
      typeEl.hidden = false
      homeVegrefStickyStreetLine = officialShortEff
      homeVegrefStickySegKey = segKeyId
    } else if (
      homeVegrefStickyStreetLine &&
      homeVegrefStickySegKey === segKeyId &&
      !segChanged
    ) {
      typeEl.textContent = homeVegrefStickyStreetLine
      typeEl.hidden = false
    } else {
      typeEl.textContent = ''
      typeEl.hidden = true
    }
  }
  if (comp) {
    homeVegrefCompactS = res.s
    homeVegrefCompactD = res.d
    homeVegrefSegKey = segKeyId

    if (mTarget == null) {
      cancelHomeVegrefMeterTween()
      /* Fix H3: ikke skru av live-ekstrapolering proaktivt — vi må ticke meter
         videre basert på fart når NVDB kortvarig ikke har meter (drift 25–60 m
         fra vei). Vi kansellerer bare i else-grenen der holdet ikke lykkes. */
      /* Midlertidig tom meter: hold ved samme fragment eller nabokf / samme veilinje. */
      const nvdbAligned = homeVegrefNullHoldNvdbAligned(res, nid)
      /* H3: dynamiske grenser — høy fart tåler større kortvarig avvik (projeksjon ved segmentgrense). */
      const resDist =
        typeof /** @type {any} */ (res).distToRoadM === 'number' &&
        Number.isFinite(/** @type {any} */ (res).distToRoadM)
          ? /** @type {any} */ (res).distToRoadM
          : null
      const HOLD_NULL_MAX_DIST_M = homeVegrefHoldNullMaxDistM()
      const HOLD_NULL_MAX_DURATION_MS = homeVegrefHoldNullMaxDurationMs()
      const holdTooFar = resDist != null && resDist > HOLD_NULL_MAX_DIST_M
      const holdTimedOut =
        homeVegrefMeterNullSinceMs > 0 &&
        Date.now() - homeVegrefMeterNullSinceMs >= HOLD_NULL_MAX_DURATION_MS
      /* Tidligere: ren tids-timeout kuttet hold selv ved lav–moderat dist
         (f.eks. 31 m), og vi nullstilte displayed → «meter borte» midt i
         kjøring. Timeout skal bare «hardne» når vi også er nær dist-taket. */
      const holdTimedOutHard =
        holdTimedOut &&
        (resDist == null || resDist > HOLD_NULL_MAX_DIST_M * 0.88)
      const holdNullMeter =
        homeVegrefDisplayedMeter != null &&
        nvdbAligned &&
        !holdTooFar &&
        !holdTimedOutHard &&
        (!segBreakForMeter || (nid != null && homeVegrefMeterNvdbId != null))
      const softHoldRecent =
        homeVegrefDisplayedMeter != null &&
        !holdTooFar &&
        !holdTimedOutHard &&
        !segBreakForMeter &&
        Date.now() - homeVegrefLastMeterUiCommitAt < 9000
      const holdNullMeterEffective = holdNullMeter || softHoldRecent
      // #region agent log H3
      vegrefDebugTrace('hold_null', {
        hyp: 'H3',
        holdNullMeter: holdNullMeterEffective,
        holdNullMeterStrict: holdNullMeter,
        softHoldRecent,
        nvdbAligned,
        segChanged,
        holdTooFar,
        holdTimedOut,
        holdTimedOutHard,
        displayed: homeVegrefDisplayedMeter,
        nid: nid != null ? String(nid) : null,
        prevNid: homeVegrefMeterNvdbId != null ? String(homeVegrefMeterNvdbId) : null,
        resSource: String(
          /** @type {any} */ (res)._vegrefMeta?.source || '',
        ),
        resM: res.m != null ? String(res.m) : null,
        resDist: resDist != null ? Math.round(resDist * 10) / 10 : null,
        holdMaxDist: HOLD_NULL_MAX_DIST_M,
        holdMaxMs: HOLD_NULL_MAX_DURATION_MS,
        softSegChange,
      })
      // #endregion
      if (holdNullMeterEffective) {
        homeVegrefHoldNullDashExtrap = true
        setHomeVegrefCompactDom(res.s, res.d, homeVegrefDisplayedMeter)
        /* Fix H3: hold meter + ekstrapoler videre basert på fart, slik at UI
           ikke fryser flere sekunder når bruker driver kortvarig 25–60 m fra
           vei og NVDB returnerer segment uten meter. */
        startHomeVegrefMeterLiveExtrap()
        if (homeVegrefMeterNullSinceMs === 0) {
          homeVegrefMeterNullSinceMs = Date.now()
        }
        /* Ikke vis «Oppdaterer meter …» her: live-ekstrap oppdaterer tallene,
         * og to ulike strenger avhengig av fart ga konstant label-bytte + DOM. */
      } else {
        homeVegrefHoldNullDashExtrap = false
        cancelHomeVegrefMeterLiveExtrap()
        homeVegrefMeterNullSinceMs = 0
        homeVegrefDisplayedMeter = null
        homeVegrefMeterNvdbId = null
        resetHomeVegrefMeterUiHold()
        setHomeVegrefCompactDom(res.s, res.d, res.m)
        setHomeVegrefUncertainUi(false, '')
      }
    } else if (homeVegrefDisplayedMeter == null) {
      cancelHomeVegrefMeterTween()
      resetHomeVegrefMeterUiHold()
      homeVegrefDisplayedMeter = mTarget
      homeVegrefLastMeterUiCommitAt = Date.now()
      setHomeVegrefCompactDom(res.s, res.d, mTarget)
      homeVegrefSetExtrapDirFromNvdbVsDisplayed(
        mTarget,
        homeVegrefDisplayedMeter,
      )
      homeVegrefPrevAuthMeter = mTarget
      startHomeVegrefMeterLiveExtrap()
    } else {
      let dbgMeterBranch = 'pending'
      const delta = Math.abs(mTarget - homeVegrefDisplayedMeter)
      const snap = homeVegrefMeterSnapThreshold()
      const _deadband = homeVegrefMeterDeadbandM()
      const _skipped =
        delta < snap &&
        shouldSkipVegrefMeterDisplayUpdate(
          mTarget,
          homeVegrefDisplayedMeter,
          segBreakForMeter,
          homeVegrefMeterSnapThreshold,
          homeVegrefLastMeterUiCommitAt,
        )
      // #region agent log H1
      vegrefDebugTrace('skip_meter', {
        hyp: 'H1',
        mInt,
        displayed: homeVegrefDisplayedMeter,
        delta,
        deadband: Math.round(_deadband * 10) / 10,
        snap,
        segChanged,
        segBreakForMeter,
        skipped: _skipped,
        willSnap: delta >= snap,
        sinceCommitMs: homeVegrefLastMeterUiCommitAt
          ? Date.now() - homeVegrefLastMeterUiCommitAt
          : -1,
      })
      // #endregion
      if (delta >= snap) {
        dbgMeterBranch = 'snap_or_large_delta'
        /* Snap-grensen er overskredet. Når det er en segmentovergang
           (spesielt soft/kf-nabo på samme S/D) kan meter-delta være stor
           fordi NVDB-fragmentnummereringen er ikke-monoton over kjørt
           strekning. Øyeblikkelig hopp oppleves som «fryser og hopper».
           Vi animerer i stedet med en kort tween (~145–185 ms) slik at
           overgangen blir visuelt rulling i stedet for teleport. */
        if (segChanged) {
          // #region agent log seg-snap
          vegrefDebugTrace('seg_snap_tween', {
            fromDisplayed: homeVegrefDisplayedMeter,
            toMeter: mTarget,
            delta,
            softSegChange,
            prevSegKey: prevHomeSegKey,
            newSegKey: segKeyId,
          })
          // #endregion
          homeVegrefLastMeterUiCommitAt = Date.now()
          setHomeVegrefCompactDom(res.s, res.d, homeVegrefDisplayedMeter)
          homeVegrefSetExtrapDirFromNvdbVsDisplayed(
            mTarget,
            homeVegrefDisplayedMeter,
          )
          homeVegrefPrevAuthMeter = mTarget
          /* Hvis det nye segmentet har lavere meter enn det vi viser
             (NVDB-fragment-grense med motsatt fra→til-retning), snap
             stille i stedet for å animere nedover. Brukeren skal aldri
             se at telleren teller bakover. Live-extrap fortsetter
             forover fra det nye startpunktet. */
          if (mTarget < homeVegrefDisplayedMeter) {
            cancelHomeVegrefMeterTween()
            homeVegrefDisplayedMeter = mTarget
            setHomeVegrefCompactDom(res.s, res.d, mTarget)
            /* Fragment med lavere meter enn vist: fortsett ekstrap forover. */
            homeVegrefMeterExtrapDir = 1
            // #region agent log
            postScanixDebugPayload({
              sessionId: 'ff8b7b',
              hypothesisId: 'H4',
              location: 'main.js:applyHomeVegrefResult:seg_snap_force_fwd',
              message: 'seg_changed_mInt_lt_displayed_forces_extrapDir_plus_1',
              data: {
                mTarget,
                displayed: homeVegrefDisplayedMeter,
                softSegChange,
                segKeyId,
              },
              timestamp: Date.now(),
            })
            // #endregion
            startHomeVegrefMeterLiveExtrap()
          } else {
            /* Kort fast varighet: synlig som animasjon, men kort nok til god respons. */
            const segTweenMs = softSegChange ? 145 : 185
            startHomeVegrefMeterTweenTo(mTarget, segTweenMs)
          }
        } else {
          /* Stor meter-delta uten segmentbytte: typisk live-extrap som har løpt
             foran trege/uregelmessige NVDB-treff (ikke «treg GPS» alene).
             Tidligere: øyeblikkelig `displayed = mInt` → tydelig hopp. Kort
             tween gir samme endelige verdi uten visuell teleport. */
          cancelHomeVegrefMeterTween()
          homeVegrefLastMeterUiCommitAt = Date.now()
          setHomeVegrefCompactDom(res.s, res.d, homeVegrefDisplayedMeter)
          homeVegrefSetExtrapDirFromNvdbVsDisplayed(
            mTarget,
            homeVegrefDisplayedMeter,
          )
          homeVegrefPrevAuthMeter = mTarget
          const largeTweenMs =
            delta > 900 ? 265 : delta > 550 ? 215 : delta > 380 ? 175 : 130
          startHomeVegrefMeterTweenTo(mTarget, largeTweenMs)
        }
      } else if (_skipped) {
        dbgMeterBranch = 'skipped'
        setHomeVegrefCompactDom(res.s, res.d, homeVegrefDisplayedMeter)
        homeVegrefSetExtrapDirFromNvdbVsDisplayed(
          mTarget,
          homeVegrefDisplayedMeter,
        )
        homeVegrefPrevAuthMeter = mTarget
        startHomeVegrefMeterLiveExtrap()
      } else {
        dbgMeterBranch = 'normal_commit'
        homeVegrefLastMeterUiCommitAt = Date.now()
        setHomeVegrefCompactDom(res.s, res.d, homeVegrefDisplayedMeter)
        homeVegrefSetExtrapDirFromNvdbVsDisplayed(
          mTarget,
          homeVegrefDisplayedMeter,
        )
        homeVegrefPrevAuthMeter = mTarget
        /* Ignorer nedover-korreksjoner på samme segment innenfor slack: live-
           extrap ligger ofte 20–50 m foran NVDB ved 10–18 m/s; fast 30 m var
           for trang og ga unødvendige tweens (flimmer). */
        const wouldGoDown =
          homeVegrefDisplayedMeter != null && mTarget < homeVegrefDisplayedMeter
        const downGap =
          wouldGoDown && homeVegrefDisplayedMeter != null
            ? homeVegrefDisplayedMeter - mInt
            : 0
        const smallDelta =
          wouldGoDown &&
          downGap < homeVegrefMeterSameSegDownIgnoreM() &&
          downGap <= homeVegrefMeterSameSegDownMaxExtrapOnlyGapM()
        if (smallDelta) {
          dbgMeterBranch = 'small_delta_extrap'
          /* extrapDir er allerede satt i blokken over når mInt ≠ forrige prevAuth. */
          startHomeVegrefMeterLiveExtrap()
        } else {
          let tweenTarget = mInt
          if (wouldGoDown && homeVegrefDisplayedMeter != null && downGap > 0) {
            const chunk = homeVegrefMeterBackwardTweenChunkM()
            if (downGap > chunk + 2) {
              tweenTarget = Math.max(mTarget, homeVegrefDisplayedMeter - chunk)
              dbgMeterBranch = 'tween_chunk_down'
            } else {
              dbgMeterBranch = 'tween_to_mInt'
            }
          } else {
            dbgMeterBranch = 'tween_to_mInt'
          }
          startHomeVegrefMeterTweenTo(tweenTarget)
        }
      }
      // #region agent log
      if (view === 'home' && typeof mTarget === 'number') {
        postScanixDebugPayload({
          sessionId: 'ff8b7b',
          hypothesisId: 'H2',
          location: 'main.js:applyHomeVegrefResult:meter_block',
          message: 'meter_apply_tick',
          data: {
            branch: dbgMeterBranch,
            mTarget,
            resM: res.m != null ? String(res.m) : null,
            displayed: homeVegrefDisplayedMeter,
            delta: Math.abs(mTarget - (homeVegrefDisplayedMeter ?? 0)),
            skipped: _skipped,
            extrapDir: homeVegrefMeterExtrapDir,
            prevAuth: homeVegrefPrevAuthMeter,
            segChanged,
            segBreakForMeter,
            nvdbId: nid != null ? String(nid) : null,
          },
          timestamp: Date.now(),
        })
      }
      // #endregion
    }
    if (mInt != null) {
      homeVegrefMeterNvdbId = nid != null ? nid : null
    }
    comp.hidden = false
  }
  const metaSource = String(
    /** @type {{ _vegrefMeta?: { source?: string } }} */ (res)._vegrefMeta
      ?.source || '',
  )
  if (metaSource !== 'coord-fallback') {
    homeVegrefLastStableRes = res
    homeVegrefLastStableAt = Date.now()
    /* [Klasse-hysterese] Oppdater sist aksepterte høy-klasse (EV/RV/FV)
       som anker for demote-guard i neste tikk. */
    const acceptedRank = homeVegrefRoadClassRank(res)
    if (acceptedRank >= 2) {
      homeVegrefLastHighClassRank = acceptedRank
      homeVegrefLastHighClassAt = Date.now()
    }
  }
  if (metaSource !== 'coord-fallback' && mInt != null) {
    homeVegrefLastMeterStableRes = res
    const dToR =
      typeof /** @type {any} */ (res).distToRoadM === 'number' &&
      Number.isFinite(/** @type {any} */ (res).distToRoadM)
        ? /** @type {any} */ (res).distToRoadM
        : null
    homeVegrefLastValidDistToRoadM = dToR
  }
  if (view === 'home') {
    const te = document.getElementById('home-vegref-type')
    const typeLineVisible =
      te != null &&
      !te.hidden &&
      String(te.textContent || '').trim() !== ''
    const primaryShown = String(
      displayEff || officialShortEff || '',
    ).trim()
    traceHomeVegrefAnomalies(res, {
      segKeyId,
      prevSegKey: prevHomeSegKey,
      segChanged,
      primaryShown,
      longDisplay: String(longDisplayEff || '').trim(),
      officialShort: String(officialShortEff || '').trim(),
      typeLineVisible,
      metaSource,
    })
  }
  maybeTraceHomeVegrefApply(res)
  maybePersistHomeVegref(res)
  // #region agent log
  {
    const __applyDt = performance.now() - __applyT0
    if (__applyDt > 55) {
      scanixDebugFreezeLog('H1', 'main.js:applyHomeVegrefResult', 'slow_apply', {
        ms: Math.round(__applyDt * 10) / 10,
        view,
        meta: String(
          /** @type {{ _vegrefMeta?: { source?: string } }} */ (res)
            ._vegrefMeta?.source || '',
        ).slice(0, 32),
      })
    }
  }
  // #endregion
}

function startHomeVegrefTracking() {
  if (homeVegrefWatchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(homeVegrefWatchId)
    homeVegrefWatchId = null
  }
  cancelHomeVegrefMeterTween()
  cancelHomeVegrefMeterLiveExtrap()
  homeVegrefPrevAuthMeter = null
  homeVegrefLastMeterUiCommitAt = 0
  homeVegrefLastRawGpsWallMs = Date.now()
  homeVegrefAnyGpsWallMs = Date.now()
  homeVegrefCoastStartedAt = 0
  homeVegrefCoastSpeedMps = 0
  homeVegrefStickyStreetLine = ''
  homeVegrefStickySegKey = ''
  resetHomeVegrefRuntimeState()
  homeVegrefStartupToken += 1
  const startupToken = homeVegrefStartupToken
  homeVegrefStartupStartedAt = Date.now()
  homeVegrefStartupFirstGpsAt = 0
  homeVegrefStartupFirstLookupAt = 0
  homeVegrefStartupFirstRenderAt = 0
  homeVegrefStartupFirstRenderSource = ''
  logHomeVegrefStartupMetric('tracking-start')
  void (async () => {
    const offlineAtStart =
      typeof navigator !== 'undefined' && navigator.onLine === false
    if (offlineAtStart) {
      await refreshOfflineVegrefState().catch(() => null)
    }
    try {
      const raw = localStorage.getItem(VEGREF_PERSIST_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (
          p &&
          typeof p.lat === 'number' &&
          typeof p.lng === 'number' &&
          p.res &&
          typeof p.res === 'object'
        ) {
          const ageMs =
            typeof p.savedAt === 'number' && Number.isFinite(p.savedAt)
              ? Date.now() - p.savedAt
              : Infinity
          /*
           * Hydrer alltid sist kjente vegref ved oppstart, uavhengig av alder.
           * Brukeren har lukket og åpnet appen igjen og forventer å se sist
           * kjente strekning umiddelbart (likt med f.eks. Vegviseren). Trygt
           * fordi:
           *   - cache-treff i offlineOrFallbackResult har avstandsjekk → en
           *     gammel, langt unna ref returneres ikke som ny posisjon-treff.
           *   - Pipelinen henter alltid fersk vegref ved første GPS-fix og
           *     overskriver hydratiseringen så snart noe nytt foreligger.
           *   - shouldPersistHomeVegrefRes hindrer at rå-koord-fallbacks
           *     persisteres i utgangspunktet — det vi hydrer er ekte vegref.
           * UI-flagget «Sist kjente vei …» kommuniserer at refen er gammel.
           */
          vegrefHydrateFromPersisted(p.lat, p.lng, p.res)
          homeVegrefLastStableRes = p.res
          homeVegrefLastStableAt = Date.now()
          vegrefReapplyLastToDom()
          const isStale = !Number.isFinite(ageMs) || ageMs > HOME_VEGREF_STALE_REUSE_MS
          const label = offlineAtStart
            ? isStale
              ? 'Sist kjente vei (uten nett)'
              : 'Sist kjente vei – uten nett'
            : 'Sist kjente vei – oppdaterer …'
          setHomeVegrefUncertainUi(true, label)
          logHomeVegrefStartupMetric('persisted-hydrate', {
            ageMs: Number.isFinite(ageMs) ? Math.round(ageMs) : -1,
            offline: offlineAtStart,
            stale: isStale,
          })
        }
      }
    } catch {
      /* ignore */
    }
  })()
  if (!window.isSecureContext || !navigator.geolocation) {
    setHomeVegrefPlaceholder(
      window.isSecureContext
        ? 'Posisjon er ikke tilgjengelig i nettleseren.'
        : 'Bruk https:// for å se vegreferanse.',
    )
    return
  }
  if (homeVegrefHasDisplayedResult || vegrefHasLastDisplay()) {
    vegrefReapplyLastToDom()
  } else {
    setHomeVegrefPlaceholder('Henter posisjon …')
  }
  markHomeVegrefMeterResumeBoost(2400)

  /* Warm start: få første vegref så raskt som mulig, uten å vente på watchPosition callback. */
  void (async () => {
    try {
      const pos = await getCurrentPositionOnce({
        enableHighAccuracy: true,
        maximumAge: 1500,
        timeout: 7000,
      })
      if (startupToken !== homeVegrefStartupToken || view !== 'home') return
      const { latitude, longitude, accuracy, heading } = pos.coords
      if (
        !(typeof accuracy === 'number' && Number.isFinite(accuracy)) ||
        accuracy <= GPS_REJECT_M
      ) {
        homeVegrefLastRawGpsWallMs = Date.now()
      }
      if (!homeVegrefStartupFirstGpsAt) {
        homeVegrefStartupFirstGpsAt = Date.now()
        logHomeVegrefStartupMetric('warm-gps', {
          accuracyM:
            typeof accuracy === 'number' && Number.isFinite(accuracy)
              ? Math.round(accuracy)
              : null,
        })
      }
      scheduleHomeWeatherFromPosition(latitude, longitude)
      pushHomeVegrefGpsSample(
        latitude,
        longitude,
        accuracy,
        pos.timestamp,
        heading,
      )
      const buffered = getBufferedHomeVegrefFix()
      const {
        refLat,
        refLng,
        refAccuracy,
        refHeading: warmRefHeading,
      } = pickHomeVegrefInputCoords(
        latitude,
        longitude,
        accuracy,
        heading,
        buffered,
      )
      if (accuracy > GPS_REJECT_M) {
        noteHomeVegrefAnyGpsFix(latitude, longitude, pos.timestamp)
        logHomeVegrefStartupMetric('warm-gps-rejected', {
          accuracyM: Math.round(accuracy),
        })
        void showHomeVegrefUncertainFallback('warm-gps-weak', accuracy)
        return
      }
      if (!homeVegrefStartupFirstLookupAt) {
        homeVegrefStartupFirstLookupAt = Date.now()
        logHomeVegrefStartupMetric('first-lookup', {
          source: 'warm-gps',
          accuracyM: Math.round(refAccuracy),
        })
      }
      pushTracePoint(latitude, longitude, pos.timestamp, accuracy)
      const hdg =
        warmRefHeading != null && Number.isFinite(warmRefHeading)
          ? warmRefHeading
          : null
      scheduleHomeVegrefLookup(
        refLat,
        refLng,
        true,
        refAccuracy,
        pos.timestamp,
        hdg,
      )
    } catch (err) {
      if (startupToken !== homeVegrefStartupToken) return
      logHomeVegrefStartupMetric('warm-gps-error', {
        message:
          err && typeof err === 'object' && 'message' in err
            ? String(/** @type {{ message?: unknown }} */ (err).message).slice(
                0,
                120,
              )
            : String(err).slice(0, 120),
      })
    }
  })()

  homeVegrefWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (view !== 'home') return
      const { latitude, longitude, accuracy, heading } = pos.coords
      /* Kun akseptable treff bumper «siste fersk GPS»-stempelet. I tunnel
         leverer iOS ofte dead-reckonede posisjoner med acc > 220 m; hvis vi
         stempler på dem, aktiveres aldri coast-logikken og meteren fryser. */
      if (
        !(typeof accuracy === 'number' && Number.isFinite(accuracy)) ||
        accuracy <= GPS_REJECT_M
      ) {
        homeVegrefLastRawGpsWallMs = Date.now()
      }
      if (!homeVegrefStartupFirstGpsAt) {
        homeVegrefStartupFirstGpsAt = Date.now()
        logHomeVegrefStartupMetric('watch-gps', {
          accuracyM:
            typeof accuracy === 'number' && Number.isFinite(accuracy)
              ? Math.round(accuracy)
              : null,
        })
      }
      scheduleHomeWeatherFromPosition(latitude, longitude)
      pushHomeVegrefGpsSample(
        latitude,
        longitude,
        accuracy,
        pos.timestamp,
        heading,
      )
      const buffered = getBufferedHomeVegrefFix()
      const {
        refLat,
        refLng,
        refAccuracy,
        refHeading: watchRefHeading,
      } = pickHomeVegrefInputCoords(
        latitude,
        longitude,
        accuracy,
        heading,
        buffered,
      )
      if (accuracy > GPS_REJECT_M) {
        noteHomeVegrefAnyGpsFix(latitude, longitude, pos.timestamp)
        if (showHomeVegrefUncertainFallback('watch-weak', accuracy)) return
        return
      }
      pushTracePoint(latitude, longitude, pos.timestamp, accuracy)
      const hdg =
        watchRefHeading != null && Number.isFinite(watchRefHeading)
          ? watchRefHeading
          : null
      /* Uten nett: ikke vent på OSRM — gå rett til NVDB-cache / koordinat-fallback i pipelinen. */
      const offline =
        typeof navigator !== 'undefined' && navigator.onLine === false
      if (offline) {
        scheduleHomeVegrefLookup(
          refLat,
          refLng,
          false,
          refAccuracy,
          pos.timestamp,
          hdg,
        )
        return
      }
      // Kritisk: oppdater vegref umiddelbart på rå GPS.
      // Hvis OSRM er treg/timeout skal ikke meteren stå og vente.
      if (!homeVegrefStartupFirstLookupAt) {
        homeVegrefStartupFirstLookupAt = Date.now()
        logHomeVegrefStartupMetric('first-lookup', {
          source: 'watch',
          accuracyM: Math.round(refAccuracy),
        })
      }
      scheduleHomeVegrefLookup(
        refLat,
        refLng,
        false,
        refAccuracy,
        pos.timestamp,
        hdg,
      )
      /* Ikke OSRM-«snap» til vegref her: nærmeste kjørebane kan være hovedvei langt fra faktisk posisjon
         (brukeren ser riktig GPS på kartet, men NVDB fikk feil punkt). */
    },
    (err) => {
      if (view !== 'home') return
      /* Har vi allerede vegreferanse, ikke bytt til feilmelding (unngår glitch). */
      if (homeVegrefHasDisplayedResult || vegrefHasLastDisplay()) return
      setHomeVegrefPlaceholder(describeGeolocationFailure(err))
    },
    {
      enableHighAccuracy: true,
      /* Lavere maks-alder på cache-fix: eldre posisjon + fersk NVDB gir ofte
         «hopp» i meter (punktet og strekningen matcher ikke samme øyeblikk). */
      maximumAge: 120,
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
  kmtLastMeterUiCommitAt = 0
  cancelKmtMeterTween()
  await stopKmtCameraStream()
  resetKmtCameraExtrasDom()
  dlg.showModal()

  /* Som forsiden: vis siste NVDB-treff med é gang; ellers tydelig lasting mens nytt oppslag kjører. */
  if (vegrefHasLastDisplay()) {
    vegrefReapplyLastToDom()
  } else {
    setKmtLoading()
  }

  const video = document.getElementById('kmt-video')
  if (
    isKmtCameraUiPreferred() &&
    navigator.mediaDevices?.getUserMedia &&
    video
  ) {
    dlg.classList.add('kmt-dialog--camera-warmup')
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
      resetKmtPreviewZoom()
      video.srcObject = stream
      video.muted = true
      video.setAttribute('playsinline', '')
      video.playsInline = true
      await video.play()
      applyKmtPreviewZoomStyle()
      const vtrack = stream.getVideoTracks()[0]
      const vs = typeof vtrack.getSettings === 'function' ? vtrack.getSettings() : {}
      kmtMainCameraDeviceId =
        vs && typeof vs.deviceId === 'string' ? vs.deviceId : null
      kmtUsingWideLens = false
      kmtWideLensDeviceId = null
      kmtWideSwitchInFlight = false
      void (async () => {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const ultra = devices.find(
            (d) =>
              d.kind === 'videoinput' &&
              d.deviceId &&
              kmtMainCameraDeviceId &&
              d.deviceId !== kmtMainCameraDeviceId &&
              /ultra|0\.5|wide|vidvinkel|dual wide|back dual wide/i.test(
                d.label,
              ),
          )
          if (ultra?.deviceId) {
            kmtWideLensDeviceId = String(ultra.deviceId)
          }
        } catch {
          kmtWideLensDeviceId = null
        }
      })()
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
      dlg.classList.remove('kmt-dialog--camera-warmup')
      dlg.classList.add('kmt-dialog--camera')
      syncKmtTorchUi()
      requestAnimationFrame(() => syncKmtTorchUi())
      window.setTimeout(() => syncKmtTorchUi(), 320)
    } catch {
      kmtCameraMode = false
      dlg.classList.remove('kmt-dialog--camera-warmup', 'kmt-dialog--camera')
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
    scheduleKmtVegrefLookup(
      lat0,
      lng0,
      true,
      lastLiveCoords?.accuracy ?? 28,
      Date.now(),
      null,
    )
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
        scheduleKmtVegrefLookup(p.lat, p.lng, true, p.accuracy, Date.now(), null)
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
  maybeFixPendingGps(latitude, longitude, acc)

  const initial = firstFixRef.v
  if (firstFixRef.v) firstFixRef.v = false

  const headingDeg =
    heading != null && !Number.isNaN(heading) ? heading : null

  pushTracePoint(latitude, longitude, pos.timestamp, acc)

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
      scheduleKmtVegrefLookup(
        latitude,
        longitude,
        false,
        acc,
        pos.timestamp,
        headingDeg,
      )
    }
    return
  }

  const offlineNav =
    typeof navigator !== 'undefined' && navigator.onLine === false
  if (offlineNav) {
    if (gpsStatusEl) {
      gpsStatusEl.textContent = `Kjøring · ca. ±${Math.round(acc)} m · uten nett (siste vegreferanse der det finnes)`
    }
    if (kmtDialogOpen) {
      scheduleKmtVegrefLookup(
        latitude,
        longitude,
        false,
        acc,
        pos.timestamp,
        headingDeg,
      )
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
    scheduleKmtVegrefLookup(
      refLat,
      refLng,
      false,
      acc,
      pos.timestamp,
      headingDeg,
    )
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
      nudgeMaptilerBasemapResize(map)
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
  if (!currentSessionId) {
    appendStorageDebugTrace('flush_current_no_session')
    return
  }
  const idx = sessions.findIndex((s) => s.id === currentSessionId)
  if (idx === -1) {
    appendStorageDebugTrace('flush_current_missing_session', { currentSessionId })
    return
  }
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
  lastTouchedSessionId = currentSessionId
  notePartialCloudPushForSessionId(currentSessionId)
  writeCoreSnapshotSync('flush_current')
  appendStorageDebugTrace('flush_current_session', {
    sessionId: currentSessionId,
    clickHistoryLen: state.clickHistory.length,
    photosLen: Array.isArray(state.photos) ? state.photos.length : 0,
  })
  saveAppState()
}

function persist(reason = 'persist') {
  setRegtracePersistReason(reason)
  flushCurrentSession()
  if (isRegisterTraceDebugEnabled() && currentSessionId) {
    const sess = sessions.find((x) => x.id === currentSessionId)
    if (sess) regtraceSessionAfterPersistFlush(reason, sess)
  }
  renderCount()
  renderLog()
  renderPhotosGallery()
  updateMapSharePanel()
}

/**
 * Tekstlinje som viser virtuell mappestruktur (images/FV7560/ …) for økt/album.
 * @param {Array<{ imageFolder?: string | null }>} photos
 */
function formatPhotosFolderSummaryLine(photos) {
  const counts = new Map()
  for (const p of photos) {
    if (p.imageFolder) {
      counts.set(p.imageFolder, (counts.get(p.imageFolder) || 0) + 1)
    }
  }
  if (!counts.size) return ''
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([f, n]) => `images/${f}/ (${n})`)
    .join(' · ')
}

/**
 * Alle bilder på enheten: standalone + alle økter; aktiv økt overstyrer evt. duplikat-id.
 * @returns {NonNullable<ReturnType<typeof normalizePhoto>>[]}
 */
function getAllPhotosFlat() {
  const byId = new Map()
  const add = (raw) => {
    const n = normalizePhotoOrSkeleton(raw)
    if (n) {
      const ex = byId.get(n.id)
      byId.set(
        n.id,
        ex ? mergeNormalizedPhotoPairForIndex(ex, n) : n,
      )
    }
  }
  for (const p of standalonePhotos) add(p)
  for (const s of sessions) {
    if (!Array.isArray(s.photos)) continue
    for (const ph of s.photos) add(ph)
  }
  if (currentSessionId && Array.isArray(state?.photos)) {
    for (const ph of state.photos) add(ph)
  }
  return [...byId.values()].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

/**
 * @param {NonNullable<ReturnType<typeof normalizePhoto>>[]} photos
 * @returns {[string, NonNullable<ReturnType<typeof normalizePhoto>>[]][]}
 */
function groupPhotosByRoadFolder(photos) {
  const map = new Map()
  for (const p of photos) {
    const key =
      typeof p.imageFolder === 'string' && p.imageFolder.trim()
        ? p.imageFolder
        : 'UKJENT_VEG'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(p)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

/** Finder-lignende mappeikon (blå mappe med «fane»). */
function menuPhotosMacFolderIconSvg() {
  return `<svg class="menu-photos-folder-svg" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <path fill="#6eb6ff" d="M6 7c0-1.1.9-2 2-2h7.2l1.6 1.6L26 7c1.66 0 3 1.34 3 3v1H5V9c0-1.1.9-2 2-2h-.5z"/>
  <path fill="#3b82f6" d="M5 11h26c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V13c0-1.1.9-2 2-2z"/>
  <path fill="#1d4ed8" opacity=".35" d="M5 11h26v2.5H5z"/>
</svg>`
}

function renderPhotosGallery() {
  const el = document.getElementById('photos-gallery')
  if (!el) return
  const strip = document.getElementById('session-photos-strip')
  const summaryEl = document.getElementById('session-photos-folders-summary')
  const compact = el.classList.contains('photos-gallery--session')
  if (!state.photos.length) {
    el.innerHTML = ''
    if (strip) strip.hidden = true
    if (summaryEl) {
      summaryEl.textContent = ''
      summaryEl.hidden = true
    }
    return
  }
  if (strip) strip.hidden = false
  const folderLine = formatPhotosFolderSummaryLine(state.photos)
  if (summaryEl) {
    if (folderLine) {
      summaryEl.textContent = `Bildemapper (lagring): ${folderLine}`
      summaryEl.hidden = false
    } else {
      summaryEl.textContent = ''
      summaryEl.hidden = true
    }
  }
  el.innerHTML = state.photos
    .map((ph, i) => {
      const ov = formatPhotoThumbOverlayHtml(ph)
      const folderBadge = ph.imageFolder
        ? `<span class="photo-thumb-folder" title="images/${escapeHtml(ph.imageFolder)}/">${escapeHtml(ph.imageFolder)}</span>`
        : ''
      const folderBit = ph.imageFolder
        ? ` · ${escapeHtml(ph.imageFolder)}`
        : ''
      const meta = compact
        ? ''
        : `<span class="photo-thumb-meta">#${i + 1} · ${formatNb(new Date(ph.timestamp))}${folderBit}</span>`
      return `
      <button type="button" class="photo-thumb-card" data-photo-id="${escapeHtml(ph.id)}">
        <span class="photo-thumb-frame">
          ${photoPreviewImgHtml(ph, 'photo-thumb-img')}
          ${ov}
          ${folderBadge}
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

/**
 * Grov est. dekodet JPEG-størrelse fra data-URL (for å unngå unødig re-koding).
 * @param {string} dataUrl
 */
function dataUrlApproxRawBytes(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.includes(',')) return 0
  const b64 = dataUrl.split(',', 2)[1]
  if (!b64) return 0
  return Math.floor((b64.length * 3) / 4)
}

/**
 * Skalerer til `maxEdge` og finner høyeste JPEG-kvalitet slik at filstørrelse ≲ `maxBytes`
 * (mobildata / Supabase). Senker evt. kantlengde hvis nødvendig.
 * @param {string} dataUrl
 * @param {{
 *   maxBytes?: number
 *   maxEdge?: number
 *   minQuality?: number
 *   minEdge?: number
 * }} [opts]
 * @returns {Promise<string>}
 */
async function compressDataUrlToJpegUnderBytes(dataUrl, opts = {}) {
  const maxBytes =
    typeof opts.maxBytes === 'number' && opts.maxBytes > 8000
      ? opts.maxBytes
      : 380 * 1024
  const maxEdgeStart =
    typeof opts.maxEdge === 'number' && opts.maxEdge > 320
      ? opts.maxEdge
      : 1920
  const minQuality =
    typeof opts.minQuality === 'number' ? opts.minQuality : 0.62
  const minEdge = typeof opts.minEdge === 'number' ? opts.minEdge : 1024

  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('image'))
    i.src = dataUrl
  })

  let maxEdge = maxEdgeStart

  /**
   * @param {number} edge
   * @param {HTMLImageElement} im
   */
  function layoutCanvas(edge, im) {
    let w = im.naturalWidth || im.width
    let h = im.naturalHeight || im.height
    if (w < 1 || h < 1) throw new Error('image size')
    if (w > edge || h > edge) {
      if (w > h) {
        h = Math.round((h * edge) / w)
        w = edge
      } else {
        w = Math.round((w * edge) / h)
        h = edge
      }
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(im, 0, 0, w, h)
    return canvas
  }

  const canvasToJpegBlob = (canvas, q) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))),
        'image/jpeg',
        q,
      )
    })

  const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(new Error('read'))
      r.readAsDataURL(blob)
    })

  while (maxEdge >= minEdge) {
    const canvas = layoutCanvas(maxEdge, img)
    let lo = minQuality
    let hi = 0.92
    /** @type {Blob | null} */
    let bestBlob = null
    for (let iter = 0; iter < 14; iter++) {
      const mid = (lo + hi) / 2
      const blob = await canvasToJpegBlob(canvas, mid)
      if (blob.size <= maxBytes) {
        bestBlob = blob
        lo = mid
      } else {
        hi = mid
      }
      if (hi - lo < 0.01) break
    }
    if (bestBlob && bestBlob.size <= maxBytes) {
      return blobToDataUrl(bestBlob)
    }
    maxEdge = Math.floor(maxEdge * 0.88)
  }

  const canvas = layoutCanvas(minEdge, img)
  const blob = await canvasToJpegBlob(canvas, minQuality)
  return blobToDataUrl(blob)
}

/**
 * Tegn vegreferanse + evt. kommentar inn i canvas (nederst, hvit tekst m/skygge).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w canvas width
 * @param {number} h canvas height
 * @param {{ road?: string, compact?: string, kortform?: string } | null | undefined} vr
 * @param {string} [note]
 * @param {string} [timestampText]
 */
function burnVegrefOntoCanvas(ctx, w, h, vr, note, timestampText = '') {
  const lines = []
  if (vr?.road) lines.push(vr.road)
  if (vr?.compact) lines.push(vr.compact)
  if (vr?.kortform) lines.push(vr.kortform)
  const trimNote = typeof note === 'string' ? note.trim().slice(0, 200) : ''
  if (trimNote) lines.push(trimNote)
  const trimTs =
    typeof timestampText === 'string' ? timestampText.trim().slice(0, 60) : ''
  if (trimTs) lines.push(trimTs)
  if (!lines.length) return
  const fontSize = Math.max(14, Math.round(w * 0.028))
  ctx.save()
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  ctx.textBaseline = 'bottom'
  ctx.textAlign = 'left'
  const lineH = fontSize * 1.35
  const padX = Math.round(w * 0.025)
  const padBottom = Math.round(h * 0.02)
  const blockH = lines.length * lineH + padBottom + Math.round(h * 0.01)
  const grd = ctx.createLinearGradient(0, h - blockH * 1.6, 0, h)
  grd.addColorStop(0, 'rgba(0,0,0,0)')
  grd.addColorStop(0.45, 'rgba(0,0,0,0.35)')
  grd.addColorStop(1, 'rgba(0,0,0,0.72)')
  ctx.fillStyle = grd
  ctx.fillRect(0, h - blockH * 1.6, w, blockH * 1.6)
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 1
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < lines.length; i++) {
    const y = h - padBottom - (lines.length - 1 - i) * lineH
    ctx.fillText(lines[i], padX, y)
  }
  ctx.restore()
}

/**
 * Lager en JPEG data-url med vegreferanse/note innbrent i pikslene.
 * @param {string} srcDataUrl
 * @param {{ road?: string, compact?: string, kortform?: string } | null | undefined} vr
 * @param {string} [note]
 * @param {string} [timestampText]
 * @returns {Promise<string>}
 */
function stampPhotoWithVegref(srcDataUrl, vr, note, timestampText = '') {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const { width: w, height: h } = img
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      burnVegrefOntoCanvas(ctx, w, h, vr, note, timestampText)
      resolve(c.toDataURL('image/jpeg', 0.93))
    }
    img.onerror = () => reject(new Error('image'))
    img.src = srcDataUrl
  })
}

/**
 * Lagrer et bilde med innprintet vegreferanse til enheten (iOS: Share Sheet → Lagre; andre: download).
 * @param {NonNullable<ReturnType<typeof normalizePhoto>>} ph
 */
async function savePhotoToDevice(ph) {
  if (!ph || typeof ph !== 'object') return
  let sourceDataUrl =
    typeof ph.dataUrl === 'string' && ph.dataUrl.startsWith('data:image/')
      ? ph.dataUrl
      : ''
  if (!sourceDataUrl) {
    const id = typeof ph.id === 'string' ? ph.id : ''
    if (id && (await isPhotoBlobStoreAvailable())) {
      try {
        const fromIdb = await getPhotoDataUrl(id)
        if (typeof fromIdb === 'string' && fromIdb.startsWith('data:image/')) {
          sourceDataUrl = fromIdb
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (!sourceDataUrl) {
    const thumbMem =
      typeof ph.thumbDataUrl === 'string' &&
      ph.thumbDataUrl.startsWith('data:image/')
        ? ph.thumbDataUrl
        : ''
    if (thumbMem) sourceDataUrl = thumbMem
  }
  if (!sourceDataUrl) {
    const sb = getSupabase()
    const fullPath =
      typeof ph.storageFullPath === 'string' ? ph.storageFullPath.trim() : ''
    const thumbPath =
      typeof ph.storageThumbPath === 'string' ? ph.storageThumbPath.trim() : ''
    const tryPath = async (path) => {
      if (!path) return ''
      try {
        const signed = await storageObjectUrlFromPath(sb, path)
        if (!signed) return ''
        const res = await fetch(signed)
        if (!res.ok) return ''
        const blob = await res.blob()
        return await new Promise((resolve) => {
          const r = new FileReader()
          r.onload = () => resolve(typeof r.result === 'string' ? r.result : '')
          r.onerror = () => resolve('')
          r.readAsDataURL(blob)
        })
      } catch {
        return ''
      }
    }
    sourceDataUrl = await tryPath(fullPath)
    if (!sourceDataUrl) sourceDataUrl = await tryPath(thumbPath)
  }
  if (!sourceDataUrl) return
  const vr = ph.vegref ? normalizePhotoVegref(ph.vegref) : null
  const note = typeof ph.note === 'string' ? ph.note : ''
  const captureTs =
    ph.captureWithVegrefDateTime === true
      ? formatPhotoOverlayTimestamp(ph.timestamp)
      : ''
  let dataUrl
  try {
    dataUrl = (vr || note.trim() || captureTs)
      ? await stampPhotoWithVegref(sourceDataUrl, vr, note, captureTs)
      : sourceDataUrl
  } catch {
    dataUrl = sourceDataUrl
  }
  const blob = await (await fetch(dataUrl)).blob()
  const ts = ph.timestamp
    ? ph.timestamp.replace(/[:.]/g, '-').slice(0, 19)
    : new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
  const filename = `bilde-${ts}.jpg`
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'image/jpeg' })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] })
        return
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Maks kant på lagrede økt-/album-bilder (før byte-mål). */
const PHOTO_MAX_DIM = 1920
/** Mål for JPEG-størrelse (dekodet) mot sky / mobildata — justeres med kvalitet i `compressDataUrlToJpegUnderBytes`. */
const PHOTO_STORAGE_TARGET_MAX_BYTES = 380 * 1024
const PHOTO_STORAGE_MIN_JPEG_QUALITY = 0.62
const PHOTO_STORAGE_MIN_EDGE = 1024
/** @deprecated Brukes bare av eldre hjelpefunksjoner; øktbilder styres av `compressDataUrlToJpegUnderBytes`. */
const PHOTO_JPEG_QUALITY = 0.9

/**
 * @param {string} dataUrl
 * @param {{
 *   lat?: number | null
 *   lng?: number | null
 *   vegref?: { road: string, compact: string, kortform: string } | null
 *   note?: string
 *   captureWithVegrefDateTime?: boolean
 * }} [opts] Eksplisitte koord (f.eks. EXIF) brukes først. `vegref` vises som HTML-overlay (skarp ved zoom), ikke innprintet i pikslene. Mappe (`images/…/`) utledes fra KMT-feltet `kmt-road-folder-src` + evt. vegref.
 */
async function addPhotoFromCompressedDataUrl(dataUrl, opts = {}) {
  let packed = dataUrl
  if (dataUrlApproxRawBytes(packed) > PHOTO_STORAGE_TARGET_MAX_BYTES * 1.06) {
    try {
      packed = await compressDataUrlToJpegUnderBytes(packed, {
        maxBytes: PHOTO_STORAGE_TARGET_MAX_BYTES,
        maxEdge: PHOTO_MAX_DIM,
        minQuality: PHOTO_STORAGE_MIN_JPEG_QUALITY,
        minEdge: PHOTO_STORAGE_MIN_EDGE,
      })
    } catch (e) {
      console.warn('addPhotoFromCompressedDataUrl compress', e)
    }
  }

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

  const folderSeed = resolveKmtPhotoFolderSeed(opts)
  const rawNote = opts.note
  const noteOpt =
    typeof rawNote === 'string' && rawNote.trim()
      ? rawNote.trim().slice(0, 800)
      : undefined
  let thumbDataUrl = null
  try {
    thumbDataUrl = await makeThumbDataUrlFromDataUrl(packed, {
      maxEdge: 200,
      quality: 0.78,
    })
  } catch (e) {
    console.warn('addPhotoFromCompressedDataUrl thumb', e)
  }
  const entry = normalizePhoto({
    id: crypto.randomUUID(),
    timestamp: nowIso(),
    lat,
    lng,
    dataUrl: packed,
    ...(thumbDataUrl ? { thumbDataUrl } : {}),
    ...(opts.vegref ? { vegref: opts.vegref } : {}),
    ...(noteOpt ? { note: noteOpt } : {}),
    ...(opts.captureWithVegrefDateTime ? { captureWithVegrefDateTime: true } : {}),
    imageFolder: folderSeed,
  })
  if (!entry) return

  if (await isPhotoBlobStoreAvailable()) {
    try {
      await putPhotoDataUrl(entry.id, packed)
    } catch (e) {
      console.warn('putPhotoDataUrl new photo', e)
    }
  }

  if (isSupabaseConfigured() && currentUser?.id) {
    enqueuePhotoStorageUpload(entry.id)
    void tryDrainPhotoUploadQueue({ userId: currentUser.id }).finally(() => {
      syncPhotoUploadDeferralBanner()
    })
  }
  syncPhotoUploadDeferralBanner()

  if (kmtStandaloneFlow) {
    standalonePhotos.push(entry)
    saveAppState()
    if (view === 'photoAlbum') {
      appendStandalonePhotoAlbumCell(entry)
      syncPhotoAlbumChrome()
    }
    triggerHapticPhoto()
    return
  }

  if (!state.photos) state.photos = []
  state.photos.push(entry)

  if (lat != null && lng != null) {
    addLogEntry(state, {
      message: `Bilde · ${state.photos.length} · med GPS`,
    })
  } else {
    addLogEntry(state, {
      message: `Bilde · ${state.photos.length} · uten GPS`,
    })
  }
  persist('session:photo_added')
  if (map) await ensureLeaflet()
  rebuildMarkers('photo_added')
  triggerHapticPhoto()
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

/** Synlig når enheten rapporterer frakoblet nett (Capacitor/safari). */
function offlineModeBannerHtml() {
  if (typeof navigator === 'undefined' || navigator.onLine !== false) return ''
  const hint = offlineVegrefReady
    ? 'Du er offline. Vegreferanse bruker nedlastet kartdata der det finnes. Sky-synk krever nett.'
    : 'Du er offline. Koble til nett for at appen skal kunne laste ned veidata automatisk; uten pakke vises posisjon som koordinater der det ikke finnes tidligere treff.'
  return `<div class="offline-mode-banner" role="status">${escapeHtml(hint)}</div>`
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
        ${
          isSupabaseConfigured()
            ? ''
            : `<p class="auth-hint auth-hint--local-only" role="status">
          Denne installasjonen har ikke sky-innlogging (mangler <code class="auth-hint-code">VITE_SUPABASE_*</code> i bygget).
          Logg inn med en bruker du har opprettet her, eller legg <code class="auth-hint-code">.env</code> med Supabase-URL og anon-nøkkel i samme mappe som <code class="auth-hint-code">package.json</code>, kjør <code class="auth-hint-code">npm run build</code> og <code class="auth-hint-code">npx cap sync</code>.
        </p>`
        }
        <form id="form-auth-login" class="auth-form" aria-label="Logg inn" ${isLogin ? '' : 'hidden'}>
          <label class="auth-label">E-post
            <input type="email" id="auth-login-email" class="auth-input auth-input--glass" autocomplete="email" required />
          </label>
          <label class="auth-label">Passord
            <input type="password" id="auth-login-password" class="auth-input auth-input--glass" autocomplete="current-password" required />
          </label>
          <button type="submit" id="btn-auth-login-submit" class="btn-auth-gradient">Logg inn</button>
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
          <button type="submit" id="btn-auth-register-submit" class="btn-auth-gradient btn-auth-gradient--teal">Opprett bruker</button>
        </form>
        <p id="auth-error" class="auth-error" role="alert" aria-live="polite"></p>
        <p class="auth-disclaimer">Passord lagres kryptert på denne enheten. Bruk kun på egen enhet du stoler på.</p>
      </div>
    </div>
  </div>`
}

function renderHomeHtml() {
  const photoDefer =
    isSupabaseConfigured() && currentUser?.id
      ? getPhotoUploadQueueDeferralUi()
      : null
  const photoDeferHtml = photoDefer
    ? `<div id="home-photo-upload-deferral" class="home-photo-upload-deferral home-photo-upload-deferral--${photoDefer.reason}" role="status" aria-live="polite"><span class="home-photo-upload-deferral__inner">${escapeHtml(
        photoDefer.reason === 'offline'
          ? `Bilder venter på nett (${photoDefer.count})`
          : `Bilder venter på Wi‑Fi (${photoDefer.count})`,
      )}</span></div>`
    : `<div id="home-photo-upload-deferral" class="home-photo-upload-deferral" hidden aria-hidden="true"></div>`
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
        <div id="home-weather" class="home-weather home-weather--toolbar" hidden aria-live="polite">
          <div class="home-weather__inner">
            <div class="home-weather__icon-wrap" id="home-weather-icon" aria-hidden="true"></div>
            <div class="home-weather__meta">
              <span id="home-weather-temp" class="home-weather__temp">—</span>
              <span id="home-weather-desc" class="home-weather__desc"></span>
            </div>
          </div>
        </div>
      </div>
    </div>`
  return `<div class="view-home surface--home">
    <div id="home-pull-refresh" class="home-pull-refresh" aria-hidden="true">
      <div class="home-pull-refresh__track">
        <div class="home-pull-refresh__spinner-wrap">
          <svg class="home-pull-refresh__spinner-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle class="home-pull-refresh__spinner-ring" cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-dasharray="44 999" />
          </svg>
        </div>
      </div>
      <div id="home-pull-refresh-overlay" class="home-pull-refresh__overlay" hidden>
        <div class="home-pull-refresh__overlay-inner" role="status" aria-live="polite" aria-label="Oppdaterer …">
          <svg class="home-pull-refresh__overlay-spinner" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle class="home-pull-refresh__overlay-ring" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="48 999" />
          </svg>
        </div>
      </div>
    </div>
    ${userBar || ''}
    ${photoDeferHtml}
    <div class="home-vegref" role="status" aria-live="off">
      <p id="home-vegref-primary" class="home-vegref__primary">Henter posisjon …</p>
      <p id="home-vegref-type" class="home-vegref__type" hidden></p>
      <div id="home-vegref-compact" class="home-vegref__compact" hidden>
        <div class="home-vegref__sd-row">
          <span id="home-vegref-s" class="home-vegref__line home-vegref__line--s"></span>
          <span id="home-vegref-d" class="home-vegref__line home-vegref__line--d"></span>
        </div>
        <div id="home-vegref-meter" class="home-vegref__meter"></div>
      </div>
    </div>
    <nav class="home-dashboard" aria-label="Hurtigvalg">
      <button type="button" class="home-dash-card home-dash-card--hero home-dash-card--accent" id="btn-home-registrering">
        <span class="home-dash-card__row">
          <span class="home-dash-card__content">
            <span class="home-dash-card__title">Ny registrering</span>
            <span class="home-dash-card__hint">Start økt fra din posisjon</span>
          </span>
          <span class="home-dash-card__visual home-dash-card__visual--accent" aria-hidden="true">
            <svg class="home-dash-card__preview" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
              <defs>
                <linearGradient id="hp-reg-bg" x1="40" y1="0" x2="40" y2="80" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#2b4b7d"/><stop offset="1" stop-color="#0e1a30"/>
                </linearGradient>
                <linearGradient id="hp-reg-pin" x1="40" y1="12" x2="40" y2="56" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#8ddcff"/><stop offset="1" stop-color="#3a8fff"/>
                </linearGradient>
              </defs>
              <rect width="80" height="80" rx="14" fill="url(#hp-reg-bg)"/>
              <path d="M40 12c-9.4 0-17 7.3-17 16.4 0 11.8 15.2 27 16.2 28a1 1 0 0 0 1.6 0c1-1 16.2-16.2 16.2-28C57 19.3 49.4 12 40 12z" fill="url(#hp-reg-pin)" stroke="#fff" stroke-width="3"/>
              <circle cx="40" cy="28" r="7.5" fill="#0c1a33" stroke="#fff" stroke-width="2"/>
              <circle cx="62" cy="60" r="12" fill="#34d97a" stroke="#fff" stroke-width="3"/>
              <path d="M62 54v12M56 60h12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
            </svg>
          </span>
        </span>
      </button>
      <button type="button" class="home-dash-card" id="btn-home-kamera">
        <span class="home-dash-card__row">
          <span class="home-dash-card__content">
            <span class="home-dash-card__title">Kamera</span>
            <span class="home-dash-card__hint">Bilder til økten</span>
          </span>
          <span class="home-dash-card__visual" aria-hidden="true">
            <svg class="home-dash-card__preview" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
              <defs>
                <linearGradient id="hp-cam-bg" x1="40" y1="0" x2="40" y2="80" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#3a4354"/><stop offset="1" stop-color="#161c27"/>
                </linearGradient>
                <linearGradient id="hp-cam-body" x1="40" y1="22" x2="40" y2="66" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#ffffff"/><stop offset="1" stop-color="#b3bccd"/>
                </linearGradient>
                <radialGradient id="hp-cam-lens" cx="40" cy="45" r="16" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#7fd0ff"/><stop offset="0.55" stop-color="#1b3a66"/><stop offset="1" stop-color="#050912"/>
                </radialGradient>
              </defs>
              <rect width="80" height="80" rx="14" fill="url(#hp-cam-bg)"/>
              <rect x="30" y="15" width="20" height="9" rx="2.5" fill="#d8dfec" stroke="#0c1220" stroke-width="1.5"/>
              <rect x="10" y="22" width="60" height="44" rx="9" fill="url(#hp-cam-body)" stroke="#0c1220" stroke-width="2.5"/>
              <circle cx="40" cy="45" r="15" fill="url(#hp-cam-lens)" stroke="#0c1220" stroke-width="2.5"/>
              <circle cx="40" cy="45" r="7" fill="#050912" stroke="rgba(255,255,255,0.35)" stroke-width="1.2"/>
              <ellipse cx="45" cy="40" rx="3.6" ry="2.6" fill="rgba(255,255,255,0.55)" transform="rotate(-30 45 40)"/>
              <circle cx="60" cy="31" r="2.8" fill="#ffce56" stroke="#0c1220" stroke-width="1.2"/>
              <rect x="13" y="26" width="8" height="4" rx="1.2" fill="#0c1220" opacity="0.7"/>
            </svg>
          </span>
        </span>
      </button>
      <button type="button" class="home-dash-card" id="btn-home-kontraktai">
        <span class="home-dash-card__row">
          <span class="home-dash-card__content">
            <span class="home-dash-card__title">Kontrakter</span>
            <span class="home-dash-card__hint">AI mot kontraktskrav</span>
          </span>
          <span class="home-dash-card__visual" aria-hidden="true">
            <svg class="home-dash-card__preview" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
              <defs>
                <linearGradient id="hp-kon-bg" x1="40" y1="0" x2="40" y2="80" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#3c4a5e"/><stop offset="1" stop-color="#141c29"/>
                </linearGradient>
              </defs>
              <rect width="80" height="80" rx="14" fill="url(#hp-kon-bg)"/>
              <path d="M20 12h26l14 14v38a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z" fill="#ffffff" stroke="#0c1220" stroke-width="2.5"/>
              <path d="M46 12v14h14" fill="none" stroke="#0c1220" stroke-width="2.5" stroke-linejoin="round"/>
              <path d="M22 36h26M22 46h30M22 56h18" stroke="#0c1220" stroke-width="3" stroke-linecap="round" opacity="0.75"/>
              <circle cx="58" cy="58" r="13" fill="#4da3ff" stroke="#0c1220" stroke-width="2.5"/>
              <text x="58" y="63" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="800" font-size="13" fill="#fff">Ai</text>
            </svg>
          </span>
        </span>
      </button>
      <button type="button" class="home-dash-card" id="btn-home-album">
        <span class="home-dash-card__row">
          <span class="home-dash-card__content">
            <span class="home-dash-card__title">Album</span>
            <span class="home-dash-card__hint">Bilder og filer</span>
          </span>
          <span class="home-dash-card__visual" aria-hidden="true">
            <svg class="home-dash-card__preview" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
              <defs>
                <linearGradient id="hp-al-bg" x1="40" y1="0" x2="40" y2="80" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#3c4a5e"/><stop offset="1" stop-color="#141c29"/>
                </linearGradient>
                <linearGradient id="hp-al-sky" x1="20" y1="22" x2="60" y2="48" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#7cc4ff"/><stop offset="1" stop-color="#3370a8"/>
                </linearGradient>
              </defs>
              <rect width="80" height="80" rx="14" fill="url(#hp-al-bg)"/>
              <g transform="rotate(-12 28 48)"><rect x="14" y="30" width="32" height="36" rx="3" fill="#fff" stroke="#0c1220" stroke-width="2"/></g>
              <g transform="rotate(10 52 38)"><rect x="36" y="22" width="32" height="36" rx="3" fill="#fff" stroke="#0c1220" stroke-width="2"/></g>
              <rect x="22" y="18" width="36" height="46" rx="4" fill="#fff" stroke="#0c1220" stroke-width="2.5"/>
              <rect x="26" y="22" width="28" height="30" rx="2" fill="url(#hp-al-sky)"/>
              <circle cx="48" cy="30" r="4" fill="#ffd96a" stroke="#0c1220" stroke-width="1"/>
              <path d="M26 52l7-10 6 6 6-8 9 12h-28z" fill="rgba(255,255,255,0.9)" stroke="#0c1220" stroke-width="1" stroke-linejoin="round"/>
              <path d="M26 56h28M26 60h22" stroke="#0c1220" stroke-width="2" stroke-linecap="round" opacity="0.65"/>
            </svg>
          </span>
        </span>
      </button>
      <button type="button" class="home-dash-card" id="btn-home-delsky">
        <span class="home-dash-card__row">
          <span class="home-dash-card__content">
            <span class="home-dash-card__title">DelSky</span>
            <span class="home-dash-card__hint">Mine økter og meldinger</span>
          </span>
          <span class="home-dash-card__visual" aria-hidden="true">
            <svg class="home-dash-card__preview" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
              <defs>
                <linearGradient id="hp-delsky-bg" x1="40" y1="0" x2="40" y2="80" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#2a4568"/><stop offset="1" stop-color="#101a2b"/>
                </linearGradient>
              </defs>
              <rect width="80" height="80" rx="14" fill="url(#hp-delsky-bg)"/>
              <path d="M22 58h36a13 13 0 0 0 2.5-25.8C58.5 22 50.8 16.5 42 16.5c-8.5 0-15.8 5.2-17.4 12.6C17.5 30.2 12 35.7 12 42.6 12 51 16.5 58 22 58z" fill="#fff" stroke="#0c1220" stroke-width="2.8"/>
              <path d="M40 70V44" stroke="#0c1220" stroke-width="6" stroke-linecap="round"/>
              <path d="M28 50l12-12 12 12" fill="none" stroke="#0c1220" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </span>
      </button>
      <button type="button" class="home-dash-card" id="btn-home-excel">
        <span class="home-dash-card__row">
          <span class="home-dash-card__content">
            <span class="home-dash-card__title">Excel</span>
            <span class="home-dash-card__hint">Eksporter regneark</span>
          </span>
          <span class="home-dash-card__visual" aria-hidden="true">
            <svg class="home-dash-card__preview" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
              <defs>
                <linearGradient id="hp-xls-bg" x1="40" y1="0" x2="40" y2="80" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#2a3a31"/><stop offset="1" stop-color="#0d1a13"/>
                </linearGradient>
                <linearGradient id="hp-xls-body" x1="40" y1="12" x2="40" y2="68" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#3ee08f"/><stop offset="1" stop-color="#0e7a45"/>
                </linearGradient>
              </defs>
              <rect width="80" height="80" rx="14" fill="url(#hp-xls-bg)"/>
              <rect x="12" y="12" width="56" height="56" rx="10" fill="url(#hp-xls-body)" stroke="#0c1220" stroke-width="2.5"/>
              <rect x="12" y="12" width="56" height="16" rx="10" fill="#0e6e3b"/>
              <text x="40" y="24" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="900" font-size="11" fill="#fff" letter-spacing="1.5">XLSX</text>
              <path d="M22 40h36M22 50h36M22 60h28" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.95"/>
              <path d="M40 36v28" stroke="#fff" stroke-width="1.8" opacity="0.55"/>
            </svg>
          </span>
        </span>
      </button>
      <button type="button" class="home-dash-card" id="btn-home-strekning">
        <span class="home-dash-card__row">
          <span class="home-dash-card__content">
            <span class="home-dash-card__title">Strekning</span>
            <span class="home-dash-card__hint">Segment og avstand</span>
          </span>
          <span class="home-dash-card__visual" aria-hidden="true">
            <svg class="home-dash-card__preview" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
              <defs>
                <linearGradient id="hp-str-bg" x1="40" y1="0" x2="40" y2="80" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#2e4868"/><stop offset="1" stop-color="#0e1a2d"/>
                </linearGradient>
              </defs>
              <rect width="80" height="80" rx="14" fill="url(#hp-str-bg)"/>
              <path d="M20 66 C 22 48, 58 48, 60 14" stroke="#fff" stroke-width="12" stroke-linecap="round" fill="none"/>
              <path d="M20 66 C 22 48, 58 48, 60 14" stroke="#0c1220" stroke-width="2.5" stroke-dasharray="4 6" fill="none" stroke-linecap="round"/>
              <g transform="translate(13 12)">
                <path d="M7 0C3.1 0 0 3.1 0 7c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill="#34d97a" stroke="#0c1220" stroke-width="2.5"/>
                <text x="7" y="10" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="9" font-weight="900" fill="#0c1220">A</text>
              </g>
              <g transform="translate(53 50)">
                <path d="M7 0C3.1 0 0 3.1 0 7c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill="#4da3ff" stroke="#0c1220" stroke-width="2.5"/>
                <text x="7" y="10" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="9" font-weight="900" fill="#0c1220">B</text>
              </g>
            </svg>
          </span>
        </span>
      </button>
    </nav>
    <section class="home-browser-sync" aria-label="Få økt og bilder inn i denne nettleseren">
      <p class="home-browser-sync__title">Økt og bilder på Mac / i nettleser</p>
      <p class="home-browser-sync__lead">Telefon og denne nettleseren har <strong>hvert sitt lokale lager</strong>. Logg inn som <strong>samme bruker</strong> her som på telefon, med sky på — forsiden prøver å <strong>hente økter fra delsky</strong> automatisk (eller trykk <strong>Hent fra sky</strong>). Øktene ligger under <strong>Meny → Økten</strong>. Alternativ: eksporter økt som <strong>HTML</strong> på telefon og trykk <strong>Importer</strong> under.</p>
      <input type="file" id="home-import-session-input" class="photo-input-hidden" accept=".html,text/html" />
      <div class="home-browser-sync__row">
        <button type="button" class="btn btn-secondary" id="btn-home-import-pick">Importer HTML-økt …</button>
        ${
          isSupabaseConfigured() && currentUser && !isMinDownloadMode()
            ? '<button type="button" class="btn btn-text home-browser-sync__sync" id="btn-home-sync-pull">Hent fra sky</button>'
            : ''
        }
      </div>
      <p id="home-import-status" class="home-browser-sync__status" role="status" aria-live="polite"></p>
    </section>
    <div class="home-main">
    <div class="home-bilde-stack">
      <div id="panel-home-bilde-camera" class="home-bilde-panel" role="region" aria-label="Bilde"></div>
      <div id="panel-home-bilde-ai" class="home-bilde-panel" role="region" aria-label="Kontraktskontroll" hidden>
        <div id="home-ai-fullscreen" class="home-ai-fullscreen ai-doc-container">
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
              <button type="button" class="home-ai-gpt__close" id="btn-home-ai-close-fs" aria-label="Tilbake">
                <svg class="home-ai-gpt__close-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <div class="home-ai-gpt__header-center">
                <span class="home-ai-gpt__contract-pill home-ai-gpt__brand-label" id="home-ai-contract-brand" role="presentation"><span class="home-ai-gpt__contract-pill-label">Kontraktskontroll</span></span>
              </div>
              <div class="home-ai-gpt__header-spacer" aria-hidden="true"></div>
            </header>
            <p id="home-ai-mode-hint" class="home-ai-gpt__mode-hint" role="note" hidden></p>
            <div class="home-ai-gpt__context">
              <div class="home-ai-gpt__thumb-wrap" id="home-ai-thumb-wrap">
                <img id="home-ai-preview-img" class="home-ai-gpt__thumb" alt="Valgt bilde" width="72" height="72" hidden />
                <p id="home-ai-thumb-placeholder" class="home-ai-gpt__thumb-ph" hidden></p>
              </div>
            </div>
            <div id="home-ai-chat-log" class="home-ai-gpt__scroll" role="log" aria-live="polite"></div>
            <div class="home-ai-gpt__composer input-bar">
              <div class="home-ai-gpt__composer-tools" role="toolbar" aria-label="Vedlegg og PDF">
                <button type="button" class="home-ai-gpt__tool home-ai-gpt__composer-tool" id="btn-home-ai-open-camera">Ta bilde</button>
                <button type="button" class="home-ai-gpt__tool home-ai-gpt__composer-tool" id="btn-home-ai-pick-file-chat">Filer</button>
                <button type="button" class="home-ai-gpt__tool home-ai-gpt__composer-tool" id="btn-home-ai-pdf">PDF</button>
              </div>
              <div class="home-ai-gpt__input-shell">
                <label class="visually-hidden" for="home-ai-chat-input">Send melding til RoadMindAi</label>
                <textarea id="home-ai-chat-input" class="home-ai-gpt__textarea" rows="1" placeholder="Skriv spørsmålet ditt …"></textarea>
                <button type="button" class="home-ai-gpt__send" id="btn-home-ai-send" aria-label="Send melding til RoadMindAi">
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 2a6.5 6.5 0 0 1 6.5 6.5c0 4.8-4.8 10.2-6.1 11.6a.55.55 0 0 1-.8 0C10.3 18.7 5.5 13.3 5.5 8.5A6.5 6.5 0 0 1 12 2z" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/>
            <circle cx="12" cy="8.5" r="2.6" fill="currentColor"/>
          </svg>
        </span>
      </button>
      <button type="button" class="home-bottom-nav__btn" id="btn-home-nav-resume" aria-label="Fortsett siste økt">
        <span class="home-bottom-nav__icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
            <path d="M10.5 8.25v7.5L16.4 12 10.5 8.25z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
        </span>
      </button>
      ${
        isMinDownloadMode()
          ? ''
          : `<button type="button" class="home-bottom-nav__btn" id="btn-home-nav-ai" aria-label="Kontraktskontroll">
        <span class="home-bottom-nav__icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M14 3v5h5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M8 14l3 3 5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </button>`
      }
      <button type="button" class="home-bottom-nav__btn" id="btn-home-nav-history" aria-label="Økter og historikk">
        <span class="home-bottom-nav__icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M4 12a8 8 0 1 0 2.4-5.7" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
            <path d="M4 4v5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 8v4.5l3 1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
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
        ${
          isMinDownloadMode()
            ? ''
            : '<button type="button" class="home-drawer__link" id="home-drawer-contract-ai">Kontraktskontroll</button>'
        }
        <button type="button" class="home-drawer__link" id="home-drawer-user">Bruker</button>
        <button type="button" class="home-drawer__link" id="home-drawer-map">Kart</button>
        <button type="button" class="home-drawer__link" id="home-drawer-photos">Bilder</button>
        <button type="button" class="home-drawer__link" id="home-drawer-friction">Friksjonsmåling</button>
        <button type="button" class="home-drawer__link" id="home-drawer-contacts">Kontaktliste</button>
        <button type="button" class="home-drawer__link" id="home-drawer-traffic-group">Trafikantgruppe</button>
        <button type="button" class="home-drawer__link" id="home-drawer-offline-vegref">Veg uten nett</button>
        ${
          isMinDownloadMode()
            ? ''
            : '<button type="button" class="home-drawer__link" id="home-drawer-messages">DelSky</button>'
        }
        <button type="button" class="home-drawer__link" id="home-drawer-settings">Innstillinger</button>
        <button type="button" class="home-drawer__link" id="home-drawer-haptics">Haptisk tilbakemelding</button>
        ${
          isMinDownloadMode()
            ? ''
            : '<button type="button" class="home-drawer__link" id="home-drawer-finn-obj">Finn objekter</button>'
        }
        <button type="button" class="home-drawer__link" id="home-drawer-excel-export">Eksporter til Excel</button>
        <button type="button" class="home-drawer__link" id="home-drawer-followup-route">Oppfølgingsrute</button>
        <button type="button" class="home-drawer__link" id="home-drawer-privacy">Personvern</button>
        <button type="button" class="home-drawer__link" id="home-drawer-support">Support</button>
      </nav>
      <div class="home-drawer__footer">
        <button type="button" class="btn btn-text btn-logout" id="btn-logout">Logg ut</button>
      </div>
    </aside>
  </div>`
}

function renderInboxHtml() {
  if (inboxUiMode === 'messages') {
    return `<div class="view-inbox view-inbox--messages surface view-panel-enter">
    <button type="button" class="btn btn-back" id="btn-back-from-inbox">← Meny</button>
    <h2 class="subview-title">Meldinger</h2>
    <p class="inbox-lead inbox-lead--compact">Økter og bilder <strong>andre brukere</strong> har sendt til bruker-ID-en din. <strong>DelSky</strong> (mine økter og hent fra sky) finner du på forsiden eller i menyen under «DelSky».</p>
    <p id="incoming-shares-status" class="home-incoming__status" role="status" aria-live="polite"></p>
    <ul id="incoming-shares-list" class="home-incoming-list"></ul>
  </div>`
  }
  const mySessions = buildSessionRowsResumeHtml()
  return `<div class="view-inbox surface view-panel-enter">
    <button type="button" class="btn btn-back" id="btn-back-from-inbox">← Meny</button>
    <h2 class="subview-title">DelSky</h2>
    <div id="delsky-usage-panel">${renderDelskyUsagePanelHtml()}</div>
    <p class="inbox-lead">Økter du <strong>lagrer</strong> (og sky-knappen i oppdraget) synkes til delsky når nett og innstillinger tillater det. De ligger under <strong>Mine økter</strong> her og på Mac/PC med <strong>samme innlogging</strong>. Trykk <strong>Hent siste fra delsky</strong> på nett hvis lista er tom. «Del oppdrag» til annen bruker er noe annet.</p>
    <button type="button" class="btn btn-secondary btn-delsky-pull" id="btn-delsky-pull-now">Hent siste fra delsky</button>
    <p id="delsky-pull-status" class="delsky-pull-status" role="status" aria-live="polite"></p>
    <h3 class="inbox-section-title">Mine økter</h3>
    <div id="delsky-my-sessions-wrap" class="delsky-my-sessions-wrap">${mySessions}</div>
    <h3 class="inbox-section-title">Meldinger</h3>
    <p class="inbox-lead inbox-lead--compact">Økter og bilder <strong>andre brukere</strong> har sendt til bruker-ID-en din.</p>
    <p id="incoming-shares-status" class="home-incoming__status" role="status" aria-live="polite"></p>
    <ul id="incoming-shares-list" class="home-incoming-list"></ul>
  </div>`
}

/**
 * @param {number} bytes
 */
function formatDelskyUsageBytes(bytes) {
  const n = Number.isFinite(bytes) && bytes > 0 ? bytes : 0
  const gb = n / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 1 : 2)} GB`
  const mb = n / (1024 ** 2)
  return `${Math.max(0, Math.round(mb))} MB`
}

function delskyUsageStatusText() {
  if (!isScanixCloudApiConfigured()) {
    return 'Skyforbruk vises når cloud API er aktiv.'
  }
  if (delskyStorageUsage.status === 'loading') return 'Oppdaterer skyforbruk …'
  if (delskyStorageUsage.status === 'error') return 'Kunne ikke hente skyforbruk nå.'
  if (delskyStorageUsage.isOverLimit) {
    return 'Du er over anbefalt kvote på 50 GB.'
  }
  if (delskyStorageUsage.isNearLimit) {
    return 'Du nærmer deg kvoten på 50 GB.'
  }
  return 'Skyforbruk oppdateres fortløpende.'
}

function renderDelskyUsagePanelHtml() {
  const hasFreshUsage = delskyStorageUsage.status === 'ready'
  const used = hasFreshUsage
    ? formatDelskyUsageBytes(delskyStorageUsage.usedBytes)
    : '–'
  const quota = formatDelskyUsageBytes(delskyStorageUsage.quotaBytes || DELSKY_QUOTA_BYTES)
  const r2 = hasFreshUsage
    ? formatDelskyUsageBytes(delskyStorageUsage.bySource?.r2Bytes || 0)
    : '–'
  const supabase = hasFreshUsage
    ? formatDelskyUsageBytes(delskyStorageUsage.bySource?.supabaseBytes || 0)
    : '–'
  const pct = hasFreshUsage
    ? Math.max(0, Math.min(100, Math.round(delskyStorageUsage.percent)))
    : 0
  const stateClass = delskyStorageUsage.isOverLimit
    ? 'delsky-usage--over'
    : delskyStorageUsage.isNearLimit
      ? 'delsky-usage--near'
      : 'delsky-usage--ok'
  return `<section class="delsky-usage ${stateClass}" aria-label="Skyforbruk">
    <div class="delsky-usage__head">
      <strong>Skyforbruk</strong>
      <span id="delsky-usage-value">${escapeHtml(used)} / ${escapeHtml(quota)}</span>
    </div>
    <div class="delsky-usage__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Brukt skykvote">
      <span id="delsky-usage-bar-fill" class="delsky-usage__bar-fill" style="width:${pct}%"></span>
    </div>
    <div class="delsky-usage__meta">
      <span id="delsky-usage-percent">${hasFreshUsage ? `${pct}% brukt` : 'Venter på data …'}</span>
      <span id="delsky-usage-status">${escapeHtml(delskyUsageStatusText())}</span>
    </div>
    <div class="delsky-usage__sources" id="delsky-usage-sources">
      R2: ${escapeHtml(r2)} · Supabase: ${escapeHtml(supabase)}
    </div>
    <button type="button" class="btn btn-text delsky-usage__help-btn" id="btn-delsky-usage-help" aria-expanded="false" aria-controls="delsky-usage-help-text">Hva betyr dette?</button>
    <p class="delsky-usage__help" id="delsky-usage-help-text" hidden>
      R2 er bilde-lagring i sky. Supabase er annen skylagring appen bruker. Sammen viser de hvor mye av 50 GB-kvoten som er brukt.
    </p>
  </section>`
}

function applyDelskyUsagePanelToDom() {
  const host = document.getElementById('delsky-usage-panel')
  if (!host) return
  host.outerHTML = `<div id="delsky-usage-panel">${renderDelskyUsagePanelHtml()}</div>`
}

/**
 * @param {number} deltaBytes
 */
function bumpDelskyUsageOptimistic(deltaBytes) {
  if (!Number.isFinite(deltaBytes) || deltaBytes <= 0) return
  const used = Math.max(0, delskyStorageUsage.usedBytes + Math.floor(deltaBytes))
  const quota = delskyStorageUsage.quotaBytes || DELSKY_QUOTA_BYTES
  delskyStorageUsage.usedBytes = used
  delskyStorageUsage.percent = Math.min(100, (used / quota) * 100)
  delskyStorageUsage.isNearLimit = used >= quota * 0.85
  delskyStorageUsage.isOverLimit = used >= quota
  delskyStorageUsage.updatedAt = Date.now()
  if (view === 'inbox' && inboxUiMode === 'delsky') {
    applyDelskyUsagePanelToDom()
  }
}

/**
 * @param {{ force?: boolean }} [opts]
 */
async function refreshDelskyStorageUsage(opts = {}) {
  if (!currentUser?.id || !isScanixCloudApiConfigured()) return
  if (view !== 'inbox' || inboxUiMode !== 'delsky') return
  const now = Date.now()
  if (!opts.force && delskyStorageUsage.status === 'ready' && now - delskyStorageUsage.updatedAt < 3500) {
    return
  }
  delskyStorageUsage.status = 'loading'
  applyDelskyUsagePanelToDom()
  const summary = await cloudFetchStorageUsageSummary()
  if (!summary) {
    delskyStorageUsage.status = 'error'
    applyDelskyUsagePanelToDom()
    return
  }
  const quota = summary.quotaBytes > 0 ? summary.quotaBytes : DELSKY_QUOTA_BYTES
  const used = Math.max(0, summary.usedBytes)
  delskyStorageUsage = {
    usedBytes: used,
    quotaBytes: quota,
    percent: Math.min(100, Math.max(0, summary.percent || (used / quota) * 100)),
    bySource: summary.bySource || { r2Bytes: 0, supabaseBytes: 0 },
    updatedAt: Date.now(),
    status: 'ready',
    isNearLimit: Boolean(summary.nearLimit || used >= quota * 0.85),
    isOverLimit: Boolean(summary.overLimit || used >= quota),
  }
  applyDelskyUsagePanelToDom()
}

function scheduleDelskyUsageRefreshSoon() {
  if (delskyUsageDebouncedRefresh != null) return
  delskyUsageDebouncedRefresh = setTimeout(() => {
    delskyUsageDebouncedRefresh = null
    void refreshDelskyStorageUsage({ force: true })
  }, 900)
}

function stopDelskyUsagePolling() {
  if (delskyUsagePollId != null) {
    clearInterval(delskyUsagePollId)
    delskyUsagePollId = null
  }
  if (delskyUsageDebouncedRefresh != null) {
    clearTimeout(delskyUsageDebouncedRefresh)
    delskyUsageDebouncedRefresh = null
  }
}

function startDelskyUsagePolling() {
  stopDelskyUsagePolling()
  if (!currentUser?.id || !isScanixCloudApiConfigured()) return
  if (view !== 'inbox' || inboxUiMode !== 'delsky') return
  void refreshDelskyStorageUsage({ force: true })
  delskyUsagePollId = setInterval(() => {
    if (view === 'inbox' && inboxUiMode === 'delsky') {
      void refreshDelskyStorageUsage()
    }
  }, DELSKY_USAGE_POLL_MS)
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
    <button type="button" class="btn btn-secondary menu-user-logout" id="btn-menu-user-logout">Logg ut</button>
    <p class="menu-user-hint">Du kan også åpne hovedmenyen (☰) på forsiden og trykke «Logg ut» nederst.</p>
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

function renderMenuFrictionHtml() {
  const resumeHidden = frictionPreviousSessionId == null ? ' hidden' : ''
  return `<div class="friction-view view-panel-enter" aria-label="Friksjonsmåling">
    <header class="friction-view__top">
      <button type="button" class="friction-view__back btn btn-back" id="btn-back-from-friction">← Meny</button>
      <span class="friction-view__title">Friksjonsmåling</span>
      <button type="button" class="friction-view__my-pos btn-text" id="friction-btn-my-position" aria-label="Min posisjon">Min posisjon</button>
      <button type="button" class="friction-view__list-open btn-text" id="friction-btn-open-list">Liste</button>
    </header>
    <div id="friction-map" class="friction-view__map" role="application" aria-label="Kart"></div>
    <p id="friction-status" class="friction-view__status" role="status" aria-live="polite" hidden></p>
    <div class="friction-view__dock">
      <div class="friction-view__hud">
        <span class="friction-view__hud-label">Strekning</span>
        <span class="friction-view__hud-value" id="friction-distance-display">0 m</span>
      </div>
      <div class="friction-view__tabs" role="tablist" aria-label="Kontroller">
        <button type="button" class="friction-tab" id="friction-btn-start" role="tab" aria-selected="false">Start</button>
        <button type="button" class="friction-tab" id="friction-btn-stop" role="tab" aria-selected="false">Stopp</button>
        <button type="button" class="friction-tab" id="friction-btn-value" role="tab" aria-selected="false">Verdi</button>
      </div>
      <div class="friction-view__session-tools" role="group" aria-label="Økt og eksport">
        <button type="button" class="btn-text friction-view__session-btn" id="friction-btn-save-session">Lagre økt</button>
        <button type="button" class="btn-text friction-view__session-btn" id="friction-btn-resume-session"${resumeHidden}>Gjenoppta økt</button>
        <button type="button" class="btn-text friction-view__session-btn" id="friction-btn-export-xlsx">Eksporter Excel</button>
        <button type="button" class="btn-text friction-view__session-btn" id="friction-btn-new-session">Ny økt</button>
      </div>
    </div>
    <dialog id="friction-value-dialog" class="friction-value-dialog" aria-labelledby="friction-value-dialog-title">
      <div class="friction-value-dialog__inner">
        <h2 id="friction-value-dialog-title" class="friction-value-dialog__title">Friksjonsverdi</h2>
        <p class="friction-value-dialog__lead">Verdien knyttes til strekningen du nettopp målte (start–stopp).</p>
        <label class="friction-value-dialog__label" for="friction-value-input">Verdi</label>
        <input type="number" class="friction-value-dialog__input" id="friction-value-input" step="any" inputmode="decimal" placeholder="f.eks. 0,35" autocomplete="off" />
        <div class="friction-value-dialog__actions">
          <button type="button" class="btn-text" id="friction-value-cancel">Avbryt</button>
          <button type="button" class="btn-home btn-home--primary" id="friction-value-save">Lagre</button>
        </div>
      </div>
    </dialog>
    <dialog id="friction-list-dialog" class="friction-list-dialog" aria-labelledby="friction-list-dialog-title">
      <div class="friction-list-dialog__inner">
        <div class="friction-list-dialog__head">
          <h2 id="friction-list-dialog-title" class="friction-list-dialog__title">Lagrede målinger</h2>
          <div class="friction-list-dialog__head-actions">
            <button type="button" class="btn-text" id="friction-list-export-all-xlsx" title="Alle lagrede målinger">Excel alle</button>
            <button type="button" class="btn-text friction-list-dialog__show-all" id="friction-list-show-all">Vis alle på kart</button>
            <button type="button" class="btn-text" id="friction-list-close">Lukk</button>
          </div>
        </div>
        <div id="friction-list-body" class="friction-list-dialog__body" role="list"></div>
      </div>
    </dialog>
  </div>`
}

function renderMenuPhotosHtml() {
  const all = getAllPhotosFlat()
  if (!all.length) {
    menuPhotosOpenFolderKey = null
    return `<div class="view-sub view-menu-photos view-home surface--home view-photo-album-page view-panel-enter">
    <header class="traffic-group-top" aria-label="Bilder">
      <button type="button" class="traffic-group-back-btn" id="btn-back-from-menu-photos">← Meny</button>
      <h1 class="traffic-group-title">Bilder</h1>
      <span class="traffic-group-top-spacer" aria-hidden="true"></span>
    </header>
    <p class="menu-photos-page-lead">Ingen bilder ennå. Ta bilde fra forsiden eller i en økt.</p>
    <p class="menu-photos-page-sub">Når du har bilder, vises de i mapper etter sted/vei.</p>
  </div>`
  }
  const grouped = groupPhotosByRoadFolder(all)

  if (menuPhotosOpenFolderKey != null) {
    const row = grouped.find(([k]) => k === menuPhotosOpenFolderKey)
    if (!row) {
      menuPhotosOpenFolderKey = null
      return renderMenuPhotosHtml()
    }
    const [folderKey, items] = row
    const thumbs = items
      .map((ph) => {
        const t = formatPhotoAlbumRowTitle(ph)
        const h = formatPhotoAlbumRowHint(ph, t)
        return `<button type="button" class="home-dash-card menu-photos-thumb" data-photo-id="${escapeHtml(ph.id)}">
        <span class="home-dash-card__row">
          <span class="home-dash-card__content">
            <span class="home-dash-card__title">${escapeHtml(t)}</span>
            <span class="home-dash-card__hint">${escapeHtml(h)}</span>
          </span>
          <span class="home-dash-card__visual" aria-hidden="true">
            ${photoPreviewImgHtml(ph, 'home-dash-card__preview')}
          </span>
        </span>
      </button>`
      })
      .join('')
    return `<div class="view-sub view-menu-photos view-home surface--home view-photo-album-page view-panel-enter">
    <header class="traffic-group-top" aria-label="Mappe">
      <button type="button" class="traffic-group-back-btn" id="btn-back-from-menu-photos" aria-label="Tilbake til mapper">← Mapper</button>
      <h1 class="traffic-group-title">${escapeHtml(folderKey)}</h1>
      <span class="traffic-group-top-spacer" aria-hidden="true"></span>
    </header>
    <p class="menu-photos-detail__meta">${items.length} ${items.length === 1 ? 'bilde' : 'bilder'}</p>
    <div class="menu-photos-detail-list" id="menu-photos-folders">${thumbs}</div>
  </div>`
  }

  const foldersHtml = grouped
    .map(([folderKey, items]) => {
      const n = items.length
      const hint =
        n === 1 ? '1 bilde' : `${n} bilder`
      return `<button type="button" class="home-dash-card menu-photos-folder-row" data-folder-key="${escapeHtml(folderKey)}">
      <span class="home-dash-card__row menu-photos-folder-row__dash">
        <span class="home-dash-card__content">
          <span class="home-dash-card__title">${escapeHtml(folderKey)}</span>
          <span class="home-dash-card__hint">${hint}</span>
        </span>
        <span class="home-dash-card__visual menu-photos-folder-row__visual" aria-hidden="true">${menuPhotosMacFolderIconSvg()}</span>
        <span class="menu-photos-folder-row__chevron" aria-hidden="true">›</span>
      </span>
    </button>`
    })
    .join('')
  return `<div class="view-sub view-menu-photos view-home surface--home view-photo-album-page view-panel-enter">
    <header class="traffic-group-top" aria-label="Bilder">
      <button type="button" class="traffic-group-back-btn" id="btn-back-from-menu-photos" aria-label="Tilbake til meny">← Meny</button>
      <h1 class="traffic-group-title">Bilder</h1>
      <span class="traffic-group-top-spacer" aria-hidden="true"></span>
    </header>
    <p class="menu-photos-page-lead">Åpne en mappe for å se bildene. Navnet følger vei/sted.</p>
    <div class="menu-photos-folder-list" id="menu-photos-folders">${foldersHtml}</div>
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

function renderMenuTrafficGroupHtml() {
  const surfacePref = getSurfacePreference()
  const motorOn = surfacePref === 'motor'
  const activeOn = surfacePref === 'active'
  return `<div class="view-traffic-group view-home surface--home view-panel-enter">
    <header class="traffic-group-top" aria-label="Trafikantgruppe">
      <button type="button" class="traffic-group-back-btn" id="btn-back-from-menu-traffic-group">← Meny</button>
      <h1 class="traffic-group-title">Trafikantgruppe</h1>
      <span class="traffic-group-top-spacer" aria-hidden="true"></span>
    </header>
    <div class="traffic-group-stack">
      <nav class="home-dashboard traffic-group-dashboard" aria-label="Velg trafikantgruppe">
        <button type="button" class="home-dash-card traffic-group-choice${
          motorOn ? ' home-dash-card--accent' : ''
        }" data-traffic-pref="motor" aria-pressed="${motorOn}">
          <span class="home-dash-card__row">
            <span class="home-dash-card__content">
              <span class="home-dash-card__title">Kjørende</span>
            </span>
          </span>
        </button>
        <button type="button" class="home-dash-card traffic-group-choice${
          activeOn ? ' home-dash-card--accent' : ''
        }" data-traffic-pref="active" aria-pressed="${activeOn}">
          <span class="home-dash-card__row">
            <span class="home-dash-card__content">
              <span class="home-dash-card__title">Sykkel/gangsti</span>
            </span>
          </span>
        </button>
        <p class="traffic-group-below-copy">Når kjørebane og gang-/sykkelvei ligger like nær GPS, styrer dette hvilket segment som brukes til vegreferansen.</p>
      </nav>
    </div>
  </div>`
}

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   bbox: { minLng: number, minLat: number, maxLng: number, maxLat: number },
 * }} OfflineVegSuggestion
 */

/** Forslag-tilstand er kun i minnet og resettes når visningen forlates. */
/** @type {OfflineVegSuggestion[]} */
let offlineVegSuggestions = []
/** @type {OfflineVegSuggestion | null} */
let offlineVegSelected = null
/** Buffer rundt bbox i km – juster med slider. */
let offlineVegBufferKm = 1.5
let offlineVegSearchQuery = ''
let offlineVegSearchBusy = false
let offlineVegSearchError = ''
let offlineVegDownloadBusy = false
let offlineVegDownloadStatus = ''
let offlineVegDownloadError = ''
/** @type {AbortController | null} */
let offlineVegSearchAbort = null
/** @type {AbortController | null} */
let offlineVegDownloadAbort = null
/** @type {ReturnType<typeof setTimeout> | null} */
let offlineVegSearchDebounce = null
/** @type {import('leaflet').Map | null} */
let offlineVegMap = null
/** @type {import('leaflet').Rectangle | null} */
let offlineVegRect = null

const OFFLINE_VEG_BUFFER_MIN_KM = 0.5
const OFFLINE_VEG_BUFFER_MAX_KM = 15
/** Nedlasting «langs vei»: OSRM-rute foran bil når fart og spor tillater det. */
const OFFLINE_VEG_ROUTE_AHEAD_KM = 12
const OFFLINE_VEG_ROUTE_MAX_AIR_KM = 13.5
const OFFLINE_VEG_ROUTE_MIN_SPEED_MPS = 2.2
const OFFLINE_VEG_ROUTE_MAX_GPS_ACC_M = 62
const OFFLINE_VEG_ROUTE_TRACE_FRESH_MS = 14_000

/**
 * Brukerens valg + buffer → bbox.
 *
 * Strategi for å håndtere både korte og lange strekninger uten å sende hele
 * Norge til NVDB:
 *  - Hvis Nominatim-treffet selv er lite/middels (passer innenfor MAX_BBOX_DEG
 *    med plass til buffer), bruker vi treffets faktiske bbox + buffer. Da
 *    følger nedlastingen formen på vegen.
 *  - Hvis treffet er stort (typisk en hel kommune/region), klamper vi til
 *    midtpunktet og lar slideren bli effektiv radius i hver retning.
 *  - Til slutt klamper vi alltid til MAX_BBOX_DEG som siste sikkerhetsnett.
 */
function offlineVegEffectiveBbox() {
  if (!offlineVegSelected) return null
  const b = offlineVegSelected.bbox
  const dLat = b.maxLat - b.minLat
  const dLng = b.maxLng - b.minLng
  const SAFE_NOMINATIM_DEG = 0.18
  let seed
  if (dLat <= SAFE_NOMINATIM_DEG && dLng <= SAFE_NOMINATIM_DEG) {
    seed = b
  } else {
    const midLat = (b.minLat + b.maxLat) / 2
    const midLng = (b.minLng + b.maxLng) / 2
    seed = {
      minLat: midLat,
      maxLat: midLat + 1e-6,
      minLng: midLng,
      maxLng: midLng + 1e-6,
    }
  }
  const expanded = expandBboxKm(seed, offlineVegBufferKm)
  const clamped = clampBboxToMaxDeg(expanded)
  return bboxIsValid(clamped) ? clamped : null
}

/**
 * Sjekker om brukerens valg er for langt til å lastes ned i én bit.
 * Returnerer null hvis det ikke er for langt; ellers et objekt som beskriver
 * den faktiske lengden og hvor mye som faller utenfor.
 *
 * «For langt» betyr at Nominatim-treffet selv strekker seg lenger enn
 * MAX_BBOX_DEG (~38 km) i minst én retning, slik at vi har klampet til
 * midtpunkt + radius og dermed ikke får med endene av strekningen.
 *
 * @returns {{ lengthKm: number, coveredKm: number, missingKm: number } | null}
 */
function offlineVegSelectionTooLong() {
  if (!offlineVegSelected) return null
  const b = offlineVegSelected.bbox
  const dLat = b.maxLat - b.minLat
  const dLng = b.maxLng - b.minLng
  const midLat = (b.minLat + b.maxLat) / 2
  const cosLat = Math.max(0.05, Math.cos((midLat * Math.PI) / 180))
  const km = Math.max(dLat * 111, dLng * 111 * cosLat)
  const MAX_DEG = 0.35
  const longestDeg = Math.max(dLat, dLng)
  if (longestDeg <= MAX_DEG) return null
  const coveredKm = MAX_DEG * (dLat >= dLng ? 111 : 111 * cosLat)
  return {
    lengthKm: km,
    coveredKm,
    missingKm: Math.max(0, km - coveredKm),
  }
}

/**
 * Klamp bboxen rundt midtpunktet slik at hver dimensjon ikke overskrider
 * MAX_BBOX_DEG. Brukes som siste sikkerhetsnett mot urimelige forespørsler.
 * @param {{minLat:number,maxLat:number,minLng:number,maxLng:number}} b
 */
function clampBboxToMaxDeg(b) {
  const max = 0.35
  const dLat = b.maxLat - b.minLat
  const dLng = b.maxLng - b.minLng
  const midLat = (b.minLat + b.maxLat) / 2
  const midLng = (b.minLng + b.maxLng) / 2
  const halfLat = Math.min(dLat, max) / 2
  const halfLng = Math.min(dLng, max) / 2
  return {
    minLat: midLat - halfLat,
    maxLat: midLat + halfLat,
    minLng: midLng - halfLng,
    maxLng: midLng + halfLng,
  }
}

function renderMenuOfflineVegrefHtml() {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const meta = offlineVegrefMeta
  const segCount =
    meta && typeof meta.count === 'number' ? meta.count : 0
  const segCountStr = segCount.toLocaleString('nb-NO')
  const bbox = offlineVegEffectiveBbox()
  const areaKm2 = bbox ? estimateAreaKm2(bbox) : 0
  const areaStr = areaKm2 > 0 ? `${areaKm2.toFixed(1)} km²` : '–'
  const sliderValue = String(offlineVegBufferKm)
  const sliderHint = `${offlineVegBufferKm.toFixed(1).replace('.', ',')} km`
  const downloadDisabled =
    offline || offlineVegDownloadBusy || !offlineVegSelected
  const downloadLabel = offlineVegDownloadBusy
    ? 'Laster ned …'
    : 'Last ned til telefon'
  const queryAttr = escapeHtml(offlineVegSearchQuery)
  const offlineNotice = offline
    ? '<p class="offline-veg-banner" role="status">Du er uten nett. Søk og nedlasting krever tilkobling.</p>'
    : ''
  return `<div class="view-offline-veg view-traffic-group view-home surface--home view-panel-enter">
    <header class="traffic-group-top" aria-label="Veg uten nett">
      <button type="button" class="traffic-group-back-btn" id="btn-back-from-menu-offline-vegref">← Meny</button>
      <h1 class="traffic-group-title">Veg uten nett</h1>
      <span class="traffic-group-top-spacer" aria-hidden="true"></span>
    </header>
    <div class="offline-veg-stack">
      ${offlineNotice}
      <section class="offline-veg-card auth-card--glass" aria-labelledby="offline-veg-search-label">
        <label class="offline-veg-card__label" id="offline-veg-search-label" for="offline-veg-search-input">Søk etter veg eller sted</label>
        <input
          type="search"
          id="offline-veg-search-input"
          class="offline-veg-card__input auth-input--glass"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          inputmode="search"
          placeholder="F.eks. E6 Beisfjord, Saltstraumen, Rv 80"
          value="${queryAttr}"
        />
        <ul class="offline-veg-suggest" role="listbox" aria-label="Forslag"></ul>
        <div class="offline-veg-search-error-slot"></div>
      </section>

      <section class="offline-veg-card auth-card--glass" aria-labelledby="offline-veg-area-label">
        <div class="offline-veg-card__head">
          <span class="offline-veg-card__label" id="offline-veg-area-label">Område</span>
          <span class="offline-veg-card__meta">${escapeHtml(areaStr)}</span>
        </div>
        <div id="offline-veg-map" class="offline-veg-map" aria-label="Forhåndsvisning av nedlastingsområdet"></div>
        <label class="offline-veg-slider" for="offline-veg-buffer">
          <span class="offline-veg-slider__row">
            <span>Utvid område</span>
            <span class="offline-veg-slider__value">${escapeHtml(sliderHint)}</span>
          </span>
          <input
            type="range"
            id="offline-veg-buffer"
            min="${OFFLINE_VEG_BUFFER_MIN_KM}"
            max="${OFFLINE_VEG_BUFFER_MAX_KM}"
            step="0.5"
            value="${sliderValue}"
          />
        </label>
        <div class="offline-veg-toolong-slot"></div>
      </section>

      <section class="offline-veg-card auth-card--glass offline-veg-card--actions">
        <button type="button" class="offline-veg-action btn-auth-gradient btn-auth-gradient--teal" id="btn-offline-veg-download"${downloadDisabled ? ' disabled' : ''}>${downloadLabel}</button>
        <div class="offline-veg-download-status-slot"></div>
        <div class="offline-veg-download-error-slot"></div>
        <p class="offline-veg-fineprint">Lagret lokalt: <span class="offline-veg-fineprint-count">${segCountStr}</span> segmenter. Nedlastingen legger til vegdata fra Statens vegvesen (NVDB) for området du har valgt. Søkeforslagene er fra OpenStreetMap-geokoder.</p>
        <p class="offline-veg-fineprint offline-veg-fineprint--muted">Kjører du nå (god GPS og spor), bygges nedlastingsområdet langs veien ca. 12 km foran deg (OSRM) i stedet for bare luftlinje rundt søket — mindre terreng «ved siden av» veien. Ellers brukes kartutsnittet fra søket + utvidelse.</p>
        <p class="offline-veg-fineprint offline-veg-fineprint--muted">«Oppdater offline-pakke» under Innstillinger erstatter alt — inkludert områder du har lastet ned her.</p>
      </section>
    </div>
  </div>`
}

function renderMenuSettingsHtml() {
  const bundledVegref = isBundledOfflineVegref()
  const generatedAt =
    offlineVegrefMeta && typeof offlineVegrefMeta.generatedAt === 'string'
      ? escapeHtml(offlineVegrefMeta.generatedAt)
      : '–'
  const offlineError = offlineVegrefSyncError
    ? `<p class="menu-info-prose" role="alert">${escapeHtml(offlineVegrefSyncError)}</p>`
    : ''
  const traceOn = isVegrefDebugTraceEnabled()
  const registerTraceOn = isRegisterTraceDebugPersisted()
  const registerNetOn = isRegisterNetworkDebugPersisted()
  const storageTraceOn = isStorageDebugTraceEnabled()
  const vegrefHighData = getVegrefDataMode() === 'normal'
  const photoUploadAllowCellular = readPhotoUploadAllowOnCellular()
  const pilotMinDownloadOn = isMinDownloadMode()
  const pilotMinDownloadBuildLock = isMinDownloadBuild
  const offlineVegrefExplainerBundled = `<p class="menu-info-prose">Har du nett, installerer appen automatisk den <strong>innebygde</strong> vegreferanse-pakken fra app-filene (under <code class="menu-settings-code">/offline/</code>) til lokal lagring ved oppstart — <strong>ikke</strong> som egen nedlasting fra internett. Knappen under tvinger installasjonen på nytt (nyttig etter feil).</p>`
  const offlineVegrefExplainerRemote = `<p class="menu-info-prose">Har du nett, forsøker appen én gang å synke den innebygde offline-pakken etter oppstart (samme vertsleverandør som appen). Knappen under starter nedlasting med én gang eller tvinger oppdatering.</p>`
  const offlineVegrefExplainer = bundledVegref
    ? offlineVegrefExplainerBundled
    : offlineVegrefExplainerRemote
  const offlineVegrefBtnLabel = bundledVegref
    ? offlineVegrefReady
      ? 'Reinstaller innebygd pakke'
      : 'Installer innebygd pakke'
    : offlineVegrefReady
      ? 'Oppdater offline-pakke'
      : 'Last ned offline-pakke'
  return `<div class="view-sub surface view-panel-enter">
    <button type="button" class="btn btn-back" id="btn-back-from-menu-settings">← Meny</button>
    <h2 class="subview-title">Innstillinger</h2>
    <div class="menu-settings-tabs" role="tablist" aria-label="Innstillinger-faner">
      <button type="button" class="menu-settings-tab menu-settings-tab--active" id="tab-settings-offline" role="tab" aria-selected="true" aria-controls="panel-settings-offline">Offline</button>
      <button type="button" class="menu-settings-tab" id="tab-settings-vegref-debug" role="tab" aria-selected="false" aria-controls="panel-settings-vegref-debug">Vegref-debug</button>
      <button type="button" class="menu-settings-tab" id="tab-settings-register-trace" role="tab" aria-selected="false" aria-controls="panel-settings-register-trace">Reg.-spor</button>
    </div>
    <div class="menu-settings-panel" id="panel-settings-offline" role="tabpanel" aria-labelledby="tab-settings-offline">
      <div class="menu-card">
        <h3 class="menu-card__title">Offline vegreferanse</h3>
        <label class="menu-settings-trace-label">
          <input type="checkbox" id="chk-vegref-high-data"${vegrefHighData ? ' checked' : ''} />
          Hyppigere oppdatering (bruker mer mobildata)
        </label>
        <p class="menu-info-prose menu-info-prose--compact">Uten avkrysning (standard): lav databruk på forsiden — færre NVDB-kall, ingen automatisk «veg foran deg»-prefetch, og ingen stille lagring av rå segmenter under kjøring. Avkryss når du vil ha raskest mulig vegref på mobilnett (parallelle NVDB-kall der det støttes).</p>
        <p class="menu-info-prose">Uten nett eller når NVDB ikke svarer, brukes lagrede segmenter automatisk der de dekker posisjonen.</p>
        ${offlineVegrefExplainer}
        <p class="menu-info-prose menu-info-prose--warn">${bundledVegref ? '«Reinstaller innebygd pakke» erstatter alt i lokal vegref-lagring — inkludert egne strekninger fra «Veg uten nett».' : '«Oppdater offline-pakke» erstatter alt — inkludert egne strekninger lastet ned i «Veg uten nett».'}</p>
        <p class="menu-info-prose">Status: ${escapeHtml(offlineVegrefSyncStatus)}</p>
        <p class="menu-info-prose">Generert: ${generatedAt}</p>
        ${offlineError}
        <button type="button" class="btn btn-primary" id="btn-settings-download-offline-vegref"${offlineVegrefSyncBusy ? ' disabled' : ''}>${offlineVegrefBtnLabel}</button>
      </div>
      <div class="menu-card">
        <h3 class="menu-card__title">Delsky (bilder og økter)</h3>
        <label class="menu-settings-trace-label">
          <input type="checkbox" id="chk-photo-upload-cellular"${photoUploadAllowCellular ? ' checked' : ''} />
          Tillat synk på mobilnett
        </label>
        <p class="menu-info-prose menu-info-prose--compact">Standard: på mobilnett (ikke Wi‑Fi) venter <strong>bildekøen</strong> og <strong>oppdatering av delsky</strong> (kun økter/bilder som faktisk lastes opp, ikke hele øktarkivet) til Wi‑Fi eller kablet nett — for å spare mobildata. Kryss av for å synke til sky også på 4G/5G når du er innlogget (kan bli mange MB).</p>
        <p class="menu-info-prose menu-info-prose--compact">Ved innlogging på mobilnett spør appen om du vil <strong>hente</strong> alt fra delsky; avbryt hvis du vil spare data (da brukes bare det som allerede ligger på enheten). På Wi‑Fi skjer henting og sending automatisk for samme bruker — da vises det samme på telefon og nettleser.</p>
        <p class="menu-info-prose menu-info-prose--compact">Samme avkrysning styrer også <strong>nedlasting av full bildeoppløsning</strong> fra sky i album (meny «Bilder»): på mobilnett uten avkrysning brukes lokalt/miniatur fra sky; unngår store MB per trykk. I installert app (Capacitor) brukes systemets nettverkstype direkte. I vanlig nettleser uten Network Information (ofte iOS Safari) behandles ukjent type som «ikke Wi‑Fi». Metadata og miniatyr synkes fortsatt; full bildefil til sky går på Wi‑Fi eller når du har krysset av over. Full oppløsning lagres lokalt (IndexedDB) til da.</p>
        <button type="button" class="btn btn-ghost" id="btn-settings-debug-storage">Debug lagring (økter)</button>
        <p class="menu-info-prose menu-info-prose--compact">Viser lagringsnøkler i konsollen (Safari Web Inspector/Xcode) og kort status i appen.</p>
        <label class="menu-settings-trace-label">
          <input type="checkbox" id="chk-storage-debug-trace"${storageTraceOn ? ' checked' : ''} />
          Spill inn lagringslogg som overlever app-lukking
        </label>
        <div class="menu-settings-trace-actions">
          <button type="button" class="btn btn-ghost" id="btn-settings-copy-storage-trace">Kopier lagringslogg</button>
          <button type="button" class="btn btn-ghost" id="btn-settings-clear-storage-trace">Tøm lagringslogg</button>
        </div>
        <p class="menu-info-prose menu-info-prose--compact">Slå på, reproducer feilen (ta bilde/lag økt, lukk app helt), åpne appen igjen og trykk «Kopier lagringslogg».</p>
      </div>
      <div class="menu-card">
        <h3 class="menu-card__title">Prøvedrift (minimal nedlasting)</h3>
        <label class="menu-settings-trace-label">
          <input type="checkbox" id="chk-pilot-min-download"${pilotMinDownloadOn ? ' checked' : ''}${pilotMinDownloadBuildLock ? ' disabled' : ''} />
          Pilot: så lite mobildata som mulig
        </label>
        <p class="menu-info-prose menu-info-prose--compact">Slå på for feltprøving: <strong>samme MapTiler-bakgrunn som ellers</strong> når API-nøkkel er bygget inn (vektor overalt — lys og mørkt underlag, uavhengig av Wi‑Fi eller mobilnett). Kartfliser og støttefiler mellomlagres i Service Worker (gjentatte besøk samme sted treffer cache). Uten nøkkel brukes OpenStreetMap-raster (fallback). Ingen NVDB-nett eller vær-API, ingen automatisk sky-synk av økter/bilder, ingen innboks-polling. Kontraktskontroll, Meldinger og Finn objekter skjules. Vegref bruker kun lagret offline-data der det finnes — ellers koordinat-fallback. <strong>Lukk og åpne kart</strong> (eller start appen på nytt) etter endring så bakgrunnskartet sikrer riktig modus.</p>
        ${
          pilotMinDownloadBuildLock
            ? '<p class="menu-info-prose menu-info-prose--compact">Dette installasjonsbygget har pilot <strong>alltid på</strong> (kan ikke slås av her).</p>'
            : ''
        }
      </div>
    </div>
    <div class="menu-settings-panel menu-settings-panel--hidden" id="panel-settings-vegref-debug" role="tabpanel" aria-labelledby="tab-settings-vegref-debug" hidden>
      <div class="menu-card">
        <h3 class="menu-card__title">Vegref-debug (felt / fine-tuning)</h3>
        <p class="menu-info-prose">Samme spor som tidligere, pluss automatisk merking av mistenkelige mønstre: raske NVDB-bytter, raske strekningsbytter, mange vekslinger på kort tid, og primærtekst som ser ut som vegnr uten veinavn/typelinje.</p>
        <label class="menu-settings-trace-label">
          <input type="checkbox" id="chk-vegref-debug-trace"${traceOn ? ' checked' : ''} />
          Spill inn detaljert vegref-spor (GPS → pipeline → skjerm + avvik)
        </label>
        <p class="menu-info-prose menu-info-prose--compact">Slå på før du kjører eller reproduserer. Lagres lokalt (ca. 240 siste hendelser). «Kopier» inkluderer JSON du kan lime i chat eller lagre.</p>
        <div class="menu-settings-trace-actions">
          <button type="button" class="btn btn-ghost" id="btn-settings-copy-vegref-debug">Kopier vegref-debug</button>
          <button type="button" class="btn btn-ghost" id="btn-settings-clear-vegref-trace">Tøm spor</button>
        </div>
        <p class="menu-info-prose menu-info-prose--compact">Avvikstyper i sporet: <code class="menu-settings-code">anomaly_rapid_nvdb_flip</code> og <code class="menu-settings-code">anomaly_rapid_seg_change</code> (kun når kilden ikke er offline-pakke — ellers ville normale segmentgrenser fylle sporet), <code class="menu-settings-code">anomaly_road_hop_burst</code>, <code class="menu-settings-code">anomaly_vegnr_without_street</code>.</p>
      </div>
    </div>
    <div class="menu-settings-panel menu-settings-panel--hidden" id="panel-settings-register-trace" role="tabpanel" aria-labelledby="tab-settings-register-trace" hidden>
      <div class="menu-card">
        <h3 class="menu-card__title">Registrering / lagring (debug)</h3>
        <p class="menu-info-prose">Logger til <strong>konsollen</strong> (Safari Web Inspector / Xcode) når du registrerer tellertrykk, lagrer økt, bygger kartmarkører på nytt osv. Søk etter <code class="menu-settings-code">[Scanix regtrace]</code>.</p>
        <label class="menu-settings-trace-label">
          <input type="checkbox" id="chk-register-trace-debug"${registerTraceOn ? ' checked' : ''} />
          Spor datastørrelse og årsak (<code class="menu-settings-code">persist</code> / <code class="menu-settings-code">rebuildMarkers</code>)
        </label>
        <p class="menu-info-prose menu-info-prose--compact">Viser bl.a. UTF-8-størrelse på gjeldende økt-JSON og på hele localStorage-skriving (hele app-tilstand). Nyttig for å se om minne-topper kommer fra bilder i økta, ikke fra den røde prikken alene.</p>
        <p class="menu-info-prose menu-info-prose--compact">Du kan også åpne appen med <code class="menu-settings-code">?regtrace=1</code> i URL-en (engangs) uten å lagre her.</p>
        <label class="menu-settings-trace-label">
          <input type="checkbox" id="chk-register-net-debug"${registerNetOn ? ' checked' : ''} />
          Logg nett omtrentlig per registrering (<code class="menu-settings-code">[Scanix regnet]</code> — NVDB + Supabase JSON)
        </label>
        <p class="menu-info-prose menu-info-prose--compact">Viser <strong>omtrent</strong> ut/inn for HTTP-kropp (ikke iOS sin mobildata-måler). Supabase-linjen kommer typisk ~2 s etter lagring og kan gjelde flere trykk samlet. Hvis du ser <code class="menu-settings-code">supabase_push_skipped</code> med <code class="menu-settings-code">photo_skeletons_block_full_upsert</code>, står bilder fortsatt som «skall» uten <code class="menu-settings-code">storage</code>-sti i sky — da ventes opplasting/piksel. Bilder som allerede ligger i bucket synkes med økta. Kartfliser og andre kall telles ikke her.</p>
        <p class="menu-info-prose menu-info-prose--compact">URL: <code class="menu-settings-code">?regnet=1</code> (engangs).</p>
      </div>
    </div>
  </div>`
}

function buildVegrefDebugReportText() {
  const rows = getVegrefMetrics()
  /* home-meter-pipeline: NVDB-treff med meterM; home-meter-tween: animasjon mellom to meterverdier */
  const meterRows = rows.filter((r) => {
    const t = String(r?.type || '')
    return t.startsWith('home-meter') || t === 'home-meter-override'
  })
  const startupRows = rows.filter((r) =>
    String(r?.type || '').startsWith('home-startup-'),
  )
  const byReason = {}
  for (const r of meterRows) {
    const key = `${String(r.type || 'unknown')}:${String(r.reason || 'n/a')}`
    byReason[key] = (byReason[key] || 0) + 1
  }
  const trace = getVegrefDebugTraceEntries()
  const anomalyEvents = trace.filter((row) =>
    String(row?.ev || '').startsWith('anomaly_'),
  )
  let ua = ''
  try {
    ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  } catch {
    ua = ''
  }
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      appVersion: String(appPackage?.version || 'unknown'),
      userAgent: ua.slice(0, 400),
      onLine:
        typeof navigator !== 'undefined' ? navigator.onLine : null,
      secureContext:
        typeof window !== 'undefined' ? window.isSecureContext : null,
      offlineVegrefReady,
      offlineVegrefStatus: offlineVegrefSyncStatus,
      surfacePreference: getSurfacePreference(),
      vegrefDetailTraceEnabled: isVegrefDebugTraceEnabled(),
      vegrefDetailTraceCount: trace.length,
      vegrefDetailTrace: trace.slice(-120),
      vegrefAnomalyCount: anomalyEvents.length,
      vegrefAnomalyTail: anomalyEvents.slice(-24),
      totalMetrics: rows.length,
      meterMetrics: meterRows.length,
      startupMetrics: startupRows.length,
      byReason,
      lastStartupEvents: startupRows.slice(-30),
      lastMeterEvents: meterRows.slice(-30),
    },
    null,
    2,
  )
}

async function copyVegrefDebugReport() {
  const text = buildVegrefDebugReportText()
  if (
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text)
      alert('Vegref-debug kopiert. Lim inn i chatten.')
      return
    } catch {
      /* fallback below */
    }
  }
  window.prompt('Kopier vegref-debug og lim inn i chatten:', text)
}

function renderMenuHapticsHtml() {
  const on = readHapticEnabled()
  const curId = readHapticProfileId()
  const radios = HAPTIC_PROFILES.map(
    (p) => `
    <label class="haptic-preset-option${p.id === curId ? ' haptic-preset-option--selected' : ''}">
      <input type="radio" name="haptic-preset" value="${escapeHtml(p.id)}" class="haptic-preset-option__input"${p.id === curId ? ' checked' : ''} />
      <span class="haptic-preset-option__body">
        <span class="haptic-preset-option__label">${escapeHtml(p.label)}</span>
        <span class="haptic-preset-option__hint">${escapeHtml(p.hint)}</span>
      </span>
    </label>`,
  ).join('')
  return `<div class="view-sub surface view-panel-enter">
    <button type="button" class="btn btn-back" id="btn-back-from-menu-haptics">← Meny</button>
    <h2 class="subview-title">Haptisk tilbakemelding</h2>
    <p class="menu-info-prose menu-info-prose--compact">Kort vibrasjon når du <strong>tar bilde</strong> (kamera / KMT) og når du <strong>registrerer</strong> et punkt i økta. På iPhone/Android-app brukes systemets haptikk; i nettleser brukes vibrasjon der nettleseren tillater det.</p>
    <div class="menu-card menu-card--haptics">
      <h3 class="menu-card__title">Slå på</h3>
      <label class="menu-settings-trace-label">
        <input type="checkbox" id="chk-haptic-enabled"${on ? ' checked' : ''} />
        Bruk haptisk tilbakemelding
      </label>
    </div>
    <div class="menu-card menu-card--haptics">
      <h3 class="menu-card__title">Mønster</h3>
      <p class="menu-info-prose menu-info-prose--compact">Velg styrke og «følelse» for bilde og registrering.</p>
      <div class="haptic-preset-grid" role="radiogroup" aria-label="Haptisk mønster">${radios}</div>
      <button type="button" class="btn btn-ghost haptic-test-btn" id="btn-haptic-test">Prøv valgt mønster</button>
    </div>
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

function renderMenuFollowUpRouteHtml() {
  const delskyRow =
    currentUser?.id && !isMinDownloadMode()
      ? `<div class="followup-delsky-row">
      <button type="button" class="btn btn-secondary" id="btn-followup-push-delsky">Send til delsky</button>
      <button type="button" class="btn btn-secondary" id="btn-followup-pull-delsky">Hent fra delsky</button>
    </div>`
      : ''
  return `<div class="view-sub surface view-panel-enter followup-route-list-view">
    <button type="button" class="btn btn-back" id="btn-back-from-menu-followup">← Meny</button>
    <h2 class="subview-title">Oppfølgingsrute</h2>
    <p class="menu-info-prose followup-lead">Legg inn <strong>veg</strong> (f.eks. FV7552) og <strong>meter</strong> på kartet. Punkter hentes fra NVDB. Rutene ligger som standard <strong>bare lokalt</strong> på enheten. Når du er innlogget, kan du med knappene under <strong>sende dem til eller hente dem fra delsky</strong> — de synkes ikke dit automatisk. <strong>Eksporter</strong>/<strong>Importer</strong> JSON fungerer også uten delsky.</p>
    ${delskyRow}
    <div class="followup-toolbar">
      <button type="button" class="btn btn-home btn-home--primary" id="btn-followup-new">Ny rute</button>
      <button type="button" class="btn btn-secondary" id="btn-followup-export-json">Eksporter JSON</button>
      <button type="button" class="btn btn-secondary" id="btn-followup-import-json">Importer JSON</button>
    </div>
    <input type="file" id="followup-import-file" class="photo-input-hidden" accept="application/json,.json" />
    <p id="followup-list-status" class="followup-status" role="status" aria-live="polite"></p>
    <ul id="followup-saved-list" class="followup-saved-list" aria-label="Lagrede oppfølgingsruter"></ul>
  </div>`
}

function renderFollowUpRouteEditHtml() {
  const title = followUpDraft?.title
    ? escapeHtml(followUpDraft.title)
    : ''
  return `<div class="view-sub followup-route-edit-view">
    <header class="followup-edit-top surface">
      <button type="button" class="btn btn-text followup-edit-back" id="btn-followup-edit-back" aria-label="Tilbake">←</button>
      <input type="text" id="followup-edit-title" class="followup-edit-title-input" maxlength="120" placeholder="Navn på rute" value="${title}" autocomplete="off" />
    </header>
    <div class="followup-edit-map-card surface">
      <div id="followup-edit-map" class="followup-edit-map" role="application" aria-label="Kart med punkter"></div>
    </div>
    <section class="followup-edit-panel surface">
      <h3 class="followup-panel-heading">Nytt punkt</h3>
      <label class="followup-field">
        <span class="followup-field__label">Veg</span>
        <input type="text" id="followup-road-input" class="followup-input" list="followup-road-datalist" placeholder="FV7552" autocomplete="off" autocapitalize="characters" />
        <datalist id="followup-road-datalist"></datalist>
      </label>
      <div class="followup-field-row">
        <label class="followup-field followup-field--half">
          <span class="followup-field__label">Strekning (S)</span>
          <input type="number" id="followup-s-input" class="followup-input" min="1" step="1" value="1" />
        </label>
        <label class="followup-field followup-field--half">
          <span class="followup-field__label">Del (D)</span>
          <input type="number" id="followup-d-input" class="followup-input" min="1" step="1" value="1" />
        </label>
      </div>
      <label class="followup-field">
        <span class="followup-field__label">Meter</span>
        <input type="number" id="followup-meter-input" class="followup-input" min="0" step="1" placeholder="345" />
      </label>
      <button type="button" class="btn btn-home btn-home--primary followup-add-btn" id="btn-followup-add-point">Legg til punkt</button>
      <p id="followup-add-feedback" class="followup-feedback" role="status" aria-live="polite"></p>
      <div class="followup-edit-actions">
        <button type="button" class="btn btn-secondary" id="btn-followup-save-draft">Lagre rute</button>
        <button type="button" class="btn btn-secondary" id="btn-followup-open-fullmap">Ferdig · fullskjerm</button>
      </div>
    </section>
    <div id="followup-fullscreen-shell" class="followup-fullscreen-shell" hidden>
      <div class="followup-fullscreen-chrome surface">
        <button type="button" class="btn btn-text" id="btn-followup-fs-close" aria-label="Lukk fullskjerm">Lukk</button>
        <span id="followup-fs-title" class="followup-fs-title"></span>
      </div>
      <div id="followup-fs-map" class="followup-fs-map" role="application" aria-label="Fullskjerm kart"></div>
    </div>
  </div>`
}

function renderMenuExcelExportHtml() {
  return `<div class="view-sub view-panel-enter view-sub--excel view-sub--excel-flat">
    <button type="button" class="btn btn-back" id="btn-back-from-menu-excel-export">← Meny</button>
    <h2 class="subview-title">Excel</h2>
    <p class="menu-info-prose excel-sheet-lead">Rediger cellene under. I veg-kolonner (Vegvei, Vegnr, S, D, Meter) bruker du «Lås» ved den enkelte cellen for å stoppe GPS der – andre rader i samme kolonne kan fortsatt følge GPS.</p>
    <div class="excel-sheet-shell">
      <p id="excel-sheet-status" class="excel-sheet-status" role="status" aria-live="polite"></p>
      <div class="excel-sheet-toolbar excel-sheet-toolbar--grid">
        <div class="excel-sheet-toolbar__row excel-sheet-toolbar__row--3">
          <button type="button" class="excel-sheet__tool" id="btn-excel-sheet-add-row">Legg til rad</button>
          <button type="button" class="excel-sheet__tool" id="btn-excel-sheet-add-col">Legg til kolonne</button>
          <button type="button" class="excel-sheet__tool excel-sheet__tool--primary" id="btn-excel-sheet-export">Last ned .xlsx</button>
        </div>
        <div class="excel-sheet-toolbar__row excel-sheet-toolbar__row--2">
          <button type="button" class="excel-sheet__tool" id="btn-excel-sheet-fill-vegref">Synk alle veg fra GPS</button>
          <button type="button" class="excel-sheet__tool" id="btn-excel-sheet-clear">Tøm arket</button>
        </div>
      </div>
      <div class="excel-sheet-legend" aria-hidden="true">
        <span class="excel-sheet-legend__item"><span class="excel-sheet-legend__sw excel-sheet-legend__sw--live"></span> Veg-kolonne følger GPS</span>
        <span class="excel-sheet-legend__item"><span class="excel-sheet-legend__sw excel-sheet-legend__sw--locked"></span> Låst celle (med «Lås» på raden)</span>
      </div>
      <div class="excel-sheet-table-wrap">
        <table class="excel-sheet-table" id="excel-sheet-table" aria-label="Egne data">
          <thead id="excel-sheet-thead">
            <tr id="excel-sheet-header-row"></tr>
          </thead>
          <tbody id="excel-sheet-tbody"></tbody>
        </table>
      </div>
    </div>
    <p class="menu-info-prose excel-sheet-build-hint" role="status">v${escapeHtml(String(appPackage?.version ?? '?'))}</p>
  </div>`
}

const EXCEL_MIN_COLS = 2
const EXCEL_COL_DRAG_HOLD_MS = 1000
const EXCEL_VEG_POLL_MS = 450

function setExcelSheetStatus(msg) {
  const el = document.getElementById('excel-sheet-status')
  if (el) el.textContent = msg || ''
}

/**
 * @param {string} header
 * @returns {'vegvei' | 'vegnr' | 's' | 'd' | 'meter' | null}
 */
function excelVegFieldForHeader(header) {
  const x = String(header).trim().toLowerCase()
  if (x === 'vegvei') return 'vegvei'
  if (x === 'vegnr' || x === 'vegnummer') return 'vegnr'
  if (x === 's') return 's'
  if (x === 'd') return 'd'
  if (x === 'meter') return 'meter'
  return null
}

/**
 * @param {'vegvei' | 'vegnr' | 's' | 'd' | 'meter'} field
 * @param {{ vegvei: string, vegnr: string, s: string, d: string, meter: string }} snap
 */
function excelSnapValueForField(field, snap) {
  return String(snap[field] ?? '')
}

/**
 * @param {{ headers: string[], rows: { id: string, cells: string[], vegLocked?: boolean[] }[] }} state
 */
function excelSheetSyncVegLockChrome(state) {
  const theadRow = document.getElementById('excel-sheet-header-row')
  const tbody = document.getElementById('excel-sheet-tbody')
  if (!theadRow || !tbody) return
  const trList = [...tbody.querySelectorAll('tr')]
  for (let j = 0; j < state.headers.length; j++) {
    const isVeg = excelVegFieldForHeader(state.headers[j]) != null
    const th = theadRow.children[j]
    if (th instanceof HTMLElement) {
      th.classList.toggle('excel-sheet-th--veg', isVeg)
      th.classList.remove('excel-sheet-col--veg-locked', 'excel-sheet-col--veg-live')
    }
    for (let ri = 0; ri < trList.length; ri++) {
      const row = state.rows[ri]
      const vl = row?.vegLocked || []
      const locked = isVeg && Boolean(vl[j])
      const tr = trList[ri]
      const td = tr?.children[j]
      if (td instanceof HTMLElement) {
        td.classList.toggle('excel-sheet-col--veg-locked', Boolean(locked))
        td.classList.toggle('excel-sheet-col--veg-live', isVeg && !locked)
      }
      const lockBtn = td?.querySelector('.excel-sheet-cell-lock')
      if (lockBtn instanceof HTMLButtonElement && isVeg) {
        lockBtn.textContent = locked ? 'Lås opp' : 'Lås'
        lockBtn.setAttribute('aria-pressed', locked ? 'true' : 'false')
      }
      const inp = tr?.querySelector(`input[data-excel-col="${j}"]`)
      if (inp instanceof HTMLInputElement && isVeg) {
        inp.title = locked
          ? 'Låst – oppdateres ikke fra GPS'
          : 'Følger GPS'
      } else if (inp instanceof HTMLInputElement) {
        inp.removeAttribute('title')
      }
    }
  }
}

function refreshExcelSheetLiveVegref() {
  if (view !== 'menuExcelExport') return
  const tbody = document.getElementById('excel-sheet-tbody')
  if (!tbody) return
  const st = loadExcelSheetState()
  const snap = getHomeVegrefExcelSnapshot()
  const trList = [...tbody.querySelectorAll('tr')]
  excelSheetVegrefApplying = true
  try {
    for (let ri = 0; ri < st.rows.length; ri++) {
      const row = st.rows[ri]
      const vl = row.vegLocked || []
      const tr = trList[ri]
      if (!tr) continue
      for (let j = 0; j < st.headers.length; j++) {
        const field = excelVegFieldForHeader(st.headers[j])
        if (!field || vl[j]) continue
        const val = excelSnapValueForField(field, snap)
        const inp = tr.querySelector(`input[data-excel-col="${j}"]`)
        if (inp instanceof HTMLInputElement) {
          const prev = inp.value
          inp.value = val
          if (prev !== val) {
            inp.classList.add('excel-sheet-input--vegflash')
            window.setTimeout(() => {
              inp.classList.remove('excel-sheet-input--vegflash')
            }, 420)
          }
        }
      }
    }
  } finally {
    excelSheetVegrefApplying = false
  }
  persistExcelSheetFromDom()
  excelSheetSyncVegLockChrome(loadExcelSheetState())
}

function copyExcelColumnToColumn(sourceIdx, targetIdx) {
  if (sourceIdx === targetIdx) return
  persistExcelSheetFromDom()
  const st = loadExcelSheetState()
  if (
    sourceIdx < 0 ||
    targetIdx < 0 ||
    sourceIdx >= st.headers.length ||
    targetIdx >= st.headers.length
  )
    return
  st.headers[targetIdx] = st.headers[sourceIdx]
  for (const r of st.rows) {
    while (r.cells.length <= Math.max(sourceIdx, targetIdx)) r.cells.push('')
    r.cells[targetIdx] = r.cells[sourceIdx] ?? ''
    if (!r.vegLocked) r.vegLocked = Array(st.headers.length).fill(false)
    while (r.vegLocked.length < st.headers.length) r.vegLocked.push(false)
    r.vegLocked[targetIdx] = Boolean(r.vegLocked[sourceIdx])
  }
  saveExcelSheetState(st)
  renderExcelSheetTable(loadExcelSheetState())
  refreshExcelSheetLiveVegref()
  setExcelSheetStatus('Kolonne kopiert.')
  window.setTimeout(() => setExcelSheetStatus(''), 2500)
}

/**
 * @param {AbortSignal} signal
 */
function bindExcelColumnDragListeners(signal) {
  const theadRow = document.getElementById('excel-sheet-header-row')
  if (!theadRow) return

  let holdTimer = null
  let sourceCol = -1
  let dragging = false
  let startX = 0
  let startY = 0

  const clearHold = () => {
    if (holdTimer != null) {
      clearTimeout(holdTimer)
      holdTimer = null
    }
  }

  const clearDragClasses = () => {
    document
      .querySelectorAll('.excel-sheet-col--drag-source')
      .forEach((el) => el.classList.remove('excel-sheet-col--drag-source'))
    document
      .querySelectorAll('.excel-sheet-col--drag-target')
      .forEach((el) => el.classList.remove('excel-sheet-col--drag-target'))
  }

  const nDataCols = () => Math.max(0, theadRow.children.length - 1)

  /**
   * @param {number} j
   * @param {'source' | 'target'} kind
   */
  const highlightColumn = (j, kind) => {
    if (j < 0 || j >= nDataCols()) return
    const cls =
      kind === 'source' ? 'excel-sheet-col--drag-source' : 'excel-sheet-col--drag-target'
    const th = theadRow.children[j]
    if (th instanceof HTMLElement) th.classList.add(cls)
    const tbody = document.getElementById('excel-sheet-tbody')
    if (!tbody) return
    for (const tr of tbody.querySelectorAll('tr')) {
      const td = tr.children[j]
      if (td instanceof HTMLElement) td.classList.add(cls)
    }
  }

  const onDocMove = (e) => {
    if (!dragging) return
    clearDragClasses()
    highlightColumn(sourceCol, 'source')
    const el = document.elementFromPoint(e.clientX, e.clientY)
    if (!(el instanceof Element)) return
    const th = el.closest('#excel-sheet-header-row th')
    if (!th || !theadRow.contains(th)) return
    const tidx = [...theadRow.children].indexOf(th)
    if (tidx < 0 || tidx >= nDataCols()) return
    if (tidx !== sourceCol) highlightColumn(tidx, 'target')
  }

  const onDocUp = (e) => {
    if (!dragging) {
      document.removeEventListener('pointermove', onDocMove)
      document.removeEventListener('pointerup', onDocUp)
      document.removeEventListener('pointercancel', onDocUp)
      return
    }
    const el = document.elementFromPoint(e.clientX, e.clientY)
    let targetCol = -1
    if (el instanceof Element) {
      const th = el.closest('#excel-sheet-header-row th')
      if (th && theadRow.contains(th)) {
        targetCol = [...theadRow.children].indexOf(th)
        if (targetCol >= nDataCols()) targetCol = -1
      }
    }
    clearDragClasses()
    dragging = false
    document.removeEventListener('pointermove', onDocMove)
    document.removeEventListener('pointerup', onDocUp)
    document.removeEventListener('pointercancel', onDocUp)
    if (sourceCol >= 0 && targetCol >= 0 && sourceCol !== targetCol) {
      copyExcelColumnToColumn(sourceCol, targetCol)
    } else {
      setExcelSheetStatus('')
    }
    sourceCol = -1
  }

  const onGripPointerDown = (e) => {
    if (!(e.target instanceof Element)) return
    const grip = e.target.closest('.excel-sheet__col-grip')
    if (!grip) return
    const col = Number(grip.dataset.excelCol)
    if (!Number.isFinite(col)) return
    e.preventDefault()
    try {
      grip.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    sourceCol = col
    startX = e.clientX
    startY = e.clientY
    clearHold()
    holdTimer = window.setTimeout(() => {
      holdTimer = null
      dragging = true
      highlightColumn(sourceCol, 'source')
      setExcelSheetStatus('Dra til målkolonne og slipp.')
      document.addEventListener('pointermove', onDocMove, { passive: true })
      document.addEventListener('pointerup', onDocUp)
      document.addEventListener('pointercancel', onDocUp)
    }, EXCEL_COL_DRAG_HOLD_MS)
  }

  const onGripPointerMove = (e) => {
    if (holdTimer == null) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (dx * dx + dy * dy > 144) {
      clearHold()
      sourceCol = -1
    }
  }

  const onGripPointerUp = () => {
    if (dragging) return
    clearHold()
    sourceCol = -1
  }

  theadRow.addEventListener('pointerdown', onGripPointerDown, { signal })
  theadRow.addEventListener('pointermove', onGripPointerMove, { signal })
  theadRow.addEventListener('pointerup', onGripPointerUp, { signal })
  theadRow.addEventListener('pointercancel', onGripPointerUp, { signal })
}

/**
 * @param {{ headers: string[], rows: { id: string, cells: string[], vegLocked?: boolean[] }[] }} state
 */
function renderExcelSheetTable(state) {
  const theadRow = document.getElementById('excel-sheet-header-row')
  const tbody = document.getElementById('excel-sheet-tbody')
  if (!theadRow || !tbody) return
  theadRow.replaceChildren()
  state.headers.forEach((h, i) => {
    const th = document.createElement('th')
    const vegField = excelVegFieldForHeader(h)
    if (vegField) th.classList.add('excel-sheet-th--veg')
    const grip = document.createElement('button')
    grip.type = 'button'
    grip.className = 'excel-sheet__col-grip'
    grip.dataset.excelCol = String(i)
    grip.setAttribute(
      'aria-label',
      `Kolonne ${i + 1}: hold og dra for å kopiere til annen kolonne`,
    )
    grip.title = 'Hold ca. 1 s, deretter dra til målkolonne'
    grip.textContent = '⋮'
    const wrap = document.createElement('div')
    wrap.className = 'excel-sheet-th-wrap'
    wrap.appendChild(grip)
    const inp = document.createElement('input')
    inp.type = 'text'
    inp.className = 'excel-sheet-input excel-sheet-header-input'
    inp.dataset.excelCol = String(i)
    inp.value = h
    inp.placeholder = `Kolonne ${i + 1}`
    inp.autocomplete = 'off'
    wrap.appendChild(inp)
    if (state.headers.length > EXCEL_MIN_COLS) {
      const rm = document.createElement('button')
      rm.type = 'button'
      rm.className = 'btn btn-ghost excel-sheet-remove-col'
      rm.dataset.excelCol = String(i)
      rm.textContent = '×'
      rm.setAttribute('aria-label', `Fjern kolonne ${i + 1}`)
      wrap.appendChild(rm)
    }
    th.appendChild(wrap)
    theadRow.appendChild(th)
  })
  const thAct = document.createElement('th')
  thAct.className = 'excel-sheet-col-remove'
  thAct.innerHTML = '<span class="visually-hidden">Fjern rad</span>'
  theadRow.appendChild(thAct)

  tbody.replaceChildren()
  for (const row of state.rows) {
    tbody.appendChild(
      createExcelSheetDataRowTr(state.headers.length, row, state.headers),
    )
  }
  excelSheetSyncVegLockChrome(state)
}

/**
 * @param {number} nCols
 * @param {{ id: string, cells: string[], vegLocked?: boolean[] }} row
 * @param {string[]} headers
 */
function createExcelSheetDataRowTr(nCols, row, headers) {
  const vl = row.vegLocked || []
  const tr = document.createElement('tr')
  tr.dataset.rowId = row.id
  for (let i = 0; i < nCols; i++) {
    const td = document.createElement('td')
    const isVeg = excelVegFieldForHeader(headers[i] ?? '') != null
    const locked = isVeg && Boolean(vl[i])
    td.classList.toggle('excel-sheet-col--veg-locked', Boolean(locked))
    td.classList.toggle('excel-sheet-col--veg-live', isVeg && !vl[i])
    if (isVeg) {
      const wrap = document.createElement('div')
      wrap.className = 'excel-sheet-veg-cell-wrap'
      const lockBtn = document.createElement('button')
      lockBtn.type = 'button'
      lockBtn.className = 'btn btn-ghost excel-sheet-cell-lock'
      lockBtn.dataset.excelCol = String(i)
      lockBtn.dataset.rowId = row.id
      lockBtn.textContent = locked ? 'Lås opp' : 'Lås'
      lockBtn.title = locked
        ? 'Følg GPS igjen i denne cellen'
        : 'Lås denne cellen mot GPS-oppdateringer'
      lockBtn.setAttribute('aria-label', locked ? 'Lås opp celle' : 'Lås celle')
      lockBtn.setAttribute('aria-pressed', locked ? 'true' : 'false')
      const inp = document.createElement('input')
      inp.type = 'text'
      inp.className = 'excel-sheet-input'
      inp.dataset.excelCol = String(i)
      inp.value = row.cells[i] ?? ''
      inp.autocomplete = 'off'
      wrap.appendChild(lockBtn)
      wrap.appendChild(inp)
      td.appendChild(wrap)
    } else {
      const inp = document.createElement('input')
      inp.type = 'text'
      inp.className = 'excel-sheet-input'
      inp.dataset.excelCol = String(i)
      inp.value = row.cells[i] ?? ''
      inp.autocomplete = 'off'
      td.appendChild(inp)
    }
    tr.appendChild(td)
  }
  const tdRm = document.createElement('td')
  tdRm.className = 'excel-sheet-col-remove'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'btn btn-ghost excel-sheet-remove'
  btn.textContent = '×'
  btn.setAttribute('aria-label', 'Fjern rad')
  tdRm.appendChild(btn)
  tr.appendChild(tdRm)
  return tr
}

function persistExcelSheetFromDom() {
  const theadRow = document.getElementById('excel-sheet-header-row')
  const tbody = document.getElementById('excel-sheet-tbody')
  if (!theadRow || !tbody) return
  const headerInputs = theadRow.querySelectorAll('input.excel-sheet-header-input')
  const headers = []
  for (const inp of headerInputs) {
    if (inp instanceof HTMLInputElement) headers.push(inp.value)
  }
  const n = headers.length
  if (n < EXCEL_MIN_COLS) return
  const prev = loadExcelSheetState()
  const byId = new Map(prev.rows.map((r) => [r.id, r]))
  const rows = []
  for (const tr of tbody.querySelectorAll('tr')) {
    const id = tr.dataset.rowId
    if (!id) continue
    const prevRow = byId.get(id)
    const cells = []
    for (let i = 0; i < n; i++) {
      const el = tr.querySelector(`input[data-excel-col="${i}"]`)
      cells.push(el instanceof HTMLInputElement ? el.value : '')
    }
    let vegLocked = prevRow?.vegLocked
      ? prevRow.vegLocked.slice(0, n)
      : Array(n).fill(false)
    while (vegLocked.length < n) vegLocked.push(false)
    vegLocked.length = n
    for (let j = 0; j < n; j++) {
      if (!excelVegFieldForHeader(headers[j])) vegLocked[j] = false
    }
    rows.push({ id, cells, vegLocked })
  }
  saveExcelSheetState({ headers, rows })
}

function fillExcelSheetVegrefFromSnapshot() {
  persistExcelSheetFromDom()
  const state = loadExcelSheetState()
  const snap = getHomeVegrefExcelSnapshot()

  for (const r of state.rows) {
    if (!r.vegLocked) r.vegLocked = Array(state.headers.length).fill(false)
    for (let j = 0; j < state.headers.length; j++) {
      if (excelVegFieldForHeader(state.headers[j])) r.vegLocked[j] = false
    }
  }

  for (let j = 0; j < state.headers.length; j++) {
    const field = excelVegFieldForHeader(state.headers[j])
    if (!field) continue
    const val = excelSnapValueForField(field, snap)
    for (const r of state.rows) {
      const next = r.cells.slice()
      while (next.length <= j) next.push('')
      next[j] = val
      r.cells = next
    }
  }
  saveExcelSheetState(state)
  renderExcelSheetTable(loadExcelSheetState())
}

function bindMenuExcelExportListeners() {
  if (menuExcelExportAbort) menuExcelExportAbort.abort()
  menuExcelExportAbort = new AbortController()
  const { signal } = menuExcelExportAbort

  if (menuExcelVegLivePollId) {
    clearInterval(menuExcelVegLivePollId)
    menuExcelVegLivePollId = null
  }

  const tbody = document.getElementById('excel-sheet-tbody')
  if (!tbody || String(tbody.tagName).toUpperCase() !== 'TBODY') return

  const table = document.getElementById('excel-sheet-table')
  renderExcelSheetTable(loadExcelSheetState())
  refreshExcelSheetLiveVegref()

  const onTableInput = (e) => {
    if (
      e.target instanceof HTMLInputElement &&
      (e.target.classList.contains('excel-sheet-header-input') ||
        e.target.closest('#excel-sheet-tbody'))
    ) {
      persistExcelSheetFromDom()
      excelSheetSyncVegLockChrome(loadExcelSheetState())
    }
  }
  table?.addEventListener('input', onTableInput, { signal })

  tbody.addEventListener(
    'click',
    (e) => {
      const t = e.target
      if (!(t instanceof Element)) return
      const cellLock = t.closest('.excel-sheet-cell-lock')
      if (cellLock instanceof HTMLButtonElement) {
        e.preventDefault()
        const col = Number(cellLock.dataset.excelCol)
        const rowId = cellLock.dataset.rowId
        if (!rowId || !Number.isFinite(col) || col < 0) return
        persistExcelSheetFromDom()
        const st = loadExcelSheetState()
        const row = st.rows.find((r) => r.id === rowId)
        if (!row || !excelVegFieldForHeader(st.headers[col] ?? '')) return
        if (!row.vegLocked) row.vegLocked = Array(st.headers.length).fill(false)
        while (row.vegLocked.length < st.headers.length) row.vegLocked.push(false)
        row.vegLocked[col] = !row.vegLocked[col]
        saveExcelSheetState(st)
        if (!row.vegLocked[col]) refreshExcelSheetLiveVegref()
        else excelSheetSyncVegLockChrome(loadExcelSheetState())
        return
      }
      const btn = t.closest('.excel-sheet-remove')
      if (!btn || !tbody.contains(btn)) return
      const tr = btn.closest('tr')
      if (!tr || !tbody.contains(tr)) return
      tr.remove()
      persistExcelSheetFromDom()
      excelSheetSyncVegLockChrome(loadExcelSheetState())
    },
    { signal },
  )

  document.getElementById('excel-sheet-thead')?.addEventListener(
    'click',
    (e) => {
      const t = e.target
      if (!(t instanceof Element)) return
      const btn = t.closest('.excel-sheet-remove-col')
      if (!(btn instanceof HTMLButtonElement)) return
      const idx = Number(btn.dataset.excelCol)
      if (!Number.isFinite(idx) || idx < 0) return
      persistExcelSheetFromDom()
      const st = loadExcelSheetState()
      if (st.headers.length <= EXCEL_MIN_COLS) return
      st.headers.splice(idx, 1)
      for (const r of st.rows) {
        r.cells.splice(idx, 1)
        if (r.vegLocked) r.vegLocked.splice(idx, 1)
      }
      saveExcelSheetState(st)
      renderExcelSheetTable(loadExcelSheetState())
    },
    { signal },
  )

  document
    .getElementById('btn-back-from-menu-excel-export')
    ?.addEventListener('click', () => goHome(), { signal })

  document.getElementById('btn-excel-sheet-add-row')?.addEventListener(
    'click',
    () => {
      persistExcelSheetFromDom()
      const st = loadExcelSheetState()
      st.rows.push({
        id: crypto.randomUUID(),
        cells: Array(st.headers.length).fill(''),
        vegLocked: Array(st.headers.length).fill(false),
      })
      saveExcelSheetState(st)
      renderExcelSheetTable(loadExcelSheetState())
      refreshExcelSheetLiveVegref()
    },
    { signal },
  )

  document.getElementById('btn-excel-sheet-add-col')?.addEventListener(
    'click',
    () => {
      persistExcelSheetFromDom()
      const st = loadExcelSheetState()
      const nextN = st.headers.length + 1
      st.headers.push(`Kolonne ${nextN}`)
      for (const r of st.rows) {
        if (!r.vegLocked) r.vegLocked = Array(r.cells.length).fill(false)
        while (r.vegLocked.length < r.cells.length) r.vegLocked.push(false)
        r.cells.push('')
        r.vegLocked.push(false)
      }
      saveExcelSheetState(st)
      renderExcelSheetTable(loadExcelSheetState())
    },
    { signal },
  )

  document.getElementById('btn-excel-sheet-fill-vegref')?.addEventListener(
    'click',
    () => {
      fillExcelSheetVegrefFromSnapshot()
    },
    { signal },
  )

  document.getElementById('btn-excel-sheet-clear')?.addEventListener(
    'click',
    () => {
      if (
        !confirm(
          'Tømme arket og starte på nytt med standardkolonner og fem tomme rader?',
        )
      )
        return
      const st = resetExcelSheetState()
      renderExcelSheetTable(st)
      refreshExcelSheetLiveVegref()
    },
    { signal },
  )

  document.getElementById('btn-excel-sheet-export')?.addEventListener(
    'click',
    () => {
      persistExcelSheetFromDom()
      const st = loadExcelSheetState()
      const headers = st.headers.map((h) => h)
      const rows = st.rows.map((r) => r.cells.slice())
      void downloadExcelSheetGrid(headers, rows)
    },
    { signal },
  )

  menuExcelVegLivePollId = window.setInterval(() => {
    if (view === 'menuExcelExport') refreshExcelSheetLiveVegref()
  }, EXCEL_VEG_POLL_MS)

  bindExcelColumnDragListeners(signal)

  startHomeVegrefTracking()
}

function refreshFollowUpRoadDatalist() {
  const dl = document.getElementById('followup-road-datalist')
  if (!dl || !currentUser?.id) return
  const sug = getRoadSuggestionsForDatalist(currentUser.id)
  dl.innerHTML = sug.map((s) => `<option value="${escapeHtml(s)}"></option>`).join('')
}

function refreshFollowUpSavedListDom() {
  const ul = document.getElementById('followup-saved-list')
  if (!ul || !currentUser?.id) return
  const routes = loadFollowUpRoutes(currentUser.id).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  if (!routes.length) {
    ul.innerHTML =
      '<li class="followup-saved-empty">Ingen lagrede ruter ennå. Trykk <strong>Ny rute</strong>.</li>'
    return
  }
  ul.innerHTML = routes
    .map((r) => {
      const n = Array.isArray(r.markers) ? r.markers.length : 0
      const dt = new Intl.DateTimeFormat('nb-NO', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(r.updatedAt))
      return `<li class="followup-saved-row surface" data-followup-id="${escapeHtml(r.id)}">
        <div class="followup-saved-row__meta">
          <span class="followup-saved-row__title">${escapeHtml(r.title || 'Uten navn')}</span>
          <span class="followup-saved-row__sub">${n} punkt · ${escapeHtml(dt)}</span>
        </div>
        <div class="followup-saved-row__actions">
          <button type="button" class="btn btn-text followup-open-btn" data-followup-id="${escapeHtml(r.id)}">Åpne</button>
          <button type="button" class="btn btn-text followup-del-btn" data-followup-id="${escapeHtml(r.id)}">Slett</button>
        </div>
      </li>`
    })
    .join('')
}

function persistFollowUpDraftFromDom() {
  if (!followUpDraft) return
  const t = document.getElementById('followup-edit-title')
  if (t instanceof HTMLInputElement) {
    const v = t.value.trim().slice(0, 120)
    if (v) followUpDraft.title = v
  }
}

function persistFollowUpDraftToStorage() {
  if (!currentUser?.id || !followUpDraft) return
  persistFollowUpDraftFromDom()
  const routes = loadFollowUpRoutes(currentUser.id)
  const ix = routes.findIndex((r) => r.id === followUpDraft.id)
  followUpDraft.updatedAt = new Date().toISOString()
  const clone = /** @type {(typeof routes)[number]} */ (
    JSON.parse(JSON.stringify(followUpDraft))
  )
  if (ix >= 0) routes[ix] = clone
  else routes.unshift(clone)
  saveFollowUpRoutes(currentUser.id, routes)
}

function openMenuFollowUpRouteView() {
  closeHomeDrawer()
  stashActiveSessionForResumeBeforeLeave()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuFollowUpRoute'
  saveAppState()
  renderApp()
  bindMenuFollowUpRouteListeners()
}

function openFollowUpRouteEditNew() {
  followUpDraft = createEmptyFollowUpRoute('')
  view = 'followUpRouteEdit'
  saveAppState()
  renderApp()
  bindFollowUpRouteEditListeners()
}

function openFollowUpRouteEditExisting(route) {
  followUpDraft = {
    ...route,
    markers: Array.isArray(route.markers) ? route.markers.map((m) => ({ ...m })) : [],
  }
  view = 'followUpRouteEdit'
  saveAppState()
  renderApp()
  bindFollowUpRouteEditListeners()
}

function bindMenuFollowUpRouteListeners() {
  if (followUpRouteAbort) followUpRouteAbort.abort()
  followUpRouteAbort = new AbortController()
  const { signal } = followUpRouteAbort
  refreshFollowUpSavedListDom()
  document.getElementById('btn-back-from-menu-followup')?.addEventListener(
    'click',
    () => goHome(),
    { signal },
  )
  document.getElementById('btn-followup-new')?.addEventListener(
    'click',
    () => openFollowUpRouteEditNew(),
    { signal },
  )
  document.getElementById('btn-followup-push-delsky')?.addEventListener(
    'click',
    () => {
      void pushFollowUpRoutesToDelsky()
    },
    { signal },
  )
  document.getElementById('btn-followup-pull-delsky')?.addEventListener(
    'click',
    () => {
      void pullFollowUpRoutesFromDelsky()
    },
    { signal },
  )
  const statusEl = document.getElementById('followup-list-status')
  document.getElementById('btn-followup-export-json')?.addEventListener(
    'click',
    () => {
      if (!currentUser?.id) return
      const json = serializeFollowUpRoutesExport(loadFollowUpRoutes(currentUser.id))
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `scanix-oppfolgingsruter-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      if (statusEl) statusEl.textContent = 'JSON eksportert.'
      window.setTimeout(() => {
        if (statusEl) statusEl.textContent = ''
      }, 2400)
    },
    { signal },
  )
  const fileInp = document.getElementById('followup-import-file')
  document.getElementById('btn-followup-import-json')?.addEventListener(
    'click',
    () => fileInp?.click(),
    { signal },
  )
  fileInp?.addEventListener(
    'change',
    () => {
      const f = fileInp.files?.[0]
      if (!f || !currentUser?.id) return
      const reader = new FileReader()
      reader.onload = () => {
        const text = String(reader.result || '')
        const incoming = parseFollowUpRoutesImport(text)
        if (!incoming?.length) {
          if (statusEl) statusEl.textContent = 'Kunne ikke lese filen.'
          return
        }
        const cur = loadFollowUpRoutes(currentUser.id)
        const byId = new Map(cur.map((r) => [r.id, r]))
        for (const r of incoming) byId.set(r.id, r)
        saveFollowUpRoutes(currentUser.id, [...byId.values()])
        refreshFollowUpSavedListDom()
        if (statusEl) {
          statusEl.textContent = `Importerte ${incoming.length} rute(r). Eksisterende med samme ID ble erstattet.`
        }
      }
      reader.readAsText(f)
      fileInp.value = ''
    },
    { signal },
  )
  document.getElementById('followup-saved-list')?.addEventListener(
    'click',
    (ev) => {
      const t = ev.target
      if (!(t instanceof Element)) return
      const del = t.closest('.followup-del-btn')
      const op = t.closest('.followup-open-btn')
      const id =
        (del || op)?.getAttribute('data-followup-id')?.trim() ?? ''
      if (!id || !currentUser?.id) return
      if (del) {
        if (!confirm('Slette denne oppfølgingsruta?')) return
        const next = loadFollowUpRoutes(currentUser.id).filter((r) => r.id !== id)
        saveFollowUpRoutes(currentUser.id, next)
        refreshFollowUpSavedListDom()
        return
      }
      if (op) {
        const route = loadFollowUpRoutes(currentUser.id).find((r) => r.id === id)
        if (route) openFollowUpRouteEditExisting(route)
      }
    },
    { signal },
  )
}

function bindFollowUpRouteEditListeners() {
  if (followUpRouteAbort) followUpRouteAbort.abort()
  followUpRouteAbort = new AbortController()
  const { signal } = followUpRouteAbort
  refreshFollowUpRoadDatalist()
  const fb = document.getElementById('followup-add-feedback')
  document.getElementById('btn-followup-edit-back')?.addEventListener(
    'click',
    () => {
      closeFollowUpFullscreen()
      view = 'menuFollowUpRoute'
      saveAppState()
      renderApp()
      bindMenuFollowUpRouteListeners()
    },
    { signal },
  )
  document.getElementById('followup-edit-title')?.addEventListener(
    'input',
    () => persistFollowUpDraftFromDom(),
    { signal },
  )
  document.getElementById('btn-followup-add-point')?.addEventListener(
    'click',
    () => {
      void (async () => {
        if (!followUpDraft || !currentUser?.id) return
        const roadEl = document.getElementById('followup-road-input')
        const meterEl = document.getElementById('followup-meter-input')
        const sEl = document.getElementById('followup-s-input')
        const dEl = document.getElementById('followup-d-input')
        const road =
          roadEl instanceof HTMLInputElement ? roadEl.value : ''
        const meter =
          meterEl instanceof HTMLInputElement ? meterEl.value : ''
        const s = sEl instanceof HTMLInputElement ? sEl.value : '1'
        const d = dEl instanceof HTMLInputElement ? dEl.value : '1'
        if (!normalizeRoadToken(road)) {
          if (fb) fb.textContent = 'Skriv gyldig veg (f.eks. FV7552 eller EV6).'
          return
        }
        if (fb) fb.textContent = 'Henter posisjon fra NVDB …'
        try {
          const res = await resolveFollowUpPoint(road, Number(meter), Number(s), Number(d))
          if (!res) {
            if (fb) fb.textContent = 'Fant ikke strekningen. Sjekk veg, S/D og meter.'
            return
          }
          recordRoadSuggestion(currentUser.id, res.roadDisplay)
          refreshFollowUpRoadDatalist()
          followUpDraft.markers.push({
            id: crypto.randomUUID(),
            roadDisplay: res.roadDisplay,
            s: Math.max(1, Math.round(Number(s)) || 1),
            d: Math.max(1, Math.round(Number(d)) || 1),
            meter: Math.round(Number(meter)) || 0,
            lat: res.lat,
            lng: res.lng,
            batchRef: res.batchRef,
            kortform: res.kortform,
          })
          if (fb) fb.textContent = `Lagt til: ${res.kortform || res.batchRef}`
          rebuildFollowUpEditMarkers()
        } catch (e) {
          const msg =
            e && typeof e === 'object' && 'message' in e
              ? String(/** @type {{ message: string }} */ (e).message)
              : 'NVDB-feil'
          if (fb) fb.textContent = msg.slice(0, 200)
        }
      })()
    },
    { signal },
  )
  document.getElementById('btn-followup-save-draft')?.addEventListener(
    'click',
    () => {
      persistFollowUpDraftToStorage()
      if (fb) fb.textContent = 'Rute lagret lokalt.'
      window.setTimeout(() => {
        if (fb) fb.textContent = ''
      }, 2200)
    },
    { signal },
  )
  document.getElementById('btn-followup-open-fullmap')?.addEventListener(
    'click',
    () => {
      persistFollowUpDraftFromDom()
      const tEl = document.getElementById('followup-fs-title')
      if (tEl) tEl.textContent = followUpDraft?.title || 'Oppfølgingsrute'
      closeFollowUpFullscreen()
      void initFollowUpFsMapInternal()
    },
    { signal },
  )
  document.getElementById('btn-followup-fs-close')?.addEventListener(
    'click',
    () => closeFollowUpFullscreen(),
    { signal },
  )
  queueMicrotask(() => void initFollowUpEditMapInternal())
  startHomeVegrefTracking()
}

function syncPhotoAlbumChrome() {
  const share = document.getElementById('btn-photo-album-share')
  const marker = document.getElementById('btn-photo-album-marker')
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
  document.querySelector('.view-photo-album-wrap')?.classList.toggle(
    'view-photo-album-wrap--marker-mode',
    photoAlbumMarkerMode,
  )
}

function renderStandalonePhotoAlbumGallery() {
  const el = document.getElementById('standalone-photos-gallery')
  const summaryEl = document.getElementById('standalone-photos-folders-summary')
  if (!el) return
  if (!standalonePhotos.length) {
    el.innerHTML =
      '<p class="photo-album__empty">Ingen bilder ennå. Bruk «Ta bilde» på forsiden.</p>'
    if (summaryEl) {
      summaryEl.textContent = ''
      summaryEl.hidden = true
    }
    syncPhotoAlbumChrome()
    return
  }
  const folderLine = formatPhotosFolderSummaryLine(standalonePhotos)
  if (summaryEl) {
    if (folderLine) {
      summaryEl.textContent = `Bildemapper (lagring): ${folderLine}`
      summaryEl.hidden = false
    } else {
      summaryEl.textContent = ''
      summaryEl.hidden = true
    }
  }
  el.innerHTML = standalonePhotos
    .map((ph) => {
      const sel = photoAlbumSelectedIds.has(ph.id)
      const cls = sel
        ? 'home-dash-card photo-album__row photo-album__row--selected'
        : 'home-dash-card photo-album__row'
      const title = formatPhotoAlbumRowTitle(ph)
      const hint = formatPhotoAlbumRowHint(ph, title)
      return `<button type="button" class="${cls}" data-photo-id="${escapeHtml(ph.id)}" aria-pressed="${sel ? 'true' : 'false'}">
        <span class="home-dash-card__row">
          <span class="home-dash-card__content">
            <span class="home-dash-card__title">${escapeHtml(title)}</span>
            <span class="home-dash-card__hint">${escapeHtml(hint)}</span>
          </span>
          <span class="home-dash-card__visual" aria-hidden="true">
            ${photoPreviewImgHtml(ph, 'home-dash-card__preview')}
          </span>
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
    ? 'home-dash-card photo-album__row photo-album__row--selected'
    : 'home-dash-card photo-album__row'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = cls
  btn.dataset.photoId = photo.id
  btn.setAttribute('aria-pressed', sel ? 'true' : 'false')
  const row = document.createElement('span')
  row.className = 'home-dash-card__row'
  const content = document.createElement('span')
  content.className = 'home-dash-card__content'
  const titleEl = document.createElement('span')
  titleEl.className = 'home-dash-card__title'
  const title = formatPhotoAlbumRowTitle(photo)
  titleEl.textContent = title
  const hintEl = document.createElement('span')
  hintEl.className = 'home-dash-card__hint'
  hintEl.textContent = formatPhotoAlbumRowHint(photo, title)
  content.appendChild(titleEl)
  content.appendChild(hintEl)
  const vis = document.createElement('span')
  vis.className = 'home-dash-card__visual'
  vis.setAttribute('aria-hidden', 'true')
  const thumbSrc = photoListThumbDataUrl(/** @type {object} */ (photo))
  if (thumbSrc) {
    const img = document.createElement('img')
    img.src = thumbSrc
    img.alt = ''
    img.className = 'home-dash-card__preview'
    img.loading = 'lazy'
    img.decoding = 'async'
    vis.appendChild(img)
  } else {
    const pend = document.createElement('span')
    pend.className = 'home-dash-card__preview photo-preview--pending'
    pend.setAttribute('role', 'status')
    pend.setAttribute('aria-label', 'Laster')
    vis.appendChild(pend)
  }
  row.appendChild(content)
  row.appendChild(vis)
  btn.appendChild(row)
  el.appendChild(btn)
}

/**
 * Bygger JSON som mottakers app kan importere som økt (kun bilder, ingen tellinger).
 * @param {NonNullable<ReturnType<typeof normalizePhoto>>[]} photos
 */
/**
 * Bygger delbar økt-json for «Send bilder» — kun metadata + storage-stier (ingen base64).
 * @param {object[]} preppedPhotos output fra `preparePhotosArrayForShareRpc`
 */
function standalonePhotosToShareSessionPayload(preppedPhotos) {
  const ts = nowIso()
  const clean = preppedPhotos.map((p) => {
    const o = {
      id: p.id,
      timestamp: p.timestamp,
      lat: p.lat,
      lng: p.lng,
    }
    const vr = p.vegref && normalizePhotoVegref(p.vegref)
    if (vr) o.vegref = vr
    if (typeof p.note === 'string' && p.note.trim()) {
      o.note = p.note.trim().slice(0, 800)
    }
    if (p.imageFolder) o.imageFolder = p.imageFolder
    if (p.imagePath) o.imagePath = p.imagePath
    if (typeof p.storageFullPath === 'string' && p.storageFullPath.trim()) {
      o.storageFullPath = p.storageFullPath.trim()
    }
    if (typeof p.storageThumbPath === 'string' && p.storageThumbPath.trim()) {
      o.storageThumbPath = p.storageThumbPath.trim()
    }
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
  if (
    isRemoteAppStateDataEnabled() &&
    currentUser?.id &&
    (isScanixCloudApiConfigured() || sb)
  ) {
    try {
      await tryDrainPhotoUploadQueue({ userId: currentUser.id })
    } catch (e) {
      console.warn('tryDrainPhotoUploadQueue (share standalone)', e)
    }
    syncPhotoUploadDeferralBanner()
    const ids = new Set(photos.map((p) => p.id))
    const fresh = standalonePhotos.filter((p) => ids.has(p.id))
    const prep = preparePhotosArrayForShareRpc(fresh)
    if (!prep.ok) {
      if (statusEl) statusEl.textContent = prep.message
      return
    }
    const payload = standalonePhotosToShareSessionPayload(prep.photos)
    if (statusEl) statusEl.textContent = 'Sender til mottaker …'
    try {
      const overlayMs = estimateDelskyOverlayDurationMs(payload, 0)
      await runDelskySyncWithOverlay(async () => {
        await sendSessionShare(sb, shareStandaloneRecipientShortId, payload)
      }, overlayMs)
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
            '#standalone-photos-gallery .photo-album__row--selected',
          )
          .forEach((cell) => {
            if (!(cell instanceof HTMLElement)) return
            cell.classList.remove('photo-album__row--selected')
            cell.setAttribute('aria-pressed', 'false')
          })
      }
      syncPhotoAlbumChrome()
    },
    { signal },
  )

  document.getElementById('btn-photo-album-save')?.addEventListener(
    'click',
    async () => {
      const photos = photoAlbumMarkerMode && photoAlbumSelectedIds.size
        ? standalonePhotos.filter((p) => photoAlbumSelectedIds.has(p.id))
        : standalonePhotos
      if (!photos.length) return
      for (const ph of photos) {
        await savePhotoToDevice(ph)
      }
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
          btn.classList.remove('photo-album__row--selected')
          btn.setAttribute('aria-pressed', 'false')
        } else {
          photoAlbumSelectedIds.add(id)
          btn.classList.add('photo-album__row--selected')
          btn.setAttribute('aria-pressed', 'true')
        }
        syncPhotoAlbumChrome()
        return
      }
      const ph = standalonePhotos.find((p) => p.id === id)
      if (ph) void openPhotoFullscreenFromPhotoRecord(ph)
    },
    { signal },
  )

  renderStandalonePhotoAlbumGallery()
}

function renderPhotoAlbumHtml() {
  return `<div class="view-photo-album-wrap">
    <div class="view-photo-album view-home surface--home view-photo-album-page view-panel-enter" aria-label="Album">
      <header class="photo-album__header" aria-label="Album">
        <div class="traffic-group-top">
          <button type="button" class="traffic-group-back-btn" id="btn-photo-album-back" aria-label="Tilbake">←</button>
          <h1 class="traffic-group-title">Album</h1>
          <span class="traffic-group-top-spacer" aria-hidden="true"></span>
        </div>
        <div class="photo-album__toolbar" role="toolbar" aria-label="Handlinger">
          <button type="button" class="photo-album__action" id="btn-photo-album-save" aria-label="Lagre bilde på mobil">Lagre</button>
          <button type="button" class="photo-album__action" id="btn-photo-album-share" aria-label="Del bilder">Del</button>
          <button type="button" class="photo-album__action photo-album__marker" id="btn-photo-album-marker" aria-pressed="false">Marker</button>
        </div>
      </header>
      <div class="photo-album__body">
        <p id="standalone-photos-folders-summary" class="session-photos-folders-summary session-photos-folders-summary--album" hidden aria-live="polite"></p>
        <div id="standalone-photos-gallery" class="photo-album__list" aria-live="polite"></div>
      </div>
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
              <div class="kmt-video-zoom-root" id="kmt-video-zoom-root">
                <div class="kmt-video-zoom-inner" id="kmt-video-zoom-inner">
                  <video
                    id="kmt-video"
                    class="kmt-video"
                    playsinline
                    muted
                    autoplay
                    aria-label="Kameravisning"
                  ></video>
                  <div
                    class="kmt-camera-warmup"
                    id="kmt-camera-warmup"
                    aria-hidden="true"
                  ></div>
                  <div
                    class="kmt-tap-focus-layer"
                    id="kmt-tap-focus-layer"
                    role="presentation"
                    title="Trykk for fokus · knipe for zoom"
                  ></div>
                  <div class="kmt-ref-overlay" id="kmt-ref-overlay">
                    <div class="kmt-ref-overlay__road" id="kmt-road-line">–</div>
                    <span class="visually-hidden" id="kmt-road-folder-src" aria-hidden="true"></span>
                    <div class="kmt-ref-overlay__compact" id="kmt-ref-compact">S – · D – · m –</div>
                    <span class="visually-hidden" id="kmt-s">–</span>
                    <span class="visually-hidden" id="kmt-d">–</span>
                    <span class="visually-hidden" id="kmt-m">–</span>
                    <div class="kmt-ref-overlay__kf" id="kmt-kortform"></div>
                  </div>
                </div>
              </div>
              <div class="kmt-capture-flash" id="kmt-capture-flash" aria-hidden="true"></div>
              <div class="kmt-camera-bottom-bar" id="kmt-camera-bottom-bar">
                <div class="kmt-camera-bottom-bar__row">
                  <div class="kmt-camera-bottom-bar__cluster kmt-camera-bottom-bar__cluster--left">
                    <button
                      type="button"
                      class="kmt-glass-control kmt-torch-btn"
                      id="btn-kmt-torch"
                      disabled
                      aria-pressed="false"
                      aria-label="Blits"
                      title="Blits / lommelykt"
                    >
                      <span class="kmt-torch-btn__glyph" aria-hidden="true">⚡</span>
                    </button>
                  </div>
                  <button type="button" class="kmt-glass-control kmt-capture-fab" id="btn-kmt-capture">Ta bilde</button>
                  <label class="visually-hidden" for="kmt-photo-note">Kommentar (valgfritt)</label>
                  <textarea
                    id="kmt-photo-note"
                    class="kmt-glass-control kmt-photo-note"
                    rows="1"
                    maxlength="800"
                    placeholder="Kommentar …"
                    autocomplete="off"
                  ></textarea>
                </div>
              </div>
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

/**
 * `interactive-widget` i viewport-meta støttes i Blink (f.eks. Android Chrome) for tastatur/layout;
 * WebKit (Safari, alle iOS-nettlesere) gir «Viewport argument key … not recognized» — derfor ikke i index.html.
 */
const VIEWPORT_INTERACTIVE_WIDGET_SUFFIX =
  typeof navigator !== 'undefined' &&
  /Android/i.test(navigator.userAgent) &&
  /Chrome\//i.test(navigator.userAgent) &&
  !/EdgA\//i.test(navigator.userAgent)
    ? ', interactive-widget=overlays-content'
    : ''

/** Hoved-UI: begrens nettleser-zoom; bildevisning: ekstra viewport + programmatisk pinch. */
const VIEWPORT_CONTENT_MAIN =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover' +
  VIEWPORT_INTERACTIVE_WIDGET_SUFFIX
const VIEWPORT_CONTENT_IMAGE_ZOOM =
  'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, viewport-fit=cover' +
  VIEWPORT_INTERACTIVE_WIDGET_SUFFIX

if (VIEWPORT_INTERACTIVE_WIDGET_SUFFIX) {
  queueMicrotask(() => {
    const m = document.getElementById('meta-viewport')
    if (m) m.setAttribute('content', VIEWPORT_CONTENT_MAIN)
  })
}

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
/** @type {{ reset: () => void } | null} */
let sharedReviewLightboxPinchControls = null

function renderPhotoFullscreenDialogHtml() {
  return `<dialog id="photo-fullscreen-dialog" class="photo-fullscreen-dialog" aria-label="Bilde i fullskjerm">
    <div class="photo-fullscreen-dialog__inner">
      <button type="button" class="photo-fullscreen-dialog__close" id="btn-photo-fullscreen-close" aria-label="Lukk">×</button>
      <button type="button" class="photo-fullscreen-dialog__close photo-fullscreen-dialog__save" id="btn-photo-fullscreen-save" aria-label="Lagre bilde">Lagre</button>
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

/** Siste foto-id i fullskjerm (for bakgrunnsoppgradering til `storageFullPath`). */
let photoFullscreenActivePhotoId = ''

/**
 * `shouldDeferPhotoUploadOnNetwork()` er til opplasting; i nettleser mangler ofte
 * `navigator.connection`, og funksjonen ble da alltid «utsett» — da ble aldri full
 * fil fra storage hentet ved trykk (svart fullskjerm når miniatyr manglet/féilet).
 * På Capacitor følger vi samme Wi‑Fi/mobil-preferanse som for opplasting.
 */
function shouldDeferFullPhotoFromStorageForViewing() {
  if (!isCapacitorNativePlatform()) return false
  return shouldDeferPhotoUploadOnNetwork()
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} path
 * @returns {Promise<string>}
 */
async function storageObjectUrlFromPath(sb, path) {
  const p = typeof path === 'string' ? path.trim() : ''
  if (!p) return ''
  if (isScanixCloudApiConfigured()) {
    return cloudGetSignedReadUrlForPhotoPath(p, 3600)
  }
  if (!sb) return ''
  const { data, error } = await sb.storage
    .from(PHOTO_STORAGE_BUCKET)
    .createSignedUrl(p, 3600)
  if (!error && data?.signedUrl) return data.signedUrl
  try {
    const { data: bin, error: dErr } = await sb.storage
      .from(PHOTO_STORAGE_BUCKET)
      .download(p)
    if (!dErr && bin && bin.size > 0) return URL.createObjectURL(bin)
  } catch {
    /* ignore */
  }
  return ''
}

/**
 * Når fullskjerm ble åpnet med miniatyr men `storageFullPath` finnes, prøv full på nytt
 * (midlertidig nett/timeout) og bytt bilde uten å lukke dialogen.
 * @param {string} photoId
 * @param {string} fullPath
 */
async function tryUpgradePhotoFullscreenStorageFull(photoId, fullPath) {
  const id = typeof photoId === 'string' ? photoId.trim() : ''
  const path = typeof fullPath === 'string' ? fullPath.trim() : ''
  if (!id || !path) return
  const sb = getSupabase()
  if (!sb && !isScanixCloudApiConfigured()) return
  const fullUrl = await storageObjectUrlFromPath(sb, path)
  if (!fullUrl) return
  const dlg = document.getElementById('photo-fullscreen-dialog')
  const img = document.getElementById('photo-fullscreen-img')
  if (!(dlg instanceof HTMLDialogElement) || !dlg.open || !img) return
  if (photoFullscreenActivePhotoId !== id) return
  const prev = img.src || ''
  if (prev.startsWith('blob:') && prev !== fullUrl) {
    try {
      URL.revokeObjectURL(prev)
    } catch {
      /* ignore */
    }
  }
  img.src = fullUrl
}

/**
 * Åpner fullskjerm med **full oppløsning når mulig**: lokalt `dataUrl` / IndexedDB,
 * deretter **full fil fra Storage** (før miniatyr i minne — ellers ble `thumbDataUrl`
 * valgt og fullskjerm så ut som miniatyr). Miniatyr og `storageThumbPath` er reserve.
 * På native med mobilnett-defer prøves ikke full fra storage før miniatyr er forsøkt.
 * @param {{ id?: string, dataUrl?: string, thumbDataUrl?: string, storageFullPath?: string, storageThumbPath?: string, vegref?: unknown, note?: string } | null | undefined} ph
 */
async function openPhotoFullscreenFromPhotoRecord(ph) {
  if (!ph || typeof ph !== 'object') return
  try {
    await refreshNativeNetworkStatus()
  } catch {
    /* ignore */
  }
  /* Alltid slå opp samme id i getAllPhotosFlat(): én kanonisk rad (økt vs standalone)
     med flettelogikk som foretrekker piksel/miniatyr lokalt — unngår at vi åpner
     med en «magrere» kopi og treffer sky for tidlig. */
  const pidCanon = typeof ph.id === 'string' ? ph.id : ''
  const pRaw = pidCanon ? getAllPhotosFlat().find((x) => x.id === pidCanon) ?? ph : ph
  const p = /** @type {typeof ph} */ (
    ensureStorageFullPathParallelToThumb(
      ensureStorageThumbPathParallelToFull(/** @type {object} */ (pRaw)),
    )
  )
  let url = photoFullscreenLocalPixelUrl(/** @type {object} */ (p))
  const hasLocalDataUrlFull = Boolean(
    url &&
      typeof p.dataUrl === 'string' &&
      p.dataUrl.startsWith('data:image/') &&
      url === p.dataUrl,
  )
  let gotUrlFromStorageFull = false
  const pid = typeof p.id === 'string' ? p.id : ''
  if (!url && pid && (await isPhotoBlobStoreAvailable())) {
    try {
      const fromIdb = await getPhotoDataUrl(pid)
      if (typeof fromIdb === 'string' && fromIdb.startsWith('data:image/'))
        url = fromIdb
    } catch {
      /* ignore */
    }
  }

  const storageThumbPath =
    typeof /** @type {{ storageThumbPath?: string }} */ (p).storageThumbPath ===
      'string' &&
    /** @type {{ storageThumbPath?: string }} */ (p).storageThumbPath.trim()
      ? /** @type {{ storageThumbPath: string }} */ (p).storageThumbPath.trim()
      : ''
  const storageFull =
    typeof p.storageFullPath === 'string' ? p.storageFullPath.trim() : ''

  if (
    !url &&
    storageFull &&
    isRemoteAppStateDataEnabled() &&
    !shouldDeferFullPhotoFromStorageForViewing()
  ) {
    const sb = getSupabase()
    if (sb || isScanixCloudApiConfigured()) {
      url = await storageObjectUrlFromPath(sb, storageFull)
      if (url) gotUrlFromStorageFull = true
    }
  }

  if (!url) {
    const t = photoListThumbDataUrl(/** @type {object} */ (p))
    if (t) url = t
  }
  if (!url && storageThumbPath && isRemoteAppStateDataEnabled()) {
    const sb = getSupabase()
    if (sb || isScanixCloudApiConfigured()) {
      url = await storageObjectUrlFromPath(sb, storageThumbPath)
    }
  }

  if (
    !url &&
    storageFull &&
    isRemoteAppStateDataEnabled() &&
    shouldDeferFullPhotoFromStorageForViewing()
  ) {
    showSessionToast(
      'Full bilde lastes på Wi‑Fi (samme valg som «Tillat opplasting på mobilnett» under Innstillinger → Offline). Miniatur fra sky brukes når den finnes.',
      5600,
    )
    return
  }

  if (!url) {
    showSessionToast(
      'Fant ikke bildefil (verken lokalt eller fra sky). Sjekk nett og innlogging.',
      5200,
    )
    return
  }
  photoFullscreenActivePhotoId = pid
  openPhotoFullscreen(
    url,
    p.vegref,
    p.note,
    p.timestamp,
    p.captureWithVegrefDateTime === true,
  )
  if (
    storageFull &&
    isRemoteAppStateDataEnabled() &&
    !shouldDeferFullPhotoFromStorageForViewing() &&
    !gotUrlFromStorageFull &&
    !hasLocalDataUrlFull
  ) {
    void tryUpgradePhotoFullscreenStorageFull(pid, storageFull)
  }
}

/**
 * @param {string} dataUrl data- eller https‑URL til bildet
 * @param {unknown} [vegrefRaw] lagret vegref-objekt; tekst vises som vektor-overlay (skarp ved zoom).
 * @param {unknown} [noteRaw] valgfri kommentar lagret med bildet.
 * @param {unknown} [timestampRaw] foto-tidspunkt.
 * @param {boolean} [showTimestamp] vis dato/klokkeslett i overlay.
 */
function openPhotoFullscreen(
  dataUrl,
  vegrefRaw,
  noteRaw,
  timestampRaw,
  showTimestamp = false,
) {
  const dlg = document.getElementById('photo-fullscreen-dialog')
  const img = document.getElementById('photo-fullscreen-img')
  const vrLayer = document.getElementById('photo-fullscreen-vegref')
  if (!dlg || !img || typeof dataUrl !== 'string' || !dataUrl) return
  img.onload = null
  img.onerror = () => {
    img.onload = null
    img.onerror = null
    showSessionToast(
      'Kunne ikke vise bildet (nett / tilgang / ødelagt fil). Sjekk innlogging og prøv igjen.',
      5600,
    )
    closePhotoFullscreen()
  }
  img.onload = () => {
    img.onload = null
    img.onerror = null
  }
  img.src = dataUrl
  const vr = vegrefRaw ? normalizePhotoVegref(vegrefRaw) : null
  const note =
    typeof noteRaw === 'string' && noteRaw.trim()
      ? noteRaw.trim().slice(0, 800)
      : ''
  const tsText = showTimestamp ? formatPhotoOverlayTimestamp(timestampRaw) : ''
  if (vrLayer) {
    const inner = formatPhotoVegrefOverlayLinesHtml(
      vr || { road: '', compact: '', kortform: '' },
      note,
      tsText,
    )
    if (inner) {
      vrLayer.innerHTML = inner
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
  photoFullscreenActivePhotoId = ''
  const dlg = document.getElementById('photo-fullscreen-dialog')
  const img = document.getElementById('photo-fullscreen-img')
  const vrLayer = document.getElementById('photo-fullscreen-vegref')
  if (img) {
    const s = img.src || ''
    if (s.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(s)
      } catch {
        /* ignore */
      }
    }
    img.onload = null
    img.onerror = null
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
  document.getElementById('btn-photo-fullscreen-save')?.addEventListener(
    'click',
    () => {
      const id = photoFullscreenActivePhotoId
      if (!id) return
      const ph = getAllPhotosFlat().find((p) => p.id === id)
      if (!ph) return
      void savePhotoToDevice(ph)
    },
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
  /* DelSky trenger Supabase ved kjøring, men knappen skal synes når bruker er innlogget
   * så «forsvant» ikke ved iOS-bygg uten bakte VITE_SUPABASE_* (kun MapTiler i .env.local). */
  const showDelskySaveBtn =
    Boolean(currentUser?.id) &&
    !isMinDownloadMode() &&
    !previewIncomingShareId
  /* Sky-silhuett samme geometri som delskyUploadOverlay (CLOUD_PATH_D) — kun statisk ikon her. */
  const delskySaveBtnHtml = showDelskySaveBtn
    ? `<button type="button" class="session-action-tab session-action-tab--icon" id="btn-save-session-delsky" aria-label="Lagre oppdrag i DelSky">
            <svg class="session-action-tab__icon session-action-tab__icon--delsky" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M 28 62 L 92 62 C 104 62 112 54 110 44 C 108 34 98 28 88 30 C 84 20 70 16 60 22 C 52 14 36 16 30 26 C 18 28 12 40 18 50 C 16 58 22 62 28 62 Z" fill="none" stroke="currentColor" stroke-width="4.25" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>`
    : ''
  return `<div class="app-stack app-stack--session">
    <header class="session-top">
      ${previewBanner}
      <div class="session-top__bar">
        <button type="button" class="btn btn-text btn-back-session" id="btn-back-menu">← Meny</button>
      </div>
      <div class="session-top__toolbar">
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
          ${delskySaveBtnHtml}
          <button type="button" class="session-action-tab session-action-tab--icon" id="btn-end-session" aria-label="Avslutt oppdrag">
            <svg class="session-action-tab__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 17l5-5-5-5" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M21 12H9" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        ${sessionDatetimeHtml}
        ${roadBlock ? `<div class="session-top__road">${roadBlock}</div>` : ''}
      </div>
    </header>

    <dialog id="share-session-dialog" class="share-session-dialog" aria-labelledby="share-session-heading">
      <div class="share-session-dialog__inner">
        <div class="share-session-dialog__head">
          <h2 id="share-session-heading" class="share-session-dialog__title">Del oppdrag</h2>
          <button type="button" class="share-session-dialog__close" id="btn-share-session-close" aria-label="Lukk">×</button>
        </div>
        <p class="share-session-dialog__lead">Hvem skal få oppdraget? Med <strong>innlogget konto</strong> sendes det til mottakers <strong>Meldinger</strong> (varslingsikon). For å bare synke til <strong>dine egne</strong> enheter (Mac/nett), lukk denne dialogen og bruk <strong>sky-knappen</strong> i verktøylinjen i oppdraget — uten mottaker.</p>
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
          <button type="button" role="tab" class="session-end-tabs__tab" id="session-end-tab-excel" aria-selected="false" aria-controls="session-end-panel-excel">Excel</button>
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
        <div id="session-end-panel-excel" class="session-end-panel" role="tabpanel" aria-labelledby="session-end-tab-excel" hidden>
          <p class="session-end-dialog__lead">Én rad per registrering (trykk) med vegreferanse slik den var da du registrerte. Filen lages på enheten – på iPhone bruker du ofte delingsarket og «Lagre i Filer».</p>
          <p id="session-end-excel-status" class="session-end-pdf-status" role="status"></p>
          <div class="session-end-dialog__actions session-end-dialog__actions--pdf">
            <button type="button" class="btn btn-secondary" id="session-end-excel-cancel">Lukk</button>
            <button type="button" class="btn btn-home btn-home--primary" id="session-end-excel-export">Last ned Excel</button>
          </div>
        </div>
      </div>
    </dialog>

    <dialog id="click-entry-edit-dialog" class="session-end-dialog click-entry-edit-dialog" aria-labelledby="click-entry-edit-heading">
      <div class="session-end-dialog__inner">
        <h2 id="click-entry-edit-heading" class="session-end-dialog__title">Rediger registrering</h2>
        <p class="session-end-dialog__lead">Tittel vises på kartet i stedet for standard registreringsnummer (f.eks. 13). Kommentar er valgfri.</p>
        <label class="session-end-label" for="click-entry-edit-title">Tittel (valgfritt)</label>
        <input type="text" id="click-entry-edit-title" class="session-end-input" maxlength="${CLICK_ENTRY_LABEL_MAX_LEN}" autocomplete="off" placeholder="F.eks. Hindring" />
        <label class="session-end-label" for="click-entry-edit-comment">Kommentar (valgfritt)</label>
        <textarea id="click-entry-edit-comment" class="session-end-textarea" rows="4" maxlength="${CLICK_ENTRY_COMMENT_MAX_LEN}" autocomplete="off" placeholder="Notater …"></textarea>
        <div class="session-end-dialog__actions">
          <button type="button" class="btn btn-secondary" id="click-entry-edit-cancel">Avbrytt</button>
          <button type="button" class="btn btn-home btn-home--primary" id="click-entry-edit-save">Lagre</button>
        </div>
      </div>
    </dialog>

    <div class="session-map-root" id="session-map-root" aria-hidden="false">
      <div class="map-frame session-map-frame" id="session-map-frame">
        <div id="map" class="map"></div>
        <p id="gps-status" class="gps-status map-gps-chip" role="status"></p>
        <button
          type="button"
          id="btn-map-explore"
          class="map-explore-btn"
          aria-label="Fri kart: slå av automatisk følging av GPS"
          title="Fri kart (panorer uten at kartet følger posisjon)"
        >
          Fri kart
        </button>
        <div
          id="session-map-theme-dock"
          class="session-map-theme-dock"
          aria-hidden="false"
        >
          <button
            type="button"
            id="session-map-theme-dot"
            class="session-map-theme-dot"
            aria-haspopup="true"
            aria-expanded="false"
            aria-label="Kartunderlag. Trykk for å velge lyst eller mørkt kart."
            title="Kartunderlag"
          >
            <span class="session-map-theme-dot__glow" aria-hidden="true"></span>
            <span class="session-map-theme-dot__core" aria-hidden="true"></span>
          </button>
          <div
            id="session-map-theme-popover"
            class="session-map-theme-popover"
            role="menu"
            aria-label="Kartunderlag"
            hidden
          >
            <button
              type="button"
              class="session-map-theme-popover__opt"
              role="menuitemradio"
              id="session-map-theme-opt-light"
              aria-checked="true"
            >
              Lyst kart
            </button>
            <button
              type="button"
              class="session-map-theme-popover__opt"
              role="menuitemradio"
              id="session-map-theme-opt-dark"
              aria-checked="false"
            >
              Mørkt kart
            </button>
          </div>
        </div>
        <button
          type="button"
          id="btn-map-locate"
          class="map-locate-btn"
          aria-label="Til min posisjon og følg GPS"
          title="Til min posisjon · følg GPS"
        >
          <span class="map-locate-btn__icon" aria-hidden="true">⌂</span>
        </button>
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
          <button type="button" id="btn-minus" class="btn btn-minus btn-ghost-action" title="Angre siste" aria-label="Angre siste">Angre (−)</button>
          <button type="button" id="btn-reset" class="btn btn-reset btn-ghost-action">Nullstill</button>
        </div>
        <p class="session-sheet-tier session-sheet-tier--expanded-hint">Notater og nedlasting finner du under kartet.</p>
      </div>
    </div>

    <div class="session-scroll-stack">
      <section class="map-section surface session-map-meta" aria-label="Kart og lenker">
        <div class="section-head">
          <h2 class="section-head__title">Kart</h2>
          <span class="section-head__meta" id="map-meta"></span>
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

    <section
      class="session-photos-strip surface"
      id="session-photos-strip"
      hidden
      aria-label="Bilder fra oppdraget"
    >
      <div class="session-sheet-tier session-sheet-tier--secondary">
        <button type="button" id="btn-session-photos-save" class="btn btn-secondary" aria-label="Lagre bilder fra denne økta">Lagre bilder</button>
      </div>
      <p id="session-photos-folders-summary" class="session-photos-folders-summary" hidden aria-live="polite"></p>
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
    </div>

    <div id="session-toast" class="session-toast" role="status" aria-live="polite" hidden></div>
  </div>`
}

function renderApp() {
  // #region agent log
  const __renderT0 = performance.now()
  // #endregion
  const mount = document.querySelector('#app')
  if (!mount) {
    console.warn('renderApp: fant ikke #app')
    return
  }
  /** Fjern ev. gammelt AI-overlay lagt på body (unngå usynlig lag som blokkerer klikk). */
  document.querySelector('body > #home-ai-fullscreen')?.remove()
  /** Pull-to-refresh-overlay kan være flyttet til body for korrekt fullskjerm; fjern før ny DOM. */
  document.querySelector('body > #home-pull-refresh-overlay')?.remove()
  /** AI-dokumentering kan være flyttet til body for korrekt fixed-stack; fjern før #app byttes (unngår spøkelseslag / duplikat-ID). */
  const orphanAiPanel = document.getElementById('panel-home-bilde-ai')
  if (orphanAiPanel && orphanAiPanel.parentElement === document.body) {
    orphanAiPanel.remove()
    syncHomeAiPanelBodyClass()
  }
  destroySharedReviewMap()
  const banner = insecureContextBannerHtml() + offlineModeBannerHtml()
  let main = ''
  if (!currentUser) {
    main = renderAuthHtml()
  } else if (view === 'session') main = renderSessionHtml()
  else if (view === 'advRegIntro') main = renderAdvancedRegisterIntroHtml()
  else if (view === 'advRegSession') main = renderAdvancedRegisterSessionHtml()
  else if (view === 'advRegReport') main = renderAdvancedRegisterReportHtml()
  else if (view === 'menuSession') main = renderMenuSessionHtml()
  else if (view === 'menuUser') main = renderMenuUserHtml()
  else if (view === 'menuMap') main = renderMenuMapHtml()
  else if (view === 'menuFriction') main = renderMenuFrictionHtml()
  else if (view === 'menuPhotos') main = renderMenuPhotosHtml()
  else if (view === 'menuContacts') main = renderMenuContactsHtml()
  else if (view === 'menuTrafficGroup') main = renderMenuTrafficGroupHtml()
  else if (view === 'menuOfflineVegref') main = renderMenuOfflineVegrefHtml()
  else if (view === 'menuSettings') main = renderMenuSettingsHtml()
  else if (view === 'menuHaptics') main = renderMenuHapticsHtml()
  else if (view === 'menuPrivacy') main = renderMenuPrivacyHtml()
  else if (view === 'menuSupport') main = renderMenuSupportHtml()
  else if (view === 'menuFinnObjekter') main = renderFinnObjekterHtml()
  else if (view === 'menuExcelExport') main = renderMenuExcelExportHtml()
  else if (view === 'menuFollowUpRoute') main = renderMenuFollowUpRouteHtml()
  else if (view === 'followUpRouteEdit') main = renderFollowUpRouteEditHtml()
  else if (view === 'inbox') main = renderInboxHtml()
  else if (view === 'sharedSessionReview')
    main = renderSharedSessionReviewHtml()
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
  /** Bevar økt-kartets DOM ved re-render så Leaflet og flis-cache ikke nullstilles. */
  let preservedSessionMapFrame = null
  if (view === 'session' && map) {
    try {
      const c = map.getContainer()
      const frame = document.getElementById('session-map-frame')
      if (frame && c && frame.contains(c)) {
        frame.remove()
        preservedSessionMapFrame = frame
      }
    } catch {
      preservedSessionMapFrame = null
    }
  }
  mount.innerHTML = `${banner}<div class="app-body">${main}</div>${kmtShell}${incomingShareSaveShell}${photoFullscreenShell}`
  if (preservedSessionMapFrame) {
    const placeholder = document.getElementById('session-map-frame')
    if (placeholder?.parentNode) {
      placeholder.parentNode.replaceChild(preservedSessionMapFrame, placeholder)
    }
  }
  const homeShellView = Boolean(
    currentUser &&
      (view === 'home' ||
        view === 'menuTrafficGroup' ||
        view === 'menuOfflineVegref' ||
        view === 'photoAlbum' ||
        view === 'menuPhotos'),
  )
  mount.classList.toggle('app-root--home', homeShellView)
  /* Bakgrunn på html: Safari/mobil + overscroll bruker ofte body/html — ikke bare #app */
  document.documentElement.classList.toggle('scanix-home-view', homeShellView)
  document.body.classList.toggle('scanix-home-view', homeShellView)
  syncLaunchSplash({ currentUser, view, appMount: mount })
  wirePhotoFullscreenDialog()
  if (view === 'menuMap') {
    queueMicrotask(() => void initMenuBrowseMap())
  } else {
    destroyMenuBrowseMap()
  }
  if (view !== 'followUpRouteEdit') {
    destroyFollowUpRouteMaps()
    followUpPulseStop()
  }
  if (view === 'menuFriction') {
    queueMicrotask(() => void initFrictionMap())
  } else {
    destroyFrictionMap()
  }
  if (view === 'menuOfflineVegref') {
    queueMicrotask(() => void initOfflineVegMap())
  } else {
    destroyOfflineVegMap()
  }
  if (view === 'menuFinnObjekter') {
    queueMicrotask(() => void initFinnObjekterMap())
  } else {
    destroyFinnObjekterMap()
  }
  if (view === 'session') {
    queueMicrotask(() => void ensureSessionPhotosFullFromRemoteIfPending())
  }
  // #region agent log
  {
    const __rd = performance.now() - __renderT0
    if (__rd > 95) {
      scanixDebugFreezeLog('H5', 'main.js:renderApp', 'slow_render', {
        ms: Math.round(__rd * 10) / 10,
        view,
      })
    }
  }
  // #endregion
}

let homeAbort = null
let authAbort = null
let menuSessionAbort = null
let menuUserAbort = null
let menuMapAbort = null
let menuFrictionAbort = null
let menuPhotosAbort = null
/** Når satt: vis bilder i denne mappen; null = kun mappeoversikt. */
let menuPhotosOpenFolderKey = /** @type {string | null} */ (null)
/** Unngå parallelle mappe-hentinger for samme mappe. */
let menuPhotosFolderPixelFetchKey = /** @type {string | null} */ (null)
let sessionPhotosFullFetchInFlight = false
let menuContactsAbort = null
let menuTrafficGroupAbort = null
let menuInfoAbort = null
/** @type {AbortController | null} */
let menuHapticsAbort = null
let menuFinnObjekterAbort = null
let menuExcelExportAbort = null
/** Under programmatisk oppdatering av veg-celler (unngå at det telles som brukerredigering). */
let excelSheetVegrefApplying = false
/** @type {ReturnType<typeof setInterval> | null} */
let menuExcelVegLivePollId = null
/** @type {ReturnType<typeof setInterval> | null} */
let inboxAbort = null
let sessionAbort = null
/** Avansert registering (egen flyt). */
let advRegAbort = null
let photoAlbumAbort = null
let receivedPhotosAbort = null
let sharedReviewAbort = null

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
 * `user_app_state` kan henge (nett/PostgREST). Vi faller tilbake til lokalt i stedet for å stoppe innlogging.
 * @param {string} userId
 */
async function fetchUserAppStateWithTimeBudget(userId) {
  /* Må være ≥ global fetch-timeout i supabaseClient (én full `select payload`). */
  const ms = 92_000
  try {
    return await awaitWithTimeout(
      fetchRemoteUserAppState(userId, { mode: 'full' }),
      ms,
      'Synk',
    )
  } catch {
    console.warn(
      `Scanix: user_app_state avbrutt etter ${ms}ms — fortsetter med lokale data.`,
    )
    return null
  }
}

/**
 * Hent `user_app_state` fra delsky med samme Wi‑Fi/mobilnett-regel som bildeopplasting.
 * @param {string} userId
 */
async function fetchUserAppStateWithNetworkGate(userId) {
  await refreshNativeNetworkStatus()
  const defer = getHeavyCloudTrafficDeferralReason()
  if (defer === 'offline') return null
  if (defer === 'metered') {
    const msg =
      'Du ser ut til å bruke mobilnett, ikke Wi‑Fi. Å hente alt fra delsky (økter og bilder) kan bruke mye mobildata.\n\nVil du hente nå?\n\nAvbryt = kun data som allerede ligger på enheten. Du kan slå på «Tillat opplasting på mobilnett» under Innstillinger → Offline.'
    if (typeof confirm !== 'function' || !confirm(msg)) {
      showSessionToast(
        'Kun lokale data brukes. Koble til Wi‑Fi, eller aktiver «Tillat opplasting på mobilnett» i Innstillinger for å hente eller sende til delsky.',
        7000,
      )
      return null
    }
    writePhotoUploadAllowOnCellular(true)
  }
  return fetchUserAppStateWithTimeBudget(userId)
}

/**
 * Henter piksler for én vei-mappe fra sky (tungt) — kun når bruker har åpnet mappen i meny.
 * @param {string} folderKey
 */
async function pullStandaloneFolderPixelsFromSupabase(folderKey) {
  if (isMinDownloadMode()) return
  const sb = getSupabase()
  if (!sb || !currentUser?.id || !folderKey) return
  if (menuPhotosFolderPixelFetchKey === folderKey) return
  try {
    await refreshNativeNetworkStatus()
  } catch {
    /* ignore */
  }
  if (shouldDeferPhotoUploadOnNetwork()) {
    showSessionToast(
      'Synk av bilder fra sky for denne mappen utsettes til Wi‑Fi (samme valg som «Tillat opplasting på mobilnett» i Innstillinger → Offline). Lokale bilder vises.',
      5200,
    )
    return
  }
  menuPhotosFolderPixelFetchKey = folderKey
  try {
    const raw = await fetchStandalonePhotosForFolder(
      sb,
      currentUser.id,
      folderKey,
    )
    if (!Array.isArray(raw) || raw.length === 0) return
    const incoming = normalizeStandalonePhotosList(raw)
    if (!incoming.length) return
    standalonePhotos = mergeStandalonePhotoLists(standalonePhotos, incoming)
    if (await isPhotoBlobStoreAvailable()) {
      for (const ph of incoming) {
        if (!photoRecordHasPixelData(ph)) continue
        try {
          await putPhotoDataUrl(
            ph.id,
            /** @type {{ dataUrl: string }} */ (ph).dataUrl,
          )
        } catch {
          /* ignore */
        }
      }
    }
    saveAppState()
    if (view === 'menuPhotos' && menuPhotosOpenFolderKey === folderKey) {
      renderApp()
      bindListenersForCurrentView()
    }
  } catch (e) {
    console.warn('pullStandaloneFolderPixelsFromSupabase', e)
  } finally {
    if (menuPhotosFolderPixelFetchKey === folderKey) {
      menuPhotosFolderPixelFetchKey = null
    }
  }
}

/**
 * Lett sky-synk kan strippe økt-bilder; ved aktiv økt: hent full payload én gang når piksel mangler.
 */
async function ensureSessionPhotosFullFromRemoteIfPending() {
  if (isMinDownloadMode()) return
  const sb = getSupabase()
  if (!sb || !currentUser?.id || sessionPhotosFullFetchInFlight) return
  const sid = currentSessionId
  if (!sid) return
  const sess0 = sessions.find((s) => s.id === sid)
  if (!sess0?.photos?.length) return

  let idbFilled = false
  try {
    idbFilled = await hydrateAllAppPhotoPixelsFromIdb()
  } catch (e) {
    console.warn('hydrateAllAppPhotoPixelsFromIdb (session)', e)
  }
  if (idbFilled) {
    state = loadCurrentSessionState()
    saveAppState()
    renderApp()
    bindListenersForCurrentView()
  }

  const sess = sessions.find((s) => s.id === sid)
  if (!sess?.photos?.length) return
  const needsNetwork = sess.photos.some((p) => {
    if (photoRecordHasPixelData(p)) return false
    if (photoRecordHasListThumb(p)) return false
    const sp = /** @type {{ storageFullPath?: string }} */ (p).storageFullPath
    if (typeof sp === 'string' && sp.trim()) return false
    return true
  })
  if (!needsNetwork) return

  sessionPhotosFullFetchInFlight = true
  try {
    const full = await fetchRemoteUserAppState(currentUser.id, { mode: 'full' })
    if (!full) return
    const diskApp = await loadAppStateFromStorageForUser(currentUser.id)
    sessions = mergeRemoteAndDiskSessions(
      full.sessions.map(normalizeSession).filter(Boolean),
      diskApp.sessions.map(normalizeSession).filter(Boolean),
    )
    state = loadCurrentSessionState()
    await persistAllAppPhotoPixelsToIdb()
    saveAppState()
    renderApp()
    bindListenersForCurrentView()
  } catch (e) {
    console.warn('ensureSessionPhotosFullFromRemoteIfPending', e)
  } finally {
    sessionPhotosFullFetchInFlight = false
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {import('@supabase/supabase-js').Session} session
 */
async function applySupabaseSessionAndNavigate(sb, session) {
  let profileUser
  try {
    profileUser = await awaitWithTimeout(
      buildCurrentUserFromSession(sb, session),
      42_000,
      'Profil',
    )
  } catch {
    console.warn('Scanix: profil (ensureProfile) tidsavbrudd')
    void sb.auth.signOut()
    currentUser = null
    const errEl = document.getElementById('auth-error')
    if (errEl) {
      errEl.textContent =
        'Kunne ikke hente brukerprofil i tide. Sjekk nett og prøv igjen.'
    }
    return
  }
  currentUser = profileUser
  if (!tryWriteAuthSession(currentUser)) {
    currentUser = null
    void sb.auth.signOut()
    const errEl = document.getElementById('auth-error')
    if (errEl) errEl.textContent = authStorageFailedUserMessage()
    return
  }
  void requestPersistedStorageIfSupported()
  void backupAuthToIdb(loadUsersFromStorage(), currentUser)
  const remote = await fetchUserAppStateForHydrate(session.user.id)
  const diskApp = await loadAppStateFromStorageForUser(currentUser.id)
  if (remote) {
    const remoteSessions = remote.sessions.map(normalizeSession).filter(Boolean)
    const diskSessions = diskApp.sessions.map(normalizeSession).filter(Boolean)
    sessions = mergeRemoteAndDiskSessions(remoteSessions, diskSessions)
    currentSessionId = remote.currentSessionId
    standalonePhotos = mergeStandalonePhotoLists(
      normalizeStandalonePhotosList(remote.standalonePhotos),
      diskApp.standalonePhotos,
    )
    frictionMeasurements = mergeFrictionMeasurementLists(
      normalizeFrictionMeasurementsList(remote.frictionMeasurements),
      diskApp.frictionMeasurements,
    )
    const mergedFrictionIds = mergeFrictionSessionStateFromRemote(
      diskApp,
      remote,
    )
    frictionActiveSessionId = mergedFrictionIds.frictionActiveSessionId
    frictionPreviousSessionId = mergedFrictionIds.frictionPreviousSessionId
    if (remoteSessions.length === 0 && sessions.length > 0) {
      queueDelskyBaselineFromLocalSessions()
    }
  } else {
    sessions = diskApp.sessions
    currentSessionId = diskApp.currentSessionId
    standalonePhotos = diskApp.standalonePhotos
    frictionMeasurements = diskApp.frictionMeasurements
    applyFrictionSessionIdsFromDisk(diskApp)
    /* Hydrate ga null (ingen rad, nett-feil, eller timeout). Kun når vi *vet* at det ikke finnes rad i
       `user_app_state`, kø første gangs opplasting — unngår å overskrive ekte sky-data ved hengende fetch. */
    if (
      sessions.length > 0 &&
      typeof navigator !== 'undefined' &&
      navigator.onLine !== false
    ) {
      try {
        if (isScanixCloudApiConfigured()) {
          const exists = await cloudProbeAppStateExists()
          if (exists === false) queueDelskyBaselineFromLocalSessions()
        } else {
          const { data: rowProbe, error: probeErr } = await sb
            .from('user_app_state')
            .select('user_id')
            .eq('user_id', session.user.id)
            .maybeSingle()
          if (!probeErr && !rowProbe) {
            queueDelskyBaselineFromLocalSessions()
          }
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (currentSessionId && !sessions.some((s) => s.id === currentSessionId)) {
    currentSessionId =
      typeof diskApp.currentSessionId === 'string' &&
      sessions.some((s) => s.id === diskApp.currentSessionId)
        ? diskApp.currentSessionId
        : null
  }
  lastResumeSessionId =
    typeof diskApp.lastResumeSessionId === 'string'
      ? diskApp.lastResumeSessionId
      : null
  if (
    lastResumeSessionId &&
    !sessions.some((s) => s.id === lastResumeSessionId)
  ) {
    lastResumeSessionId = null
  }
  state = loadCurrentSessionState()
  try {
    if (await hydrateAllAppPhotoPixelsFromIdb()) {
      state = loadCurrentSessionState()
    }
  } catch (e) {
    console.warn('hydrateAllAppPhotoPixelsFromIdb (login)', e)
  }
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
  saveAppState()
  void tryDrainPhotoUploadQueue({ userId: currentUser.id }).finally(() => {
    syncPhotoUploadDeferralBanner()
  })
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
      const submitBtn = document.getElementById('btn-auth-login-submit')
      const setBusy = (busy) => {
        if (submitBtn) {
          submitBtn.disabled = busy
          submitBtn.setAttribute('aria-busy', busy ? 'true' : 'false')
        }
      }
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
        setBusy(true)
        if (errEl) errEl.textContent = 'Logger inn…'
        try {
          const { data, error } = await awaitWithTimeout(
            sb.auth.signInWithPassword({
              email,
              password,
            }),
            AUTH_SIGN_IN_TIMEOUT_MS,
            'Innlogging',
          )
          if (error || !data.session) {
            if (errEl) {
              errEl.textContent = mapSupabaseAuthError(
                error ?? new Error('Ingen sesjon'),
              )
            }
            return
          }
          if (errEl) errEl.textContent = 'Laster data…'
          await awaitWithTimeout(
            applySupabaseSessionAndNavigate(sb, data.session),
            AUTH_APPLY_SESSION_TIMEOUT_MS,
            'Laster brukerdata',
          )
        } catch (err) {
          console.warn('Scanix login (Supabase):', err)
          if (errEl) {
            const m = err instanceof Error ? err.message : String(err)
            if (m.includes('timeout')) {
              if (m.includes('Innlogging')) {
                errEl.textContent =
                  'Innlogging tok for lang tid (tregt nett eller Supabase svarer sent). Prøv igjen — ved store økter i sky kan første innlasting ta et minutt eller mer.'
              } else if (m.includes('Profil')) {
                errEl.textContent =
                  'Kunne ikke hente profil i tide. Sjekk nett og prøv igjen.'
              } else {
                errEl.textContent =
                  'Tidsavbrudd under innlasting av brukerdata (profil/delsky). Prøv igjen — ved mye data i sky kan det ta litt tid.'
              }
            } else {
              const friendly = mapFetchErrorToUserMessage(m)
              errEl.textContent =
                friendly !== m
                  ? friendly
                  : m.length > 0 && m.length < 220
                    ? m
                    : 'Noe gikk galt ved innlogging. Prøv igjen.'
            }
          }
        } finally {
          setBusy(false)
        }
        return
      }
      setBusy(true)
      if (errEl) errEl.textContent = 'Logger inn…'
      try {
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
        const app = await loadAppStateFromStorageForUser(u.id)
        sessions = app.sessions
        currentSessionId = app.currentSessionId
        standalonePhotos = app.standalonePhotos
        frictionMeasurements = app.frictionMeasurements
        lastResumeSessionId =
          typeof app.lastResumeSessionId === 'string'
            ? app.lastResumeSessionId
            : null
        if (currentSessionId && !sessions.some((s) => s.id === currentSessionId)) {
          currentSessionId = null
        }
        if (
          lastResumeSessionId &&
          !sessions.some((s) => s.id === lastResumeSessionId)
        ) {
          lastResumeSessionId = null
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
      } catch (err) {
        console.warn('Scanix login (lokal):', err)
        if (errEl) {
          const m = err instanceof Error ? err.message : String(err)
          const friendly = mapFetchErrorToUserMessage(m)
          errEl.textContent =
            friendly !== m
              ? friendly
              : m.length > 0 && m.length < 220
                ? m
                : 'Noe gikk galt ved innlogging. Prøv igjen.'
        }
      } finally {
        setBusy(false)
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
        try {
          const { data, error } = await awaitWithTimeout(
            sbReg.auth.signUp({
              email,
              password,
              options: {
                data: { full_name: name.slice(0, AUTH_NAME_MAX_LEN) },
              },
            }),
            AUTH_SIGN_IN_TIMEOUT_MS,
            'Registrering',
          )
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
          await awaitWithTimeout(
            applySupabaseSessionAndNavigate(sbReg, data.session),
            AUTH_APPLY_SESSION_TIMEOUT_MS,
            'Laster brukerdata',
          )
          saveAppState()
        } catch (err) {
          console.warn('Scanix registrering (Supabase):', err)
          if (errEl) {
            const m = err instanceof Error ? err.message : String(err)
            if (m.includes('timeout')) {
              if (m.includes('Registrering')) {
                errEl.textContent =
                  'Registrering tok for lang tid. Sjekk nett og prøv igjen.'
              } else if (m.includes('Profil')) {
                errEl.textContent =
                  'Kunne ikke hente profil i tide. Sjekk nett og prøv igjen.'
              } else {
                errEl.textContent =
                  'Tidsavbrudd under innlasting av brukerdata (profil/delsky). Prøv igjen — ved mye data i sky kan det ta litt tid.'
              }
            } else {
              const friendly = mapFetchErrorToUserMessage(m)
              errEl.textContent =
                friendly !== m
                  ? friendly
                  : m.length > 0 && m.length < 220
                    ? m
                    : 'Noe gikk galt ved registrering. Prøv igjen.'
            }
          }
        }
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
      frictionMeasurements = []
      frictionActiveSessionId = null
      frictionPreviousSessionId = null
      lastResumeSessionId = null
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
  stashActiveSessionForResumeBeforeLeave()
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
  stashActiveSessionForResumeBeforeLeave()
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
  stashActiveSessionForResumeBeforeLeave()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuMap'
  saveAppState()
  renderApp()
  bindMenuMapListeners()
}

function openMenuFrictionView() {
  closeHomeDrawer()
  stashActiveSessionForResumeBeforeLeave()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuFriction'
  saveAppState()
  renderApp()
  bindMenuFrictionListeners()
}

function openMenuPhotosView() {
  closeHomeDrawer()
  stashActiveSessionForResumeBeforeLeave()
  menuPhotosOpenFolderKey = null
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuPhotos'
  saveAppState()
  renderApp()
  bindMenuPhotosListeners()
}

function openMenuContactsView() {
  closeHomeDrawer()
  stashActiveSessionForResumeBeforeLeave()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuContacts'
  saveAppState()
  renderApp()
  bindMenuContactsListeners()
}

function openMenuTrafficGroupView() {
  closeHomeDrawer()
  stashActiveSessionForResumeBeforeLeave()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuTrafficGroup'
  saveAppState()
  renderApp()
  bindMenuTrafficGroupListeners()
}

function openMenuOfflineVegrefView() {
  closeHomeDrawer()
  stashActiveSessionForResumeBeforeLeave()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuOfflineVegref'
  offlineVegSearchError = ''
  offlineVegDownloadError = ''
  offlineVegDownloadStatus = ''
  saveAppState()
  renderApp()
  bindMenuOfflineVegrefListeners()
}

function openMenuSettingsView() {
  closeHomeDrawer()
  stashActiveSessionForResumeBeforeLeave()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuSettings'
  saveAppState()
  renderApp()
  bindMenuInfoListeners()
}

function openMenuHapticsView() {
  closeHomeDrawer()
  stashActiveSessionForResumeBeforeLeave()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuHaptics'
  saveAppState()
  renderApp()
  bindMenuHapticsListeners()
}

function openMenuPrivacyView() {
  closeHomeDrawer()
  stashActiveSessionForResumeBeforeLeave()
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
  stashActiveSessionForResumeBeforeLeave()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuSupport'
  saveAppState()
  renderApp()
  bindMenuInfoListeners()
}

function openMenuFinnObjekterView() {
  closeHomeDrawer()
  stashActiveSessionForResumeBeforeLeave()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuFinnObjekter'
  saveAppState()
  renderApp()
  if (menuFinnObjekterAbort) menuFinnObjekterAbort.abort()
  menuFinnObjekterAbort = new AbortController()
  bindFinnObjekterListeners(menuFinnObjekterAbort.signal, { onBack: goHome })
}

function openMenuExcelExportView() {
  closeHomeDrawer()
  stashActiveSessionForResumeBeforeLeave()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'menuExcelExport'
  saveAppState()
  renderApp()
  bindMenuExcelExportListeners()
}

/** Safe area top (px) for pull-to-refresh sone. */
function getHomePullSafeInsetTop() {
  if (typeof document === 'undefined') return 0
  const el = document.createElement('div')
  el.style.cssText =
    'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top, 0px)'
  document.body.appendChild(el)
  const pt = getComputedStyle(el).paddingTop
  document.body.removeChild(el)
  const n = parseFloat(pt)
  return Number.isFinite(n) ? n : 0
}

function homePullRefreshAllowed() {
  if (view !== 'home') return false
  if (kmtDialogOpen) return false
  const ai = document.getElementById('panel-home-bilde-ai')
  if (ai && !ai.hasAttribute('hidden')) return false
  const dr = document.getElementById('home-drawer')
  if (dr && !dr.hasAttribute('hidden')) return false
  return true
}

/**
 * Hindre tekstvalg/kopiering i vegreferansefeltet (iOS WebView ignorerer ofte user-select på barn).
 * @param {AbortSignal} signal
 */
function setupHomeVegrefBlockTextSelection(signal) {
  const host = document.getElementById('home-vegref')
  if (!host) return
  const block = (e) => {
    e.preventDefault()
  }
  host.addEventListener('selectstart', block, { signal, capture: true })
  host.addEventListener('dragstart', block, { signal, capture: true })
  host.addEventListener('contextmenu', block, { signal, capture: true })
}

/**
 * Forside: hold ~0,1 s i øvre sone, deretter dra ned for full reload (Capacitor/WebView).
 * @param {AbortSignal} signal
 */
function setupHomePullToRefresh(signal) {
  const HOLD_MS = 100
  const TOP_EXTRA_PX = 118
  const MOVE_CANCEL_PX = 14
  const TRIGGER_PX = 72
  const MAX_VISUAL_PX = 96

  let phase = /** @type {'idle' | 'holding' | 'armed' | 'refreshing'} */ ('idle')
  /** @type {ReturnType<typeof setTimeout> | null} */
  let holdTimer = null
  let startY = 0
  let startX = 0
  let activeId = /** @type {number | null} */ (null)
  let maxPull = 0

  const root = () => document.getElementById('home-pull-refresh')

  const setDy = (px) => {
    const el = root()
    if (el) {
      el.style.setProperty(
        '--home-pull-dy',
        `${Math.max(0, Math.min(MAX_VISUAL_PX, Math.round(px)))}px`,
      )
    }
  }

  const resetUi = () => {
    const el = root()
    if (el) {
      el.classList.remove('home-pull-refresh--armed')
      el.style.setProperty('--home-pull-dy', '0px')
    }
  }

  const clearHold = () => {
    if (holdTimer != null) {
      clearTimeout(holdTimer)
      holdTimer = null
    }
  }

  const findTouch = (e, id) => {
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === id) return e.touches[i]
    }
    return null
  }

  /**
   * @param {TouchEvent} e
   */
  const onStart = (e) => {
    if (phase === 'refreshing') return
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    if (!homePullRefreshAllowed()) return
    const topBound = getHomePullSafeInsetTop() + TOP_EXTRA_PX
    if (t.clientY > topBound) return

    clearHold()
    phase = 'holding'
    startY = t.clientY
    startX = t.clientX
    activeId = t.identifier
    maxPull = 0
    resetUi()
    setDy(0)

    holdTimer = window.setTimeout(() => {
      holdTimer = null
      if (phase !== 'holding') return
      const el = root()
      if (!el) return
      phase = 'armed'
      el.classList.add('home-pull-refresh--armed')
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(10)
        }
      } catch {
        /* ignore */
      }
    }, HOLD_MS)
  }

  /**
   * @param {TouchEvent} e
   */
  const onMove = (e) => {
    if (phase !== 'holding' && phase !== 'armed') return
    if (activeId == null) return
    const t = findTouch(e, activeId)
    if (!t) return

    if (phase === 'holding') {
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
        clearHold()
        phase = 'idle'
        resetUi()
        activeId = null
      }
      return
    }

    if (phase === 'armed') {
      const pull = t.clientY - startY
      maxPull = Math.max(maxPull, pull)
      setDy(Math.min(Math.max(pull, 0), MAX_VISUAL_PX))
      if (pull > 10) {
        e.preventDefault()
      }
    }
  }

  /**
   * @param {TouchEvent} e
   */
  const onEnd = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const c = e.changedTouches[i]
      if (c.identifier !== activeId) continue
      if (phase === 'armed') {
        const pull = c.clientY - startY
        maxPull = Math.max(maxPull, pull)
      }
      break
    }

    let matched = false
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeId) {
        matched = true
        break
      }
    }
    if (!matched) return

    clearHold()

    if (phase === 'holding') {
      phase = 'idle'
      resetUi()
      activeId = null
      return
    }

    if (phase === 'armed') {
      if (maxPull >= TRIGGER_PX) {
        phase = 'refreshing'
        const el = root()
        el?.classList.remove('home-pull-refresh--armed')
        const ov = document.getElementById('home-pull-refresh-overlay')
        if (ov) {
          ov.removeAttribute('hidden')
          if (ov.parentElement !== document.body) {
            document.body.appendChild(ov)
          }
        }
        document.getElementById('app')?.setAttribute('aria-busy', 'true')
        requestAnimationFrame(() => {
          window.setTimeout(() => {
            window.location.reload()
          }, 150)
        })
      } else {
        resetUi()
        phase = 'idle'
      }
      activeId = null
      return
    }

    activeId = null
  }

  window.addEventListener('touchstart', onStart, { capture: true, passive: true, signal })
  window.addEventListener('touchmove', onMove, { capture: true, passive: false, signal })
  window.addEventListener('touchend', onEnd, { capture: true, passive: true, signal })
  window.addEventListener('touchcancel', onEnd, { capture: true, passive: true, signal })
}

function bindHomeListeners() {
  if (homeAbort) homeAbort.abort()
  homeAbort = new AbortController()
  const { signal } = homeAbort
  const openInbox = () => openInboxMessagesView()
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
    .getElementById('btn-home-nav-resume')
    ?.addEventListener('click', () => continueLastSessionFromHome(), { signal })
  document
    .getElementById('btn-home-nav-ai')
    ?.addEventListener('click', () => setHomeBildeSubTab('ai'), { signal })
  document
    .getElementById('btn-home-nav-history')
    ?.addEventListener('click', () => openMenuSession('sessions'), { signal })
  document.getElementById('btn-home-registrering')?.addEventListener(
    'click',
    () => {
      view = 'advRegIntro'
      renderApp()
      bindListenersForCurrentView()
    },
    { signal },
  )
  document
    .getElementById('btn-home-kamera')
    ?.addEventListener('click', () => openTaBildeFromHome(), { signal })
  document
    .getElementById('btn-home-kontraktai')
    ?.addEventListener('click', () => openHomeAiAskContract(), { signal })
  document
    .getElementById('btn-home-album')
    ?.addEventListener('click', () => openMenuPhotosView(), { signal })
  document
    .getElementById('btn-home-delsky')
    ?.addEventListener('click', () => openInboxView(), { signal })
  document
    .getElementById('btn-home-excel')
    ?.addEventListener('click', () => openMenuExcelExportView(), { signal })
  document
    .getElementById('btn-home-strekning')
    ?.addEventListener('click', () => openKmtDialog(), { signal })
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
  document.getElementById('home-drawer-photos')?.addEventListener(
    'click',
    () => openMenuPhotosView(),
    { signal },
  )
  document.getElementById('home-drawer-friction')?.addEventListener(
    'click',
    () => openMenuFrictionView(),
    { signal },
  )
  document.getElementById('home-drawer-contacts')?.addEventListener(
    'click',
    () => openMenuContactsView(),
    { signal },
  )
  document.getElementById('home-drawer-traffic-group')?.addEventListener(
    'click',
    () => openMenuTrafficGroupView(),
    { signal },
  )
  document.getElementById('home-drawer-offline-vegref')?.addEventListener(
    'click',
    () => openMenuOfflineVegrefView(),
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
  document.getElementById('home-drawer-haptics')?.addEventListener(
    'click',
    () => openMenuHapticsView(),
    { signal },
  )
  document.getElementById('home-drawer-finn-obj')?.addEventListener(
    'click',
    () => openMenuFinnObjekterView(),
    { signal },
  )
  document.getElementById('home-drawer-excel-export')?.addEventListener(
    'click',
    () => {
      closeHomeDrawer()
      openMenuExcelExportView()
    },
    { signal },
  )
  document.getElementById('home-drawer-followup-route')?.addEventListener(
    'click',
    () => {
      closeHomeDrawer()
      openMenuFollowUpRouteView()
    },
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
  setupHomeVegrefBlockTextSelection(signal)
  setupHomePullToRefresh(signal)
  startHomeVegrefTracking()
  refreshHomeWeatherOnHomeEnter()
  scheduleBrowserHomeAutoHydrateIfEmpty()

  const homeImportInput = document.getElementById('home-import-session-input')
  document.getElementById('btn-home-import-pick')?.addEventListener(
    'click',
    () => homeImportInput?.click(),
    { signal },
  )
  homeImportInput?.addEventListener(
    'change',
    async (ev) => {
      const input = ev.target
      const file = input.files?.[0]
      input.value = ''
      const st = document.getElementById('home-import-status')
      if (!file) return
      await runImportSessionFromHtmlFile(file, st)
    },
    { signal },
  )
  document.getElementById('btn-home-sync-pull')?.addEventListener(
    'click',
    () => {
      const st = document.getElementById('home-import-status')
      if (st) st.textContent = 'Henter fra sky …'
      void (async () => {
        try {
          await hydrateUserAppStateFromRemote()
          if (st) {
            st.textContent =
              'Synk ferdig. Sjekk økter under «Økten» i menyen (evt. gjenoppta).'
          }
        } catch {
          if (st) st.textContent = 'Kunne ikke fullføre henting. Prøv igjen.'
        }
      })()
    },
    { signal },
  )
}

function captureHomeAiLayoutHeight() {
  const vv = window.visualViewport
  const raw = Math.max(
    window.innerHeight || 0,
    document.documentElement?.clientHeight || 0,
    vv?.height || 0,
  )
  const fallback =
    window.innerHeight ||
    document.documentElement?.clientHeight ||
    667
  homeAiLayoutHeightPx = Math.round(raw > 80 ? raw : fallback)
}

/**
 * --home-ai-keyboard-inset: ekstra bunnluft i .home-ai-fullscreen når tastatur er åpent.
 * Vi setter ikke lenger height i px på panelet – det ga ofte kortere høyde enn viewport (svart stripe nederst).
 */
function resetHomeAiPanelVisualViewport(panel) {
  panel.classList.remove('home-ai-panel--vv')
  panel.style.removeProperty('--home-ai-keyboard-inset')
}

/**
 * --home-ai-keyboard-inset: kun når chat-feltet har fokus (tastatur sannsynligvis åpent).
 * Heistikken layoutH - visualViewport.height ga falske positive på Safari (verktøylinje, ikke tastatur)
 * og satte ofte 56–80px+ inset → tom sone under den faste bunnlinjen uten at tastatur var åpent.
 */
function applyHomeAiPanelVisualViewport(panel) {
  panel.classList.add('home-ai-panel--vv')
  if (!homeAiLayoutHeightPx) {
    captureHomeAiLayoutHeight()
  }

  const input = document.getElementById('home-ai-chat-input')
  const focusedOnChat =
    input &&
    document.activeElement === input &&
    panel &&
    panel.contains(input)

  const vv = window.visualViewport
  if (!vv || !focusedOnChat) {
    panel.style.removeProperty('--home-ai-keyboard-inset')
    return
  }

  const layoutH =
    homeAiLayoutHeightPx ||
    Math.max(
      window.innerHeight || 0,
      document.documentElement?.clientHeight || 0,
    )

  const inset = Math.max(0, layoutH - vv.offsetTop - vv.height)

  if (inset > 0) {
    panel.style.setProperty('--home-ai-keyboard-inset', `${inset}px`)
  } else {
    panel.style.removeProperty('--home-ai-keyboard-inset')
  }
}

function updateHomeAiPanelVisualViewport() {
  const panel = document.getElementById('panel-home-bilde-ai')
  if (!panel || panel.hidden) {
    if (panel) resetHomeAiPanelVisualViewport(panel)
    return
  }
  applyHomeAiPanelVisualViewport(panel)
}

function bindHomeAiPanelVisualViewport(signal) {
  const schedule = () => {
    requestAnimationFrame(() => updateHomeAiPanelVisualViewport())
  }
  window.addEventListener('resize', schedule, { signal })
  window.addEventListener(
    'orientationchange',
    () => {
      homeAiLayoutHeightPx = 0
      schedule()
    },
    { signal },
  )
  const vv = window.visualViewport
  if (vv) {
    vv.addEventListener('resize', schedule, { signal })
    vv.addEventListener('scroll', schedule, { signal })
  }
}

/** Synkroniser body-klasse når AI-fullskjerm er åpen (skjul forsidenav, bunnnav – fiks stablelag/iOS). */
function syncHomeAiPanelBodyClass() {
  const panel = document.getElementById('panel-home-bilde-ai')
  const open = Boolean(panel && !panel.hidden)
  document.body.classList.toggle('home-ai-panel-open', open)
  document.documentElement.classList.toggle('home-ai-root-lock', open)
}

/**
 * Flytter AI-panelet til document.body når det er synlig, tilbake under .home-bilde-stack når kamera vises.
 * Da blir fixed/fullskjerm alltid relativt visningsporten (ikke #app / flex-foreldre) – fikser glipper og at forsiden/bunnnav skimtes i WebKit/iOS.
 */
function reparentHomeAiPanelForViewportStacking(showAi) {
  const panelAi = document.getElementById('panel-home-bilde-ai')
  const stack = document.querySelector('.home-bilde-stack')
  if (!panelAi || !stack) return
  if (showAi) {
    if (panelAi.parentElement !== document.body) {
      document.body.appendChild(panelAi)
    }
  } else if (panelAi.parentElement === document.body) {
    stack.appendChild(panelAi)
  }
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
  reparentHomeAiPanelForViewportStacking(!isCam)
  if (isCam) {
    homeAiLayoutHeightPx = 0
  } else {
    captureHomeAiLayoutHeight()
  }
  syncHomeAiPanelBodyClass()
  updateHomeAiPanelVisualViewport()
  if (!isCam) {
    const hasImg = Boolean(
      typeof homeAiCapturedDataUrl === 'string' &&
        homeAiCapturedDataUrl.trim().length > 32,
    )
    if (!hasImg) {
      applyHomeAiContractRagUi(true)
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        captureHomeAiLayoutHeight()
        updateHomeAiPanelVisualViewport()
      })
    })
  }
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

function syncHomeAiModeHint() {
  const el = document.getElementById('home-ai-mode-hint')
  if (!el) return
  el.textContent = ''
  el.hidden = true
}

function setHomeAiContractPillProgress(percent) {
  const el = document.getElementById('home-ai-contract-brand')
  if (!el) return
  const p = Math.max(0, Math.min(100, percent))
  el.style.setProperty('--contract-fill', `${p}%`)
}

function startHomeAiContractPillProgress() {
  if (!homeAiContractRagMode) return
  if (homeAiContractPillProgressTimer) {
    clearInterval(homeAiContractPillProgressTimer)
    homeAiContractPillProgressTimer = 0
  }
  let p = 5
  setHomeAiContractPillProgress(p)
  homeAiContractPillProgressTimer = window.setInterval(() => {
    const step = 2.5 + Math.random() * 6.5
    p = Math.min(90, p + step)
    setHomeAiContractPillProgress(p)
  }, 165)
}

/** @param {boolean} success full grønn ved suksess, deretter reset; false ved avbrudd/feil. */
function finishHomeAiContractPillProgress(success) {
  if (homeAiContractPillProgressTimer) {
    clearInterval(homeAiContractPillProgressTimer)
    homeAiContractPillProgressTimer = 0
  }
  if (success) {
    setHomeAiContractPillProgress(100)
    window.setTimeout(() => setHomeAiContractPillProgress(0), 480)
  } else {
    setHomeAiContractPillProgress(0)
  }
}

function applyHomeAiContractRagUi(on) {
  const brand = document.getElementById('home-ai-contract-brand')
  const input = document.getElementById('home-ai-chat-input')
  const label = document.querySelector('label[for="home-ai-chat-input"]')
  const sendBtn = document.getElementById('btn-home-ai-send')
  brand?.classList.toggle('home-ai-gpt__contract-pill--on', on)
  if (!on) finishHomeAiContractPillProgress(false)
  if (input) {
    input.placeholder = on
      ? 'Skriv spørsmålet ditt …'
      : 'Send melding til RoadMindAi …'
  }
  if (label) {
    label.textContent = 'Send melding til RoadMindAi'
  }
  if (sendBtn) {
    sendBtn.setAttribute('aria-label', 'Send melding til RoadMindAi')
  }
  syncHomeAiModeHint()
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
    homeAiCapturedDataUrl = ''
    syncHomeAiPreviewThumb()
    if (log) log.innerHTML = ''
    if (st) st.textContent = ''
    applyHomeAiContractRagUi(true)
  } else {
    homeAiContractRagMode = false
    homeAiRagMessages = []
    if (log) log.innerHTML = ''
    if (st) st.textContent = ''
    applyHomeAiContractRagUi(false)
  }
}

function openHomeAiAskContract() {
  closeHomeDrawer()
  setHomeBildeSubTab('ai')
  setHomeAiContractRagEnabled(true)
  document.getElementById('home-ai-chat-input')?.focus({ preventScroll: true })
}

function enterHomeAiChatWithImage(dataUrl) {
  applyHomeAiContractRagUi(true)
  homeAiCapturedDataUrl = dataUrl
  stopHomeAiCamera()
  const img = document.getElementById('home-ai-preview-img')
  if (img) img.src = dataUrl
  syncHomeAiPreviewThumb()
  document.getElementById('home-ai-stage-camera')?.setAttribute('hidden', '')
  document.getElementById('home-ai-stage-chat')?.removeAttribute('hidden')
  const st = document.getElementById('home-ai-status')
  if (st) st.textContent = ''
  document.getElementById('home-ai-chat-input')?.focus({ preventScroll: true })
  triggerHapticPhoto()
}

function retakeHomeAiDoc() {
  homeAiCapturedDataUrl = ''
  homeAiRagMessages = []
  const log = document.getElementById('home-ai-chat-log')
  if (log) log.innerHTML = ''
  stopHomeAiCamera()
  syncHomeAiPreviewThumb()
  document.getElementById('home-ai-stage-camera')?.setAttribute('hidden', '')
  document.getElementById('home-ai-stage-chat')?.removeAttribute('hidden')
  const st = document.getElementById('home-ai-status')
  if (st) st.textContent = ''
  applyHomeAiContractRagUi(true)
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

/** Brukes når brukeren sender bilde uten egen tekst (kontrakt-RAG + vision). */
const HOME_AI_CONTRACT_IMAGE_DEFAULT =
  'Se bildet og svar ut fra kontrakten (hva er relevant, og hva viser bildet?).'

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
  if (ph) {
    ph.textContent = ''
    ph.hidden = true
  }
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
  const hasImage = Boolean(
    homeAiCapturedDataUrl && String(homeAiCapturedDataUrl).trim().length > 0,
  )
  const hadAssistant = homeAiRagMessages.some((m) => m.role === 'assistant')

  if (hadAssistant && !textRaw && !hasImage) {
    if (statusEl) {
      statusEl.textContent =
        'Skriv et oppfølgingsspørsmål, eller legg ved et nytt bilde.'
    }
    return
  }
  if (!hadAssistant && !textRaw && !hasImage) {
    if (statusEl) {
      statusEl.textContent =
        'Skriv et spørsmål om kontrakten, eller legg ved et bilde.'
    }
    return
  }

  const textForPayload = textRaw || (hasImage ? HOME_AI_CONTRACT_IMAGE_DEFAULT : '')
  const bubbleHtml =
    textRaw.length > 0
      ? escapeHtml(textRaw).replace(/\n/g, '<br />')
      : hasImage
        ? '<em class="home-ai-gpt__em">(Bilde vedlagt)</em>'
        : escapeHtml(textForPayload).replace(/\n/g, '<br />')
  appendHomeAiChatBubble('user', `<p class="home-ai-gpt__user-p">${bubbleHtml}</p>`)
  if (input) input.value = ''

  const userMsg = hasImage
    ? {
        role: 'user',
        content: [
          { type: 'text', text: textForPayload },
          {
            type: 'image_url',
            image_url: { url: homeAiCapturedDataUrl, detail: 'high' },
          },
        ],
      }
    : { role: 'user', content: textRaw }
  homeAiRagMessages.push(userMsg)

  if (statusEl) statusEl.textContent = 'RoadMindAi tenker …'
  if (sendBtn) sendBtn.disabled = true
  startHomeAiThinkingUx()
  startHomeAiContractPillProgress()
  try {
    /** @type {Response | null} */
    let r = null
    let data = /** @type {Record<string, unknown>} */ ({})
    const maxAttempts = 2
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        r = await fetch(apiUrl('/api/contract-chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: homeAiRagMessages }),
        })
      } catch {
        if (attempt === maxAttempts) {
          throw new Error('Nettverksfeil. Prøv igjen.')
        }
        await new Promise((resolve) => setTimeout(resolve, 850 * attempt))
        continue
      }
      const ct = r.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        data = await r.json().catch(() => ({}))
      } else {
        await r.text().catch(() => '')
      }
      if (
        r.ok ||
        ![502, 503, 504].includes(r.status) ||
        attempt === maxAttempts
      ) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 850 * attempt))
    }

    if (!r) {
      homeAiRagMessages.pop()
      finishHomeAiContractPillProgress(false)
      if (statusEl) statusEl.textContent = 'Ingen respons fra serveren.'
      const log = document.getElementById('home-ai-chat-log')
      if (log?.lastElementChild) log.removeChild(log.lastElementChild)
      if (input) input.value = textRaw
      return
    }

    if (!r.ok) {
      homeAiRagMessages.pop()
      finishHomeAiContractPillProgress(false)
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
      finishHomeAiContractPillProgress(false)
      if (statusEl) statusEl.textContent = 'Tomt svar fra serveren.'
      const log = document.getElementById('home-ai-chat-log')
      if (log?.lastElementChild) log.removeChild(log.lastElementChild)
      if (input) input.value = textRaw
      return
    }

    homeAiRagMessages.push({ role: 'assistant', content: reply })
    if (hasImage) {
      homeAiCapturedDataUrl = ''
      syncHomeAiPreviewThumb()
    }
    finishHomeAiContractPillProgress(true)
    stopHomeAiThinkingUx()
    await appendHomeAiAssistantPlainTextStreamed(reply)
    triggerHapticAiReply()
    if (statusEl) statusEl.textContent = ''
  } catch (e) {
    homeAiRagMessages.pop()
    finishHomeAiContractPillProgress(false)
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

async function sendHomeAiChatMessage() {
  applyHomeAiContractRagUi(true)
  await sendHomeAiContractRagMessage()
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

  const closeHomeAiPanel = () => {
    stopHomeAiCamera()
    setHomeBildeSubTab('camera')
  }
  document.getElementById('btn-home-ai-close-fs')?.addEventListener(
    'click',
    closeHomeAiPanel,
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

  applyHomeAiContractRagUi(true)

  bindHomeAiPanelVisualViewport(signal)
  updateHomeAiPanelVisualViewport()
  syncHomeAiPanelBodyClass()

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
      /* Ikke scrollTo(0,0) her – på iOS flyttes da caret/komponenter til toppen av skjermen. */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => updateHomeAiPanelVisualViewport())
      })
    },
    { signal },
  )
  homeAiChatInput?.addEventListener(
    'focusout',
    () => {
      requestAnimationFrame(() => updateHomeAiPanelVisualViewport())
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
  document.getElementById('btn-delsky-pull-now')?.addEventListener(
    'click',
    () => {
      void (async () => {
        if (
          isMinDownloadMode() ||
          !isRemoteAppStateDataEnabled() ||
          !currentUser?.id
        ) {
          showSessionToast('Logg inn med sky for å hente fra DelSky.', 2800)
          return
        }
        const st = document.getElementById('delsky-pull-status')
        try {
          if (st) st.textContent = 'Henter fra delsky …'
          await hydrateUserAppStateFromRemote()
          await refreshDelskyStorageUsage({ force: true })
        } catch (e) {
          console.warn('DelSky manuell hent', e)
        } finally {
          if (st) st.textContent = ''
        }
        void refreshIncomingSharesPanel()
      })()
    },
    { signal },
  )
  document.getElementById('btn-delsky-usage-help')?.addEventListener(
    'click',
    () => {
      const btn = document.getElementById('btn-delsky-usage-help')
      const help = document.getElementById('delsky-usage-help-text')
      if (!(btn instanceof HTMLButtonElement) || !(help instanceof HTMLElement)) {
        return
      }
      const open = help.hidden
      help.hidden = !open
      btn.setAttribute('aria-expanded', open ? 'true' : 'false')
    },
    { signal },
  )
  document.getElementById('delsky-my-sessions-wrap')?.addEventListener(
    'click',
    (ev) => {
      const t = ev.target
      if (!(t instanceof Element)) return
      const resumeBtn = t.closest('[data-resume-id]')
      const delBtn = t.closest('[data-delete-session-id]')
      if (resumeBtn) {
        const id = resumeBtn.getAttribute('data-resume-id')
        if (id) resumeSession(id)
        return
      }
      if (delBtn) {
        const id = delBtn.getAttribute('data-delete-session-id')
        if (id) deleteStoredSession(id)
      }
    },
    { signal },
  )
  const incomingList = document.getElementById('incoming-shares-list')
  incomingList?.addEventListener(
    'click',
    async (ev) => {
      const openBtn = ev.target.closest('[data-open-share]')
      const dis = ev.target.closest('[data-dismiss-share]')
      const sb = getSupabase()
      const st = document.getElementById('incoming-shares-status')
      if ((!sb && !isScanixCloudApiConfigured()) || !currentUser) return
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
  if (inboxUiMode === 'delsky') startDelskyUsagePolling()
  else stopDelskyUsagePolling()
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
      await runImportSessionFromHtmlFile(file, st)
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
  document.getElementById('btn-menu-user-logout')?.addEventListener(
    'click',
    () => {
      void logoutUser()
    },
    { signal },
  )
}

function bindMenuMapListeners() {
  if (menuMapAbort) menuMapAbort.abort()
  menuMapAbort = new AbortController()
  const { signal } = menuMapAbort
  document
    .getElementById('btn-back-from-menu-map')
    ?.addEventListener('click', () => goHome(), { signal })
}

function bindMenuFrictionListeners() {
  if (menuFrictionAbort) menuFrictionAbort.abort()
  menuFrictionAbort = new AbortController()
  const { signal } = menuFrictionAbort
  ensureFrictionSessionId()
  document
    .getElementById('btn-back-from-friction')
    ?.addEventListener('click', () => goHome(), { signal })
  document.getElementById('friction-btn-start')?.addEventListener(
    'click',
    () => frictionBeginMeasurement(),
    { signal },
  )
  document.getElementById('friction-btn-stop')?.addEventListener(
    'click',
    () => void frictionFinishMeasurement(),
    { signal },
  )
  document.getElementById('friction-btn-value')?.addEventListener(
    'click',
    () => frictionOpenValuePanel(),
    { signal },
  )
  document.getElementById('friction-value-cancel')?.addEventListener(
    'click',
    () => {
      const dlg = document.getElementById('friction-value-dialog')
      if (dlg instanceof HTMLDialogElement) dlg.close()
    },
    { signal },
  )
  document.getElementById('friction-value-save')?.addEventListener(
    'click',
    () => frictionSaveValueFromDialog(),
    { signal },
  )
  document.getElementById('friction-btn-open-list')?.addEventListener(
    'click',
    () => {
      const dlg = document.getElementById('friction-list-dialog')
      frictionRefreshMeasurementsListBody()
      if (dlg instanceof HTMLDialogElement) dlg.showModal()
    },
    { signal },
  )
  document.getElementById('friction-list-close')?.addEventListener(
    'click',
    () => {
      const dlg = document.getElementById('friction-list-dialog')
      if (dlg instanceof HTMLDialogElement) dlg.close()
    },
    { signal },
  )
  document.getElementById('friction-list-show-all')?.addEventListener(
    'click',
    () => frictionFitAllMeasurementsOnMap(),
    { signal },
  )
  document.getElementById('friction-btn-save-session')?.addEventListener(
    'click',
    () => frictionSaveSessionExplicit(),
    { signal },
  )
  document.getElementById('friction-btn-export-xlsx')?.addEventListener(
    'click',
    () => void frictionExportSessionXlsx(),
    { signal },
  )
  document.getElementById('friction-btn-new-session')?.addEventListener(
    'click',
    () => frictionStartNewFrictionSession(),
    { signal },
  )
  document.getElementById('friction-btn-resume-session')?.addEventListener(
    'click',
    () => frictionResumePreviousSession(),
    { signal },
  )
  document.getElementById('friction-btn-my-position')?.addEventListener(
    'click',
    () => void frictionRefreshGpsAndCenter(),
    { signal },
  )
  document.getElementById('friction-list-export-all-xlsx')?.addEventListener(
    'click',
    () => void frictionExportAllFrictionXlsx(),
    { signal },
  )
  document.getElementById('friction-list-body')?.addEventListener(
    'click',
    (ev) => {
      const mapEl = /** @type {HTMLElement | null} */ (
        ev.target?.closest?.('[data-friction-map]')
      )
      if (mapEl?.dataset?.frictionMap) {
        frictionFocusMeasurementOnMap(mapEl.dataset.frictionMap)
        return
      }
      const t = /** @type {HTMLElement | null} */ (ev.target?.closest?.('[data-friction-del]'))
      if (!t?.dataset?.frictionDel) return
      frictionDeleteMeasurementById(t.dataset.frictionDel)
    },
    { signal },
  )
}

function bindMenuPhotosListeners() {
  if (menuPhotosAbort) menuPhotosAbort.abort()
  menuPhotosAbort = new AbortController()
  const { signal } = menuPhotosAbort
  document
    .getElementById('btn-back-from-menu-photos')
    ?.addEventListener(
      'click',
      () => {
        if (menuPhotosOpenFolderKey != null) {
          menuPhotosOpenFolderKey = null
          renderApp()
          bindMenuPhotosListeners()
        } else {
          goHome()
        }
      },
      { signal },
    )
  const root = document.getElementById('menu-photos-folders')
  root?.addEventListener(
    'click',
    (ev) => {
      const row = ev.target.closest('.menu-photos-folder-row')
      if (row) {
        const key = row.getAttribute('data-folder-key')
        if (key) {
          menuPhotosOpenFolderKey = key
          renderApp()
          bindMenuPhotosListeners()
          void pullStandaloneFolderPixelsFromSupabase(key)
        }
        return
      }
      const btn = ev.target.closest('.menu-photos-thumb')
      if (!btn) return
      const id = btn.getAttribute('data-photo-id')
      if (!id) return
      const ph = getAllPhotosFlat().find((p) => p.id === id)
      if (ph) void openPhotoFullscreenFromPhotoRecord(ph)
    },
    { signal },
  )
}

function bindMenuContactsListeners() {
  if (menuContactsAbort) menuContactsAbort.abort()
  menuContactsAbort = new AbortController()
  const { signal } = menuContactsAbort
  document
    .getElementById('btn-back-from-menu-contacts')
    ?.addEventListener('click', () => goHome(), { signal })
}

function bindMenuTrafficGroupListeners() {
  if (menuTrafficGroupAbort) menuTrafficGroupAbort.abort()
  menuTrafficGroupAbort = new AbortController()
  const { signal } = menuTrafficGroupAbort
  document
    .getElementById('btn-back-from-menu-traffic-group')
    ?.addEventListener('click', () => goHome(), { signal })
  const applyTrafficGroupPreferenceSideEffects = () => {
    clearSegmentNearCache()
    vegrefResetThrottle()
    /* Unngå NVDB-pipeline fra meny: kun forsiden mater vegrefNotifyGps her. */
    if (
      view === 'home' &&
      lastLiveCoords &&
      typeof lastLiveCoords.lat === 'number' &&
      typeof lastLiveCoords.lng === 'number' &&
      !Number.isNaN(lastLiveCoords.lat) &&
      !Number.isNaN(lastLiveCoords.lng)
    ) {
      vegrefNotifyGps(lastLiveCoords.lat, lastLiveCoords.lng, {
        forceImmediate: true,
        accuracyM:
          typeof lastLiveCoords.accuracy === 'number'
            ? lastLiveCoords.accuracy
            : 28,
        timestamp: Date.now(),
      })
    }
  }
  const syncTrafficGroupChoiceUi = () => {
    const cur = getSurfacePreference()
    document.querySelectorAll('.traffic-group-choice').forEach((el) => {
      const pref = el.getAttribute('data-traffic-pref')
      const on = pref === cur
      el.classList.toggle('home-dash-card--accent', on)
      el.setAttribute('aria-pressed', on ? 'true' : 'false')
    })
  }
  document.querySelectorAll('.traffic-group-choice').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const pref = btn.getAttribute('data-traffic-pref')
        setSurfacePreference(typeof pref === 'string' ? pref : 'motor')
        syncTrafficGroupChoiceUi()
        applyTrafficGroupPreferenceSideEffects()
      },
      { signal },
    )
  })
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
  document
    .getElementById('btn-settings-download-offline-vegref')
    ?.addEventListener(
      'click',
      () => {
        if (offlineVegrefReady) {
          const ok = window.confirm(
            'Dette erstatter alle lokale vegdata, også strekninger du har lastet ned i «Veg uten nett». Fortsette?',
          )
          if (!ok) return
        }
        void ensureOfflineVegrefPackage({ force: true })
      },
      { signal },
    )
  document
    .getElementById('btn-settings-copy-vegref-debug')
    ?.addEventListener(
      'click',
      () => {
        void copyVegrefDebugReport()
      },
      { signal },
    )
  document
    .getElementById('btn-settings-debug-storage')
    ?.addEventListener(
      'click',
      () => {
        runSessionStorageDebugSnapshot()
      },
      { signal },
    )
  document
    .getElementById('btn-settings-copy-storage-trace')
    ?.addEventListener(
      'click',
      () => {
        void copyStorageDebugTraceReport()
      },
      { signal },
    )
  document
    .getElementById('btn-settings-clear-storage-trace')
    ?.addEventListener(
      'click',
      () => {
        clearStorageDebugTrace()
        showSessionToast('Lagringslogg tømt.', 2000)
      },
      { signal },
    )
  document.getElementById('chk-storage-debug-trace')?.addEventListener(
    'change',
    (ev) => {
      const el = /** @type {HTMLInputElement | null} */ (
        ev.target && 'checked' in ev.target ? ev.target : null
      )
      const enabled = Boolean(el?.checked)
      setStorageDebugTraceEnabled(enabled)
      if (enabled) {
        appendStorageDebugTrace('trace_enabled')
        showSessionToast('Lagringslogg er på.', 2000)
      } else {
        showSessionToast('Lagringslogg er av.', 2000)
      }
    },
    { signal },
  )
  document.getElementById('chk-vegref-high-data')?.addEventListener(
    'change',
    (ev) => {
      const el = /** @type {HTMLInputElement | null} */ (
        ev.target && 'checked' in ev.target ? ev.target : null
      )
      setVegrefDataMode(el?.checked ? 'normal' : 'minimal')
    },
    { signal },
  )
  document.getElementById('chk-photo-upload-cellular')?.addEventListener(
    'change',
    (ev) => {
      const el = /** @type {HTMLInputElement | null} */ (
        ev.target && 'checked' in ev.target ? ev.target : null
      )
      writePhotoUploadAllowOnCellular(Boolean(el?.checked))
      if (currentUser?.id) {
        void tryDrainPhotoUploadQueue({ userId: currentUser.id }).finally(() => {
          syncPhotoUploadDeferralBanner()
        })
        scheduleSupabaseAppStatePush()
      }
      syncPhotoUploadDeferralBanner()
    },
    { signal },
  )
  document.getElementById('chk-pilot-min-download')?.addEventListener(
    'change',
    (ev) => {
      if (isMinDownloadBuild) return
      const el = /** @type {HTMLInputElement | null} */ (
        ev.target && 'checked' in ev.target ? ev.target : null
      )
      setPilotMinDownloadUserPref(Boolean(el?.checked))
      setDelegatorAllowOnlineFallback(!isMinDownloadMode())
      if (isMinDownloadMode()) {
        abortPrefetchInFlight()
        teardownSessionShareInbox()
        syncInboxIndicators(0, { forceHide: true })
      } else if (isRemoteAppStateDataEnabled() && currentUser?.id) {
        setupSessionShareInbox()
        void tryDrainPhotoUploadQueue({ userId: currentUser.id }).finally(() => {
          syncPhotoUploadDeferralBanner()
        })
        scheduleSupabaseAppStatePush()
      }
      renderApp()
      bindListenersForCurrentView()
    },
    { signal },
  )
  document.getElementById('chk-vegref-debug-trace')?.addEventListener(
    'change',
    (ev) => {
      const el = /** @type {HTMLInputElement | null} */ (
        ev.target && 'checked' in ev.target ? ev.target : null
      )
      setVegrefDebugTraceEnabled(Boolean(el?.checked))
    },
    { signal },
  )
  document.getElementById('btn-settings-clear-vegref-trace')?.addEventListener(
    'click',
    () => {
      clearVegrefDebugTrace()
      resetVegrefAnomalyState()
      vegrefDebugLastHomeSig = ''
      vegrefDebugLastHomeAt = 0
      alert('Vegref-spor er tømt.')
    },
    { signal },
  )
  const tabOffline = document.getElementById('tab-settings-offline')
  const tabDebug = document.getElementById('tab-settings-vegref-debug')
  const tabRegTrace = document.getElementById('tab-settings-register-trace')
  const panelOffline = document.getElementById('panel-settings-offline')
  const panelDebug = document.getElementById('panel-settings-vegref-debug')
  const panelRegTrace = document.getElementById('panel-settings-register-trace')
  const switchSettingsTab = (which) => {
    const tabs = [
      { key: 'offline', tab: tabOffline, panel: panelOffline },
      { key: 'vegref', tab: tabDebug, panel: panelDebug },
      { key: 'register', tab: tabRegTrace, panel: panelRegTrace },
    ]
    for (const { key, tab, panel } of tabs) {
      const active = key === which
      if (tab) {
        tab.classList.toggle('menu-settings-tab--active', active)
        tab.setAttribute('aria-selected', active ? 'true' : 'false')
      }
      if (panel) {
        panel.classList.toggle('menu-settings-panel--hidden', !active)
        panel.hidden = !active
      }
    }
  }
  tabOffline?.addEventListener('click', () => switchSettingsTab('offline'), {
    signal,
  })
  tabDebug?.addEventListener('click', () => switchSettingsTab('vegref'), {
    signal,
  })
  tabRegTrace?.addEventListener('click', () => switchSettingsTab('register'), {
    signal,
  })
  document.getElementById('chk-register-trace-debug')?.addEventListener(
    'change',
    (ev) => {
      const el = /** @type {HTMLInputElement | null} */ (
        ev.target && 'checked' in ev.target ? ev.target : null
      )
      setRegisterTraceDebugPersisted(Boolean(el?.checked))
    },
    { signal },
  )
  document.getElementById('chk-register-net-debug')?.addEventListener(
    'change',
    (ev) => {
      const el = /** @type {HTMLInputElement | null} */ (
        ev.target && 'checked' in ev.target ? ev.target : null
      )
      setRegisterNetworkDebugPersisted(Boolean(el?.checked))
    },
    { signal },
  )
}

function isStorageDebugTraceEnabled() {
  try {
    return localStorage.getItem(STORAGE_DEBUG_TRACE_ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * @param {boolean} enabled
 */
function setStorageDebugTraceEnabled(enabled) {
  try {
    if (enabled) localStorage.setItem(STORAGE_DEBUG_TRACE_ENABLED_KEY, '1')
    else localStorage.removeItem(STORAGE_DEBUG_TRACE_ENABLED_KEY)
  } catch {
    /* ignore */
  }
}

function readStorageDebugTraceEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_DEBUG_TRACE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * @param {string} ev
 * @param {Record<string, unknown>} [data]
 */
function appendStorageDebugTrace(ev, data = {}) {
  if (!isStorageDebugTraceEnabled()) return
  try {
    const key = sessionsKeyForCurrentContext()
    const row = {
      at: new Date().toISOString(),
      ev,
      userId: currentUser?.id || null,
      key,
      currentSessionId,
      sessionsInMemory: sessions.length,
      ...data,
    }
    const entries = readStorageDebugTraceEntries()
    entries.unshift(row)
    if (entries.length > STORAGE_DEBUG_TRACE_MAX) {
      entries.length = STORAGE_DEBUG_TRACE_MAX
    }
    localStorage.setItem(STORAGE_DEBUG_TRACE_KEY, JSON.stringify(entries))
  } catch {
    /* ignore */
  }
}

function clearStorageDebugTrace() {
  try {
    localStorage.removeItem(STORAGE_DEBUG_TRACE_KEY)
  } catch {
    /* ignore */
  }
}

function writeEmergencySessionDelta(reason = 'emergency') {
  try {
    const sid =
      (typeof lastTouchedSessionId === 'string' && lastTouchedSessionId) ||
      (typeof lastResumeSessionId === 'string' && lastResumeSessionId) ||
      (typeof currentSessionId === 'string' && currentSessionId) ||
      ''
    const key = emergencyDeltaKeyForCurrentContext()
    const session =
      sid && Array.isArray(sessions) ? sessions.find((s) => s.id === sid) : null
    const payload = {
      at: new Date().toISOString(),
      reason,
      sid: sid || null,
      currentSessionId:
        typeof currentSessionId === 'string' ? currentSessionId : null,
      lastResumeSessionId:
        typeof lastResumeSessionId === 'string' ? lastResumeSessionId : null,
      session: session || null,
    }
    localStorage.setItem(key, JSON.stringify(payload))
    appendStorageDebugTrace('emergency_delta_written', {
      key,
      sid: payload.sid,
      hasSession: Boolean(payload.session),
    })
  } catch (e) {
    appendStorageDebugTrace('emergency_delta_write_failed', {
      errorName: e?.name || null,
      errorMessage: e instanceof Error ? e.message : String(e),
    })
  }
}

/**
 * @param {string} userId
 * @returns {{ session: any | null, currentSessionId: string | null, lastResumeSessionId: string | null }}
 */
function readEmergencySessionDeltaForUser(userId) {
  try {
    const key =
      userId === STORAGE_KEY_DEVICE_FALLBACK
        ? `${STORAGE_KEY_DEVICE_FALLBACK}-${STORAGE_KEY_EMERGENCY_DELTA}`
        : `${sessionsKeyForUser(userId)}-${STORAGE_KEY_EMERGENCY_DELTA}`
    const raw = localStorage.getItem(key)
    if (!raw) {
      return { session: null, currentSessionId: null, lastResumeSessionId: null }
    }
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object') {
      return { session: null, currentSessionId: null, lastResumeSessionId: null }
    }
    const s = normalizeSession(
      /** @type {{ session?: unknown }} */ (p).session || null,
    )
    return {
      session: s || null,
      currentSessionId:
        typeof /** @type {{ currentSessionId?: unknown }} */ (p).currentSessionId ===
        'string'
          ? /** @type {{ currentSessionId: string }} */ (p).currentSessionId
          : null,
      lastResumeSessionId:
        typeof /** @type {{ lastResumeSessionId?: unknown }} */ (p)
          .lastResumeSessionId === 'string'
          ? /** @type {{ lastResumeSessionId: string }} */ (p).lastResumeSessionId
          : null,
    }
  } catch {
    return { session: null, currentSessionId: null, lastResumeSessionId: null }
  }
}

function buildStorageDebugTraceText() {
  const entries = readStorageDebugTraceEntries()
  return JSON.stringify(
    {
      now: new Date().toISOString(),
      enabled: isStorageDebugTraceEnabled(),
      entriesCount: entries.length,
      entries,
    },
    null,
    2,
  )
}

async function copyStorageDebugTraceReport() {
  try {
    const text = buildStorageDebugTraceText()
    await navigator.clipboard.writeText(text)
    showSessionToast('Lagringslogg kopiert.', 2400)
  } catch (e) {
    console.warn('copyStorageDebugTraceReport', e)
    showSessionToast('Kunne ikke kopiere logg.', 2800)
  }
}

function runSessionStorageDebugSnapshot() {
  try {
    const userId = currentUser?.id || null
    const userKey = userId ? sessionsKeyForUser(userId) : null
    const fallbackKey = STORAGE_KEY_DEVICE_FALLBACK
    const legacyKey = STORAGE_KEY_V2
    const keys = [legacyKey, fallbackKey, ...(userKey ? [userKey] : [])]
    /** @type {Record<string, { exists: boolean, length: number }>} */
    const report = {}
    for (const k of keys) {
      const raw = localStorage.getItem(k)
      report[k] = {
        exists: typeof raw === 'string',
        length: typeof raw === 'string' ? raw.length : 0,
      }
    }
    console.info('[Scanix storage-debug]', {
      now: new Date().toISOString(),
      userId,
      currentSessionId,
      sessionsInMemory: sessions.length,
      report,
      traceEnabled: isStorageDebugTraceEnabled(),
      traceEntries: readStorageDebugTraceEntries().length,
    })
    showSessionToast('Debug lagring skrevet til konsollen.', 2600)
  } catch (e) {
    console.warn('[Scanix storage-debug] failed', e)
    showSessionToast('Debug lagring feilet (se konsoll).', 2800)
  }
}

function syncHapticPresetSelectionClasses() {
  const id = readHapticProfileId()
  document.querySelectorAll('.haptic-preset-option').forEach((lab) => {
    if (!(lab instanceof HTMLElement)) return
    const inp = lab.querySelector('input[name="haptic-preset"]')
    const v =
      inp instanceof HTMLInputElement ? inp.value : ''
    lab.classList.toggle('haptic-preset-option--selected', v === id)
  })
}

function bindMenuHapticsListeners() {
  if (menuHapticsAbort) menuHapticsAbort.abort()
  menuHapticsAbort = new AbortController()
  const { signal } = menuHapticsAbort
  document
    .getElementById('btn-back-from-menu-haptics')
    ?.addEventListener('click', () => goHome(), { signal })
  document.getElementById('chk-haptic-enabled')?.addEventListener(
    'change',
    (ev) => {
      const el = /** @type {HTMLInputElement | null} */ (
        ev.target && 'checked' in ev.target ? ev.target : null
      )
      writeHapticEnabled(Boolean(el?.checked))
      if (el?.checked) void previewHapticFeedback()
    },
    { signal },
  )
  document.querySelectorAll('input[name="haptic-preset"]').forEach((inp) => {
    if (!(inp instanceof HTMLInputElement)) return
    inp.addEventListener(
      'change',
      () => {
        if (!inp.checked) return
        writeHapticProfileId(inp.value)
        syncHapticPresetSelectionClasses()
        void previewHapticFeedback()
      },
      { signal },
    )
  })
  document.getElementById('btn-haptic-test')?.addEventListener(
    'click',
    () => {
      void previewHapticFeedback()
    },
    { signal },
  )
}

/** Unngå overlappende utlogging (dobbelttrykk / treg sky). */
let logoutUserInFlight = false

async function logoutUser() {
  if (logoutUserInFlight) return
  logoutUserInFlight = true
  try {
    vegrefResetSessionCache()
    resetPrefetch()
    teardownSessionShareInbox()
    previewIncomingShareId = null
    lastIncomingShareCountForNotify = null
    syncInboxIndicators(0, { forceHide: true })
    sessionIdsPendingPartialCloudPush.clear()
    standalonePhotosPendingPartialCloudPush = false
    flushCurrentSession()
    saveAppState()
    const sbOut = getSupabase()
    cancelSupabaseAppStatePush()
    const uidForCloud = currentUser?.id
    try {
      if (
        uidForCloud &&
        !appStateHasRemotePhotoSkeletons() &&
        (isScanixCloudApiConfigured() || sbOut)
      ) {
        try {
          await refreshNativeNetworkStatus()
        } catch (e) {
          console.warn('refreshNativeNetworkStatus (logout)', e)
        }
        try {
          await tryDrainPhotoUploadQueue({ userId: uidForCloud })
        } catch (e) {
          console.warn('tryDrainPhotoUploadQueue (logout)', e)
        }
        const deferOut = getHeavyCloudTrafficDeferralReason()
        if (deferOut !== 'offline') {
          let remotePreserve = null
          try {
            remotePreserve = await fetchRemoteUserAppState(uidForCloud, {
              mode: 'full',
            })
          } catch (e) {
            console.warn('fetchUserAppState (logout preserve followUp)', e)
          }
          const cloudFollowUp = Array.isArray(remotePreserve?.followUpRoutes)
            ? remotePreserve.followUpRoutes
            : []
          const payload = sanitizeUserAppStateForSupabasePayload({
            version: 2,
            sessions,
            currentSessionId,
            standalonePhotos,
            frictionMeasurements,
            frictionActiveSessionId,
            frictionPreviousSessionId,
            followUpRoutes: cloudFollowUp,
          })
          await upsertRemoteUserAppState(uidForCloud, payload)
        }
      }
    } catch (e) {
      console.warn('logoutUser (siste sky-push)', e)
    }
    if (sbOut) {
      ignoreNextSupabaseSignedOut = true
      try {
        await sbOut.auth.signOut()
      } catch (e) {
        console.warn('logoutUser (signOut)', e)
      }
      queueMicrotask(() => {
        if (ignoreNextSupabaseSignedOut) ignoreNextSupabaseSignedOut = false
      })
    }
    destroyMap()
    currentSessionId = null
    state = defaultState()
    sessions = []
    standalonePhotos = []
    frictionMeasurements = []
    frictionActiveSessionId = null
    frictionPreviousSessionId = null
    lastResumeSessionId = null
    currentUser = null
    clearAuthSession()
    void backupAuthToIdb(loadUsersFromStorage(), null)
    authScreen = 'login'
    view = 'auth'
    renderApp()
    bindAuthListeners()
  } finally {
    logoutUserInFlight = false
  }
}

function navigateHomeClearSession() {
  stopDelskyUsagePolling()
  stashActiveSessionForResumeBeforeLeave()
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
    if ((sb || isScanixCloudApiConfigured()) && shareRow) {
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
  inboxUiMode = 'delsky'
  stashActiveSessionForResumeBeforeLeave()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'inbox'
  saveAppState()
  renderApp()
  bindInboxListeners()
  void refreshIncomingSharesPanel()
  startDelskyUsagePolling()
  if (
    !isMinDownloadMode() &&
    isSupabaseConfigured() &&
    currentUser?.id
  ) {
    void (async () => {
      const st = document.getElementById('delsky-pull-status')
      try {
        if (st) st.textContent = 'Henter fra delsky …'
        await hydrateUserAppStateFromRemote()
        await refreshDelskyStorageUsage({ force: true })
      } catch (e) {
        console.warn('DelSky auto-hent', e)
      } finally {
        if (st) st.textContent = ''
      }
      void refreshIncomingSharesPanel()
    })()
  }
}

function openInboxMessagesView() {
  inboxUiMode = 'messages'
  stashActiveSessionForResumeBeforeLeave()
  flushCurrentSession()
  destroyMap()
  currentSessionId = null
  state = defaultState()
  view = 'inbox'
  saveAppState()
  renderApp()
  bindInboxListeners()
  stopDelskyUsagePolling()
  void refreshIncomingSharesPanel()
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
      const src = photoListThumbDataUrl(ph)
      if (!src) continue
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'received-photos__shot'
      btn.setAttribute('data-received-thumb-index', String(i))
      btn.setAttribute('aria-label', `Vis bilde ${i + 1} i fullskjerm`)
      const img = document.createElement('img')
      img.src = src
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
    await ensureLeafletMarkerCluster()
    receivedPhotosMap = Leaflet.map('received-photos-map', {
      zoomControl: false,
      maxZoom: APP_MAP_MAX_ZOOM,
    }).setView([Number(withLoc[0].lat), Number(withLoc[0].lng)], 14)
    try {
      receivedPhotosMap.setMaxZoom(APP_MAP_MAX_ZOOM)
    } catch {
      /* ignore */
    }
    Leaflet.control.zoom({ position: 'topright' }).addTo(receivedPhotosMap)
    ;(await createAppBasemapLayer(Leaflet)).addTo(receivedPhotosMap)
    const bounds = Leaflet.latLngBounds([])
    const mcgFn = /** @type {unknown} */ (Leaflet).markerClusterGroup
    const recvCluster =
      typeof mcgFn === 'function'
        ? /** @type {import('leaflet').Layer & { addLayer: (m: import('leaflet').Marker) => void }} */ (
            /** @type {(o?: object) => import('leaflet').Layer} */ (mcgFn)({
              maxClusterRadius: 52,
              spiderfyOnMaxZoom: true,
              showCoverageOnHover: false,
            })
          )
        : null
    if (recvCluster) recvCluster.addTo(receivedPhotosMap)
    withLoc.forEach((ph, i) => {
      const lat = Number(ph.lat)
      const lng = Number(ph.lng)
      bounds.extend([lat, lng])
      const m = Leaflet.marker([lat, lng], {
        icon: receivedPhotoMapPinIcon(),
      })
      const t = ph.timestamp
        ? new Intl.DateTimeFormat('nb-NO', {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date(ph.timestamp))
        : ''
      const safeT = escapeHtml(t)
      const popSrc = photoListThumbDataUrl(ph)
      m.bindPopup(
        popSrc
          ? `<div class="received-photos-map-popup"><strong>Bilde ${i + 1}</strong>${t ? `<br/>${safeT}` : ''}<br/><img src="${escapeHtml(popSrc)}" alt="" class="received-photos-map-popup__img" loading="lazy" decoding="async"/></div>`
          : `<div class="received-photos-map-popup"><strong>Bilde ${i + 1}</strong>${t ? `<br/>${safeT}` : ''}</div>`,
        { maxWidth: 280 },
      )
      if (recvCluster) recvCluster.addLayer(m)
      else m.addTo(receivedPhotosMap)
    })
    if (bounds.isValid()) {
      receivedPhotosMap.fitBounds(bounds, {
        padding: [44, 44],
        maxZoom: APP_MAP_MAX_ZOOM,
      })
    }
  }
  queueMicrotask(() => {
    receivedPhotosMap?.invalidateSize()
    nudgeMaptilerBasemapResize(receivedPhotosMap)
  })
  setTimeout(() => {
    receivedPhotosMap?.invalidateSize()
    nudgeMaptilerBasemapResize(receivedPhotosMap)
  }, 280)
}

function openReceivedPhotosMapFullscreen() {
  const dlg = document.getElementById('received-photos-map-dialog')
  if (!(dlg instanceof HTMLDialogElement)) return
  dlg.showModal()
  queueMicrotask(() => {
    void ensureReceivedPhotosMap().then(() => {
      receivedPhotosMap?.invalidateSize()
      nudgeMaptilerBasemapResize(receivedPhotosMap)
    })
  })
  setTimeout(() => {
    receivedPhotosMap?.invalidateSize()
    nudgeMaptilerBasemapResize(receivedPhotosMap)
  }, 400)
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
      const lbSrc = ph ? photoListThumbDataUrl(ph) : ''
      if (!lbSrc || !lb || !lbImg || !(lb instanceof HTMLDialogElement)) return
      receivedLightboxPinchControls?.reset()
      lbImg.src = lbSrc
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

function sharedReviewNumberPinIcon(n) {
  return Leaflet.divIcon({
    className: 'shared-review-map-pin shared-review-map-pin--num',
    html: `<span class="shared-review-map-pin__n" aria-hidden="true">${Number(n)}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -26],
  })
}

/**
 * @param {object[]} clickHistory
 */
function buildSharedReviewNotesListHtml(clickHistory) {
  if (!clickHistory.length) {
    return '<p class="shared-review-empty">Ingen registreringer i denne delingen.</p>'
  }
  const items = clickHistory.map((c, index) => {
    const n = index + 1
    const labelRaw =
      typeof c.label === 'string'
        ? c.label.trim().slice(0, CLICK_ENTRY_LABEL_MAX_LEN)
        : ''
    const displayTitle = escapeHtml(labelRaw || `Registrering ${n}`)
    const catLabel =
      typeof c.category === 'string' && c.category
        ? escapeHtml(getObjectCategoryLabel(c.category))
        : ''
    const timeStr =
      c.timestamp && !Number.isNaN(Date.parse(c.timestamp))
        ? escapeHtml(formatNb(new Date(c.timestamp)))
        : ''
    const isoAttr =
      c.timestamp && !Number.isNaN(Date.parse(c.timestamp))
        ? escapeHtml(c.timestamp)
        : ''
    const commentRaw =
      typeof c.comment === 'string'
        ? c.comment.trim().slice(0, CLICK_ENTRY_COMMENT_MAX_LEN)
        : ''
    const commentBlock = commentRaw
      ? `<div class="shared-review-note__comment">${escapeHtml(commentRaw)}</div>`
      : '<div class="shared-review-note__comment shared-review-note__comment--muted">Uten notat på kartet</div>'
    const vegHtml = buildSessionMapPopupVegrefHtml(c)
    const vegBlock = vegHtml
      ? `<div class="shared-review-note__veg">${vegHtml}</div>`
      : ''
    const coords =
      c.lat != null &&
      c.lng != null &&
      Number.isFinite(Number(c.lat)) &&
      Number.isFinite(Number(c.lng))
        ? `<p class="shared-review-note__coords">≈ ${escapeHtml(Number(c.lat).toFixed(5))}, ${escapeHtml(Number(c.lng).toFixed(5))}</p>`
        : ''
    return `<li class="shared-review-note">
      <div class="shared-review-note__numWrap" aria-hidden="true"><span class="shared-review-note__num">${n}</span></div>
      <div class="shared-review-note__body">
        <header class="shared-review-note__head">
          <h3 class="shared-review-note__title">${displayTitle}</h3>
          ${
        catLabel
          ? `<span class="shared-review-note__chip">${catLabel}</span>`
          : ''
      }
        </header>
        ${vegBlock}
        ${commentBlock}
        ${coords}
        ${
        timeStr
          ? `<footer class="shared-review-note__foot"><time datetime="${isoAttr}">${timeStr}</time></footer>`
          : ''
      }
      </div>
    </li>`
  })
  return `<ol class="shared-review-notes" start="1">${items.join('')}</ol>`
}

/**
 * @param {object[]} photos
 */
function buildSharedReviewLoosePhotosHtml(photos) {
  if (!photos.length) {
    return '<p class="shared-review-empty shared-review-empty--soft">Ingen bilder vedlagt.</p>'
  }
  const cells = photos
    .map((ph, i) => {
      const src = photoListThumbDataUrl(ph)
      if (!src) return ''
      return `<button type="button" class="shared-review-photo-tile" data-shared-review-photo="${i}" aria-label="Vis bilde ${i + 1}">
        <img src="${escapeHtml(src)}" alt="" class="shared-review-photo-tile__img" loading="lazy" decoding="async" />
      </button>`
    })
    .filter(Boolean)
    .join('')
  if (!cells) {
    return '<p class="shared-review-empty shared-review-empty--soft">Bilder uten forhåndsvisning ennå.</p>'
  }
  return `<div class="shared-review-photo-mosaic">${cells}</div>`
}

function renderSharedSessionReviewHtml() {
  const s = sessions.find((x) => x.id === currentSessionId)
  const clicks = Array.isArray(s?.clickHistory) ? s.clickHistory : []
  const photos = Array.isArray(s?.photos) ? s.photos : []
  const title = s ? escapeHtml(formatSessionDisplayTitle(s)) : 'Delt oppdrag'
  const roadPart = s ? formatRoadSideLabel(s.roadSide) : null
  const roadHtml = roadPart
    ? `<p class="shared-review__road">${escapeHtml(roadPart)}</p>`
    : ''
  const created =
    s?.createdAt && !Number.isNaN(Date.parse(s.createdAt))
      ? new Intl.DateTimeFormat('nb-NO', {
          dateStyle: 'long',
          timeStyle: 'short',
        }).format(new Date(s.createdAt))
      : ''
  const createdHtml = created
    ? `<p class="shared-review__when"><time datetime="${escapeHtml(String(s?.createdAt ?? ''))}">${escapeHtml(created)}</time></p>`
    : ''
  const nRegs = clicks.length
  const nPhotos = photos.length
  const tabOversiktActive = sharedSessionReviewTab === 'oversikt'
  const tabKartActive = sharedSessionReviewTab === 'kart'
  const notesHtml = buildSharedReviewNotesListHtml(clicks)
  const photosHtml = buildSharedReviewLoosePhotosHtml(photos)
  const sessionNote =
    s && typeof s.registeredNote === 'string' && s.registeredNote.trim()
      ? `<section class="shared-review-block shared-review-block--sessionnote" aria-label="Øktnotat">
          <h3 class="shared-review-block__label">Øktnotat</h3>
          <div class="shared-review-sessionnote">${escapeHtml(s.registeredNote.trim())}</div>
        </section>`
      : ''
  return `<div class="view-shared-review">
    <header class="shared-review-hero">
      <div class="shared-review-hero__bar">
        <button type="button" class="shared-review-hero__back btn btn-text" id="btn-shared-review-back" aria-label="Tilbake">← Tilbake</button>
        <span class="shared-review-hero__badge">Delt oppdrag</span>
      </div>
      <h1 class="shared-review-hero__title">${title}</h1>
      ${roadHtml}
      ${createdHtml}
      <div class="shared-review-hero__stats">
        <div class="shared-review-stat shared-review-stat--accent">
          <span class="shared-review-stat__value">${nRegs}</span>
          <span class="shared-review-stat__label">Registreringer</span>
        </div>
        <div class="shared-review-stat">
          <span class="shared-review-stat__value">${nPhotos}</span>
          <span class="shared-review-stat__label">Bilder</span>
        </div>
      </div>
      <nav class="shared-review-tabs" aria-label="Visning">
        <button type="button" class="shared-review-tabs__btn${tabOversiktActive ? ' shared-review-tabs__btn--active' : ''}" data-shared-review-tab="oversikt" aria-selected="${tabOversiktActive ? 'true' : 'false'}" role="tab">Oversikt</button>
        <button type="button" class="shared-review-tabs__btn${tabKartActive ? ' shared-review-tabs__btn--active' : ''}" data-shared-review-tab="kart" aria-selected="${tabKartActive ? 'true' : 'false'}" role="tab">Kart</button>
      </nav>
    </header>
    <div class="shared-review-panels">
      <section class="shared-review-panel shared-review-panel--oversikt" id="shared-review-panel-oversikt" role="tabpanel"${tabOversiktActive ? '' : ' hidden'}>
        <div class="shared-review-scroll">
          ${sessionNote}
          <section class="shared-review-block">
            <h2 class="shared-review-block__label">Alle registreringer</h2>
            ${notesHtml}
          </section>
          <section class="shared-review-block shared-review-block--photos">
            <h2 class="shared-review-block__label">Bilder</h2>
            <p class="shared-review-block__hint">Alle bilder i løst visning — trykk for fullskjerm.</p>
            ${photosHtml}
          </section>
        </div>
      </section>
      <section class="shared-review-panel shared-review-panel--kart" id="shared-review-panel-kart" role="tabpanel"${tabKartActive ? '' : ' hidden'}>
        <div id="shared-review-map-shell" class="shared-review-map-shell">
          <div id="shared-review-map" class="shared-review-map" role="application" aria-label="Kart over registreringer og bilder"></div>
          <p id="shared-review-map-empty" class="shared-review-map-empty" hidden>Ingen GPS-posisjon på registreringer eller bilder — kart kan ikke tegnes.</p>
        </div>
        <p class="shared-review-map-legend">Nummer = registrering · miniatyr = bilde med posisjon.</p>
      </section>
    </div>
    <footer class="shared-review-actions">
      <button type="button" class="btn btn-secondary" id="btn-shared-review-open-session">Åpne i oppdrag <span class="shared-review-actions__hint">(rediger, del, eksporter)</span></button>
    </footer>
    <dialog id="shared-review-lightbox" class="received-photo-lightbox shared-review-lightbox" aria-label="Bilde">
      <div class="received-photo-lightbox__inner shared-review-lightbox__inner">
        <button type="button" class="received-photo-lightbox__close" id="btn-shared-review-lightbox-close" aria-label="Lukk">×</button>
        <div class="received-photo-zoom-host photo-zoom-host" id="shared-review-zoom-host">
          <div class="photo-zoom-pan" id="shared-review-zoom-pan">
            <img id="shared-review-lightbox-img" class="received-photo-lightbox__img" alt="" draggable="false" />
          </div>
        </div>
      </div>
    </dialog>
  </div>`
}

async function ensureSharedReviewMap() {
  const wrap = document.getElementById('shared-review-map')
  const emptyEl = document.getElementById('shared-review-map-empty')
  if (!wrap) return
  const s = sessions.find((x) => x.id === currentSessionId)
  const clicks = Array.isArray(s?.clickHistory) ? s.clickHistory : []
  const photos = Array.isArray(s?.photos) ? s.photos : []
  /** @type {Array<{ lat: number, lng: number, kind: 'click' | 'photo', idx: number }>} */
  const pts = []
  clicks.forEach((c, i) => {
    if (c.lat == null || c.lng == null) return
    const lat = Number(c.lat)
    const lng = Number(c.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    pts.push({ lat, lng, kind: 'click', idx: i })
  })
  photos.forEach((p, i) => {
    if (p.lat == null || p.lng == null) return
    const lat = Number(p.lat)
    const lng = Number(p.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    pts.push({ lat, lng, kind: 'photo', idx: i })
  })
  if (!pts.length) {
    destroySharedReviewMap()
    if (emptyEl) emptyEl.hidden = false
    wrap.style.display = 'none'
    return
  }
  if (emptyEl) emptyEl.hidden = true
  wrap.style.display = ''
  if (sharedReviewMap) {
    try {
      sharedReviewMap.remove()
    } catch {
      /* ignore */
    }
    sharedReviewMap = null
  }
  await ensureLeaflet()
  await ensureLeafletMarkerCluster()
  const first = pts[0]
  sharedReviewMap = Leaflet.map(wrap, {
    zoomControl: false,
    tapTolerance: 12,
    maxZoom: APP_MAP_MAX_ZOOM,
  }).setView([first.lat, first.lng], 14)
  try {
    sharedReviewMap.setMaxZoom(APP_MAP_MAX_ZOOM)
  } catch {
    /* ignore */
  }
  Leaflet.control.zoom({ position: 'topright' }).addTo(sharedReviewMap)
  const basemap = await createAppBasemapLayer(
    Leaflet,
    APP_MAP_TILE_LAYER_DATA_SAVER,
    { dark: false },
  )
  basemap.addTo(sharedReviewMap)
  applyAppMapTileContrastToDom()
  const bounds = Leaflet.latLngBounds([])
  const mcgFn = /** @type {unknown} */ (Leaflet).markerClusterGroup
  const cluster =
    typeof mcgFn === 'function'
      ? /** @type {import('leaflet').Layer & { addLayer: (m: import('leaflet').Marker) => void } } */ (
          /** @type {(o?: object) => import('leaflet').Layer} */ (mcgFn)({
            chunkedLoading: true,
            maxClusterRadius: 52,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            removeOutsideVisibleBounds: true,
          })
        )
      : null
  if (cluster) cluster.addTo(sharedReviewMap)
  pts.forEach((pt) => {
    bounds.extend([pt.lat, pt.lng])
    if (pt.kind === 'click') {
      const c = clicks[pt.idx]
      const n = pt.idx + 1
      const labelRaw =
        typeof c.label === 'string'
          ? c.label.trim().slice(0, CLICK_ENTRY_LABEL_MAX_LEN)
          : ''
      const displayTitle = escapeHtml(labelRaw || `Registrering ${n}`)
      const com =
        typeof c.comment === 'string' && c.comment.trim()
          ? `<p class="shared-review-map-popup__txt">${escapeHtml(c.comment.trim().slice(0, 320))}</p>`
          : ''
      const m = Leaflet.marker([pt.lat, pt.lng], {
        icon: sharedReviewNumberPinIcon(n),
      })
      m.bindPopup(
        `<div class="shared-review-map-popup"><span class="shared-review-map-popup__eyebrow">Registrering</span><strong>${displayTitle}</strong>${com}</div>`,
        { maxWidth: 280 },
      )
      if (cluster) cluster.addLayer(m)
      else m.addTo(sharedReviewMap)
    } else {
      const ph = photos[pt.idx]
      const thumb = photoListThumbDataUrl(ph)
      const m = Leaflet.marker([pt.lat, pt.lng], {
        icon: thumb
          ? photoThumbnailIcon(thumb)
          : receivedPhotoMapPinIcon(),
      })
      const t =
        ph?.timestamp && !Number.isNaN(Date.parse(String(ph.timestamp)))
          ? escapeHtml(
              new Intl.DateTimeFormat('nb-NO', {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(ph.timestamp)),
            )
          : ''
      const pop = thumb
        ? `<div class="shared-review-map-popup shared-review-map-popup--photo"><span class="shared-review-map-popup__eyebrow">Bilde ${pt.idx + 1}</span>${t ? `<p class="shared-review-map-popup__time">${t}</p>` : ''}<img src="${escapeHtml(thumb)}" alt="" class="shared-review-map-popup__img" loading="lazy" decoding="async"/></div>`
        : `<div class="shared-review-map-popup"><strong>Bilde ${pt.idx + 1}</strong>${t ? `<p>${t}</p>` : ''}</div>`
      m.bindPopup(pop, { maxWidth: 300 })
      if (cluster) cluster.addLayer(m)
      else m.addTo(sharedReviewMap)
    }
  })
  if (bounds.isValid()) {
    sharedReviewMap.fitBounds(bounds, {
      padding: [44, 44],
      maxZoom: APP_MAP_MAX_ZOOM,
    })
  }
  queueMicrotask(() => {
    sharedReviewMap?.invalidateSize()
    nudgeMaptilerBasemapResize(sharedReviewMap)
  })
  setTimeout(() => {
    sharedReviewMap?.invalidateSize()
    nudgeMaptilerBasemapResize(sharedReviewMap)
  }, 280)
}

function bindSharedSessionReviewListeners() {
  if (sharedReviewAbort) sharedReviewAbort.abort()
  sharedReviewAbort = new AbortController()
  const { signal } = sharedReviewAbort

  const syncTabs = (tab) => {
    sharedSessionReviewTab = tab
    const oversikt = document.getElementById('shared-review-panel-oversikt')
    const kart = document.getElementById('shared-review-panel-kart')
    document.querySelectorAll('[data-shared-review-tab]').forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return
      const on = btn.getAttribute('data-shared-review-tab') === tab
      btn.classList.toggle('shared-review-tabs__btn--active', on)
      btn.setAttribute('aria-selected', on ? 'true' : 'false')
    })
    if (oversikt instanceof HTMLElement) oversikt.toggleAttribute('hidden', tab !== 'oversikt')
    if (kart instanceof HTMLElement) kart.toggleAttribute('hidden', tab !== 'kart')
    if (tab === 'kart') {
      void ensureSharedReviewMap()
    } else {
      queueMicrotask(() => {
        sharedReviewMap?.invalidateSize()
        nudgeMaptilerBasemapResize(sharedReviewMap)
      })
    }
  }

  document.querySelectorAll('[data-shared-review-tab]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const t = btn.getAttribute('data-shared-review-tab')
        if (t === 'oversikt' || t === 'kart') syncTabs(t)
      },
      { signal },
    )
  })

  document.getElementById('btn-shared-review-back')?.addEventListener(
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

  document.getElementById('btn-shared-review-open-session')?.addEventListener(
    'click',
    () => {
      destroySharedReviewMap()
      view = 'session'
      saveAppState()
      renderApp()
      void initSessionMapAndWatch()
      bindSessionListeners()
    },
    { signal },
  )

  const lb = document.getElementById('shared-review-lightbox')
  const lbImg = document.getElementById('shared-review-lightbox-img')
  const lbHost = document.getElementById('shared-review-zoom-host')
  const lbPan = document.getElementById('shared-review-zoom-pan')
  if (lbHost instanceof HTMLElement && lbPan instanceof HTMLElement) {
    sharedReviewLightboxPinchControls = attachImagePinchZoom(lbHost, lbPan, {
      signal,
    })
  }
  document.getElementById('shared-review-panel-oversikt')?.addEventListener(
    'click',
    (ev) => {
      const btn = ev.target.closest('[data-shared-review-photo]')
      if (!(btn instanceof HTMLElement)) return
      const idx = parseInt(btn.getAttribute('data-shared-review-photo') ?? '', 10)
      const photos = Array.isArray(state.photos) ? state.photos : []
      const ph = photos[idx]
      const url = ph ? photoListThumbDataUrl(ph) : ''
      if (!url || !lb || !lbImg || !(lb instanceof HTMLDialogElement)) return
      sharedReviewLightboxPinchControls?.reset()
      lbImg.src = url
      setViewportAllowImageZoom(true)
      lb.showModal()
    },
    { signal },
  )
  document.getElementById('btn-shared-review-lightbox-close')?.addEventListener(
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
      sharedReviewLightboxPinchControls?.reset()
      setViewportAllowImageZoom(false)
    },
    { signal },
  )

  if (sharedSessionReviewTab === 'kart') {
    void ensureSharedReviewMap()
  }
}

/**
 * @param {string} shareRowId
 */
async function openIncomingSharePreview(shareRowId) {
  const sb = getSupabase()
  const st = document.getElementById('incoming-shares-status')
  if ((!sb && !isScanixCloudApiConfigured()) || !currentUser) {
    if (st) st.textContent = 'Du må være innlogget.'
    return
  }
  let payload = incomingSharePayloadCache.get(shareRowId)
  if (!payload) {
    if (st) st.textContent = 'Laster økt …'
    if (isScanixCloudApiConfigured()) {
      try {
        payload = await cloudGetSessionSharePayload(shareRowId)
      } catch {
        if (st) st.textContent = 'Kunne ikke laste økt.'
        return
      }
      if (payload == null || typeof payload !== 'object') {
        if (st) st.textContent = 'Kunne ikke laste økt.'
        return
      }
    } else {
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
    }
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
  lastResumeSessionId = session.id
  state = loadCurrentSessionState()
  void persistSessionPhotoPixelsToIdb(session)
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
  sharedSessionReviewTab = 'oversikt'
  view = 'sharedSessionReview'
  renderApp()
  bindSharedSessionReviewListeners()
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
  lastResumeSessionId = s.id
  lastTouchedSessionId = s.id
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
  // #region agent log
  fetch('http://127.0.0.1:7637/ingest/e58399ea-bfe1-456f-9512-3bdae1c6fc15',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ff8b7b'},body:JSON.stringify({sessionId:'ff8b7b',runId:'pre-fix',hypothesisId:'H1',location:'main.js:commitNewSessionWithCategories:beforeSave',message:'new_session_created_before_save',data:{newSessionId:s.id,userId:currentUser?.id||null,sessionsCount:sessions.length,roadSide:roadSide||null,categoryCount:objectCategories.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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

function continueLastSessionFromHome() {
  if (previewIncomingShareId) {
    showSessionToast('Fullfør eller avslutt delt oppdrag først.', 3200)
    return
  }
  const id = resolveResumeSessionId()
  if (!id) {
    showSessionToast(
      'Ingen tidligere økt å fortsette. Start med «Ny registrering» eller åpne økter via ⌂.',
      4200,
    )
    return
  }
  resumeSession(id)
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
  if (lastResumeSessionId === id) {
    lastResumeSessionId = null
  }
  if (currentSessionId === id) {
    currentSessionId = null
    state = defaultState()
    destroyMap()
  }
  saveAppState()
  renderApp()
  if (view === 'menuSession') bindMenuSessionListeners()
  else if (view === 'inbox') bindInboxListeners()
  else if (view === 'sharedSessionReview') bindSharedSessionReviewListeners()
  else if (view === 'home') bindHomeListeners()
}

function resumeSession(id) {
  flushCurrentSession()
  currentSessionId = id
  lastResumeSessionId = id
  lastTouchedSessionId = id
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

function lastShareRecipientStorageKey() {
  if (!currentUser?.id) return null
  return `scanix-last-share-recipient-v1-user-${currentUser.id}`
}

/**
 * @param {string} shortId
 * @param {string | null | undefined} displayName
 */
function saveLastShareRecipient(shortId, displayName) {
  const key = lastShareRecipientStorageKey()
  if (!key || !isValidStoredShortId(shortId)) return
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        shortId,
        label:
          typeof displayName === 'string' && displayName.trim()
            ? displayName.trim().slice(0, AUTH_NAME_MAX_LEN)
            : '',
      }),
    )
  } catch {
    /* ignore */
  }
}

/** @returns {{ shortId: string, label: string } | null} */
function loadLastShareRecipient() {
  const key = lastShareRecipientStorageKey()
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object' || !isValidStoredShortId(p.shortId))
      return null
    return {
      shortId: p.shortId,
      label: typeof p.label === 'string' ? p.label : '',
    }
  } catch {
    return null
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
 * @param {File} file
 * @param {HTMLElement | null} statusEl
 */
async function runImportSessionFromHtmlFile(file, statusEl) {
  if (!file) return
  if (statusEl) statusEl.textContent = 'Leser fil …'
  try {
    const text = await file.text()
    const res = importSessionFromExportHtml(text)
    if (!res.ok) {
      if (statusEl) statusEl.textContent = res.message
      return
    }
    if (statusEl) statusEl.textContent = 'Økt importert. Åpner den …'
    resumeSession(res.sessionId)
  } catch {
    if (statusEl) statusEl.textContent = 'Kunne ikke lese fila. Prøv igjen.'
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
/**
 * @param {object} sess
 * @param {object[]} preppedPhotos resultat av `preparePhotosArrayForShareRpc` (uten base64)
 */
function sessionToSharePayload(sess, preppedPhotos) {
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
    photos: Array.isArray(preppedPhotos) ? preppedPhotos : [],
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
    ? payload.photos.map(normalizePhotoOrSkeleton).filter(Boolean)
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
    return 'Innholdet er for stort til å sende til en annen bruker (typisk mange store bilder). Prøv færre bilder, komprimer bilder først, eller bruk sky-knappen for å synke til din egen konto på andre enheter.'
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
    !forceHide &&
    Boolean(currentUser && isRemoteAppStateDataEnabled() && !isMinDownloadMode())
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
  if (!isRemoteAppStateDataEnabled() || !currentUser?.id || isMinDownloadMode()) {
    syncInboxIndicators(0, { forceHide: true })
    return
  }
  void refreshIncomingSharesPanel()
  sessionSharePollId = setInterval(() => {
    if (currentUser && isRemoteAppStateDataEnabled()) {
      void refreshIncomingSharesPanel()
    }
  }, 22000)
  const sb = getSupabase()
  if (sb && currentUser.id && !isScanixCloudApiConfigured()) {
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

  if (!isRemoteAppStateDataEnabled() || !currentUser?.id) {
    syncInboxIndicators(0)
    return
  }
  const sb = getSupabase()
  if (!isScanixCloudApiConfigured() && !sb) {
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

/**
 * @param {{ preselectLastContact?: boolean }} [opts]
 */
function openShareSessionDialog(opts = {}) {
  const preselectLast = opts.preselectLastContact === true
  if (!preselectLast) {
    shareRecipientShortId = null
    shareRecipientDisplayName = null
  } else {
    const last = loadLastShareRecipient()
    if (last) {
      shareRecipientShortId = last.shortId
      shareRecipientDisplayName = last.label ? last.label : null
    } else {
      shareRecipientShortId = null
      shareRecipientDisplayName = null
    }
  }
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
    persist('session:share_sent_log')
  }

  const rememberRecipient = () => {
    saveLastShareRecipient(
      shareRecipientShortId,
      shareRecipientDisplayName ?? '',
    )
  }

  const sb = getSupabase()
  if (
    isRemoteAppStateDataEnabled() &&
    currentUser?.id &&
    (isScanixCloudApiConfigured() || sb)
  ) {
    try {
      await tryDrainPhotoUploadQueue({ userId: currentUser.id })
    } catch (e) {
      console.warn('tryDrainPhotoUploadQueue (share session)', e)
    }
    syncPhotoUploadDeferralBanner()
    const sessReady = getSessionForShareExport(sessionId)
    if (!sessReady) {
      if (statusEl) statusEl.textContent = 'Fant ikke økten.'
      return
    }
    const prep = preparePhotosArrayForShareRpc(
      Array.isArray(sessReady.photos) ? sessReady.photos : [],
    )
    if (!prep.ok) {
      if (statusEl) statusEl.textContent = prep.message
      return
    }
    const payload = sessionToSharePayload(sessReady, prep.photos)
    if (!payload) {
      if (statusEl) statusEl.textContent = 'Kunne ikke forberede økt.'
      return
    }
    if (statusEl) statusEl.textContent = 'Sender til mottaker …'
    try {
      const overlayMs = estimateDelskyOverlayDurationMs(payload, 0)
      await runDelskySyncWithOverlay(async () => {
        await sendSessionShare(sb, shareRecipientShortId, payload)
      }, overlayMs)
      document.getElementById('share-session-dialog')?.close()
      if (statusEl) statusEl.textContent = ''
      rememberRecipient()
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
      rememberRecipient()
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
  rememberRecipient()
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
        const mapEl = document.getElementById('map')
        if (!mapEl) return
        await ensureLeaflet()
        await ensureLeafletMarkerCluster()

        if (
          map &&
          map.getContainer() === mapEl &&
          document.documentElement.contains(mapEl)
        ) {
          try {
            map.setMaxZoom(APP_MAP_MAX_ZOOM)
          } catch {
            /* ignore */
          }
          setTimeout(() => {
            map?.invalidateSize()
            nudgeMaptilerBasemapResize(map)
          }, 100)
          rebuildMarkers('session_map_reuse_container')
          void enrichPendingClicks()
          renderCount()
          renderLog()
          renderPhotosGallery()
          updateMapSharePanel()
          const gpsEl = document.getElementById('gps-status')
          if (locationWatchId == null) {
            requestLocationOnLoad(gpsEl)
          }
          syncSessionMapExploreButton()
          syncSessionMapDarkButton()
          await replaceSessionMapBasemapIfNeeded()
          applyAppMapTileContrastToDom()
          return
        }

        if (map) {
          detachSessionBasemapSwWarm()
          try {
            map.remove()
          } catch {
            /* ignore */
          }
          map = null
          sessionBasemapLayer = null
          sessionBasemapDarkApplied = false
          sessionMarkerClusterGroup = null
          markers.length = 0
          userLocationMarker = null
          userAccuracyCircle = null
        }
        ensureSessionPinIcons()
        followUserOnMap = true
        map = Leaflet.map(mapEl, {
          zoomControl: false,
          tapTolerance: 12,
          maxZoom: APP_MAP_MAX_ZOOM,
        }).setView([59.9139, 10.7522], 13)
        try {
          map.setMaxZoom(APP_MAP_MAX_ZOOM)
        } catch {
          /* ignore */
        }
        Leaflet.control.zoom({ position: 'topright' }).addTo(map)
        map.on('dragstart', () => {
          followUserOnMap = false
          syncSessionMapExploreButton()
        })
        map.on('zoomstart', (ev) => {
          if (ev.originalEvent) {
            followUserOnMap = false
            syncSessionMapExploreButton()
          }
        })
        map.on('popupopen', onSessionMapPopupOpen)
        sessionBasemapDarkApplied = getSessionMapDarkPreference()
        syncSessionMapRootDarkClass(sessionBasemapDarkApplied)
        sessionBasemapLayer = await createAppBasemapLayer(
          Leaflet,
          APP_MAP_TILE_LAYER_DATA_SAVER,
          { dark: sessionBasemapDarkApplied },
        )
        sessionBasemapLayer.addTo(map)
        attachSessionBasemapSwWarmIfRaster(sessionBasemapLayer)
        syncSessionMapDarkButton()
        const mcgFn = /** @type {unknown} */ (Leaflet).markerClusterGroup
        sessionMarkerClusterGroup =
          typeof mcgFn === 'function'
            ? /** @type {import('leaflet').Layer} */ (
                /** @type {(o?: object) => import('leaflet').Layer} */ (mcgFn)({
                  chunkedLoading: true,
                  maxClusterRadius: 56,
                  spiderfyOnMaxZoom: true,
                  showCoverageOnHover: false,
                  removeOutsideVisibleBounds: true,
                })
              )
            : null
        if (sessionMarkerClusterGroup) {
          sessionMarkerClusterGroup.addTo(map)
        }
        setTimeout(() => {
          map?.invalidateSize()
          nudgeMaptilerBasemapResize(map)
        }, 100)
        rebuildMarkers('session_map_init_new')
        void enrichPendingClicks()
        renderCount()
        renderLog()
        renderPhotosGallery()
        updateMapSharePanel()
        const gpsEl = document.getElementById('gps-status')
        requestLocationOnLoad(gpsEl)
        syncSessionMapExploreButton()
        applyAppMapTileContrastToDom()
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
      void stopKmtCameraStream()
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
  document.getElementById('btn-kmt-torch')?.addEventListener(
    'click',
    async () => {
      const btn = document.getElementById('btn-kmt-torch')
      if (!(btn instanceof HTMLButtonElement) || btn.disabled) return
      const next = btn.getAttribute('aria-pressed') !== 'true'
      const ok = await setKmtTorch(next)
      if (ok) {
        btn.setAttribute('aria-pressed', next ? 'true' : 'false')
        btn.classList.toggle('kmt-torch-btn--on', next)
      } else {
        btn.setAttribute('aria-pressed', 'false')
        btn.classList.remove('kmt-torch-btn--on')
        const st = document.getElementById('kmt-status')
        if (st) {
          st.textContent = 'Blits er ikke tilgjengelig på denne enheten.'
          st.hidden = false
        }
      }
    },
    { signal },
  )
  const tapLayer = document.getElementById('kmt-tap-focus-layer')
  const stage = document.getElementById('kmt-video-stage')
  let tapDownX = 0
  let tapDownY = 0
  let tapMoved = false
  let tapPanning = false
  let pinchStartDist = 0
  let pinchStartScale = 1

  tapLayer?.addEventListener(
    'pointerdown',
    (ev) => {
      if (!(ev instanceof PointerEvent) || !ev.isPrimary) return
      tapDownX = ev.clientX
      tapDownY = ev.clientY
      tapMoved = false
      tapPanning = getKmtEffectiveZoom() > 1.04
      if (tapPanning) {
        try {
          tapLayer.setPointerCapture(ev.pointerId)
        } catch {
          /* ignore */
        }
      }
    },
    { signal },
  )
  tapLayer?.addEventListener(
    'pointermove',
    (ev) => {
      if (!(ev instanceof PointerEvent)) return
      const dx = ev.clientX - tapDownX
      const dy = ev.clientY - tapDownY
      if (Math.hypot(dx, dy) > 8) tapMoved = true
      if (!tapPanning) return
      kmtZoomPanPx += ev.clientX - tapDownX
      kmtZoomPanPy += ev.clientY - tapDownY
      tapDownX = ev.clientX
      tapDownY = ev.clientY
      applyKmtPreviewZoomStyle()
    },
    { signal },
  )
  tapLayer?.addEventListener(
    'pointerup',
    (ev) => {
      if (!(ev instanceof PointerEvent) || !ev.isPrimary) return
      if (tapPanning) {
        try {
          tapLayer.releasePointerCapture(ev.pointerId)
        } catch {
          /* ignore */
        }
        tapPanning = false
        return
      }
      if (ev.pointerType === 'mouse' && ev.button !== 0) return
      if (tapMoved || kmtSkipNextTapFocus) return
      const video = document.getElementById('kmt-video')
      const track = kmtMediaStream?.getVideoTracks?.()?.[0]
      if (!track || !video) return
      const stg = document.getElementById('kmt-video-stage')
      showKmtFocusRipple(ev.clientX, ev.clientY, stg)
      void applyKmtPointFocus(track, ev.clientX, ev.clientY, video)
    },
    { signal },
  )

  stage?.addEventListener(
    'wheel',
    (e) => {
      if (!kmtCameraMode || !kmtDialogOpen) return
      const t = /** @type {HTMLElement} */ (e.target)
      if (t.closest?.('#kmt-camera-bottom-bar')) return
      if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
        e.preventDefault()
        const delta = -e.deltaY * 0.0018
        void setKmtEffectiveZoom(getKmtEffectiveZoom() + delta)
      }
    },
    { passive: false, signal },
  )

  stage?.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 2) {
        pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
        pinchStartScale = getKmtEffectiveZoom()
      }
    },
    { passive: true, signal },
  )
  stage?.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length !== 2 || pinchStartDist <= 4) return
      e.preventDefault()
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
      const ratio = d / pinchStartDist
      void setKmtEffectiveZoom(pinchStartScale * ratio)
    },
    { passive: false, signal },
  )
  stage?.addEventListener(
    'touchend',
    () => {
      if (pinchStartDist > 4) {
        kmtSkipNextTapFocus = true
        window.setTimeout(() => {
          kmtSkipNextTapFocus = false
        }, 420)
      }
      pinchStartDist = 0
    },
    { signal },
  )
}

/** @param {'quit' | 'pdf' | 'excel'} tab */
function setSessionEndDialogTab(tab) {
  const tabQuit = document.getElementById('session-end-tab-quit')
  const tabPdf = document.getElementById('session-end-tab-pdf')
  const tabExcel = document.getElementById('session-end-tab-excel')
  const panelQuit = document.getElementById('session-end-panel-quit')
  const panelPdf = document.getElementById('session-end-panel-pdf')
  const panelExcel = document.getElementById('session-end-panel-excel')
  tabQuit?.setAttribute('aria-selected', (tab === 'quit').toString())
  tabPdf?.setAttribute('aria-selected', (tab === 'pdf').toString())
  tabExcel?.setAttribute('aria-selected', (tab === 'excel').toString())
  tabQuit?.classList.toggle('session-end-tabs__tab--active', tab === 'quit')
  tabPdf?.classList.toggle('session-end-tabs__tab--active', tab === 'pdf')
  tabExcel?.classList.toggle('session-end-tabs__tab--active', tab === 'excel')
  if (tab === 'quit') {
    panelQuit?.removeAttribute('hidden')
    panelPdf?.setAttribute('hidden', '')
    panelExcel?.setAttribute('hidden', '')
  } else if (tab === 'pdf') {
    panelQuit?.setAttribute('hidden', '')
    panelPdf?.removeAttribute('hidden')
    panelExcel?.setAttribute('hidden', '')
  } else {
    panelQuit?.setAttribute('hidden', '')
    panelPdf?.setAttribute('hidden', '')
    panelExcel?.removeAttribute('hidden')
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

/**
 * Lagrer .xlsx på enheten (iOS: delingsark → Lagre i Filer). Fallback: nedlasting.
 * @param {Blob} blob
 * @param {string} filename
 */
async function shareOrDownloadXlsxBlob(blob, filename) {
  const file = new File([blob], filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
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

/**
 * @param {{ s?: string, d?: string } | null | undefined} v
 */
function sessionClickExcelSdCell(v) {
  if (!v || typeof v !== 'object') return ''
  const s = typeof v.s === 'string' ? v.s.trim() : ''
  const d = typeof v.d === 'string' ? v.d.trim() : ''
  if (s && d) return `S${s}D${d}`
  return ''
}

async function exportSessionClicksXlsx() {
  const statusEl = document.getElementById('session-end-excel-status')
  const titleInp = document.getElementById('session-end-title')
  if (!state.clickHistory.length) {
    if (statusEl) statusEl.textContent = 'Ingen registreringer å eksportere.'
    return
  }
  if (statusEl) statusEl.textContent = 'Genererer Excel …'
  try {
    const headers = [
      'Vegnavn',
      'Vegnr',
      'SD nummer',
      'Meter',
      'Objekt',
      'Kommentar',
    ]
    const rows = state.clickHistory.map((p) => {
      const v =
        p.vegrefAtClick && typeof p.vegrefAtClick === 'object'
          ? p.vegrefAtClick
          : null
      const vegnavn =
        v && typeof v.vegnavn === 'string' ? v.vegnavn.trim() : ''
      const vegnr = v && typeof v.vegnr === 'string' ? v.vegnr.trim() : ''
      const meter = v && typeof v.meter === 'string' ? v.meter.trim() : ''
      const sd = sessionClickExcelSdCell(v)
      const obj =
        typeof p.category === 'string' && p.category
          ? getObjectCategoryLabel(p.category)
          : typeof p.label === 'string' && p.label.trim()
            ? p.label.trim()
            : ''
      const comment =
        typeof p.comment === 'string' && p.comment.trim()
          ? p.comment.trim()
          : ''
      return [vegnavn, vegnr, sd, meter, obj, comment]
    })
    const blob = await excelAoaToXlsxBlob([headers, ...rows], 'Registreringer', {
      rowHeightPt: 20,
      colWidthPt: 101,
    })
    const rawTitle =
      typeof titleInp?.value === 'string' && titleInp.value.trim()
        ? titleInp.value.trim().slice(0, SESSION_TITLE_MAX_LEN)
        : ''
    const safe = rawTitle
      ? rawTitle.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-')
      : ''
    const stamp = new Date().toISOString().slice(0, 10)
    const filename = safe
      ? `inspekt-registreringer-${safe}-${stamp}.xlsx`
      : `inspekt-registreringer-${stamp}.xlsx`
    await shareOrDownloadXlsxBlob(blob, filename)
    if (statusEl) {
      statusEl.textContent =
        'Excel er klar. På iPhone: velg «Lagre i Filer» i delingsarket om du blir spurt.'
    }
  } catch (e) {
    const msg =
      e && typeof e === 'object' && 'message' in e
        ? String(/** @type {{ message: string }} */ (e).message)
        : 'Ukjent feil'
    if (statusEl) {
      statusEl.textContent = msg
    }
  }
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
  const assistantLabel = 'RoadMindAi'
  return lines
    .map((l) => {
      const who = l.role === 'user' ? 'Bruker' : assistantLabel
      return `${who}\n${l.text}`
    })
    .join('\n\n')
}

/**
 * Samme logikk som server: grønn ramme rundt markerte fraser i konklusjon.
 * @param {string} conclusion
 * @param {string[]} highlights
 */
function formatHomeAiPdfPreviewHtml(conclusion, highlights) {
  const escaped = escapeHtml(conclusion).replace(/\r\n/g, '\n')
  const uniq = [
    ...new Set((highlights || []).map((h) => String(h).trim()).filter(Boolean)),
  ].sort((a, b) => b.length - a.length)
  let body = escaped
  if (uniq.length) {
    const parts = uniq.map((h) => escapeHtml(h)).filter(Boolean)
    const pattern = parts
      .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')
    if (pattern) {
      body = escaped.replace(
        new RegExp(`(${pattern})`, 'g'),
        '<span class="pdf-kw">$1</span>',
      )
    }
  }
  return body.replace(/\n/g, '<br />')
}

async function openHomeAiPdfDialog() {
  const dlg = document.getElementById('home-ai-pdf-dialog')
  const preview = document.getElementById('home-ai-pdf-preview')
  const statusEl = document.getElementById('home-ai-pdf-dialog-status')
  if (statusEl) statusEl.textContent = ''
  homeAiPdfSummaryCache = null
  const lines = collectHomeAiChatLinesForPdf()
  if (!lines.length) {
    if (preview) {
      preview.classList.remove('home-ai-pdf-dialog__preview--html')
      preview.textContent = 'Ingen meldinger i samtalen ennå.'
    }
    if (dlg instanceof HTMLDialogElement) dlg.showModal()
    return
  }
  if (preview) {
    preview.classList.remove('home-ai-pdf-dialog__preview--html')
    preview.innerHTML =
      '<p class="home-ai-pdf-dialog__loading">Oppsummerer samtalen …</p>'
  }
  if (dlg instanceof HTMLDialogElement) dlg.showModal()
  try {
    const r = await fetch(apiUrl('/api/ai-chat-pdf-summary'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines, contractMode: homeAiContractRagMode }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      throw new Error(
        typeof data.error === 'string' ? data.error : 'Oppsummering feilet',
      )
    }
    const conclusion = typeof data.conclusion === 'string' ? data.conclusion : ''
    const highlights = Array.isArray(data.highlights) ? data.highlights : []
    homeAiPdfSummaryCache = { conclusion, highlights }
    if (preview) {
      preview.classList.add('home-ai-pdf-dialog__preview--html')
      preview.innerHTML = `<p class="home-ai-pdf-dialog__badge">Konklusjon (AI-oppsummert)</p><div class="home-ai-pdf-dialog__summary">${formatHomeAiPdfPreviewHtml(conclusion, highlights)}</div><p class="home-ai-pdf-dialog__hint">Nøkkelord er markert med grønn ramme.</p>`
    }
  } catch (e) {
    homeAiPdfSummaryCache = null
    if (preview) {
      preview.classList.remove('home-ai-pdf-dialog__preview--html')
      preview.textContent = formatHomeAiPdfPreviewText(lines)
    }
    if (statusEl) {
      statusEl.textContent =
        e && typeof e === 'object' && 'message' in e
          ? `${String(/** @type {{ message: string }} */ (e).message)} — viser full samtale.`
          : 'Kunne ikke oppsummere — viser full samtale.'
    }
  }
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
          ? 'Kontraktskontroll – samtale'
          : 'RoadMindAi – dokumentering',
        generatedAtLabel: new Date().toLocaleString('nb-NO', {
          dateStyle: 'long',
          timeStyle: 'short',
        }),
        lines,
        contractMode: homeAiContractRagMode,
        conclusion: homeAiPdfSummaryCache?.conclusion,
        highlights: homeAiPdfSummaryCache?.highlights,
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
      ? `kontraktskontroll-samtale-${new Date().toISOString().slice(0, 10)}.pdf`
      : `roadmindai-samtale-${new Date().toISOString().slice(0, 10)}.pdf`
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
    appName: 'Inspekt',
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
      label: typeof p.label === 'string' && p.label.trim() ? p.label.trim() : null,
      comment:
        typeof p.comment === 'string' && p.comment.trim()
          ? p.comment.trim()
          : null,
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
    persist('session:counter_undo_no_history')
    return
  }
  state.count -= 1
  state.clickHistory.pop()
  rebuildMarkers('counter_undo_pop')
  addLogEntry(state, {
    message: `Angret · teller ${state.count}`,
  })
  persist('session:counter_undo_pop')
  if (state.clickHistory.length) fitAllPins()
  else centerMapWhenEmptyPins()
}

function sessionCounterReset(buttonEl) {
  triggerResetFeedback(buttonEl)
  const prev = state.count
  state.count = 0
  state.clickHistory = []
  rebuildMarkers('counter_reset_all')
  centerMapWhenEmptyPins()
  addLogEntry(state, {
    message: `Fjernet alle · var ${prev}`,
  })
  persist('session:counter_reset_all')
}

function bindSessionListeners() {
  if (sessionAbort) sessionAbort.abort()
  sessionAbort = new AbortController()
  const { signal } = sessionAbort

  bindKmtDialogListeners(signal)
  wireClickEntryEditDialogListeners(signal)

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
  document.getElementById('btn-save-session-delsky')?.addEventListener(
    'click',
    () => void pushCurrentSessionToMyDelsky(),
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
      const excelStatus = document.getElementById('session-end-excel-status')
      if (excelStatus) excelStatus.textContent = ''
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
  document.getElementById('session-end-tab-excel')?.addEventListener(
    'click',
    () => {
      setSessionEndDialogTab('excel')
      queueMicrotask(() =>
        document.getElementById('session-end-excel-export')?.focus(),
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
  document.getElementById('session-end-excel-export')?.addEventListener(
    'click',
    () => {
      void exportSessionClicksXlsx()
    },
    { signal },
  )
  document.getElementById('session-end-excel-cancel')?.addEventListener(
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
      /** @type {string} */
      let positionSource = 'unknown'
      let gpsErrorText = null
      try {
        const p = await getPositionForClick()
        lat = p.lat
        lng = p.lng
        accuracy = p.accuracy
        if (typeof p.positionSource === 'string') {
          positionSource = p.positionSource
        }
      } catch (err) {
        gpsErrorText = describeGeolocationFailure(err)
        if (gpsEl) gpsEl.textContent = gpsErrorText
        lat = null
        lng = null
        accuracy = null
      }

      if (
        (lat == null || lng == null) &&
        lastLiveCoords &&
        lastLiveCoords.lat != null &&
        lastLiveCoords.lng != null
      ) {
        lat = lastLiveCoords.lat
        lng = lastLiveCoords.lng
        accuracy =
          typeof lastLiveCoords.accuracy === 'number'
            ? lastLiveCoords.accuracy
            : null
        positionSource = 'lastLiveCoords'
      }

      const accNum =
        typeof accuracy === 'number' && !Number.isNaN(accuracy) ? accuracy : null
      const pendingGps =
        lat == null ||
        lng == null ||
        accNum == null ||
        accNum > REGISTER_MAX_GPS_ACCURACY_M

      if (gpsEl) {
        if (pendingGps && lat != null && lng != null && accNum != null) {
          gpsEl.textContent = `Registrert med ca. ±${Math.round(accNum)} m (oppdateres ved bedre GPS)`
        } else if (pendingGps && (lat == null || lng == null)) {
          gpsEl.textContent =
            gpsErrorText ||
            'Registrert uten koordinat – venter på posisjon ved bedre dekning'
        } else if (accNum != null) {
          gpsEl.textContent = `Nøyaktighet ca. ${Math.round(accNum)} m`
        } else {
          gpsEl.textContent = 'Posisjon lagret – vent på vegreferanse'
        }
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
      const clickEntry = {
        id,
        lat: lat ?? null,
        lng: lng ?? null,
        timestamp: ts,
        pendingGps,
        pendingVegref: true,
        gpsAccuracyM: accNum,
        positionSource,
      }
      if (categoryId) clickEntry.category = categoryId
      state.clickHistory.push(clickEntry)
      triggerHapticMark()

      registerNetLogRegisterTap(id, { count: state.count })
      rebuildMarkers('register_button_tap')
      void enrichPendingClicks()
      animateSessionPinDrop()

      const typePart =
        categoryId != null ? ` · ${getObjectCategoryLabel(categoryId)}` : ''
      if (pendingGps) {
        addLogEntry(state, {
          message: `Oppført${typePart} · ${state.count} · venter på posisjon/vegreferanse`,
        })
      } else {
        const coordStr = `${lat.toFixed(5)}, ${lng.toFixed(5)} · nøyaktighet ca. ${Math.round(accNum)} m`
        addLogEntry(state, {
          message: `Oppført${typePart} · ${state.count} · ${coordStr}`,
        })
      }
      persist('session:register_button_tap')
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

  document.getElementById('btn-map-explore')?.addEventListener(
    'click',
    () => {
      followUserOnMap = false
      syncSessionMapExploreButton()
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
          persist('session:export_html_shared')
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
      persist('session:export_html_downloaded')
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
      if (ph) void openPhotoFullscreenFromPhotoRecord(ph)
    },
    { signal },
  )

  document.getElementById('btn-session-photos-save')?.addEventListener(
    'click',
    async () => {
      const photos = Array.isArray(state.photos) ? state.photos : []
      if (!photos.length) {
        showSessionToast('Ingen bilder å lagre i denne økta.', 2200)
        return
      }
      if (photos.length > 1 && typeof confirm === 'function') {
        const ok = confirm(
          `Lagre ${photos.length} bilder? (iPhone viser lagringsvalg for hvert bilde)`,
        )
        if (!ok) return
      }
      for (const ph of photos) {
        await savePhotoToDevice(ph)
      }
      showSessionToast('Bilder er sendt til lagring.', 2600)
    },
    { signal },
  )

  wireSessionBottomSheet(signal)
  wireSessionGpsSheetMirror(signal)
  wireMapThemeDock(signal, {
    frameId: 'session-map-frame',
    posKey: SESSION_MAP_THEME_DOT_POS_KEY,
    onAfterThemeChange: async () => {
      await replaceSessionMapBasemapIfNeeded()
      applyAppMapTileContrastToDom()
    },
  })

  setupSessionShareInbox()
  syncSessionMapDarkButton()
}

function bindListenersForCurrentView() {
  if (advRegAbort) {
    advRegAbort.abort()
    advRegAbort = null
  }
  if (menuExcelVegLivePollId) {
    clearInterval(menuExcelVegLivePollId)
    menuExcelVegLivePollId = null
  }
  if (
    (view !== 'home' &&
      view !== 'menuExcelExport' &&
      view !== 'followUpRouteEdit' &&
      view !== 'menuFollowUpRoute') ||
    !currentUser
  ) {
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
  } else if (view === 'menuFriction') {
    bindMenuFrictionListeners()
  } else if (view === 'menuPhotos') {
    bindMenuPhotosListeners()
  } else if (view === 'menuContacts') {
    bindMenuContactsListeners()
  } else if (view === 'menuTrafficGroup') {
    bindMenuTrafficGroupListeners()
  } else if (view === 'menuOfflineVegref') {
    bindMenuOfflineVegrefListeners()
  } else if (view === 'menuHaptics') {
    bindMenuHapticsListeners()
  } else if (view === 'menuSettings' || view === 'menuPrivacy' || view === 'menuSupport') {
    bindMenuInfoListeners()
  } else if (view === 'menuFinnObjekter') {
    if (menuFinnObjekterAbort) menuFinnObjekterAbort.abort()
    menuFinnObjekterAbort = new AbortController()
    bindFinnObjekterListeners(menuFinnObjekterAbort.signal, { onBack: goHome })
  } else if (view === 'menuExcelExport') {
    bindMenuExcelExportListeners()
  } else if (view === 'menuFollowUpRoute') {
    bindMenuFollowUpRouteListeners()
  } else if (view === 'followUpRouteEdit') {
    bindFollowUpRouteEditListeners()
  } else if (view === 'inbox') {
    bindInboxListeners()
  } else if (view === 'sharedSessionReview') {
    bindSharedSessionReviewListeners()
  } else if (view === 'photoAlbum') {
    bindPhotoAlbumListeners()
  } else if (view === 'receivedPhotos') {
    bindReceivedPhotosListeners()
  } else if (
    view === 'advRegIntro' ||
    view === 'advRegSession' ||
    view === 'advRegReport'
  ) {
    advRegAbort = new AbortController()
    bindAdvancedRegister(
      /** @type {'advRegIntro' | 'advRegSession' | 'advRegReport'} */ (view),
      advRegAbort.signal,
    )
  } else {
    bindHomeListeners()
  }
}

/**
 * På iOS/WebKit forsvinner ofte stylesheet-`filter` på rasterfliser etter at appen har vært
 * i bakgrunn (låseskjerm). Inline-filter (se leafletLazy tileload) + dette kallet ved resume
 * gjenoppretter lesbar kontrast. invalidateSize() unngår feil flislayout etter resume.
 */
function refreshLeafletMapsAfterResume() {
  applyAppMapTileContrastToDom()
  const inv = (m) => {
    try {
      m?.invalidateSize({ animate: false })
    } catch {
      /* ignore */
    }
    nudgeMaptilerBasemapResize(m)
  }
  inv(map)
  inv(menuBrowseMap)
  inv(frictionMap)
  inv(receivedPhotosMap)
  inv(sharedReviewMap)
  inv(offlineVegMap)
  invalidateAdvRegMapSize()
}

function queueRefreshLeafletAfterResume() {
  requestAnimationFrame(() => {
    refreshLeafletMapsAfterResume()
    window.setTimeout(refreshLeafletMapsAfterResume, 120)
  })
}

function showBootstrapFailure(err) {
  console.error('Scanix: oppstart feilet', err)
  document.getElementById('app-launch')?.remove()
  const app = document.getElementById('app')
  const detail =
    err && typeof err === 'object' && 'message' in err
      ? String(/** @type {{ message?: unknown }} */ (err).message)
      : String(err)
  if (app) {
    app.innerHTML =
      `<p style="padding:1.25rem;font-family:system-ui,sans-serif;line-height:1.5;color:#fecaca;background:#1a1520;border-radius:12px;margin:1rem;">Kunne ikke starte appen. Prøv å oppdatere siden eller tøm nettsteddata for dette domenet. (Se konsoll.)${typeof location !== 'undefined' && new URLSearchParams(location.search).has('scanixdebug') ? `<br><br><small style="opacity:.85">${detail.slice(0, 800)}</small>` : ''}</p>`
  }
}

function scanixBootstrapLog(msg) {
  try {
    const on =
      typeof location !== 'undefined' &&
      (new URLSearchParams(location.search).has('scanixdebug') ||
        (typeof localStorage !== 'undefined' &&
          localStorage.getItem('scanix-debug') === '1'))
    if (!on) return
    console.info('[Scanix bootstrap]', msg)
    const el = document.getElementById('scanix-debug-overlay')
    if (el) el.textContent += `[bootstrap] ${msg}\n`
  } catch {
    /* ignore */
  }
}

async function bootstrap() {
  scanixBootstrapLog('starter initAppStateFromStorage …')
  await initAppStateFromStorage()
  scanixBootstrapLog('initAppStateFromStorage ferdig')
  initScreenWakeLock()
  initNativeNetworkStatusListener()
  onNativeWifiOrEthernet(() => {
    if (isRemoteAppStateDataEnabled() && currentUser?.id)
      scheduleSupabaseAppStatePush()
  })
  initHomeWeather({ getIsHome: () => view === 'home' })
  configureAdvancedRegister({
    navigate: (nextView) => {
      view = nextView
      renderApp()
      bindListenersForCurrentView()
    },
  })
  initVegrefLive({
    haversineM,
    fetchRoadPositionDirect,
    fetchRoadReferenceNear: fetchRoadReferenceNearForApp,
    fetchRoadReferenceNearOffline: resolveOfflineRoadReferenceNear,
    getSurfacePreference,
    /* Policy: kun lokal vegref-data (ingen internett-fallback). */
    shouldPreferOfflineResolver: () => offlineVegrefReady,
    getViewHome: () => view === 'home',
    getKmtOpen: () => kmtDialogOpen,
    getRecentTrace: () =>
      traceBuffer.slice(-10).map((p) => ({
        lat: p.lat,
        lng: p.lng,
        at: p.timestamp,
      })),
    applyHome: applyHomeVegrefResult,
    applyKmt: applyKmtResult,
    beforeNvdbFetch: () => {
      if (kmtDialogOpen && !kmtHasDisplayedResult) setKmtLoading()
      if (view === 'home' && !homeVegrefHasDisplayedResult) {
        setHomeVegrefPlaceholder('Henter vegreferanse …')
      }
    },
    /* Minimal mobildata: ikke bruk NVDB-nett når (a) faktisk offline med
       pakke, eller (b) posisjon er innenfor prefetchet deknings-envelope,
       eller (c) innenfor installert offline-pakkes coverageBbox — da er
       lokal data allerede «hentet område»; ved miss brukes koordinat-fallback
       i stedet for å henge på nett. Utenfor disse områdene beholdes NVDB. */
    skipNetworkWhenOfflineReady: (lat, lng) => {
      if (isMinDownloadMode()) return true
      if (offlineVegrefReady) return true
      if (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        if (isLatLngInsidePrefetchCoverage(lat, lng)) return true
        if (offlineVegrefReady && isLatLngInsideOfflinePackageCoverage(lat, lng))
          return true
      }
      return false
    },
    getVegrefDataMode,
  })
  initPrefetch({
    persist: (segments) => mergeNvdbSegmentsIntoOfflineDb(segments)
      .then(() => { void refreshOfflineVegrefState() }),
    onDone: () => { void refreshOfflineVegrefState() },
    shouldSkipPrefetch: () =>
      isMinDownloadMode() ||
      offlineVegrefReady ||
      getVegrefDataMode() === 'minimal',
  })
  initDelegator({
    fetchOnline: (lat, lng, opts) => fetchRoadReferenceNearForApp(lat, lng, opts),
    /* Policy: kun lokal vegref-data. */
    allowOnlineFallback: false,
  })
  window.addEventListener('online', () => {
    void enrichPendingClicks()
    void ensureOfflineVegrefPackage().catch(() => null)
    /* Supabase auto-refresh ble stoppet ved offline for å unngå at en
       hengende refresh holder auth-låsen og spammer konsollen med
       «lock acquisition timed out». Start den igjen nå som nett er tilbake. */
    try {
      const sbOn = getSupabase()
      if (sbOn) sbOn.auth.startAutoRefresh()
    } catch {
      /* noop */
    }
    if (
      lastLiveCoords &&
      Date.now() - lastLiveCoords.ts < 90000 &&
      (view === 'home' || kmtDialogOpen)
    ) {
      vegrefResetThrottle()
      vegrefNotifyGps(lastLiveCoords.lat, lastLiveCoords.lng, {
        forceImmediate: true,
        accuracyM: lastLiveCoords.accuracy,
        timestamp: Date.now(),
      })
    }
    if (currentUser?.id) {
      void tryDrainPhotoUploadQueue({ userId: currentUser.id }).finally(() => {
        syncPhotoUploadDeferralBanner()
      })
      scheduleSupabaseAppStatePush()
    }
    if (currentUser && view === 'home') renderApp()
    else syncPhotoUploadDeferralBanner()
  })
  try {
    navigator.connection?.addEventListener?.('change', () => {
      if (currentUser?.id && !shouldDeferPhotoUploadOnNetwork()) {
        void tryDrainPhotoUploadQueue({ userId: currentUser.id }).finally(() => {
          syncPhotoUploadDeferralBanner()
        })
        scheduleSupabaseAppStatePush()
      } else {
        syncPhotoUploadDeferralBanner()
      }
    })
  } catch {
    /* ignore */
  }
  window.addEventListener('offline', () => {
    /* Stopp Supabase sin bakgrunns-auto-refresh mens nettet er borte: hver
       tick ville ellers prøve å hente refresh-token, timer ut vår 6 s fetch,
       og holde auth-låsen lenge nok til at andre kall får «acquisition
       timed out». Starter igjen på 'online'. */
    try {
      const sbOff = getSupabase()
      if (sbOff) sbOff.auth.stopAutoRefresh()
    } catch {
      /* noop */
    }
    if (
      lastLiveCoords &&
      (view === 'home' || kmtDialogOpen)
    ) {
      vegrefResetThrottle()
      vegrefNotifyGps(lastLiveCoords.lat, lastLiveCoords.lng, {
        forceImmediate: true,
        accuracyM: lastLiveCoords.accuracy,
        timestamp: Date.now(),
      })
    }
    if (currentUser && view === 'home') renderApp()
    else syncPhotoUploadDeferralBanner()
  })
  /* Ikke start stor nedlasting samtidig med første render / NVDB. */
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(
      () => {
        void ensureOfflineVegrefPackage()
      },
      { timeout: 12_000 },
    )
  } else {
    window.setTimeout(() => {
      void ensureOfflineVegrefPackage()
    }, 2500)
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      appendStorageDebugTrace('lifecycle_visibility_hidden')
      flushCurrentSession()
      forceSaveAppStateNow('visibility_hidden')
      /* Forside: watchPosition med enableHighAccuracy er svært strømkrevende.
       * Uten pause fortsetter iOS/WKWebView GPS selv når brukeren bytter app
       * (Energy Impact: Location + CPU). */
      if (view === 'home') {
        stopHomeVegrefTracking()
      }
      if (currentUser?.id) {
        void backupAuthToIdb(loadUsersFromStorage(), currentUser)
      }
    }
    if (document.visibilityState === 'visible') {
      appendStorageDebugTrace('lifecycle_visibility_visible')
      queueRefreshLeafletAfterResume()
      if (view === 'home' && currentUser) {
        startHomeVegrefTracking()
      }
      if (view === 'session') {
        void enrichPendingClicks()
      }
      if (
        currentUser &&
        lastLiveCoords &&
        Date.now() - lastLiveCoords.ts < 120_000 &&
        (view === 'home' || kmtDialogOpen)
      ) {
        vegrefResetThrottle()
        vegrefNotifyGps(lastLiveCoords.lat, lastLiveCoords.lng, {
          forceImmediate: true,
          accuracyM: lastLiveCoords.accuracy,
          timestamp: Date.now(),
        })
      }
      if (view === 'home') {
        bumpHomeVegrefMeterAfterForeground()
      }
    }
  })
  window.addEventListener('pagehide', () => {
    appendStorageDebugTrace('lifecycle_pagehide')
    flushCurrentSession()
    forceSaveAppStateNow('pagehide')
  })
  window.addEventListener('pageshow', (ev) => {
    if (ev.persisted) {
      queueRefreshLeafletAfterResume()
      if (view === 'home') bumpHomeVegrefMeterAfterForeground()
    }
  })
  window.addEventListener('error', (ev) => {
    try {
      scanixDebugFreezeLog('H6', 'window:error', 'uncaught_error', {
        message: String(ev.message || '').slice(0, 240),
        filename: String(ev.filename || '').slice(0, 120),
        lineno: ev.lineno ?? null,
      })
    } catch {
      /* ignore */
    }
  })
  window.addEventListener('unhandledrejection', (ev) => {
    try {
      const r = ev.reason
      const msg =
        r && typeof r === 'object' && 'message' in r
          ? String(/** @type {{ message?: unknown }} */ (r).message)
          : String(r)
      scanixDebugFreezeLog('H6', 'window:unhandledrejection', 'unhandled_rejection', {
        message: msg.slice(0, 240),
      })
    } catch {
      /* ignore */
    }
  })
  const sbBoot = getSupabase()
  if (sbBoot) {
    /* Ved kald oppstart offline: ikke start bakgrunns-auto-refresh, ellers
       spinner den i løkke mens nettet er dødt og spammer lock-advarsler. */
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      try {
        sbBoot.auth.stopAutoRefresh()
      } catch {
        /* noop */
      }
    }
    sbBoot.auth.onAuthStateChange((event, sess) => {
      if (
        event === 'TOKEN_REFRESHED' ||
        event === 'SIGNED_IN' ||
        event === 'INITIAL_SESSION'
      ) {
        if (
          sess?.user?.id &&
          currentUser?.id === sess.user.id &&
          view !== 'auth' &&
          !isMinDownloadMode()
        ) {
          scheduleHydrateUserAppStateFromRemote()
        }
        return
      }
      if (event !== 'SIGNED_OUT') return
      if (ignoreNextSupabaseSignedOut) {
        ignoreNextSupabaseSignedOut = false
        return
      }
      cancelSupabaseAppStatePush()
      teardownSessionShareInbox()
      sessionIdsPendingPartialCloudPush.clear()
      standalonePhotosPendingPartialCloudPush = false
      flushCurrentSession()
      destroyMap()
      vegrefResetSessionCache()
      resetPrefetch()
      currentSessionId = null
      state = defaultState()
      sessions = []
      standalonePhotos = []
      frictionMeasurements = []
      frictionActiveSessionId = null
      frictionPreviousSessionId = null
      lastResumeSessionId = null
      destroyFollowUpRouteMaps()
      followUpDraft = null
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
  scanixBootstrapLog('renderApp …')
  renderApp()
  bindListenersForCurrentView()
  if (isRemoteAppStateDataEnabled() && currentUser?.id && !isMinDownloadMode()) {
    void hydrateUserAppStateFromRemote()
  }
  scanixBootstrapLog('bootstrap ferdig')
}

void bootstrap().catch(showBootstrapFailure)

/** Service worker — må ikke krasje appen hvis registrering feiler. */
let updateSW = /** @type {((reload?: boolean) => Promise<void>) | null} */ (null)
try {
  updateSW = registerSW({
    immediate: false,
    onNeedRefresh() {
      void updateSW?.(true)
    },
  })
} catch (e) {
  console.warn('Scanix: registerSW feilet (app kjører uten PWA-oppdatering)', e)
}

window.addEventListener('beforeunload', () => {
  appendStorageDebugTrace('lifecycle_beforeunload')
  flushCurrentSession()
  forceSaveAppStateNow('beforeunload')
  stopLocationWatch()
})

/** Tidligere: flyttet kart til eget fullskjermslag. Kart er nå alltid fullskjerm under økt. */
function exitSessionMapFullscreen() {
  document.body.classList.remove('session-map-fullscreen-open')
}

function centerMapWhenEmptyPins() {
  if (!map) return
  if (lastLiveCoords && Date.now() - lastLiveCoords.ts < 120000) {
    followUserOnMap = true
    map.setView([lastLiveCoords.lat, lastLiveCoords.lng], 15)
  } else {
    followUserOnMap = false
    map.setView([59.9139, 10.7522], 13)
  }
  syncSessionMapExploreButton()
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

function destroySharedReviewMap() {
  if (sharedReviewMap) {
    try {
      sharedReviewMap.remove()
    } catch {
      /* ignore */
    }
    sharedReviewMap = null
  }
}

function destroyMap() {
  destroyReceivedPhotosMap()
  destroySharedReviewMap()
  kmtStandaloneFlow = false
  document.getElementById('kmt-dialog')?.close()
  kmtDialogOpen = false
  void stopKmtCameraStream()
  vegrefStopPipeline()
  stopLocationWatch()
  resetDrivingFilters()
  followUserOnMap = true
  lastLiveCoords = null
  userLocationMarker = null
  userAccuracyCircle = null
  markers.length = 0
  sessionMarkerClusterGroup = null
  exitSessionMapFullscreen()
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

function followUpPulseStop() {
  if (followUpPulseTimer != null) {
    clearInterval(followUpPulseTimer)
    followUpPulseTimer = null
  }
}

function destroyFollowUpRouteMaps() {
  followUpPulseStop()
  for (const m of followUpLeafletMarkers) {
    try {
      m.off()
      m.remove()
    } catch {
      /* ignore */
    }
  }
  followUpLeafletMarkers = []
  if (followUpEditCluster) {
    try {
      followUpEditMap?.removeLayer(followUpEditCluster)
    } catch {
      /* ignore */
    }
    followUpEditCluster = null
  }
  if (followUpFsCluster) {
    try {
      followUpFsMap?.removeLayer(followUpFsCluster)
    } catch {
      /* ignore */
    }
    followUpFsCluster = null
  }
  if (followUpEditMap) {
    try {
      followUpEditMap.remove()
    } catch {
      /* ignore */
    }
    followUpEditMap = null
  }
  if (followUpFsMap) {
    try {
      followUpFsMap.remove()
    } catch {
      /* ignore */
    }
    followUpFsMap = null
  }
}

function followUpEnsurePinIcon() {
  ensureSessionPinIcons()
  return pinIcon
}

async function followUpBuildPopupHtml(lat, lng) {
  try {
    const v = await fetchRoadPositionDirect(lat, lng, { accuracyM: 35 })
    if (!v) {
      return '<div class="followup-popup"><p class="followup-popup__muted">Ingen vegreferanse fra NVDB her.</p></div>'
    }
    const line =
      typeof v.roadLineDisplay === 'string' && v.roadLineDisplay.trim()
        ? v.roadLineDisplay.trim()
        : typeof v.roadLine === 'string'
          ? v.roadLine
          : ''
    const m = v.m != null ? String(v.m) : '–'
    const s = v.s != null ? String(v.s) : '–'
    const d = v.d != null ? String(v.d) : '–'
    return `<div class="followup-popup">
      <p class="followup-popup__road">${escapeHtml(line)}</p>
      <dl class="followup-popup__dl">
        <div><dt>S</dt><dd>${escapeHtml(s)}</dd></div>
        <div><dt>D</dt><dd>${escapeHtml(d)}</dd></div>
        <div><dt>Meter</dt><dd>${escapeHtml(m)}</dd></div>
      </dl>
    </div>`
  } catch {
    return '<div class="followup-popup"><p class="followup-popup__muted">Kunne ikke hente vegref.</p></div>'
  }
}

function followUpUpdateNearestPulse(map, clusterGroup) {
  if (!map || !clusterGroup || !followUpDraft?.markers?.length) return
  const u = lastLiveCoords
  if (
    !u ||
    typeof u.lat !== 'number' ||
    typeof u.lng !== 'number' ||
    map.getZoom() < 14
  ) {
    for (const m of followUpLeafletMarkers) {
      const el = m.getElement?.()
      el?.classList.remove('followup-marker--pulse')
    }
    return
  }
  const firstM = followUpLeafletMarkers[0]
  if (!firstM) return
  const ll = firstM.getLatLng()
  const dist = haversineM(u.lat, u.lng, ll.lat, ll.lng)
  const el = firstM.getElement?.()
  let unclustered = true
  try {
    if (clusterGroup && typeof clusterGroup.getVisibleParent === 'function') {
      const p = clusterGroup.getVisibleParent(firstM)
      unclustered = p == null || p === firstM
    }
  } catch {
    unclustered = true
  }
  const show = el && dist < 3200 && map.getZoom() >= 15 && unclustered
  for (const m of followUpLeafletMarkers) {
    const node = m.getElement?.()
    node?.classList.toggle('followup-marker--pulse', show && m === firstM)
  }
}

async function initFollowUpEditMapInternal() {
  const el = document.getElementById('followup-edit-map')
  if (!el || followUpEditMap) return
  await ensureLeaflet()
  await ensureLeafletMarkerCluster()
  followUpEditMap = Leaflet.map(el, {
    zoomControl: true,
    maxZoom: APP_MAP_MAX_ZOOM,
  }).setView([65.0, 15.0], 5)
  try {
    followUpEditMap.setMaxZoom(APP_MAP_MAX_ZOOM)
  } catch {
    /* ignore */
  }
  ;(await createAppBasemapLayer(Leaflet, APP_MAP_TILE_LAYER_DATA_SAVER)).addTo(
    followUpEditMap,
  )
  const mcgFn = /** @type {unknown} */ (Leaflet).markerClusterGroup
  followUpEditCluster =
    typeof mcgFn === 'function'
      ? /** @type {(o?: object) => import('leaflet').Layer} */ (mcgFn)({
          chunkedLoading: true,
          maxClusterRadius: 52,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          removeOutsideVisibleBounds: true,
        })
      : null
  if (followUpEditCluster) followUpEditCluster.addTo(followUpEditMap)
  followUpEditMap.on('zoomend moveend', () => {
    followUpUpdateNearestPulse(
      followUpEditMap,
      /** @type {{ getVisibleParent?: (m: import('leaflet').Marker) => unknown }} */ (
        followUpEditCluster
      ),
    )
  })
  window.setTimeout(() => {
    try {
      followUpEditMap?.invalidateSize()
      nudgeMaptilerBasemapResize(followUpEditMap)
    } catch {
      /* ignore */
    }
  }, 140)
  rebuildFollowUpEditMarkers()
  if (followUpPulseTimer == null) {
    followUpPulseTimer = window.setInterval(() => {
      if (view !== 'followUpRouteEdit' || !followUpEditMap) return
      followUpUpdateNearestPulse(
        followUpEditMap,
        /** @type {{ getVisibleParent?: (m: import('leaflet').Marker) => unknown }} */ (
          followUpEditCluster
        ),
      )
    }, 2200)
  }
}

function rebuildFollowUpEditMarkers() {
  if (!followUpEditMap || !Leaflet) return
  const cg = followUpEditCluster
  if (cg && typeof cg.clearLayers === 'function') {
    try {
      cg.clearLayers()
    } catch {
      /* ignore */
    }
  }
  for (const m of followUpLeafletMarkers) {
    try {
      m.remove()
    } catch {
      /* ignore */
    }
  }
  followUpLeafletMarkers = []
  const icon = followUpEnsurePinIcon()
  const markers = Array.isArray(followUpDraft?.markers) ? followUpDraft.markers : []
  let idx = 0
  for (const raw of markers) {
    const mk = /** @type {{ id?: string, lat?: number, lng?: number, roadDisplay?: string, meter?: number }} */ (
      raw
    )
    if (typeof mk.lat !== 'number' || typeof mk.lng !== 'number') continue
    const marker = Leaflet.marker([mk.lat, mk.lng], {
      icon: icon || undefined,
      title:
        typeof mk.roadDisplay === 'string'
          ? `${mk.roadDisplay} m${mk.meter ?? ''}`
          : `Punkt ${idx + 1}`,
    })
    const label = idx + 1
    marker.bindPopup(`<div class="followup-popup followup-popup--loading">Henter vegref …</div>`, {
      maxWidth: 280,
      className: 'followup-popup-wrap',
    })
    marker.on('popupopen', () => {
      void (async () => {
        const p = marker.getPopup()
        if (!p) return
        const html = await followUpBuildPopupHtml(mk.lat, mk.lng)
        p.setContent(html)
      })()
    })
    if (cg && typeof cg.addLayer === 'function') cg.addLayer(marker)
    else marker.addTo(followUpEditMap)
    followUpLeafletMarkers.push(marker)
    idx += 1
  }
  if (markers.length) {
    const bounds = Leaflet.latLngBounds(
      markers.map((r) => {
        const o = /** @type {{ lat: number, lng: number }} */ (r)
        return [o.lat, o.lng]
      }),
    )
    try {
      followUpEditMap.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 })
    } catch {
      /* ignore */
    }
  }
}

async function initFollowUpFsMapInternal() {
  const shell = document.getElementById('followup-fullscreen-shell')
  const el = document.getElementById('followup-fs-map')
  if (!shell || !el || followUpFsMap) return
  shell.hidden = false
  await ensureLeaflet()
  await ensureLeafletMarkerCluster()
  followUpFsMap = Leaflet.map(el, {
    zoomControl: true,
    maxZoom: APP_MAP_MAX_ZOOM,
  }).setView([65.0, 15.0], 5)
  try {
    followUpFsMap.setMaxZoom(APP_MAP_MAX_ZOOM)
  } catch {
    /* ignore */
  }
  ;(await createAppBasemapLayer(Leaflet, APP_MAP_TILE_LAYER_DATA_SAVER)).addTo(
    followUpFsMap,
  )
  const mcgFn = /** @type {unknown} */ (Leaflet).markerClusterGroup
  followUpFsCluster =
    typeof mcgFn === 'function'
      ? /** @type {(o?: object) => import('leaflet').Layer} */ (mcgFn)({
          chunkedLoading: true,
          maxClusterRadius: 56,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          removeOutsideVisibleBounds: true,
        })
      : null
  const icon = followUpEnsurePinIcon()
  const markers = Array.isArray(followUpDraft?.markers) ? followUpDraft.markers : []
  if (followUpFsCluster) followUpFsCluster.addTo(followUpFsMap)
  let i = 0
  for (const raw of markers) {
    const mk = /** @type {{ lat?: number, lng?: number, roadDisplay?: string, meter?: number }} */ (
      raw
    )
    if (typeof mk.lat !== 'number' || typeof mk.lng !== 'number') continue
    const marker = Leaflet.marker([mk.lat, mk.lng], { icon: icon || undefined })
    marker.bindPopup(`<div class="followup-popup followup-popup--loading">Henter vegref …</div>`, {
      maxWidth: 280,
      className: 'followup-popup-wrap',
    })
    marker.on('popupopen', () => {
      void (async () => {
        const p = marker.getPopup()
        if (!p) return
        const html = await followUpBuildPopupHtml(mk.lat, mk.lng)
        p.setContent(html)
      })()
    })
    if (followUpFsCluster && typeof followUpFsCluster.addLayer === 'function')
      followUpFsCluster.addLayer(marker)
    else marker.addTo(followUpFsMap)
    i += 1
  }
  if (markers.length) {
    const bounds = Leaflet.latLngBounds(
      markers.map((r) => {
        const o = /** @type {{ lat: number, lng: number }} */ (r)
        return [o.lat, o.lng]
      }),
    )
    try {
      followUpFsMap.fitBounds(bounds, { padding: [52, 52], maxZoom: APP_MAP_MAX_ZOOM })
    } catch {
      /* ignore */
    }
  }
  window.setTimeout(() => {
    try {
      followUpFsMap?.invalidateSize()
      nudgeMaptilerBasemapResize(followUpFsMap)
    } catch {
      /* ignore */
    }
  }, 160)
}

function closeFollowUpFullscreen() {
  const shell = document.getElementById('followup-fullscreen-shell')
  if (shell) shell.hidden = true
  if (followUpFsCluster) {
    try {
      followUpFsMap?.removeLayer(followUpFsCluster)
    } catch {
      /* ignore */
    }
    followUpFsCluster = null
  }
  if (followUpFsMap) {
    try {
      followUpFsMap.remove()
    } catch {
      /* ignore */
    }
    followUpFsMap = null
  }
  window.setTimeout(() => {
    try {
      followUpEditMap?.invalidateSize()
      nudgeMaptilerBasemapResize(followUpEditMap)
    } catch {
      /* ignore */
    }
  }, 80)
}

async function initMenuBrowseMap() {
  const el = document.getElementById('menu-browse-map')
  if (!el || menuBrowseMap) return
  await ensureLeaflet()
  menuBrowseMap = Leaflet.map('menu-browse-map', {
    zoomControl: false,
    maxZoom: APP_MAP_MAX_ZOOM,
  }).setView([59.9139, 10.7522], 13)
  try {
    menuBrowseMap.setMaxZoom(APP_MAP_MAX_ZOOM)
  } catch {
    /* ignore */
  }
  Leaflet.control.zoom({ position: 'topright' }).addTo(menuBrowseMap)
  ;(await createAppBasemapLayer(Leaflet)).addTo(menuBrowseMap)
  window.setTimeout(() => {
    try {
      menuBrowseMap?.invalidateSize()
      nudgeMaptilerBasemapResize(menuBrowseMap)
    } catch {
      /* ignore */
    }
  }, 120)
}

function destroyOfflineVegMap() {
  if (offlineVegMap) {
    try {
      offlineVegMap.remove()
    } catch {
      /* ignore */
    }
    offlineVegMap = null
    offlineVegRect = null
  }
}

async function initOfflineVegMap() {
  const el = document.getElementById('offline-veg-map')
  if (!el || offlineVegMap) return
  await ensureLeaflet()
  offlineVegMap = Leaflet.map('offline-veg-map', {
    zoomControl: false,
    attributionControl: false,
    dragging: true,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    keyboard: false,
    maxZoom: APP_MAP_MAX_ZOOM,
  }).setView([65.0, 13.0], 5)
  try {
    offlineVegMap.setMaxZoom(APP_MAP_MAX_ZOOM)
  } catch {
    /* ignore */
  }
  ;(await createAppBasemapLayer(Leaflet)).addTo(offlineVegMap)
  window.setTimeout(() => {
    try {
      offlineVegMap?.invalidateSize()
      nudgeMaptilerBasemapResize(offlineVegMap)
    } catch {
      /* ignore */
    }
    redrawOfflineVegRect()
  }, 120)
}

function redrawOfflineVegRect() {
  if (!offlineVegMap || !Leaflet) return
  const bbox = offlineVegEffectiveBbox()
  if (offlineVegRect) {
    try {
      offlineVegRect.remove()
    } catch {
      /* ignore */
    }
    offlineVegRect = null
  }
  if (!bbox) return
  const bounds = Leaflet.latLngBounds(
    [bbox.minLat, bbox.minLng],
    [bbox.maxLat, bbox.maxLng],
  )
  offlineVegRect = Leaflet.rectangle(bounds, {
    color: '#34d399',
    weight: 2,
    fillColor: '#34d399',
    fillOpacity: 0.16,
    interactive: false,
  }).addTo(offlineVegMap)
  try {
    offlineVegMap.fitBounds(bounds, {
      padding: [24, 24],
      maxZoom: 13,
      animate: false,
    })
  } catch {
    /* ignore */
  }
}

/** Bygg en stabil id for et Nominatim-treff. */
function nominatimSuggestionId(item) {
  const t = item?.osm_type ? String(item.osm_type) : 't'
  const i = item?.osm_id != null ? String(item.osm_id) : ''
  if (i) return `${t[0]}${i}`
  if (item?.place_id != null) return `p${item.place_id}`
  return `q${Math.random().toString(36).slice(2, 8)}`
}

function nominatimItemToSuggestion(item) {
  if (!item || typeof item !== 'object') return null
  const bb = Array.isArray(item.boundingbox) ? item.boundingbox : null
  if (!bb || bb.length !== 4) return null
  const minLat = Number(bb[0])
  const maxLat = Number(bb[1])
  const minLng = Number(bb[2])
  const maxLng = Number(bb[3])
  if (
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLat) ||
    !Number.isFinite(minLng) ||
    !Number.isFinite(maxLng) ||
    minLat >= maxLat ||
    minLng >= maxLng
  ) {
    return null
  }
  const label =
    typeof item.display_name === 'string'
      ? item.display_name
      : `${minLat.toFixed(3)},${minLng.toFixed(3)}`
  return {
    id: nominatimSuggestionId(item),
    label,
    bbox: { minLng, minLat, maxLng, maxLat },
  }
}

async function performOfflineVegSearch(query) {
  if (offlineVegSearchAbort) offlineVegSearchAbort.abort()
  offlineVegSearchAbort = new AbortController()
  const { signal } = offlineVegSearchAbort
  offlineVegSearchBusy = true
  offlineVegSearchError = ''
  paintOfflineVegSuggestions()
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'json')
    url.searchParams.set('countrycodes', 'no')
    url.searchParams.set('limit', '8')
    url.searchParams.set('addressdetails', '0')
    url.searchParams.set('q', query)
    const res = await fetch(url.toString(), {
      signal,
      headers: {
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const list = Array.isArray(json) ? json : []
    const mapped = list
      .map(nominatimItemToSuggestion)
      .filter(/** @returns {s is OfflineVegSuggestion} */ (s) => Boolean(s))
    offlineVegSuggestions = mapped
  } catch (err) {
    if (/** @type {{ name?: string }} */ (err)?.name === 'AbortError') return
    offlineVegSuggestions = []
    offlineVegSearchError = 'Kunne ikke hente forslag. Prøv igjen.'
  } finally {
    if (offlineVegSearchAbort?.signal === signal) {
      offlineVegSearchAbort = null
    }
    offlineVegSearchBusy = false
    paintOfflineVegSuggestions()
  }
}

/**
 * Direkte DOM-oppdatering for søkelisten: ingen full renderApp(), så input
 * mister ikke fokus eller cursor-posisjon mens brukeren skriver.
 */
function paintOfflineVegSuggestions() {
  if (view !== 'menuOfflineVegref') return
  const list = document.querySelector('.offline-veg-suggest')
  const errorHost = document.querySelector('.offline-veg-search-error-slot')
  if (!list) return
  while (list.firstChild) list.removeChild(list.firstChild)
  if (offlineVegSearchBusy) {
    const li = document.createElement('li')
    li.className = 'offline-veg-suggest__loading'
    li.setAttribute('role', 'status')
    li.textContent = 'Søker …'
    list.appendChild(li)
  } else if (offlineVegSuggestions.length > 0) {
    offlineVegSuggestions.forEach((s, idx) => {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'offline-veg-suggest__item'
      if (offlineVegSelected && offlineVegSelected.id === s.id) {
        btn.classList.add('offline-veg-suggest__item--active')
      }
      btn.dataset.offlineVegPick = String(idx)
      btn.textContent = s.label
      btn.addEventListener('click', () => pickOfflineVegSuggestion(idx))
      li.appendChild(btn)
      list.appendChild(li)
    })
  } else if (
    offlineVegSearchQuery.trim().length >= 2 &&
    !offlineVegSearchError
  ) {
    const li = document.createElement('li')
    li.className = 'offline-veg-suggest__empty'
    li.textContent = 'Ingen forslag'
    list.appendChild(li)
  }
  if (errorHost) {
    errorHost.innerHTML = offlineVegSearchError
      ? `<p class="offline-veg-error" role="alert">${escapeHtml(offlineVegSearchError)}</p>`
      : ''
  }
}

function pickOfflineVegSuggestion(idx) {
  const s = offlineVegSuggestions[idx]
  if (!s) return
  offlineVegSelected = s
  offlineVegDownloadStatus = ''
  offlineVegDownloadError = ''
  document.querySelectorAll('.offline-veg-suggest__item').forEach((el, i) => {
    el.classList.toggle('offline-veg-suggest__item--active', i === idx)
  })
  redrawOfflineVegRect()
  paintOfflineVegStatusAndButton()
  paintOfflineVegTooLongNotice()
}

function paintOfflineVegStatusAndButton() {
  if (view !== 'menuOfflineVegref') return
  const statusHost = document.querySelector('.offline-veg-download-status-slot')
  const errorHost = document.querySelector('.offline-veg-download-error-slot')
  const dlBtn = /** @type {HTMLButtonElement | null} */ (
    document.getElementById('btn-offline-veg-download')
  )
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  if (dlBtn) {
    dlBtn.disabled =
      offline || offlineVegDownloadBusy || !offlineVegSelected
    dlBtn.textContent = offlineVegDownloadBusy
      ? 'Laster ned …'
      : 'Last ned til telefon'
  }
  if (statusHost) {
    statusHost.innerHTML = offlineVegDownloadStatus
      ? `<p class="offline-veg-status" role="status">${escapeHtml(offlineVegDownloadStatus)}</p>`
      : ''
  }
  if (errorHost) {
    errorHost.innerHTML = offlineVegDownloadError
      ? `<p class="offline-veg-error" role="alert">${escapeHtml(offlineVegDownloadError)}</p>`
      : ''
  }
}

/**
 * @param {number[][]} latlngs [lat, lng][]
 * @param {number} maxM
 */
function trimLatLngPathToMaxDistanceM(latlngs, maxM) {
  if (!latlngs || latlngs.length < 2 || maxM <= 0) return latlngs || []
  const out = [latlngs[0]]
  let acc = 0
  for (let i = 1; i < latlngs.length; i++) {
    const a = out[out.length - 1]
    const b = latlngs[i]
    const d = haversineM(a[0], a[1], b[0], b[1])
    if (acc + d <= maxM) {
      acc += d
      out.push(b)
      continue
    }
    const rem = maxM - acc
    if (rem > 4 && d > 1e-6) {
      const t = Math.min(1, rem / d)
      out.push([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
      ])
    }
    break
  }
  return out.length >= 2 ? out : latlngs.slice(0, Math.min(2, latlngs.length))
}

/**
 * Bbox som omslutter en polylinje + buffer (km), deretter MAX_BBOX-klamp.
 * @param {number[][]} latlngs
 * @param {number} padKm
 */
function bboxFromLatLngPathForNvdb(latlngs, padKm) {
  if (!latlngs || latlngs.length < 2) return null
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const p of latlngs) {
    if (!p || p.length < 2) continue
    const lat = p[0]
    const lng = p[1]
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
  }
  if (!Number.isFinite(minLat) || minLat === Infinity) return null
  const seed = { minLat, maxLat, minLng, maxLng }
  const expanded = expandBboxKm(seed, padKm)
  const clamped = clampBboxToMaxDeg(expanded)
  return bboxIsValid(clamped) ? clamped : null
}

/**
 * Bygg nedlastings-bbox langs kjørerute (OSRM), ikke luftlinje-rektangel fra søk.
 * Returnerer null hvis forholdene ikke er oppfylt eller OSRM feiler — da brukes nominatim-bbox.
 */
async function tryOfflineVegRoadCorridorBbox() {
  const lc = lastLiveCoords
  if (
    !lc ||
    typeof lc.lat !== 'number' ||
    typeof lc.lng !== 'number' ||
    Number.isNaN(lc.lat) ||
    Number.isNaN(lc.lng)
  ) {
    return null
  }
  const acc =
    typeof lc.accuracy === 'number' && Number.isFinite(lc.accuracy)
      ? lc.accuracy
      : 99
  if (acc > OFFLINE_VEG_ROUTE_MAX_GPS_ACC_M) return null
  const spd = vegrefGetLastSpeed()
  if (spd < OFFLINE_VEG_ROUTE_MIN_SPEED_MPS) return null
  const tb = traceBuffer
  if (tb.length < 2) return null
  const b = tb[tb.length - 1]
  const a = tb[tb.length - 2]
  const age = Date.now() - b.timestampMs
  if (age > OFFLINE_VEG_ROUTE_TRACE_FRESH_MS) return null
  const brg = bearingDeg(a.lat, a.lng, b.lat, b.lng)
  if (!Number.isFinite(brg)) return null
  const cosLat = Math.max(0.05, Math.cos((lc.lat * Math.PI) / 180))
  const rad = (brg * Math.PI) / 180
  const airKm = Math.min(
    OFFLINE_VEG_ROUTE_MAX_AIR_KM,
    OFFLINE_VEG_ROUTE_AHEAD_KM * 1.12,
  )
  const endLat = lc.lat + (airKm * Math.cos(rad)) / 111
  const endLng = lc.lng + (airKm * Math.sin(rad)) / (111 * cosLat)
  const route = await fetchOsrmDrivingRoute(lc.lat, lc.lng, endLat, endLng)
  if (!route?.latlngs?.length || route.latlngs.length < 2) return null
  const maxAlongM = Math.min(
    OFFLINE_VEG_ROUTE_AHEAD_KM * 1000,
    typeof route.distanceM === 'number' && Number.isFinite(route.distanceM)
      ? route.distanceM
      : OFFLINE_VEG_ROUTE_AHEAD_KM * 1000,
  )
  const trimmed = trimLatLngPathToMaxDistanceM(route.latlngs, maxAlongM)
  const padKm = Math.max(offlineVegBufferKm, 1.0)
  return bboxFromLatLngPathForNvdb(trimmed, padKm)
}

async function downloadOfflineVegSelection() {
  if (offlineVegDownloadBusy) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    offlineVegDownloadError = 'Du er uten nett. Koble til og prøv igjen.'
    paintOfflineVegStatusAndButton()
    return
  }
  let bbox = offlineVegEffectiveBbox()
  if (!bbox) {
    offlineVegDownloadError = 'Velg et område først.'
    paintOfflineVegStatusAndButton()
    return
  }
  offlineVegDownloadBusy = true
  offlineVegDownloadError = ''
  offlineVegDownloadStatus = 'Forbereder nedlastingsområde …'
  paintOfflineVegStatusAndButton()
  const roadBbox = await tryOfflineVegRoadCorridorBbox()
  if (roadBbox) {
    bbox = roadBbox
    offlineVegDownloadStatus =
      'Bruker kjørerute (~12 km) som nedlastingsområde (ikke luftlinje). Henter vegdata fra NVDB …'
  } else {
    offlineVegDownloadStatus = 'Henter vegdata fra NVDB …'
  }
  if (offlineVegDownloadAbort) offlineVegDownloadAbort.abort()
  offlineVegDownloadAbort = new AbortController()
  const { signal } = offlineVegDownloadAbort
  paintOfflineVegStatusAndButton()
  try {
    const segments = await fetchNvdbSegmentsForBbox(bbox, {
      signal,
      onProgress: ({ page, total }) => {
        offlineVegDownloadStatus = `Henter side ${page} (${total.toLocaleString('nb-NO')} segmenter) …`
        paintOfflineVegStatusAndButton()
      },
    })
    if (signal.aborted) return
    if (!segments.length) {
      offlineVegDownloadStatus = 'Fant ingen vegsegmenter i området.'
    } else {
      offlineVegDownloadStatus = `Lagrer ${segments.length.toLocaleString('nb-NO')} segmenter …`
      paintOfflineVegStatusAndButton()
      await mergeNvdbSegmentsIntoOfflineDb(segments)
      await refreshOfflineVegrefState()
      const labelPart = offlineVegSelected?.label
        ? ` for «${offlineVegSelected.label.split(',')[0]}»`
        : ''
      offlineVegDownloadStatus = `Lagret ${segments.length.toLocaleString('nb-NO')} segmenter${labelPart}.`
    }
  } catch (err) {
    if (/** @type {{ name?: string }} */ (err)?.name === 'AbortError') return
    offlineVegDownloadError = 'Nedlasting feilet. Sjekk nett og prøv igjen.'
    offlineVegDownloadStatus = ''
  } finally {
    if (offlineVegDownloadAbort?.signal === signal) {
      offlineVegDownloadAbort = null
    }
    offlineVegDownloadBusy = false
    paintOfflineVegStatusAndButton()
    paintOfflineVegFineprint()
  }
}

/**
 * Vis konkret «for langt»-beskjed i Område-kortet, kun når den valgte
 * strekningen faktisk er lengre enn vi kan dekke i én nedlasting.
 */
function paintOfflineVegTooLongNotice() {
  if (view !== 'menuOfflineVegref') return
  const slot = document.querySelector('.offline-veg-toolong-slot')
  if (!slot) return
  const info = offlineVegSelectionTooLong()
  if (!info) {
    slot.innerHTML = ''
    return
  }
  const lengthStr = `${info.lengthKm.toFixed(0)} km`
  const coveredStr = `${info.coveredKm.toFixed(0)} km`
  const labelPart = offlineVegSelected?.label
    ? `«${offlineVegSelected.label.split(',')[0]}» er ca. ${lengthStr}`
    : `Strekningen er ca. ${lengthStr}`
  slot.innerHTML = `<p class="offline-veg-warn" role="alert"><strong>Strekningen er for lang for én nedlasting.</strong><br/>${escapeHtml(labelPart)}, men vi kan dekke maks ${escapeHtml(coveredStr)} per gang. Du får nå området rundt midten av treffet. <br/><br/>For å dekke hele strekningen: søk på et sted lenger ute (f.eks. en tettstad eller et kryss) og last ned det området i tillegg. Tidligere nedlastinger beholdes.</p>`
}

/** Oppdater telleren i fineprint etter merge uten full rerender. */
function paintOfflineVegFineprint() {
  if (view !== 'menuOfflineVegref') return
  const meta = offlineVegrefMeta
  const segCount =
    meta && typeof meta.count === 'number' ? meta.count : 0
  const segCountStr = segCount.toLocaleString('nb-NO')
  const el = document.querySelector('.offline-veg-fineprint-count')
  if (el) el.textContent = segCountStr
}

/** @type {AbortController | null} */
let menuOfflineVegrefAbort = null

function bindMenuOfflineVegrefListeners() {
  if (menuOfflineVegrefAbort) menuOfflineVegrefAbort.abort()
  menuOfflineVegrefAbort = new AbortController()
  const { signal } = menuOfflineVegrefAbort

  document
    .getElementById('btn-back-from-menu-offline-vegref')
    ?.addEventListener('click', () => goHome(), { signal })

  const input = /** @type {HTMLInputElement | null} */ (
    document.getElementById('offline-veg-search-input')
  )
  if (input) {
    input.addEventListener(
      'input',
      () => {
        offlineVegSearchQuery = input.value
        if (offlineVegSearchDebounce != null) {
          clearTimeout(offlineVegSearchDebounce)
          offlineVegSearchDebounce = null
        }
        const q = input.value.trim()
        if (q.length < 2) {
          if (offlineVegSearchAbort) offlineVegSearchAbort.abort()
          offlineVegSuggestions = []
          offlineVegSearchBusy = false
          offlineVegSearchError = ''
          paintOfflineVegSuggestions()
          return
        }
        offlineVegSearchDebounce = setTimeout(() => {
          offlineVegSearchDebounce = null
          void performOfflineVegSearch(q)
        }, 350)
      },
      { signal },
    )
  }

  const buffer = /** @type {HTMLInputElement | null} */ (
    document.getElementById('offline-veg-buffer')
  )
  if (buffer) {
    buffer.addEventListener(
      'input',
      () => {
        const next = Number(buffer.value)
        if (!Number.isFinite(next)) return
        offlineVegBufferKm = Math.min(
          OFFLINE_VEG_BUFFER_MAX_KM,
          Math.max(OFFLINE_VEG_BUFFER_MIN_KM, next),
        )
        const labelEl = document.querySelector('.offline-veg-slider__value')
        if (labelEl) {
          labelEl.textContent = `${offlineVegBufferKm.toFixed(1).replace('.', ',')} km`
        }
        const bbox = offlineVegEffectiveBbox()
        const areaEl = document.querySelector(
          '.offline-veg-card__head .offline-veg-card__meta',
        )
        if (areaEl) {
          areaEl.textContent = bbox
            ? `${estimateAreaKm2(bbox).toFixed(1)} km²`
            : '–'
        }
        const dlBtn = /** @type {HTMLButtonElement | null} */ (
          document.getElementById('btn-offline-veg-download')
        )
        if (dlBtn) {
          const offline =
            typeof navigator !== 'undefined' && navigator.onLine === false
          dlBtn.disabled =
            offline || offlineVegDownloadBusy || !offlineVegSelected
        }
        redrawOfflineVegRect()
      },
      { signal },
    )
  }

  document.getElementById('btn-offline-veg-download')?.addEventListener(
    'click',
    () => {
      void downloadOfflineVegSelection()
    },
    { signal },
  )

  paintOfflineVegSuggestions()
  paintOfflineVegStatusAndButton()
  paintOfflineVegTooLongNotice()
  redrawOfflineVegRect()
}

/**
 * OSRM route langs vei mellom to punkter (GeoJSON-linje).
 * @returns {{ latlngs: [number, number][], distanceM: number } | null}
 */
async function fetchOsrmDrivingRoute(lat1, lng1, lat2, lng2) {
  const path = `/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson&steps=false`
  const j = await fetchOsrmJson(path)
  const route = j?.routes?.[0]
  if (!route) return null
  const coords = route.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null
  const latlngs = coords.map(
    /** @param {[number, number]} c */ (c) => [c[1], c[0]],
  )
  const distanceM =
    typeof route.distance === 'number' && Number.isFinite(route.distance)
      ? route.distance
      : null
  if (distanceM == null) return null
  return { latlngs, distanceM }
}

function formatFrictionDistanceShort(m) {
  if (!Number.isFinite(m) || m < 0) return '—'
  if (m >= 1000) return `${(m / 1000).toFixed(2).replace('.', ',')} km`
  return `${Math.round(m)} m`
}

function formatFrictionValueNb(v) {
  if (!Number.isFinite(v)) return '—'
  return String(v).replace('.', ',')
}

/**
 * @param {import('leaflet').Polyline | null} line
 * @returns {number[][]}
 */
function frictionPolylineToPathPlain(line) {
  if (!line || typeof line.getLatLngs !== 'function') return []
  const raw = line.getLatLngs()
  if (!raw?.length) return []
  const first = raw[0]
  if (first && typeof first === 'object' && 'lat' in first) {
    return /** @type {import('leaflet').LatLng[]} */ (raw).map((ll) => [
      Number(ll.lat),
      Number(ll.lng),
    ])
  }
  const flat = /** @type {unknown[]} */ (raw).flat(Infinity)
  return flat
    .filter(
      (x) =>
        x &&
        typeof x === 'object' &&
        'lat' in x &&
        typeof /** @type {{ lat: unknown }} */ (x).lat === 'number',
    )
    .map((ll) => {
      const o = /** @type {{ lat: number, lng: number }} */ (ll)
      return [Number(o.lat), Number(o.lng)]
    })
}

async function frictionAppendMeasurementToList(value) {
  if (!currentUser?.id || !frictionRouteLine) return
  const pathLatLngs = frictionPolylineToPathPlain(frictionRouteLine)
  if (pathLatLngs.length < 2) {
    frictionSetStatus('Mangler rutedata for målingen.')
    return
  }
  const a = pathLatLngs[0]
  const b = pathLatLngs[pathLatLngs.length - 1]
  let startV = frictionPendingStartVegref
  let endV = frictionPendingStopVegref
  if (!startV || !endV) {
    frictionSetStatus('Henter vegreferanse for start og stopp …')
    try {
      const [sr, er] = await Promise.all([
        fetchRoadPositionDirect(a[0], a[1]).catch(() => null),
        fetchRoadPositionDirect(b[0], b[1]).catch(() => null),
      ])
      if (!startV) startV = vegrefPosisjonToFrictionSnap(sr)
      if (!endV) endV = vegrefPosisjonToFrictionSnap(er)
    } catch {
      /* nettverk / API */
    }
  }
  frictionPendingStartVegref = null
  frictionPendingStopVegref = null
  const sid = ensureFrictionSessionId()
  /** @type {Record<string, unknown>} */
  const raw = {
    id: crypto.randomUUID(),
    createdAt: nowIso(),
    distanceM: frictionDistanceM,
    value,
    pathLatLngs,
    sessionId: sid,
  }
  if (startV) raw.startVegref = startV
  if (endV) raw.endVegref = endV
  const entry = normalizeFrictionMeasurement(raw)
  if (!entry) {
    frictionSetStatus('Kunne ikke lagre målingen.')
    return
  }
  frictionMeasurements.unshift(entry)
  while (frictionMeasurements.length > MAX_FRICTION_MEASUREMENTS) {
    frictionMeasurements.pop()
  }
  saveAppState()
  frictionRefreshMeasurementsListBody()
  frictionSyncHistoryOverlayToMap()
  frictionSetStatus(
    startV || endV
      ? `Lagret med vegreferanse. Friksjonsverdi ${value}.`
      : `Lagret uten vegreferanse (nettverk eller posisjon). Friksjonsverdi ${value}.`,
  )
}

function frictionSaveSessionExplicit() {
  if (!currentUser?.id) {
    frictionSetStatus('Logg inn for å lagre.')
    return
  }
  saveAppState()
  showSessionToast('Økt lagret på enheten.', 2800)
}

function frictionStartNewFrictionSession() {
  if (frictionActiveSessionId) {
    frictionPreviousSessionId = frictionActiveSessionId
  }
  frictionActiveSessionId = crypto.randomUUID()
  saveAppState()
  frictionSetStatus('Ny økt er startet. Nye målinger tilhører denne økta.')
  frictionSyncResumeSessionButton()
}

function frictionSyncResumeSessionButton() {
  const btn = document.getElementById('friction-btn-resume-session')
  if (!btn) return
  if (frictionPreviousSessionId) {
    btn.removeAttribute('hidden')
  } else {
    btn.setAttribute('hidden', '')
  }
}

function frictionResumePreviousSession() {
  if (!frictionPreviousSessionId) {
    frictionSetStatus('Ingen lagret økt å gjenoppta.')
    return
  }
  const back = frictionPreviousSessionId
  frictionPreviousSessionId = null
  frictionActiveSessionId = back
  saveAppState()
  frictionSetStatus('Forrige økt er gjenopptatt.')
  frictionSyncResumeSessionButton()
}

async function frictionExportSessionXlsx() {
  const sid = frictionActiveSessionId
  const list = sid
    ? frictionMeasurements.filter((m) => m.sessionId === sid)
    : frictionMeasurements
  if (!list.length) {
    frictionSetStatus(
      sid
        ? 'Ingen målinger i aktiv økt. Bruk «Excel alle» i listen for eldre målinger uten økt-id.'
        : 'Ingen målinger å eksportere.',
    )
    return
  }
  try {
    await downloadFrictionMeasurementsXlsx(list)
    frictionSetStatus(
      `Excel lastet ned (${list.length} strekning${list.length === 1 ? '' : 'er'}).`,
    )
  } catch (e) {
    console.warn('frictionExportSessionXlsx', e)
    frictionSetStatus('Kunne ikke eksportere Excel.')
  }
}

async function frictionExportAllFrictionXlsx() {
  if (!frictionMeasurements.length) {
    frictionSetStatus('Ingen lagrede målinger.')
    return
  }
  try {
    await downloadFrictionMeasurementsXlsx(frictionMeasurements)
    frictionSetStatus(
      `Excel alle: ${frictionMeasurements.length} strekning${frictionMeasurements.length === 1 ? '' : 'er'}.`,
    )
  } catch (e) {
    console.warn('frictionExportAllFrictionXlsx', e)
    frictionSetStatus('Kunne ikke eksportere Excel.')
  }
}

function frictionRefreshMeasurementsListBody() {
  const root = document.getElementById('friction-list-body')
  if (!root) return
  if (!frictionMeasurements.length) {
    root.innerHTML =
      '<p class="friction-list-dialog__empty">Ingen lagrede målinger ennå. Lagre en verdi etter Start → Stopp.</p>'
    return
  }
  root.innerHTML = frictionMeasurements
    .map((m) => {
      const dt = new Intl.DateTimeFormat('nb-NO', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(m.createdAt))
      const dist = formatFrictionDistanceShort(m.distanceM)
      const val = formatFrictionValueNb(m.value)
      return `<div class="friction-list-row" role="listitem">
  <div class="friction-list-row__main">
    <span class="friction-list-row__meta">${escapeHtml(dt)}</span>
    <span class="friction-list-row__detail">${escapeHtml(dist)} · ${escapeHtml(val)}</span>
  </div>
  <div class="friction-list-row__actions">
    <button type="button" class="friction-list-row__map btn-text" data-friction-map="${escapeHtml(m.id)}">Kart</button>
    <button type="button" class="friction-list-row__del btn-text" data-friction-del="${escapeHtml(m.id)}" aria-label="Slett måling">Slett</button>
  </div>
</div>`
    })
    .join('')
}

/** @param {string | undefined} id */
function frictionDeleteMeasurementById(id) {
  if (!id) return
  frictionMeasurements = frictionMeasurements.filter((x) => x.id !== id)
  saveAppState()
  frictionRefreshMeasurementsListBody()
  frictionSyncHistoryOverlayToMap()
}

/**
 * @param {{ pathLatLngs?: number[][], startLat?: number | null, startLng?: number | null, endLat?: number | null, endLng?: number | null }} m
 * @returns {[number, number][]}
 */
function frictionLatLngsFromMeasurement(m) {
  const p = m.pathLatLngs
  if (Array.isArray(p) && p.length >= 2) {
    const out = []
    for (const pair of p) {
      if (!Array.isArray(pair) || pair.length < 2) continue
      const lat = Number(pair[0])
      const lng = Number(pair[1])
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      out.push([lat, lng])
    }
    if (out.length >= 2) return out
  }
  if (
    m.startLat != null &&
    m.startLng != null &&
    m.endLat != null &&
    m.endLng != null &&
    Number.isFinite(m.startLat) &&
    Number.isFinite(m.startLng) &&
    Number.isFinite(m.endLat) &&
    Number.isFinite(m.endLng)
  ) {
    return [
      [m.startLat, m.startLng],
      [m.endLat, m.endLng],
    ]
  }
  return []
}

function frictionSyncHistoryOverlayToMap() {
  if (!frictionMap || !frictionHistoryLayerGroup || !Leaflet) return
  frictionHistoryLayerGroup.clearLayers()
  frictionHistoryPolylines.clear()
  for (const m of frictionMeasurements) {
    const latlngs = frictionLatLngsFromMeasurement(m)
    if (latlngs.length < 2) continue
    const poly = Leaflet.polyline(latlngs, {
      color: '#334155',
      weight: 6,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    })
    poly.bindTooltip(
      `${formatFrictionValueNb(m.value)} · ${formatFrictionDistanceShort(m.distanceM)}`,
      {
        sticky: true,
        direction: 'top',
        opacity: 0.96,
        className: 'friction-history-tooltip',
      },
    )
    poly.addTo(frictionHistoryLayerGroup)
    frictionHistoryPolylines.set(m.id, poly)
  }
}

/** @param {string | undefined} id */
function frictionFocusMeasurementOnMap(id) {
  if (!id || !frictionMap) return
  frictionSyncHistoryOverlayToMap()
  const poly = frictionHistoryPolylines.get(id)
  const dlg = document.getElementById('friction-list-dialog')
  if (dlg instanceof HTMLDialogElement) dlg.close()
  const applyFit = () => {
    try {
      frictionMap?.invalidateSize({ animate: false })
      nudgeMaptilerBasemapResize(frictionMap)
    } catch {
      /* ignore */
    }
    if (poly) {
      try {
        frictionMap.fitBounds(poly.getBounds(), {
          padding: [48, 48],
          maxZoom: APP_MAP_MAX_ZOOM,
        })
      } catch {
        /* ignore */
      }
      frictionSetStatus('Viser valgt måling på kartet.')
      return
    }
    frictionSetStatus('Kunne ikke vise denne målingen på kartet (mangler rutedata).')
  }
  window.requestAnimationFrame(() => window.setTimeout(applyFit, 50))
}

function frictionFitAllMeasurementsOnMap() {
  if (!frictionMap || !frictionHistoryLayerGroup || !Leaflet) return
  frictionSyncHistoryOverlayToMap()
  const layers = frictionHistoryLayerGroup.getLayers()
  if (!layers.length) {
    frictionSetStatus('Ingen lagrede målinger å vise.')
    return
  }
  const fg = Leaflet.featureGroup(
    /** @type {import('leaflet').Layer[]} */ (layers),
  )
  const dlg = document.getElementById('friction-list-dialog')
  if (dlg instanceof HTMLDialogElement) dlg.close()
  const applyFit = () => {
    try {
      frictionMap?.invalidateSize({ animate: false })
      nudgeMaptilerBasemapResize(frictionMap)
    } catch {
      /* ignore */
    }
    try {
      frictionMap.fitBounds(fg.getBounds(), { padding: [52, 52], maxZoom: 16 })
    } catch {
      /* ignore */
    }
    frictionSetStatus('Viser alle lagrede målinger på kartet.')
  }
  window.requestAnimationFrame(() => window.setTimeout(applyFit, 50))
}

function frictionClearMapOverlays() {
  if (!frictionMap) return
  if (frictionTrackPreview) {
    frictionMap.removeLayer(frictionTrackPreview)
    frictionTrackPreview = null
  }
  if (frictionRouteLine) {
    frictionMap.removeLayer(frictionRouteLine)
    frictionRouteLine = null
  }
  if (frictionStartMarker) {
    frictionMap.removeLayer(frictionStartMarker)
    frictionStartMarker = null
  }
  if (frictionEndMarker) {
    frictionMap.removeLayer(frictionEndMarker)
    frictionEndMarker = null
  }
  if (frictionValueMarker) {
    frictionMap.removeLayer(frictionValueMarker)
    frictionValueMarker = null
  }
}

function destroyFrictionMap() {
  if (frictionWatchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(frictionWatchId)
    frictionWatchId = null
  }
  frictionMeasuring = false
  frictionPoints = []
  frictionDistanceM = 0
  frictionSegmentComplete = false
  frictionValueSaved = null
  if (frictionMap) {
    try {
      frictionMap.remove()
    } catch {
      /* ignore */
    }
    frictionMap = null
  }
  frictionTrackPreview = null
  frictionRouteLine = null
  frictionStartMarker = null
  frictionEndMarker = null
  frictionValueMarker = null
  frictionHistoryLayerGroup = null
  frictionHistoryPolylines.clear()
}

function frictionSetStatus(msg) {
  const el = document.getElementById('friction-status')
  if (el) {
    el.textContent = msg || ''
    el.hidden = !msg
  }
}

function frictionUpdateDistanceDisplay() {
  const el = document.getElementById('friction-distance-display')
  if (!el) return
  const m = frictionDistanceM
  if (m >= 1000) {
    el.textContent = `${(m / 1000).toFixed(2)} km`
  } else {
    el.textContent = `${Math.round(m)} m`
  }
}

function frictionSyncTabAria() {
  const start = document.getElementById('friction-btn-start')
  const stop = document.getElementById('friction-btn-stop')
  const val = document.getElementById('friction-btn-value')
  if (start)
    start.setAttribute(
      'aria-selected',
      frictionMeasuring ? 'true' : 'false',
    )
  if (stop)
    stop.setAttribute(
      'aria-selected',
      !frictionMeasuring && frictionSegmentComplete ? 'true' : 'false',
    )
  if (val)
    val.setAttribute(
      'aria-selected',
      frictionValueSaved != null ? 'true' : 'false',
    )
}

/**
 * Fersk GPS og sentrer friksjonskartet; oppdaterer `lastLiveCoords`.
 * @param {{ quiet?: boolean }} [opts]
 */
async function frictionRefreshGpsAndCenter(opts = {}) {
  const quiet = !!opts.quiet
  if (!window.isSecureContext || !navigator.geolocation) {
    if (!quiet) {
      frictionSetStatus(
        'Posisjon kreves (HTTPS eller localhost). Tillat plassering i nettleseren.',
      )
    }
    return
  }
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      })
    })
    const c = /** @type {GeolocationPosition} */ (pos).coords
    const lat = c.latitude
    const lng = c.longitude
    const acc = Math.max(
      typeof c.accuracy === 'number' && !Number.isNaN(c.accuracy)
        ? c.accuracy
        : 20,
      8,
    )
    lastLiveCoords = { lat, lng, accuracy: acc, ts: Date.now() }
    if (frictionMap) {
      frictionMap.setView([lat, lng], zoomForDriving(acc))
    }
    if (!quiet) frictionSetStatus('Kartet viser din posisjon.')
  } catch {
    if (!quiet) {
      frictionSetStatus(
        'Kunne ikke hente posisjon. Sjekk tillatelser og prøv igjen.',
      )
    }
  }
}

async function initFrictionMap() {
  const el = document.getElementById('friction-map')
  if (!el || frictionMap) return
  await ensureLeaflet()
  frictionMap = Leaflet.map('friction-map', {
    zoomControl: false,
    tapTolerance: 12,
    maxZoom: APP_MAP_MAX_ZOOM,
  }).setView([59.9139, 10.7522], 13)
  try {
    frictionMap.setMaxZoom(APP_MAP_MAX_ZOOM)
  } catch {
    /* ignore */
  }
  Leaflet.control.zoom({ position: 'topright' }).addTo(frictionMap)
  ;(await createAppBasemapLayer(Leaflet)).addTo(frictionMap)
  frictionHistoryLayerGroup = Leaflet.layerGroup().addTo(frictionMap)
  frictionSyncHistoryOverlayToMap()
  window.setTimeout(() => {
    try {
      frictionMap?.invalidateSize()
      nudgeMaptilerBasemapResize(frictionMap)
    } catch {
      /* ignore */
    }
    void frictionRefreshGpsAndCenter({ quiet: true })
  }, 160)
  frictionSyncTabAria()
}

/**
 * NVDB posisjon ved Start (synk med siste kjente GPS / samme kilde som forsiden bruker).
 * @param {number} gen
 */
async function frictionSnapshotVegrefForSegmentStart(gen) {
  let lat = /** @type {number | null} */ (null)
  let lng = /** @type {number | null} */ (null)
  if (
    lastLiveCoords &&
    typeof lastLiveCoords.lat === 'number' &&
    typeof lastLiveCoords.lng === 'number' &&
    typeof lastLiveCoords.ts === 'number' &&
    Date.now() - lastLiveCoords.ts < 12_000
  ) {
    lat = lastLiveCoords.lat
    lng = lastLiveCoords.lng
  }
  if ((lat == null || lng == null) && navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 2500,
          timeout: 12_000,
        })
      })
      lat = /** @type {GeolocationPosition} */ (pos).coords.latitude
      lng = /** @type {GeolocationPosition} */ (pos).coords.longitude
    } catch {
      return
    }
  }
  if (lat == null || lng == null || gen !== frictionSegmentGeneration) return
  try {
    const r = await fetchRoadPositionDirect(lat, lng)
    if (gen !== frictionSegmentGeneration) return
    frictionPendingStartVegref = vegrefPosisjonToFrictionSnap(r)
  } catch {
    if (gen !== frictionSegmentGeneration) return
    frictionPendingStartVegref = null
  }
}

function frictionBeginMeasurement() {
  if (!frictionMap || !window.isSecureContext || !navigator.geolocation) {
    frictionSetStatus(
      'Posisjon kreves (HTTPS eller localhost). Tillat plassering i nettleseren.',
    )
    return
  }
  frictionSegmentGeneration += 1
  const segGen = frictionSegmentGeneration
  frictionPendingStartVegref = null
  frictionPendingStopVegref = null
  frictionClearMapOverlays()
  frictionPoints = []
  frictionDistanceM = 0
  frictionValueSaved = null
  frictionSegmentComplete = false
  frictionMeasuring = true
  frictionUpdateDistanceDisplay()
  frictionSetStatus('Måler … gå eller kjør strekningen, trykk Stopp når du er ferdig.')
  frictionSyncTabAria()
  void frictionSnapshotVegrefForSegmentStart(segGen)

  if (frictionWatchId != null) {
    navigator.geolocation.clearWatch(frictionWatchId)
    frictionWatchId = null
  }

  frictionWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (!frictionMeasuring || !frictionMap) return
      const { latitude, longitude, accuracy } = pos.coords
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        accuracy > 65
      ) {
        return
      }
      const p = { lat: latitude, lng: longitude }
      if (frictionPoints.length > 0) {
        const prev = frictionPoints[frictionPoints.length - 1]
        frictionDistanceM += haversineM(prev.lat, prev.lng, p.lat, p.lng)
      }
      frictionPoints.push(p)
      const ll = [p.lat, p.lng]
      if (frictionTrackPreview) {
        frictionTrackPreview.setLatLngs(
          frictionPoints.map((x) => [x.lat, x.lng]),
        )
      } else {
        frictionTrackPreview = Leaflet.polyline(
          frictionPoints.map((x) => [x.lat, x.lng]),
          {
            color: 'rgba(96, 165, 250, 0.65)',
            weight: 4,
            lineCap: 'round',
            lineJoin: 'round',
          },
        ).addTo(frictionMap)
      }
      frictionUpdateDistanceDisplay()
      frictionMap.panTo(ll, { animate: true, duration: 0.25 })
    },
    () => {
      frictionSetStatus('Kunne ikke lese posisjon. Sjekk tillatelser og GPS.')
    },
    {
      enableHighAccuracy: true,
      maximumAge: 400,
      timeout: 20000,
    },
  )
}

async function frictionFinishMeasurement() {
  if (!frictionMeasuring) {
    frictionSetStatus('Trykk Start for å begynne måling.')
    return
  }
  frictionMeasuring = false
  if (frictionWatchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(frictionWatchId)
    frictionWatchId = null
  }

  if (frictionPoints.length < 2) {
    frictionPendingStartVegref = null
    frictionPendingStopVegref = null
    frictionClearMapOverlays()
    frictionPoints = []
    frictionDistanceM = 0
    frictionUpdateDistanceDisplay()
    frictionSetStatus('For få GPS-punkter. Prøv igjen og gå litt lenger.')
    frictionSegmentComplete = false
    frictionSyncTabAria()
    return
  }

  if (frictionTrackPreview && frictionMap) {
    frictionMap.removeLayer(frictionTrackPreview)
    frictionTrackPreview = null
  }

  const start = frictionPoints[0]
  const end = frictionPoints[frictionPoints.length - 1]
  const segGen = frictionSegmentGeneration
  frictionSetStatus('Henter vegreferanse ved stopp …')
  try {
    const rStop = await fetchRoadPositionDirect(end.lat, end.lng)
    if (segGen === frictionSegmentGeneration) {
      frictionPendingStopVegref = vegrefPosisjonToFrictionSnap(rStop)
    }
  } catch {
    if (segGen === frictionSegmentGeneration) frictionPendingStopVegref = null
  }

  const route = await fetchOsrmDrivingRoute(
    start.lat,
    start.lng,
    end.lat,
    end.lng,
  )

  if (route && frictionMap) {
    frictionDistanceM = route.distanceM
    frictionUpdateDistanceDisplay()
    frictionRouteLine = Leaflet.polyline(route.latlngs, {
      color: '#0a0a0a',
      weight: 8,
      lineCap: 'round',
      lineJoin: 'round',
      opacity: 0.95,
    }).addTo(frictionMap)
    frictionMap.fitBounds(frictionRouteLine.getBounds(), {
      padding: [36, 36],
      maxZoom: APP_MAP_MAX_ZOOM,
    })
  } else if (frictionMap) {
    const fallback = frictionPoints.map((x) => [x.lat, x.lng])
    frictionRouteLine = Leaflet.polyline(fallback, {
      color: '#0a0a0a',
      weight: 8,
      lineCap: 'round',
      lineJoin: 'round',
      opacity: 0.95,
    }).addTo(frictionMap)
    frictionMap.fitBounds(frictionRouteLine.getBounds(), {
      padding: [36, 36],
      maxZoom: APP_MAP_MAX_ZOOM,
    })
    frictionSetStatus(
      'Kunne ikke hente veirute – viser rett linje mellom punktene.',
    )
  }

  frictionStartMarker = Leaflet.circleMarker([start.lat, start.lng], {
    radius: 9,
    color: '#0a0a0a',
    fillColor: '#22c55e',
    fillOpacity: 1,
    weight: 2,
  }).addTo(/** @type {import('leaflet').Map} */ (frictionMap))
  frictionEndMarker = Leaflet.circleMarker([end.lat, end.lng], {
    radius: 9,
    color: '#0a0a0a',
    fillColor: '#ef4444',
    fillOpacity: 1,
    weight: 2,
  }).addTo(/** @type {import('leaflet').Map} */ (frictionMap))

  frictionSegmentComplete = true
  if (route) {
    frictionSetStatus('Strekning lagret. Trykk Verdi for å legge inn friksjonstall.')
  }
  frictionSyncTabAria()
}

function frictionOpenValuePanel() {
  if (!frictionSegmentComplete || !frictionMap) {
    frictionSetStatus('Fullfør først en strekning (Start → Stopp).')
    return
  }
  const dlg = document.getElementById('friction-value-dialog')
  const inp = document.getElementById('friction-value-input')
  if (!(dlg instanceof HTMLDialogElement) || !inp) return
  inp.value =
    frictionValueSaved != null && Number.isFinite(frictionValueSaved)
      ? String(frictionValueSaved)
      : ''
  dlg.showModal()
  window.setTimeout(() => inp.focus(), 80)
}

function frictionSaveValueFromDialog() {
  const inp = document.getElementById('friction-value-input')
  const dlg = document.getElementById('friction-value-dialog')
  if (!inp) return
  const raw = String(inp.value ?? '').replace(',', '.').trim()
  const n = parseFloat(raw)
  if (raw === '' || Number.isNaN(n)) {
    frictionSetStatus('Skriv inn et tall for friksjonsverdien.')
    return
  }
  frictionValueSaved = n
  if (dlg instanceof HTMLDialogElement) dlg.close()

  if (frictionValueMarker && frictionMap) {
    frictionMap.removeLayer(frictionValueMarker)
    frictionValueMarker = null
  }
  if (!frictionRouteLine || !frictionMap) return
  const b = frictionRouteLine.getBounds()
  const c = b.getCenter()
  const icon = Leaflet.divIcon({
    className: 'friction-value-marker',
    html: `<div class="friction-value-marker__inner">${escapeHtml(String(n))}</div>`,
    iconSize: [88, 44],
    iconAnchor: [44, 44],
  })
  frictionValueMarker = Leaflet.marker(c, { icon }).addTo(frictionMap)
  void frictionAppendMeasurementToList(n).finally(() => {
    frictionSyncTabAria()
  })
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

  const intro = `<p class="scanix-static-hint">Koordinater og lenker for hvert trykk under. I <a href="#map">kartet nederst</a>: røde nåler = registrering, blå B = bilde med GPS (når JavaScript er på — i Filer: åpne i Safari).</p>`

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
      const pinTitle =
        typeof p.label === 'string' && p.label.trim()
          ? escapeHtmlForExport(p.label.trim())
          : String(i + 1)
      const com =
        typeof p.comment === 'string' && p.comment.trim()
          ? `<br><span class="scanix-static-click-comment">${escapeHtmlForExport(p.comment.trim())}</span>`
          : ''
      return (
        `<li><strong>${pinTitle}</strong>${cat}` +
        (t
          ? ` · <time datetime="${tsAttr}">${t}</time>`
          : '') +
        com +
        `<br><span>${lat.toFixed(6)}, ${lng.toFixed(6)}</span> · ` +
        `<a href="${escapeHtmlForExport(pinUrl)}" target="_blank" rel="noopener noreferrer">Google Maps med rød nål</a></li>`
      )
    })
    .join('')

  const routeExpl =
    valid.length > 1
      ? ` I rutevisning bruker Google bokstaver <strong>A, B, C …</strong> på stoppene: <strong>A = punkt 1</strong>, <strong>B = punkt 2</strong>, og så videre i samme rekkefølge som her (fortsetter på neste lenke om det er flere). Da er det <em>ikke</em> røde nåler, men bokstavmerker.`
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
      const src =
        typeof ph.dataUrl === 'string' && ph.dataUrl.startsWith('data:image/')
          ? ph.dataUrl
          : typeof ph.thumbDataUrl === 'string' &&
              ph.thumbDataUrl.startsWith('data:image/')
            ? ph.thumbDataUrl
            : ''
      if (!src) {
        return `<figure class="scanix-export-photo"><figcaption>Bilde #${i + 1} · ${t} · ${pos}</figcaption><p class="scanix-static-note scanix-static-note--last">Bilde uten innebygd pikseldata i denne fila.</p></figure>`
      }
      return `<figure class="scanix-export-photo"><figcaption>Bilde #${i + 1} · ${t} · ${pos}</figcaption><img src="${src}" alt="Bilde ${i + 1}" /></figure>`
    })
    .join('')
}

/**
 * Henter piksel som data-URL for HTML-eksport (én fil, offline).
 * Rekkefølge: `dataUrl` i minne → IndexedDB → `thumbDataUrl` i minne → Supabase Storage (signert URL: tommel, deretter full).
 * På iPhone er bilder ofte bare `storageFullPath` etter opplasting — da hentes de her ved eksport (krever nett + tilgang til sky: Supabase eller Scanix Cloud API).
 * @param {Record<string, unknown>} ph
 */
async function fetchPhotoDataUrlForHtmlExport(ph) {
  if (!ph || typeof ph !== 'object') return ''
  let dataUrl =
    typeof ph.dataUrl === 'string' && ph.dataUrl.startsWith('data:image/')
      ? ph.dataUrl
      : ''
  if (dataUrl) return dataUrl

  const id = typeof ph.id === 'string' ? ph.id : null
  if (id && (await isPhotoBlobStoreAvailable())) {
    try {
      const fromIdb = await getPhotoDataUrl(id)
      if (
        typeof fromIdb === 'string' &&
        fromIdb.startsWith('data:image/')
      ) {
        return fromIdb
      }
    } catch {
      /* ignore */
    }
  }

  const thumbMem =
    typeof ph.thumbDataUrl === 'string' &&
    ph.thumbDataUrl.startsWith('data:image/')
      ? ph.thumbDataUrl
      : ''
  if (thumbMem) return thumbMem

  if (!isSupabaseConfigured() && !isScanixCloudApiConfigured()) return ''
  const sb = getSupabase()

  /**
   * @param {string} pth
   */
  const tryStoragePath = async (pth) => {
    const t = typeof pth === 'string' ? pth.trim() : ''
    if (!t) return ''
    try {
      let signedUrl = ''
      if (isScanixCloudApiConfigured()) {
        signedUrl = await cloudGetSignedReadUrlForPhotoPath(t, 7200)
      } else if (sb) {
        const { data, error } = await sb.storage
          .from(PHOTO_STORAGE_BUCKET)
          .createSignedUrl(t, 7200)
        if (error || !data?.signedUrl) return ''
        signedUrl = data.signedUrl
      }
      if (!signedUrl) return ''
      const res = await fetch(signedUrl)
      if (!res.ok) return ''
      const blob = await res.blob()
      if (!blob || blob.size < 8) return ''
      return await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result || ''))
        r.onerror = () => reject(new Error('read'))
        r.readAsDataURL(blob)
      }).catch(() => '')
    } catch {
      return ''
    }
  }

  const storageThumbPath =
    typeof ph.storageThumbPath === 'string' ? ph.storageThumbPath : ''
  const storageFullPath =
    typeof ph.storageFullPath === 'string' ? ph.storageFullPath : ''

  let fromStorage = await tryStoragePath(storageThumbPath)
  if (typeof fromStorage === 'string' && fromStorage.startsWith('data:image/'))
    return fromStorage
  fromStorage = await tryStoragePath(storageFullPath)
  if (typeof fromStorage === 'string' && fromStorage.startsWith('data:image/'))
    return fromStorage
  return ''
}

/**
 * Klargjør bilder for HTML-eksport: IDB + Supabase Storage → innebygde data-URL-er.
 */
async function resolvePhotosForHtmlExport(photosIn) {
  const hydrated = await hydratePhotoRecordsArray(
    Array.isArray(photosIn) ? photosIn : [],
  )
  const out = []
  for (const ph of hydrated) {
    if (!ph || typeof ph !== 'object') continue
    const pixel = await fetchPhotoDataUrlForHtmlExport(
      /** @type {Record<string, unknown>} */ (ph),
    )
    const merged = pixel ? { ...ph, dataUrl: pixel } : ph
    const normalized = normalizePhoto(
      /** @type {Parameters<typeof normalizePhoto>[0]} */ (merged),
    )
    if (normalized) {
      out.push(normalized)
      continue
    }
    const dataUrl =
      typeof merged.dataUrl === 'string' &&
      merged.dataUrl.startsWith('data:image/')
        ? merged.dataUrl
        : ''
    const thumb =
      typeof merged.thumbDataUrl === 'string' &&
      merged.thumbDataUrl.startsWith('data:image/')
        ? merged.thumbDataUrl
        : ''
    const display = dataUrl || thumb
    if (!display) continue
    const rawLat =
      /** @type {{ lat?: unknown, latitude?: unknown }} */ (merged).lat !=
      null
        ? /** @type {{ lat?: unknown }} */ (merged).lat
        : /** @type {{ latitude?: unknown }} */ (merged).latitude
    const rawLng =
      /** @type {{ lng?: unknown, longitude?: unknown }} */ (merged).lng !=
      null
        ? /** @type {{ lng?: unknown }} */ (merged).lng
        : /** @type {{ longitude?: unknown }} */ (merged).longitude
    const lat =
      rawLat != null && !Number.isNaN(Number(rawLat)) ? Number(rawLat) : null
    const lng =
      rawLng != null && !Number.isNaN(Number(rawLng)) ? Number(rawLng) : null
    const pid =
      typeof /** @type {{ id?: unknown }} */ (merged).id === 'string'
        ? /** @type {{ id: string }} */ (merged).id
        : crypto.randomUUID()
    const ts =
      typeof /** @type {{ timestamp?: unknown }} */ (merged).timestamp ===
      'string'
        ? /** @type {{ timestamp: string }} */ (merged).timestamp
        : nowIso()
    const noteRaw = /** @type {{ note?: unknown }} */ (merged).note
    const note =
      typeof noteRaw === 'string' && noteRaw.trim()
        ? noteRaw.trim().slice(0, 800)
        : undefined
    if (dataUrl) {
      out.push({
        id: pid,
        timestamp: ts,
        lat,
        lng,
        dataUrl,
        ...(thumb && thumb !== dataUrl ? { thumbDataUrl: thumb } : {}),
        ...(note ? { note } : {}),
      })
    } else {
      out.push({
        id: pid,
        timestamp: ts,
        lat,
        lng,
        dataUrl: display,
        ...(note ? { note } : {}),
      })
    }
  }
  return out
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
  const photos = await resolvePhotosForHtmlExport(photosIn)
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
  const exportBasemap = getRasterBasemapTileSpec()
  const exportBasemapTileOpts = {
    attribution: exportBasemap.attribution,
    maxZoom: APP_MAP_MAX_ZOOM,
    detectRetina: false,
    updateWhenIdle: true,
    updateWhenZooming: false,
    ...(exportBasemap.subdomains
      ? { subdomains: exportBasemap.subdomains }
      : {}),
    ...(exportBasemap.crossOrigin ? { crossOrigin: true } : {}),
  }
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
    .scanix-static-click-comment { display: block; margin: 0.25rem 0 0; font-size: 0.82rem; color: #a8b0c4; white-space: pre-wrap; }
    .panel-photos { border-bottom: 1px solid #2a3142; }
    .scanix-export-photo { margin: 0.75rem 0; }
    .scanix-export-photo img { max-width: 100%; height: auto; border-radius: 6px; border: 1px solid #2a3142; }
    h2 { font-size: 0.98rem; margin: 0 0 0.35rem; color: #93c5fd; font-weight: 600; }
    .log-list { list-style: none; margin: 0; padding: 0; font-size: 0.86rem; }
    .log-list li { padding: 0.55rem 0; border-bottom: 1px solid #2a3142; }
    .log-list time { display: block; color: #60a5fa; font-size: 0.8rem; margin-bottom: 0.25rem; }
    .leaflet-container { background: #b8bcc6; }
    .leaflet-tile-container img.leaflet-tile {
      image-rendering: auto;
      filter: ${APP_MAP_TILE_IMG_FILTER};
    }
    .scanix-pin-wrap { background: transparent !important; border: none !important; }
  </style>
</head>
<body>
  <header>
    <h1>Scanix – eksportert logg</h1>
    <p class="meta">Generert ${generatedAt} · Røde nåler: registrerte trykk med GPS. Blå ruter: bilder med posisjon (når JavaScript er på).${roadMeta}${objMeta}${photoMeta}${titleLine}${registeredNoteLine}</p>
    <p class="meta" style="font-size:0.78rem;color:#94a3b8;margin-top:0.4rem;line-height:1.45">Bilder er innebygd i fila som data-URL der eksporten fant piksel (telefonminne, IndexedDB eller sky ved eksport). I Safari/Chrome på Mac: <strong>ctrl-klikk / høyreklikk</strong> på et bilde under → «Lagre bilde som …» for å laste det ned enkeltvis.</p>
  </header>
  <div class="panel panel-static">
    <h2>Registrerte punkt</h2>
    ${staticPointsHtml}
  </div>
  <div class="panel panel-log">
    <h2>Tekstlogg</h2>
    <ul class="log-list" id="log-lines"></ul>
  </div>
  <div class="panel panel-static panel-photos">
    <h2>Bilder</h2>
    ${staticPhotosHtml}
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
  var photos = data.photos || []
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

    var map = ${'L'}.map('map', { zoomControl: true, maxZoom: ${APP_MAP_MAX_ZOOM} })

    var __scanixBaseOpts = ${JSON.stringify(exportBasemapTileOpts)}
    var basePrimaryLayer = ${'L'}.tileLayer(
      ${JSON.stringify(exportBasemap.url)},
      __scanixBaseOpts,
    )

    var osmFallbackLayer = ${'L'}.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: ${APP_MAP_MAX_ZOOM},
      },
    )

    function onFirstTile() {
      hideFileHint()
      basePrimaryLayer.off('tileload', onFirstTile)
      osmFallbackLayer.off('tileload', onFirstTile)
    }

    basePrimaryLayer.on('tileload', onFirstTile)
    osmFallbackLayer.on('tileload', onFirstTile)

    basePrimaryLayer.once('tileerror', function () {
      if (map.hasLayer(basePrimaryLayer)) {
        map.removeLayer(basePrimaryLayer)
        osmFallbackLayer.addTo(map)
      }
    })

    basePrimaryLayer.addTo(map)

    var valid = points.filter(function (p) {
      return (
        p.lat != null &&
        p.lng != null &&
        !Number.isNaN(Number(p.lat)) &&
        !Number.isNaN(Number(p.lng))
      )
    })

    var photoPts = photos.filter(function (ph) {
      return (
        ph.lat != null &&
        ph.lng != null &&
        !Number.isNaN(Number(ph.lat)) &&
        !Number.isNaN(Number(ph.lng))
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
      '<div style="display:flex;align-items:flex-end;justify-content:center;box-sizing:border-box;width:26px;height:32px">' +
      '<div style="width:22px;height:22px;flex-shrink:0;margin:0;background:linear-gradient(145deg,#ef4444,#b91c1c);border-radius:50% 50% 50% 0;transform:rotate(-45deg);transform-origin:50% 100%;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div></div>'
    var pinIcon = ${'L'}.divIcon({
      className: 'scanix-pin-wrap',
      html: pinHtml,
      iconSize: [26, 32],
      iconAnchor: [13, 32],
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
        .bindPopup('<strong>' + (i + 1) + '</strong><br>' + catLine + escPopup(t))
    })

    var photoPinHtml =
      '<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;background:linear-gradient(145deg,#2563eb,#1d4ed8);border-radius:7px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"><span style="font-size:11px;font-weight:700;color:#fff;font-family:system-ui,sans-serif">B</span></div>'
    var photoPinIcon = ${'L'}.divIcon({
      className: 'scanix-pin-wrap',
      html: photoPinHtml,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    })

    photoPts.forEach(function (ph, i) {
      var latlng = [Number(ph.lat), Number(ph.lng)]
      bounds.push(latlng)
      var src =
        typeof ph.dataUrl === 'string' && ph.dataUrl.indexOf('data:image/') === 0
          ? ph.dataUrl
          : typeof ph.thumbDataUrl === 'string' &&
              ph.thumbDataUrl.indexOf('data:image/') === 0
            ? ph.thumbDataUrl
            : ''
      var t = ph.timestamp
        ? new Date(ph.timestamp).toLocaleString('nb-NO')
        : ''
      var note = ph.note ? escPopup(String(ph.note)) : ''
      var imgHtml = src
        ? '<img src="' +
          src +
          '" alt="" style="max-width:220px;height:auto;border-radius:6px;display:block;margin-top:0.35rem"/>'
        : '<p style="margin:0.35rem 0 0;font-size:0.85rem;color:#94a3b8">Ingen bilde i denne eksporten.</p>'
      ${'L'}.marker(latlng, { icon: photoPinIcon })
        .addTo(map)
        .bindPopup(
          '<strong>Bilde ' +
            (i + 1) +
            '</strong><br>' +
            escPopup(t) +
            (note ? '<br>' + note : '') +
            '<br>' +
            imgHtml,
        )
    })

    if (bounds.length === 0) {
      map.setView([59.9139, 10.7522], 13)
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15)
    } else {
      map.fitBounds(${'L'}.latLngBounds(bounds), { padding: [48, 48], maxZoom: ${APP_MAP_MAX_ZOOM} })
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
  needsAppStateDiskMerge = true
  void (async () => {
    try {
      const jsonStr = await decompressAppStateJsonFromLocalStorage(ev.newValue)
      const p = JSON.parse(jsonStr)
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
      if (Array.isArray(p.frictionMeasurements)) {
        frictionMeasurements = mergeFrictionMeasurementLists(
          frictionMeasurements,
          normalizeFrictionMeasurementsList(p.frictionMeasurements),
        )
      }
      if (view === 'menuFriction' && frictionMap) {
        frictionSyncHistoryOverlayToMap()
        frictionRefreshMeasurementsListBody()
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
          rebuildMarkers('remote_state_refresh')
          renderCount()
          renderLog()
        }
      }
    } catch {
      /* ignore */
    }
  })()
})
