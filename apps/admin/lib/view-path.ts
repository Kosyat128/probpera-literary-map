const legacyGithubPrefix = "/probpera-literary-map";

export function normalizeViewPath(value?: string | null) {
  if (!value) return "/";

  let pathname = value;
  try {
    pathname = new URL(value, "https://probpera.ru").pathname;
  } catch {
    pathname = value.split(/[?#]/u)[0] || "/";
  }

  if (
    pathname === legacyGithubPrefix ||
    pathname.startsWith(`${legacyGithubPrefix}/`)
  ) {
    pathname = pathname.slice(legacyGithubPrefix.length) || "/";
  }

  pathname = pathname.replace(/\/{2,}/gu, "/").replace(/\/+$/u, "");
  return pathname || "/";
}

export function viewPathVariants(...values: Array<string | null | undefined>) {
  const result = new Set<string>();

  for (const value of values) {
    if (!value) continue;
    const path = normalizeViewPath(value);
    const trailing = path === "/" ? "/" : `${path}/`;
    result.add(path);
    result.add(trailing);
    result.add(`${legacyGithubPrefix}${path}`);
    result.add(`${legacyGithubPrefix}${trailing}`);
  }

  return [...result];
}
