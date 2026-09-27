import type { Metadata } from "next";
import type { PageData } from "@/lib/transform";
import { SITE_URL } from "@/lib/site";

/** Turn the Yoast tags WordPress printed into Next.js metadata. */
export function toMetadata(d: PageData): Metadata {
  const m = d.meta;
  const og = m.og;
  const tw = m.twitter;
  const other: Record<string, string> = {};
  for (const [k, v] of Object.entries(m.article)) other[`article:${k}`] = v;
  for (const k of ["label1", "data1", "label2", "data2"]) if (tw[k]) other[`twitter:${k}`] = tw[k];

  return {
    metadataBase: new URL(SITE_URL),
    title: m.title ? { absolute: m.title } : undefined,
    description: m.description,
    robots: m.robots,
    authors: m.author ? [{ name: m.author }] : undefined,
    alternates: m.canonical ? { canonical: m.canonical } : undefined,
    openGraph: {
      locale: og.locale,
      type: (og.type as "website" | "article") || "website",
      title: og.title,
      description: og.description,
      url: og.url,
      siteName: og.site_name,
      images: m.ogImage ? [m.ogImage] : undefined,
    },
    twitter: {
      card: (tw.card as "summary_large_image") || "summary_large_image",
      title: tw.title,
      description: tw.description,
      site: tw.site,
      creator: tw.creator,
    },
    icons: {
      icon: m.icons.filter((i) => i.rel === "icon").map((i) => ({ url: i.href, sizes: i.sizes })),
      apple: m.icons.filter((i) => i.rel === "apple-touch-icon").map((i) => ({ url: i.href })),
    },
    other: {
      ...other,
      "msapplication-TileImage": `${SITE_URL}/wp-content/uploads/2026/08/j-leon-favicon-512-300x300.png`,
    },
  };
}

/**
 * Draws a page exactly as WordPress designed it: same stylesheets in the same
 * order, same markup, same scripts. React hoists the styles into <head>.
 */
export function WpPage({ data }: { data: PageData }) {
  return (
    <>
      {/* One precedence per stylesheet keeps WordPress's exact cascade order. */}
      {data.styles.map((s, i) =>
        s.kind === "link" ? (
          <link key={s.key} rel="stylesheet" href={s.href} media={s.media} precedence={`wp-${i}`} />
        ) : (
          <style key={s.key} href={`wp-${s.key}`} precedence={`wp-${i}`}>
            {s.css}
          </style>
        ),
      )}
      {/* Put the WordPress body classes on <body> before anything paints. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.body.className=${JSON.stringify(data.bodyClass)}+(document.body.className?" "+document.body.className:"");`,
        }}
      />
      {data.jsonLd.map((j, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: j }} />
      ))}
      <div id="wp-root" style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: data.bodyHtml }} />
    </>
  );
}
