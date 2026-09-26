-- Catálogo de produtos e quantidade em estoque.
--
-- O catálogo (o que existe e por quanto é vendido) fica separado da
-- disponibilidade (quantas unidades existem agora). A baixa de estoque é feita
-- por UPDATE condicional dentro de public.registrar_venda, o que torna a
-- verificação e a baixa uma operação atômica: duas vendas simultâneas não
-- conseguem consumir a mesma unidade.

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> '' and length(nome) <= 120),
  descricao text check (descricao is null or length(descricao) <= 500),
  preco_centavos bigint not null check (preco_centavos >= 0),
  ativo boolean not null default true,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index produtos_nome_unico on public.produtos (lower(btrim(nome)));
create index produtos_ativo_idx on public.produtos (ativo);

comment on table public.produtos is
  'Catálogo. Produtos não são apagados: use ativo = false para tirar de venda e preservar o histórico das vendas.';
comment on column public.produtos.preco_centavos is
  'Preço atual em centavos. O preço cobrado em cada venda é copiado para public.venda_itens e não muda depois.';

create trigger produtos_atualizado_em
  before update on public.produtos
  for each row execute function public.set_atualizado_em();

create table public.estoque (
  produto_id uuid primary key references public.produtos (id) on delete cascade,
  quantidade integer not null default 0 check (quantidade >= 0),
  atualizado_em timestamptz not null default now()
);

comment on table public.estoque is
  'Unidades disponíveis agora. Não há reserva para encomendas: a venda só é aceita se houver estoque no instante do processamento.';

create trigger estoque_atualizado_em
  before update on public.estoque
  for each row execute function public.set_atualizado_em();

-- Todo produto nasce com uma linha de estoque zerada, para que a baixa
-- condicional nunca precise tratar o caso "produto sem registro de estoque".
create or replace function public.criar_estoque_do_produto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.estoque (produto_id, quantidade)
  values (new.id, 0)
  on conflict (produto_id) do nothing;
  return new;
end;
$$;

create trigger produtos_cria_estoque
  after insert on public.produtos
  for each row execute function public.criar_estoque_do_produto();

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------

alter table public.produtos enable row level security;
alter table public.estoque enable row level security;

revoke all on table public.produtos from anon, authenticated;
revoke all on table public.estoque from anon, authenticated;

-- produtos: a equipe administra o catálogo direto pela API (não há regra de
-- negócio além das constraints). DELETE não é concedido a ninguém: remover um
-- produto apagaria a referência do histórico de vendas.
grant select, insert, update on table public.produtos to authenticated;

create policy "produtos_select_equipe"
  on public.produtos for select to authenticated
  using (public.e_equipe());

create policy "produtos_select_ativos"
  on public.produtos for select to authenticated
  using (ativo);

create policy "produtos_insert_equipe"
  on public.produtos for insert to authenticated
  with check (public.e_equipe());

create policy "produtos_update_equipe"
  on public.produtos for update to authenticated
  using (public.e_equipe())
  with check (public.e_equipe());

-- estoque: apenas a equipe lê e ajusta. A baixa por venda é feita pela função
-- registrar_venda (SECURITY DEFINER), não por este grant.
grant select, update on table public.estoque to authenticated;

create policy "estoque_select_equipe"
  on public.estoque for select to authenticated
  using (public.e_equipe());

create policy "estoque_update_equipe"
  on public.estoque for update to authenticated
  using (public.e_equipe())
  with check (public.e_equipe());
