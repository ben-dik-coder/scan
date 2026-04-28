/**
 * Valgfri gzip + base64 for stor Scanix app-state i localStorage.
 * Samme JSON som før etter dekoding — mindre skriving til disk og lavere quota-press.
 * Uten CompressionStream (eldre motor) eller små payload: uendret rå JSON.
 */

export const APP_STATE_STORAGE_GZIP_PREFIX = 'scanix-gzip-v1:'

/** Under dette (tegn) beholdes vanlig JSON-streng (unngår overhead på små skriv). */
const MIN_JSON_LENGTH_TO_COMPRESS = 28_000

function hasCompressionStream() {
  return (
    typeof CompressionStream !== 'undefined' &&
    typeof DecompressionStream !== 'undefined'
  )
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function u8ToBase64(bytes) {
  const chunk = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, bytes.length))
    binary += String.fromCharCode.apply(
      null,
      /** @type {number[]} */ (Array.from(sub)),
    )
  }
  return btoa(binary)
}

/**
 * @param {string} b64
 * @returns {Uint8Array}
 */
function base64ToU8(b64) {
  const bin = atob(b64)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return u8
}

/**
 * @param {string} jsonStr
 * @returns {Promise<string>} enten prefix+base64(gzip) eller original
 */
export async function compressAppStateJsonForLocalStorage(jsonStr) {
  if (
    typeof jsonStr !== 'string' ||
    jsonStr.length < MIN_JSON_LENGTH_TO_COMPRESS ||
    !hasCompressionStream()
  ) {
    return jsonStr
  }
  try {
    const input = new TextEncoder().encode(jsonStr)
    const cs = new CompressionStream('gzip')
    const w = cs.writable.getWriter()
    w.write(input)
    await w.close()
    const buf = await new Response(cs.readable).arrayBuffer()
    const packed = APP_STATE_STORAGE_GZIP_PREFIX + u8ToBase64(new Uint8Array(buf))
    if (packed.length >= jsonStr.length) return jsonStr
    return packed
  } catch {
    return jsonStr
  }
}

/**
 * @param {string} raw verdi fra localStorage
 * @returns {Promise<string>} JSON-tekst klar for JSON.parse
 */
export async function decompressAppStateJsonFromLocalStorage(raw) {
  if (
    typeof raw !== 'string' ||
    !raw.startsWith(APP_STATE_STORAGE_GZIP_PREFIX) ||
    !hasCompressionStream()
  ) {
    return raw
  }
  const comp = base64ToU8(raw.slice(APP_STATE_STORAGE_GZIP_PREFIX.length))
  const ds = new DecompressionStream('gzip')
  const w = ds.writable.getWriter()
  w.write(comp)
  await w.close()
  const out = await new Response(ds.readable).arrayBuffer()
  return new TextDecoder().decode(out)
}
