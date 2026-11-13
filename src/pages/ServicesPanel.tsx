import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, Copy, Eye, History, Info, LoaderCircle, Plus, Search, Trash2, Pencil, Wrench, ChevronLeft, TrendingUp } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState, InlineNotice, LoadingScreen } from '../components/Feedback'
import { CurrencyInput } from '../components/CurrencyInput'
import { calculateProductPricing, calculateServiceCost } from '../finance/pricing'
import { formatBRLFromCents, formatMarkup, formatPercent, parseBrazilianCurrency } from '../lib/money'
import { supabase } from '../lib/supabase'
import { listServices, removeService, saveService } from '../services/companyData'
import { listServiceCosts, listServiceFees, saveServiceCost, saveServiceFee, removeServiceCost, removeServiceFee } from '../services/itemizedData'
import type { ServiceRecord, ServiceCostRecord, ServiceFeeRecord } from '../types/database'
import { TAG_COLORS, COST_COLORS } from './CalculationPage'
import { ServiceCostsList, ServiceFeesList } from '../components/ItemizedLists'
import { ServiceCostModal, ServiceFeeModal } from '../components/ItemizedModals'
import { calculateDefaultFeesPercent, getDefaultFeesBreakdown } from '../services/defaultFees'

const empty = { name: '', hours: '1', hourly: '', materials: '', fixedHourly: '', includeFixed: false, desired: '', price: '' }
const fieldLabel = 'mb-2 block text-xs font-medium text-paper'

// Detail colors matching product page
const DETAIL_COLORS = { cost: '#3b82f6', fees: '#f97316', contribution: '#22c55e', contributionNeg: '#ef4444' }

type Panel = 'list' | 'form' | 'details' | 'history'

export default function ServicesPanel() {
  const { currentCompany } = useAuth()
  const [rows, setRows] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [panel, setPanel] = useState<Panel>('list')
  const [editing, setEditing] = useState<ServiceRecord | null>(null)
  const [selectedDetails, setSelectedDetails] = useState<ServiceRecord | null>(null)
  const [activeSlice, setActiveSlice] = useState<number | null>(null)
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [historyTarget, setHistoryTarget] = useState<ServiceRecord | null>(null)
  
  // Itemized costs and fees
  const [serviceCosts, setServiceCosts] = useState<ServiceCostRecord[]>([])
  const [serviceFees, setServiceFees] = useState<ServiceFeeRecord[]>([])
  const [costModalOpen, setCostModalOpen] = useState(false)
  const [feeModalOpen, setFeeModalOpen] = useState(false)
  const [editingCost, setEditingCost] = useState<ServiceCostRecord | null>(null)
  const [editingFee, setEditingFee] = useState<ServiceFeeRecord | null>(null)
  const [defaultFeesPercent, setDefaultFeesPercent] = useState(0)
  const [defaultFeesBreakdown, setDefaultFeesBreakdown] = useState<Array<{ label: string; percent: number }>>([])

  const refresh = useCallback(async () => {
    if (!currentCompany) { setLoading(false); return }
    setLoading(true)
    try { setRows(await listServices(currentCompany.id)); setError(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os serviços.') }
    finally { setLoading(false) }
  }, [currentCompany?.id])
  useEffect(() => { void refresh() }, [refresh])

  // Load default fees from Variable Costs (Expenses tab)
  const loadDefaultFees = useCallback(async () => {
    if (!currentCompany) return
    try {
      const percent = await calculateDefaultFeesPercent(currentCompany.id)
      const breakdown = await getDefaultFeesBreakdown(currentCompany.id)
      setDefaultFeesPercent(percent)
      setDefaultFeesBreakdown(breakdown)
    } catch (err) {
      console.warn('Could not load default fees:', err)
      setDefaultFeesPercent(0)
      setDefaultFeesBreakdown([])
    }
  }, [currentCompany?.id])
  
  useEffect(() => { void loadDefaultFees() }, [loadDefaultFees])

  const filtered = useMemo(() => rows.filter(row => row.name.toLowerCase().includes(search.toLowerCase())), [rows, search])

  async function openDetails(row: ServiceRecord) { 
    setSelectedDetails(row); setActiveSlice(null); 
    
    // Load itemized costs and fees for analytics display
    try {
      const [costs, fees] = await Promise.all([
        listServiceCosts(row.id),
        listServiceFees(row.id)
      ])
      setServiceCosts(costs)
      
      // If no specific fees, load default fees from Variable Costs
      if (fees.length === 0 && defaultFeesBreakdown.length > 0) {
        setServiceFees(defaultFeesBreakdown.map(({ label, percent }) => ({
          id: crypto.randomUUID(),
          service_id: row.id,
          company_id: currentCompany!.id,
          label,
          percent,
          fee_type: 'variable' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })))
      } else {
        setServiceFees(fees)
      }
    } catch (err) {
      // Tabelas podem não existir ainda - usar fallback vazio
      console.warn('Itemized data not available:', err)
      setServiceCosts([])
      setServiceFees([])
    }
    
    setPanel('details') 
  }

  async function openForm(row?: ServiceRecord) {
    setEditing(row ?? null); setMessage(null); setError(null)
    const money = (cents: number) => (Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    setForm(row ? {
      name: row.name, hours: String(row.hours), hourly: money(row.hourly_labor_cost_cents),
      materials: '', fixedHourly: money(row.fixed_cost_per_hour_cents),
      includeFixed: row.include_fixed_cost_per_hour,
      desired: row.desired_margin_percent === null ? '' : String(row.desired_margin_percent),
      price: row.current_price_cents === null ? '' : money(row.current_price_cents),
    } : empty)
    
    // Load itemized costs and fees from database
    if (row) {
      try {
        const [costs, fees] = await Promise.all([
          listServiceCosts(row.id),
          listServiceFees(row.id)
        ])
        setServiceCosts(costs)
        
        // If no specific fees, pre-fill with default fees from Variable Costs
        if (fees.length === 0 && defaultFeesBreakdown.length > 0) {
          setServiceFees(defaultFeesBreakdown.map(({ label, percent }) => ({
            id: crypto.randomUUID(), // temporary ID for display
            service_id: row.id,
            company_id: currentCompany!.id,
            label,
            percent,
            fee_type: 'variable' as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })))
        } else {
          setServiceFees(fees)
        }
      } catch (err) {
        // Tabelas podem não existir ainda - usar fallback vazio
        console.warn('Itemized data not available:', err)
        setServiceCosts([])
        setServiceFees([])
      }
    } else {
      setServiceCosts([])
      setServiceFees([])
    }
    
    setPanel('form')
  }

  // Cost modal handlers
  function handleAddCost() {
    setEditingCost(null)
    setCostModalOpen(true)
  }

  function handleEditCost(cost: ServiceCostRecord) {
    setEditingCost(cost)
    setCostModalOpen(true)
  }

  async function handleSaveCost(data: { label: string; amount_cents: number; cost_type: 'material' | 'additional' }) {
    if (!currentCompany || !editing) throw new Error('Serviço não selecionado')
    await saveServiceCost(currentCompany.id, editing.id, data, editingCost?.id)
    const updated = await listServiceCosts(editing.id)
    setServiceCosts(updated)
    setCostModalOpen(false)
    setEditingCost(null)
  }

  async function handleDeleteCost(id: string) {
    if (!window.confirm('Excluir este custo?')) return
    await removeServiceCost(id)
    setServiceCosts(serviceCosts.filter(c => c.id !== id))
  }

  // Fee modal handlers
  function handleAddFee() {
    setEditingFee(null)
    setFeeModalOpen(true)
  }

  function handleEditFee(fee: ServiceFeeRecord) {
    setEditingFee(fee)
    setFeeModalOpen(true)
  }

  async function handleSaveFee(data: { label: string; percent: number; fee_type: 'variable' | 'tax' }) {
    if (!currentCompany || !editing) throw new Error('Serviço não selecionado')
    await saveServiceFee(currentCompany.id, editing.id, data, editingFee?.id)
    const updated = await listServiceFees(editing.id)
    setServiceFees(updated)
    setFeeModalOpen(false)
    setEditingFee(null)
  }

  async function handleDeleteFee(id: string) {
    if (!window.confirm('Excluir esta taxa?')) return
    await removeServiceFee(id)
    setServiceFees(serviceFees.filter(f => f.id !== id))
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!currentCompany) return
    
    // Calculate totals from itemized costs and fees
    const materialsCents = serviceCosts.filter(c => c.cost_type === 'material').reduce((sum, c) => sum + Number(c.amount_cents), 0)
    const otherCostsCents = serviceCosts.filter(c => c.cost_type === 'additional').reduce((sum, c) => sum + Number(c.amount_cents), 0)
    const variableFeesPercent = serviceFees.filter(f => f.fee_type === 'variable').reduce((sum, f) => sum + Number(f.percent), 0)
    const taxPercent = serviceFees.filter(f => f.fee_type === 'tax').reduce((sum, f) => sum + Number(f.percent), 0)
    
    const money = (value: string) => value.trim() ? parseBrazilianCurrency(value) : 0
    const desired = form.desired.trim() ? Number(form.desired.replace(',', '.')) : null
    const price = form.price.trim() ? money(form.price) : null
    const hours = Number(form.hours)
    const hourly = money(form.hourly)
    
    if (!form.name.trim() || !Number.isFinite(hours) || hours <= 0 || hourly === null || (form.price.trim() && price === null) || (desired !== null && !Number.isFinite(desired))) {
      setError('Revise nome, tempo e custos.'); return
    }
    
    try {
      const cost = calculateServiceCost({ 
        hours, 
        hourlyLaborCostCents: hourly ?? 0, 
        materialsCents, 
        otherCostCents: otherCostsCents, 
        fixedCostPerHourCents: money(form.fixedHourly) ?? 0, 
        includeFixedCostPerHour: form.includeFixed 
      })
      calculateProductPricing({ 
        acquisitionCostCents: cost, 
        variableFeesPercent: variableFeesPercent + taxPercent, 
        taxPercent: 0, 
        desiredMarginPercent: desired ?? undefined, 
        sellingPriceCents: price ?? undefined 
      })
      
      setBusy(true); setError(null)
      await saveService(currentCompany.id, {
        name: form.name.trim(), hours,
        hourly_labor_cost_cents: hourly ?? 0,
        materials_cents: materialsCents,
        other_cost_cents: otherCostsCents,
        fixed_cost_per_hour_cents: money(form.fixedHourly) ?? 0,
        include_fixed_cost_per_hour: form.includeFixed,
        variable_fees_percent: variableFeesPercent, tax_percent: taxPercent,
        desired_margin_percent: desired, current_price_cents: price,
      }, editing?.id)
      setPanel('list'); setMessage(editing ? 'Serviço atualizado.' : 'Serviço salvo.'); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o serviço.') }
    finally { setBusy(false) }
  }

  async function duplicate(row: ServiceRecord) {
    if (!currentCompany) return
    const { id: _id, company_id: _c, created_at: _cr, updated_at: _up, ...draft } = row
    try { await saveService(currentCompany.id, { ...draft, name: `${row.name} (cópia)` }); setMessage(`"${row.name}" duplicado.`); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível duplicar.') }
  }

  async function remove(row: ServiceRecord) {
    if (!currentCompany || !window.confirm(`Excluir "${row.name}"?`)) return
    try { await removeService(currentCompany.id, row.id); setMessage('Serviço excluído.'); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível excluir.') }
  }

  async function openHistory(row: ServiceRecord) {
    if (!supabase) return
    setHistoryTarget(row)
    const { data, error: historyError } = await supabase.from('pricing_history').select('id, snapshot, created_at').eq('company_id', row.company_id).eq('item_id', row.id).eq('item_type', 'service').order('created_at', { ascending: false }).limit(20)
    if (historyError) { setError(historyError.message); return }
    setHistory(data ?? []); setPanel('history')
  }

  if (loading) return <LoadingScreen label="Carregando serviços" />

  return <div className="space-y-5">
    {message && <InlineNotice tone="success">{message}</InlineNotice>}
    {error && panel === 'list' && <InlineNotice>{error}</InlineNotice>}

    {/* ── LIST ──────────────────────────────────── */}
    {panel === 'list' && <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"/><input className="field pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar serviço"/></label>
        <button className="btn-primary w-fit" onClick={() => openForm()}><Plus size={15}/>Cadastrar serviço</button>
      </div>
      {rows.length === 0
        ? <EmptyState title="Cadastre seu primeiro serviço" description="Informe horas, mão de obra, materiais, taxas e impostos." action={<button className="btn-primary" onClick={() => openForm()}><Plus size={15}/>Cadastrar serviço</button>}/>
        : <div className="space-y-4">
            <div className="surface px-5 py-4">
              <div className="flex items-center justify-between">
                <div><p className="eyebrow">SERVIÇOS CADASTRADOS</p><p className="mt-1 text-xs text-muted">{filtered.length} de {rows.length} serviço(s)</p></div>
                <Wrench className="text-gold" size={18}/>
              </div>
            </div>

            {/* Grid de cards de serviços */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(row => {
                const cost = calculateServiceCost({ hours: Number(row.hours), hourlyLaborCostCents: Number(row.hourly_labor_cost_cents), materialsCents: Number(row.materials_cents), otherCostCents: Number(row.other_cost_cents), fixedCostPerHourCents: Number(row.fixed_cost_per_hour_cents), includeFixedCostPerHour: row.include_fixed_cost_per_hour })
                const result = row.current_price_cents === null ? null : calculateProductPricing({ acquisitionCostCents: cost, variableFeesPercent: Number(row.variable_fees_percent), taxPercent: Number(row.tax_percent), sellingPriceCents: Number(row.current_price_cents) })
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
                        <p className="mt-1 text-[10px] text-muted line-clamp-1">{row.include_fixed_cost_per_hour ? 'Inclui custo fixo/hora' : 'Sem rateio fixo'}</p>
                      </button>
                      <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusColor} ${statusTextColor}`}>
                        {statusIcon}
                        {statusLabel}
                      </div>
                    </div>

                    {/* Corpo do card com métricas principais */}
                    <div className="p-4 space-y-3">
                      {/* Preço praticado e Margens */}
                      <div className="border-b border-line/50 pb-2">
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-muted">Preço praticado</p>
                            <p className="mt-1 font-mono text-xl font-bold">{formatBRLFromCents(row.current_price_cents)}</p>
                          </div>
                          {margin !== null && (
                            <div className="text-right">
                              <p className="text-[9px] uppercase tracking-wider text-muted">Margem Contrib.</p>
                              <p className={`mt-1 font-mono text-base font-bold ${isNeg ? 'text-red-400' : margin >= 20 ? 'text-emerald-400' : 'text-paper'}`}>
                                {formatPercent(margin)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Grid de custos e taxas */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted">Horas</p>
                          <p className="mt-0.5 font-mono text-paper">{row.hours}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted">Custo M.O.</p>
                          <p className="mt-0.5 font-mono text-paper">{formatBRLFromCents(Number(row.hours) * Number(row.hourly_labor_cost_cents) + (row.include_fixed_cost_per_hour ? Number(row.hours) * Number(row.fixed_cost_per_hour_cents) : 0))}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted">Materiais</p>
                          <p className="mt-0.5 font-mono text-paper">{formatBRLFromCents(row.materials_cents)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted">Taxas</p>
                          <p className="mt-0.5 font-mono text-amber-400">{formatPercent(row.variable_fees_percent)}</p>
                        </div>
                      </div>

                      {/* Resultado unitário */}
                      {result && (
                        <div className="pt-2 border-t border-line/50">
                          <p className="text-[9px] uppercase tracking-wider text-muted">Resultado / serviço</p>
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
                      <button aria-label={`Editar ${row.name}`} title="Editar" className="rounded p-2 text-muted hover:text-paper transition-colors" onClick={() => openForm(row)}><Pencil size={13}/></button>
                      <button aria-label={`Duplicar ${row.name}`} title="Duplicar" className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => void duplicate(row)}><Copy size={13}/></button>
                      <button aria-label={`Excluir ${row.name}`} title="Excluir" className="rounded p-2 text-muted hover:text-red-400 transition-colors" onClick={() => void remove(row)}><Trash2 size={13}/></button>
                    </div>
                  </div>
                )
              })}
            </div>

            {filtered.length === 0 && <div className="surface p-8 text-center"><p className="text-sm text-muted">Nenhum serviço corresponde à pesquisa.</p></div>}
          </div>}
    </>}

    {/* ── FORM ──────────────────────────────────── */}
    {panel === 'form' && <section className="surface p-5 sm:p-7 space-y-5">
      <div className="flex items-start justify-between border-b border-line pb-4">
        <div><p className="eyebrow text-gold">PRECIFICAÇÃO DE SERVIÇO</p><h3 className="mt-1 text-xl font-bold">{editing ? 'Editar serviço' : 'Novo serviço'}</h3></div>
        <button className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1" onClick={() => { setPanel('list'); setError(null) }}><ChevronLeft size={14}/>Voltar</button>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <label className="block"><span className={fieldLabel}>Nome do serviço</span><input className="field" maxLength={160} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>

        {/* Custos base */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={fieldLabel}>Tempo de execução (horas) <span className="text-gold font-bold">*</span></span><input className="field" type="number" min="0.01" step="any" required value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })}/></label>
          <label><span className={fieldLabel}>Custo-hora de mão de obra (R$) <span className="text-gold font-bold">*</span></span><CurrencyInput className="field" required value={form.hourly} onChange={value => setForm({ ...form, hourly: value })} placeholder="0,00"/></label>
          
          {/* Campo de totalização - Materiais e insumos */}
          <label className="sm:col-span-2">
            <span className={fieldLabel}>Materiais e insumos (R$) <span className="text-xs text-muted font-normal">· Soma dos custos abaixo</span></span>
            <input 
              className="field bg-emerald-400/5 font-mono font-bold text-emerald-400 cursor-not-allowed" 
              disabled 
              value={formatBRLFromCents(serviceCosts.reduce((sum, c) => sum + Number(c.amount_cents), 0)).replace('R$', '').trim()} 
              placeholder="0,00"
            />
          </label>
          
          <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2"><input type="checkbox" checked={form.includeFixed} onChange={e => setForm({ ...form, includeFixed: e.target.checked })} className="accent-[#D4AF37]"/>Incluir custo fixo por hora</label>
          {form.includeFixed && <label className="sm:col-span-2"><span className={fieldLabel}>Custo fixo por hora (R$)</span><CurrencyInput className="field" value={form.fixedHourly} onChange={value => setForm({ ...form, fixedHourly: value })} placeholder="0,00"/></label>}
        </div>

        {/* Custos + Taxas lado a lado */}
        {/* Custos + Taxas lado a lado como TABELAS */}
        {editing && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <ServiceCostsList
                costs={serviceCosts}
                onEdit={handleEditCost}
                onDelete={handleDeleteCost}
                onAdd={handleAddCost}
              />
              <ServiceFeesList
                fees={serviceFees}
                onEdit={handleEditFee}
                onDelete={handleDeleteFee}
                onAdd={handleAddFee}
              />
            </div>
            
            {/* Info panel: Default fees from Variable Costs */}
            {defaultFeesBreakdown.length > 0 && (
              <div className="surface p-4 border border-blue-500/20 bg-blue-500/5">
                <div className="flex items-start gap-3">
                  <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-semibold text-paper">
                      Taxas padrão da aba Custos Variáveis ({formatPercent(defaultFeesPercent)})
                    </p>
                    <div className="space-y-1">
                      {defaultFeesBreakdown.map((fee, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-muted">{fee.label}</span>
                          <span className="font-mono font-semibold text-paper">{formatPercent(fee.percent)}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted mt-2">
                      💡 Estas taxas são carregadas automaticamente. Você pode adicionar taxas adicionais específicas deste serviço usando o botão + acima.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* For new services, show message */}
        {!editing && (
          <div className="surface p-5 border border-amber-500/20 bg-amber-500/5">
            <p className="text-sm text-amber-600">
              💡 Primeiro salve o serviço, depois você poderá adicionar custos e taxas detalhados.
            </p>
          </div>
        )}

        {/* Preço e margem */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={fieldLabel}>Preço praticado hoje (R$) · opcional</span><CurrencyInput className="field" value={form.price} onChange={value => setForm({ ...form, price: value })} placeholder="0,00"/></label>
          <label><span className={fieldLabel}>Margem desejada (%) · opcional</span><input className="field" type="number" min="0" max="100" step="0.01" value={form.desired} onChange={e => setForm({ ...form, desired: e.target.value })} placeholder="Ex.: 20"/></label>
        </div>

        {error && <InlineNotice>{error}</InlineNotice>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button className="btn-secondary" type="button" onClick={() => { setPanel('list'); setError(null) }}>Cancelar</button>
          <button className="btn-primary" disabled={busy}>{busy ? <LoaderCircle size={14} className="animate-spin"/> : <Plus size={14}/>}Salvar serviço</button>
        </div>
      </form>
    </section>}

    {/* ── DETAILS ──────────────────────────────── */}
    {panel === 'details' && selectedDetails && (() => {
      const cost = calculateServiceCost({ hours: Number(selectedDetails.hours), hourlyLaborCostCents: Number(selectedDetails.hourly_labor_cost_cents), materialsCents: Number(selectedDetails.materials_cents), otherCostCents: Number(selectedDetails.other_cost_cents), fixedCostPerHourCents: Number(selectedDetails.fixed_cost_per_hour_cents), includeFixedCostPerHour: selectedDetails.include_fixed_cost_per_hour })
      const pricing = selectedDetails.current_price_cents !== null ? calculateProductPricing({ acquisitionCostCents: cost, variableFeesPercent: Number(selectedDetails.variable_fees_percent), taxPercent: Number(selectedDetails.tax_percent), desiredMarginPercent: selectedDetails.desired_margin_percent === null ? undefined : Number(selectedDetails.desired_margin_percent), sellingPriceCents: Number(selectedDetails.current_price_cents) }) : null
      const desired = selectedDetails.desired_margin_percent !== null ? Number(selectedDetails.desired_margin_percent) : null
      const minimum = pricing?.minimumPriceCents ?? null
      const recommended = pricing?.recommendedPriceCents ?? null
      const contribution = pricing?.contributionCents ?? null

      // Calcular pricing baseado no preço RECOMENDADO (não no praticado)
      const recommendedPricing = pricing && recommended ? calculateProductPricing({
        acquisitionCostCents: cost,
        variableFeesPercent: Number(selectedDetails.variable_fees_percent),
        taxPercent: Number(selectedDetails.tax_percent),
        desiredMarginPercent: selectedDetails.desired_margin_percent === null ? undefined : Number(selectedDetails.desired_margin_percent),
        sellingPriceCents: recommended ?? undefined
      }) : null

      // Usar margem do PREÇO RECOMENDADO
      const recommendedMargin = recommendedPricing?.contributionMarginPercent ?? null
      const isNegRecommended = recommendedMargin !== null && recommendedMargin < 0

      // Pie data - baseado no preço RECOMENDADO
      const pieData = recommendedPricing ? [
        { name: 'Custo total', value: cost, fill: DETAIL_COLORS.cost },
        { name: 'Taxas/encargos', value: recommendedPricing.feesCents ?? 0, fill: TAG_COLORS[2] },
        { name: 'Margem de contribuição', value: Math.max(0, recommendedPricing.contributionCents ?? 0), fill: isNegRecommended ? DETAIL_COLORS.contributionNeg : DETAIL_COLORS.contribution },
      ].filter(d => d.value > 0) : []

      // Smart footnote - baseado no preço RECOMENDADO
      let footnote: { text: string; tone: 'ok' | 'warn' | 'bad' } | null = null
      if (!recommendedPricing) footnote = { text: 'Cadastre um Preço praticado hoje para visualizar a análise de margem.', tone: 'warn' }
      else if (recommendedMargin !== null && recommendedMargin < 0) footnote = { text: `⚠️ Margem negativa (${formatPercent(recommendedMargin)}). Cada execução gera prejuízo. Revise os custos ou ajuste o preço para pelo menos ${formatBRLFromCents(minimum)}.`, tone: 'bad' }
      else if (desired !== null && recommendedMargin !== null && recommendedMargin < desired) footnote = { text: `Abaixo da meta de margem (${formatPercent(desired)}). Preço recomendado: ${formatBRLFromCents(recommended)}.`, tone: 'warn' }
      else if (recommendedMargin !== null) footnote = { text: `✓ Margem saudável de ${formatPercent(recommendedMargin)}. Continue monitorando os custos para preservar este resultado.`, tone: 'ok' }

      return (
        <section className="surface p-5 sm:p-7 space-y-6">
          <div className="flex items-start justify-between border-b border-line pb-4">
            <div><p className="eyebrow text-gold">DETALHES DO SERVIÇO</p><h3 className="mt-1 text-2xl font-bold">{selectedDetails.name}</h3></div>
            <button className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1" onClick={() => setPanel('list')}><ChevronLeft size={14}/>Voltar</button>
          </div>

          {/* Price comparison card */}
          {selectedDetails.current_price_cents && (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Current price (what they charge today) */}
              <div className={`rounded-2xl border-2 p-4 ${(contribution ?? 0) >= 0 ? 'border-teal-border bg-teal-light/10' : 'border-red-200 bg-red-50/25'}`}>
                <p className="eyebrow mb-2" style={{ color: (contribution ?? 0) >= 0 ? '#1A3C34' : '#991b1b' }}>PREÇO PRATICADO HOJE</p>
                <p className="font-mono text-4xl font-bold mt-2" style={{ color: (contribution ?? 0) >= 0 ? '#1A3C34' : '#DC2626' }}>{formatBRLFromCents(selectedDetails.current_price_cents)}</p>
                <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 ${(contribution ?? 0) >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  {(contribution ?? 0) >= 0 ? <CheckCircle2 size={16} style={{ color: '#047857' }}/> : <AlertTriangle size={16} style={{ color: '#991b1b' }}/>}
                  <div className="flex-1">
                    <p className="text-xs font-bold" style={{ color: (contribution ?? 0) >= 0 ? '#047857' : '#991b1b' }}>
                      {(contribution ?? 0) >= 0 ? 'Gerando lucro' : 'Gerando prejuízo'}
                    </p>
                    <p className="mt-0.5 text-[10px]" style={{ color: (contribution ?? 0) >= 0 ? '#065f46' : '#7f1d1d' }}>
                      {(contribution ?? 0) >= 0 
                        ? `${formatBRLFromCents(contribution)} por serviço · ${formatPercent(pricing?.contributionMarginPercent ?? 0)} de margem` 
                        : `${formatBRLFromCents(Math.abs(contribution ?? 0))} prejuízo · ${formatPercent(pricing?.contributionMarginPercent ?? 0)} de margem`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommended price (by the system) */}
              <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/25 p-4">
                <p className="eyebrow mb-2 text-emerald-900">PREÇO RECOMENDADO</p>
                <p className="font-mono text-4xl font-bold text-emerald-700 mt-2">{formatBRLFromCents(recommended)}</p>
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                  <TrendingUp size={16} className="text-emerald-700"/>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-emerald-900">Sistema calculado</p>
                    <p className="mt-0.5 text-[10px] text-emerald-800">
                      {desired !== null 
                        ? `Atinge margem de ${formatPercent(desired)}`
                        : 'Baseado em custo + taxas'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DETALHAMENTO ANALÍTICO - Linha por linha */}
          <div className="space-y-4">
            <p className="eyebrow text-gold">DETALHAMENTO ANALÍTICO</p>
            
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Custos Individuais - DETALHADO */}
              <div className="surface p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <p className="text-sm font-semibold text-paper">Custos</p>
                  <p className="font-mono text-sm font-bold text-emerald-400">
                    {formatBRLFromCents(serviceCosts.reduce((sum, c) => sum + Number(c.amount_cents), 0))}
                  </p>
                </div>
                
                {serviceCosts.length === 0 ? (
                  <p className="text-center text-sm text-muted py-2">Nenhum custo cadastrado</p>
                ) : (
                  serviceCosts.map((cost) => {
                    const price = recommended ? Number(recommended) : 0
                    const percentOfPrice = price > 0 ? ((Number(cost.amount_cents) / price) * 100).toFixed(1) : '0'
                    
                    return (
                      <div key={cost.id} className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`size-2 rounded-full shrink-0 ${cost.cost_type === 'material' ? 'bg-emerald-500' : 'bg-purple-500'}`} />
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-paper block truncate">{cost.label}</span>
                            <span className="text-xs text-muted">{cost.cost_type === 'material' ? 'Materiais' : 'Adicional'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {price > 0 && (
                            <>
                              <span className="font-mono text-sm text-paper">{percentOfPrice}%</span>
                              <span className="text-muted text-xs">·</span>
                            </>
                          )}
                          <span className={`font-mono text-base font-bold ${cost.cost_type === 'material' ? 'text-emerald-500' : 'text-purple-500'}`}>
                            {formatBRLFromCents(cost.amount_cents)}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Taxas e Encargos Individuais - DETALHADO */}
              <div className="surface p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <p className="text-sm font-semibold text-paper">Taxas e encargos</p>
                  <p className="font-mono text-sm font-bold text-amber-400">
                    {formatPercent(serviceFees.reduce((sum, f) => sum + Number(f.percent), 0))}
                  </p>
                </div>
                
                {serviceFees.length === 0 ? (
                  <p className="text-center text-sm text-muted py-2">Nenhuma taxa cadastrada</p>
                ) : (
                  serviceFees.map((fee) => {
                    const price = recommended ? Number(recommended) : 0
                    const amountCents = Math.round((price * Number(fee.percent)) / 100)
                    
                    return (
                      <div key={fee.id} className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`size-2 rounded-full shrink-0 ${fee.fee_type === 'variable' ? 'bg-orange-500' : 'bg-red-500'}`} />
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-paper block truncate">{fee.label}</span>
                            <span className="text-xs text-muted">{fee.fee_type === 'variable' ? 'Taxa variável' : 'Imposto'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-mono text-sm ${fee.fee_type === 'variable' ? 'text-orange-500' : 'text-red-500'}`}>
                            {formatPercent(fee.percent)}
                          </span>
                          <span className="text-muted text-xs">·</span>
                          <span className={`font-mono text-base font-bold ${fee.fee_type === 'variable' ? 'text-orange-500' : 'text-red-500'}`}>
                            {formatBRLFromCents(amountCents)}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            {/* Metrics */}
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['Horas de execução', `${selectedDetails.hours}h`, '#6b7280'],
                ['Custo-hora de mão de obra', formatBRLFromCents(selectedDetails.hourly_labor_cost_cents), DETAIL_COLORS.cost],
                ['Materiais e insumos', formatBRLFromCents(Number(selectedDetails.materials_cents) + Number(selectedDetails.other_cost_cents)), COST_COLORS[0]],
                ['Custo total do serviço', formatBRLFromCents(cost), '#6b7280'],
                ['Taxas e encargos', `${formatPercent(Number(selectedDetails.variable_fees_percent) + Number(selectedDetails.tax_percent))} · ${formatBRLFromCents((pricing?.feesCents ?? 0) + (pricing?.taxesCents ?? 0))}`, TAG_COLORS[2]],
                ['Preço praticado hoje', formatBRLFromCents(selectedDetails.current_price_cents), '#D4AF37'],
                ['Preço mínimo', formatBRLFromCents(minimum), '#6b7280'],
                ['Preço recomendado', formatBRLFromCents(recommended), '#22c55e'],
                ['Resultado est. / unidade', `${formatBRLFromCents(recommendedPricing?.contributionCents ?? 0)} lucro · ${formatPercent(recommendedPricing?.contributionMarginPercent ?? 0)}`, (recommendedPricing?.contributionCents ?? 0) >= 0 ? DETAIL_COLORS.contribution : DETAIL_COLORS.contributionNeg],
                ['Margem de contribuição', formatPercent(recommendedPricing?.contributionMarginPercent ?? 0), (recommendedPricing?.contributionMarginPercent ?? 0) >= 0 ? DETAIL_COLORS.contribution : DETAIL_COLORS.contributionNeg],
                ['Markup', formatMarkup(recommendedPricing?.markup ?? null), '#a855f7'],
              ] as [string, string, string][]).map(([label, value, color]) => (
                <div key={label} className="rounded-xl border border-line bg-panel p-4 hover:border-teal-border transition-colors">
                  <p className="text-xs font-semibold text-muted">{label}</p>
                  <p className="mt-2 font-mono text-base font-semibold" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Pie chart */}
            {pieData.length > 0 && (
              <div className="flex flex-col items-center">
                <p className="eyebrow mb-3 self-start">COMPOSIÇÃO DO PREÇO</p>
                <div className="relative h-52 w-full max-w-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={84} paddingAngle={3} stroke="none"
                        onMouseEnter={(_, i) => setActiveSlice(i)} onMouseLeave={() => setActiveSlice(null)}>
                        {pieData.map((entry, i) => (
                          <Cell key={entry.name} fill={entry.fill}
                            opacity={activeSlice === null || activeSlice === i ? 1 : 0.35}
                            style={{ transition: 'all 0.2s', cursor: 'pointer' }}/>
                        ))}
                      </Pie>
                      <RechartsTooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const item = payload[0]
                        return <div className="rounded-xl border border-line bg-graphite px-4 py-3 text-xs shadow-xl"><p className="font-semibold" style={{ color: item.payload.fill }}>{item.name}</p><p className="mt-1 font-mono" style={{ color: item.payload.fill }}>{formatBRLFromCents(Number(item.value))}</p></div>
                      }}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    {activeSlice !== null && pieData[activeSlice] ? (
                      <><span className="text-[9px] text-muted text-center px-2">{pieData[activeSlice].name}</span><span className="font-mono text-sm font-bold mt-1" style={{ color: pieData[activeSlice].fill }}>{((pieData[activeSlice].value / pieData.reduce((s, d) => s + d.value, 0)) * 100).toFixed(1)}%</span></>
                    ) : <TrendingUp size={16} className="text-gold"/>}
                  </div>
                </div>
                <div className="mt-2 w-full space-y-1.5">
                  {pieData.map((entry, i) => (
                    <div key={entry.name} className="flex items-center justify-between text-[11px] cursor-pointer rounded px-2 py-1 hover:bg-white/5 transition-colors" onMouseEnter={() => setActiveSlice(i)} onMouseLeave={() => setActiveSlice(null)}>
                      <span className="flex items-center gap-2 text-muted"><span className="size-2 rounded-full" style={{ background: entry.fill }}/>{entry.name}</span>
                      <span className="font-mono" style={{ color: entry.fill }}>{formatBRLFromCents(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footnote with enhanced visibility */}
          {footnote && (
            <div className={`rounded-2xl border-2 px-6 py-5 text-sm font-medium leading-relaxed shadow-lg ${footnote.tone === 'ok' ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : footnote.tone === 'bad' ? 'border-red-400 bg-red-50 text-red-800' : 'border-amber-400 bg-amber-100 text-amber-900'}`}>
              <div className="flex items-start gap-3">
                {footnote.tone === 'ok' ? <CheckCircle2 size={22} className="mt-0.5 shrink-0"/> : <AlertTriangle size={22} className="mt-0.5 shrink-0"/>}
                <p className="text-[15px] leading-7">{footnote.text}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button className="btn-secondary" onClick={() => setPanel('list')}>Fechar</button>
            <button className="btn-primary" onClick={() => openForm(selectedDetails)}><Pencil size={14}/>Editar serviço</button>
          </div>
        </section>
      )
    })()}

    {/* ── HISTORY ───────────────────────────────── */}
    {panel === 'history' && <section className="surface p-5 space-y-4">
      <div className="flex items-start justify-between border-b border-line pb-4">
        <div><p className="eyebrow text-gold">AUDITORIA DE SERVIÇOS</p><h3 className="mt-1 text-xl font-bold">Histórico — {historyTarget?.name}</h3></div>
        <button className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1" onClick={() => setPanel('list')}><ChevronLeft size={14}/>Voltar</button>
      </div>
      {history.length
        ? <div className="divide-y divide-line">{history.map(item => <div key={item.id} className="py-3"><p className="text-xs text-muted">{new Date(item.created_at).toLocaleString('pt-BR')}</p><p className="mt-1 text-sm">Preço: <span className="font-mono text-gold">{formatBRLFromCents(item.snapshot.current_price_cents)}</span></p><p className="mt-1 text-xs text-muted">Custo-hora: {formatBRLFromCents(item.snapshot.hourly_labor_cost_cents)} · materiais: {formatBRLFromCents(item.snapshot.materials_cents)} · margem desejada: {formatPercent(item.snapshot.desired_margin_percent)}</p></div>)}</div>
        : <p className="text-sm text-muted">Ainda não há alterações de preço registradas.</p>}
    </section>}

    {/* Modals */}
    <ServiceCostModal
      isOpen={costModalOpen}
      onClose={() => { setCostModalOpen(false); setEditingCost(null) }}
      onSave={handleSaveCost}
      editing={editingCost}
    />
    <ServiceFeeModal
      isOpen={feeModalOpen}
      onClose={() => { setFeeModalOpen(false); setEditingFee(null) }}
      onSave={handleSaveFee}
      editing={editingFee}
    />
  </div>
}
