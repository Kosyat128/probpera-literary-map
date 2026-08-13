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
