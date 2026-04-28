import { defineConfig } from 'vite'
import fs from 'node:fs'
import { VitePWA } from 'vite-plugin-pwa'

// USE_HTTP=1 → kun HTTP (LAN/mobil). VITE_POLL_WATCH=1 → iCloud/nettverksdisk (unngå ETIMEDOUT).
const usePlainHttp = process.env.USE_HTTP === '1'

const localHttps =
  !usePlainHttp && fs.existsSync('cert.pem') && fs.existsSync('key.pem')
    ? { cert: fs.readFileSync('cert.pem'), key: fs.readFileSync('key.pem') }
    : false

/** Lang timeout: kontrakt-RAG (embedding + rerank + modell) kan ta mange minutter. */
const apiProxy = {
  target: 'http://127.0.0.1:8787',
  changeOrigin: true,
  timeout: 900_000,
  proxyTimeout: 900_000,
}

const pollWatch =
  process.env.VITE_POLL_WATCH === '1'
    ? { usePolling: true, interval: 1000 }
    : {}

/** Når satt: `vite build` kjører i watch-modus og skriver til dist/ ved endringer (samme som build.watch i config). */
const watchDist =
  process.env.VITE_WATCH_DIST === '1'
    ? {
        watch: {
          ...(Object.keys(pollWatch).length ? { chokidar: pollWatch } : {}),
        },
      }
    : {}

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      injectRegister: false,
      devOptions: { enabled: false },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff2,webp,webmanifest}',
        ],
        globIgnores: ['**/offline/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        /* Besøkte kartfliser / vektor-ressurser: CacheFirst (eller SWR for style) → gjentatte besøk treffer SW-cache. */
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname === 'tile.openstreetmap.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'scanix-map-tiles-osm',
              expiration: {
                maxEntries: 400,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            /* MapTiler style.json: oppdater i bakgrunnen etter første treff (sparer re-download ved uendret stil). */
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.hostname.toLowerCase().endsWith('maptiler.com') &&
              url.pathname.includes('style.json'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'scanix-maptiler-style',
              expiration: {
                maxEntries: 24,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            /* MapTiler: .pbf, fonter, sprites, PNG-raster, API — alle *.maptiler.com GET (unntatt style håndteres over). */
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.hostname.toLowerCase().endsWith('maptiler.com') &&
              !url.pathname.includes('style.json'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'scanix-maptiler-assets',
              expiration: {
                maxEntries: 2800,
                maxAgeSeconds: 14 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    ...watchDist,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Samme port → stabil localStorage; ikke endre uten grunn.
    strictPort: true,
    https: localHttps || false,
    allowedHosts: true,
    watch: pollWatch,
    proxy: {
      /* Cursor/agent debug-ingest: unngå mixed content når dev kjører på https://localhost */
      '/ingest': {
        target: 'http://127.0.0.1:7877',
        changeOrigin: true,
      },
      '/api/osrm': {
        target: 'https://router.project-osrm.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/osrm/, ''),
      },
      '/api': apiProxy,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    https: localHttps || false,
    allowedHosts: true,
    proxy: {
      '/ingest': {
        target: 'http://127.0.0.1:7877',
        changeOrigin: true,
      },
      '/api/osrm': {
        target: 'https://router.project-osrm.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/osrm/, ''),
      },
      '/api': apiProxy,
    },
  },
})

