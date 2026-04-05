/**
 * Kontrakt → vask → dedupe → chunks → embeddings → Supabase contract_chunks
 *
 * Støtter: .pdf (pdf-parse), .md / .html / .htm / .txt (f.eks. LlamaParse)
 *
 * cd server && node scripts/ingest-contract-pdf.mjs /sti/til/fil.pdf [--clear]
 * cd server && node scripts/ingest-contract-pdf.mjs /sti/til/export.md [--clear]
 *
 * Valgfritt i server/.env:
 *   CONTRACT_INGEST_CHUNK_SIZE=1400
 *   CONTRACT_INGEST_CHUNK_OVERLAP=280
 *
 * Krever: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import dotenv from 'dotenv'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIM = 1536
const CHUNK_SIZE = Math.min(
  8000,
  Math.max(400, Number(process.env.CONTRACT_INGEST_CHUNK_SIZE || 1400)),
)
const CHUNK_OVERLAP = Math.min(
  CHUNK_SIZE - 1,
  Math.max(0, Number(process.env.CONTRACT_INGEST_CHUNK_OVERLAP || 280)),
)
const BATCH_EMBED = 64

/** Min. tegn i normalisert avsnitt for global dedupe */
const DEDUPE_MIN_LEN = 32

function repairBrokenHtmlTags(s) {
  let t = String(s)
  t = t.replace(/<\s*\/\s*\r?\n\s*(th|td|tr|table|thead|tbody|p|div)\s*>/gi, '</$1>')
  t = t.replace(/<\s*br\s*\/\s*\r?\n\s*>/gi, '<br/>')
  return t
}

function stripHtmlToText(html) {
  let s = String(html)
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(p|div|tr|h[1-6]|li|table|thead|tbody)>/gi, '\n')
  s = s.replace(/<\/td>/gi, '\t')
  s = s.replace(/<\/th>/gi, '\t')
  s = s.replace(/<[^>]+>/g, '')
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  return s
}

function stripPageMarkers(text) {
  return text.replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm, '')
}

function stripRepeatedHeadersFooters(text) {
  const lines = text.split(/\n/)
  const out = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) {
      out.push('')
      continue
    }
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(t)) continue
    if (/^Nordland fylkeskommune(\s+D1-\d+)?$/i.test(t)) continue
    if (/^1813 Ofoten 2023-2026$/i.test(t)) continue
    if (/^\*\*D Beskrivende del\*\*$/i.test(t)) continue
    if (/^\*\*D1 Beskrivelse\*\*$/i.test(t)) continue
    if (/^D Beskrivende del$/i.test(t)) continue
    if (/^D1 Beskrivelse(\s+09\.03\.2021)?$/i.test(t)) continue
    if (/^D1-\d+$/i.test(t)) continue
    if (/^<\/a>$/i.test(t)) continue
    out.push(line)
  }
  return out.join('\n')
}

function dedupeConsecutiveLines(text) {
  const lines = text.split('\n')
  const out = []
  for (const line of lines) {
    if (out.length && out[out.length - 1] === line) continue
    out.push(line)
  }
  return out.join('\n')
}

function paragraphNormKey(p) {
  return p
    .replace(/\s+/g, ' ')
    .replace(/\*+/g, '')
    .trim()
    .toLowerCase()
}

function dedupeParagraphs(text) {
  const rawBlocks = text.split(/\n{2,}/)
  const seen = new Set()
  const out = []
  for (const block of rawBlocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    const key = paragraphNormKey(trimmed)
    if (key.length >= DEDUPE_MIN_LEN && seen.has(key)) continue
    if (key.length >= DEDUPE_MIN_LEN) seen.add(key)
    out.push(trimmed)
  }
  return out.join('\n\n')
}

function normalizeParseArtifacts(text) {
  let s = text.replace(/\r\n/g, '\n')
  s = s.replace(/\\\*\\\*\*?/g, '***')
  s = s.replace(/\\([*_])/g, '$1')
  s = s.replace(/\n{4,}/g, '\n\n\n')
  s = s.replace(/[ \t]+\n/g, '\n')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

function normalizeContractText(text) {
  let s = String(text).replace(/\r\n/g, '\n')
  s = repairBrokenHtmlTags(s)
  s = stripPageMarkers(s)
  if (/<[a-z][\s\S]*>/i.test(s)) {
    s = stripHtmlToText(s)
  }
  s = stripRepeatedHeadersFooters(s)
  s = dedupeConsecutiveLines(s)
  s = normalizeParseArtifacts(s)
  s = dedupeParagraphs(s)
  return s.trim()
}

function chunkText(text, size, overlap) {
  const t = text.replace(/\r\n/g, '\n').trim()
  if (!t) return []
  const chunks = []
  let i = 0
  while (i < t.length) {
    chunks.push(t.slice(i, i + size))
    i += size - overlap
    if (i >= t.length) break
    if (i < 0) i = 0
  }
  return chunks
}

async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.pdf') {
    const buf = fs.readFileSync(filePath)
    const parsed = await pdfParse(buf)
    const fullText = typeof parsed.text === 'string' ? parsed.text : ''
    return { text: fullText, pages: parsed.numpages ?? null }
  }
  if (['.md', '.html', '.htm', '.txt', '.markdown'].includes(ext)) {
    const raw = fs.readFileSync(filePath, 'utf8')
    return { text: raw, pages: null }
  }
  throw new Error(
    `Ukjent filtype «${ext}». Bruk .pdf, .md, .html, .htm eller .txt`,
  )
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--clear')
  const doClear = process.argv.includes('--clear')
  const inputPath = args[0]

  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error(
      'Bruk: node scripts/ingest-contract-pdf.mjs /sti/til/fil.{pdf,md,html,txt} [--clear]',
    )
    process.exit(1)
  }

  console.log('Leser fil …', inputPath)

  const key = process.env.OPENAI_API_KEY?.trim()
  const url = process.env.SUPABASE_URL?.trim()
  const skey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key || !url || !skey) {
    console.error(
      'Mangler OPENAI_API_KEY, SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i server/.env',
    )
    process.exit(1)
  }

  const openai = new OpenAI({ apiKey: key })
  const supabase = createClient(url, skey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (doClear) {
    const { error: delErr } = await supabase
      .from('contract_chunks')
      .delete()
      .not('id', 'is', null)
    if (delErr) {
      console.warn('Kunne ikke tømme tabell:', delErr.message)
    } else {
      console.log('Tømte contract_chunks.')
    }
  }

  const { text: rawText, pages } = await extractTextFromFile(inputPath)
  const rawLen = rawText.length
  console.log('Normaliserer (HTML→tekst, fjern sidehoder, dedupe avsnitt) …')
  const fullText = normalizeContractText(rawText)
  if (!fullText.length) {
    console.error('Ingen tekst etter normalisering. Sjekk filen.')
    process.exit(1)
  }

  console.log(
    `Tekst: ${rawLen} → ${fullText.length} tegn etter vask (spar ${rawLen - fullText.length})`,
  )

  const chunks = chunkText(fullText, CHUNK_SIZE, CHUNK_OVERLAP)
  if (!chunks.length) {
    console.error('Ingen chunks. Sjekk filen.')
    process.exit(1)
  }

  console.log(
    `Chunks: ${chunks.length} (chunk=${CHUNK_SIZE}, overlapp=${CHUNK_OVERLAP})`,
  )

  const baseMeta = {
    source: path.basename(inputPath),
    pages,
    ingest_format:
      path.extname(inputPath).toLowerCase().replace('.', '') || null,
  }

  let inserted = 0
  for (let start = 0; start < chunks.length; start += BATCH_EMBED) {
    const slice = chunks.slice(start, start + BATCH_EMBED)
    const embRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: slice,
      dimensions: EMBEDDING_DIM,
    })
    const rows = slice.map((content, j) => {
      const globalIdx = start + j
      const e = embRes.data[j]?.embedding
      if (!Array.isArray(e) || e.length !== EMBEDDING_DIM) {
        throw new Error(`Embedding feilet for chunk ${globalIdx}`)
      }
      return {
        content,
        embedding: e,
        metadata: { ...baseMeta, chunk_index: globalIdx },
      }
    })

    const { error } = await supabase.from('contract_chunks').insert(rows)
    if (error) {
      console.error('Insert-feil:', error.message)
      process.exit(1)
    }
    inserted += rows.length
    console.log(`Insertet ${inserted}/${chunks.length}`)
  }

  console.log(`Ferdig. ${inserted} rader i contract_chunks.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
