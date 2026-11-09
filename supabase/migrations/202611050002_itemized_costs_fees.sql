-- Custos e taxas itemizados para produtos e serviços
-- Permite listar e editar cada lançamento individual

create table if not exists public.product_costs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 100),
  amount_cents bigint not null check (amount_cents >= 0),
  cost_type text not null check (cost_type in ('acquisition', 'additional')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_fees (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 100),
  percent numeric(7,4) not null check (percent between 0 and 100),
  fee_type text not null check (fee_type in ('variable', 'tax')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_costs (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 100),
  amount_cents bigint not null check (amount_cents >= 0),
  cost_type text not null check (cost_type in ('material', 'additional')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_fees (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 100),
  percent numeric(7,4) not null check (percent between 0 and 100),
  fee_type text not null check (fee_type in ('variable', 'tax')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices
create index if not exists product_costs_product_idx on public.product_costs(product_id);
create index if not exists product_costs_company_idx on public.product_costs(company_id);
create index if not exists product_fees_product_idx on public.product_fees(product_id);
create index if not exists product_fees_company_idx on public.product_fees(company_id);
create index if not exists service_costs_service_idx on public.service_costs(service_id);
create index if not exists service_costs_company_idx on public.service_costs(company_id);
create index if not exists service_fees_service_idx on public.service_fees(service_id);
create index if not exists service_fees_company_idx on public.service_fees(company_id);

-- Triggers para updated_at
create trigger product_costs_touch_updated_at before update on public.product_costs for each row execute procedure public.touch_updated_at();
create trigger product_fees_touch_updated_at before update on public.product_fees for each row execute procedure public.touch_updated_at();
create trigger service_costs_touch_updated_at before update on public.service_costs for each row execute procedure public.touch_updated_at();
create trigger service_fees_touch_updated_at before update on public.service_fees for each row execute procedure public.touch_updated_at();

-- RLS
alter table public.product_costs enable row level security;
alter table public.product_fees enable row level security;
alter table public.service_costs enable row level security;
alter table public.service_fees enable row level security;

create policy product_costs_company_access on public.product_costs for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy product_fees_company_access on public.product_fees for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy service_costs_company_access on public.service_costs for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy service_fees_company_access on public.service_fees for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));

grant select, insert, update, delete on public.product_costs, public.product_fees, public.service_costs, public.service_fees to authenticated;
