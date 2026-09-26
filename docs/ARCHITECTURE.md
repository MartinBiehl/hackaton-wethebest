# Arquitetura

## Arquitetura escolhida

Um monorepo npm com dois aplicativos independentes em React + TypeScript + Vite:

- `apps/vendas`: sistema interno de Carla para lançar vendas e consultar o mês.
- `apps/portal`: portal web de pais e alunos, com login e páginas de informações autorizadas.
- `packages/shared`: código comum aos dois apps (tipos do banco, erros, dinheiro e datas), consumido direto do código-fonte.
- `supabase/`: migrações SQL, seeds e Edge Functions opcionais.

Os diretórios `apps/vendas` e `apps/portal` e os npm workspaces já existem. O scaffold anterior de `frontend/` foi movido para `apps/vendas`; `apps/portal` recebeu a mesma estrutura-base. Os manifests são mínimos: ainda faltam inicializar os apps Vite, adicionar código, dependências e scripts de execução.

## Fluxo de dados e acesso

Os dois frontends conectam-se ao mesmo projeto Supabase usando `@supabase/supabase-js`, URL do projeto e chave pública. O Supabase fornece Auth e PostgreSQL. As políticas de grants e Row Level Security (RLS) no banco limitam cada operação e cada linha acessível; ocultar conteúdo na interface não é controle de segurança.

- A conta de Carla recebe permissões internas para lançar vendas e consultar os dados administrativos previstos.
- Pais e alunos entram no portal e só acessam os registros autorizados para sua conta e vínculo.
- Cada tabela exposta deve ter grants mínimos e políticas RLS explícitas. A chave `service_role` e quaisquer secret keys ficam somente em ambientes server-side protegidos.
- Se uma ação exigir segredo ou privilégio indisponível no navegador, implementá-la em Supabase Edge Functions. Um backend separado só será introduzido se surgir requisito que Supabase não atenda adequadamente.

O modelo exato de perfis, vínculos entre responsáveis e alunos, tabelas, campos e políticas deve ser definido antes das migrações de produção; esta decisão arquitetural não presume esse esquema.

## Instalação e publicação

O app de vendas será um PWA instalável pelo navegador, implementado com manifest e service worker. A v1 exige internet para autenticar e ler/gravar dados no Supabase; gravação offline e sincronização posterior estão fora do escopo definido.

O portal e o PWA serão projetos Vercel Pro distintos, construídos a partir do mesmo repositório e com configuração própria de diretório, build e variáveis de ambiente. O portal terá domínio próprio. Os domínios finais ainda não foram escolhidos. Os dois deployments apontam para o mesmo projeto Supabase, com ambiente/credenciais configurados sem commitar arquivos locais.

Referências técnicas: [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite), [domínios na Vercel](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [segurança de dados no Supabase](https://supabase.com/docs/guides/database/secure-data), [RLS no Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Segurança e configuração

Cada app terá um `.env.local` próprio, ignorado pelo Git, com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ou publishable key). A chave pública pode ser exposta no frontend somente com grants mínimos e RLS ativa e validada. Nunca expor `service_role`, secret keys, senha de banco ou connection string privilegiada no cliente, em arquivo versionado ou em log.

## Estado atual e próximos passos

Os dois apps já são projetos Vite com a camada de dados (`src/services`) implementada; faltam as telas. `packages/shared/` guarda o código comum; backend separado permanece fora do caminho inicial.

O projeto Supabase está criado e vinculado à CLI (`supabase/config.toml`), e a primeira versão do banco já foi aplicada: perfis e papéis, vínculo N:N entre responsáveis e alunos, catálogo com estoque separado, vendas com snapshot de preço e extrato financeiro append-only, tudo com RLS e funções `SECURITY DEFINER` para as operações que exigem atomicidade. O modelo, a matriz de permissões e as pendências estão em [DATABASE.md](DATABASE.md).

Próximos passos: inicializar Vite nos dois workspaces, conectar os apps ao Supabase, configurar os projetos Vercel e validar login e isolamento de dados por papel/conta na interface.
