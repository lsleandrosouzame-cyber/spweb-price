export interface SalesMixLine {
  sellingPriceCents: number
  contributionCents: number
  quantity: number
}

export interface BreakEvenResult {
  weightedContributionMarginPercent: number
  breakEvenRevenueCents: number
  referenceRevenueCents: number
  remainingRevenueCents: number
  progressPercent: number
}

export function calculateOperatingCosts(fixedMonthlyCents: number, workingDays: number, productiveHoursPerDay: number) {
  if (![fixedMonthlyCents, workingDays, productiveHoursPerDay].every(Number.isFinite) || fixedMonthlyCents < 0 || workingDays <= 0 || productiveHoursPerDay <= 0) {
    throw new RangeError('Despesas devem ser não negativas; dias e horas produtivas devem ser maiores que zero.')
  }
  const monthlyProductiveHours = workingDays * productiveHoursPerDay
  return {
    fixedMonthlyCents,
    monthlyProductiveHours,
    fixedDailyCents: fixedMonthlyCents / workingDays,
    fixedHourlyCents: fixedMonthlyCents / monthlyProductiveHours,
  }
}

export function calculateBreakEven(fixedMonthlyCents: number, salesMix: SalesMixLine[]): BreakEvenResult | null {
  if (!Number.isFinite(fixedMonthlyCents) || fixedMonthlyCents < 0 || salesMix.length === 0) return null
  const totals = salesMix.reduce((sum, line) => {
    if (line.quantity < 0 || line.sellingPriceCents < 0 || !Number.isFinite(line.contributionCents)) {
      throw new RangeError('O mix de vendas contém quantidades ou valores inválidos.')
    }
    return {
      revenue: sum.revenue + line.sellingPriceCents * line.quantity,
      contribution: sum.contribution + line.contributionCents * line.quantity,
    }
  }, { revenue: 0, contribution: 0 })
  if (totals.revenue <= 0) return null
  const weightedContributionMarginPercent = totals.contribution / totals.revenue * 100
  if (weightedContributionMarginPercent <= 0) return null
  const breakEvenRevenueCents = fixedMonthlyCents / (weightedContributionMarginPercent / 100)
  return {
    weightedContributionMarginPercent,
    breakEvenRevenueCents,
    referenceRevenueCents: totals.revenue,
    remainingRevenueCents: Math.max(0, breakEvenRevenueCents - totals.revenue),
    progressPercent: Math.min(100, totals.revenue / breakEvenRevenueCents * 100),
  }
}
