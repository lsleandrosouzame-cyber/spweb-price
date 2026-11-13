import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BarChart3, CalendarDays, CircleDollarSign, Clock3, LoaderCircle, Plus, ReceiptText, Search, Trash2, Wallet, Pencil, TrendingDown, Scale, TrendingUp } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState, InlineNotice, LoadingScreen } from '../components/Feedback'
import { CurrencyInput } from '../components/CurrencyInput'
import { Modal } from '../components/Modal'
import { calculateBreakEven, calculateOperatingCosts } from '../finance/operations'
import { formatBRLFromCents, parseBrazilianCurrency } from '../lib/money'
import { listExpenses, listProducts, listSalesRecords, listServices, listVariableCosts, readOperatingSettings, removeExpense, removeVariableCost, saveExpense, saveOperatingSettings, saveVariableCost, listAssetsLiabilities, saveAssetLiability, removeAssetLiability } from '../services/companyData'
import type { FixedExpenseDraft, FixedExpenseRecord, ProductRecord, SalesRecord, ServiceRecord, VariableCostDraft, VariableCostRecord, AssetLiabilityRecord, AssetLiabilityDraft } from '../types/database'

const categories = ['Aluguel', 'Energia', 'Água', 'Internet', 'Salários', 'Pró-labore', 'Contabilidade', 'Sistemas', 'Marketing', 'Outras despesas']
const costTypes = ['Taxa', 'Comissão', 'Frete', 'Embalagem', 'Outros'] as const
// Rich color palette for expenses chart
const PIE_COLORS_EXP = ['#D4AF37', '#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f59e0b']
const today = () => new Date().toLocaleDateString('sv-SE')
const currentMonth = () => today().slice(0, 7)
const firstDay = (month: string) => `${month}-01`
const blankExpense = { description: '', category: categories[0], amount: '', date: today(), notes: '' }
const blankVariableCost = { description: '', costType: 'Taxa' as typeof costTypes[number], valueType: 'percent' as 'percent' | 'fixed', percentValue: '', fixedValue: '', notes: '' }
const labelClass = 'mb-2 block text-xs font-medium text-paper'

export default function ExpensesPage() {
  const { currentCompany } = useAuth()
  const [tab, setTab] = useState<'expenses' | 'variableCosts' | 'assetsLiabilities'>('expenses')
  const [month, setMonth] = useState(currentMonth())
  const [expenses, setExpenses] = useState<FixedExpenseRecord[]>([])
  const [variableCosts, setVariableCosts] = useState<VariableCostRecord[]>([])
  const [assetsLiabilities, setAssetsLiabilities] = useState<AssetLiabilityRecord[]>([])
  const [sales, setSales] = useState<SalesRecord[]>([])
  const [products, setProducts] = useState<ProductRecord[]>([]); void products
  const [services, setServices] = useState<ServiceRecord[]>([]); void services

  // operational settings
  const [workingDays, setWorkingDays] = useState('')
  const [productiveHours, setProductiveHours] = useState('')
  const [revenueForecast, setRevenueForecast] = useState('')
  const [proLabore, setProLabore] = useState('')
  const [defaultVariableFees] = useState('')
  const [defaultTaxRate] = useState('')
  const [defaultDesiredMargin] = useState('')
  void defaultVariableFees; void defaultTaxRate; void defaultDesiredMargin
  const [settingsSaved, setSettingsSaved] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [expenseSearch, setExpenseSearch] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('')
  const [busy, setBusy] = useState(false)

  // inline forms
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editing, setEditing] = useState<FixedExpenseRecord | null>(null)
  const [expenseForm, setExpenseForm] = useState(blankExpense)
  const [showSaleForm] = useState(false); void showSaleForm
  const [salesForm] = useState({ item: '', quantity: '1', price: '', date: today() }); void salesForm

  // Variable costs forms
  const [showVariableCostForm, setShowVariableCostForm] = useState(false)
  const [editingVarCost, setEditingVarCost] = useState<VariableCostRecord | null>(null)
  const [varCostForm, setVarCostForm] = useState(blankVariableCost)

  // Assets/Liabilities forms
  const [showAssetLiabilityForm, setShowAssetLiabilityForm] = useState(false)
  const [editingAssetLiability, setEditingAssetLiability] = useState<AssetLiabilityRecord | null>(null)
  const [assetLiabilityForm, setAssetLiabilityForm] = useState({
    type: 'asset' as 'asset' | 'liability',
    description: '',
    amount: '',
    date: today(),
    notes: '',
    repeatMonths: '1'
  })
  
  const [expenseFormRepeat, setExpenseFormRepeat] = useState('1')

  const refresh = useCallback(async () => {
    if (!currentCompany) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      // Load data with individual error handling
      const [expensesResult, variableCostsResult, productsResult, servicesResult, settingsResult, salesResult] = await Promise.all([
        listExpenses(currentCompany.id),
        listVariableCosts(currentCompany.id),
        listProducts(currentCompany.id),
        listServices(currentCompany.id),
        readOperatingSettings(currentCompany.id),
        listSalesRecords(currentCompany.id, firstDay(month)),
      ])
      
      setExpenses(expensesResult)
      setVariableCosts(variableCostsResult)
      setProducts(productsResult)
      setServices(servicesResult)
      setSales(salesResult)
      
      // Load assets/liabilities separately to avoid blocking other data
      try {
        const assetsLiabilitiesResult = await listAssetsLiabilities(currentCompany.id)
        setAssetsLiabilities(assetsLiabilitiesResult)
      } catch (alError) {
        console.warn('Assets/Liabilities table may not exist yet:', alError)
        setAssetsLiabilities([])
      }
      
      if (settingsResult) {
        setWorkingDays(String(settingsResult.working_days_per_month))
        setProductiveHours(String(settingsResult.productive_hours_per_day))
        setRevenueForecast(settingsResult.revenue_forecast_cents
          ? (settingsResult.revenue_forecast_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          : '')
        setProLabore(settingsResult.pro_labore_cents
          ? (settingsResult.pro_labore_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          : '')
        setSettingsSaved(true)
      }
    } catch (cause) {
      console.error('Error loading data:', cause)
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os lançamentos.')
    } finally { setLoading(false) }
  }, [currentCompany?.id, month])

  useEffect(() => { void refresh() }, [refresh])

  const expenseRows = useMemo(() => expenses.filter(row => row.reference_date.startsWith(month)), [expenses, month])
  const filteredExpenseRows = useMemo(() => expenseRows.filter(row =>
    row.description.toLowerCase().includes(expenseSearch.toLowerCase()) &&
    (!expenseCategory || row.category === expenseCategory)
  ), [expenseRows, expenseSearch, expenseCategory])
  const salesRows = useMemo(() => sales.filter(row => row.sold_on.startsWith(month)), [sales, month])

  const fixedTotal = expenseRows.length ? expenseRows.reduce((sum, row) => sum + Number(row.amount_cents), 0) : null

  // Pro-labore derived values
  const proLaboreCents = proLabore ? parseBrazilianCurrency(proLabore) : null
  const workingDaysNum = workingDays ? Number(workingDays) : null
  const productiveHoursNum = productiveHours ? Number(productiveHours) : null

  const operating = fixedTotal !== null && workingDaysNum && productiveHoursNum
    ? (() => { try { return calculateOperatingCosts(fixedTotal, workingDaysNum, productiveHoursNum) } catch { return null } })()
    : null

  // Calculate pró-labore per day for dashboard
  const proLaborePerDayCents = proLaboreCents && workingDaysNum && workingDaysNum > 0 ? proLaboreCents / workingDaysNum : null

  const chartData = Object.values(
    expenseRows.reduce<Record<string, { name: string; value: number }>>((acc, row) => {
      const entry = acc[row.category] ?? { name: row.category, value: 0 }
      entry.value += Number(row.amount_cents)
      acc[row.category] = entry
      return acc
    }, {})
  ).sort((a, b) => b.value - a.value)

  // Break-even calculation
  const totalRevenue = salesRows.reduce((sum, row) => sum + Number(row.selling_price_cents) * Number(row.quantity), 0)
  const totalContribution = salesRows.reduce((sum, row) => sum + Number(row.contribution_cents) * Number(row.quantity), 0)
  const weightedMarginPercent = totalRevenue > 0 ? (totalContribution / totalRevenue) * 100 : null

  // Calculate total variable costs percentage from Variable Costs tab
  const totalVariableCostsPercent = variableCosts
    .filter(vc => vc.percent_value !== null)
    .reduce((sum, vc) => sum + Number(vc.percent_value), 0)

  // Break-even calculation using variable costs
  const effectiveMarginPct = weightedMarginPercent ?? (totalVariableCostsPercent > 0 ? Math.max(0, 100 - totalVariableCostsPercent) : null)

  const breakEvenResult = fixedTotal !== null && effectiveMarginPct !== null && effectiveMarginPct > 0
    ? (() => {
        const mix = salesRows.map(s => ({ sellingPriceCents: Number(s.selling_price_cents), contributionCents: Number(s.contribution_cents), quantity: Number(s.quantity) }))
        if (mix.length > 0) return calculateBreakEven(fixedTotal, mix)
        // No sales: use default margin to estimate break-even
        return {
          weightedContributionMarginPercent: effectiveMarginPct,
          breakEvenRevenueCents: fixedTotal / (effectiveMarginPct / 100),
          referenceRevenueCents: 0,
          remainingRevenueCents: fixedTotal / (effectiveMarginPct / 100),
          progressPercent: 0,
        }
      })()
    : null

  const breakEvenRevenueCents = breakEvenResult?.breakEvenRevenueCents ?? null

  async function saveSettings(event: FormEvent) {
    event.preventDefault()
    if (!currentCompany) return
    const days = Number(workingDays)
    const hours = Number(productiveHours)
    if (!Number.isInteger(days) || days < 1 || days > 31) {
      setError('Informe entre 1 e 31 dias trabalhados por mês.')
      return
    }
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      setError('Informe horas trabalhadas por dia entre 0,01 e 24.')
      return
    }
    const forecastValue = revenueForecast ? parseBrazilianCurrency(revenueForecast) : null
    const proLaboreValue = proLabore ? parseBrazilianCurrency(proLabore) : null
    setBusy(true); setError(null)
    try {
      await saveOperatingSettings(currentCompany.id, {
        working_days_per_month: days,
        productive_hours_per_day: hours,
        revenue_forecast_cents: forecastValue,
        pro_labore_cents: proLaboreValue,
      })
      setSettingsSaved(true)
      setNotice('Parâmetros operacionais salvos.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar os parâmetros.')
    } finally { setBusy(false) }
  }

  function startExpense(row?: FixedExpenseRecord) {
    setEditing(row ?? null)
    setExpenseForm(row
      ? { description: row.description, category: row.category, amount: (Number(row.amount_cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), date: row.reference_date, notes: row.notes ?? '' }
      : blankExpense)
    setExpenseFormRepeat('1')
    setError(null)
    setShowExpenseForm(true)
  }

  async function submitExpense(event: FormEvent) {
    event.preventDefault()
    if (!currentCompany) return
    const cents = parseBrazilianCurrency(expenseForm.amount)
    if (!expenseForm.description.trim() || cents === null || cents < 0) {
      setError('Informe descrição e valor válido.'); return
    }

    const repeatMonths = parseInt(expenseFormRepeat) || 1
    if (repeatMonths < 1 || repeatMonths > 60) {
      setError('Informe entre 1 e 60 meses.'); return
    }

    setBusy(true); setError(null)
    try {
      // Se estiver editando, apenas atualiza o registro existente
      if (editing) {
        const draft: FixedExpenseDraft = { 
          description: expenseForm.description.trim(), 
          category: expenseForm.category, 
          amount_cents: cents, 
          reference_date: expenseForm.date, 
          notes: expenseForm.notes.trim() || null 
        }
        await saveExpense(currentCompany.id, draft, editing.id)
        setNotice('Despesa atualizada.')
      } else {
        // Se for novo, cria múltiplos registros (um para cada mês)
        const baseDate = new Date(expenseForm.date + 'T12:00:00')
        for (let i = 0; i < repeatMonths; i++) {
          const currentDate = new Date(baseDate)
          currentDate.setMonth(currentDate.getMonth() + i)
          const refDate = currentDate.toISOString().split('T')[0]
          
          const draft: FixedExpenseDraft = { 
            description: expenseForm.description.trim(), 
            category: expenseForm.category, 
            amount_cents: cents, 
            reference_date: refDate, 
            notes: expenseForm.notes.trim() || null 
          }
          await saveExpense(currentCompany.id, draft)
        }
        setNotice(repeatMonths > 1 ? `${repeatMonths} despesas criadas.` : 'Despesa registrada.')
      }
      
      setShowExpenseForm(false)
      await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a despesa.') }
    finally { setBusy(false) }
  }

  async function deleteExpense(row: FixedExpenseRecord) {
    if (!currentCompany || !window.confirm(`Excluir a despesa "${row.description}"?`)) return
    try { await removeExpense(currentCompany.id, row.id); setNotice('Despesa excluída.'); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao excluir.') }
  }

  // Variable costs CRUD
  function startVariableCost(row?: VariableCostRecord) {
    setEditingVarCost(row ?? null)
    setVarCostForm(row
      ? { 
          description: row.description, 
          costType: row.cost_type as typeof costTypes[number], 
          valueType: row.percent_value !== null ? 'percent' : 'fixed',
          percentValue: row.percent_value !== null ? String(row.percent_value) : '',
          fixedValue: row.fixed_value_cents !== null ? (Number(row.fixed_value_cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
          notes: row.notes ?? '' 
        }
      : blankVariableCost)
    setError(null)
    setShowVariableCostForm(true)
  }

  async function submitVariableCost(event: FormEvent) {
    event.preventDefault()
    if (!currentCompany) return
    
    if (!varCostForm.description.trim()) {
      setError('Informe a descrição do custo.'); return
    }

    let draft: VariableCostDraft
    
    if (varCostForm.valueType === 'percent') {
      const percentVal = parseFloat(varCostForm.percentValue)
      if (isNaN(percentVal) || percentVal < 0 || percentVal > 100) {
        setError('Informe um percentual válido entre 0 e 100.'); return
      }
      draft = {
        description: varCostForm.description.trim(),
        cost_type: varCostForm.costType,
        percent_value: percentVal,
        fixed_value_cents: null,
        notes: varCostForm.notes.trim() || null
      }
    } else {
      const cents = parseBrazilianCurrency(varCostForm.fixedValue)
      if (cents === null || cents < 0) {
        setError('Informe um valor fixo válido.'); return
      }
      draft = {
        description: varCostForm.description.trim(),
        cost_type: varCostForm.costType,
        percent_value: null,
        fixed_value_cents: cents,
        notes: varCostForm.notes.trim() || null
      }
    }

    setBusy(true); setError(null)
    try {
      await saveVariableCost(currentCompany.id, draft, editingVarCost?.id)
      setShowVariableCostForm(false)
      setEditingVarCost(null)
      setNotice(editingVarCost ? 'Custo variável atualizado.' : 'Custo variável registrado.')
      await refresh()
    } catch (cause) { 
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o custo variável.') 
    } finally { 
      setBusy(false) 
    }
  }

  async function deleteVariableCost(row: VariableCostRecord) {
    if (!currentCompany || !window.confirm(`Excluir o custo variável "${row.description}"?`)) return
    try { 
      await removeVariableCost(currentCompany.id, row.id); 
      setNotice('Custo variável excluído.'); 
      await refresh() 
    } catch (cause) { 
      setError(cause instanceof Error ? cause.message : 'Falha ao excluir.') 
    }
  }

  // Assets/Liabilities CRUD
  function startAssetLiability(row?: AssetLiabilityRecord) {
    setEditingAssetLiability(row ?? null)
    setAssetLiabilityForm(row
      ? { 
          type: row.type, 
          description: row.description, 
          amount: (Number(row.amount_cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), 
          date: row.reference_date, 
          notes: row.notes ?? '',
          repeatMonths: '1'
        }
      : { type: 'asset' as 'asset' | 'liability', description: '', amount: '', date: today(), notes: '', repeatMonths: '1' })
    setError(null)
    setShowAssetLiabilityForm(true)
  }

  async function submitAssetLiability(event: FormEvent) {
    event.preventDefault()
    if (!currentCompany) return
    
    const cents = parseBrazilianCurrency(assetLiabilityForm.amount)
    if (!assetLiabilityForm.description.trim() || cents === null || cents < 0) {
      setError('Informe descrição e valor válido.'); return
    }

    const repeatMonths = parseInt(assetLiabilityForm.repeatMonths) || 1
    if (repeatMonths < 1 || repeatMonths > 60) {
      setError('Informe entre 1 e 60 meses.'); return
    }

    setBusy(true); setError(null)
    try {
      // Se estiver editando, apenas atualiza o registro existente
      if (editingAssetLiability) {
        const draft: AssetLiabilityDraft = {
          type: assetLiabilityForm.type,
          description: assetLiabilityForm.description.trim(),
          amount_cents: cents,
          reference_date: assetLiabilityForm.date,
          notes: assetLiabilityForm.notes.trim() || null
        }
        await saveAssetLiability(currentCompany.id, draft, editingAssetLiability.id)
        setNotice('Atualizado.')
      } else {
        // Se for novo, cria múltiplos registros (um para cada mês)
        const baseDate = new Date(assetLiabilityForm.date + 'T12:00:00')
        for (let i = 0; i < repeatMonths; i++) {
          const currentDate = new Date(baseDate)
          currentDate.setMonth(currentDate.getMonth() + i)
          const refDate = currentDate.toISOString().split('T')[0]
          
          const draft: AssetLiabilityDraft = {
            type: assetLiabilityForm.type,
            description: assetLiabilityForm.description.trim(),
            amount_cents: cents,
            reference_date: refDate,
            notes: assetLiabilityForm.notes.trim() || null
          }
          await saveAssetLiability(currentCompany.id, draft)
        }
        setNotice(repeatMonths > 1 ? `${repeatMonths} lançamentos criados.` : 'Registrado.')
      }
      
      setShowAssetLiabilityForm(false)
      setEditingAssetLiability(null)
      await refresh()
    } catch (cause) {
      console.error('Error saving asset/liability:', cause)
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.') 
    } finally { 
      setBusy(false) 
    }
  }

  async function deleteAssetLiability(row: AssetLiabilityRecord) {
    if (!currentCompany || !window.confirm(`Excluir "${row.description}"?`)) return
    try { 
      await removeAssetLiability(currentCompany.id, row.id); 
      setNotice('Excluído.'); 
      await refresh() 
    } catch (cause) { 
      setError(cause instanceof Error ? cause.message : 'Falha ao excluir.') 
    }
  }

  // Separate assets and liabilities - filtered by current month
  const monthAssetsLiabilities = assetsLiabilities.filter(al => al.reference_date.startsWith(month))
  const assets = monthAssetsLiabilities.filter(al => al.type === 'asset')
  const liabilities = monthAssetsLiabilities.filter(al => al.type === 'liability')
  const totalAssetsCents = assets.reduce((sum, a) => sum + Number(a.amount_cents), 0)
  const totalLiabilitiesCents = liabilities.reduce((sum, l) => sum + Number(l.amount_cents), 0)
  const netWorthCents = totalAssetsCents - totalLiabilitiesCents

  if (loading) return <LoadingScreen label="Carregando lançamentos reais" />

  return <div className="space-y-6">
    {/* Header */}
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="eyebrow text-gold">CUSTO DA OPERAÇÃO</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">Lançamentos</h2>
        <p className="mt-2 text-sm text-muted">Dashboard completo de custos fixos, variáveis e capacidade produtiva.</p>
      </div>
      <label className="block">
        <span className="mb-1 block text-[10px] text-muted">Período de referência</span>
        <span className="flex items-center gap-2 rounded-lg border border-line bg-graphite px-3">
          <CalendarDays size={15} className="text-gold"/>
          <input aria-label="Mês de referência" type="month" className="bg-white py-2 text-sm text-paper outline-none" value={month} onChange={e => setMonth(e.target.value)}/>
        </span>
      </label>
    </div>

    {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
    {error && !showExpenseForm && !showSaleForm && !showVariableCostForm && !showAssetLiabilityForm && <InlineNotice>{error}</InlineNotice>}

    {/* Tabs de navegação - mesmo estilo de Produtos/Serviços */}
    <div className="inline-flex rounded-xl border border-line bg-panel p-1">
      <button 
        onClick={() => setTab('expenses')} 
        className={`rounded-lg px-4 py-2.5 text-xs font-medium transition-colors ${tab === 'expenses' ? 'bg-gold text-black' : 'text-muted'}`}
      >
        <ReceiptText size={14} className="mr-2 inline"/>Despesas fixas
      </button>
      <button 
        onClick={() => setTab('variableCosts')} 
        className={`rounded-lg px-4 py-2.5 text-xs font-medium transition-colors ${tab === 'variableCosts' ? 'bg-gold text-black' : 'text-muted'}`}
      >
        <TrendingDown size={14} className="mr-2 inline"/>Custos variáveis
      </button>
      <button 
        onClick={() => setTab('assetsLiabilities')} 
        className={`rounded-lg px-4 py-2.5 text-xs font-medium transition-colors ${tab === 'assetsLiabilities' ? 'bg-gold text-black' : 'text-muted'}`}
      >
        <Scale size={14} className="mr-2 inline"/>Ativos/Passivos
      </button>
    </div>

    {/* ══════════════════════════════════════════════════════════════
        DASHBOARD CONSOLIDADO — Todos os KPIs no topo
    ══════════════════════════════════════════════════════════════ */}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Despesas fixas mensais */}
      <div className="surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Despesas fixas mensais</p>
          <ReceiptText size={15} className="text-gold"/>
        </div>
        <p className="mt-3 font-mono text-2xl font-bold tabular-nums">{formatBRLFromCents(fixedTotal)}</p>
        <p className="mt-1 text-[10px] text-muted">{expenseRows.length} despesa(s) cadastradas</p>
      </div>

      {/* Custos variáveis totais */}
      <div className="surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Custos variáveis</p>
          <TrendingDown size={15} className="text-teal-border"/>
        </div>
        <p className="mt-3 font-mono text-2xl font-bold tabular-nums">
          {totalVariableCostsPercent.toFixed(2)}%
        </p>
        <p className="mt-1 text-[10px] text-muted">
          {variableCosts.filter(vc => vc.percent_value !== null).length} custo(s) cadastrado(s)
        </p>
      </div>

      {/* Pró-labore */}
      <div className="surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Pró-labore mensal</p>
          <CircleDollarSign size={15} className="text-emerald-500"/>
        </div>
        <p className="mt-3 font-mono text-2xl font-bold tabular-nums">
          {proLaboreCents ? formatBRLFromCents(proLaboreCents) : 'R$ 0,00'}
        </p>
        <p className="mt-1 text-[10px] text-muted">
          {proLaborePerDayCents ? `${formatBRLFromCents(proLaborePerDayCents)}/dia` : 'Configure abaixo'}
        </p>
      </div>

      {/* Previsão de faturamento */}
      <div className="surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Previsão de faturamento</p>
          <BarChart3 size={15} className="text-blue-400"/>
        </div>
        <p className="mt-3 font-mono text-2xl font-bold tabular-nums">
          {parseBrazilianCurrency(revenueForecast) ? formatBRLFromCents(parseBrazilianCurrency(revenueForecast)!) : 'R$ 0,00'}
        </p>
        <p className="mt-1 text-[10px] text-muted">Meta do período</p>
      </div>
    </div>

    {/* NOVO: Cards de Ativos, Passivos e Patrimônio Líquido - ACIMA dos cards de Ponto/Despesas */}
    <div className="grid gap-4 sm:grid-cols-3">
      {/* Ativos */}
      <div className="surface p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted">Total de ativos</p>
          <TrendingUp size={15} className="text-emerald-500"/>
        </div>
        <p className="font-mono text-2xl font-bold text-emerald-600">{formatBRLFromCents(totalAssetsCents)}</p>
        <p className="mt-1 text-[10px] text-muted">{assets.length} ativo(s) cadastrado(s)</p>
      </div>

      {/* Passivos */}
      <div className="surface p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted">Total de passivos</p>
          <TrendingDown size={15} className="text-red-500"/>
        </div>
        <p className="font-mono text-2xl font-bold text-red-600">{formatBRLFromCents(totalLiabilitiesCents)}</p>
        <p className="mt-1 text-[10px] text-muted">{liabilities.length} passivo(s) cadastrado(s)</p>
      </div>

      {/* Patrimônio Líquido */}
      <div className="surface p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted">Patrimônio líquido</p>
          <Scale size={15} className={netWorthCents >= 0 ? 'text-blue-500' : 'text-red-500'}/>
        </div>
        <p className={`font-mono text-2xl font-bold ${netWorthCents >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatBRLFromCents(netWorthCents)}</p>
        <p className="mt-1 text-[10px] text-muted">Ativos - Passivos</p>
      </div>
    </div>

    {/* Segunda linha do dashboard */}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* Dias trabalhados */}
      <div className="surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Dias trabalhados/mês</p>
          <CalendarDays size={15} className="text-gold"/>
        </div>
        <p className="mt-3 font-mono text-2xl font-bold tabular-nums">
          {workingDays || '0'}
        </p>
        <p className="mt-1 text-[10px] text-muted">dias úteis</p>
      </div>

      {/* Horas por dia */}
      <div className="surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Horas trabalhadas/dia</p>
          <Clock3 size={15} className="text-gold"/>
        </div>
        <p className="mt-3 font-mono text-2xl font-bold tabular-nums">
          {productiveHours || '0'}h
        </p>
        <p className="mt-1 text-[10px] text-muted">jornada diária</p>
      </div>

      {/* Custo fixo por dia */}
      <div className="surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Custo fixo por dia</p>
          <CalendarDays size={15} className="text-amber-500"/>
        </div>
        <p className="mt-3 font-mono text-2xl font-bold tabular-nums">
          {formatBRLFromCents(operating?.fixedDailyCents ?? null)}
        </p>
        <p className="mt-1 text-[10px] text-muted">despesas ÷ dias</p>
      </div>

      {/* Custo fixo por hora */}
      <div className="surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Custo fixo por hora</p>
          <Clock3 size={15} className="text-amber-500"/>
        </div>
        <p className="mt-3 font-mono text-2xl font-bold tabular-nums">
          {formatBRLFromCents(operating?.fixedHourlyCents ?? null)}
        </p>
        <p className="mt-1 text-[10px] text-muted">despesas ÷ horas</p>
      </div>

      {/* Ponto de equilíbrio */}
      <div className="surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Ponto de equilíbrio</p>
          <Wallet size={15} className="text-red-400"/>
        </div>
        <p className="mt-3 font-mono text-2xl font-bold tabular-nums">
          {breakEvenRevenueCents !== null ? formatBRLFromCents(breakEvenRevenueCents) : 'R$ 0,00'}
        </p>
        <p className="mt-1 text-[10px] text-muted">faturamento mínimo</p>
      </div>
    </div>

    {/* ── PARÂMETROS OPERACIONAIS (colapsável) ─────────────────── */}
    <form className="surface p-5 space-y-4" onSubmit={saveSettings}>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">PARÂMETROS OPERACIONAIS</p>
          <h3 className="mt-1 text-sm font-semibold">Configure capacidade produtiva e previsão de faturamento</h3>
        </div>
        <button type="submit" className="btn-secondary" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" size={14}/> : <CircleDollarSign size={14}/>}
          {settingsSaved ? 'Atualizar' : 'Salvar'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className={labelClass}>Dias trabalhados no mês</span>
          <input className="field" type="number" min="1" max="31" step="any" required
            value={workingDays} onChange={e => setWorkingDays(e.target.value)} placeholder="Ex.: 22"/>
        </label>
        <label>
          <span className={labelClass}>Horas trabalhadas por dia</span>
          <input className="field" type="number" min="0.01" max="24" step="any" required
            value={productiveHours} onChange={e => setProductiveHours(e.target.value)} placeholder="Ex.: 6"/>
        </label>
        <label>
          <span className={labelClass}>Pró-labore mensal (R$)</span>
          <CurrencyInput className="field" value={proLabore} onChange={setProLabore} placeholder="Ex.: 5.000,00"/>
        </label>
        <label>
          <span className={labelClass}>Previsão de faturamento (R$)</span>
          <CurrencyInput className="field" value={revenueForecast} onChange={setRevenueForecast} placeholder="Ex.: 15.000,00"/>
        </label>
      </div>
    </form>

    {/* ── DESPESAS FIXAS ──────────────────────────────────────────────── */}
    {tab === 'expenses' && <div className="space-y-5">
      {/* Modal para Despesas Fixas */}
      <Modal 
        isOpen={showExpenseForm} 
        onClose={() => { setShowExpenseForm(false); setEditing(null); setError(null) }}
        title={editing ? 'Editar Despesa Fixa' : 'Nova Despesa Fixa'}
        maxWidth="xl"
      >
        <form onSubmit={submitExpense} className="space-y-4">
          <label className="block"><span className={labelClass}>Descrição</span><input className="field" required maxLength={160} value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Ex.: Aluguel do escritório"/></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={labelClass}>Categoria</span><select className="field" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
            <label><span className={labelClass}>Valor mensal (R$)</span><CurrencyInput className="field" required value={expenseForm.amount} onChange={value => setExpenseForm({ ...expenseForm, amount: value })} placeholder="0,00"/></label>
            <label><span className={labelClass}>Data de referência</span><input className="field" type="date" required value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}/></label>
            {!editing && <label><span className={labelClass}>Repetir por (meses)</span><input className="field" type="number" min="1" max="60" required value={expenseFormRepeat} onChange={e => setExpenseFormRepeat(e.target.value)} placeholder="1"/></label>}
          </div>
          <label className="block"><span className={labelClass}>Observação</span><input className="field" maxLength={500} value={expenseForm.notes} onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })}/></label>
          {!editing && parseInt(expenseFormRepeat) > 1 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-700">
              <p className="font-semibold">📅 Serão criadas {expenseFormRepeat} despesas consecutivas</p>
              <p className="mt-1 text-muted">Uma despesa para cada mês, começando em {new Date(expenseForm.date + 'T12:00:00').toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</p>
            </div>
          )}
          {error && <InlineNotice>{error}</InlineNotice>}
          <div className="flex justify-end gap-3 pt-4">
            <button className="btn-secondary" type="button" onClick={() => { setShowExpenseForm(false); setEditing(null); setError(null) }}>Cancelar</button>
            <button className="btn-primary" disabled={busy}>{busy ? <><LoaderCircle className="animate-spin" size={16}/> Salvando...</> : editing ? 'Atualizar despesa' : 'Salvar despesa'}</button>
          </div>
        </form>
      </Modal>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div><p className="eyebrow">DESPESAS · {month}</p><p className="mt-1 text-xs text-muted">{filteredExpenseRows.length} de {expenseRows.length} registro(s) neste período</p></div>
            <button className="btn-primary !px-3 !py-2 text-xs" onClick={() => startExpense()}><Plus size={14}/>Adicionar</button>
          </div>
          <div className="grid gap-2 border-b border-line p-4 sm:grid-cols-[1fr_200px]">
            <label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/><input aria-label="Pesquisar despesas" className="field pl-9" value={expenseSearch} onChange={e => setExpenseSearch(e.target.value)} placeholder="Pesquisar descrição"/></label>
            <select aria-label="Filtrar por categoria" className="field" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}><option value="">Todas as categorias</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
          </div>
          {expenseRows.length
            ? <div className="divide-y divide-line">{filteredExpenseRows.map(row => (
                <div key={row.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[.015] transition-colors">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{row.description}</p><p className="mt-1 text-[10px] text-muted">{row.category} · referência {row.reference_date}</p></div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-sm">{formatBRLFromCents(Number(row.amount_cents))}</span>
                    <button title="Editar" aria-label={`Editar ${row.description}`} className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => startExpense(row)}><Pencil size={14}/></button>
                    <button title="Excluir" aria-label={`Excluir ${row.description}`} className="rounded p-2 text-muted hover:text-red-400 transition-colors" onClick={() => void deleteExpense(row)}><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}</div>
            : <div className="p-5"><EmptyState title="Nenhuma despesa neste período" description="Cadastre aluguel, energia, salários e outros compromissos mensais." action={<button className="btn-secondary" onClick={() => startExpense()}><Plus size={14}/>Adicionar despesa</button>}/></div>}
          {expenseRows.length > 0 && filteredExpenseRows.length === 0 && <p className="px-5 py-4 text-center text-xs text-muted">Nenhum lançamento corresponde à pesquisa ou categoria.</p>}
        </div>

        <div className="surface p-5">
          <div className="flex items-center gap-2"><BarChart3 size={16} className="text-gold"/><div><p className="eyebrow">DISTRIBUIÇÃO</p><h3 className="mt-1 text-sm font-semibold">Por categoria</h3></div></div>
          {chartData.length
            ? <><div className="mt-4 h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={68} paddingAngle={2} stroke="none">{chartData.map((item, i) => <Cell key={item.name} fill={PIE_COLORS_EXP[i % PIE_COLORS_EXP.length]} style={{ cursor: 'pointer' }}/>)}</Pie><Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const item = payload[0]
              const color = PIE_COLORS_EXP[chartData.findIndex(d => d.name === item.name) % PIE_COLORS_EXP.length]
              const total = chartData.reduce((s, d) => s + d.value, 0)
              return <div className="rounded-xl border border-line bg-graphite px-4 py-3 shadow-xl text-xs"><p className="font-semibold" style={{ color }}>{item.name}</p><p className="mt-1 font-mono" style={{ color }}>{formatBRLFromCents(Number(item.value))}</p><p className="mt-0.5 text-muted">{total > 0 ? `${((Number(item.value) / total) * 100).toFixed(1)}% do total` : ''}</p></div>
            }}/></PieChart></ResponsiveContainer></div><div className="space-y-2">{chartData.map((row, i) => <div key={row.name} className="flex justify-between text-[11px]"><span className="flex items-center gap-2 text-muted"><span className="size-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS_EXP[i % PIE_COLORS_EXP.length] }}/>{row.name}</span><span className="font-mono" style={{ color: PIE_COLORS_EXP[i % PIE_COLORS_EXP.length] }}>{formatBRLFromCents(row.value)}</span></div>)}</div></>
            : <p className="mt-6 text-sm text-muted">Sem despesas registradas no período.</p>}
        </div>
      </section>
    </div>}

    {/* ── CUSTOS VARIÁVEIS ──────────────────────────────────────────────── */}
    {tab === 'variableCosts' && <div className="space-y-5">
      {/* Modal para Custos Variáveis */}
      <Modal
        isOpen={showVariableCostForm}
        onClose={() => { setShowVariableCostForm(false); setEditingVarCost(null); setError(null) }}
        title={editingVarCost ? 'Editar Custo Variável' : 'Novo Custo Variável'}
        maxWidth="xl"
      >
        <form onSubmit={submitVariableCost} className="space-y-4">
          <label className="block"><span className={labelClass}>Descrição</span><input className="field" required maxLength={160} value={varCostForm.description} onChange={e => setVarCostForm({ ...varCostForm, description: e.target.value })} placeholder="Ex.: ICMS, Comissão de vendas"/></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={labelClass}>Tipo de custo</span><select className="field" value={varCostForm.costType} onChange={e => setVarCostForm({ ...varCostForm, costType: e.target.value as typeof costTypes[number] })}>{costTypes.map(c => <option key={c}>{c}</option>)}</select></label>
            <label>
              <span className={labelClass}>Formato do valor</span>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="valueType" value="percent" checked={varCostForm.valueType === 'percent'} onChange={e => setVarCostForm({ ...varCostForm, valueType: e.target.value as 'percent' | 'fixed', percentValue: '', fixedValue: '' })} className="text-gold" />
                  <span className="text-xs">Percentual (%)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="valueType" value="fixed" checked={varCostForm.valueType === 'fixed'} onChange={e => setVarCostForm({ ...varCostForm, valueType: e.target.value as 'percent' | 'fixed', percentValue: '', fixedValue: '' })} className="text-gold" />
                  <span className="text-xs">Valor fixo (R$)</span>
                </label>
              </div>
            </label>
            {varCostForm.valueType === 'percent' 
              ? <label><span className={labelClass}>Percentual (%)</span><input className="field" type="number" step="0.01" min="0" max="100" required value={varCostForm.percentValue} onChange={e => setVarCostForm({ ...varCostForm, percentValue: e.target.value })} placeholder="Ex.: 18.00"/></label>
              : <label><span className={labelClass}>Valor fixo (R$)</span><CurrencyInput className="field" required value={varCostForm.fixedValue} onChange={value => setVarCostForm({ ...varCostForm, fixedValue: value })} placeholder="0,00"/></label>
            }
            <label><span className={labelClass}>Observação</span><input className="field" maxLength={500} value={varCostForm.notes} onChange={e => setVarCostForm({ ...varCostForm, notes: e.target.value })}/></label>
          </div>
          {error && <InlineNotice>{error}</InlineNotice>}
          <div className="flex justify-end gap-3 pt-4">
            <button className="btn-secondary" type="button" onClick={() => { setShowVariableCostForm(false); setEditingVarCost(null); setError(null) }}>Cancelar</button>
            <button className="btn-primary" disabled={busy}>{busy ? <><LoaderCircle className="animate-spin" size={16}/> Salvando...</> : editingVarCost ? 'Atualizar custo' : 'Salvar custo'}</button>
          </div>
        </form>
      </Modal>

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div><p className="eyebrow">CUSTOS VARIÁVEIS</p><p className="mt-1 text-xs text-muted">{variableCosts.length} custo(s) cadastrado(s)</p></div>
          <button className="btn-primary !px-3 !py-2 text-xs" onClick={() => startVariableCost()}><Plus size={14}/>Adicionar</button>
        </div>
        {variableCosts.length
          ? <div className="divide-y divide-line">{variableCosts.map(vc => (
              <div key={vc.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[.015] transition-colors">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{vc.description}</p>
                  <p className="mt-1 text-[10px] text-muted">{vc.cost_type}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-sm">
                    {vc.percent_value !== null ? `${Number(vc.percent_value).toFixed(2)}%` : formatBRLFromCents(Number(vc.fixed_value_cents))}
                  </span>
                  <button title="Editar" aria-label={`Editar ${vc.description}`} className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => startVariableCost(vc)}><Pencil size={14}/></button>
                  <button title="Excluir" aria-label={`Excluir ${vc.description}`} className="rounded p-2 text-muted hover:text-red-400 transition-colors" onClick={() => void deleteVariableCost(vc)}><Trash2 size={14}/></button>
                </div>
              </div>
            ))}</div>
          : <div className="p-5"><EmptyState title="Nenhum custo variável cadastrado" description="Cadastre taxas, comissões, fretes e custos específicos que variam conforme as vendas." action={<button className="btn-secondary" onClick={() => startVariableCost()}><Plus size={14}/>Adicionar custo</button>}/></div>}
      </section>
    </div>}

    {/* ── ATIVOS / PASSIVOS ──────────────────────────────────────────────── */}
    {tab === 'assetsLiabilities' && <div className="space-y-5">
      {/* Modal para Ativos/Passivos */}
      <Modal
        isOpen={showAssetLiabilityForm}
        onClose={() => { setShowAssetLiabilityForm(false); setEditingAssetLiability(null); setError(null) }}
        title={editingAssetLiability ? `Editar ${editingAssetLiability.type === 'asset' ? 'Ativo' : 'Passivo'}` : 'Novo Lançamento: Ativo ou Passivo'}
        maxWidth="xl"
      >
        <form onSubmit={submitAssetLiability} className="space-y-4">
          <label className="block">
            <span className={labelClass}>Tipo</span>
            <select className="field" value={assetLiabilityForm.type} onChange={e => setAssetLiabilityForm({ ...assetLiabilityForm, type: e.target.value as 'asset' | 'liability' })}>
              <option value="asset">Ativo</option>
              <option value="liability">Passivo</option>
            </select>
          </label>
          <label className="block"><span className={labelClass}>Descrição</span><input className="field" required maxLength={160} value={assetLiabilityForm.description} onChange={e => setAssetLiabilityForm({ ...assetLiabilityForm, description: e.target.value })} placeholder="Ex.: Caixa, Contas a pagar"/></label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label><span className={labelClass}>Valor (R$)</span><CurrencyInput className="field" required value={assetLiabilityForm.amount} onChange={value => setAssetLiabilityForm({ ...assetLiabilityForm, amount: value })} placeholder="0,00"/></label>
            <label><span className={labelClass}>Data de referência</span><input className="field" type="date" required value={assetLiabilityForm.date} onChange={e => setAssetLiabilityForm({ ...assetLiabilityForm, date: e.target.value })}/></label>
            {!editingAssetLiability && <label><span className={labelClass}>Repetir por (meses)</span><input className="field" type="number" min="1" max="60" required value={assetLiabilityForm.repeatMonths} onChange={e => setAssetLiabilityForm({ ...assetLiabilityForm, repeatMonths: e.target.value })} placeholder="1"/></label>}
          </div>
          <label><span className={labelClass}>Observação</span><input className="field" maxLength={500} value={assetLiabilityForm.notes} onChange={e => setAssetLiabilityForm({ ...assetLiabilityForm, notes: e.target.value })}/></label>
          {!editingAssetLiability && parseInt(assetLiabilityForm.repeatMonths) > 1 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-700">
              <p className="font-semibold">📅 Serão criados {assetLiabilityForm.repeatMonths} lançamentos consecutivos</p>
              <p className="mt-1 text-muted">Um lançamento para cada mês, começando em {new Date(assetLiabilityForm.date + 'T12:00:00').toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</p>
            </div>
          )}
          {error && <InlineNotice>{error}</InlineNotice>}
          <div className="flex justify-end gap-3 pt-4">
            <button className="btn-secondary" type="button" onClick={() => { setShowAssetLiabilityForm(false); setEditingAssetLiability(null); setError(null) }}>Cancelar</button>
            <button className="btn-primary" disabled={busy}>{busy ? <><LoaderCircle className="animate-spin" size={16}/> Salvando...</> : editingAssetLiability ? 'Atualizar' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>

      {/* Assets Section */}
      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div><p className="eyebrow text-emerald-600">ATIVOS</p><p className="mt-1 text-xs text-muted">{assets.length} ativo(s) cadastrado(s)</p></div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl font-bold text-emerald-600">{formatBRLFromCents(totalAssetsCents)}</span>
            <button className="btn-primary !px-3 !py-2 text-xs" onClick={() => { setAssetLiabilityForm({ type: 'asset', description: '', amount: '', date: today(), notes: '', repeatMonths: '1' }); startAssetLiability() }}><Plus size={14}/>Adicionar</button>
          </div>
        </div>
        {assets.length
          ? <div className="divide-y divide-line">{assets.map(asset => (
                <div key={asset.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[.015] transition-colors">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{asset.description}</p>
                    <p className="mt-1 text-[10px] text-muted">referência {asset.reference_date}{asset.notes && ` · ${asset.notes}`}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-sm text-emerald-600">{formatBRLFromCents(Number(asset.amount_cents))}</span>
                    <button title="Editar" aria-label={`Editar ${asset.description}`} className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => startAssetLiability(asset)}><Pencil size={14}/></button>
                    <button title="Excluir" aria-label={`Excluir ${asset.description}`} className="rounded p-2 text-muted hover:text-red-400 transition-colors" onClick={() => void deleteAssetLiability(asset)}><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}</div>
          : <div className="p-5"><EmptyState title="Nenhum ativo cadastrado" description="Cadastre caixa, contas a receber, estoque e outros ativos da empresa." action={<button className="btn-secondary" onClick={() => { setAssetLiabilityForm({ type: 'asset', description: '', amount: '', date: today(), notes: '', repeatMonths: '1' }); startAssetLiability() }}><Plus size={14}/>Adicionar ativo</button>}/></div>}
      </section>

      {/* Liabilities Section */}
      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div><p className="eyebrow text-red-600">PASSIVOS</p><p className="mt-1 text-xs text-muted">{liabilities.length} passivo(s) cadastrado(s)</p></div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl font-bold text-red-600">{formatBRLFromCents(totalLiabilitiesCents)}</span>
            <button className="btn-primary !px-3 !py-2 text-xs" onClick={() => { setAssetLiabilityForm({ type: 'liability', description: '', amount: '', date: today(), notes: '', repeatMonths: '1' }); startAssetLiability() }}><Plus size={14}/>Adicionar</button>
          </div>
        </div>
        {liabilities.length
          ? <div className="divide-y divide-line">{liabilities.map(liability => (
                <div key={liability.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[.015] transition-colors">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{liability.description}</p>
                    <p className="mt-1 text-[10px] text-muted">referência {liability.reference_date}{liability.notes && ` · ${liability.notes}`}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-sm text-red-600">{formatBRLFromCents(Number(liability.amount_cents))}</span>
                    <button title="Editar" aria-label={`Editar ${liability.description}`} className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => startAssetLiability(liability)}><Pencil size={14}/></button>
                    <button title="Excluir" aria-label={`Excluir ${liability.description}`} className="rounded p-2 text-muted hover:text-red-400 transition-colors" onClick={() => void deleteAssetLiability(liability)}><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}</div>
          : <div className="p-5"><EmptyState title="Nenhum passivo cadastrado" description="Cadastre contas a pagar, empréstimos, fornecedores e outras obrigações." action={<button className="btn-secondary" onClick={() => { setAssetLiabilityForm({ type: 'liability', description: '', amount: '', date: today(), notes: '', repeatMonths: '1' }); startAssetLiability() }}><Plus size={14}/>Adicionar passivo</button>}/></div>}
      </section>

      {/* Summary Card */}
      <section className="surface p-6">
        <div className="flex items-center justify-between mb-6">
          <div><p className="eyebrow">PATRIMÔNIO LÍQUIDO</p><h3 className="mt-1 text-lg font-bold">Balanço patrimonial simplificado</h3></div>
          <Scale size={20} className="text-gold"/>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-xs text-muted">Total de ativos</p>
            <p className="mt-2 font-mono text-2xl font-bold text-emerald-600">{formatBRLFromCents(totalAssetsCents)}</p>
            <p className="mt-1 text-[10px] text-muted">{assets.length} lançamento(s)</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
            <p className="text-xs text-muted">Total de passivos</p>
            <p className="mt-2 font-mono text-2xl font-bold text-red-600">{formatBRLFromCents(totalLiabilitiesCents)}</p>
            <p className="mt-1 text-[10px] text-muted">{liabilities.length} lançamento(s)</p>
          </div>
          <div className={`rounded-xl border p-4 ${netWorthCents >= 0 ? 'border-blue-200 bg-blue-50/50' : 'border-red-300 bg-red-100/50'}`}>
            <p className="text-xs text-muted">Patrimônio líquido</p>
            <p className={`mt-2 font-mono text-2xl font-bold ${netWorthCents >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatBRLFromCents(netWorthCents)}</p>
            <p className="mt-1 text-[10px] text-muted">Ativos - Passivos</p>
          </div>
        </div>
      </section>
    </div>}
  </div>
}
