-- 003: new fields from the Excel file (Department, Supplier, Warranty) and Witnessed By for counts.
-- Safe to run again. Run this BEFORE deploying the new code.

alter table public.assets
  add column if not exists department         text,
  add column if not exists supplier           text,
  add column if not exists supplier_contact   text,
  add column if not exists supplier_address   text,
  add column if not exists warranty_months    integer,
  add column if not exists warranty_expiration date;

alter table public.count_history
  add column if not exists witnessed_by text;

-- Database protection (checks new and edited rows only; existing rows are not checked)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'assets_warranty_nonnegative') then
    alter table public.assets
      add constraint assets_warranty_nonnegative check (warranty_months is null or warranty_months >= 0) not valid;
  end if;
end $$;

insert into public.schema_migrations(name) values ('003_new_fields') on conflict do nothing;
