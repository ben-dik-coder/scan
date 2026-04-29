/**
 * DelSky v1 mot Cloudflare R2 (S3-kompatibel API) + Supabase JWT.
 * Miljø: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *        + SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (allerede i server/.env).
 */

import { createClient } from '@supabase/supabase-js'
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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

const DELSKY_QUOTA_BYTES = 50 * 1024 * 1024 * 1024

/**
 * @param {unknown} v
 * @returns {number}
 */
function asSafeInt(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n)
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {number}
 */
function supabaseObjectSizeBytes(row) {
  if (!row || typeof row !== 'object') return 0
  const meta =
    row.metadata && typeof row.metadata === 'object'
      ? /** @type {Record<string, unknown>} */ (row.metadata)
      : null
  if (!meta) return 0
  return (
    asSafeInt(meta.size) ||
    asSafeInt(meta.contentLength) ||
    asSafeInt(meta.content_length) ||
    asSafeInt(meta.bytes)
  )
}

/**
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function listR2UsageBytesForUser(userId) {
  const s3 = getR2Client()
  if (!s3) return 0
  const Bucket = envStr('R2_BUCKET_NAME')
  if (!Bucket) return 0
  const prefixes = [`${userId}/`, `users/${userId}/`]
  let total = 0
  for (const Prefix of prefixes) {
    let token = undefined
    do {
      const out = await s3.send(
        new ListObjectsV2Command({
          Bucket,
          Prefix,
          ContinuationToken: token,
          MaxKeys: 1000,
        }),
      )
      const rows = Array.isArray(out.Contents) ? out.Contents : []
      for (const row of rows) {
        total += asSafeInt(row?.Size)
      }
      token = out.IsTruncated ? out.NextContinuationToken : undefined
    } while (token)
  }
  return total
}

/**
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function listSupabaseUsageBytesForUser(userId) {
  if (!supabaseAuthConfigured()) return 0
  let sb
  try {
    sb = createClient(envStr('SUPABASE_URL'), envStr('SUPABASE_SERVICE_ROLE_KEY'))
  } catch {
    return 0
  }
  let from = 0
  const page = 1000
  let total = 0
  while (true) {
    const to = from + page - 1
    const { data, error } = await sb
      .from('storage.objects')
      .select('name,owner,bucket_id,metadata')
      .or(`owner.eq.${userId},name.like.${userId}/%`)
      .range(from, to)
    if (error) {
      throw error
    }
    const rows = Array.isArray(data) ? data : []
    for (const row of rows) {
      total += supabaseObjectSizeBytes(
        /** @type {Record<string, unknown>} */ (row),
      )
    }
    if (rows.length < page) break
    from += page
  }
  return total
}

const PRESIGN_PUT_EXPIRES_SEC = 3600
const SIGNED_GET_EXPIRES_MIN = 60
const SIGNED_GET_EXPIRES_MAX = 86_400

/**
 * @param {string} userId
 * @param {string} raw klient-sti (f.eks. userId/photos/…/full.jpg)
 * @returns {string | null} trygg object key eller null
 */
function assertPhotoPathOwnedByUser(userId, raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const p = raw.trim()
  if (p.includes('..') || p.includes('\\') || p.startsWith('/')) return null
  const prefix = `${userId}/`
  if (!p.startsWith(prefix)) return null
  return p
}

/**
 * @param {import('express').Application} app
 */
export function registerScanixCloudV1R2Routes(app) {
  app.get('/v1/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/v1/storage/usage-summary', async (req, res) => {
    const uid = await userIdFromBearer(req)
    if (!uid) {
      res.status(401).json({ error: 'Uautorisert' })
      return
    }
    try {
      const [r2Bytes, supabaseBytes] = await Promise.all([
        listR2UsageBytesForUser(uid),
        listSupabaseUsageBytesForUser(uid),
      ])
      const usedBytes = r2Bytes + supabaseBytes
      const percent = Math.min(100, (usedBytes / DELSKY_QUOTA_BYTES) * 100)
      res.json({
        quotaBytes: DELSKY_QUOTA_BYTES,
        usedBytes,
        percent,
        bySource: {
          r2Bytes,
          supabaseBytes,
        },
        nearLimit: usedBytes >= DELSKY_QUOTA_BYTES * 0.85,
        overLimit: usedBytes >= DELSKY_QUOTA_BYTES,
        updatedAt: new Date().toISOString(),
      })
    } catch (e) {
      console.error('storage usage summary:', e)
      res.status(500).json({ error: 'Kunne ikke hente lagringsbruk.' })
    }
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

  app.post('/v1/photos/presign-put', async (req, res) => {
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
    const fullPath =
      body && typeof body.fullPath === 'string' ? body.fullPath : ''
    const thumbPath =
      body && typeof body.thumbPath === 'string' ? body.thumbPath : ''
    const keyFull = assertPhotoPathOwnedByUser(uid, fullPath)
    const keyThumb = assertPhotoPathOwnedByUser(uid, thumbPath)
    if (!keyFull || !keyThumb) {
      res.status(400).json({ error: 'Ugyldig sti' })
      return
    }
    const fullCt =
      body &&
      typeof body.fullContentType === 'string' &&
      body.fullContentType.trim()
        ? body.fullContentType.trim()
        : 'image/jpeg'
    const thumbCt =
      body &&
      typeof body.thumbContentType === 'string' &&
      body.thumbContentType.trim()
        ? body.thumbContentType.trim()
        : 'image/jpeg'
    const s3 = getR2Client()
    if (!s3) {
      res.status(503).json({ error: 'R2-klient kunne ikke opprettes (sjekk nøkler og konto-ID).' })
      return
    }
    const Bucket = envStr('R2_BUCKET_NAME')
    try {
      const fullPutUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket,
          Key: keyFull,
          ContentType: fullCt,
        }),
        { expiresIn: PRESIGN_PUT_EXPIRES_SEC },
      )
      const thumbPutUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket,
          Key: keyThumb,
          ContentType: thumbCt,
        }),
        { expiresIn: PRESIGN_PUT_EXPIRES_SEC },
      )
      res.json({ fullPutUrl, thumbPutUrl })
    } catch (e) {
      console.error('R2 presign PutObject photos:', e)
      res.status(500).json({ error: 'Kunne ikke presigne opplasting.' })
    }
  })

  app.get('/v1/photos/signed-url', async (req, res) => {
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
    const pathParam =
      typeof req.query.path === 'string' ? req.query.path : ''
    const key = assertPhotoPathOwnedByUser(uid, pathParam)
    if (!key) {
      res.status(400).json({ error: 'Ugyldig sti' })
      return
    }
    let expiresSec = 3600
    if (typeof req.query.expires === 'string') {
      const n = Number.parseInt(req.query.expires, 10)
      if (!Number.isNaN(n)) {
        expiresSec = Math.min(
          SIGNED_GET_EXPIRES_MAX,
          Math.max(SIGNED_GET_EXPIRES_MIN, n),
        )
      }
    }
    const s3 = getR2Client()
    if (!s3) {
      res.status(503).json({ error: 'R2-klient kunne ikke opprettes (sjekk nøkler og konto-ID).' })
      return
    }
    const Bucket = envStr('R2_BUCKET_NAME')
    try {
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket, Key: key }),
        { expiresIn: expiresSec },
      )
      res.json({ url })
    } catch (e) {
      console.error('R2 presign GetObject photo:', e)
      res.status(500).json({ error: 'Kunne ikke lage signert URL.' })
    }
  })
}
