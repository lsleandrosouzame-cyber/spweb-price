import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Copy, Eye, History, LoaderCircle, Package, Pencil, Plus, Search, Trash2, Wrench, ChevronLeft, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState, InlineNotice, LoadingScreen } from '../components/Feedback'
import { calculateProductPricing } from '../finance/pricing'
import { formatBRLFromCents, formatMarkup, formatPercent, parseBrazilianCurrency } from '../lib/money'
import { listProducts, removeProduct, saveProduct } from '../services/companyData'
import type { ProductDraft, ProductRecord } from '../types/database'
import { supabase } from '../lib/supabase'
import { CurrencyInput } from '../components/CurrencyInput'
import ServicesPanel from './ServicesPanel'
import { FeeTagWidget, CostTagWidget, type FeeTag, type CostTag } from './CalculationPage'

const blank = { name: '', acquisition: '', desired: '', price: '', notes: '' }
const inputLabel = 'mb-2 block text-xs font-medium text-paper'

type Panel = 'list' | 'form' | 'details' | 'history'

// Rich color palette for product details pie
const DETAIL_COLORS = {
  acquisition: '#3b82f6',   // blue — cost
  other: '#8b5cf6',         // purple — other costs
  fees: '#f97316',          // orange — fees
  taxes: '#ef4444',         // red — taxes
  contribution: '#22c55e',  // green — contribution (healthy)
  contributionNeg: '#ef4444', // red — negative contribution
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-xl border border-line bg-graphite px-4 py-3 shadow-xl text-xs z-50">
      <p className="font-semibold text-paper">{item.name}</p>
      <p className="mt-1 font-mono" style={{ color: item.payload.fill }}>{formatBRLFromCents(Math.abs(item.value))}</p>
      <p className="mt-0.5 text-muted">{item.payload.pct ? `${item.payload.pct}% do preço` : ''}</p>
    </div>
  )
}

export default function ProductsPage() {
  const { currentCompany, configReady } = useAuth()
  const [rows, setRows] = useState<ProductRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'todos' | 'saudavel' | 'atencao' | 'negativa'>('todos')
  const [panel, setPanel] = useState<Panel>('list')
  const [editing, setEditing] = useState<ProductRecord | null>(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [historyTarget, setHistoryTarget] = useState<ProductRecord | null>(null)
  const [selectedDetails, setSelectedDetails] = useState<ProductRecord | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [tab, setTab] = useState<'products' | 'services'>('products')
  const [activeSlice, setActiveSlice] = useState<number | null>(null)
  const [feeTags, setFeeTags] = useState<FeeTag[]>([])
  const [costTags, setCostTags] = useState<CostTag[]>([])

  const refresh = useCallback(async () => {
    if (!currentCompany || !configReady) { setRows([]); setLoading(false); return }
    setLoading(true); setError(null)
    try { setRows(await listProducts(currentCompany.id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao carregar produtos.') }
    finally { setLoading(false) }
  }, [currentCompany?.id, configReady])

  useEffect(() => { void refresh() }, [refresh])

  const filtered = useMemo(() => rows.filter(row => {
    if (!row.name.toLowerCase().includes(search.toLowerCase())) return false
    const margin = row.current_price_cents ? calculateProductPricing({ acquisitionCostCents: Number(row.acquisition_cost_cents), otherCostCents: Number(row.other_cost_cents), variableFeesPercent: Number(row.variable_fees_percent), taxPercent: Number(row.tax_percent), desiredMarginPercent: row.desired_margin_percent === null ? undefined : Number(row.desired_margin_percent), sellingPriceCents: Number(row.current_price_cents) }).contributionMarginPercent : null
    if (filter === 'todos') return true
    if (margin === null) return false
    if (filter === 'negativa') return margin < 0
    if (filter === 'atencao') return margin >= 0 && row.desired_margin_percent !== null && margin < Number(row.desired_margin_percent)
    return margin >= 0 && (row.desired_margin_percent === null || margin >= Number(row.desired_margin_percent))
  }), [rows, search, filter])

  const selectedPricing = selectedDetails ? calculateProductPricing({
    acquisitionCostCents: Number(selectedDetails.acquisition_cost_cents),
    otherCostCents: Number(selectedDetails.other_cost_cents),
    variableFeesPercent: Number(selectedDetails.variable_fees_percent),
    taxPercent: Number(selectedDetails.tax_percent),
    desiredMarginPercent: selectedDetails.desired_margin_percent === null ? undefined : Number(selectedDetails.desired_margin_percent),
    sellingPriceCents: selectedDetails.current_price_cents === null ? undefined : Number(selectedDetails.current_price_cents),
  }) : null

  // Build pie chart data for details panel
  const detailsPieData = useMemo(() => {
    if (!selectedDetails || !selectedPricing || !selectedDetails.current_price_cents) return []
    const price = Number(selectedDetails.current_price_cents)
    const acq = Number(selectedDetails.acquisition_cost_cents)
    const other = Number(selectedDetails.other_cost_cents)
    const fees = selectedPricing.feesCents ?? 0
    const taxes = selectedPricing.taxesCents ?? 0
    const contribution = selectedPricing.contributionCents ?? 0
    const pct = (v: number) => price > 0 ? `${((Math.abs(v) / price) * 100).toFixed(1)}` : '0'
    const data = [
      { name: 'Custo de aquisição', value: acq, fill: DETAIL_COLORS.acquisition, pct: pct(acq) },
      { name: 'Outros custos', value: other, fill: DETAIL_COLORS.other, pct: pct(other) },
      { name: 'Taxas variáveis', value: fees, fill: DETAIL_COLORS.fees, pct: pct(fees) },
      { name: 'Impostos', value: taxes, fill: DETAIL_COLORS.taxes, pct: pct(taxes) },
      { name: 'Margem de contribuição', value: Math.max(0, contribution), fill: contribution >= 0 ? DETAIL_COLORS.contribution : DETAIL_COLORS.contributionNeg, pct: pct(contribution) },
    ].filter(d => d.value > 0)
    return data
  }, [selectedDetails, selectedPricing])

  // Smart footnote for product details
  function getFootnote(): { text: string; tone: 'ok' | 'warn' | 'bad' } | null {
    if (!selectedDetails || !selectedPricing) return null
    const margin = selectedPricing.contributionMarginPercent
    const desired = selectedDetails.desired_margin_percent !== null ? Number(selectedDetails.desired_margin_percent) : null
    const current = selectedDetails.current_price_cents ? Number(selectedDetails.current_price_cents) : null
    const recommended = selectedPricing.recommendedPriceCents
    const minimum = selectedPricing.minimumPriceCents

    if (margin === null) return { text: 'Cadastre um Preço praticado hoje para visualizar a análise de margem deste produto.', tone: 'warn' }
    if (margin < 0) return { text: `⚠️ Atenção: você está vendendo este produto com margem negativa (${formatPercent(margin)}). Cada unidade vendida gera prejuízo. Revise custos ou ajuste o preço imediatamente para pelo menos ${formatBRLFromCents(minimum)}.`, tone: 'bad' }
    if (current !== null && minimum !== null && current < minimum) return { text: `Seu Preço praticado hoje (${formatBRLFromCents(current)}) está abaixo do preço mínimo (${formatBRLFromCents(minimum)}). Você está operando no prejuízo. Considere reajustar para pelo menos ${formatBRLFromCents(minimum)}.`, tone: 'bad' }
    if (desired !== null && margin < desired) return { text: `Você está vendendo abaixo da sua meta de margem (${formatPercent(desired)}). Para atingir essa meta, o preço recomendado é ${formatBRLFromCents(recommended)}. Avalie um reajuste gradual ou renegociação de custos.`, tone: 'warn' }
    if (recommended && current !== null && current < recommended) return { text: `Há espaço para aumentar seu preço. O preço recomendado para atingir sua margem desejada é ${formatBRLFromCents(recommended)} — ${formatBRLFromCents(recommended - current)} acima do atual.`, tone: 'warn' }
    return { text: `✓ Excelente! Sua margem atual de ${formatPercent(margin)} está saudável e dentro do esperado. Mantenha o controle dos custos para preservar esse resultado.`, tone: 'ok' }
  }

  function startCreate() { setEditing(null); setForm(blank); setFeeTags([]); setCostTags([]); setError(null); setNotice(null); setPanel('form') }
  function startEdit(row: ProductRecord) {
    setEditing(row); setError(null); setNotice(null)
    const money = (cents: number | null) => cents === null ? '' : (Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    setForm({ name: row.name, acquisition: '', desired: row.desired_margin_percent === null ? '' : String(row.desired_margin_percent), price: money(row.current_price_cents), notes: row.notes ?? '' })
    
    // Reconstruct fee tags from stored percentages
    const tags: FeeTag[] = []
    if (Number(row.variable_fees_percent) > 0) tags.push({ id: crypto.randomUUID(), label: 'Taxas variáveis', percent: String(row.variable_fees_percent) })
    if (Number(row.tax_percent) > 0) tags.push({ id: crypto.randomUUID(), label: 'Impostos', percent: String(row.tax_percent) })
    setFeeTags(tags)
    
    // Reconstruct cost tags from ALL costs (acquisition + other)
    const costs: CostTag[] = []
    if (Number(row.acquisition_cost_cents) > 0) costs.push({ id: crypto.randomUUID(), label: 'Custo de aquisição', value: money(row.acquisition_cost_cents) })
    if (Number(row.other_cost_cents) > 0) costs.push({ id: crypto.randomUUID(), label: 'Outros custos', value: money(row.other_cost_cents) })
    setCostTags(costs)
    
    setPanel('form')
  }

  function openDetails(row: ProductRecord) { setSelectedDetails(row); setActiveSlice(null); setPanel('details') }
  async function openHistory(row: ProductRecord) {
    if (!supabase) return
    setHistoryTarget(row)
    const { data, error: historyError } = await supabase.from('pricing_history').select('id, snapshot, created_at').eq('company_id', row.company_id).eq('item_id', row.id).eq('item_type', 'product').order('created_at', { ascending: false }).limit(20)
    if (historyError) { setError(historyError.message); return }
    setHistory(data ?? [])
    setPanel('history')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!currentCompany) return
    // Separar acquisition_cost dos outros custos baseado no label
    const acquisitionCents = costTags.find(t => t.label === 'Custo de aquisição') ? parseBrazilianCurrency(costTags.find(t => t.label === 'Custo de aquisição')!.value) ?? 0 : 0
    const otherCostsCents = costTags.filter(t => t.label !== 'Custo de aquisição').reduce((s, t) => s + (parseBrazilianCurrency(t.value) ?? 0), 0)
    const price = form.price.trim() ? parseBrazilianCurrency(form.price) : null
    const totalFeesPercent = feeTags.reduce((s, t) => s + Number(t.percent || 0), 0)
    const desired = form.desired.trim() ? Number(form.desired.replace(',', '.')) : null
    const totalCostsCents = acquisitionCents + otherCostsCents
    if (!form.name.trim() || totalCostsCents === 0 || (form.price.trim() && price === null)) {
      setError('Confira nome, custos e preço informados.'); return
    }
    try { calculateProductPricing({ acquisitionCostCents: totalCostsCents, otherCostCents: 0, variableFeesPercent: totalFeesPercent, taxPercent: 0, desiredMarginPercent: desired ?? undefined, sellingPriceCents: price ?? undefined }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Percentuais incompatíveis.'); return }
    setSaving(true); setError(null)
    const draft: ProductDraft = { name: form.name.trim(), acquisition_cost_cents: acquisitionCents, other_cost_cents: otherCostsCents, variable_fees_percent: totalFeesPercent, tax_percent: 0, desired_margin_percent: desired, current_price_cents: price, notes: form.notes.trim() || null }
    try {
      await saveProduct(currentCompany.id, draft, editing?.id)
      setPanel('list'); setNotice(editing ? 'Produto atualizado.' : 'Produto salvo.'); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.') }
    finally { setSaving(false) }
  }

  async function duplicate(row: ProductRecord) {
    if (!currentCompany) return
    try {
      const { id: _id, company_id: _c, created_at: _cr, updated_at: _up, ...copy } = row
      await saveProduct(currentCompany.id, { ...copy, name: `${row.name} (cópia)` })
      setNotice(`"${row.name}" foi duplicado.`); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível duplicar.') }
  }

  async function deleteRow(row: ProductRecord) {
    if (!currentCompany || !window.confirm(`Excluir "${row.name}"?`)) return
    try { await removeProduct(currentCompany.id, row.id); setNotice('Produto excluído.'); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível excluir.') }
  }

  if (loading) return <LoadingScreen label="Carregando produtos cadastrados" />

  const footnote = panel === 'details' ? getFootnote() : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow text-gold">CATÁLOGO FINANCEIRO</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Produtos e serviços</h2>
          <p className="mt-2 text-sm text-muted">Veja quanto cada venda contribui para a operação.</p>
        </div>
        {tab === 'products' && panel === 'list' && <button className="btn-primary w-fit" onClick={startCreate}><Plus size={16}/>Cadastrar produto</button>}
      </div>

      <div className="inline-flex rounded-xl border border-line bg-panel p-1">
        <button onClick={() => { setTab('products'); setPanel('list') }} className={`rounded-lg px-4 py-2.5 text-xs font-medium transition-colors ${tab === 'products' ? 'bg-gold text-black' : 'text-muted'}`}><Package size={14} className="mr-2 inline"/>Produtos</button>
        <button onClick={() => setTab('services')} className={`rounded-lg px-4 py-2.5 text-xs font-medium transition-colors ${tab === 'services' ? 'bg-gold text-black' : 'text-muted'}`}><Wrench size={14} className="mr-2 inline"/>Serviços</button>
      </div>

      {tab === 'services' ? <ServicesPanel/> : <>
        {/* ── LIST ─────────────────────────────────── */}
        {panel === 'list' && <>
          {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
          {error && <InlineNotice>{error}</InlineNotice>}
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"/><input className="field pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar produto"/></label>
            <select aria-label="Filtrar situação da margem" className="field sm:w-56" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
              <option value="todos">Todas as margens</option><option value="saudavel">Margem saudável</option><option value="atencao">Abaixo da desejada</option><option value="negativa">Margem negativa</option>
            </select>
          </div>
          {rows.length === 0
            ? <EmptyState title="Seu catálogo começa aqui" description="Cadastre um produto com seu custo de aquisição, outros custos e Preço praticado hoje." action={<button className="btn-primary" onClick={startCreate}><Plus size={15}/>Cadastrar primeiro produto</button>}/>
            : <div className="space-y-4">
                <div className="surface px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div><p className="eyebrow">PRODUTOS DA EMPRESA</p><p className="mt-1 text-xs text-muted">{filtered.length} de {rows.length} produto(s)</p></div>
                    <Package className="text-gold" size={18}/>
                  </div>
                </div>

                {/* Grid de cards de produtos */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map(row => {
                    const result = row.current_price_cents ? calculateProductPricing({ acquisitionCostCents: Number(row.acquisition_cost_cents), otherCostCents: Number(row.other_cost_cents), variableFeesPercent: Number(row.variable_fees_percent), taxPercent: Number(row.tax_percent), desiredMarginPercent: row.desired_margin_percent === null ? undefined : Number(row.desired_margin_percent), sellingPriceCents: Number(row.current_price_cents) }) : null
                    const margin = result?.contributionMarginPercent ?? null
                    const isNeg = margin !== null && margin < 0
                    const isBelowDesired = margin !== null && !isNeg && row.desired_margin_percent !== null && margin < Number(row.desired_margin_percent)
                    const statusLabel = margin === null ? 'Preço pendente' : isNeg ? 'Margem negativa' : isBelowDesired ? 'Abaixo da meta' : 'Saudável'
                    const statusColor = margin === null ? 'border-muted bg-muted/5' : isNeg ? 'border-red-400 bg-red-400/5' : isBelowDesired ? 'border-amber-400 bg-amber-400/5' : 'border-emerald-400 bg-emerald-400/5'
                    const statusTextColor = margin === null ? 'text-muted' : isNeg ? 'text-red-400' : isBelowDesired ? 'text-amber-400' : 'text-emerald-400'
                    const statusIcon = margin === null ? null : isNeg ? <AlertTriangle size={13}/> : isBelowDesired ? <TrendingUp size={13}/> : <CheckCircle2 size={13}/>

                    return (
                      <div key={row.id} className="surface overflow-hidden hover:border-teal-border transition-all group">
                        {/* Header do card com nome e status */}
                        <div className="border-b border-line px-4 py-3">
                          <button type="button" className="text-left w-full group-hover:text-gold transition-colors" onClick={() => openDetails(row)}>
                            <h4 className="text-sm font-semibold line-clamp-1">{row.name}</h4>
                            {row.notes && <p className="mt-1 text-[10px] text-muted line-clamp-1">{row.notes}</p>}
                          </button>
                          <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusColor} ${statusTextColor}`}>
                            {statusIcon}
                            {statusLabel}
                          </div>
                        </div>

                        {/* Corpo do card com métricas principais */}
                        <div className="p-4 space-y-3">
                          {/* Preço praticado */}
                          <div className="flex items-end justify-between border-b border-line/50 pb-2">
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-muted">Preço praticado</p>
                              <p className="mt-1 font-mono text-xl font-bold">{formatBRLFromCents(row.current_price_cents)}</p>
                            </div>
                            {margin !== null && (
                              <div className="text-right">
                                <p className="text-[9px] uppercase tracking-wider text-muted">Margem</p>
                                <p className={`mt-1 font-mono text-base font-bold ${isNeg ? 'text-red-400' : margin >= 20 ? 'text-emerald-400' : 'text-paper'}`}>
                                  {formatPercent(margin)}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Grid de custos e taxas */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-muted">Custo aquis.</p>
                              <p className="mt-0.5 font-mono text-paper">{formatBRLFromCents(row.acquisition_cost_cents)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-muted">Outros custos</p>
                              <p className="mt-0.5 font-mono text-paper">{formatBRLFromCents(row.other_cost_cents)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-muted">Taxas</p>
                              <p className="mt-0.5 font-mono text-amber-400">{formatPercent(row.variable_fees_percent)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-muted">Impostos</p>
                              <p className="mt-0.5 font-mono text-red-400">{formatPercent(row.tax_percent)}</p>
                            </div>
                          </div>

                          {/* Resultado unitário */}
                          {result && (
                            <div className="pt-2 border-t border-line/50">
                              <p className="text-[9px] uppercase tracking-wider text-muted">Resultado / unidade</p>
                              <p className={`mt-1 font-mono text-lg font-bold ${isNeg ? 'text-red-400' : (result.contributionCents ?? 0) > 0 ? 'text-emerald-400' : 'text-paper'}`}>
                                {formatBRLFromCents(result.contributionCents)}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Footer com ações */}
                        <div className="border-t border-line px-3 py-2 bg-white/[.01] flex items-center justify-end gap-1">
                          <button aria-label={`Detalhes de ${row.name}`} title="Detalhes" className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => openDetails(row)}><Eye size={13}/></button>
                          <button aria-label={`Histórico de ${row.name}`} title="Histórico" className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => void openHistory(row)}><History size={13}/></button>
                          <button aria-label={`Editar ${row.name}`} title="Editar" className="rounded p-2 text-muted hover:text-paper transition-colors" onClick={() => startEdit(row)}><Pencil size={13}/></button>
                          <button aria-label={`Duplicar ${row.name}`} title="Duplicar" className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => void duplicate(row)}><Copy size={13}/></button>
                          <button aria-label={`Excluir ${row.name}`} title="Excluir" className="rounded p-2 text-muted hover:text-red-400 transition-colors" onClick={() => void deleteRow(row)}><Trash2 size={13}/></button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {filtered.length === 0 && <div className="surface p-8 text-center"><p className="text-sm text-muted">Nenhum produto corresponde à pesquisa/filtro.</p></div>}
              </div>}
        </>}

        {/* ── FORM ─────────────────────────────────── */}
        {panel === 'form' && <section className="surface p-5 sm:p-7 space-y-5">
          <div className="flex items-start justify-between border-b border-line pb-4">
            <div><p className="eyebrow text-gold">PRECIFICAÇÃO DE PRODUTO</p><h3 className="mt-1 text-xl font-bold">{editing ? 'Editar produto' : 'Novo produto'}</h3></div>
            <button className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1" onClick={() => { setPanel('list'); setError(null) }}><ChevronLeft size={14}/>Voltar</button>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className={inputLabel}>Nome do produto</span><input className="field" maxLength={160} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Kit de café especial"/></label>
              
              {/* Campo de totalização - apenas leitura */}
              <label className="sm:col-span-2">
                <span className={inputLabel}>Custo de aquisição/produção (R$) <span className="text-xs text-muted font-normal">· Soma dos custos abaixo</span></span>
                <input 
                  className="field bg-gold/5 font-mono font-bold text-gold cursor-not-allowed" 
                  disabled 
                  value={formatBRLFromCents(costTags.reduce((sum, t) => sum + (parseBrazilianCurrency(t.value) ?? 0), 0)).replace('R$', '').trim()} 
                  placeholder="0,00"
                />
              </label>
            </div>

            {/* Custos + Taxas lado a lado */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <CostTagWidget costTags={costTags} setCostTags={setCostTags} title="Custos"/>
              </div>
              <div>
                <FeeTagWidget feeTags={feeTags} setFeeTags={setFeeTags}/>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className={inputLabel}>Preço praticado hoje (R$) · opcional</span><CurrencyInput className="field" value={form.price} onChange={value => setForm({ ...form, price: value })} placeholder="Deixe em branco se ainda não vende"/></label>
              <label><span className={inputLabel}>Margem desejada (%) · opcional</span><input className="field" type="number" min="0" max="100" step="0.01" value={form.desired} onChange={e => setForm({ ...form, desired: e.target.value })} placeholder="Ex.: 20"/></label>
              <label className="sm:col-span-2"><span className={inputLabel}>Observação · opcional</span><textarea className="field min-h-20 resize-y" maxLength={1000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></label>
            </div>
            {error && <InlineNotice>{error}</InlineNotice>}
            <div className="flex flex-col-reverse justify-end gap-2 border-t border-line pt-4 sm:flex-row">
              <button type="button" className="btn-secondary" onClick={() => { setPanel('list'); setError(null) }}>Cancelar</button>
              <button className="btn-primary" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" size={15}/> : <Plus size={15}/>}Salvar produto</button>
            </div>
          </form>
        </section>}

        {/* ── DETAILS ──────────────────────────────── */}
        {panel === 'details' && selectedDetails && selectedPricing && (
          <section className="surface p-5 sm:p-7 space-y-6">
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div><p className="eyebrow text-gold">DETALHES DA PRECIFICAÇÃO</p><h3 className="mt-1 text-2xl font-bold">{selectedDetails.name}</h3></div>
              <button className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1" onClick={() => setPanel('list')}><ChevronLeft size={14}/>Voltar</button>
            </div>

            {/* Price comparison card */}
            {selectedDetails.current_price_cents && (
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Current price (what they charge today) */}
                <div className={`rounded-2xl border-2 p-4 ${(selectedPricing.contributionCents ?? 0) >= 0 ? 'border-teal-border bg-teal-light/10' : 'border-red-200 bg-red-50/25'}`}>
                  <p className="eyebrow mb-2" style={{ color: (selectedPricing.contributionCents ?? 0) >= 0 ? '#1A3C34' : '#991b1b' }}>PREÇO PRATICADO HOJE</p>
                  <p className="font-mono text-4xl font-bold mt-2" style={{ color: (selectedPricing.contributionCents ?? 0) >= 0 ? '#1A3C34' : '#DC2626' }}>{formatBRLFromCents(selectedDetails.current_price_cents)}</p>
                  <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 ${(selectedPricing.contributionCents ?? 0) >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    {(selectedPricing.contributionCents ?? 0) >= 0 ? <CheckCircle2 size={16} style={{ color: '#047857' }}/> : <AlertTriangle size={16} style={{ color: '#991b1b' }}/>}
                    <div className="flex-1">
                      <p className="text-xs font-bold" style={{ color: (selectedPricing.contributionCents ?? 0) >= 0 ? '#047857' : '#991b1b' }}>
                        {(selectedPricing.contributionCents ?? 0) >= 0 ? 'Gerando lucro' : 'Gerando prejuízo'}
                      </p>
                      <p className="mt-0.5 text-[10px]" style={{ color: (selectedPricing.contributionCents ?? 0) >= 0 ? '#065f46' : '#7f1d1d' }}>
                        {(selectedPricing.contributionCents ?? 0) >= 0 
                          ? `${formatBRLFromCents(selectedPricing.contributionCents)} por unidade · ${formatPercent(selectedPricing.contributionMarginPercent)} de margem` 
                          : `${formatBRLFromCents(Math.abs(selectedPricing.contributionCents ?? 0))} prejuízo · ${formatPercent(selectedPricing.contributionMarginPercent)} de margem`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recommended price (by the system) */}
                <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/25 p-4">
                  <p className="eyebrow mb-2 text-emerald-900">PREÇO RECOMENDADO</p>
                  <p className="font-mono text-4xl font-bold text-emerald-700 mt-2">{formatBRLFromCents(selectedPricing.recommendedPriceCents)}</p>
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                    <TrendingUp size={16} className="text-emerald-700"/>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-emerald-900">Sistema calculado</p>
                      <p className="mt-0.5 text-[10px] text-emerald-800">
                        {selectedDetails.desired_margin_percent 
                          ? `Atinge margem de ${formatPercent(selectedDetails.desired_margin_percent)}`
                          : 'Baseado em custo + taxas + impostos'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* NOVO: Detalhamento Analítico de Custos e Taxas */}
            <div className="space-y-4">
              <p className="eyebrow text-gold">DETALHAMENTO ANALÍTICO</p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Custos Individuais */}
                <div className="surface p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <p className="text-sm font-semibold text-paper">Custos</p>
                    <p className="font-mono text-sm font-bold text-gold">
                      {formatBRLFromCents(Number(selectedDetails.acquisition_cost_cents) + Number(selectedDetails.other_cost_cents))}
                    </p>
                  </div>
                  {Number(selectedDetails.acquisition_cost_cents) > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-blue-500" />
                        <span className="text-sm font-medium text-paper">Custo de aquisição</span>
                      </div>
                      <span className="font-mono text-base font-bold text-blue-500">
                        {formatBRLFromCents(selectedDetails.acquisition_cost_cents)}
                      </span>
                    </div>
                  )}
                  {Number(selectedDetails.other_cost_cents) > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-purple-500" />
                        <span className="text-sm font-medium text-paper">Outros custos</span>
                      </div>
                      <span className="font-mono text-base font-bold text-purple-500">
                        {formatBRLFromCents(selectedDetails.other_cost_cents)}
                      </span>
                    </div>
                  )}
                  {Number(selectedDetails.acquisition_cost_cents) === 0 && Number(selectedDetails.other_cost_cents) === 0 && (
                    <p className="text-center text-sm text-muted py-2">Nenhum custo cadastrado</p>
                  )}
                </div>

                {/* Taxas e Encargos Individuais */}
                <div className="surface p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <p className="text-sm font-semibold text-paper">Taxas e encargos</p>
                    <p className="font-mono text-sm font-bold text-amber-400">
                      {formatPercent(Number(selectedDetails.variable_fees_percent) + Number(selectedDetails.tax_percent))}
                    </p>
                  </div>
                  {Number(selectedDetails.variable_fees_percent) > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-2 rounded-full bg-orange-500 shrink-0" />
                        <span className="text-sm font-medium text-paper truncate">Taxas variáveis</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-sm text-orange-500">{formatPercent(selectedDetails.variable_fees_percent)}</span>
                        <span className="text-muted text-xs">·</span>
                        <span className="font-mono text-base font-bold text-orange-500">
                          {formatBRLFromCents(selectedPricing.feesCents)}
                        </span>
                      </div>
                    </div>
                  )}
                  {Number(selectedDetails.tax_percent) > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-2 rounded-full bg-red-500 shrink-0" />
                        <span className="text-sm font-medium text-paper truncate">Impostos</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-sm text-red-500">{formatPercent(selectedDetails.tax_percent)}</span>
                        <span className="text-muted text-xs">·</span>
                        <span className="font-mono text-base font-bold text-red-500">
                          {formatBRLFromCents(selectedPricing.taxesCents)}
                        </span>
                      </div>
                    </div>
                  )}
                  {Number(selectedDetails.variable_fees_percent) === 0 && Number(selectedDetails.tax_percent) === 0 && (
                    <p className="text-center text-sm text-muted py-2">Nenhuma taxa cadastrada</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              {/* Left: metrics grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ['Custo de aquisição/produção', formatBRLFromCents(Number(selectedDetails.acquisition_cost_cents) + Number(selectedDetails.other_cost_cents)), DETAIL_COLORS.acquisition],
                  ['Custo total', formatBRLFromCents(selectedPricing.totalCostCents), '#6b7280'],
                  ['Taxas variáveis', `${formatPercent(selectedDetails.variable_fees_percent)} · ${formatBRLFromCents(selectedPricing.feesCents)}`, DETAIL_COLORS.fees],
                  ['Impostos', `${formatPercent(selectedDetails.tax_percent)} · ${formatBRLFromCents(selectedPricing.taxesCents)}`, DETAIL_COLORS.taxes],
                  ['Preço praticado hoje', formatBRLFromCents(selectedDetails.current_price_cents), '#D4AF37'],
                  ['Preço mínimo', formatBRLFromCents(selectedPricing.minimumPriceCents), '#6b7280'],
                  ['Preço recomendado', formatBRLFromCents(selectedPricing.recommendedPriceCents), '#22c55e'],
                  ['Resultado est. / unidade', formatBRLFromCents(selectedPricing.contributionCents), (selectedPricing.contributionCents ?? 0) >= 0 ? DETAIL_COLORS.contribution : DETAIL_COLORS.contributionNeg],
                  ['Margem de contribuição', formatPercent(selectedPricing.contributionMarginPercent), (selectedPricing.contributionMarginPercent ?? 0) >= 0 ? DETAIL_COLORS.contribution : DETAIL_COLORS.contributionNeg],
                  ['Margem desejada', formatPercent(selectedDetails.desired_margin_percent), '#D4AF37'],
                  ['Markup', formatMarkup(selectedPricing.markup), '#a855f7'],
                ] as [string, string, string][]).map(([label, value, color]) => (
                  <div key={label} className="rounded-xl border border-line bg-panel p-4 transition hover:border-teal-border">
                    <p className="text-xs font-semibold text-muted">{label}</p>
                    <p className="mt-2 font-mono text-base font-semibold" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Right: colorful pie chart */}
              {detailsPieData.length > 0 && (
                <div className="flex flex-col items-center">
                  <p className="eyebrow mb-3 self-start">COMPOSIÇÃO DO PREÇO</p>
                  <div className="relative h-56 w-full max-w-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={detailsPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%" cy="50%"
                          innerRadius={52} outerRadius={88}
                          paddingAngle={3}
                          stroke="none"
                          onMouseEnter={(_, index) => setActiveSlice(index)}
                          onMouseLeave={() => setActiveSlice(null)}
                        >
                          {detailsPieData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={entry.fill}
                              opacity={activeSlice === null || activeSlice === index ? 1 : 0.4}
                              style={{
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                transform: activeSlice === index ? 'scale(1.05)' : 'scale(1)',
                                transformOrigin: 'center',
                              }}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<PieTooltip/>}/>
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      {activeSlice !== null && detailsPieData[activeSlice] ? (
                        <>
                          <span className="text-[9px] text-muted text-center px-2 leading-3">{detailsPieData[activeSlice].name}</span>
                          <span className="font-mono text-sm font-bold mt-1" style={{ color: detailsPieData[activeSlice].fill }}>{detailsPieData[activeSlice].pct}%</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp size={16} className="text-gold"/>
                          <span className="text-[9px] text-muted mt-1">passe o mouse</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="mt-3 w-full space-y-1.5">
                    {detailsPieData.map((entry, i) => (
                      <div
                        key={entry.name}
                        className="flex items-center justify-between text-[11px] cursor-pointer rounded px-2 py-1 transition-colors hover:bg-white/5"
                        onMouseEnter={() => setActiveSlice(i)}
                        onMouseLeave={() => setActiveSlice(null)}
                      >
                        <span className="flex items-center gap-2 text-muted">
                          <span className="size-2.5 rounded-full shrink-0" style={{ background: entry.fill }}/>
                          {entry.name}
                        </span>
                        <span className="font-mono" style={{ color: entry.fill }}>{entry.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Smart footnote with enhanced visibility */}
            {footnote && (
              <div className={`rounded-2xl border-2 px-6 py-5 text-sm font-medium leading-relaxed shadow-lg ${
                footnote.tone === 'ok' ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                : footnote.tone === 'bad' ? 'border-red-400 bg-red-50 text-red-800'
                : 'border-amber-400 bg-amber-100 text-amber-900'
              }`}>
                <div className="flex items-start gap-3">
                  {footnote.tone === 'ok' ? <CheckCircle2 size={22} className="mt-0.5 shrink-0"/> : <AlertTriangle size={22} className="mt-0.5 shrink-0"/>}
                  <p className="text-[15px] leading-7">{footnote.text}</p>
                </div>
              </div>
            )}

            {selectedDetails.notes && <p className="border-t border-line pt-4 text-sm text-muted">{selectedDetails.notes}</p>}

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button className="btn-secondary" onClick={() => setPanel('list')}>Fechar</button>
              <button className="btn-primary" onClick={() => startEdit(selectedDetails)}><Pencil size={14}/>Editar precificação</button>
            </div>
          </section>
        )}

        {/* ── HISTORY ──────────────────────────────── */}
        {panel === 'history' && (
          <section className="surface p-5 space-y-4">
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div><p className="eyebrow text-gold">AUDITORIA DE PREÇOS</p><h3 className="mt-1 text-xl font-bold">Histórico — {historyTarget?.name}</h3></div>
              <button className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1" onClick={() => setPanel('list')}><ChevronLeft size={14}/>Voltar</button>
            </div>
            {history.length
              ? <div className="divide-y divide-line">{history.map(item => (
                  <div key={item.id} className="py-3">
                    <p className="text-xs text-muted">{new Date(item.created_at).toLocaleString('pt-BR')}</p>
                    <p className="mt-1 text-sm">Preço: <span className="font-mono text-gold">{formatBRLFromCents(item.snapshot.current_price_cents)}</span></p>
                    <p className="mt-1 text-xs text-muted">Custo total: {formatBRLFromCents(Number(item.snapshot.acquisition_cost_cents) + Number(item.snapshot.other_cost_cents))} · margem desejada: {formatPercent(item.snapshot.desired_margin_percent)}</p>
                  </div>
                ))}</div>
              : <p className="text-sm text-muted">Ainda não há alterações de preço registradas.</p>}
          </section>
        )}
      </>}
    </div>
  )
}
