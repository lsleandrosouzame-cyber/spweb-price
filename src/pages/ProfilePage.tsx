import { useEffect, useState, type FormEvent } from 'react'
import { UserRound, Save } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { InlineNotice, LoadingScreen } from '../components/Feedback'
import { supabase } from '../lib/supabase'

export default function ProfilePage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
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
  return <div className="mx-auto max-w-2xl space-y-6"><div><p className="eyebrow text-gold">SUA CONTA</p><h2 className="mt-2 text-2xl font-semibold">Perfil</h2><p className="mt-2 text-sm text-muted">Gerencie as informações básicas vinculadas ao seu acesso.</p></div><form className="surface space-y-5 p-5 sm:p-7" onSubmit={submit}><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full border border-gold/25 bg-gold/5 text-gold"><UserRound size={18}/></span><div><p className="text-sm font-medium">Dados de acesso</p><p className="text-xs text-muted">A sessão é gerenciada pelo Supabase Auth.</p></div></div>{notice && <InlineNotice tone={notice.error ? 'error' : 'success'}>{notice.text}</InlineNotice>}<label className="block"><span className="mb-2 block text-xs font-medium text-paper">Nome</span><input className="field" maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome"/></label><label className="block"><span className="mb-2 block text-xs font-medium text-paper">E-mail</span><input className="field opacity-70" disabled value={user?.email ?? ''}/></label><button className="btn-primary" disabled={saving || !supabase}>{saving ? 'Salvando…' : 'Salvar perfil'}<Save size={15}/></button></form></div>
}
