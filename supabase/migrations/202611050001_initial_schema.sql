-- SPWeb Lucro: schema inicial aditivo para Supabase/PostgreSQL.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  legal_name text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique(company_id, user_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  acquisition_cost_cents bigint not null default 0 check (acquisition_cost_cents >= 0),
  other_cost_cents bigint not null default 0 check (other_cost_cents >= 0),
  variable_fees_percent numeric(7,4) not null default 0 check (variable_fees_percent between 0 and 100),
  tax_percent numeric(7,4) not null default 0 check (tax_percent between 0 and 100),
  desired_margin_percent numeric(7,4) check (desired_margin_percent between 0 and 100),
  current_price_cents bigint check (current_price_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (variable_fees_percent + tax_percent < 100),
  check (desired_margin_percent is null or variable_fees_percent + tax_percent + desired_margin_percent < 100)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  hours numeric(10,3) not null check (hours > 0),
  hourly_labor_cost_cents bigint not null default 0 check (hourly_labor_cost_cents >= 0),
  materials_cents bigint not null default 0 check (materials_cents >= 0),
  other_cost_cents bigint not null default 0 check (other_cost_cents >= 0),
  fixed_cost_per_hour_cents bigint not null default 0 check (fixed_cost_per_hour_cents >= 0),
  include_fixed_cost_per_hour boolean not null default false,
  variable_fees_percent numeric(7,4) not null default 0 check (variable_fees_percent between 0 and 100),
  tax_percent numeric(7,4) not null default 0 check (tax_percent between 0 and 100),
  desired_margin_percent numeric(7,4) check (desired_margin_percent between 0 and 100),
  current_price_cents bigint check (current_price_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (variable_fees_percent + tax_percent < 100),
  check (desired_margin_percent is null or variable_fees_percent + tax_percent + desired_margin_percent < 100)
);

create table if not exists public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 1 and 160),
  category text not null check (category in ('Aluguel','Energia','Água','Internet','Salários','Pró-labore','Contabilidade','Sistemas','Marketing','Outras despesas')),
  amount_cents bigint not null check (amount_cents >= 0),
  reference_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operational_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  working_days_per_month integer not null check (working_days_per_month between 1 and 31),
  productive_hours_per_day numeric(5,2) not null check (productive_hours_per_day > 0 and productive_hours_per_day <= 24),
  updated_at timestamptz not null default now()
);

create table if not exists public.pricing_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  item_type text not null check (item_type in ('product','service')),
  item_id uuid not null,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  item_type text not null check (item_type in ('product','service')),
  item_name_snapshot text not null default '',
  product_id uuid references public.products(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  quantity numeric(14,3) not null check (quantity > 0),
  selling_price_cents bigint not null check (selling_price_cents > 0),
  contribution_cents numeric(18,4) not null,
  sold_on date not null default current_date,
  created_at timestamptz not null default now(),
  constraint sales_records_at_most_one_item check (not (product_id is not null and service_id is not null)),
  check (char_length(trim(item_name_snapshot)) between 1 and 160)
);

create index if not exists company_members_user_company_idx on public.company_members(user_id, company_id);
create index if not exists company_members_company_role_idx on public.company_members(company_id, role);
create index if not exists products_company_name_idx on public.products(company_id, name);
create index if not exists services_company_name_idx on public.services(company_id, name);
create index if not exists fixed_expenses_company_date_idx on public.fixed_expenses(company_id, reference_date desc);
create index if not exists sales_records_company_date_idx on public.sales_records(company_id, sold_on desc);
create index if not exists sales_records_product_idx on public.sales_records(product_id) where product_id is not null;
create index if not exists sales_records_service_idx on public.sales_records(service_id) where service_id is not null;
create index if not exists pricing_history_company_item_idx on public.pricing_history(company_id, item_type, item_id, created_at desc);

create or replace function public.is_company_member(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.company_members cm where cm.company_id = p_company_id and cm.user_id = (select auth.uid()))
$$;

create or replace function public.is_company_admin(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.company_members cm where cm.company_id = p_company_id and cm.user_id = (select auth.uid()) and cm.role in ('owner','admin'))
$$;

create or replace function public.is_company_owner(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.company_members cm where cm.company_id = p_company_id and cm.user_id = (select auth.uid()) and cm.role = 'owner')
$$;

create or replace function public.can_claim_company(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.companies c where c.id = p_company_id and c.created_by = (select auth.uid()))
$$;

create or replace function public.create_company_with_owner(p_company_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
  v_company_id uuid;
  v_name text;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then raise exception using errcode = '28000', message = 'A sessão autenticada é obrigatória.'; end if;
  v_name := btrim(coalesce(p_company_name, ''));
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception using errcode = '22023', message = 'O nome da empresa deve ter entre 2 e 120 caracteres.'; end if;

  insert into public.companies (name, created_by) values (v_name, v_user_id) returning id into v_company_id;
  insert into public.company_members (company_id, user_id, role) values (v_company_id, v_user_id, 'owner');
  return v_company_id;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, nullif(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles for each row execute procedure public.touch_updated_at();
create trigger companies_touch_updated_at before update on public.companies for each row execute procedure public.touch_updated_at();
create trigger products_touch_updated_at before update on public.products for each row execute procedure public.touch_updated_at();
create trigger services_touch_updated_at before update on public.services for each row execute procedure public.touch_updated_at();
create trigger expenses_touch_updated_at before update on public.fixed_expenses for each row execute procedure public.touch_updated_at();
create trigger settings_touch_updated_at before update on public.operational_settings for each row execute procedure public.touch_updated_at();

create or replace function public.record_product_pricing_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.pricing_history(company_id, item_type, item_id, snapshot, changed_by)
  values (new.company_id, 'product', new.id, to_jsonb(new), (select auth.uid()));
  return new;
end;
$$;

drop trigger if exists products_pricing_history on public.products;
create trigger products_pricing_history after insert or update of acquisition_cost_cents, other_cost_cents, variable_fees_percent, tax_percent, desired_margin_percent, current_price_cents on public.products for each row execute procedure public.record_product_pricing_history();

create or replace function public.record_service_pricing_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.pricing_history(company_id, item_type, item_id, snapshot, changed_by)
  values (new.company_id, 'service', new.id, to_jsonb(new), (select auth.uid()));
  return new;
end;
$$;

drop trigger if exists services_pricing_history on public.services;
create trigger services_pricing_history after insert or update of hours, hourly_labor_cost_cents, materials_cents, other_cost_cents, fixed_cost_per_hour_cents, include_fixed_cost_per_hour, variable_fees_percent, tax_percent, desired_margin_percent, current_price_cents on public.services for each row execute procedure public.record_service_pricing_history();

create or replace function public.validate_sales_record_item()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_item_name text;
  v_cost numeric;
  v_fees numeric;
  v_tax numeric;
begin
  if tg_op = 'INSERT' then
    if (new.product_id is null and new.service_id is null) or (new.product_id is not null and new.service_id is not null) then
      raise exception 'A venda deve referenciar exatamente um produto ou serviço da mesma empresa.';
    end if;
    if new.item_type = 'product' and new.product_id is not null then
      select p.name, p.acquisition_cost_cents::numeric + p.other_cost_cents::numeric, p.variable_fees_percent, p.tax_percent
        into v_item_name, v_cost, v_fees, v_tax
        from public.products p where p.id = new.product_id and p.company_id = new.company_id;
    elsif new.item_type = 'service' and new.service_id is not null then
      select s.name,
        s.hours::numeric * s.hourly_labor_cost_cents::numeric + s.materials_cents::numeric + s.other_cost_cents::numeric +
          case when s.include_fixed_cost_per_hour then s.hours::numeric * s.fixed_cost_per_hour_cents::numeric else 0 end,
        s.variable_fees_percent, s.tax_percent
        into v_item_name, v_cost, v_fees, v_tax
        from public.services s where s.id = new.service_id and s.company_id = new.company_id;
    else
      raise exception 'O tipo de item da venda não corresponde à referência informada.';
    end if;
    if v_item_name is null or v_cost is null then raise exception 'O item de venda não existe nesta empresa ou não está autorizado.'; end if;
    new.item_name_snapshot := v_item_name;
    new.contribution_cents := new.selling_price_cents::numeric * (1 - (v_fees + v_tax) / 100) - v_cost;
    return new;
  end if;

  if new.company_id is distinct from old.company_id or new.item_type is distinct from old.item_type then
    raise exception 'A empresa e o tipo do item de uma venda histórica não podem ser alterados.';
  end if;
  if new.selling_price_cents is distinct from old.selling_price_cents or new.quantity is distinct from old.quantity or
     new.contribution_cents is distinct from old.contribution_cents then
    raise exception 'O snapshot financeiro de uma venda registrada não pode ser alterado.';
  end if;
  if old.product_id is null and old.service_id is null then
    if new.product_id is distinct from old.product_id or new.service_id is distinct from old.service_id then
      raise exception 'O item de uma venda histórica não pode ser substituído.';
    end if;
    new.item_name_snapshot := old.item_name_snapshot;
    return new;
  end if;
  if new.product_id is not distinct from old.product_id and new.service_id is not distinct from old.service_id then
    new.item_name_snapshot := old.item_name_snapshot;
    return new;
  end if;
  if (old.product_id is not null or old.service_id is not null) and new.product_id is null and new.service_id is null then
    new.item_name_snapshot := old.item_name_snapshot;
    return new;
  end if;
  raise exception 'O item de uma venda histórica não pode ser substituído.';
end;
$$;

drop trigger if exists sales_records_validate_item on public.sales_records;
create trigger sales_records_validate_item before insert or update on public.sales_records for each row execute procedure public.validate_sales_record_item();

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.products enable row level security;
alter table public.services enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.operational_settings enable row level security;
alter table public.pricing_history enable row level security;
alter table public.sales_records enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert with check (id = (select auth.uid()));

drop policy if exists companies_read_member on public.companies;
drop policy if exists companies_create_self on public.companies;
drop policy if exists companies_update_admin on public.companies;
drop policy if exists companies_delete_owner on public.companies;
create policy companies_read_member on public.companies for select using (public.is_company_member(id) or created_by = (select auth.uid()));
create policy companies_update_admin on public.companies for update using (public.is_company_admin(id)) with check (public.is_company_admin(id));

drop policy if exists members_read_company on public.company_members;
drop policy if exists members_claim_owner on public.company_members;
drop policy if exists members_manage_admin on public.company_members;
drop policy if exists members_update_admin on public.company_members;
drop policy if exists members_delete_admin on public.company_members;
create policy members_read_company on public.company_members for select using (user_id = (select auth.uid()) or public.is_company_member(company_id));
create policy members_claim_owner on public.company_members for insert with check (user_id = (select auth.uid()) and role = 'owner' and public.can_claim_company(company_id));
create policy members_manage_admin on public.company_members for insert with check (public.is_company_admin(company_id) and (role <> 'owner' or public.is_company_owner(company_id)));
create policy members_update_admin on public.company_members for update using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id) and (role <> 'owner' or public.is_company_owner(company_id)));
create policy members_delete_admin on public.company_members for delete using (
  public.is_company_admin(company_id) and
  (role <> 'owner' or exists (
    select 1 from public.company_members other_owner
    where other_owner.company_id = company_members.company_id
      and other_owner.role = 'owner'
      and other_owner.user_id <> company_members.user_id
  ))
);

drop policy if exists products_company_access on public.products;
drop policy if exists services_company_access on public.services;
drop policy if exists expenses_company_access on public.fixed_expenses;
drop policy if exists settings_company_access on public.operational_settings;
drop policy if exists pricing_history_company_read on public.pricing_history;
drop policy if exists sales_records_company_access on public.sales_records;
create policy products_company_access on public.products for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy services_company_access on public.services for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy expenses_company_access on public.fixed_expenses for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy settings_company_access on public.operational_settings for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy pricing_history_company_read on public.pricing_history for select using (public.is_company_member(company_id));
create policy sales_records_company_access on public.sales_records for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));

revoke all on function public.is_company_member(uuid) from public, anon;
revoke all on function public.is_company_admin(uuid) from public, anon;
revoke all on function public.is_company_owner(uuid) from public, anon;
revoke all on function public.can_claim_company(uuid) from public, anon;
revoke all on function public.create_company_with_owner(text) from public, anon;
grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.is_company_admin(uuid) to authenticated;
grant execute on function public.is_company_owner(uuid) to authenticated;
grant execute on function public.can_claim_company(uuid) to authenticated;
grant execute on function public.create_company_with_owner(text) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;
revoke all on function public.touch_updated_at() from public, anon;
revoke all on function public.record_product_pricing_history() from public, anon;
revoke all on function public.record_service_pricing_history() from public, anon;
revoke all on function public.validate_sales_record_item() from public, anon;
grant execute on function public.touch_updated_at() to authenticated;
grant execute on function public.record_product_pricing_history() to authenticated;
grant execute on function public.record_service_pricing_history() to authenticated;
grant execute on function public.validate_sales_record_item() to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.company_members, public.products, public.services, public.fixed_expenses, public.operational_settings, public.sales_records to authenticated;
revoke insert on public.companies from public, anon, authenticated;
grant select on public.companies to authenticated;
grant update (name, legal_name) on public.companies to authenticated;
grant select on public.pricing_history to authenticated;
