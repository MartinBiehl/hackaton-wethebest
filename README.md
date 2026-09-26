# Hackaton WeTheBest

Repositório do sistema interno de vendas e do portal web para pais e alunos. A arquitetura-alvo é composta por dois aplicativos React + TypeScript com Vite, compartilhando um projeto Supabase.

> Os diretórios e workspaces dos dois produtos já foram criados. Os aplicativos ainda não foram inicializados com Vite e não contêm telas nem lógica de negócio.

## Produtos

- **Vendas:** aplicativo interno para Carla registrar vendas e consultar as vendas do mês. Será um PWA instalável pelo navegador; o acesso aos dados exige conexão com a internet.
- **Portal:** site publicado em domínio próprio para pais e alunos entrarem com login e consultarem as informações autorizadas para suas contas.

Os dois produtos terão interfaces e deploys separados, mas usarão o mesmo Supabase. O acesso de cada papel e conta será protegido por políticas RLS no banco.

## Estrutura-alvo

```text
apps/
├── vendas/                    Workspace do app da Carla
│   ├── public/
│   ├── src/                    assets, components, hooks, pages, services, styles, utils
│   └── package.json
└── portal/                    Workspace do portal de pais e alunos
    ├── public/
    ├── src/                    assets, components, hooks, pages, services, styles, utils
    └── package.json
supabase/
├── migrations/                Alterações versionadas do banco e das políticas RLS
├── functions/                 Edge Functions para lógica privilegiada, se necessárias
└── seed.sql
docs/                           Contexto, decisões, arquitetura, tarefas e fluxo Git
package.json                   npm workspaces na raiz
```

Não há `backend/` separado no caminho inicial nem `packages/shared/` antes de existir código comum. O acesso comum a dados poderá usar `@supabase/supabase-js`; lógica privilegiada deve passar por uma Edge Function ou serviço server-side, nunca por uma chave secreta no navegador.

## Supabase e configuração local

Os dois apps usam o mesmo `VITE_SUPABASE_URL` e a chave pública `VITE_SUPABASE_ANON_KEY` (ou publishable key). Cada app terá seu próprio `.env.local`, ignorado pelo Git, com esses valores. A chave pública só é segura com grants mínimos e RLS corretamente configurado para todas as tabelas expostas. Nunca inclua `service_role`, secret keys, senhas ou connection strings privilegiadas nos apps ou no Git.

Os dois diretórios já estão cadastrados como npm workspaces, com manifests mínimos para vendas e portal. Ainda falta inicializar cada workspace como app Vite e adicionar scripts de desenvolvimento/build quando a equipe começar essa implementação.

## Publicação

Os apps serão publicados como projetos separados na Vercel Pro, com variáveis de ambiente configuradas no ambiente de cada projeto. O portal terá um domínio próprio; o domínio do app de vendas e os nomes definitivos ainda serão escolhidos pela equipe. A publicação do frontend não substitui a configuração de Auth, banco e RLS no Supabase.

Referências: [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite), [rotas de SPA na Vercel](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas), [domínios próprios](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [segurança de dados no Supabase](https://supabase.com/docs/guides/database/secure-data).

## Documentação do projeto

- [Contexto do projeto](docs/PROJECT_CONTEXT.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Banco de dados](docs/DATABASE.md)
- [Decisões](docs/DECISIONS.md)
- [Tarefas](docs/TASKS.md)
- [Fluxo de Git e GitHub](docs/GIT_WORKFLOW.md)

## Licença

Ainda não definida. A publicação pública do repositório não concede por si só uma licença de reutilização; a equipe pode adicionar uma depois.
