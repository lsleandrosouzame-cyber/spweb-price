import { useState, useMemo } from 'react'
import { Calculator, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Sparkles, Package, Wrench, DollarSign, Target, Zap } from 'lucide-react'
import { calculateProductPricing } from '../finance/pricing'
import { formatBRLFromCents, formatPercent } from '../lib/money'

type SimulatorType = 'product' | 'service'

export default function SimulatorPage() {
  const [type, setType] = useState<SimulatorType>('product')
  
  // Estados para Produto
  const [acquisitionCost, setAcquisitionCost] = useState(10000) // R$ 100,00 em centavos
  const [otherCost, setOtherCost] = useState(2000) // R$ 20,00
  const [variableFees, setVariableFees] = useState(13) // 13%
  const [tax, setTax] = useState(8) // 8%
  const [desiredMargin, setDesiredMargin] = useState(25) // 25%
  const [sellingPrice, setSellingPrice] = useState(35000) // R$ 350,00

  // Estados para Serviço
  const [hours, setHours] = useState(8)
  const [hourlyLabor, setHourlyLabor] = useState(5000) // R$ 50,00/hora
  const [materials, setMaterials] = useState(15000) // R$ 150,00
  const [serviceOtherCost, setServiceOtherCost] = useState(3000) // R$ 30,00
  const [serviceFees, setServiceFees] = useState(13)
  const [serviceTax, setServiceTax] = useState(8)
  const [serviceDesiredMargin, setServiceDesiredMargin] = useState(25)
  const [servicePrice, setServicePrice] = useState(80000) // R$ 800,00

  // Calcular custos do serviço
  const serviceTotalCost = useMemo(() => {
    return (hours * hourlyLabor) + materials + serviceOtherCost
  }, [hours, hourlyLabor, materials, serviceOtherCost])

  // Calcular pricing
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
        sellingPriceCents: servicePrice,
      })
    }
  }, [type, acquisitionCost, otherCost, variableFees, tax, desiredMargin, sellingPrice, serviceTotalCost, serviceFees, serviceTax, serviceDesiredMargin, servicePrice])

  const contributionMargin = pricing.contributionMarginPercent ?? 0
  const contributionCents = pricing.contributionCents ?? 0
  const isProfit = contributionCents > 0
  const isLoss = contributionCents < 0
  const meetsTarget = contributionMargin >= (type === 'product' ? desiredMargin : serviceDesiredMargin)

  // Determinar status
  const getStatus = () => {
    if (isLoss) return { label: 'PREJUÍZO', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400', icon: AlertTriangle }
    if (!meetsTarget) return { label: 'ABAIXO DA META', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400', icon: TrendingUp }
    return { label: 'LUCRATIVO', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400', icon: CheckCircle2 }
  }

  const status = getStatus()
  const StatusIcon = status.icon

  // Mensagem dinâmica
  const getMessage = () => {
    if (isLoss) {
      return `Atenção! Com este preço você está tendo prejuízo de ${formatBRLFromCents(Math.abs(contributionCents))} por unidade. Aumente o preço para pelo menos ${formatBRLFromCents(pricing.minimumPriceCents)} para cobrir os custos.`
    }
    if (!meetsTarget) {
      const targetMargin = type === 'product' ? desiredMargin : serviceDesiredMargin
      return `Você está com margem de ${formatPercent(contributionMargin)}, mas sua meta é ${formatPercent(targetMargin)}. O preço recomendado para atingir a meta é ${formatBRLFromCents(pricing.recommendedPriceCents ?? 0)}.`
    }
    return `Excelente! Você está com margem de ${formatPercent(contributionMargin)}, acima da meta de ${formatPercent(type === 'product' ? desiredMargin : serviceDesiredMargin)}. Continue assim!`
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <p className="eyebrow text-gold">SIMULADOR INTERATIVO</p>
        <h2 className="mt-2 text-2xl font-semibold">Simulador de Precificação</h2>
        <p className="mt-2 text-sm text-muted">
          Ajuste os valores com os controles deslizantes e veja em tempo real se seu preço é lucrativo.
        </p>
      </div>

      {/* Tipo de Simulação */}
      <div className="surface p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Tipo de simulação</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setType('product')}
            className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${
              type === 'product'
                ? 'border-gold bg-gold/5 shadow-lg shadow-gold/20'
                : 'border-line hover:border-teal-border'
            }`}
          >
            <div className={`grid size-12 place-items-center rounded-lg ${type === 'product' ? 'bg-gold text-ink' : 'bg-muted/10 text-muted'}`}>
              <Package size={24} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-paper">Produto</p>
              <p className="text-xs text-muted">Simular precificação de produtos</p>
            </div>
          </button>
          
          <button
            type="button"
            onClick={() => setType('service')}
            className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${
              type === 'service'
                ? 'border-gold bg-gold/5 shadow-lg shadow-gold/20'
                : 'border-line hover:border-teal-border'
            }`}
          >
            <div className={`grid size-12 place-items-center rounded-lg ${type === 'service' ? 'bg-gold text-ink' : 'bg-muted/10 text-muted'}`}>
              <Wrench size={24} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-paper">Serviço</p>
              <p className="text-xs text-muted">Simular precificação de serviços</p>
            </div>
          </button>
        </div>
      </div>

      {/* Cards de Resultado no Topo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Custo Total */}
        <div className="surface p-5">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-lg bg-blue-500/10 text-blue-400">
              <Calculator size={18} />
            </div>
            <p className="text-xs font-semibold text-muted">CUSTO TOTAL</p>
          </div>
          <p className="mt-3 font-mono text-3xl font-bold text-blue-400">
            {formatBRLFromCents(pricing.totalCostCents)}
          </p>
          <p className="mt-2 text-xs text-muted">
            Custo base + adicionais
          </p>
        </div>

        {/* Preço de Venda */}
        <div className="surface p-5">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-lg bg-gold/10 text-gold">
              <DollarSign size={18} />
            </div>
            <p className="text-xs font-semibold text-muted">PREÇO DE VENDA</p>
          </div>
          <p className="mt-3 font-mono text-3xl font-bold text-gold">
            {formatBRLFromCents(type === 'product' ? sellingPrice : servicePrice)}
          </p>
          <p className="mt-2 text-xs text-muted">
            Preço praticado/simulado
          </p>
        </div>

        {/* Resultado por Unidade */}
        <div className="surface p-5">
          <div className="flex items-center gap-2">
            <div className={`grid size-9 place-items-center rounded-lg ${isLoss ? 'bg-red-400/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              {isLoss ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
            </div>
            <p className="text-xs font-semibold text-muted">{isLoss ? 'PREJUÍZO' : 'LUCRO'} / UNIDADE</p>
          </div>
          <p className={`mt-3 font-mono text-3xl font-bold ${isLoss ? 'text-red-400' : 'text-emerald-400'}`}>
            {formatBRLFromCents(Math.abs(contributionCents))}
          </p>
          <p className="mt-2 text-xs text-muted">
            {isLoss ? 'Perda por venda' : 'Ganho por venda'}
          </p>
        </div>

        {/* Margem de Contribuição */}
        <div className="surface p-5">
          <div className="flex items-center gap-2">
            <div className={`grid size-9 place-items-center rounded-lg ${status.bg}`}>
              <Target size={18} className={status.color} />
            </div>
            <p className="text-xs font-semibold text-muted">MARGEM CONTRIB.</p>
          </div>
          <p className={`mt-3 font-mono text-3xl font-bold ${status.color}`}>
            {formatPercent(contributionMargin)}
          </p>
          <p className="mt-2 text-xs text-muted">
            Meta: {formatPercent(type === 'product' ? desiredMargin : serviceDesiredMargin)}
          </p>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`surface border-2 ${status.border} ${status.bg} p-6`}>
        <div className="flex items-start gap-4">
          <div className={`grid size-16 shrink-0 place-items-center rounded-2xl ${status.bg} ring-2 ring-offset-2 ring-offset-graphite ${status.border}`}>
            <StatusIcon size={32} className={status.color} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <p className={`text-xl font-bold ${status.color}`}>{status.label}</p>
              <Sparkles size={20} className={status.color} />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-paper">
              {getMessage()}
            </p>
          </div>
        </div>
      </div>

      {/* Controles Deslizantes */}
      {type === 'product' ? (
        <div className="surface p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <div className="grid size-10 place-items-center rounded-lg bg-gold/10 text-gold">
              <Package size={20} />
            </div>
            <div>
              <p className="font-semibold">Configuração do Produto</p>
              <p className="text-xs text-muted">Ajuste os custos e margens desejadas</p>
            </div>
          </div>

          {/* Custo de Aquisição */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-paper">Custo de Aquisição/Produção</label>
              <span className="font-mono text-lg font-bold text-gold">{formatBRLFromCents(acquisitionCost)}</span>
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
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>R$ 0</span>
              <span>R$ 1.000</span>
            </div>
          </div>

          {/* Custos Adicionais */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-paper">Custos Adicionais</label>
              <span className="font-mono text-lg font-bold text-gold">{formatBRLFromCents(otherCost)}</span>
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
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>R$ 0</span>
              <span>R$ 500</span>
            </div>
          </div>

          {/* Taxas Variáveis */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-paper">Taxas Variáveis (Cartão, Comissões)</label>
              <span className="font-mono text-lg font-bold text-amber-400">{formatPercent(variableFees)}</span>
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
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>0%</span>
              <span>40%</span>
            </div>
          </div>

          {/* Impostos */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-paper">Impostos sobre Venda</label>
              <span className="font-mono text-lg font-bold text-red-400">{formatPercent(tax)}</span>
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
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>0%</span>
              <span>30%</span>
            </div>
          </div>

          {/* Margem Desejada */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-paper">Margem Desejada</label>
              <span className="font-mono text-lg font-bold text-emerald-400">{formatPercent(desiredMargin)}</span>
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
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Preço de Venda */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-paper">Preço de Venda (Teste)</label>
              <span className="font-mono text-lg font-bold text-gold">{formatBRLFromCents(sellingPrice)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="200000"
              step="100"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(Number(e.target.value))}
              className="slider w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>R$ 0</span>
              <span>R$ 2.000</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="surface p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <div className="grid size-10 place-items-center rounded-lg bg-gold/10 text-gold">
              <Wrench size={20} />
            </div>
            <div>
              <p className="font-semibold">Configuração do Serviço</p>
              <p className="text-xs text-muted">Ajuste horas, custos e margens</p>
            </div>
          </div>

          {/* Horas de Execução */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-paper">Horas de Execução</label>
              <span className="font-mono text-lg font-bold text-gold">{hours}h</span>
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
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>0.5h</span>
              <span>40h</span>
            </div>
          </div>

          {/* Custo-hora de M.O. */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-paper">Custo-hora de Mão de Obra</label>
              <span className="font-mono text-lg font-bold text-gold">{formatBRLFromCents(hourlyLabor)}</span>
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

          {/* Preço de Venda */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-paper">Preço do Serviço (Teste)</label>
              <span className="font-mono text-lg font-bold text-gold">{formatBRLFromCents(servicePrice)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="300000"
              step="100"
              value={servicePrice}
              onChange={(e) => setServicePrice(Number(e.target.value))}
              className="slider w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>R$ 0</span>
              <span>R$ 3.000</span>
            </div>
          </div>
        </div>
      )}

      {/* Recomendação */}
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
    </div>
  )
}
