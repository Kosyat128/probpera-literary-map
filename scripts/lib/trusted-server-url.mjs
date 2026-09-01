const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

function parsedUrl(value, label) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error(`${label} must be an absolute URL.`);
  }
  if (url.username || url.password) throw new Error(`${label} must not contain credentials.`);
  return url;
}

export function trustedSupabaseOrigin(value, label = "SUPABASE_URL") {
  const url = parsedUrl(value, label);
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    !/^[a-z0-9-]+\.supabase\.co$/iu.test(url.hostname)
  ) {
    throw new Error(`${label} must be an HTTPS *.supabase.co origin.`);
  }
  return url.origin;
}

export function trustedProbperaOrigin(value, label = "PUBLIC_SITE_URL") {
  const url = parsedUrl(value, label);
  if (url.protocol !== "https:" || url.hostname !== "probpera.ru" || (url.port && url.port !== "443")) {
    throw new Error(`${label} must be the canonical https://probpera.ru origin.`);
  }
  return url.origin;
}

export function trustedLoopbackOrigin(value, label = "endpoint") {
  const url = parsedUrl(value, label);
  if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(`${label} must use an HTTP loopback origin.`);
  }
  return url.origin;
}

export function trustedHttpsUrl(value, allowedHosts, label = "URL") {
  const url = parsedUrl(value, label);
  if (url.protocol !== "https:" || !allowedHosts.includes(url.hostname) || (url.port && url.port !== "443")) {
    throw new Error(`${label} host is not allowlisted.`);
  }
  return url;
}
