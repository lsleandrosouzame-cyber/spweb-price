import { useEffect, useState } from 'react'
import { Clock, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { RadialBarChart, RadialBar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { LoadingScreen } from '../components/Feedback'
import { listExpenses, listProducts, listVariableCosts, readOperatingSettings, listAssetsLiabilities } from '../services/companyData'
import type { FixedExpenseRecord, ProductRecord, VariableCostRecord, AssetLiabilityRecord } from '../types/database'
import { useFinancialDiagnosis } from '../hooks/useFinancialDiagnosis'
import { formatBRLFromCents } from '../lib/money'

const localDate = () => new Date().toLocaleDateString('sv-SE')

export default function DiagnosticoPage() {
  const { currentCompany, configReady } = useAuth()
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [expenses, setExpenses] = useState<FixedExpenseRecord[]>([])
  const [variableCosts, setVariableCosts] = useState<VariableCostRecord[]>([])
  const [assetsLiabilities, setAssetsLiabilities] = useState<AssetLiabilityRecord[]>([])
  const [operatingSettings, setOperatingSettings] = useState<{
    working_days_per_month: number
    productive_hours_per_day: number
    revenue_forecast_cents: number | null
    pro_labore_cents: number | null
    default_desired_margin_percent: number | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const monthKey = localDate().slice(0, 7)

  // Load data
  useEffect(() => {
    if (!currentCompany?.id) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [prods, exps, vcs, settings, assets] = await Promise.all([
          listProducts(currentCompany.id),
          listExpenses(currentCompany.id),
          listVariableCosts(currentCompany.id),
          readOperatingSettings(currentCompany.id),
          listAssetsLiabilities(currentCompany.id)
        ])
        setProducts(prods)
        setExpenses(exps.filter(e => e.reference_date?.startsWith(monthKey)))
        setVariableCosts(vcs)
        setOperatingSettings(settings)
        setAssetsLiabilities(assets)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentCompany?.id, monthKey])

  // Calculate variable cost percentage
  const variableCostPercent = variableCosts.reduce((sum, vc) => sum + (vc.percent_value ?? 0), 0)

  // Run diagnosis
  const diagnosis = useFinancialDiagnosis({
    fixedExpenses: expenses,
    products,
    assetsLiabilities,
    variableCostPercent,
    workingDaysPerMonth: operatingSettings?.working_days_per_month ?? 30,
    productiveHoursPerDay: operatingSettings?.productive_hours_per_day ?? 8,
    proLaboreCents: operatingSettings?.pro_labore_cents ?? null,
    revenueForecastCents: operatingSettings?.revenue_forecast_cents ?? null,
    desiredMarginPercent: operatingSettings?.default_desired_margin_percent ?? 30
  })

  // Action checklist state (stored in localStorage per month)
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  
  useEffect(() => {
    const key = `diagnostico-checklist-${monthKey}`
    const stored = localStorage.getItem(key)
    setChecklist(stored ? JSON.parse(stored) : {})
  }, [monthKey])

  const toggleChecklistItem = (id: string) => {
    const key = `diagnostico-checklist-${monthKey}`
    const updated = { ...checklist, [id]: !checklist[id] }
    setChecklist(updated)
    localStorage.setItem(key, JSON.stringify(updated))
  }

  if (!configReady || loading) return <LoadingScreen label="Calculando diagnóstico financeiro" />
  if (error) return <div className="text-red-500">Erro: {error}</div>

  const currentRevenue = operatingSettings?.revenue_forecast_cents ?? 0
  const currentExpenses = expenses.reduce((sum, exp) => sum + (exp.amount_cents ?? 0), 0)

  // Health score color
  const healthColor = diagnosis.healthStatus === 'critical' ? '#F97316' : diagnosis.healthStatus === 'attention' ? '#EAB308' : '#10B981'
  const healthBgColor = diagnosis.healthStatus === 'critical' ? '#FFF7ED' : diagnosis.healthStatus === 'attention' ? '#FEFCE8' : '#ECFDF5'

  // Gauge data for radial chart
  const gaugeData = [
    {
      name: 'Score',
      value: diagnosis.healthScore,
      fill: healthColor
    }
  ]

  // Comparison chart data
  const comparisonData = [
    {
      category: 'Faturamento',
      atual: currentRevenue / 100,
      meta: diagnosis.idealRevenueCents / 100
    },
    {
      category: 'Despesas',
      atual: currentExpenses / 100,
      meta: diagnosis.idealExpensesCents / 100
    },
    {
      category: 'Lucro',
      atual: diagnosis.netProfitCents / 100,
      meta: diagnosis.idealProfitCents / 100
    }
  ]

  // Check for missing assets/liabilities
  const totalAssets = assetsLiabilities.filter(a => a.type === 'asset').reduce((sum, a) => sum + (a.amount_cents ?? 0), 0)
  const totalLiabilities = assetsLiabilities.filter(a => a.type === 'liability').reduce((sum, a) => sum + (a.amount_cents ?? 0), 0)
  const missingPatrimony = assetsLiabilities.length === 0 || (totalAssets === 0 && totalLiabilities === 0)

  // Calculate Real Average Profit Margin (based on current_price_cents, not recommended)
  const productsWithProfit = products.filter(p => (p.current_price_cents ?? 0) > 0)
  const realAverageProfitData = productsWithProfit.length > 0 ? productsWithProfit.reduce((acc, p) => {
    const price = p.current_price_cents ?? 0
    const cost = p.acquisition_cost_cents ?? 0
    const variableFees = price * ((p.variable_fees_percent ?? 0) / 100)
    const taxes = price * ((p.tax_percent ?? 0) / 100)
    const profit = price - cost - variableFees - taxes
    
    return {
      totalProfit: acc.totalProfit + profit,
      totalRevenue: acc.totalRevenue + price,
      count: acc.count + 1
    }
  }, { totalProfit: 0, totalRevenue: 0, count: 0 }) : null

  const realAverageProfitPercent = realAverageProfitData && realAverageProfitData.totalRevenue > 0 
    ? (realAverageProfitData.totalProfit / realAverageProfitData.totalRevenue) * 100 
    : 0
  const realAverageProfitCents = realAverageProfitData ? Math.round(realAverageProfitData.totalProfit / realAverageProfitData.count) : 0

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Single, Clean */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight" style={{ color: '#0D1F1A' }}>
          Diagnóstico Financeiro
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted">
          Raio-X cirúrgico da sua operação e plano de ação do CFO Digital.
        </p>
      </div>

      {/* Block 1: CFO Verdict - Compact 3-Zone Layout */}
      <div className="surface p-4 sm:p-6 relative overflow-hidden">
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-[200px_1fr_280px]">
          {/* Zone 1: Health Score Gauge */}
          <div className="flex flex-col items-center justify-center text-center">
            <ResponsiveContainer width="100%" height={140} minHeight={140}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="90%"
                barSize={14}
                data={gaugeData}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={10}
                  fill={healthColor}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="mt-[-80px] mb-[50px]">
              <p className="text-4xl font-extrabold" style={{ color: healthColor }}>
                {diagnosis.healthScore}
              </p>
              <p className="text-xs text-muted font-semibold">/ 100</p>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
              SAÚDE FINANCEIRA
            </p>
            <div
              className="mt-2 rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: healthBgColor, color: healthColor }}
            >
              {diagnosis.healthLabel}
            </div>
          </div>

          {/* Zone 2: Executive Insights */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider" style={{ color: '#1A3C34' }}>
              Insights Executivos
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs sm:text-sm">
                <div className="mt-0.5 size-1.5 rounded-full shrink-0" style={{ background: healthColor }} />
                <p>
                  <span className="font-semibold">
                    Margem de segurança {diagnosis.healthStatus === 'critical' ? 'crítica' : 'atual'}:
                  </span>{' '}
                  apenas <strong>{diagnosis.safetyMarginPercent.toFixed(1)}%</strong> (
                  {formatBRLFromCents(diagnosis.safetyMarginCents)}) acima do ponto de equilíbrio.
                </p>
              </div>
              <div className="flex items-start gap-2 text-xs sm:text-sm">
                <div className="mt-0.5 size-1.5 rounded-full shrink-0" style={{ background: healthColor }} />
                <p>
                  Você trabalha <strong>{diagnosis.daysToPayExpenses.toFixed(1)} dias</strong> do mês só para pagar contas.
                  Sobram <strong>{diagnosis.daysProfitable.toFixed(1)} dias</strong> para lucro real.
                </p>
              </div>
            </div>
          </div>

          {/* Zone 3: Hour Cost Highlight Box */}
          <div className="rounded-xl p-3 sm:p-4 border md:col-span-2 lg:col-span-1" style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} style={{ color: '#3D5048' }} />
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Custo da Hora Parada
              </span>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xl sm:text-2xl font-extrabold" style={{ color: '#0D1F1A' }}>
                  {formatBRLFromCents(diagnosis.costPerHourCents)}/h
                </p>
                <p className="text-[10px] sm:text-xs text-muted">Custo fixo por hora produtiva</p>
              </div>
              <div className="pt-2 sm:pt-3 border-t border-line">
                <p className="text-[10px] sm:text-xs font-semibold" style={{ color: '#DC2626' }}>
                  Impacto da Ociosidade
                </p>
                <p className="text-xs sm:text-sm font-bold" style={{ color: '#DC2626' }}>
                  2h ociosas/dia = -{formatBRLFromCents(diagnosis.idleCost2HoursCents)}/mês
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Block 2: Meta vs Reality + Audit */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Left: Meta vs Reality */}
        <div className="surface p-4 sm:p-6">
          <h2 className="text-sm sm:text-base font-bold" style={{ color: '#0D1F1A' }}>
            Meta vs. Realidade (Lucro {operatingSettings?.default_desired_margin_percent ?? 30}%)
          </h2>
          <div className="mt-4 h-[200px] sm:h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={comparisonData} 
                margin={{ top: 20, right: 10, bottom: 10, left: 10 }}
                barGap={6}
              >
                <defs>
                  {/* Gradiente para barras Atual (Cinza sofisticado) */}
                  <linearGradient id="gradientAtual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#64748B" stopOpacity={1} />
                    <stop offset="100%" stopColor="#475569" stopOpacity={0.9} />
                  </linearGradient>
                  {/* Gradiente para barras Meta (Verde premium) */}
                  <linearGradient id="gradientMeta" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.95} />
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="#E2E8F0" 
                  strokeOpacity={0.5}
                  vertical={false}
                />
                <XAxis 
                  dataKey="category" 
                  tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  contentStyle={{
                    background: 'linear-gradient(135deg, #F8FAF9 0%, #FFFFFF 100%)',
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    padding: '8px 12px'
                  }}
                  formatter={(value: number) => [
                    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    ''
                  ]}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                />
                <Bar 
                  dataKey="atual" 
                  fill="url(#gradientAtual)" 
                  name="Realidade" 
                  radius={[8, 8, 0, 0]} 
                  barSize={22}
                  label={{
                    position: 'top',
                    fill: '#475569',
                    fontSize: 11,
                    fontWeight: 700,
                    formatter: (value: number) => `R$ ${(value / 1000).toFixed(0)}k`
                  }}
                />
                <Bar 
                  dataKey="meta" 
                  fill="url(#gradientMeta)" 
                  name="Meta" 
                  radius={[8, 8, 0, 0]} 
                  barSize={22}
                  label={{
                    position: 'top',
                    fill: '#059669',
                    fontSize: 11,
                    fontWeight: 700,
                    formatter: (value: number) => `R$ ${(value / 1000).toFixed(0)}k`
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table - Columnar Layout */}
          <div className="mt-4 overflow-x-auto">
            <div className="grid grid-cols-[minmax(80px,1fr)_auto_auto] gap-2 sm:gap-3 text-xs sm:text-sm min-w-0">
              {/* Header Row */}
              <div className="font-bold text-xs uppercase tracking-wider text-muted"></div>
              <div className="font-bold text-xs uppercase tracking-wider text-center" style={{ color: '#64748B' }}>
                Realidade
              </div>
              <div className="font-bold text-xs uppercase tracking-wider text-center" style={{ color: '#10B981' }}>
                Meta
              </div>

              {/* Faturamento */}
              <div className="font-semibold py-2 border-t border-line truncate">Faturamento</div>
              <div className="py-2 border-t border-line text-right font-mono tabular-nums text-muted">
                {formatBRLFromCents(currentRevenue)}
              </div>
              <div className="py-2 border-t border-line text-right font-mono tabular-nums font-semibold" style={{ color: '#10B981' }}>
                {formatBRLFromCents(diagnosis.idealRevenueCents)}
                {diagnosis.revenueIncreaseNeeded > 0 && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    +{diagnosis.revenueIncreaseNeeded.toFixed(0)}%
                  </span>
                )}
              </div>

              {/* Despesas Fixas */}
              <div className="font-semibold py-2 border-t border-line truncate">Despesas Fixas</div>
              <div className="py-2 border-t border-line text-right font-mono tabular-nums text-muted">
                {formatBRLFromCents(currentExpenses)}
              </div>
              <div className="py-2 border-t border-line text-right font-mono tabular-nums font-semibold" style={{ color: '#10B981' }}>
                {formatBRLFromCents(diagnosis.idealExpensesCents)}
                {diagnosis.expenseCutNeeded > 0 && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">
                    -{formatBRLFromCents(diagnosis.expenseCutNeeded)}
                  </span>
                )}
              </div>

              {/* Lucro Líquido */}
              <div className="font-semibold py-2 border-t border-line truncate">Lucro Líquido</div>
              <div className="py-2 border-t border-line text-right font-mono tabular-nums text-muted">
                {formatBRLFromCents(diagnosis.netProfitCents)}
                <span className="ml-1 text-xs">
                  [{diagnosis.netProfitPercent.toFixed(1)}%]
                </span>
              </div>
              <div className="py-2 border-t border-line text-right font-mono tabular-nums font-semibold" style={{ color: '#10B981' }}>
                {formatBRLFromCents(diagnosis.idealProfitCents)}
                <span className="ml-1 text-xs">
                  [{operatingSettings?.default_desired_margin_percent ?? 30}%]
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Audit */}
        <div className="surface p-4 sm:p-6">
          <h2 className="text-sm sm:text-base font-bold" style={{ color: '#0D1F1A' }}>
            Auditoria & Inconsistências
          </h2>
          <div className="mt-4 space-y-2 sm:space-y-3">
            {diagnosis.suspiciousExpenses.length > 0 && (
              <div className="border-l-4 border-red-500 bg-red-50 p-3 sm:p-4 rounded-r-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5 sm:size-4" />
                  <div className="text-xs sm:text-sm">
                    <p className="font-bold text-red-900">Erro de Classificação Contábil</p>
                    <p className="mt-1 text-red-800">
                      {formatBRLFromCents(diagnosis.suspiciousExpenses.reduce((sum, e) => sum + e.value, 0))} em{' '}
                      <strong>"{diagnosis.suspiciousExpenses[0].description}"</strong> como Despesa Fixa. 
                      Isso infla seu ponto de equilíbrio.
                    </p>
                    <div className="mt-2 bg-cyan-50 border border-cyan-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-cyan-900">
                        Simulação: Ao corrigir, seu Ponto de Equilíbrio cai de{' '}
                        {formatBRLFromCents(diagnosis.breakEvenCents)} para{' '}
                        <strong>{formatBRLFromCents(diagnosis.simulatedBreakEvenCents)}</strong>.
                      </p>
                    </div>
                    <Link
                      to="/lancamentos"
                      className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-red-700 hover:text-red-900"
                    >
                      Corrigir lançamento
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {missingPatrimony && (
              <div className="border-l-4 border-amber-500 bg-amber-50 p-3 sm:p-4 rounded-r-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5 sm:size-4" />
                  <div className="text-xs sm:text-sm">
                    <p className="font-bold text-amber-900">Ponto Cego Patrimonial</p>
                    <p className="mt-1 text-amber-800">
                      Ativos e Passivos zerados impedem o cálculo de ROI.
                    </p>
                    <Link
                      to="/lancamentos"
                      className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-amber-700 hover:text-amber-900"
                    >
                      Configurar
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {diagnosis.suspiciousExpenses.length === 0 && !missingPatrimony && (
              <div className="border-l-4 border-emerald-500 bg-emerald-50 p-3 sm:p-4 rounded-r-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5 sm:size-4" />
                  <div className="text-xs sm:text-sm">
                    <p className="font-bold text-emerald-900">Auditoria Limpa</p>
                    <p className="mt-1 text-emerald-800">
                      Nenhuma inconsistência detectada nos lançamentos.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Block 2.5: Real Average Profit Margin */}
      <div className="surface p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold" style={{ color: '#0D1F1A' }}>
              Média de Lucro Real dos Produtos
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-muted">
              Baseado nos preços praticados atualmente ({productsWithProfit.length} produtos)
            </p>
          </div>
        </div>

        {productsWithProfit.length > 0 ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Average Profit Percent */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Lucro Médio %
              </p>
              <p className="mt-2 text-3xl font-extrabold" style={{ color: '#059669' }}>
                {realAverageProfitPercent.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                {realAverageProfitPercent >= (operatingSettings?.default_desired_margin_percent ?? 30) 
                  ? '✓ Acima da meta' 
                  : '⚠ Abaixo da meta'}
              </p>
            </div>

            {/* Average Profit Value */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Lucro Médio R$
              </p>
              <p className="mt-2 text-2xl font-extrabold text-blue-900">
                {formatBRLFromCents(realAverageProfitCents)}
              </p>
              <p className="mt-1 text-xs text-blue-700">
                por produto vendido
              </p>
            </div>

            {/* Total Products */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-700">
                Produtos Analisados
              </p>
              <p className="mt-2 text-3xl font-extrabold text-purple-900">
                {productsWithProfit.length}
              </p>
              <p className="mt-1 text-xs text-purple-700">
                com preço cadastrado
              </p>
            </div>

            {/* Comparison with Target */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                vs. Meta de Lucro
              </p>
              <p className="mt-2 text-3xl font-extrabold text-amber-900">
                {realAverageProfitPercent >= (operatingSettings?.default_desired_margin_percent ?? 30)
                  ? `+${(realAverageProfitPercent - (operatingSettings?.default_desired_margin_percent ?? 30)).toFixed(1)}`
                  : `${(realAverageProfitPercent - (operatingSettings?.default_desired_margin_percent ?? 30)).toFixed(1)}`}
                <span className="text-xl">pp</span>
              </p>
              <p className="mt-1 text-xs text-amber-700">
                pontos percentuais
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted">
            Nenhum produto com preço cadastrado. Acesse a aba <Link to="/precificacao" className="font-semibold underline">Precificação</Link> para adicionar produtos.
          </div>
        )}

        {/* Alert if below target */}
        {productsWithProfit.length > 0 && realAverageProfitPercent < (operatingSettings?.default_desired_margin_percent ?? 30) && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
            <strong>⚠ Atenção:</strong> Sua margem média real está {((operatingSettings?.default_desired_margin_percent ?? 30) - realAverageProfitPercent).toFixed(1)}pp abaixo da meta de {operatingSettings?.default_desired_margin_percent ?? 30}%. 
            Considere revisar os preços praticados ou reduzir custos.
          </div>
        )}
      </div>

      {/* Block 3: Revenue Distribution + Action Plan */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Left: Para Onde Vai Seu Faturamento */}
        <div className="surface p-4 sm:p-6">
          <h2 className="text-sm sm:text-base font-bold" style={{ color: '#0D1F1A' }}>
            Para Onde Vai Seu Faturamento
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            Distribuição de {formatBRLFromCents(currentRevenue)} previsto no mês
          </p>

          {currentRevenue > 0 ? (
            <>
              {/* Stacked Bar */}
              <div className="mt-4 space-y-2">
                <div className="relative h-10 sm:h-12 rounded-lg overflow-hidden" style={{ background: '#E2E8F0' }}>
                  {/* Custos Variáveis */}
                  <div
                    className="absolute top-0 left-0 h-full flex items-center justify-center text-white text-xs font-bold"
                    style={{
                      background: '#64748B',
                      width: `${variableCostPercent}%`
                    }}
                  >
                    {variableCostPercent > 8 && `${variableCostPercent.toFixed(1)}%`}
                  </div>
                  {/* Despesas Fixas */}
                  <div
                    className="absolute top-0 h-full flex items-center justify-center text-white text-xs font-bold"
                    style={{
                      background: '#F59E0B',
                      left: `${variableCostPercent}%`,
                      width: `${((currentExpenses / currentRevenue) * 100).toFixed(1)}%`
                    }}
                  >
                    {(currentExpenses / currentRevenue) * 100 > 8 && `${((currentExpenses / currentRevenue) * 100).toFixed(1)}%`}
                  </div>
                  {/* Lucro Líquido */}
                  <div
                    className="absolute top-0 right-0 h-full flex items-center justify-center text-white text-xs font-bold"
                    style={{
                      background: '#10B981',
                      width: `${diagnosis.netProfitPercent.toFixed(1)}%`
                    }}
                  >
                    {diagnosis.netProfitPercent > 8 && `${diagnosis.netProfitPercent.toFixed(1)}%`}
                  </div>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="size-3 rounded" style={{ background: '#64748B' }} />
                    <div>
                      <p className="font-semibold">Custos Variáveis</p>
                      <p className="text-muted">{formatBRLFromCents((currentRevenue * variableCostPercent) / 100)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-3 rounded" style={{ background: '#F59E0B' }} />
                    <div>
                      <p className="font-semibold">Despesas Fixas</p>
                      <p className="text-muted">{formatBRLFromCents(currentExpenses)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-3 rounded" style={{ background: '#10B981' }} />
                    <div>
                      <p className="font-semibold">Lucro Líquido</p>
                      <p className="text-muted">{formatBRLFromCents(diagnosis.netProfitCents)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Expenses Distribution Bar */}
              <div className="mt-4 pt-3 sm:pt-4 border-t border-line">
                <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted mb-2 sm:mb-3">
                  Distribuição de Despesas Fixas
                </h3>
                
                {/* Stacked Bar - Expenses Distribution */}
                <div className="space-y-2">
                  <div className="relative h-10 sm:h-12 rounded-lg overflow-hidden" style={{ background: '#E2E8F0' }}>
                    {expenses
                      .sort((a, b) => (b.amount_cents ?? 0) - (a.amount_cents ?? 0))
                      .reduce((acc, exp, idx) => {
                        const value = exp.amount_cents ?? 0
                        const percent = currentExpenses > 0 ? (value / currentExpenses) * 100 : 0
                        const colors = ['#DC2626', '#F59E0B', '#64748B', '#10B981', '#8B5CF6', '#06B6D4']
                        const color = colors[idx % colors.length]
                        
                        acc.bars.push(
                          <div
                            key={exp.id}
                            className="absolute top-0 h-full flex items-center justify-center text-white text-xs font-bold"
                            style={{
                              background: color,
                              left: `${acc.leftOffset}%`,
                              width: `${percent}%`
                            }}
                            title={`${exp.description}: ${percent.toFixed(1)}%`}
                          >
                            {percent > 8 && `${percent.toFixed(1)}%`}
                          </div>
                        )
                        
                        acc.leftOffset += percent
                        return acc
                      }, { bars: [] as JSX.Element[], leftOffset: 0 }).bars
                    }
                  </div>

                  {/* Legend */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                    {expenses
                      .sort((a, b) => (b.amount_cents ?? 0) - (a.amount_cents ?? 0))
                      .slice(0, 6)
                      .map((exp, idx) => {
                        const value = exp.amount_cents ?? 0
                        const percent = currentExpenses > 0 ? (value / currentExpenses) * 100 : 0
                        const colors = ['#DC2626', '#F59E0B', '#64748B', '#10B981', '#8B5CF6', '#06B6D4']
                        const color = colors[idx % colors.length]
                        
                        return (
                          <div key={exp.id} className="flex items-center gap-2">
                            <div className="size-3 rounded shrink-0" style={{ background: color }} />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate">{exp.description}</p>
                              <p className="text-muted">{formatBRLFromCents(value)} · {percent.toFixed(1)}%</p>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>

                {/* Top 3 List Below Bar */}
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted">
                    Top 3 Vilões do Orçamento
                  </p>
                  {expenses
                    .sort((a, b) => (b.amount_cents ?? 0) - (a.amount_cents ?? 0))
                    .slice(0, 3)
                    .map((exp, idx) => {
                      const value = exp.amount_cents ?? 0
                      const percentOfTotal = currentExpenses > 0 ? (value / currentExpenses) * 100 : 0
                      const percentOfRevenue = currentRevenue > 0 ? (value / currentRevenue) * 100 : 0
                      return (
                        <div key={exp.id} className="flex items-center gap-2 sm:gap-3 bg-slate-50 rounded-lg p-2">
                          <div
                            className="size-5 sm:size-6 shrink-0 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white"
                            style={{ background: idx === 0 ? '#DC2626' : idx === 1 ? '#F59E0B' : '#64748B' }}
                          >
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-semibold truncate">{exp.description}</p>
                            <p className="text-[10px] sm:text-xs text-muted">{exp.category}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs sm:text-sm font-bold">{formatBRLFromCents(value)}</p>
                            <p className="text-[10px] sm:text-xs font-semibold" style={{ color: '#F59E0B' }}>
                              {percentOfTotal.toFixed(1)}% das despesas
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted">{percentOfRevenue.toFixed(1)}% do FAT</p>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Critical Products Alert */}
              {diagnosis.criticalProductsCount > 0 && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-2 sm:p-3 text-[10px] sm:text-xs text-amber-900">
                  <strong>{diagnosis.criticalProductsCount} produtos</strong> com margem abaixo da mínima necessária.{' '}
                  <Link to="/precificacao" className="font-semibold underline hover:text-amber-700">
                    Revisar preços →
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="mt-4 text-center text-sm text-muted py-8">
              Configure a previsão de faturamento em Configurações para visualizar a distribuição.
            </div>
          )}
        </div>

        {/* Right: Action Plan */}
        <div className="surface p-4 sm:p-6">
          <h2 className="text-sm sm:text-base font-bold" style={{ color: '#0D1F1A' }}>
            Plano de Ação Priorizado
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            Checklist executivo para o mês
          </p>

          <div className="mt-4 space-y-2 sm:space-y-3">
            {diagnosis.suspiciousExpenses.length > 0 && (
              <label className="flex items-start gap-2 sm:gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checklist['reclassify'] || false}
                  onChange={() => toggleChecklistItem('reclassify')}
                  className="mt-1 size-3 sm:size-4 rounded border-line text-teal accent-teal shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-bold">
                      ALTO IMPACTO
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm font-semibold group-hover:text-teal">
                    Reclassificar {diagnosis.suspiciousExpenses.length} lançamento(s) suspeito(s) de custo variável
                  </p>
                  <p className="mt-0.5 text-[10px] sm:text-xs text-muted">
                    Reduz PE em {formatBRLFromCents(diagnosis.breakEvenCents - diagnosis.simulatedBreakEvenCents)}
                  </p>
                </div>
              </label>
            )}

            {diagnosis.criticalProductsCount > 0 && (
              <label className="flex items-start gap-2 sm:gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checklist['adjust-prices'] || false}
                  onChange={() => toggleChecklistItem('adjust-prices')}
                  className="mt-1 size-3 sm:size-4 rounded border-line text-teal accent-teal shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold">
                      MÉDIO IMPACTO
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm font-semibold group-hover:text-teal">
                    Reajustar preços de {diagnosis.criticalProductsCount} produtos críticos
                  </p>
                  <p className="mt-0.5 text-[10px] sm:text-xs text-muted">
                    Margem abaixo do necessário para atingir meta
                  </p>
                </div>
              </label>
            )}

            {diagnosis.highestMarginProduct && (
              <label className="flex items-start gap-2 sm:gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checklist['focus-champions'] || false}
                  onChange={() => toggleChecklistItem('focus-champions')}
                  className="mt-1 size-4 rounded border-line text-teal accent-teal"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                      CRESCIMENTO
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold group-hover:text-teal">
                    Focar esforços comerciais em produtos campeões
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Produto top: {diagnosis.highestMarginProduct.name} ({diagnosis.highestMarginProduct.marginPercent.toFixed(1)}% margem)
                  </p>
                </div>
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
