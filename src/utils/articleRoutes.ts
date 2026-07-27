const basePath = import.meta.env.BASE_URL.replace(/\/+$/, "");

export function articlePath(articleId: string) {
  return `${basePath}/articles/${encodeURIComponent(articleId)}/`;
}

export function articleIdFromPath(pathname = window.location.pathname) {
  const normalizedBase = basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = pathname.match(
    new RegExp(`^${normalizedBase}/articles/([^/]+)/?$`, "i")
  );

  return match ? decodeURIComponent(match[1]) : null;
}

export function journalPath(sectionId?: string) {
  const query =
    sectionId && sectionId !== "all"
      ? `?section=${encodeURIComponent(sectionId)}`
      : "";
  return `${basePath || "/"}${query}#journal`;
}
