/**
 * Lagrer store data-URL-er (fotobilder) i IndexedDB slik at localStorage JSON
 * ikke sprenger ~5 MB-kvoten. Metadata (id, mappe, vegref) ligger fortsatt i JSON.
 */

const DB_NAME = 'count-clicker-photo-blobs-v1'
const DB_VERSION = 1
const STORE = 'photos'

/** @type {IDBDatabase | null} */
let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
  })
  return dbPromise
}

/**
 * @returns {Promise<boolean>}
 */
export async function isPhotoBlobStoreAvailable() {
  try {
    await openDb()
    return true
  } catch {
    return false
  }
}

/**
 * @param {string} id
 * @param {string} dataUrl
 */
export async function putPhotoDataUrl(id, dataUrl) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put(dataUrl, id)
  })
}

/**
 * @param {string} id
 * @returns {Promise<string | null>}
 */
export async function getPhotoDataUrl(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => {
      const v = req.result
      resolve(typeof v === 'string' ? v : null)
    }
    req.onerror = () => reject(req.error)
  })
}

/**
 * @param {string} id
 */
export async function deletePhotoBlob(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).delete(id)
  })
}

/**
 * Sletter alle blob-oppslag unntatt `keepIds`.
 * @param {Set<string>} keepIds
 */
export async function prunePhotoBlobsExcept(keepIds) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.openCursor()
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        resolve()
        return
      }
      const key = /** @type {string} */ (cursor.key)
      if (!keepIds.has(key)) {
        cursor.delete()
      }
      cursor.continue()
    }
  })
}
