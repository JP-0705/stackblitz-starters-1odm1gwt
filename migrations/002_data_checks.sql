-- 002: proteksyon sa mismong database (hindi lang sa browser).
-- "NOT VALID" = hindi sinusuri ang MGA LUMANG row, pero sinusuri ang bago at ang mga na-edit.
--
-- HAKBANG 1 — patakbuhin MUNA ang tatlong query na ito. Dapat WALANG lumabas na row.
--   Kung may lumabas, ayusin muna ang mga row na iyon, kung hindi ay hindi na
--   mae-edit ang mga ito pagkatapos ng migration na ito.
--
--   select id from public.assets where id !~ '^IPHL[A-Z]*-[A-Z0-9-]+$';
--   select id, qty, unit_price, amount from public.assets
--    where qty < 0 or unit_price < 0 or amount < 0;
--
-- HAKBANG 2 — saka patakbuhin ang bahaging ito:

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'assets_id_format') then
    -- Tumatanggap ng IPHLNAGA-00001, IPHLMAKATI-00001 at ng luma mong IPHL-APP-001.
    -- Bawal ang espasyo, maliit na letra at kakaibang simbolo.
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
