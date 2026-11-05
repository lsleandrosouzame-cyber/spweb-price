# SPWeb Lucro — TODO de produto e implementação

> Todos os resultados abaixo continuam **abertos** até que haja evidência suficiente do comportamento completo. Evidência parcial: `typecheck`, 8 testes financeiros unitários, build de produção, 112 instruções da migration analisadas sintaticamente e `/manus-routes.json` comparado com o código e servido em HTTP 200. O formulário protegido de credenciais Supabase foi cancelado; não reabrir sem novo pedido. Sem essas credenciais, autenticação real, gravação, persistência, aplicação/validação de RLS e testes de isolamento seguem pendentes. A conexão canônica ao GitHub ainda depende do checkpoint e da confirmação do proprietário. Não usar dados fictícios como se fossem reais.

## 1. Fundação, identidade visual e navegação — [ ]

- Entregar frontend completo em React, Vite e TypeScript, com Tailwind CSS, shadcn/ui, Supabase, PostgreSQL, Supabase Auth, Lucide Icons e biblioteca leve de gráficos, mantendo arquitetura organizada, modular e escalável.
- Aplicar dark mode em todas as páginas; paleta preto `#090909`, grafite `#141414`, fundo secundário `#101010`, bordas `#262626`, dourado `#D4AF37`, branco `#F5F5F5`, cinza `#999999`, verde `#22C55E`, vermelho `#EF4444`, amarelo `#EAB308`; família Sora em toda aplicação.
- Interface premium, sofisticada, minimalista e profissional; sidebar elegante/recolhível no desktop e adaptada a celulares; cards discretamente arredondados, gráficos modernos, ícones minimalistas, microinterações suaves, hierarquia visual e espaçamento consistentes, contraste adequado e layout responsivo. Não usar neon, gradientes exagerados nem aparência genérica de template. Transmitir confiança, precisão, inteligência e simplicidade.
- Criar exatamente as opções principais: Dashboard, Produtos, Cálculo, Vídeos e Lançamentos. No rodapé: Perfil, Configurações e Sair. Rotas protegidas.
- Organizar código em módulos para `components`, `pages`, `layouts`, `hooks`, `services`, `lib`, `types`, `validations`, `finance` e `contexts`; separar visual, regras financeiras, serviços de banco, autenticação, validações, tipos e contextos; não concentrar tudo em arquivos gigantes.

## 2. Cadastro, login, sessão e onboarding — [ ]

- Implementar cadastro de usuário, login, logout, recuperação de senha, sessão persistente e proteção de rotas com integração real ao Supabase Auth.
- Após cadastro, apresentar configuração inicial simples para cadastrar a empresa.
- Preparar arquitetura multiempresa para permitir futuramente que um usuário administre mais de uma empresa; cada usuário acessa somente empresas e registros para os quais possui autorização.
- Mostrar estado deslogado até autenticação real; não inventar usuário de Preview nem contornar autenticação em desenvolvimento. Credenciais e callback devem ser protegidos e funcionar no Preview HTTPS.

## 3. Schema persistente, migrations e RLS — [ ]

- Usar PostgreSQL com Supabase e criar as entidades `profiles`, `companies`, `company_members`, `products`, `services`, `fixed_expenses`, `operational_settings`, `pricing_history` e `sales_records`.
- Criar relacionamentos, índices e constraints adequados e migrations organizadas/versionadas. Não executar alterações destrutivas sem verificar os dados existentes.
- Implementar Row Level Security em todas as tabelas privadas e garantir isolamento entre usuários e empresas. Cada operação deve verificar a associação/permissão da empresa; não expor chave administrativa no frontend.
- Persistir dados no banco real; não usar `localStorage` como substituto de banco nem dados estáticos como dados reais.

## 4. Gestão de produtos/serviços e histórico — [ ]

- Permitir cadastrar, editar, excluir, duplicar, pesquisar, filtrar, visualizar detalhes e consultar histórico de precificação de produtos e serviços.
- Exibir tabela com nome, custo total, preço atual, margem, markup, resultado por unidade e situação da margem. Verde = saudável; amarelo = abaixo da desejada; vermelho = negativa.
- Ao selecionar um produto, mostrar detalhes completos da precificação. Operações de exclusão exigem confirmação; sucesso, falhas e carregamento devem ter feedback.

## 5. Calculadora e precificação de produtos — [ ]

- Formulário com nome, custo de aquisição/produção, outros custos unitários, taxas e despesas variáveis (%), impostos sobre venda (%), preço atual opcional e margem desejada opcional conforme operação.
- Atualizar resultados automaticamente durante a digitação; botão principal `SALVAR PRODUTO`.
- Calcular e apresentar custo total, valor das taxas, valor dos impostos, resultado estimado por unidade, margem de contribuição, preço mínimo, preço recomendado, markup e diferença do preço atual para o recomendado. Cards: custo total, preço atual, mínimo, recomendado, resultado unitário, margem atual, margem desejada e markup. Comparativo visual entre preço atual e recomendado.
- Fórmulas obrigatórias: custo total = custo de aquisição + outros custos unitários; preço mínimo = custo total ÷ (1 − taxas variáveis − impostos); preço recomendado = custo total ÷ (1 − taxas variáveis − impostos − margem desejada); resultado unitário = preço de venda − custo total − taxas − impostos; margem de contribuição = resultado unitário ÷ preço de venda × 100; markup = preço de venda ÷ custo total.

## 6. Calculadora e precificação de serviços — [ ]

- Formulário específico: nome do serviço, tempo de execução em horas, custo-hora de mão de obra, materiais/insumos, outros custos, taxas/despesas variáveis, impostos, preço atual e margem desejada.
- Custo de mão de obra = horas × custo-hora; custo total = mão de obra + materiais + outros custos. Calcular resultado estimado, margem de contribuição, preço mínimo, preço recomendado e markup.
- Permitir utilizar custo-hora calculado em Lançamentos. Permitir incluir custo fixo por hora produtiva somente quando o usuário selecionar explicitamente essa regra. Evitar dupla contagem de despesas fixas.

## 7. Lançamentos e custo da operação — [ ]

- Cadastrar despesas fixas nas categorias Aluguel, Energia, Água, Internet, Salários, Pró-labore, Contabilidade, Sistemas, Marketing e Outras despesas.
- Campos: descrição, categoria, valor mensal, data de referência e observação. Permitir cadastrar, editar, excluir, pesquisar e filtrar.
- Exibir `TOTAL DE DESPESAS FIXAS MENSAIS` e gráfico de distribuição por categoria.
- Permitir informar dias trabalhados por mês e horas produtivas por dia. Calcular horas produtivas mensais = dias × horas/dia; custo fixo diário = despesas mensais ÷ dias trabalhados; custo fixo por hora = despesas mensais ÷ horas produtivas mensais; mostrar em três cards.
- Não adicionar automaticamente esses valores ao custo de todos os produtos.

## 8. Motor financeiro central e precisão — [ ]

- Motor independente da interface, com todas as fórmulas centralizadas em módulos reutilizáveis. Diferenciar custos variáveis, despesas variáveis, margem de contribuição, despesas fixas, resultado estimado por unidade e resultado operacional.
- Nunca apresentar margem de contribuição como lucro líquido. Usar precisão decimal confiável, preferir valores monetários em centavos inteiros no banco ou biblioteca decimal apropriada e arredondar somente na apresentação.
- Validar divisão por zero, percentuais inválidos, valores negativos indevidos, margens incompatíveis com taxas, dados incompletos e preços que não cobrem custos.

## 9. Dashboard de inteligência financeira — [ ]

- Exibir faturamento de referência, despesas fixas mensais, margem de contribuição, ponto de equilíbrio, markup, produtos cadastrados, produtos com margem saudável e produtos com margem baixa/negativa.
- Cada indicador possui valor, descrição, tooltip explicativo, origem dos dados e atualização automática. Não mostrar números fictícios. Quando faltarem informações, orientar como completar cadastros.
- Destacar ponto de equilíbrio com despesas fixas mensais, margem de contribuição média ponderada, faturamento necessário, faturamento de referência, valor faltante e progresso visual. Fórmula: despesas fixas mensais ÷ margem percentual ponderada. Ponderar pela participação dos produtos no faturamento ou mix de vendas informado; nunca usar média aritmética simples das margens.
- Preparar cadastro de quantidades vendidas por produto e período. Se faltarem dados, explicar que o ponto de equilíbrio depende do mix de vendas.
- Criar alertas para produtos vendidos abaixo do recomendado; margem abaixo da desejada; margem negativa; despesas fixas elevadas; negócio abaixo do equilíbrio; oportunidades de reajuste de preços.
- Seção “Onde você pode lucrar mais?” com produto/serviço, preço atual, preço recomendado, margem atual, margem desejada, diferença de preço e potencial adicional de contribuição por unidade; ordenar por relevância financeira. Identificar valores como simulações, nunca ganhos garantidos.

## 10. Central de conhecimento / Vídeos — [ ]

- Página chamada `CENTRAL DE CONHECIMENTO` com o texto exato “Estamos preparando conteúdos para ajudar você a precificar melhor e lucrar mais.” e status `EM BREVE.`
- Deixar estrutura preparada para vídeos e categorias futuras.

## 11. Experiência, responsividade e performance — [ ]

- Aplicar simplicidade absoluta: o empresário deve conseguir entrar, cadastrar um produto, informar custo e preço de venda e descobrir sua margem em poucos minutos.
- Máscaras brasileiras de moeda; percentuais intuitivos; tooltips explicativos; formulários curtos; feedback de sucesso e erro; estados de carregamento; confirmação antes de excluir; orientações para telas vazias; não exigir informações desnecessárias.
- Carregamento rápido, componentes reutilizáveis, consultas eficientes, navegação fluida, atualização instantânea dos cálculos, excelente experiência em celulares e tratamento adequado de erros.

## 12. Testes funcionais, financeiros e segurança — [ ]

- Executar testes reais para cadastro/login, recuperação de senha, proteção de rotas, cadastro/edição/exclusão/duplicação de produtos, cadastro de serviços, precificação, margem, markup, resultado unitário, despesas fixas, rateio diário, rateio por hora, ponto de equilíbrio, dashboard, persistência, isolamento entre usuários e responsividade.
- Teste financeiro de referência: custo R$ 50,00, taxas 5%, impostos 10%, margem desejada 20%; preço recomendado = 50 ÷ (1 − 0,05 − 0,10 − 0,20) ≈ R$ 76,92; resultado por unidade ≈ R$ 15,38; margem de contribuição 20%; markup ≈ 1,5384.
- Incluir testes de prejuízo, percentuais inválidos, denominadores negativos e dados incompletos.
- Validar que usuário A não acessa dados do usuário B, usuário não autorizado não acessa empresa de terceiros, políticas RLS funcionam, rotas privadas estão protegidas e credenciais não são expostas.

## 13. Build, publicação e entrega — [ ]

- Executar a aplicação, validar páginas, corrigir erros, executar testes, configurar publicação e publicar quando acesso e autorização necessários estiverem disponíveis.
- Critérios de conclusão: criação de conta e login funcionais; persistência real; produtos/serviços cadastráveis e editáveis; cálculos funcionais; despesas fixas; rateios por dia/hora; ponto de equilíbrio quando houver dados suficientes; dashboard de dados reais; isolamento e segurança implementados; funcionamento em dispositivos móveis; testes financeiros aprovados.
- Relatório final com funcionalidades implementadas, arquitetura, banco criado, autenticação, segurança, testes realizados/resultados, URL publicada somente se publicação confirmada e pendências externas. Não declarar funcionalidade pronta sem evidência.
