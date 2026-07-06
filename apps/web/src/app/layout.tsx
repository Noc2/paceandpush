import type { Metadata } from "next";
import { cssVariables } from "@paceandpush/brand";
import { SiteFooter } from "./SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pace & Push",
  description: "A leaderboard for healthy body, shipped code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
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
      </body>
    </html>
  );
}
