#!/usr/bin/env node
/**
 * Skriver ut hvordan du åpner Scanix fra iPhone/iPad på samme nettverk som Mac-en.
 * Kjør: node scripts/dev-network-hint.mjs
 */
import os from 'os'

function firstLanIPv4() {
  const ifs = os.networkInterfaces()
  for (const name of Object.keys(ifs)) {
    for (const addr of ifs[name] || []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address
    }
  }
  return '127.0.0.1'
}

const ip = firstLanIPv4()

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Scanix — åpne på Mac, iPhone eller iPad
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 På DENNE maskinen (Mac):
   • HTTP:  http://127.0.0.1:5173
   • HTTPS: https://127.0.0.1:5173  (Safari: godkjenn sertifikatvarsel)

 Fra iPhone/iPad på SAMME Wi‑Fi (bytt ut IP hvis annerledes):
   • HTTP (enklest):  http://${ip}:5173
     Start med:  npm run dev:lan
     (unngår sertifikatproblem med selvsignert HTTPS)

   • HTTPS (standard dev):  https://${ip}:5173
     Start med:  npm run dev
     I Safari: «Vis detaljer» / «Advanced» → fortsett til nettstedet.

 Fungerer det ikke?
   • Mac-brannmur: tillat «node» eller terminal-app som lytter på 5173.
   • Annen app bruker port 5173 → endre port i vite.config.js eller stopp den appen.
   • Produksjon (Netlify/Render/…): åpne den https-URLen du har deployet til;
     tøm nettsteddata hvis gammel service worker henger.

 Etter «npm run build» (test som prod lokalt, port 4173):
   • HTTP:  http://${ip}:4173   med:  npm run preview:lan
   • HTTPS: https://${ip}:4173  med:  npm run preview
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
