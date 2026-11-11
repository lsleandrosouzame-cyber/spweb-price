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

  return <main className="relative grid min-h-screen">
    {/* Background cinematográfico - sala de reunião com gráficos e apresentação */}
    <div 
      className="fixed inset-0 z-0 h-full w-full"
      style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1552664730-d307ca884978?w=1600&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Overlay escuro cinematográfico */}
      <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-black/75 via-black/70 to-black/80"></div>
    </div>

    {/* Formulário centralizado */}
    <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-10">
      {/* Logo acima do formulário */}
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-bold text-white drop-shadow-lg sm:text-6xl">
          SPWeb
        </h1>
        <p className="mt-3 text-sm font-medium uppercase tracking-wider text-white/80 drop-shadow">
          Sistemas inteligentes que geram lucro
        </p>
      </div>

      {/* Card do formulário - estilo Apple: branco puro, minimalista, clean */}
      <div className="w-full max-w-[440px] rounded-3xl bg-white p-10 shadow-2xl">

        {/* Título do formulário */}
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{pageCopy.title}</h2>
          <p className="mt-2 text-sm text-slate-600">{pageCopy.subtitle}</p>
        </div>

        {/* Notices */}
        <div className="space-y-3">
          {configMissing && <InlineNotice tone="info">A autenticação real aguarda a configuração segura do projeto Supabase. Os dados não são simulados.</InlineNotice>}
          {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}
        </div>

        {/* Formulário estilo Apple */}
        <form className="mt-6 space-y-5" onSubmit={submit}>
          {!updatingPassword && (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-900">E-mail</span>
              <span className="relative block">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input 
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 pl-12 text-base text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10" 
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
              <span className="mb-2 block text-sm font-medium text-slate-900">{updatingPassword ? 'Nova senha' : 'Senha'}</span>
              <span className="relative block">
                <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input 
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 pl-12 pr-12 text-base text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10" 
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors" 
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
              className="mt-6 w-full rounded-xl bg-blue-600/40 px-6 py-4 text-base font-semibold text-white transition-all" 
              disabled
            >
              {pageCopy.button}
            </button>
          )}
          {hasSupabaseConfig && (
            <button 
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:shadow-xl hover:shadow-blue-600/40 active:scale-[0.98] disabled:opacity-60" 
              disabled={busy}
            >
              {busy ? 'Aguarde…' : pageCopy.button}
            </button>
          )}
        </form>

        {/* Links auxiliares estilo Apple */}
        <div className="mt-6 text-center">
          {mode === 'login' && (
            <div className="space-y-2">
              <a href="/auth/signup" className="block text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                Criar conta gratuita
              </a>
              <a href="/auth/recovery" className="block text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Esqueci minha senha
              </a>
            </div>
          )}
          {mode === 'signup' && (
            <a href="/auth/login" className="block text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
              Já tenho uma conta
            </a>
          )}
          {mode === 'recovery' && !updatingPassword && (
            <a href="/auth/login" className="block text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
              Voltar ao login
            </a>
          )}
        </div>
      </div>
    </section>
  </main>
}
