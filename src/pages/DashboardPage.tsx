import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowUpRight, CircleHelp, Package, Plus, ShieldAlert, Target, Wallet, Scale, ChartNoAxesCombined, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Cell, Pie, PieChart, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip as RechartsTooltip, Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState, InlineNotice, LoadingScreen } from '../components/Feedback'
import { listExpenses, listProducts, listSalesRecords, listServices, listVariableCosts, readOperatingSettings, listAssetsLiabilities } from '../services/companyData'
import type { FixedExpenseRecord, ProductRecord, SalesRecord, ServiceRecord, VariableCostRecord, AssetLiabilityRecord } from '../types/database'
import { calculateBreakEven, type SalesMixLine } from '../finance/operations'
import { calculateProductPricing, calculateServiceCost } from '../finance/pricing'
import { formatBRLFromCents, formatMarkup, formatPercent } from '../lib/money'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip'

// Rich color palette
const PIE_COLORS = ['#D4AF37', '#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#06b6d4', '#ec4899']
const localDate = () => new Date().toLocaleDateString('sv-SE')

type PriceOpportunity = {
  id: string; name: string; kind: 'Produto' | 'Serviço'
  current: number; margin: number | null; desired: number | null
  recommended: number; delta: number; potential: number
}

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

type MetricVariant = 'default' | 'gold' | 'green' | 'red' | 'blue'
function Metric({ title, value, detail, icon: Icon, variant = 'default', to }: { title: string; value: string; detail: string; icon: typeof Wallet; variant?: MetricVariant; to?: string }) {
  const schemes: Record<MetricVariant, { border: string; bg: string; icon: string; value: string }> = {
    default: { border: 'border-teal-border', bg: 'bg-teal-light', icon: 'text-teal', value: 'text-paper' },
    gold:    { border: 'border-teal/30', bg: 'bg-teal/10', icon: 'text-teal', value: 'text-teal' },
    green:   { border: 'border-emerald-500/40', bg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-700' },
    red:     { border: 'border-red-300', bg: 'bg-red-50', icon: 'text-red-500', value: 'text-red-600' },
    blue:    { border: 'border-blue-300', bg: 'bg-blue-50', icon: 'text-blue-500', value: 'text-blue-700' },
  }
  const s = schemes[variant]
  const inner = (
    <div className={`surface group relative overflow-hidden p-3 transition hover:border-teal-border ${to ? 'cursor-pointer hover:bg-teal-light/30' : 'cursor-default'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">{title}</p>
          <p className={`mt-2 font-mono text-xl font-bold tracking-tight tabular-nums ${s.value}`}>{value}</p>
        </div>
        <span className={`grid size-9 place-items-center rounded-lg border ${s.border} ${s.bg} ${s.icon} transition-transform group-hover:scale-110`}>
          <Icon size={16}/>
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-snug font-medium text-muted">{detail}</p>
      {to && <span className="absolute bottom-2 right-3 text-[9px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">Ver detalhes →</span>}
    </div>
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {to ? <Link to={to} className="block">{inner}</Link> : inner}
      </TooltipTrigger>
      <TooltipContent side="top">{title}: {detail}</TooltipContent>
    </Tooltip>
  )
}

// Custom tooltip for pie chart
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-xl border border-line bg-graphite px-4 py-3 shadow-xl text-xs">
      <p className="font-semibold text-paper">{item.name}</p>
      <p className="mt-1 font-mono text-gold">{formatBRLFromCents(item.value)}</p>
      <p className="mt-0.5 text-muted">{item.payload.percent ? `${(item.payload.percent * 100).toFixed(1)}% do total` : ''}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { currentCompany, configReady } = useAuth()
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [expenses, setExpenses] = useState<FixedExpenseRecord[]>([])
  const [sales, setSales] = useState<SalesRecord[]>([])
  const [variableCosts, setVariableCosts] = useState<VariableCostRecord[]>([])
  const [assetsLiabilities, setAssetsLiabilities] = useState<AssetLiabilityRecord[]>([])
  const [revenueForecastCents, setRevenueForecastCents] = useState<number | null>(null)
  const [proLaboreCents, setProLaboreCents] = useState<number | null>(null)
  const [feeTags, setFeeTags] = useState<Array<{ label: string; percent: string }>>([])
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
      const [productResult, serviceResult, expenseResult, salesResult, settingsResult, variableCostsResult] = await Promise.allSettled([
        listProducts(currentCompany.id), listServices(currentCompany.id),
        listExpenses(currentCompany.id), listSalesRecords(currentCompany.id, from),
        readOperatingSettings(currentCompany.id), listVariableCosts(currentCompany.id),
      ])
      if (!active) return
      const failed = [productResult, serviceResult, expenseResult, salesResult].find(r => r.status === 'rejected')
      if (failed?.status === 'rejected') setError(String(failed.reason?.message ?? failed.reason))
      else if (productResult.status === 'fulfilled' && serviceResult.status === 'fulfilled' && expenseResult.status === 'fulfilled' && salesResult.status === 'fulfilled') {
        setProducts(productResult.value); setServices(serviceResult.value)
        setExpenses(expenseResult.value); setSales(salesResult.value)
      }
      if (variableCostsResult.status === 'fulfilled') {
        setVariableCosts(variableCostsResult.value)
      }
      // Load assets/liabilities separately to avoid blocking dashboard
      try {
        const assetsLiabilitiesResult = await listAssetsLiabilities(currentCompany.id)
        if (active) setAssetsLiabilities(assetsLiabilitiesResult)
      } catch (alError) {
        console.warn('Assets/Liabilities table may not exist yet:', alError)
        if (active) setAssetsLiabilities([])
      }
      if (settingsResult.status === 'fulfilled' && settingsResult.value) {
        setRevenueForecastCents(settingsResult.value.revenue_forecast_cents ?? null)
        setProLaboreCents(settingsResult.value.pro_labore_cents ?? null)
        setFeeTags(settingsResult.value.fee_tags ?? [])
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [currentCompany?.id, configReady, monthKey])

  if (loading) return <LoadingScreen label="Atualizando os indicadores da empresa" />
  if (error) return <div className="space-y-4"><InlineNotice>{error}</InlineNotice><p className="text-xs text-muted">Verifique a conexão e as policies do Supabase.</p></div>

  // ── Calculations ────────────────────────────────────────────
  const monthExpenses = expenses.filter(row => row.reference_date.startsWith(monthKey))
  const monthSales = sales.filter(row => row.sold_on.startsWith(monthKey))
  const fixedTotal = monthExpenses.length ? monthExpenses.reduce((sum, row) => sum + Number(row.amount_cents), 0) : null
  const mix: SalesMixLine[] = monthSales.map(s => ({ sellingPriceCents: Number(s.selling_price_cents), contributionCents: Number(s.contribution_cents), quantity: Number(s.quantity) }))
  const breakEven = fixedTotal === null ? null : calculateBreakEven(fixedTotal, mix)
  const revenue = monthSales.length ? monthSales.reduce((sum, row) => sum + Number(row.selling_price_cents) * Number(row.quantity), 0) : null

  // Assets and Liabilities calculations
  const assets = assetsLiabilities.filter(al => al.type === 'asset')
  const liabilities = assetsLiabilities.filter(al => al.type === 'liability')
  const totalAssetsCents = assets.reduce((sum, a) => sum + Number(a.amount_cents), 0)
  const totalLiabilitiesCents = liabilities.reduce((sum, l) => sum + Number(l.amount_cents), 0)
  const netWorthCents = totalAssetsCents - totalLiabilitiesCents

  // Calculate variable costs from Custos Variáveis tab (primary source)
  const totalVariableCostsPercent = variableCosts
    .filter(vc => vc.percent_value !== null)
    .reduce((sum, vc) => sum + Number(vc.percent_value), 0)
  
  // Use Variable Costs as primary source, fallback to fee tags only if empty
  const effectiveVariableCostsPercent = totalVariableCostsPercent > 0 ? totalVariableCostsPercent : feeTags.reduce((sum, t) => sum + Number(t.percent || 0), 0)
  const estimatedMarginPct = effectiveVariableCostsPercent > 0 ? Math.max(0, 100 - effectiveVariableCostsPercent) : null
  const breakEvenEstimated = fixedTotal !== null && !breakEven && estimatedMarginPct !== null && estimatedMarginPct > 0
    ? { breakEvenRevenueCents: fixedTotal / (estimatedMarginPct / 100), weightedContributionMarginPercent: estimatedMarginPct, isEstimated: true }
    : null
  const effectiveBreakEvenCents = breakEven?.breakEvenRevenueCents ?? breakEvenEstimated?.breakEvenRevenueCents ?? null
  const effectiveMarginPct = breakEven?.weightedContributionMarginPercent ?? breakEvenEstimated?.weightedContributionMarginPercent ?? null

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

  const alerts: Array<{ title: string; detail: string; tone: 'warn' | 'ok' | 'bad' }> = []
  if (negativeMargins) alerts.push({ title: 'Margem negativa', detail: `${negativeMargins} produto(s) ou serviço(s) com contribuição negativa.`, tone: 'bad' })
  if (belowDesiredMargins) alerts.push({ title: 'Margem abaixo da meta', detail: `${belowDesiredMargins} item(ns) abaixo da margem desejada cadastrada.`, tone: 'warn' })
  if (fixedTotal !== null && revenue !== null && fixedTotal >= revenue) alerts.push({ title: 'Despesas fixas elevadas', detail: 'As despesas fixas são iguais ou superiores ao faturamento registrado.', tone: 'bad' })
  if (breakEven && breakEven.remainingRevenueCents > 0) alerts.push({ title: 'Abaixo do ponto de equilíbrio', detail: `Faltam ${formatBRLFromCents(breakEven.remainingRevenueCents)} para cobrir as despesas fixas.`, tone: 'warn' })
  if (allOpportunities.length) alerts.push({ title: 'Oportunidade de reajuste', detail: `${allOpportunities.length} produto(s)/serviço(s) com simulação de preço acima do atual.`, tone: 'ok' })

  const distribution = Object.values(
    monthExpenses.reduce<Record<string, { name: string; value: number }>>((acc, item) => {
      const group = acc[item.category] ?? { name: item.category, value: 0 }
      group.value += Number(item.amount_cents)
      acc[item.category] = group
      return acc
    }, {})
  ).sort((a, b) => b.value - a.value).slice(0, 8)

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
  void statusText // used for future reference
  const marginVariant: MetricVariant = !breakEven && !breakEvenEstimated ? 'default' : (effectiveMarginPct ?? 0) >= 30 ? 'green' : (effectiveMarginPct ?? 0) >= 10 ? 'gold' : 'red'
  const breakEvenVariant: MetricVariant = !effectiveBreakEvenCents ? 'default' : (breakEven?.progressPercent ?? 0) >= 100 ? 'green' : 'blue'

  // Radial bar data for break-even progress
  const progressPct = breakEven ? Math.min(breakEven.progressPercent, 100) : revenueForecastCents && effectiveBreakEvenCents ? Math.min((revenueForecastCents / effectiveBreakEvenCents) * 100, 100) : 0
  const radialFill = progressPct >= 100 ? '#22c55e' : '#D4AF37'
  const radialData = effectiveBreakEvenCents ? [{ name: 'Progresso', value: progressPct, fill: radialFill }] : []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow text-gold">VISÃO FINANCEIRA · {month.toUpperCase()}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Os números do seu negócio, sem adivinhação.</h2>
          <p className="mt-2 text-sm text-muted">Indicadores vêm dos cadastros e vendas reais da sua empresa.</p>
        </div>
      </div>

      {products.length === 0 && monthExpenses.length === 0 && monthSales.length === 0 &&
        <InlineNotice tone="info">Seu painel ainda não tem dados. Cadastre um produto, lance uma despesa e registre vendas para liberar indicadores reais.</InlineNotice>}

      {/* Metric cards */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Produtos cadastrados" value={String(products.length)} detail={products.length ? `Total de ${products.length} produto(s) nesta empresa` : 'Nenhum produto cadastrado ainda'} icon={Package} variant={products.length > 0 ? 'blue' : 'default'} to="/produtos"/>
        <Metric title="Serviços cadastrados" value={String(services.length)} detail={services.length ? `Total de ${services.length} serviço(s) nesta empresa` : 'Nenhum serviço cadastrado ainda'} icon={Wallet} variant={services.length > 0 ? 'green' : 'default'} to="/produtos"/>
        <Metric title="Margem saudável" value={productMargins.length || serviceMargins.length ? String(healthy) : '—'} detail={productMargins.length || serviceMargins.length ? 'Produtos/serviços acima da margem desejada' : 'Aguardando preços completos'} icon={TrendingUp} variant={healthy > 0 ? 'green' : 'default'} to="/produtos"/>
        <Metric title="Atenção necessária" value={productMargins.length || serviceMargins.length ? String(lowOrNegative) : '—'} detail="Produtos/serviços abaixo da meta ou negativos" icon={TrendingDown} variant={lowOrNegative > 0 ? 'red' : 'default'} to="/produtos"/>
      </section>

      {/* Menores/Maiores margens - INVERTIDO: Menores primeiro, Maiores depois */}
      {(products.length > 0 || services.length > 0) && (
        <section className="grid gap-4 md:grid-cols-2">
          {/* Menores margens - PRIMEIRO CARD */}
          <div className="surface p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="eyebrow text-red-600">MENORES MARGENS</p>
                <h3 className="mt-1 text-base font-bold">Precisam de atenção</h3>
              </div>
              <AlertTriangle className="text-red-500" size={18}/>
            </div>
            <div className="space-y-2.5">
              {(() => {
                const allItems = [
                  ...products.flatMap(p => {
                    if (!p.current_price_cents) return []
                    const result = calculateProductPricing({ acquisitionCostCents: Number(p.acquisition_cost_cents), otherCostCents: Number(p.other_cost_cents), variableFeesPercent: Number(p.variable_fees_percent), taxPercent: Number(p.tax_percent), desiredMarginPercent: p.desired_margin_percent === null ? undefined : Number(p.desired_margin_percent), sellingPriceCents: Number(p.current_price_cents) })
                    return result.contributionMarginPercent === null ? [] : [{ name: p.name, type: 'Produto', margin: result.contributionMarginPercent, price: p.current_price_cents, desired: p.desired_margin_percent }]
                  }),
                  ...services.flatMap(s => {
                    if (!s.current_price_cents) return []
                    try {
                      const cost = calculateServiceCost({ hours: Number(s.hours), hourlyLaborCostCents: Number(s.hourly_labor_cost_cents), materialsCents: Number(s.materials_cents), otherCostCents: Number(s.other_cost_cents), fixedCostPerHourCents: Number(s.fixed_cost_per_hour_cents), includeFixedCostPerHour: s.include_fixed_cost_per_hour })
                      const result = calculateProductPricing({ acquisitionCostCents: cost, variableFeesPercent: Number(s.variable_fees_percent), taxPercent: Number(s.tax_percent), desiredMarginPercent: s.desired_margin_percent === null ? undefined : Number(s.desired_margin_percent), sellingPriceCents: Number(s.current_price_cents) })
                      return result.contributionMarginPercent === null ? [] : [{ name: s.name, type: 'Serviço', margin: result.contributionMarginPercent, price: s.current_price_cents, desired: s.desired_margin_percent }]
                    } catch { return [] }
                  })
                ].sort((a, b) => a.margin - b.margin).slice(0, 5)
                
                return allItems.length ? allItems.map((item, i) => (
                  <div key={i} className={`flex items-center justify-between gap-4 rounded-xl border p-2.5 hover:bg-red-50/50 transition-colors ${item.margin < 0 ? 'border-red-300 bg-red-50/70' : 'border-amber-200 bg-amber-50/50'}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-paper truncate">{item.name}</p>
                      <p className="mt-0.5 text-[10px] text-muted">{item.type} · {formatBRLFromCents(item.price)}{item.desired !== null && ` · Meta: ${formatPercent(item.desired)}`}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-mono text-base font-bold ${item.margin < 0 ? 'text-red-600' : 'text-amber-600'}`}>{formatPercent(item.margin)}</p>
                      <p className="text-[9px] text-muted">margem</p>
                    </div>
                  </div>
                )) : <p className="text-sm text-muted text-center py-4">Nenhum produto/serviço com preço cadastrado</p>
              })()}
            </div>
          </div>

          {/* Maiores margens - SEGUNDO CARD */}
          <div className="surface p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="eyebrow text-emerald-600">MAIORES MARGENS</p>
                <h3 className="mt-1 text-base font-bold">Produtos/serviços campeões</h3>
              </div>
              <CheckCircle2 className="text-emerald-500" size={18}/>
            </div>
            <div className="space-y-2.5">
              {(() => {
                const allItems = [
                  ...products.flatMap(p => {
                    if (!p.current_price_cents) return []
                    const result = calculateProductPricing({ acquisitionCostCents: Number(p.acquisition_cost_cents), otherCostCents: Number(p.other_cost_cents), variableFeesPercent: Number(p.variable_fees_percent), taxPercent: Number(p.tax_percent), desiredMarginPercent: p.desired_margin_percent === null ? undefined : Number(p.desired_margin_percent), sellingPriceCents: Number(p.current_price_cents) })
                    return result.contributionMarginPercent === null ? [] : [{ name: p.name, type: 'Produto', margin: result.contributionMarginPercent, price: p.current_price_cents }]
                  }),
                  ...services.flatMap(s => {
                    if (!s.current_price_cents) return []
                    try {
                      const cost = calculateServiceCost({ hours: Number(s.hours), hourlyLaborCostCents: Number(s.hourly_labor_cost_cents), materialsCents: Number(s.materials_cents), otherCostCents: Number(s.other_cost_cents), fixedCostPerHourCents: Number(s.fixed_cost_per_hour_cents), includeFixedCostPerHour: s.include_fixed_cost_per_hour })
                      const result = calculateProductPricing({ acquisitionCostCents: cost, variableFeesPercent: Number(s.variable_fees_percent), taxPercent: Number(s.tax_percent), desiredMarginPercent: s.desired_margin_percent === null ? undefined : Number(s.desired_margin_percent), sellingPriceCents: Number(s.current_price_cents) })
                      return result.contributionMarginPercent === null ? [] : [{ name: s.name, type: 'Serviço', margin: result.contributionMarginPercent, price: s.current_price_cents }]
                    } catch { return [] }
                  })
                ].sort((a, b) => b.margin - a.margin).slice(0, 5)
                
                return allItems.length ? allItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5 hover:bg-emerald-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-paper truncate">{item.name}</p>
                      <p className="mt-0.5 text-[10px] text-muted">{item.type} · {formatBRLFromCents(item.price)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-base font-bold text-emerald-600">{formatPercent(item.margin)}</p>
                      <p className="text-[9px] text-muted">margem</p>
                    </div>
                  </div>
                )) : <p className="text-sm text-muted text-center py-4">Nenhum produto/serviço com preço cadastrado</p>
              })()}
            </div>
          </div>
        </section>
      )}

      {/* Original metric cards - adjusted */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Despesas fixas mensais" value={formatBRLFromCents(fixedTotal)} detail={monthExpenses.length ? `${monthExpenses.length} lançamento(s) neste período` : 'Cadastre despesas para acompanhar'} icon={Scale} variant={fixedTotal !== null ? 'red' : 'default'} to="/lancamentos"/>
        <Metric title="Margem de contribuição" value={formatPercent(effectiveMarginPct)} detail={breakEven ? 'Ponderada pelo mix de vendas registrado' : breakEvenEstimated ? `Baseada nos custos variáveis (${effectiveVariableCostsPercent.toFixed(1)}% cadastrados)` : 'Depende de vendas com mix informado'} icon={ChartNoAxesCombined} variant={marginVariant} to="/lancamentos"/>
        <Metric title="Ponto de equilíbrio" value={effectiveBreakEvenCents ? formatBRLFromCents(effectiveBreakEvenCents) : '—'} detail={breakEven ? 'Baseado nas despesas fixas e mix real de vendas' : breakEvenEstimated ? 'Estimado pelos custos variáveis e despesas fixas' : 'Exige despesas e mix de vendas suficientes'} icon={Target} variant={breakEvenVariant} to="/lancamentos"/>
        <Metric title="Previsão de faturamento" value={formatBRLFromCents(revenueForecastCents)} detail={revenueForecastCents !== null ? 'Meta de faturamento cadastrada nos parâmetros' : 'Cadastre em Lançamentos → Parâmetros'} icon={TrendingUp} variant={revenueForecastCents !== null ? 'gold' : 'default'} to="/lancamentos"/>
        <Metric title="Markup de referência" value={formatMarkup(revenueWeightedMarkup)} detail={revenueWeightedMarkup === null ? 'Disponível quando preço e mix estiverem completos' : 'Ponderado pelo faturamento vendido'} icon={ArrowUpRight} variant={revenueWeightedMarkup !== null ? 'gold' : 'default'} to="/lancamentos"/>
      </section>

      {/* Break-even + Expenses distribution + Variable costs */}
      <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        {/* Break-even card */}
        <div className="surface overflow-hidden p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">PONTO DE EQUILÍBRIO</p>
              <h3 className="mt-2 text-xl font-bold">Quanto falta para cobrir a operação?</h3>
            </div>
            <span className="rounded-full border border-line px-3 py-1.5 text-[10px] text-muted">Sem estimativas inventadas</span>
          </div>

          {(breakEven || breakEvenEstimated) ? (
            <>
              <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="relative mx-auto h-36 w-36 shrink-0 sm:mx-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%" startAngle={90} endAngle={-270} data={radialData} barSize={12}>
                      <RadialBar dataKey="value" cornerRadius={6} background={{ fill: '#E8ECEB' }}/>
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`font-mono text-xl font-bold ${radialFill === '#22c55e' ? 'text-emerald-400' : 'text-gold'}`}>{progressPct.toFixed(0)}%</span>
                    <span className="text-[9px] text-muted mt-0.5">do equilíbrio</span>
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-end justify-between gap-4">
                    <div><p className="text-xs text-muted">Faturamento necessário</p><p className="mt-1 font-mono text-2xl font-bold text-gold">{formatBRLFromCents(effectiveBreakEvenCents)}</p></div>
                    {breakEven && <div className="text-right"><p className="text-xs text-muted">Faturamento atual</p><p className="mt-1 font-mono text-xl font-bold">{formatBRLFromCents(breakEven.referenceRevenueCents)}</p></div>}
                    {breakEvenEstimated && revenueForecastCents && <div className="text-right"><p className="text-xs text-muted">Previsão de faturamento</p><p className="mt-1 font-mono text-xl font-bold">{formatBRLFromCents(revenueForecastCents)}</p></div>}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-teal-light">
                    <div className={`h-full rounded-full transition-all ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-gold'}`} style={{ width: `${progressPct}%` }}/>
                  </div>
                  {breakEven && <p className={`text-xs font-medium ${breakEven.remainingRevenueCents > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {breakEven.remainingRevenueCents > 0
                      ? `Faltam ${formatBRLFromCents(breakEven.remainingRevenueCents)} para atingir o equilíbrio`
                      : `✓ Equilíbrio atingido com folga de ${formatBRLFromCents(Math.abs(breakEven.remainingRevenueCents))}`}
                  </p>}
                  {breakEvenEstimated && <p className="text-xs text-amber-400">Estimativa baseada nas taxas cadastradas. Cadastre vendas para cálculo real.</p>}
                </div>
              </div>
              <div className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
                <div><span className="text-[11px] text-muted">Despesas fixas</span><p className="mt-1 font-mono text-sm text-red-400">{formatBRLFromCents(fixedTotal)}</p></div>
                <div><span className="text-[11px] text-muted">Margem {breakEvenEstimated ? '(estimada)' : 'ponderada'}</span><p className="mt-1 font-mono text-sm text-emerald-400">{formatPercent(effectiveMarginPct)}</p></div>
                {revenueForecastCents !== null && <div><span className="text-[11px] text-muted">Previsão</span><p className={`mt-1 font-mono text-sm ${revenueForecastCents >= (effectiveBreakEvenCents ?? Infinity) ? 'text-emerald-400' : 'text-red-400'}`}>{formatBRLFromCents(revenueForecastCents)}</p></div>}
                {proLaboreCents !== null && <div><span className="text-[11px] text-muted">Pró-labore</span><p className="mt-1 font-mono text-sm text-blue-400">{formatBRLFromCents(proLaboreCents)}</p></div>}
              </div>
              {revenueForecastCents !== null && effectiveBreakEvenCents !== null && (
                <div className={`mt-4 rounded-xl border p-3 text-xs flex items-center justify-between gap-4 ${revenueForecastCents >= effectiveBreakEvenCents ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                  <span className="text-muted">Previsão vs. equilíbrio</span>
                  <span className={`font-mono font-bold ${revenueForecastCents >= effectiveBreakEvenCents ? 'text-emerald-400' : 'text-red-400'}`}>
                    {revenueForecastCents >= effectiveBreakEvenCents ? '+' : ''}{formatBRLFromCents(revenueForecastCents - effectiveBreakEvenCents)}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="mt-7">
              <EmptyState title="O ponto de equilíbrio depende do mix de vendas" description="Cadastre despesas fixas e registre quantidades vendidas com preço e contribuição por produto." action={<Link to="/lancamentos" className="btn-secondary">Completar lançamentos <ArrowRight size={14}/></Link>}/>
            </div>
          )}
        </div>

        {/* Right column: two pie charts stacked */}
        <div className="flex flex-col gap-4">
          {/* Fixed expenses pie + revenue relation */}
          <div className="surface p-5 flex-1">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">DESPESAS FIXAS</p>
                <h3 className="mt-1 text-base font-semibold">Por categoria</h3>
              </div>
              <CircleHelp size={15} className="text-muted"/>
            </div>
            {/* Revenue relation bar */}
            {fixedTotal !== null && (revenue !== null || revenueForecastCents !== null) && (() => {
              const ref = revenue ?? revenueForecastCents!
              const pct = Math.min(100, (fixedTotal / ref) * 100)
              return (
                <div className="mt-3 rounded-lg bg-panel border border-line p-3 text-xs space-y-1.5">
                  <div className="flex justify-between text-muted">
                    <span>Despesas fixas / {revenue !== null ? 'faturamento real' : 'previsão'}</span>
                    <span className={`font-mono font-semibold ${pct >= 80 ? 'text-red-400' : pct >= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-teal-light">
                    <div className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }}/>
                  </div>
                </div>
              )
            })()}
            {distribution.length ? (
              <>
                <div className="mt-3 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} stroke="none">
                        {distribution.map((item, index) => (
                          <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} style={{ cursor: 'pointer' }}/>
                        ))}
                      </Pie>
                      <RechartsTooltip content={<PieTooltip/>}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 space-y-1.5">
                  {distribution.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full shrink-0" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}/>{item.name}</span>
                      <span className="font-mono text-paper">{formatBRLFromCents(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-4"><EmptyState title="Nenhuma despesa" description="Cadastre despesas fixas para ver a distribuição." action={<Link to="/lancamentos" className="btn-secondary text-xs">Adicionar <Plus size={12}/></Link>}/></div>
            )}
          </div>
        </div>
      </section>

      {/* Assets and Liabilities Card + Chart */}
      {(assets.length > 0 || liabilities.length > 0) && (
        <section className="surface p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <p className="eyebrow text-gold">BALANÇO PATRIMONIAL</p>
              <h3 className="mt-2 text-xl font-bold">Ativos vs. Passivos</h3>
              <p className="mt-1 text-xs text-muted">Confronto simplificado da sua posição patrimonial</p>
            </div>
            <Link to="/lancamentos" className="text-xs font-medium text-gold hover:text-[#ead584]">Gerenciar <ArrowRight size={13} className="ml-1 inline"/></Link>
          </div>

          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-emerald-700">ATIVOS</p>
                <TrendingUp size={16} className="text-emerald-600"/>
              </div>
              <p className="font-mono text-2xl font-bold text-emerald-600">{formatBRLFromCents(totalAssetsCents)}</p>
              <p className="mt-1 text-[10px] text-muted">{assets.length} lançamento(s)</p>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-red-700">PASSIVOS</p>
                <TrendingDown size={16} className="text-red-600"/>
              </div>
              <p className="font-mono text-2xl font-bold text-red-600">{formatBRLFromCents(totalLiabilitiesCents)}</p>
              <p className="mt-1 text-[10px] text-muted">{liabilities.length} lançamento(s)</p>
            </div>

            <div className={`rounded-xl border p-4 ${netWorthCents >= 0 ? 'border-blue-200 bg-blue-50/50' : 'border-red-300 bg-red-100/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs font-semibold ${netWorthCents >= 0 ? 'text-blue-700' : 'text-red-700'}`}>PATRIMÔNIO LÍQUIDO</p>
                <Scale size={16} className={netWorthCents >= 0 ? 'text-blue-600' : 'text-red-600'}/>
              </div>
              <p className={`font-mono text-2xl font-bold ${netWorthCents >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatBRLFromCents(netWorthCents)}</p>
              <p className="mt-1 text-[10px] text-muted">Ativos - Passivos</p>
            </div>
          </div>

          {/* Horizontal bar chart comparison */}
          <div className="rounded-xl border border-line bg-panel p-5">
            <p className="mb-4 text-xs font-semibold text-muted">COMPARATIVO VISUAL</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Ativos', value: totalAssetsCents / 100, fill: '#059669' },
                  { name: 'Passivos', value: totalLiabilitiesCents / 100, fill: '#dc2626' }
                ]} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8ECEB" horizontal={false}/>
                  <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#E8ECEB' }}/>
                  <YAxis type="category" dataKey="name" tick={{ fill: '#1F2937', fontSize: 14, fontWeight: 600 }} axisLine={{ stroke: '#E8ECEB' }} width={80}/>
                  <RechartsTooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const item = payload[0]
                    return (
                      <div className="rounded-xl border border-line bg-graphite px-4 py-3 shadow-xl text-xs">
                        <p className="font-semibold text-paper">{item.payload.name}</p>
                        <p className="mt-1 font-mono text-gold">R$ {Number(item.value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    )
                  }}/>
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={50}>
                    {[
                      { name: 'Ativos', value: totalAssetsCents / 100, fill: '#059669' },
                      { name: 'Passivos', value: totalLiabilitiesCents / 100, fill: '#dc2626' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Insight */}
            <div className={`mt-4 rounded-xl border p-3 text-xs flex items-center justify-between gap-4 ${netWorthCents >= 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
              <span className="text-muted">Situação patrimonial</span>
              <span className={`font-mono font-bold ${netWorthCents >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {netWorthCents >= 0 
                  ? `Patrimônio positivo em ${formatBRLFromCents(netWorthCents)}` 
                  : `Passivo descoberto em ${formatBRLFromCents(Math.abs(netWorthCents))}`}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Alerts */}
      <section className="surface p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 shrink-0 text-gold" size={17}/>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">ALERTAS E SINAIS DE ATENÇÃO</p>
            <h3 className="mt-1 text-base font-semibold">Ações que merecem sua atenção</h3>
            {alerts.length ? (
              <div className="mt-4 divide-y divide-line">
                {alerts.map(alert => {
                  const Icon = alert.tone === 'ok' ? CheckCircle2 : alert.tone === 'bad' ? TrendingDown : AlertTriangle
                  const color = alert.tone === 'ok' ? 'text-emerald-400' : alert.tone === 'bad' ? 'text-red-400' : 'text-amber-400'
                  return (
                    <div key={alert.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <Icon size={14} className={`${color} mt-0.5 shrink-0`}/>
                      <div><p className={`text-sm font-medium ${color}`}>{alert.title}</p><p className="mt-0.5 text-xs leading-5 text-muted">{alert.detail}</p></div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mt-3 text-xs leading-5 text-muted">Nenhum alerta calculável com os dados atuais.</p>
            )}
          </div>
        </div>
      </section>

      {/* Opportunities */}
      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-5 sm:px-7">
          <div>
            <p className="eyebrow">SIMULAÇÕES · NÃO SÃO GARANTIAS</p>
            <h3 className="mt-2 text-xl font-bold">Onde você pode lucrar mais?</h3>
            <p className="mt-1 text-xs text-muted">Oportunidades calculadas pelo preço mínimo ou pela margem desejada.</p>
          </div>
          <Link className="text-xs font-medium text-gold hover:text-[#ead584]" to="/produtos">Ver produtos <ArrowRight size={13} className="ml-1 inline"/></Link>
        </div>
        {opportunities.length ? (
          <div className="divide-y divide-line">
            {opportunities.map(item => (
              <div key={item.id} className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-[1.2fr_repeat(5,.75fr)] sm:items-center sm:px-7 hover:bg-white/[.012] transition-colors">
                <div><p className="font-medium">{item.name}</p><p className="mt-1 text-[10px] text-muted">{item.kind} · simulação de reajuste</p></div>
                <div><p className="text-[10px] text-muted">Preço atual</p><p className="mt-1 font-mono text-xs">{formatBRLFromCents(item.current)}</p></div>
                <div><p className="text-[10px] text-muted">Recomendado</p><p className="mt-1 font-mono text-xs text-gold">{formatBRLFromCents(item.recommended)}</p></div>
                <div><p className="text-[10px] text-muted">Margem atual / meta</p><p className={`mt-1 font-mono text-xs ${item.margin !== null && item.margin < 0 ? 'text-red-400' : item.desired !== null && item.margin !== null && item.margin < item.desired ? 'text-amber-400' : 'text-emerald-400'}`}>{formatPercent(item.margin)} / {formatPercent(item.desired)}</p></div>
                <div><p className="text-[10px] text-muted">Diferença</p><p className="mt-1 font-mono text-xs text-emerald-400">+{formatBRLFromCents(item.delta)}</p></div>
                <div><p className="text-[10px] text-muted">Potencial / un.</p><p className="mt-1 font-mono text-xs text-gold">+{formatBRLFromCents(item.potential)}</p></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6"><p className="text-sm text-muted">Não há oportunidade calculável com os dados atuais.</p></div>
        )}
      </section>

      <div className="flex items-start gap-2 text-[10px] leading-5 text-muted">
        <ShieldAlert size={13} className="mt-0.5 shrink-0 text-gold"/>
        A margem de contribuição não representa lucro líquido. Indicadores só aparecem quando existem despesas e mix de vendas suficientes.
      </div>
    </div>
  )
}
