export const homepageHashTargets = new Set([
  "atlas",
  "book-day",
  "books",
  "featured-journal",
  "journal",
  "community",
  "authors",
  "sections",
  "editorial-policy",
  "calendar",
  "about",
]);

export function decodeHashTarget(hash: string) {
  const raw = hash.replace(/^#/u, "").split(/[?&]/u)[0];
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

export function scrollToDeferredHashTarget(
  hash: string,
  getElement: (id: string) => HTMLElement | null = (id) =>
    document.getElementById(id)
) {
  const targetId = decodeHashTarget(hash);
  if (!homepageHashTargets.has(targetId)) return false;
  const target = getElement(targetId);
  if (!target) return false;
  target.scrollIntoView({ behavior: "auto", block: "start" });
  return true;
}
