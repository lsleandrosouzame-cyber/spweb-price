import { useEffect, useState, type FormEvent } from 'react'
import { UserRound, Save, Calendar, Clock, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { InlineNotice, LoadingScreen } from '../components/Feedback'
import { supabase } from '../lib/supabase'

export default function ProfilePage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [subscriptionStart] = useState(new Date('2024-11-05')) // Data de início da assinatura
  const [daysRemaining, setDaysRemaining] = useState(0)
  
  useEffect(() => {
    const calculateDays = () => {
      const now = new Date()
      const endDate = new Date(subscriptionStart)
      endDate.setFullYear(endDate.getFullYear() + 1) // 12 meses
      const diff = endDate.getTime() - now.getTime()
      const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
      setDaysRemaining(days)
    }
    calculateDays()
    const interval = setInterval(calculateDays, 1000 * 60 * 60) // atualiza a cada hora
    return () => clearInterval(interval)
  }, [subscriptionStart])

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase || !user) { setLoading(false); return }
      const { data, error } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      if (!active) return
      if (error) setNotice({ text: error.message, error: true })
      setName(data?.full_name ?? '')
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [user?.id])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !user) return
    setSaving(true); setNotice(null)
    const { error } = await supabase.from('profiles').upsert({ id: user.id, full_name: name.trim(), email: user.email }, { onConflict: 'id' })
    setNotice(error ? { text: error.message, error: true } : { text: 'Perfil atualizado.' })
    setSaving(false)
  }
  if (loading) return <LoadingScreen label="Carregando perfil" />
  
  const subscriptionEnd = new Date(subscriptionStart)
  subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1)
  const totalDays = 365
  const daysElapsed = totalDays - daysRemaining
  const progressPercent = (daysElapsed / totalDays) * 100
  
  return <div className="mx-auto max-w-2xl space-y-6"><div><p className="eyebrow text-gold">SUA CONTA</p><h2 className="mt-2 text-2xl font-semibold">Perfil</h2><p className="mt-2 text-sm text-muted">Gerencie as informações básicas vinculadas ao seu acesso.</p></div>

    {/* Card de Assinatura */}
    <div className="surface relative overflow-hidden p-6 sm:p-8">
      {/* Background gradient decorativo */}
      <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-emerald-500/5" />
      <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
      
      <div className="relative space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-gold to-yellow-600 shadow-lg shadow-gold/25">
              <Zap size={24} className="text-ink" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Assinatura Ativa</h3>
              <p className="text-xs text-muted">Plano Anual SPWeb Lucro</p>
            </div>
          </div>
          <div className="rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
            ● Vigente
          </div>
        </div>

        {/* Contador Regressivo - Destaque Principal */}
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-gold/20 via-yellow-500/20 to-emerald-500/20 blur-xl" />
          <div className="relative rounded-2xl border border-gold/20 bg-ink/40 p-6 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-gold">Tempo restante</p>
              <div className="mt-3 flex items-baseline justify-center gap-2">
                <Clock size={32} className="text-gold animate-pulse" />
                <span className="text-6xl font-bold tracking-tight text-paper">{daysRemaining}</span>
                <span className="text-2xl font-medium text-muted">dias</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink/60">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-gold via-yellow-500 to-emerald-500 shadow-lg shadow-gold/50 transition-all duration-1000"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-muted">{daysElapsed} de {totalDays} dias decorridos</p>
            </div>
          </div>
        </div>

        {/* Datas de Vigência */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-ink/20 p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Calendar size={18} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Início da vigência</p>
                <p className="mt-1 font-semibold text-paper">
                  {subscriptionStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl border border-border bg-ink/20 p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-gold/10 text-gold">
                <Calendar size={18} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Término da vigência</p>
                <p className="mt-1 font-semibold text-paper">
                  {subscriptionEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Informação adicional */}
        <div className="rounded-lg bg-gold/5 p-4 text-center">
          <p className="text-xs text-muted">
            Sua assinatura será renovada automaticamente em {' '}
            <span className="font-semibold text-gold">
              {subscriptionEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </p>
        </div>
      </div>
    </div>

    <form className="surface space-y-5 p-5 sm:p-7" onSubmit={submit}><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full border border-gold/25 bg-gold/5 text-gold"><UserRound size={18}/></span><div><p className="text-sm font-medium">Dados de acesso</p><p className="text-xs text-muted">A sessão é gerenciada pelo Supabase Auth.</p></div></div>{notice && <InlineNotice tone={notice.error ? 'error' : 'success'}>{notice.text}</InlineNotice>}<label className="block"><span className="mb-2 block text-xs font-medium text-paper">Nome</span><input className="field" maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome"/></label><label className="block"><span className="mb-2 block text-xs font-medium text-paper">E-mail</span><input className="field opacity-70" disabled value={user?.email ?? ''}/></label><button className="btn-primary" disabled={saving || !supabase}>{saving ? 'Salvando…' : 'Salvar perfil'}<Save size={15}/></button></form></div>
}
