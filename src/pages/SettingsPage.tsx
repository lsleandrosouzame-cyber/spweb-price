import { useEffect, useState, type FormEvent } from 'react'
import { Building2, Save, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { InlineNotice, LoadingScreen } from '../components/Feedback'
import { supabase } from '../lib/supabase'

export default function SettingsPage() {
  const { currentCompany, refreshCompanies } = useAuth()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase || !currentCompany) { setLoading(false); return }
      const { data, error } = await supabase.from('companies').select('name').eq('id', currentCompany.id).maybeSingle()
      if (!active) return
      if (error) setNotice({ text: error.message, error: true })
      setName(data?.name ?? currentCompany.name); setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [currentCompany?.id])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !currentCompany) return
    setBusy(true); setNotice(null)
    const { error } = await supabase.from('companies').update({ name: name.trim() }).eq('id', currentCompany.id)
    if (!error) await refreshCompanies()
    setNotice(error ? { text: error.message, error: true } : { text: 'Configuração da empresa atualizada.' })
    setBusy(false)
  }
  if (loading) return <LoadingScreen label="Carregando configurações" />
  return <div className="mx-auto max-w-2xl space-y-6"><div><p className="eyebrow text-gold">PREFERÊNCIAS DA EMPRESA</p><h2 className="mt-2 text-2xl font-semibold">Configurações</h2><p className="mt-2 text-sm text-muted">Dados da empresa atual e informações de segurança.</p></div><form className="surface space-y-5 p-5 sm:p-7" onSubmit={submit}><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg border border-gold/20 bg-gold/5 text-gold"><Building2 size={18}/></span><div><p className="text-sm font-medium">Empresa</p><p className="text-xs text-muted">Alterações só são permitidas para usuários autorizados.</p></div></div>{notice && <InlineNotice tone={notice.error ? 'error' : 'success'}>{notice.text}</InlineNotice>}<label className="block"><span className="mb-2 block text-xs font-medium text-[#c7c7c7]">Nome de exibição</span><input className="field" minLength={2} maxLength={120} required value={name} onChange={e => setName(e.target.value)}/></label><button className="btn-primary" disabled={busy || !supabase}>{busy ? 'Salvando…' : 'Salvar configurações'}<Save size={15}/></button></form><div className="surface flex items-start gap-3 p-5"><ShieldCheck size={18} className="mt-0.5 text-positive"/><div><p className="text-sm font-medium">Isolamento e acesso</p><p className="mt-1 text-xs leading-5 text-muted">Os registros são protegidos por RLS no Supabase e associados à empresa conforme as permissões de participação. A chave administrativa não é distribuída ao navegador.</p></div></div></div>
}
