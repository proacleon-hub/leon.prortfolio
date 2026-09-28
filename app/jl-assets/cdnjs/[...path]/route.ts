import { proxyCss } from "@/lib/assets";

type Ctx = { params: Promise<{ path: string[] }> };

/** Stylesheets from cdnjs (Font Awesome) served from our own address (the icon fonts still come from cdnjs). */
export async function GET(_req: Request, { params }: Ctx) {
  const { path } = await params;
  const file = path.map(encodeURIComponent).join("/");
  if (!file.endsWith(".css")) return new Response("Not found", { status: 404 });
  return proxyCss(`https://cdnjs.cloudflare.com/${file}`);
}
