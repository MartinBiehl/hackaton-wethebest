# Decisões

Registre decisões que afetem o trabalho da equipe para que todos, incluindo agentes de IA, usem o mesmo contexto.

| Data | Decisão | Motivo |
| --- | --- | --- |
| 2026-09-25 | React + Vite + TypeScript no frontend; Supabase para dados e autenticação. Backend separado continua opcional. | Preparação inicial para o hackathon. |
| 2026-09-26 | Organizar a arquitetura-alvo como monorepo npm com apps independentes `apps/vendas` e `apps/portal`; manter `packages/shared` opcional até existir código comum. | Vendas e portal têm públicos e publicação distintos, mas compartilham a plataforma de dados. |
| 2026-09-26 | Os dois apps usarão um projeto Supabase compartilhado (Auth e PostgreSQL), com acesso limitado por grants e RLS; lógica privilegiada fica em Edge Functions se necessária. | Centralizar os dados e autenticação sem confiar somente em controles da interface. |
| 2026-09-26 | Vendas será um PWA instalável, online para consultar e registrar dados na primeira versão; portal e vendas serão projetos Vercel Pro independentes. | Permitir instalação simples para Carla e publicação separada dos dois produtos no mesmo repositório. |
| 2026-09-26 | Domínios definitivos, esquema de dados e associações entre responsáveis/alunos ainda serão definidos antes da implementação correspondente. | Esses detalhes dependem de decisões de produto e não devem ser presumidos na documentação arquitetural. |

As decisões descrevem a arquitetura planejada; a estrutura atual do repositório ainda não foi migrada e os aplicativos não estão implementados.
