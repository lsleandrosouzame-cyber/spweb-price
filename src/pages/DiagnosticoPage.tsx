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

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Single, Clean */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: '#0D1F1A' }}>
          Diagnóstico Financeiro
        </h1>
        <p className="mt-1 text-sm text-muted">
          Raio-X cirúrgico da sua operação e plano de ação do CFO Digital.
        </p>
      </div>

      {/* Block 1: CFO Verdict - Compact 3-Zone Layout */}
      <div className="surface p-6 relative overflow-hidden">
        <div className="grid gap-6 md:grid-cols-[200px_1fr_280px]">
          {/* Zone 1: Health Score Gauge */}
          <div className="flex flex-col items-center justify-center text-center">
            <ResponsiveContainer width="100%" height={160}>
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
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#1A3C34' }}>
              Insights Executivos
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <div className="mt-0.5 size-1.5 rounded-full shrink-0" style={{ background: healthColor }} />
                <p>
                  <span className="font-semibold">
                    Margem de segurança {diagnosis.healthStatus === 'critical' ? 'crítica' : 'atual'}:
                  </span>{' '}
                  apenas <strong>{diagnosis.safetyMarginPercent.toFixed(1)}%</strong> (
                  {formatBRLFromCents(diagnosis.safetyMarginCents)}) acima do ponto de equilíbrio.
                </p>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <div className="mt-0.5 size-1.5 rounded-full shrink-0" style={{ background: healthColor }} />
                <p>
                  Você trabalha <strong>{diagnosis.daysToPayExpenses.toFixed(1)} dias</strong> do mês só para pagar contas.
                  Sobram <strong>{diagnosis.daysProfitable.toFixed(1)} dias</strong> para lucro real.
                </p>
              </div>
            </div>
          </div>

          {/* Zone 3: Hour Cost Highlight Box */}
          <div className="rounded-xl p-4 border" style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} style={{ color: '#3D5048' }} />
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Custo da Hora Parada
              </span>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-2xl font-extrabold" style={{ color: '#0D1F1A' }}>
                  {formatBRLFromCents(diagnosis.costPerHourCents)}/h
                </p>
                <p className="text-xs text-muted">Custo fixo por hora produtiva</p>
              </div>
              <div className="pt-3 border-t border-line">
                <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>
                  Impacto da Ociosidade
                </p>
                <p className="text-sm font-bold" style={{ color: '#DC2626' }}>
                  2h ociosas/dia = -{formatBRLFromCents(diagnosis.idleCost2HoursCents)}/mês
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Block 2: Meta vs Reality + Audit */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left: Meta vs Reality */}
        <div className="surface p-4 sm:p-6">
          <h2 className="text-base font-bold" style={{ color: '#0D1F1A' }}>
            Meta vs. Realidade (Lucro {operatingSettings?.default_desired_margin_percent ?? 30}%)
          </h2>
          <div className="mt-4 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 20, right: 10, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#6B7E78' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7E78' }} />
                <RechartsTooltip
                  contentStyle={{
                    background: '#F8FAF9',
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    fontSize: 12
                  }}
                  formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <Bar dataKey="atual" fill="#64748B" name="Atual" radius={[6, 6, 0, 0]} barSize={32}>
                  {/* @ts-ignore */}
                  {comparisonData.map((entry, index) => (
                    <text
                      key={`label-atual-${index}`}
                      x={0}
                      y={0}
                      fill="#64748B"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={10}
                      fontWeight="600"
                    />
                  ))}
                </Bar>
                <Bar dataKey="meta" fill="#10B981" name="Meta" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="mt-4 space-y-2 text-sm font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="font-semibold">Faturamento</span>
              <div className="flex items-center gap-3">
                <span className="text-muted tabular-nums">{formatBRLFromCents(currentRevenue)}</span>
                <span>→</span>
                <span className="font-semibold tabular-nums" style={{ color: '#10B981' }}>
                  {formatBRLFromCents(diagnosis.idealRevenueCents)}
                </span>
                {diagnosis.revenueIncreaseNeeded > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 tabular-nums">
                    +{diagnosis.revenueIncreaseNeeded.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="font-semibold">Despesas Fixas</span>
              <div className="flex items-center gap-3">
                <span className="text-muted tabular-nums">{formatBRLFromCents(currentExpenses)}</span>
                <span>→</span>
                <span className="font-semibold tabular-nums" style={{ color: '#10B981' }}>
                  {formatBRLFromCents(diagnosis.idealExpensesCents)}
                </span>
                {diagnosis.expenseCutNeeded > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 tabular-nums">
                    -{formatBRLFromCents(diagnosis.expenseCutNeeded)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Lucro Líquido</span>
              <div className="flex items-center gap-3">
                <span className="text-muted tabular-nums">
                  {formatBRLFromCents(diagnosis.netProfitCents)} [{diagnosis.netProfitPercent.toFixed(1)}%]
                </span>
                <span>→</span>
                <span className="font-semibold tabular-nums" style={{ color: '#10B981' }}>
                  {formatBRLFromCents(diagnosis.idealProfitCents)} [{operatingSettings?.default_desired_margin_percent ?? 30}%]
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Audit */}
        <div className="surface p-4 sm:p-6">
          <h2 className="text-base font-bold" style={{ color: '#0D1F1A' }}>
            Auditoria & Inconsistências
          </h2>
          <div className="mt-4 space-y-3">
            {diagnosis.suspiciousExpenses.length > 0 && (
              <div className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
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
              <div className="border-l-4 border-amber-500 bg-amber-50 p-4 rounded-r-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
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
              <div className="border-l-4 border-emerald-500 bg-emerald-50 p-4 rounded-r-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
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

      {/* Block 3: Revenue Distribution + Action Plan */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left: Para Onde Vai Seu Faturamento */}
        <div className="surface p-4 sm:p-6">
          <h2 className="text-base font-bold" style={{ color: '#0D1F1A' }}>
            Para Onde Vai Seu Faturamento
          </h2>
          <p className="mt-1 text-sm text-muted">
            Distribuição de {formatBRLFromCents(currentRevenue)} previsto no mês
          </p>

          {currentRevenue > 0 ? (
            <>
              {/* Stacked Bar */}
              <div className="mt-4 space-y-2">
                <div className="relative h-12 rounded-lg overflow-hidden" style={{ background: '#E2E8F0' }}>
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
                <div className="grid grid-cols-3 gap-2 text-xs">
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

              {/* Top 3 Expense Villains */}
              <div className="mt-4 pt-4 border-t border-line">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
                  Top 3 Vilões do Orçamento
                </h3>
                <div className="space-y-2">
                  {expenses
                    .sort((a, b) => (b.amount_cents ?? 0) - (a.amount_cents ?? 0))
                    .slice(0, 3)
                    .map((exp, idx) => {
                      const value = exp.amount_cents ?? 0
                      const percentOfRevenue = currentRevenue > 0 ? (value / currentRevenue) * 100 : 0
                      return (
                        <div key={exp.id} className="flex items-center gap-3">
                          <div
                            className="size-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{ background: idx === 0 ? '#DC2626' : idx === 1 ? '#F59E0B' : '#64748B' }}
                          >
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{exp.description}</p>
                            <p className="text-xs text-muted">{exp.category}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{formatBRLFromCents(value)}</p>
                            <p className="text-xs text-muted">{percentOfRevenue.toFixed(1)}% do FAT</p>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Critical Products Alert */}
              {diagnosis.criticalProductsCount > 0 && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
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
          <h2 className="text-base font-bold" style={{ color: '#0D1F1A' }}>
            Plano de Ação Priorizado
          </h2>
          <p className="mt-1 text-sm text-muted">
            Checklist executivo para o mês
          </p>

          <div className="mt-4 space-y-3">
            {diagnosis.suspiciousExpenses.length > 0 && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checklist['reclassify'] || false}
                  onChange={() => toggleChecklistItem('reclassify')}
                  className="mt-1 size-4 rounded border-line text-teal accent-teal"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-bold">
                      ALTO IMPACTO
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold group-hover:text-teal">
                    Reclassificar {diagnosis.suspiciousExpenses.length} lançamento(s) suspeito(s) de custo variável
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Reduz PE em {formatBRLFromCents(diagnosis.breakEvenCents - diagnosis.simulatedBreakEvenCents)}
                  </p>
                </div>
              </label>
            )}

            {diagnosis.criticalProductsCount > 0 && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checklist['adjust-prices'] || false}
                  onChange={() => toggleChecklistItem('adjust-prices')}
                  className="mt-1 size-4 rounded border-line text-teal accent-teal"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold">
                      MÉDIO IMPACTO
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold group-hover:text-teal">
                    Reajustar preços de {diagnosis.criticalProductsCount} produtos críticos
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Margem abaixo do necessário para atingir meta
                  </p>
                </div>
              </label>
            )}

            {diagnosis.highestMarginProduct && (
              <label className="flex items-start gap-3 cursor-pointer group">
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
