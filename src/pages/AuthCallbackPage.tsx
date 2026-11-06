import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { LoadingScreen, InlineNotice } from '../components/Feedback'
import { Mail, RefreshCw } from 'lucide-react'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [resendEmail, setResendEmail] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    let active = true
    let recoveryEvent = false

    // ── 1. Check for error params in URL first ─────────────────
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    const urlError = searchParams.get('error') ?? hashParams.get('error')
    const urlErrorCode = searchParams.get('error_code') ?? hashParams.get('error_code')
    const urlErrorDesc = searchParams.get('error_description') ?? hashParams.get('error_description')

    if (urlError) {
      const isExpired = urlErrorCode === 'otp_expired' || urlErrorDesc?.includes('expired')
      const isInvalid = urlErrorDesc?.includes('invalid')
      let msg = urlErrorDesc?.replace(/\+/g, ' ') ?? urlError

      if (isExpired || isInvalid) {
        setErrorCode('expired')
        setError('O link de confirmação expirou ou já foi utilizado. Solicite um novo link abaixo.')
      } else {
        setError(msg)
      }
      setLoading(false)
      return
    }

    if (!supabase || !hasSupabaseConfig) {
      setError('O projeto Supabase ainda não está configurado.')
      setLoading(false)
      return
    }

    // ── 2. Listen for PASSWORD_RECOVERY event ─────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryEvent = true
        if (active) navigate('/recovery?update=1', { replace: true })
      }
    })

    // ── 3. Complete the session exchange ──────────────────────
    async function complete() {
      try {
        const { data: sessionData, error: sessionError } = await supabase!.auth.getSession()
        if (!active) return
        if (sessionError) { setError(sessionError.message); setLoading(false); return }

        const { data, error: userError } = await supabase!.auth.getUser()
        if (!active) return
        if (userError || !data.user) {
          setErrorCode('no_session')
          setError('Não foi possível confirmar sua sessão. Solicite um novo link de acesso.')
          setLoading(false)
          return
        }

        const isRecovery = recoveryEvent ||
          searchParams.get('type') === 'recovery' ||
          hashParams.get('type') === 'recovery'

        if (isRecovery) {
          navigate('/recovery?update=1', { replace: true })
        } else if (sessionData.session) {
          // Email confirmed — go to setup to create company, or dashboard if already has one
          navigate('/setup', { replace: true })
        } else {
          navigate('/login', { replace: true })
        }
      } catch (cause) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Erro inesperado ao confirmar o acesso.')
        setLoading(false)
      }
    }

    void complete()
    return () => { active = false; subscription.unsubscribe() }
  }, [navigate])

  async function resendConfirmation() {
    if (!supabase || !resendEmail) return
    setResending(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: resendEmail })
    setResending(false)
    if (!error) setResent(true)
  }

  if (loading) return <LoadingScreen label="Confirmando seu acesso" />

  return (
    <main className="grid min-h-screen place-items-center bg-ink p-5">
      <div className="w-full max-w-md space-y-5">
        {/* Icon */}
        <div className="text-center">
          <span className="inline-grid size-16 place-items-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 mx-auto">
            <Mail size={28}/>
          </span>
          <h2 className="mt-4 text-xl font-semibold">
            {errorCode === 'expired' ? 'Link expirado' : 'Problema na confirmação'}
          </h2>
          <p className="mt-2 text-sm text-muted max-w-sm mx-auto">
            {error}
          </p>
        </div>

        {/* Resend form — for expired links */}
        {(errorCode === 'expired' || errorCode === 'no_session') && !resent && (
          <div className="surface p-5 space-y-3">
            <p className="text-xs font-medium text-[#c7c7c7]">Reenviar link de confirmação</p>
            <input
              className="field"
              type="email"
              placeholder="Seu e-mail de cadastro"
              value={resendEmail ?? ''}
              onChange={e => setResendEmail(e.target.value)}
            />
            <button
              className="btn-primary w-full"
              disabled={resending || !resendEmail?.includes('@')}
              onClick={resendConfirmation}>
              {resending
                ? <><RefreshCw size={14} className="animate-spin"/>Enviando…</>
                : <><Mail size={14}/>Reenviar link de confirmação</>}
            </button>
          </div>
        )}

        {resent && (
          <InlineNotice tone="success">
            Novo link enviado! Verifique sua caixa de entrada e clique no link dentro de 1 hora.
          </InlineNotice>
        )}

        <div className="flex flex-col gap-2">
          <button
            className="btn-secondary w-full"
            onClick={() => navigate('/login', { replace: true })}>
            Ir para o login
          </button>
          <button
            className="text-xs text-muted hover:text-paper transition-colors text-center py-2"
            onClick={() => navigate('/signup', { replace: true })}>
            Criar nova conta
          </button>
        </div>

        <p className="text-center text-[10px] text-[#555]">
          Links de confirmação expiram em 1 hora por segurança.
        </p>
      </div>
    </main>
  )
}
