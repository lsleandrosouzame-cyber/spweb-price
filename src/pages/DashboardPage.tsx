import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleHelp, Package, Plus, ShieldAlert, Target, Wallet, Scale, ChartNoAxesCombined } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState, InlineNotice, LoadingScreen } from '../components/Feedback'
import { listExpenses, listProducts, listSalesRecords, listServices, readOperatingSettings } from '../services/companyData'
import type { FixedExpenseRecord, ProductRecord, SalesRecord, ServiceRecord } from '../types/database'
import { calculateBreakEven, type SalesMixLine } from '../finance/operations'
import { calculateProductPricing, calculateServiceCost } from '../finance/pricing'
import { formatBRLFromCents, formatMarkup, formatPercent } from '../lib/money'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip'

const COLORS = ['#D4AF37', '#88752b', '#565044', '#3a3a3a', '#272727']
const moneyTooltip = (value: number | null | undefined) => formatBRLFromCents(value)
const localDate = () => new Date().toLocaleDateString('sv-SE')

type PriceOpportunity = { id: string; name: string; kind: 'Produto' | 'Serviço'; current: number; margin: number | null; desired: number | null; recommended: number; delta: number; potential: number }
function buildOpportunity(input: { id: string; name: string; kind: 'Produto' | 'Serviço'; cost: number; fees: number; tax: number; current: number | null; desired: number | null }): PriceOpportunity | null {
  if (!input.current) return null
  const targetMargin = input.desired ?? 0
  const current = calculateProductPricing({ acquisitionCostCents: input.cost, variableFeesPercent: input.fees, taxPercent: input.tax, desiredMarginPercent: targetMargin, sellingPriceCents: input.current })
  const recommended = current.recommendedPriceCents
  if (!recommended || recommended <= input.current || current.contributionCents === null) return null
  const target = calculateProductPricing({ acquisitionCostCents: input.cost, variableFeesPercent: input.fees, taxPercent: input.tax, desiredMarginPercent: targetMargin, sellingPriceCents: recommended })
  if (target.contributionCents === null) return null
  return { id: input.id, name: input.name, kind: input.kind, current: input.current, margin: current.contributionMarginPercent, desired: input.desired, recommended, delta: recommended - input.current, potential: target.contributionCents - current.contributionCents }
}

function Metric({ title, value, detail, icon: Icon, accent = false }: { title: string; value: string; detail: string; icon: typeof Wallet; accent?: boolean }) {
  return <Tooltip><TooltipTrigger asChild><div tabIndex={0} className="surface group relative overflow-hidden p-5 transition hover:border-[#414141]"><div className="flex items-start justify-between"><div><p className="text-xs text-muted">{title}</p><p className={`mt-4 font-mono text-2xl font-semibold tracking-tight tabular-nums ${accent ? 'text-gold' : 'text-paper'}`}>{value}</p></div><span className={`grid size-9 place-items-center rounded-lg border ${accent ? 'border-gold/20 bg-gold/5 text-gold' : 'border-line bg-[#171717] text-muted'}`}><Icon size={17}/></span></div><p className="mt-3 text-[11px] leading-5 text-[#777]">{detail}</p></div></TooltipTrigger><TooltipContent side="top">{title}: {detail}</TooltipContent></Tooltip>
}

export default function DashboardPage() {
  const { currentCompany, configReady } = useAuth()
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [expenses, setExpenses] = useState<FixedExpenseRecord[]>([])
  const [sales, setSales] = useState<SalesRecord[]>([])
  const [revenueForecastCents, setRevenueForecastCents] = useState<number | null>(null)
  const [proLaboreCents, setProLaboreCents] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const monthKey = localDate().slice(0, 7)
  const month = useMemo(() => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date()), [])

  useEffect(() => {
    let active = true
    async function load() {
      if (!configReady || !currentCompany) { setLoading(false); return }
      setLoading(true); setError(null)
      const from = `${monthKey}-01`
      const [productResult, serviceResult, expenseResult, salesResult, settingsResult] = await Promise.allSettled([
        listProducts(currentCompany.id), listServices(currentCompany.id), listExpenses(currentCompany.id), listSalesRecords(currentCompany.id, from), readOperatingSettings(currentCompany.id),
      ])
      if (!active) return
      const failed = [productResult, serviceResult, expenseResult, salesResult].find(r => r.status === 'rejected')
      if (failed?.status === 'rejected') setError(String(failed.reason?.message ?? failed.reason))
      else if (productResult.status === 'fulfilled' && serviceResult.status === 'fulfilled' && expenseResult.status === 'fulfilled' && salesResult.status === 'fulfilled') {
        setProducts(productResult.value); setServices(serviceResult.value); setExpenses(expenseResult.value); setSales(salesResult.value)
      }
      if (settingsResult.status === 'fulfilled' && settingsResult.value) {
        setRevenueForecastCents(settingsResult.value.revenue_forecast_cents ?? null)
        setProLaboreCents(settingsResult.value.pro_labore_cents ?? null)
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [currentCompany?.id, configReady, monthKey])

  if (loading) return <LoadingScreen label="Atualizando os indicadores da empresa" />
  if (error) return <div className="space-y-4"><InlineNotice>{error}</InlineNotice><p className="text-xs text-muted">Nenhum valor fictício será exibido. Verifique a conexão e as policies do Supabase.</p></div>

  const monthExpenses = expenses.filter(row => row.reference_date.startsWith(monthKey))
  const monthSales = sales.filter(row => row.sold_on.startsWith(monthKey))
  const fixedTotal = monthExpenses.length ? monthExpenses.reduce((sum, row) => sum + Number(row.amount_cents), 0) : null
  const mix: SalesMixLine[] = monthSales.map(s => ({ sellingPriceCents: Number(s.selling_price_cents), contributionCents: Number(s.contribution_cents), quantity: Number(s.quantity) }))
  const breakEven = fixedTotal === null ? null : calculateBreakEven(fixedTotal, mix)
  const revenue = monthSales.length ? monthSales.reduce((sum, row) => sum + Number(row.selling_price_cents) * Number(row.quantity), 0) : null
  const productMargins = products.flatMap(product => {
    if (!product.current_price_cents) return []
    const result = calculateProductPricing({ acquisitionCostCents: Number(product.acquisition_cost_cents), otherCostCents: Number(product.other_cost_cents), variableFeesPercent: Number(product.variable_fees_percent), taxPercent: Number(product.tax_percent), desiredMarginPercent: product.desired_margin_percent === null ? undefined : Number(product.desired_margin_percent), sellingPriceCents: Number(product.current_price_cents) })
    return result.contributionMarginPercent === null ? [] : [{ margin: result.contributionMarginPercent, desired: product.desired_margin_percent === null ? 0 : Number(product.desired_margin_percent) }]
  })
  const healthy = productMargins.filter(item => item.margin >= item.desired && item.margin >= 0).length
  const lowOrNegative = productMargins.length - healthy
  const productOpportunities = products.flatMap(product => {
    try {
      const item = buildOpportunity({ id: product.id, name: product.name, kind: 'Produto', cost: Number(product.acquisition_cost_cents) + Number(product.other_cost_cents), fees: Number(product.variable_fees_percent), tax: Number(product.tax_percent), current: product.current_price_cents === null ? null : Number(product.current_price_cents), desired: product.desired_margin_percent === null ? null : Number(product.desired_margin_percent) })
      return item ? [item] : []
    } catch { return [] }
  })
  const serviceOpportunities = services.flatMap(service => {
    try {
      const cost = calculateServiceCost({ hours: Number(service.hours), hourlyLaborCostCents: Number(service.hourly_labor_cost_cents), materialsCents: Number(service.materials_cents), otherCostCents: Number(service.other_cost_cents), fixedCostPerHourCents: Number(service.fixed_cost_per_hour_cents), includeFixedCostPerHour: service.include_fixed_cost_per_hour })
      const item = buildOpportunity({ id: service.id, name: service.name, kind: 'Serviço', cost, fees: Number(service.variable_fees_percent), tax: Number(service.tax_percent), current: service.current_price_cents === null ? null : Number(service.current_price_cents), desired: service.desired_margin_percent === null ? null : Number(service.desired_margin_percent) })
      return item ? [item] : []
    } catch { return [] }
  })
  const allOpportunities: PriceOpportunity[] = [...productOpportunities, ...serviceOpportunities].sort((a, b) => b.potential - a.potential)
  const opportunities = allOpportunities.slice(0, 4)
  const belowRecommendedSales = monthSales.filter(sale => {
    const product = sale.product_id ? products.find(item => item.id === sale.product_id) : null
    const service = sale.service_id ? services.find(item => item.id === sale.service_id) : null
    if (!product && !service) return false
    try {
      const cost = product
        ? Number(product.acquisition_cost_cents) + Number(product.other_cost_cents)
        : calculateServiceCost({ hours: Number(service!.hours), hourlyLaborCostCents: Number(service!.hourly_labor_cost_cents), materialsCents: Number(service!.materials_cents), otherCostCents: Number(service!.other_cost_cents), fixedCostPerHourCents: Number(service!.fixed_cost_per_hour_cents), includeFixedCostPerHour: service!.include_fixed_cost_per_hour })
      const item = product ?? service!
      const result = calculateProductPricing({ acquisitionCostCents: cost, variableFeesPercent: Number(item.variable_fees_percent), taxPercent: Number(item.tax_percent), desiredMarginPercent: item.desired_margin_percent === null ? undefined : Number(item.desired_margin_percent) })
      return Number(sale.selling_price_cents) < (result.recommendedPriceCents ?? result.minimumPriceCents)
    } catch { return false }
  }).length
  const serviceMargins = services.flatMap(service => {
    if (!service.current_price_cents) return []
    try {
      const cost = calculateServiceCost({ hours: Number(service.hours), hourlyLaborCostCents: Number(service.hourly_labor_cost_cents), materialsCents: Number(service.materials_cents), otherCostCents: Number(service.other_cost_cents), fixedCostPerHourCents: Number(service.fixed_cost_per_hour_cents), includeFixedCostPerHour: service.include_fixed_cost_per_hour })
      const result = calculateProductPricing({ acquisitionCostCents: cost, variableFeesPercent: Number(service.variable_fees_percent), taxPercent: Number(service.tax_percent), desiredMarginPercent: service.desired_margin_percent === null ? undefined : Number(service.desired_margin_percent), sellingPriceCents: Number(service.current_price_cents) })
      return result.contributionMarginPercent === null ? [] : [{ margin: result.contributionMarginPercent, desired: service.desired_margin_percent === null ? null : Number(service.desired_margin_percent) }]
    } catch { return [] }
  })
  const negativeMargins = [...productMargins, ...serviceMargins].filter(item => item.margin < 0).length
  const belowDesiredMargins = [...productMargins, ...serviceMargins].filter(item => item.margin >= 0 && item.desired !== null && item.margin < item.desired).length
  const alerts: Array<{ title: string; detail: string }> = []
  if (belowRecommendedSales) alerts.push({ title: 'Venda abaixo do recomendado', detail: `${belowRecommendedSales} registro(s) de venda abaixo do preço recomendado atual do item.` })
  if (negativeMargins) alerts.push({ title: 'Margem negativa', detail: `${negativeMargins} produto(s) ou serviço(s) com contribuição negativa no preço atual.` })
  if (belowDesiredMargins) alerts.push({ title: 'Margem abaixo da meta', detail: `${belowDesiredMargins} item(ns) abaixo da margem desejada cadastrada.` })
  if (fixedTotal !== null && revenue !== null && fixedTotal >= revenue) alerts.push({ title: 'Despesas fixas elevadas', detail: 'As despesas fixas de referência são iguais ou superiores ao faturamento registrado no período.' })
  if (breakEven && breakEven.remainingRevenueCents > 0) alerts.push({ title: 'Abaixo do ponto de equilíbrio', detail: `Faltam ${formatBRLFromCents(breakEven.remainingRevenueCents)} de faturamento de referência para cobrir as despesas fixas, conforme o mix registrado.` })
  if (allOpportunities.length) alerts.push({ title: 'Oportunidade de reajuste', detail: `${allOpportunities.length} produto(s)/serviço(s) com simulação de preço acima do atual.` })
  const distribution = Object.values(monthExpenses.reduce<Record<string, { name: string; value: number }>>((acc, item) => {
    const group = acc[item.category] ?? { name: item.category, value: 0 }; group.value += Number(item.amount_cents); acc[item.category] = group; return acc
  }, {})).sort((a, b) => b.value - a.value).slice(0, 5)
  const revenueWeightedMarkup = (() => {
    let numerator = 0; let denominator = 0
    for (const sale of monthSales) {
      const item = sale.product_id ? products.find(p => p.id === sale.product_id) : services.find(s => s.id === sale.service_id)
      if (!item) continue
      let cost: number
      if ('acquisition_cost_cents' in item) cost = Number(item.acquisition_cost_cents) + Number(item.other_cost_cents)
      else cost = calculateServiceCost({ hours: Number(item.hours), hourlyLaborCostCents: Number(item.hourly_labor_cost_cents), materialsCents: Number(item.materials_cents), otherCostCents: Number(item.other_cost_cents), fixedCostPerHourCents: Number(item.fixed_cost_per_hour_cents), includeFixedCostPerHour: item.include_fixed_cost_per_hour })
      if (cost <= 0) continue
      const rowRevenue = Number(sale.selling_price_cents) * Number(sale.quantity)
      numerator += Number(sale.selling_price_cents) / cost * rowRevenue; denominator += rowRevenue
    }
    return denominator > 0 ? numerator / denominator : null
  })()
  const statusText = monthSales.length ? `${monthSales.length} registro(s) de venda no mês` : 'Aguardando registros de vendas'

  return <div className="space-y-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow text-gold">VISÃO FINANCEIRA · {month.toUpperCase()}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Os números do seu negócio, sem adivinhação.</h2><p className="mt-2 text-sm text-muted">Indicadores vêm dos cadastros e vendas reais da sua empresa.</p></div><Link to="/calculo" className="btn-primary w-fit">Simular preço <ArrowRight size={15}/></Link></div>
    {products.length === 0 && monthExpenses.length === 0 && monthSales.length === 0 && <InlineNotice tone="info">Seu painel ainda não tem dados. Cadastre um produto, lance uma despesa e registre vendas para liberar indicadores reais.</InlineNotice>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric title="Faturamento de referência" value={moneyTooltip(revenue)} detail={statusText} icon={Wallet}/>
      <Metric title="Despesas fixas mensais" value={moneyTooltip(fixedTotal)} detail={monthExpenses.length ? `${monthExpenses.length} lançamento(s) neste período` : 'Cadastre despesas para acompanhar a operação'} icon={Scale}/>
      <Metric title="Margem de contribuição" value={formatPercent(breakEven?.weightedContributionMarginPercent)} detail={breakEven ? 'Ponderada pelo mix de vendas registrado' : 'Depende de vendas com mix informado'} icon={ChartNoAxesCombined} accent/>
      <Metric title="Ponto de equilíbrio" value={breakEven ? moneyTooltip(breakEven.breakEvenRevenueCents) : '—'} detail={breakEven ? 'Estimativa baseada nas despesas e no mix real' : 'Exige despesas e mix de vendas suficientes'} icon={Target}/>
      <Metric title="Markup de referência" value={formatMarkup(revenueWeightedMarkup)} detail={revenueWeightedMarkup === null ? 'Disponível quando preço e mix estiverem completos' : 'Ponderado pelo faturamento vendido no período'} icon={ArrowUpRight}/>
      <Metric title="Produtos cadastrados" value={String(products.length)} detail="Total de produtos desta empresa" icon={Package}/>
      <Metric title="Margem saudável" value={productMargins.length ? String(healthy) : '—'} detail={productMargins.length ? 'Preço atual comparado à margem desejada' : 'Ainda sem preços e margens completos'} icon={ArrowUpRight}/>
      <Metric title="Baixa ou negativa" value={productMargins.length ? String(lowOrNegative) : '—'} detail="Itens com margem abaixo da desejada ou negativa" icon={ArrowDownRight}/>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.45fr_.85fr]">
      <div className="surface overflow-hidden p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">PONTO DE EQUILÍBRIO</p><h3 className="mt-2 text-lg font-semibold">Quanto falta para cobrir a operação?</h3></div><span className="rounded-full border border-line px-3 py-1.5 text-[10px] text-muted">Sem estimativas inventadas</span></div>
        {breakEven ? <>
          <div className="mt-7 flex items-end justify-between gap-4">
            <div><p className="text-xs text-muted">Faturamento necessário</p><p className="mt-2 font-mono text-3xl font-semibold text-gold">{formatBRLFromCents(breakEven.breakEvenRevenueCents)}</p></div>
            <div className="text-right"><p className="text-xs text-muted">Faturamento de referência</p><p className="mt-2 font-mono text-xl font-medium tabular-nums">{formatBRLFromCents(breakEven.referenceRevenueCents)}</p></div>
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#262626]"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${breakEven.progressPercent}%` }}/></div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs"><span className="text-muted">{formatPercent(breakEven.progressPercent, 0)} do ponto de equilíbrio</span><span className="text-paper">Faltam <strong className="font-mono text-gold">{formatBRLFromCents(breakEven.remainingRevenueCents)}</strong></span></div>
          <div className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <div><span className="text-[11px] text-muted">Despesas fixas do período</span><p className="mt-1 font-mono text-sm">{formatBRLFromCents(fixedTotal)}</p></div>
            <div><span className="text-[11px] text-muted">Margem ponderada pelo mix</span><p className="mt-1 font-mono text-sm">{formatPercent(breakEven.weightedContributionMarginPercent)}</p></div>
            {revenueForecastCents !== null && <div><span className="text-[11px] text-muted">Previsão de faturamento</span><p className={`mt-1 font-mono text-sm ${revenueForecastCents >= breakEven.breakEvenRevenueCents ? 'text-positive' : 'text-negative'}`}>{formatBRLFromCents(revenueForecastCents)}</p></div>}
            {proLaboreCents !== null && <div><span className="text-[11px] text-muted">Pró-labore mensal</span><p className="mt-1 font-mono text-sm">{formatBRLFromCents(proLaboreCents)}</p></div>}
          </div>
          {revenueForecastCents !== null && <div className="mt-4 rounded-lg border border-line bg-[#0b0b0b] p-3 text-xs flex items-center justify-between gap-4">
            <span className="text-muted">Previsão vs. equilíbrio</span>
            <span className={`font-mono font-semibold ${revenueForecastCents >= breakEven.breakEvenRevenueCents ? 'text-positive' : 'text-negative'}`}>
              {revenueForecastCents >= breakEven.breakEvenRevenueCents ? '+' : ''}{formatBRLFromCents(revenueForecastCents - breakEven.breakEvenRevenueCents)}
            </span>
          </div>}
        </> : <div className="mt-7"><EmptyState title="O ponto de equilíbrio depende do mix de vendas" description="Cadastre despesas fixas e registre quantidades vendidas com preço e contribuição por produto. Sem isso, não estimamos uma média simples nem inventamos o resultado." action={<Link to="/lancamentos" className="btn-secondary">Completar lançamentos <ArrowRight size={14}/></Link>}/></div>}
      </div>
      <div className="surface p-5 sm:p-7"><div className="flex items-start justify-between"><div><p className="eyebrow">DESPESAS FIXAS</p><h3 className="mt-2 text-lg font-semibold">Distribuição por categoria</h3></div><CircleHelp size={16} className="text-muted"/></div>
        {distribution.length ? <><div className="mt-4 h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" nameKey="name" innerRadius={54} outerRadius={76} paddingAngle={3} stroke="none">{distribution.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]}/>)}</Pie><RechartsTooltip formatter={value => moneyTooltip(Number(value))} contentStyle={{ background: '#141414', border: '1px solid #262626', borderRadius: 10, color: '#f5f5f5' }}/></PieChart></ResponsiveContainer></div><div className="space-y-2">{distribution.map((item, index) => <div key={item.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-muted"><span className="size-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }}/>{item.name}</span><span className="font-mono text-paper">{moneyTooltip(item.value)}</span></div>)}</div></> : <div className="mt-8"><EmptyState title="Nenhuma despesa cadastrada" description="Quando você registrar despesas no período, verá aqui a distribuição real por categoria." action={<Link to="/lancamentos" className="btn-secondary">Adicionar despesa <Plus size={14}/></Link>}/></div>}
      </div>
    </section>

    <section className="surface p-5 sm:p-6"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 shrink-0 text-gold" size={17}/><div className="min-w-0 flex-1"><p className="eyebrow">ALERTAS E SINAIS DE ATENÇÃO</p><h3 className="mt-1 text-base font-semibold">Ações que merecem sua atenção</h3>{alerts.length ? <div className="mt-4 divide-y divide-line">{alerts.map(alert => <div key={alert.title} className="py-3 first:pt-0 last:pb-0"><p className="text-sm font-medium text-attention">{alert.title}</p><p className="mt-1 text-xs leading-5 text-muted">{alert.detail}</p></div>)}</div> : <p className="mt-3 text-xs leading-5 text-muted">Nenhum alerta calculável com os dados atuais. Alguns sinais dependem de preços, margens e vendas suficientes.</p>}</div></div></section>

    <section className="surface overflow-hidden"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-5 sm:px-7"><div><p className="eyebrow">SIMULAÇÕES · NÃO SÃO GARANTIAS</p><h3 className="mt-2 text-lg font-semibold">Onde você pode lucrar mais?</h3><p className="mt-1 text-xs text-muted">Oportunidades calculadas pelo preço mínimo ou pela margem desejada cadastrada.</p></div><Link className="text-xs font-medium text-gold hover:text-[#ead584]" to="/produtos">Ver produtos <ArrowRight size={13} className="ml-1 inline"/></Link></div>
      {opportunities.length ? <div className="divide-y divide-line">{opportunities.map(item => <div key={item.id} className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-[1.2fr_repeat(5,.75fr)] sm:items-center sm:px-7"><div><p className="font-medium">{item.name}</p><p className="mt-1 text-[10px] text-muted">{item.kind} · simulação de reajuste</p></div><div><p className="text-[10px] text-muted">Preço atual</p><p className="mt-1 font-mono text-xs">{formatBRLFromCents(item.current)}</p></div><div><p className="text-[10px] text-muted">Preço recomendado</p><p className="mt-1 font-mono text-xs text-gold">{formatBRLFromCents(item.recommended)}</p></div><div><p className="text-[10px] text-muted">Margem atual / desejada</p><p className="mt-1 font-mono text-xs">{formatPercent(item.margin)} / {formatPercent(item.desired)}</p></div><div><p className="text-[10px] text-muted">Diferença simulada</p><p className="mt-1 font-mono text-xs text-positive">+{formatBRLFromCents(item.delta)}</p></div><div><p className="text-[10px] text-muted">Potencial adicional de contribuição / un.</p><p className="mt-1 font-mono text-xs text-gold">+{formatBRLFromCents(item.potential)}</p></div></div>)}</div> : <div className="p-6"><p className="text-sm text-muted">Não há oportunidade calculável com os dados atuais. Cadastre um preço atual; se houver margem desejada, ela será usada, senão a referência é o preço mínimo. Valores são simulações.</p></div>}
    </section>
    <div className="flex items-start gap-2 text-[10px] leading-5 text-[#6f6f6f]"><ShieldAlert size={13} className="mt-0.5 shrink-0 text-gold"/>A margem de contribuição não representa lucro líquido. Indicadores de equilíbrio só aparecem quando existem despesas e mix de vendas suficientes.</div>
  </div>
}
