# Portfolio inbox deployment

The public portfolio can be published as static files on GitHub Pages, but GitHub Pages does not execute the `functions/api` backend. The inbox API must be deployed to a serverless host that supports Cloudflare Pages Functions.

## Backend files

- `functions/api/messages.js`: authenticated inbox listing API
- `functions/api/messages/[id].js`: authenticated message-status updates
- `functions/api/messages/auth.js`: admin password login
- `admin.html`: private inbox UI
- `package.json`: Neon serverless PostgreSQL driver

## Deploy on Cloudflare Pages

1. Create a Cloudflare Pages project connected to this GitHub repository.
2. Use the repository root as the project root and no framework preset. Set the build command to `npm install` and the output directory to `.`.
3. In Pages project settings, add these **server-side environment variables** for production:
   - `DATABASE_URL`: Neon connection string for the `portfolio` database.
   - `ADMIN_PASSWORD`: a strong, unique password for the dashboard.
   - `SESSION_SECRET`: a long random secret (at least 32 random bytes).
4. Redeploy after adding variables.
5. Visit `/admin.html` on the Cloudflare Pages deployment.

Never put these values in `index.html`, `admin.html`, any committed file, or a public issue. Keep the Neon connection string in the host's encrypted environment-variable settings only.

## Current limitation

The inbox dashboard and authenticated read/status API are scaffolded. The public portfolio currently has a GitHub contact link rather than a message form; add and test a public form endpoint before expecting visitors to submit messages into the database. GitHub Pages alone cannot host the API.
