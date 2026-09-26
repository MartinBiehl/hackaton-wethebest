-- Identidade, papéis e vínculo entre responsáveis e alunos.
--
-- Princípios aplicados em todas as migrações deste projeto:
--   * RLS ativa em toda tabela exposta pela API, com políticas explícitas.
--   * Grants mínimos: nenhuma tabela recebe INSERT/UPDATE/DELETE direto do cliente
--     quando a escrita depende de regra de negócio; isso passa por função RPC.
--   * Valores monetários sempre em centavos (bigint). Nunca ponto flutuante.
--   * Fuso horário de referência para competências mensais: America/Sao_Paulo.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.papel_usuario as enum ('equipe', 'responsavel', 'aluno');
create type public.status_vinculo as enum ('pendente', 'ativo', 'revogado');

comment on type public.papel_usuario is
  'equipe = Carla e time de vendas; responsavel = pai/responsável; aluno = conta do aluno no portal.';

-- ---------------------------------------------------------------------------
-- Utilitário de auditoria
-- ---------------------------------------------------------------------------

create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Configuração do sistema (linha única)
-- ---------------------------------------------------------------------------

create table public.configuracoes (
  id smallint primary key default 1 check (id = 1),
  vinculo_automatico boolean not null default false,
  atualizado_em timestamptz not null default now()
);

comment on table public.configuracoes is
  'Parâmetros globais. Alterável apenas por SQL no painel (service_role); não há política de escrita para o cliente.';
comment on column public.configuracoes.vinculo_automatico is
  'Quando true, a conta do aluno é ativada automaticamente se o e-mail estiver confirmado no Auth. Só ative depois de habilitar "Confirm email" no painel: com a confirmação desligada o Auth marca todo e-mail como confirmado no cadastro e a verificação deixa de significar posse do e-mail. Com false, todo vínculo de conta espera aprovação do responsável.';

insert into public.configuracoes (id) values (1) on conflict (id) do nothing;

create trigger configuracoes_atualizado_em
  before update on public.configuracoes
  for each row execute function public.set_atualizado_em();

-- ---------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------------

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (btrim(nome) <> '' and length(nome) <= 120),
  email text not null,
  papel public.papel_usuario not null default 'responsavel',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index perfis_email_unico on public.perfis (lower(email));
create index perfis_papel_idx on public.perfis (papel);

comment on column public.perfis.papel is
  'Nunca é escolhido pelo cliente: o gatilho de cadastro só aceita responsavel ou aluno, e a política de UPDATE impede alteração. O papel equipe é concedido manualmente por SQL administrativo.';

create trigger perfis_atualizado_em
  before update on public.perfis
  for each row execute function public.set_atualizado_em();

-- ---------------------------------------------------------------------------
-- Alunos
--
-- O aluno é um REGISTRO, não necessariamente uma conta: o responsável pode
-- pré-cadastrar o e-mail antes de o aluno existir no Auth, e a Carla pode
-- vender para um aluno que nunca usou o portal.
-- ---------------------------------------------------------------------------

create table public.alunos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> '' and length(nome) <= 120),
  email_convite text check (email_convite is null or position('@' in email_convite) > 1),
  user_id uuid unique references auth.users (id) on delete set null,
  user_id_pendente uuid unique references auth.users (id) on delete set null,
  limite_mensal_centavos bigint check (limite_mensal_centavos is null or limite_mensal_centavos >= 0),
  ativo boolean not null default true,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint alunos_conta_distinta check (user_id_pendente is null or user_id_pendente is distinct from user_id)
);

create unique index alunos_email_convite_unico
  on public.alunos (lower(email_convite))
  where email_convite is not null;
create index alunos_user_id_idx on public.alunos (user_id);
create index alunos_ativo_idx on public.alunos (ativo);

comment on column public.alunos.limite_mensal_centavos is
  'Teto de compras por mês-calendário (America/Sao_Paulo). NULL = sem limite mensal; o piso de dívida de -R$ 250,00 continua valendo.';
comment on column public.alunos.user_id_pendente is
  'Conta do Auth que reivindicou este aluno e aguarda aprovação de um responsável ativo.';

create trigger alunos_atualizado_em
  before update on public.alunos
  for each row execute function public.set_atualizado_em();

-- ---------------------------------------------------------------------------
-- Vínculo N:N entre responsáveis e alunos
-- ---------------------------------------------------------------------------

create table public.responsavel_aluno (
  responsavel_id uuid not null references auth.users (id) on delete cascade,
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  status public.status_vinculo not null default 'pendente',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (responsavel_id, aluno_id)
);

create index responsavel_aluno_aluno_idx on public.responsavel_aluno (aluno_id);
create index responsavel_aluno_ativos_idx on public.responsavel_aluno (responsavel_id) where status = 'ativo';

comment on table public.responsavel_aluno is
  'Um aluno pode ter vários responsáveis e um responsável vários alunos. Status ativo é exigido para qualquer leitura financeira ou ação sobre o aluno.';

create trigger responsavel_aluno_atualizado_em
  before update on public.responsavel_aluno
  for each row execute function public.set_atualizado_em();

-- ---------------------------------------------------------------------------
-- Predicados de autorização
--
-- SECURITY DEFINER porque são chamados de dentro das próprias políticas RLS:
-- sem isso a política de perfis consultaria perfis recursivamente e as demais
-- não conseguiriam ler as tabelas de vínculo. Cada função recebe no máximo um
-- uuid, nunca SQL livre, e sempre resolve o sujeito por auth.uid() — o chamador
-- não consegue perguntar "o usuário X é responsável?", só sobre si mesmo.
-- search_path fixo em '' impede sequestro de nome de objeto.
-- EXECUTE é concedido apenas a authenticated.
-- ---------------------------------------------------------------------------

create or replace function public.papel_atual()
returns public.papel_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select p.papel from public.perfis p where p.id = (select auth.uid());
$$;

create or replace function public.e_equipe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.papel_atual() = 'equipe'::public.papel_usuario, false);
$$;

create or replace function public.e_responsavel_de(p_aluno_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.responsavel_aluno ra
    where ra.aluno_id = p_aluno_id
      and ra.responsavel_id = (select auth.uid())
      and ra.status = 'ativo'::public.status_vinculo
  );
$$;

create or replace function public.e_titular_do_aluno(p_aluno_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.alunos a
    where a.id = p_aluno_id
      and a.user_id = (select auth.uid())
  );
$$;

comment on function public.papel_atual() is 'Papel do usuário autenticado. SECURITY DEFINER para evitar recursão nas políticas de public.perfis.';
comment on function public.e_responsavel_de(uuid) is 'Verdadeiro se o usuário autenticado é responsável ATIVO pelo aluno informado.';

revoke execute on function public.papel_atual() from public, anon;
revoke execute on function public.e_equipe() from public, anon;
revoke execute on function public.e_responsavel_de(uuid) from public, anon;
revoke execute on function public.e_titular_do_aluno(uuid) from public, anon;

grant execute on function public.papel_atual() to authenticated;
grant execute on function public.e_equipe() to authenticated;
grant execute on function public.e_responsavel_de(uuid) to authenticated;
grant execute on function public.e_titular_do_aluno(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Criação automática do perfil no cadastro
--
-- SECURITY DEFINER porque roda como gatilho em auth.users, cuja inserção é
-- feita pelo GoTrue, e precisa escrever em public.perfis com RLS ativa.
-- O papel vindo do metadata do cliente é coagido: só 'aluno' é aceito como
-- alternativa; qualquer outro valor, inclusive 'equipe', vira 'responsavel'.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, email, papel)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    case new.raw_user_meta_data ->> 'papel'
      when 'aluno' then 'aluno'::public.papel_usuario
      else 'responsavel'::public.papel_usuario
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------

alter table public.configuracoes enable row level security;
alter table public.perfis enable row level security;
alter table public.alunos enable row level security;
alter table public.responsavel_aluno enable row level security;

revoke all on table public.configuracoes from anon, authenticated;
revoke all on table public.perfis from anon, authenticated;
revoke all on table public.alunos from anon, authenticated;
revoke all on table public.responsavel_aluno from anon, authenticated;

-- configuracoes: somente leitura, somente equipe. Escrita só por SQL administrativo.
grant select on table public.configuracoes to authenticated;

create policy "configuracoes_select_equipe"
  on public.configuracoes for select to authenticated
  using (public.e_equipe());

-- perfis: cada um enxerga e renomeia apenas o próprio perfil. O grant de UPDATE
-- é restrito à coluna nome, então e-mail e papel não são alteráveis pela API.
grant select on table public.perfis to authenticated;
grant update (nome) on table public.perfis to authenticated;

create policy "perfis_select_proprio"
  on public.perfis for select to authenticated
  using (id = (select auth.uid()));

create policy "perfis_update_proprio"
  on public.perfis for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and papel = public.papel_atual());

-- alunos: equipe vê todos (precisa pesquisar o aluno na hora da venda);
-- responsável vê os vinculados ativos; o aluno vê a si mesmo, inclusive
-- enquanto a reivindicação da conta está pendente, para o portal informar isso.
grant select on table public.alunos to authenticated;

create policy "alunos_select_autorizados"
  on public.alunos for select to authenticated
  using (
    public.e_equipe()
    or user_id = (select auth.uid())
    or user_id_pendente = (select auth.uid())
    or public.e_responsavel_de(id)
  );

-- responsavel_aluno: o responsável vê seus vínculos; o aluno vê quem o acompanha.
-- A equipe não precisa e não recebe acesso.
grant select on table public.responsavel_aluno to authenticated;

create policy "responsavel_aluno_select_partes"
  on public.responsavel_aluno for select to authenticated
  using (
    responsavel_id = (select auth.uid())
    or public.e_titular_do_aluno(aluno_id)
  );
