import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { LoadingScreen, InlineNotice } from '../components/Feedback'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    let recoveryEvent = false
    if (!supabase || !hasSupabaseConfig) {
      setError('O projeto Supabase ainda não está configurado.')
      setLoading(false)
      return
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryEvent = true
        if (active) navigate('/recovery?update=1', { replace: true })
      }
    })
    async function complete() {
      const { data: sessionData, error: sessionError } = await supabase!.auth.getSession()
      if (!active) return
      if (sessionError) { setError(sessionError.message); setLoading(false); return }
      const { data, error: userError } = await supabase!.auth.getUser()
      if (!active) return
      if (userError || !data.user) { setError(userError?.message ?? 'Não foi possível confirmar sua sessão. Solicite um novo link de acesso.'); setLoading(false); return }
      const params = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const isRecovery = recoveryEvent || params.get('type') === 'recovery' || hashParams.get('type') === 'recovery'
      if (isRecovery) navigate('/recovery?update=1', { replace: true })
      else navigate(sessionData.session ? '/setup' : '/login', { replace: true })
    }
    void complete()
    return () => { active = false; subscription.unsubscribe() }
  }, [navigate])
  if (loading) return <LoadingScreen label="Confirmando seu acesso" />
  return <main className="grid min-h-screen place-items-center bg-ink p-5"><div className="w-full max-w-md space-y-4"><InlineNotice>{error}</InlineNotice><button className="btn-secondary w-full" onClick={() => navigate('/login', { replace: true })}>Voltar para entrar</button></div></main>
}
