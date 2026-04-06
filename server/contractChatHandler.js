/**
 * POST /api/contract-chat — RAG mot contract_chunks (Supabase pgvector).
 * Krever: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Brukermeldinger kan være ren tekst eller multimodal (tekst + image_url, OpenAI-format).
 * Svarmodell (OPENAI_CONTRACT_MODEL / gpt-5-mini) må støtte vision for bilde.
 *
 * Kvalitet: stort vektor-trekk → hybrid merge → (valgfritt) query-utvidelse ved embedding
 * → LLM-rerank til færre, mest relevante utdrag → svarmodell.
 */

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

import { modelSupportsCustomTemperature } from './openaiModelHelpers.js'

const EMBEDDING_MODEL =
  process.env.CONTRACT_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small'
const EMBEDDING_DIM = Math.min(
  3072,
  Math.max(256, Number(process.env.CONTRACT_EMBEDDING_DIM || 1536)),
)
const CHAT_MODEL = process.env.OPENAI_CONTRACT_MODEL || 'gpt-5-mini'

/** Vektor-treff fra DB (pool før rerank). Må matche eller underskride match_contract_chunks limit (100). */
const POOL_MATCH_COUNT = Math.min(
  80,
  Math.max(8, Number(process.env.CONTRACT_RAG_POOL_MATCH_COUNT || 32)),
)

/** Maks utdrag etter vektor+nøkkelord før rerank (kap på token til reranker). */
const MERGE_POOL_MAX = Math.min(
  64,
  Math.max(12, Number(process.env.CONTRACT_RAG_MERGE_POOL_MAX || 44)),
)

/** Utdrag sendt til svarmodellen etter rerank (kvalitet > kvantitet). */
const MAX_CONTEXT_CHUNKS = Math.min(
  28,
  Math.max(8, Number(process.env.CONTRACT_RAG_MAX_CONTEXT_CHUNKS || 12)),
)

const KEYWORD_SUPPLEMENT = Math.min(
  20,
  Math.max(0, Number(process.env.CONTRACT_RAG_KEYWORD_SUPPLEMENT || 14)),
)

const RERANK_MODEL =
  process.env.CONTRACT_RAG_RERANK_MODEL?.trim() || 'gpt-4o-mini'
const RERANK_INPUT_MAX = Math.min(
  40,
  Math.max(12, Number(process.env.CONTRACT_RAG_RERANK_INPUT_MAX || 32)),
)

/** Maks utdrag per prosess før backfill når multi-intent (post-rerank). */
const PROCESS_CAP_PER_PROCESS = Math.min(
  10,
  Math.max(1, Number(process.env.CONTRACT_RAG_PROCESS_CAP_PER_PROCESS || 3)),
)

/** Lavere standard = kortere svar (kan økes med CONTRACT_RAG_MAX_COMPLETION_TOKENS). */
const MAX_COMPLETION_TOKENS = Math.min(
  4096,
  Math.max(400, Number(process.env.CONTRACT_RAG_MAX_COMPLETION_TOKENS || 1100)),
)

/**
 * GPT-5 / o-modeller bruker resonneringstokens som trekkes fra samme `max_completion_tokens`.
 * «Kort modus» (560) kan da bruke hele budsjettet før synlig tekst → tomt svar.
 * @param {string} model
 */
function modelUsesReasoningOutputBudget(model) {
  const m = String(model || '').toLowerCase()
  if (m.includes('gpt-5')) return true
  if (/^o[0-9]/.test(m)) return true
  if (/\bo3\b|\bo1\b|\bo4-mini\b/.test(m)) return true
  return false
}

/**
 * @param {string} model
 * @param {boolean} compactMode
 */
function getContractChatCompletionMaxTokens(model, compactMode) {
  const base = MAX_COMPLETION_TOKENS
  let cap = compactMode ? Math.min(420, base) : base
  if (modelUsesReasoningOutputBudget(model)) {
    const floor = Math.min(
      16384,
      Math.max(
        4096,
        Number(process.env.CONTRACT_RAG_REASONING_COMPLETION_TOKEN_FLOOR || 8192),
      ),
    )
    cap = Math.max(cap, floor)
  }
  return Math.min(16384, cap)
}

/** Svarmodell: høyere = mer variert resonnement (gpt-5 ignorerer temperature). */
function getContractChatTemperature() {
  const v = process.env.CONTRACT_RAG_TEMPERATURE
  if (v == null || String(v).trim() === '') return 0.35
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.35
}

function isEnvEnabled(name, defaultTrue = true) {
  const v = process.env[name]
  if (v == null || String(v).trim() === '') return defaultTrue
  const s = String(v).trim().toLowerCase()
  if (['0', 'false', 'off', 'no'].includes(s)) return false
  if (['1', 'true', 'on', 'yes'].includes(s)) return true
  return defaultTrue
}

/** Cosinus-likhet 0–1; filtrerer svake treff (mindre støy → mindre hallusinasjon). Tomt treff → retry med 0. */
function getContractRagMinSimilarity() {
  const v = process.env.CONTRACT_RAG_MIN_SIMILARITY
  if (v == null || String(v).trim() === '') return 0.1
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(0.95, Math.max(0, n)) : 0.1
}

/** @type {OpenAI | null} */
let openaiClient = null
/** @type {ReturnType<typeof createClient> | null} */
let supabaseAdmin = null

function getOpenAiTimeoutMs() {
  const v = process.env.OPENAI_TIMEOUT_MS
  if (v == null || String(v).trim() === '') return 720_000
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(1_800_000, Math.max(60_000, n)) : 720_000
}

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY
  if (!key?.trim()) return null
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: key.trim(),
      timeout: getOpenAiTimeoutMs(),
    })
  }
  return openaiClient
}

function getSupabase() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return supabaseAdmin
}

/** @returns {string[]} navn på manglende variabler */
function getMissingContractEnvVars() {
  const m = []
  if (!process.env.OPENAI_API_KEY?.trim()) m.push('OPENAI_API_KEY')
  if (!process.env.SUPABASE_URL?.trim()) m.push('SUPABASE_URL')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    m.push('SUPABASE_SERVICE_ROLE_KEY')
  }
  return m
}

/**
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedQuery(text) {
  const openai = getOpenAI()
  if (!openai) throw new Error('OPENAI_API_KEY mangler.')
  const t = String(text).trim()
  if (!t) throw new Error('Tom tekst for embedding.')
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: t.length > 8000 ? t.slice(0, 8000) : t,
    dimensions: EMBEDDING_DIM,
  })
  const emb = res.data?.[0]?.embedding
  if (!Array.isArray(emb) || emb.length !== EMBEDDING_DIM) {
    throw new Error('Ugyldig embedding-svar fra OpenAI.')
  }
  return emb
}

const QUERY_EXPAND_MODEL =
  process.env.CONTRACT_RAG_QUERY_EXPAND_MODEL?.trim() || 'gpt-4o-mini'

/**
 * Utvider brukerens spørsmål med fagord/synonymer for bedre vektor-treff (valgfritt).
 * @param {OpenAI} openai
 * @param {string} query
 */
async function expandQueryForRetrieval(openai, query) {
  const q = String(query).trim()
  if (!q || q.length > 12_000) return q
  const completion = await openai.chat.completions.create({
    model: QUERY_EXPAND_MODEL,
    response_format: { type: 'json_object' },
    max_completion_tokens: 400,
    messages: [
      {
        role: 'system',
        content:
          'Du hjelper med semantisk søk i norske anskaffelses-/veikontrakter (drift, vedlikehold, veg, grøfter, snø, merking). Returner JSON: {"search_text":"..."} der search_text er én kort søkeforespørsel (2–5 setninger) som gjengir brukerens intensjon og legger til relevante fagord, prosess-/kapittelhenvisninger hvis brukeren nevnte dem, og nære synonymer. Ikke svar på spørsmålet; ikke moraliser. Hvis teksten allerede er presis, kan du returnere den nesten uendret i search_text.',
      },
      { role: 'user', content: q },
    ],
  })
  const raw = completion.choices?.[0]?.message?.content?.trim() || ''
  try {
    const parsed = JSON.parse(raw)
    const st =
      parsed && typeof parsed.search_text === 'string'
        ? parsed.search_text.trim()
        : ''
    if (st.length >= 8) {
      return `${q}\n\n${st}`.slice(0, 8000)
    }
  } catch {
    /* fall back */
  }
  return q
}

/**
 * Enkel heuristikk for flere delkrav i samme spørsmål (ingen LLM).
 * @param {string} text
 */
function detectMultiIntentQuery(text) {
  const t = String(text || '').trim()
  if (t.length < 10) return false
  if (/\balle\b/i.test(t)) return true
  if (/\binkludert\b/i.test(t)) return true
  if ((t.match(/,/g) || []).length >= 2) return true
  if (/\bog\b[^.]{0,120}\bog\b/is.test(t)) return true
  const lines = t.split(/\r?\n/)
  let bulletish = 0
  for (const line of lines) {
    if (/^\s*(?:[-*•]|\d+\.)\s+\S/.test(line)) bulletish++
  }
  if (bulletish >= 2) return true
  return false
}

/**
 * Stabil nøkkel per «prosess» for diversitet. Leser metadata først, ellers start av innhold.
 * @param {unknown} row
 */
function getChunkProcessKey(row) {
  if (row && typeof row === 'object' && row !== null && 'metadata' in row) {
    const m = /** @type {{ metadata?: unknown }} */ (row).metadata
    if (m && typeof m === 'object') {
      const o = /** @type {Record<string, unknown>} */ (m)
      for (const k of [
        'process_number',
        'process_id',
        'prosess',
        'prosessnummer',
        'section',
      ]) {
        const v = o[k]
        if (v != null && String(v).trim()) return `meta:${k}:${String(v).trim()}`
      }
    }
  }
  const content =
    row && typeof row === 'object' && row !== null && 'content' in row
      ? String(/** @type {{ content?: string }} */ (row).content ?? '')
      : ''
  const head = content.trim().slice(0, 600)
  const proc = head.match(/(?:^|[\n\r])\s*(?:§\s*)?(\d+(?:\.\d+)+)\b/)
  if (proc) return `proc:${proc[1]}`
  const sec = head.match(/(?:^|[\n\r])\s*§\s*(\d+)\b/)
  if (sec) return `sec:${sec[1]}`
  const id =
    row && typeof row === 'object' && row !== null && 'id' in row
      ? /** @type {{ id?: unknown }} */ (row).id
      : null
  return id != null ? `id:${String(id)}` : 'unknown'
}

/**
 * @param {unknown} chunk
 * @param {number} index
 */
function chunkSelectionId(chunk, index) {
  if (
    chunk &&
    typeof chunk === 'object' &&
    chunk !== null &&
    'id' in chunk &&
    /** @type {{ id?: unknown }} */ (chunk).id != null
  ) {
    return `id:${String(/** @type {{ id?: unknown }} */ (chunk).id)}`
  }
  return `idx:${index}:${getChunkProcessKey(chunk)}`
}

/**
 * Cap per prosess i rangert rekkefølge, deretter backfill til finalK.
 * @param {unknown[]} rankedChunks
 * @param {number} finalK
 * @param {number} capPerProcess
 */
function applyProcessDiversityAndBackfill(rankedChunks, finalK, capPerProcess) {
  const list = /** @type {any[]} */ (Array.isArray(rankedChunks) ? rankedChunks : [])
  if (!list.length || finalK <= 0) return []
  const cap = Math.max(1, capPerProcess)
  const selected = /** @type {any[]} */ ([])
  const selectedIds = new Set()
  const counts = new Map()

  for (let i = 0; i < list.length; i++) {
    if (selected.length >= finalK) break
    const chunk = list[i]
    const key = getChunkProcessKey(chunk)
    if ((counts.get(key) ?? 0) >= cap) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
    const sid = chunkSelectionId(chunk, i)
    if (selectedIds.has(sid)) continue
    selectedIds.add(sid)
    selected.push(chunk)
  }

  for (let i = 0; i < list.length; i++) {
    if (selected.length >= finalK) break
    const chunk = list[i]
    const sid = chunkSelectionId(chunk, i)
    if (selectedIds.has(sid)) continue
    selectedIds.add(sid)
    selected.push(chunk)
  }

  return selected.slice(0, finalK)
}

/**
 * Velger de mest relevante utdragene for svarmodellen (reduserer støy og «nesten riktige» chunks).
 * @param {OpenAI} openai
 * @param {string} userQuery
 * @param {unknown[]} chunks rader med id, content, similarity, metadata
 * @param {number} targetK ønsket antall til svarmodell etter diversitet (multi-intent) eller direkte (vanlig)
 * @param {{ multiIntent?: boolean }} [opts]
 */
async function rerankRetrievalChunks(openai, userQuery, chunks, targetK, opts) {
  const multiIntent = Boolean(opts && opts.multiIntent)
  if (!chunks.length || chunks.length <= targetK) {
    return /** @type {any[]} */ (chunks)
  }
  const pool = chunks.slice(
    0,
    Math.min(chunks.length, RERANK_INPUT_MAX),
  )
  const maxAsk = multiIntent
    ? Math.min(2 * targetK, RERANK_INPUT_MAX, pool.length)
    : Math.min(targetK, pool.length)
  const multiRerankHint = multiIntent
    ? ' Spørsmålet kan kreve svar fra flere ulike deler av kontrakten. Ikke la én enkelt prosess eller paragraf dominere listen — prioriter **bred dekning** av ulike relevante utdrag når flere krav eller tema er implisitt. Inkluder gjerne flere indekser (opp til maks) slik at ulike prosesser kan komme med.'
    : ''
  const previews = pool.map((row, i) => {
    const content =
      row && typeof row === 'object' && row !== null && 'content' in row
        ? String(/** @type {{ content?: string }} */ (row).content ?? '')
        : ''
    const excerpt = content.trim().slice(0, 1450)
    return `[${i}]\n${excerpt}${content.length > 1450 ? '\n…' : ''}`
  })
  const listing = previews.join('\n\n---\n\n')
  const completion = await openai.chat.completions.create({
    model: RERANK_MODEL,
    response_format: { type: 'json_object' },
    max_completion_tokens: 500,
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: `Du rangerer utdrag fra et kontraktsdokument etter relevans for brukerens spørsmål. Returner JSON: {"indices":[...]} der indices er en liste av 0-baserte indekser (0–${pool.length - 1}), sortert fra mest til minst relevant. Inkluder maks ${maxAsk} indekser. Utelat indekser som ikke hjelper med å besvare spørsmålet. Ved tvil: inkluder utdrag som kan inneholde sitatbar ordlyd.${multiRerankHint}`,
      },
      {
        role: 'user',
        content: `SPØRSMÅL:\n${String(userQuery).slice(0, 6000)}\n\nNUMMERERTE UTDDRAG:\n${listing}`,
      },
    ],
  })
  const raw = completion.choices?.[0]?.message?.content?.trim() || ''
  let indices = []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.indices)) {
      indices = parsed.indices
        .map((n) => (typeof n === 'number' ? n : parseInt(String(n), 10)))
        .filter((n) => Number.isFinite(n) && n >= 0 && n < pool.length)
    }
  } catch {
    return /** @type {any[]} */ (pool.slice(0, maxAsk))
  }
  const seen = new Set()
  const ordered = []
  for (const idx of indices) {
    if (seen.has(idx)) continue
    seen.add(idx)
    ordered.push(pool[idx])
    if (ordered.length >= maxAsk) break
  }
  if (ordered.length === 0) {
    return /** @type {any[]} */ (pool.slice(0, maxAsk))
  }
  return ordered
}

/**
 * Kun tekst til sluttbruker: stripper [FORSTÅELSE]/[SVAR]/[LOGIKK]/[KILDE] hvis modellen
 * fortsatt sender gammelt strukturformat.
 * @param {string} raw
 */
/**
 * OpenAI kan returnere assistant.content som streng eller liste (gpt-5 m.fl.).
 * @param {unknown} message
 * @returns {string}
 */
function textFromAssistantMessage(message) {
  if (!message || typeof message !== 'object') return ''
  const m = /** @type {Record<string, unknown>} */ (message)
  if (typeof m.refusal === 'string' && m.refusal.trim()) {
    return m.refusal.trim()
  }
  const c = m.content
  if (typeof c === 'string') return c
  if (Array.isArray(c)) {
    return c
      .map((part) => {
        if (!part || typeof part !== 'object') return ''
        const p = /** @type {Record<string, unknown>} */ (part)
        if (typeof p.text === 'string') return p.text
        if (typeof p.output_text === 'string') return p.output_text
        return ''
      })
      .join('')
  }
  if (c == null) {
    if (typeof m.output_text === 'string') return m.output_text
    return ''
  }
  return String(c)
}

function extractContractUserReply(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return ''

  const afterSvar = t.match(
    /\[SVAR\]\s*:?\s*([\s\S]*?)(?=\n\s*\[(?:FORSTÅELSE|LOGIKK|KILDE|SVAR)\]|\s*$)/i,
  )
  if (afterSvar && afterSvar[1] && afterSvar[1].trim()) {
    return afterSvar[1].trim()
  }

  let s = t
  s = s.replace(/\[FORSTÅELSE\][\s\S]*?(?=\n\s*\[|$)/gi, '')
  s = s.replace(/\[LOGIKK\][\s\S]*?(?=\n\s*\[|$)/gi, '')
  s = s.replace(/\[KILDE\][\s\S]*$/gi, '')
  s = s.replace(/\[KILDE\][\s\S]*?(?=\n\s*\[|$)/gi, '')
  s = s.trim()
  if (s) return s

  // Modellen skrev bare metadata-blokker: fjern kjente tagger og behold evt. ren tekst
  const stripped = t
    .replace(/\[(?:FORSTÅELSE|LOGIKK|KILDE|SVAR)\]\s*:?\s*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (stripped) return stripped

  const noTags = t.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim()
  return noTags || ''
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @param {unknown} e
 * @returns {boolean}
 */
function isTransientOpenAIError(e) {
  if (!e || typeof e !== 'object') return false
  const rec = /** @type {Record<string, unknown>} */ (e)
  const status = rec.status
  if (status === 429 || status === 502 || status === 503 || status === 504)
    return true
  const code = rec.code
  if (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED'
  ) {
    return true
  }
  const msg = String(rec.message ?? '')
  if (/timeout|timed out|ECONNRESET|socket|rate limit|overloaded/i.test(msg))
    return true
  return false
}

const NO_STOP = new Set(
  `alle andre bare ble bli blir brukt bør da de deg den der det din disse du eller en er et ett fra før får har her hva hvem hvilke hvilken hvis hvor hvordan ikke inn jeg kan kom kun litt man med meg men mer min mot mye nei noe noen nå og også om opp oss over på samme seg selv si sin sine sitt skal slik som så tid til under ut være vært var ved vi vil vår år`.split(
    /\s+/,
  ),
)

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractKeywordTerms(text) {
  const raw = String(text).toLowerCase()
  const tokens = raw.match(/[0-9]+(?:[,.][0-9]+)?|[a-zæøå]+/gi) || []
  const out = []
  for (const tok of tokens) {
    const t = tok.trim()
    if (t.length < 2) continue
    if (t.length < 4 && /^\d+$/.test(t)) {
      out.push(t)
      continue
    }
    if (t.length < 4) continue
    if (NO_STOP.has(t)) continue
    out.push(t)
  }
  const seen = new Set()
  const uniq = []
  for (const t of out.sort((a, b) => b.length - a.length)) {
    if (seen.has(t)) continue
    seen.add(t)
    uniq.push(t)
  }
  return uniq.slice(0, 10)
}

/**
 * @param {string} s
 */
function escapeIlike(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Når siste melding bare har bilde (ingen tekstdel), brukes dette til embedding/søk. */
const EMBEDDING_FALLBACK_IMAGE_ONLY =
  'Brukeren har vedlagt et bilde og spør om kontrakten i lys av det som vises.'

/**
 * @param {unknown} content
 * @returns {string}
 */
function extractTextFromMessageContent(content) {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const part of content) {
    if (!part || typeof part !== 'object') continue
    const p = /** @type {Record<string, unknown>} */ (part)
    if (p.type === 'text' && typeof p.text === 'string') {
      parts.push(p.text.trim())
    }
  }
  return parts.join('\n').trim()
}

/**
 * @param {unknown} content
 * @returns {boolean}
 */
function messageHasImagePart(content) {
  if (!Array.isArray(content)) return false
  return content.some((part) => {
    if (!part || typeof part !== 'object') return false
    const p = /** @type {Record<string, unknown>} */ (part)
    return p.type === 'image_url' || p.type === 'input_image'
  })
}

/**
 * Kombiner siste brukermeldinger til bedre semantisk treff (oppfølgingsspørsmål).
 * @param {Array<{ role?: string, content?: unknown }>} messages
 * @param {string} lastUserText
 */
function buildRetrievalQuery(messages, lastUserText) {
  const users = []
  for (let i = messages.length - 1; i >= 0 && users.length < 4; i--) {
    const m = messages[i]
    if (m && m.role === 'user') {
      const t = extractTextFromMessageContent(m.content)
      if (t) users.unshift(t)
      else if (messageHasImagePart(m.content)) {
        users.unshift(EMBEDDING_FALLBACK_IMAGE_ONLY)
      }
    }
  }
  if (users.length <= 1) return lastUserText
  return users.join('\n---\n')
}

/**
 * Hent ekstra chunks via ILIKE på viktige ord (hybrid RAG).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} terms
 */
async function fetchKeywordSupplementChunks(supabase, terms) {
  if (KEYWORD_SUPPLEMENT <= 0 || !terms.length) return []
  const use = terms.slice(0, 8)
  const clauses = []
  for (const t of use) {
    if (t.length < 2) continue
    clauses.push(`content.ilike.%${escapeIlike(t)}%`)
  }
  if (!clauses.length) return []
  const orExpr = clauses.join(',')
  const { data, error } = await supabase
    .from('contract_chunks')
    .select('id, content, metadata')
    .or(orExpr)
    .limit(KEYWORD_SUPPLEMENT)

  if (error) {
    console.warn('contract-chat keyword supplement:', error.message)
    return []
  }
  return Array.isArray(data) ? data : []
}

/**
 * Vektor-treff først, deretter nøkkelord-treff uten duplikat-ID.
 * @param {unknown[]} vectorRows
 * @param {unknown[]} keywordRows
 * @param {number} maxPool maks antall rader før rerank
 */
function mergeVectorAndKeywordChunks(vectorRows, keywordRows, maxPool) {
  const cap = Math.max(MAX_CONTEXT_CHUNKS, maxPool)
  const seen = new Set()
  const out = []
  for (const row of vectorRows) {
    const id = row && typeof row === 'object' && 'id' in row ? row.id : null
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(row)
    if (out.length >= cap) return out
  }
  for (const row of keywordRows) {
    const id = row && typeof row === 'object' && 'id' in row ? row.id : null
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({
      ...row,
      similarity: 0.06,
      _keywordBoost: true,
    })
    if (out.length >= cap) break
  }
  return out
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function handleContractChat(req, res) {
  try {
    const openai = getOpenAI()
    const supabase = getSupabase()
    if (!openai || !supabase) {
      const missing = getMissingContractEnvVars()
      res.status(503).json({
        error:
          missing.length > 0
            ? `Kontrakt-RAG: mangler i server/.env: ${missing.join(', ')}. (Ikke VITE_* – bruk nøyaktig disse navnene i mappen server/)`
            : 'Kontrakt-RAG er ikke konfigurert.',
      })
      return
    }

    const body = req.body
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Ugyldig JSON.' })
      return
    }

    const messages = body.messages
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages må være en ikke-tom tabell.' })
      return
    }
    if (messages.length > 40) {
      res.status(400).json({ error: 'For mange meldinger (maks 40).' })
      return
    }

    /** Siste brukerinnhold (tekst) for embedding; bilde uten tekst → fallback-streng. */
    let lastUserText = ''
    let lastUserHasImage = false
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m && m.role === 'user') {
        lastUserText = extractTextFromMessageContent(m.content)
        lastUserHasImage = messageHasImagePart(m.content)
        break
      }
    }
    if (!lastUserText && lastUserHasImage) {
      lastUserText = EMBEDDING_FALLBACK_IMAGE_ONLY
    }
    if (!lastUserText) {
      res.status(400).json({
        error:
          'Ingen brukermelding med tekst eller bilde funnet. Skriv et spørsmål eller legg ved et bilde.',
      })
      return
    }

    const retrievalQuery = buildRetrievalQuery(messages, lastUserText)
    const multiIntentQuery = detectMultiIntentQuery(retrievalQuery)
    const queryExpandOn = isEnvEnabled('CONTRACT_RAG_QUERY_EXPAND', true)
    const textForEmbedding = queryExpandOn
      ? await expandQueryForRetrieval(openai, retrievalQuery)
      : retrievalQuery
    const queryEmbedding = await embedQuery(textForEmbedding)

    const minSim = getContractRagMinSimilarity()
    let { data: rows, error: rpcError } = await supabase.rpc(
      'match_contract_chunks',
      {
        query_embedding: queryEmbedding,
        match_count: POOL_MATCH_COUNT,
        min_similarity: minSim,
      },
    )

    if (
      !rpcError &&
      minSim > 0 &&
      (!Array.isArray(rows) || rows.length === 0)
    ) {
      const retry = await supabase.rpc('match_contract_chunks', {
        query_embedding: queryEmbedding,
        match_count: POOL_MATCH_COUNT,
        min_similarity: 0,
      })
      rows = retry.data
      rpcError = retry.error
    }

    if (rpcError) {
      console.error('contract-chat rpc:', rpcError)
      res.status(500).json({
        error:
          rpcError.message ||
          'Kunne ikke hente treff fra databasen. Sjekk at SQL for match_contract_chunks er kjørt.',
      })
      return
    }

    const vectorChunks = Array.isArray(rows) ? rows : []
    if (vectorChunks.length === 0) {
      res.status(503).json({
        error:
          'Ingen indeksert kontrakttekst. Kjør: npm run ingest-contract-pdf -- /sti/til/kontrakt.pdf (i server-mappen).',
        reply: null,
      })
      return
    }

    const kwTerms = extractKeywordTerms(retrievalQuery)
    const kwRows = await fetchKeywordSupplementChunks(supabase, kwTerms)
    let chunks = mergeVectorAndKeywordChunks(
      vectorChunks,
      kwRows,
      MERGE_POOL_MAX,
    )

    const rerankOn = isEnvEnabled('CONTRACT_RAG_RERANK', true)
    if (rerankOn && chunks.length > MAX_CONTEXT_CHUNKS) {
      try {
        chunks = await rerankRetrievalChunks(
          openai,
          retrievalQuery,
          chunks,
          MAX_CONTEXT_CHUNKS,
          { multiIntent: multiIntentQuery },
        )
        if (multiIntentQuery) {
          chunks = applyProcessDiversityAndBackfill(
            chunks,
            MAX_CONTEXT_CHUNKS,
            PROCESS_CAP_PER_PROCESS,
          )
        }
      } catch (reErr) {
        console.warn('contract-chat rerank:', reErr)
        chunks = /** @type {any[]} */ (chunks).slice(0, MAX_CONTEXT_CHUNKS)
      }
    } else if (chunks.length > MAX_CONTEXT_CHUNKS) {
      chunks = /** @type {any[]} */ (chunks).slice(0, MAX_CONTEXT_CHUNKS)
    }

    const contextBlock = chunks
      .map((row) => {
        const content =
          row && typeof row.content === 'string' ? row.content.trim() : ''
        return content
      })
      .filter(Boolean)
      .join('\n\n---\n\n')

    const trimmedLast = lastUserText.trim()
    const wantsQuote = /\b(sitat|sitere|ordrett|direkte\s+fra|hvor\s+står|pek\s+til|vis\s+meg|eksakt\s+ordlyd|siter|§\s*\d|paragraf)/i.test(
      lastUserText,
    )
    const shortFollowUp =
      /^ja\s*,?\s*(begge(\s+deler)?|sitater|råd)\b/i.test(trimmedLast) ||
      /^(ja|jepp|jo|ok|gjerne|vis|begge|begge deler|sitater|råd|bare råd|bare sitater)(\s+(begge|sitater|råd|bare\s+råd|bare\s+sitater|delene?))?\s*\.?!?$/i.test(
        trimmedLast,
      )
    const asksForExpanded =
      /\b(ordrett|sitater|sitering|\bsiter\b|vis meg ordlyd|utdyp|mer detalj|lengre svar|full oversikt|praktiske råd|vurdering\s*\/\s*råd)\b/i.test(
        trimmedLast,
      ) ||
      /\b(gi|ønsker|vil ha|trenger|vis)\s+(meg\s+)?(sitater|ordlyd|utdyping|praktiske\s+råd|konkrete\s+råd|faglige\s+råd|mer\s+detaljert)\b/i.test(
        trimmedLast,
      )
    const wantsExpanded =
      wantsQuote || shortFollowUp || asksForExpanded
    const compactMode = !wantsExpanded

    const visionHint = lastUserHasImage
      ? `\n## Bilde i siste melding
Brukeren har vedlagt et bilde. Bruk det til å forstå spørsmålet og hva som vises (sted, skilt, dokument, situasjon). **Konkrete kontraktskrav og ordlyd** skal fortsatt hentes fra KONTEKST nedenfor — ikke finn opp § eller tall fra bildet alene.\n`
      : ''

    const quoteHint = wantsQuote
      ? '\nSPESIELT NÅ: Brukeren vil ha ordlyd – **sitér ordrett** fra KONTEKST i «anførselstegn». Korte sitater; ikke parafraser når ordlyd er poenget.\n'
      : ''

    const userSuggestsNumbers =
      /\b\d+[,.]?\d*\s*(m|meter|km|t|timer|min|dager|år|%)|\b\d{1,2}[.:]\d{2}\b/i.test(
        lastUserText,
      )
    const numberHint = userSuggestsNumbers
      ? `\nSPESIELT NÅ – TALL I BRUKERENS MELDING:\nKonkrete tall eller mål er nevnt. Si **aldri** at kontrakten «sier» eller «fastsetter» disse tallene med mindre **samme verdi** står ordrett i KONTEKST (vis i «anførselstegn»). Finnes ikke tallet der: si at du **ikke ser det** i den teksten du har, og vis hva som faktisk står. Ikke gjenta brukerens tall som fakta uten sitat.\n`
      : ''

    const modeBlock = compactMode
      ? `## Modus: KORT SVAR (gjelder nå)
- Svar **kun** på det brukeren spurte om. Ikke oppsummer hele kontrakten og ikke liste relaterte temaer de ikke ba om.
- Én kort konklusjon: **maks om lag 40–80 ord** (hold deg til poenget).
- **Ikke** bruk egne seksjoner eller overskrifter som «Sitat», «I kontrakten», «Vurdering/råd», eller lange punktlister med ordrette sitater.
- Oppsummer hva kontrakten sier **med egne ord**. Ikke ta med ordrette sitater i «anførselstegn» i dette svaret.
- **Avslutning:** Du trenger ikke alltid å stille et nytt spørsmål. Legg eventuelt til **én kort linje** som tilbyr mer (f.eks. ordrette sitater eller praktiske råd) bare hvis det åpenbart hjelper brukeren videre; ellers kan du avslutte uten oppfølgingsspørsmål.
- Hvis KONTEKST ikke dekker spørsmålet: si det kort; still bare oppfølgingsspørsmål om det er naturlig.`
      : `## Modus: UTVIDET SVAR
Brukeren har bedt om ordlyd/sitater, råd, utdyping, eller svart kort (f.eks. ja/begge) på tilbud om mer. Da kan du:
- Bruke **korte sitater** i «anførselstegn» fra KONTEKST der det trengs.
- Tydelig merke egne råd med **Vurdering/råd:** (ett avsnitt eller punktliste) — ikke bland med sitater.
- Unngå tre gjentakelser av samme poeng; hold deg til det som trengs for å svare.`

    const systemPrompt = `Du er **fagassistent for kontraktsoppfølging** (vei, drift, vedlikehold, anskaffelse). Du svarer på **norsk**, praktisk og presist.

${modeBlock}

${visionHint}${quoteHint}${numberHint}
## Fakta vs tolkning
- Når du i **utvidet modus** sier at kontrakten **krever**, **sier** eller **fastsetter** noe konkret (§, tall, frist): det må **kunne spores til KONTEKST** — sitér eller parafraser nøyaktig. **Oppfinn ikke** §, beløp eller datoer.
- I **kort modus**: ikke påstå konkrete tall/§ som ikke er tydelig dekket; bruk egne ord og tilby sitater i neste melding.

## Motstrid og tidligere meldinger
- Ved motstrid i KONTEKST: si det **kort**.
- Tidligere assistentsvar kan være feil — sjekk mot KONTEKST ved kontraktsinnhold.

## Ikke bruk disse formatene
- Ingen [SVAR], [LOGIKK], [KILDE], [FORSTÅELSE] eller lignende tagger.
- Ingen intern chunk-nummerering («Utdrag 1/4»).

## Synlig svar
**Svaret til brukeren skal alltid være fullstendig synlig tekst** (ikke tomt).

## Bruk av KONTEKST
Utdragene under kan inneholde støy eller avsnitt som bare delvis treffer spørsmålet. **Ignorer** irrelevante deler og bruk **kun** det som trengs for et presist svar. Ikke gjengi eller oppsummer hele KONTEKST.

---
KONTEKST:
${contextBlock}`

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => {
        const role = m.role === 'assistant' ? 'assistant' : 'user'
        const c = m.content
        if (role === 'assistant') {
          return { role: 'assistant', content: String(c ?? '') }
        }
        if (typeof c === 'string') {
          return { role: 'user', content: c }
        }
        if (Array.isArray(c)) {
          return { role: 'user', content: c }
        }
        return { role: 'user', content: String(c ?? '') }
      }),
    ]

    const maxTokens = getContractChatCompletionMaxTokens(CHAT_MODEL, compactMode)

    const completionOpts = {
      model: CHAT_MODEL,
      messages: /** @type {any} */ (chatMessages),
      max_completion_tokens: maxTokens,
    }
    if (modelSupportsCustomTemperature(CHAT_MODEL)) {
      completionOpts.temperature = getContractChatTemperature()
      completionOpts.top_p = 0.92
    }

    let reply = ''
    /** @type {{ choices?: unknown[], usage?: unknown } | null} */
    let lastCompletion = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const completion = await openai.chat.completions.create(completionOpts)
        lastCompletion = completion
        const rawReply = textFromAssistantMessage(
          completion.choices?.[0]?.message,
        ).trim()
        reply = extractContractUserReply(rawReply)
        if (reply) break
      } catch (e) {
        if (!isTransientOpenAIError(e)) throw e
        if (attempt === 3) throw e
      }
      if (reply) break
      await sleep(450 * attempt)
    }

    if (!reply) {
      if (lastCompletion) {
        const ch = /** @type {{ finish_reason?: string }} */ (
          Array.isArray(lastCompletion.choices) ? lastCompletion.choices[0] : null
        )
        console.warn('contract-chat: tomt synlig svar fra modell', {
          model: CHAT_MODEL,
          finish_reason: ch?.finish_reason,
          max_completion_tokens: maxTokens,
          compactMode,
          usage: lastCompletion.usage,
        })
      }
      res.status(502).json({
        error:
          'Tomt svar fra modell. Prøv igjen, eller øk CONTRACT_RAG_REASONING_COMPLETION_TOKEN_FLOOR / CONTRACT_RAG_MAX_COMPLETION_TOKENS på serveren.',
      })
      return
    }

    res.json({ reply })
  } catch (e) {
    console.error('contract-chat:', e)
    const msg =
      e && typeof e === 'object' && 'message' in e
        ? String(/** @type {{ message: string }} */ (e).message)
        : 'Ukjent feil.'
    res.status(500).json({ error: msg })
  }
}
