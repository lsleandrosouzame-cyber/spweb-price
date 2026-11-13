-- ========================================
-- SCRIPTS ÚTEIS PARA GERENCIAR O SISTEMA
-- ========================================

-- ==========================================
-- 1. CONFIGURAR PERCENTUAL PADRÃO PARA TODAS AS EMPRESAS
-- ==========================================
-- Define 25% como margem padrão para todas as empresas
UPDATE operational_settings
SET default_desired_margin_percent = 25.00;

-- Ou para uma empresa específica:
UPDATE operational_settings
SET default_desired_margin_percent = 30.00
WHERE company_id = 'SEU_COMPANY_ID_AQUI';


-- ==========================================
-- 2. VER PRODUTOS QUE USAM MARGEM PADRÃO VS ESPECÍFICA
-- ==========================================
SELECT 
    p.name as produto,
    p.desired_margin_percent as margem_especifica,
    os.default_desired_margin_percent as margem_padrao,
    CASE 
        WHEN p.desired_margin_percent IS NULL THEN 'USA PADRÃO'
        ELSE 'USA ESPECÍFICA'
    END as tipo_margem
FROM products p
JOIN company_members cm ON cm.company_id = p.company_id
JOIN operational_settings os ON os.company_id = p.company_id
ORDER BY tipo_margem, p.name;


-- ==========================================
-- 3. LIMPAR MARGENS ESPECÍFICAS (voltar para padrão)
-- ==========================================
-- Remove margem específica de todos os produtos
-- (eles passam a usar a margem padrão)
UPDATE products
SET desired_margin_percent = NULL;

-- Ou apenas de produtos com margem abaixo de 20%:
UPDATE products
SET desired_margin_percent = NULL
WHERE desired_margin_percent < 20;


-- ==========================================
-- 4. DEFINIR MARGEM ESPECÍFICA EM MASSA
-- ==========================================
-- Define 35% para todos os produtos de uma categoria
UPDATE products
SET desired_margin_percent = 35.00
WHERE name ILIKE '%CATEGORIA_AQUI%';

-- Define 40% para produtos com custo alto
UPDATE products
SET desired_margin_percent = 40.00
WHERE acquisition_cost_cents > 50000; -- acima de R$ 500


-- ==========================================
-- 5. RELATÓRIO DE ESTOQUE
-- ==========================================
SELECT 
    COUNT(*) as total_produtos,
    SUM(stock_quantity) as quantidade_total,
    SUM(acquisition_cost_cents * stock_quantity / 100.0) as valor_estoque_custo,
    SUM(COALESCE(current_price_cents, 0) * stock_quantity / 100.0) as valor_estoque_venda
FROM products
WHERE company_id = 'SEU_COMPANY_ID_AQUI';


-- ==========================================
-- 6. PRODUTOS SEM ESTOQUE
-- ==========================================
SELECT 
    name as produto,
    acquisition_cost_cents / 100.0 as custo_unitario,
    COALESCE(current_price_cents / 100.0, 0) as preco_venda
FROM products
WHERE stock_quantity = 0
ORDER BY name;


-- ==========================================
-- 7. PRODUTOS COM ESTOQUE BAIXO
-- ==========================================
SELECT 
    name as produto,
    stock_quantity as quantidade,
    acquisition_cost_cents / 100.0 as custo_unitario,
    (acquisition_cost_cents * stock_quantity / 100.0) as valor_total_estoque
FROM products
WHERE stock_quantity > 0 
  AND stock_quantity < 10  -- menos de 10 unidades
ORDER BY stock_quantity ASC;


-- ==========================================
-- 8. ATUALIZAR ESTOQUE EM MASSA
-- ==========================================
-- Adicionar 100 unidades a todos os produtos
UPDATE products
SET stock_quantity = stock_quantity + 100;

-- Zerar estoque de produtos específicos
UPDATE products
SET stock_quantity = 0
WHERE name ILIKE '%DESCONTINUADO%';


-- ==========================================
-- 9. TOP 10 PRODUTOS MAIS VALIOSOS NO ESTOQUE
-- ==========================================
SELECT 
    name as produto,
    stock_quantity as quantidade,
    acquisition_cost_cents / 100.0 as custo_unitario,
    (acquisition_cost_cents * stock_quantity / 100.0) as valor_total_estoque
FROM products
WHERE stock_quantity > 0
ORDER BY (acquisition_cost_cents * stock_quantity) DESC
LIMIT 10;


-- ==========================================
-- 10. RESETAR SENHA DE USUÁRIO (eduardo@lyon.com.br)
-- ==========================================
-- Define senha como: abcde12345
UPDATE auth.users
SET encrypted_password = crypt('abcde12345', gen_salt('bf'))
WHERE email = 'eduardo@lyon.com.br';


-- ==========================================
-- 11. VER TODAS AS EMPRESAS E SEUS PARÂMETROS
-- ==========================================
SELECT 
    c.name as empresa,
    os.working_days_per_month as dias_trabalho,
    os.productive_hours_per_day as horas_dia,
    os.pro_labore_cents / 100.0 as pro_labore,
    os.revenue_forecast_cents / 100.0 as previsao_faturamento,
    os.default_desired_margin_percent as margem_padrao
FROM companies c
JOIN operational_settings os ON os.company_id = c.id;


-- ==========================================
-- 12. PRODUTOS SEM PREÇO DEFINIDO
-- ==========================================
SELECT 
    name as produto,
    acquisition_cost_cents / 100.0 as custo,
    stock_quantity as estoque,
    desired_margin_percent as margem_desejada
FROM products
WHERE current_price_cents IS NULL
ORDER BY stock_quantity DESC;


-- ==========================================
-- 13. BACKUP: EXPORTAR PRODUTOS PARA REIMPORTAR
-- ==========================================
SELECT 
    name,
    acquisition_cost_cents / 100.0 as custo_aquisicao,
    other_cost_cents / 100.0 as outros_custos,
    variable_fees_percent,
    tax_percent,
    desired_margin_percent,
    current_price_cents / 100.0 as preco_atual,
    stock_quantity,
    notes
FROM products
WHERE company_id = 'SEU_COMPANY_ID_AQUI'
ORDER BY name;


-- ==========================================
-- 14. ENCONTRAR COMPANY_ID POR EMAIL
-- ==========================================
SELECT 
    u.email,
    c.id as company_id,
    c.name as company_name
FROM auth.users u
JOIN company_members cm ON cm.user_id = u.id
JOIN companies c ON c.id = cm.company_id
WHERE u.email = 'SEU_EMAIL_AQUI@exemplo.com';


-- ==========================================
-- 15. ESTATÍSTICAS GERAIS DO SISTEMA
-- ==========================================
SELECT 
    'Total de Empresas' as metrica,
    COUNT(*)::text as valor
FROM companies
UNION ALL
SELECT 
    'Total de Produtos' as metrica,
    COUNT(*)::text as valor
FROM products
UNION ALL
SELECT 
    'Total de Serviços' as metrica,
    COUNT(*)::text as valor
FROM services
UNION ALL
SELECT 
    'Produtos com Estoque' as metrica,
    COUNT(*)::text as valor
FROM products
WHERE stock_quantity > 0
UNION ALL
SELECT 
    'Valor Total Estoque (R$)' as metrica,
    TO_CHAR(SUM(acquisition_cost_cents * stock_quantity / 100.0), 'FM999,999,999.00') as valor
FROM products;


-- ==========================================
-- 16. LIMPAR DADOS DE TESTE (CUIDADO!)
-- ==========================================
-- ⚠️ USE COM CUIDADO - Remove todos os produtos de uma empresa
-- DELETE FROM products WHERE company_id = 'COMPANY_ID_AQUI';

-- ⚠️ Remove todos os serviços de uma empresa
-- DELETE FROM services WHERE company_id = 'COMPANY_ID_AQUI';


-- ==========================================
-- 17. APLICAR MARGEM PADRÃO RETROATIVAMENTE
-- ==========================================
-- Remove margem específica apenas de produtos que estão
-- usando uma margem MENOR que a padrão configurada
UPDATE products p
SET desired_margin_percent = NULL
FROM operational_settings os
WHERE p.company_id = os.company_id
  AND p.desired_margin_percent IS NOT NULL
  AND p.desired_margin_percent < os.default_desired_margin_percent;


-- ==========================================
-- NOTAS IMPORTANTES
-- ==========================================
-- 1. Substitua 'SEU_COMPANY_ID_AQUI' pelo ID real da empresa
-- 2. Substitua 'SEU_EMAIL_AQUI@exemplo.com' pelo email real
-- 3. Sempre teste queries SELECT antes de executar UPDATE/DELETE
-- 4. Faça backup antes de operações em massa
-- 5. Use transações (BEGIN/COMMIT/ROLLBACK) para segurança:
--
--    BEGIN;
--    UPDATE products SET stock_quantity = 0;
--    -- Verifique se está correto
--    SELECT * FROM products LIMIT 5;
--    -- Se estiver OK:
--    COMMIT;
--    -- Se algo estiver errado:
--    ROLLBACK;
