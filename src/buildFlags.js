/**
 * Bygg-/kjøremodus (Vite env) + brukervalg datasparemodus.
 */

const LS_USER_MIN = 'scanix-user-min-download-mode'

/** @returns {boolean} */
export function isMinDownloadModeForcedByBuild() {
  try {
    return import.meta.env?.VITE_MIN_DOWNLOAD_MODE === 'true'
  } catch {
    return false
  }
}

/** Når true: dataspare er låst på i UI (bygg). */
export const isMinDownloadBuild = isMinDownloadModeForcedByBuild()

function readUserMinDownloadMode() {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(LS_USER_MIN) === '1'
  } catch {
    return false
  }
}

/** Datasparemodus: bygg tvinger, eller bruker har slått på. */
export function isMinDownloadMode() {
  if (isMinDownloadBuild) return true
  return readUserMinDownloadMode()
}

/** @param {boolean} on */
export function setPilotMinDownloadUserPref(on) {
  try {
    if (typeof localStorage === 'undefined') return
    if (on) localStorage.setItem(LS_USER_MIN, '1')
    else localStorage.removeItem(LS_USER_MIN)
  } catch {
    /* ignore */
  }
}
