import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [companyError, setCompanyError] = useState<string | null>(null)

  const refreshCompanies = useCallback(async () => {
    if (!supabase || !session?.user) {
      setCompanyError(null)
      setCompanies([])
      setCompaniesLoading(false)
      return
    }
    setCompanyError(null)
    setCompaniesLoading(true)
    const { data, error } = await supabase
      .from('company_members')
      .select('company_id, companies(id, name, created_at)')
      .eq('user_id', session.user.id)
    if (error) {
      setCompanyError(error.message)
      setCompanies([])
      setCompaniesLoading(false)
      return
    }
    const next = (data ?? []).flatMap((row: any) => row.companies ? [row.companies as CompanySummary] : [])
    setCompanies(next)
    setCompanyError(null)
    setCompaniesLoading(false)
  }, [session?.user?.id])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setCompanyError(error.message)
      setCompaniesLoading(Boolean(data.session))
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setCompaniesLoading(Boolean(nextSession))
      setSession(nextSession)
      setLoading(false)
    })
    return () => {
      active = false
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
