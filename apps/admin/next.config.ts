import type { NextConfig } from "next";

const configuredBasePath = process.env.ADMIN_BASE_PATH?.trim() ?? "/admin";
const adminBasePath =
  configuredBasePath === "/" || configuredBasePath === ""
    ? ""
    : `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}`;
const allowedOrigins = [
  "probpera.ru",
  "www.probpera.ru",
  "admin.probpera.ru",
  "localhost:3000",
  "127.0.0.1:3000",
  ...(process.env.ADMIN_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep the Supabase server packages outside the webpack server bundle.
  // Next 16 on Windows can otherwise reference an unwritten
  // `.next/dev/server/vendor-chunks/@supabase.js` after a route reload.
  serverExternalPackages: [
    "@supabase/ssr",
    "@supabase/supabase-js",
    "sanitize-html",
    "zod",
  ],
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingRoot: process.cwd().replace(/[\\/]apps[\\/]admin$/, ""),
  basePath: adminBasePath,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
      allowedOrigins: [...new Set(allowedOrigins)],
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
