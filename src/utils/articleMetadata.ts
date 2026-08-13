const unsafeMetadataCharacters =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff\ufffd]/gu;

const metadataTextFields = [
  "title",
  "description",
  "imageAlt",
  "sectionLabel",
  "publishedLabel",
  "seoTitle",
  "seoDescription",
  "ogTitle",
  "ogDescription",
] as const;

function decodedMetadataEntity(entity: string) {
  const normalized = entity.toLocaleLowerCase("en");
  const namedEntities: Record<string, string> = {
    "&amp;": "&",
    "&apos;": "'",
    "&gt;": ">",
    "&lt;": "<",
    "&nbsp;": " ",
    "&quot;": '"',
    "&shy;": "",
  };
  if (normalized in namedEntities) return namedEntities[normalized];
  const numeric = normalized.match(/^&#(?:x([0-9a-f]+)|(\d+));$/u);
  if (!numeric) return entity;
  const codePoint = Number.parseInt(numeric[1] || numeric[2], numeric[1] ? 16 : 10);
  if (!Number.isSafeInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return "";
  }
  return String.fromCodePoint(codePoint);
}

export function normalizeArticleMetadataText(value: string) {
  return value
    .normalize("NFC")
    .replace(/&(?:nbsp|shy|amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/giu, (entity) =>
      decodedMetadataEntity(entity)
    )
    .replace(/<\/?[a-z][^>]*>/giu, " ")
    .replace(unsafeMetadataCharacters, "")
    .replace(/\u00a0/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function normalizeArticleMetadataRecord<T extends Record<string, unknown>>(
  record: T
): T {
  const normalized: Record<string, unknown> = { ...record };
  for (const field of metadataTextFields) {
    const value = normalized[field];
    if (typeof value === "string") {
      normalized[field] = normalizeArticleMetadataText(value);
    }
  }
  return normalized as T;
}
