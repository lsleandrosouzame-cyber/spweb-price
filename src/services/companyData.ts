import { supabase } from '../lib/supabase'
import type { FixedExpenseDraft, FixedExpenseRecord, ProductDraft, ProductRecord, SalesRecord, SalesRecordDraft, ServiceRecord } from '../types/database'

function requireClient() {
  if (!supabase) throw new Error('Conexão Supabase não configurada.')
  return supabase
}

export async function listProducts(companyId: string) {
  const { data, error } = await requireClient().from('products').select('*').eq('company_id', companyId).order('name')
  if (error) throw error
  return (data ?? []) as ProductRecord[]
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
    fee_tags: Array<{ label: string; percent: string }> | null
  } | null
}

export async function saveOperatingSettings(companyId: string, settings: {
  working_days_per_month: number
  productive_hours_per_day: number
  revenue_forecast_cents?: number | null
  pro_labore_cents?: number | null
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
