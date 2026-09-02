const productionFallbackOrigin = "https://probpera.ru";
const localDevelopmentHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function safePublicSiteOrigin(value: unknown) {
  try {
    const parsed = new URL(String(value || "").trim());
    const allowedProtocol = parsed.protocol === "https:" ||
      (parsed.protocol === "http:" && localDevelopmentHosts.has(parsed.hostname));
    if (!allowedProtocol || parsed.username || parsed.password) {
      return productionFallbackOrigin;
    }
    return parsed.origin;
  } catch {
    return productionFallbackOrigin;
  }
}

export function safePublicSiteHref(originValue: unknown, targetValue: unknown = "/") {
  const origin = safePublicSiteOrigin(originValue);
  const target = String(targetValue || "").trim();
  if (target.startsWith("#")) {
    const url = new URL("/", origin);
    url.hash = target.slice(1);
    return url.toString();
  }
  if (target.startsWith("/") && !target.startsWith("//") && !target.includes("\\")) {
    const url = new URL(target, `${origin}/`);
    return url.origin === origin ? url.toString() : origin;
  }
  if (target.toLowerCase().startsWith("mailto:")) {
    try {
      const mail = new URL(target);
      return mail.protocol === "mailto:" ? mail.toString() : origin;
    } catch {
      return origin;
    }
  }
  return origin;
}
