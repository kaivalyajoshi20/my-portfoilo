# CODEYAAR — Digital Studio

A responsive, editorial-style website for CODEYAAR, an independent digital studio exploring the space between design and engineering.

## Features
- Minimal, warm editorial layout inspired by modern independent studio portfolios
- Responsive navigation and mobile-friendly sections
- Studio profiles for Kaivalya Joshi and Gauravi
- Live public project list sourced from the CODEYAAR GitHub account
- Services, current focus, capabilities and contact sections
- Cloudflare Pages Functions contact form and existing admin inbox
- SEO and social preview metadata, custom SVG favicon
- Reduced-motion support and accessible form status messages

## Local preview
Open `index.html` in a browser, or use a static file server.

## Build and deploy
Cloudflare Pages is connected to the `main` branch of this repository. The Pages build runs `npm run build` and publishes the `dist` directory. The build copies the frontend, local profile images, and the `functions/` directory so the contact API remains available.

The contact form posts to `/api/messages`. Keep `DATABASE_URL`, `ADMIN_PASSWORD`, and `SESSION_SECRET` configured as encrypted Cloudflare Pages production environment variables. Never commit those secrets.

## Content notes
The project section lists public repositories from GitHub. Update team descriptions and service details as the studio's work evolves.
