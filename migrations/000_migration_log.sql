-- 000: talaan ng mga SQL na naipatakbo na (para hindi ka malito kung alin na).
-- Patakbuhin ito UNA, isang beses lang (ligtas kahit ulitin).
create table if not exists public.schema_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);
-- Naka-on ang RLS at WALANG policy: walang makakabasa/makakasulat nito sa pamamagitan ng app.
-- Ang SQL Editor lang (ikaw bilang may-ari) ang nakakakita.
alter table public.schema_migrations enable row level security;
insert into public.schema_migrations(name) values ('000_migration_log') on conflict do nothing;
-- Para makita kung alin na ang naipatakbo:  select * from public.schema_migrations order by applied_at;
