/** @type {import('leaflet').default | null} */
export let Leaflet = null

let loadPromise = null

/**
 * Lys «Google-lignende» bakgrunn (CARTO Positron, OSM-data).
 * @param {import('leaflet').default} L
 * @returns {import('leaflet').TileLayer}
 */
export function createAppMapTileLayer(L) {
  return L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://carto.com/attributions" rel="noreferrer">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
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
