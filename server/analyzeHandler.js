/**
 * POST /api/analyze — OpenAI vision + tekst (veivokter-rapport).
 * Krever OPENAI_API_KEY. Modell: OPENAI_MODEL (standard gpt-4.1).
 */

import OpenAI from 'openai'

const DEFAULT_MODEL = 'gpt-4.1'

const SYSTEM_PROMPT = `Du er en erfaren veivokter i Norge.
Analyser bildet og teksten fra brukeren.

Fokuser på:
- raske og praktiske løsninger
- vinterforhold
- sikkerhet

Svar kort og konkret.

Returner JSON med:
- problem
- risk
- action
- explanation
- report (ferdig skrevet rapport klar til bruk)

Svar ALLTID med gyldig JSON-objekt med nøklene problem, risk, action, explanation, report. Bruk norsk.`

/**
 * @param {string} image
 * @returns {Promise<string>} image_url for OpenAI (https eller data: URL)
 */
async function normalizeImageForOpenAI(image) {
  const t = image.trim()
  if (t.startsWith('https://') || t.startsWith('http://')) {
    const r = await fetch(t, {
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
    })
    if (!r.ok) {
      throw new Error(`Kunne ikke hente bilde-URL (${r.status}).`)
    }
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > 20 * 1024 * 1024) {
      throw new Error('Bildet fra URL er for stort (maks 20 MB).')
    }
    const ct = (r.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
    const safeCt = ct.startsWith('image/') ? ct : 'image/jpeg'
    return `data:${safeCt};base64,${buf.toString('base64')}`
  }
  if (t.startsWith('data:image/')) {
    return t
  }
  const b64 = t.replace(/\s/g, '')
  if (!b64.length) throw new Error('Tomt bildeinnhold.')
  return `data:image/jpeg;base64,${b64}`
}

function buildUserText(text, vehicle, temperature) {
  let s = `Brukerens beskrivelse:\n${String(text).trim()}`
  if (vehicle != null && String(vehicle).trim()) {
    s += `\n\nKjøretøy/utstyr (valgfritt): ${String(vehicle).trim()}`
  }
  if (temperature != null && String(temperature).trim()) {
    s += `\n\nTemperatur / føreforhold (valgfritt): ${String(temperature).trim()}`
  }
  return s
}

function coerceResult(obj) {
  const keys = ['problem', 'risk', 'action', 'explanation', 'report']
  const out = {}
  for (const k of keys) {
    const v = obj && typeof obj === 'object' ? obj[k] : null
    out[k] = typeof v === 'string' ? v : v != null ? String(v) : ''
  }
  return out
}

/** @type {OpenAI | null} */
let client = null

function getClient() {
  const key = process.env.OPENAI_API_KEY
  if (!key || !key.trim()) return null
  if (!client) {
    client = new OpenAI({ apiKey: key.trim() })
  }
  return client
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function handleAnalyze(req, res) {
  try {
    const body = req.body
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Ugyldig JSON.' })
      return
    }

    const { image, text, vehicle, temperature } = body

    if (text == null || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Mangler tekst (beskrivelse).' })
      return
    }
    if (image == null || typeof image !== 'string' || !String(image).trim()) {
      res.status(400).json({ error: 'Mangler bilde (URL eller base64).' })
      return
    }

    const openai = getClient()
    if (!openai) {
      res.status(503).json({
        error:
          'OPENAI_API_KEY er ikke satt. Legg til nøkkel i miljøvariabler for serveren.',
      })
      return
    }

    const imageUrl = await normalizeImageForOpenAI(String(image))
    const userText = buildUserText(text, vehicle, temperature)
    const model = (process.env.OPENAI_MODEL || DEFAULT_MODEL).trim()

    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      max_tokens: 2500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            {
              type: 'image_url',
              image_url: { url: imageUrl, detail: 'high' },
            },
          ],
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw || typeof raw !== 'string') {
      res.status(502).json({ error: 'Tomt svar fra modellen.' })
      return
    }

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      res.status(502).json({ error: 'Kunne ikke tolke JSON fra modellen.' })
      return
    }

    const result = coerceResult(parsed)
    res.json(result)
  } catch (err) {
    console.error('analyze:', err)
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message: string }} */ (err).message)
        : 'Analyse feilet.'
    /** Ikke videresend OpenAI sin HTTP-status (f.eks. 404 ved ukjent modell) — gir «feil 404» i appen uten tydelig årsak. */
    const hint =
      /404|model/i.test(msg) && !/fetch|connect/i.test(msg)
        ? ' Sjekk OPENAI_MODEL i server/.env (f.eks. gpt-4o).'
        : ''
    res.status(502).json({ error: `${msg}${hint}` })
  }
}
