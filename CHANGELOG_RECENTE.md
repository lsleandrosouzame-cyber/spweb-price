# 📝 Changelog - Atualizações Recentes

## 🆕 Versão: 13 de Novembro de 2024

### ✨ Novas Funcionalidades

#### 1. 📦 Gestão de Estoque
- **Campo "Quantidade em Estoque"** adicionado a todos os produtos
- **Aba "Inventário"** com visão completa do estoque:
  - Total de produtos cadastrados
  - Valor total do estoque (custo)
  - Valor total do estoque (venda)
  - Potencial de lucro bruto
- **Colunas do inventário**:
  - Produto
  - Quantidade
  - Custo Unitário
  - Valor Estoque (custo total)
  - Valor Venda (preço total)
  - Lucro Bruto (com percentual e valor)

#### 2. 📊 Percentual de Lucratividade Padrão
- **Novo campo** nos Parâmetros Operacionais: "Percentual de Lucratividade Padrão (%)"
- **Aplicação automática**: Todos os produtos e serviços sem margem específica usam o valor padrão
- **Sincronização em tempo real**: Ao alterar o percentual padrão, todos os produtos/serviços são atualizados instantaneamente
- **Flexibilidade**: Cada produto/serviço ainda pode ter sua margem específica que sobrescreve o padrão
- **Indicadores visuais**:
  - Placeholder mostra "Padrão: 25%" quando há valor configurado
  - Detalhes mostram "25% (padrão)" para produtos usando margem padrão

#### 3. 🏷️ Nomenclaturas Atualizadas
- **"Custos"** renomeado para **"Custo Aquisição Mercadoria"**
- Maior clareza na interface de precificação

#### 4. 📋 Importação em Massa - Lyon
- Script SQL pronto para importar **492 produtos** da tabela Lyon
- Importação direta para conta **eduardo@lyon.com.br**
- Arquivo: `IMPORTAR_PRODUTOS_LYON.sql`

---

### 🔧 Melhorias

#### Tabela de Inventário Simplificada
- **Removidas colunas**:
  - Preço Unitário (redundante)
  - Lucro Operacional (complexo demais)
  - Markup (não essencial)
- **Coluna Lucro Bruto aprimorada**:
  - Mostra valor total
  - Badge colorido com percentual (verde positivo, vermelho negativo)
  - Valor por unidade
- **Largura reduzida**: 1200px → 900px (melhor visualização)

#### Cards de Resumo
- **4 cards informativos** no topo do inventário:
  - Total de produtos (azul)
  - Valor estoque custo (azul escuro)
  - Valor estoque venda (verde)
  - Lucro bruto potencial (dourado)

---

### 🗄️ Migrations do Banco

#### Migration 1: `202611130001_add_stock_quantity.sql`
```sql
ALTER TABLE products
ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0;
```

#### Migration 2: `202611130003_add_default_desired_margin.sql`
```sql
ALTER TABLE operational_settings
ADD COLUMN default_desired_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00;
```

---

### 💻 Arquivos Modificados

```
✅ src/types/database.ts
✅ src/pages/ProductsPage.tsx
✅ src/pages/ServicesPanel.tsx
✅ src/pages/ExpensesPage.tsx
✅ src/pages/CalculationPage.tsx
✅ src/services/companyData.ts
✅ supabase/migrations/202611130001_add_stock_quantity.sql
✅ supabase/migrations/202611130003_add_default_desired_margin.sql
✅ IMPORTAR_PRODUTOS_LYON.sql
```

---

### 🎯 Fluxo de Uso - Percentual de Lucratividade

**Cenário 1: Definir padrão para toda a empresa**
1. Vá em **Lançamentos** → seção **Parâmetros Operacionais**
2. Defina "Percentual de Lucratividade Padrão" = **30%**
3. Clique em **Atualizar**
4. ✅ Todos os produtos/serviços sem margem específica usam 30%

**Cenário 2: Sobrescrever para produto específico**
1. Abra um produto em **Precificação**
2. No campo "Margem desejada (%)", digite **40**
3. Salve o produto
4. ✅ Este produto usa 40%, ignorando o padrão de 30%

**Cenário 3: Voltar a usar o padrão**
1. Abra o produto
2. **Limpe** o campo "Margem desejada (%)"
3. Salve
4. ✅ Produto volta a usar o padrão configurado (30%)

**Cenário 4: Alterar padrão de toda empresa**
1. Mude o padrão de 30% para **35%**
2. ✅ Todos os produtos sem margem específica mudam para 35% **instantaneamente**
3. ✅ Produtos com margem específica (40%) permanecem em 40%

---

### 🧪 Como Testar

#### Teste 1: Estoque
1. Vá em **Precificação** → Cadastro/Edição de Produto
2. Preencha o campo "Quantidade em estoque"
3. Vá na aba **Inventário**
4. Veja os totalizadores e a tabela detalhada

#### Teste 2: Lucratividade Padrão
1. Configure 25% nos Parâmetros Operacionais
2. Crie um produto SEM preencher "Margem desejada"
3. Veja que o preço recomendado usa 25%
4. Altere o padrão para 35%
5. Reabra o produto → preço recomendado mudou para 35%

#### Teste 3: Importação Lyon
1. Execute `IMPORTAR_PRODUTOS_LYON.sql` no Supabase
2. Faça login com eduardo@lyon.com.br
3. Veja 492 produtos na lista de Precificação

---

### 📊 Commits

| Hash | Descrição |
|------|-----------|
| `4dba146` | Add stock quantity to products |
| `a809ef2` | Add SQL migration to import 492 Lyon products |
| `c4a2a84` | Simplify inventory table |
| `4be5389` | Add default profit margin field to operational parameters |
| `278aa03` | Apply default profit margin system-wide |
| `fbde9f6` | Add real-time sync for default margin updates |
| `67a15ca` | Add migration file for default desired margin percent |

---

### 🚀 Próximos Passos

1. ✅ Execute as migrations no Supabase
2. ✅ Configure o Percentual de Lucratividade Padrão
3. ✅ Adicione quantidades de estoque aos produtos
4. 📊 Monitore o inventário na nova aba
5. 🎯 Ajuste margens específicas conforme necessário

---

### 📞 Suporte

Se encontrar problemas:
1. Verifique se as migrations foram executadas
2. Confirme que está na versão mais recente do GitHub
3. Limpe o cache do navegador (Ctrl + Shift + R)
4. Verifique o console do navegador (F12) para erros

---

**Desenvolvido com precisão cirúrgica! 🎯**
