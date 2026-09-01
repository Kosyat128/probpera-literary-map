export type CmsNavigationItem = {
  id: string;
  parentId?: string | null;
  label: string;
  href: string;
  openInNewTab?: boolean;
  displayOrder: number;
};

export type CmsNavigationNode = CmsNavigationItem & {
  children: CmsNavigationNode[];
};

export type CmsBannerSchedule = {
  startsAt?: string | null;
  endsAt?: string | null;
};

function compareNavigationItems(
  first: CmsNavigationItem,
  second: CmsNavigationItem
) {
  return (
    first.displayOrder - second.displayOrder ||
    first.label.localeCompare(second.label, "ru") ||
    first.id.localeCompare(second.id)
  );
}

/**
 * Builds a renderable menu forest without trusting editorial relations.
 * Orphans and every member of a parent cycle become roots, so a malformed
 * relation cannot hide a published navigation item or recurse forever.
 */
export function buildCmsNavigationForest(
  sourceItems: readonly CmsNavigationItem[]
): CmsNavigationNode[] {
  const uniqueItems: CmsNavigationItem[] = [];
  const itemById = new Map<string, CmsNavigationItem>();

  for (const item of sourceItems) {
    if (!item.id || itemById.has(item.id)) continue;
    itemById.set(item.id, item);
    uniqueItems.push(item);
  }

  const parentById = new Map<string, string>();
  for (const item of uniqueItems) {
    const parentId = item.parentId || "";
    if (parentId && parentId !== item.id && itemById.has(parentId)) {
      parentById.set(item.id, parentId);
    }
  }

  const cycleMembers = new Set<string>();
  for (const item of uniqueItems) {
    const path: string[] = [];
    const pathIndex = new Map<string, number>();
    let cursor: string | undefined = item.id;

    while (cursor && parentById.has(cursor)) {
      const repeatedAt = pathIndex.get(cursor);
      if (repeatedAt !== undefined) {
        for (const id of path.slice(repeatedAt)) cycleMembers.add(id);
        break;
      }
      pathIndex.set(cursor, path.length);
      path.push(cursor);
      cursor = parentById.get(cursor);
    }
  }

  for (const id of cycleMembers) parentById.delete(id);

  const nodeById = new Map<string, CmsNavigationNode>();
  for (const item of uniqueItems) {
    nodeById.set(item.id, { ...item, children: [] });
  }

  const roots: CmsNavigationNode[] = [];
  for (const item of uniqueItems) {
    const node = nodeById.get(item.id);
    if (!node) continue;
    const parent = nodeById.get(parentById.get(item.id) || "");
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortBranch = (nodes: CmsNavigationNode[]) => {
    nodes.sort(compareNavigationItems);
    for (const node of nodes) sortBranch(node.children);
  };
  sortBranch(roots);
  return roots;
}

export function normalizeCmsPathname(pathname: string, baseUrl = "/") {
  let normalized = pathname.split(/[?#]/u, 1)[0] || "/";
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep the browser-provided path when it contains malformed escapes.
  }
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;

  const base = `/${baseUrl.replace(/^\/+|\/+$/gu, "")}`;
  if (base !== "/" && (normalized === base || normalized.startsWith(`${base}/`))) {
    normalized = normalized.slice(base.length) || "/";
  }

  normalized = normalized.replace(/\/{2,}/gu, "/");
  if (normalized.length > 1) normalized = normalized.replace(/\/+$/gu, "");
  return normalized || "/";
}

export function cmsPagePatternMatches(pattern: string, pathname: string) {
  const candidate = normalizeCmsPathname(pathname);
  const rawPattern = pattern.trim();
  if (rawPattern === "*" || rawPattern === "/*") return true;
  if (!rawPattern.startsWith("/")) return false;

  const normalizedPattern = normalizeCmsPathname(rawPattern);
  if (!rawPattern.endsWith("*")) return normalizedPattern === candidate;

  const prefix = normalizeCmsPathname(rawPattern.slice(0, -1));
  if (prefix === "/") return true;
  return candidate === prefix || candidate.startsWith(`${prefix}/`);
}

export function cmsBannerMatchesPath(
  pagePatterns: readonly string[] | undefined,
  pathname: string,
  baseUrl = "/"
) {
  const publicPathname = normalizeCmsPathname(pathname, baseUrl);
  const patterns = pagePatterns?.length ? pagePatterns : ["/"];
  return patterns.some((pattern) => cmsPagePatternMatches(pattern, publicPathname));
}

function parseOptionalCmsTimestamp(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  if (value.trim() === "") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

/**
 * Mirrors the public banners RLS window for snapshots exported with a service
 * role. Invalid configured boundaries fail closed instead of leaking a banner.
 */
export function cmsBannerIsActiveAt(
  banner: CmsBannerSchedule,
  now: number | Date = Date.now()
) {
  const currentTimestamp = now instanceof Date ? now.getTime() : now;
  const startsAt = parseOptionalCmsTimestamp(banner.startsAt);
  const endsAt = parseOptionalCmsTimestamp(banner.endsAt);

  if (
    !Number.isFinite(currentTimestamp) ||
    startsAt === undefined ||
    endsAt === undefined
  ) {
    return false;
  }

  return (
    (startsAt === null || startsAt <= currentTimestamp) &&
    (endsAt === null || endsAt > currentTimestamp)
  );
}
