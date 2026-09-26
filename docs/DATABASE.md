# Banco de dados

Esquema Supabase: identidade e papéis, cardápio com foto e estoque, vendas, extrato financeiro, créditos pagos e pedidos prévios. As migrações estão em `supabase/migrations/` e já foram aplicadas no projeto `kggurgtwhoofalzptizv`.

## Princípios

- **A segurança fica no banco.** Toda tabela exposta pela API tem RLS ativa e políticas explícitas. Esconder algo na interface não é controle de acesso.
- **Grants mínimos.** `anon` não tem acesso a nada. `authenticated` recebe apenas os `SELECT` necessários, mais `INSERT`/`UPDATE` em produtos e estoque (só a equipe passa pela política).
- **Escrita com regra de negócio passa por função.** Vendas, extrato, limites e vínculos não aceitam `INSERT`/`UPDATE` direto do cliente.
- **Dinheiro em centavos** (`bigint`). Nunca ponto flutuante.
- **Uma só fonte de verdade financeira:** o extrato. Saldo e dívida são derivados, nunca armazenados.
- **Competência mensal em `America/Sao_Paulo`.** Limite mensal e relatórios usam mês-calendário nesse fuso, independentemente de onde o servidor está.

## Tabelas

| Tabela | Conteúdo |
| --- | --- |
| `perfis` | 1:1 com `auth.users`. Nome, e-mail e `papel` (`equipe`, `responsavel`, `aluno`). |
| `alunos` | O aluno como **registro**, não como conta: pode existir antes de ter login. Guarda `email_convite`, `user_id` (conta confirmada), `user_id_pendente` (conta aguardando aprovação) e `limite_mensal_centavos`. |
| `responsavel_aluno` | Vínculo N:N com `status` (`pendente`, `ativo`, `revogado`). |
| `produtos` | Catálogo: nome, descrição, `preco_centavos`, `ativo` e `foto_path` (arquivo no bucket `produtos` do Storage). |
| `estoque` | Unidades disponíveis por produto, separado do catálogo. |
| `vendas` | Aluno (nulo para cliente não registrado), operador, data/hora, `total_centavos`, `status` (`confirmada`, `cancelada`), `origem` (`balcao`, `pedido`) e dados do cancelamento. |
| `venda_itens` | Snapshot de nome e preço unitário no momento da compra, quantidade e subtotal. |
| `movimentos_financeiros` | Extrato append-only: `credito`, `compra`, `pagamento`, `estorno`, `ajuste`. Crédito vindo de Pix guarda `pagamento_id` (no máximo um por pagamento). |
| `intervalos_retirada` | Horários de retirada de pedidos prévios (nome, início, fim, `ativo`), cadastrados pela equipe. |
| `pedidos` | Pedido prévio do aluno: intervalo, `data_retirada`, `status`, forma de pagamento (`saldo`, `pix`), total, `corte_em` e a `venda_id` gerada quando é pago. |
| `pedido_itens` | Snapshot de nome e preço no momento do pedido. |
| `pagamentos` | Cobranças Pix de crédito ou de pedido: `status` (`pendente`, `pago`, `expirado`), `expira_em`, quem confirmou e `provedor_id` (para a API de Pix). |
| `configuracoes` | Linha única de parâmetros globais (hoje só `vinculo_automatico`). |

### Views

| View | Para quê |
| --- | --- |
| `saldos_alunos` | Saldo atual por aluno (soma do extrato). Negativo = dívida. |
| `gastos_mensais_alunos` | Gasto por aluno e competência mensal; só vendas confirmadas com aluno. |
| `vendas_mensais` | Fechamento mensal da Carla. |

As três usam `security_invoker = on`: a RLS das tabelas de origem continua valendo dentro delas.

## Matriz de permissões RLS

`—` significa nenhum acesso. Operações não listadas (`DELETE`, e `UPDATE` onde não indicado) não têm grant nem política para nenhum papel: só o `service_role` alcança.

| Tabela | `anon` | Equipe (Carla) | Responsável | Aluno |
| --- | --- | --- | --- | --- |
| `perfis` | — | SELECT do próprio | SELECT do próprio | SELECT do próprio |
| | | UPDATE só da coluna `nome` | idem | idem |
| `alunos` | — | SELECT de todos (precisa pesquisar na venda) | SELECT dos vinculados **ativos** | SELECT de si mesmo (inclusive quando pendente) |
| `responsavel_aluno` | — | — | SELECT dos próprios vínculos | SELECT de quem o acompanha |
| `produtos` | — | SELECT/INSERT/UPDATE | SELECT só dos ativos | SELECT só dos ativos |
| `estoque` | — | SELECT/UPDATE | SELECT dos produtos ativos | SELECT dos produtos ativos |
| `vendas` | — | SELECT de todas | SELECT dos alunos vinculados | SELECT das próprias |
| `venda_itens` | — | SELECT de todos | SELECT dos alunos vinculados | SELECT dos próprios |
| `movimentos_financeiros` | — | SELECT de todos | SELECT dos alunos vinculados | SELECT dos próprios |
| `configuracoes` | — | SELECT | — | — |
| `intervalos_retirada` | — | SELECT/INSERT/UPDATE | SELECT dos ativos | SELECT dos ativos |
| `pedidos`, `pedido_itens` | — | SELECT de todos | SELECT dos alunos vinculados | SELECT dos próprios |
| `pagamentos` | — | SELECT de todos | SELECT dos alunos vinculados | SELECT dos próprios |
| Storage `produtos` | leitura pública pela URL | envia, troca e apaga fotos | — | — |

Nenhum papel tem `UPDATE` ou `DELETE` em `movimentos_financeiros`: correção entra como novo movimento (`ajuste` ou `estorno`). `produtos` não tem `DELETE` para ninguém — use `ativo = false`, para não quebrar a referência do histórico.

## Funções (RPC)

Todas são `SECURITY DEFINER` com `search_path = ''`, validam `auth.uid()` e o papel na primeira linha, recebem só parâmetros tipados e têm `EXECUTE` concedido apenas a `authenticated`. Precisam desse privilégio porque gravam em tabelas sem grant de escrita para o cliente e leem linhas que o chamador não enxerga (saldo, estoque, e-mail de outra conta).

| Função | Quem chama | O que faz |
| --- | --- | --- |
| `registrar_venda(aluno, itens jsonb, observacao)` | equipe | Valida, baixa estoque, recalcula preços pelo catálogo, checa limites, grava venda + itens + movimento. Atômica. Com `aluno` nulo registra venda para cliente não registrado. O núcleo fica em `efetivar_venda`, função interna sem EXECUTE para clientes, usada também pelos pedidos. |
| `cancelar_venda(venda, motivo)` | equipe | Até 24 horas após a venda: cancela, devolve ao estoque e lança o estorno (venda avulsa não tem estorno). Se a venda veio de pedido, o pedido fica `cancelado`. |
| `registrar_pagamento(aluno, valor, descricao)` | equipe | Quitação de dívida paga no balcão. |
| `adicionar_credito(aluno, valor, descricao)` | ninguém (sem EXECUTE para clientes) | Mantida só para uso administrativo: crédito sem pagamento. |
| `solicitar_credito(aluno, valor)` | responsável ativo ou aluno titular | Cria cobrança Pix `pendente` (expira em 30 min). O saldo só muda na confirmação. |
| `criar_pedido(intervalo, data, itens, forma, observacao)` | aluno titular | Pedido prévio para hoje ou amanhã, até 30 min antes do intervalo. `saldo`: exige saldo suficiente e efetiva na hora. `pix`: cria pedido e cobrança pendentes. Sem reserva de estoque. |
| `confirmar_pagamento(pagamento)` | equipe (provisório) | Idempotente. Marca como pago e lança o crédito; se for de pedido, efetiva a venda ou, sem estoque/limite/prazo, recusa ou expira o pedido e mantém o crédito. |
| `finalizar_pedido(pedido, entregue)` | equipe | Pedido pago vira `entregue` ou `nao_retirado` (sem devolução). |
| `expirar_pendentes()` | qualquer conta logada | Marca como expirados os Pix e pedidos vencidos. Chamada antes de listar. |
| `definir_limite_mensal(aluno, limite)` | responsável ativo | Teto mensal; `null` remove o limite. |
| `cadastrar_aluno(nome, email)` | responsável ou equipe | Pré-cadastro. Responsável cria com vínculo ativo; equipe cria sem vínculo. |
| `vincular_conta_aluno(email_responsavel)` | aluno | Casa a conta com o pré-cadastro. |
| `aprovar_conta_aluno(aluno)` | responsável ativo | Confirma a conta que reivindicou o aluno. |
| `aprovar_vinculo_responsavel(aluno, responsavel)` | aluno titular ou responsável ativo | Ativa um vínculo pendente. |
| `revogar_vinculo_responsavel(aluno, responsavel)` | aluno titular ou responsável ativo | Revoga um vínculo. |

Os predicados `papel_atual()`, `e_equipe()`, `e_responsavel_de(aluno)` e `e_titular_do_aluno(aluno)` também são `SECURITY DEFINER`: são chamados de dentro das próprias políticas RLS, onde uma consulta comum causaria recursão (em `perfis`) ou seria bloqueada (nas tabelas de vínculo). Eles nunca aceitam o sujeito como parâmetro — sempre resolvem por `auth.uid()`, então ninguém consegue perguntar "o usuário X é responsável pelo aluno Y?".

Erros de negócio trazem um `detail` estável para o frontend tratar sem depender do texto: `papel_insuficiente`, `aluno_invalido`, `itens_invalidos`, `produto_indisponivel`, `estoque_insuficiente`, `limite_mensal_excedido`, `limite_divida_excedido`, `venda_invalida`, `prazo_cancelamento_expirado`, `valor_invalido`, `saldo_insuficiente`, `pedido_fora_do_prazo`, `intervalo_invalido`, `pagamento_invalido`, `pedido_invalido`.

### Exemplo de chamada

```ts
const { data, error } = await supabase.rpc('registrar_venda', {
  p_aluno_id: alunoId,
  p_itens: [{ produto_id: produtoId, quantidade: 2 }],
})
```

O preço **não** é enviado pelo cliente: a função busca o valor vigente no catálogo e o copia para o item da venda.

## Regras financeiras

- O saldo do aluno é único e pode ser positivo, zero ou negativo. Negativo é a dívida com a Carla.
- Crédito lançado com saldo negativo abate a dívida primeiro; o excedente vira saldo positivo. Isso é consequência de o saldo ser a soma do extrato — não há duas contas para conciliar.
- **Piso de dívida: −R$ 250,00** (`piso_saldo_centavos()`). Venda que ultrapasse é recusada.
- **Limite mensal** é regra independente: soma das vendas confirmadas do mês-calendário, tenham elas usado saldo positivo ou gerado dívida. `NULL` = sem limite.
- Venda cancelada sai do gasto do mês e o estorno volta ao saldo.
- **Cliente não registrado:** venda com `aluno_id` nulo, paga na hora. Baixa estoque e entra em `vendas_mensais`, mas não gera movimento no extrato nem passa por limite mensal ou piso de dívida. Só a equipe a enxerga.
- **Prazo de cancelamento: 24 horas** a partir da venda (`prazo_cancelamento()`). Depois disso a função recusa com `prazo_cancelamento_expirado`.

## Créditos e pedidos prévios

- **Crédito só depois de pago.** Responsável ou aluno geram a cobrança (`solicitar_credito`); o valor entra no extrato quando o pagamento é confirmado. Um mesmo pagamento nunca credita duas vezes.
- **Pedido prévio** é feito só pelo aluno, para hoje ou amanhã (fuso `America/Sao_Paulo`), em um intervalo ativo, até 30 minutos antes do início (`antecedencia_pedido()`).
- **Sem reserva de estoque.** Ao pedir, o banco só confere as unidades do momento. O estoque baixa quando o pedido é pago: na hora, se for com saldo; na confirmação, se for com Pix.
- **Pix pendente expira** em 30 minutos (`validade_pix()`) ou no fechamento do intervalo, o que vier antes.
- **Pedido pago vira venda** (`origem = 'pedido'`): entra no fechamento mensal, no limite mensal e no extrato. Pago com Pix, gera `credito` (+) e `compra` (−), sem alterar o saldo líquido.
- **Pix confirmado sem estoque, acima do limite ou depois do prazo:** o pedido fica `recusado` ou `expirado` e o valor permanece como crédito no saldo do aluno.
- O aluno **não cancela** pedidos, e pedido **não retirado não é devolvido**. A equipe pode cancelar a venda do pedido em até 24 horas, com estorno.

### Integração com Pix (próxima etapa)

Hoje a Carla confirma os pagamentos no app de vendas. A API de Pix entrará por uma Edge Function que cria a cobrança (preenchendo `pagamentos.provedor_id`) e, no webhook, confirma o pagamento com a mesma lógica de `confirmar_pagamento`, usando `service_role` só no servidor. Nesse momento a confirmação manual deve ser restringida.

## Tipos TypeScript

Os tipos do banco ficam em `packages/shared/src/database.ts` e são usados pelos dois apps. Depois de aplicar uma migração, regenere:

```bash
npx supabase gen types typescript --linked > packages/shared/src/database.ts
```

No PowerShell o `>` pode gravar em UTF-16; rode pelo Git Bash.

## Como aplicar as migrações

O repositório está vinculado ao projeto (`supabase link` já feito). Para aplicar o que ainda não foi:

```bash
npx supabase db push
```

Para conferir o que está aplicado:

```bash
npx supabase migration list
```

Não edite uma migração já aplicada — crie outra. Não há banco local (o ambiente da equipe não tem Docker); o desenvolvimento é direto no projeto remoto.

## Provisionar a conta da Carla

O papel `equipe` não é obtido por cadastro: o gatilho de signup só aceita `responsavel` ou `aluno`, e a política de `UPDATE` em `perfis` libera apenas a coluna `nome`. Para promover a conta:

1. No painel, **Authentication → Users → Add user**, com o e-mail da Carla.
2. No **SQL Editor**, rodar:

```sql
update public.perfis set papel = 'equipe' where email = 'email-da-carla@exemplo.com';
```

## Verificação

`supabase/tests/rls_smoke.sql` cobre papéis, isolamento entre contas, limites, piso de dívida, estoque concorrente, atomicidade, escalada de privilégio, venda avulsa, prazo de cancelamento, fotos do cardápio, créditos pagos e pedidos prévios. Roda no SQL Editor e termina em `ROLLBACK` — não deixa dados. Deve imprimir `TODOS OS TESTES PASSARAM`.

Executado em 2026-09-26 contra o projeto: passou, e nenhum registro permaneceu.

## Pendências para a equipe

- **`configuracoes.vinculo_automatico` está `false`**, então toda conta de aluno espera aprovação do responsável. Para ativar o vínculo automático, primeiro ligue *Confirm email* em Authentication → Providers (com a confirmação desligada, o Auth marca todo e-mail como confirmado no cadastro e a verificação perde o sentido), depois rode `update public.configuracoes set vinculo_automatico = true where id = 1;`.
- **Limite mensal por aluno, não por responsável.** Com vários responsáveis, o último a definir prevalece. Se isso incomodar, é decisão de produto.
- **Vazamento residual aceito:** ao pré-cadastrar um e-mail que já pertence a outro aluno, o responsável recebe `aguardando_aprovacao` em vez de `criado`, e assim descobre que aquele e-mail já existe. Não há consulta pública de e-mails, e nenhum dado do aluno é revelado. Fechar isso completamente exigiria um fluxo de convite por e-mail.
- **Confirmação manual de pagamento** vale só até a integração do Pix; a Carla deve confirmar apenas pagamentos que realmente recebeu.
- **Expiração sem agendador:** pendências vencidas são marcadas quando alguém lista ou cria pedidos (`expirar_pendentes`). Se for preciso expirar em horário fixo, ligar `pg_cron`.
