# Plano de implementação — SPWeb Lucro

## Objetivo e decisões aprovadas

Construir o SPWeb Lucro como SaaS brasileiro de precificação e inteligência financeira: “Pare de adivinhar seus preços. Descubra quanto você realmente ganha.” O usuário deve conseguir entrar, cadastrar um produto, informar custo e preço e entender imediatamente sua margem e contribuição.

O brief exige React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Supabase, PostgreSQL, Supabase Auth, Lucide e biblioteca de gráficos. O usuário escolheu explicitamente Supabase; portanto, o banco Manus permanece desativado. O servidor Manus está habilitado. Para publicação, usar um contêiner único: o Dockerfile compila o frontend, e um servidor Node atende os arquivos, `GET /health` e `GET /api/config`. Supabase Auth/Postgres, policies e migrations continuam como camada de identidade e dados; nenhuma chave service-role deve entrar no contêiner ou navegador. Em produção, o servidor lê somente `SUPABASE_URL` e `SUPABASE_ANON_KEY` do ambiente de runtime e envia esses dois valores públicos ao cliente pelo endpoint de configuração. Desenvolvimento continua usando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no Vite. Nunca copiar valores de Development para Production nem armazenar credenciais no Git.

## Arquitetura e implementação

- **Web:** React + Vite + TypeScript; roteamento de páginas protegidas; Tailwind e componentes shadcn/ui onde fizerem sentido; Lucide; charts leves para distribuição e indicadores.
- **Dados/identidade:** Supabase JS client inicializado antes do React. Em Development, usa valores `VITE_*`; em produção, busca configuração pública em `/api/config` do servidor Node. Supabase Auth para cadastro, login, logout, recuperação e sessão. PostgreSQL com migrations versionadas em `supabase/migrations`; tabelas, chaves, constraints, índices, funções/policies e RLS para acesso por `company_members` e empresa autorizada. A chave anon/public pode ser usada no cliente somente acompanhada de RLS; nenhuma service-role key no bundle.
- **Domínio financeiro:** `src/finance` puro e independente da UI. Valores em centavos inteiros e percentuais com precisão definida; arredondamento somente na apresentação. Fórmulas centrais e validações compartilhadas por dashboard, formulários e relatórios.
- **Serviços e validação:** `src/services` para Supabase e consultas, `src/validations` para formulários, `src/types` para modelos, `src/contexts`/`src/hooks` para sessão/estado e `src/lib` para formatadores e utilitários. Operações multiempresa sempre limitadas por membership e verificadas pelas políticas do banco.
- **App:** layout com sidebar recolhível em desktop e navegação móvel; exatamente as cinco áreas principais Dashboard, Produtos, Cálculo, Vídeos e Lançamentos; Perfil, Configurações e Sair no rodapé. Calculadoras acessíveis também pelo fluxo de cadastro sem duplicar lógica.
- **Integração externa:** formulário de onboarding da empresa. A solicitação protegida de valores de Production foi cancelada; não reabri-la sem novo pedido. Até configuração dessas credenciais, Auth, gravação e persistência reais permanecem pendentes; o endpoint runtime informa `configured: false` e a interface mantém login/mutações desabilitados. Não usar service-role key nem dados simulados.
- **Operação/publicação:** não manter a declaração `build` de site estático separada. Limpar esse domínio e configurar `deploy` para `Dockerfile` e `/health`, pois `features.server` já está habilitado. O contêiner escuta `PORT` em `0.0.0.0`, serve `dist` com fallback SPA e retorna 2xx sem autenticação em `/health`; configurar `/api/config` para somente dados públicos. Não adicionar roteamento híbrido. A rota `/manus-routes.json` continua sincronizada. `publishing.auto_publish` está habilitado: um novo checkpoint em `main` pode iniciar a publicação automaticamente. Não enviar um segundo POST para a mesma versão se a publicação automática já foi submetida. O sucesso só será declarado após confirmação de publicação.

## Estrutura pretendida

```text
.
├── public/manus-routes.json
├── Dockerfile             # build e runtime do contêiner publicado
├── server.mjs             # estáticos, /health e configuração pública Supabase
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

Implementar em etapas funcionais preservando a ordem de negócio do brief: fundação e identidade; autenticação e persistência; produtos/serviços; calculadoras; lançamentos; motor financeiro; dashboard; central de conhecimento; validação; contrato do contêiner e publicação. As credenciais externas e eventuais limitações de Supabase serão explicitadas, não mascaradas por conteúdo simulado.
