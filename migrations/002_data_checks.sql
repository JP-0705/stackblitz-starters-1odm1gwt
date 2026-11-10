-- 002: protections in the database itself (not only in the browser).
-- "NOT VALID" = existing rows are not checked, but new and edited rows are.
--
-- STEP 1 — run these queries FIRST. They should return NO rows.
--   If any row comes back, fix those rows first; otherwise they can no longer
--   be edited after this migration.
--
--   select id from public.assets where id !~ '^IPHL[A-Z]*-[A-Z0-9-]+$';
--   select id, qty, unit_price, amount from public.assets
--    where qty < 0 or unit_price < 0 or amount < 0;
--
-- STEP 2 — then run the rest of this file:

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'assets_id_format') then
    -- Accepts IPHLNAGA-00001, IPHLMAKATI-00001 and the old IPHL-APP-001 style.
    -- Spaces, lowercase letters and unusual symbols are not allowed.
    alter table public.assets
      add constraint assets_id_format check (id ~ '^IPHL[A-Z]*-[A-Z0-9-]+$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assets_qty_nonnegative') then
    alter table public.assets add constraint assets_qty_nonnegative check (qty >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assets_price_nonnegative') then
    alter table public.assets add constraint assets_price_nonnegative
      check (unit_price >= 0 and amount >= 0) not valid;
  end if;
end $$;

insert into public.schema_migrations(name) values ('002_data_checks') on conflict do nothing;
