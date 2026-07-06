import type { NextConfig } from "next";

const requiredProductionEnv = [
  "NEXT_PUBLIC_APP_URL",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_TOKEN_ENCRYPTION_KEY",
  "SESSION_SECRET",
  "MOBILE_TOKEN_SECRET",
  "CRON_SECRET",
] as const;

assertProductionEnv();

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self' https://api.github.com https://github.com",
      "font-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https://avatars.githubusercontent.com",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
    ].join("; "),
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(), payment=()",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  transpilePackages: ["@paceandpush/api-contracts", "@paceandpush/brand"],
};

function assertProductionEnv() {
  if (process.env.VERCEL_ENV !== "production") return;

  const missing: string[] = requiredProductionEnv.filter((key) => !process.env[key]);
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    missing.push("DATABASE_URL or POSTGRES_URL");
  }
  if (missing.length > 0) {
    throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
  }

  if (!process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://")) {
    throw new Error("NEXT_PUBLIC_APP_URL must be an https:// URL in production.");
  }
  if (process.env.MOBILE_TOKEN_SECRET === process.env.SESSION_SECRET) {
    throw new Error("MOBILE_TOKEN_SECRET must be distinct from SESSION_SECRET in production.");
  }
}

export default nextConfig;
