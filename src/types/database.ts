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
