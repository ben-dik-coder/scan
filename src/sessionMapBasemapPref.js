/** @type {import('./sessionMapBasemapPref.js')} */
export const SCANIX_SESSION_MAP_DARK_KEY = 'scanix-session-map-dark'

/** @returns {boolean} */
export function getSessionMapDarkPreference() {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(SCANIX_SESSION_MAP_DARK_KEY) === '1'
  } catch {
    return false
  }
}

/** @param {boolean} on */
export function setSessionMapDarkPreference(on) {
  try {
    if (typeof localStorage === 'undefined') return
    if (on) {
      localStorage.setItem(SCANIX_SESSION_MAP_DARK_KEY, '1')
    } else {
      localStorage.removeItem(SCANIX_SESSION_MAP_DARK_KEY)
    }
  } catch {
    /* ignore */
  }
}
