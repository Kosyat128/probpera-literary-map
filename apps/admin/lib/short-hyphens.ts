const longDashPattern = /[\u2013\u2014]/gu;
const longDashEntityPattern =
  /&(?:mdash|ndash|#8211|#8212|#x2013|#x2014);/giu;

export function normalizeShortHyphens(value: string) {
  return value
    .replace(longDashPattern, "-")
    .replace(longDashEntityPattern, "-");
}

export function normalizeShortHyphensDeep<T>(value: T): T {
  if (typeof value === "string") {
    return normalizeShortHyphens(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeShortHyphensDeep(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        normalizeShortHyphens(key),
        normalizeShortHyphensDeep(child),
      ])
    ) as T;
  }
  return value;
}

export function normalizeShortHyphensFormData(formData: FormData) {
  const entries = Array.from(formData.entries());
  const keys = new Set(entries.map(([key]) => key));
  keys.forEach((key) => formData.delete(key));
  entries.forEach(([key, value]) => {
    formData.append(
      key,
      typeof value === "string" ? normalizeShortHyphens(value) : value
    );
  });
  return formData;
}
