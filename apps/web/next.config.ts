import type { NextConfig } from "next";

const simpleAnalyticsScriptSrc = "https://scripts.simpleanalyticscdn.com";
const simpleAnalyticsCollectionSrc = "https://queue.simpleanalyticscdn.com";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      `connect-src 'self' https://api.github.com https://github.com ${simpleAnalyticsCollectionSrc}`,
      "font-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      `img-src 'self' data: https://avatars.githubusercontent.com ${simpleAnalyticsCollectionSrc}`,
      "object-src 'none'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${simpleAnalyticsScriptSrc}`,
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

export default nextConfig;
