# Supabase

`migrations/` guarda alterações versionadas do banco; `functions/` guarda Edge Functions opcionais.

A CLI executa `seed.sql` por padrão. Para organizar vários seeds em `seed/`, configure `db.seed.sql_paths` em `config.toml` antes de depender deles em `supabase start` ou `supabase db reset`.
