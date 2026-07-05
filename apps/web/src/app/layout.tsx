import type { Metadata } from "next";
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
      <body>
        <div className="site-root">
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
