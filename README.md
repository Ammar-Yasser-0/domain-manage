# DomainFlow

DomainFlow is a private, single-user dashboard for tracking domain expiration dates. It uses React, Vite, TypeScript, Tailwind CSS, Lucide icons, Vercel Functions, and Neon PostgreSQL.

DomainFlow keeps a renewal schedule. It does not contact registrars, renew domain registrations, send notifications, or store registrar credentials.

## Features

- Add, edit, and delete domain renewal records.
- Search instantly and filter by Active, Expiring soon, or Expired.
- Sort by the closest upcoming expiration; expired domains follow upcoming dates, with the least overdue first.
- Renew for 1, 2, 3, or 5 years, or enter a custom whole number from 1 to 99.
- Preview the new expiration date before saving. The extension is added to the saved expiration date and clamps leap days to February 28 when the target year is not a leap year.
- Keep a renewal history with the prior and new expiration date, renewal period, and recorded time.
- Export every domain and its current status to CSV.
- Store expiration dates as PostgreSQL DATE values and evaluate status using the Africa/Cairo calendar date.
- Prevent duplicate domain names regardless of letter case.

## Domain status rules

| Status | Rule |
|---|---|
| Expired | The expiration date is before today's Africa/Cairo date. |
| Expiring soon | The date is today or up to 30 calendar days away. |
| Active | More than 30 calendar days remain. |

Status is calculated from the saved expiration date and is not stored in the database.

## Local development

Requirements: Node.js 20.19 or newer and npm.

1. Install the exact, lockfile-pinned packages:

~~~powershell
npm ci
~~~

The project approves only the reviewed `esbuild@0.28.2` install script. Its hook verifies the platform binary against the SHA-256 hash published in the package and prepares the executable. No global npm script policy is enabled.

2. Copy `.env.example` to `.env` and set `DATABASE_URL` to a Neon PostgreSQL connection string. The migration script reads this local file when present; Vite and Vercel Dev load their development environment files as usual. Keep it server-only; never rename it to a `VITE_` variable or commit `.env`.

3. Apply the initial database migration:

~~~powershell
npm run db:migrate
~~~

The migration is idempotent and creates the domains and renewal_history tables plus indexes. Run it before starting the app. Add future schema changes as new forward migrations instead of editing an already-applied migration.

4. Run the frontend:

~~~powershell
npm run dev
~~~

The Vite server runs the frontend only. To exercise the Vercel Functions locally, install or use the Vercel CLI, link this checkout to the intended Vercel project, and run:

~~~powershell
npx vercel dev
~~~

Vercel Authentication protects deployed URLs. A local server does not receive that platform gate; keep development local and use non-sensitive data.

## Database

Create a Neon PostgreSQL project and copy its pooled connection string into DATABASE_URL. For the application, use a separate Neon branch for previews and development so preview changes do not touch production records. Use the production branch for the production Vercel environment.

Required Vercel environment variable:

| Variable | Scope | Purpose |
|---|---|---|
| DATABASE_URL | Server only | Neon PostgreSQL connection string used by Vercel Functions and the migration script. |

Do not set a VITE_DATABASE_URL or otherwise expose this value to client-side JavaScript. API queries use parameterized statements. Renewal updates and history insertion are one atomic PostgreSQL statement, so a failed history insert also rolls back the date update.

The schema is in migrations/001_create_domainflow_tables.sql. Domain deletion also deletes that domain's renewal history.

## Vercel setup

1. Import the GitHub repository as a Vercel project and set the root directory to the repository root.
2. Select the Vite framework preset, `npm ci` as the install command, `npm run build` as the build command, and `dist` as the output directory. The package's Node engine range is compatible with Vercel's current Node.js 24 default.
3. Add `DATABASE_URL` to the appropriate production, preview, and development environments. Use separate Neon branches for preview/development and production.
4. Apply the production migration before the first deployment that uses the database.
5. In the Vercel project, open **Security → Deployment Protection** (or **Settings → Deployment Protection** in dashboard layouts that place it there). Select **Vercel Authentication** and set the scope to **All Deployments**. This protects production, preview, and generated deployment URLs, including their API requests.
6. Grant project access only to the authorized Vercel account. Do not create shareable links, automation bypasses, or public exceptions for this private dashboard.
7. Verify protection before adding real records: in a signed-out private browser, the deployment and `/api/domains` must both show the Vercel authentication gate; after signing in with an authorized account, the dashboard should load and `/api/domains` should return JSON.

All Deployments protection with Vercel Authentication is currently available on all plans, according to Vercel's September 9, 2026 changelog. Vercel Hobby is for personal, non-commercial use; use Pro when DomainFlow is used for commercial work. Review the current plan terms and usage limits before deployment.

Deployment Protection is a Vercel project setting and is not encoded in this repository. The application does not add a second password login. Do not deploy real data until the project-level Vercel Authentication setting is active.

The SPA fallback in `vercel.json` uses a negative lookahead to leave `/api` and `/api/*` outside the rewrite. Vercel's API function routes therefore keep their own handlers while browser page routes load `index.html`.

## GitHub integration

The project is designed to live at the root of the existing GitHub repository. In Vercel, choose **Add New → Project**, import `Ammar-Yasser-0/domain-manage`, and verify that the production branch is `main`. Vercel can build from GitHub pushes after the project is connected. Keep `DATABASE_URL` in Vercel's Environment Variables, never in GitHub Actions files, source code, or committed `.env` files.

If importing the repository triggers a deployment automatically, configure and verify **All Deployments** protection before connecting the repository or keep the project paused until protection is set.

## Production release sequence

1. Create the Vercel project and enable Vercel Authentication with **All Deployments** protection.
2. Add the production Neon connection string as the `DATABASE_URL` production environment variable.
3. Run `npm run db:migrate` against the production Neon branch before the first application deployment.
4. Verify the protection gate while signed out and the dashboard/API while signed in.
5. Confirm the Vercel project uses `main` for production and that the latest successful build corresponds to the reviewed commit.
6. Add real domain records only after the above checks pass.

## Troubleshooting

- **The dashboard shows “database is not configured”:** Set `DATABASE_URL` in the Vercel project for the deployment's environment, then redeploy.
- **The API returns a database error after configuration:** Confirm the URL belongs to the intended Neon branch, the branch is available, and migration `001` completed successfully.
- **A local Vite page cannot load `/api/*`:** Vite serves only the frontend. Run `npx vercel dev` from the linked project directory to exercise Vercel Functions locally.
- **A domain returns a conflict:** Domain names are normalized to lowercase and are unique without regard to case. Check the existing record before trying another spelling.
- **A direct page refresh returns 404:** Confirm the deployed `vercel.json` includes the SPA fallback rewrite and that its negative lookahead excludes `/api` paths.
- **A signed-out user can open a deployment:** In the correct Vercel project, check Security → Deployment Protection, confirm Vercel Authentication and All Deployments are selected, remove any exception or shareable link, and retest in a private browser.
- **The migration command exits before connecting:** Confirm `DATABASE_URL` is set in the current PowerShell session and includes the Neon connection's SSL requirement.

## API

| Method | Path | Behavior |
|---|---|---|
| GET | /api/domains | List all domains and return today's Africa/Cairo date. |
| POST | /api/domains | Create a domain. |
| PUT | /api/domains/:id | Update its name and expiration date. |
| DELETE | /api/domains/:id | Delete a domain and its renewal history. |
| POST | /api/domains/:id/renew | Extend the saved expiration date and add a history record. |
| GET | /api/domains/:id/history | List renewal history. |
| GET | /api/exports/domains | Download all domains as CSV. |

API errors use a consistent JSON shape with a machine-readable code and user-facing message. Validation occurs in both the browser and the API. The API does not enable cross-origin access; the frontend calls same-origin paths so Vercel Authentication applies to the UI and API.

## Checks

~~~powershell
npm ci
npm audit
npm audit --omit=dev
npm run typecheck
npm run lint
npm test
npm run build
~~~

The tests cover Cairo date selection, status boundaries, renewal date calculations (including leap years), API input validation, duplicate-domain conflict handling, and renewal query atomicity. Database-operation tests mock Neon; they do not replace a final live database test.

## Manual setup checklist

See [MANUAL-SETUP.md](./MANUAL-SETUP.md) for the short list of account, credential, and production verification steps that require your access.

## Project structure

- api/ — Vercel Functions.
- migrations/ — PostgreSQL schema migrations.
- scripts/migrate.ts — applies the SQL migration transactionally.
- src/components/ — dashboard, tables, and dialogs.
- src/lib/domain-date.ts — timezone-safe date and renewal rules.
- src/server/ — server-only Neon database access and domain operations.
- CONTEXT.md — canonical domain terms and system boundaries.

## Deployment and billing references

- Vercel Vite and Functions: https://vercel.com/docs/frameworks/frontend/vite
- Vercel Deployment Protection: https://vercel.com/docs/deployment-protection
- All Deployments availability announcement: https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan
- Vercel plan comparison and commercial-use note: https://vercel.com/pricing
- Neon serverless driver: https://neon.com/docs/serverless/serverless-driver
- Tailwind CSS with Vite: https://tailwindcss.com/docs/installation/using-vite
