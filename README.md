# iCarla — Hackaton WeTheBest

Monorepo do iCarla, composto pelo sistema interno da cantina e pelo portal de pais e alunos. Os dois aplicativos usam React, TypeScript e Vite, compartilham código em um pacote próprio e acessam o mesmo projeto Supabase.

> Os dois aplicativos já possuem seus principais fluxos e telas conectados à camada de serviços do Supabase.

## Produtos

- **iCarla Vendas (`apps/vendas`):** app interno da Carla para autenticação, registro e cancelamento de vendas, fechamento mensal, pedidos, pagamentos, produtos, estoque, alunos e intervalos de retirada.
- **Portal (`apps/portal`):** app de pais e alunos com cadastro e login, cardápio, carrinho, agendamento e histórico de pedidos, créditos, extrato, limites e gestão dos alunos vinculados.

As interfaces e os deploys são independentes, mas os dados, a autenticação e as regras de acesso ficam no mesmo Supabase. Grants, Row Level Security (RLS) e funções SQL aplicam as permissões no banco.

## Design

- [Figma Desktop](https://www.figma.com/design/pv3RvxrhVU6F5TDJcmJq8B/Desktop?node-id=0-1&t=fUDQbVLkXjNGg9xc-1)
- [Figma Mobile iCarla](https://www.figma.com/design/TRpC2zJyvla20VRpTKnNKx/Mobile-Icarla?node-id=0-1&t=UoVuBK5LBWQocEJV-1)

## Estrutura atual

```text
apps/
├── vendas/                    App interno iCarla
│   ├── public/
│   └── src/
│       ├── components/        Layout, modais, busca, avisos e elementos reutilizáveis
│       ├── hooks/             Sessão e utilitários assíncronos
│       ├── pages/             Vendas, nova venda, fechamento, pedidos, pagamentos e cadastros
│       ├── services/          Auth e acesso tipado ao Supabase
│       └── utils/             Erros e períodos
└── portal/                    Portal de pais e alunos
    ├── public/
    └── src/
        ├── components/        Layout, carrinho, resumo do pedido e elementos reutilizáveis
        ├── hooks/             Sessão, aluno selecionado, carrinho e utilitários assíncronos
        ├── pages/             Autenticação e áreas de aluno e responsável
        ├── services/          Auth, alunos, vínculos, cardápio, créditos, extrato e pedidos
        ├── styles/            Estilos globais do portal
        └── utils/             Datas, erros, pedidos, rótulos e texto
packages/
└── shared/src/                Tipos do banco e utilitários de datas, dinheiro e erros
supabase/
├── migrations/                Esquema, RLS, Storage, vendas, créditos e pedidos
├── functions/                 Espaço para Edge Functions
├── tests/                     Testes SQL de RLS e regras de negócio
└── seed.sql
docs/                           Contexto, arquitetura, banco, decisões, tarefas e fluxo Git
package.json                   Workspaces npm da raiz
```

Não há um `backend/` separado. As regras transacionais ficam em funções PostgreSQL; integrações que precisem de segredo ou privilégio, como o futuro webhook de Pix, devem usar Supabase Edge Functions. Nunca coloque uma chave `service_role` no navegador.

## Executar localmente

Na raiz do repositório:

```bash
npm install
```

Copie o `.env.example` de cada app para um `.env.local` no mesmo diretório e preencha apenas as credenciais públicas:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Depois, execute o app desejado:

```bash
npm run dev -w @wethebest/vendas
npm run dev -w @wethebest/portal
```

O app de vendas usa a porta `5173`; o portal usa a `5174`. Cada workspace também oferece os scripts `build`, `lint` e `preview`.

## Banco de dados

As migrações versionadas cobrem identidade e papéis, vínculos entre responsáveis e alunos, catálogo com fotos e estoque, vendas, extrato, créditos pagos e pedidos prévios. O código compartilhado expõe os tipos gerados do Supabase para os dois frontends. O modelo completo, as RPCs e a matriz de permissões estão em [docs/DATABASE.md](docs/DATABASE.md).

## Publicação

Vendas e portal serão projetos separados na Vercel, com diretório, build e variáveis de ambiente próprios. Os dois apps já contêm o rewrite de SPA; a configuração final dos projetos, dos domínios e do PWA instalável continua pendente.

## Documentação do projeto

- [Contexto do projeto](docs/PROJECT_CONTEXT.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Banco de dados](docs/DATABASE.md)
- [Decisões](docs/DECISIONS.md)
- [Tarefas](docs/TASKS.md)
- [Uso de inteligência artificial](docs/AI_USAGE.md)
- [Fluxo de Git e GitHub](docs/GIT_WORKFLOW.md)

<details>
<summary>Nota sobre uso de IA</summary>

O registro está em [Uso de inteligência artificial](docs/AI_USAGE.md).

</details>

## Licença

Ainda não definida. A publicação pública do repositório não concede por si só uma licença de reutilização; a equipe pode adicionar uma depois.
