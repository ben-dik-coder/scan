/**
 * DelSky v1 mot Cloudflare R2 (S3-kompatibel API) + Supabase JWT.
 * Miljø: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *        + SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (allerede i server/.env).
 */

import { createClient } from '@supabase/supabase-js'
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

/** @type {S3Client | null} */
let r2Client = null

/**
 * Les .env-verdi uten anførselstegn rundt (vanlig feil: R2_ACCOUNT_ID="abc").
 * @param {string} name
 */
function envStr(name) {
  const v = process.env[name]
  if (typeof v !== 'string') return ''
  let t = v.trim()
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim()
  }
  return t
}

function r2Configured() {
  return Boolean(
    envStr('R2_ACCOUNT_ID') &&
      envStr('R2_ACCESS_KEY_ID') &&
      envStr('R2_SECRET_ACCESS_KEY') &&
      envStr('R2_BUCKET_NAME'),
  )
}

/** @returns {string | null} gyldig R2 S3-endepunkt eller null */
function r2EndpointUrl() {
  const accountId = envStr('R2_ACCOUNT_ID')
  if (!accountId) return null
  const ep = `https://${accountId}.r2.cloudflarestorage.com`
  try {
    const u = new URL(ep)
    if (!u.hostname || !u.hostname.endsWith('.r2.cloudflarestorage.com')) return null
    return ep
  } catch {
    return null
  }
}

function supabaseAuthConfigured() {
  const url = envStr('SUPABASE_URL')
  const key = envStr('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return false
  try {
    const u = new URL(url)
    return Boolean(u.protocol === 'https:' || u.protocol === 'http:') && Boolean(u.hostname)
  } catch {
    return false
  }
}

function getR2Client() {
  if (!r2Configured()) return null
  const endpoint = r2EndpointUrl()
  if (!endpoint) {
    console.error(
      '[DelSky R2] Ugyldig R2_ACCOUNT_ID — må være Cloudflare «Account ID» (kun tegnene, ingen https://, ingen anførselstegn).',
    )
    return null
  }
  if (r2Client) return r2Client
  try {
    r2Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: envStr('R2_ACCESS_KEY_ID'),
        secretAccessKey: envStr('R2_SECRET_ACCESS_KEY'),
      },
    })
  } catch (e) {
    console.error('[DelSky R2] Kunne ikke opprette S3-klient:', e)
    return null
  }
  return r2Client
}

/**
 * @param {import('express').Request} req
 * @returns {Promise<string | null>} Supabase user id
 */
async function userIdFromBearer(req) {
  const raw = req.headers.authorization
  if (!raw || typeof raw !== 'string') return null
  const m = raw.match(/^Bearer\s+(.+)$/i)
  const jwt = m?.[1]?.trim()
  if (!jwt || !supabaseAuthConfigured()) return null
  const url = envStr('SUPABASE_URL')
  const key = envStr('SUPABASE_SERVICE_ROLE_KEY')
  let sb
  try {
    sb = createClient(url, key)
  } catch (e) {
    console.error(
      '[DelSky] Ugyldig SUPABASE_URL i server/.env (må være full https://… .supabase.co — uten anførselstegn):',
      e,
    )
    return null
  }
  const {
    data: { user },
    error,
  } = await sb.auth.getUser(jwt)
  if (error || !user?.id) return null
  return user.id
}

/**
 * @param {string} userId
 */
function appStateObjectKey(userId) {
  return `users/${userId}/app-state.json`
}

/**
 * @param {import('express').Application} app
 */
export function registerScanixCloudV1R2Routes(app) {
  app.get('/v1/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.head('/v1/app-state', async (req, res) => {
    if (!r2Configured() || !r2EndpointUrl()) {
      res.status(503).end()
      return
    }
    const uid = await userIdFromBearer(req)
    if (!uid) {
      res.status(401).end()
      return
    }
    const s3 = getR2Client()
    if (!s3) {
      res.status(503).end()
      return
    }
    const Bucket = envStr('R2_BUCKET_NAME')
    const Key = appStateObjectKey(uid)
    try {
      await s3.send(new HeadObjectCommand({ Bucket, Key }))
      res.status(200).end()
    } catch {
      res.status(404).end()
    }
  })

  app.get('/v1/app-state/meta', async (req, res) => {
    if (!r2Configured() || !r2EndpointUrl()) {
      res.status(503).json({
        error:
          'R2 er ikke konfigurert eller R2_ACCOUNT_ID er ugyldig — se server/.env og terminal-logg.',
      })
      return
    }
    const uid = await userIdFromBearer(req)
    if (!uid) {
      res.status(401).json({ error: 'Uautorisert' })
      return
    }
    const s3 = getR2Client()
    if (!s3) {
      res.status(503).json({ error: 'R2-klient kunne ikke opprettes (sjekk nøkler og konto-ID).' })
      return
    }
    const Bucket = envStr('R2_BUCKET_NAME')
    const Key = appStateObjectKey(uid)
    try {
      await s3.send(new HeadObjectCommand({ Bucket, Key }))
      res.json({ exists: true })
    } catch {
      res.json({ exists: false })
    }
  })

  app.get('/v1/app-state', async (req, res) => {
    if (!r2Configured() || !r2EndpointUrl()) {
      res.status(503).json({
        error:
          'R2 er ikke konfigurert eller R2_ACCOUNT_ID er ugyldig — se server/.env og terminal-logg.',
      })
      return
    }
    const uid = await userIdFromBearer(req)
    if (!uid) {
      res.status(401).json({ error: 'Uautorisert' })
      return
    }
    const s3 = getR2Client()
    if (!s3) {
      res.status(503).json({ error: 'R2-klient kunne ikke opprettes (sjekk nøkler og konto-ID).' })
      return
    }
    const Bucket = envStr('R2_BUCKET_NAME')
    const Key = appStateObjectKey(uid)
    try {
      const out = await s3.send(new GetObjectCommand({ Bucket, Key }))
      if (!out.Body) {
        res.status(404).end()
        return
      }
      const str = await out.Body.transformToString()
      const parsed = JSON.parse(str)
      res.json(parsed)
    } catch (e) {
      const status = /** @type {{ $metadata?: { httpStatusCode?: number } }} */ (e)
        .$metadata?.httpStatusCode
      if (status === 404) {
        res.status(404).end()
        return
      }
      const name = e && typeof e === 'object' && 'name' in e ? String(e.name) : ''
      if (name === 'NoSuchKey') {
        res.status(404).end()
        return
      }
      console.error('R2 GetObject app-state:', e)
      res.status(500).json({ error: 'Kunne ikke lese app-state fra R2.' })
    }
  })

  app.put('/v1/app-state', async (req, res) => {
    if (!r2Configured() || !r2EndpointUrl()) {
      res.status(503).json({
        error:
          'R2 er ikke konfigurert eller R2_ACCOUNT_ID er ugyldig — se server/.env og terminal-logg.',
      })
      return
    }
    const uid = await userIdFromBearer(req)
    if (!uid) {
      res.status(401).json({ error: 'Uautorisert' })
      return
    }
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'Forventet JSON-objekt som kropp.' })
      return
    }
    const s3 = getR2Client()
    if (!s3) {
      res.status(503).json({ error: 'R2-klient kunne ikke opprettes (sjekk nøkler og konto-ID).' })
      return
    }
    const Bucket = envStr('R2_BUCKET_NAME')
    const Key = appStateObjectKey(uid)
    try {
      const buf = Buffer.from(JSON.stringify(body), 'utf8')
      await s3.send(
        new PutObjectCommand({
          Bucket,
          Key,
          Body: buf,
          ContentType: 'application/json',
        }),
      )
      res.status(204).end()
    } catch (e) {
      console.error('R2 PutObject app-state:', e)
      res.status(500).json({ error: 'Kunne ikke lagre app-state til R2.' })
    }
  })
}
