/**
 * Scanix backend: PDF, AI, kontrakt-RAG (POST /api/contract-chat)
 * Kjør: cd server && npm install && npm start  |  ren node: node -r ./startup-log.cjs index.js
 * Miljø: server/.env lastes automatisk (OPENAI_API_KEY, …). Kopier fra .env.example.
 * Utvikling: Vite proxyer /api → denne serveren (se vite.config.js).
 *
 * Tunge moduler lastes asynkront etter at HTTP-port er åpen, så du ser «lytter» raskt
 * (unngår lang stillhet ved treg disk / iCloud / store node_modules).
 */

import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

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
    browserInstance = await puppeteerCore.launch({
      args: [...Chromium.args, ...PUPPETEER_BASE_ARGS],
      executablePath: await Chromium.executablePath(),
      headless: true,
    })
    return browserInstance
  }

  const puppeteer = (await import('puppeteer')).default
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

/** Ruter utenom health registreres etter dynamisk import (kan ta tid på treg disk). */
let routesReady = false

app.use((req, res, next) => {
  const p = req.path
  const needsRoutes =
    p.startsWith('/api') || p === '/analyze'
  if (routesReady || !needsRoutes || p === '/api/health') {
    next()
    return
  }
  res.status(503).json({
    error:
      'Server laster fortsatt moduler. Vent noen sekunder og prøv igjen.',
  })
})

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'scanix-server',
    version: readAppVersion(),
    routesReady,
    endpoints: [
      '/api/generate-report',
      '/api/generate-ai-chat-pdf',
      '/api/ai-chat-pdf-summary',
      '/api/analyze',
      '/api/contract-chat',
    ],
  })
})

const httpServer = app.listen(PORT, LISTEN_HOST, () => {
  console.log(
    `Scanix API lytter på http://${LISTEN_HOST}:${PORT} (moduler lastes i bakgrunnen …)`,
  )
  console.log(`Test: http://127.0.0.1:${PORT}/api/health`)
})
/* Lange AI-kall (kontrakt-RAG, analyse): Node sin standard requestTimeout (5 min) kan avbryte før svar er klart. */
httpServer.requestTimeout = 0
httpServer.headersTimeout = 660000

;(async () => {
  try {
    console.log('Laster AI-handlere og PDF-moduler (kan ta tid ved treg disk) …')
    const [
      { handleAnalyze },
      { handleContractChat },
      { buildReportHtml },
      { buildAiChatPdfHtml },
      { summarizeAiChatLinesForPdf },
      { fetchStaticMapAsDataUrl },
    ] = await Promise.all([
      import('./analyzeHandler.js'),
      import('./contractChatHandler.js'),
      import('./reportHtml.js'),
      import('./aiChatPdfHtml.js'),
      import('./aiChatPdfSummary.js'),
      import('./staticMap.js'),
    ])

    app.post('/api/analyze', handleAnalyze)
    app.post('/analyze', handleAnalyze)
    app.post('/api/contract-chat', handleContractChat)

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
        res.setHeader(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        )
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

    app.post('/api/ai-chat-pdf-summary', async (req, res) => {
      try {
        const body = req.body
        if (!body || typeof body !== 'object') {
          res.status(400).json({ error: 'Ugyldig JSON.' })
          return
        }
        const lines = Array.isArray(body.lines) ? body.lines : []
        if (!lines.length) {
          res.status(400).json({ error: 'Ingen samtale å oppsummere.' })
          return
        }
        const out = await summarizeAiChatLinesForPdf(lines, {
          contractMode: Boolean(body.contractMode),
        })
        res.json(out)
      } catch (err) {
        console.error('ai-chat-pdf-summary:', err)
        res.status(500).json({
          error:
            err && typeof err === 'object' && 'message' in err
              ? String(/** @type {{ message: string }} */ (err).message)
              : 'Oppsummering feilet.',
        })
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

        let conclusion =
          typeof body.conclusion === 'string' ? body.conclusion.trim() : ''
        let highlights = Array.isArray(body.highlights) ? body.highlights : []
        const lines = Array.isArray(body.lines) ? body.lines : []

        if (!conclusion && lines.length > 0) {
          try {
            const sum = await summarizeAiChatLinesForPdf(lines, {
              contractMode: Boolean(body.contractMode),
            })
            conclusion = sum.conclusion
            highlights = sum.highlights
          } catch (sumErr) {
            console.warn('generate-ai-chat-pdf summarize:', sumErr)
          }
        }

        const html = buildAiChatPdfHtml({
          ...body,
          conclusion,
          highlights,
          lines,
        })

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

    routesReady = true
    console.log('Alle API-ruter er klare (/api/analyze, /api/contract-chat, PDF, …).')
  } catch (e) {
    console.error('Kunne ikke laste server-moduler:', e)
    process.exit(1)
  }
})()

process.on('SIGINT', async () => {
  if (browserInstance) await browserInstance.close()
  process.exit(0)
})
