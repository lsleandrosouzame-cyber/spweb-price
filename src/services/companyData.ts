import { supabase } from '../lib/supabase'
import type { FixedExpenseDraft, FixedExpenseRecord, ProductDraft, ProductRecord, SalesRecord, SalesRecordDraft, ServiceRecord, VariableCostDraft, VariableCostRecord, AssetLiabilityRecord, AssetLiabilityDraft } from '../types/database'

function requireClient() {
  if (!supabase) throw new Error('Conexão Supabase não configurada.')
  return supabase
}

export async function listProducts(companyId: string) {
  const client = requireClient()
  
  // Buscar produtos
  const { data: products, error: productsError } = await client
    .from('products')
    .select('*')
    .eq('company_id', companyId)
    .order('name')
  
  if (productsError) throw productsError
  if (!products || products.length === 0) return []
  
  // Buscar todas as taxas dos produtos
  const productIds = products.map(p => p.id)
  const { data: fees, error: feesError } = await client
    .from('product_fees')
    .select('product_id, percent')
    .in('product_id', productIds)
  
  if (feesError) throw feesError
  
  // Calcular soma das taxas por produto
  const feesByProduct = new Map<string, number>()
  if (fees) {
    for (const fee of fees) {
      const current = feesByProduct.get(fee.product_id) || 0
      feesByProduct.set(fee.product_id, current + Number(fee.percent))
    }
  }
  
  // Adicionar as taxas calculadas aos produtos
  const enrichedProducts = products.map(p => ({
    ...p,
    // Se variable_fees_percent está vazio ou zero, usar a soma das taxas detalhadas
    variable_fees_percent: Number(p.variable_fees_percent) || feesByProduct.get(p.id) || 0
  }))
  
  return enrichedProducts as ProductRecord[]
}

export async function saveProduct(companyId: string, draft: ProductDraft, id?: string) {
  const client = requireClient()
  const values = { ...draft, company_id: companyId }
  const response = id
    ? await client.from('products').update(values).eq('company_id', companyId).eq('id', id).select('*').single()
    : await client.from('products').insert(values).select('*').single()
  if (response.error) throw response.error
  return response.data as ProductRecord
}

export async function removeProduct(companyId: string, id: string) {
  const { error } = await requireClient().from('products').delete().eq('company_id', companyId).eq('id', id)
  if (error) throw error
}

export async function listServices(companyId: string) {
  const { data, error } = await requireClient().from('services').select('*').eq('company_id', companyId).order('name')
  if (error) throw error
  return (data ?? []) as ServiceRecord[]
}

export async function saveService(companyId: string, draft: Omit<ServiceRecord, 'id' | 'company_id' | 'created_at' | 'updated_at'>, id?: string) {
  const client = requireClient()
  const values = { ...draft, company_id: companyId }
  const response = id
    ? await client.from('services').update(values).eq('company_id', companyId).eq('id', id).select('*').single()
    : await client.from('services').insert(values).select('*').single()
  if (response.error) throw response.error
  return response.data as ServiceRecord
}

export async function removeService(companyId: string, id: string) {
  const { error } = await requireClient().from('services').delete().eq('company_id', companyId).eq('id', id)
  if (error) throw error
}

export async function listExpenses(companyId: string) {
  const { data, error } = await requireClient().from('fixed_expenses').select('*').eq('company_id', companyId).order('reference_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as FixedExpenseRecord[]
}

export async function saveExpense(companyId: string, draft: FixedExpenseDraft, id?: string) {
  const client = requireClient()
  const values = { ...draft, company_id: companyId }
  const response = id
    ? await client.from('fixed_expenses').update(values).eq('company_id', companyId).eq('id', id).select('*').single()
    : await client.from('fixed_expenses').insert(values).select('*').single()
  if (response.error) throw response.error
  return response.data as FixedExpenseRecord
}

export async function removeExpense(companyId: string, id: string) {
  const { error } = await requireClient().from('fixed_expenses').delete().eq('company_id', companyId).eq('id', id)
  if (error) throw error
}

export async function readOperatingSettings(companyId: string) {
  const { data, error } = await requireClient().from('operational_settings').select('*').eq('company_id', companyId).maybeSingle()
  if (error) throw error
  return data as {
    working_days_per_month: number
    productive_hours_per_day: number
    revenue_forecast_cents: number | null
    pro_labore_cents: number | null
    default_desired_margin_percent: number | null
    fee_tags: Array<{ label: string; percent: string }> | null
  } | null
}

export async function saveOperatingSettings(companyId: string, settings: {
  working_days_per_month: number
  productive_hours_per_day: number
  revenue_forecast_cents?: number | null
  pro_labore_cents?: number | null
  default_desired_margin_percent?: number | null
  fee_tags?: Array<{ label: string; percent: string }> | null
}) {
  const { error } = await requireClient().from('operational_settings').upsert({ company_id: companyId, ...settings }, { onConflict: 'company_id' })
  if (error) throw error
}

export async function listSalesRecords(companyId: string, fromDate: string) {
  const { data, error } = await requireClient().from('sales_records').select('*').eq('company_id', companyId).gte('sold_on', fromDate).order('sold_on', { ascending: false })
  if (error) throw error
  return (data ?? []) as SalesRecord[]
}

export async function saveSalesRecord(companyId: string, draft: SalesRecordDraft) {
  const { data, error } = await requireClient().from('sales_records').insert({ ...draft, company_id: companyId }).select('*').single()
  if (error) throw error
  return data as SalesRecord
}

export async function removeSalesRecord(companyId: string, id: string) {
  const { error } = await requireClient().from('sales_records').delete().eq('company_id', companyId).eq('id', id)
  if (error) throw error
}

export async function listVariableCosts(companyId: string) {
  const { data, error } = await requireClient().from('variable_costs').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as VariableCostRecord[]
}

export async function saveVariableCost(companyId: string, draft: VariableCostDraft, id?: string) {
  const client = requireClient()
  const values = { ...draft, company_id: companyId }
  const response = id
    ? await client.from('variable_costs').update(values).eq('company_id', companyId).eq('id', id).select('*').single()
    : await client.from('variable_costs').insert(values).select('*').single()
  if (response.error) throw response.error
  return response.data as VariableCostRecord
}

export async function removeVariableCost(companyId: string, id: string) {
  const { error } = await requireClient().from('variable_costs').delete().eq('company_id', companyId).eq('id', id)
  if (error) throw error
}

// ── Assets & Liabilities ────────────────────────────────────────────────────
export async function listAssetsLiabilities(companyId: string): Promise<AssetLiabilityRecord[]> {
  if (!supabase) throw new Error('Supabase not initialized')
  const { data, error } = await supabase
    .from('assets_liabilities')
    .select('*')
    .eq('company_id', companyId)
    .order('reference_date', { ascending: false })
  if (error) throw error
  return (data as AssetLiabilityRecord[]) ?? []
}

export async function saveAssetLiability(companyId: string, draft: AssetLiabilityDraft, id?: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not initialized')
  if (id) {
    const { error } = await supabase.from('assets_liabilities').update(draft).eq('id', id).eq('company_id', companyId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('assets_liabilities').insert({ ...draft, company_id: companyId })
    if (error) throw error
  }
}

export async function removeAssetLiability(companyId: string, id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not initialized')
  const { error } = await supabase.from('assets_liabilities').delete().eq('id', id).eq('company_id', companyId)
  if (error) throw error
}
