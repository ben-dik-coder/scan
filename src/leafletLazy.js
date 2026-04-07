/** @type {import('leaflet').default | null} */
export let Leaflet = null

let loadPromise = null

/**
 * CARTO Voyager (OSM-data). `{r}` → `@2x` på HiDPI når detectRetina er på (skarpere fliser).
 * @param {import('leaflet').default} L
 * @param {{ detectRetina?: boolean }} [opts]
 * @returns {import('leaflet').TileLayer}
 */
export function createAppMapTileLayer(L, opts = {}) {
  const detectRetina = opts.detectRetina !== false
  return L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://carto.com/attributions" rel="noreferrer">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
      detectRetina,
    },
  )
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
