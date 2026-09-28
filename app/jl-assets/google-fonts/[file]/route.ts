import { proxyCss } from "@/lib/assets";

type Ctx = { params: Promise<{ file: string }> };

/** Google Fonts stylesheets served from our own address (the fonts themselves still come from Google). */
export async function GET(req: Request, { params }: Ctx) {
  const { file } = await params;
  // Named css.css / css2.css so the site's trailing-slash rule leaves them alone.
  const api = { "css.css": "css", "css2.css": "css2" }[file];
  if (!api) return new Response("Not found", { status: 404 });
  return proxyCss(`https://fonts.googleapis.com/${api}${new URL(req.url).search}`);
}
