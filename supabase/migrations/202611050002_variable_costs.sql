-- Add variable_costs table for system-wide variable costs
create table if not exists public.variable_costs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 1 and 160),
  cost_type text not null check (cost_type in ('Taxa','Comissão','Frete','Embalagem','Outros')),
  percent_value numeric(7,4) check (percent_value between 0 and 100),
  fixed_value_cents bigint check (fixed_value_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((percent_value is not null and fixed_value_cents is null) or (percent_value is null and fixed_value_cents is not null))
);

create index if not exists variable_costs_company_idx on public.variable_costs(company_id);

create trigger variable_costs_touch_updated_at before update on public.variable_costs 
  for each row execute procedure public.touch_updated_at();

create policy variable_costs_company_access on public.variable_costs 
  for all using (public.is_company_member(company_id)) 
  with check (public.is_company_member(company_id));

alter table public.variable_costs enable row level security;

grant select, insert, update, delete on public.variable_costs to authenticated;

-- Add variable_costs column to operational_settings to store aggregated variable cost percentage
alter table public.operational_settings add column if not exists variable_costs_percent numeric(7,4) default 0 check (variable_costs_percent between 0 and 100);
