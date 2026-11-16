import { useMemo } from 'react'
import type { FixedExpenseRecord, ProductRecord, AssetLiabilityRecord } from '../types/database'

export type FinancialDiagnosisInput = {
  fixedExpenses: FixedExpenseRecord[]
  products: ProductRecord[]
  assetsLiabilities: AssetLiabilityRecord[]
  variableCostPercent: number
  workingDaysPerMonth: number
  productiveHoursPerDay: number
  proLaboreCents: number | null
  revenueForecastCents: number | null
  desiredMarginPercent: number | null
}

export type SuspiciousExpense = {
  id: string
  description: string
  category: string
  value: number
  reason: string
}

export type ProductMixItem = {
  id: string
  name: string
  marginPercent: number
  unitMarginCents: number
  quantityToPayExpenses: number
}

export type FinancialDiagnosisResult = {
  // Core metrics
  breakEvenCents: number
  safetyMarginCents: number
  safetyMarginPercent: number
  daysToPayExpenses: number
  daysProfitable: number
  netProfitCents: number
  netProfitPercent: number
  
  // Ideal scenario
  idealRevenueCents: number
  idealExpensesCents: number
  idealProfitCents: number
  revenueIncreaseNeeded: number
  expenseCutNeeded: number
  
  // Hour cost
  costPerHourCents: number
  idleCost2HoursCents: number
  
  // Audit
  suspiciousExpenses: SuspiciousExpense[]
  simulatedBreakEvenCents: number
  
  // Product mix
  lowestMarginProduct: ProductMixItem | null
  highestMarginProduct: ProductMixItem | null
  criticalProductsCount: number
  
  // Health score
  healthScore: number
  healthStatus: 'critical' | 'attention' | 'healthy'
  healthLabel: string
}

const safeDivide = (numerator: number, denominator: number, fallback = 0): number => {
  if (!denominator || denominator === 0 || !isFinite(denominator)) return fallback
  const result = numerator / denominator
  return isFinite(result) ? result : fallback
}

export function useFinancialDiagnosis(input: FinancialDiagnosisInput): FinancialDiagnosisResult {
  return useMemo(() => {
    const FAT = input.revenueForecastCents ?? 0
    const DF = input.fixedExpenses.reduce((sum, exp) => sum + (exp.amount_cents ?? 0), 0)
    const CV_PCT = input.variableCostPercent / 100
    const MC_PCT = 1 - CV_PCT
    const META_LUCRO_PCT = (input.desiredMarginPercent ?? 0) / 100
    const DIAS = input.workingDaysPerMonth || 30
    const HORAS = input.productiveHoursPerDay || 8

    // 1. Ponto de Equilíbrio Atual
    const PE_ATUAL = MC_PCT > 0 ? safeDivide(DF, MC_PCT, 0) : 0

    // 2. Margem de Segurança
    const MS_VALOR = FAT - PE_ATUAL
    const MS_PCT = safeDivide(MS_VALOR, FAT, 0) * 100

    // 3. Dias para Pagar Contas vs Dias de Lucro
    const DIAS_PE = FAT > 0 ? Math.min(DIAS, safeDivide(PE_ATUAL, FAT, DIAS) * DIAS) : DIAS
    const DIAS_LUCRO = Math.max(0, DIAS - DIAS_PE)

    // 4. Lucro Líquido Projetado
    const LUCRO_REAL_VALOR = (FAT * MC_PCT) - DF
    const LUCRO_REAL_PCT = safeDivide(LUCRO_REAL_VALOR, FAT, 0) * 100

    // 5. Cenário Ideal
    const divisor = MC_PCT - META_LUCRO_PCT
    const FAT_IDEAL = divisor > 0 ? safeDivide(DF, divisor, 0) : 0
    const DF_IDEAL = FAT * (MC_PCT - META_LUCRO_PCT)
    const LUCRO_IDEAL = FAT * META_LUCRO_PCT
    const revenueIncreaseNeeded = FAT > 0 ? safeDivide(FAT_IDEAL - FAT, FAT, 0) * 100 : 0
    const expenseCutNeeded = DF - DF_IDEAL

    // 6. Custo da Hora Parada
    const totalHours = DIAS * HORAS
    const CUSTO_HORA = totalHours > 0 ? safeDivide(DF, totalHours, 0) : 0
    const CUSTO_OCIOSIDADE_2H = CUSTO_HORA * 2 * DIAS

    // 7. Auditoria de Inconsistências
    const suspiciousTerms = ['aquisição', 'produto', 'estoque', 'mercadoria', 'fornecedor', 'revenda']
    const suspiciousExpenses: SuspiciousExpense[] = []
    
    for (const expense of input.fixedExpenses) {
      const value = expense.amount_cents ?? 0
      const category = expense.category?.toLowerCase() || ''
      const description = expense.description?.toLowerCase() || ''
      
      let reason = ''
      
      // Check for "Outras despesas" with high value
      if (category.includes('outras') && value > DF * 0.2) {
        reason = 'Categoria "Outras despesas" com valor > 20% do total'
      }
      
      // Check for suspicious terms
      if (!reason) {
        for (const term of suspiciousTerms) {
          if (description.includes(term) || category.includes(term)) {
            reason = `Possível custo variável (termo: "${term}")`
            break
          }
        }
      }
      
      if (reason) {
        suspiciousExpenses.push({
          id: expense.id,
          description: expense.description || '',
          category: expense.category || '',
          value,
          reason
        })
      }
    }
    
    const VALOR_SUSPEITO = suspiciousExpenses.reduce((sum, exp) => sum + exp.value, 0)
    const DF_SIMULADO = DF - VALOR_SUSPEITO
    const PE_SIMULADO = MC_PCT > 0 ? safeDivide(DF_SIMULADO, MC_PCT, 0) : 0

    // 8. Mix de Sobrevivência
    const productsWithMargin: ProductMixItem[] = input.products
      .map(p => {
        const cost = p.acquisition_cost_cents ?? 0
        const price = p.current_price_cents ?? 0
        const fees = (p.variable_fees_percent ?? 0) / 100
        const tax = (p.tax_percent ?? 0) / 100
        
        const unitMarginCents = price - cost - (price * (fees + tax))
        const marginPercent = price > 0 ? safeDivide(unitMarginCents, price, 0) * 100 : 0
        
        return {
          id: p.id,
          name: p.name,
          marginPercent,
          unitMarginCents,
          quantityToPayExpenses: unitMarginCents > 0 ? Math.ceil(DF / unitMarginCents) : 999999
        }
      })
      .filter(p => p.unitMarginCents > 0)
      .sort((a, b) => a.unitMarginCents - b.unitMarginCents)

    const lowestMarginProduct = productsWithMargin[0] || null
    const highestMarginProduct = productsWithMargin[productsWithMargin.length - 1] || null
    
    const minRequiredMargin = MC_PCT - META_LUCRO_PCT
    const criticalProductsCount = input.products.filter(p => {
      const price = p.current_price_cents ?? 0
      const cost = p.acquisition_cost_cents ?? 0
      const fees = (p.variable_fees_percent ?? 0) / 100
      const tax = (p.tax_percent ?? 0) / 100
      const unitMargin = price - cost - (price * (fees + tax))
      const marginPercent = price > 0 ? safeDivide(unitMargin, price, 0) : 0
      return marginPercent < minRequiredMargin
    }).length

    // 9. Score de Saúde Financeira
    let healthScore = 0
    
    // Base score on safety margin (0-60 points)
    if (MS_PCT >= 50) {
      healthScore += 60
    } else if (MS_PCT >= 30) {
      healthScore += 40 + (MS_PCT - 30) // 40-50
    } else if (MS_PCT >= 10) {
      healthScore += 20 + (MS_PCT - 10) // 20-40
    } else if (MS_PCT >= 0) {
      healthScore += MS_PCT * 2 // 0-20
    }
    
    // Add score based on profit margin (0-40 points)
    if (LUCRO_REAL_PCT >= META_LUCRO_PCT * 100) {
      healthScore += 40
    } else if (LUCRO_REAL_PCT >= 0) {
      healthScore += safeDivide(LUCRO_REAL_PCT, META_LUCRO_PCT * 100, 0) * 40
    }
    
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))
    
    let healthStatus: 'critical' | 'attention' | 'healthy'
    let healthLabel: string
    
    if (healthScore < 50) {
      healthStatus = 'critical'
      healthLabel = 'OPERAÇÃO NO LIMITE'
    } else if (healthScore < 75) {
      healthStatus = 'attention'
      healthLabel = 'EM EVOLUÇÃO'
    } else {
      healthStatus = 'healthy'
      healthLabel = 'SAUDÁVEL'
    }

    return {
      breakEvenCents: Math.round(PE_ATUAL),
      safetyMarginCents: Math.round(MS_VALOR),
      safetyMarginPercent: MS_PCT,
      daysToPayExpenses: Math.round(DIAS_PE * 10) / 10,
      daysProfitable: Math.round(DIAS_LUCRO * 10) / 10,
      netProfitCents: Math.round(LUCRO_REAL_VALOR),
      netProfitPercent: LUCRO_REAL_PCT,
      idealRevenueCents: Math.round(FAT_IDEAL),
      idealExpensesCents: Math.round(DF_IDEAL),
      idealProfitCents: Math.round(LUCRO_IDEAL),
      revenueIncreaseNeeded,
      expenseCutNeeded: Math.round(expenseCutNeeded),
      costPerHourCents: Math.round(CUSTO_HORA),
      idleCost2HoursCents: Math.round(CUSTO_OCIOSIDADE_2H),
      suspiciousExpenses,
      simulatedBreakEvenCents: Math.round(PE_SIMULADO),
      lowestMarginProduct,
      highestMarginProduct,
      criticalProductsCount,
      healthScore,
      healthStatus,
      healthLabel
    }
  }, [input])
}
