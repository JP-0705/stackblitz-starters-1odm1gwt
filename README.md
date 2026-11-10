# INNOVPHIL Asset Portal

HTML + JavaScript + Supabase. There is no build step.

## Deploying on Vercel
1. Upload this folder to a private GitHub repository, then import it in Vercel (Framework: "Other", no build command).
2. `vercel.json` adds the security headers. `.vercelignore` keeps `tests/` and `migrations/` from being published.
3. In Supabase, go to Authentication → URL Configuration and add your Vercel URL to the Site URL and Redirect URLs.

## Database (Supabase SQL Editor) — run in this order
Check which migrations have already run: `select * from public.schema_migrations order by applied_at;`
1. `migrations/000_migration_log.sql`
2. `migrations/001_dispose_missing_and_permissions.sql`
3. `migrations/002_data_checks.sql` (read STEP 1 at the top of the file before running it)
4. `migrations/003_new_fields.sql` (Department, Supplier, Warranty, Witnessed By) — run BEFORE deploying the code

For any future database change, add a new numbered file (`004_...`) and never edit an old one.

## Backup (weekly)
Table Editor → Export to CSV: `assets`, `asset_edit_history`, `asset_counts`, `count_history`. Save the files to Drive with the date in the name.
Photos in the `asset-images` bucket are not included in the CSV export.

## Tests (optional, for developers)
```
cd tests && npm install && npx playwright install chromium
npm run test:all
```
The tests use a fake Supabase and never touch the real database.
