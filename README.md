# TEAME Sales Projection

A complete Vercel-ready web app with optional Supabase authentication and private cloud persistence. CSV and XLSX uploads, mapping validation, searchable paginated reports, and Excel download.

## Run locally
1. Install Node.js 22 or newer.
2. Open a terminal in this folder.
3. Run `npm ci`.
4. Run `npm run dev` and open the displayed localhost URL.

The full projection workflow works without Supabase. Data remains in memory for the current browser session. Nothing is saved automatically. Download the report before closing, or configure cloud saving below.

## Input files
Use the downloadable templates in the app, also in `public/templates/`.

**Item master:** `Item ID | Product Id`

**Sales report:** `Product Id | Order Date | SKU ID | Gross Units | Cancellation Units | Final Sale Units`

One Product Id must map to exactly one Item ID. Multiple Product IDs may share an Item ID. Repeated identical master mappings are deduplicated. IDs are case-sensitive. Keep ID columns as text in Excel to preserve leading zeroes. Headers ignore case, spaces, underscores, and hyphens. The first Excel worksheet is read, with headers in its first row. Use numeric whole units without thousands separators. The order date is retained as source information and is not used as a filter. Empty rows are ignored; invalid rows block the entire upload with a row number. Limits: 15 MB per file and 50,000 data rows. Save older `.xls` files as `.xlsx` first.

Each upload replaces the current file. Sales rows are not deduplicated because the source has no unique Order ID; repeated product/date rows may be legitimate orders. Ensure your source report does not contain repeated exports or subtotal rows.

## Projection and download
- Product detail groups by Product Id + SKU ID and maps each group to Item ID.
- Gross Units(total) is the sum of uploaded Gross Units.
- Projected unit = CEILING(Gross Units(total) × 1.25).
- Cancellation Units and Final Sale Units are retained but do not affect the calculation.
- Unmapped Product IDs remain visible and block export until mapped.
- The Excel download has Product detail, Item totals, and Read me worksheets.
- Item totals sums Gross Units across all products/SKUs for each Item ID and then calculates the uplift. Whole-unit rounding means its projection may differ from the sum of rounded product-detail rows.
- Search affects the screen only; download always includes the entire report.
- Master items without sales do not appear in the report.
- This is a 25% uplift of the entire uploaded period, not a time-normalized monthly forecast or a statistical prediction.

## Supabase setup
1. Create a Supabase project.
2. Open SQL Editor and run all of `supabase/schema.sql`.
3. In project API settings, copy the project URL and publishable key (the legacy anon key also works). Never use a secret or service-role key in this app.
4. Copy `.env.example` to `.env` and enter the two values. Restart the local dev server.
5. Enable Email authentication. For an internal app, create the intended users in Supabase Authentication, then disable public sign-ups. Otherwise users can use Create account in the app; email confirmation follows your Supabase configuration.
6. In Authentication URL Configuration, set Site URL to your deployed Vercel URL and add your local development URL if you need local confirmation links.
7. Sign in, upload your files, and choose Save workspace. On another device, sign in and choose Load saved.

Cloud data is a single JSON workspace per authenticated user with row-level security. Users cannot read or overwrite another user's workspace. Saves replace the previously saved workspace atomically. No team sharing or version history is implemented. The last save wins if two devices edit the same account. Uploaded raw files are not stored, only validated rows and filenames. Workspace payloads have a 25 MB database limit. Supabase and account-specific service limits also apply.

## Deploy to Vercel
1. Upload the contents of this folder to your own Git repository, excluding node_modules, dist, and .env.
2. Import the repository in Vercel. If this folder is nested, select it as Root Directory.
3. Select Vite. Build command: `npm run build`. Output directory: `dist`. Node.js: 22 or newer.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel project environment variables.
5. Deploy, then configure the Supabase Site URL as above. Redeploy after any environment-variable changes.

No separate backend server is needed. All file processing happens in the browser; authenticated cloud saves use Supabase HTTPS APIs.

## Verification
`npm test` checks aggregation, item rollups, mapping conflicts, missing mappings, duplicate master pairs, and invalid unit values. `npm run build` creates the production build. Automated file tests exercise CSV and XLSX parsing and the generated Excel workbook. Browser visual verification was unavailable in the build environment, so test the upload/download flow once after deployment. Live Supabase authentication and RLS must be smoke-tested against your own configured project; credentials are not supplied in this package.

Official setup references:
- https://vercel.com/docs/frameworks/frontend/vite
- https://vercel.com/docs/environment-variables
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/passwords
