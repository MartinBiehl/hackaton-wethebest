# Decisões

Registre decisões que afetem o trabalho da equipe para que todos, incluindo agentes de IA, usem o mesmo contexto.

| Data | Decisão | Motivo |
| --- | --- | --- |
| 2026-09-25 | React + Vite + TypeScript no frontend; Supabase para dados e autenticação. Backend separado continua opcional. | Preparação inicial para o hackathon. |
| 2026-09-26 | Organizar a arquitetura-alvo como monorepo npm com apps independentes `apps/vendas` e `apps/portal`; manter `packages/shared` opcional até existir código comum. | Vendas e portal têm públicos e publicação distintos, mas compartilham a plataforma de dados. |
| 2026-09-26 | Os dois apps usarão um projeto Supabase compartilhado (Auth e PostgreSQL), com acesso limitado por grants e RLS; lógica privilegiada fica em Edge Functions se necessária. | Centralizar os dados e autenticação sem confiar somente em controles da interface. |
| 2026-09-26 | Vendas será um PWA instalável, online para consultar e registrar dados na primeira versão; portal e vendas serão projetos Vercel Pro independentes. | Permitir instalação simples para Carla e publicação separada dos dois produtos no mesmo repositório. |
| 2026-09-26 | Domínios definitivos, esquema de dados e associações entre responsáveis/alunos ainda serão definidos antes da implementação correspondente. | Esses detalhes dependem de decisões de produto e não devem ser presumidos na documentação arquitetural. |
| 2026-09-26 | Materializar a estrutura como npm workspaces em `apps/vendas` e `apps/portal`; remover o scaffold vazio de `backend/`; deixar `packages/shared/` para quando houver código comum. | Manter a estrutura de arquivos alinhada aos dois produtos e evitar um backend separado sem requisito. |
| 2026-09-26 | Esquema inicial do banco versionado em `supabase/migrations/`, aplicado no projeto remoto pela CLI; sem banco local (a equipe não usa Docker). | Um único ambiente durante o hackathon, com histórico versionado no Git. |
| 2026-09-26 | Valores monetários em centavos (`bigint`) e extrato financeiro append-only como única fonte de verdade; saldo e dívida são derivados por view, nunca armazenados. | Evita erro de ponto flutuante e impede que saldo e extrato divirjam. |
| 2026-09-26 | Toda escrita com regra de negócio (venda, extrato, limite, vínculo) passa por função `SECURITY DEFINER` com `search_path` fixo; o cliente não tem INSERT/UPDATE nessas tabelas. | Atomicidade entre estoque, limites e extrato, e validação de papel no banco em vez da interface. |
| 2026-09-26 | Limite mensal e piso de dívida de −R$ 250,00 são regras independentes; mês-calendário no fuso `America/Sao_Paulo`. | Regra de negócio definida com a equipe; o fuso precisa ser explícito para o fechamento mensal. |
| 2026-09-26 | O papel `equipe` só é concedido por SQL administrativo; o cadastro público aceita apenas `responsavel` e `aluno`. | Impede escalada de privilégio por metadata enviado pelo cliente. |
| 2026-09-26 | A conta do aluno só é vinculada ao pré-cadastro do responsável após aprovação; o vínculo automático por e-mail confirmado fica atrás da chave `configuracoes.vinculo_automatico`, desligada. | Com "Confirm email" desligado no Auth, e-mail confirmado não prova posse do endereço. |

Os diretórios e workspaces foram criados, mas os aplicativos ainda não foram inicializados com Vite nem implementados. O banco de dados já tem esquema, políticas RLS e funções aplicados; o detalhamento está em [docs/DATABASE.md](DATABASE.md).
