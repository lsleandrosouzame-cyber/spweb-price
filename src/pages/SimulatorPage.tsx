import { useState, useMemo, useEffect } from 'react'
import { Calculator, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Sparkles, Package, Wrench, DollarSign, Target, Zap, Save, Search, Trash2, Edit2, Percent, Receipt, LayoutGrid, List } from 'lucide-react'
import { calculateProductPricing } from '../finance/pricing'
import { formatBRLFromCents, formatPercent } from '../lib/money'

const STORAGE_KEY = 'spweb-saved-simulations'

type SimulatorType = 'product' | 'service'
type ViewMode = 'simulator' | 'saved'
type SavedTab = 'products' | 'services'

interface SavedSimulation {
  id: string
  name: string
  type: SimulatorType
  timestamp: number
  // Dados do produto
  acquisitionCost?: number
  otherCost?: number
  // Dados do serviço
  hours?: number
  hourlyLabor?: number
  materials?: number
  serviceOtherCost?: number
  // Comum
  variableFees: number
  tax: number
  desiredMargin: number
  // Resultados
  totalCostCents: number
  sellingPrice: number
  profitCents: number
  profitMargin: number
}

export default function SimulatorPage() {
  const [type, setType] = useState<SimulatorType>('product')
  const [viewMode, setViewMode] = useState<ViewMode>('simulator')
  const [savedTab, setSavedTab] = useState<SavedTab>('products')
  const [searchTerm, setSearchTerm] = useState('')
  const [simulationName, setSimulationName] = useState('')
  const [listViewMode, setListViewMode] = useState<'cards' | 'list'>('cards')
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>(() => {
    // Carregar simulações do localStorage na inicialização
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Erro ao carregar simulações:', error)
      return []
    }
  })
  
  // Estados para Produto - ZERADOS
  const [acquisitionCost, setAcquisitionCost] = useState(0)
  const [otherCost, setOtherCost] = useState(0)
  const [variableFees, setVariableFees] = useState(0)
  const [tax, setTax] = useState(0)
  const [desiredMargin, setDesiredMargin] = useState(0)

  // Estados para Serviço - ZERADOS
  const [hours, setHours] = useState(0)
  const [hourlyLabor, setHourlyLabor] = useState(0)
  const [materials, setMaterials] = useState(0)
  const [serviceOtherCost, setServiceOtherCost] = useState(0)
  const [serviceFees, setServiceFees] = useState(0)
  const [serviceTax, setServiceTax] = useState(0)
  const [serviceDesiredMargin, setServiceDesiredMargin] = useState(0)

  // Sincronizar savedSimulations com localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSimulations))
    } catch (error) {
      console.error('Erro ao salvar simulações:', error)
    }
  }, [savedSimulations])

  // Calcular custos do serviço
  const serviceTotalCost = useMemo(() => {
    return (hours * hourlyLabor) + materials + serviceOtherCost
  }, [hours, hourlyLabor, materials, serviceOtherCost])

  // Calcular pricing - Primeiro passo: obter o preço recomendado
  const initialPricing = useMemo(() => {
    if (type === 'product') {
      return calculateProductPricing({
        acquisitionCostCents: acquisitionCost,
        otherCostCents: otherCost,
        variableFeesPercent: variableFees,
        taxPercent: tax,
        desiredMarginPercent: desiredMargin,
        sellingPriceCents: undefined, // Sem preço de venda ainda
      })
    } else {
      return calculateProductPricing({
        acquisitionCostCents: serviceTotalCost,
        otherCostCents: 0,
        variableFeesPercent: serviceFees,
        taxPercent: serviceTax,
        desiredMarginPercent: serviceDesiredMargin,
        sellingPriceCents: undefined,
      })
    }
  }, [type, acquisitionCost, otherCost, variableFees, tax, desiredMargin, serviceTotalCost, serviceFees, serviceTax, serviceDesiredMargin])

  // O preço de venda é o recomendado pelo sistema
  const sellingPrice = initialPricing.recommendedPriceCents ?? initialPricing.minimumPriceCents

  // Calcular pricing final com o preço recomendado
  const pricing = useMemo(() => {
    if (type === 'product') {
      return calculateProductPricing({
        acquisitionCostCents: acquisitionCost,
        otherCostCents: otherCost,
        variableFeesPercent: variableFees,
        taxPercent: tax,
        desiredMarginPercent: desiredMargin,
        sellingPriceCents: sellingPrice,
      })
    } else {
      return calculateProductPricing({
        acquisitionCostCents: serviceTotalCost,
        otherCostCents: 0,
        variableFeesPercent: serviceFees,
        taxPercent: serviceTax,
        desiredMarginPercent: serviceDesiredMargin,
        sellingPriceCents: sellingPrice,
      })
    }
  }, [type, acquisitionCost, otherCost, variableFees, tax, desiredMargin, sellingPrice, serviceTotalCost, serviceFees, serviceTax, serviceDesiredMargin])

  const contributionMargin = pricing.contributionMarginPercent ?? 0
  const contributionCents = pricing.contributionCents ?? 0
  // Só considera prejuízo se tiver um preço de venda válido e o resultado for negativo
  const hasValidPrice = sellingPrice > 0 && pricing.contributionCents !== null
  const isLoss = hasValidPrice && contributionCents < 0
  const meetsTarget = hasValidPrice && contributionMargin >= (type === 'product' ? desiredMargin : serviceDesiredMargin)

  // Calcular Margem de Lucro (assumindo 0 despesas fixas no simulador)
  const profitMargin = contributionMargin
  const profitCents = contributionCents

  // Calcular totais de taxas
  const currentVariableFees = type === 'product' ? variableFees : serviceFees
  const currentTax = type === 'product' ? tax : serviceTax
  const totalTaxesPercent = currentVariableFees + currentTax // Soma de taxas variáveis + impostos
  const totalBurdensPercent = totalTaxesPercent // Total geral de encargos sobre venda

  // Determinar status
  const getStatus = () => {
    if (!hasValidPrice) return { label: 'AGUARDANDO DADOS', color: 'text-muted', bg: 'bg-muted/10', border: 'border-line', icon: Calculator }
    if (isLoss) return { label: 'PREJUÍZO', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400', icon: AlertTriangle }
    if (!meetsTarget) return { label: 'ABAIXO DA META', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400', icon: TrendingUp }
    return { label: 'LUCRATIVO', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400', icon: CheckCircle2 }
  }

  const status = getStatus()
  const StatusIcon = status.icon

  // Mensagem dinâmica
  const getMessage = () => {
    if (!hasValidPrice) {
      return 'Configure os custos e margens desejadas usando os controles deslizantes abaixo. O sistema calculará automaticamente o preço de venda ideal para você.'
    }
    if (isLoss) {
      return `Atenção! Com este preço você está tendo prejuízo de ${formatBRLFromCents(Math.abs(contributionCents))} por unidade. Aumente o preço para pelo menos ${formatBRLFromCents(pricing.minimumPriceCents)} para cobrir os custos.`
    }
    if (!meetsTarget) {
      const targetMargin = type === 'product' ? desiredMargin : serviceDesiredMargin
      return `Você está com margem de ${formatPercent(contributionMargin)}, mas sua meta é ${formatPercent(targetMargin)}. O preço recomendado para atingir a meta é ${formatBRLFromCents(pricing.recommendedPriceCents ?? 0)}.`
    }
    return `Excelente! Você está com margem de ${formatPercent(contributionMargin)}, acima da meta de ${formatPercent(type === 'product' ? desiredMargin : serviceDesiredMargin)}. Continue assim!`
  }

  // Função para salvar simulação
  const saveSimulation = () => {
    if (!simulationName.trim()) {
      alert('Por favor, dê um nome para esta simulação')
      return
    }

    const newSimulation: SavedSimulation = {
      id: Date.now().toString(),
      name: simulationName.trim(),
      type,
      timestamp: Date.now(),
      variableFees: type === 'product' ? variableFees : serviceFees,
      tax: type === 'product' ? tax : serviceTax,
      desiredMargin: type === 'product' ? desiredMargin : serviceDesiredMargin,
      totalCostCents: pricing.totalCostCents,
      sellingPrice,
      profitCents,
      profitMargin,
      ...(type === 'product' 
        ? { acquisitionCost, otherCost }
        : { hours, hourlyLabor, materials, serviceOtherCost }
      )
    }

    setSavedSimulations([...savedSimulations, newSimulation])
    setSimulationName('')
    alert('Simulação salva com sucesso!')
  }

  // Função para deletar simulação
  const deleteSimulation = (id: string) => {
    if (window.confirm('Deseja realmente excluir esta simulação?')) {
      setSavedSimulations(savedSimulations.filter(s => s.id !== id))
    }
  }

  // Função para carregar simulação
  const loadSimulation = (simulation: SavedSimulation) => {
    setType(simulation.type)
    
    if (simulation.type === 'product') {
      setAcquisitionCost(simulation.acquisitionCost ?? 0)
      setOtherCost(simulation.otherCost ?? 0)
      setVariableFees(simulation.variableFees)
      setTax(simulation.tax)
      setDesiredMargin(simulation.desiredMargin)
    } else {
      setHours(simulation.hours ?? 0)
      setHourlyLabor(simulation.hourlyLabor ?? 0)
      setMaterials(simulation.materials ?? 0)
      setServiceOtherCost(simulation.serviceOtherCost ?? 0)
      setServiceFees(simulation.variableFees)
      setServiceTax(simulation.tax)
      setServiceDesiredMargin(simulation.desiredMargin)
    }
    
    setViewMode('simulator')
    setSimulationName(simulation.name)
  }

  // Filtrar simulações salvas
  const filteredSimulations = savedSimulations.filter(s => 
    s.type === (savedTab === 'products' ? 'product' : 'service') &&
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-gold">SIMULADOR INTERATIVO</p>
          <h2 className="mt-2 text-2xl font-semibold">Simulador de Precificação</h2>
          <p className="mt-2 text-sm text-muted">
            Ajuste os valores com os controles deslizantes e veja em tempo real se seu preço é lucrativo.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('simulator')}
            className={`btn-secondary ${viewMode === 'simulator' ? 'bg-gold/10 border-gold' : ''}`}
          >
            <Calculator size={16} />
            Simulador
          </button>
          <button
            onClick={() => setViewMode('saved')}
            className={`btn-secondary ${viewMode === 'saved' ? 'bg-gold/10 border-gold' : ''}`}
          >
            <Save size={16} />
            Salvos ({savedSimulations.length})
          </button>
        </div>
      </div>

      {viewMode === 'saved' ? (
        // View de Simulações Salvas
        <div className="space-y-4">
          {/* Abas e Busca */}
          <div className="surface p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setSavedTab('products')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    savedTab === 'products'
                      ? 'bg-gold text-ink'
                      : 'bg-muted/10 text-muted hover:bg-muted/20'
                  }`}
                >
                  <Package size={16} className="inline mr-2" />
                  Produtos ({savedSimulations.filter(s => s.type === 'product').length})
                </button>
                <button
                  onClick={() => setSavedTab('services')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    savedTab === 'services'
                      ? 'bg-gold text-ink'
                      : 'bg-muted/10 text-muted hover:bg-muted/20'
                  }`}
                >
                  <Wrench size={16} className="inline mr-2" />
                  Serviços ({savedSimulations.filter(s => s.type === 'service').length})
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar simulação..."
                    className="field pl-10 w-full"
                  />
                </div>
                
                {/* Botão Cards/List */}
                <div className="flex gap-1 rounded-lg border border-line bg-panel p-1">
                  <button
                    onClick={() => setListViewMode('cards')}
                    className={`rounded-md p-2 transition-colors ${listViewMode === 'cards' ? 'bg-gold text-ink' : 'text-muted hover:text-paper'}`}
                    title="Visualização em cards"
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    onClick={() => setListViewMode('list')}
                    className={`rounded-md p-2 transition-colors ${listViewMode === 'list' ? 'bg-gold text-ink' : 'text-muted hover:text-paper'}`}
                    title="Visualização em lista"
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de Simulações */}
          {listViewMode === 'cards' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSimulations.length === 0 ? (
                <div className="surface p-8 text-center col-span-full">
                  <p className="text-sm text-muted">
                    {searchTerm ? 'Nenhuma simulação encontrada' : 'Nenhuma simulação salva ainda'}
                  </p>
                </div>
              ) : (
                filteredSimulations.map((simulation) => (
                  <div key={simulation.id} className="surface p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {simulation.type === 'product' ? (
                          <Package size={16} className="text-blue-400 shrink-0" />
                        ) : (
                          <Wrench size={16} className="text-purple-400 shrink-0" />
                        )}
                        <h3 className="font-semibold text-sm truncate">{simulation.name}</h3>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => loadSimulation(simulation)}
                          className="p-2 rounded-lg hover:bg-teal-light text-muted hover:text-gold transition-colors"
                          title="Carregar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => deleteSimulation(simulation.id)}
                          className="p-2 rounded-lg hover:bg-red-400/10 text-muted hover:text-red-400 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted">Custo total:</span>
                        <span className="font-mono font-semibold">{formatBRLFromCents(simulation.totalCostCents)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Preço de venda:</span>
                        <span className="font-mono font-semibold text-gold">{formatBRLFromCents(simulation.sellingPrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Lucro/unidade:</span>
                        <span className={`font-mono font-semibold ${simulation.profitCents >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatBRLFromCents(simulation.profitCents)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Margem de lucro:</span>
                        <span className={`font-mono font-semibold ${simulation.profitMargin >= simulation.desiredMargin ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {formatPercent(simulation.profitMargin)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-line text-xs text-muted">
                      {new Date(simulation.timestamp).toLocaleDateString('pt-BR', { 
                        day: '2-digit', 
                        month: 'short', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="surface overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="border-b border-line bg-panel/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Tipo</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted">Custo Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted">Preço</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted">Lucro</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted">Margem</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted">Data</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSimulations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">
                        {searchTerm ? 'Nenhuma simulação encontrada' : 'Nenhuma simulação salva ainda'}
                      </td>
                    </tr>
                  ) : (
                    filteredSimulations.map((simulation) => (
                      <tr key={simulation.id} className="border-b border-line hover:bg-panel/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {simulation.type === 'product' ? (
                              <Package size={14} className="text-blue-400 shrink-0" />
                            ) : (
                              <Wrench size={14} className="text-purple-400 shrink-0" />
                            )}
                            <span className="text-sm font-medium truncate max-w-[200px]">{simulation.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted">
                          {simulation.type === 'product' ? 'Produto' : 'Serviço'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm">
                          {formatBRLFromCents(simulation.totalCostCents)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-gold">
                          {formatBRLFromCents(simulation.sellingPrice)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono text-sm font-semibold ${simulation.profitCents >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatBRLFromCents(simulation.profitCents)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono text-sm font-semibold ${simulation.profitMargin >= simulation.desiredMargin ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {formatPercent(simulation.profitMargin)}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-muted">
                          {new Date(simulation.timestamp).toLocaleDateString('pt-BR', { 
                            day: '2-digit', 
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => loadSimulation(simulation)}
                              className="p-2 rounded-lg hover:bg-teal-light text-muted hover:text-gold transition-colors"
                              title="Carregar"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => deleteSimulation(simulation.id)}
                              className="p-2 rounded-lg hover:bg-red-400/10 text-muted hover:text-red-400 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        // View do Simulador
        <div className="space-y-6">

      {/* Tipo de Simulação */}
      <div className="surface p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Tipo de simulação</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setType('product')}
            className={`flex items-center gap-2 rounded-lg border-2 p-2.5 transition-all ${
              type === 'product'
                ? 'border-gold bg-gold/5 shadow-lg shadow-gold/20'
                : 'border-line hover:border-teal-border'
            }`}
          >
            <div className={`grid size-9 place-items-center rounded-lg ${type === 'product' ? 'bg-gold text-ink' : 'bg-muted/10 text-muted'}`}>
              <Package size={18} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-paper">Produto</p>
              <p className="text-[10px] text-muted">Simular precificação de produtos</p>
            </div>
          </button>
          
          <button
            type="button"
            onClick={() => setType('service')}
            className={`flex items-center gap-2 rounded-lg border-2 p-2.5 transition-all ${
              type === 'service'
                ? 'border-gold bg-gold/5 shadow-lg shadow-gold/20'
                : 'border-line hover:border-teal-border'
            }`}
          >
            <div className={`grid size-9 place-items-center rounded-lg ${type === 'service' ? 'bg-gold text-ink' : 'bg-muted/10 text-muted'}`}>
              <Wrench size={18} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-paper">Serviço</p>
              <p className="text-[10px] text-muted">Simular precificação de serviços</p>
            </div>
          </button>
        </div>
      </div>

      {/* Cards de Resultado no Topo - COMPACTOS */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Custo Total */}
        <div className="surface p-3">
          <div className="flex items-center gap-1.5">
            <div className="grid size-7 place-items-center rounded-lg bg-blue-500/10 text-blue-400">
              <Calculator size={14} />
            </div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">CUSTO TOTAL</p>
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-blue-400">
            {formatBRLFromCents(pricing.totalCostCents)}
          </p>
          <p className="mt-1 text-[10px] text-muted">
            Custo base + adicionais
          </p>
        </div>

        {/* Preço de Venda */}
        <div className="surface p-3">
          <div className="flex items-center gap-1.5">
            <div className="grid size-7 place-items-center rounded-lg bg-gold/10 text-gold">
              <DollarSign size={14} />
            </div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">PREÇO DE VENDA</p>
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-gold">
            {formatBRLFromCents(sellingPrice)}
          </p>
          <p className="mt-1 text-[10px] text-muted">
            Mín: <span className="font-mono font-semibold text-amber-400">{formatBRLFromCents(pricing.minimumPriceCents)}</span>
          </p>
        </div>

        {/* Resultado por Unidade */}
        <div className="surface p-3">
          <div className="flex items-center gap-1.5">
            <div className={`grid size-7 place-items-center rounded-lg ${isLoss ? 'bg-red-400/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              {isLoss ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
            </div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">{isLoss ? 'PREJUÍZO' : 'LUCRO'}</p>
          </div>
          <p className={`mt-2 font-mono text-xl font-bold ${isLoss ? 'text-red-400' : 'text-emerald-400'}`}>
            {formatBRLFromCents(Math.abs(contributionCents))}
          </p>
          <p className="mt-1 text-[10px] text-muted">
            {isLoss ? 'Perda por venda' : 'Ganho por venda'}
          </p>
        </div>

        {/* Margem de Lucro */}
        <div className="surface p-3">
          <div className="flex items-center gap-1.5">
            <div className={`grid size-7 place-items-center rounded-lg ${status.bg}`}>
              <Target size={14} className={status.color} />
            </div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">MARGEM</p>
          </div>
          <p className={`mt-2 font-mono text-xl font-bold ${status.color}`}>
            {formatPercent(profitMargin)}
          </p>
          <p className="mt-1 text-[10px] text-muted">
            Meta: {formatPercent(type === 'product' ? desiredMargin : serviceDesiredMargin)}
          </p>
        </div>

        {/* Total de Taxas (Variáveis + Impostos) */}
        <div className="surface p-3">
          <div className="flex items-center gap-1.5">
            <div className="grid size-7 place-items-center rounded-lg bg-orange-500/10 text-orange-400">
              <Percent size={14} />
            </div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">TAXAS</p>
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-orange-400">
            {formatPercent(totalTaxesPercent)}
          </p>
          <p className="mt-1 text-[10px] text-muted">
            Var: {formatPercent(currentVariableFees)} + Imp: {formatPercent(currentTax)}
          </p>
        </div>

        {/* Total Geral sobre Venda */}
        <div className="surface p-3">
          <div className="flex items-center gap-1.5">
            <div className="grid size-7 place-items-center rounded-lg bg-purple-500/10 text-purple-400">
              <Receipt size={14} />
            </div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">ENCARGOS</p>
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-purple-400">
            {formatPercent(totalBurdensPercent)}
          </p>
          <p className="mt-1 text-[10px] text-muted">
            Total sobre a venda
          </p>
        </div>
      </div>

      {/* Status Banner - COMPACTO */}
      <div className={`surface border-2 ${status.border} ${status.bg} p-4`}>
        <div className="flex items-start gap-3">
          <div className={`grid size-12 shrink-0 place-items-center rounded-xl ${status.bg} ring-2 ring-offset-2 ring-offset-graphite ${status.border}`}>
            <StatusIcon size={24} className={status.color} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={`text-lg font-bold ${status.color}`}>{status.label}</p>
              <Sparkles size={16} className={status.color} />
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-paper">
              {getMessage()}
            </p>
          </div>
        </div>
      </div>

      {/* Controles Deslizantes - COMPACTOS */}
      {type === 'product' ? (
        <div className="surface p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <div className="grid size-8 place-items-center rounded-lg bg-gold/10 text-gold">
              <Package size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold">Configuração do Produto</p>
              <p className="text-[10px] text-muted">Ajuste os custos e margens desejadas</p>
            </div>
          </div>

          {/* Custo de Aquisição */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-paper">Custo de Aquisição/Produção</label>
              <span className="font-mono text-base font-bold text-gold">{formatBRLFromCents(acquisitionCost)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100000"
              step="100"
              value={acquisitionCost}
              onChange={(e) => setAcquisitionCost(Number(e.target.value))}
              className="slider w-full"
            />
            <div className="mt-0.5 flex justify-between text-[10px] text-muted">
              <span>R$ 0</span>
              <span>R$ 1.000</span>
            </div>
          </div>

          {/* Custos Adicionais */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-paper">Custos Adicionais</label>
              <span className="font-mono text-base font-bold text-gold">{formatBRLFromCents(otherCost)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="50000"
              step="100"
              value={otherCost}
              onChange={(e) => setOtherCost(Number(e.target.value))}
              className="slider w-full"
            />
            <div className="mt-0.5 flex justify-between text-[10px] text-muted">
              <span>R$ 0</span>
              <span>R$ 500</span>
            </div>
          </div>

          {/* Taxas Variáveis */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-paper">Taxas Variáveis (Cartão, Comissões)</label>
              <span className="font-mono text-base font-bold text-amber-400">{formatPercent(variableFees)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              step="0.5"
              value={variableFees}
              onChange={(e) => setVariableFees(Number(e.target.value))}
              className="slider w-full"
            />
            <div className="mt-0.5 flex justify-between text-[10px] text-muted">
              <span>0%</span>
              <span>40%</span>
            </div>
          </div>

          {/* Impostos */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-paper">Impostos sobre Venda</label>
              <span className="font-mono text-base font-bold text-red-400">{formatPercent(tax)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="0.5"
              value={tax}
              onChange={(e) => setTax(Number(e.target.value))}
              className="slider w-full"
            />
            <div className="mt-0.5 flex justify-between text-[10px] text-muted">
              <span>0%</span>
              <span>30%</span>
            </div>
          </div>

          {/* Margem Desejada */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-paper">Margem Desejada</label>
              <span className="font-mono text-base font-bold text-emerald-400">{formatPercent(desiredMargin)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={desiredMargin}
              onChange={(e) => setDesiredMargin(Number(e.target.value))}
              className="slider w-full"
            />
            <div className="mt-0.5 flex justify-between text-[10px] text-muted">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="surface p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <div className="grid size-8 place-items-center rounded-lg bg-gold/10 text-gold">
              <Wrench size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold">Configuração do Serviço</p>
              <p className="text-[10px] text-muted">Ajuste horas, custos e margens</p>
            </div>
          </div>

          {/* Horas de Execução */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-paper">Horas de Execução</label>
              <span className="font-mono text-base font-bold text-gold">{hours}h</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="40"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="slider w-full"
            />
            <div className="mt-0.5 flex justify-between text-[10px] text-muted">
              <span>0.5h</span>
              <span>40h</span>
            </div>
          </div>

          {/* Custo-hora de M.O. */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-paper">Custo-hora de Mão de Obra</label>
              <span className="font-mono text-base font-bold text-gold">{formatBRLFromCents(hourlyLabor)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="50000"
              step="100"
              value={hourlyLabor}
              onChange={(e) => setHourlyLabor(Number(e.target.value))}
              className="slider w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>R$ 0/h</span>
              <span>R$ 500/h</span>
            </div>
          </div>

          {/* Materiais */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-paper">Materiais e Insumos</label>
              <span className="font-mono text-lg font-bold text-gold">{formatBRLFromCents(materials)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100000"
              step="100"
              value={materials}
              onChange={(e) => setMaterials(Number(e.target.value))}
              className="slider w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>R$ 0</span>
              <span>R$ 1.000</span>
            </div>
          </div>

          {/* Custos Adicionais */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-paper">Custos Adicionais</label>
              <span className="font-mono text-lg font-bold text-gold">{formatBRLFromCents(serviceOtherCost)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="50000"
              step="100"
              value={serviceOtherCost}
              onChange={(e) => setServiceOtherCost(Number(e.target.value))}
              className="slider w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>R$ 0</span>
              <span>R$ 500</span>
            </div>
          </div>

          {/* Taxas Variáveis */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-paper">Taxas Variáveis</label>
              <span className="font-mono text-lg font-bold text-amber-400">{formatPercent(serviceFees)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              step="0.5"
              value={serviceFees}
              onChange={(e) => setServiceFees(Number(e.target.value))}
              className="slider w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>0%</span>
              <span>40%</span>
            </div>
          </div>

          {/* Impostos */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-paper">Impostos sobre Venda</label>
              <span className="font-mono text-lg font-bold text-red-400">{formatPercent(serviceTax)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="0.5"
              value={serviceTax}
              onChange={(e) => setServiceTax(Number(e.target.value))}
              className="slider w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>0%</span>
              <span>30%</span>
            </div>
          </div>

          {/* Margem Desejada */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-paper">Margem Desejada</label>
              <span className="font-mono text-lg font-bold text-emerald-400">{formatPercent(serviceDesiredMargin)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={serviceDesiredMargin}
              onChange={(e) => setServiceDesiredMargin(Number(e.target.value))}
              className="slider w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      )}

      {/* Recomendação e Salvar */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface bg-gradient-to-br from-gold/5 via-transparent to-emerald-500/5 p-6">
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-gold text-ink">
              <Zap size={24} />
            </div>
            <div>
              <p className="font-semibold text-paper">Preço Recomendado pelo Sistema</p>
              <p className="mt-1 text-sm text-muted">Para atingir sua margem desejada de {formatPercent(type === 'product' ? desiredMargin : serviceDesiredMargin)}</p>
              <p className="mt-3 font-mono text-4xl font-bold text-gold">
                {formatBRLFromCents(pricing.recommendedPriceCents ?? 0)}
              </p>
              <p className="mt-2 text-xs text-muted">
                Preço mínimo para cobrir custos: <span className="font-mono font-semibold text-paper">{formatBRLFromCents(pricing.minimumPriceCents)}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Salvar Simulação */}
        <div className="surface p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid size-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Save size={20} />
            </div>
            <div>
              <p className="font-semibold text-paper">Salvar Simulação</p>
              <p className="text-xs text-muted">Guarde esta configuração para consultar depois</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-2">Nome da simulação</label>
              <input
                type="text"
                value={simulationName}
                onChange={(e) => setSimulationName(e.target.value)}
                placeholder={`Ex: ${type === 'product' ? 'Produto Premium' : 'Instalação Completa'}`}
                className="field w-full"
                maxLength={50}
              />
            </div>
            
            <button
              onClick={saveSimulation}
              className="btn-primary w-full"
              disabled={!simulationName.trim()}
            >
              <Save size={16} />
              Salvar Simulação
            </button>
          </div>
        </div>
      </div>
        </div>
      )}
    </div>
  )
}
