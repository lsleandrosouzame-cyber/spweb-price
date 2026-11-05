import { createClient, type SupabaseClient } from '@supabase/supabase-js'

interface RuntimeSupabaseConfig {
  configured?: boolean
  supabaseUrl?: string | null
  supabaseAnonKey?: string | null
}

export let hasSupabaseConfig = false
export let supabase: SupabaseClient | null = null
let initialization: Promise<void> | null = null

function createSupabase(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })
}

export function initializeSupabase(): Promise<void> {
  if (initialization) return initialization

  initialization = (async () => {
    let url = ''
    let anonKey = ''

    if (import.meta.env.DEV) {
      url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
      anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
    } else {
      try {
        const response = await fetch('/api/config', {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        })
        if (!response.ok) throw new Error(`Runtime configuration returned HTTP ${response.status}.`)
        const config = await response.json() as RuntimeSupabaseConfig
        if (config.configured) {
          url = config.supabaseUrl?.trim() ?? ''
          anonKey = config.supabaseAnonKey?.trim() ?? ''
        }
      } catch (error) {
        console.error('Não foi possível carregar a configuração Supabase em runtime.', error)
      }
    }

    if (url && anonKey) {
      supabase = createSupabase(url, anonKey)
      hasSupabaseConfig = true
    }
  })()

  return initialization
}
