-- Créditos pagos e pedidos prévios.
--
-- Créditos: deixam de ser lançados livremente pelo responsável. Responsável
-- ou aluno solicitam um pagamento (Pix); o crédito só entra no extrato quando
-- o pagamento é confirmado. Até a API de Pix ser integrada, quem confirma é a
-- equipe; depois, uma Edge Function com service_role chamará a mesma lógica.
--
-- Pedidos prévios: o aluno encomenda para hoje ou amanhã, em um intervalo de
-- retirada cadastrado pela equipe, até 30 minutos antes do início. Não há
-- reserva de estoque: na criação só se confere se há unidades; a baixa
-- acontece quando o pedido é pago. Pedido pago vira uma venda (origem
-- 'pedido'), então entra no fechamento mensal, no limite mensal e no extrato.
--   * Pago com saldo: exige saldo suficiente e efetiva na hora.
--   * Pago com Pix: fica aguardando pagamento por até 30 minutos (ou até o
--     fechamento do intervalo). Na confirmação, o valor entra como crédito e
--     a venda é efetivada; se não houver mais estoque, se o limite estourar ou
--     se o prazo passou, o pedido é recusado/expirado e o valor fica como
--     crédito no saldo do aluno.
-- O aluno não cancela pedidos, e pedido não retirado não é devolvido.

-- ---------------------------------------------------------------------------
-- Prazos
-- ---------------------------------------------------------------------------

create or replace function public.antecedencia_pedido()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '30 minutes';
$$;

comment on function public.antecedencia_pedido() is 'Pedidos para um intervalo fecham este tempo antes do início dele.';

create or replace function public.validade_pix()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '30 minutes';
$$;

comment on function public.validade_pix() is 'Tempo para pagar um Pix pendente antes de ele expirar.';

revoke execute on function public.antecedencia_pedido() from public, anon;
revoke execute on function public.validade_pix() from public, anon;
grant execute on function public.antecedencia_pedido() to authenticated;
grant execute on function public.validade_pix() to authenticated;

-- ---------------------------------------------------------------------------
-- Intervalos de retirada
-- ---------------------------------------------------------------------------

create table public.intervalos_retirada (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> '' and length(nome) <= 60),
  inicio time not null,
  fim time not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint intervalos_horario_coerente check (fim > inicio)
);

comment on table public.intervalos_retirada is
  'Horários em que o aluno retira pedidos prévios (ex.: recreio da manhã). Horas no fuso America/Sao_Paulo.';

create trigger intervalos_retirada_atualizado_em
  before update on public.intervalos_retirada
  for each row execute function public.set_atualizado_em();

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------

create type public.status_pedido as enum (
  'aguardando_pagamento', 'pago', 'entregue', 'nao_retirado', 'expirado', 'recusado', 'cancelado'
);
create type public.forma_pagamento_pedido as enum ('saldo', 'pix');

comment on type public.status_pedido is
  'aguardando_pagamento = Pix pendente; pago = venda efetivada, aguardando retirada; entregue / nao_retirado = fechado pela equipe; expirado = Pix não pago no prazo; recusado = pago mas sem estoque ou limite; cancelado = venda cancelada pela equipe.';

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id) on delete restrict,
  intervalo_id uuid not null references public.intervalos_retirada (id) on delete restrict,
  data_retirada date not null,
  status public.status_pedido not null default 'aguardando_pagamento',
  forma_pagamento public.forma_pagamento_pedido not null,
  total_centavos bigint not null check (total_centavos > 0),
  observacao text check (observacao is null or length(observacao) <= 300),
  corte_em timestamptz not null,
  venda_id uuid unique references public.vendas (id) on delete restrict,
  motivo text check (motivo is null or length(motivo) <= 300),
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  pago_em timestamptz,
  finalizado_em timestamptz,
  constraint pedidos_venda_coerente check (
    (status in ('pago', 'entregue', 'nao_retirado', 'cancelado')) = (venda_id is not null)
  )
);

create index pedidos_retirada_idx on public.pedidos (data_retirada, intervalo_id, status);
create index pedidos_aluno_idx on public.pedidos (aluno_id, criado_em desc);

comment on column public.pedidos.corte_em is 'Instante em que o intervalo deixa de aceitar pedidos (início - antecedencia_pedido()).';

create table public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  produto_id uuid references public.produtos (id) on delete set null,
  nome_produto text not null,
  preco_unitario_centavos bigint not null check (preco_unitario_centavos >= 0),
  quantidade integer not null check (quantidade > 0),
  subtotal_centavos bigint not null check (subtotal_centavos >= 0),
  constraint pedido_itens_subtotal_coerente check (subtotal_centavos = preco_unitario_centavos * quantidade)
);

create index pedido_itens_pedido_idx on public.pedido_itens (pedido_id);

-- ---------------------------------------------------------------------------
-- Pagamentos
-- ---------------------------------------------------------------------------

create type public.tipo_pagamento as enum ('credito', 'pedido');
create type public.status_pagamento as enum ('pendente', 'pago', 'expirado');

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_pagamento not null,
  aluno_id uuid not null references public.alunos (id) on delete restrict,
  valor_centavos bigint not null check (valor_centavos > 0),
  status public.status_pagamento not null default 'pendente',
  pedido_id uuid unique references public.pedidos (id) on delete restrict,
  solicitado_por uuid references auth.users (id) on delete set null,
  expira_em timestamptz not null,
  pago_em timestamptz,
  confirmado_por uuid references auth.users (id) on delete set null,
  provedor_id text unique check (provedor_id is null or length(provedor_id) <= 100),
  criado_em timestamptz not null default now(),
  constraint pagamentos_pedido_coerente check ((tipo = 'pedido') = (pedido_id is not null)),
  constraint pagamentos_pago_coerente check ((status = 'pago') = (pago_em is not null))
);

create index pagamentos_status_idx on public.pagamentos (status, criado_em desc);
create index pagamentos_aluno_idx on public.pagamentos (aluno_id, criado_em desc);

comment on table public.pagamentos is
  'Cobranças Pix. O dinheiro só entra no extrato quando o pagamento é confirmado. provedor_id guardará o identificador da cobrança na API de Pix.';

-- ---------------------------------------------------------------------------
-- Colunas novas em vendas e no extrato
-- ---------------------------------------------------------------------------

alter table public.vendas
  add column origem text not null default 'balcao' check (origem in ('balcao', 'pedido'));

comment on column public.vendas.origem is 'balcao = lançada pela equipe; pedido = pedido prévio pago pelo aluno.';

alter table public.movimentos_financeiros
  add column pagamento_id uuid references public.pagamentos (id) on delete restrict;

-- Um pagamento gera no máximo um crédito: confirmar duas vezes não duplica.
create unique index movimentos_credito_por_pagamento
  on public.movimentos_financeiros (pagamento_id)
  where pagamento_id is not null;

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------

alter table public.intervalos_retirada enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.pagamentos enable row level security;

revoke all on table public.intervalos_retirada from anon, authenticated;
revoke all on table public.pedidos from anon, authenticated;
revoke all on table public.pedido_itens from anon, authenticated;
revoke all on table public.pagamentos from anon, authenticated;

-- intervalos: a equipe administra direto (sem regra além das constraints).
grant select, insert, update on table public.intervalos_retirada to authenticated;

create policy "intervalos_select"
  on public.intervalos_retirada for select to authenticated
  using (ativo or public.e_equipe());

create policy "intervalos_insert_equipe"
  on public.intervalos_retirada for insert to authenticated
  with check (public.e_equipe());

create policy "intervalos_update_equipe"
  on public.intervalos_retirada for update to authenticated
  using (public.e_equipe())
  with check (public.e_equipe());

-- pedidos e pagamentos: somente leitura; toda escrita passa pelas funções.
grant select on table public.pedidos to authenticated;
grant select on table public.pedido_itens to authenticated;
grant select on table public.pagamentos to authenticated;

create policy "pedidos_select_autorizados"
  on public.pedidos for select to authenticated
  using (
    public.e_equipe()
    or public.e_titular_do_aluno(aluno_id)
    or public.e_responsavel_de(aluno_id)
  );

create policy "pedido_itens_select_autorizados"
  on public.pedido_itens for select to authenticated
  using (
    exists (
      select 1
      from public.pedidos p
      where p.id = pedido_itens.pedido_id
        and (
          public.e_equipe()
          or public.e_titular_do_aluno(p.aluno_id)
          or public.e_responsavel_de(p.aluno_id)
        )
    )
  );

create policy "pagamentos_select_autorizados"
  on public.pagamentos for select to authenticated
  using (
    public.e_equipe()
    or public.e_titular_do_aluno(aluno_id)
    or public.e_responsavel_de(aluno_id)
  );

-- ---------------------------------------------------------------------------
-- Efetivação de venda (interna)
--
-- Núcleo que era de registrar_venda: baixa estoque, recalcula preços pelo
-- catálogo, valida limite mensal e piso de dívida e grava venda, itens e
-- movimento. Não tem EXECUTE para nenhum cliente: só é chamada por outras
-- funções que já validaram quem está agindo.
-- ---------------------------------------------------------------------------

create or replace function public.efetivar_venda(
  p_aluno_id uuid,
  p_itens jsonb,
  p_observacao text,
  p_operador uuid,
  p_origem text,
  p_exigir_saldo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
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

  -- Itens agregados por produto e percorridos em ordem de id, para que vendas
  -- concorrentes travem o estoque sempre na mesma sequência (sem deadlock).
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

    -- Verificação e baixa de estoque na mesma instrução.
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

    select coalesce(sum(m.valor_centavos), 0)
      into v_saldo
      from public.movimentos_financeiros m
      where m.aluno_id = p_aluno_id;

    -- Pedido pago com saldo não pode gerar dívida.
    if p_exigir_saldo and v_saldo < v_total then
      raise exception 'Saldo insuficiente: disponível R$ %, total R$ %.',
          (v_saldo / 100.0)::numeric(12,2),
          (v_total / 100.0)::numeric(12,2)
        using errcode = 'P0001', detail = 'saldo_insuficiente';
    end if;

    -- Piso de dívida: independente do limite mensal.
    if v_saldo - v_total < public.piso_saldo_centavos() then
      raise exception 'Venda recusada: o saldo ficaria em R$ %, abaixo do limite de R$ %.',
          ((v_saldo - v_total) / 100.0)::numeric(12,2),
          (public.piso_saldo_centavos() / 100.0)::numeric(12,2)
        using errcode = 'P0001', detail = 'limite_divida_excedido';
    end if;
  end if;

  insert into public.vendas (aluno_id, operador_id, total_centavos, observacao, origem)
    values (p_aluno_id, p_operador, v_total, nullif(btrim(p_observacao), ''), p_origem)
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
    values (
      p_aluno_id, 'compra', -v_total, v_venda_id, p_operador,
      case when p_origem = 'pedido' then 'Pedido prévio' else 'Venda registrada' end
    );

  return jsonb_build_object(
    'venda_id', v_venda_id,
    'total_centavos', v_total,
    'saldo_centavos', v_saldo - v_total,
    'gasto_mes_centavos', v_gasto_mes + v_total,
    'limite_mensal_centavos', v_aluno.limite_mensal_centavos
  );
end;
$$;

comment on function public.efetivar_venda(uuid, jsonb, text, uuid, text, boolean) is
  'Uso interno. Núcleo atômico de venda compartilhado por registrar_venda e pelos pedidos prévios. Sem EXECUTE para clientes.';

revoke execute on function public.efetivar_venda(uuid, jsonb, text, uuid, text, boolean) from public, anon, authenticated;

-- registrar_venda mantém assinatura e comportamento; só delega o núcleo.
create or replace function public.registrar_venda(
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
begin
  if v_operador is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  if not public.e_equipe() then
    raise exception 'Apenas contas da equipe de vendas podem registrar vendas.'
      using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  return public.efetivar_venda(p_aluno_id, p_itens, p_observacao, v_operador, 'balcao', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Expiração de pendências
--
-- Não há agendador: quem lista ou cria pedidos chama esta função antes, e ela
-- marca como expirado o que já passou do prazo. É idempotente e só avança
-- estados vencidos, então pode ser chamada por qualquer usuário logado.
-- ---------------------------------------------------------------------------

create or replace function public.expirar_pendentes()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pagamentos
    set status = 'expirado'
    where status = 'pendente' and expira_em < now();

  update public.pedidos p
    set status = 'expirado',
        finalizado_em = now(),
        motivo = 'Pagamento não confirmado no prazo.'
    where p.status = 'aguardando_pagamento'
      and exists (
        select 1 from public.pagamentos g
        where g.pedido_id = p.id and g.status = 'expirado'
      );
end;
$$;

-- ---------------------------------------------------------------------------
-- Créditos
-- ---------------------------------------------------------------------------

create or replace function public.solicitar_credito(p_aluno_id uuid, p_valor_centavos bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := (select auth.uid());
  v_pagamento_id uuid;
  v_expira timestamptz := now() + public.validade_pix();
begin
  if not (public.e_responsavel_de(p_aluno_id) or public.e_titular_do_aluno(p_aluno_id)) then
    raise exception 'Apenas o aluno ou um responsável ativo pode comprar créditos para ele.'
      using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  if p_valor_centavos is null or p_valor_centavos <= 0 then
    raise exception 'O valor do crédito precisa ser maior que zero.'
      using errcode = '22023', detail = 'valor_invalido';
  end if;

  insert into public.pagamentos (tipo, aluno_id, valor_centavos, solicitado_por, expira_em)
    values ('credito', p_aluno_id, p_valor_centavos, v_autor, v_expira)
    returning id into v_pagamento_id;

  return jsonb_build_object(
    'pagamento_id', v_pagamento_id,
    'valor_centavos', p_valor_centavos,
    'expira_em', v_expira
  );
end;
$$;

comment on function public.solicitar_credito(uuid, bigint) is
  'Cria a cobrança de um crédito. O saldo só muda quando o pagamento for confirmado.';

-- ---------------------------------------------------------------------------
-- Pedido prévio
-- ---------------------------------------------------------------------------

create or replace function public.criar_pedido(
  p_intervalo_id uuid,
  p_data_retirada date,
  p_itens jsonb,
  p_forma public.forma_pagamento_pedido default 'saldo',
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := (select auth.uid());
  v_aluno public.alunos%rowtype;
  v_intervalo public.intervalos_retirada%rowtype;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_corte timestamptz;
  v_item record;
  v_produto public.produtos%rowtype;
  v_disponivel integer;
  v_resolvidos jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_subtotal bigint;
  v_gasto_mes bigint;
  v_inicio_mes timestamp;
  v_pedido_id uuid;
  v_pagamento_id uuid;
  v_expira timestamptz;
  v_venda jsonb;
begin
  if v_autor is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  perform public.expirar_pendentes();

  -- O aluno é sempre o dono da conta: não é aceito como parâmetro.
  select * into v_aluno from public.alunos where user_id = v_autor and ativo;

  if not found then
    raise exception 'Apenas alunos com conta aprovada podem fazer pedidos.'
      using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  if p_forma is null then
    raise exception 'Informe a forma de pagamento.' using errcode = '22023', detail = 'valor_invalido';
  end if;

  select * into v_intervalo from public.intervalos_retirada where id = p_intervalo_id;

  if not found or not v_intervalo.ativo then
    raise exception 'Intervalo de retirada inválido.'
      using errcode = 'P0001', detail = 'intervalo_invalido';
  end if;

  if p_data_retirada is null or p_data_retirada < v_hoje or p_data_retirada > v_hoje + 1 then
    raise exception 'Pedidos só podem ser feitos para hoje ou amanhã.'
      using errcode = 'P0001', detail = 'pedido_fora_do_prazo';
  end if;

  v_corte := ((p_data_retirada + v_intervalo.inicio) at time zone 'America/Sao_Paulo')
             - public.antecedencia_pedido();

  if now() >= v_corte then
    raise exception 'Os pedidos para este intervalo já fecharam.'
      using errcode = 'P0001', detail = 'pedido_fora_do_prazo';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe ao menos um item no pedido.'
      using errcode = '22023', detail = 'itens_invalidos';
  end if;

  -- Sem reserva: só confere se há unidades agora.
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
      raise exception 'Produto indisponível.'
        using errcode = 'P0001', detail = 'produto_indisponivel';
    end if;

    select e.quantidade into v_disponivel from public.estoque e where e.produto_id = v_item.produto_id;

    if coalesce(v_disponivel, 0) < v_item.quantidade then
      raise exception 'Estoque insuficiente para "%".', v_produto.nome
        using errcode = 'P0001', detail = 'estoque_insuficiente';
    end if;

    v_subtotal := v_produto.preco_centavos * v_item.quantidade;
    v_total := v_total + v_subtotal;

    v_resolvidos := v_resolvidos || jsonb_build_object(
      'produto_id', v_item.produto_id,
      'nome_produto', v_produto.nome,
      'preco_unitario_centavos', v_produto.preco_centavos,
      'quantidade', v_item.quantidade,
      'subtotal_centavos', v_subtotal
    );
  end loop;

  if v_total <= 0 then
    raise exception 'O total do pedido precisa ser maior que zero.'
      using errcode = '22023', detail = 'itens_invalidos';
  end if;

  -- Aviso antecipado do limite mensal; a efetivação confere de novo.
  if v_aluno.limite_mensal_centavos is not null then
    v_inicio_mes := date_trunc('month', (now() at time zone 'America/Sao_Paulo'));

    select coalesce(sum(v.total_centavos), 0)
      into v_gasto_mes
      from public.vendas v
      where v.aluno_id = v_aluno.id
        and v.status = 'confirmada'
        and (v.criado_em at time zone 'America/Sao_Paulo') >= v_inicio_mes
        and (v.criado_em at time zone 'America/Sao_Paulo') < v_inicio_mes + interval '1 month';

    if v_gasto_mes + v_total > v_aluno.limite_mensal_centavos then
      raise exception 'Pedido recusado: limite mensal de R$ % excedido.',
          (v_aluno.limite_mensal_centavos / 100.0)::numeric(12,2)
        using errcode = 'P0001', detail = 'limite_mensal_excedido';
    end if;
  end if;

  insert into public.pedidos (
    aluno_id, intervalo_id, data_retirada, forma_pagamento, total_centavos, observacao, corte_em, criado_por
  )
  values (
    v_aluno.id, v_intervalo.id, p_data_retirada, p_forma, v_total, nullif(btrim(p_observacao), ''), v_corte, v_autor
  )
  returning id into v_pedido_id;

  insert into public.pedido_itens (
    pedido_id, produto_id, nome_produto, preco_unitario_centavos, quantidade, subtotal_centavos
  )
  select
    v_pedido_id,
    (r ->> 'produto_id')::uuid,
    r ->> 'nome_produto',
    (r ->> 'preco_unitario_centavos')::bigint,
    (r ->> 'quantidade')::integer,
    (r ->> 'subtotal_centavos')::bigint
  from jsonb_array_elements(v_resolvidos) as r;

  if p_forma = 'saldo' then
    -- Qualquer recusa aqui (estoque, saldo, limite) desfaz o pedido inteiro.
    v_venda := public.efetivar_venda(v_aluno.id, p_itens, p_observacao, null, 'pedido', true);

    update public.pedidos
      set status = 'pago', venda_id = (v_venda ->> 'venda_id')::uuid, pago_em = now()
      where id = v_pedido_id;

    return jsonb_build_object(
      'pedido_id', v_pedido_id,
      'status', 'pago',
      'total_centavos', v_total,
      'saldo_centavos', (v_venda ->> 'saldo_centavos')::bigint
    );
  end if;

  v_expira := least(now() + public.validade_pix(), v_corte);

  insert into public.pagamentos (tipo, aluno_id, valor_centavos, pedido_id, solicitado_por, expira_em)
    values ('pedido', v_aluno.id, v_total, v_pedido_id, v_autor, v_expira)
    returning id into v_pagamento_id;

  return jsonb_build_object(
    'pedido_id', v_pedido_id,
    'pagamento_id', v_pagamento_id,
    'status', 'aguardando_pagamento',
    'total_centavos', v_total,
    'expira_em', v_expira
  );
end;
$$;

comment on function public.criar_pedido(uuid, date, jsonb, public.forma_pagamento_pedido, text) is
  'Pedido prévio do aluno logado para hoje ou amanhã, até antecedencia_pedido() antes do intervalo. Com saldo, efetiva na hora; com Pix, cria cobrança pendente. Sem reserva de estoque.';

-- ---------------------------------------------------------------------------
-- Confirmação de pagamento
--
-- Provisória para a equipe; com a API de Pix, uma Edge Function (service_role)
-- confirmará pelo webhook usando esta mesma lógica.
-- ---------------------------------------------------------------------------

create or replace function public.confirmar_pagamento(p_pagamento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operador uuid := (select auth.uid());
  v_pagamento public.pagamentos%rowtype;
  v_pedido public.pedidos%rowtype;
  v_itens jsonb;
  v_venda jsonb;
  v_detalhe text;
  v_resultado text;
begin
  if not public.e_equipe() then
    raise exception 'Apenas a equipe pode confirmar pagamentos.'
      using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  select * into v_pagamento from public.pagamentos where id = p_pagamento_id for update;

  if not found then
    raise exception 'Pagamento não encontrado.' using errcode = 'P0001', detail = 'pagamento_invalido';
  end if;

  -- Idempotente: confirmar de novo não credita outra vez.
  if v_pagamento.status = 'pago' then
    return jsonb_build_object('pagamento_id', p_pagamento_id, 'status', 'ja_confirmado');
  end if;

  -- Mesmo vencido, o dinheiro recebido vira crédito do aluno.
  update public.pagamentos
    set status = 'pago', pago_em = now(), confirmado_por = v_operador
    where id = p_pagamento_id;

  insert into public.movimentos_financeiros (aluno_id, tipo, valor_centavos, criado_por, descricao, pagamento_id)
    values (
      v_pagamento.aluno_id, 'credito', v_pagamento.valor_centavos, v_operador,
      case when v_pagamento.tipo = 'pedido' then 'Pix do pedido prévio' else 'Crédito via Pix' end,
      p_pagamento_id
    );

  if v_pagamento.tipo = 'credito' then
    return jsonb_build_object('pagamento_id', p_pagamento_id, 'status', 'creditado');
  end if;

  select * into v_pedido from public.pedidos where id = v_pagamento.pedido_id for update;

  if v_pedido.status not in ('aguardando_pagamento', 'expirado') then
    return jsonb_build_object('pagamento_id', p_pagamento_id, 'status', 'creditado', 'pedido_id', v_pedido.id);
  end if;

  if now() > v_pagamento.expira_em then
    update public.pedidos
      set status = 'expirado',
          finalizado_em = now(),
          motivo = 'Pagamento confirmado após o prazo; o valor ficou como crédito.'
      where id = v_pedido.id;
    return jsonb_build_object('pagamento_id', p_pagamento_id, 'status', 'pedido_expirado', 'pedido_id', v_pedido.id);
  end if;

  select jsonb_agg(jsonb_build_object('produto_id', i.produto_id, 'quantidade', i.quantidade))
    into v_itens
    from public.pedido_itens i
    where i.pedido_id = v_pedido.id;

  begin
    v_venda := public.efetivar_venda(v_pedido.aluno_id, v_itens, v_pedido.observacao, null, 'pedido', false);

    update public.pedidos
      set status = 'pago', venda_id = (v_venda ->> 'venda_id')::uuid, pago_em = now()
      where id = v_pedido.id;

    v_resultado := 'pedido_pago';
  exception when sqlstate 'P0001' or sqlstate '22023' then
    -- Recusa de negócio (sem estoque, limite etc.): só a efetivação é
    -- desfeita; o pagamento e o crédito continuam valendo.
    get stacked diagnostics v_detalhe = pg_exception_detail;

    update public.pedidos
      set status = 'recusado',
          finalizado_em = now(),
          motivo = coalesce(nullif(v_detalhe, ''), 'recusado') || ': o valor ficou como crédito.'
      where id = v_pedido.id;

    v_resultado := 'pedido_recusado';
  end;

  return jsonb_build_object(
    'pagamento_id', p_pagamento_id,
    'status', v_resultado,
    'pedido_id', v_pedido.id,
    'motivo', v_detalhe
  );
end;
$$;

comment on function public.confirmar_pagamento(uuid) is
  'Marca o pagamento como pago e lança o crédito. Se for de pedido, efetiva a venda ou recusa o pedido mantendo o crédito. Idempotente.';

-- ---------------------------------------------------------------------------
-- Retirada
-- ---------------------------------------------------------------------------

create or replace function public.finalizar_pedido(p_pedido_id uuid, p_entregue boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_status public.status_pedido := case when p_entregue then 'entregue' else 'nao_retirado' end;
begin
  if not public.e_equipe() then
    raise exception 'Apenas a equipe pode finalizar pedidos.'
      using errcode = '42501', detail = 'papel_insuficiente';
  end if;

  if p_entregue is null then
    raise exception 'Informe se o pedido foi entregue.' using errcode = '22023', detail = 'valor_invalido';
  end if;

  select * into v_pedido from public.pedidos where id = p_pedido_id for update;

  if not found or v_pedido.status <> 'pago' then
    raise exception 'Só pedidos pagos e ainda não retirados podem ser finalizados.'
      using errcode = 'P0001', detail = 'pedido_invalido';
  end if;

  -- Não retirado não gera devolução: a venda continua valendo.
  update public.pedidos
    set status = v_status, finalizado_em = now()
    where id = p_pedido_id;

  return jsonb_build_object('pedido_id', p_pedido_id, 'status', v_status);
end;
$$;

comment on function public.finalizar_pedido(uuid, boolean) is
  'Equipe marca o pedido pago como entregue (true) ou não retirado (false). Não retirado não é devolvido.';

-- ---------------------------------------------------------------------------
-- cancelar_venda: também encerra o pedido de origem
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

  update public.pedidos
    set status = 'cancelado',
        finalizado_em = now(),
        motivo = coalesce(nullif(btrim(p_motivo), ''), 'Venda cancelada pela equipe.')
    where venda_id = p_venda_id;

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

-- ---------------------------------------------------------------------------
-- Grants de execução
-- ---------------------------------------------------------------------------

-- Crédito sem pagamento deixa de existir para clientes.
revoke execute on function public.adicionar_credito(uuid, bigint, text) from authenticated;

revoke execute on function public.expirar_pendentes() from public, anon;
revoke execute on function public.solicitar_credito(uuid, bigint) from public, anon;
revoke execute on function public.criar_pedido(uuid, date, jsonb, public.forma_pagamento_pedido, text) from public, anon;
revoke execute on function public.confirmar_pagamento(uuid) from public, anon;
revoke execute on function public.finalizar_pedido(uuid, boolean) from public, anon;

grant execute on function public.expirar_pendentes() to authenticated;
grant execute on function public.solicitar_credito(uuid, bigint) to authenticated;
grant execute on function public.criar_pedido(uuid, date, jsonb, public.forma_pagamento_pedido, text) to authenticated;
grant execute on function public.confirmar_pagamento(uuid) to authenticated;
grant execute on function public.finalizar_pedido(uuid, boolean) to authenticated;
