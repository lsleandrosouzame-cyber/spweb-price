# ✅ Checklist de Instalação - SPWeb Lucro

## 📋 Use este checklist para garantir que tudo está funcionando

---

## 🗄️ FASE 1: Banco de Dados (Supabase)

### [ ] 1.1 Abrir SQL Editor
- Acesse seu projeto no Supabase
- Clique em "SQL Editor" no menu lateral

### [ ] 1.2 Executar Migration 1 (Estoque)
```sql
ALTER TABLE products
ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0;
```
- ✅ Executou sem erros?
- ✅ Mensagem: "Success. No rows returned"

### [ ] 1.3 Executar Migration 2 (Margem Padrão)
```sql
ALTER TABLE operational_settings
ADD COLUMN default_desired_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00;
```
- ✅ Executou sem erros?
- ✅ Mensagem: "Success. No rows returned"

### [ ] 1.4 Verificar Instalação
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'stock_quantity'
UNION ALL
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'operational_settings' AND column_name = 'default_desired_margin_percent';
```
- ✅ Retornou 2 linhas?
- ✅ `stock_quantity` aparece?
- ✅ `default_desired_margin_percent` aparece?

---

## 🌐 FASE 2: Aplicação Web

### [ ] 2.1 Acessar a Aplicação
- Abra o navegador
- Acesse a URL da aplicação
- Faça login com sua conta

### [ ] 2.2 Configurar Margem Padrão
- ✅ Menu lateral → Clique em "Lançamentos"
- ✅ Role até "PARÂMETROS OPERACIONAIS"
- ✅ Veja o campo "Percentual de Lucratividade Padrão (%)"
- ✅ Digite: **25**
- ✅ Clique em "Atualizar"
- ✅ Mensagem: "Parâmetros operacionais salvos."

### [ ] 2.3 Verificar Outras Configurações (opcional)
- Dias trabalhados no mês: ex. **22**
- Horas trabalhadas por dia: ex. **8**
- Pró-labore mensal: ex. **5.000,00**
- Previsão de faturamento: ex. **20.000,00**

---

## 🧪 FASE 3: Testes Funcionais

### [ ] 3.1 Teste: Criar Produto com Margem Padrão
- ✅ Menu lateral → "Precificação"
- ✅ Clique em "+ Novo produto"
- ✅ Preencha:
  - Nome: **Teste Margem Padrão**
  - Custo de aquisição: **100,00**
  - Quantidade em estoque: **10**
  - Margem desejada: **deixe VAZIO**
- ✅ Veja o placeholder: "Padrão: 25%"
- ✅ Clique em "Salvar"
- ✅ Produto criado com sucesso?

### [ ] 3.2 Teste: Verificar Preço Calculado
- ✅ Na lista, clique no produto "Teste Margem Padrão"
- ✅ Veja os detalhes
- ✅ Preço recomendado foi calculado?
- ✅ Margem mostra "25% (padrão)"?

### [ ] 3.3 Teste: Sincronização em Tempo Real
- ✅ Volte em "Lançamentos" → "Parâmetros Operacionais"
- ✅ Mude de 25% para **30%**
- ✅ Clique em "Atualizar"
- ✅ Volte em "Precificação"
- ✅ Clique no produto "Teste Margem Padrão"
- ✅ Margem mudou para "30% (padrão)"?
- ✅ Preço recomendado foi recalculado?

### [ ] 3.4 Teste: Margem Específica
- ✅ Edite o produto "Teste Margem Padrão"
- ✅ No campo "Margem desejada", digite **40**
- ✅ Salve
- ✅ Volte em "Lançamentos" e mude margem padrão para 35%
- ✅ Volte no produto
- ✅ Margem continua em "40%" (sem "(padrão)")?
- ✅ Produto não foi afetado pela mudança do padrão?

### [ ] 3.5 Teste: Inventário
- ✅ Menu "Precificação" → Clique na aba "Inventário"
- ✅ Vê 4 cards no topo?
  - Total de produtos
  - Valor estoque (custo)
  - Valor estoque (venda)
  - Lucro bruto potencial
- ✅ Vê a tabela com o produto "Teste Margem Padrão"?
- ✅ Quantidade mostra 10?
- ✅ Valores estão corretos?

---

## 🎯 FASE 4: Cenários Reais

### [ ] 4.1 Criar Produto Real
- ✅ Crie um produto do seu catálogo real
- ✅ Preencha todos os campos
- ✅ Defina quantidade em estoque
- ✅ Use margem padrão (deixe vazio) OU específica
- ✅ Produto salvo com sucesso?

### [ ] 4.2 Verificar Status Visual
- ✅ Na lista de produtos, vê badges coloridos?
  - 🟢 Verde = Saudável
  - 🟡 Amarelo = Abaixo da meta
  - 🔴 Vermelho = Margem negativa
- ✅ Status condiz com a margem do produto?

### [ ] 4.3 Testar Múltiplos Produtos
- ✅ Crie 3 produtos:
  - Produto A: sem margem específica
  - Produto B: sem margem específica  
  - Produto C: margem específica 50%
- ✅ Mude margem padrão para 28%
- ✅ Produtos A e B usam 28%?
- ✅ Produto C continua com 50%?

---

## 📊 FASE 5: Importação (Opcional - Lyon)

### [ ] 5.1 Verificar Company ID
```sql
SELECT 
    u.email,
    c.id as company_id,
    c.name as company_name
FROM auth.users u
JOIN company_members cm ON cm.user_id = u.id
JOIN companies c ON c.id = cm.company_id
WHERE u.email = 'eduardo@lyon.com.br';
```
- ✅ Retornou o company_id?
- ✅ Anotou: `ba488372-7a4f-4132-a18c-77e2a56edf03`

### [ ] 5.2 Executar Importação
- ✅ Abra o arquivo `IMPORTAR_PRODUTOS_LYON.sql`
- ✅ Execute no SQL Editor
- ✅ Aguarde conclusão (pode demorar 1-2 minutos)
- ✅ Mensagem de sucesso?

### [ ] 5.3 Verificar Produtos Importados
- ✅ Faça login como eduardo@lyon.com.br
- ✅ Vá em "Precificação"
- ✅ Vê 492 produtos?
- ✅ Produtos têm nomes da tabela Lyon?

---

## 🔍 FASE 6: Verificações Finais

### [ ] 6.1 Performance
- ✅ Páginas carregam rapidamente?
- ✅ Troca entre abas é fluida?
- ✅ Lista de produtos rola suavemente?
- ✅ Sem erros no console (F12)?

### [ ] 6.2 Responsividade (opcional)
- ✅ Abra em tela menor (Ctrl + Shift + M)
- ✅ Interface se adapta?
- ✅ Botões clicáveis?
- ✅ Campos legíveis?

### [ ] 6.3 Navegadores (opcional)
- ✅ Chrome: funciona?
- ✅ Firefox: funciona?
- ✅ Edge: funciona?
- ✅ Safari: funciona?

---

## 🆘 TROUBLESHOOTING

### Problema: Migration retorna erro "column already exists"
**Solução:** A coluna já foi criada anteriormente. Pule esta migration.

### Problema: Campo "Percentual de Lucratividade Padrão" não aparece
**Solução:** 
1. Confirme que executou a migration 2
2. Limpe cache do navegador (Ctrl + Shift + R)
3. Faça logout e login novamente

### Problema: Margem não atualiza em tempo real
**Solução:**
1. Verifique se clicou em "Atualizar" nos Parâmetros
2. Aguarde 1-2 segundos
3. Recarregue a página (F5)
4. Verifique console (F12) por erros

### Problema: Produto não aparece no Inventário
**Solução:** Produto precisa ter `stock_quantity > 0`. Edite e adicione quantidade.

### Problema: Preço recomendado está errado
**Solução:** Verifique:
1. Custo de aquisição preenchido
2. Taxas variáveis configuradas
3. Margem (específica ou padrão) definida

---

## ✅ CONCLUSÃO

Marque todos os checkboxes ✅ para garantir instalação completa!

**Itens obrigatórios:**
- Fase 1: Banco de Dados (100%)
- Fase 2: Configuração (100%)
- Fase 3: Testes (100%)

**Itens opcionais:**
- Fase 4: Cenários Reais
- Fase 5: Importação Lyon
- Fase 6: Verificações Extras

---

## 🎉 Sistema Pronto!

Se todos os testes passaram, seu sistema está **100% funcional**!

Próximos passos:
1. Cadastre seus produtos reais
2. Configure quantidades de estoque
3. Ajuste margens conforme necessário
4. Monitore o inventário diariamente

**Bom trabalho! 🚀**
