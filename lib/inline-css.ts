import { REVALIDATE, SITE_URL, WP_ORIGIN } from "./site";
import { toPublicUrls } from "./transform";

// A current Chrome user agent, so Google Fonts answers with WOFF2 files,
// which every browser in use today understands.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

// Outside stylesheets that are safe to copy into the page. Their fonts keep
// loading from the original servers; only the CSS text moves.
const OUTSIDE_HOSTS = new Set(["fonts.googleapis.com", "cdnjs.cloudflare.com"]);

// Font families Elementor asks for by default that no text on the site uses
// (the browser never downloads them). Their stylesheets load without holding
// up the page instead of being copied in.
const UNUSED_FONTS = /fonts\.googleapis\.com\/css\?family=Roboto(\+Slab)?:/;

const LINK_TAG = /<link\b[^>]*\brel="stylesheet"[^>]*>/gi;

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}="([^"]*)"`, "i").exec(tag);
  return m ? m[1].replace(/&amp;/g, "&") : undefined;
}

type Source = { fetchUrl: string; baseUrl: string; local: boolean };

/** Where to fetch a stylesheet from, or null if it should stay a <link>. */
function sourceOf(href: string): Source | null {
  if (href.startsWith("/") && !href.startsWith("//")) {
    // Our own files (/wp-content/..., /wp-includes/...) live on WordPress.
    return { fetchUrl: WP_ORIGIN + href, baseUrl: SITE_URL + href, local: true };
  }
  try {
    const u = new URL(href);
    if (u.protocol === "https:" && OUTSIDE_HOSTS.has(u.hostname)) return { fetchUrl: u.href, baseUrl: u.href, local: false };
  } catch {}
  return null;
}

/** Point the stylesheet's relative url(...) references at where the files really are. */
function fixUrls(css: string, src: Source): string {
  if (src.local) css = toPublicUrls(css);
  css = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, q: string, ref: string) => {
    if (/^(data:|#)/i.test(ref)) return whole;
    try {
      const abs = new URL(ref, src.baseUrl);
      const out = abs.origin === SITE_URL ? abs.pathname + abs.search + abs.hash : abs.href;
      return `url(${q}${out}${q})`;
    } catch {
      return whole;
    }
  });
  return css.replace(/@charset\s+["'][^"']*["'];?/gi, "").replace(/<\/style/gi, "<\\/style");
}

async function fetchCss(src: Source): Promise<string | null> {
  try {
    const res = await fetch(src.fetchUrl, {
      headers: { "user-agent": BROWSER_UA, accept: "text/css,*/*;q=0.1" },
      next: { revalidate: REVALIDATE, tags: ["wp"] },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok || !/text\/css/i.test(res.headers.get("content-type") || "")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Load a stylesheet without holding up the first paint. */
function nonBlocking(tag: string): string {
  const media = attr(tag, "media") || "all";
  const withoutMedia = tag.replace(/\smedia="[^"]*"/i, "");
  return (
    withoutMedia.replace(/\/?>$/, ` media="print" onload="this.media='${media}'">`) +
    `<noscript>${tag}</noscript>`
  );
}

/**
 * Copies the page's stylesheets into the page itself, each at the exact spot
 * its <link> was, so the styles apply in the same order and the page looks
 * the same. Phones can then draw the page as soon as the page itself has
 * arrived, instead of first waiting for about 20 separate style files. A file
 * that can't be fetched stays a normal <link>.
 */
export async function inlineStylesheets(html: string): Promise<string> {
  const headEnd = html.search(/<\/head>/i);
  if (headEnd < 0) return html;
  const head = html.slice(0, headEnd);
  const tags = Array.from(new Set(head.match(LINK_TAG) || []));

  const replacements = await Promise.all(
    tags.map(async (tag) => {
      const href = attr(tag, "href");
      if (!href) return null;
      if (UNUSED_FONTS.test(href)) return [tag, nonBlocking(tag)] as const;
      const src = sourceOf(href);
      if (!src) return null;
      const css = await fetchCss(src);
      if (css === null) return null;
      const media = attr(tag, "media");
      let body = fixUrls(css, src);
      if (media && media !== "all") body = `@media ${media}{${body}}`;
      const id = attr(tag, "id");
      return [tag, `<style${id ? ` id="${id}"` : ""}>${body}</style>`] as const;
    }),
  );

  let out = head;
  for (const r of replacements) if (r) out = out.split(r[0]).join(r[1]);
  return out + html.slice(headEnd);
}
