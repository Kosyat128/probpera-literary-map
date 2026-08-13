import { readFileSync } from "node:fs";

const sectionRoutesUrl = new URL(
  "../../src/data/articles/sectionRoutes.json",
  import.meta.url
);

export const articleSectionSlugs = Object.freeze(
  JSON.parse(readFileSync(sectionRoutesUrl, "utf8"))
);

export const articleRouteSlugPattern = /^[a-z0-9][a-z0-9-]{1,179}$/u;

const transliteration = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

const unsafePublicTextPattern =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff\ufffd]/gu;

function decodedMetadataEntity(entity) {
  const normalized = entity.toLocaleLowerCase("en");
  const namedEntities = {
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

export function normalizedPath(value = "") {
  if (!value) return "";
  try {
    return new URL(value, "https://probpera.ru").pathname.replace(/\/+$/, "") || "/";
  } catch {
    return String(value).split(/[?#]/u)[0].replace(/\/+$/, "") || "/";
  }
}

export function humanArticleSlug(value = "") {
  return String(value)
    .toLocaleLowerCase("ru")
    .split("")
    .map((letter) => transliteration[letter] ?? letter)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 115);
}

export function articleSectionSlug(sectionOrArticle = "") {
  const sectionId =
    typeof sectionOrArticle === "string"
      ? sectionOrArticle
      : sectionOrArticle?.sectionId || "";
  return articleSectionSlugs[sectionId] || "materialy";
}

export function articleRouteSlug(article) {
  return articleRouteSlugPattern.test(article?.slug || "")
    ? article.slug
    : humanArticleSlug(article?.title) || "material";
}

export function articlePublicPath(article) {
  return `/stati/${articleSectionSlug(article?.sectionId)}/${articleRouteSlug(article)}`;
}

export function normalizePublicMetadataText(value = "") {
  return String(value)
    .normalize("NFC")
    .replace(/&(?:nbsp|shy|amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/giu, (entity) =>
      decodedMetadataEntity(entity)
    )
    .replace(/<\/?[a-z][^>]*>/giu, " ")
    .replace(unsafePublicTextPattern, "")
    .replace(/\u00a0/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const publicMetadataTextFields = [
  "title",
  "description",
  "imageAlt",
  "sectionLabel",
  "publishedLabel",
  "seoTitle",
  "seoDescription",
  "ogTitle",
  "ogDescription",
];

export function normalizeArticlePublicMetadata(article) {
  const normalized = { ...article };
  for (const field of publicMetadataTextFields) {
    if (typeof normalized[field] === "string") {
      normalized[field] = normalizePublicMetadataText(normalized[field]);
    }
  }
  if (article?.translations?.en) {
    normalized.translations = {
      ...article.translations,
      en: normalizeArticlePublicMetadata(article.translations.en),
    };
  }
  return normalized;
}

const confirmedHeadingCorrections = new Map([
  [
    "Писатель, создавший множество своих альтер эго?",
    "Писатель, создавший множество своих альтер эго",
  ],
]);

export function normalizeConfirmedArticleHeading(value = "") {
  const text = normalizePublicMetadataText(value);
  return confirmedHeadingCorrections.get(text) || text;
}

export function publicMetadataArtifacts(value = "") {
  const text = String(value);
  const artifacts = [];
  if (unsafePublicTextPattern.test(text)) artifacts.push("unicode-control");
  unsafePublicTextPattern.lastIndex = 0;
  if (/&(?:nbsp|shy|amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/iu.test(text)) {
    artifacts.push("html-entity");
  }
  if (/<\/?[a-z][^>]*>/iu.test(text)) artifacts.push("html-tag");
  if (
    /[\u00c3\u00c2\u00d0\u00d1][\u0080-\u00ff]|\u00e2[\u0080-\u00bf]{1,2}/u.test(
      text
    )
  ) {
    artifacts.push("mojibake");
  }
  if (text !== text.normalize("NFC")) artifacts.push("non-nfc");
  return artifacts;
}
