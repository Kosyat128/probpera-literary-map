import { load } from "cheerio";

const MEDIA_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const MAX_EDITORIAL_HTML_LENGTH = 2_000_000;
const MAX_MEDIA_SOURCE_LENGTH = 2_000;
const MAX_MEDIA_ALT_LENGTH = 500;

function loadEditorialHtml(html: string) {
  let fatalParseError = false;
  const document = load(
    html,
    {
      onParseError(error) {
        if (error.code === "eof-in-tag") fatalParseError = true;
      },
    },
    false
  );
  if (fatalParseError) {
    throw new EditorialMediaIdentityError(
      "HTML редактора повреждён: обнаружен незавершённый тег."
    );
  }
  return document;
}

export type EditorialMediaReference = {
  mediaId: string;
  src: string;
  alt: string;
  decorative: boolean;
};

export class EditorialMediaIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorialMediaIdentityError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedReferenceText(
  value: unknown,
  maximum: number,
  location: string,
  required = false
) {
  if (value !== null && value !== undefined && typeof value !== "string") {
    throw new EditorialMediaIdentityError(`${location}: ожидалась строка.`);
  }
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length > maximum) {
    throw new EditorialMediaIdentityError(`${location}: значение превышает допустимый размер.`);
  }
  if (required && !normalized) {
    throw new EditorialMediaIdentityError(`${location}: отсутствует адрес файла.`);
  }
  return normalized;
}

function normalizedDecorative(value: unknown) {
  return value === true || value === "true" || value === "1";
}

function uniqueSortedMediaIds(references: EditorialMediaReference[]) {
  return [...new Set(references.map(({ mediaId }) => mediaId))].sort();
}

function referenceSignature(reference: EditorialMediaReference) {
  return JSON.stringify([
    reference.mediaId,
    reference.src,
    reference.alt,
    reference.decorative,
  ]);
}

export function normalizeAuthoritativeMediaId(
  value: unknown,
  location = "mediaId"
) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new EditorialMediaIdentityError(`${location}: идентификатор файла должен быть строкой UUID.`);
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.length > 80 || !MEDIA_ID_PATTERN.test(normalized)) {
    throw new EditorialMediaIdentityError(`${location}: указан некорректный UUID файла.`);
  }
  return normalized;
}

/** Parse a submitted TipTap document without replacing invalid input with an empty document. */
export function parseEditorialContentJson(serialized: string, label = "Содержимое") {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new EditorialMediaIdentityError(
      `${label}: JSON редактора повреждён. Обновите страницу и повторите сохранение.`
    );
  }
  if (
    !isRecord(parsed) ||
    parsed.type !== "doc" ||
    (parsed.content !== undefined && !Array.isArray(parsed.content))
  ) {
    throw new EditorialMediaIdentityError(
      `${label}: получен некорректный документ редактора. Обновите страницу и повторите сохранение.`
    );
  }
  return parsed;
}

export function authoritativeMediaReferencesFromJson(value: unknown) {
  if (!isRecord(value) || value.type !== "doc") {
    throw new EditorialMediaIdentityError("JSON редактора не является документом TipTap.");
  }
  const references: EditorialMediaReference[] = [];
  const ancestors = new Set<object>();
  const visit = (candidate: unknown, path: string) => {
    if (Array.isArray(candidate)) {
      if (ancestors.has(candidate)) {
        throw new EditorialMediaIdentityError(`${path}: обнаружена циклическая структура JSON.`);
      }
      ancestors.add(candidate);
      candidate.forEach((child, index) => visit(child, `${path}[${index}]`));
      ancestors.delete(candidate);
      return;
    }
    if (!isRecord(candidate)) return;
    if (ancestors.has(candidate)) {
      throw new EditorialMediaIdentityError(`${path}: обнаружена циклическая структура JSON.`);
    }
    ancestors.add(candidate);
    if (Object.hasOwn(candidate, "mediaId")) {
      const mediaId = normalizeAuthoritativeMediaId(candidate.mediaId, `${path}.mediaId`);
      if (mediaId) {
        references.push({
          mediaId,
          src: normalizedReferenceText(
            candidate.src,
            MAX_MEDIA_SOURCE_LENGTH,
            `${path}.src`,
            true
          ),
          alt: normalizedReferenceText(
            candidate.alt,
            MAX_MEDIA_ALT_LENGTH,
            `${path}.alt`
          ),
          decorative: normalizedDecorative(candidate.decorative),
        });
      }
    }
    Object.entries(candidate).forEach(([key, child]) => visit(child, `${path}.${key}`));
    ancestors.delete(candidate);
  };
  visit(value, "content_json");
  return references;
}

export function authoritativeMediaIdsFromJson(value: unknown) {
  return uniqueSortedMediaIds(authoritativeMediaReferencesFromJson(value));
}

export function authoritativeMediaReferencesFromHtml(html: string) {
  if (typeof html !== "string") {
    throw new EditorialMediaIdentityError("HTML редактора должен быть строкой.");
  }
  if (html.length > MAX_EDITORIAL_HTML_LENGTH) {
    throw new EditorialMediaIdentityError("HTML редактора превышает допустимый размер.");
  }

  const $ = loadEditorialHtml(html);
  const references: EditorialMediaReference[] = [];
  $("[data-media-id]").each((_, element) => {
    if (!$(element).is("img")) {
      throw new EditorialMediaIdentityError(
        "content_html: data-media-id разрешён только у изображения."
      );
    }
  });
  $("img").each((_, element) => {
    const image = $(element);
    const rawMediaId = image.attr("data-media-id");
    if (rawMediaId === undefined) return;
    const mediaId = normalizeAuthoritativeMediaId(
      rawMediaId,
      "content_html data-media-id"
    );
    if (!mediaId) return;
    references.push({
      mediaId,
      src: normalizedReferenceText(
        image.attr("src"),
        MAX_MEDIA_SOURCE_LENGTH,
        "content_html img src",
        true
      ),
      alt: normalizedReferenceText(
        image.attr("alt"),
        MAX_MEDIA_ALT_LENGTH,
        "content_html img alt"
      ),
      decorative: normalizedDecorative(image.attr("data-decorative")),
    });
  });

  return references;
}

export function authoritativeMediaIdsFromHtml(html: string) {
  return uniqueSortedMediaIds(authoritativeMediaReferencesFromHtml(html));
}

export function editorialMediaHtmlAccessibilityIssues(html: string) {
  if (typeof html !== "string" || html.length > MAX_EDITORIAL_HTML_LENGTH) {
    throw new EditorialMediaIdentityError("HTML редактора имеет недопустимый размер.");
  }
  const $ = loadEditorialHtml(html);
  const issues: string[] = [];
  $("img").each((index, element) => {
    const image = $(element);
    const decorative = normalizedDecorative(image.attr("data-decorative"));
    const alt = normalizedReferenceText(
      image.attr("alt"),
      MAX_MEDIA_ALT_LENGTH,
      `content_html img ${index + 1} alt`
    );
    if (!decorative && alt.length < 3) {
      issues.push(
        `добавьте описание к изображению ${index + 1} или отметьте его декоративным`
      );
    }
  });
  return issues;
}

export function assertEditorialMediaIdentityParity(
  contentJson: unknown,
  canonicalHtml: string,
  label = "Материал"
) {
  const jsonReferences = authoritativeMediaReferencesFromJson(contentJson);
  const htmlReferences = authoritativeMediaReferencesFromHtml(canonicalHtml);
  const jsonSignatures = jsonReferences.map(referenceSignature).sort();
  const htmlSignatures = htmlReferences.map(referenceSignature).sort();
  if (
    jsonSignatures.length !== htmlSignatures.length ||
    jsonSignatures.some((signature, index) => signature !== htmlSignatures[index])
  ) {
    throw new EditorialMediaIdentityError(
      `${label}: данные изображений в JSON и HTML расходятся. Обновите страницу и повторите сохранение.`
    );
  }
  return uniqueSortedMediaIds(jsonReferences);
}
