export type PublicHrefPolicy = {
  allowEmpty?: boolean;
  allowHash?: boolean;
  allowMailto?: boolean;
};

export function isSafeRootRelativePath(value: string) {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  );
}

export function isSafePublicHref(
  value: string,
  policy: PublicHrefPolicy = {}
) {
  const normalized = value.trim();
  if (!normalized) return Boolean(policy.allowEmpty);
  if (isSafeRootRelativePath(normalized)) return true;
  if (policy.allowHash && normalized.startsWith("#")) return true;
  try {
    const url = new URL(normalized);
    return (
      url.protocol === "https:" ||
      Boolean(policy.allowMailto && url.protocol === "mailto:")
    );
  } catch {
    return false;
  }
}
