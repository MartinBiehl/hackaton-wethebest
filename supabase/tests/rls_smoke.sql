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

-- Crédito só vale depois de pago: a solicitação não muda o saldo.
select set_config('app.pag_credito',
  public.solicitar_credito(current_setting('app.aluno')::uuid, 2000) ->> 'pagamento_id', false);

do $$
declare v_saldo bigint;
begin
  select coalesce(sum(valor_centavos), 0) into v_saldo from public.movimentos_financeiros
   where aluno_id = current_setting('app.aluno')::uuid;
  if v_saldo <> 0 then
    raise exception 'FALHOU: crédito entrou no saldo antes de ser pago (saldo %)', v_saldo;
  end if;

  begin
    perform public.adicionar_credito(current_setting('app.aluno')::uuid, 2000, 'Sem pagar');
    raise exception 'FALHOU: responsável lançou crédito sem pagamento';
  exception when insufficient_privilege then
    null; -- esperado: adicionar_credito não é mais executável por clientes
  end;
end $$;

-- A equipe confirma o Pix (provisório até a integração da API).
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select public.confirmar_pagamento(current_setting('app.pag_credito')::uuid);

do $$
declare v_saldo bigint;
begin
  if public.confirmar_pagamento(current_setting('app.pag_credito')::uuid) ->> 'status' <> 'ja_confirmado' then
    raise exception 'FALHOU: segunda confirmação não foi tratada como repetida';
  end if;

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
-- Venda para cliente não registrado
-- ---------------------------------------------------------------------------

select public.registrar_venda(
  null,
  jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 1)),
  'avulsa-1'
);

do $$
declare v_estoque integer; v_mov integer; v_aluno uuid; v_gasto_nulo integer;
begin
  select quantidade into v_estoque from public.estoque where produto_id = current_setting('app.produto')::uuid;
  select aluno_id into v_aluno from public.vendas where observacao = 'avulsa-1';
  select count(*) into v_mov from public.movimentos_financeiros m
    join public.vendas v on v.id = m.venda_id where v.observacao = 'avulsa-1';
  select count(*) into v_gasto_nulo from public.gastos_mensais_alunos where aluno_id is null;
  if v_estoque <> 100 then raise exception 'FALHOU: venda avulsa não baixou o estoque (veio %)', v_estoque; end if;
  if v_aluno is not null then raise exception 'FALHOU: venda avulsa gravou aluno %', v_aluno; end if;
  if v_mov <> 0 then raise exception 'FALHOU: venda avulsa gerou % movimentos no extrato', v_mov; end if;
  if v_gasto_nulo <> 0 then raise exception 'FALHOU: venda avulsa apareceu no gasto mensal por aluno'; end if;
end $$;

select set_config('app.venda_avulsa', (select id::text from public.vendas where observacao = 'avulsa-1'), false);
select public.cancelar_venda(current_setting('app.venda_avulsa')::uuid, 'Teste avulsa');

do $$
declare v_estoque integer; v_mov integer;
begin
  select quantidade into v_estoque from public.estoque where produto_id = current_setting('app.produto')::uuid;
  select count(*) into v_mov from public.movimentos_financeiros where venda_id = current_setting('app.venda_avulsa')::uuid;
  if v_estoque <> 101 then raise exception 'FALHOU: cancelar venda avulsa não devolveu ao estoque (veio %)', v_estoque; end if;
  if v_mov <> 0 then raise exception 'FALHOU: cancelar venda avulsa gerou % movimentos', v_mov; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Prazo de cancelamento (24 horas)
-- ---------------------------------------------------------------------------

select public.registrar_venda(
  null,
  jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 1)),
  'antiga-1'
);

-- Envelhece a venda com privilégio de dono; authenticated não pode alterar vendas.
reset role;
update public.vendas set criado_em = now() - interval '25 hours' where observacao = 'antiga-1';
set local role authenticated;

do $$
begin
  begin
    perform public.cancelar_venda((select id from public.vendas where observacao = 'antiga-1'), 'Tarde demais');
    raise exception 'FALHOU: venda com mais de 24 horas foi cancelada';
  exception when others then
    if sqlerrm not like '%prazo para cancelar%' then raise; end if;
  end;
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
-- Cardápio: foto e estoque visível
-- ---------------------------------------------------------------------------

-- Aluno enxerga o estoque de produto ativo (para o cardápio mostrar disponibilidade).
do $$
begin
  if not exists (select 1 from public.estoque where produto_id = current_setting('app.produto')::uuid) then
    raise exception 'FALHOU: aluno não enxerga o estoque do produto ativo';
  end if;
end $$;

-- Só a equipe envia fotos ao bucket "produtos".
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
begin
  begin
    insert into storage.objects (bucket_id, name) values ('produtos', 'teste/mae.png');
    raise exception 'FALHOU: responsável enviou foto ao cardápio';
  exception when insufficient_privilege then
    null; -- esperado: bloqueado pela RLS do Storage
  end;
end $$;

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into storage.objects (bucket_id, name) values ('produtos', 'teste/carla.png');

-- ---------------------------------------------------------------------------
-- Pedidos prévios
-- ---------------------------------------------------------------------------

-- Intervalos: um sempre aberto para amanhã e um que já fechou hoje.
insert into public.intervalos_retirada (nome, inicio, fim) values
  ('Teste almoço', '12:00', '12:30'),
  ('Teste madrugada', '00:00', '00:30');
select set_config('app.intervalo', (select id::text from public.intervalos_retirada where nome = 'Teste almoço'), false);
select set_config('app.intervalo_fechado', (select id::text from public.intervalos_retirada where nome = 'Teste madrugada'), false);
select set_config('app.amanha', ((now() at time zone 'America/Sao_Paulo')::date + 1)::text, false);
select set_config('app.hoje', ((now() at time zone 'America/Sao_Paulo')::date)::text, false);

-- Responsável não faz pedido; só o aluno.
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
begin
  begin
    perform public.criar_pedido(current_setting('app.intervalo')::uuid, current_setting('app.amanha')::date,
      jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 1)), 'saldo');
    raise exception 'FALHOU: responsável criou pedido';
  exception when insufficient_privilege then
    null; -- esperado
  end;
end $$;

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

-- Saldo 0: pedido pago com saldo é recusado (sem fiado em pedido).
do $$
declare v_det text;
begin
  begin
    perform public.criar_pedido(current_setting('app.intervalo')::uuid, current_setting('app.amanha')::date,
      jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 1)), 'saldo');
    raise exception 'FALHOU: pedido com saldo insuficiente foi aceito';
  exception when others then
    get stacked diagnostics v_det = pg_exception_detail;
    if v_det is distinct from 'saldo_insuficiente' then raise; end if;
  end;
end $$;

-- Fora do prazo: depois de amanhã, ou intervalo que já fechou.
do $$
declare v_det text;
begin
  begin
    perform public.criar_pedido(current_setting('app.intervalo')::uuid, current_setting('app.amanha')::date + 1,
      jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 1)), 'pix');
    raise exception 'FALHOU: pedido para depois de amanhã foi aceito';
  exception when others then
    get stacked diagnostics v_det = pg_exception_detail;
    if v_det is distinct from 'pedido_fora_do_prazo' then raise; end if;
  end;

  begin
    perform public.criar_pedido(current_setting('app.intervalo_fechado')::uuid, current_setting('app.hoje')::date,
      jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 1)), 'pix');
    raise exception 'FALHOU: pedido para intervalo já fechado foi aceito';
  exception when others then
    get stacked diagnostics v_det = pg_exception_detail;
    if v_det is distinct from 'pedido_fora_do_prazo' then raise; end if;
  end;
end $$;

-- O próprio aluno compra crédito; a equipe confirma.
select set_config('app.pag_aluno',
  public.solicitar_credito(current_setting('app.aluno')::uuid, 1000) ->> 'pagamento_id', false);

do $$
begin
  begin
    perform public.confirmar_pagamento(current_setting('app.pag_aluno')::uuid);
    raise exception 'FALHOU: aluno confirmou o próprio pagamento';
  exception when insufficient_privilege then
    null; -- esperado
  end;
end $$;

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select public.confirmar_pagamento(current_setting('app.pag_aluno')::uuid);

-- Pedido pago com saldo: efetiva na hora, baixa estoque e vira venda de origem 'pedido'.
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select set_config('app.pedido_saldo',
  public.criar_pedido(current_setting('app.intervalo')::uuid, current_setting('app.amanha')::date,
    jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 1)), 'saldo')
  ->> 'pedido_id', false);

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare v_status text; v_origem text; v_estoque integer; v_saldo bigint;
begin
  select p.status::text, v.origem into v_status, v_origem
    from public.pedidos p join public.vendas v on v.id = p.venda_id
    where p.id = current_setting('app.pedido_saldo')::uuid;
  select quantidade into v_estoque from public.estoque where produto_id = current_setting('app.produto')::uuid;
  select saldo_centavos into v_saldo from public.saldos_alunos where aluno_id = current_setting('app.aluno')::uuid;
  if v_status <> 'pago' or v_origem <> 'pedido' then
    raise exception 'FALHOU: pedido com saldo deveria estar pago com venda de origem pedido (%, %)', v_status, v_origem;
  end if;
  if v_estoque <> 99 then raise exception 'FALHOU: pedido com saldo não baixou o estoque (veio %)', v_estoque; end if;
  if v_saldo <> 0 then raise exception 'FALHOU: saldo após pedido deveria ser 0, veio %', v_saldo; end if;
end $$;

-- Pedido com Pix: não mexe no estoque até o pagamento ser confirmado.
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select set_config('app.pedido_pix',
  public.criar_pedido(current_setting('app.intervalo')::uuid, current_setting('app.amanha')::date,
    jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 2)), 'pix')
  ->> 'pedido_id', false);

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select set_config('app.pag_pedido',
  (select id::text from public.pagamentos where pedido_id = current_setting('app.pedido_pix')::uuid), false);

do $$
declare v_estoque integer;
begin
  select quantidade into v_estoque from public.estoque where produto_id = current_setting('app.produto')::uuid;
  if v_estoque <> 99 then raise exception 'FALHOU: pedido Pix pendente reservou estoque (veio %)', v_estoque; end if;
end $$;

select public.confirmar_pagamento(current_setting('app.pag_pedido')::uuid);

do $$
declare v_status text; v_estoque integer; v_saldo bigint; v_creditos integer;
begin
  select status::text into v_status from public.pedidos where id = current_setting('app.pedido_pix')::uuid;
  select quantidade into v_estoque from public.estoque where produto_id = current_setting('app.produto')::uuid;
  select saldo_centavos into v_saldo from public.saldos_alunos where aluno_id = current_setting('app.aluno')::uuid;
  if public.confirmar_pagamento(current_setting('app.pag_pedido')::uuid) ->> 'status' <> 'ja_confirmado' then
    raise exception 'FALHOU: confirmação repetida do pedido não foi tratada como repetida';
  end if;
  select count(*) into v_creditos from public.movimentos_financeiros
    where pagamento_id = current_setting('app.pag_pedido')::uuid;
  if v_status <> 'pago' then raise exception 'FALHOU: pedido Pix confirmado deveria estar pago, veio %', v_status; end if;
  if v_estoque <> 97 then raise exception 'FALHOU: confirmação do Pix não baixou o estoque (veio %)', v_estoque; end if;
  if v_saldo <> 0 then raise exception 'FALHOU: Pix do pedido deveria entrar e sair do saldo (saldo %)', v_saldo; end if;
  if v_creditos <> 1 then raise exception 'FALHOU: pagamento gerou % créditos', v_creditos; end if;
end $$;

-- Estoque esgotado entre o pedido e o pagamento: pedido recusado, valor vira crédito.
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select set_config('app.pedido_sem_estoque',
  public.criar_pedido(current_setting('app.intervalo')::uuid, current_setting('app.amanha')::date,
    jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 1)), 'pix')
  ->> 'pedido_id', false);

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
update public.estoque set quantidade = 0 where produto_id = current_setting('app.produto')::uuid;

do $$
declare v_resultado jsonb; v_status text; v_saldo bigint;
begin
  v_resultado := public.confirmar_pagamento(
    (select id from public.pagamentos where pedido_id = current_setting('app.pedido_sem_estoque')::uuid));
  select status::text into v_status from public.pedidos where id = current_setting('app.pedido_sem_estoque')::uuid;
  select saldo_centavos into v_saldo from public.saldos_alunos where aluno_id = current_setting('app.aluno')::uuid;
  if v_resultado ->> 'status' <> 'pedido_recusado' or v_status <> 'recusado' then
    raise exception 'FALHOU: pedido sem estoque deveria ser recusado (%, %)', v_resultado ->> 'status', v_status;
  end if;
  if v_saldo <> 1000 then raise exception 'FALHOU: valor do pedido recusado deveria virar crédito (saldo %)', v_saldo; end if;
end $$;

update public.estoque set quantidade = 50 where produto_id = current_setting('app.produto')::uuid;

-- Pix não pago no prazo expira; se o dinheiro chegar depois, vira crédito.
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select set_config('app.pedido_expira',
  public.criar_pedido(current_setting('app.intervalo')::uuid, current_setting('app.amanha')::date,
    jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 1)), 'pix')
  ->> 'pedido_id', false);

reset role;
update public.pagamentos set expira_em = now() - interval '1 minute'
  where pedido_id = current_setting('app.pedido_expira')::uuid;
set local role authenticated;

select public.expirar_pendentes();

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare v_status text; v_resultado jsonb; v_saldo bigint; v_estoque integer;
begin
  select status::text into v_status from public.pedidos where id = current_setting('app.pedido_expira')::uuid;
  if v_status <> 'expirado' then raise exception 'FALHOU: pedido com Pix vencido deveria expirar, veio %', v_status; end if;

  v_resultado := public.confirmar_pagamento(
    (select id from public.pagamentos where pedido_id = current_setting('app.pedido_expira')::uuid));
  select saldo_centavos into v_saldo from public.saldos_alunos where aluno_id = current_setting('app.aluno')::uuid;
  select quantidade into v_estoque from public.estoque where produto_id = current_setting('app.produto')::uuid;
  if v_resultado ->> 'status' <> 'pedido_expirado' then
    raise exception 'FALHOU: Pix confirmado após o prazo deveria manter o pedido expirado, veio %', v_resultado ->> 'status';
  end if;
  if v_saldo <> 2000 then raise exception 'FALHOU: Pix atrasado deveria virar crédito (saldo %)', v_saldo; end if;
  if v_estoque <> 50 then raise exception 'FALHOU: pedido expirado baixou estoque (veio %)', v_estoque; end if;
end $$;

-- Pedido conta no limite mensal (gasto do mês: 2000 balcão + 1000 + 2000 de pedidos).
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select public.definir_limite_mensal(current_setting('app.aluno')::uuid, 5000);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare v_det text;
begin
  begin
    perform public.criar_pedido(current_setting('app.intervalo')::uuid, current_setting('app.amanha')::date,
      jsonb_build_array(jsonb_build_object('produto_id', current_setting('app.produto'), 'quantidade', 1)), 'saldo');
    raise exception 'FALHOU: pedido acima do limite mensal foi aceito';
  exception when others then
    get stacked diagnostics v_det = pg_exception_detail;
    if v_det is distinct from 'limite_mensal_excedido' then raise; end if;
  end;
end $$;

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select public.definir_limite_mensal(current_setting('app.aluno')::uuid, null);

-- Retirada: a equipe marca como entregue, e não dá para finalizar de novo.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select public.finalizar_pedido(current_setting('app.pedido_saldo')::uuid, true);

do $$
declare v_det text;
begin
  if (select status::text from public.pedidos where id = current_setting('app.pedido_saldo')::uuid) <> 'entregue' then
    raise exception 'FALHOU: pedido não ficou como entregue';
  end if;
  begin
    perform public.finalizar_pedido(current_setting('app.pedido_saldo')::uuid, false);
    raise exception 'FALHOU: pedido entregue foi finalizado de novo';
  exception when others then
    get stacked diagnostics v_det = pg_exception_detail;
    if v_det is distinct from 'pedido_invalido' then raise; end if;
  end;
end $$;

-- Cancelar a venda de um pedido encerra o pedido e estorna.
select public.cancelar_venda(
  (select venda_id from public.pedidos where id = current_setting('app.pedido_pix')::uuid), 'Teste pedido');

do $$
declare v_status text; v_saldo bigint;
begin
  select status::text into v_status from public.pedidos where id = current_setting('app.pedido_pix')::uuid;
  select saldo_centavos into v_saldo from public.saldos_alunos where aluno_id = current_setting('app.aluno')::uuid;
  if v_status <> 'cancelado' then raise exception 'FALHOU: pedido da venda cancelada ficou %', v_status; end if;
  if v_saldo <> 4000 then raise exception 'FALHOU: estorno do pedido cancelado (saldo %)', v_saldo; end if;
end $$;

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Isolamento entre contas
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
do $$
declare v_alunos integer; v_mov integer; v_vendas integer; v_itens integer; v_pedidos integer; v_pag integer;
begin
  select count(*) into v_pedidos from public.pedidos;
  select count(*) into v_pag from public.pagamentos;
  if v_pedidos <> 0 or v_pag <> 0 then
    raise exception 'FALHOU: conta sem vínculo enxergou pedidos (%) ou pagamentos (%)', v_pedidos, v_pag;
  end if;
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
