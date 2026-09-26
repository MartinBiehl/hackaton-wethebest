# Tarefas

Dividam o trabalho por funcionalidade e indiquem quem está atuando em cada tarefa. Evitem editar os mesmos arquivos ao mesmo tempo. Responsáveis ainda não definidos; combinar com a equipe antes de implementar.

## Estrutura do monorepo

- [ ] Definir branch de tarefa e migrar o esqueleto para `apps/vendas` e `apps/portal`.
- [ ] Configurar npm workspaces e scripts por app; criar `packages/shared` apenas se houver código compartilhado.

## Aplicativo de vendas — responsável: a definir

- [ ] Implementar lançamento de vendas e consulta das vendas do mês para Carla.
- [ ] Configurar o PWA instalável e documentar que a v1 exige conexão para acessar dados.

## Portal de pais e alunos — responsável: a definir

- [ ] Definir conteúdo das páginas, fluxo de login e vínculo entre responsáveis e alunos.
- [ ] Implementar acesso autenticado às informações autorizadas para cada conta.

## Supabase e publicação — responsável: a definir

- [ ] Definir esquema PostgreSQL, migrações, perfis/vínculos e políticas RLS para cada papel.
- [ ] Validar grants e RLS para impedir que uma conta acesse registros não autorizados.
- [ ] Configurar os dois projetos Vercel Pro e seus domínios/variáveis de ambiente.
- [ ] Usar Edge Functions para ações privilegiadas, caso sejam necessárias; manter chaves secretas fora do cliente e do Git.

## Integração e entrega — responsável: a definir

- [ ] Conferir fluxo completo de venda e consulta mensal da Carla.
- [ ] Conferir login de pais/alunos e isolamento dos dados entre contas.
- [ ] Atualizar esta lista com responsáveis, estado das tarefas e decisões ainda pendentes.
