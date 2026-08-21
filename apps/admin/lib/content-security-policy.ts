type AdminCspOptions = {
  nonce: string;
  isDevelopment?: boolean;
  supabaseUrl?: string;
  publicSiteUrl?: string;
};

const noncePattern = /^[A-Za-z0-9_-]{20,160}$/u;

function normalizedOrigin(value: string | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!new Set(["https:", "http:"]).has(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function websocketOrigin(origin: string | null) {
  if (!origin) return null;
  const url = new URL(origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.origin;
}

function uniqueSources(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function createAdminCspNonce(
  randomUUID: () => string = () => crypto.randomUUID()
) {
  const nonce = randomUUID().replaceAll("-", "");
  if (!noncePattern.test(nonce)) {
    throw new Error("The generated admin CSP nonce is invalid.");
  }
  return nonce;
}

export function buildAdminContentSecurityPolicy({
  nonce,
  isDevelopment = false,
  supabaseUrl,
  publicSiteUrl = "https://probpera.ru",
}: AdminCspOptions) {
  if (!noncePattern.test(nonce)) {
    throw new Error("Admin CSP requires a valid per-request nonce.");
  }

  const supabaseOrigin = normalizedOrigin(supabaseUrl);
  const publicOrigin = normalizedOrigin(publicSiteUrl);
  const connectSources = uniqueSources([
    "'self'",
    supabaseOrigin,
    websocketOrigin(supabaseOrigin),
    isDevelopment ? "http:" : null,
    isDevelopment ? "ws:" : null,
  ]);
  const frameSources = uniqueSources(["'self'", publicOrigin]);
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    `frame-src ${frameSources.join(" ")}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob: https:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ];

  return `${directives.join("; ")};`;
}
