import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Copy, History, LoaderCircle, Plus, Search, Trash2, Pencil, Wrench, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState, InlineNotice, LoadingScreen } from '../components/Feedback'
import { CurrencyInput } from '../components/CurrencyInput'
import { calculateProductPricing, calculateServiceCost } from '../finance/pricing'
import { formatBRLFromCents, formatMarkup, formatPercent, parseBrazilianCurrency } from '../lib/money'
import { supabase } from '../lib/supabase'
import { listServices, removeService, saveService } from '../services/companyData'
import type { ServiceRecord } from '../types/database'

const empty = { name: '', hours: '1', hourly: '', materials: '0', other: '0', fixedHourly: '0', includeFixed: false, fees: '0', taxes: '0', desired: '', price: '' }
const fieldLabel = 'mb-2 block text-xs font-medium text-[#c7c7c7]'

export default function ServicesPanel() {
  const { currentCompany } = useAuth()
  const [rows, setRows] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceRecord | null>(null)
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<any[] | null>(null)

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
    setForm(row ? { name: row.name, hours: String(row.hours), hourly: money(row.hourly_labor_cost_cents), materials: money(row.materials_cents), other: money(row.other_cost_cents), fixedHourly: money(row.fixed_cost_per_hour_cents), includeFixed: row.include_fixed_cost_per_hour, fees: String(row.variable_fees_percent), taxes: String(row.tax_percent), desired: row.desired_margin_percent === null ? '' : String(row.desired_margin_percent), price: row.current_price_cents === null ? '' : money(row.current_price_cents) } : empty)
    setOpen(true)
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!currentCompany) return
    const cents = (value: string) => value.trim() ? parseBrazilianCurrency(value) : 0
    const desired = form.desired.trim() ? Number(form.desired.replace(',', '.')) : null
    const price = form.price.trim() ? cents(form.price) : null
    const hours = Number(form.hours)
    const hourly = cents(form.hourly)
    const fees = Number(form.fees.replace(',', '.')); const taxes = Number(form.taxes.replace(',', '.'))
    if (!form.name.trim() || !Number.isFinite(hours) || hours <= 0 || hourly === null || price === null && form.price.trim() || !Number.isFinite(fees) || !Number.isFinite(taxes) || desired !== null && !Number.isFinite(desired)) { setError('Revise nome, tempo, custos e percentuais.'); return }
    try {
      const cost = calculateServiceCost({ hours, hourlyLaborCostCents: hourly ?? 0, materialsCents: cents(form.materials) ?? 0, otherCostCents: cents(form.other) ?? 0, fixedCostPerHourCents: cents(form.fixedHourly) ?? 0, includeFixedCostPerHour: form.includeFixed })
      calculateProductPricing({ acquisitionCostCents: cost, variableFeesPercent: fees, taxPercent: taxes, desiredMarginPercent: desired ?? undefined, sellingPriceCents: price ?? undefined })
      setBusy(true); setError(null)
      await saveService(currentCompany.id, { name: form.name.trim(), hours, hourly_labor_cost_cents: hourly ?? 0, materials_cents: cents(form.materials) ?? 0, other_cost_cents: cents(form.other) ?? 0, fixed_cost_per_hour_cents: cents(form.fixedHourly) ?? 0, include_fixed_cost_per_hour: form.includeFixed, variable_fees_percent: fees, tax_percent: taxes, desired_margin_percent: desired, current_price_cents: price }, editing?.id)
      setOpen(false); setMessage(editing ? 'Serviço atualizado.' : 'Serviço salvo.'); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível calcular ou salvar o serviço.') }
    finally { setBusy(false) }
  }
  async function duplicate(row: ServiceRecord) {
    if (!currentCompany) return
    const { id: _id, company_id: _company, created_at: _created, updated_at: _updated, ...draft } = row
    try { await saveService(currentCompany.id, { ...draft, name: `${row.name} (cópia)` }); setMessage(`“${row.name}” foi duplicado.`); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível duplicar.') }
  }
  async function remove(row: ServiceRecord) {
    if (!currentCompany || !window.confirm(`Excluir “${row.name}”?`)) return
    try { await removeService(currentCompany.id, row.id); setMessage('Serviço excluído.'); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível excluir.') }
  }
  async function showHistory(row: ServiceRecord) {
    if (!supabase) return
    const { data, error: historyError } = await supabase.from('pricing_history').select('id, snapshot, created_at').eq('company_id', row.company_id).eq('item_id', row.id).eq('item_type', 'service').order('created_at', { ascending: false }).limit(20)
    if (historyError) { setError(historyError.message); return }
    setHistory(data ?? [])
  }

  if (loading) return <LoadingScreen label="Carregando serviços" />
  return <div className="space-y-5">
    {message && <InlineNotice tone="success">{message}</InlineNotice>}{error && !open && <InlineNotice>{error}</InlineNotice>}
    <div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"/><input className="field pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar serviço"/></label><button className="btn-primary w-fit" onClick={() => openForm()}><Plus size={15}/>Cadastrar serviço</button></div>
    {rows.length === 0 ? <EmptyState title="Cadastre seu primeiro serviço" description="Informe horas, mão de obra, materiais, taxas e impostos. O custo fixo por hora só será aplicado se você selecionar essa regra." action={<button className="btn-primary" onClick={() => openForm()}><Plus size={15}/>Cadastrar serviço</button>}/> : <div className="surface overflow-hidden"><div className="flex items-center gap-2 border-b border-line px-5 py-4"><Wrench size={16} className="text-gold"/><div><p className="eyebrow">SERVIÇOS CADASTRADOS</p><p className="mt-1 text-xs text-muted">{filtered.length} de {rows.length} serviço(s)</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left"><thead><tr className="border-b border-line text-[10px] uppercase tracking-[.14em] text-muted"><th className="px-5 py-3">Serviço</th><th className="px-3 py-3">Horas</th><th className="px-3 py-3">Custo total</th><th className="px-3 py-3">Preço atual</th><th className="px-3 py-3">Margem</th><th className="px-3 py-3">Markup</th><th className="px-3 py-3">Resultado / unidade</th><th className="px-4 py-3"/></tr></thead><tbody className="divide-y divide-line">{filtered.map(row => {
      const cost = calculateServiceCost({ hours: Number(row.hours), hourlyLaborCostCents: Number(row.hourly_labor_cost_cents), materialsCents: Number(row.materials_cents), otherCostCents: Number(row.other_cost_cents), fixedCostPerHourCents: Number(row.fixed_cost_per_hour_cents), includeFixedCostPerHour: row.include_fixed_cost_per_hour })
      const result = row.current_price_cents === null ? null : calculateProductPricing({ acquisitionCostCents: cost, variableFeesPercent: Number(row.variable_fees_percent), taxPercent: Number(row.tax_percent), sellingPriceCents: Number(row.current_price_cents) })
      return <tr key={row.id}><td className="px-5 py-4"><p className="text-sm font-medium">{row.name}</p><p className="mt-1 text-[10px] text-muted">{row.include_fixed_cost_per_hour ? 'Inclui custo fixo/hora selecionado' : 'Sem rateio fixo automático'}</p></td><td className="px-3 py-4 font-mono text-xs">{row.hours}</td><td className="px-3 py-4 font-mono text-xs">{formatBRLFromCents(cost)}</td><td className="px-3 py-4 font-mono text-xs">{formatBRLFromCents(row.current_price_cents)}</td><td className="px-3 py-4 font-mono text-xs">{formatPercent(result?.contributionMarginPercent)}</td><td className="px-3 py-4 font-mono text-xs">{formatMarkup(result?.markup)}</td><td className="px-3 py-4 font-mono text-xs">{formatBRLFromCents(result?.contributionCents)}</td><td className="px-3 py-4"><div className="flex justify-end gap-1"><button aria-label={`Histórico de ${row.name}`} title="Histórico" className="rounded p-2 text-muted hover:text-gold" onClick={() => void showHistory(row)}><History size={14}/></button><button aria-label={`Editar ${row.name}`} className="rounded p-2 text-muted hover:text-paper" onClick={() => openForm(row)}><Pencil size={14}/></button><button aria-label={`Duplicar ${row.name}`} className="rounded p-2 text-muted hover:text-gold" onClick={() => void duplicate(row)}><Copy size={14}/></button><button aria-label={`Excluir ${row.name}`} className="rounded p-2 text-muted hover:text-negative" onClick={() => void remove(row)}><Trash2 size={14}/></button></div></td></tr>
    })}</tbody></table></div></div>}
    {history && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setHistory(null) }}><section role="dialog" aria-modal="true" aria-labelledby="service-history-title" className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-[#111] p-5"><div className="flex items-center justify-between"><div><p className="eyebrow text-gold">AUDITORIA DE SERVIÇOS</p><h3 id="service-history-title" className="mt-1 text-lg font-semibold">Histórico de precificação</h3></div><button aria-label="Fechar histórico" onClick={() => setHistory(null)} className="rounded p-2 text-muted hover:text-paper"><X size={16}/></button></div>{history.length ? <div className="mt-5 divide-y divide-line">{history.map(item => <div key={item.id} className="py-3"><p className="text-xs text-muted">{new Date(item.created_at).toLocaleString('pt-BR')}</p><p className="mt-1 text-sm">Preço atual: <span className="font-mono text-gold">{formatBRLFromCents(item.snapshot.current_price_cents)}</span></p><p className="mt-1 text-xs text-muted">Custo-hora: {formatBRLFromCents(item.snapshot.hourly_labor_cost_cents)} · materiais: {formatBRLFromCents(item.snapshot.materials_cents)} · margem desejada: {formatPercent(item.snapshot.desired_margin_percent)}</p></div>)}</div> : <p className="mt-5 text-sm text-muted">Ainda não há alterações de preço registradas.</p>}</section></div>}
    {open && <div className="fixed inset-0 z-[75] grid place-items-center overflow-y-auto bg-black/75 p-3" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false) }}><section role="dialog" aria-modal="true" aria-labelledby="service-form-title" className="my-5 w-full max-w-3xl rounded-2xl border border-line bg-[#111] p-5 sm:p-7"><div className="mb-5 flex items-start justify-between"><div><p className="eyebrow text-gold">PRECIFICAÇÃO DE SERVIÇO</p><h3 id="service-form-title" className="mt-1 text-lg font-semibold">{editing ? 'Editar serviço' : 'Novo serviço'}</h3></div><button aria-label="Fechar" className="rounded p-2 text-muted hover:text-paper" onClick={() => setOpen(false)}>×</button></div><form onSubmit={submit} className="space-y-4"><label className="block"><span className={fieldLabel}>Nome do serviço</span><input className="field" maxLength={160} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label><div className="grid gap-4 sm:grid-cols-2"><Field label="Tempo de execução (horas)" type="number" value={form.hours} onChange={value => setForm({ ...form, hours: value })}/><Field label="Custo-hora de mão de obra (R$)" type="currency" value={form.hourly} onChange={value => setForm({ ...form, hourly: value })}/><Field label="Materiais e insumos (R$)" type="currency" value={form.materials} onChange={value => setForm({ ...form, materials: value })}/><Field label="Outros custos (R$)" type="currency" value={form.other} onChange={value => setForm({ ...form, other: value })}/><label className="flex items-center gap-2 text-xs text-muted sm:col-span-2"><input type="checkbox" checked={form.includeFixed} onChange={e => setForm({ ...form, includeFixed: e.target.checked })} className="accent-[#D4AF37]"/>Incluir custo fixo por hora produtiva nesta precificação</label>{form.includeFixed && <Field label="Custo fixo por hora (R$)" type="currency" value={form.fixedHourly} onChange={value => setForm({ ...form, fixedHourly: value })}/>}<Field label="Taxas e despesas variáveis (%)" type="number" value={form.fees} onChange={value => setForm({ ...form, fees: value })}/><Field label="Impostos (%)" type="number" value={form.taxes} onChange={value => setForm({ ...form, taxes: value })}/><Field label="Preço atual (R$) · opcional" type="currency" value={form.price} onChange={value => setForm({ ...form, price: value })}/><Field label="Margem desejada (%) · opcional" type="number" value={form.desired} onChange={value => setForm({ ...form, desired: value })}/></div>{error && <InlineNotice>{error}</InlineNotice>}<div className="flex justify-end gap-2 border-t border-line pt-4"><button className="btn-secondary" type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="btn-primary" disabled={busy}>{busy ? <LoaderCircle size={14} className="animate-spin"/> : <Plus size={14}/>}Salvar serviço</button></div></form></section></div>}
  </div>
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label><span className={fieldLabel}>{label}</span>{type === 'currency' ? <CurrencyInput className="field" value={value} onChange={onChange}/> : <input className="field" type={type} inputMode={type === 'text' ? 'decimal' : undefined} min={type === 'number' ? 0 : undefined} max={type === 'number' ? 100 : undefined} step={type === 'number' ? '0.01' : undefined} value={value} onChange={e => onChange(e.target.value)}/>}</label> }
