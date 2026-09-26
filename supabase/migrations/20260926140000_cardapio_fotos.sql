-- Cardápio: foto do produto e disponibilidade visível no portal.
--
-- A foto fica no Storage, no bucket público "produtos": são imagens do
-- cardápio, sem dado pessoal, e o portal as exibe pela URL pública. Só a
-- equipe envia, troca ou apaga arquivos. A tabela guarda apenas o caminho.
--
-- O estoque de produtos ativos passa a ser legível por qualquer usuário
-- logado, para o cardápio mostrar "disponível" ou "esgotado" e o aluno só
-- encomendar o que existe. A escrita continua exclusiva da equipe.

alter table public.produtos
  add column foto_path text check (foto_path is null or length(foto_path) <= 300);

comment on column public.produtos.foto_path is
  'Caminho do arquivo no bucket "produtos" do Storage (ex.: <produto_id>/<arquivo>.webp). NULL = sem foto.';

-- ---------------------------------------------------------------------------
-- Bucket de fotos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública é servida pela URL do bucket; estas políticas cobrem a API.
create policy "produtos_fotos_select_equipe"
  on storage.objects for select to authenticated
  using (bucket_id = 'produtos' and public.e_equipe());

create policy "produtos_fotos_insert_equipe"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos' and public.e_equipe());

create policy "produtos_fotos_update_equipe"
  on storage.objects for update to authenticated
  using (bucket_id = 'produtos' and public.e_equipe())
  with check (bucket_id = 'produtos' and public.e_equipe());

create policy "produtos_fotos_delete_equipe"
  on storage.objects for delete to authenticated
  using (bucket_id = 'produtos' and public.e_equipe());

-- ---------------------------------------------------------------------------
-- Estoque visível no cardápio
-- ---------------------------------------------------------------------------

create policy "estoque_select_ativos"
  on public.estoque for select to authenticated
  using (
    exists (
      select 1 from public.produtos p
      where p.id = estoque.produto_id and p.ativo
    )
  );
