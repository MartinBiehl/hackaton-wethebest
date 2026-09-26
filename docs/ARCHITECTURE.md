# Arquitetura

## Visão geral

O projeto é um monorepo npm com dois aplicativos React + TypeScript + Vite, um pacote TypeScript compartilhado e a infraestrutura do Supabase versionada no mesmo repositório.

```text
apps/vendas ──┐
              ├── packages/shared ── tipos e utilitários comuns
apps/portal ──┘
       │
       └──────── Supabase ── Auth, PostgreSQL, RLS, RPCs e Storage
```

Não existe um backend HTTP separado. Operações com regra de negócio são executadas em funções PostgreSQL atômicas. Uma Supabase Edge Function deve ser introduzida quando uma integração exigir segredo ou execução privilegiada, como na futura integração com o provedor de Pix.

## Estrutura do monorepo

```text
apps/
├── vendas/                    Aplicação interna iCarla
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   ├── vercel.json            Rewrite da SPA
│   └── vite.config.ts         Servidor local na porta 5173
└── portal/                    Portal de pais e alunos
    ├── public/
    ├── src/
    │   ├── components/
    │   ├── hooks/
    │   ├── pages/
    │   │   ├── aluno/
    │   │   └── responsavel/
    │   ├── services/
    │   ├── styles/
    │   └── utils/
    ├── vercel.json            Rewrite da SPA
    └── vite.config.ts         Servidor local na porta 5174
packages/
└── shared/src/
    ├── database.ts            Tipos gerados a partir do Supabase
    ├── datas.ts
    ├── dinheiro.ts
    ├── erros.ts
    └── index.ts
supabase/
├── migrations/                Alterações SQL ordenadas e versionadas
├── functions/                 Edge Functions futuras
├── tests/rls_smoke.sql        Testes de isolamento e regras de negócio
├── config.toml
└── seed.sql
```

Os workspaces são `@wethebest/vendas`, `@wethebest/portal` e `@wethebest/shared`. O pacote compartilhado exporta diretamente o código-fonte TypeScript; cada Vite o compila junto com o respectivo app, sem etapa própria de build.

## Aplicativo de vendas

`apps/vendas` é a interface operacional da Carla. O `App.tsx` usa `react-router-dom` e protege as rotas com o perfil obtido pelo hook de sessão.

Rotas implementadas:

| Rota | Página | Responsabilidade |
| --- | --- | --- |
| `/vendas` | `Vendas` | Lista, filtros, indicadores, ranking e cancelamento. |
| `/nova-venda` | `NovaVenda` | Venda para aluno ou cliente não registrado. |
| `/fechamento` | `FechamentoMensal` | Relatório mensal calculado e imprimível. |
| `/pedidos` | `Pedidos` | Fila de retirada e finalização. |
| `/pagamentos` | `Pagamentos` | Confirmação manual de cobranças Pix pendentes. |
| `/produtos` | `Produtos` | Catálogo, fotos, ativação e estoque. |
| `/alunos` | `Alunos` | Cadastro, consulta de saldo e recebimento de fiado. |
| `/intervalos` | `Intervalos` | Horários disponíveis para retirada. |

Os componentes reutilizáveis ficam em `components/`; sessão e comportamento assíncrono ficam em `hooks/`; o acesso ao Supabase fica isolado em `services/`. A interface não replica as regras críticas: preços, estoque, limites, saldo, cancelamento e pagamento são validados novamente no banco.

## Portal

`apps/portal` usa `react-router-dom`, consome `@wethebest/shared` e separa a navegação autenticada conforme o papel retornado pela sessão.

Principais rotas:

| Rota | Público | Responsabilidade |
| --- | --- | --- |
| `/cadastro` | Não autenticado | Criação de conta de aluno ou responsável. |
| `/aluno` | Aluno | Cardápio e entrada da área do aluno. |
| `/aluno/pedido` | Aluno | Carrinho e resumo do pedido. |
| `/aluno/retirada` | Aluno | Data, intervalo e forma de pagamento. |
| `/aluno/pedidos` e `/aluno/pedidos/:pedidoId` | Aluno | Histórico e detalhe dos pedidos. |
| `/aluno/creditos` | Aluno | Solicitação e acompanhamento de créditos. |
| `/responsavel` | Responsável | Visão dos alunos vinculados. |
| `/responsavel/alunos/:alunoId/extrato` | Responsável | Extrato e compras do aluno. |
| `/responsavel/alunos/:alunoId/limites` | Responsável | Limite mensal e créditos. |

As telas compartilham layout, componentes de interface, tratamento de erros e um provedor de carrinho isolado por conta. A camada `src/services` está dividida por domínio:

- `auth.ts`: cadastro, login, logout e sessão;
- `alunos.ts` e `vinculos.ts`: contas, responsáveis, limites e aprovações;
- `cardapio.ts`: produtos disponíveis e intervalos;
- `creditos.ts`: solicitações de crédito e pagamentos;
- `extrato.ts`: movimentos e compras;
- `pedidos.ts`: criação e histórico de pedidos.

## Pacote compartilhado

`packages/shared` surgiu depois que os dois apps passaram a dividir código real. Ele centraliza:

- o tipo `Database` gerado pela CLI do Supabase;
- conversão e formatação de valores em centavos;
- datas e competência mensal no fuso `America/Sao_Paulo`;
- tradução dos códigos de erro do banco para erros de negócio.

Isso evita manter cópias divergentes da tipagem e das regras auxiliares nos dois frontends.

## Supabase e fluxo de dados

Os frontends usam `@supabase/supabase-js` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. O Supabase fornece:

- Auth para as contas de equipe, responsáveis e alunos;
- PostgreSQL para catálogo, estoque, vendas, extrato, créditos e pedidos;
- RLS e grants mínimos para restringir linhas e operações por papel e vínculo;
- RPCs `SECURITY DEFINER` para escritas atômicas e validações de negócio;
- Storage público apenas para fotos de produtos, com escrita limitada à equipe.

O fluxo de uma escrita crítica é:

```text
tela → service tipado → RPC do Supabase → validação de papel e regras
     → transação no PostgreSQL → resposta ou erro de negócio estável
```

A matriz de permissões, as tabelas, as views e todas as RPCs estão detalhadas em [DATABASE.md](DATABASE.md).

## Configuração, segurança e deploy

Cada app usa seu próprio `.env.local`, ignorado pelo Git. Somente a URL do projeto e a chave pública anônima/publicável podem chegar ao frontend. `service_role`, secret keys, senhas e connection strings privilegiadas devem ficar fora do navegador, dos logs e do Git.

Vendas e portal serão projetos Vercel independentes, cada um com diretório raiz, build e variáveis de ambiente próprios. Os dois apps já têm rewrite para rotas de SPA. Manifest, service worker e instalação como PWA ainda não foram configurados; a primeira versão continuará online.

## Próximos passos arquiteturais

1. Validar as telas dos dois apps com contas, vínculos e dados reais.
2. Configurar e validar o PWA do app de vendas.
3. Integrar o provedor de Pix por Edge Function e restringir a confirmação manual.
4. Testar os fluxos de ponta a ponta e o isolamento entre contas.
5. Configurar os dois projetos Vercel e seus domínios.
