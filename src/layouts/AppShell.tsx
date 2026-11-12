import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CircleUserRound, Command, LayoutDashboard, LogOut, Menu, ReceiptText, Settings2, Shield, Video, X, Package, Calculator } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const primaryNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, color: '#3b82f6' },
  { to: '/simulador', label: 'Simulador', icon: Calculator, color: '#D4AF37' },
  { to: '/cadastro', label: 'Cadastro', icon: Package, color: '#8b5cf6' },
  { to: '/produtos', label: 'Precificação', icon: Calculator, color: '#22c55e' },
  { to: '/videos', label: 'Vídeos', icon: Video, color: '#f97316' },
  { to: '/lancamentos', label: 'Lançamentos', icon: ReceiptText, color: '#ef4444' },
]
const footerNav = [
  { to: '/perfil', label: 'Perfil', icon: CircleUserRound, color: '#06b6d4' },
  { to: '/configuracoes', label: 'Configurações', icon: Settings2, color: '#6B7E78' },
]
const titles: Record<string, string> = {
  '/dashboard': 'Dashboard', '/simulador': 'Simulador', '/cadastro': 'Cadastro', '/produtos': 'Precificação', '/videos': 'Central de conhecimento',
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

  return (
    <div className="min-h-screen bg-ink text-paper">
      {/* Mobile overlay */}
      {mobileOpen && (
        <button aria-label="Fechar menu" className="fixed inset-0 z-40 bg-black/15 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-graphite transition-all duration-200
        ${collapsed ? 'w-[72px]' : 'w-[260px]'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{ boxShadow: '1px 0 20px rgba(0,0,0,.06)' }}>

        {/* Logo */}
        <div className={`flex h-[72px] items-center border-b border-line ${collapsed ? 'justify-center px-3' : 'justify-between px-5'}`}>
          <button className="flex items-center gap-3" onClick={() => navigate('/dashboard')} aria-label="Dashboard">
            {!collapsed && (
              <div className="text-left leading-tight">
                <span className="block text-sm font-extrabold tracking-tight" style={{ color: '#0D1F1A', fontFamily: 'Sora, sans-serif' }}>SPWeb <span style={{ color: '#1A3C34' }}>Lucro</span></span>
                <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[.18em]" style={{ color: '#3D5048', fontFamily: 'Sora, sans-serif' }}>Precificação Lucrativa</span>
              </div>
            )}
            {collapsed && (
              <span className="block text-sm font-extrabold tracking-tight" style={{ color: '#0D1F1A', fontFamily: 'Sora, sans-serif' }}>SPWeb</span>
            )}
          </button>
          <button className="hidden rounded-lg p-1.5 transition-colors hover:bg-teal-light lg:block" style={{ color: '#3D5048' }} onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expandir' : 'Recolher'}>
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
          <button className="rounded-lg p-1.5 lg:hidden" style={{ color: '#3D5048' }} onClick={() => setMobileOpen(false)}><X size={17} /></button>
        </div>

        {/* Company info - sem card */}
        {!collapsed && (
          <div className="mx-4 mt-5 px-3">
            <p className="text-[9px] font-bold uppercase tracking-[.18em]" style={{ color: '#3D5048' }}>Empresa ativa</p>
            <p className="mt-1 truncate text-sm font-bold" style={{ color: '#0D1F1A' }}>{currentCompany?.name ?? 'Nenhuma empresa'}</p>
          </div>
        )}

        {/* Primary nav */}
        <nav aria-label="Navegação principal" className="mt-5 flex-1 px-3">
          {!collapsed && <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[.18em]" style={{ color: '#3D5048' }}>Visão geral</p>}
          <div className="space-y-0.5">
            {primaryNav.map(({ to, label, icon: Icon, color }) => (
              <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined}
                className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-150 ${collapsed ? 'justify-center' : ''} ${
                  isActive
                    ? 'text-[#0D1F1A]'
                    : 'text-[#6B7E78] hover:bg-teal-light hover:text-[#1A3C34]'
                }`}
                style={({ isActive }) => isActive ? { background: '#C8FF00', fontWeight: 700 } : {}}>
                {({ isActive }) => (
                  <>
                    <Icon size={17} strokeWidth={2} style={{ color: isActive ? '#0D1F1A' : color }} />
                    <span className={collapsed ? 'sr-only' : ''}>{label}</span>
                    {to === '/dashboard' && !collapsed && (
                      <span className="ml-auto size-2 rounded-full" style={{ background: '#1A3C34' }} />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Footer nav */}
        <div className="border-t border-line px-3 py-4">
          {!collapsed && <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[.18em]" style={{ color: '#3D5048' }}>Conta</p>}
          <div className="space-y-0.5">
            {footerNav.map(({ to, label, icon: Icon, color }) => (
              <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined}
                className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all ${collapsed ? 'justify-center' : ''} ${isActive ? 'bg-teal-light text-teal' : 'text-[#6B7E78] hover:bg-teal-light hover:text-[#1A3C34]'}`}>
                {({ isActive }) => (
                  <>
                    <Icon size={16} style={{ color: isActive ? '#1A3C34' : color }} />
                    <span className={collapsed ? 'sr-only' : ''}>{label}</span>
                  </>
                )}
              </NavLink>
            ))}

            <button onClick={logout} title={collapsed ? 'Sair' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all hover:bg-red-50 hover:text-red-600 ${collapsed ? 'justify-center' : ''}`}
              style={{ color: '#3D5048' }}>
              <LogOut size={16} /><span className={collapsed ? 'sr-only' : ''}>Sair</span>
            </button>
            {isAdmin && (
              <NavLink to="/admin" onClick={() => setMobileOpen(false)} title={collapsed ? 'Admin' : undefined}
                className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-bold transition-all ${collapsed ? 'justify-center' : ''} ${isActive ? 'text-[#0D1F1A]' : 'text-[#1A3C34] hover:bg-teal-light'}`}
                style={({ isActive }) => isActive ? { background: '#C8FF00' } : {}}>
                <Shield size={16} /><span className={collapsed ? 'sr-only' : ''}>Painel Admin</span>
              </NavLink>
            )}
          </div>
          {!collapsed && (
            <div className="mt-4 flex items-center gap-2.5 border-t border-line px-2 pt-4">
              <div className="grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: '#1A3C34' }}>{initials}</div>
              <div className="min-w-0">
                <span className="block truncate text-xs font-semibold" style={{ color: '#0D1F1A' }}>{user?.email}</span>
                <span className="mt-0.5 block text-[10px]" style={{ color: '#3D5048' }}>Conta conectada</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'}`}>
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-[60px] sm:h-[72px] items-center justify-between border-b border-line bg-graphite/90 px-3 sm:px-4 md:px-8 backdrop-blur-xl"
          style={{ boxShadow: '0 1px 12px rgba(0,0,0,.05)' }}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button className="rounded-xl border border-line p-2 text-muted lg:hidden shrink-0" style={{ background: '#F8FAF9' }} onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={18} /></button>
            <div className="min-w-0">
              <p className="eyebrow hidden sm:block">SPWEB LUCRO <span className="px-1.5" style={{ color: '#1A3C34' }}>/</span> {title.toUpperCase()}</p>
              <h1 className="text-sm sm:text-base md:text-lg font-extrabold tracking-tight truncate" style={{ color: '#0D1F1A' }}>{title}</h1>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-line px-3 py-2 text-[11px] shrink-0" style={{ background: '#F2F4F3', color: '#3D5048' }}>
            <Command size={13} style={{ color: '#1A3C34' }} />
            <span className="hidden md:inline font-semibold">Dados em tempo real</span>
            <span className="size-2 rounded-full" style={{ background: '#00B87A' }} />
          </div>
        </header>

        {/* Page content with responsive padding */}
        <main className="p-3 sm:p-6 md:p-8 lg:p-10 mx-auto w-full max-w-[1440px]">
          <Outlet />
        </main>
      </div>

      {/* Keep Video icon in DOM to prevent tree-shaking */}
      <span className="sr-only"><Video /></span>
    </div>
  )
}
