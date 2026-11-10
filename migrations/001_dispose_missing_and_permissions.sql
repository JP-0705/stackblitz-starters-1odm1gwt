-- =====================================================================
-- INNOVPHIL Asset Portal — database update (run ONCE in Supabase SQL Editor)
-- Safe to run more than once. Run this BEFORE deploying the new code.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PART 1: Dispose + Missing columns
-- ---------------------------------------------------------------------
alter table public.assets
  add column if not exists disposal_reason     text,
  add column if not exists disposal_date       date,
  add column if not exists disposal_remarks    text,
  add column if not exists is_missing          boolean not null default false,
  add column if not exists missing_date        date,
  add column if not exists missing_last_holder text,
  add column if not exists missing_remarks     text,
  add column if not exists missing_marked_by   text,
  add column if not exists missing_marked_at   timestamptz;

-- Items that were "deleted" before this update become Disposed (reason unknown).
update public.assets
   set disposal_reason = 'UNSPECIFIED (previously deleted)',
       disposal_date   = coalesce(deleted_at::date, current_date)
 where is_deleted = true
   and disposal_reason is null;

-- ---------------------------------------------------------------------
-- PART 2: edit history = permanent + trustworthy
--   * nobody can edit or delete history rows
--   * only Admin/Accounting can add rows, and only under their OWN email
--   * Accounting can read it (needed for the Monthly Report)
-- ---------------------------------------------------------------------
drop policy if exists "Admin update history" on public.asset_edit_history;
drop policy if exists "Admin delete history" on public.asset_edit_history;
drop policy if exists "Any authenticated can insert history" on public.asset_edit_history;
drop policy if exists "Admin/Accounting insert history" on public.asset_edit_history;
create policy "Admin/Accounting insert history" on public.asset_edit_history
  for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'ACCOUNTING')
    and edited_by = (auth.jwt() ->> 'email')
  );

drop policy if exists "Accounting read edit history" on public.asset_edit_history;
create policy "Accounting read edit history" on public.asset_edit_history
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ACCOUNTING');

-- ---------------------------------------------------------------------
-- PART 3: count history = permanent, and signed with the real email
-- ---------------------------------------------------------------------
drop policy if exists "Admin update" on public.count_history;
drop policy if exists "Admin delete" on public.count_history;
drop policy if exists "Admin/Accounting insert" on public.count_history;
create policy "Admin/Accounting insert" on public.count_history
  for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'ACCOUNTING')
    and counted_by = (auth.jwt() ->> 'email')
  );

-- ---------------------------------------------------------------------
-- PART 4: Accounting can re-save a count for the same date
-- ---------------------------------------------------------------------
drop policy if exists "Accounting update counts" on public.asset_counts;
create policy "Accounting update counts" on public.asset_counts
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ACCOUNTING')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ACCOUNTING');

-- ---------------------------------------------------------------------
-- PART 5: only Admin/Accounting can upload / replace / remove asset photos
-- ---------------------------------------------------------------------
drop policy if exists "Authenticated upload asset images" on storage.objects;
drop policy if exists "Authenticated update asset images" on storage.objects;
drop policy if exists "Admin/Accounting upload asset images" on storage.objects;
drop policy if exists "Admin/Accounting update asset images" on storage.objects;
drop policy if exists "Admin/Accounting delete asset images" on storage.objects;

create policy "Admin/Accounting upload asset images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'asset-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'ACCOUNTING'));

create policy "Admin/Accounting update asset images" on storage.objects
  for update to authenticated
  using (bucket_id = 'asset-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'ACCOUNTING'))
  with check (bucket_id = 'asset-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'ACCOUNTING'));

create policy "Admin/Accounting delete asset images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'asset-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'ACCOUNTING'));

-- ---------------------------------------------------------------------
-- PART 6: update_asset_remarks — close the "no role = allowed" loophole
--   (NULL NOT IN (...) is NULL, which IF treats as false, so a user with no
--    role used to slip through the check.)
-- ---------------------------------------------------------------------
create or replace function public.update_asset_remarks(p_asset_id text, p_remarks text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('ADMIN', 'ACCOUNTING') then
    raise exception 'Not authorized to update remarks';
  end if;

  update public.assets
     set remarks = p_remarks
   where id = p_asset_id
     and coalesce(is_deleted, false) = false;

  if not found then
    raise exception 'Asset not found (or already disposed): %', p_asset_id;
  end if;
end;
$$;

revoke all on function public.update_asset_remarks(text, text) from public, anon;
grant execute on function public.update_asset_remarks(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- CHECK (optional): should list the new columns
-- ---------------------------------------------------------------------
-- select column_name from information_schema.columns
--  where table_schema='public' and table_name='assets'
--    and column_name in ('is_missing','disposal_reason','disposal_date','disposal_remarks');

-- Record that this migration has run
insert into public.schema_migrations(name) values ('001_dispose_missing_and_permissions') on conflict do nothing;
