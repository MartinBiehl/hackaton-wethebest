-- Venda para cliente não registrado e prazo de cancelamento.
--
-- 1. Venda avulsa: a Carla também vende para quem não tem cadastro. Essas
--    vendas ficam com aluno_id nulo, são pagas na hora e por isso não entram
--    no extrato, não usam saldo e não passam por limite mensal nem piso de
--    dívida. Estoque, itens e preço vindo do catálogo seguem iguais.
-- 2. Cancelamento: só é aceito até 24 horas depois da venda.
--
-- As políticas de leitura não mudam: e_titular_do_aluno(null) e
-- e_responsavel_de(null) são sempre falsos, então venda avulsa só é visível
-- para a equipe.

alter table public.vendas alter column aluno_id drop not null;

comment on column public.vendas.aluno_id is
  'Aluno da venda. NULL = cliente não registrado: pago na hora, sem movimento no extrato.';

-- Gasto mensal é por aluno; vendas avulsas não têm aluno.
create or replace view public.gastos_mensais_alunos with (security_invoker = on) as
  select
    v.aluno_id,
    (date_trunc('month', (v.criado_em at time zone 'America/Sao_Paulo')))::date as competencia,
    sum(v.total_centavos)::bigint as total_centavos,
    count(*)::bigint as quantidade_vendas
  from public.vendas v
  where v.status = 'confirmada'
    and v.aluno_id is not null
  group by 1, 2;

-- Prazo de cancelamento em um só lugar, como o piso de dívida.
create or replace function public.prazo_cancelamento()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '24 hours';
$$;

comment on function public.prazo_cancelamento() is 'Tempo máximo, a partir da venda, para a equipe cancelá-la.';

revoke execute on function public.prazo_cancelamento() from public, anon;
grant execute on function public.prazo_cancelamento() to authenticated;

-- ---------------------------------------------------------------------------
-- registrar_venda: p_aluno_id passa a aceitar nulo
--
-- Todos os parâmetros ganham default para que p_aluno_id possa ser omitido
-- pela API; a ordem é mantida, então chamadas posicionais continuam valendo.
-- p_itens nulo é recusado pela validação, como antes.
-- ---------------------------------------------------------------------------

drop function public.registrar_venda(uuid, jsonb, text);

create function public.registrar_venda(
  p_aluno_id uuid default null,
  p_itens jsonb default null,
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

  if p_aluno_id is not null then
    -- Trava o aluno: duas vendas simultâneas para o mesmo aluno passam a ser
    -- avaliadas em sequência, então nenhuma delas valida limite contra um
    -- estado que a outra já mudou.
    select * into v_aluno from public.alunos where id = p_aluno_id for update;

    if not found or not v_aluno.ativo then
      raise exception 'Aluno não encontrado ou inativo.'
        using errcode = 'P0001', detail = 'aluno_invalido';
    end if;
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

  if p_aluno_id is not null then
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

  if p_aluno_id is null then
    return jsonb_build_object(
      'venda_id', v_venda_id,
      'total_centavos', v_total,
      'saldo_centavos', null,
      'gasto_mes_centavos', null,
      'limite_mensal_centavos', null
    );
  end if;

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
  'Registra uma venda de forma atômica: valida papel e aluno, baixa estoque, recalcula preços pelo catálogo, valida limite mensal e piso de dívida, grava venda, itens e movimento. p_aluno_id nulo = cliente não registrado (sem extrato nem limites). p_itens = [{"produto_id": uuid, "quantidade": int}].';

revoke execute on function public.registrar_venda(uuid, jsonb, text) from public, anon;
grant execute on function public.registrar_venda(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- cancelar_venda: prazo de 24 horas e suporte a venda avulsa
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

  if now() > v_venda.criado_em + public.prazo_cancelamento() then
    raise exception 'O prazo para cancelar esta venda já terminou.'
      using errcode = 'P0001', detail = 'prazo_cancelamento_expirado';
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

  -- Venda avulsa foi paga na hora e nunca entrou no extrato: não há estorno.
  if v_venda.aluno_id is null then
    return jsonb_build_object(
      'venda_id', p_venda_id,
      'estornado_centavos', 0,
      'saldo_centavos', null
    );
  end if;

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
  'Cancela uma venda confirmada em até 24 horas, devolve as unidades ao estoque e, se a venda tem aluno, lança o estorno no extrato, tudo na mesma transação.';
