import { describe, expect, it } from 'vitest'
import { calculateProductPricing } from '../src/finance/pricing'

// Cenário obrigatório do brief de correção do motor de precificação:
// custo = R$ 179,10 · taxas = 19% · margem = 30% · preço praticado hoje = R$ 399,00
describe('motor de precificação — cenário obrigatório do brief', () => {
  const base = {
    acquisitionCostCents: 17910, // R$ 179,10
    otherCostCents: 0,
    variableFeesPercent: 19,    // soma de todas as taxas (variáveis + impostos) = 19%
    taxPercent: 0,
    desiredMarginPercent: 30,
  }

  it('calcula o preço recomendado = custo / (1 - taxas - margem)', () => {
    const result = calculateProductPricing({ ...base, sellingPriceCents: 39900 })
    // 17910 / (1 - 0,19 - 0,30) = 17910 / 0,51 = 35117,647... -> exibido como R$ 351,18
    expect(result.recommendedPriceCents).toBeCloseTo(35117.65, 1)
  })

  it('calcula o markup = 1 / (1 - taxas - margem) com 4 casas decimais', () => {
    const recommended = calculateProductPricing({ ...base })
    const result = calculateProductPricing({ ...base, sellingPriceCents: recommended.recommendedPriceCents ?? 0 })
    // 1 / 0,51 = 1,9608
    expect(result.markup).toBeCloseTo(1.9608, 4)
  })

  it('calcula o preço mínimo (margem 0%) = custo / (1 - taxas)', () => {
    const result = calculateProductPricing({ ...base })
    // 17910 / 0,81 = 22111,11... -> exibido como R$ 221,11
    expect(result.minimumPriceCents).toBeCloseTo(22111.11, 1)
  })

  it('calcula as taxas variáveis sobre o preço recomendado', () => {
    const recommended = calculateProductPricing({ ...base })
    const price = recommended.recommendedPriceCents ?? 0
    // 35117,65 * 0,19 = 6672,35 -> exibido como R$ 66,72
    expect((price * 19) / 100).toBeCloseTo(6672.35, 1)
  })

  it('calcula o lucro operacional sobre o preço praticado hoje', () => {
    const result = calculateProductPricing({ ...base, sellingPriceCents: 39900 })
    // lucro bruto = 39900 - 17910 = 21990 (R$ 219,90)
    // taxas sobre hoje = 39900 * 0,19 = 7581 (R$ 75,81)
    // lucro operacional = 21990 - 7581 = 14409 (R$ 144,09) -> 36,1%
    expect(result.contributionCents).toBeCloseTo(14409, 0)
    expect(result.contributionMarginPercent).toBeCloseTo(36.1, 1)
  })

  it('calcula o lucro operacional sobre o preço recomendado igual à margem desejada', () => {
    const recommended = calculateProductPricing({ ...base })
    const result = calculateProductPricing({ ...base, sellingPriceCents: recommended.recommendedPriceCents ?? 0 })
    // 35117,65 * 0,30 = 10535,29 (R$ 105,35) -> 30,0% (bate com a margem desejada)
    expect(result.contributionCents).toBeCloseTo(10535.29, 1)
    expect(result.contributionMarginPercent).toBeCloseTo(30, 1)
  })

  it('composição do preço recomendado soma 100% (51% custo / 19% taxas / 30% margem)', () => {
    const recommended = calculateProductPricing({ ...base })
    const price = recommended.recommendedPriceCents ?? 0
    const custoPct = (17910 / price) * 100
    const taxasPct = 19
    const margemPct = 30
    expect(custoPct).toBeCloseTo(51, 0)
    expect(custoPct + taxasPct + margemPct).toBeCloseTo(100, 1)
  })

  it('rejeita divisor de markup nulo ou negativo (taxas + margem >= 100%)', () => {
    expect(() => calculateProductPricing({ ...base, variableFeesPercent: 70, desiredMarginPercent: 30 })).toThrow()
    expect(() => calculateProductPricing({ ...base, variableFeesPercent: 100 })).toThrow()
  })
})
