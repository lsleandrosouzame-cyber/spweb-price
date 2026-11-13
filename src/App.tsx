import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { LoadingScreen } from './components/Feedback'
import { lazy, Suspense, type ReactNode } from 'react'

const AppShell = lazy(() => import('./layouts/AppShell'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const SimulatorPage = lazy(() => import('./pages/SimulatorPage'))
const CadastroPage = lazy(() => import('./pages/CadastroPage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'))
const KnowledgePage = lazy(() => import('./pages/KnowledgePage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

function Protected({ children }: { children: ReactNode }) {
  const { user, loading, companyError, refreshCompanies } = useAuth()
  const location = useLocation()
  // Only block render while auth state is being resolved
  if (loading) return <LoadingScreen label="Verificando sua sessão" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (companyError) return <CompanyLookupFailure onRetry={() => void refreshCompanies()} />
  return <>{children}</>
}

function CompanyLookupFailure({ onRetry }: { onRetry: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-ink p-5"><section className="surface w-full max-w-lg p-6 sm:p-8"><p className="eyebrow text-gold">ACESSO PROTEGIDO</p><h1 className="mt-3 text-xl font-semibold">Não foi possível verificar sua empresa</h1><p className="mt-3 text-sm leading-6 text-muted">Não vamos iniciar um novo cadastro enquanto não confirmarmos sua associação. Seus dados continuam protegidos. Tente novamente em instantes.</p><button className="btn-primary mt-6" onClick={onRetry}>Tentar novamente</button></section></main>
}

function LandingRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen label="Carregando SPWeb Lucro" />
  return <Navigate to={user ? '/dashboard' : '/login'} replace />
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen label="Abrindo o SPWeb Lucro" />}><Routes>
      <Route path="/" element={<LandingRedirect />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/recovery" element={<AuthPage mode="recovery" />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/admin" element={<Protected><AdminPage /></Protected>} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/simulador" element={<SimulatorPage />} />
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/produtos" element={<ProductsPage />} />
        <Route path="/videos" element={<KnowledgePage />} />
        <Route path="/lancamentos" element={<ExpensesPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<LandingRedirect />} />
    </Routes></Suspense>
  )
}
