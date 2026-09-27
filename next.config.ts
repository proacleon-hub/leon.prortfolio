import type { NextConfig } from "next";

const WP_ORIGIN = (process.env.WP_ORIGIN || "https://junayedleon.tech").replace(/\/$/, "");

const config: NextConfig = {
  // WordPress URLs end with a slash (/services/, /insights/post-name/).
  trailingSlash: true,
  poweredByHeader: false,
  async redirects() {
    return [
      // The WordPress dashboard keeps working on the CMS address.
      { source: "/wp-admin/:path*", destination: `${WP_ORIGIN}/wp-admin/:path*`, permanent: false },
      { source: "/wp-login.php", destination: `${WP_ORIGIN}/wp-login.php`, permanent: false },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      // Images, fonts and theme files stay on WordPress; anything not served
      // by Next.js itself is fetched from there, so old media URLs keep working.
      fallback: [
        { source: "/wp-content/:path*", destination: `${WP_ORIGIN}/wp-content/:path*` },
        { source: "/wp-includes/:path*", destination: `${WP_ORIGIN}/wp-includes/:path*` },
        { source: "/wp-json/:path*", destination: `${WP_ORIGIN}/wp-json/:path*` },
      ],
    };
  },
};

export default config;
