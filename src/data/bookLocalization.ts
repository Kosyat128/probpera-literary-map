import type {
  WorkLocale,
  WorkProfile,
  WriterProfile,
} from "./countries/types";

export type LocalizedBookText = {
  locale: WorkLocale;
  title: string;
  description: string;
};

type BookWithWriter = WorkProfile & {
  writer?: WriterProfile;
  writerId?: string;
  writerName?: string;
};

const curatedEnglishBookWriterNames = new Map<string, string>([
  ["dostoevsky", "Fyodor Dostoevsky"],
  ["flaubert", "Gustave Flaubert"],
  ["j_r_r_tolkien", "J. R. R. Tolkien"],
  ["jerome_david_salinger", "J. D. Salinger"],
  ["saint_exupery", "Antoine de Saint-Exupéry"],
  ["tolstoy", "Leo Tolstoy"],
]);

const lowercaseNameParticles = new Set([
  "da",
  "de",
  "del",
  "der",
  "di",
  "dos",
  "la",
  "le",
  "van",
  "von",
]);

function stableWriterIdName(writerId: string) {
  const normalizedId = writerId.trim().toLocaleLowerCase("en");
  const curated = curatedEnglishBookWriterNames.get(normalizedId);
  if (curated) return curated;
  if (!/^\p{Script=Latin}+(?:[_-]\p{Script=Latin}+)*$/u.test(normalizedId)) {
    return "";
  }

  const parts = normalizedId.split(/[_-]+/u);
  if (
    parts.some((part) =>
      /^(?:author|draft|generated|unknown|writer)$/u.test(part)
    )
  ) {
    return "";
  }

  return parts
    .map((part, index) =>
      index > 0 && lowercaseNameParticles.has(part)
        ? part
        : `${part[0].toLocaleUpperCase("en")}${part.slice(1)}`
    )
    .join(" ");
}

function curatedWriterIdName(writerId: string) {
  return (
    curatedEnglishBookWriterNames.get(
      writerId.trim().toLocaleLowerCase("en")
    ) || ""
  );
}

function isProfessionalEnglishWriterName(value: string) {
  return (
    isEnglishSafe(value) &&
    !/^(?:author|writer)$/iu.test(value.trim())
  );
}

const englishLanguageNames = new Map<string, string>([
  ["английский", "English"],
  ["арабский", "Arabic"],
  ["бенгальский", "Bengali"],
  ["венгерский", "Hungarian"],
  ["датский", "Danish"],
  ["древнегреческий", "Ancient Greek"],
  ["испанский", "Spanish"],
  ["итальянский", "Italian"],
  ["китайский", "Chinese"],
  ["латинский", "Latin"],
  ["немецкий", "German"],
  ["нидерландский", "Dutch"],
  ["норвежский", "Norwegian"],
  ["польский", "Polish"],
  ["португальский", "Portuguese"],
  ["русский", "Russian"],
  ["турецкий", "Turkish"],
  ["французский", "French"],
  ["чешский", "Czech"],
  ["шведский", "Swedish"],
  ["японский", "Japanese"],
]);

function isEnglishSafe(value: string) {
  return /[A-Za-z]/u.test(value) && !/\p{Script=Cyrillic}/u.test(value);
}

export function selectWriterDisplayName(
  writer: WriterProfile,
  locale: WorkLocale,
  fallback = locale === "en" ? "Author" : "Автор"
) {
  const candidates =
    locale === "en"
      ? [writer.fullName, writer.name]
      : [writer.name, writer.fullName];
  const selected = candidates.find((candidate) => {
    const value = candidate?.trim() || "";
    return value && (locale === "ru" || isEnglishSafe(value));
  });
  if (selected?.trim()) return selected.trim();
  if (locale === "en") {
    // Search and writer profiles must not turn an arbitrary technical ID into
    // a visitor-facing identity. Only explicitly reviewed spellings are safe
    // here. Book cards may still derive a conservative label from a stable ID
    // after the bilingual publication gate has passed.
    const curatedName = curatedWriterIdName(writer.id);
    if (isProfessionalEnglishWriterName(curatedName)) return curatedName;
  }
  return fallback;
}

export function selectWriterYears(
  writer: WriterProfile,
  locale: WorkLocale
) {
  const stored = writer.years?.trim() || "";
  if (locale === "ru" || !/\p{Script=Cyrillic}/u.test(stored)) return stored;
  const birthYear = (writer.birthDate || writer.birth || "").match(
    /-?\d{3,4}/u
  )?.[0];
  const deathYear = (writer.deathDate || writer.death || "").match(
    /-?\d{3,4}/u
  )?.[0];
  if (birthYear) return `${birthYear}–${deathYear || ""}`;
  return stored.match(/-?\d{3,4}/u)?.[0] || "";
}

export function selectBookWriterName(
  work: BookWithWriter,
  locale: WorkLocale,
  fallback = locale === "en" ? "Author" : "Автор"
) {
  if (locale === "ru") {
    if (work.writer) return selectWriterDisplayName(work.writer, locale, fallback);
    return work.writerName?.trim() || fallback;
  }

  const profileName = work.writer
    ? selectWriterDisplayName(work.writer, locale, "")
    : "";
  if (isProfessionalEnglishWriterName(profileName)) return profileName;

  const stored = work.writerName?.trim() || "";
  if (isProfessionalEnglishWriterName(stored)) return stored;

  const stableName = stableWriterIdName(work.writer?.id || work.writerId || "");
  return stableName || fallback;
}

export function selectBookOriginalLanguage(
  work: WorkProfile,
  locale: WorkLocale
) {
  const value = work.originalLanguage?.trim() || "";
  if (locale === "ru" || !value) return value;
  if (isEnglishSafe(value)) return value;
  return englishLanguageNames.get(value.toLocaleLowerCase("ru")) || "";
}

export function selectBookMetadataLabels(
  work: WorkProfile,
  locale: WorkLocale,
  translate: (value: string) => string = (value) => value
) {
  const labels = [...(work.genres || []), ...(work.tags || [])];
  const localized = labels
    .map((label) => (locale === "en" ? translate(label) : label).trim())
    .filter((label) => label && (locale === "ru" || isEnglishSafe(label)));
  return [...new Set(localized)];
}

/**
 * Returns text from the requested locale record only. In particular, English
 * UI must never silently fall back to the legacy top-level Russian fields.
 * Public callers already receive books that passed the bilingual gate, while
 * empty strings keep accidental draft callers from leaking another language.
 */
export function selectBookText(
  work: WorkProfile,
  locale: WorkLocale
): LocalizedBookText {
  const translation = work.translations?.[locale];
  if (!translation || translation.locale !== locale) {
    return { locale, title: "", description: "" };
  }
  return {
    locale,
    title: translation.title.trim(),
    description: translation.description.trim(),
  };
}
