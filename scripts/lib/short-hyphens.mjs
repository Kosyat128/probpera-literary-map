const longDashPattern = /[\u2013\u2014]/gu;
const longDashEntityPattern =
  /&(?:mdash|ndash|#8211|#8212|#x2013|#x2014);/giu;

export function normalizeShortHyphens(value) {
  return String(value)
    .replace(longDashPattern, "-")
    .replace(longDashEntityPattern, "-");
}

export function normalizeShortHyphensDeep(value) {
  if (typeof value === "string") return normalizeShortHyphens(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = normalizeShortHyphensDeep(value[index]);
    }
    return value;
  }
  if (value && typeof value === "object") {
    const normalizedEntries = Object.entries(value)
      .sort(([left], [right]) => {
        const leftIsCanonical = left === normalizeShortHyphens(left) ? 1 : 0;
        const rightIsCanonical = right === normalizeShortHyphens(right) ? 1 : 0;
        return leftIsCanonical - rightIsCanonical;
      })
      .map(([key, child]) => [
        normalizeShortHyphens(key),
        normalizeShortHyphensDeep(child),
      ]);
    for (const key of Object.keys(value)) delete value[key];
    for (const [key, child] of normalizedEntries) {
      value[key] = child;
    }
  }
  return value;
}
