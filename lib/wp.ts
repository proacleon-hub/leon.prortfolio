import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { GA_IDS, REVALIDATE, WP_ORIGIN } from "./site";
import { toDocument, toPublicUrls } from "./transform";

const SNAPSHOT_DIR = path.join(process.cwd(), "snapshot");

function snapshotName(route: string): string {
  const clean = route.replace(/^\/|\/$/g, "");
  return (clean === "" ? "index" : clean.replace(/\//g, "--")) + ".html";
}

async function readSnapshot(route: string): Promise<string | null> {
  try {
    return await readFile(path.join(SNAPSHOT_DIR, snapshotName(route)), "utf8");
  } catch {
    return null;
  }
}

/** Routes that have a saved copy in /snapshot (used at build time). */
export async function snapshotRoutes(): Promise<string[]> {
  const files = await readdir(SNAPSHOT_DIR);
  return files
    .filter((f) => f.endsWith(".html") && !f.startsWith("__"))
    .map((f) => f.replace(/\.html$/, ""))
    .map((n) => (n === "index" ? "/" : "/" + n.replace(/--/g, "/") + "/"));
}

type WpResponse = { status: number; contentType: string; body: string; location?: string };

async function fetchFromWordPress(route: string): Promise<WpResponse | null> {
  if (process.env.WP_SOURCE === "snapshot") return null;
  try {
    const res = await fetch(WP_ORIGIN + route, {
      headers: { "user-agent": "junayedleon-next/1.0 (+headless front end)" },
      redirect: "manual",
      next: { revalidate: REVALIDATE, tags: ["wp"] },
      signal: AbortSignal.timeout(15000),
    });
    const contentType = res.headers.get("content-type") || "text/html; charset=utf-8";
    if (res.status >= 300 && res.status < 400) {
      return { status: res.status, contentType, body: "", location: res.headers.get("location") ?? "" };
    }
    if (res.status === 200 || res.status === 404 || res.status === 410) {
      return { status: res.status, contentType, body: await res.text() };
    }
    return null; // 5xx etc: fall back to the saved copy
  } catch {
    return null;
  }
}

export type PageResult =
  | { kind: "page"; html: string; source: "wordpress" | "snapshot" }
  // robots.txt, llms.txt, XML sitemaps, feeds: passed through as WordPress/Yoast made them
  | { kind: "file"; body: string; contentType: string }
  | { kind: "redirect"; location: string; status: number }
  | { kind: "not-found"; status: number };

function isHtml(contentType: string) {
  return /text\/html/i.test(contentType);
}

/**
 * Get a page as WordPress renders it, as the final document the public site
 * serves. WordPress is the source of truth; the saved snapshot keeps the site
 * up if WordPress can't be reached.
 */
export async function getPage(route: string): Promise<PageResult> {
  const live = await fetchFromWordPress(route);
  if (live) {
    if (live.status >= 300 && live.status < 400) {
      let to = live.location || "/";
      try {
        const u = new URL(toPublicUrls(to), WP_ORIGIN);
        // Keep redirects to other sites (e.g. wa.me) as they are.
        to = u.origin === new URL(toPublicUrls(WP_ORIGIN)).origin ? u.pathname + u.search + u.hash : u.href;
      } catch {}
      // A redirect back to the same address would loop; use the saved copy instead.
      if (to !== route) return { kind: "redirect", location: to, status: live.status };
    } else if (live.status !== 200) {
      return { kind: "not-found", status: live.status };
    } else if (!isHtml(live.contentType)) {
      return { kind: "file", body: toPublicUrls(live.body), contentType: live.contentType };
    } else {
      return { kind: "page", html: toDocument(live.body, { gaIds: GA_IDS }), source: "wordpress" };
    }
  }
  const saved = await readSnapshot(route);
  if (saved) return { kind: "page", html: toDocument(saved, { gaIds: GA_IDS }), source: "snapshot" };
  return { kind: "not-found", status: 404 };
}

/** The site's own 404 page design. */
export async function getNotFoundPage(): Promise<string | null> {
  const live = await fetchFromWordPress("/__jl-not-found__/");
  if (live && live.status === 404 && isHtml(live.contentType)) return toDocument(live.body, { gaIds: GA_IDS });
  const saved = await readSnapshot("/__404/");
  return saved ? toDocument(saved, { gaIds: GA_IDS }) : null;
}

/** When WordPress last changed (set by the bridge plugin on every save). */
export async function getLastChange(): Promise<number | null> {
  try {
    const res = await fetch(`${WP_ORIGIN}/wp-json/jl/v1/last-change`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { t?: number };
    return typeof data.t === "number" ? data.t : null;
  } catch {
    return null;
  }
}
