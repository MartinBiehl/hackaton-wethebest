# Banco de dados

Primeira versão do esquema Supabase: identidade e papéis, catálogo com estoque, vendas e extrato financeiro. As migrações estão em `supabase/migrations/` e já foram aplicadas no projeto `kggurgtwhoofalzptizv`.

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
| `produtos` | Catálogo: nome, descrição, `preco_centavos`, `ativo`. |
| `estoque` | Unidades disponíveis por produto, separado do catálogo. |
| `vendas` | Aluno, operador, data/hora, `total_centavos`, `status` (`confirmada`, `cancelada`) e dados do cancelamento. |
| `venda_itens` | Snapshot de nome e preço unitário no momento da compra, quantidade e subtotal. |
| `movimentos_financeiros` | Extrato append-only: `credito`, `compra`, `pagamento`, `estorno`, `ajuste`. |
| `configuracoes` | Linha única de parâmetros globais (hoje só `vinculo_automatico`). |

### Views

| View | Para quê |
| --- | --- |
| `saldos_alunos` | Saldo atual por aluno (soma do extrato). Negativo = dívida. |
| `gastos_mensais_alunos` | Gasto por aluno e competência mensal; só vendas confirmadas. |
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
| `estoque` | — | SELECT/UPDATE | — | — |
| `vendas` | — | SELECT de todas | SELECT dos alunos vinculados | SELECT das próprias |
| `venda_itens` | — | SELECT de todos | SELECT dos alunos vinculados | SELECT dos próprios |
| `movimentos_financeiros` | — | SELECT de todos | SELECT dos alunos vinculados | SELECT dos próprios |
| `configuracoes` | — | SELECT | — | — |

Nenhum papel tem `UPDATE` ou `DELETE` em `movimentos_financeiros`: correção entra como novo movimento (`ajuste` ou `estorno`). `produtos` não tem `DELETE` para ninguém — use `ativo = false`, para não quebrar a referência do histórico.

## Funções (RPC)

Todas são `SECURITY DEFINER` com `search_path = ''`, validam `auth.uid()` e o papel na primeira linha, recebem só parâmetros tipados e têm `EXECUTE` concedido apenas a `authenticated`. Precisam desse privilégio porque gravam em tabelas sem grant de escrita para o cliente e leem linhas que o chamador não enxerga (saldo, estoque, e-mail de outra conta).

| Função | Quem chama | O que faz |
| --- | --- | --- |
| `registrar_venda(aluno, itens jsonb, observacao)` | equipe | Valida, baixa estoque, recalcula preços pelo catálogo, checa limites, grava venda + itens + movimento. Atômica. |
| `cancelar_venda(venda, motivo)` | equipe | Cancela, devolve ao estoque e lança o estorno. |
| `registrar_pagamento(aluno, valor, descricao)` | equipe | Quitação de dívida paga no balcão. |
| `adicionar_credito(aluno, valor, descricao)` | responsável ativo | Crédito (+) no extrato. |
| `definir_limite_mensal(aluno, limite)` | responsável ativo | Teto mensal; `null` remove o limite. |
| `cadastrar_aluno(nome, email)` | responsável ou equipe | Pré-cadastro. Responsável cria com vínculo ativo; equipe cria sem vínculo. |
| `vincular_conta_aluno(email_responsavel)` | aluno | Casa a conta com o pré-cadastro. |
| `aprovar_conta_aluno(aluno)` | responsável ativo | Confirma a conta que reivindicou o aluno. |
| `aprovar_vinculo_responsavel(aluno, responsavel)` | aluno titular ou responsável ativo | Ativa um vínculo pendente. |
| `revogar_vinculo_responsavel(aluno, responsavel)` | aluno titular ou responsável ativo | Revoga um vínculo. |

Os predicados `papel_atual()`, `e_equipe()`, `e_responsavel_de(aluno)` e `e_titular_do_aluno(aluno)` também são `SECURITY DEFINER`: são chamados de dentro das próprias políticas RLS, onde uma consulta comum causaria recursão (em `perfis`) ou seria bloqueada (nas tabelas de vínculo). Eles nunca aceitam o sujeito como parâmetro — sempre resolvem por `auth.uid()`, então ninguém consegue perguntar "o usuário X é responsável pelo aluno Y?".

Erros de negócio trazem um `detail` estável para o frontend tratar sem depender do texto: `papel_insuficiente`, `aluno_invalido`, `itens_invalidos`, `produto_indisponivel`, `estoque_insuficiente`, `limite_mensal_excedido`, `limite_divida_excedido`, `venda_invalida`, `valor_invalido`.

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

`supabase/tests/rls_smoke.sql` cobre papéis, isolamento entre contas, limites, piso de dívida, estoque concorrente, atomicidade e escalada de privilégio. Roda no SQL Editor e termina em `ROLLBACK` — não deixa dados. Deve imprimir `TODOS OS TESTES PASSARAM`.

Executado em 2026-09-26 contra o projeto: passou, e nenhum registro permaneceu.

## Pendências para a equipe

- **`configuracoes.vinculo_automatico` está `false`**, então toda conta de aluno espera aprovação do responsável. Para ativar o vínculo automático, primeiro ligue *Confirm email* em Authentication → Providers (com a confirmação desligada, o Auth marca todo e-mail como confirmado no cadastro e a verificação perde o sentido), depois rode `update public.configuracoes set vinculo_automatico = true where id = 1;`.
- **Limite mensal por aluno, não por responsável.** Com vários responsáveis, o último a definir prevalece. Se isso incomodar, é decisão de produto.
- **Vazamento residual aceito:** ao pré-cadastrar um e-mail que já pertence a outro aluno, o responsável recebe `aguardando_aprovacao` em vez de `criado`, e assim descobre que aquele e-mail já existe. Não há consulta pública de e-mails, e nenhum dado do aluno é revelado. Fechar isso completamente exigiria um fluxo de convite por e-mail.
- **Encomendas não foram modeladas**: não há reserva de estoque. Uma venda só passa se houver unidades no instante do processamento.
