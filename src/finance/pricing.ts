export interface ProductPricingInput {
  acquisitionCostCents: number
  otherCostCents?: number
  variableFeesPercent: number
  taxPercent: number
  desiredMarginPercent?: number
  sellingPriceCents?: number
}

export interface ProductPricingResult {
  totalCostCents: number
  minimumPriceCents: number
  recommendedPriceCents: number | null
  feesCents: number | null
  taxesCents: number | null
  contributionCents: number | null
  contributionMarginPercent: number | null
  markup: number | null
  priceDeltaCents: number | null
}

export class PricingInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PricingInputError'
  }
}

const assertMoney = (value: number, field: string) => {
  if (!Number.isFinite(value) || value < 0) throw new PricingInputError(`${field} deve ser um valor não negativo.`)
}

const assertPercent = (value: number, field: string) => {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new PricingInputError(`${field} deve estar entre 0% e 100%.`)
}

export function calculateProductPricing(input: ProductPricingInput): ProductPricingResult {
  const other = input.otherCostCents ?? 0
  assertMoney(input.acquisitionCostCents, 'Custo de aquisição')
  assertMoney(other, 'Custos adicionais')
  assertPercent(input.variableFeesPercent, 'Taxas variáveis')
  assertPercent(input.taxPercent, 'Impostos')
  if (input.sellingPriceCents !== undefined) assertMoney(input.sellingPriceCents, 'Preço atual')

  const totalCostCents = input.acquisitionCostCents + other
  const feesRate = input.variableFeesPercent / 100
  const taxRate = input.taxPercent / 100
  const minimumDenominator = 1 - feesRate - taxRate
  if (minimumDenominator <= Number.EPSILON * 8) throw new PricingInputError('Taxas e impostos deixam o preço mínimo sem denominador positivo.')
  const minimumPriceCents = totalCostCents / minimumDenominator

  let recommendedPriceCents: number | null = null
  if (input.desiredMarginPercent !== undefined) {
    assertPercent(input.desiredMarginPercent, 'Margem desejada')
    const recommendedDenominator = minimumDenominator - input.desiredMarginPercent / 100
    if (recommendedDenominator <= Number.EPSILON * 8) throw new PricingInputError('A margem desejada é incompatível com as taxas e impostos informados.')
    recommendedPriceCents = totalCostCents / recommendedDenominator
  }

  if (input.sellingPriceCents === undefined || input.sellingPriceCents <= 0) {
    return { totalCostCents, minimumPriceCents, recommendedPriceCents, feesCents: null, taxesCents: null, contributionCents: null, contributionMarginPercent: null, markup: null, priceDeltaCents: null }
  }

  const price = input.sellingPriceCents
  const feesCents = price * feesRate
  const taxesCents = price * taxRate
  const contributionCents = price - totalCostCents - feesCents - taxesCents
  return {
    totalCostCents,
    minimumPriceCents,
    recommendedPriceCents,
    feesCents,
    taxesCents,
    contributionCents,
    contributionMarginPercent: (contributionCents / price) * 100,
    markup: totalCostCents === 0 ? null : price / totalCostCents,
    priceDeltaCents: recommendedPriceCents === null ? null : recommendedPriceCents - price,
  }
}

export interface ServiceCostInput {
  hours: number
  hourlyLaborCostCents: number
  materialsCents?: number
  otherCostCents?: number
  fixedCostPerHourCents?: number
  includeFixedCostPerHour?: boolean
}

export function calculateServiceCost(input: ServiceCostInput): number {
  for (const [field, value] of Object.entries({
    hours: input.hours,
    hourlyLaborCostCents: input.hourlyLaborCostCents,
    materialsCents: input.materialsCents ?? 0,
    otherCostCents: input.otherCostCents ?? 0,
    fixedCostPerHourCents: input.fixedCostPerHourCents ?? 0,
  })) assertMoney(value, field)
  return input.hours * input.hourlyLaborCostCents
    + (input.materialsCents ?? 0)
    + (input.otherCostCents ?? 0)
    + (input.includeFixedCostPerHour ? input.hours * (input.fixedCostPerHourCents ?? 0) : 0)
}
