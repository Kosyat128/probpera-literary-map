const LOCAL_EDITORIAL_ARTWORK_PATTERN =
  /^brand\/book-covers\/(?:thumbs\/)?[a-z0-9][a-z0-9-]*\.webp$/u;

function limitedText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().slice(0, maxLength)
    : "";
}

export function editorialArtworkAssetUrl(
  value: unknown,
  publicSiteOrigin = "https://probpera.ru"
) {
  const candidate = limitedText(value, 2_000);
  if (/^https:\/\//u.test(candidate)) {
    try {
      const external = new URL(candidate);
      return external.protocol === "https:" &&
        !external.username &&
        !external.password
        ? external.toString()
        : "";
    } catch {
      return "";
    }
  }
  if (!LOCAL_EDITORIAL_ARTWORK_PATTERN.test(candidate)) return "";

  try {
    const origin = new URL(publicSiteOrigin);
    if (origin.protocol !== "https:") return "";
    return new URL(candidate, `${origin.origin}/`).toString();
  } catch {
    return "";
  }
}

export function editorialArtworkCountFromRelation(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== "object") return 0;
  const count = Number((relation as { count?: unknown }).count);
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

export function editorialArtworkSecondaryCount(
  total: unknown,
  primary: unknown
) {
  const totalCount = Number(total);
  const primaryCount = Number(primary);
  if (!Number.isSafeInteger(totalCount) || totalCount < 0) return 0;
  if (!Number.isSafeInteger(primaryCount) || primaryCount < 0) return 0;
  return Math.max(totalCount - primaryCount, 0);
}

export function editorialArtworkDigest(value: unknown) {
  const digest = limitedText(value, 64).toLowerCase();
  return /^[a-f0-9]{64}$/u.test(digest)
    ? `${digest.slice(0, 12)}…${digest.slice(-8)}`
    : "-";
}

export type EditorialArtworkProvenanceView = {
  kind: string;
  matchBasis: string;
  sourceEvidence: string;
  note: string;
};

export function editorialArtworkProvenanceView(
  value: unknown
): EditorialArtworkProvenanceView {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    kind: limitedText(source.kind, 120),
    matchBasis: limitedText(source.matchBasis, 240),
    sourceEvidence: limitedText(source.sourceEvidence, 240),
    note: limitedText(source.note, 1_000),
  };
}
