import { isCapacitorNativePlatform } from './nativeNetworkMetered.js'

/** @type {import('leaflet').default | null} */
export let Leaflet = null

let loadPromise = null
/** @type {Promise<import('leaflet').default> | null} */
let markerClusterLoadPromise = null

/**
 * Samme som i style.css for #app .leaflet-tile — må også settes inline: WebKit dropper ofte
 * stylesheet-`filter` på kartfliser etter at appen har vært i bakgrunn (mobil låseskjerm).
 * OSM-standardfliser er nøytrale: lett kontrastjustering
 * (samme mønster som for Voyager, men svakere — unngår «sotete» fliser).
 */
export const APP_MAP_TILE_IMG_FILTER =
  'brightness(0.97) contrast(1.1) saturate(1.06)'

/** Mørkt raster-underlag (MapTiler-PNG er allerede mørkt — svak justering). */
export const APP_MAP_TILE_IMG_FILTER_DARK =
  'brightness(1.02) contrast(1.08) saturate(1.04)'

/**
 * OSM-standardfliser har ikke eget natt-URL: inverter + hue for lesbar «mørk modus»
 * (brukes når `VITE_MAPTILER_API_KEY` mangler i bygget, f.eks. Xcode uten .env.production.local).
 */
export const APP_MAP_TILE_OSM_DARK_FILTER =
  'invert(1) hue-rotate(180deg) brightness(0.92) contrast(1.06) saturate(0.88)'

/** Maks zoom for alle app-kart (færre fliser / mindre mobildata). */
export const APP_MAP_MAX_ZOOM = 16

/**
 * Standard flis-lag: 1× fliser, tak i zoom, færre forespørsler under pinch/zoom.
 */
export const APP_MAP_TILE_LAYER_DEFAULT = Object.freeze({
  detectRetina: false,
  maxZoom: APP_MAP_MAX_ZOOM,
  updateWhenIdle: true,
  updateWhenZooming: false,
})

/** @deprecated Samme som APP_MAP_TILE_LAYER_DEFAULT. */
export const APP_MAP_TILE_LAYER_DATA_SAVER = APP_MAP_TILE_LAYER_DEFAULT

/**
 * @param {HTMLElement} el
 */
function applyTileImgContrastInline(el, filterStr) {
  if (!el || el.tagName !== 'IMG') return
  const f =
    typeof filterStr === 'string' && filterStr.trim()
      ? filterStr
      : APP_MAP_TILE_IMG_FILTER
  el.style.setProperty('filter', f, 'important')
  el.style.setProperty('image-rendering', 'auto', 'important')
}

/**
 * Gjenbruk på alle synlige fliser (etter resume / fokus). Kall fra main ved visibilitychange.
 */
export function applyAppMapTileContrastToDom() {
  if (typeof document === 'undefined') return
  document
    .querySelectorAll('#app .leaflet-tile-container img.leaflet-tile')
    .forEach((img) => {
      const el = /** @type {HTMLElement} */ (img)
      const sessionDark = Boolean(
        el.closest('.session-map-root.session-map-basemap-dark'),
      )
      const src = typeof img.src === 'string' ? img.src : ''
      const isOsmTile = src.includes('openstreetmap.org')
      const darkFilter =
        sessionDark && isOsmTile
          ? APP_MAP_TILE_OSM_DARK_FILTER
          : sessionDark
            ? APP_MAP_TILE_IMG_FILTER_DARK
            : APP_MAP_TILE_IMG_FILTER
      applyTileImgContrastInline(el, darkFilter)
    })
}

/**
 * Bakgrunnsfliser som **raster** (PNG): MapTiler Cloud når nøkkel er satt, ellers OpenStreetMap.
 * Brukes av frittstående HTML-eksport og av `createAppMapTileLayer` (kun uten vektor).
 * Se https://docs.maptiler.com/cloud/api/maps/ (raster `…/maps/{mapId}/256/{z}/{x}/{y}.png`).
 *
 * @param {{ dark?: boolean }} [basemapOpts]
 * @returns {{
 *   url: string
 *   attribution: string
 *   subdomains?: string
 *   crossOrigin?: boolean
 *   provider: 'maptiler' | 'osm'
 * }}
 */
export function getRasterBasemapTileSpec(basemapOpts = {}) {
  const keyRaw = import.meta.env.VITE_MAPTILER_API_KEY
  const key = typeof keyRaw === 'string' ? keyRaw.trim() : ''
  const styleRaw = import.meta.env.VITE_MAPTILER_MAP_ID
  const styleId =
    typeof styleRaw === 'string' && styleRaw.trim()
      ? styleRaw.trim()
      : 'base-v4'
  const styleDarkRaw = import.meta.env.VITE_MAPTILER_MAP_ID_DARK
  const styleIdDark =
    typeof styleDarkRaw === 'string' && styleDarkRaw.trim()
      ? styleDarkRaw.trim()
      : 'streets-v2-dark'
  if (key) {
    const dark = basemapOpts.dark === true
    const encKey = encodeURIComponent(key)
    const encId = encodeURIComponent(dark ? styleIdDark : styleId)
    return {
      url: `https://api.maptiler.com/maps/${encId}/256/{z}/{x}/{y}.png?key=${encKey}`,
      attribution:
        '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">&copy; OpenStreetMap contributors</a>',
      crossOrigin: true,
      provider: 'maptiler',
    }
  }
  return {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    crossOrigin: true,
    provider: 'osm',
  }
}

/**
 * OSM- eller MapTiler-raster (se `getRasterBasemapTileSpec`).
 * MapTiler-PNG-URL støtter query-nøkkel; OSM bruker standard flis-URL (behold `detectRetina: false` for OSM-policy).
 * @param {import('leaflet').default} L
 * @param {{
 *   detectRetina?: boolean
 *   maxZoom?: number
 *   updateWhenIdle?: boolean
 *   updateWhenZooming?: boolean
 * }} [opts]
 * @param {{ dark?: boolean }} [basemapOpts]
 * @returns {import('leaflet').TileLayer}
 */
export function createAppMapTileLayer(L, opts = {}, basemapOpts = {}) {
  const dark = basemapOpts.dark === true
  const spec = getRasterBasemapTileSpec(basemapOpts)
  const merged = { ...APP_MAP_TILE_LAYER_DEFAULT, ...opts }
  const maxZoom =
    typeof merged.maxZoom === 'number' ? merged.maxZoom : APP_MAP_MAX_ZOOM
  const detectRetina = merged.detectRetina === true
  /** @type {import('leaflet').TileLayerOptions & Record<string, unknown>} */
  const tileOpts = {
    attribution: spec.attribution,
    maxZoom,
    detectRetina,
  }
  if (spec.subdomains) tileOpts.subdomains = spec.subdomains
  if (spec.crossOrigin) tileOpts.crossOrigin = true
  if (merged.updateWhenIdle === true) {
    tileOpts.updateWhenIdle = true
  }
  if (merged.updateWhenZooming === false) {
    tileOpts.updateWhenZooming = false
  }
  const layer = L.tileLayer(spec.url, tileOpts)
  const tileFilter =
    spec.provider === 'osm' && dark
      ? APP_MAP_TILE_OSM_DARK_FILTER
      : dark
        ? APP_MAP_TILE_IMG_FILTER_DARK
        : APP_MAP_TILE_IMG_FILTER
  layer.on('tileload', (e) => {
    applyTileImgContrastInline(/** @type {HTMLElement} */ (e.tile), tileFilter)
  })
  return layer
}

/**
 * Raster i stedet for MapTiler-vektor når eksplisitt ønsket (WKWebView kan være ustabil).
 * Standard: vektor overalt inkl. Capacitor — ved feil faller `createAppBasemapLayer` tilbake til raster.
 *
 * - `VITE_MAPTILER_FORCE_RASTER=true` → alltid raster (også nettleser).
 * - `VITE_MAPTILER_PREFER_RASTER_ON_NATIVE=true` → raster kun i installert app (Capacitor).
 */
function shouldUseMaptilerRasterInsteadOfVector() {
  if (import.meta.env.VITE_MAPTILER_FORCE_RASTER === 'true') return true
  if (
    isCapacitorNativePlatform() &&
    import.meta.env.VITE_MAPTILER_PREFER_RASTER_ON_NATIVE === 'true'
  ) {
    return true
  }
  return false
}

/** @type {Promise<typeof import('@maptiler/leaflet-maptilersdk')> | null} */
let maptilerLeafletSdkPromise = null

function loadMaptilerLeafletSdk() {
  if (!maptilerLeafletSdkPromise) {
    maptilerLeafletSdkPromise = (async () => {
      await import('@maptiler/sdk/dist/maptiler-sdk.css')
      return import('@maptiler/leaflet-maptilersdk')
    })()
  }
  return maptilerLeafletSdkPromise
}

/**
 * Bakgrunn i appen: med `VITE_MAPTILER_API_KEY` → MapTiler **vektor** (MapLibre i Leaflet)
 * overalt (nett + Capacitor / WKWebView). Ved init-feil brukes raster-PNG. Valgfritt:
 * `VITE_MAPTILER_PREFER_RASTER_ON_NATIVE=true` (kun native) eller `VITE_MAPTILER_FORCE_RASTER=true`.
 * Uten nøkkel: OpenStreetMap-raster (mørkt = invertert filter).
 *
 * @param {import('leaflet').default} L
 * @param {{
 *   detectRetina?: boolean
 *   maxZoom?: number
 *   updateWhenIdle?: boolean
 *   updateWhenZooming?: boolean
 * }} [opts] — brukes for rasterfliser (MapTiler eller OSM).
 * @param {{ dark?: boolean }} [basemapOpts]
 * @returns {Promise<import('leaflet').Layer | import('leaflet').TileLayer>}
 */
export async function createAppBasemapLayer(L, opts = {}, basemapOpts = {}) {
  const preferDark = basemapOpts.dark === true
  const keyRaw = import.meta.env.VITE_MAPTILER_API_KEY
  const apiKey = typeof keyRaw === 'string' ? keyRaw.trim() : ''

  if (!apiKey) {
    return createAppMapTileLayer(L, opts, { dark: preferDark })
  }

  if (shouldUseMaptilerRasterInsteadOfVector()) {
    return createAppMapTileLayer(L, opts, { dark: preferDark })
  }

  const styleDarkRaw = import.meta.env.VITE_MAPTILER_MAP_ID_DARK
  const mapIdDark =
    typeof styleDarkRaw === 'string' && styleDarkRaw.trim()
      ? styleDarkRaw.trim()
      : 'streets-v2-dark'
  const styleRaw = import.meta.env.VITE_MAPTILER_MAP_ID
  const mapIdLight =
    typeof styleRaw === 'string' && styleRaw.trim()
      ? styleRaw.trim()
      : 'base-v4'
  const mapId = preferDark ? mapIdDark : mapIdLight
  const encKey = encodeURIComponent(apiKey)
  const encId = encodeURIComponent(mapId)
  const style = `https://api.maptiler.com/maps/${encId}/style.json?key=${encKey}`
  try {
    const { MaptilerLayer } = await loadMaptilerLeafletSdk()
    return new MaptilerLayer({ apiKey, style })
  } catch (err) {
    console.warn('[basemap] MapTiler-vektor feilet, bruker raster-fliser', err)
    return createAppMapTileLayer(L, opts, { dark: preferDark })
  }
}

/**
 * MapTiler-vektor = MapLibre i WebGL. Etter `invalidateSize`, resume eller bottom sheet
 * oppdateres ikke alltid canvas automatisk — `resize()` synker dimensjoner og unngår
 * «frosne» eller halvfliser.
 *
 * @param {import('leaflet').Map | null | undefined} leafletMap
 */
export function nudgeMaptilerBasemapResize(leafletMap) {
  if (!leafletMap || typeof leafletMap.eachLayer !== 'function') return
  try {
    leafletMap.eachLayer((layer) => {
      if (!layer || typeof layer.getMaptilerSDKMap !== 'function') return
      const inner = /** @type {{ resize?: () => void }} */ (
        /** @type {{ getMaptilerSDKMap: () => unknown }} */ (layer).getMaptilerSDKMap()
      )
      if (inner && typeof inner.resize === 'function') inner.resize()
    })
  } catch {
    /* ignore */
  }
}

/** Last Leaflet + CSS første gang; deretter cache. Flytter ~hundrevis av kB ut av initial parse. */
export function ensureLeaflet() {
  if (Leaflet) return Promise.resolve(Leaflet)
  if (!loadPromise) {
    loadPromise = (async () => {
      await import('leaflet/dist/leaflet.css')
      const mod = await import('leaflet')
      Leaflet = mod.default
      return Leaflet
    })()
  }
  return loadPromise
}

/**
 * Markercluster (UMD) forventer global `L` under lasting.
 * @returns {Promise<import('leaflet').default>}
 */
export function ensureLeafletMarkerCluster() {
  if (markerClusterLoadPromise) return markerClusterLoadPromise
  markerClusterLoadPromise = (async () => {
    const L = await ensureLeaflet()
    const g = typeof globalThis !== 'undefined' ? globalThis : window
    const prevL = g.L
    try {
      g.L = L
      await import('leaflet.markercluster/dist/MarkerCluster.css')
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css')
      await import('leaflet.markercluster/dist/leaflet.markercluster-src.js')
    } finally {
      if (prevL === undefined) {
        try {
          delete g.L
        } catch {
          g.L = undefined
        }
      } else {
        g.L = prevL
      }
    }
    return L
  })()
  return markerClusterLoadPromise
}
