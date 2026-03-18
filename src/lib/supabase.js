import { createClient } from '@supabase/supabase-js'

const getConfig = () => {
  const url = localStorage.getItem('sb_url') || import.meta.env.VITE_SUPABASE_URL || ''
  const key = localStorage.getItem('sb_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  return { url, key }
}

export const isConfigured = () => {
  const { url, key } = getConfig()
  return url.startsWith('https://') && key.length > 20
}

let _client = null

export const getSupabase = () => {
  if (_client) return _client
  const { url, key } = getConfig()
  _client = createClient(url, key)
  return _client
}

export const resetClient = () => { _client = null }

// backward compat — lazy proxy
export const supabase = new Proxy({}, {
  get(_, prop) {
    return getSupabase()[prop]
  }
})
