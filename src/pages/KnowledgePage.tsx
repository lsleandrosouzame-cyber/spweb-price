import { Video } from 'lucide-react'
import { EmptyState } from '../components/Feedback'

export default function KnowledgePage() {
  return <div className="space-y-6"><div><p className="eyebrow text-gold">APRENDIZADO APLICADO</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Central de conhecimento</h2><p className="mt-2 text-sm text-muted">Conteúdos práticos para tomar decisões melhores.</p></div><EmptyState title="Estamos preparando conteúdos para ajudar você a precificar melhor e lucrar mais." description="Em breve, esta área terá vídeos organizados por temas e categorias para apoiar sua rotina financeira." action={<span className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/5 px-3 py-1.5 text-[10px] font-semibold tracking-[.16em] text-gold"><Video size={13}/>EM BREVE.</span>}/></div>
}
