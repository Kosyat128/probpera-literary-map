const ADMIN_OUTBOUND_HOSTS = new Set(["api.github.com", "api.cloudflare.com", "probpera.ru"]);

export function trustedAdminOutboundUrl(value: string, label: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !ADMIN_OUTBOUND_HOSTS.has(url.hostname)
  ) {
    throw new Error(`${label} host is not allowlisted.`);
  }
  return url;
}
