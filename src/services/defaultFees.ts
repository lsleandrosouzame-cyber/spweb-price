import { listVariableCosts } from './companyData'

/**
 * Calcula as taxas padrão baseadas nos custos variáveis percentuais da aba Lançamentos
 */
export async function calculateDefaultFeesPercent(companyId: string): Promise<number> {
  try {
    const variableCosts = await listVariableCosts(companyId)
    
    // Soma apenas os custos variáveis que são percentuais
    const totalPercent = variableCosts.reduce((sum, cost) => {
      if (cost.percent_value !== null && cost.percent_value > 0) {
        return sum + Number(cost.percent_value)
      }
      return sum
    }, 0)
    
    return totalPercent
  } catch (error) {
    console.error('Erro ao calcular taxas padrão:', error)
    return 0
  }
}

/**
 * Retorna a lista de custos variáveis percentuais formatada para exibição
 */
export async function getDefaultFeesBreakdown(companyId: string): Promise<Array<{ label: string; percent: number }>> {
  try {
    const variableCosts = await listVariableCosts(companyId)
    
    return variableCosts
      .filter(cost => cost.percent_value !== null && cost.percent_value > 0)
      .map(cost => ({
        label: cost.description,
        percent: Number(cost.percent_value)
      }))
  } catch (error) {
    console.error('Erro ao buscar breakdown de taxas:', error)
    return []
  }
}
