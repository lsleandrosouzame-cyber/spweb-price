import { useEffect, useState, type FormEvent } from 'react'
import { Building2, CheckCircle2, Eye, Lock, LogOut, Mail, Plus, RefreshCw, Search, Shield, ShieldAlert, ShieldOff, Trash2, UserPlus, Users, X, XCircle } from 'lucide-react'
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
  company_id: string | null
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
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' })
  const [createBusy, setCreateBusy] = useState(false)
  const [createNotice, setCreateNotice] = useState<string | null>(null)

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
      // Use RPC to list all auth.users (bypasses RLS, includes users without profiles)
      const { data, error } = await supabase.rpc('admin_list_users')
      if (error) {
        // Fallback: query profiles directly if RPC not yet deployed
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, created_at, updated_at')
          .order('created_at', { ascending: false })
        if (profilesError) throw profilesError
        const { data: members } = await supabase
          .from('company_members')
          .select('user_id, company_id, companies(name)')
        const rows: UserRow[] = (profiles ?? []).map(p => {
          const membership = members?.find(m => m.user_id === p.id)
          return {
            id: p.id,
            email: p.email ?? '—',
            created_at: p.created_at ?? p.updated_at ?? '',
            last_sign_in_at: p.updated_at ?? null,
            is_blocked: false,
            full_name: p.full_name,
            phone: p.phone,
            company_name: (membership?.companies as any)?.name ?? null,
            company_id: membership?.company_id ?? null,
          }
        })
        setUsers(rows)
        return
      }
      // Map RPC results
      const rows: UserRow[] = (data ?? []).map((u: any) => ({
        id: u.id,
        email: u.email ?? '—',
        created_at: u.created_at ?? '',
        last_sign_in_at: u.last_sign_in_at ?? null,
        is_blocked: false,
        full_name: u.full_name,
        phone: u.phone,
        company_name: u.company_name,
        company_id: u.company_id,
      }))
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

  async function createUser(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    if (!createForm.email.trim() || !createForm.password || createForm.password.length < 8) {
      setCreateNotice('Informe email e senha com pelo menos 8 caracteres.')
      return
    }
    setCreateBusy(true); setCreateNotice(null)
    try {
      // Create user via Supabase Auth (admin sign up)
      const { data, error } = await supabase.auth.signUp({
        email: createForm.email.trim(),
        password: createForm.password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
      if (data.user) {
        // Create profile immediately
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: createForm.name.trim() || null,
          email: createForm.email.trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
      }
      setShowCreateModal(false)
      setCreateForm({ name: '', email: '', password: '' })
      setNotice({ text: `Usuário ${createForm.email} criado com sucesso.`, tone: 'success' })
      await loadUsers()
    } catch (cause) {
      setCreateNotice(cause instanceof Error ? cause.message : 'Não foi possível criar o usuário.')
    } finally { setCreateBusy(false) }
  }

  // Impersonate: redirect to dashboard as that user's context
  // We can't truly impersonate in Supabase free tier without admin API,
  // so we show their data summary and offer to view their company data
  function viewUserPanel(u: UserRow) {
    setSelected(u)
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
            <div>
              <p className="eyebrow">GERENCIAMENTO DE USUÁRIOS</p>
              <p className="mt-1 text-xs text-muted">{filtered.length} de {users.length} usuário(s)</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/>
                <input className="field pl-9 text-sm" placeholder="Buscar por email, nome ou empresa…" value={search} onChange={e => setSearch(e.target.value)}/>
              </label>
              <button
                className="btn-primary shrink-0 flex items-center gap-2"
                onClick={() => { setShowCreateModal(true); setCreateNotice(null) }}>
                <UserPlus size={15}/>Novo usuário
              </button>
            </div>
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
                  const isAdmin = u.email === ADMIN_EMAIL
                  return (
                    <tr key={u.id} className="hover:bg-white/[.015] transition-colors">
                      <td className="px-5 py-4">
                        <button type="button" className="text-left hover:text-gold transition-colors" onClick={() => viewUserPanel(u)}>
                          <div className="flex items-center gap-2">
                            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#1a1a1a] border border-line text-xs font-semibold text-gold">
                              {(u.full_name?.[0] ?? u.email[0]).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{u.full_name || '—'}{isAdmin && <span className="ml-2 text-[10px] bg-gold/10 text-gold border border-gold/30 rounded-full px-2 py-0.5">Admin</span>}</p>
                              <p className="mt-0.5 text-[11px] text-muted flex items-center gap-1"><Mail size={10}/>{u.email}</p>
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                          <Building2 size={11}/>
                          {u.company_name ?? <span className="italic text-[#444]">Sem empresa</span>}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-xs text-muted">{u.phone ? `(${u.phone.slice(0,2)}) ${u.phone.slice(2,7)}-${u.phone.slice(7)}` : '—'}</td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.bg} ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="px-3 py-4 text-xs text-muted">{u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button title="Ver painel do usuário" className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => viewUserPanel(u)}><Eye size={14}/></button>
                          <button title="Resetar senha" className="rounded p-2 text-muted hover:text-blue-400 transition-colors" onClick={() => sendPasswordReset(u.email)} disabled={busy || isAdmin}><Lock size={14}/></button>
                          <button title="Excluir usuário" className="rounded p-2 text-muted hover:text-red-400 transition-colors" disabled={isAdmin} onClick={() => !isAdmin && setDeleteConfirm(u.id)}><Trash2 size={14}/></button>
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
                <p className="eyebrow text-gold">PAINEL DO USUÁRIO</p>
                <h3 className="mt-1 text-lg font-semibold">{selected.full_name || 'Sem nome'}</h3>
                <p className="text-xs text-muted mt-0.5">{selected.email}</p>
              </div>
              <button className="rounded-lg p-2 text-muted hover:text-paper transition-colors" onClick={() => setSelected(null)}><X size={16}/></button>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-4 rounded-xl border border-line bg-[#141414] p-4">
              <div className="grid size-14 place-items-center rounded-full bg-gold/10 border border-gold/30 text-xl font-bold text-gold">
                {(selected.full_name?.[0] ?? selected.email[0]).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{selected.full_name || '—'}</p>
                <p className="text-xs text-muted mt-1">{selected.company_name ? `Empresa: ${selected.company_name}` : 'Sem empresa cadastrada'}</p>
                <span className={`mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatus(selected).bg} ${getStatus(selected).color}`}>{getStatus(selected).label}</span>
              </div>
            </div>

            <div className="space-y-2">
              {[
                ['ID do usuário', selected.id],
                ['E-mail', selected.email],
                ['Telefone', selected.phone ? `(${selected.phone.slice(0,2)}) ${selected.phone.slice(2,7)}-${selected.phone.slice(7)}` : '—'],
                ['Empresa', selected.company_name ?? '—'],
                ['Último acesso', selected.last_sign_in_at ? new Date(selected.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca'],
                ['Cadastro', selected.created_at ? new Date(selected.created_at).toLocaleString('pt-BR') : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5 rounded-xl border border-line bg-[#141414] p-3">
                  <p className="text-[10px] text-muted">{label}</p>
                  <p className="text-sm font-medium break-all">{value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-line pt-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Ações administrativas</p>

              <button
                className="flex w-full items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors"
                disabled={busy}
                onClick={() => sendPasswordReset(selected.email)}>
                <Lock size={15}/>Enviar link de redefinição de senha
              </button>

              {selected.email !== ADMIN_EMAIL && (
                <button
                  className="flex w-full items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  onClick={() => setDeleteConfirm(selected.id)}>
                  <Trash2 size={15}/>Excluir usuário permanentemente
                </button>
              )}

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400 leading-5">
                <p className="font-semibold mb-1">Nota sobre acesso ao painel</p>
                <p className="text-muted">Para acessar o painel completo de um usuário, faça login com as credenciais dele. O Supabase não permite impersonation no plano atual.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create user modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
          <div className="surface max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow text-gold">NOVO USUÁRIO</p>
                <h3 className="mt-1 text-lg font-semibold">Criar conta</h3>
              </div>
              <button className="rounded-lg p-2 text-muted hover:text-paper" onClick={() => setShowCreateModal(false)}><X size={16}/></button>
            </div>

            <form onSubmit={createUser} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-[#c7c7c7]">Nome completo · opcional</span>
                <input className="field" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex.: João Silva"/>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-[#c7c7c7]">E-mail <span className="text-gold">*</span></span>
                <input className="field" type="email" required value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="usuario@empresa.com"/>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-[#c7c7c7]">Senha <span className="text-gold">*</span></span>
                <input className="field" type="password" required minLength={8} value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" autoComplete="new-password"/>
              </label>
              {createNotice && <p className="text-xs text-red-400">{createNotice}</p>}
              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={createBusy}>
                  <Plus size={15}/>{createBusy ? 'Criando…' : 'Criar usuário'}
                </button>
              </div>
            </form>

            <p className="text-[10px] text-muted border-t border-line pt-3">O usuário receberá um e-mail de confirmação. Após confirmar, poderá criar sua empresa e usar o sistema.</p>
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
              <button
                className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
                disabled={busy}
                onClick={() => void deleteUser(deleteConfirm)}>
                {busy ? 'Excluindo…' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
