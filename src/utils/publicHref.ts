export function isSafeRootRelativeHref(value: string) {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  );
}

export function safePublicHref(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (isSafeRootRelativeHref(normalized)) return normalized;
  if (normalized.startsWith("#")) return normalized;
  try {
    const url = new URL(normalized);
    if (url.protocol === "https:" || url.protocol === "mailto:") {
      return normalized;
    }
  } catch {
    // Invalid or unsupported links use the caller's safe fallback.
  }
  return fallback;
}
