/**
 * Ringbuffer med strukturerte vegref-målinger (localStorage) for tuning.
 * Skru av med localStorage.setItem('scanix-vegref-metrics-enabled','0')
 */

const STORAGE_KEY = 'scanix-vegref-metrics-v1'
const MAX_ENTRIES = 220

function metricsEnabled() {
  try {
    const v = localStorage.getItem('scanix-vegref-metrics-enabled')
    if (v === '0' || v === 'false') return false
    return true
  } catch {
    return false
  }
}

/**
 * @param {Record<string, unknown>} entry
 */
export function logVegrefMetric(entry) {
  if (!metricsEnabled()) return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    /** @type {Record<string, unknown>[]} */
    const arr = raw ? JSON.parse(raw) : []
    if (!Array.isArray(arr)) return
    arr.push({ t: Date.now(), ...entry })
    while (arr.length > MAX_ENTRIES) arr.shift()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  } catch {
    /* ignore quota / private mode */
  }
}

/** @returns {Record<string, unknown>[]} */
export function getVegrefMetrics() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const p = raw ? JSON.parse(raw) : []
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

export function clearVegrefMetrics() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined') {
  window.__scanixVegrefMetrics = {
    get: getVegrefMetrics,
    clear: clearVegrefMetrics,
    disable: () => {
      try {
        localStorage.setItem('scanix-vegref-metrics-enabled', '0')
      } catch {
        /* ignore */
      }
    },
    enable: () => {
      try {
        localStorage.removeItem('scanix-vegref-metrics-enabled')
      } catch {
        /* ignore */
      }
    },
  }
}
