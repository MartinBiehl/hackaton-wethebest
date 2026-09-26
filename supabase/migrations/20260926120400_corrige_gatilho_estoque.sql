-- Correção: o gatilho que cria a linha de estoque de um produto novo rodava
-- com os privilégios de quem inseriu o produto. A equipe tem INSERT em
-- public.produtos, mas não em public.estoque (e não deve ter: a baixa de
-- estoque é responsabilidade das funções de venda), então cadastrar produto
-- falhava com "permission denied for table estoque".
--
-- SECURITY DEFINER resolve mantendo o grant mínimo: a função é dona da
-- inserção, não o cliente. Ela não recebe parâmetros do chamador além da
-- linha recém-inserida, só grava a quantidade zero e tem search_path fixo.

create or replace function public.criar_estoque_do_produto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.estoque (produto_id, quantidade)
  values (new.id, 0)
  on conflict (produto_id) do nothing;
  return new;
end;
$$;
