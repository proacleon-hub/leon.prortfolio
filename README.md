# junayedleon.tech — Next.js front end

The public site runs on Next.js (Vercel). WordPress stays as the content
backend: pages and posts are still written and edited in WordPress, and
Next.js draws them with the same markup, styles and scripts, so the design,
fonts, colours and animations match the WordPress site exactly.

## How it works

- `app/[[...slug]]/route.ts` serves every route (`/`, `/services/`,
  `/insights/<post>/`, …). It asks WordPress for the page (`lib/wp.ts`) and
  cleans it into the final HTML document (`lib/transform.ts`). No React
  runtime is shipped, so pages are lighter than the WordPress originals.
- Pages are static and refresh from WordPress every 5 minutes (ISR), so new
  posts and edits show up without a redeploy.
- `snapshot/` holds a saved copy of every page. If WordPress can't be reached,
  the site serves the saved copy instead of going down.
- Yoast titles, descriptions, Open Graph, canonical URLs and JSON-LD schema are
  carried over per page. Yoast XML sitemaps and feeds are proxied
  (`proxy.ts`, `app/api/wp-proxy`), `robots.txt` comes from `app/robots.ts`.
- Images and theme files under `/wp-content/` are served from WordPress, so
  every existing media URL keeps working.
- WordPress's jQuery/Elementor/emoji scripts are dropped; the site's own
  scripts (theme toggle, mobile menu, scroll animations, carousels, filters,
  FAQ accordions, WhatsApp contact form) are kept as they are.

## Settings

| Variable     | Default                     | Meaning                                  |
|--------------|-----------------------------|------------------------------------------|
| `SITE_URL`   | `https://junayedleon.tech`  | Public address used in canonical/OG tags |
| `WP_ORIGIN`  | `https://junayedleon.tech`  | Where WordPress is reachable             |
| `WP_SOURCE`  | (unset)                     | `snapshot` = never call WordPress        |

## Run locally

```bash
npm install
npm run dev            # http://localhost:3000
WP_SOURCE=snapshot npm run build   # offline build from the saved copy
```

## Launch checklist (in order)

1. Import this repo into Vercel (framework: Next.js, no extra settings).
   Check the `*.vercel.app` preview against the live site.
2. Create the DNS record `cms.junayedleon.tech` pointing at the current
   WordPress server, and get HTTPS working on it.
3. In WordPress, change Settings → General (WordPress Address and Site
   Address) to `https://cms.junayedleon.tech`, and set the Vercel variable
   `WP_ORIGIN=https://cms.junayedleon.tech`. Redeploy.
4. Point `junayedleon.tech` and `www` at Vercel (Vercel shows the exact records).
5. Add a Yoast/robots rule so `cms.junayedleon.tech` itself is not indexed.
6. Re-submit `https://junayedleon.tech/sitemap_index.xml` in Search Console.

Steps 2–5 change the live site and need the owner's go-ahead.
