import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BarChart3, CalendarDays, CircleDollarSign, Clock3, LoaderCircle, Plus, ReceiptText, Search, Target, Trash2, Wallet, Pencil, ShoppingBag } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState, InlineNotice, LoadingScreen } from '../components/Feedback'
import { CurrencyInput } from '../components/CurrencyInput'
import { calculateProductPricing, calculateServiceCost } from '../finance/pricing'
import { calculateBreakEven, calculateOperatingCosts } from '../finance/operations'
import { formatBRLFromCents, parseBrazilianCurrency } from '../lib/money'
import { listExpenses, listProducts, listSalesRecords, listServices, readOperatingSettings, removeExpense, removeSalesRecord, saveExpense, saveOperatingSettings, saveSalesRecord } from '../services/companyData'
import type { FixedExpenseDraft, FixedExpenseRecord, ProductRecord, SalesRecord, ServiceRecord } from '../types/database'

const categories = ['Aluguel', 'Energia', 'Água', 'Internet', 'Salários', 'Pró-labore', 'Contabilidade', 'Sistemas', 'Marketing', 'Outras despesas']
const colors = ['#D4AF37', '#88752b', '#565044', '#3a3a3a', '#272727', '#1d1d1d']
const today = () => new Date().toLocaleDateString('sv-SE')
const currentMonth = () => today().slice(0, 7)
const firstDay = (month: string) => `${month}-01`
const blankExpense = { description: '', category: categories[0], amount: '', date: today(), notes: '' }
const labelClass = 'mb-2 block text-xs font-medium text-[#c7c7c7]'

export default function ExpensesPage() {
  const { currentCompany } = useAuth()
  const [tab, setTab] = useState<'expenses' | 'sales'>('expenses')
  const [month, setMonth] = useState(currentMonth())
  const [expenses, setExpenses] = useState<FixedExpenseRecord[]>([])
  const [sales, setSales] = useState<SalesRecord[]>([])
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [services, setServices] = useState<ServiceRecord[]>([])

  // operational settings
  const [workingDays, setWorkingDays] = useState('')
  const [productiveHours, setProductiveHours] = useState('')
  const [revenueForecast, setRevenueForecast] = useState('')
  const [proLabore, setProLabore] = useState('')
  const [defaultVariableFees, setDefaultVariableFees] = useState('')
  const [defaultTaxRate, setDefaultTaxRate] = useState('')
  const [defaultDesiredMargin, setDefaultDesiredMargin] = useState('')
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
  const [showSaleForm, setShowSaleForm] = useState(false)
  const [salesForm, setSalesForm] = useState({ item: '', quantity: '1', price: '', date: today() })

  const refresh = useCallback(async () => {
    if (!currentCompany) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const [expensesResult, productsResult, servicesResult, settingsResult, salesResult] = await Promise.all([
        listExpenses(currentCompany.id),
        listProducts(currentCompany.id),
        listServices(currentCompany.id),
        readOperatingSettings(currentCompany.id),
        listSalesRecords(currentCompany.id, firstDay(month)),
      ])
      setExpenses(expensesResult)
      setProducts(productsResult)
      setServices(servicesResult)
      setSales(salesResult)
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
  const proLaborePerDay = proLaboreCents && workingDaysNum && workingDaysNum > 0 ? proLaboreCents / workingDaysNum : null
  const proLaborePerHour = proLaboreCents && workingDaysNum && productiveHoursNum && workingDaysNum > 0 && productiveHoursNum > 0
    ? proLaboreCents / (workingDaysNum * productiveHoursNum) : null

  const operating = fixedTotal !== null && workingDaysNum && productiveHoursNum
    ? (() => { try { return calculateOperatingCosts(fixedTotal, workingDaysNum, productiveHoursNum) } catch { return null } })()
    : null

  const chartData = Object.values(
    expenseRows.reduce<Record<string, { name: string; value: number }>>((acc, row) => {
      const entry = acc[row.category] ?? { name: row.category, value: 0 }
      entry.value += Number(row.amount_cents)
      acc[row.category] = entry
      return acc
    }, {})
  ).sort((a, b) => b.value - a.value)

  // Break-even calculation
  const forecastCents = revenueForecast ? parseBrazilianCurrency(revenueForecast) : null
  const totalRevenue = salesRows.reduce((sum, row) => sum + Number(row.selling_price_cents) * Number(row.quantity), 0)
  const totalContribution = salesRows.reduce((sum, row) => sum + Number(row.contribution_cents) * Number(row.quantity), 0)
  const weightedMarginPercent = totalRevenue > 0 ? (totalContribution / totalRevenue) * 100 : null

  // Use sales mix when available; fall back to default margin for break-even
  const defaultMarginPct = defaultDesiredMargin ? Number(defaultDesiredMargin.replace(',', '.')) : null
  const effectiveMarginPct = weightedMarginPercent ?? defaultMarginPct

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

  const forecastSurplusDeficitCents = forecastCents !== null && breakEvenRevenueCents !== null
    ? forecastCents - breakEvenRevenueCents
    : null

  const forecastBreakEvenProgress = forecastCents && breakEvenRevenueCents
    ? Math.min(100, (forecastCents / breakEvenRevenueCents) * 100)
    : null

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
    setError(null)
    setShowExpenseForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitExpense(event: FormEvent) {
    event.preventDefault()
    if (!currentCompany) return
    const cents = parseBrazilianCurrency(expenseForm.amount)
    if (!expenseForm.description.trim() || cents === null || cents < 0) {
      setError('Informe descrição e valor válido.'); return
    }
    const draft: FixedExpenseDraft = { description: expenseForm.description.trim(), category: expenseForm.category, amount_cents: cents, reference_date: expenseForm.date, notes: expenseForm.notes.trim() || null }
    setBusy(true); setError(null)
    try {
      await saveExpense(currentCompany.id, draft, editing?.id)
      setShowExpenseForm(false)
      setNotice(editing ? 'Despesa atualizada.' : 'Despesa registrada.')
      await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a despesa.') }
    finally { setBusy(false) }
  }

  async function deleteExpense(row: FixedExpenseRecord) {
    if (!currentCompany || !window.confirm(`Excluir a despesa "${row.description}"?`)) return
    try { await removeExpense(currentCompany.id, row.id); setNotice('Despesa excluída.'); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao excluir.') }
  }

  function openSale() { setSalesForm({ item: '', quantity: '1', price: '', date: today() }); setError(null); setShowSaleForm(true) }
  function selectedItem() {
    const [kind, id] = salesForm.item.split(':')
    if (kind === 'product') return products.find(row => row.id === id) ?? null
    if (kind === 'service') return services.find(row => row.id === id) ?? null
    return null
  }
  const selected = selectedItem()
  const selectedPrice = selected?.current_price_cents ? Number(selected.current_price_cents) : null
  const salePriceCents = salesForm.price ? parseBrazilianCurrency(salesForm.price) : selectedPrice

  function getContributionPreview() {
    if (!selected || !salePriceCents) return null
    try {
      if ('acquisition_cost_cents' in selected) {
        return calculateProductPricing({ acquisitionCostCents: Number(selected.acquisition_cost_cents), otherCostCents: Number(selected.other_cost_cents), variableFeesPercent: Number(selected.variable_fees_percent), taxPercent: Number(selected.tax_percent), sellingPriceCents: salePriceCents }).contributionCents
      }
      const total = calculateServiceCost({ hours: Number(selected.hours), hourlyLaborCostCents: Number(selected.hourly_labor_cost_cents), materialsCents: Number(selected.materials_cents), otherCostCents: Number(selected.other_cost_cents), fixedCostPerHourCents: Number(selected.fixed_cost_per_hour_cents), includeFixedCostPerHour: selected.include_fixed_cost_per_hour })
      return calculateProductPricing({ acquisitionCostCents: total, variableFeesPercent: Number(selected.variable_fees_percent), taxPercent: Number(selected.tax_percent), sellingPriceCents: salePriceCents }).contributionCents
    } catch { return null }
  }

  async function submitSale(event: FormEvent) {
    event.preventDefault()
    if (!currentCompany || !selected) { setError('Selecione um produto ou serviço.'); return }
    const quantity = Number(salesForm.quantity)
    const price = salesForm.price ? parseBrazilianCurrency(salesForm.price) : selectedPrice
    if (!Number.isFinite(quantity) || quantity <= 0 || price === null || price <= 0) { setError('Informe quantidade e preço de venda positivos.'); return }
    let contribution = 0; let productId: string | null = null; let serviceId: string | null = null
    try {
      if ('acquisition_cost_cents' in selected) {
        const calc = calculateProductPricing({ acquisitionCostCents: Number(selected.acquisition_cost_cents), otherCostCents: Number(selected.other_cost_cents), variableFeesPercent: Number(selected.variable_fees_percent), taxPercent: Number(selected.tax_percent), sellingPriceCents: price })
        contribution = calc.contributionCents ?? 0; productId = selected.id
      } else {
        const total = calculateServiceCost({ hours: Number(selected.hours), hourlyLaborCostCents: Number(selected.hourly_labor_cost_cents), materialsCents: Number(selected.materials_cents), otherCostCents: Number(selected.other_cost_cents), fixedCostPerHourCents: Number(selected.fixed_cost_per_hour_cents), includeFixedCostPerHour: selected.include_fixed_cost_per_hour })
        const calc = calculateProductPricing({ acquisitionCostCents: total, variableFeesPercent: Number(selected.variable_fees_percent), taxPercent: Number(selected.tax_percent), sellingPriceCents: price })
        contribution = calc.contributionCents ?? 0; serviceId = selected.id
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível calcular a contribuição.'); return }
    setBusy(true); setError(null)
    try {
      await saveSalesRecord(currentCompany.id, { item_type: productId ? 'product' : 'service', product_id: productId, service_id: serviceId, quantity, selling_price_cents: price, contribution_cents: contribution, sold_on: salesForm.date })
      setShowSaleForm(false); setNotice('Venda registrada.'); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a venda.') }
    finally { setBusy(false) }
  }

  async function deleteSale(row: SalesRecord) {
    if (!currentCompany || !window.confirm('Excluir este registro de venda?')) return
    try { await removeSalesRecord(currentCompany.id, row.id); setNotice('Registro excluído.'); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao excluir a venda.') }
  }

  if (loading) return <LoadingScreen label="Carregando lançamentos reais" />

  return <div className="space-y-6">
    {/* Header */}
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="eyebrow text-gold">CUSTO DA OPERAÇÃO</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Lançamentos</h2><p className="mt-2 text-sm text-muted">Acompanhe despesas fixas e o mix real de vendas.</p></div>
      <label className="block"><span className="mb-1 block text-[10px] text-muted">Período de referência</span><span className="flex items-center gap-2 rounded-lg border border-line bg-graphite px-3"><CalendarDays size={15} className="text-gold"/><input aria-label="Mês de referência" type="month" className="bg-transparent py-2 text-sm text-paper outline-none" value={month} onChange={e => setMonth(e.target.value)}/></span></label>
    </div>

    {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
    {error && !showExpenseForm && !showSaleForm && <InlineNotice>{error}</InlineNotice>}

    {/* ── CAPACIDADE PRODUTIVA — sempre no topo ─────────────────── */}
    <form className="surface p-5 space-y-4" onSubmit={saveSettings}>
      <div><p className="eyebrow">CAPACIDADE PRODUTIVA & PREVISÃO</p><h3 className="mt-1 text-sm font-semibold">Parâmetros operacionais e ponto de equilíbrio</h3><p className="mt-1 text-xs text-muted">Preencha os campos abaixo. O pró-labore, custo/dia e custo/hora são calculados automaticamente.</p></div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className={labelClass}>Dias trabalhados no mês</span>
          {/* step="any" + validação manual para evitar o erro do browser */}
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

      {/* Contribution margin parameters */}
      <div className="grid gap-4 sm:grid-cols-3">
        <label>
          <span className={labelClass}>Taxas variáveis padrão (%)</span>
          <input className="field" type="number" min="0" max="100" step="any"
            value={defaultVariableFees} onChange={e => setDefaultVariableFees(e.target.value)} placeholder="Ex.: 5"/>
          <p className="mt-1 text-[10px] text-muted">Taxas médias sobre vendas (cartão, marketplace etc.)</p>
        </label>
        <label>
          <span className={labelClass}>Imposto médio sobre venda (%)</span>
          <input className="field" type="number" min="0" max="100" step="any"
            value={defaultTaxRate} onChange={e => setDefaultTaxRate(e.target.value)} placeholder="Ex.: 6"/>
          <p className="mt-1 text-[10px] text-muted">Simples Nacional, MEI ou regime tributário aplicável.</p>
        </label>
        <label>
          <span className={labelClass}>Margem de contribuição desejada (%)</span>
          <input className="field" type="number" min="0" max="100" step="any"
            value={defaultDesiredMargin} onChange={e => setDefaultDesiredMargin(e.target.value)} placeholder="Ex.: 30"/>
          <p className="mt-1 text-[10px] text-muted">Usada para estimar o ponto de equilíbrio sem vendas cadastradas.</p>
        </label>
      </div>

      {/* Derived values — auto calculated */}
      {(proLaborePerDay !== null || operating) && <div className="grid gap-3 rounded-lg border border-line bg-[#0b0b0b] p-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
        {proLaborePerDay !== null && <div><p className="text-muted">Pró-labore por dia</p><p className="mt-1 font-mono text-sm text-paper">{formatBRLFromCents(proLaborePerDay)}</p></div>}
        {proLaborePerHour !== null && <div><p className="text-muted">Pró-labore por hora</p><p className="mt-1 font-mono text-sm text-paper">{formatBRLFromCents(proLaborePerHour)}</p></div>}
        {operating && <div><p className="text-muted">Custo fixo por dia</p><p className="mt-1 font-mono text-sm text-paper">{formatBRLFromCents(operating.fixedDailyCents)}</p></div>}
        {operating && <div><p className="text-muted">Custo fixo por hora</p><p className="mt-1 font-mono text-sm text-paper">{formatBRLFromCents(operating.fixedHourlyCents)}</p></div>}
      </div>}

      {/* Break-even panel */}
      {breakEvenRevenueCents !== null && <div className="rounded-lg border border-line bg-[#0b0b0b] p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div><p className="text-muted">Ponto de equilíbrio</p><p className="mt-1 font-mono text-sm text-gold">{formatBRLFromCents(breakEvenRevenueCents)}</p></div>
          <div>
            <p className="text-muted">Margem usada {weightedMarginPercent !== null ? '(mix real)' : '(padrão estimado)'}</p>
            <p className="mt-1 font-mono text-sm">{effectiveMarginPct !== null ? `${effectiveMarginPct.toFixed(1)}%` : '—'}</p>
          </div>
          {forecastCents !== null && <div><p className="text-muted">Previsão de faturamento</p><p className="mt-1 font-mono text-sm">{formatBRLFromCents(forecastCents)}</p></div>}
        </div>
        {forecastSurplusDeficitCents !== null && <>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#262626]">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${forecastBreakEvenProgress ?? 0}%` }}/>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">{(forecastBreakEvenProgress ?? 0).toFixed(0)}% do equilíbrio</span>
            <span className={forecastSurplusDeficitCents >= 0 ? 'text-positive' : 'text-negative'}>
              {forecastSurplusDeficitCents >= 0 ? 'Superávit' : 'Déficit'}: {forecastSurplusDeficitCents >= 0 ? '+' : ''}{formatBRLFromCents(forecastSurplusDeficitCents)}
            </span>
          </div>
        </>}
      </div>}

      <div className="flex justify-end">
        <button className="btn-secondary" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" size={14}/> : <CircleDollarSign size={14}/>}
          {settingsSaved ? 'Atualizar parâmetros' : 'Salvar parâmetros'}
        </button>
      </div>
    </form>

    {/* Tabs */}
    <div className="inline-flex rounded-xl border border-line bg-[#101010] p-1">
      <button onClick={() => setTab('expenses')} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium ${tab === 'expenses' ? 'bg-gold text-ink' : 'text-muted'}`}><ReceiptText size={15}/>Despesas fixas</button>
      <button onClick={() => setTab('sales')} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium ${tab === 'sales' ? 'bg-gold text-ink' : 'text-muted'}`}><ShoppingBag size={15}/>Vendas e mix</button>
    </div>

    {/* ── DESPESAS ──────────────────────────────────────────────── */}
    {tab === 'expenses' && <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <Summary title="Total de despesas fixas mensais" value={formatBRLFromCents(fixedTotal)} icon={Wallet}/>
        <Summary title="Custo fixo por dia" value={formatBRLFromCents(operating?.fixedDailyCents ?? null)} icon={CalendarDays}/>
        <Summary title="Custo fixo por hora" value={formatBRLFromCents(operating?.fixedHourlyCents ?? null)} icon={Clock3}/>
      </section>

      {showExpenseForm && <section className="surface p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div><p className="eyebrow text-gold">DESPESA FIXA</p><h3 className="mt-1 text-sm font-semibold">{editing ? 'Editar despesa' : 'Nova despesa'}</h3></div>
          <button className="btn-secondary !px-3 !py-2 text-xs" onClick={() => { setShowExpenseForm(false); setError(null) }}>Cancelar</button>
        </div>
        <form onSubmit={submitExpense} className="space-y-4">
          <label className="block"><span className={labelClass}>Descrição</span><input className="field" required maxLength={160} value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Ex.: Aluguel do escritório"/></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={labelClass}>Categoria</span><select className="field" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
            <label><span className={labelClass}>Valor mensal (R$)</span><CurrencyInput className="field" required value={expenseForm.amount} onChange={value => setExpenseForm({ ...expenseForm, amount: value })} placeholder="0,00"/></label>
            <label><span className={labelClass}>Data de referência</span><input className="field" type="date" required value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}/></label>
            <label><span className={labelClass}>Observação</span><input className="field" maxLength={500} value={expenseForm.notes} onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })}/></label>
          </div>
          {error && <InlineNotice>{error}</InlineNotice>}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" type="button" onClick={() => { setShowExpenseForm(false); setError(null) }}>Cancelar</button>
            <button className="btn-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar despesa'}</button>
          </div>
        </form>
      </section>}

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div><p className="eyebrow">DESPESAS · {month}</p><p className="mt-1 text-xs text-muted">{filteredExpenseRows.length} de {expenseRows.length} registro(s) neste período</p></div>
            {!showExpenseForm && <button className="btn-primary !px-3 !py-2 text-xs" onClick={() => startExpense()}><Plus size={14}/>Adicionar</button>}
          </div>
          <div className="grid gap-2 border-b border-line p-4 sm:grid-cols-[1fr_200px]">
            <label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/><input aria-label="Pesquisar despesas" className="field pl-9" value={expenseSearch} onChange={e => setExpenseSearch(e.target.value)} placeholder="Pesquisar descrição"/></label>
            <select aria-label="Filtrar por categoria" className="field" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}><option value="">Todas as categorias</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
          </div>
          {expenseRows.length
            ? <div className="divide-y divide-line">{filteredExpenseRows.map(row => <div key={row.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{row.description}</p><p className="mt-1 text-[10px] text-muted">{row.category} · referência {row.reference_date}</p></div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-sm">{formatBRLFromCents(Number(row.amount_cents))}</span>
                  <button title="Editar" aria-label={`Editar ${row.description}`} className="rounded p-2 text-muted hover:text-paper" onClick={() => startExpense(row)}><Pencil size={14}/></button>
                  <button title="Excluir" aria-label={`Excluir ${row.description}`} className="rounded p-2 text-muted hover:text-negative" onClick={() => void deleteExpense(row)}><Trash2 size={14}/></button>
                </div>
              </div>)}</div>
            : <div className="p-5"><EmptyState title="Nenhuma despesa neste período" description="Cadastre aluguel, energia, salários e outros compromissos mensais." action={<button className="btn-secondary" onClick={() => startExpense()}><Plus size={14}/>Adicionar despesa</button>}/></div>}
          {expenseRows.length > 0 && filteredExpenseRows.length === 0 && <p className="px-5 py-4 text-center text-xs text-muted">Nenhum lançamento corresponde à pesquisa ou categoria.</p>}
        </div>

        <div className="surface p-5">
          <div className="flex items-center gap-2"><BarChart3 size={16} className="text-gold"/><div><p className="eyebrow">DISTRIBUIÇÃO</p><h3 className="mt-1 text-sm font-semibold">Por categoria</h3></div></div>
          {chartData.length
            ? <><div className="mt-4 h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={68} paddingAngle={2} stroke="none">{chartData.map((item, i) => <Cell key={item.name} fill={colors[i % colors.length]}/>)}</Pie><Tooltip formatter={value => formatBRLFromCents(Number(value))} contentStyle={{ background: '#141414', border: '1px solid #262626', borderRadius: 10 }}/></PieChart></ResponsiveContainer></div><div className="space-y-2">{chartData.map((row, i) => <div key={row.name} className="flex justify-between text-[11px]"><span className="flex items-center gap-2 text-muted"><span className="size-2 rounded-full" style={{ background: colors[i % colors.length] }}/>{row.name}</span><span className="font-mono">{formatBRLFromCents(row.value)}</span></div>)}</div></>
            : <p className="mt-6 text-sm text-muted">Sem despesas registradas no período.</p>}
        </div>
      </section>
    </div>}

    {/* ── VENDAS ────────────────────────────────────────────────── */}
    {tab === 'sales' && <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <Summary title="Faturamento de referência" value={salesRows.length ? formatBRLFromCents(totalRevenue) : '—'} icon={Wallet}/>
        <Summary title="Contribuição registrada" value={salesRows.length ? formatBRLFromCents(totalContribution) : '—'} icon={CircleDollarSign}/>
        <Summary title="Vendas no período" value={salesRows.length ? String(salesRows.length) : '—'} icon={ShoppingBag}/>
      </section>

      {breakEvenRevenueCents !== null && <div className="surface p-4 flex flex-wrap gap-6 items-center">
        <Target size={16} className="text-gold shrink-0"/>
        <div><p className="text-xs text-muted">Ponto de equilíbrio estimado</p><p className="font-mono text-sm text-gold">{formatBRLFromCents(breakEvenRevenueCents)}</p></div>
        {forecastCents !== null && <div><p className="text-xs text-muted">Previsão de faturamento</p><p className="font-mono text-sm">{formatBRLFromCents(forecastCents)}</p></div>}
        {forecastSurplusDeficitCents !== null && <div><p className="text-xs text-muted">Diferença</p><p className={`font-mono text-sm ${forecastSurplusDeficitCents >= 0 ? 'text-positive' : 'text-negative'}`}>{forecastSurplusDeficitCents >= 0 ? '+' : ''}{formatBRLFromCents(forecastSurplusDeficitCents)}</p></div>}
      </div>}

      {showSaleForm && <section className="surface p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div><p className="eyebrow text-gold">REGISTRAR VENDA</p><h3 className="mt-1 text-sm font-semibold">Nova venda</h3></div>
          <button className="btn-secondary !px-3 !py-2 text-xs" onClick={() => { setShowSaleForm(false); setError(null) }}>Cancelar</button>
        </div>
        <form onSubmit={submitSale} className="space-y-4">
          <label className="block"><span className={labelClass}>Produto ou serviço</span>
            <select className="field" required value={salesForm.item} onChange={e => { setSalesForm({ ...salesForm, item: e.target.value, price: '' }); setError(null) }}>
              <option value="">Selecione um item cadastrado</option>
              <optgroup label="Produtos">{products.map(p => <option key={p.id} value={`product:${p.id}`}>{p.name}{p.current_price_cents ? ` · ${formatBRLFromCents(p.current_price_cents)}` : ' · sem preço atual'}</option>)}</optgroup>
              <optgroup label="Serviços">{services.map(s => <option key={s.id} value={`service:${s.id}`}>{s.name}{s.current_price_cents ? ` · ${formatBRLFromCents(s.current_price_cents)}` : ' · sem preço atual'}</option>)}</optgroup>
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label><span className={labelClass}>Quantidade</span><input className="field" type="number" min="0.001" step="any" required value={salesForm.quantity} onChange={e => setSalesForm({ ...salesForm, quantity: e.target.value })}/></label>
            <label><span className={labelClass}>Preço de venda unitário (R$)</span><CurrencyInput className="field" value={salesForm.price} onChange={value => setSalesForm({ ...salesForm, price: value })} placeholder={selectedPrice ? (selectedPrice / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}/></label>
            <label><span className={labelClass}>Data da venda</span><input className="field" type="date" required value={salesForm.date} onChange={e => setSalesForm({ ...salesForm, date: e.target.value })}/></label>
          </div>
          <div className="rounded-lg border border-line bg-[#0b0b0b] p-3 text-xs text-muted">
            Contribuição unitária estimada: <span className="font-mono text-gold">{formatBRLFromCents(getContributionPreview())}</span>
          </div>
          {error && <InlineNotice>{error}</InlineNotice>}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" type="button" onClick={() => { setShowSaleForm(false); setError(null) }}>Cancelar</button>
            <button className="btn-primary" disabled={busy || !selected}>{busy ? 'Salvando…' : 'Salvar venda'}</button>
          </div>
        </form>
      </section>}

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div><p className="eyebrow">MIX DE VENDAS · {month}</p><p className="mt-1 text-xs text-muted">O ponto de equilíbrio usa a contribuição ponderada por receita.</p></div>
          {!showSaleForm && <button className="btn-primary !px-3 !py-2 text-xs" onClick={openSale}><Plus size={14}/>Registrar venda</button>}
        </div>
        {salesRows.length
          ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead><tr className="border-b border-line text-[10px] uppercase tracking-[.14em] text-muted"><th className="px-5 py-3">Item</th><th className="px-3 py-3">Data</th><th className="px-3 py-3">Quantidade</th><th className="px-3 py-3">Preço / unidade</th><th className="px-3 py-3">Contribuição / unidade</th><th className="px-4 py-3"/></tr></thead><tbody className="divide-y divide-line">{salesRows.map(row => <tr key={row.id}><td className="px-5 py-4 text-sm">{row.item_name_snapshot || products.find(p => p.id === row.product_id)?.name || services.find(s => s.id === row.service_id)?.name || 'Item removido'}</td><td className="px-3 py-4 text-xs text-muted">{new Date(`${row.sold_on}T12:00:00`).toLocaleDateString('pt-BR')}</td><td className="px-3 py-4 font-mono text-xs">{row.quantity}</td><td className="px-3 py-4 font-mono text-xs">{formatBRLFromCents(Number(row.selling_price_cents))}</td><td className="px-3 py-4 font-mono text-xs">{formatBRLFromCents(Number(row.contribution_cents))}</td><td className="px-4 py-4 text-right"><button className="rounded p-2 text-muted hover:text-negative" aria-label="Excluir venda" onClick={() => void deleteSale(row)}><Trash2 size={14}/></button></td></tr>)}</tbody></table></div>
          : <div className="p-5"><EmptyState title="Sem registros de venda no período" description="Informe quantidades, preço e data. A contribuição unitária é calculada a partir da precificação cadastrada." action={<button className="btn-secondary" onClick={openSale}><Plus size={14}/>Registrar venda</button>}/></div>}
      </div>
    </div>}
  </div>
}

function Summary({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Wallet }) {
  return <div className="surface p-4"><div className="flex items-center justify-between"><p className="text-xs text-muted">{title}</p><Icon size={15} className="text-gold"/></div><p className="mt-3 font-mono text-xl font-semibold tabular-nums">{value}</p></div>
}
