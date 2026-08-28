const longDashPattern = /[\u2013\u2014]/gu;
const longDashEntityPattern =
  /&(?:mdash|ndash|#8211|#8212|#x2013|#x2014);/giu;

export function normalizeShortHyphens(value: string) {
  return value
    .replace(longDashPattern, "-")
    .replace(longDashEntityPattern, "-");
}
