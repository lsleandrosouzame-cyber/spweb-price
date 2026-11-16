import { useEffect, useState } from 'react'
import { Clock, AlertTriangle, CheckCircle2, ChevronRight, Package } from 'lucide-react'
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
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">SPWEB LUCRO / DIAGNÓSTICO</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: '#0D1F1A' }}>
            Diagnóstico Financeiro
          </h1>
          <p className="mt-1 text-sm text-muted">
            Raio-X cirúrgico da sua operação e plano de ação do CFO Digital.
          </p>
        </div>
      </div>

      {/* Block 1: CFO Verdict */}
      <div className="surface p-4 sm:p-6 relative overflow-hidden">
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          {/* Left: Health Score Gauge */}
          <div className="flex flex-col items-center justify-center text-center">
            <ResponsiveContainer width="100%" height={180}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="90%"
                barSize={16}
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
            <div className="mt-[-90px] mb-[60px]">
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

          {/* Right: Insights */}
          <div className="space-y-4">
            {/* Hour cost pill */}
            <div className="flex items-center gap-2 text-xs" style={{ color: '#3D5048' }}>
              <Clock size={14} />
              <span className="font-semibold">
                Custo da Hora Parada: {formatBRLFromCents(diagnosis.costPerHourCents)}/h
              </span>
              <span className="text-muted">
                (2h ociosas/dia = -{formatBRLFromCents(diagnosis.idleCost2HoursCents)}/mês)
              </span>
            </div>

            {/* Executive insights */}
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
              <BarChart data={comparisonData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
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
                <Bar dataKey="atual" fill="#64748B" name="Atual" radius={[6, 6, 0, 0]} />
                <Bar dataKey="meta" fill="#10B981" name="Meta" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="font-semibold">Faturamento</span>
              <div className="flex items-center gap-3">
                <span className="text-muted">{formatBRLFromCents(currentRevenue)}</span>
                <span>→</span>
                <span className="font-semibold" style={{ color: '#10B981' }}>
                  {formatBRLFromCents(diagnosis.idealRevenueCents)}
                </span>
                {diagnosis.revenueIncreaseNeeded > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    +{diagnosis.revenueIncreaseNeeded.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="font-semibold">Despesas Fixas</span>
              <div className="flex items-center gap-3">
                <span className="text-muted">{formatBRLFromCents(currentExpenses)}</span>
                <span>→</span>
                <span className="font-semibold" style={{ color: '#10B981' }}>
                  {formatBRLFromCents(diagnosis.idealExpensesCents)}
                </span>
                {diagnosis.expenseCutNeeded > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                    -{formatBRLFromCents(diagnosis.expenseCutNeeded)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Lucro Líquido</span>
              <div className="flex items-center gap-3">
                <span className="text-muted">
                  {formatBRLFromCents(diagnosis.netProfitCents)} [{diagnosis.netProfitPercent.toFixed(1)}%]
                </span>
                <span>→</span>
                <span className="font-semibold" style={{ color: '#10B981' }}>
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

      {/* Block 3: Product Mix + Action Plan */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left: Product Mix */}
        <div className="surface p-4 sm:p-6">
          <h2 className="text-base font-bold" style={{ color: '#0D1F1A' }}>
            Mix de Sobrevivência
          </h2>
          <p className="mt-1 text-sm text-muted">
            Para pagar {formatBRLFromCents(currentExpenses)}, precisa vender:
          </p>

          {diagnosis.lowestMarginProduct && diagnosis.highestMarginProduct ? (
            <div className="mt-4 flex items-center gap-3">
              {/* Lowest margin */}
              <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <Package size={20} className="mx-auto text-red-600" />
                <p className="mt-2 text-2xl font-extrabold text-red-900">
                  {diagnosis.lowestMarginProduct.quantityToPayExpenses.toLocaleString('pt-BR')}
                </p>
                <p className="mt-1 text-xs font-semibold text-red-800 truncate">
                  {diagnosis.lowestMarginProduct.name}
                </p>
                <span className="mt-2 inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                  {diagnosis.lowestMarginProduct.marginPercent.toFixed(1)}% margem
                </span>
              </div>

              {/* VS */}
              <div className="shrink-0 text-sm font-bold text-muted">vs</div>

              {/* Highest margin */}
              <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <Package size={20} className="mx-auto text-emerald-600" />
                <p className="mt-2 text-2xl font-extrabold text-emerald-900">
                  {diagnosis.highestMarginProduct.quantityToPayExpenses.toLocaleString('pt-BR')}
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-800 truncate">
                  {diagnosis.highestMarginProduct.name}
                </p>
                <span className="mt-2 inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                  {diagnosis.highestMarginProduct.marginPercent.toFixed(1)}% margem
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-center text-sm text-muted py-8">
              Nenhum produto cadastrado com margem positiva.
            </div>
          )}

          {diagnosis.criticalProductsCount > 0 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
              <strong>{diagnosis.criticalProductsCount} produtos críticos</strong> com margem abaixo da mínima necessária.
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
