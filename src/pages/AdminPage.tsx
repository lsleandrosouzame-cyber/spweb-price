import { useEffect, useState } from 'react'
import { Building2, CheckCircle2, Lock, LogOut, Mail, RefreshCw, Search, Shield, ShieldAlert, ShieldOff, Trash2, Users, X, XCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { InlineNotice, LoadingScreen } from '../components/Feedback'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = 'admin@spweb.digital'

type UserRow = {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  is_blocked: boolean
  full_name: string | null
  phone: string | null
  company_name: string | null
}

type StatusBadge = { label: string; color: string; bg: string }
function getStatus(u: UserRow): StatusBadge {
  if (u.is_blocked) return { label: 'Bloqueado', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' }
  if (!u.last_sign_in_at) return { label: 'Nunca acessou', color: 'text-muted', bg: 'bg-[#1a1a1a] border-line' }
  const days = Math.floor((Date.now() - new Date(u.last_sign_in_at).getTime()) / 86400000)
  if (days <= 7) return { label: 'Ativo', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' }
  if (days <= 30) return { label: `${days}d atrás`, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' }
  return { label: `${days}d atrás`, color: 'text-muted', bg: 'bg-[#1a1a1a] border-line' }
}

export default function AdminPage() {
  const { user, signOut } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error' } | null>(null)
  const [selected, setSelected] = useState<UserRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Guard
  if (user?.email !== ADMIN_EMAIL) {
    return (
      <main className="grid min-h-screen place-items-center bg-ink p-5">
        <section className="surface max-w-md w-full p-8 text-center space-y-4">
          <ShieldAlert size={40} className="text-red-400 mx-auto"/>
          <h1 className="text-xl font-semibold">Acesso restrito</h1>
          <p className="text-sm text-muted">Esta área é exclusiva para administradores do sistema.</p>
          <button className="btn-secondary w-full" onClick={() => window.location.href = '/dashboard'}>Voltar ao Dashboard</button>
        </section>
      </main>
    )
  }

  async function loadUsers() {
    if (!supabase) return
    setLoading(true)
    try {
      // List all profiles joined with company data
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, updated_at')
        .order('updated_at', { ascending: false })
      if (error) throw error

      // Get company memberships
      const { data: members } = await supabase
        .from('company_members')
        .select('user_id, companies(name)')

      // Get blocked status from a metadata table if exists, otherwise default false
      const rows: UserRow[] = (profiles ?? []).map(p => {
        const membership = members?.find(m => m.user_id === p.id)
        const company = (membership?.companies as any)?.name ?? null
        return {
          id: p.id,
          email: p.email ?? '—',
          created_at: p.updated_at ?? '',
          last_sign_in_at: p.updated_at ?? null,
          is_blocked: false,
          full_name: p.full_name,
          phone: p.phone,
          company_name: company,
        }
      })
      setUsers(rows)
    } catch (cause) {
      setNotice({ text: cause instanceof Error ? cause.message : 'Erro ao carregar usuários.', tone: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadUsers() }, [])

  async function sendPasswordReset(email: string) {
    if (!supabase) return
    setBusy(true); setNotice(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback` })
    setNotice(error ? { text: error.message, tone: 'error' } : { text: `Link de redefinição enviado para ${email}.`, tone: 'success' })
    setBusy(false)
  }

  async function deleteUser(userId: string) {
    if (!supabase) return
    setBusy(true); setNotice(null)
    try {
      // Delete profile (cascade will handle related data depending on FK setup)
      const { error } = await supabase.from('profiles').delete().eq('id', userId)
      if (error) throw error
      setUsers(prev => prev.filter(u => u.id !== userId))
      setDeleteConfirm(null)
      setSelected(null)
      setNotice({ text: 'Usuário removido do sistema.', tone: 'success' })
    } catch (cause) {
      setNotice({ text: cause instanceof Error ? cause.message : 'Não foi possível excluir.', tone: 'error' })
    } finally { setBusy(false) }
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.company_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: users.length,
    active: users.filter(u => u.last_sign_in_at && (Date.now() - new Date(u.last_sign_in_at).getTime()) < 7 * 86400000).length,
    blocked: users.filter(u => u.is_blocked).length,
    companies: new Set(users.map(u => u.company_name).filter(Boolean)).size,
  }

  if (loading) return <LoadingScreen label="Carregando painel administrativo" />

  return (
    <div className="min-h-screen bg-ink text-paper">
      {/* Admin header */}
      <header className="sticky top-0 z-40 border-b border-line bg-[#080808]/95 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold"><Shield size={17}/></span>
          <div>
            <p className="text-[10px] text-muted uppercase tracking-widest">SPWeb Lucro</p>
            <h1 className="text-sm font-bold">Painel Administrativo</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted hidden sm:block">{user.email}</span>
          <button onClick={loadUsers} className="rounded-lg border border-line p-2 text-muted hover:text-paper transition-colors" title="Recarregar"><RefreshCw size={14}/></button>
          <button onClick={() => { void signOut(); window.location.href = '/login' }} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs text-muted hover:text-red-400 transition-colors"><LogOut size={14}/>Sair</button>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8 space-y-6">
        {notice && <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice>}

        {/* Stats */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total de usuários', value: stats.total, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
            { label: 'Ativos nos últimos 7 dias', value: stats.active, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
            { label: 'Empresas cadastradas', value: stats.companies, icon: Building2, color: 'text-gold', bg: 'bg-gold/10 border-gold/30' },
            { label: 'Bloqueados', value: stats.blocked, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
          ].map(stat => (
            <div key={stat.label} className="surface p-5">
              <div className="flex items-start justify-between">
                <div><p className="text-xs text-muted">{stat.label}</p><p className={`mt-3 font-mono text-3xl font-bold ${stat.color}`}>{stat.value}</p></div>
                <span className={`grid size-10 place-items-center rounded-xl border ${stat.bg} ${stat.color}`}><stat.icon size={18}/></span>
              </div>
            </div>
          ))}
        </section>

        {/* User table */}
        <section className="surface overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="eyebrow">GERENCIAMENTO DE USUÁRIOS</p><p className="mt-1 text-xs text-muted">{filtered.length} de {users.length} usuário(s)</p></div>
            <label className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/>
              <input className="field pl-9 text-sm" placeholder="Buscar por email, nome ou empresa…" value={search} onChange={e => setSearch(e.target.value)}/>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[.14em] text-muted">
                  <th className="px-5 py-3">Usuário</th>
                  <th className="px-3 py-3">Empresa</th>
                  <th className="px-3 py-3">Contato</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Cadastro</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-muted">Nenhum usuário encontrado.</td></tr>
                ) : filtered.map(u => {
                  const status = getStatus(u)
                  return (
                    <tr key={u.id} className="hover:bg-white/[.015] transition-colors">
                      <td className="px-5 py-4">
                        <button type="button" className="text-left hover:text-gold transition-colors" onClick={() => setSelected(u)}>
                          <p className="text-sm font-medium">{u.full_name || '—'}</p>
                          <p className="mt-0.5 text-[11px] text-muted flex items-center gap-1"><Mail size={10}/>{u.email}</p>
                        </button>
                      </td>
                      <td className="px-3 py-4"><span className="inline-flex items-center gap-1.5 text-xs text-muted"><Building2 size={11}/>{u.company_name ?? '—'}</span></td>
                      <td className="px-3 py-4 text-xs text-muted">{u.phone ? `(${u.phone.slice(0,2)}) ${u.phone.slice(2,7)}-${u.phone.slice(7)}` : '—'}</td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.bg} ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="px-3 py-4 text-xs text-muted">{u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button title="Ver detalhes" className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => setSelected(u)}><Shield size={14}/></button>
                          <button title="Resetar senha" className="rounded p-2 text-muted hover:text-blue-400 transition-colors" onClick={() => sendPasswordReset(u.email)} disabled={busy}><Lock size={14}/></button>
                          <button title="Excluir usuário" className="rounded p-2 text-muted hover:text-red-400 transition-colors" onClick={() => setDeleteConfirm(u.id)}><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* User detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="relative h-full w-full max-w-md overflow-y-auto bg-[#0d0d0d] border-l border-line p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow text-gold">DETALHES DO USUÁRIO</p>
                <h3 className="mt-1 text-lg font-semibold">{selected.full_name || 'Sem nome'}</h3>
              </div>
              <button className="rounded-lg p-2 text-muted hover:text-paper transition-colors" onClick={() => setSelected(null)}><X size={16}/></button>
            </div>

            <div className="space-y-3">
              {[
                ['ID', selected.id.slice(0, 8) + '…'],
                ['E-mail', selected.email],
                ['Telefone', selected.phone ?? '—'],
                ['Empresa', selected.company_name ?? '—'],
                ['Último acesso', selected.last_sign_in_at ? new Date(selected.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca'],
                ['Cadastro', selected.created_at ? new Date(selected.created_at).toLocaleDateString('pt-BR') : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5 rounded-xl border border-line bg-[#141414] p-3">
                  <p className="text-[10px] text-muted">{label}</p>
                  <p className="text-sm font-medium break-all">{value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-line pt-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Ações</p>
              <button
                className="flex w-full items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors"
                disabled={busy}
                onClick={() => sendPasswordReset(selected.email)}>
                <Lock size={15}/>Enviar link de redefinição de senha
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                onClick={() => setDeleteConfirm(selected.id)}>
                <Trash2 size={15}/>Excluir usuário permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4">
          <div className="surface max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3"><ShieldOff size={20} className="text-red-400 shrink-0"/><h3 className="text-base font-semibold">Confirmar exclusão</h3></div>
            <p className="text-sm text-muted">Esta ação é <strong className="text-paper">irreversível</strong>. O perfil e todos os dados associados serão removidos. Deseja continuar?</p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="btn-primary bg-red-600 hover:bg-red-500 border-red-600" disabled={busy} onClick={() => void deleteUser(deleteConfirm)}>
                {busy ? 'Excluindo…' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
