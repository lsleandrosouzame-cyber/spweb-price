import { supabase } from '../lib/supabase'
import type { 
  ProductCostRecord, ProductCostDraft, 
  ProductFeeRecord, ProductFeeDraft,
  ServiceCostRecord, ServiceCostDraft,
  ServiceFeeRecord, ServiceFeeDraft
} from '../types/database'

// Product Costs
export async function listProductCosts(productId: string): Promise<ProductCostRecord[]> {
  if (!supabase) throw new Error('Supabase não está configurado.')
  const { data, error } = await supabase
    .from('product_costs')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function saveProductCost(
  companyId: string, 
  productId: string, 
  draft: ProductCostDraft, 
  id?: string
): Promise<void> {
  if (!supabase) throw new Error('Supabase não está configurado.')
  const payload = { ...draft, company_id: companyId, product_id: productId }
  if (id) {
    const { error } = await supabase.from('product_costs').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('product_costs').insert(payload)
    if (error) throw error
  }
}

export async function removeProductCost(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não está configurado.')
  const { error } = await supabase.from('product_costs').delete().eq('id', id)
  if (error) throw error
}

// Product Fees
export async function listProductFees(productId: string): Promise<ProductFeeRecord[]> {
  if (!supabase) throw new Error('Supabase não está configurado.')
  const { data, error } = await supabase
    .from('product_fees')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function saveProductFee(
  companyId: string, 
  productId: string, 
  draft: ProductFeeDraft, 
  id?: string
): Promise<void> {
  if (!supabase) throw new Error('Supabase não está configurado.')
  const payload = { ...draft, company_id: companyId, product_id: productId }
  if (id) {
    const { error } = await supabase.from('product_fees').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('product_fees').insert(payload)
    if (error) throw error
  }
}

export async function removeProductFee(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não está configurado.')
  const { error } = await supabase.from('product_fees').delete().eq('id', id)
  if (error) throw error
}

// Service Costs
export async function listServiceCosts(serviceId: string): Promise<ServiceCostRecord[]> {
  if (!supabase) throw new Error('Supabase não está configurado.')
  const { data, error } = await supabase
    .from('service_costs')
    .select('*')
    .eq('service_id', serviceId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function saveServiceCost(
  companyId: string, 
  serviceId: string, 
  draft: ServiceCostDraft, 
  id?: string
): Promise<void> {
  if (!supabase) throw new Error('Supabase não está configurado.')
  const payload = { ...draft, company_id: companyId, service_id: serviceId }
  if (id) {
    const { error } = await supabase.from('service_costs').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('service_costs').insert(payload)
    if (error) throw error
  }
}

export async function removeServiceCost(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não está configurado.')
  const { error } = await supabase.from('service_costs').delete().eq('id', id)
  if (error) throw error
}

// Service Fees
export async function listServiceFees(serviceId: string): Promise<ServiceFeeRecord[]> {
  if (!supabase) throw new Error('Supabase não está configurado.')
  const { data, error } = await supabase
    .from('service_fees')
    .select('*')
    .eq('service_id', serviceId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function saveServiceFee(
  companyId: string, 
  serviceId: string, 
  draft: ServiceFeeDraft, 
  id?: string
): Promise<void> {
  if (!supabase) throw new Error('Supabase não está configurado.')
  const payload = { ...draft, company_id: companyId, service_id: serviceId }
  if (id) {
    const { error } = await supabase.from('service_fees').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('service_fees').insert(payload)
    if (error) throw error
  }
}

export async function removeServiceFee(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não está configurado.')
  const { error } = await supabase.from('service_fees').delete().eq('id', id)
  if (error) throw error
}
