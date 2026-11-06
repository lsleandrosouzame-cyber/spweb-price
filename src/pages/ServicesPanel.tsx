import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Copy, History, LoaderCircle, Plus, Search, Trash2, Pencil, Wrench, ChevronLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState, InlineNotice, LoadingScreen } from '../components/Feedback'
import { CurrencyInput } from '../components/CurrencyInput'
import { calculateProductPricing, calculateServiceCost } from '../finance/pricing'
import { formatBRLFromCents, formatMarkup, formatPercent, parseBrazilianCurrency } from '../lib/money'
import { supabase } from '../lib/supabase'
import { listServices, removeService, saveService } from '../services/companyData'
import type { ServiceRecord } from '../types/database'
import { FeeTagWidget, CostTagWidget, type FeeTag, type CostTag } from './CalculationPage'

const empty = { name: '', hours: '1', hourly: '', materials: '', fixedHourly: '', includeFixed: false, desired: '', price: '' }
const fieldLabel = 'mb-2 block text-xs font-medium text-[#c7c7c7]'
type Panel = 'list' | 'form' | 'history'

export default function ServicesPanel() {
  const { currentCompany } = useAuth()
  const [rows, setRows] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [panel, setPanel] = useState<Panel>('list')
  const [editing, setEditing] = useState<ServiceRecord | null>(null)
  const [form, setForm] = useState(empty)
  const [feeTags, setFeeTags] = useState<FeeTag[]>([])
  const [costTags, setCostTags] = useState<CostTag[]>([])
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [historyTarget, setHistoryTarget] = useState<ServiceRecord | null>(null)

  const refresh = useCallback(async () => {
    if (!currentCompany) { setLoading(false); return }
    setLoading(true)
    try { setRows(await listServices(currentCompany.id)); setError(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os serviços.') }
    finally { setLoading(false) }
  }, [currentCompany?.id])
  useEffect(() => { void refresh() }, [refresh])

  const filtered = useMemo(() => rows.filter(row => row.name.toLowerCase().includes(search.toLowerCase())), [rows, search])

  function openForm(row?: ServiceRecord) {
    setEditing(row ?? null); setMessage(null); setError(null)
    const money = (cents: number) => (Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    setForm(row ? {
      name: row.name, hours: String(row.hours), hourly: money(row.hourly_labor_cost_cents),
      materials: money(row.materials_cents), fixedHourly: money(row.fixed_cost_per_hour_cents),
      includeFixed: row.include_fixed_cost_per_hour,
      desired: row.desired_margin_percent === null ? '' : String(row.desired_margin_percent),
      price: row.current_price_cents === null ? '' : money(row.current_price_cents),
    } : empty)
    // Reconstruct fee tags from stored data
    const tags: FeeTag[] = []
    if (row && Number(row.variable_fees_percent) > 0) tags.push({ id: crypto.randomUUID(), label: 'Taxas variáveis', percent: String(row.variable_fees_percent) })
    if (row && Number(row.tax_percent) > 0) tags.push({ id: crypto.randomUUID(), label: 'Impostos', percent: String(row.tax_percent) })
    setFeeTags(tags)
    // Reconstruct cost tags from other_cost_cents
    const costs: CostTag[] = []
    if (row && Number(row.other_cost_cents) > 0) costs.push({ id: crypto.randomUUID(), label: 'Outros custos', value: money(row.other_cost_cents) })
    setCostTags(costs)
    setPanel('form')
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!currentCompany) return
    const totalFeesPercent = feeTags.reduce((s, t) => s + Number(t.percent || 0), 0)
    const totalExtraCostsCents = costTags.reduce((s, t) => s + (parseBrazilianCurrency(t.value) ?? 0), 0)
    const money = (value: string) => value.trim() ? parseBrazilianCurrency(value) : 0
    const desired = form.desired.trim() ? Number(form.desired.replace(',', '.')) : null
    const price = form.price.trim() ? money(form.price) : null
    const hours = Number(form.hours)
    const hourly = money(form.hourly)
    if (!form.name.trim() || !Number.isFinite(hours) || hours <= 0 || hourly === null || (form.price.trim() && price === null) || (desired !== null && !Number.isFinite(desired))) {
      setError('Revise nome, tempo e custos.'); return
    }
    try {
      const cost = calculateServiceCost({ hours, hourlyLaborCostCents: hourly ?? 0, materialsCents: money(form.materials) ?? 0, otherCostCents: totalExtraCostsCents, fixedCostPerHourCents: money(form.fixedHourly) ?? 0, includeFixedCostPerHour: form.includeFixed })
      calculateProductPricing({ acquisitionCostCents: cost, variableFeesPercent: totalFeesPercent, taxPercent: 0, desiredMarginPercent: desired ?? undefined, sellingPriceCents: price ?? undefined })
      setBusy(true); setError(null)
      await saveService(currentCompany.id, {
        name: form.name.trim(), hours,
        hourly_labor_cost_cents: hourly ?? 0,
        materials_cents: money(form.materials) ?? 0,
        other_cost_cents: totalExtraCostsCents,
        fixed_cost_per_hour_cents: money(form.fixedHourly) ?? 0,
        include_fixed_cost_per_hour: form.includeFixed,
        variable_fees_percent: totalFeesPercent, tax_percent: 0,
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
        : <div className="surface overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-4"><Wrench size={16} className="text-gold"/><div><p className="eyebrow">SERVIÇOS CADASTRADOS</p><p className="mt-1 text-xs text-muted">{filtered.length} de {rows.length} serviço(s)</p></div></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left">
                <thead><tr className="border-b border-line text-[10px] uppercase tracking-[.14em] text-muted"><th className="px-5 py-3">Serviço</th><th className="px-3 py-3">Horas</th><th className="px-3 py-3">Custo total</th><th className="px-3 py-3">Preço atual</th><th className="px-3 py-3">Margem</th><th className="px-3 py-3">Markup</th><th className="px-3 py-3">Resultado / un.</th><th className="px-4 py-3"/></tr></thead>
                <tbody className="divide-y divide-line">{filtered.map(row => {
                  const cost = calculateServiceCost({ hours: Number(row.hours), hourlyLaborCostCents: Number(row.hourly_labor_cost_cents), materialsCents: Number(row.materials_cents), otherCostCents: Number(row.other_cost_cents), fixedCostPerHourCents: Number(row.fixed_cost_per_hour_cents), includeFixedCostPerHour: row.include_fixed_cost_per_hour })
                  const result = row.current_price_cents === null ? null : calculateProductPricing({ acquisitionCostCents: cost, variableFeesPercent: Number(row.variable_fees_percent), taxPercent: Number(row.tax_percent), sellingPriceCents: Number(row.current_price_cents) })
                  return <tr key={row.id} className="hover:bg-white/[.018] transition-colors">
                    <td className="px-5 py-4"><p className="text-sm font-medium">{row.name}</p><p className="mt-1 text-[10px] text-muted">{row.include_fixed_cost_per_hour ? 'Inclui custo fixo/hora' : 'Sem rateio fixo'}</p></td>
                    <td className="px-3 py-4 font-mono text-xs">{row.hours}</td>
                    <td className="px-3 py-4 font-mono text-xs">{formatBRLFromCents(cost)}</td>
                    <td className="px-3 py-4 font-mono text-xs">{formatBRLFromCents(row.current_price_cents)}</td>
                    <td className={`px-3 py-4 font-mono text-xs font-semibold ${(result?.contributionMarginPercent ?? 0) < 0 ? 'text-red-400' : (result?.contributionMarginPercent ?? 0) >= 20 ? 'text-emerald-400' : 'text-paper'}`}>{formatPercent(result?.contributionMarginPercent)}</td>
                    <td className="px-3 py-4 font-mono text-xs">{formatMarkup(result?.markup)}</td>
                    <td className={`px-3 py-4 font-mono text-xs font-semibold ${(result?.contributionCents ?? 0) < 0 ? 'text-red-400' : (result?.contributionCents ?? 0) > 0 ? 'text-emerald-400' : 'text-paper'}`}>{formatBRLFromCents(result?.contributionCents)}</td>
                    <td className="px-3 py-4"><div className="flex justify-end gap-1">
                      <button aria-label={`Histórico de ${row.name}`} title="Histórico" className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => void openHistory(row)}><History size={14}/></button>
                      <button aria-label={`Editar ${row.name}`} className="rounded p-2 text-muted hover:text-paper transition-colors" onClick={() => openForm(row)}><Pencil size={14}/></button>
                      <button aria-label={`Duplicar ${row.name}`} className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => void duplicate(row)}><Copy size={14}/></button>
                      <button aria-label={`Excluir ${row.name}`} className="rounded p-2 text-muted hover:text-red-400 transition-colors" onClick={() => void remove(row)}><Trash2 size={14}/></button>
                    </div></td>
                  </tr>
                })}</tbody>
              </table>
            </div>
          </div>}
    </>}

    {/* ── FORM ──────────────────────────────────── */}
    {panel === 'form' && <section className="surface p-5 sm:p-7 space-y-5">
      <div className="flex items-start justify-between border-b border-line pb-4">
        <div><p className="eyebrow text-gold">PRECIFICAÇÃO DE SERVIÇO</p><h3 className="mt-1 text-lg font-semibold">{editing ? 'Editar serviço' : 'Novo serviço'}</h3></div>
        <button className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1" onClick={() => { setPanel('list'); setError(null) }}><ChevronLeft size={14}/>Voltar</button>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <label className="block"><span className={fieldLabel}>Nome do serviço</span><input className="field" maxLength={160} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>

        {/* Custos base */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={fieldLabel}>Tempo de execução (horas) <span className="text-gold font-bold">*</span></span><input className="field" type="number" min="0.01" step="any" required value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })}/></label>
          <label><span className={fieldLabel}>Custo-hora de mão de obra (R$) <span className="text-gold font-bold">*</span></span><CurrencyInput className="field" required value={form.hourly} onChange={value => setForm({ ...form, hourly: value })} placeholder="0,00"/></label>
          <label><span className={fieldLabel}>Materiais e insumos (R$)</span><CurrencyInput className="field" value={form.materials} onChange={value => setForm({ ...form, materials: value })} placeholder="0,00"/></label>
          <label className="flex items-center gap-2 text-xs text-muted mt-1"><input type="checkbox" checked={form.includeFixed} onChange={e => setForm({ ...form, includeFixed: e.target.checked })} className="accent-[#D4AF37]"/>Incluir custo fixo por hora</label>
          {form.includeFixed && <label className="sm:col-span-2"><span className={fieldLabel}>Custo fixo por hora (R$)</span><CurrencyInput className="field" value={form.fixedHourly} onChange={value => setForm({ ...form, fixedHourly: value })} placeholder="0,00"/></label>}
        </div>

        {/* Custos adicionais + Taxas lado a lado */}
        <div className="grid gap-4 sm:grid-cols-2">
          <CostTagWidget costTags={costTags} setCostTags={setCostTags} title="Outros custos"/>
          <FeeTagWidget feeTags={feeTags} setFeeTags={setFeeTags}/>
        </div>

        {/* Preço e margem */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={fieldLabel}>Preço atual (R$) · opcional</span><CurrencyInput className="field" value={form.price} onChange={value => setForm({ ...form, price: value })} placeholder="0,00"/></label>
          <label><span className={fieldLabel}>Margem desejada (%) · opcional</span><input className="field" type="number" min="0" max="100" step="0.01" value={form.desired} onChange={e => setForm({ ...form, desired: e.target.value })} placeholder="Ex.: 20"/></label>
        </div>

        {error && <InlineNotice>{error}</InlineNotice>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button className="btn-secondary" type="button" onClick={() => { setPanel('list'); setError(null) }}>Cancelar</button>
          <button className="btn-primary" disabled={busy}>{busy ? <LoaderCircle size={14} className="animate-spin"/> : <Plus size={14}/>}Salvar serviço</button>
        </div>
      </form>
    </section>}

    {/* ── HISTORY ───────────────────────────────── */}
    {panel === 'history' && <section className="surface p-5 space-y-4">
      <div className="flex items-start justify-between border-b border-line pb-4">
        <div><p className="eyebrow text-gold">AUDITORIA DE SERVIÇOS</p><h3 className="mt-1 text-lg font-semibold">Histórico — {historyTarget?.name}</h3></div>
        <button className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1" onClick={() => setPanel('list')}><ChevronLeft size={14}/>Voltar</button>
      </div>
      {history.length
        ? <div className="divide-y divide-line">{history.map(item => <div key={item.id} className="py-3"><p className="text-xs text-muted">{new Date(item.created_at).toLocaleString('pt-BR')}</p><p className="mt-1 text-sm">Preço: <span className="font-mono text-gold">{formatBRLFromCents(item.snapshot.current_price_cents)}</span></p><p className="mt-1 text-xs text-muted">Custo-hora: {formatBRLFromCents(item.snapshot.hourly_labor_cost_cents)} · materiais: {formatBRLFromCents(item.snapshot.materials_cents)} · margem desejada: {formatPercent(item.snapshot.desired_margin_percent)}</p></div>)}</div>
        : <p className="text-sm text-muted">Ainda não há alterações de preço registradas.</p>}
    </section>}
  </div>
}
