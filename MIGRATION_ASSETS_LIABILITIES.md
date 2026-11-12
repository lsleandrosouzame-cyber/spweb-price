# Migration: Ativos e Passivos

## Se você estiver vendo erro "Não foi possível carregar os lançamentos"

A tabela `assets_liabilities` pode não ter sido criada ainda no Supabase.

### Solução: Aplicar Migration Manualmente

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Vá em **SQL Editor**
3. Cole o SQL abaixo e execute:

```sql
-- Migration: Ativos e Passivos
-- Tabela para registro de ativos e passivos da empresa

create table if not exists public.assets_liabilities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null check (type in ('asset', 'liability')),
  description text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  reference_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index para queries rápidas
create index if not exists idx_assets_liabilities_company on public.assets_liabilities(company_id);
create index if not exists idx_assets_liabilities_type on public.assets_liabilities(company_id, type);
create index if not exists idx_assets_liabilities_date on public.assets_liabilities(reference_date);

-- RLS policies
alter table public.assets_liabilities enable row level security;

create policy "Users can view assets/liabilities of their companies"
  on public.assets_liabilities for select
  using (
    exists (
      select 1 from public.user_companies uc
      where uc.company_id = assets_liabilities.company_id
      and uc.user_id = auth.uid()
    )
  );

create policy "Users can insert assets/liabilities for their companies"
  on public.assets_liabilities for insert
  with check (
    exists (
      select 1 from public.user_companies uc
      where uc.company_id = assets_liabilities.company_id
      and uc.user_id = auth.uid()
    )
  );

create policy "Users can update assets/liabilities of their companies"
  on public.assets_liabilities for update
  using (
    exists (
      select 1 from public.user_companies uc
      where uc.company_id = assets_liabilities.company_id
      and uc.user_id = auth.uid()
    )
  );

create policy "Users can delete assets/liabilities of their companies"
  on public.assets_liabilities for delete
  using (
    exists (
      select 1 from public.user_companies uc
      where uc.company_id = assets_liabilities.company_id
      and uc.user_id = auth.uid()
    )
  );

-- Trigger para updated_at
create trigger set_assets_liabilities_updated_at
  before update on public.assets_liabilities
  for each row
  execute function public.update_updated_at_column();
```

4. Após executar, **recarregue a página** do SPWeb Lucro

## O que foi implementado?

### ✅ ExpensesPage (Lançamentos)
- **Nova aba "Ativos/Passivos"** ao lado de Despesas fixas e Custos Variáveis
- Formulário com dropdown para escolher: Ativo ou Passivo
- Listas separadas para Ativos (verde) e Passivos (vermelho)
- Edição e exclusão inline
- Card de resumo com Patrimônio Líquido

### ✅ DashboardPage
- Card com 3 métricas: Ativos, Passivos e Patrimônio Líquido
- Gráfico horizontal comparativo (BarChart) entre Ativos vs Passivos
- Cores profissionais (verde=ativo, vermelho=passivo, azul=patrimônio positivo)
- Insight automático da situação patrimonial

## Funcionalidades
- Cadastro de ativos (caixa, contas a receber, estoque, etc)
- Cadastro de passivos (contas a pagar, empréstimos, fornecedores, etc)
- Cálculo automático do patrimônio líquido
- Visualização comparativa com gráfico horizontal moderno
- Integração completa com o sistema de gestão financeira
