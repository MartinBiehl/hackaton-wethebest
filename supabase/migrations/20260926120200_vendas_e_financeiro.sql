-- Vendas, itens e extrato financeiro.
--
-- O extrato (public.movimentos_financeiros) é a única fonte de verdade do
-- dinheiro. Não existe coluna de saldo nem de dívida em lugar nenhum: o saldo
-- atual é a soma dos movimentos do aluno, e a dívida é simplesmente um saldo
-- negativo. Assim não há duas fontes para divergir.

create type public.status_venda as enum ('confirmada', 'cancelada');
create type public.tipo_movimento as enum ('credito', 'compra', 'pagamento', 'ajuste', 'estorno');

comment on type public.tipo_movimento is
  'credito = responsável adiciona saldo (+); compra = venda registrada (-); pagamento = aluno quita dívida no balcão (+); estorno = devolução de venda cancelada (+); ajuste = correção manual autorizada (+/-).';

-- Piso de saldo: nenhuma venda pode deixar o aluno abaixo deste valor.
create or replace function public.piso_saldo_centavos()
returns bigint
language sql
immutable
set search_path = ''
as $$
  select (-25000)::bigint;
$$;

comment on function public.piso_saldo_centavos() is 'Limite de dívida: -R$ 250,00 em centavos. Regra independente do limite mensal.';

revoke execute on function public.piso_saldo_centavos() from public, anon;
grant execute on function public.piso_saldo_centavos() to authenticated;

-- ---------------------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------------------

create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id) on delete restrict,
  operador_id uuid references auth.users (id) on delete set null,
  status public.status_venda not null default 'confirmada',
  total_centavos bigint not null check (total_centavos > 0),
  observacao text check (observacao is null or length(observacao) <= 300),
  criado_em timestamptz not null default now(),
  cancelado_em timestamptz,
  cancelado_por uuid references auth.users (id) on delete set null,
  motivo_cancelamento text check (motivo_cancelamento is null or length(motivo_cancelamento) <= 300),
  constraint vendas_cancelamento_coerente check (
    (status = 'confirmada' and cancelado_em is null and cancelado_por is null and motivo_cancelamento is null)
    or (status = 'cancelada' and cancelado_em is not null)
  )
);

create index vendas_aluno_data_idx on public.vendas (aluno_id, criado_em desc);
create index vendas_data_idx on public.vendas (criado_em desc);
create index vendas_operador_idx on public.vendas (operador_id);
create index vendas_confirmadas_idx on public.vendas (aluno_id, criado_em) where status = 'confirmada';

comment on column public.vendas.total_centavos is 'Soma dos subtotais dos itens no momento da venda, em centavos.';
comment on column public.vendas.operador_id is 'Conta da equipe que lançou a venda. Fica nulo se a conta for apagada; a venda permanece.';

create table public.venda_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas (id) on delete cascade,
  produto_id uuid references public.produtos (id) on delete set null,
  nome_produto text not null,
  preco_unitario_centavos bigint not null check (preco_unitario_centavos >= 0),
  quantidade integer not null check (quantidade > 0),
  subtotal_centavos bigint not null check (subtotal_centavos >= 0),
  constraint venda_itens_subtotal_coerente check (subtotal_centavos = preco_unitario_centavos * quantidade)
);

create index venda_itens_venda_idx on public.venda_itens (venda_id);
create index venda_itens_produto_idx on public.venda_itens (produto_id);

comment on table public.venda_itens is
  'Cada linha guarda o nome e o preço unitário vigentes no momento da compra. Alterar ou inativar o produto depois não muda o histórico.';

-- ---------------------------------------------------------------------------
-- Extrato financeiro
-- ---------------------------------------------------------------------------

create table public.movimentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id) on delete restrict,
  tipo public.tipo_movimento not null,
  valor_centavos bigint not null check (valor_centavos <> 0),
  venda_id uuid references public.vendas (id) on delete restrict,
  descricao text check (descricao is null or length(descricao) <= 300),
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  constraint movimentos_sinal_coerente check (
    (tipo in ('credito', 'pagamento', 'estorno') and valor_centavos > 0)
    or (tipo = 'compra' and valor_centavos < 0)
    or (tipo = 'ajuste')
  ),
  constraint movimentos_venda_coerente check (
    (tipo in ('compra', 'estorno')) = (venda_id is not null)
  )
);

create index movimentos_aluno_data_idx on public.movimentos_financeiros (aluno_id, criado_em desc);
create unique index movimentos_compra_unica on public.movimentos_financeiros (venda_id) where tipo = 'compra';
create unique index movimentos_estorno_unico on public.movimentos_financeiros (venda_id) where tipo = 'estorno';

comment on table public.movimentos_financeiros is
  'Extrato append-only e auditável. Não há política de UPDATE nem DELETE para nenhum papel: correções entram como novo movimento do tipo ajuste ou estorno.';

-- ---------------------------------------------------------------------------
-- Leituras derivadas
--
-- security_invoker = on faz as views respeitarem a RLS das tabelas de origem:
-- cada usuário só agrega as linhas que já poderia ler.
-- ---------------------------------------------------------------------------

create view public.saldos_alunos with (security_invoker = on) as
  select
    a.id as aluno_id,
    coalesce(sum(m.valor_centavos), 0)::bigint as saldo_centavos,
    coalesce(sum(m.valor_centavos) filter (where m.valor_centavos < 0), 0)::bigint as total_debitos_centavos,
    coalesce(sum(m.valor_centavos) filter (where m.valor_centavos > 0), 0)::bigint as total_creditos_centavos,
    max(m.criado_em) as ultimo_movimento_em
  from public.alunos a
  left join public.movimentos_financeiros m on m.aluno_id = a.id
  group by a.id;

comment on view public.saldos_alunos is
  'Saldo atual por aluno, derivado do extrato. Negativo = dívida com a Carla. Nunca é armazenado.';

create view public.gastos_mensais_alunos with (security_invoker = on) as
  select
    v.aluno_id,
    (date_trunc('month', (v.criado_em at time zone 'America/Sao_Paulo')))::date as competencia,
    sum(v.total_centavos)::bigint as total_centavos,
    count(*)::bigint as quantidade_vendas
  from public.vendas v
  where v.status = 'confirmada'
  group by 1, 2;

comment on view public.gastos_mensais_alunos is
  'Gasto por aluno e mês-calendário no fuso America/Sao_Paulo. Conta toda venda confirmada, tenha ela usado saldo positivo ou gerado dívida. Vendas canceladas não entram.';

create view public.vendas_mensais with (security_invoker = on) as
  select
    (date_trunc('month', (v.criado_em at time zone 'America/Sao_Paulo')))::date as competencia,
    count(*)::bigint as quantidade_vendas,
    sum(v.total_centavos)::bigint as total_centavos
  from public.vendas v
  where v.status = 'confirmada'
  group by 1;

comment on view public.vendas_mensais is 'Fechamento mensal da Carla. Pela RLS de public.vendas, só a equipe enxerga linhas aqui.';

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------

alter table public.vendas enable row level security;
alter table public.venda_itens enable row level security;
alter table public.movimentos_financeiros enable row level security;

revoke all on table public.vendas from anon, authenticated;
revoke all on table public.venda_itens from anon, authenticated;
revoke all on table public.movimentos_financeiros from anon, authenticated;

-- Somente leitura para o cliente: toda escrita passa pelas funções RPC.
grant select on table public.vendas to authenticated;
grant select on table public.venda_itens to authenticated;
grant select on table public.movimentos_financeiros to authenticated;

-- As views herdam os grants padrão do Supabase; removemos o acesso de anon
-- antes de liberar apenas a leitura autenticada. Como são security_invoker,
-- a RLS das tabelas de origem continua valendo dentro delas.
revoke all on public.saldos_alunos from anon, authenticated;
revoke all on public.gastos_mensais_alunos from anon, authenticated;
revoke all on public.vendas_mensais from anon, authenticated;

grant select on public.saldos_alunos to authenticated;
grant select on public.gastos_mensais_alunos to authenticated;
grant select on public.vendas_mensais to authenticated;

create policy "vendas_select_autorizados"
  on public.vendas for select to authenticated
  using (
    public.e_equipe()
    or public.e_titular_do_aluno(aluno_id)
    or public.e_responsavel_de(aluno_id)
  );

create policy "venda_itens_select_autorizados"
  on public.venda_itens for select to authenticated
  using (
    exists (
      select 1
      from public.vendas v
      where v.id = venda_itens.venda_id
        and (
          public.e_equipe()
          or public.e_titular_do_aluno(v.aluno_id)
          or public.e_responsavel_de(v.aluno_id)
        )
    )
  );

create policy "movimentos_select_autorizados"
  on public.movimentos_financeiros for select to authenticated
  using (
    public.e_equipe()
    or public.e_titular_do_aluno(aluno_id)
    or public.e_responsavel_de(aluno_id)
  );
