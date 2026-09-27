import { proxyText } from "@/lib/proxy";

export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path") || "";
  const ok = /^\/[a-z0-9_-]*sitemap[a-z0-9_-]*\.(xml|xsl)$/i.test(path) || /^\/(.+\/)?feed\/?$/.test(path);
  if (!ok) return new Response("Not found", { status: 404 });
  const type = path.endsWith(".xsl") ? "text/xsl; charset=utf-8" : path.includes("feed") ? "application/rss+xml; charset=utf-8" : "application/xml; charset=utf-8";
  return proxyText(path.endsWith("/") || path.endsWith(".xml") || path.endsWith(".xsl") ? path : path + "/", type);
}
