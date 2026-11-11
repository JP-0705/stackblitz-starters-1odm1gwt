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
5. `migrations/004_forms.sql` (Forms: Asset Issuance, Asset Turnover, Borrower's Form and the Borrowers Tracker) — run BEFORE deploying the code

For any future database change, add a new numbered file (`005_...`) and never edit an old one.

## Backup (weekly)
Table Editor → Export to CSV: `assets`, `asset_edit_history`, `asset_counts`, `count_history`. Save the files to Drive with the date in the name.
Photos in the `asset-images` bucket are not included in the CSV export.

## Tests (optional, for developers)
```
cd tests && npm install && npx playwright install chromium
npm run test:all
```
The tests use a fake Supabase and never touch the real database.


## Forms (Issuance, Turnover, Borrower's Form)

- Page: `/forms/` (Admin and Accounting only; Viewers cannot see it, and the database blocks them too).
- Printing uses the company's own PDF forms in `forms/templates/`. The system only writes the typed
  data onto them. To change a form, replace the PDF there and, if boxes moved, adjust the numbers in
  `shared/form-pdf.js` (`FORM_PDF_LAYOUT`).
- If the PDF library cannot load, Print falls back to a built-in copy of the form.
- Forms are never deleted. A wrong form is marked VOID so its control number stays on record.
- New Issuance forms (with the option ticked, which is the default) set each listed asset's Issued To = the employee, Status = IN USE (and Department). New Turnover forms set Issued To = the storage location typed in "Returned To" and Status = AVAILABLE. The user is shown the exact changes and must confirm; each change is written to the asset's history. Editing or voiding a saved form never changes assets, and Borrower's Forms never do.
- On the Turnover form, typing the employee's name lists the units currently issued to them.
