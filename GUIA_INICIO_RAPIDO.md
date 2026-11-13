# 🚀 Guia de Início Rápido

## ⏱️ 5 Minutos para Configurar Tudo

### Passo 1: Execute as Migrations (2 minutos)

Abra o **SQL Editor** do Supabase e execute:

```sql
-- 1. Adicionar coluna de estoque
ALTER TABLE products
ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0;

-- 2. Adicionar margem de lucratividade padrão
ALTER TABLE operational_settings
ADD COLUMN default_desired_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00;
```

✅ **Pronto!** Agora o banco está atualizado.

---

### Passo 2: Configure o Sistema (3 minutos)

#### 2.1 Defina a Margem Padrão

1. Abra a aplicação
2. Vá em **Lançamentos**
3. Role até **PARÂMETROS OPERACIONAIS**
4. Digite **25** no campo "Percentual de Lucratividade Padrão (%)"
5. Clique em **Atualizar**

✅ Agora todos os produtos usarão 25% por padrão!

---

#### 2.2 Configure um Produto

1. Vá em **Precificação**
2. Clique em **+ Novo produto**
3. Preencha:
   - Nome: **Produto Teste**
   - Custo de aquisição: **100,00**
   - Quantidade em estoque: **10**
   - **Deixe "Margem desejada" vazio** (usará os 25% padrão)
4. Clique em **Salvar**

✅ O sistema calculou automaticamente o preço com 25% de margem!

---

#### 2.3 Veja o Inventário

1. Clique na aba **Inventário**
2. Veja os cards de resumo:
   - Total de produtos
   - Valor em estoque (custo)
   - Valor em estoque (venda)
   - Lucro bruto potencial

✅ Gestão completa do estoque funcionando!

---

### Passo 3: Teste a Sincronização (1 minuto)

1. Volte em **Lançamentos** → **Parâmetros Operacionais**
2. Mude a margem de **25%** para **30%**
3. Clique em **Atualizar**
4. Volte em **Precificação**
5. Abra o produto que você criou

✅ O preço mudou automaticamente para refletir 30%!

---

## 🎯 Conceitos Importantes

### Margem Padrão vs Específica

**Margem Padrão (nos Parâmetros Operacionais):**
- Aplica-se a TODOS os produtos/serviços
- Pode ser alterada a qualquer momento
- Mudanças refletem instantaneamente

**Margem Específica (no produto individual):**
- Sobrescreve a margem padrão
- Útil para produtos premium ou promoções
- Para voltar ao padrão, basta limpar o campo

### Exemplo Prático

**Cenário:**
- Margem padrão: 25%
- Produto A: sem margem específica → usa 25%
- Produto B: margem específica 40% → usa 40%

**Você muda a margem padrão para 30%:**
- Produto A: agora usa 30% ✅
- Produto B: continua usando 40% (específica não muda)

---

## 📊 Dicas de Uso

### 1. Gerencie Margens por Categoria

**Eletrônicos (margem baixa - 15%):**
```
Campo "Margem desejada": 15
```

**Cosméticos (margem alta - 50%):**
```
Campo "Margem desejada": 50
```

**Produtos comuns (margem padrão - 25%):**
```
Campo "Margem desejada": deixe vazio
```

---

### 2. Monitore seu Inventário

Na aba **Inventário**, fique de olho em:
- 🔵 **Valor estoque (custo)**: Quanto você investiu
- 🟢 **Valor estoque (venda)**: Quanto vale se vender tudo
- 🟡 **Lucro bruto potencial**: A diferença entre os dois

---

### 3. Use os Status Visuais

**Verde - "Saudável":**
- Margem acima ou igual ao desejado
- Tudo certo! ✅

**Amarelo - "Abaixo da meta":**
- Margem positiva mas abaixo do desejado
- Considere aumentar o preço 📈

**Vermelho - "Margem negativa":**
- Você está vendendo com prejuízo!
- Ajuste urgente necessário ⚠️

---

## 🆘 Problemas Comuns

### "Margem não está atualizando"

1. Certifique-se de clicar em **Atualizar** nos Parâmetros Operacionais
2. Recarregue a página (F5)
3. Limpe o cache (Ctrl + Shift + R)

### "Produto não aparece no Inventário"

- O produto precisa ter **quantidade em estoque > 0**
- Edite o produto e preencha o campo "Quantidade em estoque"

### "Preço recomendado está errado"

Verifique se preencheu:
- ✅ Custo de aquisição
- ✅ Taxas variáveis (ou configure as padrões em Lançamentos)
- ✅ Margem desejada (ou configure a padrão)

---

## 🎓 Próximos Passos

1. ✅ Configure suas taxas padrão em **Lançamentos** → **Custos Variáveis**
2. ✅ Cadastre todos os seus produtos
3. ✅ Adicione quantidades de estoque
4. ✅ Monitore o inventário diariamente
5. ✅ Ajuste margens conforme necessário

---

## 📈 Workflow Recomendado

```
1. Configure Parâmetros Operacionais (uma vez)
   └── Margem padrão: 25%
   └── Taxas padrão: 10%
   └── Dias/horas trabalhados

2. Cadastre Produtos (conforme necessário)
   └── Nome e custos
   └── Quantidade em estoque
   └── Margem específica (se diferente do padrão)

3. Monitore Diariamente
   └── Aba Inventário: valores totais
   └── Aba Precificação: status de cada produto
   └── Ajuste preços/margens conforme mercado

4. Revise Mensalmente
   └── Analise lucratividade geral
   └── Ajuste margem padrão se necessário
   └── Limpe margens específicas que não fazem mais sentido
```

---

## 🎉 Pronto!

Agora você tem:
- ✅ Gestão centralizada de margens
- ✅ Controle completo de estoque
- ✅ Sincronização automática entre produtos
- ✅ Visão clara de lucratividade

**Bom trabalho! 🚀**
