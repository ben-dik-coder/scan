/**
 * PDF → chunks → embeddings → Supabase contract_chunks
 * Bruk: cd server && node scripts/ingest-contract-pdf.mjs /full/sti/kontrakt.pdf
 * Valgfritt: --clear  (sletter eksisterende rader først)
 *
 * Krever i .env: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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
const CHUNK_SIZE = 1100
/** Overlapp mellom nabochunks – høyere verdi gir bedre RAG-treff på setninger delt mellom to chunks. */
const CHUNK_OVERLAP = 240
const BATCH_EMBED = 64

/**
 * @param {string} text
 * @param {number} size
 * @param {number} overlap
 */
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

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--clear')
  const doClear = process.argv.includes('--clear')
  const pdfPath = args[0]

  if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.error(
      'Bruk: node scripts/ingest-contract-pdf.mjs /sti/til/kontrakt.pdf [--clear]',
    )
    process.exit(1)
  }

  console.log('Leser PDF (store filer kan ta litt tid) …', pdfPath)

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

  const buf = fs.readFileSync(pdfPath)
  console.log('Parser PDF …')
  const parsed = await pdfParse(buf)
  const fullText = typeof parsed.text === 'string' ? parsed.text : ''
  const chunks = chunkText(fullText, CHUNK_SIZE, CHUNK_OVERLAP)
  if (!chunks.length) {
    console.error('Ingen tekst fra PDF. Sjekk filen.')
    process.exit(1)
  }

  console.log(`Chunks: ${chunks.length} (fra ${fullText.length} tegn)`)

  const baseMeta = {
    source: path.basename(pdfPath),
    pages: parsed.numpages ?? null,
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
