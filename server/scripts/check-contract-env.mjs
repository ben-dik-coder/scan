/**
 * Viser om Kontrakt-RAG-variabler er satt (ikke verdiene).
 * Kjør: cd server && node scripts/check-contract-env.mjs
 */
import dotenv from 'dotenv'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env')
dotenv.config({ path: envPath })

function ok(name) {
  const v = process.env[name]
  return typeof v === 'string' && v.trim().length > 0
}

console.log('Leser:', envPath)
console.log('Finnes fil?', existsSync(envPath) ? 'ja' : 'NEI')
console.log('')
const need = ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const n of need) {
  console.log(n + ':', ok(n) ? 'satt' : 'MANGLER eller tom')
}

const wrong = [
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
]
console.log('')
console.log('Vanlige feilnavn (skal IKKE brukes til RAG på server):')
for (const n of wrong) {
  if (ok(n)) console.log('  – Du har', n, '(det erstatter ikke SUPABASE_SERVICE_ROLE_KEY)')
}

if (ok('SUPABASE_SERVICE_ROLE_KEY')) {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
  const looksJwt = k.startsWith('eyJ')
  const looksSb = k.startsWith('sb_')
  console.log('')
  console.log(
    'Service key-format:',
    looksJwt ? 'ser ut som JWT (typisk for service_role)' : looksSb ? 'sb_* (sjekk at det er service_role, ikke publishable)' : 'ukjent – verifiser i Supabase → Project Settings → API',
  )
}
