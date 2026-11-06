import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react'
import { Building2, Eye, EyeOff, KeyRound, Lock, MapPin, Phone, Save, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { InlineNotice, LoadingScreen } from '../components/Feedback'
import { supabase } from '../lib/supabase'

const labelClass = 'mb-2 block text-xs font-medium text-[#c7c7c7]'

// WhatsApp mask: (11) 99999-9999
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

// CEP mask: 99999-999
function maskCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

type CepData = { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean }

export default function SettingsPage() {
  const { currentCompany, refreshCompanies } = useAuth()

  // Company
  const [companyName, setCompanyName] = useState('')
  const [companyBusy, setCompanyBusy] = useState(false)
  const [companyNotice, setCompanyNotice] = useState<{ text: string; error?: boolean } | null>(null)

  // Profile
  const [profileName, setProfileName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileNotice, setProfileNotice] = useState<{ text: string; error?: boolean } | null>(null)

  // Address
  const [cep, setCep] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState<string | null>(null)

  // Password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState<{ text: string; error?: boolean } | null>(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase || !currentCompany) { setLoading(false); return }
      const [companyRes, profileRes] = await Promise.all([
        supabase.from('companies').select('name').eq('id', currentCompany.id).maybeSingle(),
        supabase.from('profiles').select('full_name, email, phone, address_street, address_number, address_neighborhood, address_city, address_state, address_cep').eq('id', (await supabase.auth.getUser()).data.user?.id ?? '').maybeSingle(),
      ])
      if (!active) return
      setCompanyName(companyRes.data?.name ?? currentCompany.name)
      if (profileRes.data) {
        setProfileName(profileRes.data.full_name ?? '')
        setEmail(profileRes.data.email ?? '')
        setWhatsapp(profileRes.data.phone ? maskPhone(profileRes.data.phone) : '')
        setStreet(profileRes.data.address_street ?? '')
        setNumber(profileRes.data.address_number ?? '')
        setNeighborhood(profileRes.data.address_neighborhood ?? '')
        setCity(profileRes.data.address_city ?? '')
        setState(profileRes.data.address_state ?? '')
        setCep(profileRes.data.address_cep ? maskCep(profileRes.data.address_cep) : '')
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [currentCompany?.id])

  // CEP lookup
  async function lookupCep(rawCep: string) {
    const digits = rawCep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true); setCepError(null)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data: CepData = await res.json()
      if (data.erro) { setCepError('CEP não encontrado.'); return }
      setStreet(data.logradouro ?? '')
      setNeighborhood(data.bairro ?? '')
      setCity(data.localidade ?? '')
      setState(data.uf ?? '')
    } catch { setCepError('Não foi possível consultar o CEP.') }
    finally { setCepLoading(false) }
  }

  function handleCepChange(e: ChangeEvent<HTMLInputElement>) {
    const masked = maskCep(e.target.value)
    setCep(masked)
    if (masked.replace(/\D/g, '').length === 8) void lookupCep(masked)
  }

  async function saveCompany(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !currentCompany) return
    setCompanyBusy(true); setCompanyNotice(null)
    const { error } = await supabase.from('companies').update({ name: companyName.trim() }).eq('id', currentCompany.id)
    if (!error) await refreshCompanies()
    setCompanyNotice(error ? { text: error.message, error: true } : { text: 'Nome da empresa atualizado.' })
    setCompanyBusy(false)
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setProfileBusy(true); setProfileNotice(null)
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) { setProfileNotice({ text: 'Sessão inválida.', error: true }); setProfileBusy(false); return }
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: profileName.trim(),
      email: email.trim(),
      phone: whatsapp.replace(/\D/g, ''),
      address_street: street.trim(),
      address_number: number.trim(),
      address_neighborhood: neighborhood.trim(),
      address_city: city.trim(),
      address_state: state.trim(),
      address_cep: cep.replace(/\D/g, ''),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    setProfileNotice(error ? { text: error.message, error: true } : { text: 'Perfil atualizado com sucesso.' })
    setProfileBusy(false)
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    if (newPassword.length < 8) { setPasswordNotice({ text: 'A nova senha deve ter pelo menos 8 caracteres.', error: true }); return }
    if (newPassword !== confirmPassword) { setPasswordNotice({ text: 'As senhas não conferem.', error: true }); return }
    setPasswordBusy(true); setPasswordNotice(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) { setNewPassword(''); setConfirmPassword('') }
    setPasswordNotice(error ? { text: error.message, error: true } : { text: 'Senha atualizada com sucesso.' })
    setPasswordBusy(false)
  }

  if (loading) return <LoadingScreen label="Carregando configurações" />

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="eyebrow text-gold">PREFERÊNCIAS DA EMPRESA</p>
        <h2 className="mt-2 text-2xl font-semibold">Configurações</h2>
        <p className="mt-2 text-sm text-muted">Gerencie a empresa, seu perfil e segurança da conta.</p>
      </div>

      {/* ── Empresa ─────────────────────────────── */}
      <form className="surface space-y-5 p-5 sm:p-7" onSubmit={saveCompany}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg border border-gold/20 bg-gold/5 text-gold"><Building2 size={18}/></span>
          <div><p className="text-sm font-semibold">Empresa</p><p className="text-xs text-muted">Nome visível no sistema e nos relatórios.</p></div>
        </div>
        {companyNotice && <InlineNotice tone={companyNotice.error ? 'error' : 'success'}>{companyNotice.text}</InlineNotice>}
        <label className="block"><span className={labelClass}>Nome de exibição</span><input className="field" minLength={2} maxLength={120} required value={companyName} onChange={e => setCompanyName(e.target.value)}/></label>
        <button className="btn-primary" disabled={companyBusy || !supabase}>{companyBusy ? 'Salvando…' : 'Salvar'}<Save size={14}/></button>
      </form>

      {/* ── Perfil + Endereço ────────────────────── */}
      <form className="surface space-y-5 p-5 sm:p-7" onSubmit={saveProfile}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-400"><User size={18}/></span>
          <div><p className="text-sm font-semibold">Perfil pessoal</p><p className="text-xs text-muted">Seus dados de contato e localização.</p></div>
        </div>
        {profileNotice && <InlineNotice tone={profileNotice.error ? 'error' : 'success'}>{profileNotice.text}</InlineNotice>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}><User size={11} className="inline mr-1"/>Nome completo</span>
            <input className="field" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Seu nome"/>
          </label>
          <label>
            <span className={labelClass}><Phone size={11} className="inline mr-1"/>WhatsApp (com DDD)</span>
            <input className="field" value={whatsapp} onChange={e => setWhatsapp(maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="tel"/>
          </label>
          <label>
            <span className={labelClass}>E-mail de contato</span>
            <input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com.br"/>
          </label>
        </div>

        {/* Endereço */}
        <div className="border-t border-line pt-4 space-y-4">
          <div className="flex items-center gap-2"><MapPin size={14} className="text-gold"/><p className="text-xs font-semibold text-paper">Endereço</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={labelClass}>CEP</span>
              <div className="relative">
                <input className="field pr-10" value={cep} onChange={handleCepChange} placeholder="00000-000" inputMode="numeric" maxLength={9}/>
                {cepLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin rounded-full border-2 border-gold/30 border-t-gold"/>}
              </div>
              {cepError && <p className="mt-1 text-[10px] text-red-400">{cepError}</p>}
            </label>
            <label>
              <span className={labelClass}>Número do logradouro</span>
              <input className="field" value={number} onChange={e => setNumber(e.target.value)} placeholder="Ex.: 123"/>
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>Logradouro</span>
              <input className="field" value={street} onChange={e => setStreet(e.target.value)} placeholder="Preenchido automaticamente pelo CEP"/>
            </label>
            <label>
              <span className={labelClass}>Bairro</span>
              <input className="field" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Preenchido pelo CEP"/>
            </label>
            <div className="grid gap-3 grid-cols-[1fr_80px]">
              <label><span className={labelClass}>Cidade</span><input className="field" value={city} onChange={e => setCity(e.target.value)} placeholder="Cidade"/></label>
              <label><span className={labelClass}>UF</span><input className="field text-center" value={state} onChange={e => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2}/></label>
            </div>
          </div>
        </div>

        <button className="btn-primary" disabled={profileBusy || !supabase}>{profileBusy ? 'Salvando…' : 'Salvar perfil'}<Save size={14}/></button>
      </form>

      {/* ── Alterar Senha ────────────────────────── */}
      <form className="surface space-y-5 p-5 sm:p-7" onSubmit={savePassword}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-400"><KeyRound size={18}/></span>
          <div><p className="text-sm font-semibold">Alterar senha</p><p className="text-xs text-muted">Mínimo de 8 caracteres. Use algo único e seguro.</p></div>
        </div>
        {passwordNotice && <InlineNotice tone={passwordNotice.error ? 'error' : 'success'}>{passwordNotice.text}</InlineNotice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}><Lock size={11} className="inline mr-1"/>Nova senha</span>
            <div className="relative">
              <input className="field pr-10" type={showNew ? 'text' : 'password'} minLength={8} required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password"/>
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-paper" onClick={() => setShowNew(v => !v)}>{showNew ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
            </div>
          </label>
          <label>
            <span className={labelClass}><Lock size={11} className="inline mr-1"/>Confirmar nova senha</span>
            <div className="relative">
              <input className="field pr-10" type={showConfirm ? 'text' : 'password'} minLength={8} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" autoComplete="new-password"/>
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-paper" onClick={() => setShowConfirm(v => !v)}>{showConfirm ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
            </div>
          </label>
        </div>
        {newPassword && confirmPassword && newPassword !== confirmPassword && (
          <p className="text-[11px] text-red-400">As senhas não conferem.</p>
        )}
        <button className="btn-primary" disabled={passwordBusy || !supabase}>{passwordBusy ? 'Atualizando…' : 'Atualizar senha'}<KeyRound size={14}/></button>
      </form>

      {/* ── Segurança ────────────────────────────── */}
      <div className="surface flex items-start gap-3 p-5">
        <ShieldCheck size={18} className="mt-0.5 text-positive shrink-0"/>
        <div><p className="text-sm font-medium">Isolamento e acesso</p><p className="mt-1 text-xs leading-5 text-muted">Os registros são protegidos por RLS no Supabase e associados à empresa conforme as permissões de participação. A chave administrativa não é distribuída ao navegador.</p></div>
      </div>
    </div>
  )
}
