import type { NextConfig } from "next";

const WP_ORIGIN = (process.env.WP_ORIGIN || "https://cms.junayedleon.tech").replace(/\/$/, "");

// Phone browsers ("Mobile" is in every phone user agent; tablets leave it out).
const PHONE_UA = { type: "header" as const, key: "user-agent", value: ".*Mobile.*" };

const config: NextConfig = {
  // WordPress URLs end with a slash (/services/, /insights/post-name/).
  trailingSlash: true,
  poweredByHeader: false,
  images: {
    // Photos from WordPress are resized and converted to AVIF/WebP (see lib/transform.ts).
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 828, 1080, 1200, 1920, 2048],
    qualities: [85],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: "https", hostname: "junayedleon.tech", pathname: "/wp-content/uploads/**" },
      { protocol: "https", hostname: "cms.junayedleon.tech", pathname: "/wp-content/uploads/**" },
      ...(process.env.WP_ORIGIN?.startsWith("http://localhost")
        ? [{ protocol: "http" as const, hostname: "localhost", port: "8082", pathname: "/wp-content/uploads/**" }]
        : []),
    ],
    dangerouslyAllowLocalIP: process.env.WP_ORIGIN?.startsWith("http://localhost") ?? false,
  },
  async redirects() {
    return [
      // The WordPress dashboard keeps working on the CMS address.
      { source: "/wp-admin/:path*", destination: `${WP_ORIGIN}/wp-admin/:path*`, permanent: false },
      { source: "/wp-login.php", destination: `${WP_ORIGIN}/wp-login.php`, permanent: false },
    ];
  },
  async rewrites() {
    return {
      // Images, fonts and theme files stay on WordPress and are fetched from
      // there, so old media URLs keep working. These must run before the
      // catch-all page route, which would otherwise answer them with a 404.
      beforeFiles: [
        { source: "/wp-content/:path*", destination: `${WP_ORIGIN}/wp-content/:path*` },
        { source: "/wp-includes/:path*", destination: `${WP_ORIGIN}/wp-includes/:path*` },
        { source: "/wp-json/:path*", destination: `${WP_ORIGIN}/wp-json/:path*` },
      ],
      // Phones get their own lighter version of each page (style files built
      // in, see lib/inline-css.ts). Computers and tablets are not affected.
      afterFiles: [
        { source: "/", has: [PHONE_UA], destination: "/jl-phone/" },
        { source: "/:path((?!_next/|api/|jl-phone/|wp-|.*\\.[a-zA-Z0-9]+$).*)", has: [PHONE_UA], destination: "/jl-phone/:path" },
      ],
      fallback: [],
    };
  },
};

export default config;
