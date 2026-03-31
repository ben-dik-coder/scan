/**
 * Scanix backend: PDF (POST /api/generate-report), AI (POST /api/analyze, POST /analyze)
 * Kjør: cd server && npm install && npm start  |  eller: node server.js
 * Miljø: server/.env lastes automatisk (OPENAI_API_KEY, …). Kopier fra .env.example.
 * Utvikling: Vite proxyer /api → denne serveren (se vite.config.js).
 */

import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'
import { handleAnalyze } from './analyzeHandler.js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import puppeteer from 'puppeteer'
import { fileURLToPath } from 'url'
import { buildReportHtml } from './reportHtml.js'
import { buildAiChatPdfHtml } from './aiChatPdfHtml.js'
import { fetchStaticMapAsDataUrl } from './staticMap.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '.env') })
const ROOT = join(__dirname, '..')
/** Railway, Render, Fly m.fl. setter PORT; lokal fallback 8787 */
const PORT = Number(process.env.PORT || process.env.PDF_SERVER_PORT || 8787)
const LISTEN_HOST = process.env.LISTEN_HOST || '0.0.0.0'

/** @type {import('puppeteer').Browser | null} */
let browserInstance = null

const PUPPETEER_BASE_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--font-render-hinting=medium',
]

/**
 * Render / mange Linux-hosts: Puppeteers medfølgende Chromium feiler ofte (mangler libs).
 * Bruk @sparticuz/chromium + puppeteer-core når RENDER=true.
 * Lokalt (macOS/Windows): vanlig puppeteer med nedlastet Chromium.
 */
async function getBrowser() {
  if (browserInstance) return browserInstance

  if (process.env.RENDER === 'true') {
    const Chromium = (await import('@sparticuz/chromium')).default
    const puppeteerCore = (await import('puppeteer-core')).default
    /** args inkluderer allerede --headless=shell / --no-sandbox (sparticuz) */
    browserInstance = await puppeteerCore.launch({
      args: [...Chromium.args, ...PUPPETEER_BASE_ARGS],
      executablePath: await Chromium.executablePath(),
      headless: true,
    })
    return browserInstance
  }

  browserInstance = await puppeteer.launch({
    headless: true,
    args: PUPPETEER_BASE_ARGS,
  })
  return browserInstance
}

/** Ved feil ved oppstart av nettleser: prøv igjen ved neste PDF-kall. */
function resetBrowserInstance() {
  browserInstance = null
}

function readAppVersion() {
  try {
    const p = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    return typeof p.version === 'string' ? p.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function readLogoDataUrl() {
  const logoPath = join(ROOT, 'public/assets/app-logo-launch.png')
  if (!existsSync(logoPath)) return null
  try {
    const b = readFileSync(logoPath)
    return `data:image/png;base64,${b.toString('base64')}`
  } catch {
    return null
  }
}

const app = express()
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }),
)
app.use(express.json({ limit: '48mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'scanix-server',
    version: readAppVersion(),
    endpoints: ['/api/generate-report', '/api/generate-ai-chat-pdf', '/api/analyze'],
  })
})

app.post('/api/analyze', handleAnalyze)
app.post('/analyze', handleAnalyze)

app.post('/api/generate-report', async (req, res) => {
  let page = null
  try {
    const body = req.body
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Ugyldig JSON.' })
      return
    }

    const mapDataUrl = await fetchStaticMapAsDataUrl(body.clickHistory || [])
    const logoDataUrl = readLogoDataUrl()
    const generatedAtLabel =
      typeof body.generatedAtLabel === 'string' && body.generatedAtLabel.trim()
        ? body.generatedAtLabel.trim()
        : new Date().toLocaleString('nb-NO', {
            dateStyle: 'long',
            timeStyle: 'short',
          })

    const html = buildReportHtml(
      { ...body, generatedAtLabel, appVersion: body.appVersion || readAppVersion() },
      { mapDataUrl, logoDataUrl },
    )

    let browser
    try {
      browser = await getBrowser()
    } catch (launchErr) {
      console.error('generate-report browser launch:', launchErr)
      resetBrowserInstance()
      browser = await getBrowser()
    }

    page = await browser.newPage()
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    })
    /** Vent på at bilder (data-URL) er tegnet */
    await page.evaluate(() => document.fonts?.ready ?? Promise.resolve())

    const pdfBuf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: '14mm',
        right: '12mm',
        bottom: '16mm',
        left: '12mm',
      },
    })

    const filename = `scanix-rapport-${new Date().toISOString().slice(0, 10)}.pdf`
    res.setHeader('Content-Type', 'application/pdf; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    res.send(Buffer.from(pdfBuf))
  } catch (err) {
    console.error('generate-report:', err)
    resetBrowserInstance()
    res.status(500).json({
      error:
        err && typeof err === 'object' && 'message' in err
          ? String(/** @type {{ message: string }} */ (err).message)
          : 'Kunne ikke generere PDF.',
    })
  } finally {
    if (page) {
      try {
        await page.close()
      } catch {
        /* ignore */
      }
    }
  }
})

app.post('/api/generate-ai-chat-pdf', async (req, res) => {
  let page = null
  try {
    const body = req.body
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Ugyldig JSON.' })
      return
    }

    const html = buildAiChatPdfHtml(body)

    let browser
    try {
      browser = await getBrowser()
    } catch (launchErr) {
      console.error('generate-ai-chat-pdf browser launch:', launchErr)
      resetBrowserInstance()
      browser = await getBrowser()
    }

    page = await browser.newPage()
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    })
    await page.evaluate(() => document.fonts?.ready ?? Promise.resolve())

    const pdfBuf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: '14mm',
        right: '12mm',
        bottom: '16mm',
        left: '12mm',
      },
    })

    const filename = `veiai-samtale-${new Date().toISOString().slice(0, 10)}.pdf`
    res.setHeader('Content-Type', 'application/pdf; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    )
    res.send(Buffer.from(pdfBuf))
  } catch (err) {
    console.error('generate-ai-chat-pdf:', err)
    resetBrowserInstance()
    res.status(500).json({
      error:
        err && typeof err === 'object' && 'message' in err
          ? String(/** @type {{ message: string }} */ (err).message)
          : 'Kunne ikke generere PDF.',
    })
  } finally {
    if (page) {
      try {
        await page.close()
      } catch {
        /* ignore */
      }
    }
  }
})

app.listen(PORT, LISTEN_HOST, () => {
  console.log(
    `Scanix API lytter på http://${LISTEN_HOST}:${PORT} (PDF + /api/analyze — OPENAI_API_KEY i miljø)`,
  )
})

process.on('SIGINT', async () => {
  if (browserInstance) await browserInstance.close()
  process.exit(0)
})
