import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { InlineNotice } from '../components/Feedback'

type Mode = 'login' | 'signup' | 'recovery'
const copy: Record<Mode, { title: string; subtitle: string; button: string }> = {
  login: { title: 'Entre na sua conta', subtitle: 'Acesse seus indicadores e decisões financeiras.', button: 'Entrar com segurança' },
  signup: { title: 'Crie sua conta', subtitle: 'Comece a entender o resultado por trás dos seus preços.', button: 'Criar minha conta' },
  recovery: { title: 'Recupere o acesso', subtitle: 'Enviaremos um link para redefinir sua senha.', button: 'Enviar link de recuperação' },
}

export default function AuthPage({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; tone: 'error' | 'info' | 'success' } | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const configMissing = !hasSupabaseConfig || !supabase
  const updatingPassword = mode === 'recovery' && new URLSearchParams(location.search).get('update') === '1'
  const pageCopy = updatingPassword
    ? { title: 'Defina uma nova senha', subtitle: 'Escolha uma senha nova para voltar a acessar sua conta.', button: 'Atualizar senha' }
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

  return <main className="relative grid min-h-screen overflow-hidden">
    {/* Background com gradiente animado vibrante */}
    <div className="fixed inset-0 z-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Esferas coloridas flutuantes para criar o efeito glassmorphism */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      <div className="absolute bottom-8 right-20 w-72 h-72 bg-cyan-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-6000"></div>
      
      {/* Overlay escuro suave para melhor contraste */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-transparent to-black/40"></div>
    </div>

    {/* Formulário centralizado */}
    <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-10">
      {/* Logo acima do formulário */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white drop-shadow-2xl sm:text-5xl" style={{ fontFamily: 'Sora, sans-serif', textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          SPWeb
        </h1>
        <p className="mt-3 text-sm font-medium uppercase tracking-[0.3em] text-white/90 drop-shadow-lg" style={{ fontFamily: 'Sora, sans-serif', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
          Precificação Lucrativa
        </p>
      </div>

      {/* Card do formulário - branco com texto preto */}
      <div className="w-full max-w-[440px] rounded-3xl p-10 shadow-2xl bg-white/90 backdrop-blur-2xl border border-white/60" style={{ boxShadow: '0 8px 40px 0 rgba(0,0,0,0.25)' }}>

        {/* Título do formulário - apenas para signup e recovery */}
        {mode !== 'login' && (
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{pageCopy.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{pageCopy.subtitle}</p>
          </div>
        )}

        {/* Notices */}
        <div className="space-y-3">
          {configMissing && <InlineNotice tone="info">A autenticação real aguarda a configuração segura do projeto Supabase. Os dados não são simulados.</InlineNotice>}
          {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}
        </div>

        {/* Formulário */}
        <form className="mt-6 space-y-5" onSubmit={submit}>
          {!updatingPassword && (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-800">E-mail</span>
              <span className="relative block">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                <input 
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 pl-12 text-base text-gray-900 placeholder:text-gray-400 transition-all hover:border-gray-300 focus:border-purple-400 focus:outline-none focus:ring-4 focus:ring-purple-100"
                  type="email" 
                  autoComplete="email" 
                  required 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="voce@empresa.com.br" 
                />
              </span>
            </label>
          )}
          {(mode !== 'recovery' || updatingPassword) && (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-800">{updatingPassword ? 'Nova senha' : 'Senha'}</span>
              <span className="relative block">
                <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                <input 
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 pl-12 pr-12 text-base text-gray-900 placeholder:text-gray-400 transition-all hover:border-gray-300 focus:border-purple-400 focus:outline-none focus:ring-4 focus:ring-purple-100"
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors" 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </span>
            </label>
          )}
          
          {!hasSupabaseConfig && (
            <button 
              type="button" 
              className="mt-6 w-full rounded-xl bg-gold/40 px-6 py-4 text-base font-bold text-gold-dark transition-all" 
              disabled
            >
              {pageCopy.button}
            </button>
          )}
          {hasSupabaseConfig && (
            <button 
              className="mt-6 w-full rounded-xl bg-gradient-to-br from-gold via-[#BAEC00] to-gold px-6 py-4 text-base font-bold text-black shadow-lg shadow-gold/30 transition-all hover:shadow-xl hover:shadow-gold/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60" 
              disabled={busy}
            >
              {busy ? 'Aguarde…' : pageCopy.button}
            </button>
          )}
        </form>
      </div>
    </section>
  </main>
}
