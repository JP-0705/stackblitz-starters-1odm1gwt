# INNOVPHIL Asset Portal

HTML + JavaScript + Supabase. Walang build step.

## Deploy sa Vercel
1. I-upload ang folder na ito sa private GitHub repo, tapos i-import sa Vercel (Framework: "Other", walang build command).
2. Ang `vercel.json` ang naglalagay ng security headers. Ang `.vercelignore` ay pumipigil na ma-publish ang `tests/` at `migrations/`.
3. Sa Supabase → Authentication → URL Configuration, ilagay ang Vercel URL mo sa Site URL at Redirect URLs.

## Database (Supabase SQL Editor) — sundin ang pagkakasunod-sunod
Tingnan kung alin na ang naipatakbo: `select * from public.schema_migrations order by applied_at;`
1. `migrations/000_migration_log.sql`
2. `migrations/001_dispose_missing_and_permissions.sql`
3. `migrations/002_data_checks.sql` (basahin ang HAKBANG 1 sa itaas ng file bago patakbuhin)
Kapag may bagong pagbabago sa database, gumawa ng bagong file (`003_...`) at huwag nang galawin ang luma.

## Backup (kada linggo)
Table Editor → Export to CSV: `assets`, `asset_edit_history`, `asset_counts`, `count_history`. I-save sa Drive na may petsa.
Hindi kasama ang mga litrato sa `asset-images`.

## Mga test (opsyonal, para sa developer)
```
cd tests && npm install && npx playwright install chromium
npm run test:all
```
Gumagamit ang mga test ng pekeng Supabase; hindi nila ginagalaw ang totoong database.
