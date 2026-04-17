import { createClient } from '@supabase/supabase-js'

const url =
  typeof import.meta.env.VITE_SUPABASE_URL === 'string'
    ? import.meta.env.VITE_SUPABASE_URL.trim()
    : ''
const anonKey =
  typeof import.meta.env.VITE_SUPABASE_ANON_KEY === 'string'
    ? import.meta.env.VITE_SUPABASE_ANON_KEY.trim()
    : ''

/** @type {ReturnType<typeof createClient> | null} */
let client = null

export function isSupabaseConfigured() {
  return (
    typeof url === 'string' &&
    url.length > 0 &&
    typeof anonKey === 'string' &&
    anonKey.length > 0
  )
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}
