/**
 * Holder skjermen våken mens appen er synlig (samme idé som video / YouTube).
 * - **Native (Capacitor):** iOS/Android styrer dette i AppDelegate / MainActivity (pålitelig).
 * - **Nettleser / PWA:** Screen Wake Lock API der det støttes (Chrome, Safari 16.4+, Edge),
 *   med periodisk ny forsøk (lås kan slippe ved batterisparing / fullskjerm).
 */

/** @type {{ release: () => void, addEventListener: (type: string, fn: () => void) => void } | null} */
let screenLock = null

/** @type {ReturnType<typeof setInterval> | null} */
let wakeLockRetryInterval = null

const WAKE_LOCK_RETRY_MS = 45_000

async function tryAcquireScreenWakeLock() {
  if (typeof navigator === 'undefined') return
  const wl = navigator.wakeLock
  if (!wl?.request) return
  if (document.visibilityState !== 'visible') return
  if (screenLock) return
  try {
    screenLock = await wl.request('screen')
    screenLock.addEventListener('release', () => {
      screenLock = null
      if (document.visibilityState === 'visible') {
        void tryAcquireScreenWakeLock()
      }
    })
  } catch {
    /* Manglende støtte, avslått tillatelse, eller krever brukerinteraksjon */
  }
}

function releaseScreenWakeLock() {
  try {
    screenLock?.release()
  } catch {
    /* ignore */
  }
  screenLock = null
}

function startWakeLockRetryLoop() {
  if (wakeLockRetryInterval != null) return
  wakeLockRetryInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      void tryAcquireScreenWakeLock()
    }
  }, WAKE_LOCK_RETRY_MS)
}

function stopWakeLockRetryLoop() {
  if (wakeLockRetryInterval != null) {
    clearInterval(wakeLockRetryInterval)
    wakeLockRetryInterval = null
  }
}

/**
 * Aktiverer våkenlås når dokumentet er synlig. Prøver på nytt ved første trykk
 * (noen mobilnettlesere krever brukerinteraksjon før første lås).
 */
export function initScreenWakeLock() {
  if (typeof document === 'undefined') return

  void tryAcquireScreenWakeLock()
  startWakeLockRetryLoop()

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') {
        releaseScreenWakeLock()
        stopWakeLockRetryLoop()
      } else {
        void tryAcquireScreenWakeLock()
        startWakeLockRetryLoop()
      }
    },
    { passive: true },
  )

  window.addEventListener(
    'pageshow',
    () => {
      if (document.visibilityState === 'visible') {
        void tryAcquireScreenWakeLock()
        startWakeLockRetryLoop()
      }
    },
    { passive: true },
  )

  window.addEventListener(
    'focus',
    () => {
      if (document.visibilityState === 'visible') {
        void tryAcquireScreenWakeLock()
      }
    },
    { passive: true },
  )

  const onFirstPointer = () => {
    void tryAcquireScreenWakeLock()
    document.removeEventListener('pointerdown', onFirstPointer, true)
  }
  document.addEventListener('pointerdown', onFirstPointer, {
    capture: true,
    passive: true,
  })
}
