import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BarChart3, CalendarDays, CircleDollarSign, Clock3, LoaderCircle, Plus, ReceiptText, Search, Trash2, Wallet, Pencil, X, Percent } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState, InlineNotice, LoadingScreen } from '../components/Feedback'
import { CurrencyInput } from '../components/CurrencyInput'
import { calculateProductPricing, calculateServiceCost } from '../finance/pricing'
void calculateProductPricing; void calculateServiceCost
import { calculateBreakEven, calculateOperatingCosts } from '../finance/operations'
import { formatBRLFromCents, parseBrazilianCurrency } from '../lib/money'
import { listExpenses, listProducts, listSalesRecords, listServices, readOperatingSettings, removeExpense, saveExpense, saveOperatingSettings } from '../services/companyData'
import type { FixedExpenseDraft, FixedExpenseRecord, ProductRecord, SalesRecord, ServiceRecord } from '../types/database'

const categories = ['Aluguel', 'Energia', 'Água', 'Internet', 'Salários', 'Pró-labore', 'Contabilidade', 'Sistemas', 'Marketing', 'Outras despesas']
// Rich color palette for expenses chart
const PIE_COLORS_EXP = ['#D4AF37', '#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f59e0b']
const today = () => new Date().toLocaleDateString('sv-SE')
const currentMonth = () => today().slice(0, 7)
const firstDay = (month: string) => `${month}-01`
const blankExpense = { description: '', category: categories[0], amount: '', date: today(), notes: '' }
const labelClass = 'mb-2 block text-xs font-medium text-paper'

export default function ExpensesPage() {
  const { currentCompany } = useAuth()
  const [month, setMonth] = useState(currentMonth())
  const [expenses, setExpenses] = useState<FixedExpenseRecord[]>([])
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

  // fee tags — dynamic list of { label, percent }
  type FeeTag = { id: string; label: string; percent: string }
  const [feeTags, setFeeTags] = useState<FeeTag[]>([])
  const [feeInput, setFeeInput] = useState({ label: '', percent: '' })
  const [showFeeInput, setShowFeeInput] = useState(false)

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
        // Restore saved fee tags
        if (settingsResult.fee_tags && settingsResult.fee_tags.length > 0) {
          setFeeTags(settingsResult.fee_tags.map(t => ({ ...t, id: crypto.randomUUID() })))
        }
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

  // Use sales mix when available; fall back to total fees estimation
  const totalFeesPercent = feeTags.reduce((sum, t) => sum + Number(t.percent.replace(',', '.') || 0), 0)
  // effective margin = 100% - total fees (simple estimation when no sales)
  const defaultMarginPct = totalFeesPercent > 0 ? Math.max(0, 100 - totalFeesPercent) : null
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
        fee_tags: feeTags.map(({ label, percent }) => ({ label, percent })),
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
    // Only scroll to top for new expense; editing opens inline
    if (!row) window.scrollTo({ top: 0, behavior: 'smooth' })
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

  // sales helpers removed (Vendas e mix tab removed)

  if (loading) return <LoadingScreen label="Carregando lançamentos reais" />

  return <div className="space-y-6">
    {/* Header */}
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="eyebrow text-gold">CUSTO DA OPERAÇÃO</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Lançamentos</h2><p className="mt-2 text-sm text-muted">Acompanhe despesas fixas e o mix real de vendas.</p></div>
      <label className="block"><span className="mb-1 block text-[10px] text-muted">Período de referência</span><span className="flex items-center gap-2 rounded-lg border border-line bg-graphite px-3"><CalendarDays size={15} className="text-gold"/><input aria-label="Mês de referência" type="month" className="bg-white py-2 text-sm text-paper outline-none" value={month} onChange={e => setMonth(e.target.value)}/></span></label>
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

      {/* Fee tags — dynamic list with + button */}
      <div className="rounded-xl border border-line bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-paper">Taxas e encargos sobre vendas</p>
            <p className="mt-0.5 text-[10px] text-muted">Cartão, comissão, imposto, marketplace — cada um separado.</p>
          </div>
          {feeTags.length > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-muted">Total</p>
              <p className="font-mono text-sm font-bold text-gold">{totalFeesPercent.toFixed(2)}%</p>
              {defaultMarginPct !== null && <p className="text-[10px] text-emerald-400">margem est. {defaultMarginPct.toFixed(1)}%</p>}
            </div>
          )}
        </div>

        {/* Existing tags as colored cards */}
        {feeTags.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {feeTags.map((tag, i) => {
              const tagColors = ['#D4AF37', '#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#06b6d4', '#ec4899']
              const color = tagColors[i % tagColors.length]
              return (
                <div key={tag.id} className="group flex items-center justify-between rounded-xl border border-line bg-white px-3 py-2.5 hover:border-teal-border transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2 rounded-full shrink-0" style={{ background: color }}/>
                    <span className="text-xs font-medium text-paper truncate">{tag.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-mono text-sm font-bold" style={{ color }}>{tag.percent}%</span>
                    <button type="button" aria-label={`Remover ${tag.label}`}
                      className="size-5 rounded-full flex items-center justify-center text-muted hover:bg-red-500/15 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      onClick={() => setFeeTags(prev => prev.filter(t => t.id !== tag.id))}>
                      <X size={11}/>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add input */}
        {showFeeInput ? (
          <div className="flex items-center gap-2 rounded-xl border border-gold/50 bg-white px-4 py-3">
            <Percent size={13} className="text-gold shrink-0"/>
            <input autoFocus
              className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted"
              placeholder="Nome da taxa (ex.: Cartão de crédito)"
              value={feeInput.label}
              onChange={e => setFeeInput(f => ({ ...f, label: e.target.value }))}
              onKeyDown={e => e.key === 'Escape' && (setShowFeeInput(false), setFeeInput({ label: '', percent: '' }))}
            />
            <span className="text-muted text-xs mx-1">|</span>
            <input
              className="bg-transparent text-sm outline-none w-16 font-mono placeholder:text-muted text-center"
              placeholder="0,00"
              type="number" min="0" max="100" step="any"
              value={feeInput.percent}
              onChange={e => setFeeInput(f => ({ ...f, percent: e.target.value }))}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const pct = feeInput.percent.replace(',', '.')
                  if (feeInput.label.trim() && Number(pct) > 0) {
                    setFeeTags(prev => [...prev, { id: crypto.randomUUID(), label: feeInput.label.trim(), percent: pct }])
                    setFeeInput({ label: '', percent: '' })
                    setShowFeeInput(false)
                  }
                }
                if (e.key === 'Escape') { setShowFeeInput(false); setFeeInput({ label: '', percent: '' }) }
              }}
            />
            <span className="text-xs font-semibold text-muted">%</span>
            <button type="button"
              className="ml-1 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#ead584] transition-colors"
              onClick={() => {
                const pct = feeInput.percent.replace(',', '.')
                if (feeInput.label.trim() && Number(pct) > 0) {
                  setFeeTags(prev => [...prev, { id: crypto.randomUUID(), label: feeInput.label.trim(), percent: pct }])
                  setFeeInput({ label: '', percent: '' })
                  setShowFeeInput(false)
                }
              }}>
              Adicionar
            </button>
            <button type="button" className="text-muted hover:text-paper transition-colors" onClick={() => { setShowFeeInput(false); setFeeInput({ label: '', percent: '' }) }}>
              <X size={14}/>
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowFeeInput(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-xs text-muted hover:border-gold/60 hover:text-gold transition-colors">
            <Plus size={13}/>
            <span>Adicionar taxa ou encargo</span>
          </button>
        )}

        {feeTags.length === 0 && !showFeeInput && (
          <p className="text-center text-[10px] text-muted pb-1">Nenhuma taxa cadastrada. Adicione cartão, impostos, comissões etc.</p>
        )}
      </div>

      {/* Derived values — auto calculated */}
      {(proLaborePerDay !== null || operating) && <div className="grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
        {proLaborePerDay !== null && <div><p className="text-muted">Pró-labore por dia</p><p className="mt-1 font-mono text-sm text-paper">{formatBRLFromCents(proLaborePerDay)}</p></div>}
        {proLaborePerHour !== null && <div><p className="text-muted">Pró-labore por hora</p><p className="mt-1 font-mono text-sm text-paper">{formatBRLFromCents(proLaborePerHour)}</p></div>}
        {operating && <div><p className="text-muted">Custo fixo por dia</p><p className="mt-1 font-mono text-sm text-paper">{formatBRLFromCents(operating.fixedDailyCents)}</p></div>}
        {operating && <div><p className="text-muted">Custo fixo por hora</p><p className="mt-1 font-mono text-sm text-paper">{formatBRLFromCents(operating.fixedHourlyCents)}</p></div>}
      </div>}

      {/* Break-even panel */}
      {breakEvenRevenueCents !== null && <div className="rounded-lg border border-line bg-white p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div><p className="text-muted">Ponto de equilíbrio</p><p className="mt-1 font-mono text-sm text-gold">{formatBRLFromCents(breakEvenRevenueCents)}</p></div>
          <div>
            <p className="text-muted">Margem usada {weightedMarginPercent !== null ? '(mix real)' : '(padrão estimado)'}</p>
            <p className="mt-1 font-mono text-sm">{effectiveMarginPct !== null ? `${effectiveMarginPct.toFixed(1)}%` : '—'}</p>
          </div>
          {forecastCents !== null && <div><p className="text-muted">Previsão de faturamento</p><p className="mt-1 font-mono text-sm">{formatBRLFromCents(forecastCents)}</p></div>}
        </div>
        {forecastSurplusDeficitCents !== null && <>
          <div className="h-1.5 overflow-hidden rounded-full bg-teal-light">
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

    {/* Tabs — only Despesas fixas (Vendas e mix removed) */}
    <div className="inline-flex rounded-xl border border-line bg-panel p-1">
      <button className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium bg-gold text-ink"><ReceiptText size={15}/>Despesas fixas</button>
    </div>

    {/* ── DESPESAS ──────────────────────────────────────────────── */}
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <Summary title="Total de despesas fixas mensais" value={formatBRLFromCents(fixedTotal)} icon={Wallet}/>
        <Summary title="Custo fixo por dia" value={formatBRLFromCents(operating?.fixedDailyCents ?? null)} icon={CalendarDays}/>
        <Summary title="Custo fixo por hora" value={formatBRLFromCents(operating?.fixedHourlyCents ?? null)} icon={Clock3}/>
      </section>

      {/* Form for NEW expense only (editing is inline per row) */}
      {showExpenseForm && !editing && <section className="surface p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div><p className="eyebrow text-gold">DESPESA FIXA</p><h3 className="mt-1 text-sm font-semibold">Nova despesa</h3></div>
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
            <button className="btn-primary !px-3 !py-2 text-xs" onClick={() => startExpense()}><Plus size={14}/>Adicionar</button>
          </div>
          <div className="grid gap-2 border-b border-line p-4 sm:grid-cols-[1fr_200px]">
            <label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/><input aria-label="Pesquisar despesas" className="field pl-9" value={expenseSearch} onChange={e => setExpenseSearch(e.target.value)} placeholder="Pesquisar descrição"/></label>
            <select aria-label="Filtrar por categoria" className="field" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}><option value="">Todas as categorias</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
          </div>
          {expenseRows.length
            ? <div className="divide-y divide-line">{filteredExpenseRows.map(row => {
                const isEditing = editing?.id === row.id && showExpenseForm
                if (isEditing) return (
                  <div key={row.id} className="px-5 py-4 bg-panel">
                    <form onSubmit={submitExpense} className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gold">Editando despesa</p>
                        <button type="button" className="text-xs text-muted hover:text-paper" onClick={() => { setShowExpenseForm(false); setEditing(null); setError(null) }}>Cancelar</button>
                      </div>
                      <label className="block"><span className={labelClass}>Descrição</span><input className="field" required maxLength={160} value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Ex.: Aluguel"/></label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label><span className={labelClass}>Categoria</span><select className="field" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
                        <label><span className={labelClass}>Valor (R$)</span><CurrencyInput className="field" required value={expenseForm.amount} onChange={value => setExpenseForm({ ...expenseForm, amount: value })} placeholder="0,00"/></label>
                        <label><span className={labelClass}>Data de referência</span><input className="field" type="date" required value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}/></label>
                        <label><span className={labelClass}>Observação</span><input className="field" maxLength={500} value={expenseForm.notes} onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })}/></label>
                      </div>
                      {error && <InlineNotice>{error}</InlineNotice>}
                      <div className="flex justify-end gap-2">
                        <button className="btn-secondary !px-3 !py-2 text-xs" type="button" onClick={() => { setShowExpenseForm(false); setEditing(null); setError(null) }}>Cancelar</button>
                        <button className="btn-primary !px-3 !py-2 text-xs" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
                      </div>
                    </form>
                  </div>
                )
                return (
                  <div key={row.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[.015] transition-colors">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{row.description}</p><p className="mt-1 text-[10px] text-muted">{row.category} · referência {row.reference_date}</p></div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-sm">{formatBRLFromCents(Number(row.amount_cents))}</span>
                      <button title="Editar" aria-label={`Editar ${row.description}`} className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => startExpense(row)}><Pencil size={14}/></button>
                      <button title="Excluir" aria-label={`Excluir ${row.description}`} className="rounded p-2 text-muted hover:text-red-400 transition-colors" onClick={() => void deleteExpense(row)}><Trash2 size={14}/></button>
                    </div>
                  </div>
                )
              })}</div>
            : <div className="p-5"><EmptyState title="Nenhuma despesa neste período" description="Cadastre aluguel, energia, salários e outros compromissos mensais." action={<button className="btn-secondary" onClick={() => startExpense()}><Plus size={14}/>Adicionar despesa</button>}/></div>}
          {expenseRows.length > 0 && filteredExpenseRows.length === 0 && <p className="px-5 py-4 text-center text-xs text-muted">Nenhum lançamento corresponde à pesquisa ou categoria.</p>}
        </div>

        <div className="surface p-5">
          <div className="flex items-center gap-2"><BarChart3 size={16} className="text-gold"/><div><p className="eyebrow">DISTRIBUIÇÃO</p><h3 className="mt-1 text-sm font-semibold">Por categoria</h3></div></div>
          {chartData.length
            ? <><div className="mt-4 h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={68} paddingAngle={2} stroke="none">{chartData.map((item, i) => <Cell key={item.name} fill={PIE_COLORS_EXP[i % PIE_COLORS_EXP.length]} style={{ filter: 'drop-shadow(0 0 6px rgba(0,0,0,.5))', cursor: 'pointer' }}/>)}</Pie><Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const item = payload[0]
              const color = PIE_COLORS_EXP[chartData.findIndex(d => d.name === item.name) % PIE_COLORS_EXP.length]
              const total = chartData.reduce((s, d) => s + d.value, 0)
              return <div className="rounded-xl border border-line bg-graphite px-4 py-3 shadow-xl text-xs"><p className="font-semibold" style={{ color }}>{item.name}</p><p className="mt-1 font-mono" style={{ color }}>{formatBRLFromCents(Number(item.value))}</p><p className="mt-0.5 text-muted">{total > 0 ? `${((Number(item.value) / total) * 100).toFixed(1)}% do total` : ''}</p></div>
            }}/></PieChart></ResponsiveContainer></div><div className="space-y-2">{chartData.map((row, i) => <div key={row.name} className="flex justify-between text-[11px]"><span className="flex items-center gap-2 text-muted"><span className="size-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS_EXP[i % PIE_COLORS_EXP.length] }}/>{row.name}</span><span className="font-mono" style={{ color: PIE_COLORS_EXP[i % PIE_COLORS_EXP.length] }}>{formatBRLFromCents(row.value)}</span></div>)}</div></>
            : <p className="mt-6 text-sm text-muted">Sem despesas registradas no período.</p>}
        </div>
      </section>
    </div>
  </div>
}

function Summary({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Wallet }) {
  return <div className="surface p-4"><div className="flex items-center justify-between"><p className="text-xs text-muted">{title}</p><Icon size={15} className="text-gold"/></div><p className="mt-3 font-mono text-2xl font-bold tabular-nums">{value}</p></div>
}
