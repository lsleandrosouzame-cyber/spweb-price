import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { hasSupabaseConfig, supabase } from '../lib/supabase'

export interface CompanySummary {
  id: string
  name: string
  created_at?: string
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  companies: CompanySummary[]
  currentCompany: CompanySummary | null
  loading: boolean
  companiesLoading: boolean
  configReady: boolean
  companyError: string | null
  refreshCompanies: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  // loading = true only until we know the auth state (first getSession resolves)
  const [loading, setLoading] = useState(true)
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [companyError, setCompanyError] = useState<string | null>(null)
  // track whether companies have ever been loaded for this session
  const companiesLoadedRef = useRef(false)

  const refreshCompanies = useCallback(async () => {
    if (!supabase || !session?.user) {
      setCompanyError(null)
      setCompanies([])
      setCompaniesLoading(false)
      return
    }
    setCompanyError(null)
    setCompaniesLoading(true)
    const timeoutId = setTimeout(() => setCompaniesLoading(false), 5000)
    try {
      const { data, error } = await supabase
        .from('company_members')
        .select('company_id, companies(id, name, created_at)')
        .eq('user_id', session.user.id)
      clearTimeout(timeoutId)
      if (error) {
        setCompanyError(error.message)
        setCompanies([])
      } else {
        const next = (data ?? []).flatMap((row: any) =>
          row.companies ? [row.companies as CompanySummary] : []
        )
        setCompanies(next)
        setCompanyError(null)
        companiesLoadedRef.current = true
      }
    } catch (cause) {
      clearTimeout(timeoutId)
      setCompanyError(cause instanceof Error ? cause.message : 'Erro ao carregar empresa.')
      setCompanies([])
    } finally {
      setCompaniesLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let active = true
    const sessionTimeout = setTimeout(() => {
      if (!active) return
      setLoading(false)
    }, 6000)

    supabase.auth.getSession().then(({ data, error }) => {
      clearTimeout(sessionTimeout)
      if (!active) return
      if (error) setCompanyError(error.message)
      // Do NOT set companiesLoading here — refreshCompanies effect handles it
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setLoading(false)
      // Reset companies ref when session changes so we reload
      if (!nextSession) {
        setCompanies([])
        companiesLoadedRef.current = false
      }
    })

    return () => {
      active = false
      clearTimeout(sessionTimeout)
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    void refreshCompanies()
  }, [refreshCompanies])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setSession(null)
    setCompanies([])
    setCompaniesLoading(false)
    companiesLoadedRef.current = false
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    companies,
    currentCompany: companies[0] ?? null,
    loading,
    companiesLoading,
    configReady: hasSupabaseConfig,
    companyError,
    refreshCompanies,
    signOut,
  }), [session, companies, loading, companiesLoading, companyError, refreshCompanies, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return context
}
