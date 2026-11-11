import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
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
    {/* Background com imagem de escritório executivo */}
    <div 
      className="fixed inset-0 z-0 h-full w-full"
      style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Overlay 70% para todas as telas */}
      <div className="absolute inset-0 h-full w-full bg-black/70"></div>
    </div>

    {/* Formulário centralizado */}
    <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-10">
      {/* Logo acima do formulário */}
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-white">
          SPWeb
        </h1>
        <p className="mt-3 text-sm font-medium uppercase tracking-wider text-white/70">
          Sistemas inteligentes que geram lucro
        </p>
      </div>

      {/* Card do formulário */}
      <div className="w-full max-w-[420px] rounded-2xl bg-graphite/40 backdrop-blur-xl border border-white/10 p-8 shadow-2xl">

        {/* Título do formulário */}
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold text-white sm:text-2xl">{pageCopy.title}</h2>
        </div>

        {/* Notices */}
        <div className="space-y-3">
          {configMissing && <InlineNotice tone="info">A autenticação real aguarda a configuração segura do projeto Supabase. Os dados não são simulados.</InlineNotice>}
          {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}
        </div>

        {/* Formulário */}
        <form className="mt-6 space-y-4" onSubmit={submit}>
          {!updatingPassword && <label className="block"><span className="mb-2 block text-xs font-medium text-white">E-mail</span><span className="relative block"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 pl-10 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com.br" /></span></label>}
          {(mode !== 'recovery' || updatingPassword) && <label className="block"><span className="mb-2 block text-xs font-medium text-white">{updatingPassword ? 'Nova senha' : 'Senha'}</span><span className="relative block"><LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' || updatingPassword ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres"/><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>}
          {!hasSupabaseConfig && <button type="button" className="btn-primary w-full opacity-60" disabled>{pageCopy.button}<ArrowRight size={15}/></button>}
          {hasSupabaseConfig && <button className="btn-primary w-full" disabled={busy}>{busy ? 'Aguarde…' : pageCopy.button}<ArrowRight size={15}/></button>}
        </form>


      </div>
    </section>
  </main>
}
