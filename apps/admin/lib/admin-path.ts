export const legacyAdminPrefix = "/admin";

const LEGACY_PREFIX_WITH_TRAILING_SLASH = `${legacyAdminPrefix}/`;
const LEGACY_PREFIX = legacyAdminPrefix.replace(/^\/+|\/+$/gu, "");

function sanitizePath(raw: string | undefined): string {
  return (raw || "").trim();
}

function normalizeBasePathPath(value: string): string {
  if (!value) return "/admin";
  if (value === "/") return "";

  const normalized = value.replace(/^\/+|\/+$/gu, "").replace(/\/{2,}/gu, "/");
  if (!normalized) return "";

  const parts = normalized.split("/").filter(Boolean);
  if (parts[0]?.toLowerCase() === LEGACY_PREFIX) {
    while (parts[1]?.toLowerCase() === LEGACY_PREFIX) {
      parts.shift();
    }
  }

  return parts.length ? `/${parts.join("/")}` : "";
}

export function getAdminBasePathFromEnv(rawValue?: string): string {
  return normalizeBasePathPath(sanitizePath(rawValue));
}

export function normalizeAdminRequestPath(
  pathname: string,
  configuredAdminBasePath: string
) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  let rewritten = normalizedPath;

  if (!configuredAdminBasePath) {
    const legacyRewritePattern = new RegExp(`^(?:${legacyAdminPrefix})(/.*)?$`, "u");
    if (!legacyRewritePattern.test(rewritten) && rewritten !== legacyAdminPrefix) {
      return undefined;
    }

    while (rewritten === legacyAdminPrefix || rewritten.startsWith(LEGACY_PREFIX_WITH_TRAILING_SLASH)) {
      const stripped = rewritten.length === legacyAdminPrefix.length
        ? "/"
        : rewritten.slice(legacyAdminPrefix.length);
      rewritten = stripped;
      if (stripped !== "/" && !stripped.startsWith("/")) {
        rewritten = `/${stripped}`;
      }
    }
    return rewritten === "" ? "/" : rewritten;
  }

  if (configuredAdminBasePath === legacyAdminPrefix) {
    const repeatedPattern = `${configuredAdminBasePath}${configuredAdminBasePath}`;
    while (
      rewritten === repeatedPattern ||
      rewritten.startsWith(`${repeatedPattern}/`)
    ) {
      rewritten = `${configuredAdminBasePath}${rewritten.slice(repeatedPattern.length)}`;
    }
    if (rewritten === normalizedPath) return undefined;
    return rewritten === "" ? configuredAdminBasePath : rewritten;
  }

  if (!rewritten.startsWith(`${configuredAdminBasePath}/`) && rewritten !== configuredAdminBasePath) {
    return undefined;
  }

  return rewritten;
}

export function getClientAdminBasePath(): string {
  if (typeof document === "undefined") return "";

  const attribute = document.body?.dataset.adminBasePath;
  if (!attribute) return "";

  const value = attribute.trim();
  if (!value || value === "/") return "";
  return value.startsWith("/") ? value : `/${value}`;
}

export function withClientAdminPath(path: string) {
  if (!path) return path;

  const basePath = getClientAdminBasePath();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!basePath || normalized.startsWith(`${basePath}/`)) {
    return normalized;
  }

  return `${basePath}${normalized}`;
}
