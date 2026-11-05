import { useMemo, useState, type FormEvent } from 'react'
import { Calculator, LoaderCircle, Package, Wrench } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { InlineNotice } from '../components/Feedback'
import { CurrencyInput } from '../components/CurrencyInput'
import { calculateProductPricing, calculateServiceCost } from '../finance/pricing'
import { formatBRLFromCents, formatMarkup, formatPercent, parseBrazilianCurrency } from '../lib/money'
import { saveProduct, saveService } from '../services/companyData'
import { supabase } from '../lib/supabase'

const initial = { name: '', cost: '', other: '', fees: '0', taxes: '0', price: '', desired: '', hours: '1', hourly: '', materials: '', includeFixed: false, fixedHourly: '' }
const labelClass = 'mb-2 block text-xs font-medium text-[#c7c7c7]'

export default function CalculationPage() {
  const { currentCompany } = useAuth()
  const [kind, setKind] = useState<'product' | 'service'>('product')
  const [form, setForm] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const calculated = useMemo(() => {
    const money = (value: string) => value.trim() ? parseBrazilianCurrency(value) : 0
    const asRate = (value: string) => Number(value.replace(',', '.'))
    try {
      if (kind === 'product') {
        const result = calculateProductPricing({ acquisitionCostCents: money(form.cost) ?? 0, otherCostCents: money(form.other) ?? 0, variableFeesPercent: asRate(form.fees), taxPercent: asRate(form.taxes), desiredMarginPercent: form.desired.trim() ? asRate(form.desired) : undefined, sellingPriceCents: form.price.trim() ? money(form.price) ?? undefined : undefined })
        return { cost: result.totalCostCents, result, serviceTotal: null as number | null, error: null }
      }
      const serviceTotal = calculateServiceCost({ hours: Number(form.hours), hourlyLaborCostCents: money(form.hourly) ?? 0, materialsCents: money(form.materials) ?? 0, otherCostCents: money(form.other) ?? 0, fixedCostPerHourCents: money(form.fixedHourly) ?? 0, includeFixedCostPerHour: form.includeFixed })
      const result = calculateProductPricing({ acquisitionCostCents: serviceTotal, variableFeesPercent: asRate(form.fees), taxPercent: asRate(form.taxes), desiredMarginPercent: form.desired.trim() ? asRate(form.desired) : undefined, sellingPriceCents: form.price.trim() ? money(form.price) ?? undefined : undefined })
      return { cost: serviceTotal, result, serviceTotal, error: null }
    } catch (cause) {
      return { cost: null, result: null, serviceTotal: null, error: cause instanceof Error ? cause.message : 'Revise os valores informados.' }
    }
  }, [kind, form])

  async function save(event: FormEvent) {
    event.preventDefault()
    setError(null); setNotice(null)
    if (!currentCompany || !supabase) { setError('Configure o projeto Supabase e uma empresa antes de salvar.'); return }
    if (!form.name.trim()) { setError(kind === 'product' ? 'Informe o nome do produto.' : 'Informe o nome do serviço.'); return }
    if (calculated.error || calculated.cost === null || !calculated.result) { setError(calculated.error ?? 'Complete os dados necessários.'); return }
    const currency = (value: string) => value.trim() ? parseBrazilianCurrency(value) : null
    const desired = form.desired.trim() ? Number(form.desired.replace(',', '.')) : null
    const price = currency(form.price)
    const fees = Number(form.fees.replace(',', '.'))
    const taxes = Number(form.taxes.replace(',', '.'))
    if (kind === 'product' && currency(form.cost) === null) { setError('Informe o custo de aquisição ou produção.'); return }
    setSaving(true)
    try {
      if (kind === 'product') {
        await saveProduct(currentCompany.id, { name: form.name.trim(), acquisition_cost_cents: currency(form.cost) ?? 0, other_cost_cents: currency(form.other) ?? 0, variable_fees_percent: fees, tax_percent: taxes, desired_margin_percent: desired, current_price_cents: price, notes: null })
      } else {
        await saveService(currentCompany.id, { name: form.name.trim(), hours: Number(form.hours), hourly_labor_cost_cents: currency(form.hourly) ?? 0, materials_cents: currency(form.materials) ?? 0, other_cost_cents: currency(form.other) ?? 0, fixed_cost_per_hour_cents: currency(form.fixedHourly) ?? 0, include_fixed_cost_per_hour: form.includeFixed, variable_fees_percent: fees, tax_percent: taxes, desired_margin_percent: desired, current_price_cents: price })
      }
      setNotice(kind === 'product' ? 'Produto salvo no banco da empresa.' : 'Serviço salvo no banco da empresa.')
      setForm(initial)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar no Supabase.') }
    finally { setSaving(false) }
  }

  const current = calculated.result
  return <div className="space-y-6">
    <div><p className="eyebrow text-gold">SIMULADOR DE PREÇOS</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Descubra o que sobra por unidade.</h2><p className="mt-2 text-sm text-muted">Os resultados mudam com os dados informados. Nada é salvo até você confirmar.</p></div>
    <div className="inline-flex rounded-xl border border-line bg-[#101010] p-1"><button className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium transition ${kind === 'product' ? 'bg-gold text-ink' : 'text-muted hover:text-paper'}`} onClick={() => { setKind('product'); setError(null) }}><Package size={15}/>Produto</button><button className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium transition ${kind === 'service' ? 'bg-gold text-ink' : 'text-muted hover:text-paper'}`} onClick={() => { setKind('service'); setError(null) }}><Wrench size={15}/>Serviço</button></div>
    {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
    <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
      <form onSubmit={save} className="surface space-y-5 p-5 sm:p-7">
        <div className="flex items-center gap-2"><Calculator size={17} className="text-gold"/><h3 className="text-sm font-semibold">Dados da precificação</h3></div>
        <label className="block"><span className={labelClass}>{kind === 'product' ? 'Nome do produto' : 'Nome do serviço'}</span><input className="field" required maxLength={160} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={kind === 'product' ? 'Ex.: Caixa presenteável' : 'Ex.: Consultoria por hora'}/></label>
        {kind === 'product' ? <div className="grid gap-4 sm:grid-cols-2"><label><span className={labelClass}>Custo de aquisição/produção (R$)</span><CurrencyInput className="field" required value={form.cost} onChange={value => setForm({ ...form, cost: value })} placeholder="0,00"/></label><label><span className={labelClass}>Outros custos unitários (R$)</span><CurrencyInput className="field" value={form.other} onChange={value => setForm({ ...form, other: value })} placeholder="0,00"/></label></div> : <div className="grid gap-4 sm:grid-cols-2"><label><span className={labelClass}>Tempo de execução (horas)</span><input className="field" type="number" min="0.01" step="0.01" required value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })}/></label><label><span className={labelClass}>Custo-hora de mão de obra (R$)</span><CurrencyInput className="field" required value={form.hourly} onChange={value => setForm({ ...form, hourly: value })} placeholder="0,00"/></label><label><span className={labelClass}>Materiais e insumos (R$)</span><CurrencyInput className="field" value={form.materials} onChange={value => setForm({ ...form, materials: value })} placeholder="0,00"/></label><label><span className={labelClass}>Outros custos (R$)</span><CurrencyInput className="field" value={form.other} onChange={value => setForm({ ...form, other: value })} placeholder="0,00"/></label><label className="sm:col-span-2"><span className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={form.includeFixed} onChange={e => setForm({ ...form, includeFixed: e.target.checked })} className="accent-[#D4AF37]"/>Incluir custo fixo por hora produtiva (seleção explícita)</span></label>{form.includeFixed && <label className="sm:col-span-2"><span className={labelClass}>Custo fixo por hora produtiva de Lançamentos (R$)</span><CurrencyInput className="field" value={form.fixedHourly} onChange={value => setForm({ ...form, fixedHourly: value })} placeholder="Informe o custo fixo/hora calculado em Lançamentos"/></label>}</div>}
        <div className="grid gap-4 sm:grid-cols-2"><label><span className={labelClass}>Taxas/despesas variáveis (%)</span><input className="field" type="number" min="0" max="100" step="0.01" value={form.fees} onChange={e => setForm({ ...form, fees: e.target.value })}/></label><label><span className={labelClass}>Impostos sobre venda (%)</span><input className="field" type="number" min="0" max="100" step="0.01" value={form.taxes} onChange={e => setForm({ ...form, taxes: e.target.value })}/></label><label><span className={labelClass}>Preço atual (R$) · opcional</span><CurrencyInput className="field" value={form.price} onChange={value => setForm({ ...form, price: value })} placeholder="0,00"/></label><label><span className={labelClass}>Margem desejada (%) · opcional</span><input className="field" type="number" min="0" max="100" step="0.01" value={form.desired} onChange={e => setForm({ ...form, desired: e.target.value })} placeholder="Ex.: 20"/></label></div>
        {error && <InlineNotice>{error}</InlineNotice>}{calculated.error && <InlineNotice>{calculated.error}</InlineNotice>}
        <button className="btn-primary w-full" disabled={saving || !supabase}>{saving ? <LoaderCircle className="animate-spin" size={15}/> : <Calculator size={15}/>}SALVAR {kind === 'product' ? 'PRODUTO' : 'SERVIÇO'}</button>
        {!supabase && <p className="text-xs text-attention">O salvamento real exige configuração do Supabase.</p>}
      </form>

      <section className="surface h-fit p-5 sm:p-7"><div><p className="eyebrow text-gold">RESULTADOS AUTOMÁTICOS</p><h3 className="mt-2 text-lg font-semibold">Resumo da precificação</h3><p className="mt-1 text-xs text-muted">Contribuição estimada não é lucro líquido.</p></div>
        <div className="mt-6 grid grid-cols-2 gap-3"><Result title="Custo total" value={formatBRLFromCents(calculated.cost)}/><Result title="Preço atual" value={formatBRLFromCents(current?.contributionCents === null ? parseBrazilianCurrency(form.price) : parseBrazilianCurrency(form.price))}/><Result title="Preço mínimo" value={formatBRLFromCents(current?.minimumPriceCents ?? null)}/><Result title="Preço recomendado" value={formatBRLFromCents(current?.recommendedPriceCents ?? null)} gold/><Result title="Resultado / unidade" value={formatBRLFromCents(current?.contributionCents ?? null)}/><Result title="Margem atual" value={formatPercent(current?.contributionMarginPercent ?? null)}/><Result title="Margem desejada" value={form.desired.trim() ? formatPercent(Number(form.desired.replace(',', '.'))) : '—'}/><Result title="Markup" value={formatMarkup(current?.markup ?? null)}/></div>
        <div className="mt-5 rounded-xl border border-line bg-[#0b0b0b] p-4"><div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted">Comparativo de preço</span><span className="text-[10px] text-gold">simulação</span></div><div className="mt-4 grid grid-cols-2 gap-3"><div><p className="text-[10px] text-muted">Atual</p><p className="mt-1 font-mono text-sm">{formatBRLFromCents(parseBrazilianCurrency(form.price))}</p></div><div><p className="text-[10px] text-muted">Recomendado</p><p className="mt-1 font-mono text-sm text-gold">{formatBRLFromCents(current?.recommendedPriceCents ?? null)}</p></div></div><div className="mt-3 flex justify-between border-t border-line pt-3 text-xs"><span className="text-muted">Diferença estimada</span><span className="font-mono text-paper">{formatBRLFromCents(current?.priceDeltaCents ?? null)}</span></div></div>
        <p className="mt-4 text-[10px] leading-5 text-muted">Preço mínimo cobre custo e taxas informados. O recomendado depende da margem desejada; os valores são arredondados apenas na apresentação.</p>
      </section>
    </div>
  </div>
}

function Result({ title, value, gold = false }: { title: string; value: string; gold?: boolean }) {
  return <div className="rounded-xl border border-line bg-[#0d0d0d] p-3.5"><p className="text-[10px] text-muted">{title}</p><p className={`mt-2 font-mono text-base font-semibold tabular-nums ${gold ? 'text-gold' : 'text-paper'}`}>{value}</p></div>
}
