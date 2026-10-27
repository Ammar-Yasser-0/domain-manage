# DomainFlow manual setup checklist

Only these steps require account access or credentials.

## Neon

1. Create or select the Neon project and a production branch. Create a separate preview/development branch if previews will use a database.
2. Copy the pooled PostgreSQL connection string for the correct branch. Keep it private.
3. For local migration setup, copy `.env.example` to `.env` and replace the placeholder `DATABASE_URL` locally. Then run:

   ~~~powershell
   npm run db:migrate
   ~~~

   The migration is idempotent and can be run again safely. For production, add the production connection string in Vercel instead of committing it.

## GitHub and Vercel

1. Confirm the GitHub repository is `Ammar-Yasser-0/domain-manage` and its production branch is `main`.
2. In Vercel, choose **Add New → Project**, import that repository, and set **Root Directory** to the repository root.
3. Set the framework to **Vite**, install command to `npm ci`, build command to `npm run build`, and output directory to `dist`.
4. Before triggering a deployment, open the Vercel project and go to **Security → Deployment Protection** (some dashboard layouts show this under **Settings**). Choose **Vercel Authentication** and **All Deployments**. Do not enable shareable links, automation bypasses, or public exceptions for this private app.
5. In the project, open **Settings → Environment Variables** and add `DATABASE_URL` separately for Production, Preview, and Development as applicable. Use the matching Neon branch for each environment.
6. Apply the migration to the production Neon branch before the first production deployment.

## Verify privacy before using real data

1. Open the deployment in a signed-out private browser. The Vercel authentication gate should appear.
2. Visit the deployment's `/api/domains` path while signed out. It should show the same gate, not application JSON.
3. Sign in with the Vercel account that has access to the project. The dashboard should load, and `/api/domains` should return JSON.
4. In **Security → Deployment Protection**, confirm the saved scope still reads **All Deployments** and there are no public exceptions or shareable links.
5. Add real domain records only after protection and the signed-in API request both work.

Vercel announced All Deployments Vercel Authentication protection at no additional cost on every plan on September 9, 2026. Review the current [Deployment Protection documentation](https://vercel.com/docs/deployment-protection) and [availability announcement](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan) if the dashboard shows different options.
