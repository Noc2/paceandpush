import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
