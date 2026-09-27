import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { REVALIDATE, WP_ORIGIN } from "./site";
import { transform, type PageData } from "./transform";

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

async function fetchFromWordPress(route: string): Promise<{ status: number; html: string } | null> {
  if (process.env.WP_SOURCE === "snapshot") return null;
  try {
    const res = await fetch(WP_ORIGIN + route, {
      headers: { "user-agent": "junayedleon-next/1.0 (+headless front end)" },
      redirect: "manual",
      next: { revalidate: REVALIDATE, tags: ["wp"] },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 200 || res.status === 404) return { status: res.status, html: await res.text() };
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      return { status: res.status, html: loc ?? "" };
    }
    return null; // 5xx etc: fall back to the saved copy
  } catch {
    return null;
  }
}

export type PageResult =
  | { kind: "page"; data: PageData; source: "wordpress" | "snapshot" }
  | { kind: "redirect"; location: string }
  | { kind: "not-found" };

/**
 * Get a page as WordPress renders it, turned into data the Next.js page can
 * draw. WordPress is the source of truth; the saved snapshot keeps the site
 * up if WordPress can't be reached.
 */
export const getPage = cache(async (route: string): Promise<PageResult> => {
  const live = await fetchFromWordPress(route);
  if (live) {
    if (live.status === 404) return { kind: "not-found" };
    if (live.status >= 300 && live.status < 400) {
      let to = live.html;
      try {
        const u = new URL(to, WP_ORIGIN);
        to = u.pathname + u.search + u.hash;
      } catch {}
      // A redirect back to the same address would loop; use the saved copy instead.
      if (to && to !== route) return { kind: "redirect", location: to };
    } else {
      return { kind: "page", data: transform(live.html), source: "wordpress" };
    }
  }
  const saved = await readSnapshot(route);
  if (saved) return { kind: "page", data: transform(saved), source: "snapshot" };
  return { kind: "not-found" };
});

/** The site's own 404 page design. */
export const getNotFoundPage = cache(async (): Promise<PageData | null> => {
  const live = await fetchFromWordPress("/__jl-not-found__/");
  if (live && live.status === 404) return transform(live.html);
  const saved = await readSnapshot("/__404/");
  return saved ? transform(saved) : null;
});
