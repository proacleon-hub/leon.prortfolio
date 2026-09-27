import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getPage, snapshotRoutes } from "@/lib/wp";
import { WpPage, toMetadata } from "../wp-page";

export const revalidate = 300; // keep in sync with REVALIDATE in lib/site.ts
export const dynamicParams = true; // new WordPress posts render on first visit

type Props = { params: Promise<{ slug?: string[] }> };

function routeOf(slug?: string[]): string {
  return slug && slug.length ? `/${slug.join("/")}/` : "/";
}

export async function generateStaticParams() {
  const routes = await snapshotRoutes();
  return routes.map((r) => ({ slug: r === "/" ? [] : r.replace(/^\/|\/$/g, "").split("/") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await getPage(routeOf((await params).slug));
  return res.kind === "page" ? toMetadata(res.data) : {};
}

export default async function Page({ params }: Props) {
  const route = routeOf((await params).slug);
  const res = await getPage(route);
  if (res.kind === "redirect") permanentRedirect(res.location);
  if (res.kind === "not-found") notFound();
  return <WpPage data={res.data} />;
}
