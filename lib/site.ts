// Public address of the site (what visitors and Google see).
export const SITE_URL = (process.env.SITE_URL || "https://junayedleon.tech").replace(/\/$/, "");

// Where WordPress lives: the CMS subdomain, so the public domain can point
// at Next.js. Set WP_ORIGIN=https://junayedleon.tech to read the old address.
export const WP_ORIGIN = (process.env.WP_ORIGIN || "https://cms.junayedleon.tech").replace(/\/$/, "");

// Every host WordPress may print in its HTML. All of them are mapped to SITE_URL.
export const WP_HOSTS = Array.from(
  new Set([WP_ORIGIN, "https://junayedleon.tech", "https://www.junayedleon.tech", "https://cms.junayedleon.tech"]),
);

// How often (seconds) a page is refreshed from WordPress.
export const REVALIDATE = 300;

// Google Analytics / Site Kit tags that WordPress printed.
export const GA_IDS = ["GT-NB9BF8NS", "G-R54Y1NXE92"];

// Pages we know about at build time. Anything else under /insights/ is
// rendered on first request, so new posts appear without a redeploy.
export const KNOWN_ROUTES = [
  "/",
  "/services/",
  "/cases/",
  "/insights/",
  "/sitemap/",
  "/privacy-policy/",
];

// Widths the image optimiser may produce (must match next.config.ts images.deviceSizes).
export const IMAGE_WIDTHS = [640, 828, 1080, 1200, 1920, 2048];
// High enough that photos look the same as the originals.
export const IMAGE_QUALITY = 85;

// Phones are sent to this hidden path prefix (see next.config.ts), so they can
// get their own lighter version of each page, cached separately from the
// desktop version. Visitors never see it in the address bar.
export const PHONE_PREFIX = "jl-phone";
