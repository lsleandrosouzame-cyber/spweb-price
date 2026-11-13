import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Copy, Eye, History, LoaderCircle, Package, Pencil, Plus, Search, Trash2, Wrench, ChevronLeft, AlertTriangle, CheckCircle2, TrendingUp, LayoutGrid, List, Info, Box } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState, InlineNotice, LoadingScreen } from '../components/Feedback'
import { calculateProductPricing } from '../finance/pricing'
import { formatBRLFromCents, formatMarkup, formatPercent, parseBrazilianCurrency } from '../lib/money'
import { listProducts, removeProduct, saveProduct, readOperatingSettings } from '../services/companyData'
import { listProductCosts, listProductFees, saveProductCost, saveProductFee, removeProductCost, removeProductFee } from '../services/itemizedData'
import { calculateDefaultFeesPercent, getDefaultFeesBreakdown } from '../services/defaultFees'
import type { ProductDraft, ProductRecord, ProductCostRecord, ProductFeeRecord } from '../types/database'
import { supabase } from '../lib/supabase'
import { CurrencyInput } from '../components/CurrencyInput'
import ServicesPanel from './ServicesPanel'
import { ProductCostsList, ProductFeesList } from '../components/ItemizedLists'
import { ProductCostModal, ProductFeeModal } from '../components/ItemizedModals'

const blank = { name: '', acquisition: '', desired: '', price: '', quantity: '0', notes: '' }
const inputLabel = 'mb-2 block text-xs font-medium text-paper'

type Panel = 'list' | 'form' | 'details' | 'history'

// Rich color palette for product details pie
const DETAIL_COLORS = {
  acquisition: '#3b82f6',   // blue — cost
  other: '#8b5cf6',         // purple — other costs
  fees: '#f97316',          // orange — fees
  taxes: '#ef4444',         // red — taxes
  contribution: '#22c55e',  // green — contribution (healthy)
  contributionNeg: '#ef4444', // red — negative contribution
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-xl border border-line bg-graphite px-4 py-3 shadow-xl text-xs z-50">
      <p className="font-semibold text-paper">{item.name}</p>
      <p className="mt-1 font-mono" style={{ color: item.payload.fill }}>{formatBRLFromCents(Math.abs(item.value))}</p>
      <p className="mt-0.5 text-muted">{item.payload.pct ? `${item.payload.pct}% do preço` : ''}</p>
    </div>
  )
}

export default function ProductsPage() {
  const { currentCompany, configReady } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState<ProductRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'todos' | 'saudavel' | 'atencao' | 'negativa'>('todos')
  const [panel, setPanel] = useState<Panel>('list')
  const [editing, setEditing] = useState<ProductRecord | null>(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [historyTarget, setHistoryTarget] = useState<ProductRecord | null>(null)
  const [selectedDetails, setSelectedDetails] = useState<ProductRecord | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [tab, setTab] = useState<'products' | 'services' | 'inventory'>('products')
  const [activeSlice, setActiveSlice] = useState<number | null>(null)
  
  // Itemized costs and fees
  const [productCosts, setProductCosts] = useState<ProductCostRecord[]>([])
  const [productFees, setProductFees] = useState<ProductFeeRecord[]>([])
  const [costModalOpen, setCostModalOpen] = useState(false)
  const [feeModalOpen, setFeeModalOpen] = useState(false)
  const [editingCost, setEditingCost] = useState<ProductCostRecord | null>(null)
  const [editingFee, setEditingFee] = useState<ProductFeeRecord | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Taxas padrão da aba Lançamentos
  const [defaultFeesPercent, setDefaultFeesPercent] = useState<number>(0)
  const [defaultFeesBreakdown, setDefaultFeesBreakdown] = useState<Array<{ label: string; percent: number }>>([])
  
  // Margem de lucratividade padrão dos Parâmetros Operacionais
  const [defaultDesiredMargin, setDefaultDesiredMargin] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    if (!currentCompany || !configReady) { setRows([]); setLoading(false); return }
    setLoading(true); setError(null)
    try { 
      const products = await listProducts(currentCompany.id)
      setRows(products)
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao carregar produtos.') }
    finally { setLoading(false) }
  }, [currentCompany?.id, configReady])

  // Carregar taxas padrão da aba Lançamentos
  const loadDefaultFees = useCallback(async () => {
    if (!currentCompany) return
    try {
      const [totalPercent, breakdown, settings] = await Promise.all([
        calculateDefaultFeesPercent(currentCompany.id),
        getDefaultFeesBreakdown(currentCompany.id),
        readOperatingSettings(currentCompany.id)
      ])
      setDefaultFeesPercent(totalPercent)
      setDefaultFeesBreakdown(breakdown)
      setDefaultDesiredMargin(settings?.default_desired_margin_percent ?? null)
    } catch (error) {
      console.error('Erro ao carregar taxas padrão:', error)
    }
  }, [currentCompany?.id])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { void loadDefaultFees() }, [loadDefaultFees])

  // Detectar ID na URL e abrir produto/serviço automaticamente
  useEffect(() => {
    const productId = searchParams.get('id')
    const tabParam = searchParams.get('tab')
    
    if (productId && rows.length > 0) {
      // Se tem parâmetro tab=services, troca para aba de serviços
      if (tabParam === 'services') {
        setTab('services')
      }
      
      // Encontrar e abrir o produto
      const product = rows.find(p => p.id === productId)
      if (product) {
        setSelectedDetails(product)
        setPanel('details')
        // Limpar o parâmetro da URL
        setSearchParams({})
      }
    }
  }, [searchParams, rows, setSearchParams])

  // Escuta mudanças nos Parâmetros Operacionais
  useEffect(() => {
    const handleSettingsUpdate = (event: CustomEvent) => {
      const newMargin = event.detail?.default_desired_margin_percent
      setDefaultDesiredMargin(newMargin ?? null)
    }
    
    window.addEventListener('operational-settings-updated', handleSettingsUpdate as EventListener)
    return () => window.removeEventListener('operational-settings-updated', handleSettingsUpdate as EventListener)
  }, [])

  // Helper para obter margem desejada (específica do produto ou padrão)
  const getEffectiveDesiredMargin = useCallback((productDesiredMargin: number | null): number | undefined => {
    if (productDesiredMargin !== null) return Number(productDesiredMargin)
    if (defaultDesiredMargin !== null && defaultDesiredMargin > 0) return Number(defaultDesiredMargin)
    return undefined
  }, [defaultDesiredMargin])

  const filtered = useMemo(() => rows.filter(row => {
    if (!row.name.toLowerCase().includes(search.toLowerCase())) return false
    const effectiveMargin = getEffectiveDesiredMargin(row.desired_margin_percent)
    const margin = row.current_price_cents ? calculateProductPricing({ acquisitionCostCents: Number(row.acquisition_cost_cents), otherCostCents: Number(row.other_cost_cents), variableFeesPercent: Number(row.variable_fees_percent), taxPercent: Number(row.tax_percent), desiredMarginPercent: effectiveMargin, sellingPriceCents: Number(row.current_price_cents) }).contributionMarginPercent : null
    if (filter === 'todos') return true
    if (margin === null) return false
    if (filter === 'negativa') return margin < 0
    if (filter === 'atencao') return margin >= 0 && effectiveMargin !== undefined && margin < effectiveMargin
    return margin >= 0 && (effectiveMargin === undefined || margin >= effectiveMargin)
  }), [rows, search, filter, getEffectiveDesiredMargin])

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filtered.slice(startIndex, startIndex + itemsPerPage)
  }, [filtered, currentPage, itemsPerPage])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, filter, itemsPerPage])

  const selectedPricing = selectedDetails ? calculateProductPricing({
    acquisitionCostCents: Number(selectedDetails.acquisition_cost_cents),
    otherCostCents: Number(selectedDetails.other_cost_cents),
    variableFeesPercent: Number(selectedDetails.variable_fees_percent),
    taxPercent: Number(selectedDetails.tax_percent),
    desiredMarginPercent: getEffectiveDesiredMargin(selectedDetails.desired_margin_percent),
    sellingPriceCents: selectedDetails.current_price_cents === null ? undefined : Number(selectedDetails.current_price_cents),
  }) : null

  // Calcular pricing baseado no preço RECOMENDADO (não no praticado)
  const recommendedPricing = selectedDetails && selectedPricing ? calculateProductPricing({
    acquisitionCostCents: Number(selectedDetails.acquisition_cost_cents),
    otherCostCents: Number(selectedDetails.other_cost_cents),
    variableFeesPercent: Number(selectedDetails.variable_fees_percent),
    taxPercent: Number(selectedDetails.tax_percent),
    desiredMarginPercent: getEffectiveDesiredMargin(selectedDetails.desired_margin_percent),
    sellingPriceCents: selectedPricing.recommendedPriceCents ?? undefined,
  }) : null

  // Build pie chart data for details panel - BASEADO NO PREÇO RECOMENDADO
  const detailsPieData = useMemo(() => {
    if (!selectedDetails || !selectedPricing || !recommendedPricing) return []
    const price = selectedPricing.recommendedPriceCents ?? 0
    const acq = Number(selectedDetails.acquisition_cost_cents)
    const other = Number(selectedDetails.other_cost_cents)
    const fees = recommendedPricing.feesCents ?? 0
    const taxes = recommendedPricing.taxesCents ?? 0
    const contribution = recommendedPricing.contributionCents ?? 0
    const pct = (v: number) => price > 0 ? `${((Math.abs(v) / price) * 100).toFixed(1)}` : '0'
    const data = [
      { name: 'Custo de aquisição', value: acq, fill: DETAIL_COLORS.acquisition, pct: pct(acq) },
      { name: 'Custos adicionais', value: other, fill: DETAIL_COLORS.other, pct: pct(other) },
      { name: 'Taxas variáveis', value: fees, fill: DETAIL_COLORS.fees, pct: pct(fees) },
      { name: 'Impostos', value: taxes, fill: DETAIL_COLORS.taxes, pct: pct(taxes) },
      { name: 'Margem de contribuição', value: Math.max(0, contribution), fill: contribution >= 0 ? DETAIL_COLORS.contribution : DETAIL_COLORS.contributionNeg, pct: pct(contribution) },
    ].filter(d => d.value > 0)
    return data
  }, [selectedDetails, selectedPricing, recommendedPricing])

  // Smart footnote for product details - usa margem do PREÇO RECOMENDADO
  function getFootnote(): { text: string; tone: 'ok' | 'warn' | 'bad' } | null {
    if (!selectedDetails || !selectedPricing || !recommendedPricing) return null
    const contributionMargin = recommendedPricing.contributionMarginPercent ?? 0
    const contributionCents = recommendedPricing.contributionCents ?? 0
    const current = selectedDetails.current_price_cents ? Number(selectedDetails.current_price_cents) : null
    const recommended = selectedPricing.recommendedPriceCents
    const minimum = selectedPricing.minimumPriceCents
    const desired = selectedDetails.desired_margin_percent !== null ? Number(selectedDetails.desired_margin_percent) : null

    if (current === null) return { text: 'Cadastre um Preço praticado hoje para visualizar a análise de margem deste produto.', tone: 'warn' }
    
    // Verifica se preço atual está abaixo do mínimo
    if (current < minimum) return { text: `⚠️ Seu Preço praticado hoje (${formatBRLFromCents(current)}) está abaixo do preço mínimo (${formatBRLFromCents(minimum)}). Você está operando no prejuízo. Ajuste o preço imediatamente.`, tone: 'bad' }
    
    // Verifica se está abaixo da margem desejada
    if (desired !== null && contributionMargin < desired) return { text: `Você está com margem de ${formatPercent(contributionMargin)}, abaixo da sua meta de ${formatPercent(desired)}. Para atingir essa meta, o preço recomendado é ${formatBRLFromCents(recommended)}. Avalie um reajuste gradual ou renegociação de custos.`, tone: 'warn' }
    
    // Verifica se há espaço para aumentar o preço
    if (recommended && current < recommended) return { text: `Há espaço para aumentar seu preço. O preço recomendado para atingir sua margem desejada é ${formatBRLFromCents(recommended)} — ${formatBRLFromCents(recommended - current)} acima do atual.`, tone: 'warn' }
    
    return { text: `✓ Excelente! Sua margem de contribuição de ${formatPercent(contributionMargin)} está saudável e dentro do esperado. Cada venda contribui com ${formatBRLFromCents(contributionCents)} para cobrir despesas fixas e gerar lucro.`, tone: 'ok' }
  }

  function startCreate() { 
    setEditing(null); setForm(blank); 
    setProductCosts([]); setProductFees([]); 
    setError(null); setNotice(null); setPanel('form') 
  }
  
  async function startEdit(row: ProductRecord) {
    setEditing(row); setError(null); setNotice(null)
    const money = (cents: number | null) => cents === null ? '' : (Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    setForm({ name: row.name, acquisition: '', desired: row.desired_margin_percent === null ? '' : String(row.desired_margin_percent), price: money(row.current_price_cents), quantity: String(row.stock_quantity || 0), notes: row.notes ?? '' })
    
    // Load itemized costs and fees from database
    try {
      const [costs, fees] = await Promise.all([
        listProductCosts(row.id),
        listProductFees(row.id)
      ])
      setProductCosts(costs)
      
      // Se não há taxas cadastradas E as taxas padrão estão disponíveis, pré-preenche
      if (fees.length === 0 && defaultFeesBreakdown.length > 0) {
        // Cria taxas baseadas no padrão
        const defaultFees: ProductFeeRecord[] = defaultFeesBreakdown.map(item => ({
          id: crypto.randomUUID(),
          product_id: row.id,
          company_id: row.company_id,
          label: item.label,
          percent: item.percent,
          fee_type: 'variable' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))
        setProductFees(defaultFees)
      } else {
        setProductFees(fees)
      }
    } catch (err) {
      // Tabelas podem não existir ainda - usar fallback vazio
      console.warn('Itemized data not available:', err)
      setProductCosts([])
      setProductFees([])
    }
    
    setPanel('form')
  }

  // Cost modal handlers
  function handleAddCost() {
    setEditingCost(null)
    setCostModalOpen(true)
  }

  function handleEditCost(cost: ProductCostRecord) {
    setEditingCost(cost)
    setCostModalOpen(true)
  }

  async function handleSaveCost(data: { label: string; amount_cents: number; cost_type: 'acquisition' | 'additional' }) {
    if (!currentCompany || !editing) throw new Error('Produto não selecionado')
    await saveProductCost(currentCompany.id, editing.id, data, editingCost?.id)
    const updated = await listProductCosts(editing.id)
    setProductCosts(updated)
    setCostModalOpen(false)
    setEditingCost(null)
  }

  async function handleDeleteCost(id: string) {
    if (!window.confirm('Excluir este custo?')) return
    await removeProductCost(id)
    setProductCosts(productCosts.filter(c => c.id !== id))
  }

  // Fee modal handlers
  function handleAddFee() {
    setEditingFee(null)
    setFeeModalOpen(true)
  }

  function handleEditFee(fee: ProductFeeRecord) {
    setEditingFee(fee)
    setFeeModalOpen(true)
  }

  async function handleSaveFee(data: { label: string; percent: number; fee_type: 'variable' | 'tax' }) {
    if (!currentCompany || !editing) throw new Error('Produto não selecionado')
    await saveProductFee(currentCompany.id, editing.id, data, editingFee?.id)
    const updated = await listProductFees(editing.id)
    setProductFees(updated)
    setFeeModalOpen(false)
    setEditingFee(null)
  }

  async function handleDeleteFee(id: string) {
    if (!window.confirm('Excluir esta taxa?')) return
    await removeProductFee(id)
    setProductFees(productFees.filter(f => f.id !== id))
  }

  async function openDetails(row: ProductRecord) { 
    setSelectedDetails(row); setActiveSlice(null); 
    
    // Load itemized costs and fees for analytics display
    try {
      const [costs, fees] = await Promise.all([
        listProductCosts(row.id),
        listProductFees(row.id)
      ])
      setProductCosts(costs)
      
      // If no specific fees, load default fees from Variable Costs
      if (fees.length === 0 && defaultFeesBreakdown.length > 0) {
        setProductFees(defaultFeesBreakdown.map(({ label, percent }) => ({
          id: crypto.randomUUID(),
          product_id: row.id,
          company_id: currentCompany!.id,
          label,
          percent,
          fee_type: 'variable' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })))
      } else {
        setProductFees(fees)
      }
    } catch (err) {
      // Tabelas podem não existir ainda - usar fallback vazio
      console.warn('Itemized data not available:', err)
      setProductCosts([])
      setProductFees([])
    }
    
    setPanel('details') 
  }
  async function openHistory(row: ProductRecord) {
    if (!supabase) return
    setHistoryTarget(row)
    const { data, error: historyError } = await supabase.from('pricing_history').select('id, snapshot, created_at').eq('company_id', row.company_id).eq('item_id', row.id).eq('item_type', 'product').order('created_at', { ascending: false }).limit(20)
    if (historyError) { setError(historyError.message); return }
    setHistory(data ?? [])
    setPanel('history')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!currentCompany) return
    
    // Calculate totals from itemized costs and fees
    const acquisitionCents = productCosts.filter(c => c.cost_type === 'acquisition').reduce((sum, c) => sum + Number(c.amount_cents), 0)
    const otherCostsCents = productCosts.filter(c => c.cost_type === 'additional').reduce((sum, c) => sum + Number(c.amount_cents), 0)
    const variableFeesPercent = productFees.filter(f => f.fee_type === 'variable').reduce((sum, f) => sum + Number(f.percent), 0)
    const taxPercent = productFees.filter(f => f.fee_type === 'tax').reduce((sum, f) => sum + Number(f.percent), 0)
    
    const price = form.price.trim() ? parseBrazilianCurrency(form.price) : null
    const desired = form.desired.trim() ? Number(form.desired.replace(',', '.')) : null
    const totalCostsCents = acquisitionCents + otherCostsCents
    
    if (!form.name.trim() || (editing && totalCostsCents === 0)) {
      setError('Confira nome e custos informados.'); return
    }
    
    if (form.price.trim() && price === null) {
      setError('Preço inválido.'); return
    }
    
    try { 
      calculateProductPricing({ 
        acquisitionCostCents: totalCostsCents, 
        otherCostCents: 0, 
        variableFeesPercent: variableFeesPercent + taxPercent, 
        taxPercent: 0, 
        desiredMarginPercent: desired ?? undefined, 
        sellingPriceCents: price ?? undefined 
      }) 
    } catch (cause) { 
      setError(cause instanceof Error ? cause.message : 'Percentuais incompatíveis.'); return 
    }
    
    setSaving(true); setError(null)
    const quantity = parseInt(form.quantity) || 0
    const draft: ProductDraft = { 
      name: form.name.trim(), 
      acquisition_cost_cents: acquisitionCents, 
      other_cost_cents: otherCostsCents, 
      variable_fees_percent: variableFeesPercent, 
      tax_percent: taxPercent, 
      desired_margin_percent: desired, 
      current_price_cents: price,
      stock_quantity: quantity,
      notes: form.notes.trim() || null 
    }
    
    try {
      await saveProduct(currentCompany.id, draft, editing?.id)
      setPanel('list'); setNotice(editing ? 'Produto atualizado.' : 'Produto salvo.'); await refresh()
    } catch (cause) { 
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.') 
    } finally { 
      setSaving(false) 
    }
  }

  async function duplicate(row: ProductRecord) {
    if (!currentCompany) return
    try {
      const { id: _id, company_id: _c, created_at: _cr, updated_at: _up, ...copy } = row
      await saveProduct(currentCompany.id, { ...copy, name: `${row.name} (cópia)` })
      setNotice(`"${row.name}" foi duplicado.`); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível duplicar.') }
  }

  async function deleteRow(row: ProductRecord) {
    if (!currentCompany || !window.confirm(`Excluir "${row.name}"?`)) return
    try { await removeProduct(currentCompany.id, row.id); setNotice('Produto excluído.'); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível excluir.') }
  }

  if (loading) return <LoadingScreen label="Carregando produtos cadastrados" />

  const footnote = panel === 'details' ? getFootnote() : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow text-gold">CATÁLOGO FINANCEIRO</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Produtos e serviços</h2>
          <p className="mt-2 text-sm text-muted">Veja quanto cada venda contribui para a operação.</p>
        </div>
        {tab === 'products' && panel === 'list' && <button className="btn-primary w-fit" onClick={startCreate}><Plus size={16}/>Cadastrar produto</button>}
      </div>

      <div className="inline-flex rounded-xl border border-line bg-panel p-1">
        <button onClick={() => { setTab('products'); setPanel('list') }} className={`rounded-lg px-4 py-2.5 text-xs font-medium transition-colors ${tab === 'products' ? 'bg-gold text-black' : 'text-muted'}`}><Package size={14} className="mr-2 inline"/>Produtos</button>
        <button onClick={() => setTab('services')} className={`rounded-lg px-4 py-2.5 text-xs font-medium transition-colors ${tab === 'services' ? 'bg-gold text-black' : 'text-muted'}`}><Wrench size={14} className="mr-2 inline"/>Serviços</button>
        <button onClick={() => { setTab('inventory'); setPanel('list') }} className={`rounded-lg px-4 py-2.5 text-xs font-medium transition-colors ${tab === 'inventory' ? 'bg-gold text-black' : 'text-muted'}`}><Box size={14} className="mr-2 inline"/>Inventário</button>
      </div>

      {tab === 'services' ? (
        <ServicesPanel/>
      ) : tab === 'inventory' ? (
        /* ── INVENTORY ─────────────────────────────── */
        <InventoryPanel rows={rows} />
      ) : (
        <>
        {/* ── LIST ─────────────────────────────────── */}
        {panel === 'list' && <>
          {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
          {error && <InlineNotice>{error}</InlineNotice>}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"/><input className="field pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar produto"/></label>
            <select aria-label="Filtrar situação da margem" className="field sm:w-56" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
              <option value="todos">Todas as margens</option><option value="saudavel">Margem saudável</option><option value="atencao">Abaixo da desejada</option><option value="negativa">Margem negativa</option>
            </select>
            {/* Items per page selector */}
            <select 
              aria-label="Itens por página" 
              className="field sm:w-32" 
              value={itemsPerPage} 
              onChange={e => setItemsPerPage(Number(e.target.value))}
            >
              <option value="50">50 itens</option>
              <option value="100">100 itens</option>
            </select>
            {/* Toggle visualização Cards/Lista */}
            <div className="inline-flex rounded-xl border border-line bg-panel p-1">
              <button 
                onClick={() => setViewMode('cards')} 
                className={`rounded-lg px-3 py-2 transition-colors ${viewMode === 'cards' ? 'bg-gold text-black' : 'text-muted hover:text-paper'}`}
                title="Visualizar em cards"
                aria-label="Visualizar em cards"
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                onClick={() => setViewMode('list')} 
                className={`rounded-lg px-3 py-2 transition-colors ${viewMode === 'list' ? 'bg-gold text-black' : 'text-muted hover:text-paper'}`}
                title="Visualizar em lista"
                aria-label="Visualizar em lista"
              >
                <List size={16} />
              </button>
            </div>
          </div>
          {rows.length === 0
            ? <EmptyState title="Seu catálogo começa aqui" description="Cadastre um produto com custos detalhados e Preço praticado hoje." action={<button className="btn-primary" onClick={startCreate}><Plus size={15}/>Cadastrar primeiro produto</button>}/>
            : <div className="space-y-4">
                <div className="surface px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div><p className="eyebrow">PRODUTOS DA EMPRESA</p><p className="mt-1 text-xs text-muted">{filtered.length} produto(s) {filtered.length !== rows.length && `de ${rows.length} no total`} · Página {currentPage} de {totalPages}</p></div>
                    <Package className="text-gold" size={18}/>
                  </div>
                </div>

                {/* Grid de cards OU tabela de lista */}
                {viewMode === 'cards' ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {paginatedRows.map(row => {
                      const effectiveMargin = getEffectiveDesiredMargin(row.desired_margin_percent)
                      const result = row.current_price_cents ? calculateProductPricing({ acquisitionCostCents: Number(row.acquisition_cost_cents), otherCostCents: Number(row.other_cost_cents), variableFeesPercent: Number(row.variable_fees_percent), taxPercent: Number(row.tax_percent), desiredMarginPercent: effectiveMargin, sellingPriceCents: Number(row.current_price_cents) }) : null
                      const margin = result?.contributionMarginPercent ?? null
                      const isNeg = margin !== null && margin < 0
                      const isBelowDesired = margin !== null && !isNeg && effectiveMargin !== undefined && margin < effectiveMargin
                      const statusLabel = margin === null ? 'Preço pendente' : isNeg ? 'Margem negativa' : isBelowDesired ? 'Abaixo da meta' : 'Saudável'
                      const statusColor = margin === null ? 'border-muted bg-muted/5' : isNeg ? 'border-red-400 bg-red-400/5' : isBelowDesired ? 'border-amber-400 bg-amber-400/5' : 'border-emerald-400 bg-emerald-400/5'
                      const statusTextColor = margin === null ? 'text-muted' : isNeg ? 'text-red-400' : isBelowDesired ? 'text-amber-400' : 'text-emerald-400'
                      const statusIcon = margin === null ? null : isNeg ? <AlertTriangle size={13}/> : isBelowDesired ? <TrendingUp size={13}/> : <CheckCircle2 size={13}/>

                      return (
                        <div key={row.id} className="surface overflow-hidden hover:border-teal-border transition-all group">
                          {/* Header do card com nome e status */}
                          <div className="border-b border-line px-4 py-3">
                            <button type="button" className="text-left w-full group-hover:text-gold transition-colors" onClick={() => openDetails(row)}>
                              <h4 className="text-sm font-semibold line-clamp-1">{row.name}</h4>
                              {row.notes && <p className="mt-1 text-[10px] text-muted line-clamp-1">{row.notes}</p>}
                            </button>
                            <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusColor} ${statusTextColor}`}>
                              {statusIcon}
                              {statusLabel}
                            </div>
                          </div>

                          {/* Corpo do card com métricas principais */}
                          <div className="p-4 space-y-3">
                            {/* Preço praticado e Margens */}
                            <div className="border-b border-line/50 pb-2">
                              <div className="flex items-end justify-between">
                                <div>
                                  <p className="text-[9px] uppercase tracking-wider text-muted">Preço praticado</p>
                                  <p className="mt-1 font-mono text-xl font-bold">{formatBRLFromCents(row.current_price_cents)}</p>
                                </div>
                                {margin !== null && (
                                  <div className="text-right">
                                    <p className="text-[9px] uppercase tracking-wider text-muted">Margem Contrib.</p>
                                    <p className={`mt-1 font-mono text-base font-bold ${isNeg ? 'text-red-400' : margin >= 20 ? 'text-emerald-400' : 'text-paper'}`}>
                                      {formatPercent(margin)}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Grid de custos e taxas */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-muted">Custo aquis.</p>
                                <p className="mt-0.5 font-mono text-paper">{formatBRLFromCents(row.acquisition_cost_cents)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-muted">Taxas</p>
                                <p className="mt-0.5 font-mono text-amber-400">{formatPercent(row.variable_fees_percent)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-muted">Impostos</p>
                                <p className="mt-0.5 font-mono text-red-400">{formatPercent(row.tax_percent)}</p>
                              </div>
                            </div>

                            {/* Resultado unitário */}
                            {result && (
                              <div className="pt-2 border-t border-line/50">
                                <p className="text-[9px] uppercase tracking-wider text-muted">Resultado / unidade</p>
                                <p className={`mt-1 font-mono text-lg font-bold ${isNeg ? 'text-red-400' : (result.contributionCents ?? 0) > 0 ? 'text-emerald-400' : 'text-paper'}`}>
                                  {formatBRLFromCents(result.contributionCents)}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Footer com ações */}
                          <div className="border-t border-line px-3 py-2 bg-white/[.01] flex items-center justify-end gap-1">
                            <button aria-label={`Detalhes de ${row.name}`} title="Detalhes" className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => openDetails(row)}><Eye size={13}/></button>
                            <button aria-label={`Histórico de ${row.name}`} title="Histórico" className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => void openHistory(row)}><History size={13}/></button>
                            <button aria-label={`Editar ${row.name}`} title="Editar" className="rounded p-2 text-muted hover:text-paper transition-colors" onClick={() => startEdit(row)}><Pencil size={13}/></button>
                            <button aria-label={`Duplicar ${row.name}`} title="Duplicar" className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => void duplicate(row)}><Copy size={13}/></button>
                            <button aria-label={`Excluir ${row.name}`} title="Excluir" className="rounded p-2 text-muted hover:text-red-400 transition-colors" onClick={() => void deleteRow(row)}><Trash2 size={13}/></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  /* Visualização em lista (tabela) */
                  <div className="surface overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1300px] text-left">
                        <thead>
                          <tr className="border-b border-line text-[10px] uppercase tracking-[.14em] text-muted">
                            <th className="px-5 py-2">Produto</th>
                            <th className="px-3 py-2">Preço praticado</th>
                            <th className="px-3 py-2">Custo aquis.</th>
                            <th className="px-3 py-2">Taxas</th>
                            <th className="px-3 py-2">% Lucro</th>
                            <th className="px-3 py-2">Preço recomendado</th>
                            <th className="px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {paginatedRows.map(row => {
                            const effectiveMargin = getEffectiveDesiredMargin(row.desired_margin_percent)
                            const result = row.current_price_cents ? calculateProductPricing({ acquisitionCostCents: Number(row.acquisition_cost_cents), otherCostCents: Number(row.other_cost_cents), variableFeesPercent: Number(row.variable_fees_percent), taxPercent: Number(row.tax_percent), desiredMarginPercent: effectiveMargin, sellingPriceCents: Number(row.current_price_cents) }) : null
                            const margin = result?.contributionMarginPercent ?? null
                            const isNeg = margin !== null && margin < 0
                            const isBelowDesired = margin !== null && !isNeg && effectiveMargin !== undefined && margin < effectiveMargin
                            const statusLabel = margin === null ? 'Preço pendente' : isNeg ? 'Margem negativa' : isBelowDesired ? 'Abaixo da meta' : 'Saudável'
                            const statusColor = margin === null ? 'border-muted bg-muted/5' : isNeg ? 'border-red-400 bg-red-400/5' : isBelowDesired ? 'border-amber-400 bg-amber-400/5' : 'border-emerald-400 bg-emerald-400/5'
                            const statusTextColor = margin === null ? 'text-muted' : isNeg ? 'text-red-400' : isBelowDesired ? 'text-amber-400' : 'text-emerald-400'
                            const statusIcon = margin === null ? null : isNeg ? <AlertTriangle size={13}/> : isBelowDesired ? <TrendingUp size={13}/> : <CheckCircle2 size={13}/>

                            return (
                              <tr key={row.id} className="hover:bg-teal-light/20 transition-colors">
                                <td className="px-5 py-2.5">
                                  <button type="button" className="text-left hover:text-gold transition-colors" onClick={() => openDetails(row)}>
                                    <p className="text-sm font-medium">{row.name}</p>
                                    {row.notes && <p className="mt-0.5 text-[10px] text-muted line-clamp-1">{row.notes}</p>}
                                  </button>
                                  <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${statusColor} ${statusTextColor}`}>
                                    {statusIcon}
                                    {statusLabel}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 font-mono text-xs">{formatBRLFromCents(row.current_price_cents)}</td>
                                <td className="px-3 py-2.5 font-mono text-xs text-muted">{formatBRLFromCents(row.acquisition_cost_cents)}</td>
                                <td className="px-3 py-2.5 font-mono text-xs text-amber-400">{formatPercent(row.variable_fees_percent)}</td>
                                <td className="px-3 py-2.5 font-mono text-xs">
                                  {effectiveMargin !== undefined ? (
                                    <span className="text-paper">
                                      {formatPercent(effectiveMargin)}
                                    </span>
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-xs">
                                  {result?.recommendedPriceCents ? (
                                    <span className="text-gold">
                                      {formatBRLFromCents(result.recommendedPriceCents)}
                                    </span>
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex justify-end gap-1">
                                    <button aria-label={`Detalhes de ${row.name}`} title="Detalhes" className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => openDetails(row)}><Eye size={14}/></button>
                                    <button aria-label={`Histórico de ${row.name}`} title="Histórico" className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => void openHistory(row)}><History size={14}/></button>
                                    <button aria-label={`Editar ${row.name}`} title="Editar" className="rounded p-2 text-muted hover:text-paper transition-colors" onClick={() => startEdit(row)}><Pencil size={14}/></button>
                                    <button aria-label={`Duplicar ${row.name}`} title="Duplicar" className="rounded p-2 text-muted hover:text-gold transition-colors" onClick={() => void duplicate(row)}><Copy size={14}/></button>
                                    <button aria-label={`Excluir ${row.name}`} title="Excluir" className="rounded p-2 text-muted hover:text-red-400 transition-colors" onClick={() => void deleteRow(row)}><Trash2 size={14}/></button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="surface px-5 py-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-xs text-muted">
                        Exibindo {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filtered.length)} de {filtered.length} produto(s)
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line bg-panel hover:bg-teal-light/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Anterior
                        </button>
                        
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum
                            if (totalPages <= 5) {
                              pageNum = i + 1
                            } else if (currentPage <= 3) {
                              pageNum = i + 1
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i
                            } else {
                              pageNum = currentPage - 2 + i
                            }
                            
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                  currentPage === pageNum
                                    ? 'border-gold bg-gold text-black'
                                    : 'border-line bg-panel hover:bg-teal-light/20'
                                }`}
                              >
                                {pageNum}
                              </button>
                            )
                          })}
                        </div>

                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line bg-panel hover:bg-teal-light/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {filtered.length === 0 && <div className="surface p-8 text-center"><p className="text-sm text-muted">Nenhum produto corresponde à pesquisa/filtro.</p></div>}
              </div>}
        </>}

        {/* ── FORM ─────────────────────────────────── */}
        {panel === 'form' && <section className="surface p-5 sm:p-7 space-y-5">
          <div className="flex items-start justify-between border-b border-line pb-4">
            <div><p className="eyebrow text-gold">PRECIFICAÇÃO DE PRODUTO</p><h3 className="mt-1 text-xl font-bold">{editing ? 'Editar produto' : 'Novo produto'}</h3></div>
            <button className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1" onClick={() => { setPanel('list'); setError(null) }}><ChevronLeft size={14}/>Voltar</button>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className={inputLabel}>Nome do produto</span><input className="field" maxLength={160} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Kit de café especial"/></label>
              
              {/* Campo de totalização - apenas leitura */}
              <label className="sm:col-span-2">
                <span className={inputLabel}>Custo de aquisição/produção (R$) <span className="text-xs text-muted font-normal">· Soma dos custos abaixo</span></span>
                <input 
                  className="field bg-gold/5 font-mono font-bold text-gold cursor-not-allowed" 
                  disabled 
                  value={formatBRLFromCents(productCosts.reduce((sum, c) => sum + Number(c.amount_cents), 0)).replace('R$', '').trim()} 
                  placeholder="0,00"
                />
              </label>
            </div>

            {/* Custos + Taxas lado a lado como TABELAS */}
            {editing && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProductCostsList
                    costs={productCosts}
                    onEdit={handleEditCost}
                    onDelete={handleDeleteCost}
                    onAdd={handleAddCost}
                  />
                  <ProductFeesList
                    fees={productFees}
                    onEdit={handleEditFee}
                    onDelete={handleDeleteFee}
                    onAdd={handleAddFee}
                  />
                </div>
                
                {/* Info sobre taxas padrão da aba Lançamentos */}
                {defaultFeesBreakdown.length > 0 && (
                  <div className="surface p-4 border border-blue-500/20 bg-blue-500/5">
                    <div className="flex items-start gap-3">
                      <Info size={16} className="text-blue-600 mt-0.5 shrink-0"/>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-700">Taxas padrão da aba Lançamentos</p>
                        <p className="mt-1 text-xs text-blue-600">
                          Base automática: {formatPercent(defaultFeesPercent)} 
                          {defaultFeesBreakdown.length > 0 && (
                            <span className="ml-2">
                              ({defaultFeesBreakdown.map(item => `${item.label}: ${formatPercent(item.percent)}`).join(' + ')})
                            </span>
                          )}
                        </p>
                        <p className="mt-2 text-xs text-blue-600">
                          💡 As taxas acima já são aplicadas automaticamente. Adicione taxas adicionais apenas se este produto tiver encargos específicos.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* For new products, show message */}
            {!editing && (
              <div className="surface p-5 border border-amber-500/20 bg-amber-500/5">
                <p className="text-sm text-amber-600">
                  💡 Primeiro salve o produto, depois você poderá adicionar custos e taxas detalhados.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className={inputLabel}>Preço praticado hoje (R$) · opcional</span><CurrencyInput className="field" value={form.price} onChange={value => setForm({ ...form, price: value })} placeholder="Deixe em branco se ainda não vende"/></label>
              <label><span className={inputLabel}>Margem desejada (%) · opcional</span><input className="field" type="number" min="0" max="100" step="0.01" value={form.desired} onChange={e => setForm({ ...form, desired: e.target.value })} placeholder={defaultDesiredMargin ? `Padrão: ${defaultDesiredMargin}%` : "Ex.: 20"}/></label>
              <label><span className={inputLabel}>Quantidade em estoque</span><input className="field" type="number" min="0" step="1" required value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="0"/></label>
              <label className="sm:col-span-2"><span className={inputLabel}>Observação · opcional</span><textarea className="field min-h-20 resize-y" maxLength={1000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></label>
            </div>
            {error && <InlineNotice>{error}</InlineNotice>}
            <div className="flex flex-col-reverse justify-end gap-2 border-t border-line pt-4 sm:flex-row">
              <button type="button" className="btn-secondary" onClick={() => { setPanel('list'); setError(null) }}>Cancelar</button>
              <button className="btn-primary" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" size={15}/> : <Plus size={15}/>}Salvar produto</button>
            </div>
          </form>
        </section>}

        {/* ── DETAILS ──────────────────────────────── */}
        {panel === 'details' && selectedDetails && selectedPricing && (
          <section className="surface p-5 sm:p-7 space-y-6">
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div><p className="eyebrow text-gold">DETALHES DA PRECIFICAÇÃO</p><h3 className="mt-1 text-2xl font-bold">{selectedDetails.name}</h3></div>
              <button className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1" onClick={() => setPanel('list')}><ChevronLeft size={14}/>Voltar</button>
            </div>

            {/* Price comparison card */}
            {selectedDetails.current_price_cents && (
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Current price (what they charge today) */}
                <div className={`rounded-xl border-2 p-3 ${(selectedPricing.contributionCents ?? 0) >= 0 ? 'border-teal-border bg-teal-light/10' : 'border-red-200 bg-red-50/25'}`}>
                  <p className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: (selectedPricing.contributionCents ?? 0) >= 0 ? '#065f46' : '#991b1b' }}>PREÇO PRATICADO HOJE</p>
                  <p className="font-mono text-2xl font-bold" style={{ color: (selectedPricing.contributionCents ?? 0) >= 0 ? '#047857' : '#DC2626' }}>{formatBRLFromCents(selectedDetails.current_price_cents)}</p>
                  
                  {/* Lucros */}
                  <div className="mt-2 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Lucro Bruto</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-semibold text-paper">{formatBRLFromCents(Number(selectedDetails.current_price_cents) - Number(selectedDetails.acquisition_cost_cents) - Number(selectedDetails.other_cost_cents))}</span>
                        <span className="font-mono text-sm font-medium text-muted">{formatPercent(((Number(selectedDetails.current_price_cents) - Number(selectedDetails.acquisition_cost_cents) - Number(selectedDetails.other_cost_cents)) / Number(selectedDetails.current_price_cents)) * 100)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={(selectedPricing.contributionCents ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}>Lucro Operacional</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-base font-bold ${(selectedPricing.contributionCents ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatBRLFromCents(selectedPricing.contributionCents)}</span>
                        <span className={`font-mono text-sm font-semibold ${(selectedPricing.contributionCents ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatPercent(selectedPricing.contributionMarginPercent)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommended price (by the system) */}
                <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/25 p-3">
                  <p className="text-[9px] uppercase tracking-wider font-semibold text-emerald-800 mb-1">PREÇO RECOMENDADO</p>
                  <p className="font-mono text-2xl font-bold text-emerald-700">{formatBRLFromCents(selectedPricing.recommendedPriceCents)}</p>
                  
                  {/* Lucros */}
                  <div className="mt-2 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-800">Lucro Bruto</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-semibold text-emerald-700">{formatBRLFromCents((selectedPricing.recommendedPriceCents ?? 0) - Number(selectedDetails.acquisition_cost_cents) - Number(selectedDetails.other_cost_cents))}</span>
                        <span className="font-mono text-sm font-medium text-emerald-700">{formatPercent((((selectedPricing.recommendedPriceCents ?? 0) - Number(selectedDetails.acquisition_cost_cents) - Number(selectedDetails.other_cost_cents)) / (selectedPricing.recommendedPriceCents ?? 1)) * 100)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-800">Lucro Operacional</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold text-emerald-700">{formatBRLFromCents(recommendedPricing?.contributionCents ?? 0)}</span>
                        <span className="font-mono text-sm font-semibold text-emerald-700">{formatPercent(recommendedPricing?.contributionMarginPercent ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DETALHAMENTO ANALÍTICO - Linha por linha */}
            <div className="space-y-4">
              <p className="eyebrow text-gold">DETALHAMENTO ANALÍTICO</p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Custos Individuais - DETALHADO */}
                <div className="surface p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <p className="text-sm font-semibold text-paper">Custo Aquisição Mercadoria</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-xs text-paper">
                        {selectedPricing?.recommendedPriceCents && productCosts.length > 0
                          ? `${((productCosts.reduce((sum, c) => sum + Number(c.amount_cents), 0) / Number(selectedPricing.recommendedPriceCents)) * 100).toFixed(1)}%`
                          : '—'}
                      </p>
                      <span className="text-muted text-xs">·</span>
                      <p className="font-mono text-sm font-bold text-gold">
                        {formatBRLFromCents(productCosts.reduce((sum, c) => sum + Number(c.amount_cents), 0))}
                      </p>
                    </div>
                  </div>
                  
                  {productCosts.length === 0 ? (
                    <p className="text-center text-sm text-muted py-2">Nenhum custo cadastrado</p>
                  ) : (
                    productCosts.map((cost) => {
                      const price = selectedPricing?.recommendedPriceCents ? Number(selectedPricing.recommendedPriceCents) : 0
                      const percentOfPrice = price > 0 ? ((Number(cost.amount_cents) / price) * 100).toFixed(1) : '0'
                      
                      return (
                        <div key={cost.id} className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`size-2 rounded-full shrink-0 ${cost.cost_type === 'acquisition' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-paper block truncate">{cost.label}</span>
                              <span className="text-xs text-muted">{cost.cost_type === 'acquisition' ? 'Aquisição' : 'Adicional'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {price > 0 && (
                              <>
                                <span className="font-mono text-sm text-paper">{percentOfPrice}%</span>
                                <span className="text-muted text-xs">·</span>
                              </>
                            )}
                            <span className={`font-mono text-base font-bold ${cost.cost_type === 'acquisition' ? 'text-blue-500' : 'text-purple-500'}`}>
                              {formatBRLFromCents(cost.amount_cents)}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Taxas e Encargos Individuais - DETALHADO */}
                <div className="surface p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <p className="text-sm font-semibold text-paper">Taxas e encargos</p>
                    <p className="font-mono text-sm font-bold text-amber-400">
                      {formatPercent(productFees.reduce((sum, f) => sum + Number(f.percent), 0))}
                    </p>
                  </div>
                  
                  {productFees.length === 0 ? (
                    <p className="text-center text-sm text-muted py-2">Nenhuma taxa cadastrada</p>
                  ) : (
                    productFees.map((fee) => {
                      const price = selectedPricing?.recommendedPriceCents ? Number(selectedPricing.recommendedPriceCents) : 0
                      const amountCents = Math.round((price * Number(fee.percent)) / 100)
                      
                      return (
                        <div key={fee.id} className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`size-2 rounded-full shrink-0 ${fee.fee_type === 'variable' ? 'bg-orange-500' : 'bg-red-500'}`} />
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-paper block truncate">{fee.label}</span>
                              <span className="text-xs text-muted">{fee.fee_type === 'variable' ? 'Taxa variável' : 'Imposto'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-mono text-sm ${fee.fee_type === 'variable' ? 'text-orange-500' : 'text-red-500'}`}>
                              {formatPercent(fee.percent)}
                            </span>
                            <span className="text-muted text-xs">·</span>
                            <span className={`font-mono text-base font-bold ${fee.fee_type === 'variable' ? 'text-orange-500' : 'text-red-500'}`}>
                              {formatBRLFromCents(amountCents)}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              {/* Left: metrics grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ['Custo de aquisição/produção', formatBRLFromCents(Number(selectedDetails.acquisition_cost_cents) + Number(selectedDetails.other_cost_cents)), DETAIL_COLORS.acquisition],
                  ['Custo total', formatBRLFromCents(selectedPricing.totalCostCents), '#6b7280'],
                  ['Taxas variáveis', `${formatPercent(selectedDetails.variable_fees_percent)} · ${formatBRLFromCents(selectedPricing.feesCents)}`, DETAIL_COLORS.fees],
                  ['Preço praticado hoje', formatBRLFromCents(selectedDetails.current_price_cents), '#D4AF37'],
                  ['Preço mínimo', formatBRLFromCents(selectedPricing.minimumPriceCents), '#6b7280'],
                  ['Preço recomendado', formatBRLFromCents(selectedPricing.recommendedPriceCents), '#22c55e'],
                  ['Resultado est. / unidade', `${formatBRLFromCents(recommendedPricing?.contributionCents ?? 0)} lucro · ${formatPercent(recommendedPricing?.contributionMarginPercent ?? 0)}`, (recommendedPricing?.contributionCents ?? 0) >= 0 ? DETAIL_COLORS.contribution : DETAIL_COLORS.contributionNeg],
                  ['Margem de contribuição', formatPercent(recommendedPricing?.contributionMarginPercent ?? 0), (recommendedPricing?.contributionMarginPercent ?? 0) >= 0 ? DETAIL_COLORS.contribution : DETAIL_COLORS.contributionNeg],
                  ['Margem desejada', `${formatPercent(getEffectiveDesiredMargin(selectedDetails.desired_margin_percent) ?? 0)}${selectedDetails.desired_margin_percent === null && defaultDesiredMargin ? ' (padrão)' : ''}`, '#D4AF37'],
                  ['Markup', formatMarkup(recommendedPricing?.markup ?? null), '#a855f7'],
                ] as [string, string, string][]).map(([label, value, color]) => (
                  <div key={label} className="rounded-xl border border-line bg-panel p-4 transition hover:border-teal-border">
                    <p className="text-xs font-semibold text-muted">{label}</p>
                    <p className="mt-2 font-mono text-base font-semibold" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Right: colorful pie chart */}
              {detailsPieData.length > 0 && (
                <div className="flex flex-col items-center">
                  <p className="eyebrow mb-3 self-start">COMPOSIÇÃO DO PREÇO</p>
                  <div className="relative h-56 w-full max-w-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={detailsPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%" cy="50%"
                          innerRadius={52} outerRadius={88}
                          paddingAngle={3}
                          stroke="none"
                          onMouseEnter={(_, index) => setActiveSlice(index)}
                          onMouseLeave={() => setActiveSlice(null)}
                        >
                          {detailsPieData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={entry.fill}
                              opacity={activeSlice === null || activeSlice === index ? 1 : 0.4}
                              style={{
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                transform: activeSlice === index ? 'scale(1.05)' : 'scale(1)',
                                transformOrigin: 'center',
                              }}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<PieTooltip/>}/>
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      {activeSlice !== null && detailsPieData[activeSlice] ? (
                        <>
                          <span className="text-[9px] text-muted text-center px-2 leading-3">{detailsPieData[activeSlice].name}</span>
                          <span className="font-mono text-sm font-bold mt-1" style={{ color: detailsPieData[activeSlice].fill }}>{detailsPieData[activeSlice].pct}%</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp size={16} className="text-gold"/>
                          <span className="text-[9px] text-muted mt-1">passe o mouse</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="mt-3 w-full space-y-1.5">
                    {detailsPieData.map((entry, i) => (
                      <div
                        key={entry.name}
                        className="flex items-center justify-between text-[11px] cursor-pointer rounded px-2 py-1 transition-colors hover:bg-white/5"
                        onMouseEnter={() => setActiveSlice(i)}
                        onMouseLeave={() => setActiveSlice(null)}
                      >
                        <span className="flex items-center gap-2 text-muted">
                          <span className="size-2.5 rounded-full shrink-0" style={{ background: entry.fill }}/>
                          {entry.name}
                        </span>
                        <span className="font-mono" style={{ color: entry.fill }}>{entry.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Smart footnote with enhanced visibility */}
            {footnote && (
              <div className={`rounded-2xl border-2 px-6 py-5 text-sm font-medium leading-relaxed shadow-lg ${
                footnote.tone === 'ok' ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                : footnote.tone === 'bad' ? 'border-red-400 bg-red-50 text-red-800'
                : 'border-amber-400 bg-amber-100 text-amber-900'
              }`}>
                <div className="flex items-start gap-3">
                  {footnote.tone === 'ok' ? <CheckCircle2 size={22} className="mt-0.5 shrink-0"/> : <AlertTriangle size={22} className="mt-0.5 shrink-0"/>}
                  <p className="text-[15px] leading-7">{footnote.text}</p>
                </div>
              </div>
            )}

            {selectedDetails.notes && <p className="border-t border-line pt-4 text-sm text-muted">{selectedDetails.notes}</p>}

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button className="btn-secondary" onClick={() => setPanel('list')}>Fechar</button>
              <button className="btn-primary" onClick={() => startEdit(selectedDetails)}><Pencil size={14}/>Editar precificação</button>
            </div>
          </section>
        )}

        {/* ── HISTORY ──────────────────────────────── */}
        {panel === 'history' && (
          <section className="surface p-5 space-y-4">
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div><p className="eyebrow text-gold">AUDITORIA DE PREÇOS</p><h3 className="mt-1 text-xl font-bold">Histórico — {historyTarget?.name}</h3></div>
              <button className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1" onClick={() => setPanel('list')}><ChevronLeft size={14}/>Voltar</button>
            </div>
            {history.length
              ? <div className="divide-y divide-line">{history.map(item => (
                  <div key={item.id} className="py-3">
                    <p className="text-xs text-muted">{new Date(item.created_at).toLocaleString('pt-BR')}</p>
                    <p className="mt-1 text-sm">Preço: <span className="font-mono text-gold">{formatBRLFromCents(item.snapshot.current_price_cents)}</span></p>
                    <p className="mt-1 text-xs text-muted">Custo total: {formatBRLFromCents(Number(item.snapshot.acquisition_cost_cents) + Number(item.snapshot.other_cost_cents))} · margem desejada: {formatPercent(item.snapshot.desired_margin_percent)}</p>
                  </div>
                ))}</div>
              : <p className="text-sm text-muted">Ainda não há alterações de preço registradas.</p>}
          </section>
        )}
      </>)}

      {/* Modals */}
      <ProductCostModal
        isOpen={costModalOpen}
        onClose={() => { setCostModalOpen(false); setEditingCost(null) }}
        onSave={handleSaveCost}
        editing={editingCost}
      />
      <ProductFeeModal
        isOpen={feeModalOpen}
        onClose={() => { setFeeModalOpen(false); setEditingFee(null) }}
        onSave={handleSaveFee}
        editing={editingFee}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   INVENTORY PANEL COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function InventoryPanel({ rows }: { rows: ProductRecord[] }) {
  const [search, setSearch] = useState('')
  
  // Produtos ordenados alfabeticamente
  const sortedProducts = useMemo(() => {
    return [...rows].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [rows])
  
  // Filtrar por busca
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return sortedProducts
    return sortedProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  }, [sortedProducts, search])
  
  // Cálculos do inventário
  const inventoryStats = useMemo(() => {
    const totalProducts = rows.length
    const totalStockValue = rows.reduce((sum, p) => {
      const unitCost = Number(p.acquisition_cost_cents) + Number(p.other_cost_cents)
      const quantity = Number(p.stock_quantity || 0)
      return sum + (unitCost * quantity)
    }, 0)
    
    const totalSalesValue = rows.reduce((sum, p) => {
      const unitPrice = Number(p.current_price_cents || 0)
      const quantity = Number(p.stock_quantity || 0)
      return sum + (unitPrice * quantity)
    }, 0)
    
    return {
      totalProducts,
      totalStockValue,
      totalSalesValue,
    }
  }, [rows])
  
  return (
    <div className="space-y-4">
      {/* Cards de resumo do inventário */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Total de produtos */}
        <div className="surface p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted">Total de produtos</p>
            <Package size={15} className="text-gold"/>
          </div>
          <p className="font-mono text-2xl font-bold text-paper">{inventoryStats.totalProducts}</p>
          <p className="mt-1 text-[10px] text-muted">produtos cadastrados</p>
        </div>
        
        {/* Valor total do estoque (custo) */}
        <div className="surface p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted">Valor estoque (custo)</p>
            <Box size={15} className="text-blue-500"/>
          </div>
          <p className="font-mono text-2xl font-bold text-blue-600">{formatBRLFromCents(inventoryStats.totalStockValue)}</p>
          <p className="mt-1 text-[10px] text-muted">custo × quantidade</p>
        </div>
      </div>
      
      {/* Barra de pesquisa */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"/>
          <input 
            className="field pl-10" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Pesquisar produto no inventário"
          />
        </label>
      </div>
      
      {/* Lista de produtos por ordem alfabética */}
      {filteredProducts.length === 0 ? (
        <EmptyState 
          title={search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"} 
          description={search ? "Tente pesquisar com outros termos" : "Cadastre produtos para visualizar o inventário"}
        />
      ) : (
        <div className="space-y-4">
          <div className="surface px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">INVENTÁRIO</p>
                <p className="mt-1 text-xs text-muted">
                  {filteredProducts.length} produto(s) {filteredProducts.length !== rows.length && `de ${rows.length} no total`}
                </p>
              </div>
              <Box className="text-gold" size={18}/>
            </div>
          </div>
          
          {/* Tabela de produtos */}
          <div className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left">
                <thead>
                  <tr className="border-b border-line text-[9px] uppercase tracking-[.12em] text-muted">
                    <th className="px-5 py-2">Produto</th>
                    <th className="px-3 py-2 text-center">Qtd</th>
                    <th className="px-3 py-2">Custo Unit.</th>
                    <th className="px-3 py-2">Valor Estoque</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredProducts.map(product => {
                    const acquisitionCost = Number(product.acquisition_cost_cents)
                    const otherCosts = Number(product.other_cost_cents)
                    const totalCost = acquisitionCost + otherCosts
                    const quantity = Number(product.stock_quantity || 0)
                    
                    // Valores totais
                    const totalStockValue = totalCost * quantity
                    
                    return (
                      <tr key={product.id} className="hover:bg-teal-light/20 transition-colors">
                        <td className="px-5 py-2.5">
                          <p className="text-sm font-medium">{product.name}</p>
                          {product.notes && (
                            <p className="mt-0.5 text-[10px] text-muted line-clamp-1">{product.notes}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-center font-semibold text-paper">
                          {quantity}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-blue-600">
                          {formatBRLFromCents(totalCost)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-blue-700">
                          {formatBRLFromCents(totalStockValue)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
