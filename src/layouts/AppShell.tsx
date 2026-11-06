import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Calculator, ChevronLeft, ChevronRight, CircleUserRound, Command, LayoutDashboard, LogOut, Menu, ReceiptText, Settings2, Shield, Video, X, Package } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const primaryNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/calculo', label: 'Cálculo', icon: Calculator },
  { to: '/videos', label: 'Vídeos', icon: Video },
  { to: '/lancamentos', label: 'Lançamentos', icon: ReceiptText },
]
const footerNav = [
  { to: '/perfil', label: 'Perfil', icon: CircleUserRound },
  { to: '/configuracoes', label: 'Configurações', icon: Settings2 },
]
const titles: Record<string, string> = {
  '/dashboard': 'Dashboard', '/produtos': 'Produtos', '/calculo': 'Cálculo', '/videos': 'Central de conhecimento',
  '/lancamentos': 'Lançamentos', '/perfil': 'Perfil', '/configuracoes': 'Configurações', '/admin': 'Painel Administrativo',
}

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, currentCompany, signOut } = useAuth()
  const isAdmin = user?.email === 'admin@spweb.digital'
  const location = useLocation()
  const navigate = useNavigate()
  const title = titles[location.pathname] ?? 'SPWeb Lucro'
  const initials = (user?.email?.slice(0, 2) ?? 'SP').toUpperCase()

  const logout = async () => {
    try { await signOut(); navigate('/login', { replace: true }) }
    catch { navigate('/login', { replace: true }) }
  }

  return <div className="min-h-screen bg-ink text-paper">
    {mobileOpen && <button aria-label="Fechar menu" className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setMobileOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-[#0d0d0d] transition-all duration-200 ${collapsed ? 'w-[76px]' : 'w-[248px]'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className={`flex h-[76px] items-center border-b border-line ${collapsed ? 'justify-center px-3' : 'justify-between px-5'}`}>
        <button className="flex items-center gap-3" onClick={() => navigate('/dashboard')} aria-label="Ir ao dashboard">
          <img src="/spweb-lucro-mark.svg" alt="" className="size-9 shrink-0 rounded-xl" />
          {!collapsed && <span className="text-left leading-tight"><span className="block text-sm font-semibold tracking-tight">SPWeb <span className="text-gold">Lucro</span></span><span className="mt-1 block text-[9px] font-medium uppercase tracking-[.19em] text-muted">Inteligência financeira</span></span>}
        </button>
        <button className="hidden rounded-md p-1 text-muted hover:text-paper lg:block" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
        <button className="rounded-md p-1 text-muted hover:text-paper lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={17} /></button>
      </div>

      {!collapsed && <div className="mx-4 mt-6 rounded-lg border border-line bg-[#121212] px-3 py-3">
        <p className="eyebrow">Empresa ativa</p><p className="mt-2 truncate text-sm font-medium text-paper">{currentCompany?.name ?? 'Nenhuma empresa'}</p>
      </div>}
      <nav aria-label="Navegação principal" className="mt-6 flex-1 px-3">
        {!collapsed && <p className="eyebrow px-3 pb-3">Visão geral</p>}
        <div className="space-y-1">{primaryNav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined} className={({ isActive }) => `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition ${isActive ? 'border border-gold/20 bg-gold/[.08] font-medium text-gold' : 'border border-transparent text-muted hover:bg-white/[.035] hover:text-paper'} ${collapsed ? 'justify-center' : ''}`}>
          <Icon size={17} strokeWidth={1.8} /><span className={collapsed ? 'sr-only' : ''}>{label}</span>{to === '/dashboard' && !collapsed && <span className="ml-auto size-1.5 rounded-full bg-gold" />}
        </NavLink>)}</div>
      </nav>
      <div className="border-t border-line px-3 py-4">
        {!collapsed && <p className="eyebrow px-3 pb-3">Conta</p>}
        <div className="space-y-1">{footerNav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition ${isActive ? 'bg-white/[.05] text-paper' : 'text-muted hover:bg-white/[.035] hover:text-paper'} ${collapsed ? 'justify-center' : ''}`}><Icon size={16} /><span className={collapsed ? 'sr-only' : ''}>{label}</span></NavLink>)}
          <button onClick={logout} title={collapsed ? 'Sair' : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-muted transition hover:bg-negative/5 hover:text-negative ${collapsed ? 'justify-center' : ''}`}><LogOut size={16} /><span className={collapsed ? 'sr-only' : ''}>Sair</span></button>
          {isAdmin && <NavLink to="/admin" onClick={() => setMobileOpen(false)} title={collapsed ? 'Admin' : undefined} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition ${isActive ? 'bg-gold/[.08] text-gold border border-gold/20' : 'text-gold/70 hover:bg-gold/5 hover:text-gold'} ${collapsed ? 'justify-center' : ''}`}><Shield size={16} /><span className={collapsed ? 'sr-only' : ''}>Painel Admin</span></NavLink>}</div>
        {!collapsed && <div className="mt-4 flex items-center gap-2.5 border-t border-line px-2 pt-4"><span className="grid size-8 shrink-0 place-items-center rounded-full border border-gold/20 bg-[#1a1a1a] text-[10px] font-semibold text-gold">{initials}</span><span className="min-w-0"><span className="block truncate text-xs font-medium text-paper">{user?.email}</span><span className="mt-0.5 block text-[10px] text-muted">Conta conectada</span></span></div>}
      </div>
    </aside>

    <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-[248px]'}`}>
      <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-line bg-ink/90 px-4 backdrop-blur-xl md:px-8">
        <div className="flex items-center gap-3"><button className="rounded-lg border border-line bg-graphite p-2 text-muted lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={18} /></button><div><p className="eyebrow hidden sm:block">SPWEB LUCRO <span className="px-1.5 text-gold">/</span> {title.toUpperCase()}</p><h1 className="mt-1 text-base font-semibold tracking-tight sm:text-lg">{title}</h1></div></div>
        <div className="flex items-center gap-2 rounded-full border border-line bg-graphite px-3 py-2 text-[11px] text-muted"><Command size={13} className="text-gold" /><span className="hidden sm:inline">Dados em tempo real</span><span className="size-1.5 rounded-full bg-positive" /></div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-9"><Outlet /></main>
    </div>
    <span className="sr-only"><Video /></span>
  </div>
}
