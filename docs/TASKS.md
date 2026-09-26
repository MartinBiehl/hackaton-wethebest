# Tarefas

Estado consolidado em 2026-09-26. Dividam o trabalho por funcionalidade, indiquem quem está atuando em cada tarefa e evitem editar os mesmos arquivos ao mesmo tempo.

## Estrutura e documentação

- [x] Organizar `apps/vendas` e `apps/portal` como workspaces npm independentes.
- [x] Inicializar os dois apps com React + TypeScript + Vite.
- [x] Criar `packages/shared` com tipos do banco e utilitários de erros, dinheiro e datas.
- [x] Versionar migrações, testes e configuração do Supabase em `supabase/`.
- [x] Atualizar os documentos para refletir a estrutura implementada e registrar os Figma de [Desktop](https://www.figma.com/design/pv3RvxrhVU6F5TDJcmJq8B/Desktop?node-id=0-1&t=fUDQbVLkXjNGg9xc-1) e [Mobile iCarla](https://www.figma.com/design/TRpC2zJyvla20VRpTKnNKx/Mobile-Icarla?node-id=0-1&t=UoVuBK5LBWQocEJV-1).
- [x] Registrar em [AI_USAGE.md](AI_USAGE.md) as partes produzidas integralmente por IA.

## Aplicativo iCarla — vendas

- [x] Implementar autenticação e controle de sessão para a equipe.
- [x] Implementar a camada de dados de alunos, produtos, estoque, vendas e cancelamento em até 24 horas.
- [x] Implementar os serviços de intervalos, pedidos e confirmação de pagamentos.
- [x] Implementar as telas de vendas, nova venda, fechamento mensal, pedidos, pagamentos, produtos, alunos e intervalos.
- [x] Adicionar filtros, indicadores e ranking de produtos às vendas do mês.
- [x] Adaptar as telas de desktop do Figma para os componentes React e para as regras reais do banco.
- [x] Configurar o rewrite de SPA para a Vercel.
- [ ] Testar todas as telas com a conta da Carla e dados reais.
- [ ] Configurar manifest, ícones e service worker do PWA; documentar e validar o funcionamento online da v1.

## Portal de pais e alunos

- [x] Implementar serviços de cadastro, login e sessão.
- [x] Implementar serviços de alunos, vínculos, saldo, extrato, compras e limite mensal.
- [x] Implementar serviços de cardápio, créditos e pedidos prévios.
- [x] Substituir o scaffold do Vite pelas telas do portal.
- [x] Implementar navegação e estados autenticados para responsável e aluno.
- [x] Implementar cardápio, carrinho, agendamento, histórico de pedidos, créditos, extrato e limites.
- [x] Configurar o rewrite de SPA para a Vercel.
- [ ] Integrar e validar os fluxos do portal com as políticas RLS.

## Supabase e pagamentos

- [x] Definir e aplicar o esquema PostgreSQL, os perfis, os vínculos e as políticas RLS.
- [x] Implementar catálogo com foto, estoque, vendas, extrato, créditos pagos e pedidos prévios.
- [x] Implementar RPCs atômicas para as operações com regra de negócio.
- [x] Validar grants, RLS, limites, estoque e escalada de privilégio em `supabase/tests/rls_smoke.sql`.
- [x] Gerar e centralizar os tipos do banco em `packages/shared/src/database.ts`.
- [ ] Criar a conta da Carla e promovê-la a `equipe` com o procedimento de [DATABASE.md](DATABASE.md).
- [ ] Decidir se o vínculo automático de contas de aluno será ligado; isso exige confirmação de e-mail no Auth.
- [ ] Escolher o provedor Pix e implementar cobrança e webhook por Edge Function.
- [ ] Restringir a confirmação manual de pagamento depois da integração do Pix.

## Integração e entrega

- [ ] Conferir o fluxo completo de venda, cancelamento e fechamento mensal da Carla.
- [ ] Conferir pedido, pagamento, retirada e tratamento de expiração.
- [ ] Conferir login de pais/alunos e isolamento dos dados entre contas.
- [ ] Executar `build` e `lint` dos dois workspaces antes da entrega.
- [ ] Configurar os projetos Vercel, variáveis de ambiente e domínios dos dois apps.
- [ ] Registrar responsáveis e atualizar esta lista conforme as tarefas forem concluídas.
