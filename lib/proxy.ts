import { WP_ORIGIN } from "./site";
import { toPublicUrls } from "./transform";

/** Fetch a text file from WordPress and point its URLs at the public site. */
export async function proxyText(path: string, contentType: string, revalidate = 3600): Promise<Response> {
  try {
    const res = await fetch(WP_ORIGIN + path, { next: { revalidate }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return new Response("Not found", { status: 404 });
    return new Response(toPublicUrls(await res.text()), {
      headers: { "content-type": contentType, "cache-control": `public, s-maxage=${revalidate}, stale-while-revalidate=86400` },
    });
  } catch {
    return new Response("Upstream unavailable", { status: 503 });
  }
}
