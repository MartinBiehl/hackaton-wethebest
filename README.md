# Hackaton WeTheBest

Estrutura inicial para desenvolver rapidamente uma aplicação com React, TypeScript e Supabase durante o hackathon. O tema e as funcionalidades serão definidos pela equipe.

## Stack prevista

- **Frontend:** React + TypeScript com Vite (a inicializar quando o projeto for definido).
- **Backend e dados:** Supabase (Postgres, Auth e Storage, conforme necessário).
- **Lógica server-side opcional:** Supabase Edge Functions em TypeScript/Deno.

## Estrutura

```text
frontend/
├── public/                    Arquivos estáticos
└── src/
    ├── assets/                Imagens, ícones e fontes
    ├── components/            Componentes React reutilizáveis
    ├── pages/                 Páginas/telas
    ├── services/              Integrações e chamadas a APIs/Supabase
    ├── hooks/                 Hooks React
    ├── utils/                  Funções auxiliares
    └── styles/                 Estilos globais e compartilhados
backend/                        API separada, se necessária para o desafio
├── src/
│   ├── controllers/ routes/ services/
│   └── models/ middleware/ utils/
└── tests/                      Testes do backend, se houver
supabase/
├── migrations/                 Migrações SQL
├── functions/                  Edge Functions opcionais
├── seed/                       Seeds SQL organizados, se configurados
└── seed.sql                    Seed padrão da CLI Supabase
docs/
├── PROJECT_CONTEXT.md           Desafio e objetivo do MVP
├── ARCHITECTURE.md              Arquitetura escolhida
├── TASKS.md                     Quadro do trio
├── DECISIONS.md                 Decisões compartilhadas
└── GIT_WORKFLOW.md              Fluxo de Git e GitHub
AGENTS.md / CLAUDE.md            Instruções compartilhadas com agentes de IA
.env.example / .gitignore       Variáveis de exemplo e exclusões do Git
package.json                     Metadados do repositório
```

O backend separado é opcional: use primeiro o Supabase para banco e autenticação. Definam linguagem e framework do backend somente se o MVP precisar.

## Documentação do projeto

- [Fluxo de Git e GitHub para o trio](docs/GIT_WORKFLOW.md)

## Começar quando o desafio for definido

1. Inicialize o frontend React + TypeScript em `frontend/` usando Vite. Se solicitado, escolha manter/ignorar os arquivos existentes para preservar a estrutura preparada.
2. Instale e configure a CLI do Supabase e execute `supabase init` na raiz do repositório. O comando cria `supabase/config.toml`; preserve as pastas preparadas aqui.
3. Crie um projeto Supabase e copie a URL e a chave pública (anon/publishable) para um arquivo local `.env` baseado em `.env.example`.
4. Nunca coloque chaves secretas, como `service_role` ou secret key, no frontend ou no Git. Guarde-as em secrets de Edge Functions.

O Supabase CLI usa `supabase/seed.sql` por padrão. Para dividir seeds em `supabase/seed/`, configure `db.seed.sql_paths` em `supabase/config.toml` conforme a documentação da CLI.

## Variáveis de ambiente do frontend

O arquivo `.env.example` documenta apenas os nomes esperados. Duplique-o como `frontend/.env.local` ao configurar o app e preencha os valores localmente. Arquivos `.env*` locais são ignorados pelo Git, exceto `.env.example`.

## Licença

Ainda não definida. A publicação pública do repositório não concede por si só uma licença de reutilização; a equipe pode adicionar uma depois.
