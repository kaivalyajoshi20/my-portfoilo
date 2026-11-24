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

The form submits to `POST /api/messages`. The endpoint checks the same-origin request, JSON content type, field lengths, email format, a hidden honeypot, and a minimum completion time before inserting a message into `public.contact_messages`. The dashboard uses a signed, eight-hour Secure, HttpOnly, SameSite=Strict cookie for authenticated API requests to list, update and permanently delete messages. Mutating admin routes validate the request Origin. Delete actions require confirmation.

The contact endpoint also limits submissions to 5 per 10 minutes per client fingerprint. Admin sign-in limits failed attempts to 5 per 15 minutes. The limits use a keyed HMAC of Cloudflare's client IP header; raw client IP addresses are not stored by this rate-limit table. The `public.api_rate_limits` table is created by `migrations/001_api_rate_limits.sql`. Old counters are cleaned up periodically. For higher-risk public launches, add Cloudflare Turnstile and review provider-level abuse controls as well.

## Database

The Neon database schema is already applied. The `public.contact_messages` table stores sender name, email, optional subject, message, creation time, and inbox status.

## Status

The Pages deployment requires the encrypted production variables `DATABASE_URL`, `ADMIN_PASSWORD` and `SESSION_SECRET`. The contact form and inbox should be end-to-end tested after each production configuration change. Do not treat the form as operational until a test message appears in `/admin.html` on the Cloudflare Pages domain.


## Security maintenance

The repository includes `SECURITY_AUDIT.md` with a 20-point review and remaining operational actions. Dependabot checks npm dependencies weekly, and GitHub Actions runs a scheduled production-dependency audit. The admin session token is not exposed to browser JavaScript or stored in browser web storage; it is held in an HttpOnly cookie.

Enable multi-factor authentication on the Cloudflare, GitHub and Neon accounts that can change production code or infrastructure. Confirm the admin password is unique and strong, and that `SESSION_SECRET` is generated randomly with at least 32 random bytes.
