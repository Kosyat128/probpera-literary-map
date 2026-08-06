import type { NextConfig } from "next";

const LEGACY_PREFIX = "admin";

function normalizeBasePath(rawValue: string | undefined): string {
  const configured = rawValue?.trim() ?? "/admin";

  if (configured === "/" || configured === "") {
    return "";
  }

  const normalized = configured
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");

  if (!normalized) {
    return "";
  }

  const segments = normalized.split("/").filter(Boolean);

  while (segments[0]?.toLowerCase() === LEGACY_PREFIX && segments[1]?.toLowerCase() === LEGACY_PREFIX) {
    segments.shift();
  }

  return segments.length ? `/${segments.join("/")}` : "";
}

const configuredBasePath = process.env.ADMIN_BASE_PATH?.trim() ?? "/admin";
const adminBasePath = normalizeBasePath(configuredBasePath);
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
