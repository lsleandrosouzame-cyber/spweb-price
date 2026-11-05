# SPWeb Lucro

SaaS brasileiro para precificação e inteligência financeira. A aplicação usa React, Vite, TypeScript, Tailwind CSS, componentes Radix no padrão shadcn/ui, Supabase Auth/PostgreSQL e regras financeiras centralizadas.

## Requisitos

- Node.js compatível com o toolchain do projeto.
- pnpm 11.25.0 (fixado em `package.json`).
- Um projeto Supabase próprio.

## Conectar ao Supabase

A solicitação protegida das credenciais foi cancelada, portanto nenhuma integração externa foi configurada neste código. Para ativá-la:

1. Crie ou selecione um projeto Supabase.
2. Copie a URL do projeto e a chave pública `anon`/publishable. **Não** use a chave `service_role` no navegador.
3. Em **Authentication → URL Configuration**, adicione como redirect URL cada origem usada (local, Preview e produção), terminando em `/auth/callback`. Configure também a Site URL de produção.
4. Aplique `supabase/migrations/202611050001_initial_schema.sql` uma única vez pelo SQL Editor do Supabase ou pelo fluxo de migrations da CLI Supabase. A migration cria tabelas, constraints, índices, triggers, membership de empresas e políticas RLS; revise-a antes de aplicá-la em um banco com dados existentes.
5. Crie um `.env` local copiando `.env.example` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Para build publicado, defina essas mesmas variáveis no ambiente do projeto WebDev antes de publicar.

Sem as duas variáveis, login, cadastro e mutações ficam desabilitados; a interface mostra claramente que a integração está pendente e não usa dados simulados.

## Desenvolvimento

```bash
pnpm install
cp .env.example .env
# preencher as duas variáveis públicas no .env
pnpm dev
```

A aplicação local inicia em `http://localhost:3000`. O manifesto de rotas está em `public/manus-routes.json` e também é servido em `/manus-routes.json`.

## Verificação e build

```bash
pnpm typecheck
pnpm test
pnpm build
```

O build estático é gerado em `dist/`. A migration armazena valores monetários em centavos e recalcula a contribuição de vendas no Postgres ao inseri-las. Vendas registradas preservam seu snapshot financeiro e nome de item mesmo se o cadastro original for removido. O acesso a todas as tabelas privadas depende de RLS e da membership da empresa.

## Observações

- A margem exibida é margem de contribuição, não lucro líquido.
- Despesas fixas não são adicionadas automaticamente ao custo unitário.
- O ponto de equilíbrio só aparece quando há despesas e mix de vendas suficientes.
- A publicação ainda não foi executada; configure Supabase e redirects primeiro.
