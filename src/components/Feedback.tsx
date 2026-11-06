import { AlertCircle, ArrowRight, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

export function LoadingScreen({ label = 'Carregando' }: { label?: string }) {
  return <div className="grid min-h-screen place-items-center bg-ink px-6 text-center"><div><LoaderCircle className="mx-auto mb-4 animate-spin" size={26} style={{ color: '#1A3C34' }}/><p className="text-sm text-muted">{label}</p></div></div>
}

export function InlineNotice({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' | 'success' }) {
  const style = tone === 'error' ? 'border-red-300 bg-red-50 text-red-700' : tone === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'
  return <div role="status" className={`flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm font-medium ${style}`}><AlertCircle size={16} className="mt-0.5 shrink-0" /><div>{children}</div></div>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="surface flex min-h-60 flex-col items-center justify-center px-6 py-10 text-center">
    <div className="mb-4 grid size-12 place-items-center rounded-full border border-teal-border bg-teal-light" style={{ color: '#1A3C34' }}><ArrowRight size={18} /></div>
    <h3 className="text-base font-bold text-paper">{title}</h3>
    <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
}
