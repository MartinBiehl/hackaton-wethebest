# Supabase

Infraestrutura versionada do projeto iCarla. O mesmo projeto Supabase atende `apps/vendas` e `apps/portal` com Auth, PostgreSQL, Row Level Security, funções RPC e Storage de fotos de produtos.

## Estrutura

```text
supabase/
├── migrations/
│   ├── 20260926120000_identidade_e_vinculos.sql
│   ├── 20260926120100_produtos_e_estoque.sql
│   ├── 20260926120200_vendas_e_financeiro.sql
│   ├── 20260926120300_operacoes.sql
│   ├── 20260926120400_corrige_gatilho_estoque.sql
│   ├── 20260926130000_venda_avulsa_e_prazo_cancelamento.sql
│   ├── 20260926140000_cardapio_fotos.sql
│   └── 20260926140100_pagamentos_e_pedidos.sql
├── functions/                 Edge Functions futuras, como a integração Pix
├── tests/rls_smoke.sql        Testes de RLS, atomicidade e regras de negócio
├── config.toml                Configuração da CLI e vínculo do projeto
└── seed.sql                   Ponto de entrada de dados iniciais
```

As migrações devem ser executadas na ordem do timestamp. Não edite uma migração já aplicada: crie outra com um timestamp posterior.

## Fluxo de trabalho

O repositório está vinculado ao projeto remoto. A equipe não usa um banco local com Docker.

```bash
npx supabase migration list
npx supabase db push
```

Depois de alterar o esquema, regenere a tipagem compartilhada:

```bash
npx supabase gen types typescript --linked > packages/shared/src/database.ts
```

No PowerShell, o redirecionamento pode gravar em UTF-16; prefira executar esse comando pelo Git Bash.

## Segurança

- Nunca versione senhas, connection strings, `service_role` ou secret keys.
- Os frontends usam somente a URL do projeto e a chave pública anônima/publicável.
- Toda tabela exposta tem grants mínimos e RLS explícita.
- Vendas, limites, extrato, créditos, pagamentos, pedidos e vínculos usam RPCs para manter validação e atomicidade no banco.
- A chave privilegiada de uma integração futura deve existir apenas em uma Edge Function protegida.

O esquema, a matriz de permissões, as funções e as regras financeiras estão detalhados em [docs/DATABASE.md](../docs/DATABASE.md).
