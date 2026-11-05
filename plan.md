# Plano de implementação — SPWeb Lucro

## Objetivo e decisões aprovadas

Construir o SPWeb Lucro como SaaS brasileiro de precificação e inteligência financeira: “Pare de adivinhar seus preços. Descubra quanto você realmente ganha.” O usuário deve conseguir entrar, cadastrar um produto, informar custo e preço e entender imediatamente sua margem e contribuição.

O brief exige React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Supabase, PostgreSQL, Supabase Auth, Lucide e biblioteca de gráficos. O usuário escolheu explicitamente Supabase; portanto, o banco Manus permanece desativado. O servidor Manus está habilitado para viabilizar a publicação server-capable e operações server-side necessárias. Não usar dados mock como reais, localStorage como persistência ou service-role key no navegador. Supabase Auth, Postgres, policies e migrations são a camada de identidade e dados; endpoints server-side só serão usados quando houver necessidade que não possa ser resolvida com segurança via Supabase/RLS. As chaves do Supabase serão obtidas por canal protegido, nunca armazenadas no Git.

## Arquitetura e implementação

- **Web:** React + Vite + TypeScript; roteamento de páginas protegidas; Tailwind e componentes shadcn/ui onde fizerem sentido; Lucide; charts leves para distribuição e indicadores.
- **Dados/identidade:** Supabase JS client com variáveis de ambiente apropriadas ao Vite, Supabase Auth para cadastro, login, logout, recuperação e sessão. PostgreSQL com migrations versionadas em `supabase/migrations`; tabelas, chaves, constraints, índices, funções/policies e RLS para acesso por `company_members` e empresa autorizada. A chave anon/public pode ser usada no cliente somente acompanhada de RLS; nenhuma service-role key no bundle.
- **Domínio financeiro:** `src/finance` puro e independente da UI. Valores em centavos inteiros e percentuais com precisão definida; arredondamento somente na apresentação. Fórmulas centrais e validações compartilhadas por dashboard, formulários e relatórios.
- **Serviços e validação:** `src/services` para Supabase e consultas, `src/validations` para formulários, `src/types` para modelos, `src/contexts`/`src/hooks` para sessão/estado e `src/lib` para formatadores e utilitários. Operações multiempresa sempre limitadas por membership e verificadas pelas políticas do banco.
- **App:** layout com sidebar recolhível em desktop e navegação móvel; exatamente as cinco áreas principais Dashboard, Produtos, Cálculo, Vídeos e Lançamentos; Perfil, Configurações e Sair no rodapé. Calculadoras acessíveis também pelo fluxo de cadastro sem duplicar lógica.
- **Integração externa:** formulário de onboarding da empresa. Não presumir que credenciais Supabase existem. A primeira solicitação protegida de URL do projeto e chave pública anon foi cancelada; só solicitar novamente se o usuário pedir. Até a configuração, autenticação, gravação, migrations aplicadas e persistência reais permanecem pendentes e a interface não simula dados. Nenhuma chave secreta administrativa é necessária no frontend. Não inserir registros fictícios para preencher o dashboard.
- **Operação:** arquivo de rotas estático `/manus-routes.json` sincronizado com as rotas, diagnósticos TypeScript gerenciados pelo host, servidor de desenvolvimento na porta configurada 3000, build e testes. A publicação só será declarada concluída após resposta bem-sucedida da plataforma.

## Estrutura pretendida

```text
.
├── public/manus-routes.json
├── src/
│   ├── components/       # componentes de UI reutilizáveis
│   ├── contexts/         # sessão e empresa selecionada
│   ├── finance/          # fórmulas independentes da interface
│   ├── hooks/            # hooks de domínio e dados
│   ├── layouts/          # shell autenticado e navegação
│   ├── lib/              # Supabase client, moeda, datas e utilitários
│   ├── pages/            # login, onboarding e áreas principais
│   ├── services/         # consultas/mutações ao Supabase
│   ├── types/            # tipos compartilhados
│   └── validations/      # regras de entrada
├── supabase/migrations/  # schema, índices, constraints e RLS
├── tests/                # testes unitários e de integração viáveis
├── app.config.ts         # metadados da aplicação Manus
├── package.json          # scripts e versões
├── pnpm-workspace.yaml   # pin/política de lifecycle scripts
├── TODO.md               # critérios de aceite rastreáveis
└── plan.md
```

A estrutura será ajustada à medida que as capacidades reais do projeto flexível forem verificadas, sem concentrar a aplicação em arquivos gigantes.

## Design

### Direção

- **Design Movement:** Swiss Precision com luxo editorial contemporâneo — densidade informacional controlada, alinhamentos rigorosos e detalhes dourados discretos.
- **Princípios centrais:** clareza financeira antes de decoração; contraste e hierarquia inequívocos; confiança por precisão e transparência sobre origem/ausência dos dados; simplicidade para pequenas empresas.
- **Filosofia de cor:** preto profundo e grafite reduzem ruído e dão foco; o dourado #D4AF37 sinaliza decisão/valor sem neon; branco #F5F5F5 e cinza #999999 preservam leitura; verde #22C55E, vermelho #EF4444 e amarelo #EAB308 comunicam estados sem depender apenas de texto.
- **Layout:** aplicação de trabalho com navegação lateral estreita e conteúdo orientado a tarefa; indicadores e tabelas aparecem em faixas/hierarquias, não em uma grade genérica centralizada. Em telas pequenas, navegação compacta e formulários em coluna.
- **Motivos de assinatura:** traços finos dourados para destacar cálculo/recomendação; números tabulares alinhados para valores financeiros; etiquetas de estado com texto e cor.
- **Interação:** entrada curta e progressiva, atualização imediata de cálculos, ajuda contextual junto ao campo, feedback explícito e confirmação para exclusão. Estados vazios explicam a próxima ação.
- **Animação:** transições sutis de 140–220 ms para sidebar, drawers e feedback; sem animação contínua, parallax ou movimento que distraia de dados; respeitar `prefers-reduced-motion`.
- **Tipografia:** Sora em toda aplicação, conforme pedido. Pesos 400–500 para texto, 600 para cabeçalhos, 600–700 para números/CTAs; números financeiros com alinhamento tabular. Escala responsiva sem reduzir legibilidade.
- **Essência de marca:** inteligência financeira acessível a pequenos empresários, que transforma números em decisões claras; personalidade: precisa, confiável, objetiva.
- **Voz:** direta, acolhedora e sem promessas de lucro garantido. Exemplos: “Veja o que sobra por unidade.”; “Com os dados atuais, ainda não dá para estimar seu ponto de equilíbrio.”
- **Wordmark/logo:** lettering “SPWeb” em Sora semibold e “LUCRO” em versais pequenas, acompanhado de uma marca geométrica de dois traços ascendentes que remetem a margem/resultado; não usar fonte padrão sem tratamento. A criação de asset/URL durável será resolvida antes de checkpoint conforme regra de logo da plataforma.
- **Cor proprietária:** dourado fosco #D4AF37, usado com parcimônia para a marca e ações primárias.

## Organização de entrega

Implementar em etapas funcionais preservando a ordem de negócio do brief: fundação e identidade; autenticação e persistência; produtos/serviços; calculadoras; lançamentos; motor financeiro; dashboard; central de conhecimento; validação e publicação. As credenciais externas e eventuais limitações de Supabase serão explicitadas, não mascaradas por conteúdo simulado.
