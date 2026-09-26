-- Dados de desenvolvimento.
--
-- A CLI executa este arquivo em `supabase db reset` (banco local com Docker).
-- Como o projeto usa o Supabase remoto, aplique-o manualmente quando quiser
-- popular o catálogo: cole o conteúdo no SQL Editor do painel.
--
-- Não crie usuários aqui: contas nascem pelo Auth, e o papel `equipe` é
-- concedido manualmente (veja docs/DATABASE.md).

insert into public.produtos (nome, descricao, preco_centavos, ativo)
select v.nome, v.descricao, v.preco_centavos, true
from (values
  ('Salgado assado', 'Unidade do dia', 800::bigint),
  ('Suco natural 300ml', 'Laranja ou maracujá', 600::bigint),
  ('Refrigerante lata', null, 500::bigint),
  ('Bolo fatia', 'Sabor do dia', 700::bigint),
  ('Sanduíche natural', null, 1200::bigint)
) as v(nome, descricao, preco_centavos)
where not exists (
  select 1 from public.produtos p where lower(btrim(p.nome)) = lower(btrim(v.nome))
);

-- O gatilho de produtos cria a linha de estoque zerada; aqui damos unidades.
update public.estoque e
  set quantidade = 20
  from public.produtos p
  where p.id = e.produto_id and e.quantidade = 0;
