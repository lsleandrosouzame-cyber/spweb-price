-- Preencher taxas dos produtos da Lyon
-- Execute este SQL no Supabase SQL Editor

-- Verificar primeiro o produto que tem as taxas corretas
SELECT p.name, p.variable_fees_percent, pf.label, pf.percent
FROM products p
INNER JOIN product_fees pf ON pf.product_id = p.id
WHERE p.company_id = (
  SELECT cm.company_id 
  FROM auth.users u 
  JOIN company_members cm ON cm.user_id = u.id 
  WHERE u.email = 'eduardo@lyon.com.br'
)
ORDER BY p.name
LIMIT 10;

-- ============================================
-- OPÇÃO 1: Copiar as taxas do primeiro produto para todos os outros
-- (execute esta query se o primeiro produto tiver as taxas corretas)
-- ============================================

WITH company_info AS (
  SELECT cm.company_id 
  FROM auth.users u 
  JOIN company_members cm ON cm.user_id = u.id 
  WHERE u.email = 'eduardo@lyon.com.br'
),
first_product AS (
  SELECT p.id, p.company_id
  FROM products p
  INNER JOIN company_info ci ON ci.company_id = p.company_id
  ORDER BY p.name
  LIMIT 1
),
first_product_fees AS (
  SELECT pf.label, pf.percent
  FROM product_fees pf
  INNER JOIN first_product fp ON fp.id = pf.product_id
),
other_products AS (
  SELECT p.id, p.company_id
  FROM products p
  INNER JOIN company_info ci ON ci.company_id = p.company_id
  WHERE p.id NOT IN (SELECT id FROM first_product)
)
INSERT INTO product_fees (product_id, company_id, label, percent)
SELECT op.id, op.company_id, fpf.label, fpf.percent
FROM other_products op
CROSS JOIN first_product_fees fpf
WHERE NOT EXISTS (
  SELECT 1 FROM product_fees pf2
  WHERE pf2.product_id = op.id 
  AND pf2.label = fpf.label
);

-- ============================================
-- OPÇÃO 2: Definir taxas manualmente (24% total)
-- Caso você saiba quais taxas devem ser aplicadas
-- ============================================

-- Exemplo: Taxa única de 24%
/*
INSERT INTO product_fees (product_id, company_id, label, percent)
SELECT p.id, p.company_id, 'Taxa de Transação', 24.00
FROM products p
WHERE p.company_id = (
  SELECT cm.company_id 
  FROM auth.users u 
  JOIN company_members cm ON cm.user_id = u.id 
  WHERE u.email = 'eduardo@lyon.com.br'
)
AND NOT EXISTS (
  SELECT 1 FROM product_fees pf 
  WHERE pf.product_id = p.id
);
*/

-- ============================================
-- Após inserir, verificar se funcionou
-- ============================================
SELECT p.name, 
       p.variable_fees_percent as taxa_antiga,
       COALESCE(SUM(pf.percent), 0) as taxa_nova
FROM products p
LEFT JOIN product_fees pf ON pf.product_id = p.id
WHERE p.company_id = (
  SELECT cm.company_id 
  FROM auth.users u 
  JOIN company_members cm ON cm.user_id = u.id 
  WHERE u.email = 'eduardo@lyon.com.br'
)
GROUP BY p.id, p.name, p.variable_fees_percent
ORDER BY p.name
LIMIT 10;
