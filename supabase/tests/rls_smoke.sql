-- Bateria de verificação do esquema: papéis, RLS, limites e atomicidade.
--
-- Como rodar: cole no SQL Editor do painel do Supabase e execute.
-- Tudo acontece dentro de uma transação que termina em ROLLBACK, então
-- nenhum dado de teste (inclusive os usuários fictícios) permanece no banco.
-- Qualquer regra violada interrompe a execução com a mensagem do passo.
--
-- Os usuários são criados direto em auth.users porque o teste precisa de
-- contas com papéis distintos; em uso real as contas nascem pelo Auth.

begin;

-- ---------------------------------------------------------------------------
-- Contas de teste
-- ---------------------------------------------------------------------------

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'carla@teste.local', 'x', now(), now(), now(),
   '{"provider":"email"}', '{"nome":"Carla"}'),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'mae@teste.local', 'x', now(), now(), now(),
   '{"provider":"email"}', '{"nome":"Mae Teste"}'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'filho@teste.local', 'x', now(), now(), now(),
   '{"provider":"email"}', '{"nome":"Filho Teste","papel":"aluno"}'),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
   'authenticated', 'authenticated', 'estranho@teste.local', 'x', now(), now(), now(),
   '{"provider":"email"}', '{"nome":"Estranho"}');

-- Papel privilegiado só por via administrativa (é exatamente o comando
-- documentado para promover a conta real da Carla).
update public.perfis set papel = 'equipe' where email = 'carla@teste.local';

do $$
begin
  if (select papel from public.perfis where email = 'filho@teste.local') <> 'aluno' then
    raise exception 'FALHOU: o gatilho de cadastro não aplicou o papel aluno vindo do metadata';
  end if;
  if (select papel from public.perfis where email = 'mae@teste.local') <> 'responsavel' then
    raise exception 'FALHOU: papel padrão deveria ser responsavel';
  end if;
end $$;

-- Metadata malicioso não vira papel privilegiado.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555',
        'authenticated', 'authenticated', 'esperto@teste.local', 'x', now(), now(), now(),
        '{"provider":"email"}', '{"nome":"Esperto","papel":"equipe"}');

do $$
begin
  if (select papel from public.perfis where email = 'esperto@teste.local') = 'equipe' then
    raise exception 'FALHOU: cliente conseguiu se autodeclarar equipe pelo metadata do cadastro';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Catálogo (equipe)
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.produtos (nome, preco_centavos) values ('Produto Teste', 1000);
select set_config('app.produto', (select id::text from public.produtos where nome = 'Produto Teste'), false);

update public.estoque set quantidade = 3 where produto_id = current_setting('app.produto')::uuid;

-- ---------------------------------------------------------------------------
-- Pré-cadastro do aluno pelo responsável
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select set_config('app.aluno',
  (public.cadastrar_aluno('Filho Teste', 'filho@teste.local') ->> 'aluno_id'), false);

do $$
begin
  if current_setting('app.aluno', true) is null or current_setting('app.aluno', true) = '' then
    raise exception 'FALHOU: responsável não conseguiu pré-cadastrar o aluno';
  end if;
end $$;

select public.definir_limite_mensal(current_setting('app.aluno')::uuid, 5000);
select public.adicionar_credito(current_setting('app.aluno')::uuid, 2000, 'Crédito inicial');

do $$
declare v_saldo bigint;
begin
  select saldo_centavos into v_saldo from public.saldos_alunos
   where aluno_id = current_setting('app.aluno')::uuid;
  if v_saldo <> 2000 then
    raise exception 'FALHOU: saldo após crédito deveria ser 2000, veio %', v_saldo;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Vendas (equipe)
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 2 x R$ 10,00 = R$ 20,00 -> consome todo o crédito, saldo 0, estoque 1
select public.registrar_venda(
  current_setting('app.aluno')::uuid,
  jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 2))
);

do $$
declare v_saldo bigint; v_estoque integer;
begin
  select saldo_centavos into v_saldo from public.saldos_alunos where aluno_id = current_setting('app.aluno')::uuid;
  select quantidade into v_estoque from public.estoque where produto_id = current_setting('app.produto')::uuid;
  if v_saldo <> 0 then raise exception 'FALHOU: saldo deveria ser 0 após a venda, veio %', v_saldo; end if;
  if v_estoque <> 1 then raise exception 'FALHOU: estoque deveria ser 1, veio %', v_estoque; end if;
end $$;

-- 1 x R$ 10,00 -> saldo -R$ 10,00 (fiado permitido), estoque 0, gasto do mês R$ 30,00
select public.registrar_venda(
  current_setting('app.aluno')::uuid,
  jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 1))
);

do $$
declare v_saldo bigint; v_gasto bigint;
begin
  select saldo_centavos into v_saldo from public.saldos_alunos where aluno_id = current_setting('app.aluno')::uuid;
  select total_centavos into v_gasto from public.gastos_mensais_alunos
   where aluno_id = current_setting('app.aluno')::uuid
     and competencia = date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  if v_saldo <> -1000 then raise exception 'FALHOU: saldo deveria ser -1000 (fiado), veio %', v_saldo; end if;
  if v_gasto <> 3000 then raise exception 'FALHOU: gasto do mês deveria ser 3000, veio %', v_gasto; end if;
end $$;

-- Estoque esgotado: a venda precisa ser recusada.
do $$
begin
  begin
    perform public.registrar_venda(
      current_setting('app.aluno')::uuid,
      jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 1)));
    raise exception 'FALHOU: venda sem estoque foi aceita';
  exception when others then
    if sqlerrm not like '%Estoque insuficiente%' then raise; end if;
  end;
end $$;

-- Reposição para os testes de limite.
update public.estoque set quantidade = 100 where produto_id = current_setting('app.produto')::uuid;

-- Limite mensal: já gastou R$ 30,00 de um teto de R$ 50,00; R$ 30,00 estoura.
do $$
begin
  begin
    perform public.registrar_venda(
      current_setting('app.aluno')::uuid,
      jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 3)));
    raise exception 'FALHOU: venda acima do limite mensal foi aceita';
  exception when others then
    if sqlerrm not like '%limite mensal%' then raise; end if;
  end;
end $$;

-- E o estoque não pode ter sido consumido pela venda recusada (atomicidade).
do $$
declare v_estoque integer;
begin
  select quantidade into v_estoque from public.estoque where produto_id = current_setting('app.produto')::uuid;
  if v_estoque <> 100 then
    raise exception 'FALHOU: venda recusada consumiu estoque (esperado 100, veio %)', v_estoque;
  end if;
end $$;

-- Piso de dívida: sem limite mensal, a compra não pode passar de -R$ 250,00.
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select public.definir_limite_mensal(current_setting('app.aluno')::uuid, null);

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    -- saldo -1000; 25 x 1000 = 25000 -> saldo final -26000, abaixo do piso
    perform public.registrar_venda(
      current_setting('app.aluno')::uuid,
      jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 25)));
    raise exception 'FALHOU: venda que ultrapassa o piso de -R$ 250,00 foi aceita';
  exception when others then
    if sqlerrm not like '%abaixo do limite%' then raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Cancelamento e estorno
-- ---------------------------------------------------------------------------

-- Dentro de uma única transação todas as linhas têm o mesmo criado_em
-- (now() é o instante da transação), então aqui a venda é escolhida pelo
-- valor, e não pela data. Em produção cada venda é uma transação própria.
select set_config('app.venda',
  (select id::text from public.vendas
    where aluno_id = current_setting('app.aluno')::uuid
      and status = 'confirmada'
      and total_centavos = 1000
    limit 1), false);

select public.cancelar_venda(current_setting('app.venda')::uuid, 'Teste');

do $$
declare v_saldo bigint; v_estoque integer; v_gasto bigint;
begin
  select saldo_centavos into v_saldo from public.saldos_alunos where aluno_id = current_setting('app.aluno')::uuid;
  select quantidade into v_estoque from public.estoque where produto_id = current_setting('app.produto')::uuid;
  select coalesce(total_centavos, 0) into v_gasto from public.gastos_mensais_alunos
   where aluno_id = current_setting('app.aluno')::uuid;
  if v_saldo <> 0 then raise exception 'FALHOU: estorno deveria zerar o saldo, veio %', v_saldo; end if;
  if v_estoque <> 101 then raise exception 'FALHOU: cancelamento não devolveu a unidade ao estoque (veio %)', v_estoque; end if;
  if v_gasto <> 2000 then raise exception 'FALHOU: venda cancelada ainda conta no gasto do mês (veio %)', v_gasto; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Vínculo da conta do aluno
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

do $$
declare v_status text;
begin
  v_status := public.vincular_conta_aluno('mae@teste.local') ->> 'status';
  if v_status <> 'aguardando_aprovacao' then
    raise exception 'FALHOU: com vinculo_automatico desligado o esperado é aguardando_aprovacao, veio %', v_status;
  end if;
end $$;

-- Antes da aprovação, o aluno não vê o próprio financeiro.
do $$
declare v_qtd integer;
begin
  select count(*) into v_qtd from public.movimentos_financeiros;
  if v_qtd <> 0 then
    raise exception 'FALHOU: aluno pendente enxergou % movimentos', v_qtd;
  end if;
end $$;

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select public.aprovar_conta_aluno(current_setting('app.aluno')::uuid);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare v_alunos integer; v_mov integer;
begin
  select count(*) into v_alunos from public.alunos;
  select count(*) into v_mov from public.movimentos_financeiros;
  if v_alunos <> 1 then raise exception 'FALHOU: aluno aprovado deveria ver exatamente 1 aluno, viu %', v_alunos; end if;
  if v_mov = 0 then raise exception 'FALHOU: aluno aprovado não enxerga o próprio extrato'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Isolamento entre contas
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
do $$
declare v_alunos integer; v_mov integer; v_vendas integer; v_itens integer;
begin
  select count(*) into v_alunos from public.alunos;
  select count(*) into v_mov from public.movimentos_financeiros;
  select count(*) into v_vendas from public.vendas;
  select count(*) into v_itens from public.venda_itens;
  if v_alunos <> 0 or v_mov <> 0 or v_vendas <> 0 or v_itens <> 0 then
    raise exception 'FALHOU: conta sem vínculo enxergou dados (alunos %, movimentos %, vendas %, itens %)',
      v_alunos, v_mov, v_vendas, v_itens;
  end if;
end $$;

-- Escalada de privilégio pelo cliente.
do $$
begin
  begin
    update public.perfis set papel = 'equipe' where id = '44444444-4444-4444-4444-444444444444';
    raise exception 'FALHOU: usuário conseguiu se promover a equipe';
  exception when insufficient_privilege then
    null; -- esperado: não há grant de UPDATE na coluna papel
  end;
end $$;

-- Aluno não vende, responsável não vende.
do $$
begin
  begin
    perform public.registrar_venda(
      current_setting('app.aluno')::uuid,
      jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 1)));
    raise exception 'FALHOU: conta sem papel de equipe registrou venda';
  exception when insufficient_privilege then
    null; -- esperado
  end;
end $$;

-- Responsável não credita aluno de outra família.
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
do $$
begin
  begin
    perform public.adicionar_credito(current_setting('app.aluno')::uuid, 1000);
    raise exception 'FALHOU: estranho creditou saldo de aluno não vinculado';
  exception when insufficient_privilege then
    null; -- esperado
  end;
end $$;

-- Extrato é append-only: nem a equipe altera movimentos.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    update public.movimentos_financeiros set valor_centavos = 1;
    raise exception 'FALHOU: movimentos financeiros puderam ser alterados';
  exception when insufficient_privilege then
    null; -- esperado
  end;
end $$;

reset role;

rollback;

select 'TODOS OS TESTES PASSARAM' as resultado;
