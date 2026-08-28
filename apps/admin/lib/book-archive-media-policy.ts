export type BookArchiveBackgroundMedia = {
  mime_type?: unknown;
  alt_text?: unknown;
  creator?: unknown;
  source_url?: unknown;
  license_name?: unknown;
  license_url?: unknown;
};

const safeImageMimeTypes = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const editorialOriginalLicenseNames = new Set([
  "editorial-original",
  "editorial original",
  "original editorial artwork",
  "редакционное оригинальное изображение",
  "оригинал редакции",
]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedText(value: unknown) {
  return text(value).normalize("NFKC").toLocaleLowerCase("ru");
}


function safeOptionalHttps(value: unknown) {
  const candidate = text(value);
  if (!candidate) return true;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function bookArchiveBackgroundMediaIssue(
  media: BookArchiveBackgroundMedia | null | undefined
) {
  if (!media) return "Фоновое изображение не найдено или удалено.";
  if (!safeImageMimeTypes.has(text(media.mime_type).toLocaleLowerCase("en"))) {
    return "Для сцены разрешены только AVIF, JPEG, PNG и WebP.";
  }
  if (!text(media.alt_text)) return "У изображения нет текстового описания.";
  if (!text(media.creator)) return "У изображения не указан автор.";
  if (!text(media.license_name)) return "У изображения не указана лицензия или право использования.";
  if (
    !text(media.source_url) &&
    !editorialOriginalLicenseNames.has(normalizedText(media.license_name))
  ) {
    return "Для внешнего изображения должен быть указан HTTPS-источник.";
  }
  if (!safeOptionalHttps(media.source_url)) return "Источник изображения должен использовать HTTPS.";
  if (!safeOptionalHttps(media.license_url)) return "Ссылка на лицензию должна использовать HTTPS.";
  return "";
}

export function isBookArchiveBackgroundMediaSafe(
  media: BookArchiveBackgroundMedia | null | undefined
) {
  return !bookArchiveBackgroundMediaIssue(media);
}
