# Portfolio deployment

## What's in this repo

- `index.html`: public portfolio, including the contact form
- `functions/api/messages.js`: public contact submission plus authenticated inbox listing
- `functions/api/messages/auth.js`: admin password login
- `functions/api/messages/[id].js`: authenticated message status updates
- `admin.html`: inbox dashboard
- `package.json`: Neon serverless PostgreSQL driver

## Important: use Cloudflare Pages for the working form and inbox

GitHub Pages only serves static files. It does not run the `functions/api` serverless API, so the contact form and admin dashboard will not work on a GitHub Pages-only deployment. The repository's GitHub Pages workflow may continue to publish a static preview, but use the Cloudflare Pages URL for the complete app.

## One-time Cloudflare setup

1. Sign in to Cloudflare and open **Workers & Pages → Create → Pages → Connect to Git**.
2. Choose the GitHub repository `kaivalyajoshi20/my-portfoilo` and the `main` branch.
3. Use the repository root, choose **None** for framework preset, set build command to `npm install`, and set build output directory to `.`.
4. In the Pages project settings, add these as **encrypted/server-side production environment variables**:
   - `DATABASE_URL`: connection string for the Neon `portfolio` database in project `kaivalya-portfolio`.
   - `ADMIN_PASSWORD`: a strong, unique dashboard password.
   - `SESSION_SECRET`: a cryptographically random secret with at least 32 random bytes.
5. Save the settings and trigger a new deployment. Environment variable changes require a redeploy.
6. Open the deployed site's `/admin.html` path and sign in with `ADMIN_PASSWORD`.

Do not commit these values or put them in either HTML file. Never paste the Neon connection string into a public issue or commit.

## Contact form behavior

The form submits to `POST /api/messages`. The endpoint checks the same-origin request, JSON content type, field lengths, email format, a hidden honeypot, and a minimum completion time before inserting a message into `public.contact_messages`. The dashboard uses authenticated API requests to list messages and change their status.

This is basic spam resistance, not a full rate-limiting service. Before promoting the site widely, consider enabling Cloudflare Turnstile and/or a rate-limiting rule for `POST /api/messages`.

## Database

The Neon database schema is already applied. The `public.contact_messages` table stores sender name, email, optional subject, message, creation time, and inbox status.

## Status

The code and schema are committed, but a live Cloudflare Pages deployment and end-to-end test still require a Cloudflare account/project and its private environment variables. Do not treat the form as live until a test message appears in `/admin.html` on the Cloudflare Pages domain.
