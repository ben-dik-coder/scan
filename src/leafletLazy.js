/** @type {import('leaflet').default | null} */
export let Leaflet = null

let loadPromise = null

/**
 * Samme som i style.css for #app .leaflet-tile — må også settes inline: WebKit dropper ofte
 * stylesheet-`filter` på kartfliser etter at appen har vært i bakgrunn (mobil låseskjerm).
 */
export const APP_MAP_TILE_IMG_FILTER = 'contrast(1.28) saturate(1.06)'

/**
 * @param {HTMLElement} el
 */
function applyTileImgContrastInline(el) {
  if (!el || el.tagName !== 'IMG') return
  el.style.setProperty('filter', APP_MAP_TILE_IMG_FILTER, 'important')
  el.style.setProperty('image-rendering', 'auto', 'important')
}

/**
 * Gjenbruk på alle synlige fliser (etter resume / fokus). Kall fra main ved visibilitychange.
 */
export function applyAppMapTileContrastToDom() {
  if (typeof document === 'undefined') return
  document
    .querySelectorAll('#app .leaflet-tile-container img.leaflet-tile')
    .forEach((img) => applyTileImgContrastInline(/** @type {HTMLElement} */ (img)))
}

/**
 * CARTO Voyager (OSM-data). `{r}` → `@2x` på HiDPI når detectRetina er på (skarpere fliser).
 * @param {import('leaflet').default} L
 * @param {{ detectRetina?: boolean }} [opts]
 * @returns {import('leaflet').TileLayer}
 */
export function createAppMapTileLayer(L, opts = {}) {
  const detectRetina = opts.detectRetina !== false
  const layer = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://carto.com/attributions" rel="noreferrer">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
      detectRetina,
    },
  )
  layer.on('tileload', (e) => {
    applyTileImgContrastInline(/** @type {HTMLElement} */ (e.tile))
  })
  return layer
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
