import type { Metadata } from "next";
import { cssVariables } from "@paceandpush/brand";
import Script from "next/script";
import { SiteFooter } from "./SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pace & Push",
  description: "A leaderboard for runners who ship.",
};

const themeScript = `(() => {
  try {
    const theme = window.localStorage.getItem("pace-theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    }
  } catch {
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="pace-theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        <style
          id="pace-push-brand-tokens"
          dangerouslySetInnerHTML={{ __html: cssVariables }}
        />
      </head>
      <body>
        <div className="site-root">
          {children}
          <SiteFooter />
        </div>
        <Script
          id="simple-analytics"
          src="https://scripts.simpleanalyticscdn.com/latest.js"
        />
      </body>
    </html>
  );
}
