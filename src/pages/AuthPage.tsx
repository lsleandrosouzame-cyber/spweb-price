import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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

  return <main className="grid min-h-screen bg-ink lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)]">
    <section className="relative hidden min-h-screen overflow-hidden border-r border-line bg-panel p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
      <div className="absolute -left-40 top-1/4 size-[540px] rounded-full border border-gold/[.06]" /><div className="absolute -left-16 top-[30%] size-[380px] rounded-full border border-gold/[.08]" />
      <Link to="/login" className="relative z-10 flex w-fit items-center gap-3"><span className="text-sm font-semibold">SPWeb <span className="text-gold">Lucro</span></span></Link>
      <div className="relative z-10 max-w-xl">
        <h1 className="text-5xl font-bold leading-tight tracking-tight xl:text-6xl">
          SPWeb <span className="text-gold">Lucro</span>
        </h1>
        <p className="mt-4 text-sm font-medium uppercase tracking-wider text-muted">
          Inteligência Financeira que Gera Lucro
        </p>
      </div>
      <p className="relative z-10 text-[10px] text-muted">SPWEB LUCRO · PRECISÃO QUE VIRA DECISÃO</p>
    </section>

    <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
      <div className="w-full max-w-[420px]">
        <Link to="/login" className="mb-12 flex items-center gap-3 lg:hidden"><span className="text-sm font-semibold">SPWeb <span className="text-gold">Lucro</span></span></Link>

        <div className="mt-8 space-y-4">
          {configMissing && <InlineNotice tone="info">A autenticação real aguarda a configuração segura do projeto Supabase. Os dados não são simulados.</InlineNotice>}
          {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}
        </div>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          {!updatingPassword && <label className="block"><span className="mb-2 block text-xs font-medium text-paper">E-mail</span><span className="relative block"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16}/><input className="field pl-10" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com.br" /></span></label>}
          {(mode !== 'recovery' || updatingPassword) && <label className="block"><span className="mb-2 block text-xs font-medium text-paper">{updatingPassword ? 'Nova senha' : 'Senha'}</span><span className="relative block"><LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16}/><input className="field pl-10 pr-11" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' || updatingPassword ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres"/><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-paper" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>}
          {!hasSupabaseConfig && <button type="button" className="btn-primary w-full opacity-60" disabled>{pageCopy.button}<ArrowRight size={15}/></button>}
          {hasSupabaseConfig && <button className="btn-primary w-full" disabled={busy}>{busy ? 'Aguarde…' : pageCopy.button}<ArrowRight size={15}/></button>}
        </form>
      </div>
    </section>
  </main>
}
