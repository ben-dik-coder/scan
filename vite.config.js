import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// USE_HTTP=1 → kun HTTP (LAN/mobil). VITE_POLL_WATCH=1 → iCloud/nettverksdisk (unngå ETIMEDOUT).
const usePlainHttp = process.env.USE_HTTP === '1'

/** Lang timeout: /api/contract-chat kan bruke lang tid (embedding + modell). */
const apiProxy = {
  target: 'http://127.0.0.1:8787',
  changeOrigin: true,
  timeout: 300_000,
  proxyTimeout: 300_000,
}

const pollWatch =
  process.env.VITE_POLL_WATCH === '1'
    ? { usePolling: true, interval: 1000 }
    : {}

export default defineConfig({
  plugins: usePlainHttp ? [] : [basicSsl()],
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

