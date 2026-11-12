-- ═══════════════════════════════════════════════════════════════════════════
-- EXECUTE ESTE SQL NO SUPABASE SQL EDITOR
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Criar tabela de Ativos e Passivos
CREATE TABLE IF NOT EXISTS public.assets_liabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('asset', 'liability')),
  description text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  reference_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_assets_liabilities_company ON public.assets_liabilities(company_id);
CREATE INDEX IF NOT EXISTS idx_assets_liabilities_type ON public.assets_liabilities(company_id, type);
CREATE INDEX IF NOT EXISTS idx_assets_liabilities_date ON public.assets_liabilities(reference_date);

-- 3. RLS Policies para Ativos/Passivos
ALTER TABLE public.assets_liabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view assets/liabilities of their companies" ON public.assets_liabilities;
CREATE POLICY "Users can view assets/liabilities of their companies"
  ON public.assets_liabilities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_companies uc
      WHERE uc.company_id = assets_liabilities.company_id
      AND uc.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert assets/liabilities for their companies" ON public.assets_liabilities;
CREATE POLICY "Users can insert assets/liabilities for their companies"
  ON public.assets_liabilities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_companies uc
      WHERE uc.company_id = assets_liabilities.company_id
      AND uc.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update assets/liabilities of their companies" ON public.assets_liabilities;
CREATE POLICY "Users can update assets/liabilities of their companies"
  ON public.assets_liabilities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_companies uc
      WHERE uc.company_id = assets_liabilities.company_id
      AND uc.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete assets/liabilities of their companies" ON public.assets_liabilities;
CREATE POLICY "Users can delete assets/liabilities of their companies"
  ON public.assets_liabilities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_companies uc
      WHERE uc.company_id = assets_liabilities.company_id
      AND uc.user_id = auth.uid()
    )
  );

-- 4. Trigger para updated_at
DROP TRIGGER IF EXISTS set_assets_liabilities_updated_at ON public.assets_liabilities;
CREATE TRIGGER set_assets_liabilities_updated_at
  BEFORE UPDATE ON public.assets_liabilities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════
-- PRONTO! Após executar, recarregue a página do SPWeb Lucro
-- ═══════════════════════════════════════════════════════════════════════════
