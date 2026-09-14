import { selectWriterDisplayName } from "../data/bookLocalization";
import type { Writer } from "../data/countries";

export function writerSearchLabel(
  writer: Writer,
  language: "ru" | "en"
) {
  const label = selectWriterDisplayName(writer, language, "").trim();
  if (!label) return null;
  if (
    language === "en" &&
    (label.toLocaleLowerCase("en") === "author" ||
      /\p{Script=Cyrillic}/u.test(label))
  ) {
    return null;
  }
  return label;
}

/**
 * Hidden index fields from the existing locale selectors only. A supported
 * opposite-locale label supplements the current canonical fields; it never
 * makes a writer eligible in a locale whose visible label is unavailable.
 */
export function writerSearchNames(
  writer: Writer,
  language: "ru" | "en"
): readonly string[] {
  const label = writerSearchLabel(writer, language);
  if (!label) return [];
  const oppositeLabel = writerSearchLabel(writer, language === "ru" ? "en" : "ru");
  return [...new Set([label, writer.name, writer.fullName, oppositeLabel]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value)))];
}
