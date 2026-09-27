import Script from "next/script";
import type { ReactNode } from "react";
import { GA_IDS } from "@/lib/site";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-US" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      {/* WordPress body classes are set by the page (see WpPage); the site's
          scripts also add classes (theme, mobile), so don't fight them. */}
      <body suppressHydrationWarning>
        {children}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_IDS[0]}`} strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag("set","linker",{"domains":["junayedleon.tech"]});gtag("js",new Date());
${GA_IDS.map((id) => `gtag("config",${JSON.stringify(id)});`).join("")}`}
        </Script>
      </body>
    </html>
  );
}
