import { CACHE_HEADER, fixCssUrls } from "@/lib/assets";
import { SITE_URL, WP_ORIGIN } from "@/lib/site";

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * WordPress stylesheets (.css). next.config.ts sends every other /wp-content/
 * file straight to WordPress. Stylesheets hold up the first paint, so they are
 * fetched from WordPress once and then kept in Vercel's cache near each
 * visitor, instead of travelling to the WordPress server on every visit.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { path } = await params;
  const pathname = "/wp-content/" + path.map(encodeURIComponent).join("/");
  if (!pathname.endsWith(".css")) return new Response("Not found", { status: 404 });
  try {
    const res = await fetch(WP_ORIGIN + pathname + new URL(req.url).search, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok && /text\/css/i.test(res.headers.get("content-type") || "")) {
      return new Response(fixCssUrls(await res.text(), SITE_URL + pathname), {
        headers: { "content-type": "text/css; charset=utf-8", "cache-control": CACHE_HEADER },
      });
    }
    return new Response(await res.text(), {
      status: res.status === 200 ? 502 : res.status,
      headers: { "content-type": res.headers.get("content-type") || "text/plain", "cache-control": "public, max-age=60" },
    });
  } catch {
    return new Response("WordPress unreachable", { status: 502, headers: { "cache-control": "no-store" } });
  }
}
