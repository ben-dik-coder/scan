/**
 * Værstripe på forsiden: Open-Meteo (gratis, ingen nøkkel), posisjon fra GPS.
 * Oppdateres når brukeren flytter seg (terskel) eller etter minimumsintervall.
 */

const OPEN_METEO =
  'https://api.open-meteo.com/v1/forecast?current=temperature_2m,weather_code&timezone=auto'

const MIN_FETCH_INTERVAL_MS = 90_000
const MOVE_REFRESH_M = 2500

let getIsHome = () => false
let lastLat = null
let lastLng = null
let lastFetchAt = 0
let fetchInFlight = false
let uid = 0

/** @type {{ temp: number, kind: string, label: string } | null} */
let lastOk = null

const LABELS = {
  clear: 'Klart',
  mainly_clear: 'Lett skyet',
  partly: 'Delvis skyet',
  cloudy: 'Skyet',
  fog: 'Tåke',
  drizzle: 'Yr',
  rain: 'Regn',
  snow: 'Snø',
  thunder: 'Torden',
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * @param {number} code WMO weathercode fra Open-Meteo
 * @returns {keyof typeof LABELS}
 */
function weatherCodeToKind(code) {
  if (code === 0) return 'clear'
  if (code === 1) return 'mainly_clear'
  if (code === 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code >= 61 && code <= 67) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 80 && code <= 82) return 'rain'
  if (code >= 85 && code <= 86) return 'snow'
  if (code >= 95 && code <= 99) return 'thunder'
  return 'cloudy'
}

function nextId() {
  uid += 1
  return `hw-${uid}`
}

/**
 * @param {string} kind
 * @param {string} gid unik gradient-id suffiks
 */
function iconHtml(kind, gid) {
  const gSun = `${gid}-sun`
  const gCloud = `${gid}-cloud`
  const gBolt = `${gid}-bolt`

  const sunCore = `<defs><radialGradient id="${gSun}" cx="40%" cy="40%"><stop offset="0%" stop-color="#ffe8a8"/><stop offset="55%" stop-color="#ffc14d"/><stop offset="100%" stop-color="#e88c20"/></radialGradient><linearGradient id="${gCloud}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,0.95)"/><stop offset="100%" stop-color="rgba(200,210,230,0.55)"/></linearGradient><linearGradient id="${gBolt}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fffef0"/><stop offset="100%" stop-color="#e8b020"/></linearGradient></defs>`

  const raysInner = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    const x1 = Math.cos(a) * 15
    const y1 = Math.sin(a) * 15
    const x2 = Math.cos(a) * 21
    const y2 = Math.sin(a) * 21
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="rgba(255,220,140,0.92)" stroke-width="2.2" stroke-linecap="round"/>`
  }).join('')

  const sunStack = (r) =>
    `<g transform="translate(32,28)"><circle cx="0" cy="0" r="${r}" fill="url(#${gSun})"/><g class="home-weather__sun-rays">${raysInner}</g></g>`

  const sunOnly = `${sunCore}${sunStack(11)}`

  const cloudPath =
    '<path class="home-weather__cloud-shape" fill="url(#' +
    gCloud +
    ')" d="M18 38c-4 0-7 3-7 7 0 4 3 7 7 7h28c5 0 9-4 9-9 0-4-3-8-7-9 0-6-5-11-11-11-4 0-8 2-10 5-2-1-4-2-7-2-6 0-11 5-11 11 0 1 0 2 0 3z"/>'

  const partly = `${sunCore}<g class="home-weather__partly-wrap"><g class="home-weather__partly-sun" transform="translate(38,24)"><circle cx="0" cy="0" r="9" fill="url(#${gSun})"/><g class="home-weather__sun-rays">${raysInner}</g></g><g class="home-weather__partly-cloud" transform="translate(0,8)">${cloudPath}</g></g>`

  const cloudFloat = `${sunCore}<g class="home-weather__cloud-alone">${cloudPath}</g>`

  const fogExtra =
    '<ellipse cx="32" cy="44" rx="20" ry="5" fill="rgba(220,230,245,0.25)" class="home-weather__fog-layer"/>'

  const drops = [14, 26, 38, 22, 34]
    .map(
      (x, i) =>
        `<line class="home-weather__drop" x1="${x}" y1="46" x2="${x - 2}" y2="58" stroke="rgba(120,180,255,0.85)" stroke-width="2" stroke-linecap="round" style="animation-delay:${i * 0.12}s"/>`,
    )
    .join('')

  const rain = `${sunCore}<g class="home-weather__rain-cloud">${cloudPath}</g><g class="home-weather__rain-drops">${drops}</g>`
  const drizzle = `${sunCore}<g class="home-weather__rain-cloud">${cloudPath}</g><g class="home-weather__rain-drops home-weather__rain-drops--light">${drops}</g>`

  const flakes = [16, 28, 40, 24, 36]
    .map(
      (x, i) =>
        `<circle class="home-weather__flake" cx="${x}" cy="${48 + (i % 3) * 3}" r="2" fill="rgba(255,255,255,0.9)" style="animation-delay:${i * 0.15}s"/>`,
    )
    .join('')
  const snow = `${sunCore}<g class="home-weather__snow-cloud">${cloudPath}</g><g class="home-weather__snow-flakes">${flakes}</g>`

  const bolt = `<path class="home-weather__bolt" fill="url(#${gBolt})" d="M34 36 L28 48 L32 48 L26 58 L38 42 L33 42 L38 36 Z"/>`
  const thunder = `${sunCore}<g class="home-weather__th-cloud">${cloudPath}</g>${bolt}`

  switch (kind) {
    case 'clear':
    case 'mainly_clear':
      return `<svg viewBox="0 0 64 64" class="home-weather__svg home-weather__svg--sun" aria-hidden="true">${sunOnly}</svg>`
    case 'partly':
      return `<svg viewBox="0 0 64 64" class="home-weather__svg home-weather__svg--partly" aria-hidden="true">${partly}</svg>`
    case 'cloudy':
      return `<svg viewBox="0 0 64 64" class="home-weather__svg home-weather__svg--cloud" aria-hidden="true">${cloudFloat}</svg>`
    case 'fog':
      return `<svg viewBox="0 0 64 64" class="home-weather__svg home-weather__svg--fog" aria-hidden="true">${sunCore}<g class="home-weather__fog-cloud">${cloudPath}</g>${fogExtra}</svg>`
    case 'drizzle':
      return `<svg viewBox="0 0 64 64" class="home-weather__svg home-weather__svg--rain" aria-hidden="true">${drizzle}</svg>`
    case 'rain':
      return `<svg viewBox="0 0 64 64" class="home-weather__svg home-weather__svg--rain" aria-hidden="true">${rain}</svg>`
    case 'snow':
      return `<svg viewBox="0 0 64 64" class="home-weather__svg home-weather__svg--snow" aria-hidden="true">${snow}</svg>`
    case 'thunder':
      return `<svg viewBox="0 0 64 64" class="home-weather__svg home-weather__svg--thunder" aria-hidden="true">${thunder}</svg>`
    default:
      return `<svg viewBox="0 0 64 64" class="home-weather__svg home-weather__svg--cloud" aria-hidden="true">${cloudFloat}</svg>`
  }
}

function shouldFetch(lat, lng) {
  const now = Date.now()
  if (lastLat == null || lastLng == null) return true
  if (now - lastFetchAt >= MIN_FETCH_INTERVAL_MS) return true
  if (haversineM(lastLat, lastLng, lat, lng) >= MOVE_REFRESH_M) return true
  return false
}

function setDom(temp, kind, label) {
  const root = document.getElementById('home-weather')
  const tempEl = document.getElementById('home-weather-temp')
  const descEl = document.getElementById('home-weather-desc')
  const iconEl = document.getElementById('home-weather-icon')
  if (!root || !tempEl || !descEl || !iconEl) return

  const gid = nextId()
  iconEl.innerHTML = iconHtml(kind, gid)
  tempEl.textContent = `${Math.round(temp)}°`
  descEl.textContent = label
  root.hidden = false
  root.setAttribute(
    'aria-label',
    `Vær: ${label}, ${Math.round(temp)} grader celsius`,
  )
}

function hideDom() {
  const root = document.getElementById('home-weather')
  if (root) root.hidden = true
}

async function fetchWeather(lat, lng) {
  const url = `${OPEN_METEO}&latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}`
  const res = await fetch(url, { credentials: 'omit' })
  if (!res.ok) throw new Error(String(res.status))
  const data = await res.json()
  const cur = data?.current
  if (!cur || typeof cur.temperature_2m !== 'number') throw new Error('værdata')
  const code = typeof cur.weather_code === 'number' ? cur.weather_code : 3
  const kind = weatherCodeToKind(code)
  const label = LABELS[kind] || LABELS.cloudy
  return { temp: cur.temperature_2m, kind, label }
}

/**
 * Kalles fra forsiden når GPS gir ny posisjon (samme spor som vegref).
 * @param {number} lat
 * @param {number} lng
 */
export function scheduleHomeWeatherFromPosition(lat, lng) {
  if (!getIsHome()) return
  if (typeof lat !== 'number' || typeof lng !== 'number') return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (lastOk) {
      setDom(lastOk.temp, lastOk.kind, lastOk.label)
    }
    return
  }
  if (!shouldFetch(lat, lng)) return
  if (fetchInFlight) return
  fetchInFlight = true
  void (async () => {
    try {
      const w = await fetchWeather(lat, lng)
      lastLat = lat
      lastLng = lng
      lastFetchAt = Date.now()
      lastOk = w
      if (!getIsHome()) return
      setDom(w.temp, w.kind, w.label)
    } catch {
      if (getIsHome() && lastOk) {
        setDom(lastOk.temp, lastOk.kind, lastOk.label)
      }
    } finally {
      fetchInFlight = false
    }
  })()
}

export function resetHomeWeather() {
  lastLat = null
  lastLng = null
  lastFetchAt = 0
  hideDom()
}

/**
 * @param {{ getIsHome: () => boolean }} opts
 */
export function initHomeWeather(opts) {
  getIsHome = opts.getIsHome
}
