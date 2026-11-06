import { useMemo, useState, type FormEvent } from 'react'
import { Calculator, LoaderCircle, Package, Percent, Plus, DollarSign, Wrench, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { InlineNotice } from '../components/Feedback'
import { CurrencyInput } from '../components/CurrencyInput'
import { calculateProductPricing, calculateServiceCost } from '../finance/pricing'
import { formatBRLFromCents, formatMarkup, formatPercent, parseBrazilianCurrency } from '../lib/money'
import { saveProduct, saveService } from '../services/companyData'
import { supabase } from '../lib/supabase'

export const TAG_COLORS = ['#D4AF37', '#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#06b6d4', '#ec4899']
export const COST_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#D4AF37', '#06b6d4', '#ec4899', '#ef4444']
const initial = { name: '', cost: '', price: '', desired: '', hours: '1', hourly: '', materials: '', includeFixed: false, fixedHourly: '' }
const labelClass = 'mb-2 block text-xs font-medium text-paper'

export type FeeTag = { id: string; label: string; percent: string }
export type CostTag = { id: string; label: string; value: string }

// ── Fee Tag Widget ─────────────────────────────────────────────
export function FeeTagWidget({ feeTags, setFeeTags }: { feeTags: FeeTag[]; setFeeTags: (fn: (prev: FeeTag[]) => FeeTag[]) => void }) {
  const [showInput, setShowInput] = useState(false)
  const [input, setInput] = useState({ label: '', percent: '' })
  const total = feeTags.reduce((s, t) => s + Number(t.percent || 0), 0)

  function add() {
    const pct = input.percent.replace(',', '.')
    if (input.label.trim() && Number(pct) > 0) {
      setFeeTags(prev => [...prev, { id: crypto.randomUUID(), label: input.label.trim(), percent: pct }])
      setInput({ label: '', percent: '' }); setShowInput(false)
    }
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4 space-y-3 h-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-paper">Taxas e encargos</p>
          <p className="mt-0.5 text-[10px] text-muted">Cartão, imposto, comissão, marketplace…</p>
        </div>
        {feeTags.length > 0 && (
          <div className="text-right shrink-0 ml-2">
            <p className="text-[10px] text-muted">Total</p>
            <p className="font-mono text-sm font-bold text-gold">{total.toFixed(2)}%</p>
          </div>
        )}
      </div>

      {feeTags.length > 0 && (
        <div className="space-y-1.5">
          {feeTags.map((tag, i) => (
            <div key={tag.id} className="group flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2 hover:border-teal-border transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="size-2 rounded-full shrink-0" style={{ background: TAG_COLORS[i % TAG_COLORS.length] }}/>
                <span className="text-xs text-paper truncate">{tag.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="font-mono text-xs font-bold" style={{ color: TAG_COLORS[i % TAG_COLORS.length] }}>{tag.percent}%</span>
                <button type="button"
                  className="size-4 rounded-full flex items-center justify-center text-muted hover:bg-red-500/15 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={() => setFeeTags(prev => prev.filter(t => t.id !== tag.id))}>
                  <X size={10}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showInput ? (
        <div className="flex items-center gap-2 rounded-lg border border-gold/50 bg-panel px-3 py-2.5">
          <Percent size={12} className="text-gold shrink-0"/>
          <input autoFocus className="bg-transparent text-xs outline-none flex-1 placeholder:text-muted" placeholder="Ex.: Cartão de crédito" value={input.label} onChange={e => setInput(f => ({ ...f, label: e.target.value }))} onKeyDown={e => e.key === 'Escape' && (setShowInput(false), setInput({ label: '', percent: '' }))}/>
          <input className="bg-transparent text-xs outline-none w-12 font-mono text-center placeholder:text-muted" placeholder="%" type="number" min="0" max="100" step="any" value={input.percent} onChange={e => setInput(f => ({ ...f, percent: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } if (e.key === 'Escape') { setShowInput(false); setInput({ label: '', percent: '' }) } }}/>
          <span className="text-[10px] text-muted">%</span>
          <button type="button" className="rounded-md bg-gold px-2 py-1 text-[10px] font-semibold text-ink hover:bg-[#ead584]" onClick={add}>OK</button>
          <button type="button" className="text-muted hover:text-paper" onClick={() => { setShowInput(false); setInput({ label: '', percent: '' }) }}><X size={12}/></button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowInput(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2 text-[11px] text-muted hover:border-gold/60 hover:text-gold transition-colors">
          <Plus size={11}/> Adicionar taxa
        </button>
      )}
      {feeTags.length === 0 && !showInput && <p className="text-center text-[10px] text-muted">Nenhuma taxa cadastrada</p>}
    </div>
  )
}

// ── Cost Tag Widget ────────────────────────────────────────────
export function CostTagWidget({ costTags, setCostTags, title = 'Custos adicionais' }: { costTags: CostTag[]; setCostTags: (fn: (prev: CostTag[]) => CostTag[]) => void; title?: string }) {
  const [showInput, setShowInput] = useState(false)
  const [input, setInput] = useState({ label: '', value: '' })
  const total = costTags.reduce((s, t) => s + (parseBrazilianCurrency(t.value) ?? 0), 0)

  function add() {
    const val = parseBrazilianCurrency(input.value)
    if (input.label.trim() && val !== null && val > 0) {
      setCostTags(prev => [...prev, { id: crypto.randomUUID(), label: input.label.trim(), value: input.value }])
      setInput({ label: '', value: '' }); setShowInput(false)
    }
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4 space-y-3 h-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-paper">{title}</p>
          <p className="mt-0.5 text-[10px] text-muted">Embalagem, frete, comissão fixa…</p>
        </div>
        {costTags.length > 0 && (
          <div className="text-right shrink-0 ml-2">
            <p className="text-[10px] text-muted">Total</p>
            <p className="font-mono text-sm font-bold text-emerald-400">{formatBRLFromCents(total)}</p>
          </div>
        )}
      </div>

      {costTags.length > 0 && (
        <div className="space-y-1.5">
          {costTags.map((tag, i) => (
            <div key={tag.id} className="group flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2 hover:border-teal-border transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="size-2 rounded-full shrink-0" style={{ background: COST_COLORS[i % COST_COLORS.length] }}/>
                <span className="text-xs text-paper truncate">{tag.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="font-mono text-xs font-bold" style={{ color: COST_COLORS[i % COST_COLORS.length] }}>{formatBRLFromCents(parseBrazilianCurrency(tag.value))}</span>
                <button type="button"
                  className="size-4 rounded-full flex items-center justify-center text-muted hover:bg-red-500/15 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={() => setCostTags(prev => prev.filter(t => t.id !== tag.id))}>
                  <X size={10}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showInput ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-panel px-3 py-2.5">
          <DollarSign size={12} className="text-emerald-400 shrink-0"/>
          <input autoFocus className="bg-transparent text-xs outline-none flex-1 placeholder:text-muted" placeholder="Ex.: Embalagem" value={input.label} onChange={e => setInput(f => ({ ...f, label: e.target.value }))} onKeyDown={e => e.key === 'Escape' && (setShowInput(false), setInput({ label: '', value: '' }))}/>
          <CurrencyInput className="bg-transparent text-xs outline-none w-20 font-mono text-right border-0 !ring-0 !p-0" value={input.value} onChange={v => setInput(f => ({ ...f, value: v }))} placeholder="R$" onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); add() } if (e.key === 'Escape') { setShowInput(false); setInput({ label: '', value: '' }) } }}/>
          <button type="button" className="rounded-md bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-400" onClick={add}>OK</button>
          <button type="button" className="text-muted hover:text-paper" onClick={() => { setShowInput(false); setInput({ label: '', value: '' }) }}><X size={12}/></button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowInput(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2 text-[11px] text-muted hover:border-emerald-500/50 hover:text-emerald-400 transition-colors">
          <Plus size={11}/> Adicionar custo
        </button>
      )}
      {costTags.length === 0 && !showInput && <p className="text-center text-[10px] text-muted">Nenhum custo adicional</p>}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function CalculationPage() {
  const { currentCompany } = useAuth()
  const [kind, setKind] = useState<'product' | 'service'>('product')
  const [form, setForm] = useState(initial)
  const [feeTags, setFeeTags] = useState<FeeTag[]>([])
  const [costTags, setCostTags] = useState<CostTag[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const totalFeesPercent = feeTags.reduce((s, t) => s + Number(t.percent || 0), 0)
  const totalExtraCostsCents = costTags.reduce((s, t) => s + (parseBrazilianCurrency(t.value) ?? 0), 0)

  const calculated = useMemo(() => {
    const money = (value: string) => value.trim() ? parseBrazilianCurrency(value) : 0
    try {
      if (kind === 'product') {
        const result = calculateProductPricing({
          acquisitionCostCents: money(form.cost) ?? 0,
          otherCostCents: totalExtraCostsCents,
          variableFeesPercent: totalFeesPercent,
          taxPercent: 0,
          desiredMarginPercent: form.desired.trim() ? Number(form.desired.replace(',', '.')) : undefined,
          sellingPriceCents: form.price.trim() ? money(form.price) ?? undefined : undefined,
        })
        return { cost: result.totalCostCents, result, serviceTotal: null as number | null, error: null }
      }
      const serviceTotal = calculateServiceCost({
        hours: Number(form.hours),
        hourlyLaborCostCents: money(form.hourly) ?? 0,
        materialsCents: money(form.materials) ?? 0,
        otherCostCents: totalExtraCostsCents,
        fixedCostPerHourCents: money(form.fixedHourly) ?? 0,
        includeFixedCostPerHour: form.includeFixed,
      })
      const result = calculateProductPricing({
        acquisitionCostCents: serviceTotal,
        variableFeesPercent: totalFeesPercent,
        taxPercent: 0,
        desiredMarginPercent: form.desired.trim() ? Number(form.desired.replace(',', '.')) : undefined,
        sellingPriceCents: form.price.trim() ? money(form.price) ?? undefined : undefined,
      })
      return { cost: serviceTotal, result, serviceTotal, error: null }
    } catch (cause) {
      return { cost: null, result: null, serviceTotal: null, error: cause instanceof Error ? cause.message : 'Revise os valores informados.' }
    }
  }, [kind, form, totalFeesPercent, totalExtraCostsCents])

  async function save(event: FormEvent) {
    event.preventDefault()
    setError(null); setNotice(null)
    if (!currentCompany || !supabase) { setError('Configure o projeto Supabase e uma empresa antes de salvar.'); return }
    if (!form.name.trim()) { setError(kind === 'product' ? 'Informe o nome do produto.' : 'Informe o nome do serviço.'); return }
    if (calculated.error || calculated.cost === null || !calculated.result) { setError(calculated.error ?? 'Complete os dados necessários.'); return }
    const currency = (value: string) => value.trim() ? parseBrazilianCurrency(value) : null
    const desired = form.desired.trim() ? Number(form.desired.replace(',', '.')) : null
    const price = currency(form.price)
    if (kind === 'product' && currency(form.cost) === null) { setError('Informe o custo de aquisição ou produção.'); return }
    setSaving(true)
    try {
      if (kind === 'product') {
        await saveProduct(currentCompany.id, { name: form.name.trim(), acquisition_cost_cents: currency(form.cost) ?? 0, other_cost_cents: totalExtraCostsCents, variable_fees_percent: totalFeesPercent, tax_percent: 0, desired_margin_percent: desired, current_price_cents: price, notes: null })
      } else {
        await saveService(currentCompany.id, { name: form.name.trim(), hours: Number(form.hours), hourly_labor_cost_cents: currency(form.hourly) ?? 0, materials_cents: currency(form.materials) ?? 0, other_cost_cents: totalExtraCostsCents, fixed_cost_per_hour_cents: currency(form.fixedHourly) ?? 0, include_fixed_cost_per_hour: form.includeFixed, variable_fees_percent: totalFeesPercent, tax_percent: 0, desired_margin_percent: desired, current_price_cents: price })
      }
      setNotice(kind === 'product' ? 'Produto salvo.' : 'Serviço salvo.')
      setForm(initial); setFeeTags([]); setCostTags([])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar no Supabase.') }
    finally { setSaving(false) }
  }

  const current = calculated.result
  return <div className="space-y-6">
    <div><p className="eyebrow text-gold">SIMULADOR DE PREÇOS</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Descubra o que sobra por unidade.</h2><p className="mt-2 text-sm text-muted">Os resultados mudam com os dados informados. Nada é salvo até você confirmar.</p></div>
    <div className="inline-flex rounded-xl border border-line bg-panel p-1">
      <button className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium transition ${kind === 'product' ? 'bg-gold text-ink' : 'text-muted hover:text-paper'}`} onClick={() => { setKind('product'); setError(null) }}><Package size={15}/>Produto</button>
      <button className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium transition ${kind === 'service' ? 'bg-gold text-ink' : 'text-muted hover:text-paper'}`} onClick={() => { setKind('service'); setError(null) }}><Wrench size={15}/>Serviço</button>
    </div>
    {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
    <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
      <form onSubmit={save} className="surface space-y-5 p-5 sm:p-7">
        <div className="flex items-center gap-2"><Calculator size={17} className="text-gold"/><h3 className="text-sm font-semibold">Dados da precificação</h3></div>

        <label className="block"><span className={labelClass}>{kind === 'product' ? 'Nome do produto' : 'Nome do serviço'}</span>
          <input className="field" required maxLength={160} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={kind === 'product' ? 'Ex.: Caixa presenteável' : 'Ex.: Consultoria por hora'}/>
        </label>

        {/* Custo base — FIXO, sempre visível */}
        {kind === 'product' ? (
          <label className="block">
            <span className={labelClass}>Custo de aquisição/produção (R$) <span className="text-gold font-bold">*</span></span>
            <CurrencyInput className="field" required value={form.cost} onChange={value => setForm({ ...form, cost: value })} placeholder="0,00"/>
          </label>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={labelClass}>Tempo de execução (horas)</span><input className="field" type="number" min="0.01" step="0.01" required value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })}/></label>
            <label><span className={labelClass}>Custo-hora de mão de obra (R$) <span className="text-gold font-bold">*</span></span><CurrencyInput className="field" required value={form.hourly} onChange={value => setForm({ ...form, hourly: value })} placeholder="0,00"/></label>
            <label><span className={labelClass}>Materiais e insumos (R$)</span><CurrencyInput className="field" value={form.materials} onChange={value => setForm({ ...form, materials: value })} placeholder="0,00"/></label>
            <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2 mt-1"><input type="checkbox" checked={form.includeFixed} onChange={e => setForm({ ...form, includeFixed: e.target.checked })} className="accent-[#D4AF37]"/>Incluir custo fixo por hora produtiva</label>
            {form.includeFixed && <label className="sm:col-span-2"><span className={labelClass}>Custo fixo por hora (R$)</span><CurrencyInput className="field" value={form.fixedHourly} onChange={value => setForm({ ...form, fixedHourly: value })} placeholder="Custo fixo/hora de Lançamentos"/></label>}
          </div>
        )}

        {/* Dois widgets lado a lado: custos adicionais + taxas */}
        <div className="grid gap-4 sm:grid-cols-2">
          <CostTagWidget costTags={costTags} setCostTags={setCostTags} title={kind === 'product' ? 'Custos adicionais' : 'Outros custos'}/>
          <FeeTagWidget feeTags={feeTags} setFeeTags={setFeeTags}/>
        </div>

        {/* Preço e margem */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={labelClass}>Preço atual (R$) · opcional</span><CurrencyInput className="field" value={form.price} onChange={value => setForm({ ...form, price: value })} placeholder="0,00"/></label>
          <label><span className={labelClass}>Margem desejada (%) · opcional</span><input className="field" type="number" min="0" max="100" step="0.01" value={form.desired} onChange={e => setForm({ ...form, desired: e.target.value })} placeholder="Ex.: 20"/></label>
        </div>

        {error && <InlineNotice>{error}</InlineNotice>}
        {calculated.error && <InlineNotice>{calculated.error}</InlineNotice>}
        <button className="btn-primary w-full" disabled={saving || !supabase}>
          {saving ? <LoaderCircle className="animate-spin" size={15}/> : <Calculator size={15}/>}
          SALVAR {kind === 'product' ? 'PRODUTO' : 'SERVIÇO'}
        </button>
        {!supabase && <p className="text-xs text-attention">O salvamento real exige configuração do Supabase.</p>}
      </form>

      <section className="surface h-fit p-5 sm:p-7">
        <div><p className="eyebrow text-gold">RESULTADOS AUTOMÁTICOS</p><h3 className="mt-2 text-xl font-bold">Resumo da precificação</h3><p className="mt-1 text-xs text-muted">Contribuição estimada não é lucro líquido.</p></div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Result title="Custo total" value={formatBRLFromCents(calculated.cost)}/>
          <Result title="Preço atual" value={formatBRLFromCents(form.price.trim() ? parseBrazilianCurrency(form.price) : null)}/>
          <Result title="Preço mínimo" value={formatBRLFromCents(current?.minimumPriceCents ?? null)}/>
          <Result title="Preço recomendado" value={formatBRLFromCents(current?.recommendedPriceCents ?? null)} gold/>
          <Result title="Resultado / unidade" value={formatBRLFromCents(current?.contributionCents ?? null)}/>
          <Result title="Margem atual" value={formatPercent(current?.contributionMarginPercent ?? null)}/>
          <Result title="Margem desejada" value={form.desired.trim() ? formatPercent(Number(form.desired.replace(',', '.'))) : '—'}/>
          <Result title="Markup" value={formatMarkup(current?.markup ?? null)}/>
        </div>

        {/* Breakdown de custos e taxas */}
        {(costTags.length > 0 || feeTags.length > 0) && (
          <div className="mt-4 space-y-2">
            {costTags.length > 0 && (
              <div className="rounded-xl border border-line bg-panel p-3 space-y-1.5">
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wide">Custos adicionais</p>
                {costTags.map((t, i) => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted"><span className="size-1.5 rounded-full" style={{ background: COST_COLORS[i % COST_COLORS.length] }}/>{t.label}</span>
                    <span className="font-mono font-semibold" style={{ color: COST_COLORS[i % COST_COLORS.length] }}>{formatBRLFromCents(parseBrazilianCurrency(t.value))}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-line pt-1.5 text-xs">
                  <span className="text-muted">Total de custos extras</span>
                  <span className="font-mono font-bold text-emerald-400">{formatBRLFromCents(totalExtraCostsCents)}</span>
                </div>
              </div>
            )}
            {feeTags.length > 0 && (
              <div className="rounded-xl border border-line bg-panel p-3 space-y-1.5">
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wide">Encargos aplicados</p>
                {feeTags.map((t, i) => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted"><span className="size-1.5 rounded-full" style={{ background: TAG_COLORS[i % TAG_COLORS.length] }}/>{t.label}</span>
                    <span className="font-mono font-semibold" style={{ color: TAG_COLORS[i % TAG_COLORS.length] }}>{t.percent}%</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-line pt-1.5 text-xs">
                  <span className="text-muted">Total de encargos</span>
                  <span className="font-mono font-bold text-gold">{totalFeesPercent.toFixed(2)}%</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-line bg-panel p-4">
          <div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted">Comparativo de preço</span><span className="text-[10px] text-gold">simulação</span></div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div><p className="text-[10px] text-muted">Atual</p><p className="mt-1 font-mono text-sm">{formatBRLFromCents(parseBrazilianCurrency(form.price))}</p></div>
            <div><p className="text-[10px] text-muted">Recomendado</p><p className="mt-1 font-mono text-sm text-gold">{formatBRLFromCents(current?.recommendedPriceCents ?? null)}</p></div>
          </div>
          <div className="mt-3 flex justify-between border-t border-line pt-3 text-xs"><span className="text-muted">Diferença estimada</span><span className="font-mono text-paper">{formatBRLFromCents(current?.priceDeltaCents ?? null)}</span></div>
        </div>
        <p className="mt-4 text-[10px] leading-5 text-muted">Preço mínimo cobre custo e taxas informados. O recomendado depende da margem desejada.</p>
      </section>
    </div>
  </div>
}

function Result({ title, value, gold = false }: { title: string; value: string; gold?: boolean }) {
  return <div className="rounded-xl border border-line bg-panel p-3.5"><p className="text-[10px] text-muted">{title}</p><p className={`mt-2 font-mono text-base font-semibold tabular-nums ${gold ? 'text-gold' : 'text-paper'}`}>{value}</p></div>
}
