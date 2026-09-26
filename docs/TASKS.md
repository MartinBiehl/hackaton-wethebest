# Tarefas

Dividam o trabalho por funcionalidade e indiquem quem está atuando em cada tarefa. Evitem editar os mesmos arquivos ao mesmo tempo. Responsáveis ainda não definidos; combinar com a equipe antes de implementar.

## Estrutura do monorepo

- [x] Mover o scaffold de frontend para `apps/vendas`, criar o scaffold de `apps/portal` e configurar npm workspaces.
- [x] Inicializar `apps/vendas` como app React + TypeScript + Vite.
- [x] Inicializar `apps/portal` como app React + TypeScript + Vite (porta 5174).
- [x] Criar `packages/shared` com tipos do banco, erros, dinheiro e datas.

## Aplicativo de vendas — branch `frontend-Cantina`

- [x] Camada de dados do app de vendas (`apps/vendas/src/services`): login, busca de aluno, venda com ou sem cliente registrado, cancelamento em 24 h, produtos, estoque e cadastro de aluno.
- [x] Serviços de cardápio com foto, intervalos de retirada, fila de pedidos e confirmação de pagamentos.
- [x] Telas de venda, cancelamento, cadastros (produtos com foto, estoque, alunos, intervalos), fila de pedidos e pagamentos.
- [x] Consulta das vendas do mês (lista com filtros, indicadores e ranking de produtos mais vendidos) e fechamento mensal como relatório imprimível.
- [ ] Testar as telas com a conta da Carla e dados reais.
- [ ] Configurar o PWA instalável e documentar que a v1 exige conexão para acessar dados.

## Portal de pais e alunos — responsável: a definir

- [x] Serviços do portal: cadastro e login, vínculos, saldo, extrato, compras, limite, cardápio, créditos e pedidos prévios.
- [ ] Telas do portal (cardápio, pedido, créditos, extrato, limite, vínculos).
- [ ] Integrar a API de Pix por Edge Function (depois das telas) e restringir a confirmação manual.

## Supabase e publicação — responsável: a definir

- [x] Definir esquema PostgreSQL, migrações, perfis/vínculos e políticas RLS para cada papel. Aplicado no projeto remoto; ver [DATABASE.md](DATABASE.md).
- [x] Validar grants e RLS para impedir que uma conta acesse registros não autorizados. Bateria em `supabase/tests/rls_smoke.sql`, executada em 2026-09-26.
- [ ] Criar a conta da Carla no painel e promovê-la a `equipe` com o SQL de [DATABASE.md](DATABASE.md).
- [ ] Decidir se o vínculo automático de contas de aluno será ligado (exige "Confirm email" no Auth).
- [ ] Configurar os dois projetos Vercel Pro e seus domínios/variáveis de ambiente.
- [ ] Usar Edge Functions para ações privilegiadas, caso sejam necessárias; manter chaves secretas fora do cliente e do Git.

## Integração e entrega — responsável: a definir

- [ ] Conferir fluxo completo de venda e consulta mensal da Carla.
- [ ] Conferir login de pais/alunos e isolamento dos dados entre contas.
- [ ] Atualizar esta lista com responsáveis, estado das tarefas e decisões ainda pendentes.
