# CODEYAAR security review

Review date: 25 November 2026  
Scope: repository source, Cloudflare Pages project settings, and the Neon `portfolio` database. This is a code/configuration review, not a penetration test or certification.

## 20-point checklist

| # | Control | Result | Evidence / follow-up |
|---:|---|---|---|
| 01 | SQL injection | **Verified in code** | Database statements use Neon tagged-template parameters for user-controlled values; no SQL string concatenation was found in the reviewed API handlers. |
| 02 | XSS | **Verified in code, CSP could be stronger** | Admin message fields and public GitHub repository fields are HTML-escaped before insertion into markup. The site also sends a Content Security Policy, but it currently permits inline scripts and styles. |
| 03 | CSRF protection | **Improved in this review** | Admin sessions now use a Secure, HttpOnly, SameSite=Strict cookie. Contact submissions and inbox mutations validate the request Origin. The login and logout routes also validate Origin. Confirm the new production deployment and test the form and inbox after it finishes. |
| 04 | File uploads | **Not applicable** | No file-upload endpoint or upload flow exists in the current site. Reassess before adding uploads. |
| 05 | SSRF protection | **Not applicable to current API** | No server-side fetch of user-supplied URLs was found. The portfolio fetches public GitHub repository data from the visitor's browser. Reassess if server-side URL fetching is introduced. |
| 06 | BOLA / IDOR | **Verified for current single-admin model** | Message read, update and delete routes require the admin session. The application has one private inbox and no per-customer or multi-tenant records. Add object-level ownership checks if that data model changes. |
| 07 | Rate limiting | **Verified in code and database** | Contact submissions are limited to 5 per 10 minutes; failed admin sign-ins are limited to 5 per 15 minutes. Counters use keyed HMAC fingerprints rather than storing raw IPs in the rate-limit table. |
| 08 | Password hashing | **Not applicable to stored user passwords; admin secret still needs review** | The site does not create user accounts or store user passwords. The single admin password is held as a Cloudflare secret and compared at runtime; it is not a database password hash. Keep it long, unique and unreused. |
| 09 | MFA protection | **Missing / manual action required** | No application MFA flow is implemented. Cloudflare account settings currently report account-level two-factor enforcement disabled. Enable MFA on the Cloudflare account and any GitHub/Neon accounts with production access. |
| 10 | Server-side permissions | **Verified in code** | Inbox listing, status updates and deletion are authorized in Pages Functions; hiding the admin HTML page is not relied upon as the access control. |
| 11 | RLS (Row-Level Security) | **Not enabled; not currently a public data-access path** | Neon reports RLS disabled on `contact_messages` and `api_rate_limits`. Catalog grants show only the `portfolio_owner` role has table privileges. The app accesses the database only through server-side functions. Do not enable RLS without first introducing a least-privilege runtime role and testing policies; enable it if direct client access or multiple data owners are introduced. |
| 12 | JWT / session secret | **Verified in code/config** | Admin sessions are HMAC-SHA-256 signed with the server-side `SESSION_SECRET`, expire after 8 hours, and are now placed in an HttpOnly cookie. The signing secret is configured as a Cloudflare secret. |
| 13 | API keys | **Verified for browser exposure** | No private API key is embedded in the public HTML. Cloudflare production secrets are configured for the database, admin password and session signing. Secret values are masked and were not inspected. |
| 14 | No LocalStorage tokens | **Improved / verified in code** | Admin authentication no longer stores a token in localStorage or sessionStorage. The browser receives only the HttpOnly session cookie; old sessionStorage token values are cleared on page load. |
| 15 | Default credentials | **Source clear; secret values unverified** | No default admin password or signing secret is hard-coded in the repository. Cloudflare confirms the secret variables exist, but their values are masked; confirm they are unique, non-default and high entropy. |
| 16 | CORS policy | **Verified for current same-origin API** | The API does not emit permissive Access-Control-Allow-Origin headers. Mutating routes require the exact request origin. Keep the API same-origin unless a specific cross-origin client is deliberately added. |
| 17 | Webhook signatures | **Not applicable** | No inbound webhook endpoint exists in the current application. Verify provider signatures before adding one. |
| 18 | Source maps | **Not applicable to current build** | The site is static HTML/CSS/JavaScript and does not bundle or generate source maps. Reassess if a bundler or minification pipeline is introduced. |
| 19 | Clean production logs | **Partial / operational action required** | The reviewed application code does not log contact message contents or passwords. Cloudflare has no account-level Logpush job configured, and no 180-day central log-retention evidence was available. Configure appropriate provider logs/retention and an incident-response contact if required for your operating obligations. |
| 20 | Dependencies | **Improved; audit workflow pending first run** | The Neon serverless driver is pinned to 1.2.1. Dependabot weekly npm updates and a scheduled `npm audit --omit=dev --audit-level=high` workflow were added. There is no committed lockfile; the workflow generates an audit lockfile during CI. A successful workflow run is still required before calling this fully verified. |

## Changes made in this review

- Replaced JavaScript-readable admin bearer-token storage with a Secure, HttpOnly, SameSite=Strict session cookie.
- Added Origin validation to admin login, logout, inbox status changes and message deletion.
- Added bounded JSON body validation to the inbox status-update route.
- Pinned `@neondatabase/serverless` to 1.2.1.
- Added Dependabot and a scheduled production-dependency audit workflow.

## Remaining actions

1. Enable MFA on Cloudflare, GitHub and Neon accounts used to administer production.
2. Confirm `ADMIN_PASSWORD` is long, unique and not reused, and that `SESSION_SECRET` is randomly generated with at least 32 random bytes.
3. Confirm the dependency-audit workflow passes and consider committing a generated lockfile for reproducible installs.
4. Decide whether applicable operational requirements call for 180-day log retention and a named incident-response contact; configure provider logging accordingly.
5. End-to-end test admin login, refresh persistence, logout, message status changes, deletion and the public contact form after the new deployment completes.
6. Reassess RLS, BOLA, file upload and webhook controls if the product gains accounts, multiple users, uploads or integrations.

