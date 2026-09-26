# Hackaton WeTheBest

Repositório do sistema interno de vendas e do portal web para pais e alunos. A arquitetura-alvo é composta por dois aplicativos React + TypeScript com Vite, compartilhando um projeto Supabase.

> A estrutura abaixo documenta a organização escolhida para a implementação. O repositório ainda contém o esqueleto inicial (`frontend/`, `backend/` e `supabase/`); esta documentação não significa que os aplicativos já foram criados ou que as pastas existentes foram migradas.

## Produtos

- **Vendas:** aplicativo interno para Carla registrar vendas e consultar as vendas do mês. Será um PWA instalável pelo navegador; o acesso aos dados exige conexão com a internet.
- **Portal:** site publicado em domínio próprio para pais e alunos entrarem com login e consultarem as informações autorizadas para suas contas.

Os dois produtos terão interfaces e deploys separados, mas usarão o mesmo Supabase. O acesso de cada papel e conta será protegido por políticas RLS no banco.

## Estrutura-alvo

```text
apps/
├── vendas/                    Aplicativo React + TypeScript + Vite da Carla
│   ├── public/
│   └── src/
└── portal/                    Aplicativo React + TypeScript + Vite de pais e alunos
    ├── public/
    └── src/
packages/
└── shared/                    Criar somente quando houver código realmente compartilhado
supabase/
├── migrations/                Alterações versionadas do banco e das políticas RLS
├── functions/                 Edge Functions para lógica privilegiada, se necessárias
└── seed.sql
docs/                           Contexto, decisões, arquitetura, tarefas e fluxo Git
package.json                   Configuração npm workspaces na raiz
```

`backend/` separado não faz parte do caminho inicial. O acesso comum a dados pode usar `@supabase/supabase-js`; lógica privilegiada deve passar por uma Edge Function ou serviço server-side, nunca por uma chave secreta no navegador.

## Supabase e configuração local

Os dois apps usam o mesmo `VITE_SUPABASE_URL` e a chave pública `VITE_SUPABASE_ANON_KEY` (ou publishable key). Cada app terá seu próprio `.env.local`, ignorado pelo Git, com esses valores. A chave pública só é segura com grants mínimos e RLS corretamente configurado para todas as tabelas expostas. Nunca inclua `service_role`, secret keys, senhas ou connection strings privilegiadas nos apps ou no Git.

Ao iniciar os apps, configure npm workspaces no `package.json` da raiz e scripts para executar cada workspace. Este repositório ainda não contém esses apps ou scripts.

## Publicação

Os apps serão publicados como projetos separados na Vercel Pro, com variáveis de ambiente configuradas no ambiente de cada projeto. O portal terá um domínio próprio; o domínio do app de vendas e os nomes definitivos ainda serão escolhidos pela equipe. A publicação do frontend não substitui a configuração de Auth, banco e RLS no Supabase.

Referências: [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite), [rotas de SPA na Vercel](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas), [domínios próprios](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [segurança de dados no Supabase](https://supabase.com/docs/guides/database/secure-data).

## Documentação do projeto

- [Contexto do projeto](docs/PROJECT_CONTEXT.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Decisões](docs/DECISIONS.md)
- [Tarefas](docs/TASKS.md)
- [Fluxo de Git e GitHub](docs/GIT_WORKFLOW.md)

## Licença

Ainda não definida. A publicação pública do repositório não concede por si só uma licença de reutilização; a equipe pode adicionar uma depois.
