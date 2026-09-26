# Arquitetura

## Arquitetura escolhida

Um monorepo npm com dois aplicativos independentes em React + TypeScript + Vite:

- `apps/vendas`: sistema interno de Carla para lançar vendas e consultar o mês.
- `apps/portal`: portal web de pais e alunos, com login e páginas de informações autorizadas.
- `packages/shared`: opcional; adicionar apenas quando os apps tiverem código comum que valha a pena manter em um pacote.
- `supabase/`: migrações SQL, seeds e Edge Functions opcionais.

A árvore acima é a estrutura-alvo documentada. O repositório ainda não foi migrado de `frontend/` e não contém os aplicativos. A implementação e a migração de pastas são tarefas futuras.

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

O repositório contém um esqueleto inicial, não os apps descritos acima. A documentação define a direção sem criar telas, configurar serviços externos nem mover arquivos. Antes de produção, implementar os apps, definir e versionar o esquema e as políticas Supabase, configurar os projetos Vercel e validar login e isolamento de dados por papel/conta.
