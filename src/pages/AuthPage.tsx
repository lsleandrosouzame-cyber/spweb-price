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
    <section className="relative hidden min-h-screen overflow-hidden border-r border-line bg-[#0b0b0b] p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
      <div className="absolute -left-40 top-1/4 size-[540px] rounded-full border border-gold/[.06]" /><div className="absolute -left-16 top-[30%] size-[380px] rounded-full border border-gold/[.08]" />
      <Link to="/login" className="relative z-10 flex w-fit items-center gap-3"><img src="/spweb-lucro-mark.svg" alt="" className="size-10 rounded-xl" /><span className="text-sm font-semibold">SPWeb <span className="text-gold">Lucro</span></span></Link>
      <div className="relative z-10 max-w-xl"><span className="eyebrow text-gold">INTELIGÊNCIA PARA DECIDIR</span><h1 className="mt-6 text-4xl font-semibold leading-[1.16] tracking-[-.04em] xl:text-5xl">Pare de adivinhar seus preços.</h1><p className="mt-5 max-w-md text-lg leading-8 text-muted">Descubra quanto você realmente ganha.</p><div className="mt-12 flex items-center gap-3"><span className="h-px w-10 bg-gold"/><span className="text-xs tracking-wide text-muted">Clareza financeira para quem empreende.</span></div></div>
      <p className="relative z-10 text-[10px] text-[#606060]">SPWEB LUCRO · PRECISÃO QUE VIRA DECISÃO</p>
    </section>

    <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
      <div className="w-full max-w-[420px]">
        <Link to="/login" className="mb-12 flex items-center gap-3 lg:hidden"><img src="/spweb-lucro-mark.svg" alt="" className="size-9 rounded-xl" /><span className="text-sm font-semibold">SPWeb <span className="text-gold">Lucro</span></span></Link>
        <p className="eyebrow text-gold">SUA EMPRESA, COM MAIS CLAREZA</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">{pageCopy.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{pageCopy.subtitle}</p>

        <div className="mt-8 space-y-4">
          {configMissing && <InlineNotice tone="info">A autenticação real aguarda a configuração segura do projeto Supabase. Os dados não são simulados.</InlineNotice>}
          {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}
        </div>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          {!updatingPassword && <label className="block"><span className="mb-2 block text-xs font-medium text-[#c7c7c7]">E-mail</span><span className="relative block"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16}/><input className="field pl-10" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com.br" /></span></label>}
          {(mode !== 'recovery' || updatingPassword) && <label className="block"><span className="mb-2 block text-xs font-medium text-[#c7c7c7]">{updatingPassword ? 'Nova senha' : 'Senha'}</span><span className="relative block"><LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16}/><input className="field pl-10 pr-11" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' || updatingPassword ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres"/><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-paper" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>}
          {!hasSupabaseConfig && <button type="button" className="btn-primary w-full opacity-60" disabled>{pageCopy.button}<ArrowRight size={15}/></button>}
          {hasSupabaseConfig && <button className="btn-primary w-full" disabled={busy}>{busy ? 'Aguarde…' : pageCopy.button}<ArrowRight size={15}/></button>}
        </form>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          {mode === 'login' ? <><Link className="hover:text-gold" to="/recovery">Esqueci minha senha</Link><Link className="hover:text-gold" to="/signup">Criar conta <span className="text-gold">→</span></Link></> : mode === 'signup' ? <><span>Já tem uma conta?</span><Link className="hover:text-gold" to="/login">Entrar <span className="text-gold">→</span></Link></> : <Link className="hover:text-gold" to="/login">Voltar para entrar <span className="text-gold">→</span></Link>}
        </div>
        <p className="mt-10 border-t border-line pt-5 text-center text-[10px] leading-5 text-[#666]">Ao continuar, você concorda em usar os dados da sua empresa para calcular indicadores e simulações. A margem de contribuição não representa lucro líquido.</p>
      </div>
    </section>
  </main>
}
