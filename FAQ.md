# ❓ Perguntas Frequentes (FAQ)

## 📊 Percentual de Lucratividade Padrão

### P1: O que é o "Percentual de Lucratividade Padrão"?
**R:** É uma margem de lucro que você configura UMA VEZ nos Parâmetros Operacionais e se aplica automaticamente a TODOS os produtos e serviços que não têm uma margem específica definida.

### P2: Se eu mudar o percentual padrão, todos os produtos mudam?
**R:** SIM e NÃO:
- ✅ **SIM**: Produtos SEM margem específica atualizam automaticamente
- ❌ **NÃO**: Produtos COM margem específica mantêm seu valor

**Exemplo:**
```
Padrão: 25%
├── Produto A (vazio) → usa 25%
├── Produto B (vazio) → usa 25%
└── Produto C (40%) → usa 40%

Muda para 30%:
├── Produto A → agora 30% ✅
├── Produto B → agora 30% ✅
└── Produto C → continua 40% ❌
```

### P3: Como faço para um produto usar a margem padrão?
**R:** Deixe o campo "Margem desejada (%)" **VAZIO** no formulário do produto. O sistema aplicará automaticamente o percentual configurado nos Parâmetros Operacionais.

### P4: Como faço para um produto ter margem específica?
**R:** Preencha o campo "Margem desejada (%)" com o valor desejado. Este produto passará a ignorar a margem padrão e usar sempre o valor específico.

### P5: Posso voltar a usar o padrão depois de definir margem específica?
**R:** SIM! Basta editar o produto e **limpar** o campo "Margem desejada (%)". O produto voltará a usar a margem padrão.

### P6: O placeholder mostra "Padrão: 25%", o que isso significa?
**R:** Significa que você configurou 25% como margem padrão nos Parâmetros Operacionais. Se você deixar o campo vazio, este produto usará automaticamente 25%.

### P7: Por que alguns produtos mostram "25% (padrão)" e outros só "40%"?
**R:** 
- **"25% (padrão)"**: Produto está usando a margem dos Parâmetros Operacionais
- **"40%"**: Produto tem margem específica configurada

---

## 📦 Gestão de Estoque

### P8: O que é "Quantidade em estoque"?
**R:** É o número de unidades que você possui deste produto. Usado para calcular o valor total imobilizado em estoque e potencial de lucro.

### P9: Produto com estoque zero aparece no Inventário?
**R:** NÃO. A aba Inventário mostra apenas produtos com `quantidade > 0`. Se quiser incluir um produto, edite-o e adicione quantidade.

### P10: Como funciona o cálculo dos cards de resumo?
**R:**
- **Valor estoque (custo)**: Soma de (Custo × Quantidade) de todos os produtos
- **Valor estoque (venda)**: Soma de (Preço × Quantidade) de todos os produtos
- **Lucro bruto potencial**: Diferença entre valor de venda e valor de custo

### P11: O que é "Lucro Bruto" na tabela?
**R:** É a diferença entre o preço de venda e o custo total (incluindo outros custos), multiplicado pela quantidade. NÃO inclui taxas e impostos - por isso é "bruto".

### P12: A badge de lucro ficou vermelha, o que fazer?
**R:** Badge vermelha significa margem negativa - você está vendendo com prejuízo! 
- Aumente o preço de venda
- Renegocie custos com fornecedor
- Ou descontinue o produto

---

## 🎨 Interface e Usabilidade

### P13: O que significam as cores dos status?
**R:**
- 🟢 **Verde (Saudável)**: Margem está igual ou acima da desejada ✅
- 🟡 **Amarelo (Abaixo da meta)**: Margem positiva mas abaixo do desejado ⚠️
- 🔴 **Vermelho (Margem negativa)**: Você está no prejuízo! 🚨

### P14: Como ordenar a tabela de produtos?
**R:** Clique nos cabeçalhos das colunas para ordenar:
- Nome: A-Z ou Z-A
- Custo: Menor-Maior ou Maior-Menor
- Margem: Menor-Maior ou Maior-Menor

### P15: Tem como ver apenas produtos com margem negativa?
**R:** SIM! Use os filtros no topo da lista:
- **Todos**: Mostra todos os produtos
- **Saudável**: Apenas produtos com margem OK
- **Abaixo da meta**: Margem positiva mas abaixo
- **Negativa**: Apenas produtos no prejuízo

---

## 🗄️ Banco de Dados

### P16: Já executei a migration antes, posso executar de novo?
**R:** NÃO dá erro, mas vai retornar "column already exists". Se a coluna já existe, não precisa executar novamente.

### P17: Como verifico se as migrations foram aplicadas?
**R:** Execute este SQL:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name IN ('products', 'operational_settings')
AND column_name IN ('stock_quantity', 'default_desired_margin_percent');
```
Deve retornar 2 linhas.

### P18: Posso reverter as migrations?
**R:** SIM, mas você perderá os dados:
```sql
ALTER TABLE products DROP COLUMN stock_quantity;
ALTER TABLE operational_settings DROP COLUMN default_desired_margin_percent;
```

### P19: Os dados antigos foram afetados?
**R:** NÃO! As migrations usam `DEFAULT 0`, então:
- Produtos existentes: `stock_quantity = 0`
- Empresas existentes: `default_desired_margin_percent = 0.00`

Você pode atualizar esses valores pela interface depois.

---

## 🔄 Sincronização e Performance

### P20: A atualização em tempo real funciona em outra aba?
**R:** SIM! Se você tiver duas abas abertas:
1. Aba 1: Muda margem padrão em Lançamentos
2. Aba 2: Em Precificação, os produtos atualizam automaticamente

### P21: Demora quanto tempo para sincronizar?
**R:** Instantâneo! O sistema usa eventos customizados do JavaScript. A atualização acontece em milissegundos.

### P22: E se eu estiver offline?
**R:** A sincronização só funciona com conexão ativa. Se estiver offline, faça a mudança e depois recarregue a página quando voltar online.

### P23: O sistema fica lento com muitos produtos?
**R:** Não! Implementamos paginação:
- Mostra 50 produtos por página por padrão
- Você pode escolher 100 ou 200
- Mesmo com milhares de produtos, permanece rápido

---

## 💼 Casos de Uso Práticos

### P24: Como configurar margens diferentes por categoria?
**R:** Duas opções:

**Opção 1 - Manual:**
1. Defina margem padrão conservadora (ex: 20%)
2. Para produtos premium, defina margem específica (ex: 50%)

**Opção 2 - SQL em massa:**
```sql
UPDATE products
SET desired_margin_percent = 50
WHERE name ILIKE '%PREMIUM%';
```

### P25: Tenho produtos de atacado e varejo, como diferenciar?
**R:** Use a margem específica:
- **Atacado**: margem específica 15%
- **Varejo**: deixe vazio (usa padrão de 30%)

Ou crie campos customizados no nome:
- "Produto X - Atacado"
- "Produto X - Varejo"

### P26: Como faço promoções sem perder a margem original?
**R:** 
1. Anote a margem atual do produto
2. Defina margem promocional temporária
3. Após promoção, volte para a margem original
4. Ou limpe o campo para usar o padrão

### P27: Importei produtos da Lyon, como ajustar margens em massa?
**R:** Use SQL:
```sql
-- Aplicar 30% a todos os produtos Lyon
UPDATE products
SET desired_margin_percent = 30
WHERE name ILIKE '%LYON%';

-- Ou limpar para usar padrão
UPDATE products
SET desired_margin_percent = NULL
WHERE name ILIKE '%LYON%';
```

---

## 🔐 Segurança e Permissões

### P28: Outros usuários veem meus produtos?
**R:** NÃO! O sistema tem RLS (Row Level Security). Cada empresa só vê seus próprios dados. Eduardo@lyon.com.br não vê seus produtos e vice-versa.

### P29: Posso ter múltiplos usuários na mesma empresa?
**R:** SIM! Você pode convidar colaboradores. Todos verão os mesmos produtos e parâmetros da empresa.

### P30: Como resetar senha de um usuário?
**R:** Execute no Supabase (substitua o email e senha):
```sql
UPDATE auth.users
SET encrypted_password = crypt('NOVA_SENHA', gen_salt('bf'))
WHERE email = 'usuario@exemplo.com';
```

---

## 📊 Relatórios e Análises

### P31: Como exportar meu inventário?
**R:** Por enquanto, use o SQL:
```sql
SELECT 
    name,
    stock_quantity,
    acquisition_cost_cents / 100.0 as custo,
    current_price_cents / 100.0 as preco,
    (current_price_cents - acquisition_cost_cents) * stock_quantity / 100.0 as lucro_total
FROM products
WHERE company_id = 'SEU_ID'
ORDER BY name;
```

Copie e cole no Excel.

### P32: Tem relatório de produtos mais lucrativos?
**R:** Use o script do `SCRIPTS_UTEIS_SUPABASE.sql` #9:
```sql
SELECT 
    name,
    (acquisition_cost_cents * stock_quantity / 100.0) as valor_estoque
FROM products
WHERE stock_quantity > 0
ORDER BY valor_estoque DESC
LIMIT 10;
```

### P33: Como ver histórico de mudanças de preço?
**R:** O sistema salva automaticamente. Veja:
1. Abra um produto
2. Clique no ícone de histórico (relógio)
3. Veja todas as alterações com data/hora

---

## 🔧 Manutenção

### P34: Como fazer backup dos produtos?
**R:** Use o script #13 do `SCRIPTS_UTEIS_SUPABASE.sql`. Ele exporta todos os produtos em formato que pode ser reimportado depois.

### P35: Como limpar produtos de teste?
**R:** Com CUIDADO:
```sql
DELETE FROM products 
WHERE name ILIKE '%TESTE%'
AND company_id = 'SEU_ID';
```

### P36: Como atualizar estoque em massa?
**R:** Use SQL:
```sql
-- Adicionar 50 unidades a todos
UPDATE products
SET stock_quantity = stock_quantity + 50;

-- Zerar estoque de produtos descontinuados
UPDATE products
SET stock_quantity = 0
WHERE name ILIKE '%DESCONTINUADO%';
```

---

## 🆘 Problemas Comuns

### P37: "Cannot read property of null" no console
**R:** Recarregue a página (F5). Se persistir, limpe o cache (Ctrl + Shift + R).

### P38: Margem mudou mas preço não
**R:** O preço só muda se você:
1. Deixou "Preço praticado hoje" vazio (usa recomendado)
2. Ou editar o produto e salvar novamente

### P39: Tabela está vazia mas tenho produtos
**R:** 
- **Na aba Inventário**: Produtos precisam ter `stock_quantity > 0`
- **Na aba Precificação**: Verifique os filtros (pode estar em "Saudável" mas produtos estão "Abaixo da meta")

### P40: Sistema está em inglês
**R:** O sistema está em português brasileiro. Se aparecer inglês, pode ser:
- Extensão do navegador traduzindo
- Cache antigo do navegador

Limpe o cache (Ctrl + Shift + R).

---

## 📞 Suporte

### Onde encontro mais ajuda?
Consulte os outros documentos:
- **GUIA_INICIO_RAPIDO.md**: Tutorial passo a passo
- **INSTRUCOES_BANCO.md**: Scripts SQL
- **SCRIPTS_UTEIS_SUPABASE.sql**: 17 scripts prontos
- **CHANGELOG_RECENTE.md**: Todas as funcionalidades

### Encontrei um bug, e agora?
1. Verifique o console (F12) por erros
2. Anote os passos para reproduzir
3. Verifique se as migrations foram aplicadas
4. Recarregue a página e teste novamente

---

**Última atualização: Novembro 2024**
