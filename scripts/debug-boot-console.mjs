/**
 * Headless smoke: last produksjons-build med vite preview og fang konsoll-feil.
 * Kjør: npm run build && node scripts/debug-boot-console.mjs
 */
import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const port = 4174

const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', `--port`, String(port)], {
  cwd: root,
  env: { ...process.env, USE_HTTP: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let out = ''
preview.stdout.on('data', (d) => {
  out += d.toString()
})
preview.stderr.on('data', (d) => {
  out += d.toString()
})

await new Promise((r) => setTimeout(r, 2500))

const url = `http://127.0.0.1:${port}/`
const logs = []
const errors = []

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
page.on('console', (msg) => {
  const t = msg.type()
  const text = msg.text()
  logs.push(`[${t}] ${text}`)
  if (t === 'error') errors.push(text)
})
page.on('pageerror', (err) => {
  errors.push(`pageerror: ${err.message}\n${err.stack}`)
})

await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
await new Promise((r) => setTimeout(r, 3000))

const appHtml = await page.$eval('#app', (el) => el.innerHTML.slice(0, 500)).catch(() => '(ingen #app)')
const hasAuthOrHome =
  (await page.content()).includes('auth') ||
  (await page.content()).includes('app-body')

preview.kill('SIGTERM')
await browser.close()

console.log('--- vite preview log (siste) ---')
console.log(out.split('\n').slice(-15).join('\n'))
console.log('--- konsoll (nettleser) ---')
console.log(logs.join('\n') || '(ingen)')
console.log('--- #app (start) ---')
console.log(appHtml)
console.log('--- oppsummering ---')
if (errors.length) {
  console.error('FEIL:', errors.join('\n---\n'))
  process.exitCode = 1
} else {
  console.log('Ingen konsoll-feil / pageerror.')
}
