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

async function fetchConfigWithRetry(retries = 2, delayMs = 800): Promise<RuntimeSupabaseConfig> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000) // 4s per attempt
      const response = await fetch('/api/config', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json() as RuntimeSupabaseConfig
    } catch (error) {
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      } else {
        console.error('Não foi possível carregar a configuração Supabase após tentativas.', error)
      }
    }
  }
  return {}
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
      const config = await fetchConfigWithRetry()
      if (config.configured) {
        url = config.supabaseUrl?.trim() ?? ''
        anonKey = config.supabaseAnonKey?.trim() ?? ''
      }
    }

    if (url && anonKey) {
      supabase = createSupabase(url, anonKey)
      hasSupabaseConfig = true
    }
  })()

  return initialization
}
