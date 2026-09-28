import { SITE_URL } from "./site";
import { toPublicUrls } from "./transform";

// Files are kept in Vercel's cache near each visitor, so a phone in Dhaka
// doesn't wait for the WordPress server in the UK on every style file.
export const CACHE_HEADER = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";

// A current Chrome user agent, so Google Fonts answers with WOFF2 files,
// which every browser in use today understands.
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/**
 * Point a stylesheet's url(...) references at absolute addresses, resolved
 * from where the file really lives, so it keeps working when served from
 * another path. Addresses on our own site stay relative.
 */
export function fixCssUrls(css: string, baseUrl: string): string {
  return toPublicUrls(css).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, q: string, ref: string) => {
    if (/^(data:|#)/i.test(ref)) return whole;
    try {
      const abs = new URL(ref, baseUrl);
      const out = abs.origin === SITE_URL ? abs.pathname + abs.search + abs.hash : abs.href;
      return `url(${q}${out}${q})`;
    } catch {
      return whole;
    }
  });
}

/** Proxy a CSS file from another server, fixing its internal links. */
export async function proxyCss(url: string): Promise<Response> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": BROWSER_UA, accept: "text/css,*/*;q=0.1" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok && /text\/css/i.test(res.headers.get("content-type") || "")) {
      return new Response(fixCssUrls(await res.text(), url), {
        headers: { "content-type": "text/css; charset=utf-8", "cache-control": CACHE_HEADER },
      });
    }
  } catch {}
  // Couldn't fetch it: send the browser to the original file.
  return Response.redirect(url, 302);
}
