/**
 * Capacitor Network / mobilnett — nettleser: enkle fallbacks.
 */

/** @type {{ connected: boolean, connectionType?: string } | null} */
let cachedNativeNetworkStatus = null

/** @returns {boolean} */
export function isCapacitorNativePlatform() {
  try {
    const C = typeof window !== 'undefined' ? window.Capacitor : null
    if (!C) return false
    const p = typeof C.getPlatform === 'function' ? C.getPlatform() : ''
    return typeof p === 'string' && p !== 'web'
  } catch {
    return false
  }
}

/**
 * Oppdaterer cache fra @capacitor/network når tilgjengelig.
 * @returns {Promise<void>}
 */
export async function refreshNativeNetworkStatus() {
  if (!isCapacitorNativePlatform()) {
    cachedNativeNetworkStatus = null
    return
  }
  try {
    const { Network } = await import('@capacitor/network')
    const s = await Network.getStatus()
    cachedNativeNetworkStatus = {
      connected: Boolean(s.connected),
      connectionType:
        typeof s.connectionType === 'string' ? s.connectionType : '',
    }
  } catch {
    cachedNativeNetworkStatus = {
      connected: typeof navigator !== 'undefined'
        ? navigator.onLine !== false
        : true,
      connectionType: 'unknown',
    }
  }
}

/** @returns {{ connected: boolean, connectionType?: string } | null} */
export function getCachedNativeNetworkStatus() {
  return cachedNativeNetworkStatus
}

export function initNativeNetworkStatusListener() {
  if (!isCapacitorNativePlatform()) return
  void refreshNativeNetworkStatus()
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => {
    void refreshNativeNetworkStatus()
  })
  window.addEventListener('offline', () => {
    void refreshNativeNetworkStatus()
  })
}

/**
 * @param {() => void} fn
 */
export function onNativeWifiOrEthernet(fn) {
  if (typeof window === 'undefined' || typeof fn !== 'function') return
  window.addEventListener('online', fn)
}
