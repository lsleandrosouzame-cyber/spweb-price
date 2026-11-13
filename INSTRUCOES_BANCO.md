# 📋 Instruções para Atualizar o Banco de Dados

## ⚠️ IMPORTANTE: Execute estas queries no Supabase SQL Editor

### 1️⃣ Adicionar Coluna de Quantidade em Estoque (se ainda não executou)

```sql
-- Migration: 202611130001_add_stock_quantity.sql
ALTER TABLE products
ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN products.stock_quantity IS 'Current stock quantity for this product';
```

---

### 2️⃣ Adicionar Coluna de Percentual de Lucratividade Padrão

```sql
-- Migration: 202611130003_add_default_desired_margin.sql
ALTER TABLE operational_settings
ADD COLUMN default_desired_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN operational_settings.default_desired_margin_percent IS 'Default desired profit margin percentage for all products and services (can be overridden per item)';
```

---

### 3️⃣ (OPCIONAL) Importar 492 Produtos da Lyon

⚠️ **Só execute se quiser importar os produtos da tabela Lyon_Tabela.csv para eduardo@lyon.com.br**

```sql
-- Arquivo: IMPORTAR_PRODUTOS_LYON.sql
-- Veja o arquivo completo no repositório
-- Este script importa 492 produtos do arquivo Lyon_Tabela.csv
```

---

## ✅ Como Verificar se Funcionou

### Verificar coluna stock_quantity:
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name = 'stock_quantity';
```

### Verificar coluna default_desired_margin_percent:
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'operational_settings' 
AND column_name = 'default_desired_margin_percent';
```

### Verificar dados:
```sql
-- Ver configurações operacionais
SELECT * FROM operational_settings;

-- Ver produtos com estoque
SELECT name, stock_quantity FROM products WHERE stock_quantity > 0;
```

---

## 🔄 Ordem Recomendada de Execução

1. ✅ Execute a migration de **stock_quantity**
2. ✅ Execute a migration de **default_desired_margin_percent**
3. 🔄 Atualize a aplicação web (já está no GitHub)
4. 🧪 Teste: Configure um percentual padrão nos Parâmetros Operacionais
5. 📦 (Opcional) Importe os produtos da Lyon

---

## 📝 Notas

- Todas as migrations são **seguras** e reversíveis
- As colunas têm valores **DEFAULT**, então não quebram dados existentes
- A migration de **stock_quantity** define 0 para todos os produtos existentes
- A migration de **default_desired_margin_percent** define 0.00% para todas as empresas
- Você pode alterar esses valores depois pela interface da aplicação

---

## 🆘 Problemas?

Se algo der errado, você pode reverter:

```sql
-- Reverter stock_quantity
ALTER TABLE products DROP COLUMN stock_quantity;

-- Reverter default_desired_margin_percent
ALTER TABLE operational_settings DROP COLUMN default_desired_margin_percent;
```
