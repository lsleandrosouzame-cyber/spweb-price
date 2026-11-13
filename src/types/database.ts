export type ProductRecord = {
  id: string
  company_id: string
  name: string
  acquisition_cost_cents: number
  other_cost_cents: number
  variable_fees_percent: number
  tax_percent: number
  desired_margin_percent: number | null
  current_price_cents: number | null
  stock_quantity: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type ServiceRecord = {
  id: string
  company_id: string
  name: string
  hours: number
  hourly_labor_cost_cents: number
  materials_cents: number
  other_cost_cents: number
  fixed_cost_per_hour_cents: number
  include_fixed_cost_per_hour: boolean
  variable_fees_percent: number
  tax_percent: number
  desired_margin_percent: number | null
  current_price_cents: number | null
  created_at: string
  updated_at: string
}

export type FixedExpenseRecord = {
  id: string
  company_id: string
  description: string
  category: string
  amount_cents: number
  reference_date: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type VariableCostRecord = {
  id: string
  company_id: string
  description: string
  cost_type: 'Taxa' | 'Comissão' | 'Frete' | 'Embalagem' | 'Outros'
  percent_value: number | null
  fixed_value_cents: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type SalesRecord = {
  id: string
  company_id: string
  item_type: 'product' | 'service'
  item_name_snapshot: string
  product_id: string | null
  service_id: string | null
  quantity: number
  selling_price_cents: number
  contribution_cents: number
  sold_on: string
}

export type ProductDraft = Omit<ProductRecord, 'id' | 'company_id' | 'created_at' | 'updated_at'>
export type FixedExpenseDraft = Omit<FixedExpenseRecord, 'id' | 'company_id' | 'created_at' | 'updated_at'>
export type VariableCostDraft = Omit<VariableCostRecord, 'id' | 'company_id' | 'created_at' | 'updated_at'>
export type SalesRecordDraft = Omit<SalesRecord, 'id' | 'company_id' | 'item_name_snapshot'>

export type ProductCostRecord = {
  id: string
  product_id: string
  company_id: string
  label: string
  amount_cents: number
  cost_type: 'acquisition' | 'additional'
  created_at: string
  updated_at: string
}

export type ProductFeeRecord = {
  id: string
  product_id: string
  company_id: string
  label: string
  percent: number
  fee_type: 'variable' | 'tax'
  created_at: string
  updated_at: string
}

export type ServiceCostRecord = {
  id: string
  service_id: string
  company_id: string
  label: string
  amount_cents: number
  cost_type: 'material' | 'additional'
  created_at: string
  updated_at: string
}

export type ServiceFeeRecord = {
  id: string
  service_id: string
  company_id: string
  label: string
  percent: number
  fee_type: 'variable' | 'tax'
  created_at: string
  updated_at: string
}

export type ProductCostDraft = Omit<ProductCostRecord, 'id' | 'product_id' | 'company_id' | 'created_at' | 'updated_at'>
export type ProductFeeDraft = Omit<ProductFeeRecord, 'id' | 'product_id' | 'company_id' | 'created_at' | 'updated_at'>
export type ServiceCostDraft = Omit<ServiceCostRecord, 'id' | 'service_id' | 'company_id' | 'created_at' | 'updated_at'>
export type ServiceFeeDraft = Omit<ServiceFeeRecord, 'id' | 'service_id' | 'company_id' | 'created_at' | 'updated_at'>

export type AssetLiabilityRecord = {
  id: string
  company_id: string
  type: 'asset' | 'liability'
  description: string
  amount_cents: number
  reference_date: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type AssetLiabilityDraft = Omit<AssetLiabilityRecord, 'id' | 'company_id' | 'created_at' | 'updated_at'>
