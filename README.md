# Hackaton WeTheBest

Estrutura inicial para desenvolver rapidamente uma aplicação com React, TypeScript e Supabase durante o hackathon. O tema e as funcionalidades serão definidos pela equipe.

## Stack prevista

- **Frontend:** React + TypeScript com Vite (a inicializar quando o projeto for definido).
- **Backend e dados:** Supabase (Postgres, Auth e Storage, conforme necessário).
- **Lógica server-side opcional:** Supabase Edge Functions em TypeScript/Deno.

## Estrutura

```text
.vscode/                   Recomendações e preferências do editor
frontend/src/components/   Componentes de interface reutilizáveis
frontend/src/pages/        Páginas/telas
frontend/src/hooks/        Hooks React
frontend/src/types/        Tipos compartilhados no frontend
frontend/src/lib/supabase/ Cliente e helpers de integração com Supabase
supabase/functions/        Edge Functions (opcionais)
supabase/migrations/       Migrações SQL versionadas
supabase/seed.sql          Dados iniciais locais (opcional)
docs/                      Ideias, decisões e documentação do projeto
```

## Documentação do projeto

- [Fluxo de Git e GitHub para o trio](docs/GIT_WORKFLOW.md)

## Começar quando o desafio for definido

1. Inicialize o frontend React + TypeScript em `frontend/` usando Vite. Remova os arquivos `.gitkeep` de `frontend/` antes de gerar o app se a ferramenta solicitar uma pasta vazia.
2. Instale e configure a CLI do Supabase e execute `supabase init` na raiz do repositório. O comando cria `supabase/config.toml`; preserve as pastas preparadas aqui.
3. Crie um projeto Supabase e copie a URL e a chave pública (anon/publishable) para um arquivo local `.env` baseado em `.env.example`.
4. Nunca coloque chaves secretas, como `service_role` ou secret key, no frontend ou no Git. Guarde-as em secrets de Edge Functions.

## Variáveis de ambiente do frontend

O arquivo `.env.example` documenta apenas os nomes esperados. Duplique-o como `frontend/.env.local` ao configurar o app e preencha os valores localmente. Arquivos `.env*` locais são ignorados pelo Git, exceto `.env.example`.

## Licença

Ainda não definida. A publicação pública do repositório não concede por si só uma licença de reutilização; a equipe pode adicionar uma depois.
