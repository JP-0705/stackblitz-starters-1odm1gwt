-- 004: Forms (Asset Issuance, Asset Turnover, Borrower's Form) and the Borrowers Tracker.
-- Safe to run again. Run this BEFORE deploying the new code.
--
-- Who can use it: ADMIN and ACCOUNTING only (the forms hold employee details).
-- Viewers cannot read, add or change anything here.
-- Forms are never deleted. A wrong form is marked VOID so the control number stays on record.

create table if not exists public.asset_forms (
  id                   uuid primary key default gen_random_uuid(),
  form_type            text not null,
  control_no           text not null,
  status               text not null default 'SAVED',
  employee_name        text not null,
  designation          text,
  department           text,
  employee_id          text,
  form_date            date,            -- Issuance Date / Return Date / Date Borrowed
  by_party             text,            -- Issued by (PROPERTY / MIS) or Returned To
  assets               jsonb not null default '[]'::jsonb,
  reasons              jsonb not null default '[]'::jsonb,
  reason_other         text,
  mis_findings         text,
  property_findings    text,
  usage_type           text,            -- Borrower: INTERNAL / EXTERNAL
  purpose              text,
  expected_return_date date,
  date_returned        date,
  created_by           text,
  created_at           timestamptz not null default now(),
  updated_by           text,
  updated_at           timestamptz not null default now()
);

-- Database protection
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'asset_forms_type_check') then
    alter table public.asset_forms
      add constraint asset_forms_type_check check (form_type in ('ISSUANCE', 'TURNOVER', 'BORROWER'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'asset_forms_status_check') then
    alter table public.asset_forms
      add constraint asset_forms_status_check check (status in ('SAVED', 'BORROWED', 'RETURNED', 'VOID'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'asset_forms_usage_check') then
    alter table public.asset_forms
      add constraint asset_forms_usage_check check (usage_type is null or usage_type in ('INTERNAL', 'EXTERNAL'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'asset_forms_assets_is_array') then
    alter table public.asset_forms
      add constraint asset_forms_assets_is_array check (jsonb_typeof(assets) = 'array' and jsonb_array_length(assets) <= 20);
  end if;
end $$;

-- A control number can only be used once per form type.
create unique index if not exists asset_forms_type_control_uniq on public.asset_forms (form_type, control_no);
create index if not exists asset_forms_type_date_idx on public.asset_forms (form_type, form_date desc);
create index if not exists asset_forms_borrower_status_idx on public.asset_forms (status) where form_type = 'BORROWER';

alter table public.asset_forms enable row level security;

drop policy if exists "Forms select" on public.asset_forms;
create policy "Forms select" on public.asset_forms
  for select to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('ADMIN', 'ACCOUNTING'));

drop policy if exists "Forms insert" on public.asset_forms;
create policy "Forms insert" on public.asset_forms
  for insert to authenticated
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('ADMIN', 'ACCOUNTING'));

drop policy if exists "Forms update" on public.asset_forms;
create policy "Forms update" on public.asset_forms
  for update to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('ADMIN', 'ACCOUNTING'))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('ADMIN', 'ACCOUNTING'));

-- No delete policy on purpose: nobody can delete a form through the website.

insert into public.schema_migrations(name) values ('004_forms') on conflict do nothing;

-- Make Supabase notice the new table right away (otherwise it can take a few minutes).
notify pgrst, 'reload schema';
