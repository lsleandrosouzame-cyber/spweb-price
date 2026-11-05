import { describe, expect, it } from 'vitest'
import { calculateProductPricing, PricingInputError, calculateServiceCost } from '../src/finance/pricing'
import { calculateBreakEven, calculateOperatingCosts } from '../src/finance/operations'

describe('motor financeiro SPWeb Lucro', () => {
  it('calcula o caso de referência de preço, contribuição, margem e markup', () => {
    const result = calculateProductPricing({
      acquisitionCostCents: 5000,
      variableFeesPercent: 5,
      taxPercent: 10,
      desiredMarginPercent: 20,
      sellingPriceCents: 7692,
    })
    expect(result.totalCostCents).toBe(5000)
    expect(result.recommendedPriceCents).toBeCloseTo(7692.3077, 3)
    expect(result.contributionCents).toBeCloseTo(1538, 0)
    expect(result.contributionMarginPercent).toBeCloseTo(20, 1)
    expect(result.markup).toBeCloseTo(1.5384, 3)
  })

  it('preserva preço abaixo do custo como resultado negativo, sem ocultar prejuízo', () => {
    const result = calculateProductPricing({ acquisitionCostCents: 5000, variableFeesPercent: 5, taxPercent: 10, sellingPriceCents: 4000 })
    expect(result.contributionCents).toBeLessThan(0)
    expect(result.contributionMarginPercent).toBeLessThan(0)
  })

  it('rejeita percentuais inválidos e denominadores nulos ou negativos', () => {
    expect(() => calculateProductPricing({ acquisitionCostCents: 1000, variableFeesPercent: 101, taxPercent: 0 })).toThrow(PricingInputError)
    expect(() => calculateProductPricing({ acquisitionCostCents: 1000, variableFeesPercent: 70, taxPercent: 30 })).toThrow(/denominador positivo/)
    expect(() => calculateProductPricing({ acquisitionCostCents: 1000, variableFeesPercent: 5, taxPercent: 10, desiredMarginPercent: 90 })).toThrow(/incompatível/)
  })

  it('permite cálculo parcial sem preço ou margem, e não inventa resultado', () => {
    const result = calculateProductPricing({ acquisitionCostCents: 1000, variableFeesPercent: 5, taxPercent: 10 })
    expect(result.minimumPriceCents).toBeCloseTo(1176.47, 2)
    expect(result.recommendedPriceCents).toBeNull()
    expect(result.contributionCents).toBeNull()
  })

  it('calcula custo de serviço e só inclui rateio fixo quando selecionado', () => {
    const base = calculateServiceCost({ hours: 2, hourlyLaborCostCents: 3000, materialsCents: 500 })
    const withFixed = calculateServiceCost({ hours: 2, hourlyLaborCostCents: 3000, materialsCents: 500, fixedCostPerHourCents: 250, includeFixedCostPerHour: true })
    expect(base).toBe(6500)
    expect(withFixed).toBe(7000)
  })

  it('calcula custo diário/hora e rejeita divisores inválidos', () => {
    const result = calculateOperatingCosts(300000, 20, 6)
    expect(result.monthlyProductiveHours).toBe(120)
    expect(result.fixedDailyCents).toBe(15000)
    expect(result.fixedHourlyCents).toBe(2500)
    expect(() => calculateOperatingCosts(1000, 0, 8)).toThrow()
  })

  it('usa margem ponderada pela receita para o ponto de equilíbrio', () => {
    const result = calculateBreakEven(100000, [
      { sellingPriceCents: 10000, contributionCents: 5000, quantity: 1 },
      { sellingPriceCents: 90000, contributionCents: 9000, quantity: 1 },
    ])
    expect(result?.weightedContributionMarginPercent).toBeCloseTo(14, 5)
    expect(result?.breakEvenRevenueCents).toBeCloseTo(714285.714, 2)
  })

  it('não estima ponto de equilíbrio sem mix válido ou margem positiva', () => {
    expect(calculateBreakEven(100000, [])).toBeNull()
    expect(calculateBreakEven(100000, [{ sellingPriceCents: 1000, contributionCents: 0, quantity: 1 }])).toBeNull()
    expect(calculateBreakEven(100000, [{ sellingPriceCents: 1000, contributionCents: -100, quantity: 1 }])).toBeNull()
  })
})
