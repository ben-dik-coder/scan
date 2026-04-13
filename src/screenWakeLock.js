/**
 * Holder skjermen våken mens appen er synlig (samme idé som video / YouTube).
 * Bruker Screen Wake Lock API der det støttes (Chrome, Safari 16.4+, Edge).
 */

/** @type {{ release: () => void, addEventListener: (type: string, fn: () => void) => void } | null} */
let screenLock = null

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

/**
 * Aktiverer våkenlås når dokumentet er synlig. Prøver på nytt ved første trykk
 * (noen mobilnettlesere krever brukerinteraksjon før første lås).
 */
export function initScreenWakeLock() {
  if (typeof document === 'undefined') return

  void tryAcquireScreenWakeLock()

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') {
        releaseScreenWakeLock()
      } else {
        void tryAcquireScreenWakeLock()
      }
    },
    { passive: true },
  )

  window.addEventListener(
    'pageshow',
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
