import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// USE_HTTP=1 → kun HTTP (test om mobil når LAN), ingen GPS i nettleser uten HTTPS
const usePlainHttp = process.env.USE_HTTP === '1'

export default defineConfig({
  plugins: usePlainHttp ? [] : [basicSsl()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Samme port hver gang → samme localStorage-opprinnelse (ellers «forsvinner» brukere ved ny port).
    strictPort: true,
    https: usePlainHttp ? false : undefined,
    // Tillat tilgang via IP (192.168…) når du kjører HTTP-modus
    allowedHosts: usePlainHttp ? true : undefined,
    proxy: {
      '/api/osrm': {
        target: 'https://router.project-osrm.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/osrm/, ''),
      },
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
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
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
