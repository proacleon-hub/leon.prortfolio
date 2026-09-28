import { getNotFoundPage, getPage, snapshotRoutes } from "@/lib/wp";

// Pages are built once and refreshed from WordPress every 5 minutes (ISR),
// or straight away when WordPress reports a change (see app/api/revalidate).
export const revalidate = 300; // keep in sync with REVALIDATE in lib/site.ts
export const dynamicParams = true; // new WordPress posts render on first visit

type Ctx = { params: Promise<{ slug?: string[] }> };

function routeOf(slug?: string[]): string {
  if (!slug || !slug.length) return "/";
  const p = `/${slug.join("/")}`;
  // Files such as /robots.txt, /llms.txt or /sitemap_index.xml have no trailing slash.
  return /\.[a-z0-9]+$/i.test(p) ? p : `${p}/`;
}

export async function generateStaticParams() {
  const routes = await snapshotRoutes();
  return routes.map((r) => ({ slug: r === "/" ? [] : r.replace(/^\/|\/$/g, "").split("/") }));
}

const HTML = "text/html; charset=utf-8";

/**
 * Serves each page as a finished HTML document, the way WordPress designed it.
 * No React runtime is sent to the browser: the site's own scripts do the
 * interactive parts, which keeps pages as light as the WordPress originals.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const route = routeOf((await params).slug);
  const res = await getPage(route);
  switch (res.kind) {
    case "page":
      return new Response(res.html, { headers: { "content-type": HTML, "x-jl-source": res.source } });
    case "file":
      return new Response(res.body, { headers: { "content-type": res.contentType } });
    case "redirect":
      return new Response(null, { status: res.status, headers: { location: res.location } });
    default: {
      const notFound = await getNotFoundPage();
      return new Response(notFound ?? "Page not found", { status: res.status, headers: { "content-type": HTML } });
    }
  }
}
