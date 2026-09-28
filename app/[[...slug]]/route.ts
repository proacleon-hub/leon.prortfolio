import { getNotFoundPage, getPage, snapshotRoutes } from "@/lib/wp";

// Pages are built once and refreshed from WordPress every 5 minutes (ISR).
export const revalidate = 300; // keep in sync with REVALIDATE in lib/site.ts
export const dynamicParams = true; // new WordPress posts render on first visit

type Ctx = { params: Promise<{ slug?: string[] }> };

function routeOf(slug?: string[]): string {
  return slug && slug.length ? `/${slug.join("/")}/` : "/";
}

export async function generateStaticParams() {
  const routes = await snapshotRoutes();
  return routes.map((r) => ({ slug: r === "/" ? [] : r.replace(/^\/|\/$/g, "").split("/") }));
}

const HTML = { "content-type": "text/html; charset=utf-8" };

/**
 * Serves each page as a finished HTML document, the way WordPress designed it.
 * No React runtime is sent to the browser: the site's own scripts do the
 * interactive parts, which keeps pages as light as the WordPress originals.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const route = routeOf((await params).slug);
  const res = await getPage(route);
  if (res.kind === "page") return new Response(res.html, { headers: HTML });
  if (res.kind === "redirect") return new Response(null, { status: 308, headers: { location: res.location } });
  const notFound = await getNotFoundPage();
  return new Response(notFound ?? "Page not found", { status: 404, headers: HTML });
}
