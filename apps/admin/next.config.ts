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
  ...(process.env.ADMIN_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

const nextConfig: NextConfig = {
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
