import { AlertCircle, ArrowRight, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

export function LoadingScreen({ label = 'Carregando' }: { label?: string }) {
  return <div className="grid min-h-screen place-items-center bg-ink px-6 text-center"><div><LoaderCircle className="mx-auto mb-4 animate-spin text-gold" size={26} /><p className="text-sm text-muted">{label}</p></div></div>
}

export function InlineNotice({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' | 'success' }) {
  const style = tone === 'error' ? 'border-negative/30 bg-negative/5 text-[#ffb4b4]' : tone === 'success' ? 'border-positive/30 bg-positive/5 text-[#baf2ce]' : 'border-gold/25 bg-gold/5 text-[#e9d992]'
  return <div role="status" className={`flex items-start gap-2 rounded-lg border px-3.5 py-3 text-sm ${style}`}><AlertCircle size={16} className="mt-0.5 shrink-0" /><div>{children}</div></div>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="surface flex min-h-60 flex-col items-center justify-center px-6 py-10 text-center">
    <div className="mb-4 grid size-12 place-items-center rounded-full border border-gold/20 bg-gold/5 text-gold"><ArrowRight size={18} /></div>
    <h3 className="text-base font-semibold text-paper">{title}</h3>
    <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
}
