import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { InlineNotice } from '../components/Feedback'

export default function OnboardingPage() {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user, companies, companiesLoading, refreshCompanies } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!companiesLoading && companies.length > 0) navigate('/dashboard', { replace: true })
  }, [companies.length, companiesLoading, navigate])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !user) { setError('Não foi possível confirmar sua sessão. Entre novamente.'); return }
    const normalizedName = name.trim()
    if (normalizedName.length < 2) { setError('Informe o nome da empresa.'); return }
    setBusy(true); setError(null)
    try {
      const { data: companyId, error: companyError } = await supabase.rpc('create_company_with_owner', { p_company_name: normalizedName })
      if (companyError) throw companyError
      if (!companyId) throw new Error('Não foi possível confirmar a criação da empresa. Tente novamente.')
      await refreshCompanies()
      navigate('/dashboard', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a empresa.')
    } finally { setBusy(false) }
  }

  return <main className="grid min-h-screen place-items-center bg-ink px-5 py-10">
    <div className="w-full max-w-xl">
      <div className="mb-10 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold"><Building2 size={19}/></span><span className="text-sm font-semibold">SPWeb <span className="text-gold">Lucro</span></span></div>
      <p className="eyebrow text-gold">CONFIGURAÇÃO INICIAL · 1 DE 1</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Vamos organizar os números da sua empresa.</h1><p className="mt-3 max-w-lg text-sm leading-6 text-muted">Começamos pelo essencial. Você poderá cadastrar produtos, serviços e despesas quando estiver pronto.</p>
      <form className="surface mt-8 space-y-5 p-5 sm:p-7" onSubmit={submit}>
        {error && <InlineNotice>{error}</InlineNotice>}
        <label className="block"><span className="mb-2 block text-xs font-medium text-paper">Como sua empresa é chamada?</span><input className="field" autoFocus required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Ateliê Aurora" /></label>
        <p className="text-xs leading-5 text-muted">A empresa será vinculada à sua conta. O acesso aos registros será controlado por políticas do banco e pela sua associação.</p>
        <button className="btn-primary w-full" disabled={busy || !supabase}>{busy ? 'Salvando…' : 'Continuar'}<ArrowRight size={16}/></button>
        {!supabase && <p className="text-xs text-attention">A conexão Supabase precisa ser configurada antes de salvar.</p>}
      </form>
    </div>
  </main>
}
