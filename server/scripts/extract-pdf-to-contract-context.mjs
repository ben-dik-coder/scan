/**
 * Leser en PDF og skriver ren tekst til server/contract-context.txt
 * Bruk: node scripts/extract-pdf-to-contract-context.mjs "/sti/til/fil.pdf"
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.join(__dirname, '..')
const outFile = path.join(serverRoot, 'contract-context.txt')

const pdfPath = process.argv[2]
if (!pdfPath || !fs.existsSync(pdfPath)) {
  console.error('Bruk: node scripts/extract-pdf-to-contract-context.mjs "/full/sti/til/kontrakt.pdf"')
  process.exit(1)
}

const buf = fs.readFileSync(pdfPath)
const data = await pdfParse(buf)
let text = typeof data.text === 'string' ? data.text.trim() : ''
text = text.replace(/\r\n/g, '\n')
fs.writeFileSync(outFile, text, 'utf8')
console.log(
  `Skrev ${outFile} (${text.length} tegn, ${data.numpages} sider). Restart API (npm start) for å laste inn.`,
)
