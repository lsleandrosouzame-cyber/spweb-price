import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { InlineNotice } from '../components/Feedback'

// MacBook on a desk — Unsplash free-to-use photo (Gabriel Beaudry)
const BG_IMAGE = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1920&q=80'

type Mode = 'login' | 'signup' | 'recovery'
const copy: Record<Mode, { title: string; subtitle: string; button: string }> = {
  login:    { title: 'Login',              subtitle: '',                                                      button: 'Entrar com segurança'       },
  signup:   { title: 'Criar conta',        subtitle: 'Comece a entender o resultado por trás dos seus preços.', button: 'Criar minha conta'          },
  recovery: { title: 'Recuperar acesso',   subtitle: 'Enviaremos um link para redefinir sua senha.',           button: 'Enviar link de recuperação' },
}

export default function AuthPage({ mode }: { mode: Mode }) {
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy]                 = useState(false)
  const [notice, setNotice]             = useState<{ text: string; tone: 'error' | 'info' | 'success' } | null>(null)
  const navigate  = useNavigate()
  const location  = useLocation()
  const configMissing   = !hasSupabaseConfig || !supabase
  const updatingPassword = mode === 'recovery' && new URLSearchParams(location.search).get('update') === '1'
  const pageCopy = updatingPassword
    ? { title: 'Nova senha', subtitle: 'Escolha uma senha nova para voltar a acessar sua conta.', button: 'Atualizar senha' }
    : copy[mode]

  async function submit(event: FormEvent) {
    event.preventDefault()
    setNotice(null)
    if (!supabase) return
    if ((mode !== 'recovery' || updatingPassword) && password.length < 8) {
      setNotice({ text: 'A senha deve ter pelo menos 8 caracteres.', tone: 'error' })
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        navigate((location.state as { from?: string } | null)?.from ?? '/dashboard', { replace: true })
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
        if (error) throw error
        if (data.session) navigate('/setup', { replace: true })
        else setNotice({ text: 'Verifique seu e-mail para confirmar o cadastro e continuar.', tone: 'success' })
      } else if (updatingPassword) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setNotice({ text: 'Senha atualizada. Você já pode continuar.', tone: 'success' })
        navigate('/dashboard', { replace: true })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback` })
        if (error) throw error
        setNotice({ text: 'Se houver uma conta com esse e-mail, enviaremos as instruções de recuperação.', tone: 'success' })
      }
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Não foi possível concluir a solicitação.', tone: 'error' })
    } finally { setBusy(false) }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">

      {/* ── Foto de fundo full-screen ── */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${BG_IMAGE}')` }}
      />
      {/* Overlay escuro para contraste */}
      <div className="fixed inset-0 z-10 bg-black/60" />

      {/* ── Conteúdo centralizado ── */}
      <section className="relative z-20 flex min-h-screen flex-col items-center justify-center px-5 py-12">

        {/* Logo */}
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-white drop-shadow-xl sm:text-6xl">
            SPWeb
          </h1>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
            Precificação Lucrativa
          </p>
        </div>

        {/* ── Card glassmorphism ── */}
        <div
          className="w-full max-w-[420px] rounded-2xl px-10 py-10 backdrop-blur-md"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.22)',
            boxShadow: '0 8px 32px 0 rgba(0,0,0,0.45)',
          }}
        >
          {/* Título do modo */}
          <h2 className="mb-8 text-center text-3xl font-bold text-white tracking-wide">
            {pageCopy.title}
          </h2>

          {/* Notices */}
          {(configMissing || notice) && (
            <div className="mb-5 space-y-2">
              {configMissing && <InlineNotice tone="info">Autenticação aguarda configuração do Supabase.</InlineNotice>}
              {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}
            </div>
          )}

          {/* Formulário com inputs estilo "underline" */}
          <form className="space-y-7" onSubmit={submit}>

            {!updatingPassword && (
              <div className="group">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-white/60">
                  E-mail
                </label>
                <input
                  className="w-full border-0 border-b border-white/40 bg-transparent py-2.5 text-base text-white placeholder:text-white/35 transition-all focus:border-white focus:outline-none group-hover:border-white/60"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="voce@empresa.com.br"
                />
              </div>
            )}

            {(mode !== 'recovery' || updatingPassword) && (
              <div className="group">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-white/60">
                  {updatingPassword ? 'Nova senha' : 'Senha'}
                </label>
                <div className="relative">
                  <input
                    className="w-full border-0 border-b border-white/40 bg-transparent py-2.5 pr-10 text-base text-white placeholder:text-white/35 transition-all focus:border-white focus:outline-none group-hover:border-white/60"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'signup' || updatingPassword ? 'new-password' : 'current-password'}
                    minLength={8}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-white/50 transition-colors hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {/* Link "Esqueceu a senha?" — apenas no login */}
            {mode === 'login' && !updatingPassword && (
              <div className="text-right -mt-3">
                <a href="/recovery" className="text-xs text-white/55 hover:text-white transition-colors">
                  Esqueceu a senha?
                </a>
              </div>
            )}

            {/* Botão */}
            {hasSupabaseConfig ? (
              <button
                className="mt-2 w-full rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#BAEC00] py-3.5 text-base font-bold text-black shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] disabled:opacity-60"
                disabled={busy}
              >
                {busy ? 'Aguarde…' : pageCopy.button}
              </button>
            ) : (
              <button
                type="button"
                className="mt-2 w-full rounded-xl bg-white/20 py-3.5 text-base font-bold text-white/60 cursor-not-allowed"
                disabled
              >
                {pageCopy.button}
              </button>
            )}
          </form>

          {/* Rodapé do card */}
          <div className="mt-7 text-center text-sm text-white/50">
            {mode === 'login' && (
              <p>Não tem conta?{' '}
                <a href="/signup" className="font-semibold text-white/80 hover:text-white transition-colors underline underline-offset-2">
                  Cadastre-se
                </a>
              </p>
            )}
            {mode === 'signup' && (
              <p>Já tem conta?{' '}
                <a href="/login" className="font-semibold text-white/80 hover:text-white transition-colors underline underline-offset-2">
                  Entrar
                </a>
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
