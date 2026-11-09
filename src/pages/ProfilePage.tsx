import { useEffect, useState, type FormEvent } from 'react'
import { UserRound, Save, Clock, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { InlineNotice, LoadingScreen } from '../components/Feedback'
import { supabase } from '../lib/supabase'

export default function ProfilePage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [subscriptionStart, setSubscriptionStart] = useState<Date | null>(null)
  const [daysRemaining, setDaysRemaining] = useState(0)
  
  useEffect(() => {
    if (!subscriptionStart) return
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
      const { data, error } = await supabase.from('profiles').select('full_name, created_at').eq('id', user.id).maybeSingle()
      if (!active) return
      if (error) setNotice({ text: error.message, error: true })
      setName(data?.full_name ?? '')
      // Use created_at from profile as subscription start date
      if (data?.created_at) {
        setSubscriptionStart(new Date(data.created_at))
      } else if (user.created_at) {
        // Fallback to user metadata created_at
        setSubscriptionStart(new Date(user.created_at))
      } else {
        // Ultimate fallback to current date
        setSubscriptionStart(new Date())
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [user?.id, user?.created_at])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !user) return
    setSaving(true); setNotice(null)
    const { error } = await supabase.from('profiles').upsert({ id: user.id, full_name: name.trim(), email: user.email }, { onConflict: 'id' })
    setNotice(error ? { text: error.message, error: true } : { text: 'Perfil atualizado.' })
    setSaving(false)
  }
  if (loading || !subscriptionStart) return <LoadingScreen label="Carregando perfil" />
  
  const subscriptionEnd = new Date(subscriptionStart)
  subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1)
  
  return <div className="mx-auto max-w-2xl space-y-6"><div><p className="eyebrow text-gold">SUA CONTA</p><h2 className="mt-2 text-2xl font-semibold">Perfil</h2><p className="mt-2 text-sm text-muted">Gerencie as informações básicas vinculadas ao seu acesso.</p></div>

    {/* Card de Assinatura - Discreet Professional Design */}
    <div className="surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-gold/10 text-gold">
            <Zap size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Plano Anual SPWeb Lucro</h3>
            <p className="text-xs text-muted">Assinatura vigente</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <Clock size={14} />
          <span>{daysRemaining} dias restantes</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted">Data de contratação</p>
          <p className="mt-1 text-sm font-medium text-paper">
            {subscriptionStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Data de expiração</p>
          <p className="mt-1 text-sm font-medium text-paper">
            {subscriptionEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>

    <form className="surface space-y-5 p-5 sm:p-7" onSubmit={submit}><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full border border-gold/25 bg-gold/5 text-gold"><UserRound size={18}/></span><div><p className="text-sm font-medium">Dados de acesso</p><p className="text-xs text-muted">A sessão é gerenciada pelo Supabase Auth.</p></div></div>{notice && <InlineNotice tone={notice.error ? 'error' : 'success'}>{notice.text}</InlineNotice>}<label className="block"><span className="mb-2 block text-xs font-medium text-paper">Nome</span><input className="field" maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome"/></label><label className="block"><span className="mb-2 block text-xs font-medium text-paper">E-mail</span><input className="field opacity-70" disabled value={user?.email ?? ''}/></label><button className="btn-primary" disabled={saving || !supabase}>{saving ? 'Salvando…' : 'Salvar perfil'}<Save size={15}/></button></form></div>
}
