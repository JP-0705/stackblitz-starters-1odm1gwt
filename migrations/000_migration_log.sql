-- 000: a log of which migrations have already been run (so you never have to guess).
-- Run this FIRST, once (safe to run again).
create table if not exists public.schema_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);
-- RLS is on and there is NO policy, so nobody can read or write this table through the app.
-- Only the SQL Editor (you, as the owner) can see it.
alter table public.schema_migrations enable row level security;
insert into public.schema_migrations(name) values ('000_migration_log') on conflict do nothing;
-- To see which migrations have run:  select * from public.schema_migrations order by applied_at;
