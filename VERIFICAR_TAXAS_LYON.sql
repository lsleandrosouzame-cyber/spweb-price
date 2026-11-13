-- Verificar taxas dos produtos da Lyon
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar quantos produtos Lyon têm taxas na tabela product_fees
SELECT COUNT(DISTINCT p.id) as produtos_com_taxas
FROM products p
INNER JOIN product_fees pf ON pf.product_id = p.id
WHERE p.company_id = (
  SELECT cm.company_id 
  FROM auth.users u 
  JOIN company_members cm ON cm.user_id = u.id 
  WHERE u.email = 'eduardo@lyon.com.br'
);

-- 2. Verificar taxas específicas de alguns produtos
SELECT p.name, p.variable_fees_percent, 
       COALESCE(SUM(pf.percent), 0) as soma_taxas_detalhadas
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

-- 3. Verificar se há algum produto Lyon com variable_fees_percent preenchido
SELECT COUNT(*) as produtos_com_variable_fees_percent
FROM products
WHERE company_id = (
  SELECT cm.company_id 
  FROM auth.users u 
  JOIN company_members cm ON cm.user_id = u.id 
  WHERE u.email = 'eduardo@lyon.com.br'
)
AND variable_fees_percent > 0;
