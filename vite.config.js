import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

// USE_HTTP=1 → kun HTTP (LAN/mobil). VITE_POLL_WATCH=1 → iCloud/nettverksdisk (unngå ETIMEDOUT).
const usePlainHttp = process.env.USE_HTTP === '1'

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
    ...(usePlainHttp ? [] : [basicSsl()]),
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
    https: usePlainHttp ? false : undefined,
    allowedHosts: usePlainHttp ? true : undefined,
    watch: pollWatch,
    proxy: {
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
    allowedHosts: true,
    proxy: {
      '/api/osrm': {
        target: 'https://router.project-osrm.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/osrm/, ''),
      },
      '/api': apiProxy,
    },
  },
})

