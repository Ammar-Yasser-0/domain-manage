# DomainFlow manual setup checklist

Only these steps require account access or credentials.

## Neon

1. Create or select the Neon project and a production branch. Create a separate preview/development branch if previews will use a database.
2. Copy the pooled PostgreSQL connection string for the correct branch. Keep it private.
3. For local setup, run `npm run auth:setup` in an interactive terminal. Type a password of at least 12 characters twice; input is hidden, the plaintext is never written to disk, and the command stores only its scrypt hash plus a generated session secret in the ignored `.env` file. It refuses to overwrite existing authentication values.
4. Add the local Neon pooled connection string to `.env` as `DATABASE_URL`. Then apply the migrations:

   ~~~powershell
   npm run db:migrate
   ~~~

   The migration runner serializes concurrent runs, records applied migration filenames, and wraps each migration plus its record in a transaction. It safely recognizes the existing `001_create_domainflow_tables.sql` schema and applies `002_auth_login_attempts.sql` without modifying or deleting domain records. For production, use a one-time migration run against the production Neon connection before the first custom-auth deployment.

## Vercel environment variables

Add these server-side variables in **Settings → Environment Variables** for every environment that should run the app. Never prefix them with `VITE_`:

- `DATABASE_URL` — pooled Neon connection string for that environment.
- `APP_PASSWORD_HASH` — copy the generated value from local `.env`; it contains the salted scrypt hash, not the password.
- `SESSION_SECRET` — copy the generated random value from local `.env`.

Do not commit `.env` or paste the plaintext password into Vercel. Use the same `APP_PASSWORD_HASH` and `SESSION_SECRET` in Production, Preview, and Development only if you intentionally want one shared password and shared session signing key. After changing either auth value, existing sessions become invalid and users must log in again.

## GitHub and Vercel

1. Confirm the GitHub repository is `Ammar-Yasser-0/domain-manage` and its production branch is `main`.
2. In Vercel, choose **Add New → Project**, import that repository, and set **Root Directory** to the repository root.
3. Set the framework to **Vite**, install command to `npm ci`, build command to `npm run build`, and output directory to `dist`.
4. Keep the existing **Vercel Authentication** setting enabled with **All Deployments** while deploying and verifying this custom login. Do not disable it during development or deployment. Do not enable shareable links, automation bypasses, or public exceptions for this private app.
5. In **Settings → Environment Variables**, add `DATABASE_URL`, `APP_PASSWORD_HASH`, and `SESSION_SECRET` separately for Production, Preview, and Development as applicable. Use the matching Neon branch for each environment.
6. Apply the migration to the production Neon branch before deploying the custom-auth code.

## Verify privacy before using real data

1. Open the deployment in a signed-out private browser. The Vercel authentication gate should appear first.
2. Sign in with the Vercel account that has access. The DomainFlow password-only login should appear; enter the password used to generate `APP_PASSWORD_HASH`.
3. Confirm the dashboard loads and `/api/domains` returns JSON only after the custom password login. In a separate signed-out context, confirm protected API routes return `401` after passing Vercel's gate.
4. Confirm login throttling, logout, and session expiry behave as expected. Check **Security → Deployment Protection** and verify **Vercel Authentication → All Deployments** is still enabled.
5. Only after the custom login and API protections are confirmed, disable Vercel Authentication if you want the custom login to be the only visible gate. Keep deployment protection enabled until that verification is complete.
6. Add or edit real domain records only after protection and the authenticated API request work.

Vercel announced All Deployments Vercel Authentication protection at no additional cost on every plan on September 9, 2026. Review the current [Deployment Protection documentation](https://vercel.com/docs/deployment-protection) and [availability announcement](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan) if the dashboard shows different options.
