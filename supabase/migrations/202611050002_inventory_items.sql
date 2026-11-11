-- Create inventory_items table for cataloging materials and supplies
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  unit_measure text not null,
  is_fractional boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for company lookups
create index if not exists inventory_items_company_id_idx on public.inventory_items(company_id);

-- RLS policies
alter table public.inventory_items enable row level security;

create policy "Users can view their company's inventory items"
  on public.inventory_items for select
  using (
    company_id in (
      select company_id from public.company_members where user_id = auth.uid()
    )
  );

create policy "Users can insert inventory items for their company"
  on public.inventory_items for insert
  with check (
    company_id in (
      select company_id from public.company_members where user_id = auth.uid()
    )
  );

create policy "Users can update their company's inventory items"
  on public.inventory_items for update
  using (
    company_id in (
      select company_id from public.company_members where user_id = auth.uid()
    )
  );

create policy "Users can delete their company's inventory items"
  on public.inventory_items for delete
  using (
    company_id in (
      select company_id from public.company_members where user_id = auth.uid()
    )
  );

-- Updated at trigger
create or replace function public.handle_inventory_items_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger inventory_items_updated_at
  before update on public.inventory_items
  for each row
  execute function public.handle_inventory_items_updated_at();
