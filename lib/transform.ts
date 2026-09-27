import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { SITE_URL, WP_HOSTS } from "./site";

export type StyleItem =
  | { kind: "link"; key: string; href: string; media?: string }
  | { kind: "inline"; key: string; css: string };

export type MetaData = {
  title?: string;
  description?: string;
  robots?: string;
  canonical?: string;
  og: Record<string, string>;
  ogImage?: { url: string; width?: number; height?: number; type?: string };
  twitter: Record<string, string>;
  article: Record<string, string>;
  author?: string;
  icons: { rel: string; href: string; sizes?: string }[];
};

export type PageData = {
  lang: string;
  bodyClass: string;
  styles: StyleItem[];
  jsonLd: string[];
  bodyHtml: string;
  meta: MetaData;
};

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

/** Point every WordPress URL at the public site address. */
export function toPublicUrls(s: string): string {
  return s.replace(hostPattern, SITE_URL).replace(escapedHostPattern, SITE_URL.replace(/\//g, "\\/"));
}

/** Make links relative so the site also works on preview domains. */
function toRelative(s: string): string {
  const esc = SITE_URL.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return s.replace(new RegExp(esc + "(?=/)", "g"), "").replace(new RegExp(esc + "(?=[\"'#?\\s]|$)", "g"), "/");
}

function stripVersion(href: string): string {
  // Keep ?ver= for cache-busting, only fix HTML entities.
  return href.replace(/&#038;|&amp;/g, "&");
}

export function transform(rawHtml: string): PageData {
  const html = toPublicUrls(rawHtml);
  const $ = cheerio.load(html);

  const meta: MetaData = { og: {}, twitter: {}, article: {}, icons: [] };
  const styles: StyleItem[] = [];
  const jsonLd: string[] = [];
  const seen = new Set<string>();

  // ---- <head>: title, meta, styles, structured data ----
  $("head")
    .children()
    .each((i, node) => {
      const el = $(node);
      const tag = (node as Element).tagName?.toLowerCase();
      if (tag === "title") {
        meta.title ??= el.text();
      } else if (tag === "meta") {
        const name = el.attr("name");
        const prop = el.attr("property");
        const content = el.attr("content") ?? "";
        // WordPress prints some tags twice; the first one (Yoast) wins.
        if (name === "description") meta.description ??= content;
        else if (name === "robots") meta.robots ??= content;
        else if (name === "author") meta.author ??= content;
        else if (name?.startsWith("twitter:")) meta.twitter[name.slice(8)] ??= content;
        else if (prop === "og:image") meta.ogImage ??= { url: content };
        else if (prop?.startsWith("og:image:") && meta.ogImage) {
          const k = prop.slice(9);
          if (k === "width" || k === "height") meta.ogImage[k] ??= Number(content);
          else if (k === "type") meta.ogImage.type ??= content;
        } else if (prop?.startsWith("og:")) meta.og[prop.slice(3)] ??= content;
        else if (prop?.startsWith("article:")) meta.article[prop.slice(8)] ??= content;
      } else if (tag === "link") {
        const rel = (el.attr("rel") || "").toLowerCase();
        const href = el.attr("href");
        if (!href) return;
        if (rel === "stylesheet") {
          const key = el.attr("id") || href;
          if (seen.has(key)) return;
          seen.add(key);
          const media = el.attr("media");
          styles.push({ kind: "link", key, href: toRelative(stripVersion(href)), media: media && media !== "all" ? media : undefined });
        } else if (rel === "canonical") meta.canonical ??= href;
        else if (rel === "icon" || rel === "apple-touch-icon")
          meta.icons.push({ rel, href, sizes: el.attr("sizes") });
      } else if (tag === "style") {
        const css = el.html() || "";
        if (!css.trim()) return;
        const key = el.attr("id") || "inline-" + i;
        styles.push({ kind: "inline", key, css: toRelative(css) });
      } else if (tag === "script" && (el.attr("type") || "").toLowerCase() === "application/ld+json") {
        jsonLd.push((el.html() || "").trim());
      }
    });

  // ---- <body>: keep the page markup and the site's own scripts ----
  const body = $("body");
  const bodyClass = body.attr("class") || "";

  body.find("script").each((_, node) => {
    const el = $(node);
    if ((el.attr("type") || "").toLowerCase() === "application/ld+json") {
      jsonLd.push((el.html() || "").trim());
      el.remove();
    } else if (shouldDropScript(el)) {
      el.remove();
    }
  });
  // Stylesheets WordPress prints late in <body> (e.g. the blog template CSS)
  // stay where they are, but point at relative URLs.
  const bodyHtml = toRelative(body.html() || "");

  return {
    lang: $("html").attr("lang") || "en-US",
    bodyClass,
    styles,
    jsonLd,
    bodyHtml,
    meta,
  };
}
