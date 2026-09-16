# TEAME Sales Projection

A Vercel-ready internal sales projection module with mandatory Supabase email/password login, a persistent one-time item master, separate Flipkart and Website upload formats, adjustable projection percentage, case-pack rounding, and item-wise Excel download.

## Workflow

1. Sign in with a Supabase user account.
2. Upload the item master once. It is saved privately in Supabase and loads automatically at future logins.
3. Select **Flipkart** or **Website**.
4. Upload the matching previous-sales report.
5. Enter the projection percentage.
6. Review the item-wise projection.
7. Download the final Excel report.

## Item master

Required columns:

`Product Id | Item Id | Case Pack`

Example case packs can be 12, 18, 24, or 36. Any positive whole-number case pack is supported.

Rules:
- One Product Id can map to only one Item Id.
- An Item Id must have one consistent Case Pack.
- Multiple Product IDs may map to the same Item Id.
- The master is stored against the signed-in Supabase user.
- The UI includes a **Replace master** option for controlled future updates, but daily sales uploads do not require re-uploading the master.

## Flipkart upload

Required columns:

`Product Id | Item Id | Gross Units`

The app validates both Product Id and Item Id against the saved master, then aggregates Gross Units by Item Id.

## Website upload

Required columns:

`Item Id | Gross Units`

The app validates Item Id against the saved master and aggregates Gross Units by Item Id.

## Projection calculation

For each Item Id:

1. Sum Gross Units.
2. Apply the percentage entered by the user.
3. Round **up** to the next complete Case Pack from the saved master.

Formula:

`Raw projection = Gross Units × (1 + Percentage / 100)`

`Final projected unit = CEILING(Raw projection / Case Pack) × Case Pack`

Example:

- Gross Units: 100
- Projection: 25%
- Case Pack: 12
- Raw projection: 125
- Final projected unit: 132

The final screen and downloaded workbook use:

`Item Id | Gross Units(total) | Projection Percentage | Projected Unit`

## Supabase setup

### 1. Run the database schema

Open **Supabase > SQL Editor** and run all of:

`supabase/schema.sql`

This creates the `projection_masters` table with Row Level Security. Each user can access only their own saved master.

### 2. Create login users

In Supabase:

**Authentication > Users > Add user**

Create each authorized user's email and password. The application does not offer public account creation.

### 3. Environment variables

Local development: copy `.env.example` to `.env` and fill in:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Never use a service-role key in this Vite browser application.

In Vercel add the same two values under:

**Project > Settings > Environment Variables**

Then redeploy.

## Run locally

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

## Deploy to Vercel

1. Push this project to GitHub.
2. Import the repository into Vercel.
3. Framework preset: Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add the two Supabase environment variables.
7. Deploy.
8. Create the authorized login users in Supabase Authentication.

## Verification

```bash
npm test
npm run build
```

The test suite covers master validation, source-file validation, aggregation, custom percentage uplift, and case-pack rounding.
