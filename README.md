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
  carried over per page. `robots.txt`, `llms.txt`, the XML sitemaps and feeds
  are passed through exactly as Yoast/WordPress make them.
- Instant refresh: the WordPress must-use plugin `jl-nextjs-bridge.php`
  (in `wordpress/`) pings `/api/revalidate/` on every save. That endpoint asks
  WordPress (`/wp-json/jl/v1/last-change`) whether anything really changed in
  the last 5 minutes before refreshing, so it needs no password.
- Images and theme files under `/wp-content/` are served from WordPress, so
  every existing media URL keeps working.
- WordPress's jQuery/Elementor/emoji scripts are dropped; the site's own
  scripts (theme toggle, mobile menu, scroll animations, carousels, filters,
  FAQ accordions, WhatsApp contact form) are kept as they are.

## Settings

| Variable     | Default                     | Meaning                                  |
|--------------|-----------------------------|------------------------------------------|
| `SITE_URL`   | `https://junayedleon.tech`  | Public address used in canonical/OG tags |
| `WP_ORIGIN`  | `https://cms.junayedleon.tech` | Where WordPress is reachable             |
| `WP_SOURCE`  | (unset)                     | `snapshot` = never call WordPress        |

## Run locally

```bash
npm install
npm run dev            # http://localhost:3000
WP_SOURCE=snapshot npm run build   # offline build from the saved copy
```

## Launch checklist (in order)

1. ✅ Import this repo into Vercel and check the `*.vercel.app` preview.
2. ✅ DNS record `cms` → 72.62.7.44 at Hostinger, and `cms.junayedleon.tech`
   added to the WordPress Traefik router (HTTPS by Let's Encrypt). Done 2026-09-28.
3. ✅ Install `wordpress/jl-nextjs-bridge.php` as a must-use plugin. On the cms
   address it makes WordPress use that address and sends `noindex`. WordPress's
   own settings stay `https://junayedleon.tech`, so nothing else changes.
4. ✅ Next.js reads WordPress from `https://cms.junayedleon.tech` (default of `WP_ORIGIN`).
5. Add `junayedleon.tech` and `www.junayedleon.tech` in Vercel → Domains.
6. With the owner's written go-ahead, change the Hostinger DNS records `@` and
   `www` to the values Vercel shows. Keep the `cms` record.
7. Re-submit `https://junayedleon.tech/sitemap_index.xml` in Search Console.

## Going back to the old site

WordPress is never removed and keeps `https://junayedleon.tech` as its address,
so going back is only a DNS change. At Hostinger (nameservers
`athena/apollo.dns-parking.com`), set these records back to their values from
before launch:

| Type | Name  | Points to    | TTL |
| ---- | ----- | ------------ | --- |
| A    | `@`   | `72.62.7.44` | 300 |
| A    | `www` | `72.62.7.44` | 300 |

A full WordPress backup (database, uploads, custom code) was taken on
2026-09-28 before any launch step.
