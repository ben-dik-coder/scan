import { createClient } from '@supabase/supabase-js'
import { processLock } from '@supabase/auth-js'
import { Capacitor } from '@capacitor/core'

const url =
  typeof import.meta.env.VITE_SUPABASE_URL === 'string'
    ? import.meta.env.VITE_SUPABASE_URL.trim()
    : ''
const anonKey =
  typeof import.meta.env.VITE_SUPABASE_ANON_KEY === 'string'
    ? import.meta.env.VITE_SUPABASE_ANON_KEY.trim()
    : ''

/** @type {ReturnType<typeof createClient> | null} */
let client = null

export function isSupabaseConfigured() {
  return (
    typeof url === 'string' &&
    url.length > 0 &&
    typeof anonKey === 'string' &&
    anonKey.length > 0
  )
}

/**
 * På Capacitor-WebView (iOS/Android) bruker vi `processLock` i stedet for
 * standard Navigator Lock API. Standardlåsen har vist seg å gi opphav til
 * «Lock was not released / Lock was stolen»-advarsler når auth-fetchen
 * henger på dødt nett, fordi WebKit-implementasjonen ikke frigjør låsen
 * selv etter timeout.
 *
 * I tillegg slår vi av `detectSessionInUrl` på native — URL-en i WebView
 * settes av Capacitor-runneren, ikke en OAuth-omdirigering.
 */
function isNativeRuntime() {
  try {
    return (
      typeof Capacitor !== 'undefined' &&
      typeof Capacitor.isNativePlatform === 'function' &&
      Capacitor.isNativePlatform()
    )
  } catch {
    return false
  }
}

/**
 * Egen `fetch` som avbryter selve nettverkskallet etter `timeoutMs`. Uten
 * dette henger `sb.auth.getSession()` (og andre auth-kall) i bakgrunnen på
 * iOS når nettet er nede, og auth-låsen slippes aldri — selv om vår ytre
 * Promise.race gir opp. Her kansellerer vi faktisk requesten via
 * `AbortController`, slik at Supabase-klienten rydder låsen korrekt og vi
 * får en vanlig fetch-feil i stedet for permanent «lock acquisition timed
 * out».
 *
 * Respekterer en eventuell `AbortSignal` fra kalleren (f.eks. fra Supabase
 * sin egen interne retry-logikk).
 *
 * @param {number} [timeoutMs]
 * @returns {typeof fetch}
 */
function createTimeoutFetch(timeoutMs = 6000) {
  return (input, init) => {
    const opts = /** @type {RequestInit} */ (init || {})
    const ctrl = new AbortController()
    const userSignal = opts.signal
    const onUserAbort = () => {
      try {
        ctrl.abort(/** @type {any} */ (userSignal)?.reason)
      } catch {
        ctrl.abort()
      }
    }
    if (userSignal) {
      if (userSignal.aborted) onUserAbort()
      else userSignal.addEventListener('abort', onUserAbort, { once: true })
    }
    const timer = setTimeout(() => {
      try {
        ctrl.abort(new DOMException('Request timed out', 'TimeoutError'))
      } catch {
        ctrl.abort()
      }
    }, timeoutMs)
    return fetch(input, { ...opts, signal: ctrl.signal }).finally(() => {
      clearTimeout(timer)
      if (userSignal) {
        try {
          userSignal.removeEventListener('abort', onUserAbort)
        } catch {
          /* noop */
        }
      }
    })
  }
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    const native = isNativeRuntime()
    /* Lang nok til `user_app_state` (store JSON-payloads) og RPC ved tregt nett.
       For korte timeouts avbryter PostgREST med AbortError før data er nede —
       da feiler hydrate og innboks selv på Wi‑Fi. */
    const fetchTimeoutMs = native ? 90_000 : 80_000
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: !native,
        ...(native ? { lock: processLock } : {}),
      },
      global: {
        fetch: createTimeoutFetch(fetchTimeoutMs),
      },
    })
    /* `@supabase/supabase-js` 2.100.x videresender IKKE `auth.lockAcquireTimeout`
       til GoTrueClient (ref. _initSupabaseAuthClient som destrukturerer
       kjente felter og dropper resten). Resultatet er at alle auth-kall
       bruker default 5 s ventetid på låsen, og ved flakete nett får vi
       kaskader av «Lock acquisition timed out after 5000ms» i konsollen.
       Vi setter derfor feltet direkte på instansen etter opprettelse.
       Feltet leses ved hvert _acquireLock-kall, så dette fungerer. */
    try {
      /** @type {any} */ (client.auth).lockAcquireTimeout = 15000
    } catch {
      /* noop */
    }
    installSupabaseConsoleNoiseFilter()
  }
  return client
}

/** @type {boolean} */
let supabaseConsoleNoiseFilterInstalled = false

/**
 * Nettleser og Capacitor: Supabase / fetch kan logge forventede avbrudd
 * (timeout, ny navigering, overlappende kall) som røde feil uten at noe er
 * «ødelagt». Vi demper bare kjente mønstre; alt annet går til konsollen.
 *
 * Tidligere kun native (Xcode); samme støy vises i Safari/Chrome ved treg
 * linje eller avbrutte Supabase-kall.
 *
 * Typiske meldinger når nettet er flakete eller borte — både ved app-oppstart og
 * ved auto-refresh. Loggen fylles med:
 *
 *   - `@supabase/gotrue-js: Lock "..." acquisition timed out after ...ms`
 *     (fordi initialize()/refresh kjører intern retry-loop i opptil 30 s
 *     mens den holder låsen; Supabase-js 2.100.x videresender ikke
 *     skipAutoInitialize heller, så vi kan ikke unngå retry-løkken uten
 *     å bytte versjon)
 *   - `console.error(error)` hvor `error` er et AbortError-objekt som
 *     serialiseres som `{}` i Capacitor-konsollen
 *   - `AuthRetryableFetchError` med `status: 0` (vår egen fetch-timeout)
 *   - `Auto refresh tick failed with error. This is likely a transient
 *     error.` — Supabase sier eksplisitt at det er forbigående
 *
 * Alle disse er forventet ved dødt nett og håndteres allerede av fallback
 * til lokal sesjon. Vi suppresser dem her så utviklerkonsollen holder seg lesbar.
 */
function installSupabaseConsoleNoiseFilter() {
  if (supabaseConsoleNoiseFilterInstalled) return
  supabaseConsoleNoiseFilterInstalled = true
  const origWarn = console.warn.bind(console)
  const origError = console.error.bind(console)

  /** @param {unknown[]} args */
  const isSupabaseLockWarn = (args) => {
    const first = args[0]
    return (
      typeof first === 'string' &&
      first.includes('@supabase/gotrue-js: Lock') &&
      first.includes('acquisition timed out')
    )
  }

  /** @param {unknown[]} args */
  const isSupabaseAutoRefreshTickError = (args) => {
    const first = args[0]
    return (
      typeof first === 'string' &&
      first.startsWith('Auto refresh tick failed with error')
    )
  }

  /** @param {unknown} e */
  const isAuthRetryableFetchError = (e) => {
    if (!e || typeof e !== 'object') return false
    const obj = /** @type {Record<string, unknown>} */ (e)
    return (
      obj.__isAuthError === true &&
      (obj.name === 'AuthRetryableFetchError' || obj.status === 0)
    )
  }

  /** @param {unknown} e */
  const isAbortError = (e) => {
    if (!e || typeof e !== 'object') return false
    const obj = /** @type {Record<string, unknown>} */ (e)
    const name = obj.name
    return name === 'AbortError' || name === 'TimeoutError'
  }

  /** @param {unknown[]} args */
  const isBenignFetchAbortMessage = (args) => {
    for (const a of args) {
      if (typeof a === 'string') {
        if (/Fetch is aborted|The operation was aborted/i.test(a)) return true
        continue
      }
      if (a instanceof DOMException) {
        if (a.name === 'AbortError' || a.name === 'TimeoutError') return true
        if (/Fetch is aborted|The operation was aborted/i.test(a.message || '')) {
          return true
        }
        continue
      }
      if (a && typeof a === 'object' && 'message' in a) {
        const n = /** @type {{ name?: unknown }} */ (a).name
        if (n === 'AbortError' || n === 'TimeoutError') return true
        const m = String(/** @type {{ message?: unknown }} */ (a).message)
        if (/Fetch is aborted|The operation was aborted/i.test(m)) return true
      }
    }
    return false
  }

  /** @param {unknown[]} args */
  const isEmptySupabaseError = (args) => {
    if (args.length !== 1) return false
    const a = args[0]
    if (!a || typeof a !== 'object') return false
    if (isAuthRetryableFetchError(a)) return true
    if (isAbortError(a)) return true
    /* Tomme objekter fra Supabase sin `console.error(error)` når error har
       ingen enumerable properties. Lar vi slippe gjennom bare hvis objektet
       har et identifiserbart innhold utenfor disse mønstrene. */
    try {
      const keys = Object.keys(a)
      if (keys.length === 0) return true
    } catch {
      /* noop */
    }
    return false
  }

  console.warn = (...args) => {
    if (isSupabaseLockWarn(args)) return
    origWarn(...args)
  }
  console.error = (...args) => {
    if (isSupabaseAutoRefreshTickError(args)) return
    if (isBenignFetchAbortMessage(args)) return
    if (isEmptySupabaseError(args)) return
    origError(...args)
  }
}
