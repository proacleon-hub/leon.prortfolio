import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { SITE_URL, WP_HOSTS } from "./site";

// WordPress scripts that the Next.js site doesn't need (jQuery, Elementor
// runtime, emoji, Astra, Google tags that the layout loads once).
const DROP_SCRIPT_IDS = new Set([
  "jquery-js-after",
  "google_gtagjs-js-after",
  "astra-theme-js-js-extra",
  "jquery-ui-core-js-before",
  "elementor-frontend-js-before",
  "wp-emoji-settings",
]);

function shouldDropScript($el: cheerio.Cheerio<Element>): boolean {
  const type = ($el.attr("type") || "").toLowerCase();
  if (type === "application/ld+json") return false; // handled separately
  if ($el.attr("src")) return true;
  if (DROP_SCRIPT_IDS.has($el.attr("id") || "")) return true;
  if (type === "speculationrules" || type === "application/json") return true;
  const code = $el.html() || "";
  if (/wp-emoji-settings/.test(code)) return true;
  if (/\bgtag\(/.test(code) && /dataLayer/.test(code)) return true;
  if (/\(trident\|msie\)/.test(code)) return true; // old IE skip-link fix
  return false;
}

const hostPattern = new RegExp(
  "(" + WP_HOSTS.map((h) => h.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|") + ")",
  "g",
);
// Same, but also matching JSON-escaped slashes (https:\/\/junayedleon.tech).
const escapedHostPattern = new RegExp(
  "(" + WP_HOSTS.map((h) => h.replace(/\//g, "\\/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")",
  "g",
);

// Protocol-relative WordPress URLs (//cms.junayedleon.tech/...), e.g. in Yoast's sitemap XSL link.
const protocolRelativePattern = new RegExp(
  "(?<![:\\w])(" + WP_HOSTS.map((h) => h.replace(/^https?:/, "").replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|") + ")(?=[/\"'])",
  "g",
);

/** Point every WordPress URL at the public site address. */
export function toPublicUrls(s: string): string {
  return s
    .replace(protocolRelativePattern, SITE_URL.replace(/^https?:/, ""))
    .replace(hostPattern, SITE_URL).replace(escapedHostPattern, SITE_URL.replace(/\//g, "\\/"));
}

/** Make links relative so the site also works on preview domains. */
function toRelative(s: string): string {
  const esc = SITE_URL.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return s.replace(new RegExp(esc + "(?=/)", "g"), "").replace(new RegExp(esc + "(?=[\"'#?\\s]|$)", "g"), "/");
}


// Head tags WordPress prints that the public site doesn't need.
const DROP_HEAD = [
  'meta[name="generator"]',
  'link[rel="EditURI"]',
  'link[rel="https://api.w.org/"]',
  'link[rel="dns-prefetch"][href*="w.org"]',
  'link[rel="profile"]',
];

// Only these attributes carry URLs we make relative. Meta tags, canonical and
// JSON-LD keep absolute public URLs, as search engines expect.
const URL_ATTRS = ["href", "src", "srcset", "action", "poster", "data-src", "data-srcset", "style"];

function gaSnippet(ids: string[]): string {
  const cfg = ids.map((id) => `gtag("config",${JSON.stringify(id)});`).join("");
  return (
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${ids[0]}"></script>` +
    `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}` +
    `gtag("set","linker",{"domains":["junayedleon.tech"]});gtag("js",new Date());${cfg}</script>`
  );
}

/**
 * Take a page exactly as WordPress rendered it and return the document the
 * public site serves: same markup, styles (in the same order) and the site's
 * own scripts, with WordPress-only extras (jQuery, Elementor runtime, emoji,
 * duplicate SEO tags) removed and URLs pointing at the public site.
 */
export function toDocument(rawHtml: string, opts: { gaIds: string[] }): string {
  const $ = cheerio.load(toPublicUrls(rawHtml));

  $("script").each((_, node) => {
    const el = $(node);
    if (shouldDropScript(el)) el.remove();
  });
  $(DROP_HEAD.join(",")).remove();

  // WordPress prints some SEO tags twice; the first one (Yoast) wins.
  const seen = new Set<string>();
  $("head meta[name], head meta[property], head link[rel=canonical]").each((_, node) => {
    const el = $(node);
    const key = el.attr("name") || el.attr("property") || "canonical";
    if (key.startsWith("og:image:") || key.startsWith("article:tag")) return;
    if (seen.has(key)) el.remove();
    else seen.add(key);
  });

  const skip = (el: Element) =>
    el.tagName === "meta" || (el.tagName === "link" && /canonical|alternate|shortlink/i.test(el.attribs.rel || ""));
  $("*").each((_, node) => {
    const el = node as Element;
    if (skip(el)) return;
    for (const a of URL_ATTRS) if (el.attribs[a]) el.attribs[a] = toRelative(el.attribs[a]);
  });
  $("style").each((_, node) => {
    const el = $(node);
    el.text(toRelative(el.text()));
  });
  $("script:not([type='application/ld+json'])").each((_, node) => {
    const el = $(node);
    const code = el.html() || "";
    if (code.includes(SITE_URL)) el.text(toRelative(code));
  });

  $("head").append(gaSnippet(opts.gaIds));
  return "<!DOCTYPE html>\n" + $.html().replace(/^<!DOCTYPE html>\s*/i, "");
}
