-- DEBUG: Verificar taxas dos produtos Lyon
-- Execute no Supabase SQL Editor

-- 1. Ver o primeiro produto (1 MILLION BLACK EDP 30ML- RABANNE) e suas taxas
SELECT 
  p.id,
  p.name,
  p.variable_fees_percent as taxa_no_produto,
  p.tax_percent as imposto_no_produto,
  COUNT(pf.id) as quantidade_taxas_detalhadas,
  COALESCE(SUM(pf.percent), 0) as soma_taxas_detalhadas
FROM products p
LEFT JOIN product_fees pf ON pf.product_id = p.id
WHERE p.company_id = (
  SELECT cm.company_id 
  FROM auth.users u 
  JOIN company_members cm ON cm.user_id = u.id 
  WHERE u.email = 'eduardo@lyon.com.br'
)
AND p.name LIKE '1 MILLION BLACK%'
GROUP BY p.id, p.name, p.variable_fees_percent, p.tax_percent;

-- 2. Ver todas as taxas detalhadas deste produto
SELECT pf.label, pf.percent
FROM products p
INNER JOIN product_fees pf ON pf.product_id = p.id
WHERE p.company_id = (
  SELECT cm.company_id 
  FROM auth.users u 
  JOIN company_members cm ON cm.user_id = u.id 
  WHERE u.email = 'eduardo@lyon.com.br'
)
AND p.name LIKE '1 MILLION BLACK%';

-- 3. Ver quantos produtos têm taxas cadastradas VS total de produtos
SELECT 
  COUNT(DISTINCT p.id) as total_produtos,
  COUNT(DISTINCT pf.product_id) as produtos_com_taxas,
  COUNT(DISTINCT p.id) - COUNT(DISTINCT pf.product_id) as produtos_sem_taxas
FROM products p
LEFT JOIN product_fees pf ON pf.product_id = p.id
WHERE p.company_id = (
  SELECT cm.company_id 
  FROM auth.users u 
  JOIN company_members cm ON cm.user_id = u.id 
  WHERE u.email = 'eduardo@lyon.com.br'
);
