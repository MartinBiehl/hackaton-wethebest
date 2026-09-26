-- Operações de negócio.
--
-- Toda escrita que depende de regra de negócio acontece aqui, e não por
-- INSERT/UPDATE direto do cliente. Cada função é SECURITY DEFINER porque
-- precisa gravar em tabelas sem grant de escrita para authenticated e ler
-- linhas que o chamador não enxerga (saldo do aluno, estoque, e-mail de outra
-- conta). Em compensação, cada uma:
--   * fixa search_path = '' e qualifica todos os objetos;
--   * valida auth.uid() e o papel do chamador logo na primeira linha;
--   * aceita só parâmetros tipados (uuid, bigint, text, jsonb), nunca SQL;
--   * tem EXECUTE revogado de public/anon e concedido apenas a authenticated.
--
-- Cada chamada roda em uma única transação: se qualquer validação falhar,
-- nada do que a função fez é aplicado.
--
-- Os erros trazem um `detail` estável para o frontend tratar sem depender do
-- texto da mensagem: papel_insuficiente, aluno_invalido, itens_invalidos,
-- produto_indisponivel, estoque_insuficiente, limite_mensal_excedido,
-- limite_divida_excedido, venda_invalida, valor_invalido.

-- ---------------------------------------------------------------------------
-- Venda
-- ---------------------------------------------------------------------------

create or replace function public.registrar_venda(
  p_aluno_id uuid,
  p_itens jsonb,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operador uuid := (select auth.uid());
  v_aluno public.alunos%rowtype;
  v_item record;
  v_produto public.produtos%rowtype;
  v_resolvidos jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_subtotal bigint;
  v_saldo bigint;
  v_gasto_mes bigint;
  v_inicio_mes timestamp;
  v_afetadas integer;
  v_venda_id uuid;
begin
  if v_operador is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  if not public.e_equipe() then
    raise exception 'Apenas contas da equipe de vendas podem registrar vendas.'
      using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe ao menos um item na venda.'
      using errcode = '22023', detail = 'itens_invalidos';
  end if;

  -- Trava o aluno: duas vendas simultâneas para o mesmo aluno passam a ser
  -- avaliadas em sequência, então nenhuma delas valida limite contra um estado
  -- que a outra já mudou.
  select * into v_aluno from public.alunos where id = p_aluno_id for update;

  if not found or not v_aluno.ativo then
    raise exception 'Aluno não encontrado ou inativo.'
      using errcode = 'P0001', detail = 'aluno_invalido';
  end if;

  -- Itens agregados por produto (o mesmo produto repetido vira uma linha) e
  -- percorridos em ordem de id, para que vendas concorrentes travem o estoque
  -- sempre na mesma sequência e não gerem deadlock.
  for v_item in
    select
      (i ->> 'produto_id')::uuid as produto_id,
      sum((i ->> 'quantidade')::integer) as quantidade
    from jsonb_array_elements(p_itens) as i
    group by 1
    order by 1
  loop
    if v_item.produto_id is null or v_item.quantidade is null or v_item.quantidade <= 0 then
      raise exception 'Item inválido: informe produto_id e quantidade maior que zero.'
        using errcode = '22023', detail = 'itens_invalidos';
    end if;

    select * into v_produto from public.produtos where id = v_item.produto_id;

    if not found or not v_produto.ativo then
      raise exception 'Produto indisponível para venda.'
        using errcode = 'P0001', detail = 'produto_indisponivel';
    end if;

    -- Verificação e baixa de estoque na mesma instrução: se a linha não foi
    -- atingida, não havia unidades suficientes neste instante.
    update public.estoque
      set quantidade = quantidade - v_item.quantidade
      where produto_id = v_item.produto_id
        and quantidade >= v_item.quantidade;

    get diagnostics v_afetadas = row_count;

    if v_afetadas = 0 then
      raise exception 'Estoque insuficiente para "%".', v_produto.nome
        using errcode = 'P0001', detail = 'estoque_insuficiente';
    end if;

    v_subtotal := v_produto.preco_centavos * v_item.quantidade;
    v_total := v_total + v_subtotal;

    -- O preço vem do banco, nunca do cliente.
    v_resolvidos := v_resolvidos || jsonb_build_object(
      'produto_id', v_item.produto_id,
      'nome_produto', v_produto.nome,
      'preco_unitario_centavos', v_produto.preco_centavos,
      'quantidade', v_item.quantidade,
      'subtotal_centavos', v_subtotal
    );
  end loop;

  if v_total <= 0 then
    raise exception 'O total da venda precisa ser maior que zero.'
      using errcode = '22023', detail = 'itens_invalidos';
  end if;

  -- Limite mensal: mês-calendário no fuso America/Sao_Paulo.
  v_inicio_mes := date_trunc('month', (now() at time zone 'America/Sao_Paulo'));

  select coalesce(sum(v.total_centavos), 0)
    into v_gasto_mes
    from public.vendas v
    where v.aluno_id = p_aluno_id
      and v.status = 'confirmada'
      and (v.criado_em at time zone 'America/Sao_Paulo') >= v_inicio_mes
      and (v.criado_em at time zone 'America/Sao_Paulo') < v_inicio_mes + interval '1 month';

  if v_aluno.limite_mensal_centavos is not null
     and v_gasto_mes + v_total > v_aluno.limite_mensal_centavos then
    raise exception 'Venda recusada: limite mensal de R$ % excedido (já gasto R$ %, venda de R$ %).',
        (v_aluno.limite_mensal_centavos / 100.0)::numeric(12,2),
        (v_gasto_mes / 100.0)::numeric(12,2),
        (v_total / 100.0)::numeric(12,2)
      using errcode = 'P0001', detail = 'limite_mensal_excedido';
  end if;

  -- Piso de dívida: independente do limite mensal.
  select coalesce(sum(m.valor_centavos), 0)
    into v_saldo
    from public.movimentos_financeiros m
    where m.aluno_id = p_aluno_id;

  if v_saldo - v_total < public.piso_saldo_centavos() then
    raise exception 'Venda recusada: o saldo ficaria em R$ %, abaixo do limite de R$ %.',
        ((v_saldo - v_total) / 100.0)::numeric(12,2),
        (public.piso_saldo_centavos() / 100.0)::numeric(12,2)
      using errcode = 'P0001', detail = 'limite_divida_excedido';
  end if;

  insert into public.vendas (aluno_id, operador_id, total_centavos, observacao)
    values (p_aluno_id, v_operador, v_total, nullif(btrim(p_observacao), ''))
    returning id into v_venda_id;

  insert into public.venda_itens (
    venda_id, produto_id, nome_produto, preco_unitario_centavos, quantidade, subtotal_centavos
  )
  select
    v_venda_id,
    (r ->> 'produto_id')::uuid,
    r ->> 'nome_produto',
    (r ->> 'preco_unitario_centavos')::bigint,
    (r ->> 'quantidade')::integer,
    (r ->> 'subtotal_centavos')::bigint
  from jsonb_array_elements(v_resolvidos) as r;

  insert into public.movimentos_financeiros (aluno_id, tipo, valor_centavos, venda_id, criado_por, descricao)
    values (p_aluno_id, 'compra', -v_total, v_venda_id, v_operador, 'Venda registrada');

  return jsonb_build_object(
    'venda_id', v_venda_id,
    'total_centavos', v_total,
    'saldo_centavos', v_saldo - v_total,
    'gasto_mes_centavos', v_gasto_mes + v_total,
    'limite_mensal_centavos', v_aluno.limite_mensal_centavos
  );
end;
$$;

comment on function public.registrar_venda(uuid, jsonb, text) is
  'Registra uma venda de forma atômica: valida papel e aluno, baixa estoque, recalcula preços pelo catálogo, valida limite mensal e piso de dívida, grava venda, itens e movimento. p_itens = [{"produto_id": uuid, "quantidade": int}].';

-- ---------------------------------------------------------------------------
-- Cancelamento com estorno
-- ---------------------------------------------------------------------------

create or replace function public.cancelar_venda(p_venda_id uuid, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operador uuid := (select auth.uid());
  v_venda public.vendas%rowtype;
begin
  if not public.e_equipe() then
    raise exception 'Apenas contas da equipe de vendas podem cancelar vendas.'
      using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  select * into v_venda from public.vendas where id = p_venda_id for update;

  if not found then
    raise exception 'Venda não encontrada.' using errcode = 'P0001', detail = 'venda_invalida';
  end if;

  if v_venda.status <> 'confirmada' then
    raise exception 'Esta venda já está cancelada.' using errcode = 'P0001', detail = 'venda_invalida';
  end if;

  -- Devolve ao estoque apenas o que ainda existe no catálogo.
  update public.estoque e
    set quantidade = e.quantidade + i.quantidade
    from public.venda_itens i
    where i.venda_id = p_venda_id
      and i.produto_id is not null
      and e.produto_id = i.produto_id;

  update public.vendas
    set status = 'cancelada',
        cancelado_em = now(),
        cancelado_por = v_operador,
        motivo_cancelamento = nullif(btrim(p_motivo), '')
    where id = p_venda_id;

  insert into public.movimentos_financeiros (aluno_id, tipo, valor_centavos, venda_id, criado_por, descricao)
    values (v_venda.aluno_id, 'estorno', v_venda.total_centavos, p_venda_id, v_operador, 'Estorno de venda cancelada');

  return jsonb_build_object(
    'venda_id', p_venda_id,
    'estornado_centavos', v_venda.total_centavos,
    'saldo_centavos', (
      select coalesce(sum(m.valor_centavos), 0)
      from public.movimentos_financeiros m
      where m.aluno_id = v_venda.aluno_id
    )
  );
end;
$$;

comment on function public.cancelar_venda(uuid, text) is
  'Cancela uma venda confirmada, devolve as unidades ao estoque e lança o estorno no extrato, tudo na mesma transação.';

-- ---------------------------------------------------------------------------
-- Extrato: crédito (responsável) e pagamento/ajuste (equipe)
-- ---------------------------------------------------------------------------

create or replace function public.adicionar_credito(
  p_aluno_id uuid,
  p_valor_centavos bigint,
  p_descricao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := (select auth.uid());
  v_saldo bigint;
begin
  if not public.e_responsavel_de(p_aluno_id) then
    raise exception 'Apenas um responsável ativo pelo aluno pode adicionar crédito.'
      using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  if p_valor_centavos is null or p_valor_centavos <= 0 then
    raise exception 'O valor do crédito precisa ser maior que zero.'
      using errcode = '22023', detail = 'valor_invalido';
  end if;

  -- Crédito lançado com saldo negativo abate a dívida primeiro; o que sobrar
  -- vira saldo positivo. Isso é consequência direta de o saldo ser a soma do
  -- extrato, sem contas separadas de "crédito" e "dívida".
  insert into public.movimentos_financeiros (aluno_id, tipo, valor_centavos, criado_por, descricao)
    values (p_aluno_id, 'credito', p_valor_centavos, v_autor, nullif(btrim(p_descricao), ''));

  select coalesce(sum(m.valor_centavos), 0) into v_saldo
    from public.movimentos_financeiros m where m.aluno_id = p_aluno_id;

  return jsonb_build_object('aluno_id', p_aluno_id, 'saldo_centavos', v_saldo);
end;
$$;

create or replace function public.registrar_pagamento(
  p_aluno_id uuid,
  p_valor_centavos bigint,
  p_descricao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := (select auth.uid());
  v_saldo bigint;
begin
  if not public.e_equipe() then
    raise exception 'Apenas contas da equipe de vendas podem registrar pagamentos.'
      using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  if p_valor_centavos is null or p_valor_centavos <= 0 then
    raise exception 'O valor do pagamento precisa ser maior que zero.'
      using errcode = '22023', detail = 'valor_invalido';
  end if;

  if not exists (select 1 from public.alunos a where a.id = p_aluno_id) then
    raise exception 'Aluno não encontrado.' using errcode = 'P0001', detail = 'aluno_invalido';
  end if;

  insert into public.movimentos_financeiros (aluno_id, tipo, valor_centavos, criado_por, descricao)
    values (p_aluno_id, 'pagamento', p_valor_centavos, v_autor, nullif(btrim(p_descricao), ''));

  select coalesce(sum(m.valor_centavos), 0) into v_saldo
    from public.movimentos_financeiros m where m.aluno_id = p_aluno_id;

  return jsonb_build_object('aluno_id', p_aluno_id, 'saldo_centavos', v_saldo);
end;
$$;

comment on function public.registrar_pagamento(uuid, bigint, text) is
  'Quitação de dívida paga no balcão. Lançada pela equipe; entra no extrato como pagamento (+).';

-- ---------------------------------------------------------------------------
-- Limite mensal
-- ---------------------------------------------------------------------------

create or replace function public.definir_limite_mensal(
  p_aluno_id uuid,
  p_limite_centavos bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_responsavel_de(p_aluno_id) then
    raise exception 'Apenas um responsável ativo pelo aluno pode definir o limite mensal.'
      using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  if p_limite_centavos is not null and p_limite_centavos < 0 then
    raise exception 'O limite mensal não pode ser negativo.'
      using errcode = '22023', detail = 'valor_invalido';
  end if;

  update public.alunos set limite_mensal_centavos = p_limite_centavos where id = p_aluno_id;

  return jsonb_build_object('aluno_id', p_aluno_id, 'limite_mensal_centavos', p_limite_centavos);
end;
$$;

comment on function public.definir_limite_mensal(uuid, bigint) is
  'Define o teto mensal do aluno. NULL remove o limite; o piso de dívida continua valendo.';

-- ---------------------------------------------------------------------------
-- Cadastro de aluno e vínculo de conta
-- ---------------------------------------------------------------------------

create or replace function public.cadastrar_aluno(
  p_nome text,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := (select auth.uid());
  v_papel public.papel_usuario := public.papel_atual();
  v_email text := nullif(lower(btrim(p_email)), '');
  v_aluno_id uuid;
begin
  if v_papel is null or v_papel = 'aluno' then
    raise exception 'Apenas responsáveis ou a equipe de vendas podem cadastrar alunos.'
      using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'Informe o nome do aluno.' using errcode = '22023', detail = 'valor_invalido';
  end if;

  if v_email is not null then
    select a.id into v_aluno_id
      from public.alunos a
      where lower(a.email_convite) = v_email;
  end if;

  if v_aluno_id is null then
    insert into public.alunos (nome, email_convite, criado_por)
      values (btrim(p_nome), v_email, v_autor)
      returning id into v_aluno_id;

    if v_papel = 'responsavel' then
      insert into public.responsavel_aluno (responsavel_id, aluno_id, status)
        values (v_autor, v_aluno_id, 'ativo');
    end if;

    return jsonb_build_object('status', 'criado', 'aluno_id', v_aluno_id);
  end if;

  -- Já existe um aluno com este e-mail. Não confirmamos nem negamos: o vínculo
  -- entra como pendente e só passa a valer depois de aprovado por quem já tem
  -- acesso (o próprio aluno ou um responsável ativo). Isso impede que alguém
  -- ganhe acesso ao financeiro de um aluno apenas adivinhando o e-mail.
  if v_papel = 'responsavel' then
    insert into public.responsavel_aluno (responsavel_id, aluno_id, status)
      values (v_autor, v_aluno_id, 'pendente')
      on conflict (responsavel_id, aluno_id) do nothing;
  end if;

  return jsonb_build_object('status', 'aguardando_aprovacao');
end;
$$;

comment on function public.cadastrar_aluno(text, text) is
  'Pré-cadastro do aluno pelo responsável (vínculo ativo) ou cadastro operacional pela equipe (sem vínculo). Se o e-mail já pertence a um aluno existente, o vínculo fica pendente de aprovação e a função não revela a existência do cadastro.';

create or replace function public.vincular_conta_aluno(p_email_responsavel text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_email_confirmado boolean;
  v_email_responsavel text := nullif(lower(btrim(p_email_responsavel)), '');
  v_automatico boolean;
  v_aluno_id uuid;
  v_nome text;
begin
  if v_uid is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  select lower(u.email), u.email_confirmed_at is not null
    into v_email, v_email_confirmado
    from auth.users u where u.id = v_uid;

  if exists (select 1 from public.alunos a where a.user_id = v_uid) then
    return jsonb_build_object('status', 'ja_vinculado');
  end if;

  if exists (select 1 from public.alunos a where a.user_id_pendente = v_uid) then
    return jsonb_build_object('status', 'aguardando_aprovacao');
  end if;

  select coalesce(c.vinculo_automatico, false) into v_automatico
    from public.configuracoes c where c.id = 1;

  -- Só é candidato o registro pré-cadastrado com ESTE e-mail de aluno e um
  -- responsável ATIVO cujo e-mail seja exatamente o informado. Os dois lados
  -- precisam bater; o e-mail sozinho nunca autoriza nada.
  if v_email_responsavel is not null then
    select a.id into v_aluno_id
      from public.alunos a
      join public.responsavel_aluno ra on ra.aluno_id = a.id and ra.status = 'ativo'
      join public.perfis p on p.id = ra.responsavel_id
      where lower(a.email_convite) = v_email
        and lower(p.email) = v_email_responsavel
        and a.user_id is null
        and a.user_id_pendente is null
      limit 1;
  end if;

  if v_aluno_id is not null then
    if v_automatico and v_email_confirmado then
      update public.alunos set user_id = v_uid, user_id_pendente = null where id = v_aluno_id;
      return jsonb_build_object('status', 'vinculado', 'aluno_id', v_aluno_id);
    end if;

    update public.alunos set user_id_pendente = v_uid where id = v_aluno_id;
    return jsonb_build_object('status', 'aguardando_aprovacao');
  end if;

  -- Sem pré-cadastro correspondente: a conta segue como aluno independente.
  select coalesce(nullif(btrim(p.nome), ''), split_part(v_email, '@', 1))
    into v_nome
    from public.perfis p where p.id = v_uid;

  begin
    insert into public.alunos (nome, email_convite, user_id, criado_por)
      values (coalesce(v_nome, split_part(v_email, '@', 1)), v_email, v_uid, v_uid)
      returning id into v_aluno_id;
  exception when unique_violation then
    -- O e-mail já está reservado por um registro de aluno que não casou com o
    -- responsável informado. Mesma resposta genérica, sem revelar o motivo.
    return jsonb_build_object('status', 'aguardando_aprovacao');
  end;

  return jsonb_build_object('status', 'conta_independente', 'aluno_id', v_aluno_id);
end;
$$;

comment on function public.vincular_conta_aluno(text) is
  'Chamada pelo aluno após o cadastro. Casa o e-mail dele com o pré-cadastro feito pelo responsável e ativa o vínculo (automaticamente se configuracoes.vinculo_automatico estiver ligado e o e-mail confirmado; caso contrário aguarda aprovação). Sem correspondência, cria conta independente. Nunca informa se um e-mail existe.';

create or replace function public.aprovar_conta_aluno(p_aluno_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pendente uuid;
begin
  if not public.e_responsavel_de(p_aluno_id) then
    raise exception 'Apenas um responsável ativo pelo aluno pode aprovar esta conta.'
      using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  select a.user_id_pendente into v_pendente
    from public.alunos a where a.id = p_aluno_id and a.user_id is null
    for update;

  if v_pendente is null then
    raise exception 'Não há conta aguardando aprovação para este aluno.'
      using errcode = 'P0001', detail = 'aluno_invalido';
  end if;

  update public.alunos
    set user_id = v_pendente, user_id_pendente = null
    where id = p_aluno_id;

  return jsonb_build_object('status', 'vinculado', 'aluno_id', p_aluno_id);
end;
$$;

create or replace function public.aprovar_vinculo_responsavel(
  p_aluno_id uuid,
  p_responsavel_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Quem já tem acesso legítimo aprova: o próprio aluno ou outro responsável ativo.
  if not (public.e_titular_do_aluno(p_aluno_id) or public.e_responsavel_de(p_aluno_id)) then
    raise exception 'Sem permissão para aprovar vínculos deste aluno.'
      using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  update public.responsavel_aluno
    set status = 'ativo'
    where aluno_id = p_aluno_id
      and responsavel_id = p_responsavel_id
      and status = 'pendente';

  if not found then
    raise exception 'Não há vínculo pendente para este responsável.'
      using errcode = 'P0001', detail = 'aluno_invalido';
  end if;

  return jsonb_build_object('status', 'ativo', 'aluno_id', p_aluno_id, 'responsavel_id', p_responsavel_id);
end;
$$;

create or replace function public.revogar_vinculo_responsavel(
  p_aluno_id uuid,
  p_responsavel_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.e_titular_do_aluno(p_aluno_id) or public.e_responsavel_de(p_aluno_id)) then
    raise exception 'Sem permissão para alterar vínculos deste aluno.'
      using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  update public.responsavel_aluno
    set status = 'revogado'
    where aluno_id = p_aluno_id
      and responsavel_id = p_responsavel_id
      and status <> 'revogado';

  if not found then
    raise exception 'Vínculo não encontrado.' using errcode = 'P0001', detail = 'aluno_invalido';
  end if;

  return jsonb_build_object('status', 'revogado', 'aluno_id', p_aluno_id, 'responsavel_id', p_responsavel_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants de execução
-- ---------------------------------------------------------------------------

revoke execute on function public.registrar_venda(uuid, jsonb, text) from public, anon;
revoke execute on function public.cancelar_venda(uuid, text) from public, anon;
revoke execute on function public.adicionar_credito(uuid, bigint, text) from public, anon;
revoke execute on function public.registrar_pagamento(uuid, bigint, text) from public, anon;
revoke execute on function public.definir_limite_mensal(uuid, bigint) from public, anon;
revoke execute on function public.cadastrar_aluno(text, text) from public, anon;
revoke execute on function public.vincular_conta_aluno(text) from public, anon;
revoke execute on function public.aprovar_conta_aluno(uuid) from public, anon;
revoke execute on function public.aprovar_vinculo_responsavel(uuid, uuid) from public, anon;
revoke execute on function public.revogar_vinculo_responsavel(uuid, uuid) from public, anon;

grant execute on function public.registrar_venda(uuid, jsonb, text) to authenticated;
grant execute on function public.cancelar_venda(uuid, text) to authenticated;
grant execute on function public.adicionar_credito(uuid, bigint, text) to authenticated;
grant execute on function public.registrar_pagamento(uuid, bigint, text) to authenticated;
grant execute on function public.definir_limite_mensal(uuid, bigint) to authenticated;
grant execute on function public.cadastrar_aluno(text, text) to authenticated;
grant execute on function public.vincular_conta_aluno(text) to authenticated;
grant execute on function public.aprovar_conta_aluno(uuid) to authenticated;
grant execute on function public.aprovar_vinculo_responsavel(uuid, uuid) to authenticated;
grant execute on function public.revogar_vinculo_responsavel(uuid, uuid) to authenticated;
